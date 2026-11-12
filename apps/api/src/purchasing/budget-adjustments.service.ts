// Phiếu điều chỉnh ngân sách mua (CHUC_NANG_208; QUYTAC_NGHIEPVU_448, 449; API_237, API_238).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { BudgetAdjustmentListItem, BudgetAdjustmentResponse, budgetListQuerySchema, PageResponse, saveBudgetAdjustmentSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { usedByCell } from "./open-to-buy";
import { purchasingAudit, purchasingPermissions, requirePermission, type Executor, type FieldErrors } from "./purchasing-context";
import { ensureSequence } from "./requisitions.service";

export const budgetAdjustmentDocumentType = "purchasing.budget_adjustment";
type Input = z.output<typeof saveBudgetAdjustmentSchema>;
type AdjustmentRow = {
  id: string;
  document_no: string | null;
  plan_id: string;
  plan_document_no: string | null;
  plan_from_month: string;
  plan_to_month: string;
  plan_status: string;
  reason: string;
  currency: string;
  status: BudgetAdjustmentResponse["status"];
  approval_request_id: string | null;
  total_increase: string;
  total_decrease: string;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  version: number;
};
type LineRow = { id: string; category_id: string; category_code: string; category_name: string; warehouse_id: string; warehouse_name: string; month: string; delta: string };

const firstDay = (month: string) => `${month}-01`;

@Injectable()
export class BudgetAdjustmentsService implements OnModuleInit {
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
      if (event.payload.documentTypeCode !== budgetAdjustmentDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const updated = await transaction.execute<{ id: string; plan_id: string; company_id: string }>(sql`
          UPDATE purchasing.budget_adjustments SET status = ${status}, updated_at = now(), applied_at = CASE WHEN ${status} = 'approved' THEN now() END
          WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id, plan_id, company_id`);
        const adjustment = updated.rows[0];
        if (!adjustment || status !== "approved") return;
        await this.apply(transaction, adjustment.id, adjustment.plan_id, adjustment.company_id);
      });
    });
  }

  // Duyệt xong thì áp vào ô của kế hoạch; ô chưa có thì tạo với ngân sách gốc 0 (QUYTAC_NGHIEPVU_448).
  // Giảm làm ô nhỏ hơn số đã dùng (đơn mới được duyệt trong lúc chờ) vẫn áp, ghi nhật ký (QUYTAC_NGHIEPVU_449).
  private async apply(transaction: Executor, adjustmentId: string, planId: string, companyId: string): Promise<void> {
    const lines = (
      await transaction.execute<{ category_id: string; warehouse_id: string; month: string; delta: string }>(sql`
      SELECT category_id, warehouse_id, to_char(month, 'YYYY-MM') AS month, delta::text FROM purchasing.budget_adjustment_lines WHERE adjustment_id = ${adjustmentId}`)
    ).rows;
    for (const line of lines) {
      await transaction.execute(sql`
        INSERT INTO purchasing.budget_lines (plan_id, category_id, warehouse_id, month, amount, adjusted_amount)
        VALUES (${planId}, ${line.category_id}, ${line.warehouse_id}, ${firstDay(line.month)}::date, 0, ${line.delta}::numeric)
        ON CONFLICT (plan_id, category_id, warehouse_id, month) DO UPDATE SET adjusted_amount = purchasing.budget_lines.adjusted_amount + EXCLUDED.adjusted_amount`);
    }
    const shortfalls = await this.shortfalls(transaction, companyId, planId, lines);
    await this.auditService.record(
      { actorUserId: null, companyId, appCode: "purchasing", entityType: "budget_adjustment", action: "budget_adjustment.apply", entityId: adjustmentId, afterData: { lines, belowUsed: shortfalls } },
      transaction,
    );
  }

  async list(actor: Actor, query: z.output<typeof budgetListQuerySchema>): Promise<PageResponse<BudgetAdjustmentListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const conditions: SQL[] = [sql`a.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`a.status = ${query.status}`);
    if (query.planId) conditions.push(sql`a.plan_id = ${query.planId}`);
    if (query.year) conditions.push(sql`b.from_month <= make_date(${query.year}, 12, 1) AND b.to_month >= make_date(${query.year}, 1, 1)`);
    const where = sql.join(conditions, sql` AND `);
    const total = (
      await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM purchasing.budget_adjustments a JOIN purchasing.budget_plans b ON b.id = a.plan_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<AdjustmentRow>(sql`${this.select()} WHERE ${where} ORDER BY a.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<BudgetAdjustmentResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const row = await this.single(this.database, actor.companyId, id);
    const lines = (
      await this.database.execute<LineRow>(sql`
      SELECT l.id, l.category_id, c.code AS category_code, c.name_vi AS category_name, l.warehouse_id, w.name AS warehouse_name, to_char(l.month, 'YYYY-MM') AS month, l.delta::text
      FROM purchasing.budget_adjustment_lines l JOIN catalog.categories c ON c.id = l.category_id JOIN inventory.warehouses w ON w.id = l.warehouse_id
      WHERE l.adjustment_id = ${id} ORDER BY l.line_no`)
    ).rows;
    const cells = await this.cellState(this.database, actor.companyId, row.plan_id, row.plan_from_month, row.plan_to_month);
    const manage = granted.has(purchasingPermissions.manageBudgets);
    const own = row.created_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    const editable = ["draft", "rejected", "withdrawn"].includes(row.status);
    return {
      ...toItem(row),
      planFromMonth: row.plan_from_month,
      planToMonth: row.plan_to_month,
      approvalRequestId: row.approval_request_id,
      lines: lines.map((line) => {
        const cell = cells(line.category_id, line.warehouse_id, line.month);
        // Phiếu đã duyệt: ngân sách hiện tại đã gồm phần điều chỉnh này.
        const current = row.status === "approved" ? cell.budget - Number(line.delta) : cell.budget;
        return {
          id: line.id,
          categoryId: line.category_id,
          categoryCode: line.category_code,
          categoryName: line.category_name,
          warehouseId: line.warehouse_id,
          warehouseName: line.warehouse_name,
          month: line.month,
          delta: trimDecimal(line.delta),
          currentBudget: trimDecimal(current.toFixed(4)),
          used: trimDecimal(cell.used.toFixed(4)),
          after: trimDecimal((current + Number(line.delta)).toFixed(4)),
        };
      }),
      version: row.version,
      canEdit: manage && editable,
      canSubmit: manage && editable && row.plan_status === "approved",
      canWithdraw: own && row.status === "pending" && !firstStepDecided,
      canCancel: manage && editable,
    };
  }

  async create(actor: Actor, input: Input): Promise<BudgetAdjustmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const id = await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input);
      const adjustmentId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.budget_adjustments (company_id, plan_id, reason, created_by) VALUES (${actor.companyId}, ${input.planId}, ${input.reason}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, adjustmentId, input);
      await this.auditService.record({ ...purchasingAudit(actor, "budget_adjustment"), action: "budget_adjustment.create", entityId: adjustmentId, afterData: input }, transaction);
      return adjustmentId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<BudgetAdjustmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input);
      const updated = await transaction.execute(sql`
        UPDATE purchasing.budget_adjustments SET plan_id = ${input.planId}, reason = ${input.reason}, status = 'draft', approval_request_id = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM purchasing.budget_adjustment_lines WHERE adjustment_id = ${id}`);
      await this.writeLines(transaction, id, input);
      await this.auditService.record({ ...purchasingAudit(actor, "budget_adjustment"), action: "budget_adjustment.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi duyệt: giá trị duyệt là tổng số tăng; giảm dưới số đã dùng bị từ chối; không có chính sách thì báo lỗi (QUYTAC_NGHIEPVU_448, 449).
  async submit(actor: Actor, id: string, version: number): Promise<BudgetAdjustmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const before = await this.detail(actor, id);
    if (!before.canSubmit) throw new ApiError("BUSINESS_RULE", before.canEdit ? "budgetPlanNotApproved" : "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, budgetAdjustmentDocumentType, "DCNS");
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<AdjustmentRow>(sql`${this.select()} WHERE a.id = ${id} AND a.status IN ('draft', 'rejected', 'withdrawn') AND a.version = ${version} FOR UPDATE OF a`))
        .rows[0];
      if (!row) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const lines = (
        await transaction.execute<{ category_id: string; warehouse_id: string; month: string; delta: string }>(sql`
        SELECT category_id, warehouse_id, to_char(month, 'YYYY-MM') AS month, delta::text FROM purchasing.budget_adjustment_lines WHERE adjustment_id = ${id} ORDER BY line_no`)
      ).rows;
      const shortfalls = await this.shortfalls(transaction, actor.companyId, row.plan_id, lines);
      if (shortfalls.length > 0) {
        const fields: FieldErrors = {};
        for (const index of shortfalls) fields[`lines.${index}.delta`] = "budgetBelowUsed";
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      }
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, budgetAdjustmentDocumentType, transaction));
      const requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
        documentTypeCode: budgetAdjustmentDocumentType,
        documentId: id,
        documentNo,
        amount: row.total_increase,
        currency: row.currency,
        documentDate: this.permissionService.today(),
      });
      await transaction.execute(sql`
        UPDATE purchasing.budget_adjustments SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, submitted_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record(
        { ...purchasingAudit(actor, "budget_adjustment"), action: "budget_adjustment.submit", entityId: id, afterData: { documentNo, amount: row.total_increase, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<BudgetAdjustmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const before = await this.detail(actor, id);
    if (!before.canWithdraw || !before.approvalRequestId) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, before.approvalRequestId);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE purchasing.budget_adjustments SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...purchasingAudit(actor, "budget_adjustment"), action: "budget_adjustment.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<BudgetAdjustmentResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.budget_adjustments SET status = 'cancelled', updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) {
        await this.single(transaction, actor.companyId, id);
        throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      }
      await this.auditService.record({ ...purchasingAudit(actor, "budget_adjustment"), action: "budget_adjustment.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Chỉ số các dòng giảm làm ngân sách ô nhỏ hơn số đã dùng (QUYTAC_NGHIEPVU_449).
  private async shortfalls(executor: Executor, companyId: string, planId: string, lines: { category_id: string; warehouse_id: string; month: string; delta: string }[]): Promise<number[]> {
    const plan = (
      await executor.execute<{ from_month: string; to_month: string }>(sql`
      SELECT to_char(from_month, 'YYYY-MM') AS from_month, to_char(to_month, 'YYYY-MM') AS to_month FROM purchasing.budget_plans WHERE id = ${planId}`)
    ).rows[0]!;
    const cells = await this.cellState(executor, companyId, planId, plan.from_month, plan.to_month);
    return lines.flatMap((line, index) => {
      if (Number(line.delta) >= 0) return [];
      const cell = cells(line.category_id, line.warehouse_id, line.month);
      return cell.budget + Number(line.delta) < cell.used - 0.00005 ? [index] : [];
    });
  }

  // Ngân sách hiện tại (gốc + điều chỉnh đã duyệt) và số đã dùng của các ô trong kỳ kế hoạch.
  private async cellState(executor: Executor, companyId: string, planId: string, fromMonth: string, toMonth: string) {
    const budgets = (
      await executor.execute<{ category_id: string; warehouse_id: string; month: string; budget: string }>(sql`
      SELECT category_id, warehouse_id, to_char(month, 'YYYY-MM') AS month, (amount + adjusted_amount)::text AS budget FROM purchasing.budget_lines WHERE plan_id = ${planId}`)
    ).rows;
    const used = await usedByCell(executor, companyId, fromMonth, toMonth);
    return (categoryId: string, warehouseId: string, month: string) => ({
      budget: Number(budgets.find((cell) => cell.category_id === categoryId && cell.warehouse_id === warehouseId && cell.month === month)?.budget ?? 0),
      used: Number(used.find((cell) => cell.category_id === categoryId && cell.warehouse_id === warehouseId && cell.month === month)?.used ?? 0),
    });
  }

  private async validate(transaction: Executor, companyId: string, input: Input): Promise<void> {
    const plan = (
      await transaction.execute<{ from_month: string; to_month: string; status: string }>(sql`
      SELECT to_char(from_month, 'YYYY-MM') AS from_month, to_char(to_month, 'YYYY-MM') AS to_month, status FROM purchasing.budget_plans WHERE id = ${input.planId} AND company_id = ${companyId}`)
    ).rows[0];
    if (!plan || plan.status !== "approved") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { planId: "budgetPlanNotApproved" } });
    const list = (values: string[]) =>
      sql.join(
        [...new Set(values)].map((value) => sql`${value}`),
        sql`, `,
      );
    const topCategories = new Set(
      (
        await transaction.execute<{ id: string }>(sql`SELECT id FROM catalog.categories WHERE level = 1 AND status = 'active' AND id IN (${list(input.lines.map((line) => line.categoryId))})`)
      ).rows.map((row) => row.id),
    );
    const ownWarehouses = new Set(
      (
        await transaction.execute<{ id: string }>(sql`
        SELECT w.id FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
        WHERE o.company_id = ${companyId} AND w.status = 'active' AND w.id IN (${list(input.lines.map((line) => line.warehouseId))})`)
      ).rows.map((row) => row.id),
    );
    const fields: FieldErrors = {};
    const seen = new Set<string>();
    for (const [index, line] of input.lines.entries()) {
      if (!topCategories.has(line.categoryId)) fields[`lines.${index}.categoryId`] = "budgetCategoryNotTopLevel";
      if (!ownWarehouses.has(line.warehouseId)) fields[`lines.${index}.warehouseId`] = "invalidValue";
      if (line.month < plan.from_month || line.month > plan.to_month) fields[`lines.${index}.month`] = "budgetMonthOutsidePeriod";
      const key = `${line.categoryId}|${line.warehouseId}|${line.month}`;
      if (seen.has(key)) fields[`lines.${index}.month`] = "budgetCellDuplicate";
      seen.add(key);
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeLines(transaction: Executor, adjustmentId: string, input: Input): Promise<void> {
    await transaction.execute(sql`
      INSERT INTO purchasing.budget_adjustment_lines (adjustment_id, line_no, category_id, warehouse_id, month, delta)
      VALUES ${sql.join(
        input.lines.map((line, index) => sql`(${adjustmentId}, ${index + 1}, ${line.categoryId}, ${line.warehouseId}, ${firstDay(line.month)}::date, ${line.delta}::numeric)`),
        sql`, `,
      )}`);
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<AdjustmentRow> {
    const row = (await executor.execute<AdjustmentRow>(sql`${this.select()} WHERE a.id = ${id} AND a.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private select(): SQL {
    return sql`SELECT a.id, a.document_no, a.plan_id, b.document_no AS plan_document_no, to_char(b.from_month, 'YYYY-MM') AS plan_from_month, to_char(b.to_month, 'YYYY-MM') AS plan_to_month,
      b.status AS plan_status, a.reason, b.currency, a.status, a.approval_request_id, a.created_by, cu.full_name AS created_by_name, a.created_at, a.version,
      (SELECT coalesce(sum(l.delta) FILTER (WHERE l.delta > 0), 0)::text FROM purchasing.budget_adjustment_lines l WHERE l.adjustment_id = a.id) AS total_increase,
      (SELECT coalesce(-sum(l.delta) FILTER (WHERE l.delta < 0), 0)::text FROM purchasing.budget_adjustment_lines l WHERE l.adjustment_id = a.id) AS total_decrease
      FROM purchasing.budget_adjustments a JOIN purchasing.budget_plans b ON b.id = a.plan_id JOIN core.users cu ON cu.id = a.created_by`;
  }
}

function toItem(row: AdjustmentRow): BudgetAdjustmentListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    planId: row.plan_id,
    planDocumentNo: row.plan_document_no,
    reason: row.reason,
    currency: row.currency,
    totalIncrease: trimDecimal(row.total_increase),
    totalDecrease: trimDecimal(row.total_decrease),
    status: row.status,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
