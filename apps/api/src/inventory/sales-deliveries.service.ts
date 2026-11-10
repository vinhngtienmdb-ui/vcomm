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
import { deliveredOnOrderLine, salesOrderSource, SalesOrdersService } from "../sales/sales-orders.service";
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
    const rows = await this.database.execute<{ id: string; document_no: string; customer_name: string | null; buyer_name: string | null; warehouse_name: string }>(sql`
      SELECT o.id, o.document_no, c.name AS customer_name, o.buyer_name, w.name AS warehouse_name
      FROM sales.orders o LEFT JOIN crm.partners c ON c.id = o.customer_id JOIN inventory.warehouses w ON w.id = o.warehouse_id
      WHERE o.status = 'confirmed' AND o.warehouse_id = ANY(${pgArray(allowed)}::uuid[])
        AND (${pattern}::text IS NULL OR o.document_no ILIKE ${pattern} OR c.name ILIKE ${pattern} OR o.buyer_name ILIKE ${pattern})
      ORDER BY o.order_date, o.document_no LIMIT 50`);
    return rows.rows.map((row) => ({ id: row.id, documentNo: row.document_no, customerName: row.customer_name ?? row.buyer_name, warehouseName: row.warehouse_name }));
  }

  // Dòng đơn bán kèm số còn phải giao, để lập phiếu xuất.
  async orderLines(actor: Actor, orderId: string) {
    const order = await this.order(this.database, orderId);
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
      WHERE l.order_id = ${orderId} ORDER BY l.line_no`);
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

  async createIssue(actor: Actor, input: IssueInput): Promise<StockDocumentResponse> {
    const order = await this.order(this.database, input.orderId);
    if (order.status !== "confirmed") throw new ApiError("BUSINESS_RULE", "salesOrderNotOpen");
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

  // Phiếu nhận hàng trả lại lập từ phiếu xuất giao hàng đã ghi sổ; đơn giá là giá vốn phiếu xuất gốc theo đơn vị của dòng; lô, vị trí theo dòng gốc (QUYTAC_NGHIEPVU_72).
  async createReturn(actor: Actor, input: ReturnInput): Promise<StockDocumentResponse> {
    const issue = await this.documents.visibleRow(actor, input.issueId);
    if (issue.type !== "sales_issue" || issue.status !== "posted") throw new ApiError("BUSINESS_RULE", "salesIssueNotPosted");
    const issueLines = new Map((await this.documents.lines(issue.id)).map((line) => [line.id, line]));
    const fields: FieldErrors = {};
    const lines = input.lines.map((line, index) => {
      const source = issueLines.get(line.issueLineId);
      if (!source) {
        fields[`lines.${index}.issueLineId`] = "invalidValue";
        return null;
      }
      const issued = Math.abs(Number(source.base_quantity));
      const factor = issued / Math.abs(Number(source.quantity));
      const unitCost = issued > 0 ? ((Number(source.cost_value ?? 0) / issued) * factor).toFixed(4) : "0";
      if (line.serials.some((serial) => !source.serials.includes(serial))) fields[`lines.${index}.serials`] = "serialNotInStock";
      return {
        variantId: source.variant_id,
        unitId: source.unit_id,
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
    const typeCode = documentTypeCodes[row.type];
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${row.company_id} AND document_type_code = ${typeCode} LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update({ ...actor, companyId: row.company_id }, typeCode, { prefix: prefixes[row.type], resetPeriod: "year", padding: 6 });
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'draft' AND version = ${row.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const lines = await this.documents.lines(id, transaction);
      let fields: FieldErrors = {};
      if (row.type === "sales_issue") {
        const order = await this.order(transaction, row.source_id!, true);
        if (order.status !== "confirmed") throw new ApiError("BUSINESS_RULE", "salesOrderNotOpen");
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
          for (const [variantId, quantity] of totals) await this.reservations.consumeFromSource(transaction, salesOrderSource, order.id, row.warehouse_id, variantId, quantity.toFixed(4));
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
      if (row.type === "sales_issue") await this.orders.refreshDelivered(transaction, row.source_id!);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.submit", entityId: id, afterData: { documentNo } }, transaction);
    });
    return this.documents.detail(actor, id);
  }

  async remove(actor: Actor, id: string): Promise<void> {
    const row = await this.ownDraft(actor, id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM inventory.documents WHERE id = ${id} AND status = 'draft'`);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.delete", entityId: id }, transaction);
    });
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
    for (const [index, line] of lines.entries()) {
      const row = (
        await executor.execute<{ issued: string; returned: string }>(sql`
        SELECT abs(dl.base_quantity)::text AS issued,
          coalesce((SELECT sum(rl.base_quantity) FROM inventory.document_lines rl JOIN inventory.documents r ON r.id = rl.document_id
                    WHERE rl.source_line_id = dl.id AND r.type = 'sales_return' AND r.status = 'posted'), 0)::text AS returned
        FROM inventory.document_lines dl WHERE dl.id = ${line.issueLineId} FOR UPDATE`)
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
    return row;
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
