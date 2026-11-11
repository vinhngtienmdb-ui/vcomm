// Đề nghị mua (CHUC_NANG_50; QUYTAC_NGHIEPVU_62; API_74): lập, gửi duyệt, rút, đóng; số đã đặt tính từ dòng đơn mua.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { PageResponse, PurchaseDocumentStatus, purchaseListQuerySchema, RequisitionListItem, RequisitionResponse, saveRequisitionSchema } from "contracts";
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
import { NumberSequencesService } from "../settings/number-sequences.service";
import { isActiveSupplier, isReceivingWarehouse, purchasingAudit, purchasingPermissions, requirePermission, variantUnitFactor, type Executor, type FieldErrors } from "./purchasing-context";

const documentTypeCode = "purchasing.requisition";
type Input = z.output<typeof saveRequisitionSchema>;
type RequisitionRow = {
  id: string;
  document_no: string | null;
  warehouse_id: string;
  warehouse_name: string;
  needed_by: Date | string;
  reason: string;
  status: PurchaseDocumentStatus;
  approval_request_id: string | null;
  line_count: number;
  estimated_total: string;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  version: number;
};

// Số đã đặt của dòng đề nghị: dòng đơn mua chưa bị từ chối, rút; đơn đã đóng chỉ tính phần đã nhận (QUYTAC_NGHIEPVU_62).
export const orderedOnRequisitionLine = (lineId: SQL) => sql`coalesce((
  SELECT sum(CASE WHEN o.status = 'closed' THEN least(ol.base_quantity, coalesce((
    SELECT sum(dl.base_quantity - coalesce(dl.rejected_base_quantity, 0)) FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
    WHERE dl.source_line_id = ol.id AND d.type = 'purchase_receipt' AND d.status = 'posted'), 0)) ELSE ol.base_quantity END)
  FROM purchasing.order_lines ol JOIN purchasing.orders o ON o.id = ol.order_id
  WHERE ol.requisition_line_id = ${lineId} AND o.status NOT IN ('rejected', 'withdrawn')), 0)`;

@Injectable()
export class RequisitionsService implements OnModuleInit {
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
      await this.database.execute(sql`
        UPDATE purchasing.requisitions SET status = ${status}, updated_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  async list(actor: Actor, query: z.output<typeof purchaseListQuerySchema>): Promise<PageResponse<RequisitionListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.createRequisition, purchasingPermissions.manageOrders);
    const conditions: SQL[] = [sql`r.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`r.status = ${query.status}`);
    if (query.search) conditions.push(sql`(r.document_no = ${query.search.toUpperCase()} OR r.reason ILIKE ${`%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`})`);
    // Đề nghị còn đặt được: đã duyệt, còn dòng chưa đặt hết.
    if (query.openOnly)
      conditions.push(
        sql`r.status = 'approved' AND EXISTS (SELECT 1 FROM purchasing.requisition_lines rl WHERE rl.requisition_id = r.id AND rl.base_quantity > ${orderedOnRequisitionLine(sql`rl.id`)})`,
      );
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM purchasing.requisitions r WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<RequisitionRow>(sql`${this.select()} WHERE ${where} ORDER BY r.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<RequisitionResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.createRequisition, purchasingPermissions.manageOrders);
    const row = await this.single(actor.companyId, id);
    const lines = await this.database.execute<{
      id: string;
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      unit_id: string;
      unit_name: string;
      quantity: string;
      base_quantity: string;
      estimated_unit_price: string;
      suggested_supplier_id: string | null;
      suggested_supplier_name: string | null;
      note: string | null;
      ordered: string;
    }>(sql`
      SELECT rl.id, rl.variant_id, v.sku, p.name AS product_name, v.option_values, rl.unit_id, u.name_vi AS unit_name, rl.quantity::text, rl.base_quantity::text,
        rl.estimated_unit_price::text, rl.suggested_supplier_id, s.name AS suggested_supplier_name, rl.note, ${orderedOnRequisitionLine(sql`rl.id`)}::text AS ordered
      FROM purchasing.requisition_lines rl JOIN catalog.variants v ON v.id = rl.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = rl.unit_id
      LEFT JOIN crm.partners s ON s.id = rl.suggested_supplier_id
      WHERE rl.requisition_id = ${id} ORDER BY rl.line_no`);
    const own = row.created_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    const remaining = lines.rows.some((line) => Number(line.base_quantity) > Number(line.ordered));
    return {
      ...toItem(row),
      warehouseId: row.warehouse_id,
      approvalRequestId: row.approval_request_id,
      lines: lines.rows.map((line) => ({
        id: line.id,
        variantId: line.variant_id,
        sku: line.sku,
        productName: line.product_name,
        optionValues: line.option_values,
        unitId: line.unit_id,
        unitName: line.unit_name,
        quantity: trimDecimal(line.quantity),
        baseQuantity: trimDecimal(line.base_quantity),
        estimatedUnitPrice: trimDecimal(line.estimated_unit_price),
        suggestedSupplierId: line.suggested_supplier_id,
        suggestedSupplierName: line.suggested_supplier_name,
        note: line.note,
        orderedBaseQuantity: trimDecimal(line.ordered),
      })),
      version: row.version,
      canEdit: own && ["draft", "rejected", "withdrawn"].includes(row.status),
      canWithdraw: own && row.status === "pending" && !firstStepDecided,
      canOrder: granted.has(purchasingPermissions.manageOrders) && row.status === "approved" && remaining,
    };
  }

  async create(actor: Actor, input: Input): Promise<RequisitionResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.createRequisition);
    const id = await this.database.transaction(async (transaction) => {
      const lines = await this.validate(transaction, actor.companyId, input);
      const requisitionId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.requisitions (company_id, warehouse_id, needed_by, reason, created_by)
        VALUES (${actor.companyId}, ${input.warehouseId}, ${input.neededBy}::date, ${input.reason}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, requisitionId, input, lines);
      await this.auditService.record({ ...purchasingAudit(actor, "requisition"), action: "requisition.create", entityId: requisitionId, afterData: input }, transaction);
      return requisitionId;
    });
    return this.detail(actor, id);
  }

  // Sửa khi nháp, bị từ chối hoặc đã rút; sửa xong về nháp, gửi lại tạo yêu cầu duyệt mới.
  async update(actor: Actor, id: string, input: Input): Promise<RequisitionResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.createRequisition);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      const lines = await this.validate(transaction, actor.companyId, input);
      const updated = await transaction.execute(sql`
        UPDATE purchasing.requisitions SET warehouse_id = ${input.warehouseId}, needed_by = ${input.neededBy}::date, reason = ${input.reason}, status = 'draft', approval_request_id = NULL,
          updated_at = now(), version = version + 1
        WHERE id = ${id} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM purchasing.requisition_lines WHERE requisition_id = ${id}`);
      await this.writeLines(transaction, id, input, lines);
      await this.auditService.record({ ...purchasingAudit(actor, "requisition"), action: "requisition.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi duyệt; công ty chưa có chính sách duyệt đề nghị mua thì duyệt ngay (QUYTAC_NGHIEPVU_62).
  async submit(actor: Actor, id: string): Promise<RequisitionResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.createRequisition);
    const row = await this.single(actor.companyId, id);
    if (row.created_by !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "DNM");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{ document_no: string | null }>(sql`
        SELECT document_no FROM purchasing.requisitions WHERE id = ${id} AND status = 'draft' AND version = ${row.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const documentNo = locked.rows[0]!.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: id,
          documentNo,
          amount: row.estimated_total,
          currency: await companyCurrency(transaction, actor.companyId),
          documentDate: this.permissionService.today(),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE purchasing.requisitions SET status = ${requestId ? "pending" : "approved"}, document_no = ${documentNo}, approval_request_id = ${requestId}, submitted_at = now(),
          updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record(
        { ...purchasingAudit(actor, "requisition"), action: "requisition.submit", entityId: id, afterData: { documentNo, amount: row.estimated_total, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<RequisitionResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.createRequisition);
    const row = await this.single(actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.execute(sql`UPDATE purchasing.requisitions SET status = 'withdrawn', updated_at = now() WHERE id = ${id} AND status = 'pending'`);
    return this.detail(actor, id);
  }

  // Đóng đề nghị đã duyệt: phần chưa đặt không đặt được nữa.
  async close(actor: Actor, id: string, version: number): Promise<RequisitionResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.requisitions SET status = 'closed', updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'approved' AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...purchasingAudit(actor, "requisition"), action: "requisition.close", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  private async validate(transaction: Executor, companyId: string, input: Input): Promise<{ baseQuantity: string }[]> {
    const fields: FieldErrors = {};
    if (!(await isReceivingWarehouse(transaction, companyId, input.warehouseId))) fields.warehouseId = "invalidValue";
    const lines: { baseQuantity: string }[] = [];
    for (const [index, line] of input.lines.entries()) {
      const unit = await variantUnitFactor(transaction, companyId, line.variantId, line.unitId);
      if (!unit) fields[`lines.${index}.unitId`] = "invalidValue";
      if (line.suggestedSupplierId && !(await isActiveSupplier(transaction, companyId, line.suggestedSupplierId))) fields[`lines.${index}.suggestedSupplierId`] = "supplierNotActive";
      lines.push({ baseQuantity: unit ? (Number(line.quantity) * unit.factor).toFixed(4) : "0" });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return lines;
  }

  private async writeLines(transaction: Executor, requisitionId: string, input: Input, lines: { baseQuantity: string }[]): Promise<void> {
    for (const [index, line] of input.lines.entries()) {
      await transaction.execute(sql`
        INSERT INTO purchasing.requisition_lines (requisition_id, line_no, variant_id, unit_id, quantity, base_quantity, estimated_unit_price, suggested_supplier_id, note)
        VALUES (${requisitionId}, ${index + 1}, ${line.variantId}, ${line.unitId}, ${line.quantity}::numeric, ${lines[index]!.baseQuantity}::numeric, ${line.estimatedUnitPrice ?? "0"}::numeric,
          ${line.suggestedSupplierId ?? null}, ${line.note})`);
    }
  }

  private async single(companyId: string, id: string): Promise<RequisitionRow> {
    const row = (await this.database.execute<RequisitionRow>(sql`${this.select()} WHERE r.id = ${id} AND r.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private select(): SQL {
    return sql`SELECT r.id, r.document_no, r.warehouse_id, w.name AS warehouse_name, r.needed_by, r.reason, r.status, r.approval_request_id, r.created_by, cu.full_name AS created_by_name,
      r.created_at, r.version,
      (SELECT count(*)::int FROM purchasing.requisition_lines rl WHERE rl.requisition_id = r.id) AS line_count,
      (SELECT coalesce(sum(rl.quantity * rl.estimated_unit_price), 0)::text FROM purchasing.requisition_lines rl WHERE rl.requisition_id = r.id) AS estimated_total
      FROM purchasing.requisitions r JOIN inventory.warehouses w ON w.id = r.warehouse_id JOIN core.users cu ON cu.id = r.created_by`;
  }
}

function toItem(row: RequisitionRow): RequisitionListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    warehouseName: row.warehouse_name,
    neededBy: day(row.needed_by),
    reason: row.reason,
    status: row.status,
    lineCount: row.line_count,
    estimatedTotal: trimDecimal(row.estimated_total),
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function companyCurrency(executor: Pick<Executor, "execute">, companyId: string): Promise<string> {
  return (await executor.execute<{ base_currency: string }>(sql`SELECT base_currency FROM core.companies WHERE id = ${companyId}`)).rows[0]!.base_currency;
}

// Công ty chưa cấu hình dãy số loại chứng từ thì tự tạo dãy theo năm (như phiếu kho, phiếu điều chỉnh giá).
export async function ensureSequence(database: Database, sequences: NumberSequencesService, actor: Actor, typeCode: string, prefix: string): Promise<void> {
  const configured = await database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${actor.companyId} AND document_type_code = ${typeCode} LIMIT 1`);
  if (configured.rows.length === 0) await sequences.update(actor, typeCode, { prefix, resetPeriod: "year", padding: 6 });
}
