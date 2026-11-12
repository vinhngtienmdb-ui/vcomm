// Kế hoạch ngân sách mua (CHUC_NANG_207; QUYTAC_NGHIEPVU_442 đến 445, 453; API_235, API_236).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  BudgetLineResponse,
  BudgetOptionsResponse,
  BudgetPlanListItem,
  BudgetPlanResponse,
  budgetListQuerySchema,
  BudgetCheckResponse,
  budgetCheckSchema,
  CellOrderItem,
  cellOrdersQuerySchema,
  OpenToBuyResponse,
  OpenToBuyRow,
  openToBuyQuerySchema,
  PageResponse,
  saveBudgetPlanSchema,
} from "contracts";
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
import { purchasingAudit, purchasingPermissions, requirePermission, type Executor, type FieldErrors } from "./purchasing-context";
import { companyCurrency, ensureSequence } from "./requisitions.service";
import { checkBudget, ordersOfCell, usedByCell } from "./open-to-buy";

export const budgetPlanDocumentType = "purchasing.budget_plan";
type Input = z.output<typeof saveBudgetPlanSchema>;
type PlanRow = {
  id: string;
  document_no: string | null;
  from_month: string;
  to_month: string;
  currency: string;
  note: string | null;
  status: BudgetPlanResponse["status"];
  approval_request_id: string | null;
  total_amount: string;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  version: number;
};

// "2026-10" → ngày đầu tháng; ngày đầu tháng → "2026-10".
const firstDay = (month: string) => `${month}-01`;
const monthsBetween = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));

@Injectable()
export class BudgetPlansService implements OnModuleInit {
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
      if (event.payload.documentTypeCode !== budgetPlanDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.execute(sql`
        UPDATE purchasing.budget_plans SET status = ${status}, updated_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  async options(actor: Actor): Promise<BudgetOptionsResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const categories = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name_vi AS name FROM catalog.categories WHERE level = 1 AND status = 'active' ORDER BY code`);
    const warehouses = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT w.id, w.code, w.name FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
      WHERE o.company_id = ${actor.companyId} AND w.status = 'active' ORDER BY w.code`);
    return { currency: await companyCurrency(this.database, actor.companyId), categories: categories.rows, warehouses: warehouses.rows };
  }

  async list(actor: Actor, query: z.output<typeof budgetListQuerySchema>): Promise<PageResponse<BudgetPlanListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const conditions: SQL[] = [sql`b.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`b.status = ${query.status}`);
    if (query.year) conditions.push(sql`b.from_month <= make_date(${query.year}, 12, 1) AND b.to_month >= make_date(${query.year}, 1, 1)`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM purchasing.budget_plans b WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<PlanRow>(
      sql`${this.select()} WHERE ${where} ORDER BY b.from_month DESC, b.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    const data = await Promise.all(
      rows.rows.map(async (row) => {
        const item = toItem(row);
        // Kế hoạch đã duyệt: đã dùng = mọi đơn tính vào ngân sách trong các tháng của kế hoạch (QUYTAC_NGHIEPVU_446).
        if (row.status === "approved") item.usedAmount = trimDecimal(sumOf((await usedByCell(this.database, actor.companyId, row.from_month, row.to_month)).map((cell) => cell.used)));
        return item;
      }),
    );
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<BudgetPlanResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const row = await this.single(this.database, actor.companyId, id);
    const lines = await this.database.execute<{
      id: string;
      category_id: string;
      category_code: string;
      category_name: string;
      warehouse_id: string;
      warehouse_name: string;
      month: string;
      amount: string;
      adjusted_amount: string;
    }>(sql`
      SELECT l.id, l.category_id, c.code AS category_code, c.name_vi AS category_name, l.warehouse_id, w.name AS warehouse_name, to_char(l.month, 'YYYY-MM') AS month,
        l.amount::text, l.adjusted_amount::text
      FROM purchasing.budget_lines l JOIN catalog.categories c ON c.id = l.category_id JOIN inventory.warehouses w ON w.id = l.warehouse_id
      WHERE l.plan_id = ${id} ORDER BY c.code, w.code, l.month`);
    const used = row.status === "approved" ? await usedByCell(this.database, actor.companyId, row.from_month, row.to_month) : null;
    const usedOf = (line: { category_id: string; warehouse_id: string; month: string }) =>
      used?.find((cell) => cell.category_id === line.category_id && cell.warehouse_id === line.warehouse_id && cell.month === line.month)?.used ?? "0";
    const manage = granted.has(purchasingPermissions.manageBudgets);
    const own = row.created_by === actor.userId;
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    const editable = ["draft", "rejected", "withdrawn"].includes(row.status);
    return {
      ...toItem(row),
      usedAmount: used ? trimDecimal(sumOf(used.map((cell) => cell.used))) : null,
      note: row.note,
      approvalRequestId: row.approval_request_id,
      lines: lines.rows.map(
        (line): BudgetLineResponse => ({
          id: line.id,
          categoryId: line.category_id,
          categoryCode: line.category_code,
          categoryName: line.category_name,
          warehouseId: line.warehouse_id,
          warehouseName: line.warehouse_name,
          month: line.month,
          amount: trimDecimal(line.amount),
          adjustedAmount: trimDecimal(line.adjusted_amount),
          usedAmount: used ? trimDecimal(usedOf(line)) : null,
        }),
      ),
      version: row.version,
      canEdit: manage && editable,
      canSubmit: manage && editable && lines.rows.length > 0,
      canWithdraw: own && row.status === "pending" && !firstStepDecided,
      canCancel: manage && editable,
      canAdjust: manage && row.status === "approved",
    };
  }

  async create(actor: Actor, input: Input): Promise<BudgetPlanResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const id = await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input);
      const planId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.budget_plans (company_id, from_month, to_month, currency, note, created_by)
        VALUES (${actor.companyId}, ${firstDay(input.fromMonth)}::date, ${firstDay(input.toMonth)}::date, ${await companyCurrency(transaction, actor.companyId)}, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, planId, input);
      await this.auditService.record({ ...purchasingAudit(actor, "budget_plan"), action: "budget_plan.create", entityId: planId, afterData: input }, transaction);
      return planId;
    });
    return this.detail(actor, id);
  }

  // Sửa khi nháp, bị từ chối hoặc đã rút; sửa xong về nháp (QUYTAC_NGHIEPVU_443).
  async update(actor: Actor, id: string, input: Input): Promise<BudgetPlanResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input);
      const updated = await transaction.execute(sql`
        UPDATE purchasing.budget_plans SET from_month = ${firstDay(input.fromMonth)}::date, to_month = ${firstDay(input.toMonth)}::date, note = ${input.note}, status = 'draft',
          approval_request_id = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM purchasing.budget_lines WHERE plan_id = ${id}`);
      await this.writeLines(transaction, id, input);
      await this.auditService.record({ ...purchasingAudit(actor, "budget_plan"), action: "budget_plan.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi duyệt qua luồng duyệt dùng chung; không có chính sách thì báo lỗi, không tự duyệt (QUYTAC_NGHIEPVU_444, 445).
  async submit(actor: Actor, id: string, version: number): Promise<BudgetPlanResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const before = await this.detail(actor, id);
    if (!before.canSubmit) throw new ApiError("BUSINESS_RULE", before.canEdit ? "budgetPlanEmpty" : "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, budgetPlanDocumentType, "NSM");
    await this.database.transaction(async (transaction) => {
      // Khóa theo công ty để hai kế hoạch trùng tháng không cùng được gửi.
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext('purchasing.budget_plan'), hashtext(${actor.companyId}))`);
      const row = (await transaction.execute<PlanRow>(sql`${this.select()} WHERE b.id = ${id} AND b.status IN ('draft', 'rejected', 'withdrawn') AND b.version = ${version} FOR UPDATE OF b`)).rows[0];
      if (!row) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const overlap = await transaction.execute(sql`
        SELECT 1 FROM purchasing.budget_plans WHERE company_id = ${actor.companyId} AND id <> ${id} AND status IN ('pending', 'approved')
          AND from_month <= ${firstDay(row.to_month)}::date AND to_month >= ${firstDay(row.from_month)}::date LIMIT 1`);
      if (overlap.rows.length > 0) throw new ApiError("BUSINESS_RULE", "budgetPeriodOverlap");
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, budgetPlanDocumentType, transaction));
      const requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
        documentTypeCode: budgetPlanDocumentType,
        documentId: id,
        documentNo,
        amount: row.total_amount,
        currency: row.currency,
        documentDate: this.permissionService.today(),
      });
      await transaction.execute(sql`
        UPDATE purchasing.budget_plans SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, submitted_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record(
        { ...purchasingAudit(actor, "budget_plan"), action: "budget_plan.submit", entityId: id, afterData: { documentNo, amount: row.total_amount, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<BudgetPlanResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    const before = await this.detail(actor, id);
    if (!before.canWithdraw || !before.approvalRequestId) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, before.approvalRequestId);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE purchasing.budget_plans SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...purchasingAudit(actor, "budget_plan"), action: "budget_plan.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string, version: number): Promise<BudgetPlanResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageBudgets);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.budget_plans SET status = 'cancelled', updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) {
        await this.single(transaction, actor.companyId, id);
        throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      }
      await this.auditService.record({ ...purchasingAudit(actor, "budget_plan"), action: "budget_plan.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // API_239: ô của kế hoạch đã duyệt và ô có đơn trong tháng đã áp dụng ngân sách; gộp theo tháng, quý hoặc năm (QUYTAC_NGHIEPVU_447, 450).
  async openToBuy(actor: Actor, query: z.output<typeof openToBuyQuerySchema>): Promise<OpenToBuyResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const budgets = await this.database.execute<{ category_id: string; warehouse_id: string; month: string; amount: string; adjusted_amount: string }>(sql`
      SELECT l.category_id, l.warehouse_id, to_char(l.month, 'YYYY-MM') AS month, l.amount::text, l.adjusted_amount::text
      FROM purchasing.budget_lines l JOIN purchasing.budget_plans b ON b.id = l.plan_id
      WHERE b.company_id = ${actor.companyId} AND b.status = 'approved' AND extract(year FROM l.month) = ${query.year}`);
    const coveredMonths = new Set(
      (
        await this.database.execute<{ month: string }>(sql`
        SELECT DISTINCT to_char(m, 'YYYY-MM') AS month FROM purchasing.budget_plans b, generate_series(b.from_month, b.to_month, interval '1 month') m
        WHERE b.company_id = ${actor.companyId} AND b.status = 'approved' AND extract(year FROM m) = ${query.year}`)
      ).rows.map((row) => row.month),
    );
    const used = (await usedByCell(this.database, actor.companyId, `${query.year}-01`, `${query.year}-12`)).filter((cell) => coveredMonths.has(cell.month));
    const periodOf = (month: string) => (query.period === "month" ? month : query.period === "quarter" ? `${query.year}-Q${Math.ceil(Number(month.slice(5, 7)) / 3)}` : String(query.year));
    const cells = new Map<string, { categoryId: string; warehouseId: string; period: string; month: string; budget: number; adjusted: number; used: number; hasBudget: boolean }>();
    const cellOf = (categoryId: string, warehouseId: string, month: string) => {
      const period = periodOf(month);
      const key = `${categoryId}|${warehouseId}|${period}`;
      let cell = cells.get(key);
      if (!cell) cells.set(key, (cell = { categoryId, warehouseId, period, month, budget: 0, adjusted: 0, used: 0, hasBudget: false }));
      return cell;
    };
    for (const line of budgets.rows) {
      const cell = cellOf(line.category_id, line.warehouse_id, line.month);
      cell.budget += Number(line.amount);
      cell.adjusted += Number(line.adjusted_amount);
      cell.hasBudget = true;
    }
    for (const row of used) cellOf(row.category_id, row.warehouse_id, row.month).used += Number(row.used);
    const selected = [...cells.values()].filter((cell) => (!query.categoryId || cell.categoryId === query.categoryId) && (!query.warehouseId || cell.warehouseId === query.warehouseId));
    const names = await this.names(
      selected.map((cell) => cell.categoryId),
      selected.map((cell) => cell.warehouseId),
    );
    const money = (value: number) => trimDecimal(value.toFixed(4));
    const rows: OpenToBuyRow[] = selected
      .map((cell) => ({
        categoryId: cell.categoryId,
        categoryCode: names.categories.get(cell.categoryId)?.code ?? "",
        categoryName: names.categories.get(cell.categoryId)?.name ?? "",
        warehouseId: cell.warehouseId,
        warehouseName: names.warehouses.get(cell.warehouseId)?.name ?? "",
        warehouseCode: names.warehouses.get(cell.warehouseId)?.code ?? "",
        period: cell.period,
        month: query.period === "month" ? cell.month : null,
        budget: money(cell.budget),
        adjusted: money(cell.adjusted),
        used: money(cell.used),
        remaining: money(cell.budget + cell.adjusted - cell.used),
        hasBudget: cell.hasBudget,
      }))
      .sort((left, right) => left.categoryCode.localeCompare(right.categoryCode) || left.warehouseCode.localeCompare(right.warehouseCode) || left.period.localeCompare(right.period))
      .map(({ warehouseCode: _warehouseCode, ...row }) => row);
    const totalOf = (key: "budget" | "adjusted" | "used") => selected.reduce((sum, cell) => sum + cell[key], 0);
    return {
      currency: await companyCurrency(this.database, actor.companyId),
      year: query.year,
      period: query.period,
      rows,
      total: { budget: money(totalOf("budget")), adjusted: money(totalOf("adjusted")), used: money(totalOf("used")), remaining: money(totalOf("budget") + totalOf("adjusted") - totalOf("used")) },
    };
  }

  async cellOrders(actor: Actor, query: z.output<typeof cellOrdersQuerySchema>): Promise<CellOrderItem[]> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    const rows = await ordersOfCell(this.database, actor.companyId, query.categoryId, query.warehouseId, query.month);
    return rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      supplierName: row.supplier_name,
      orderDate: row.order_date,
      status: row.status,
      currency: row.currency,
      amount: trimDecimal(row.amount),
    }));
  }

  // API_240 (QUYTAC_NGHIEPVU_451): người lập, sửa đơn mua xem ngân sách của đơn mình mà không cần quyền xem ngân sách.
  async checkOrder(actor: Actor, input: z.output<typeof budgetCheckSchema>): Promise<BudgetCheckResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageOrders, purchasingPermissions.viewBudgets, purchasingPermissions.manageBudgets);
    if (input.orderId) {
      const own = await this.database.execute(sql`SELECT 1 FROM purchasing.orders WHERE id = ${input.orderId} AND company_id = ${actor.companyId}`);
      if (own.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    }
    if (input.warehouseId) {
      const warehouse = await this.database.execute(sql`SELECT 1 FROM inventory.warehouse_owners WHERE warehouse_id = ${input.warehouseId} AND company_id = ${actor.companyId}`);
      if (warehouse.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { warehouseId: "invalidValue" } });
    }
    const variants = [...new Set(input.lines.map((line) => line.variantId))];
    if (variants.length > 0) {
      const owned = await this.database.execute<{ count: number }>(
        sql`SELECT count(*)::int AS count FROM catalog.variants WHERE company_id = ${actor.companyId} AND id IN (${sql.join(
          variants.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
      if (owned.rows[0]!.count !== variants.length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { lines: "invalidValue" } });
    }
    return checkBudget(
      this.database,
      actor.companyId,
      {
        warehouseId: input.warehouseId,
        orderDate: input.orderDate,
        currency: input.currency ?? (await companyCurrency(this.database, actor.companyId)),
        lines: input.lines.map((line) => ({ variantId: line.variantId, amount: (Number(line.quantity) * Number(line.unitPrice)).toFixed(4) })),
      },
      input.orderId ?? null,
    );
  }

  private async names(categoryIds: string[], warehouseIds: string[]) {
    const list = (values: string[]) =>
      sql.join(
        [...new Set(values)].map((value) => sql`${value}`),
        sql`, `,
      );
    const categories = categoryIds.length
      ? (await this.database.execute<{ id: string; code: string; name: string }>(sql`SELECT id, code, name_vi AS name FROM catalog.categories WHERE id IN (${list(categoryIds)})`)).rows
      : [];
    const warehouses = warehouseIds.length
      ? (await this.database.execute<{ id: string; code: string; name: string }>(sql`SELECT id, code, name FROM inventory.warehouses WHERE id IN (${list(warehouseIds)})`)).rows
      : [];
    return { categories: new Map(categories.map((row) => [row.id, row])), warehouses: new Map(warehouses.map((row) => [row.id, row])) };
  }

  private async validate(transaction: Executor, companyId: string, input: Input): Promise<void> {
    const fields: FieldErrors = {};
    const span = monthsBetween(input.fromMonth, input.toMonth);
    if (span < 0 || span > 11) fields.toMonth = "budgetPeriodInvalid";
    const categoryIds = [...new Set(input.lines.map((line) => line.categoryId))];
    const warehouseIds = [...new Set(input.lines.map((line) => line.warehouseId))];
    const topCategories = new Set(
      categoryIds.length === 0
        ? []
        : (
            await transaction.execute<{ id: string }>(
              sql`SELECT id FROM catalog.categories WHERE level = 1 AND status = 'active' AND id IN (${sql.join(
                categoryIds.map((value) => sql`${value}`),
                sql`, `,
              )})`,
            )
          ).rows.map((row) => row.id),
    );
    const ownWarehouses = new Set(
      warehouseIds.length === 0
        ? []
        : (
            await transaction.execute<{ id: string }>(sql`
            SELECT w.id FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
            WHERE o.company_id = ${companyId} AND w.status = 'active' AND w.id IN (${sql.join(
              warehouseIds.map((value) => sql`${value}`),
              sql`, `,
            )})`)
          ).rows.map((row) => row.id),
    );
    const seen = new Set<string>();
    for (const [index, line] of input.lines.entries()) {
      if (!topCategories.has(line.categoryId)) fields[`lines.${index}.categoryId`] = "budgetCategoryNotTopLevel";
      if (!ownWarehouses.has(line.warehouseId)) fields[`lines.${index}.warehouseId`] = "invalidValue";
      if (line.month < input.fromMonth || line.month > input.toMonth) fields[`lines.${index}.month`] = "budgetMonthOutsidePeriod";
      const key = `${line.categoryId}|${line.warehouseId}|${line.month}`;
      if (seen.has(key)) fields[`lines.${index}.month`] = "budgetCellDuplicate";
      seen.add(key);
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeLines(transaction: Executor, planId: string, input: Input): Promise<void> {
    if (input.lines.length === 0) return;
    await transaction.execute(sql`
      INSERT INTO purchasing.budget_lines (plan_id, category_id, warehouse_id, month, amount)
      VALUES ${sql.join(
        input.lines.map((line) => sql`(${planId}, ${line.categoryId}, ${line.warehouseId}, ${firstDay(line.month)}::date, ${line.amount}::numeric)`),
        sql`, `,
      )}`);
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<PlanRow> {
    const row = (await executor.execute<PlanRow>(sql`${this.select()} WHERE b.id = ${id} AND b.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private select(): SQL {
    return sql`SELECT b.id, b.document_no, to_char(b.from_month, 'YYYY-MM') AS from_month, to_char(b.to_month, 'YYYY-MM') AS to_month, b.currency, b.note, b.status,
      b.approval_request_id, b.created_by, cu.full_name AS created_by_name, b.created_at, b.version,
      (SELECT coalesce(sum(l.amount + l.adjusted_amount), 0)::text FROM purchasing.budget_lines l WHERE l.plan_id = b.id) AS total_amount
      FROM purchasing.budget_plans b JOIN core.users cu ON cu.id = b.created_by`;
  }
}

const sumOf = (values: string[]) => values.reduce((sum, value) => sum + Number(value), 0).toFixed(4);

function toItem(row: PlanRow): BudgetPlanListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    fromMonth: row.from_month,
    toMonth: row.to_month,
    currency: row.currency,
    totalAmount: trimDecimal(row.total_amount),
    usedAmount: null,
    status: row.status,
    createdByName: row.created_by_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
