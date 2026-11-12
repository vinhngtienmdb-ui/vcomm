// Phiếu xuất giao hàng theo đơn bán, phiếu nhận hàng trả lại (CHUC_NANG_56, 57; QUYTAC_NGHIEPVU_70 đến 72; API_79).
// Module Kho ghi phiếu, đọc đơn bán của module Bán hàng; trạng thái "Đã giao đủ" của đơn do module Bán hàng cập nhật qua SalesOrdersService.
// Phiếu có chứng từ gốc nên không đi luồng duyệt.
import { Inject, Injectable } from "@nestjs/common";
import type { saveSalesIssueSchema, saveSalesReturnSchema, saveStockDocumentSchema, StockDocumentResponse } from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { linkedVariant } from "../catalog/variant-links.service";
import { deliveredOnOrderLine, requireNotMarketplace, salesOrderSource, SalesOrdersService } from "../sales/sales-orders.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { ReservationsService } from "./reservations.service";
import { documentTypeCodes, prefixes, StockDocumentsService } from "./stock-documents.service";
import { pgArray } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

type Executor = Pick<Database, "execute" | "insert">;
type FieldErrors = Record<string, keyof Messages["errors"]>;
type DocumentInput = z.output<typeof saveStockDocumentSchema>;
type IssueInput = z.output<typeof saveSalesIssueSchema>;
type ReturnInput = z.output<typeof saveSalesReturnSchema>;
type OrderRow = { id: string; company_id: string; document_no: string; customer_id: string | null; warehouse_id: string; status: string };

@Injectable()
export class SalesDeliveriesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly documents: StockDocumentsService,
    private readonly warehouses: WarehousesService,
    private readonly reservations: ReservationsService,
    private readonly orders: SalesOrdersService,
  ) {}

  // Đơn bán đã xác nhận còn phải giao, xuất từ kho người dùng giao hàng được.
  async openOrders(actor: Actor, search: string | undefined) {
    const { operable } = await this.warehouses.stockScope(actor);
    const allowed: string[] = [];
    for (const warehouseId of operable) {
      if (await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.issueSales).catch(() => null)) allowed.push(warehouseId);
    }
    if (allowed.length === 0) return [];
    const pattern = search ? `%${search.replace(/[%_\\]/g, (character) => `\\${character}`)}%` : null;
    const rows = await this.database.execute<{ id: string; document_no: string; customer_name: string | null; buyer_name: string | null; warehouse_id: string; warehouse_name: string }>(sql`
      SELECT o.id, o.document_no, c.name AS customer_name, o.buyer_name, o.warehouse_id, w.name AS warehouse_name
      FROM sales.orders o LEFT JOIN crm.partners c ON c.id = o.customer_id JOIN inventory.warehouses w ON w.id = o.warehouse_id
      WHERE o.status = 'confirmed' AND o.warehouse_id = ANY(${pgArray(allowed)}::uuid[])
        -- Đơn chỉ gồm dịch vụ không qua kho (QUYTAC_NGHIEPVU_275).
        AND EXISTS (SELECT 1 FROM sales.order_lines gl JOIN catalog.variants gv ON gv.id = gl.variant_id JOIN catalog.products gp ON gp.id = gv.product_id WHERE gl.order_id = o.id AND gp.kind = 'goods')
        AND (${pattern}::text IS NULL OR o.document_no ILIKE ${pattern} OR c.name ILIKE ${pattern} OR o.buyer_name ILIKE ${pattern})
      ORDER BY o.order_date, o.document_no LIMIT 50`);
    return rows.rows.map((row) => ({ id: row.id, documentNo: row.document_no, customerName: row.customer_name ?? row.buyer_name, warehouseId: row.warehouse_id, warehouseName: row.warehouse_name }));
  }

  // Dòng đơn bán kèm số còn phải giao, để lập phiếu xuất.
  async orderLines(actor: Actor, orderId: string) {
    const order = await this.order(this.database, orderId);
    // Kho chỉ xem đơn đã xác nhận trở đi; đơn nháp, chờ duyệt chưa phải việc của kho.
    if (!["confirmed", "delivered", "closed"].includes(order.status)) throw new ApiError("NOT_FOUND", "notFound");
    await this.warehouses.operable(actor.userId, order.warehouse_id, inventoryPermissions.issueSales);
    const rows = await this.database.execute<{
      id: string;
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      unit_id: string;
      unit_name: string;
      quantity: string;
      base_quantity: string;
      tracks_lots: boolean;
      tracks_serials: boolean;
      delivered: string;
    }>(sql`
      SELECT l.id, l.variant_id, v.sku, p.name AS product_name, v.option_values, l.unit_id, u.name_vi AS unit_name, l.quantity::text, l.base_quantity::text, p.tracks_lots, p.tracks_serials,
        ${deliveredOnOrderLine(sql`l.id`)}::text AS delivered
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.order_id = ${orderId} AND p.kind = 'goods' ORDER BY l.line_no`);
    return {
      id: order.id,
      documentNo: order.document_no,
      warehouseId: order.warehouse_id,
      companyId: order.company_id,
      lines: rows.rows.map((row) => {
        const factor = Number(row.base_quantity) / Number(row.quantity);
        return {
          orderLineId: row.id,
          variantId: row.variant_id,
          sku: row.sku,
          productName: row.product_name,
          optionValues: row.option_values,
          unitId: row.unit_id,
          unitName: row.unit_name,
          orderedQuantity: String(Number(row.quantity)),
          remainingQuantity: String(Number((Math.max(0, Number(row.base_quantity) - Number(row.delivered)) / factor).toFixed(4))),
          tracksLots: row.tracks_lots,
          tracksSerials: row.tracks_serials,
        };
      }),
    };
  }

  // marketplace: lập từ màn hình đơn VComm (CONG_VIEC_24); từ màn hình phiếu kho thì không nhận đơn VComm.
  async createIssue(actor: Actor, input: IssueInput, marketplace = false): Promise<StockDocumentResponse> {
    if (!marketplace) await requireNotMarketplace(this.database, input.orderId);
    const order = await this.order(this.database, input.orderId);
    if (order.status !== "confirmed") throw new ApiError("BUSINESS_RULE", "salesOrderNotOpen");
    await this.requireInternalReady(this.database, order.id);
    const { documentInput, sourceLines } = await this.issueInput(order, input);
    const prepared = await this.documents.prepare(actor, documentInput, inventoryPermissions.issueSales);
    const fields = await this.deliverableErrors(this.database, order.id, documentInput, sourceLines);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const id = await this.database.transaction(async (transaction) => {
      const documentId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, source_type, source_id, partner_id, created_by)
        VALUES (${order.company_id}, ${order.warehouse_id}, 'sales_issue', ${input.documentDate}::date, 'sale', ${documentInput.reason}, ${input.note}, ${salesOrderSource}, ${order.id},
          ${order.customer_id}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, documentId, documentInput, prepared, sourceLines);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: order.company_id, action: "stock_document.create", entityId: documentId, afterData: input }, transaction);
      return documentId;
    });
    return this.documents.detail(actor, id);
  }

  // Phiếu nhận hàng trả lại lập từ phiếu xuất giao hàng đã ghi sổ; số lượng, đơn giá theo đơn vị cơ sở, đơn giá là giá vốn phiếu xuất gốc; lô, vị trí theo dòng gốc (QUYTAC_NGHIEPVU_72).
  async createReturn(actor: Actor, input: ReturnInput): Promise<StockDocumentResponse> {
    const issue = await this.documents.visibleRow(actor, input.issueId);
    if (issue.type !== "sales_issue" || issue.status !== "posted") throw new ApiError("BUSINESS_RULE", "salesIssueNotPosted");
    await requireNotMarketplace(this.database, issue.source_id);
    const issueLines = new Map((await this.documents.lines(issue.id)).map((line) => [line.id, line]));
    const fields: FieldErrors = {};
    const lines = input.lines.map((line, index) => {
      const source = issueLines.get(line.issueLineId);
      if (!source) {
        fields[`lines.${index}.issueLineId`] = "invalidValue";
        return null;
      }
      // Trả theo đơn vị cơ sở để trả được một phần của dòng giao theo đơn vị quy đổi (ví dụ giao 1 hộp, trả 1 cái).
      const issued = Math.abs(Number(source.base_quantity));
      const unitCost = issued > 0 ? (Math.abs(Number(source.cost_value ?? 0)) / issued).toFixed(4) : "0";
      if (line.serials.some((serial) => !source.serials.includes(serial))) fields[`lines.${index}.serials`] = "serialNotInStock";
      return {
        variantId: source.variant_id,
        unitId: source.base_unit_id,
        quantity: line.quantity,
        unitCost,
        lotId: null,
        lotNo: source.lot_no,
        manufacturedOn: source.manufactured_on,
        expiresOn: source.expires_on,
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
      type: "sales_return",
      warehouseId: issue.warehouse_id,
      companyId: issue.company_id,
      documentDate: input.documentDate,
      reasonCode: "sales_return",
      reason: input.reason,
      note: input.note,
      lines,
    } as DocumentInput;
    const prepared = await this.documents.prepare(actor, documentInput, inventoryPermissions.issueSales);
    const id = await this.database.transaction(async (transaction) => {
      const documentId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, source_type, source_id, partner_id, created_by)
        VALUES (${issue.company_id}, ${issue.warehouse_id}, 'sales_return', ${input.documentDate}::date, 'sales_return', ${input.reason}, ${input.note}, 'inventory.document', ${issue.id},
          ${issue.partner_id}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(
        transaction,
        documentId,
        documentInput,
        prepared,
        input.lines.map((line) => line.issueLineId),
      );
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: issue.company_id, action: "stock_document.create", entityId: documentId, afterData: input }, transaction);
      return documentId;
    });
    return this.documents.detail(actor, id);
  }

  // Gửi phiếu xuất: khóa đơn bán, kiểm số còn phải giao, dùng phần hàng đã giữ rồi ghi sổ. Gửi phiếu trả: kiểm số đã giao còn trả được rồi ghi sổ.
  async submit(actor: Actor, id: string): Promise<StockDocumentResponse> {
    const row = await this.ownDraft(actor, id);
    await this.ensureSequences(actor, row.company_id);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'draft' AND version = ${row.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.postDraft(transaction, { ...row, type: row.type as "sales_issue" | "sales_return" }, actor);
    });
    return this.documents.detail(actor, id);
  }

  // Dãy số phiếu xuất giao hàng, phiếu nhận hàng trả lại của công ty; tạo ngoài giao dịch ghi sổ.
  async ensureSequences(actor: Actor, companyId: string): Promise<void> {
    for (const type of ["sales_issue", "sales_return"] as const) {
      const typeCode = documentTypeCodes[type];
      const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${companyId} AND document_type_code = ${typeCode} LIMIT 1`);
      if (configured.rows.length === 0) await this.sequences.update({ ...actor, companyId }, typeCode, { prefix: prefixes[type], resetPeriod: "year", padding: 6 });
    }
  }

  // Gửi phiếu nháp đã khóa: phiếu xuất khóa đơn bán, kiểm số còn phải giao, dùng phần hàng đã giữ; phiếu trả kiểm số đã giao còn trả được; rồi ghi sổ.
  private async postDraft(
    transaction: Executor,
    row: { id: string; type: "sales_issue" | "sales_return"; company_id: string; warehouse_id: string; source_id: string | null; reason_code: string; stocktake_id: string | null },
    actor: Actor,
  ): Promise<void> {
    const id = row.id;
    const typeCode = documentTypeCodes[row.type as "sales_issue" | "sales_return"];
    const lines = await this.documents.lines(id, transaction);
    let fields: FieldErrors = {};
    if (row.type === "sales_issue") {
      const order = await this.order(transaction, row.source_id!, true);
      if (order.status !== "confirmed") throw new ApiError("BUSINESS_RULE", "salesOrderNotOpen");
      await this.requireInternalReady(transaction, order.id);
      fields = await this.deliverableErrors(
        transaction,
        order.id,
        null,
        lines.map((line) => line.source_line_id!),
        lines.map((line) => Math.abs(Number(line.base_quantity))),
      );
      if (Object.keys(fields).length === 0) {
        // Dùng phần đang giữ cho đơn trước khi kiểm hàng khả dụng (QUYTAC_NGHIEPVU_70).
        const totals = new Map<string, number>();
        for (const line of lines) totals.set(line.variant_id, (totals.get(line.variant_id) ?? 0) + Math.abs(Number(line.base_quantity)));
        for (const [variantId, quantity] of [...totals].sort(([left], [right]) => left.localeCompare(right)))
          await this.reservations.consumeFromSource(transaction, salesOrderSource, order.id, row.warehouse_id, variantId, quantity.toFixed(4));
      }
    } else {
      fields = await this.returnableErrors(
        transaction,
        lines.map((line) => ({ issueLineId: line.source_line_id!, baseQuantity: Math.abs(Number(line.base_quantity)) })),
      );
    }
    if (Object.keys(fields).length === 0) Object.assign(fields, await this.documents.checkForSubmit(row, lines, transaction));
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const documentNo = await this.sequences.next(row.company_id, typeCode, transaction);
    await transaction.execute(sql`
      UPDATE inventory.documents SET status = 'pending', document_no = ${documentNo}, submitted_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
    await this.documents.postDocument(transaction, id);
    if (row.type === "sales_issue") {
      await this.orders.refreshDelivered(transaction, row.source_id!);
      await this.createInternalReceipt(transaction, id);
    }
    await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.submit", entityId: id, afterData: { documentNo } }, transaction);
  }

  // Đơn VComm (CONG_VIEC_24): ghi sổ phiếu xuất nháp khi đơn vị vận chuyển lấy hàng, không xét quyền kho; dãy số đã tạo lúc giao đơn.
  async postDraftAsSystem(transaction: Executor, documentId: string, actor: Actor): Promise<void> {
    const row = (
      await transaction.execute<{
        id: string;
        type: "sales_issue" | "sales_return";
        company_id: string;
        warehouse_id: string;
        source_id: string | null;
        reason_code: string;
        stocktake_id: string | null;
      }>(sql`
      SELECT id, type, company_id, warehouse_id, source_id, reason_code, stocktake_id FROM inventory.documents WHERE id = ${documentId} AND status = 'draft' FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.postDraft(transaction, row, actor);
  }

  // Đơn VComm (CONG_VIEC_24): nhận hàng trả lại theo dòng phiếu xuất (hàng hoàn về, yêu cầu trả hàng đã duyệt), không xét quyền kho; ghi sổ ngay.
  // serials: hàng theo serial trả lại (bán lẻ tại quầy, CONG_VIEC_53); đơn VComm không truyền.
  async returnAsSystem(
    transaction: Executor,
    actor: Actor,
    input: { issueId: string; documentDate: string; reason: string; lines: { issueLineId: string; quantity: string; serials?: string[] }[] },
  ): Promise<string> {
    const issue = (
      await transaction.execute<{ id: string; company_id: string; warehouse_id: string; partner_id: string | null; status: string; type: string }>(sql`
      SELECT id, company_id, warehouse_id, partner_id, status, type FROM inventory.documents WHERE id = ${input.issueId}`)
    ).rows[0];
    if (!issue || issue.type !== "sales_issue" || issue.status !== "posted") throw new ApiError("BUSINESS_RULE", "salesIssueNotPosted");
    const issueLines = new Map((await this.documents.lines(issue.id, transaction)).map((line) => [line.id, line]));
    const lines = input.lines.map((line) => {
      const source = issueLines.get(line.issueLineId);
      if (!source) throw new ApiError("BUSINESS_RULE", "salesIssueNotPosted");
      const issued = Math.abs(Number(source.base_quantity));
      return {
        variantId: source.variant_id,
        unitId: source.base_unit_id,
        quantity: line.quantity,
        unitCost: issued > 0 ? (Math.abs(Number(source.cost_value ?? 0)) / issued).toFixed(4) : "0",
        lotId: null,
        lotNo: source.lot_no,
        manufacturedOn: source.manufactured_on,
        expiresOn: source.expires_on,
        lotOverrideReason: null,
        locationId: source.location_id,
        destinationLocationId: null,
        serials: line.serials ?? [],
        responsibleUserId: null,
        compensationAmount: null,
      };
    });
    const documentInput = {
      type: "sales_return",
      warehouseId: issue.warehouse_id,
      companyId: issue.company_id,
      documentDate: input.documentDate,
      reasonCode: "sales_return",
      reason: input.reason,
      note: null,
      lines,
    } as DocumentInput;
    const prepared = await this.documents.prepare(null, documentInput);
    const documentId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, source_type, source_id, partner_id, created_by)
      VALUES (${issue.company_id}, ${issue.warehouse_id}, 'sales_return', ${input.documentDate}::date, 'sales_return', ${input.reason}, NULL, 'inventory.document', ${issue.id},
        ${issue.partner_id}, ${actor.userId}) RETURNING id`)
    ).rows[0]!.id;
    await this.writeLines(
      transaction,
      documentId,
      documentInput,
      prepared,
      input.lines.map((line) => line.issueLineId),
    );
    await this.postDraft(
      transaction,
      { id: documentId, type: "sales_return", company_id: issue.company_id, warehouse_id: issue.warehouse_id, source_id: issue.id, reason_code: "sales_return", stocktake_id: null },
      actor,
    );
    return documentId;
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const row = await this.ownDraft(actor, id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM inventory.documents WHERE id = ${id} AND status = 'draft'`);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.delete", entityId: id }, transaction);
    });
  }

  // Bán lẻ tại quầy (CONG_VIEC_53; QUYTAC_NGHIEPVU_370, 374): lập và ghi sổ phiếu xuất cho toàn bộ đơn bán lẻ trong giao dịch của bên gọi, không xét quyền kho.
  // Hàng theo lô: xuất lô hết hạn trước, bỏ lô đã hết hạn; hàng theo serial: dùng lần lượt serial thu ngân quét theo mặt hàng. Dãy số đã tạo trước giao dịch.
  // CONG_VIEC_57: đơn VComm giao tại trạm dùng chung, ghi lý do riêng.
  async issueRetailWithin(transaction: Executor, actor: Actor, input: { orderId: string; documentDate: string; serials: Map<string, string[]>; reason?: string }): Promise<string> {
    const order = await this.order(transaction, input.orderId, true);
    const orderLines = await transaction.execute<{
      id: string;
      variant_id: string;
      unit_id: string;
      quantity: string;
      base_quantity: string;
      base_unit_id: string;
      tracks_lots: boolean;
      tracks_serials: boolean;
    }>(sql`
      SELECT l.id, l.variant_id, l.unit_id, l.quantity::text, l.base_quantity::text, p.base_unit_id, p.tracks_lots, p.tracks_serials
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = ${order.id} ORDER BY l.line_no`);
    const remainingSerials = new Map([...input.serials].map(([variantId, serials]) => [variantId, [...serials]]));
    const lines: DocumentInput["lines"] = [];
    const sourceLines: string[] = [];
    const blank = {
      unitCost: null,
      lotId: null,
      lotNo: null,
      manufacturedOn: null,
      expiresOn: null,
      lotOverrideReason: null,
      locationId: null,
      destinationLocationId: null,
      serials: [] as string[],
      responsibleUserId: null,
      compensationAmount: null,
    };
    for (const line of orderLines.rows) {
      if (line.tracks_lots) {
        let needed = Number(line.base_quantity);
        const lots = (await this.documents.suggestLots(transaction, order.warehouse_id, order.company_id, line.variant_id, null, false)).filter((lot) => !lot.expired);
        for (const lot of lots) {
          if (needed <= 0.00005) break;
          const taken = Math.min(needed, Number(lot.quantity));
          const serials = line.tracks_serials ? (remainingSerials.get(line.variant_id) ?? []).splice(0, taken) : [];
          // Lô sau lô gợi ý chỉ dùng khi lô trước không đủ: ghi lý do như khi thủ kho chọn lô khác gợi ý.
          const lotOverrideReason = lot === lots[0] ? null : "Bán lẻ: lô hết hạn trước không đủ hàng";
          lines.push({ ...blank, variantId: line.variant_id, unitId: line.base_unit_id, quantity: taken.toFixed(4), lotId: lot.lotId, lotOverrideReason, serials });
          sourceLines.push(line.id);
          needed -= taken;
        }
        if (needed > 0.00005) throw new ApiError("BUSINESS_RULE", "insufficientStock");
      } else {
        const serials = line.tracks_serials ? (remainingSerials.get(line.variant_id) ?? []).splice(0, Number(line.base_quantity)) : [];
        lines.push({ ...blank, variantId: line.variant_id, unitId: line.unit_id, quantity: line.quantity, serials });
        sourceLines.push(line.id);
      }
    }
    const documentInput = {
      type: "sales_issue",
      warehouseId: order.warehouse_id,
      companyId: order.company_id,
      documentDate: input.documentDate,
      reasonCode: "sale",
      reason: input.reason ?? `Bán lẻ theo đơn ${order.document_no}`,
      note: null,
      lines,
    } as DocumentInput;
    const prepared = await this.documents.prepare(null, documentInput);
    const documentId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, note, source_type, source_id, partner_id, created_by)
      VALUES (${order.company_id}, ${order.warehouse_id}, 'sales_issue', ${input.documentDate}::date, 'sale', ${documentInput.reason}, NULL, ${salesOrderSource}, ${order.id}, NULL, ${actor.userId})
      RETURNING id`)
    ).rows[0]!.id;
    await this.writeLines(transaction, documentId, documentInput, prepared, sourceLines);
    await this.postDraft(
      transaction,
      { id: documentId, type: "sales_issue", company_id: order.company_id, warehouse_id: order.warehouse_id, source_id: order.id, reason_code: "sale", stocktake_id: null },
      actor,
    );
    return documentId;
  }

  private async issueInput(order: OrderRow, input: IssueInput): Promise<{ documentInput: DocumentInput; sourceLines: string[] }> {
    const orderLines = new Map(
      (await this.database.execute<{ id: string; variant_id: string; unit_id: string }>(sql`SELECT id, variant_id, unit_id FROM sales.order_lines WHERE order_id = ${order.id}`)).rows.map((row) => [
        row.id,
        row,
      ]),
    );
    const fields: FieldErrors = {};
    const lines = input.lines.map((line, index) => {
      const source = orderLines.get(line.orderLineId);
      if (!source) fields[`lines.${index}.orderLineId`] = "invalidValue";
      return {
        variantId: source?.variant_id ?? "00000000-0000-0000-0000-000000000000",
        unitId: source?.unit_id ?? "00000000-0000-0000-0000-000000000000",
        quantity: line.quantity,
        unitCost: null,
        lotId: line.lotId ?? null,
        lotNo: null,
        manufacturedOn: null,
        expiresOn: null,
        lotOverrideReason: line.lotOverrideReason ?? null,
        locationId: line.locationId ?? null,
        destinationLocationId: null,
        serials: line.serials,
        responsibleUserId: null,
        compensationAmount: null,
      };
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const documentInput = {
      type: "sales_issue",
      warehouseId: order.warehouse_id,
      companyId: order.company_id,
      documentDate: input.documentDate,
      reasonCode: "sale",
      reason: `Giao hàng theo đơn ${order.document_no}`,
      note: input.note,
      lines,
    } as DocumentInput;
    return { documentInput, sourceLines: input.lines.map((line) => line.orderLineId) };
  }

  private async writeLines(transaction: Executor, documentId: string, input: DocumentInput, prepared: Awaited<ReturnType<StockDocumentsService["prepare"]>>, sourceLines: string[]): Promise<void> {
    await this.documents.writeLines(transaction, documentId, input, prepared);
    for (const [index, sourceLineId] of sourceLines.entries()) {
      await transaction.execute(sql`UPDATE inventory.document_lines SET source_line_id = ${sourceLineId} WHERE document_id = ${documentId} AND line_no = ${index + 1}`);
    }
  }

  // Tổng đã giao (đã ghi sổ) cộng lần này không vượt số đặt của dòng (QUYTAC_NGHIEPVU_71).
  private async deliverableErrors(executor: Executor, orderId: string, input: DocumentInput | null, sourceLines: string[], baseQuantities?: number[]): Promise<FieldErrors> {
    const rows = new Map(
      (
        await executor.execute<{ id: string; base_quantity: string; quantity: string; delivered: string }>(sql`
        SELECT l.id, l.base_quantity::text, l.quantity::text, ${deliveredOnOrderLine(sql`l.id`)}::text AS delivered FROM sales.order_lines l WHERE l.order_id = ${orderId}`)
      ).rows.map((row) => [row.id, row]),
    );
    const fields: FieldErrors = {};
    const totals = new Map<string, number>();
    sourceLines.forEach((lineId, index) => {
      const row = rows.get(lineId);
      if (!row) {
        fields[`lines.${index}.orderLineId`] = "invalidValue";
        return;
      }
      const base = baseQuantities ? baseQuantities[index]! : Number(input!.lines[index]!.quantity) * (Number(row.base_quantity) / Number(row.quantity));
      const total = (totals.get(lineId) ?? 0) + base;
      totals.set(lineId, total);
      if (total > Number(row.base_quantity) - Number(row.delivered) + 0.00005) fields[`lines.${index}.quantity`] = "salesOverDelivery";
    });
    return fields;
  }

  // Tổng trả của mỗi dòng phiếu xuất không vượt số đã giao trừ số đã trả (QUYTAC_NGHIEPVU_72).
  private async returnableErrors(executor: Executor, lines: { issueLineId: string; baseQuantity: number }[]): Promise<FieldErrors> {
    const fields: FieldErrors = {};
    const totals = new Map<string, number>();
    // Khóa các dòng phiếu xuất trước bằng câu lệnh riêng để câu tính số đã trả sau đó thấy phiếu trả vừa ghi sổ của giao dịch khác.
    const issueLineIds = [...new Set(lines.map((line) => line.issueLineId))].sort();
    if (issueLineIds.length > 0) await executor.execute(sql`SELECT 1 FROM inventory.document_lines WHERE id = ANY(${pgArray(issueLineIds)}::uuid[]) ORDER BY id FOR UPDATE`);
    for (const [index, line] of lines.entries()) {
      const row = (
        await executor.execute<{ issued: string; returned: string }>(sql`
        SELECT abs(dl.base_quantity)::text AS issued,
          coalesce((SELECT sum(rl.base_quantity) FROM inventory.document_lines rl JOIN inventory.documents r ON r.id = rl.document_id
                    WHERE rl.source_line_id = dl.id AND r.type = 'sales_return' AND r.status = 'posted'), 0)::text AS returned
        FROM inventory.document_lines dl WHERE dl.id = ${line.issueLineId}`)
      ).rows[0];
      if (!row) {
        fields[`lines.${index}.issueLineId`] = "invalidValue";
        continue;
      }
      const total = (totals.get(line.issueLineId) ?? 0) + line.baseQuantity;
      totals.set(line.issueLineId, total);
      if (total > Number(row.issued) - Number(row.returned) + 0.00005) fields[`lines.${index}.quantity`] = "salesReturnExceeded";
    }
    return fields;
  }

  private async ownDraft(actor: Actor, id: string) {
    const row = await this.documents.visibleRow(actor, id);
    if (row.type !== "sales_issue" && row.type !== "sales_return") throw new ApiError("NOT_FOUND", "notFound");
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.issueSales);
    if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    // Phiếu của đơn VComm do hệ thống ghi sổ theo trạng thái vận chuyển (CONG_VIEC_24).
    const salesOrderId =
      row.type === "sales_issue"
        ? row.source_id
        : ((await this.database.execute<{ source_id: string | null }>(sql`SELECT source_id FROM inventory.documents WHERE id = ${row.source_id}`)).rows[0]?.source_id ?? null);
    await requireNotMarketplace(this.database, salesOrderId);
    return row;
  }

  // Phiếu xuất giao hàng nội bộ đã ghi sổ sinh phiếu nhập mua "Chờ nhận" ở kho nhận của đơn mua đối ứng; mặt hàng, số lượng quy theo liên kết,
  // đơn giá theo đơn mua, lô theo phiếu xuất; dòng đơn bán và dòng đơn mua đối ứng cùng số dòng (QUYTAC_NGHIEPVU_76).
  private async createInternalReceipt(transaction: Executor, issueId: string): Promise<void> {
    const issue = (
      await transaction.execute<{ document_no: string; document_date: string; created_by: string; purchase_order_id: string | null; buyer_company_id: string | null }>(sql`
      SELECT d.document_no, d.document_date::text, d.created_by, o.counterpart_order_id AS purchase_order_id, c.company_id AS buyer_company_id
      FROM inventory.documents d JOIN sales.orders o ON o.id = d.source_id LEFT JOIN crm.partners c ON c.id = o.customer_id WHERE d.id = ${issueId}`)
    ).rows[0];
    if (!issue?.buyer_company_id || !issue.purchase_order_id) return;
    const order = (
      await transaction.execute<{ company_id: string; warehouse_id: string; supplier_id: string }>(sql`
      SELECT company_id, warehouse_id, supplier_id FROM purchasing.orders WHERE id = ${issue.purchase_order_id}`)
    ).rows[0]!;
    const receiptId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, status, source_type, source_id, partner_id, counterpart_document_id, created_by)
      VALUES (${order.company_id}, ${order.warehouse_id}, 'purchase_receipt', ${issue.document_date}::date, 'purchase', ${`Nhận hàng nội bộ theo phiếu xuất ${issue.document_no}`}, 'in_transit',
        'purchasing.order', ${issue.purchase_order_id}, ${order.supplier_id}, ${issueId}, ${issue.created_by}) RETURNING id`)
    ).rows[0]!.id;
    const lines = await transaction.execute<{
      id: string;
      variant_id: string;
      base_quantity: string;
      lot_no: string | null;
      manufactured_on: string | null;
      expires_on: string | null;
      purchase_line_id: string;
      purchase_variant_id: string;
      unit_cost: string;
      base_unit_id: string;
    }>(sql`
      SELECT dl.id, dl.variant_id, abs(dl.base_quantity)::text AS base_quantity, coalesce(lot.lot_no, dl.lot_no) AS lot_no,
        coalesce(lot.manufactured_on, dl.manufactured_on)::text AS manufactured_on, coalesce(lot.expires_on, dl.expires_on)::text AS expires_on,
        pl.id AS purchase_line_id, pl.variant_id AS purchase_variant_id, (pl.unit_price * pl.quantity / pl.base_quantity)::text AS unit_cost, p.base_unit_id
      FROM inventory.document_lines dl JOIN sales.order_lines sl ON sl.id = dl.source_line_id
      JOIN purchasing.order_lines pl ON pl.order_id = ${issue.purchase_order_id} AND pl.line_no = sl.line_no
      JOIN catalog.variants v ON v.id = pl.variant_id JOIN catalog.products p ON p.id = v.product_id
      LEFT JOIN inventory.lots lot ON lot.id = dl.lot_id
      WHERE dl.document_id = ${issueId} ORDER BY dl.line_no`);
    for (const [index, line] of lines.rows.entries()) {
      const link = await linkedVariant(transaction, line.variant_id, order.company_id);
      if (!link || link.variantId !== line.purchase_variant_id) throw new ApiError("BUSINESS_RULE", "internalVariantNotLinked");
      const quantity = (Number(line.base_quantity) * link.factor).toFixed(4);
      await transaction.execute(sql`
        INSERT INTO inventory.document_lines (document_id, line_no, variant_id, unit_id, quantity, base_quantity, unit_cost, lot_no, manufactured_on, expires_on, source_line_id, counterpart_line_id)
        VALUES (${receiptId}, ${index + 1}, ${line.purchase_variant_id}, ${line.base_unit_id}, ${quantity}::numeric, ${quantity}::numeric, ${Number(line.unit_cost).toFixed(4)}::numeric,
          ${line.lot_no}, ${line.manufactured_on}::date, ${line.expires_on}::date, ${line.purchase_line_id}, ${line.id})`);
    }
  }

  // Đơn bán nội bộ chỉ giao khi đơn mua đối ứng của công ty mua đã duyệt (QUYTAC_NGHIEPVU_76).
  private async requireInternalReady(executor: Executor, orderId: string): Promise<void> {
    const row = (
      await executor.execute<{ internal: boolean; purchase_status: string | null }>(sql`
      SELECT c.company_id IS NOT NULL AS internal, po.status AS purchase_status
      FROM sales.orders o LEFT JOIN crm.partners c ON c.id = o.customer_id LEFT JOIN purchasing.orders po ON po.id = o.counterpart_order_id
      WHERE o.id = ${orderId}`)
    ).rows[0];
    if (row?.internal && row.purchase_status !== "approved") throw new ApiError("BUSINESS_RULE", "internalCounterpartNotApproved");
  }

  private async order(executor: Executor, id: string, lock = false): Promise<OrderRow> {
    const row = (
      await executor.execute<OrderRow>(
        lock
          ? sql`SELECT id, company_id, document_no, customer_id, warehouse_id, status FROM sales.orders WHERE id = ${id} FOR UPDATE`
          : sql`SELECT id, company_id, document_no, customer_id, warehouse_id, status FROM sales.orders WHERE id = ${id}`,
      )
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }
}
