// Nhận hàng nội bộ, biên bản chênh lệch giao nhận nội bộ (CONG_VIEC_09; CHUC_NANG_60, 61; QUYTAC_NGHIEPVU_76, 77; API_82).
// Phiếu nhập mua nội bộ "Chờ nhận" do SalesDeliveriesService sinh khi bên bán ghi sổ phiếu xuất giao hàng.
import { Inject, Injectable } from "@nestjs/common";
import type { InternalDiscrepancyItem, InternalDiscrepancyStatus, receiveInternalSchema, resolveInternalDiscrepancySchema, saveStockDocumentSchema, StockDocumentResponse } from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { PurchaseOrdersService } from "../purchasing/orders.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { SalesDeliveriesService } from "./sales-deliveries.service";
import { pgArray } from "./stock-ledger.service";
import { documentTypeCodes, prefixes, StockDocumentsService } from "./stock-documents.service";
import { WarehousesService } from "./warehouses.service";

type FieldErrors = Record<string, keyof Messages["errors"]>;
type DocumentInput = z.output<typeof saveStockDocumentSchema>;

@Injectable()
export class InternalReceiptsService {
  // Module khác đăng ký lúc khởi động: chạy khi biên bản chênh lệch được ghi tổn thất (công nợ, CONG_VIEC_13).
  readonly writtenOffHooks: ((transaction: Pick<Database, "execute">, discrepancyId: string) => Promise<void>)[] = [];

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly documents: StockDocumentsService,
    private readonly warehouses: WarehousesService,
    private readonly orders: PurchaseOrdersService,
    private readonly deliveries: SalesDeliveriesService,
  ) {}

  // Thủ kho bên mua nhận theo số thực nhận: không vượt số xuất, serial thuộc serial đã xuất; ghi sổ phần nhận; dòng thiếu sinh biên bản ở công ty bán.
  async receive(actor: Actor, id: string, input: z.output<typeof receiveInternalSchema>): Promise<StockDocumentResponse> {
    const row = await this.documents.visibleRow(actor, id);
    if (row.type !== "purchase_receipt" || row.status !== "in_transit" || !row.counterpart_document_id) throw new ApiError("BUSINESS_RULE", "internalReceiptNotPending");
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.receivePurchases);
    const shipped = await this.shippedLines(this.database, id);
    const fields: FieldErrors = {};
    const received = new Map(input.lines.map((line) => [line.lineId, line]));
    let shortage = false;
    for (const [index, line] of shipped.entries()) {
      const entry = received.get(line.id);
      if (!entry) {
        fields[`lines.${index}.receivedQuantity`] = "internalLineMissing";
        continue;
      }
      const quantity = Number(entry.receivedQuantity);
      if (quantity > Number(line.base_quantity) + 0.00005) fields[`lines.${index}.receivedQuantity`] = "internalReceivedOverShipped";
      if (quantity < Number(line.base_quantity) - 0.00005) shortage = true;
      if (line.serials.length > 0 && entry.serials.some((serial) => !line.serials.includes(serial))) fields[`lines.${index}.serials`] = "internalSerialNotShipped";
    }
    if (shortage && !input.shortageReason) fields.shortageReason = "internalShortageReasonRequired";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });

    const kept = shipped.filter((line) => Number(received.get(line.id)!.receivedQuantity) > 0);
    const documentInput = {
      type: "purchase_receipt",
      warehouseId: row.warehouse_id,
      companyId: row.company_id,
      documentDate: this.permissionService.today(),
      reasonCode: "purchase",
      reason: row.reason,
      note: row.note,
      lines: kept.map((line) => {
        const entry = received.get(line.id)!;
        return {
          variantId: line.variant_id,
          unitId: line.unit_id,
          quantity: entry.receivedQuantity,
          unitCost: line.unit_cost,
          lotId: null,
          lotNo: line.lot_no,
          manufacturedOn: line.manufactured_on,
          expiresOn: line.expires_on,
          lotOverrideReason: null,
          locationId: entry.locationId ?? null,
          destinationLocationId: null,
          serials: entry.serials,
          responsibleUserId: null,
          compensationAmount: null,
        };
      }),
    } as DocumentInput;
    // Lỗi theo dòng trả theo vị trí dòng xuất (dòng nhận 0 đã bỏ khỏi phiếu) để giao diện gắn đúng dòng.
    const remap = (errors: FieldErrors): FieldErrors => {
      const mapped: FieldErrors = {};
      for (const [key, value] of Object.entries(errors)) {
        const match = /^lines\.(\d+)\.(.+)$/.exec(key);
        mapped[match ? `lines.${shipped.indexOf(kept[Number(match[1])]!)}.${match[2]}` : key] = value;
      }
      return mapped;
    };
    const prepared =
      kept.length > 0
        ? await this.documents.prepare(actor, documentInput, inventoryPermissions.receivePurchases).catch((error: unknown) => {
            if (error instanceof ApiError && error.extra.fields) throw new ApiError(error.code, error.messageKey, { fields: remap(error.extra.fields as FieldErrors) });
            throw error;
          })
        : null;
    const typeCode = documentTypeCodes.purchase_receipt;
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${row.company_id} AND document_type_code = ${typeCode} LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update({ ...actor, companyId: row.company_id }, typeCode, { prefix: prefixes.purchase_receipt, resetPeriod: "year", padding: 6 });

    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE id = ${id} AND status = 'in_transit' AND version = ${input.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM inventory.document_lines WHERE document_id = ${id}`);
      if (prepared) {
        await this.documents.writeLines(transaction, id, documentInput, prepared);
        for (const [index, line] of kept.entries()) {
          await transaction.execute(sql`
            UPDATE inventory.document_lines SET source_line_id = ${line.source_line_id}, counterpart_line_id = ${line.counterpart_line_id} WHERE document_id = ${id} AND line_no = ${index + 1}`);
        }
        const errors = await this.documents.checkForSubmit(row, await this.documents.lines(id, transaction), transaction);
        if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: remap(errors) });
      }
      const documentNo = await this.sequences.next(row.company_id, typeCode, transaction);
      await transaction.execute(sql`
        UPDATE inventory.documents SET status = ${prepared ? "pending" : "posted"}, document_no = ${documentNo}, document_date = ${this.permissionService.today()}::date,
          submitted_at = now(), posted_at = CASE WHEN ${prepared === null} THEN now() END, received_at = now(), received_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (prepared) await this.documents.postDocument(transaction, id);
      await this.orders.refreshReceived(transaction, row.source_id!);
      const receiptLines = new Map(
        (await transaction.execute<{ id: string; counterpart_line_id: string }>(sql`SELECT id, counterpart_line_id FROM inventory.document_lines WHERE document_id = ${id}`)).rows.map((line) => [
          line.counterpart_line_id,
          line.id,
        ]),
      );
      for (const line of shipped) {
        const entry = received.get(line.id)!;
        const missing = Number(line.base_quantity) - Number(entry.receivedQuantity);
        if (missing <= 0.00005) continue;
        const ratio = missing / Number(line.base_quantity);
        await transaction.execute(sql`
          INSERT INTO inventory.internal_discrepancies (company_id, warehouse_id, issue_document_id, issue_line_id, receipt_document_id, receipt_line_id, variant_id, shortage_base_quantity,
            value, serials, reason)
          SELECT d.company_id, d.warehouse_id, d.id, l.id, ${id}, ${receiptLines.get(line.counterpart_line_id) ?? null}, l.variant_id, round(abs(l.base_quantity) * ${ratio}::numeric, 4),
            round(coalesce(l.cost_value, 0) * ${ratio}::numeric, 4), ${pgArray(line.serials.filter((serial) => !entry.serials.includes(serial)))}::text[], ${input.shortageReason}
          FROM inventory.document_lines l JOIN inventory.documents d ON d.id = l.document_id WHERE l.id = ${line.counterpart_line_id}`);
      }
      await this.auditService.record(
        { ...inventoryAudit(actor, "stock_document"), companyId: row.company_id, action: "stock_document.receive_internal", entityId: id, afterData: { documentNo, ...input } },
        transaction,
      );
    });
    return this.documents.detail(actor, id);
  }

  // Biên bản của công ty đang làm việc tại các kho người dùng được xuất giao hàng.
  async discrepancies(actor: Actor, status: InternalDiscrepancyStatus | undefined): Promise<InternalDiscrepancyItem[]> {
    const allowed = await this.issuableWarehouses(actor);
    if (allowed.length === 0) return [];
    const costVisible = await this.warehouses.costVisibility(actor);
    const rows = await this.database.execute<{
      id: string;
      company_id: string;
      warehouse_id: string;
      warehouse_name: string;
      issue_document_id: string;
      issue_document_no: string | null;
      receipt_document_id: string;
      receipt_document_no: string | null;
      buyer_company_name: string;
      sku: string;
      product_name: string;
      base_unit_name: string;
      shortage_base_quantity: string;
      value: string;
      currency: string;
      serials: string[];
      reason: string;
      status: InternalDiscrepancyStatus;
      return_document_id: string | null;
      resolution_note: string | null;
      resolved_by_name: string | null;
      created_at: Date;
      version: number;
    }>(sql`
      SELECT x.id, x.company_id, x.warehouse_id, w.name AS warehouse_name, x.issue_document_id, i.document_no AS issue_document_no, x.receipt_document_id, r.document_no AS receipt_document_no,
        bc.short_name AS buyer_company_name, v.sku, p.name AS product_name, bu.name_vi AS base_unit_name, x.shortage_base_quantity::text, x.value::text, sc.base_currency AS currency, x.serials, x.reason, x.status,
        x.return_document_id, x.resolution_note, ru.full_name AS resolved_by_name, x.created_at, x.version
      FROM inventory.internal_discrepancies x JOIN inventory.warehouses w ON w.id = x.warehouse_id JOIN inventory.documents i ON i.id = x.issue_document_id
      JOIN inventory.documents r ON r.id = x.receipt_document_id JOIN core.companies bc ON bc.id = r.company_id JOIN core.companies sc ON sc.id = x.company_id
      JOIN catalog.variants v ON v.id = x.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units bu ON bu.id = p.base_unit_id
      LEFT JOIN core.users ru ON ru.id = x.resolved_by
      WHERE x.company_id = ${actor.companyId} AND x.warehouse_id = ANY(${pgArray(allowed)}::uuid[]) ${status ? sql`AND x.status = ${status}` : sql``}
      ORDER BY x.created_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      warehouseName: row.warehouse_name,
      issueId: row.issue_document_id,
      issueDocumentNo: row.issue_document_no,
      receiptId: row.receipt_document_id,
      receiptDocumentNo: row.receipt_document_no,
      buyerCompanyName: row.buyer_company_name,
      sku: row.sku,
      productName: row.product_name,
      baseUnitName: row.base_unit_name,
      shortageBaseQuantity: trimDecimal(row.shortage_base_quantity),
      value: costVisible(row) ? trimDecimal(row.value) : null,
      currency: row.currency,
      serials: row.serials,
      reason: row.reason,
      status: row.status,
      returnDocumentId: row.return_document_id,
      resolutionNote: row.resolution_note,
      resolvedByName: row.resolved_by_name,
      createdAt: new Date(row.created_at).toISOString(),
      version: row.version,
      canResolve: row.status === "open",
    }));
  }

  // Bên bán xử lý một lần: nhập lại kho (phiếu nhận hàng trả lại theo phiếu xuất gốc, ghi sổ ngay) hoặc ghi tổn thất (chỉ đóng biên bản).
  async resolve(actor: Actor, id: string, input: z.output<typeof resolveInternalDiscrepancySchema>): Promise<InternalDiscrepancyItem[]> {
    const row = (
      await this.database.execute<{ warehouse_id: string; issue_document_id: string; issue_line_id: string; shortage_base_quantity: string; serials: string[]; reason: string }>(sql`
      SELECT warehouse_id, issue_document_id, issue_line_id, shortage_base_quantity::text, serials, reason FROM inventory.internal_discrepancies WHERE id = ${id} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.issueSales);
    // Giữ biên bản trước để hai người xử lý cùng lúc không cùng nhập lại kho.
    // Ghi tổn thất: đóng biên bản và chạy móc nối (công nợ giảm phải thu bên bán) trong cùng giao dịch.
    const claimed = await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.internal_discrepancies SET status = ${input.action === "return" ? "returned" : "written_off"}, resolution_note = ${input.note}, resolved_by = ${actor.userId},
          resolved_at = now(), version = version + 1
        WHERE id = ${id} AND status = 'open' AND version = ${input.version} RETURNING id`);
      if (updated.rows.length > 0 && input.action === "write_off") for (const hook of this.writtenOffHooks) await hook(transaction, id);
      return updated;
    });
    if (claimed.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (input.action === "return") {
      let returnId: string | null = null;
      try {
        returnId = (
          await this.deliveries.createReturn(actor, {
            issueId: row.issue_document_id,
            documentDate: this.permissionService.today(),
            reason: `Hàng thiếu khi giao nội bộ: ${row.reason}`,
            note: input.note,
            lines: [{ issueLineId: row.issue_line_id, quantity: trimDecimal(row.shortage_base_quantity), serials: row.serials }],
          })
        ).id;
        await this.deliveries.submit(actor, returnId);
        await this.database.execute(sql`UPDATE inventory.internal_discrepancies SET return_document_id = ${returnId} WHERE id = ${id}`);
      } catch (error) {
        if (returnId) await this.deliveries.remove(actor, returnId).catch(() => undefined);
        await this.database.execute(sql`
          UPDATE inventory.internal_discrepancies SET status = 'open', resolution_note = NULL, resolved_by = NULL, resolved_at = NULL, version = version + 1 WHERE id = ${id}`);
        throw error;
      }
    }
    await this.auditService.record({ ...inventoryAudit(actor, "internal_discrepancy"), action: "internal_discrepancy.resolve", entityId: id, afterData: input });
    return this.discrepancies(actor, undefined);
  }

  private async issuableWarehouses(actor: Actor): Promise<string[]> {
    const { operable } = await this.warehouses.stockScope(actor);
    const allowed: string[] = [];
    for (const warehouseId of operable) {
      if (await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.issueSales).catch(() => null)) allowed.push(warehouseId);
    }
    return allowed;
  }

  private async shippedLines(executor: Pick<Database, "execute">, id: string) {
    return (
      await executor.execute<{
        id: string;
        variant_id: string;
        unit_id: string;
        base_quantity: string;
        unit_cost: string;
        lot_no: string | null;
        manufactured_on: string | null;
        expires_on: string | null;
        source_line_id: string;
        counterpart_line_id: string;
        serials: string[];
      }>(sql`
      SELECT l.id, l.variant_id, l.unit_id, l.base_quantity::text, l.unit_cost::text, l.lot_no, l.manufactured_on::text, l.expires_on::text, l.source_line_id, l.counterpart_line_id,
        coalesce((SELECT array_agg(s.serial_no ORDER BY s.serial_no) FROM inventory.document_line_serials s WHERE s.line_id = l.counterpart_line_id), '{}') AS serials
      FROM inventory.document_lines l WHERE l.document_id = ${id} ORDER BY l.line_no`)
    ).rows;
  }
}
