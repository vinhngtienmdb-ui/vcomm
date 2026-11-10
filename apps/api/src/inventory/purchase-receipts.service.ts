// Phiếu nhập mua theo đơn mua, kiểm tra chất lượng, phiếu trả hàng nhà cung cấp (CHUC_NANG_52, 53; QUYTAC_NGHIEPVU_64 đến 66; API_76).
// Module Kho ghi phiếu, đọc đơn mua của module Mua hàng; trạng thái "Đã nhận đủ" của đơn do module Mua hàng cập nhật qua PurchaseOrdersService.
// Phiếu có chứng từ gốc nên không đi luồng duyệt.
import { Inject, Injectable } from "@nestjs/common";
import type { qualityCheckSchema, savePurchaseReceiptSchema, savePurchaseReturnSchema, saveStockDocumentSchema, StockDocumentResponse } from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { checkingOnOrderLine, PurchaseOrdersService, receivedOnOrderLine } from "../purchasing/orders.service";
import { readSettings } from "../purchasing/supplier-prices.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { documentTypeCodes, prefixes, StockDocumentsService } from "./stock-documents.service";
import { pgArray } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

type Executor = Pick<Database, "execute" | "insert">;
type FieldErrors = Record<string, keyof Messages["errors"]>;
type DocumentInput = z.output<typeof saveStockDocumentSchema>;
type ReceiptInput = z.output<typeof savePurchaseReceiptSchema>;
type ReturnInput = z.output<typeof savePurchaseReturnSchema>;
type OrderRow = { id: string; company_id: string; document_no: string; supplier_id: string; warehouse_id: string; status: string };
type OrderLineRow = { id: string; variant_id: string; unit_id: string; unit_price: string; base_quantity: string; received: string; checking: string };

@Injectable()
export class PurchaseReceiptsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly documents: StockDocumentsService,
    private readonly warehouses: WarehousesService,
    private readonly orders: PurchaseOrdersService,
  ) {}

  // Đơn mua đã duyệt còn nhận được, nhận vào kho người dùng nhập mua được.
  async openOrders(actor: Actor, search: string | undefined): Promise<{ id: string; documentNo: string; supplierName: string; warehouseId: string; warehouseName: string; companyName: string }[]> {
    const { operable } = await this.warehouses.stockScope(actor);
    const allowed: string[] = [];
    for (const warehouseId of operable) {
      const warehouse = await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.receivePurchases).catch(() => null);
      if (warehouse) allowed.push(warehouseId);
    }
    if (allowed.length === 0) return [];
    const pattern = search ? `%${search.replace(/[%_\\]/g, (character) => `\\${character}`)}%` : null;
    const rows = await this.database.execute<{ id: string; document_no: string; supplier_name: string; warehouse_id: string; warehouse_name: string; company_name: string }>(sql`
      SELECT o.id, o.document_no, s.name AS supplier_name, o.warehouse_id, w.name AS warehouse_name, c.short_name AS company_name
      FROM purchasing.orders o JOIN crm.partners s ON s.id = o.supplier_id JOIN inventory.warehouses w ON w.id = o.warehouse_id JOIN core.companies c ON c.id = o.company_id
      WHERE o.status = 'approved' AND o.warehouse_id = ANY(${pgArray(allowed)}::uuid[])
        AND (${pattern}::text IS NULL OR o.document_no ILIKE ${pattern} OR s.name ILIKE ${pattern})
      ORDER BY o.expected_date NULLS LAST, o.document_no LIMIT 50`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      supplierName: row.supplier_name,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      companyName: row.company_name,
    }));
  }

  // Dòng đơn mua kèm số còn nhận được (đơn vị cơ sở), để lập phiếu nhập.
  async orderLines(actor: Actor, orderId: string) {
    const order = await this.order(this.database, orderId);
    await this.warehouses.operable(actor.userId, order.warehouse_id, inventoryPermissions.receivePurchases);
    const tolerance = await this.tolerance(order.company_id);
    const rows = await this.database.execute<
      OrderLineRow & { sku: string; product_name: string; option_values: string[]; unit_name: string; quantity: string; tracks_lots: boolean; tracks_serials: boolean; requires_quality_check: boolean }
    >(sql`
      SELECT ol.id, ol.variant_id, ol.unit_id, ol.unit_price::text, ol.base_quantity::text, ol.quantity::text, v.sku, p.name AS product_name, v.option_values, u.name_vi AS unit_name,
        p.tracks_lots, p.tracks_serials, cat.requires_quality_check,
        ${receivedOnOrderLine(sql`ol.id`)}::text AS received, ${checkingOnOrderLine(sql`ol.id`)}::text AS checking
      FROM purchasing.order_lines ol JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = ol.unit_id
      JOIN catalog.categories cat ON cat.id = p.category_id
      WHERE ol.order_id = ${orderId} ORDER BY ol.line_no`);
    return {
      id: order.id,
      documentNo: order.document_no,
      warehouseId: order.warehouse_id,
      companyId: order.company_id,
      lines: rows.rows.map((row) => {
        const factor = Number(row.base_quantity) / Number(row.quantity);
        const receivable = Math.max(0, Number(row.base_quantity) * (1 + tolerance / 100) - Number(row.received) - Number(row.checking));
        return {
          orderLineId: row.id,
          variantId: row.variant_id,
          sku: row.sku,
          productName: row.product_name,
          optionValues: row.option_values,
          unitId: row.unit_id,
          unitName: row.unit_name,
          factor: String(factor),
          orderedQuantity: String(Number(row.quantity)),
          receivableQuantity: String(Number((receivable / factor).toFixed(4))),
          tracksLots: row.tracks_lots,
          tracksSerials: row.tracks_serials,
          requiresQualityCheck: row.requires_quality_check,
        };
      }),
    };
  }

  async createReceipt(actor: Actor, input: ReceiptInput): Promise<StockDocumentResponse> {
    const order = await this.order(this.database, input.orderId);
    if (order.status !== "approved") throw new ApiError("BUSINESS_RULE", "purchaseOrderNotOpen");
    const { documentInput, sourceLines } = await this.receiptInput(order, input);
    const prepared = await this.documents.prepare(actor, documentInput, inventoryPermissions.receivePurchases);
    await this.checkReceivable(this.database, order, input);
    const id = await this.database.transaction(async (transaction) => {
      const documentId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, source_type, source_id, partner_id, created_by)
        VALUES (${order.company_id}, ${order.warehouse_id}, 'purchase_receipt', ${input.documentDate}::date, 'purchase', ${documentInput.reason}, ${input.note}, 'purchasing.order',
          ${order.id}, ${order.supplier_id}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, documentId, documentInput, prepared, sourceLines);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: order.company_id, action: "stock_document.create", entityId: documentId, afterData: input }, transaction);
      return documentId;
    });
    return this.documents.detail(actor, id);
  }

  async updateReceipt(actor: Actor, id: string, input: ReceiptInput): Promise<StockDocumentResponse> {
    const row = await this.ownDraft(actor, id, "purchase_receipt");
    if (row.source_id !== input.orderId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { orderId: "documentHeaderLocked" } });
    const order = await this.order(this.database, input.orderId);
    const { documentInput, sourceLines } = await this.receiptInput(order, input);
    const prepared = await this.documents.prepare(actor, documentInput, inventoryPermissions.receivePurchases);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.documents SET document_date = ${input.documentDate}::date, note = ${input.note}, version = version + 1, updated_at = now()
        WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM inventory.document_lines WHERE document_id = ${id}`);
      await this.writeLines(transaction, id, documentInput, prepared, sourceLines);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.update", entityId: id, afterData: input }, transaction);
    });
    return this.documents.detail(actor, id);
  }

  // Phiếu trả lập từ phiếu nhập mua đã ghi sổ; đơn giá là giá nhập gốc theo đơn vị của dòng; lô, vị trí theo dòng gốc (QUYTAC_NGHIEPVU_66).
  async createReturn(actor: Actor, input: ReturnInput): Promise<StockDocumentResponse> {
    const receipt = await this.documents.visibleRow(actor, input.receiptId);
    if (receipt.type !== "purchase_receipt" || receipt.status !== "posted") throw new ApiError("BUSINESS_RULE", "purchaseReceiptNotPosted");
    const { documentInput, sourceLines } = await this.returnInput(receipt, input);
    const prepared = await this.documents.prepare(actor, documentInput, inventoryPermissions.receivePurchases);
    const id = await this.database.transaction(async (transaction) => {
      const documentId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, source_type, source_id, partner_id, created_by)
        VALUES (${receipt.company_id}, ${receipt.warehouse_id}, 'purchase_return', ${input.documentDate}::date, 'purchase_return', ${input.reason}, ${input.note}, 'inventory.document',
          ${receipt.id}, ${receipt.partner_id}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, documentId, documentInput, prepared, sourceLines);
      await this.auditService.record(
        { ...inventoryAudit(actor, "stock_document"), companyId: receipt.company_id, action: "stock_document.create", entityId: documentId, afterData: input },
        transaction,
      );
      return documentId;
    });
    return this.documents.detail(actor, id);
  }

  async updateReturn(actor: Actor, id: string, input: ReturnInput): Promise<StockDocumentResponse> {
    const row = await this.ownDraft(actor, id, "purchase_return");
    if (row.source_id !== input.receiptId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { receiptId: "documentHeaderLocked" } });
    const receipt = await this.documents.visibleRow(actor, input.receiptId);
    const { documentInput, sourceLines } = await this.returnInput(receipt, input);
    const prepared = await this.documents.prepare(actor, documentInput, inventoryPermissions.receivePurchases);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.documents SET document_date = ${input.documentDate}::date, reason = ${input.reason}, note = ${input.note}, version = version + 1, updated_at = now()
        WHERE id = ${id} AND status = 'draft' AND version = ${input.version ?? row.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM inventory.document_lines WHERE document_id = ${id}`);
      await this.writeLines(transaction, id, documentInput, prepared, sourceLines);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.update", entityId: id, afterData: input }, transaction);
    });
    return this.documents.detail(actor, id);
  }

  // Gửi phiếu nhập mua: khóa đơn mua, kiểm dung sai; cần kiểm tra chất lượng thì chờ kiểm, còn lại ghi sổ ngay. Gửi phiếu trả: kiểm số đã nhập rồi ghi sổ.
  async submit(actor: Actor, id: string): Promise<StockDocumentResponse> {
    const row = await this.documents.visibleRow(actor, id);
    if (row.type !== "purchase_receipt" && row.type !== "purchase_return") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.ownDraft(actor, id, row.type);
    const typeCode = documentTypeCodes[row.type];
    const ownerActor: Actor = { ...actor, companyId: row.company_id };
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${row.company_id} AND document_type_code = ${typeCode} LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update(ownerActor, typeCode, { prefix: prefixes[row.type], resetPeriod: "year", padding: 6 });
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'draft' AND version = ${row.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const lines = await this.documents.lines(id, transaction);
      let fields: FieldErrors = {};
      let orderId: string | null = null;
      if (row.type === "purchase_receipt") {
        const order = await this.order(transaction, row.source_id!, true);
        if (order.status !== "approved") throw new ApiError("BUSINESS_RULE", "purchaseOrderNotOpen");
        orderId = order.id;
        fields = await this.receivableErrors(
          transaction,
          order,
          lines.map((line) => ({ orderLineId: line.source_line_id!, baseQuantity: Number(line.base_quantity) })),
        );
      } else {
        fields = await this.returnableErrors(
          transaction,
          lines.map((line) => ({ receiptLineId: line.source_line_id!, baseQuantity: Math.abs(Number(line.base_quantity)) })),
        );
      }
      Object.assign(fields, await this.documents.checkForSubmit(row, lines));
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const documentNo = await this.sequences.next(row.company_id, typeCode, transaction);
      const checking = row.type === "purchase_receipt" && lines.some((line) => line.requires_quality_check);
      await transaction.execute(sql`
        UPDATE inventory.documents SET status = ${checking ? "quality_check" : "pending"}, document_no = ${documentNo}, submitted_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!checking) await this.documents.postDocument(transaction, id);
      if (orderId && !checking) await this.orders.refreshReceived(transaction, orderId);
      await this.auditService.record(
        { ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.submit", entityId: id, afterData: { documentNo, qualityCheck: checking } },
        transaction,
      );
    });
    return this.documents.detail(actor, id);
  }

  // Kết quả kiểm tra chất lượng: phần đạt ghi sổ kho, phần không đạt ghi biên bản kèm lý do, không tính vào số đã nhận (QUYTAC_NGHIEPVU_65).
  async qualityCheck(actor: Actor, id: string, input: z.output<typeof qualityCheckSchema>): Promise<StockDocumentResponse> {
    const row = await this.documents.visibleRow(actor, id);
    if (row.type !== "purchase_receipt" || row.status !== "quality_check") throw new ApiError("BUSINESS_RULE", "documentNotInQualityCheck");
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.receivePurchases);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'quality_check' AND version = ${input.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const lines = await this.documents.lines(id, transaction);
      const fields: FieldErrors = {};
      const results = new Map(input.lines.map((line) => [line.lineId, line]));
      for (const [index, line] of lines.entries()) {
        const result = results.get(line.id);
        if (!result) continue;
        const at = (field: string) => `lines.${index}.${field}`;
        const factor = Number(line.base_quantity) / Number(line.quantity);
        let rejected = Number(result.rejectedQuantity) * factor;
        if (line.tracks_serials) {
          if (result.rejectedSerials.some((serial) => !line.serials.includes(serial))) fields[at("rejectedSerials")] = "serialNotInStock";
          rejected = result.rejectedSerials.length;
        }
        if (rejected > Number(line.base_quantity) + 0.00005) fields[at("rejectedQuantity")] = "invalidValue";
        if (rejected > 0 && !result.rejectionReason) fields[at("rejectionReason")] = "required";
        if (Object.keys(fields).length > 0) continue;
        if (rejected === 0) continue;
        // Serial không đạt bỏ khỏi dòng (không vào kho), ghi vào biên bản.
        const reason = line.tracks_serials ? `${result.rejectionReason} (${result.rejectedSerials.join(", ")})` : result.rejectionReason;
        await transaction.execute(sql`UPDATE inventory.document_lines SET rejected_base_quantity = ${rejected.toFixed(4)}::numeric, rejection_reason = ${reason} WHERE id = ${line.id}`);
        if (line.tracks_serials) {
          await transaction.execute(
            sql`DELETE FROM inventory.document_line_serials WHERE line_id = ${line.id} AND serial_no = ANY(${pgArray(result.rejectedSerials)}::text[])`,
          );
        }
      }
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      await transaction.execute(sql`UPDATE inventory.documents SET quality_checked_at = now(), quality_checked_by = ${actor.userId}, version = version + 1 WHERE id = ${id}`);
      await this.documents.postDocument(transaction, id);
      await this.orders.refreshReceived(transaction, row.source_id!);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.quality_check", entityId: id, afterData: input }, transaction);
    });
    return this.documents.detail(actor, id);
  }

  private async receiptInput(order: OrderRow, input: ReceiptInput): Promise<{ documentInput: DocumentInput; sourceLines: string[] }> {
    const orderLines = new Map(
      (
        await this.database.execute<{ id: string; variant_id: string; unit_id: string; unit_price: string }>(
          sql`SELECT id, variant_id, unit_id, unit_price::text FROM purchasing.order_lines WHERE order_id = ${order.id}`,
        )
      ).rows.map((row) => [row.id, row]),
    );
    const fields: FieldErrors = {};
    const lines = input.lines.map((line, index) => {
      const source = orderLines.get(line.orderLineId);
      if (!source) fields[`lines.${index}.orderLineId`] = "invalidValue";
      return {
        variantId: source?.variant_id ?? "00000000-0000-0000-0000-000000000000",
        unitId: source?.unit_id ?? "00000000-0000-0000-0000-000000000000",
        quantity: line.quantity,
        unitCost: source?.unit_price ?? "0",
        lotId: null,
        lotNo: line.lotNo ?? null,
        manufacturedOn: line.manufacturedOn ?? null,
        expiresOn: line.expiresOn ?? null,
        lotOverrideReason: null,
        locationId: line.locationId ?? null,
        destinationLocationId: null,
        serials: line.serials,
        responsibleUserId: null,
        compensationAmount: null,
      };
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const documentInput = {
      type: "purchase_receipt",
      warehouseId: order.warehouse_id,
      companyId: order.company_id,
      documentDate: input.documentDate,
      reasonCode: "purchase",
      reason: `Nhập mua theo đơn ${order.document_no}`,
      note: input.note,
      lines,
    } as DocumentInput;
    return { documentInput, sourceLines: input.lines.map((line) => line.orderLineId) };
  }

  private async returnInput(receipt: { id: string; warehouse_id: string; company_id: string }, input: ReturnInput): Promise<{ documentInput: DocumentInput; sourceLines: string[] }> {
    const receiptLines = new Map((await this.documents.lines(receipt.id)).map((line) => [line.id, line]));
    const fields: FieldErrors = {};
    const lines = input.lines.map((line, index) => {
      const source = receiptLines.get(line.receiptLineId);
      if (!source) {
        fields[`lines.${index}.receiptLineId`] = "invalidValue";
        return null;
      }
      const accepted = Number(source.base_quantity) - Number(source.rejected_base_quantity ?? 0);
      const factor = Number(source.base_quantity) / Number(source.quantity);
      // Đơn giá trả theo đơn vị của dòng gốc = giá trị đã ghi sổ / số đã nhập × hệ số.
      const unitCost = accepted > 0 ? ((Number(source.cost_value ?? 0) / accepted) * factor).toFixed(4) : "0";
      if (line.serials.some((serial) => !source.serials.includes(serial))) fields[`lines.${index}.serials`] = "serialNotInStock";
      return {
        variantId: source.variant_id,
        unitId: source.unit_id,
        quantity: line.quantity,
        unitCost,
        lotId: source.lot_id,
        lotNo: null,
        manufacturedOn: null,
        expiresOn: null,
        lotOverrideReason: null,
        locationId: source.location_id,
        destinationLocationId: null,
        serials: line.serials,
        responsibleUserId: null,
        compensationAmount: null,
      };
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const documentInput = {
      type: "purchase_return",
      warehouseId: receipt.warehouse_id,
      companyId: receipt.company_id,
      documentDate: input.documentDate,
      reasonCode: "purchase_return",
      reason: input.reason,
      note: input.note,
      lines,
    } as DocumentInput;
    return { documentInput, sourceLines: input.lines.map((line) => line.receiptLineId) };
  }

  private async writeLines(transaction: Executor, documentId: string, input: DocumentInput, prepared: Awaited<ReturnType<StockDocumentsService["prepare"]>>, sourceLines: string[]): Promise<void> {
    await this.documents.writeLines(transaction, documentId, input, prepared);
    for (const [index, sourceLineId] of sourceLines.entries()) {
      await transaction.execute(sql`UPDATE inventory.document_lines SET source_line_id = ${sourceLineId} WHERE document_id = ${documentId} AND line_no = ${index + 1}`);
    }
  }

  // Lập nháp: báo sớm khi vượt số còn nhận được (chưa khóa); gửi: kiểm lại trong giao dịch đã khóa đơn mua.
  private async checkReceivable(executor: Executor, order: OrderRow, input: ReceiptInput): Promise<void> {
    const factors = new Map(
      (await executor.execute<{ id: string; factor: string }>(sql`SELECT id, (base_quantity / quantity)::text AS factor FROM purchasing.order_lines WHERE order_id = ${order.id}`)).rows.map((row) => [
        row.id,
        Number(row.factor),
      ]),
    );
    const fields = await this.receivableErrors(
      executor,
      order,
      input.lines.map((line) => ({ orderLineId: line.orderLineId, baseQuantity: Number(line.quantity) * (factors.get(line.orderLineId) ?? 0) })),
    );
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  // Tổng đã nhận (đã ghi sổ, đang chờ kiểm) cộng lần này không vượt số đặt cộng dung sai (QUYTAC_NGHIEPVU_64).
  private async receivableErrors(executor: Executor, order: OrderRow, lines: { orderLineId: string; baseQuantity: number }[]): Promise<FieldErrors> {
    const tolerance = await this.tolerance(order.company_id, executor);
    const rows = new Map(
      (
        await executor.execute<OrderLineRow>(sql`
        SELECT ol.id, ol.base_quantity::text, ${receivedOnOrderLine(sql`ol.id`)}::text AS received, ${checkingOnOrderLine(sql`ol.id`)}::text AS checking
        FROM purchasing.order_lines ol WHERE ol.order_id = ${order.id}`)
      ).rows.map((row) => [row.id, row]),
    );
    const totals = new Map<string, number>();
    const fields: FieldErrors = {};
    lines.forEach((line, index) => {
      const row = rows.get(line.orderLineId);
      if (!row) {
        fields[`lines.${index}.orderLineId`] = "invalidValue";
        return;
      }
      const total = (totals.get(line.orderLineId) ?? 0) + line.baseQuantity;
      totals.set(line.orderLineId, total);
      const allowed = Number(row.base_quantity) * (1 + tolerance / 100) - Number(row.received) - Number(row.checking);
      if (total > allowed + 0.00005) fields[`lines.${index}.quantity`] = "purchaseOverReceipt";
    });
    return fields;
  }

  // Tổng trả của mỗi dòng phiếu nhập không vượt số đã nhập (phần đạt) trừ số đã trả (QUYTAC_NGHIEPVU_66).
  private async returnableErrors(executor: Executor, lines: { receiptLineId: string; baseQuantity: number }[]): Promise<FieldErrors> {
    const fields: FieldErrors = {};
    const totals = new Map<string, number>();
    for (const [index, line] of lines.entries()) {
      const row = (
        await executor.execute<{ accepted: string; returned: string }>(sql`
        SELECT (dl.base_quantity - coalesce(dl.rejected_base_quantity, 0))::text AS accepted,
          coalesce((SELECT sum(rl.base_quantity) FROM inventory.document_lines rl JOIN inventory.documents r ON r.id = rl.document_id
                    WHERE rl.source_line_id = dl.id AND r.type = 'purchase_return' AND r.status = 'posted'), 0)::text AS returned
        FROM inventory.document_lines dl WHERE dl.id = ${line.receiptLineId} FOR UPDATE`)
      ).rows[0];
      if (!row) {
        fields[`lines.${index}.receiptLineId`] = "invalidValue";
        continue;
      }
      const total = (totals.get(line.receiptLineId) ?? 0) + line.baseQuantity;
      totals.set(line.receiptLineId, total);
      if (total > Number(row.accepted) - Number(row.returned) + 0.00005) fields[`lines.${index}.quantity`] = "purchaseReturnExceeded";
    }
    return fields;
  }

  private async ownDraft(actor: Actor, id: string, type: "purchase_receipt" | "purchase_return") {
    const row = await this.documents.visibleRow(actor, id);
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.receivePurchases);
    if (row.type !== type) throw new ApiError("NOT_FOUND", "notFound");
    if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    return row;
  }

  private async order(executor: Executor, id: string, lock = false): Promise<OrderRow> {
    const row = (
      await executor.execute<OrderRow>(
        lock
          ? sql`SELECT id, company_id, document_no, supplier_id, warehouse_id, status FROM purchasing.orders WHERE id = ${id} FOR UPDATE`
          : sql`SELECT id, company_id, document_no, supplier_id, warehouse_id, status FROM purchasing.orders WHERE id = ${id}`,
      )
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async tolerance(companyId: string, executor: Executor = this.database): Promise<number> {
    return Number((await readSettings(executor, companyId)).overReceiptTolerancePercent);
  }
}
