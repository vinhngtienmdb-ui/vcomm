// Đánh giá hiệu suất: mẫu tiêu chí, kỳ, phiếu, mục tiêu, tự đánh giá, người quản lý chấm, hiệu chỉnh, chốt, công bố (CONG_VIEC_54; CHUC_NANG_192; QUYTAC_NGHIEPVU_389; API_205).
import { Inject, Injectable } from "@nestjs/common";
import type {
  MyReviewsResponse,
  ReviewCycleItem,
  ReviewCycleOptionsResponse,
  ReviewCycleResponse,
  ReviewGrade,
  ReviewListItem,
  ReviewPhase,
  ReviewResponse,
  ReviewTemplateResponse,
  saveReviewCycleSchema,
  saveReviewGoalsSchema,
  saveReviewScoresSchema,
  saveReviewTemplateSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { messages } from "i18n";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { hrAudit, hrGranted, positionAt } from "./hr-context";
import { fillTemplate } from "./recruitment-emails";

type Executor = Pick<Database, "execute">;
type CycleInput = z.output<typeof saveReviewCycleSchema>;
export const reviewPermission = "hr.review.manage";

type CycleRow = {
  id: string;
  name: string;
  period_from: string;
  period_to: string;
  template_id: string;
  template_name: string;
  goal_weight: number;
  competency_weight: number;
  threshold_a: string;
  threshold_b: string;
  threshold_c: string;
  goal_deadline: string;
  self_deadline: string;
  manager_deadline: string;
  all_departments: boolean;
  status: ReviewCycleItem["status"];
  review_count: number;
  submitted_count: number;
  version: number;
};

type ReviewRow = {
  id: string;
  company_id: string;
  cycle_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  employee_user_id: string | null;
  department_name: string | null;
  reviewer_id: string | null;
  reviewer_name: string | null;
  goals_confirmed_at: string | null;
  self_submitted_at: string | null;
  manager_submitted_at: string | null;
  goal_score: string | null;
  competency_score: string | null;
  total_score: string | null;
  adjusted_score: string | null;
  adjustment_reason: string | null;
  manager_comment: string | null;
  self_comment: string | null;
  excluded_at: string | null;
  excluded_reason: string | null;
  acknowledged_at: string | null;
  employee_comment: string | null;
  version: number;
};

const two = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

// Xếp loại theo ngưỡng của kỳ: A, B, C từ điểm tối thiểu; dưới C là D.
export function gradeOf(score: string | null, cycle: { threshold_a: string; threshold_b: string; threshold_c: string }): ReviewGrade | null {
  if (score === null) return null;
  const value = Number(score);
  if (value >= Number(cycle.threshold_a)) return "A";
  if (value >= Number(cycle.threshold_b)) return "B";
  if (value >= Number(cycle.threshold_c)) return "C";
  return "D";
}

export function phaseOf(
  row: Pick<ReviewRow, "excluded_at" | "manager_submitted_at" | "goals_confirmed_at" | "self_submitted_at">,
  goalWeight: number,
  selfDeadline: string,
  today: string,
): ReviewPhase {
  if (row.excluded_at) return "excluded";
  if (row.manager_submitted_at) return "submitted";
  if (goalWeight > 0 && !row.goals_confirmed_at) return "goals";
  if (!row.self_submitted_at && today <= selfDeadline) return "self";
  return "manager";
}

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  private async requireManage(actor: Actor): Promise<void> {
    if (!(await hrGranted(this.permissionService, actor)).has(reviewPermission)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // ---------- Mẫu đánh giá ----------

  async templates(actor: Actor): Promise<ReviewTemplateResponse[]> {
    await this.requireManage(actor);
    const rows = await this.database.execute<{ id: string; name: string; used: number; version: number }>(sql`
      SELECT t.id, t.name, (SELECT count(*)::int FROM hr.review_cycles c WHERE c.template_id = t.id AND c.status <> 'draft') AS used, t.version
      FROM hr.review_templates t WHERE t.company_id = ${actor.companyId} ORDER BY t.created_at DESC`);
    const criteria = await this.database.execute<{ id: string; template_id: string; name: string; description: string | null; weight: number }>(sql`
      SELECT c.id, c.template_id, c.name, c.description, c.weight FROM hr.review_criteria c JOIN hr.review_templates t ON t.id = c.template_id
      WHERE t.company_id = ${actor.companyId} ORDER BY c.position`);
    return rows.rows.map((row) => ({
      id: row.id,
      name: row.name,
      usedInCycles: row.used,
      version: row.version,
      criteria: criteria.rows.filter((item) => item.template_id === row.id).map((item) => ({ id: item.id, name: item.name, description: item.description, weight: item.weight })),
    }));
  }

  private checkWeights(weights: number[], field: string): void {
    if (weights.reduce((sum, weight) => sum + weight, 0) !== 100) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "weightsNotHundred" } });
  }

  private async writeCriteria(executor: Executor, templateId: string, input: z.output<typeof saveReviewTemplateSchema>): Promise<void> {
    await executor.execute(sql`DELETE FROM hr.review_criteria WHERE template_id = ${templateId}`);
    for (const [index, criterion] of input.criteria.entries()) {
      await executor.execute(sql`
        INSERT INTO hr.review_criteria (template_id, position, name, description, weight) VALUES (${templateId}, ${index + 1}, ${criterion.name}, ${criterion.description}, ${criterion.weight})`);
    }
  }

  async saveTemplate(actor: Actor, id: string | null, input: z.output<typeof saveReviewTemplateSchema>): Promise<ReviewTemplateResponse> {
    await this.requireManage(actor);
    this.checkWeights(
      input.criteria.map((item) => item.weight),
      "criteria",
    );
    const templateId = await this.database.transaction(async (transaction) => {
      if (id) {
        const row = (
          await transaction.execute<{ version: number; used: boolean }>(sql`
          SELECT version, EXISTS (SELECT 1 FROM hr.review_cycles c WHERE c.template_id = t.id AND c.status <> 'draft') AS used
          FROM hr.review_templates t WHERE t.id = ${id} AND t.company_id = ${actor.companyId} FOR UPDATE`)
        ).rows[0];
        if (!row) throw new ApiError("NOT_FOUND", "notFound");
        // Mẫu đã dùng trong kỳ đã mở không sửa tiêu chí (sao chép thành mẫu mới).
        if (row.used) throw new ApiError("BUSINESS_RULE", "reviewTemplateUsed");
        if (input.version !== undefined && input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`UPDATE hr.review_templates SET name = ${input.name}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
        await this.writeCriteria(transaction, id, input);
        await this.auditService.record({ ...hrAudit(actor, "review_template"), action: "review_template.update", entityId: id }, transaction);
        return id;
      }
      const created = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.review_templates (company_id, name, created_by) VALUES (${actor.companyId}, ${input.name}, ${actor.userId}) RETURNING id`);
      const newId = created.rows[0]!.id;
      await this.writeCriteria(transaction, newId, input);
      await this.auditService.record({ ...hrAudit(actor, "review_template"), action: "review_template.create", entityId: newId }, transaction);
      return newId;
    });
    return (await this.templates(actor)).find((item) => item.id === templateId)!;
  }

  async copyTemplate(actor: Actor, id: string): Promise<ReviewTemplateResponse> {
    const source = (await this.templates(actor)).find((item) => item.id === id);
    if (!source) throw new ApiError("NOT_FOUND", "notFound");
    const suffix = messages.vi.reviews.copySuffix;
    return this.saveTemplate(actor, null, {
      name: `${source.name}${suffix}`.slice(0, 150),
      criteria: source.criteria.map((item) => ({ name: item.name, description: item.description, weight: item.weight })),
    });
  }

  // ---------- Kỳ đánh giá ----------

  private cycleSelect(): SQL {
    return sql`
      SELECT c.id, c.name, c.period_from::text, c.period_to::text, c.template_id, t.name AS template_name, c.goal_weight, c.competency_weight, c.threshold_a::text, c.threshold_b::text,
        c.threshold_c::text, c.goal_deadline::text, c.self_deadline::text, c.manager_deadline::text, c.all_departments, c.status,
        (SELECT count(*)::int FROM hr.reviews r WHERE r.cycle_id = c.id AND r.excluded_at IS NULL) AS review_count,
        (SELECT count(*)::int FROM hr.reviews r WHERE r.cycle_id = c.id AND r.excluded_at IS NULL AND r.manager_submitted_at IS NOT NULL) AS submitted_count, c.version
      FROM hr.review_cycles c JOIN hr.review_templates t ON t.id = c.template_id`;
  }

  private cycleItem(row: CycleRow): ReviewCycleItem {
    return {
      id: row.id,
      name: row.name,
      periodFrom: row.period_from,
      periodTo: row.period_to,
      templateName: row.template_name,
      goalWeight: row.goal_weight,
      competencyWeight: row.competency_weight,
      status: row.status,
      reviewCount: row.review_count,
      submittedCount: row.submitted_count,
    };
  }

  private async requireCycle(executor: Executor, actor: Actor, id: string, lock = false): Promise<CycleRow> {
    const row = (await executor.execute<CycleRow>(sql`${this.cycleSelect()} WHERE c.company_id = ${actor.companyId} AND c.id = ${id}${lock ? sql` FOR UPDATE OF c` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async cycles(actor: Actor): Promise<ReviewCycleItem[]> {
    await this.requireManage(actor);
    const rows = await this.database.execute<CycleRow>(sql`${this.cycleSelect()} WHERE c.company_id = ${actor.companyId} ORDER BY c.period_from DESC, c.created_at DESC`);
    return rows.rows.map((row) => this.cycleItem(row));
  }

  private reviewSelect(): SQL {
    return sql`
      SELECT r.id, r.company_id, r.cycle_id, r.employee_id, e.code AS employee_code, e.full_name AS employee_name, e.user_id AS employee_user_id, d.name AS department_name,
        r.reviewer_id, u.full_name AS reviewer_name, r.goals_confirmed_at::text, r.self_submitted_at::text, r.manager_submitted_at::text, r.goal_score::text, r.competency_score::text,
        r.total_score::text, r.adjusted_score::text, r.adjustment_reason, r.manager_comment, r.self_comment, r.excluded_at::text, r.excluded_reason, r.acknowledged_at::text,
        r.employee_comment, r.version
      FROM hr.reviews r JOIN hr.employees e ON e.id = r.employee_id LEFT JOIN core.departments d ON d.id = r.department_id LEFT JOIN core.users u ON u.id = r.reviewer_id`;
  }

  async cycleDetail(actor: Actor, id: string): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    const row = await this.requireCycle(this.database, actor, id);
    const departments = await this.database.execute<{ department_id: string }>(sql`SELECT department_id FROM hr.review_cycle_departments WHERE cycle_id = ${id}`);
    const reviews = await this.database.execute<ReviewRow>(sql`${this.reviewSelect()} WHERE r.cycle_id = ${id} ORDER BY e.code`);
    const today = this.permissionService.today();
    const items: ReviewListItem[] = reviews.rows.map((review) => {
      const final = review.adjusted_score ?? review.total_score;
      return {
        id: review.id,
        employeeId: review.employee_id,
        employeeCode: review.employee_code,
        employeeName: review.employee_name,
        departmentName: review.department_name,
        reviewerId: review.reviewer_id,
        reviewerName: review.reviewer_name,
        phase: phaseOf(review, row.goal_weight, row.self_deadline, today),
        goalsConfirmed: review.goals_confirmed_at !== null,
        selfSubmitted: review.self_submitted_at !== null,
        managerSubmitted: review.manager_submitted_at !== null,
        totalScore: review.total_score,
        finalScore: final,
        grade: gradeOf(final, row),
        excludedReason: review.excluded_reason,
        acknowledged: review.acknowledged_at !== null,
      };
    });
    const distribution: Record<ReviewGrade, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const item of items) if (item.grade && item.phase !== "excluded") distribution[item.grade] += 1;
    const active = items.filter((item) => item.phase !== "excluded");
    return {
      ...this.cycleItem(row),
      templateId: row.template_id,
      thresholdA: row.threshold_a,
      thresholdB: row.threshold_b,
      thresholdC: row.threshold_c,
      goalDeadline: row.goal_deadline,
      selfDeadline: row.self_deadline,
      managerDeadline: row.manager_deadline,
      allDepartments: row.all_departments,
      departmentIds: departments.rows.map((item) => item.department_id),
      version: row.version,
      reviews: items,
      gradeDistribution: distribution,
      canEdit: row.status === "draft",
      canOpen: row.status === "draft",
      canClose: row.status === "open" && active.length > 0 && active.every((item) => item.managerSubmitted),
      canPublish: row.status === "closed",
    };
  }

  async cycleOptions(actor: Actor, id: string | null): Promise<ReviewCycleOptionsResponse> {
    await this.requireManage(actor);
    const templates = await this.database.execute<{ id: string; name: string }>(sql`SELECT id, name FROM hr.review_templates WHERE company_id = ${actor.companyId} ORDER BY name`);
    const departments = await this.database.execute<{ id: string; name: string }>(sql`SELECT id, name FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    const employees = await this.database.execute<{ id: string; code: string; full_name: string }>(sql`
      SELECT e.id, e.code, e.full_name FROM hr.employees e WHERE e.company_id = ${actor.companyId} AND e.status = 'active'
        ${id ? sql`AND NOT EXISTS (SELECT 1 FROM hr.reviews r WHERE r.cycle_id = ${id} AND r.employee_id = e.id)` : sql``} ORDER BY e.code LIMIT 2000`);
    const members = await this.database.execute<{ id: string; full_name: string }>(sql`
      SELECT u.id, u.full_name FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active' ORDER BY u.full_name LIMIT 1000`);
    return {
      templates: templates.rows,
      departments: departments.rows,
      employees: employees.rows.map((row) => ({ id: row.id, code: row.code, fullName: row.full_name })),
      members: members.rows.map((row) => ({ id: row.id, fullName: row.full_name })),
    };
  }

  private async validateCycle(executor: Executor, actor: Actor, input: CycleInput): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    if (input.goalWeight + input.competencyWeight !== 100) fields.competencyWeight = "weightsNotHundred";
    if (input.periodTo < input.periodFrom) fields.periodTo = "invalidValue";
    if (!(Number(input.thresholdA) > Number(input.thresholdB) && Number(input.thresholdB) > Number(input.thresholdC))) fields.thresholdC = "reviewThresholdsOrder";
    if (!(input.goalDeadline <= input.selfDeadline && input.selfDeadline <= input.managerDeadline)) fields.managerDeadline = "reviewDeadlinesOrder";
    const template = await executor.execute(sql`SELECT 1 FROM hr.review_templates WHERE id = ${input.templateId} AND company_id = ${actor.companyId}`);
    if (template.rows.length === 0) fields.templateId = "invalidValue";
    if (!input.allDepartments && input.departmentIds.length === 0) fields.departmentIds = "required";
    if (Object.keys(fields).length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeDepartments(executor: Executor, actor: Actor, cycleId: string, input: CycleInput): Promise<void> {
    await executor.execute(sql`DELETE FROM hr.review_cycle_departments WHERE cycle_id = ${cycleId}`);
    if (input.allDepartments) return;
    for (const departmentId of new Set(input.departmentIds)) {
      const owned = await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${departmentId} AND company_id = ${actor.companyId}`);
      if (owned.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { departmentIds: "invalidValue" } });
      await executor.execute(sql`INSERT INTO hr.review_cycle_departments (cycle_id, department_id) VALUES (${cycleId}, ${departmentId})`);
    }
  }

  async saveCycle(actor: Actor, id: string | null, input: CycleInput): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    const cycleId = await this.database.transaction(async (transaction) => {
      await this.validateCycle(transaction, actor, input);
      const values = sql`name = ${input.name}, period_from = ${input.periodFrom}, period_to = ${input.periodTo}, template_id = ${input.templateId}, goal_weight = ${input.goalWeight},
        competency_weight = ${input.competencyWeight}, threshold_a = ${input.thresholdA}, threshold_b = ${input.thresholdB}, threshold_c = ${input.thresholdC},
        goal_deadline = ${input.goalDeadline}, self_deadline = ${input.selfDeadline}, manager_deadline = ${input.managerDeadline}, all_departments = ${input.allDepartments}`;
      let saved = id;
      if (id) {
        const row = await this.requireCycle(transaction, actor, id, true);
        if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "reviewCycleStatusInvalid");
        if (input.version !== undefined && input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`UPDATE hr.review_cycles SET ${values}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      } else {
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.review_cycles (company_id, name, period_from, period_to, template_id, goal_weight, competency_weight, threshold_a, threshold_b, threshold_c,
            goal_deadline, self_deadline, manager_deadline, all_departments, created_by)
          VALUES (${actor.companyId}, ${input.name}, ${input.periodFrom}, ${input.periodTo}, ${input.templateId}, ${input.goalWeight}, ${input.competencyWeight},
            ${input.thresholdA}, ${input.thresholdB}, ${input.thresholdC}, ${input.goalDeadline}, ${input.selfDeadline}, ${input.managerDeadline}, ${input.allDepartments}, ${actor.userId})
          RETURNING id`);
        saved = created.rows[0]!.id;
      }
      await this.writeDepartments(transaction, actor, saved!, input);
      await this.auditService.record({ ...hrAudit(actor, "review_cycle"), action: id ? "review_cycle.update" : "review_cycle.create", entityId: saved }, transaction);
      return saved!;
    });
    return this.cycleDetail(actor, cycleId);
  }

  // Tạo phiếu: người chấm mặc định là trưởng phòng của phòng ban hiện hành, trừ khi trưởng phòng chính là nhân viên (QUYTAC_NGHIEPVU_389).
  private async createReview(executor: Executor, actor: Actor, cycle: CycleRow, employeeId: string): Promise<string> {
    const today = this.permissionService.today();
    const employee = (
      await executor.execute<{ user_id: string | null; department_id: string | null; manager_user_id: string | null }>(sql`
      SELECT e.user_id, position.department_id, d.manager_user_id
      FROM hr.employees e CROSS JOIN LATERAL (SELECT ${positionAt(sql`e.id`, sql`GREATEST(${today}::date, e.hire_date)`)}) position
      LEFT JOIN core.departments d ON d.id = position.department_id WHERE e.id = ${employeeId}`)
    ).rows[0]!;
    const reviewer = employee.manager_user_id && employee.manager_user_id !== employee.user_id ? employee.manager_user_id : null;
    const created = await executor.execute<{ id: string }>(sql`
      INSERT INTO hr.reviews (company_id, cycle_id, employee_id, department_id, reviewer_id) VALUES (${actor.companyId}, ${cycle.id}, ${employeeId}, ${employee.department_id}, ${reviewer})
      RETURNING id`);
    const reviewId = created.rows[0]!.id;
    await executor.execute(sql`INSERT INTO hr.review_criterion_scores (review_id, criterion_id) SELECT ${reviewId}, id FROM hr.review_criteria WHERE template_id = ${cycle.template_id}`);
    return reviewId;
  }

  async openCycle(actor: Actor, id: string): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    const today = this.permissionService.today();
    await this.database.transaction(async (transaction) => {
      const cycle = await this.requireCycle(transaction, actor, id, true);
      if (cycle.status !== "draft") throw new ApiError("BUSINESS_RULE", "reviewCycleStatusInvalid");
      const weights = await transaction.execute<{ total: number }>(sql`SELECT COALESCE(sum(weight), 0)::int AS total FROM hr.review_criteria WHERE template_id = ${cycle.template_id}`);
      if (weights.rows[0]!.total !== 100) throw new ApiError("BUSINESS_RULE", "weightsNotHundred");
      const employees = await transaction.execute<{ id: string }>(sql`
        SELECT e.id FROM hr.employees e CROSS JOIN LATERAL (SELECT ${positionAt(sql`e.id`, sql`GREATEST(${today}::date, e.hire_date)`)}) position
        WHERE e.company_id = ${actor.companyId} AND e.status = 'active' AND e.hire_date <= ${cycle.period_to}
          ${cycle.all_departments ? sql`` : sql`AND position.department_id IN (SELECT department_id FROM hr.review_cycle_departments WHERE cycle_id = ${id})`}`);
      for (const employee of employees.rows) await this.createReview(transaction, actor, cycle, employee.id);
      await transaction.execute(sql`UPDATE hr.review_cycles SET status = 'open', opened_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review_cycle"), action: "review_cycle.open", entityId: id, afterData: { reviews: employees.rows.length } }, transaction);
    });
    return this.cycleDetail(actor, id);
  }

  async addReview(actor: Actor, cycleId: string, employeeId: string): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    await this.database.transaction(async (transaction) => {
      const cycle = await this.requireCycle(transaction, actor, cycleId, true);
      if (cycle.status !== "open") throw new ApiError("BUSINESS_RULE", "reviewCycleStatusInvalid");
      const employee = await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${employeeId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (employee.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "invalidValue" } });
      const exists = await transaction.execute(sql`SELECT 1 FROM hr.reviews WHERE cycle_id = ${cycleId} AND employee_id = ${employeeId}`);
      if (exists.rows.length) throw new ApiError("BUSINESS_RULE", "reviewExists");
      const reviewId = await this.createReview(transaction, actor, cycle, employeeId);
      await this.auditService.record({ ...hrAudit(actor, "review_cycle"), action: "review_cycle.review.add", entityId: cycleId, afterData: { reviewId } }, transaction);
    });
    return this.cycleDetail(actor, cycleId);
  }

  // Chốt kỳ khi mọi phiếu chưa loại đã được người chấm nộp.
  async closeCycle(actor: Actor, id: string): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    await this.database.transaction(async (transaction) => {
      const cycle = await this.requireCycle(transaction, actor, id, true);
      if (cycle.status !== "open") throw new ApiError("BUSINESS_RULE", "reviewCycleStatusInvalid");
      const pending = await transaction.execute(sql`SELECT 1 FROM hr.reviews WHERE cycle_id = ${id} AND excluded_at IS NULL AND manager_submitted_at IS NULL LIMIT 1`);
      if (pending.rows.length || cycle.review_count === 0) throw new ApiError("BUSINESS_RULE", "reviewCycleNotComplete");
      await transaction.execute(sql`UPDATE hr.review_cycles SET status = 'closed', closed_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review_cycle"), action: "review_cycle.close", entityId: id }, transaction);
    });
    return this.cycleDetail(actor, id);
  }

  // Công bố: nhân viên có tài khoản liên kết nhận thông báo.
  async publishCycle(actor: Actor, id: string): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    await this.database.transaction(async (transaction) => {
      const cycle = await this.requireCycle(transaction, actor, id, true);
      if (cycle.status !== "closed") throw new ApiError("BUSINESS_RULE", "reviewCycleStatusInvalid");
      await transaction.execute(sql`UPDATE hr.review_cycles SET status = 'published', published_at = now(), updated_at = now(), version = version + 1 WHERE id = ${id}`);
      const employees = await transaction.execute<{ review_id: string; user_id: string }>(sql`
        SELECT r.id AS review_id, e.user_id FROM hr.reviews r JOIN hr.employees e ON e.id = r.employee_id WHERE r.cycle_id = ${id} AND r.excluded_at IS NULL AND e.user_id IS NOT NULL`);
      const title = fillTemplate(messages.vi.reviews.notifyPublished, { cycle: cycle.name });
      await notify(
        transaction,
        employees.rows.map((row) => ({ userId: row.user_id, companyId: actor.companyId, kind: "hr.review.published", title, link: `/hr/my-reviews/${row.review_id}` })),
      );
      await this.auditService.record({ ...hrAudit(actor, "review_cycle"), action: "review_cycle.publish", entityId: id, afterData: { notified: employees.rows.length } }, transaction);
    });
    return this.cycleDetail(actor, id);
  }

  // ---------- Phiếu ----------

  private async reviewContext(executor: Executor, actor: Actor, id: string, lock = false) {
    const row = (await executor.execute<ReviewRow>(sql`${this.reviewSelect()} WHERE r.company_id = ${actor.companyId} AND r.id = ${id}${lock ? sql` FOR UPDATE OF r` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const cycle = (await executor.execute<CycleRow>(sql`${this.cycleSelect()} WHERE c.id = ${row.cycle_id}`)).rows[0]!;
    const manager = (await hrGranted(this.permissionService, actor)).has(reviewPermission);
    const role = { employee: row.employee_user_id === actor.userId, reviewer: row.reviewer_id === actor.userId, manager };
    // Nhân viên, người chấm, nhân sự; người khác nhận 404. Phiếu đã loại chỉ nhân sự thấy.
    if (!role.employee && !role.reviewer && !role.manager) throw new ApiError("NOT_FOUND", "notFound");
    if (row.excluded_at && !manager) throw new ApiError("NOT_FOUND", "notFound");
    if (cycle.status === "draft") throw new ApiError("NOT_FOUND", "notFound");
    return { row, cycle, role };
  }

  async review(actor: Actor, id: string): Promise<ReviewResponse> {
    const { row, cycle, role } = await this.reviewContext(this.database, actor, id);
    const today = this.permissionService.today();
    const published = cycle.status === "published";
    // Nhân viên (không phải người chấm, không phải nhân sự) chỉ thấy điểm người chấm sau khi công bố.
    const showManager = role.reviewer || role.manager || published;
    const goals = await this.database.execute<{ id: string; name: string; target: string | null; weight: number; self_score: number | null; manager_score: number | null }>(sql`
      SELECT id, name, target, weight, self_score, manager_score FROM hr.review_goals WHERE review_id = ${id} ORDER BY position`);
    const criteria = await this.database.execute<{ id: string; name: string; description: string | null; weight: number; self_score: number | null; manager_score: number | null }>(sql`
      SELECT c.id, c.name, c.description, c.weight, s.self_score, s.manager_score FROM hr.review_criterion_scores s JOIN hr.review_criteria c ON c.id = s.criterion_id
      WHERE s.review_id = ${id} ORDER BY c.position`);
    const phase = phaseOf(row, cycle.goal_weight, cycle.self_deadline, today);
    const open = cycle.status === "open" && !row.excluded_at;
    const final = row.adjusted_score ?? row.total_score;
    const goalsEditable = open && cycle.goal_weight > 0 && !row.goals_confirmed_at && !row.manager_submitted_at;
    return {
      id: row.id,
      cycleId: cycle.id,
      cycleName: cycle.name,
      cycleStatus: cycle.status,
      periodFrom: cycle.period_from,
      periodTo: cycle.period_to,
      goalWeight: cycle.goal_weight,
      competencyWeight: cycle.competency_weight,
      thresholds: { A: cycle.threshold_a, B: cycle.threshold_b, C: cycle.threshold_c },
      goalDeadline: cycle.goal_deadline,
      selfDeadline: cycle.self_deadline,
      managerDeadline: cycle.manager_deadline,
      employeeName: row.employee_name,
      employeeCode: row.employee_code,
      departmentName: row.department_name,
      reviewerName: row.reviewer_name,
      phase,
      goalsConfirmedAt: row.goals_confirmed_at,
      selfSubmittedAt: row.self_submitted_at,
      managerSubmittedAt: row.manager_submitted_at,
      goals: goals.rows.map((goal) => ({
        id: goal.id,
        name: goal.name,
        target: goal.target,
        weight: goal.weight,
        selfScore: goal.self_score,
        managerScore: showManager ? goal.manager_score : null,
      })),
      criteria: criteria.rows.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        weight: item.weight,
        selfScore: item.self_score,
        managerScore: showManager ? item.manager_score : null,
      })),
      selfComment: row.self_comment,
      managerComment: showManager ? row.manager_comment : null,
      goalScore: showManager ? row.goal_score : null,
      competencyScore: showManager ? row.competency_score : null,
      totalScore: showManager ? row.total_score : null,
      adjustedScore: role.manager || published ? row.adjusted_score : null,
      adjustmentReason: role.manager ? row.adjustment_reason : null,
      finalScore: role.manager || published ? final : showManager ? row.total_score : null,
      grade: role.manager || published ? gradeOf(final, cycle) : showManager ? gradeOf(row.total_score, cycle) : null,
      acknowledgedAt: row.acknowledged_at,
      employeeComment: row.employee_comment,
      role,
      canEditGoals: goalsEditable && (role.employee || role.reviewer),
      canConfirmGoals: goalsEditable && role.reviewer && goals.rows.length > 0,
      canUnconfirmGoals: open && role.reviewer && row.goals_confirmed_at !== null && !row.self_submitted_at && !row.manager_submitted_at,
      canSelfAssess: open && role.employee && phase === "self",
      canScore: open && role.reviewer && !row.manager_submitted_at && (cycle.goal_weight === 0 || row.goals_confirmed_at !== null),
      canReopen: open && role.manager && row.manager_submitted_at !== null,
      canAdjust: (cycle.status === "open" || cycle.status === "closed") && role.manager && row.manager_submitted_at !== null && !row.excluded_at,
      canAcknowledge: published && role.employee && !row.acknowledged_at,
    };
  }

  async mine(actor: Actor): Promise<MyReviewsResponse> {
    const today = this.permissionService.today();
    const own = await this.database.execute<ReviewRow & CycleRow & { cycle_name: string; cycle_status: string; review_id: string }>(sql`
      SELECT x.*, c.name AS cycle_name, c.status AS cycle_status, c.goal_weight, c.self_deadline::text, c.threshold_a::text, c.threshold_b::text, c.threshold_c::text, x.id AS review_id
      FROM (${this.reviewSelect()} WHERE r.company_id = ${actor.companyId} AND e.user_id = ${actor.userId} AND r.excluded_at IS NULL) x
      JOIN hr.review_cycles c ON c.id = x.cycle_id WHERE c.status <> 'draft' ORDER BY c.period_from DESC`);
    const scoring = await this.database.execute<ReviewRow & { cycle_name: string; goal_weight: number; self_deadline: string; manager_deadline: string; review_id: string }>(sql`
      SELECT x.*, c.name AS cycle_name, c.goal_weight, c.self_deadline::text, c.manager_deadline::text, x.id AS review_id
      FROM (${this.reviewSelect()} WHERE r.company_id = ${actor.companyId} AND r.reviewer_id = ${actor.userId} AND r.excluded_at IS NULL) x
      JOIN hr.review_cycles c ON c.id = x.cycle_id WHERE c.status = 'open' ORDER BY c.manager_deadline, x.employee_code`);
    return {
      own: own.rows.map((row) => {
        const published = row.cycle_status === "published";
        const final = row.adjusted_score ?? row.total_score;
        return {
          id: row.review_id,
          cycleName: row.cycle_name,
          reviewerName: row.reviewer_name,
          phase: phaseOf(row, row.goal_weight, row.self_deadline, today),
          published,
          finalScore: published ? final : null,
          grade: published ? gradeOf(final, row) : null,
        };
      }),
      scoring: scoring.rows.map((row) => ({
        id: row.review_id,
        cycleName: row.cycle_name,
        employeeName: row.employee_name,
        managerDeadline: row.manager_deadline,
        phase: phaseOf(row, row.goal_weight, row.self_deadline, today),
      })),
    };
  }

  // Mục tiêu: nhân viên hoặc người chấm lập khi chưa xác nhận; tổng trọng số 100.
  async saveGoals(actor: Actor, id: string, input: z.output<typeof saveReviewGoalsSchema>): Promise<ReviewResponse> {
    this.checkWeights(
      input.goals.map((goal) => goal.weight),
      "goals",
    );
    await this.database.transaction(async (transaction) => {
      await this.reviewContext(transaction, actor, id, true);
      const current = await this.review(actor, id);
      if (!current.canEditGoals) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      await transaction.execute(sql`DELETE FROM hr.review_goals WHERE review_id = ${id}`);
      for (const [index, goal] of input.goals.entries()) {
        await transaction.execute(sql`INSERT INTO hr.review_goals (review_id, position, name, target, weight) VALUES (${id}, ${index + 1}, ${goal.name}, ${goal.target}, ${goal.weight})`);
      }
      await transaction.execute(sql`UPDATE hr.reviews SET updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review"), action: "review.goals.save", entityId: id, afterData: { goals: input.goals.length } }, transaction);
    });
    return this.review(actor, id);
  }

  async confirmGoals(actor: Actor, id: string, confirmed: boolean): Promise<ReviewResponse> {
    await this.database.transaction(async (transaction) => {
      await this.reviewContext(transaction, actor, id, true);
      const current = await this.review(actor, id);
      if (confirmed ? !current.canConfirmGoals : !current.canUnconfirmGoals) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      await transaction.execute(sql`UPDATE hr.reviews SET goals_confirmed_at = ${confirmed ? sql`now()` : sql`NULL`}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review"), action: confirmed ? "review.goals.confirm" : "review.goals.reopen", entityId: id }, transaction);
    });
    return this.review(actor, id);
  }

  // Ghi điểm của nhân viên (tự đánh giá) hoặc người chấm; nộp thì bắt buộc đủ điểm mọi mục; nộp của người chấm tính điểm.
  async saveScores(actor: Actor, id: string, who: "self" | "manager", input: z.output<typeof saveReviewScoresSchema>): Promise<ReviewResponse> {
    await this.database.transaction(async (transaction) => {
      const { cycle } = await this.reviewContext(transaction, actor, id, true);
      const current = await this.review(actor, id);
      if (who === "self" ? !current.canSelfAssess : !current.canScore) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      const column = who === "self" ? sql`self_score` : sql`manager_score`;
      const goalScores = new Map(input.goals.map((item) => [item.id, item.score]));
      const criterionScores = new Map(input.criteria.map((item) => [item.id, item.score]));
      for (const goal of current.goals) if (goalScores.has(goal.id)) await transaction.execute(sql`UPDATE hr.review_goals SET ${column} = ${goalScores.get(goal.id)} WHERE id = ${goal.id}`);
      for (const item of current.criteria) {
        if (criterionScores.has(item.id))
          await transaction.execute(sql`UPDATE hr.review_criterion_scores SET ${column} = ${criterionScores.get(item.id)} WHERE review_id = ${id} AND criterion_id = ${item.id}`);
      }
      await transaction.execute(
        who === "self"
          ? sql`UPDATE hr.reviews SET self_comment = ${input.comment}, updated_at = now(), version = version + 1 WHERE id = ${id}`
          : sql`UPDATE hr.reviews SET manager_comment = ${input.comment}, updated_at = now(), version = version + 1 WHERE id = ${id}`,
      );
      if (input.submit) {
        const goals = await transaction.execute<{ weight: number; score: number | null }>(sql`SELECT weight, ${column} AS score FROM hr.review_goals WHERE review_id = ${id}`);
        const criteria = await transaction.execute<{ weight: number; score: number | null }>(sql`
          SELECT c.weight, s.${column} AS score FROM hr.review_criterion_scores s JOIN hr.review_criteria c ON c.id = s.criterion_id WHERE s.review_id = ${id}`);
        const goalRows = cycle.goal_weight > 0 ? goals.rows : [];
        const criterionRows = cycle.competency_weight > 0 ? criteria.rows : [];
        if ([...goalRows, ...criterionRows].some((item) => item.score === null)) throw new ApiError("BUSINESS_RULE", "reviewScoresMissing");
        if (who === "self") {
          await transaction.execute(sql`UPDATE hr.reviews SET self_submitted_at = now() WHERE id = ${id}`);
        } else {
          // Điểm mục tiêu, năng lực = tổng (trọng số × điểm) / 100; điểm tổng theo tỷ trọng của kỳ, làm tròn 2 chữ số.
          const weighted = (rows: { weight: number; score: number | null }[]) => rows.reduce((sum, item) => sum + item.weight * (item.score ?? 0), 0) / 100;
          const goalScore = goalRows.length ? weighted(goalRows) : null;
          const competencyScore = criterionRows.length ? weighted(criterionRows) : null;
          const total = ((goalScore ?? 0) * cycle.goal_weight + (competencyScore ?? 0) * cycle.competency_weight) / 100;
          await transaction.execute(sql`
            UPDATE hr.reviews SET manager_submitted_at = now(), goal_score = ${goalScore === null ? null : two(goalScore)},
              competency_score = ${competencyScore === null ? null : two(competencyScore)}, total_score = ${two(total)} WHERE id = ${id}`);
        }
      }
      await this.auditService.record({ ...hrAudit(actor, "review"), action: `review.${who}.${input.submit ? "submit" : "save"}`, entityId: id }, transaction);
    });
    return this.review(actor, id);
  }

  // Nhân sự mở lại phiếu đã nộp (kỳ đang mở): xóa điểm tổng, giữ điểm từng mục để người chấm sửa.
  async reopen(actor: Actor, id: string): Promise<ReviewResponse> {
    await this.database.transaction(async (transaction) => {
      await this.reviewContext(transaction, actor, id, true);
      if (!(await this.review(actor, id)).canReopen) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      await transaction.execute(sql`
        UPDATE hr.reviews SET manager_submitted_at = NULL, goal_score = NULL, competency_score = NULL, total_score = NULL, adjusted_score = NULL, adjustment_reason = NULL,
          updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review"), action: "review.reopen", entityId: id }, transaction);
    });
    return this.review(actor, id);
  }

  // Hiệu chỉnh điểm tổng cuối, lý do bắt buộc; ghi điểm trước, sau vào nhật ký.
  async adjust(actor: Actor, id: string, score: string, reason: string): Promise<ReviewResponse> {
    await this.database.transaction(async (transaction) => {
      const { row } = await this.reviewContext(transaction, actor, id, true);
      if (!(await this.review(actor, id)).canAdjust) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      await transaction.execute(sql`UPDATE hr.reviews SET adjusted_score = ${score}, adjustment_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record(
        { ...hrAudit(actor, "review"), action: "review.adjust", entityId: id, beforeData: { score: row.adjusted_score ?? row.total_score }, afterData: { score, reason } },
        transaction,
      );
    });
    return this.review(actor, id);
  }

  async exclude(actor: Actor, id: string, reason: string): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    const cycleId = await this.database.transaction(async (transaction) => {
      const { row, cycle } = await this.reviewContext(transaction, actor, id, true);
      if (cycle.status !== "open" || row.excluded_at) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      await transaction.execute(sql`UPDATE hr.reviews SET excluded_at = now(), excluded_reason = ${reason}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review"), action: "review.exclude", entityId: id, afterData: { reason } }, transaction);
      return cycle.id;
    });
    return this.cycleDetail(actor, cycleId);
  }

  // Gán, đổi người chấm khi kỳ đang mở; người chấm là thành viên đang hoạt động, không phải chính nhân viên.
  async assignReviewer(actor: Actor, id: string, reviewerId: string | null): Promise<ReviewCycleResponse> {
    await this.requireManage(actor);
    const cycleId = await this.database.transaction(async (transaction) => {
      const { row, cycle } = await this.reviewContext(transaction, actor, id, true);
      if (cycle.status !== "open" || row.excluded_at || row.manager_submitted_at) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      if (reviewerId) {
        if (reviewerId === row.employee_user_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { reviewerId: "reviewerSelf" } });
        const member = await transaction.execute(sql`
          SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id WHERE m.company_id = ${actor.companyId} AND m.user_id = ${reviewerId} AND m.status = 'active' AND u.status = 'active'`);
        if (member.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { reviewerId: "invalidValue" } });
      }
      await transaction.execute(sql`UPDATE hr.reviews SET reviewer_id = ${reviewerId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review"), action: "review.reviewer", entityId: id, afterData: { reviewerId } }, transaction);
      return cycle.id;
    });
    return this.cycleDetail(actor, cycleId);
  }

  // Nhân viên xác nhận đã xem kết quả, ghi ý kiến một lần.
  async acknowledge(actor: Actor, id: string, comment: string | null): Promise<ReviewResponse> {
    await this.database.transaction(async (transaction) => {
      await this.reviewContext(transaction, actor, id, true);
      if (!(await this.review(actor, id)).canAcknowledge) throw new ApiError("BUSINESS_RULE", "reviewStepClosed");
      await transaction.execute(sql`UPDATE hr.reviews SET acknowledged_at = now(), employee_comment = ${comment}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "review"), action: "review.acknowledge", entityId: id }, transaction);
    });
    return this.review(actor, id);
  }

  // Việc nền 8 giờ: nhắc một lần sau hạn đặt mục tiêu (nhân viên, người chấm) và hạn người chấm (người chấm).
  async sendReminders(): Promise<number> {
    const today = this.permissionService.today();
    const text = messages.vi.reviews;
    return this.database.transaction(async (transaction) => {
      const due = await transaction.execute<{
        id: string;
        company_id: string;
        kind: "goal" | "manager";
        cycle_name: string;
        employee_name: string;
        employee_user_id: string | null;
        reviewer_id: string | null;
      }>(sql`
        SELECT r.id, r.company_id, k.kind, c.name AS cycle_name, e.full_name AS employee_name, e.user_id AS employee_user_id, r.reviewer_id
        FROM hr.reviews r JOIN hr.review_cycles c ON c.id = r.cycle_id JOIN hr.employees e ON e.id = r.employee_id
        CROSS JOIN (VALUES ('goal'), ('manager')) AS k(kind)
        WHERE c.status = 'open' AND r.excluded_at IS NULL AND r.manager_submitted_at IS NULL
          AND ((k.kind = 'goal' AND c.goal_weight > 0 AND r.goals_confirmed_at IS NULL AND c.goal_deadline < ${today})
            OR (k.kind = 'manager' AND c.manager_deadline < ${today}))
          AND NOT EXISTS (SELECT 1 FROM hr.review_reminders m WHERE m.review_id = r.id AND m.kind = k.kind)`);
      for (const row of due.rows) {
        const recipients = row.kind === "goal" ? [row.employee_user_id, row.reviewer_id] : [row.reviewer_id];
        const title = fillTemplate(row.kind === "goal" ? text.remindGoals : text.remindManager, { cycle: row.cycle_name, employee: row.employee_name });
        await notify(
          transaction,
          [...new Set(recipients.filter((userId): userId is string => userId !== null))].map((userId) => ({
            userId,
            companyId: row.company_id,
            kind: "hr.review.reminder",
            title,
            link: `/hr/my-reviews/${row.id}`,
          })),
        );
        await transaction.execute(sql`INSERT INTO hr.review_reminders (review_id, kind) VALUES (${row.id}, ${row.kind})`);
      }
      return due.rows.length;
    });
  }
}
