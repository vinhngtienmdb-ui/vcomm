// Đơn mua (CHUC_NANG_51; QUYTAC_NGHIEPVU_63, 64; API_75): lập, sửa, gửi duyệt, duyệt lại khi tăng giá trị hoặc đổi nhà cung cấp, đóng đơn.
// Số đã nhận, đã trả của dòng đơn mua tính từ phiếu kho (module Kho ghi), không lưu trùng.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { PageResponse, PurchaseDocumentStatus, purchaseListQuerySchema, PurchaseOrderListItem, PurchaseOrderResponse, savePurchaseOrderSchema, VatRate } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { pgArray } from "../inventory/stock-ledger.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { isActiveSupplier, isReceivingWarehouse, purchasingAudit, purchasingPermissions, requirePermission, variantUnitFactor, type Executor, type FieldErrors } from "./purchasing-context";
import { companyCurrency, ensureSequence, orderedOnRequisitionLine } from "./requisitions.service";
import { readSettings } from "./supplier-prices.service";

const documentTypeCode = "purchasing.order";
type Input = z.output<typeof savePurchaseOrderSchema>;
type OrderRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  supplier_id: string;
  supplier_name: string;
  warehouse_id: string;
  warehouse_name: string;
  order_date: Date | string;
  expected_date: Date | string | null;
  currency: string;
  note: string | null;
  status: PurchaseDocumentStatus;
  approval_request_id: string | null;
  approved_total: string | null;
  approved_supplier_id: string | null;
  total_amount: string;
  tax_amount: string;
  closed_reason: string | null;
  created_by: string;
  created_by_name: string;
  version: number;
};
type PreparedLine = { id: string | null; baseQuantity: string; amount: string; estimate: number | null };

// Theo đơn vị cơ sở: nhập mua đã ghi sổ (trừ phần không đạt), đang chờ kiểm tra, đã trả.
export const receivedOnOrderLine = (lineId: SQL) => sql`coalesce((
  SELECT sum(dl.base_quantity - coalesce(dl.rejected_base_quantity, 0)) FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
  WHERE dl.source_line_id = ${lineId} AND d.type = 'purchase_receipt' AND d.status = 'posted'), 0)`;
export const checkingOnOrderLine = (lineId: SQL) => sql`coalesce((
  SELECT sum(dl.base_quantity) FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
  WHERE dl.source_line_id = ${lineId} AND d.type = 'purchase_receipt' AND d.status = 'quality_check'), 0)`;
export const returnedOnOrderLine = (lineId: SQL) => sql`coalesce((
  SELECT sum(rl.base_quantity) FROM inventory.document_lines rl JOIN inventory.documents r ON r.id = rl.document_id
  JOIN inventory.document_lines dl ON dl.id = rl.source_line_id
  WHERE dl.source_line_id = ${lineId} AND r.type = 'purchase_return' AND r.status = 'posted'), 0)`;

@Injectable()
export class PurchaseOrdersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const updated = await transaction.execute<{ id: string }>(sql`
          UPDATE purchasing.orders SET status = ${status}, updated_at = now(),
            approved_total = CASE WHEN ${status} = 'approved' THEN total_amount ELSE approved_total END,
            approved_supplier_id = CASE WHEN ${status} = 'approved' THEN supplier_id ELSE approved_supplier_id END
          WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id`);
        if (updated.rows[0] && status === "approved") await this.refreshReceived(transaction, updated.rows[0].id);
      });
    });
  }

  async list(actor: Actor, query: z.output<typeof purchaseListQuerySchema>): Promise<PageResponse<PurchaseOrderListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewOrders, purchasingPermissions.manageOrders);
    const conditions: SQL[] = [sql`o.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`o.status = ${query.status}`);
    if (query.supplierId) conditions.push(sql`o.supplier_id = ${query.supplierId}`);
    if (query.openOnly) conditions.push(sql`o.status = 'approved'`);
    if (query.search) conditions.push(sql`(o.document_no = ${query.search.toUpperCase()} OR s.name ILIKE ${`%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`})`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY o.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<PurchaseOrderResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewOrders, purchasingPermissions.manageOrders);
    const row = await this.single(this.database, actor.companyId, id);
    const tolerance = Number((await readSettings(this.database, row.company_id)).overReceiptTolerancePercent);
    const lines = await this.database.execute<{
      id: string;
      line_no: number;
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      unit_id: string;
      unit_name: string;
      factor: string;
      quantity: string;
      base_quantity: string;
      unit_price: string;
      vat_rate: VatRate;
      amount: string;
      requisition_line_id: string | null;
      received: string;
      checking: string;
      returned: string;
    }>(sql`
      SELECT ol.id, ol.line_no, ol.variant_id, v.sku, p.name AS product_name, v.option_values, ol.unit_id, u.name_vi AS unit_name, (ol.base_quantity / ol.quantity)::text AS factor,
        ol.quantity::text, ol.base_quantity::text, ol.unit_price::text, ol.vat_rate, ol.amount::text, ol.requisition_line_id,
        ${receivedOnOrderLine(sql`ol.id`)}::text AS received, ${checkingOnOrderLine(sql`ol.id`)}::text AS checking, ${returnedOnOrderLine(sql`ol.id`)}::text AS returned
      FROM purchasing.order_lines ol JOIN catalog.variants v ON v.id = ol.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = ol.unit_id
      WHERE ol.order_id = ${id} ORDER BY ol.line_no`);
    const receipts = await this.database.execute<{ id: string; document_no: string | null; type: "purchase_receipt" | "purchase_return"; status: string; document_date: Date | string }>(sql`
      SELECT d.id, d.document_no, d.type, d.status, d.document_date FROM inventory.documents d
      WHERE (d.type = 'purchase_receipt' AND d.source_id = ${id})
         OR (d.type = 'purchase_return' AND d.source_id IN (SELECT r.id FROM inventory.documents r WHERE r.type = 'purchase_receipt' AND r.source_id = ${id}))
      ORDER BY d.created_at`);
    const manage = granted.has(purchasingPermissions.manageOrders);
    const own = row.created_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    return {
      ...toItem(row),
      warehouseId: row.warehouse_id,
      note: row.note,
      approvalRequestId: row.approval_request_id,
      closedReason: row.closed_reason,
      lines: lines.rows.map((line) => {
        const allowed = Number(line.base_quantity) * (1 + tolerance / 100);
        const receivable = row.status === "approved" ? Math.max(0, allowed - Number(line.received) - Number(line.checking)) : 0;
        return {
          id: line.id,
          lineNo: line.line_no,
          variantId: line.variant_id,
          sku: line.sku,
          productName: line.product_name,
          optionValues: line.option_values,
          unitId: line.unit_id,
          unitName: line.unit_name,
          factor: trimDecimal(Number(line.factor).toFixed(4)),
          quantity: trimDecimal(line.quantity),
          baseQuantity: trimDecimal(line.base_quantity),
          unitPrice: trimDecimal(line.unit_price),
          vatRate: line.vat_rate,
          amount: trimDecimal(line.amount),
          requisitionLineId: line.requisition_line_id,
          receivedBaseQuantity: trimDecimal(line.received),
          returnedBaseQuantity: trimDecimal(line.returned),
          receivableBaseQuantity: trimDecimal(receivable.toFixed(4)),
        };
      }),
      receipts: receipts.rows.map((receipt) => ({ id: receipt.id, documentNo: receipt.document_no, type: receipt.type, status: receipt.status, documentDate: day(receipt.document_date) })),
      version: row.version,
      canEdit: manage && ["draft", "rejected", "withdrawn", "approved"].includes(row.status),
      canSubmit: manage && row.status === "draft",
      canWithdraw: own && row.status === "pending" && !firstStepDecided,
      // Đơn từng được duyệt mà lần duyệt lại bị từ chối, bị rút vẫn đóng được (đã có thể có phiếu nhập).
      canClose: manage && (row.status === "approved" || (["rejected", "withdrawn"].includes(row.status) && row.approved_total !== null)),
    };
  }

  async create(actor: Actor, input: Input): Promise<PurchaseOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders);
    const id = await this.database.transaction(async (transaction) => {
      const lines = await this.prepare(transaction, actor.companyId, input, null);
      const currency = await companyCurrency(transaction, actor.companyId);
      const orderId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.orders (company_id, supplier_id, warehouse_id, order_date, expected_date, currency, note, created_by)
        VALUES (${actor.companyId}, ${input.supplierId}, ${input.warehouseId}, ${input.orderDate}::date, ${input.expectedDate ?? null}::date, ${currency}, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, orderId, input, lines);
      await this.auditService.record({ ...purchasingAudit(actor, "purchase_order"), action: "purchase_order.create", entityId: orderId, afterData: input }, transaction);
      return orderId;
    });
    return this.detail(actor, id);
  }

  // Sửa đơn nháp, bị từ chối, đã rút (về nháp) hoặc đã duyệt; đơn đã duyệt sửa tăng giá trị hoặc đổi nhà cung cấp thì gửi duyệt lại (QUYTAC_NGHIEPVU_63).
  async update(actor: Actor, id: string, input: Input): Promise<PurchaseOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{ status: PurchaseDocumentStatus; approved_total: string | null; warehouse_id: string }>(sql`
        SELECT status, approved_total::text, warehouse_id FROM purchasing.orders WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version ?? 0} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Đơn đã từng được duyệt (kể cả lần duyệt lại bị từ chối, bị rút): sửa vẫn so với lần duyệt gần nhất, không về nháp.
      const wasApproved = locked.rows[0]!.approved_total !== null;
      // Kho nhận đã duyệt không đổi được: phiếu nhập đã lập, đang mở gắn với kho cũ.
      if (wasApproved && input.warehouseId !== locked.rows[0]!.warehouse_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { warehouseId: "documentHeaderLocked" } });
      const lines = await this.prepare(transaction, actor.companyId, input, id);
      await transaction.execute(sql`
        UPDATE purchasing.orders SET supplier_id = ${input.supplierId}, warehouse_id = ${input.warehouseId}, order_date = ${input.orderDate}::date, expected_date = ${input.expectedDate ?? null}::date,
          note = ${input.note}, status = ${wasApproved ? "approved" : "draft"}, approval_request_id = CASE WHEN ${wasApproved} THEN approval_request_id END,
          updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeLines(transaction, id, input, lines);
      const totals = await this.totals(transaction, id);
      const row = await this.single(transaction, actor.companyId, id);
      const reapprove = wasApproved && (Number(totals.total) > Number(row.approved_total ?? 0) || row.supplier_id !== row.approved_supplier_id);
      await this.auditService.record(
        { ...purchasingAudit(actor, "purchase_order"), action: "purchase_order.update", entityId: id, beforeData: before, afterData: { ...input, reapprove } },
        transaction,
      );
      if (reapprove) await this.sendForApproval(transaction, actor, row, lines);
      // Giảm về đúng số đã nhận thì đơn nhận đủ.
      else if (wasApproved) await this.refreshReceived(transaction, id);
    });
    return this.detail(actor, id);
  }

  async submit(actor: Actor, id: string): Promise<PurchaseOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders);
    const current = await this.single(this.database, actor.companyId, id);
    if (current.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "DMH");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM purchasing.orders WHERE id = ${id} AND status = 'draft' AND version = ${current.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const input = await this.inputOf(transaction, current);
      const lines = await this.prepare(transaction, actor.companyId, input, id);
      await this.sendForApproval(transaction, actor, current, lines);
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<PurchaseOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders);
    const row = await this.single(this.database, actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.execute(sql`UPDATE purchasing.orders SET status = 'withdrawn', updated_at = now() WHERE id = ${id} AND status = 'pending'`);
    return this.detail(actor, id);
  }

  // Đóng đơn đã duyệt còn thiếu: phần chưa nhận hủy; còn phiếu nhập chờ kiểm tra thì chưa đóng được (QUYTAC_NGHIEPVU_64).
  async close(actor: Actor, id: string, reason: string, version: number): Promise<PurchaseOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM purchasing.orders WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version}
          AND (status = 'approved' OR (status IN ('rejected', 'withdrawn') AND approved_total IS NOT NULL)) FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const open = await transaction.execute(sql`
        SELECT 1 FROM inventory.documents WHERE type = 'purchase_receipt' AND source_id = ${id} AND status IN ('draft', 'quality_check') LIMIT 1`);
      if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "purchaseOrderHasOpenReceipts");
      await transaction.execute(sql`
        UPDATE purchasing.orders SET status = 'closed', closed_reason = ${reason}, closed_at = now(), closed_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...purchasingAudit(actor, "purchase_order"), action: "purchase_order.close", entityId: id, afterData: { reason } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gọi trong giao dịch ghi sổ phiếu nhập mua của module Kho: đơn nhận đủ mọi dòng thì chuyển "Đã nhận đủ" (QUYTAC_NGHIEPVU_64).
  async refreshReceived(executor: Executor, orderId: string): Promise<void> {
    await executor.execute(sql`
      UPDATE purchasing.orders o SET status = 'received', updated_at = now(), version = version + 1
      WHERE o.id = ${orderId} AND o.status = 'approved'
        AND NOT EXISTS (SELECT 1 FROM purchasing.order_lines ol WHERE ol.order_id = o.id AND ${receivedOnOrderLine(sql`ol.id`)} < ol.base_quantity)`);
  }

  // Miễn duyệt khi mọi dòng lấy từ đề nghị mua đã duyệt và tổng không vượt giá trị ước tính; còn lại gửi luồng duyệt, chưa có chính sách thì duyệt ngay.
  private async sendForApproval(transaction: Executor, actor: Actor, row: OrderRow, lines: PreparedLine[]): Promise<void> {
    const totals = await this.totals(transaction, row.id);
    const estimate = lines.every((line) => line.estimate !== null) ? lines.reduce((sum, line) => sum + (line.estimate ?? 0), 0) : null;
    const exempt = estimate !== null && Number(totals.total) <= estimate + 0.00005;
    const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
    let requestId: string | null = null;
    if (!exempt) {
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: row.id,
          documentNo,
          amount: totals.total,
          currency: row.currency,
          documentDate: this.permissionService.today(),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
    }
    await transaction.execute(sql`
      UPDATE purchasing.orders SET status = ${requestId ? "pending" : "approved"}, document_no = ${documentNo}, approval_request_id = ${requestId}, submitted_at = coalesce(submitted_at, now()),
        approved_total = CASE WHEN ${requestId === null} THEN total_amount ELSE approved_total END,
        approved_supplier_id = CASE WHEN ${requestId === null} THEN supplier_id ELSE approved_supplier_id END,
        updated_at = now(), version = version + 1
      WHERE id = ${row.id}`);
    await this.auditService.record(
      { ...purchasingAudit(actor, "purchase_order"), action: "purchase_order.submit", entityId: row.id, afterData: { documentNo, amount: totals.total, approvalRequestId: requestId, exempt } },
      transaction,
    );
  }

  // Kiểm nhà cung cấp, kho, dòng hàng; dòng từ đề nghị mua không vượt số còn lại; dòng đã có phiếu nhập không đổi mặt hàng, đơn vị, không giảm dưới số đã nhận.
  private async prepare(transaction: Executor, companyId: string, input: Input, orderId: string | null): Promise<PreparedLine[]> {
    const fields: FieldErrors = {};
    if (!(await isActiveSupplier(transaction, companyId, input.supplierId))) fields.supplierId = "supplierNotActive";
    if (!(await isReceivingWarehouse(transaction, companyId, input.warehouseId))) fields.warehouseId = "invalidValue";
    const existing = new Map<string, { variant_id: string; unit_id: string; used: string }>();
    if (orderId) {
      const rows = await transaction.execute<{ id: string; variant_id: string; unit_id: string; used: string }>(sql`
        SELECT ol.id, ol.variant_id, ol.unit_id, (${receivedOnOrderLine(sql`ol.id`)} + ${checkingOnOrderLine(sql`ol.id`)})::text AS used FROM purchasing.order_lines ol WHERE ol.order_id = ${orderId}`);
      for (const row of rows.rows) existing.set(row.id, row);
      const kept = new Set(input.lines.map((line) => line.id).filter(Boolean));
      for (const [lineId] of existing) {
        if (kept.has(lineId)) continue;
        const referenced = await transaction.execute(sql`SELECT 1 FROM inventory.document_lines WHERE source_line_id = ${lineId} LIMIT 1`);
        if (referenced.rows.length > 0) fields.lines = "purchaseLineHasReceipts";
      }
    }
    const requisitionUse = new Map<string, number>();
    const lines: PreparedLine[] = [];
    for (const [index, line] of input.lines.entries()) {
      const unit = await variantUnitFactor(transaction, companyId, line.variantId, line.unitId);
      if (!unit) fields[`lines.${index}.unitId`] = "invalidValue";
      const baseQuantity = unit ? Number(line.quantity) * unit.factor : 0;
      const previous = line.id ? existing.get(line.id) : undefined;
      if (line.id && !previous) fields[`lines.${index}.id`] = "invalidValue";
      if (previous && Number(previous.used) > 0) {
        if (previous.variant_id !== line.variantId || previous.unit_id !== line.unitId) fields[`lines.${index}.variantId`] = "purchaseLineHasReceipts";
        if (baseQuantity < Number(previous.used) - 0.00005) fields[`lines.${index}.quantity`] = "purchaseQuantityBelowReceived";
      }
      let estimate: number | null = null;
      if (line.requisitionLineId) {
        const requisition = (
          await transaction.execute<{ variant_id: string; base_quantity: string; quantity: string; estimated_unit_price: string; ordered: string }>(sql`
          SELECT rl.variant_id, rl.base_quantity::text, rl.quantity::text, rl.estimated_unit_price::text,
            (${orderedOnRequisitionLine(sql`rl.id`)} - coalesce((SELECT sum(ol.base_quantity) FROM purchasing.order_lines ol WHERE ol.requisition_line_id = rl.id AND ol.order_id IS NOT DISTINCT FROM ${orderId}), 0))::text AS ordered
          FROM purchasing.requisition_lines rl JOIN purchasing.requisitions r ON r.id = rl.requisition_id
          WHERE rl.id = ${line.requisitionLineId} AND r.company_id = ${companyId} AND r.status = 'approved'
          FOR UPDATE OF rl`)
        ).rows[0];
        if (!requisition || requisition.variant_id !== line.variantId) fields[`lines.${index}.requisitionLineId`] = "invalidValue";
        else {
          const used = (requisitionUse.get(line.requisitionLineId) ?? 0) + baseQuantity;
          requisitionUse.set(line.requisitionLineId, used);
          if (used > Number(requisition.base_quantity) - Number(requisition.ordered) + 0.00005) fields[`lines.${index}.quantity`] = "requisitionQuantityExceeded";
          // Giá trị ước tính theo đơn vị cơ sở của dòng đề nghị.
          estimate = (baseQuantity * Number(requisition.estimated_unit_price) * Number(requisition.quantity)) / Number(requisition.base_quantity);
        }
      }
      const amount = Number(line.quantity) * Number(line.unitPrice);
      lines.push({ id: line.id ?? null, baseQuantity: baseQuantity.toFixed(4), amount: amount.toFixed(4), estimate });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return lines;
  }

  private async writeLines(transaction: Executor, orderId: string, input: Input, lines: PreparedLine[]): Promise<void> {
    const kept = lines.map((line) => line.id).filter((lineId): lineId is string => lineId !== null);
    await transaction.execute(sql`DELETE FROM purchasing.order_lines WHERE order_id = ${orderId} AND NOT (id = ANY(${pgArray(kept)}::uuid[]))`);
    // Đánh số lại dòng: dời số dòng cũ ra chỗ trống trước để không vướng ràng buộc duy nhất.
    await transaction.execute(sql`UPDATE purchasing.order_lines SET line_no = line_no + 10000 WHERE order_id = ${orderId}`);
    for (const [index, line] of input.lines.entries()) {
      const prepared = lines[index]!;
      if (prepared.id) {
        await transaction.execute(sql`
          UPDATE purchasing.order_lines SET line_no = ${index + 1}, variant_id = ${line.variantId}, unit_id = ${line.unitId}, quantity = ${line.quantity}::numeric,
            base_quantity = ${prepared.baseQuantity}::numeric, unit_price = ${line.unitPrice}::numeric, vat_rate = ${line.vatRate}, amount = ${prepared.amount}::numeric,
            requisition_line_id = ${line.requisitionLineId ?? null}
          WHERE id = ${prepared.id} AND order_id = ${orderId}`);
      } else {
        await transaction.execute(sql`
          INSERT INTO purchasing.order_lines (order_id, line_no, variant_id, unit_id, quantity, base_quantity, unit_price, vat_rate, amount, requisition_line_id)
          VALUES (${orderId}, ${index + 1}, ${line.variantId}, ${line.unitId}, ${line.quantity}::numeric, ${prepared.baseQuantity}::numeric, ${line.unitPrice}::numeric, ${line.vatRate},
            ${prepared.amount}::numeric, ${line.requisitionLineId ?? null})`);
      }
    }
    // Tổng, thuế tính trong cơ sở dữ liệu để không lệch làm tròn số thực.
    await transaction.execute(sql`
      UPDATE purchasing.orders SET total_amount = (SELECT coalesce(sum(amount), 0) FROM purchasing.order_lines WHERE order_id = ${orderId}),
        tax_amount = (SELECT coalesce(sum(round(amount * CASE WHEN vat_rate IN ('0', '5', '8', '10') THEN vat_rate::numeric ELSE 0 END / 100, 4)), 0) FROM purchasing.order_lines WHERE order_id = ${orderId})
      WHERE id = ${orderId}`);
  }

  private async totals(executor: Executor, orderId: string): Promise<{ total: string }> {
    return (await executor.execute<{ total: string }>(sql`SELECT total_amount::text AS total FROM purchasing.orders WHERE id = ${orderId}`)).rows[0]!;
  }

  private async inputOf(executor: Executor, row: OrderRow): Promise<Input> {
    const lines = await executor.execute<{ id: string; variant_id: string; unit_id: string; quantity: string; unit_price: string; vat_rate: VatRate; requisition_line_id: string | null }>(sql`
      SELECT id, variant_id, unit_id, quantity::text, unit_price::text, vat_rate, requisition_line_id FROM purchasing.order_lines WHERE order_id = ${row.id} ORDER BY line_no`);
    return {
      supplierId: row.supplier_id,
      warehouseId: row.warehouse_id,
      orderDate: day(row.order_date),
      expectedDate: row.expected_date === null ? null : day(row.expected_date),
      note: row.note,
      lines: lines.rows.map((line) => ({
        id: line.id,
        variantId: line.variant_id,
        unitId: line.unit_id,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        vatRate: line.vat_rate,
        requisitionLineId: line.requisition_line_id,
      })),
      version: row.version,
    };
  }

  async single(executor: Executor, companyId: string, id: string): Promise<OrderRow> {
    const row = (await executor.execute<OrderRow>(sql`${this.select()} ${this.from()} WHERE o.id = ${id} AND o.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private select(): SQL {
    return sql`SELECT o.id, o.company_id, o.document_no, o.supplier_id, s.name AS supplier_name, o.warehouse_id, w.name AS warehouse_name, o.order_date, o.expected_date, o.currency, o.note,
      o.status, o.approval_request_id, o.approved_total::text, o.approved_supplier_id, o.total_amount::text, o.tax_amount::text, o.closed_reason, o.created_by,
      cu.full_name AS created_by_name, o.version`;
  }

  private from(): SQL {
    return sql`FROM purchasing.orders o JOIN crm.partners s ON s.id = o.supplier_id JOIN inventory.warehouses w ON w.id = o.warehouse_id JOIN core.users cu ON cu.id = o.created_by`;
  }
}

function toItem(row: OrderRow): PurchaseOrderListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    warehouseName: row.warehouse_name,
    orderDate: day(row.order_date),
    expectedDate: row.expected_date === null ? null : day(row.expected_date),
    currency: row.currency,
    totalAmount: trimDecimal(row.total_amount),
    taxAmount: trimDecimal(row.tax_amount),
    status: row.status,
    createdByName: row.created_by_name,
  };
}
