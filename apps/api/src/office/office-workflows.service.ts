// Quy trình theo mẫu (CHUC_NANG_183; QUYTAC_NGHIEPVU_360 đến 362; API_186, API_187).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  workflowDefinitionSchema,
  workflowEnd,
  workflowStepMaximumRuns,
  type OfficeTaskResponse,
  type PageResponse,
  type SaveWorkflowTemplateInput,
  type WorkflowCondition,
  type WorkflowDefinition,
  type WorkflowDesignOptions,
  type WorkflowField,
  type WorkflowRunListItem,
  type WorkflowRunResponse,
  type WorkflowRunStatus,
  type WorkflowStartOption,
  type WorkflowStep,
  type WorkflowStepInstanceStatus,
  type WorkflowTemplateListItem,
  type WorkflowTemplateResponse,
  type WorkflowTemplateStatus,
  type WorkflowValidationIssue,
  type workflowRunListQuerySchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify, type NotificationInput } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService, periodKey } from "../settings/number-sequences.service";
import { activeGroupUsers, peopleById } from "./office-access";
import { OfficeTasksService } from "./office-tasks.service";

type Executor = Pick<Database, "execute">;
type Values = Record<string, string | boolean | null>;

type TemplateRow = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: WorkflowTemplateStatus;
  active_version_id: string | null;
  active_version_no: number | null;
  draft_version_id: string | null;
  draft_version_no: number | null;
  running_count: number;
  version: number;
};

type RunRow = {
  id: string;
  company_id: string;
  template_id: string;
  template_version_id: string;
  version_no: number;
  template_name: string;
  run_no: string;
  title: string;
  field_values: Values;
  initiator_id: string;
  status: WorkflowRunStatus;
  step_count: number;
  cancel_reason: string | null;
  created_at: string;
  completed_at: string | null;
  definition: WorkflowDefinition;
  version: number;
};

type InstanceRow = {
  id: string;
  run_id: string;
  step_key: string;
  status: WorkflowStepInstanceStatus;
  task_id: string | null;
  outcome: string | null;
  blocked_reason: string | null;
  created_at: string;
  completed_at: string | null;
  owner_user_id: string | null;
};

const iso = (value: string | Date | null): string | null => (value === null ? null : new Date(value).toISOString());
const decimal = /^-?\d{1,16}(\.\d{1,4})?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

// So sánh trường biểu mẫu khởi tạo theo kiểu trường (QUYTAC_NGHIEPVU_360).
function compare(field: WorkflowField, condition: WorkflowCondition, values: Values): boolean {
  const raw = values[field.key];
  if (raw === null || raw === undefined || raw === "") return condition.operator === "ne" ? condition.value !== "" : condition.value === "" && condition.operator === "eq";
  if (field.type === "number") {
    const left = Number(raw);
    const right = Number(condition.value);
    return { eq: left === right, ne: left !== right, gt: left > right, gte: left >= right, lt: left < right, lte: left <= right }[condition.operator];
  }
  if (field.type === "date") {
    const left = String(raw);
    const right = condition.value;
    return { eq: left === right, ne: left !== right, gt: left > right, gte: left >= right, lt: left < right, lte: left <= right }[condition.operator];
  }
  const left = typeof raw === "boolean" ? String(raw) : raw;
  return condition.operator === "eq" ? left === condition.value : left !== condition.value;
}

// Kiểm tra hợp lệ mẫu trước khi kích hoạt; trả danh sách lỗi theo bước.
export function validateDefinition(definition: WorkflowDefinition): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const steps = new Map<string, WorkflowStep>();
  for (const step of definition.steps) {
    if (steps.has(step.key)) issues.push({ stepKey: step.key, code: "duplicateKey" });
    steps.set(step.key, step);
  }
  const fields = new Map(definition.fields.map((field) => [field.key, field]));
  if (fields.size !== definition.fields.length) issues.push({ stepKey: null, code: "duplicateKey" });
  for (const field of definition.fields) if (field.type === "select" && (field.options?.length ?? 0) === 0) issues.push({ stepKey: null, code: "selectNeedsOptions" });
  if (!steps.has(definition.firstStepKey)) issues.push({ stepKey: null, code: "noFirstStep" });
  const edges = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  for (const step of definition.steps) {
    if (new Set(step.outcomes).size !== step.outcomes.length) issues.push({ stepKey: step.key, code: "duplicateOutcome" });
    if (step.assignee.type === "field") {
      const field = fields.get(step.assignee.fieldKey);
      if (!field) issues.push({ stepKey: step.key, code: "unknownField" });
      else if (field.type !== "user") issues.push({ stepKey: step.key, code: "fieldNotUser" });
    }
    if (!step.otherwise) issues.push({ stepKey: step.key, code: "missingOtherwise" });
    const targets: string[] = [];
    for (const transition of [...step.transitions, ...(step.otherwise ? [{ outcome: null, condition: null, targets: step.otherwise }] : [])]) {
      if (transition.outcome !== null && !step.outcomes.includes(transition.outcome)) issues.push({ stepKey: step.key, code: "unknownOutcome" });
      if (transition.condition) {
        const field = fields.get(transition.condition.fieldKey);
        if (!field) issues.push({ stepKey: step.key, code: "unknownField" });
        else {
          const ordered = ["gt", "gte", "lt", "lte"].includes(transition.condition.operator);
          const value = transition.condition.value;
          const typeOk =
            field.type === "number"
              ? decimal.test(value)
              : field.type === "date"
                ? isoDate.test(value)
                : field.type === "boolean"
                  ? ["true", "false"].includes(value) && !ordered
                  : field.type === "select"
                    ? (field.options ?? []).includes(value) && !ordered
                    : !ordered;
          if (!typeOk) issues.push({ stepKey: step.key, code: "fieldTypeMismatch" });
        }
      }
      for (const target of transition.targets) {
        if (target !== workflowEnd && !steps.has(target)) issues.push({ stepKey: step.key, code: "unknownTarget" });
        targets.push(target);
        if (target !== workflowEnd) incoming.set(target, (incoming.get(target) ?? 0) + 1);
      }
    }
    edges.set(step.key, targets);
  }
  for (const step of definition.steps) if (step.kind === "join" && (incoming.get(step.key) ?? 0) < 2) issues.push({ stepKey: step.key, code: "joinNeedsTwoInputs" });
  // Mọi bước đến được từ bước đầu.
  const reached = new Set<string>();
  const queue = steps.has(definition.firstStepKey) ? [definition.firstStepKey] : [];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (reached.has(key)) continue;
    reached.add(key);
    for (const target of edges.get(key) ?? []) if (target !== workflowEnd) queue.push(target);
  }
  for (const step of definition.steps) if (steps.has(definition.firstStepKey) && !reached.has(step.key)) issues.push({ stepKey: step.key, code: "unreachable" });
  // Từ mọi bước có đường tới Kết thúc: lan ngược từ các bước có đích Kết thúc.
  const reachesEnd = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, targets] of edges) {
      if (!reachesEnd.has(key) && targets.some((target) => target === workflowEnd || reachesEnd.has(target))) {
        reachesEnd.add(key);
        changed = true;
      }
    }
  }
  for (const step of definition.steps) if (!reachesEnd.has(step.key)) issues.push({ stepKey: step.key, code: "noPathToEnd" });
  return issues;
}

@Injectable()
export class OfficeWorkflowsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly sequences: NumberSequencesService,
    private readonly tasks: OfficeTasksService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    this.tasks.workflowCompletedHooks.push((transaction, task) => this.stepCompleted(transaction, task.stepInstanceId, task.outcome));
    this.tasks.workflowInfo = (stepInstanceId, candidateRoleId) => this.taskInfo(stepInstanceId, candidateRoleId);
  }

  private audit(actor: Actor, entityType: string) {
    return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "office", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
  }

  private async covering(actor: Actor, companyId: string): Promise<Set<string>> {
    return this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId });
  }

  // Lỗi kiểm tra cần dữ liệu công ty: vai trò, người cụ thể, phòng ban được khởi tạo.
  private async issuesFor(executor: Executor, companyId: string, definition: WorkflowDefinition): Promise<WorkflowValidationIssue[]> {
    const issues = validateDefinition(definition);
    for (const step of definition.steps) {
      if (step.assignee.type === "role") {
        const role = await executor.execute(sql`SELECT 1 FROM core.roles WHERE id = ${step.assignee.roleId} AND status = 'active' AND (company_id IS NULL OR company_id = ${companyId})`);
        if (role.rows.length === 0) issues.push({ stepKey: step.key, code: "unknownRole" });
      }
      if (step.assignee.type === "user" && !(await activeGroupUsers(executor, companyId, [step.assignee.userId])).has(step.assignee.userId)) issues.push({ stepKey: step.key, code: "inactiveUser" });
    }
    if (definition.starterDepartmentIds.length > 0) {
      const found = await executor.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM core.departments WHERE company_id = ${companyId} AND status = 'active'
          AND id IN (${sql.join(
            definition.starterDepartmentIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`);
      if (found.rows[0]!.total !== new Set(definition.starterDepartmentIds).size) issues.push({ stepKey: null, code: "unknownDepartment" });
    }
    return issues;
  }

  private templateQuery(where: SQL): SQL {
    return sql`
      SELECT t.id, t.company_id, t.name, t.description, t.status, t.active_version_id, t.version,
        av.version_no AS active_version_no, dv.id AS draft_version_id, dv.version_no AS draft_version_no,
        (SELECT count(*)::int FROM office.workflow_runs r WHERE r.template_id = t.id AND r.status IN ('running', 'blocked')) AS running_count
      FROM office.workflow_templates t
      LEFT JOIN office.workflow_template_versions av ON av.id = t.active_version_id
      LEFT JOIN office.workflow_template_versions dv ON dv.template_id = t.id AND dv.status = 'draft'
      WHERE ${where}`;
  }

  private listItem(row: TemplateRow): WorkflowTemplateListItem {
    return { id: row.id, name: row.name, status: row.status, activeVersionNo: row.active_version_no, hasDraft: row.draft_version_id !== null, runningCount: row.running_count };
  }

  async designOptions(actor: Actor): Promise<WorkflowDesignOptions> {
    const roles = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT id, name_vi AS name FROM core.roles WHERE status = 'active' AND (company_id IS NULL OR company_id = ${actor.companyId}) ORDER BY company_id NULLS FIRST, name_vi`);
    const departments = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`);
    return { roles: roles.rows, departments: departments.rows };
  }

  async listTemplates(actor: Actor): Promise<WorkflowTemplateListItem[]> {
    const rows = (await this.database.execute<TemplateRow>(sql`${this.templateQuery(sql`t.company_id = ${actor.companyId}`)} ORDER BY t.name`)).rows;
    return rows.map((row) => this.listItem(row));
  }

  private async loadTemplate(executor: Executor, actor: Actor, id: string, lock = false): Promise<TemplateRow> {
    if (lock) await executor.execute(sql`SELECT 1 FROM office.workflow_templates WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`);
    const row = (await executor.execute<TemplateRow>(this.templateQuery(sql`t.id = ${id} AND t.company_id = ${actor.companyId}`))).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async template(actor: Actor, id: string): Promise<WorkflowTemplateResponse> {
    const row = await this.loadTemplate(this.database, actor, id);
    const versionId = row.draft_version_id ?? row.active_version_id;
    const version = (
      await this.database.execute<{ definition: WorkflowDefinition; version_no: number }>(sql`SELECT definition, version_no FROM office.workflow_template_versions WHERE id = ${versionId}`)
    ).rows[0]!;
    return {
      ...this.listItem(row),
      description: row.description,
      editingVersionNo: version.version_no,
      editingIsDraft: row.draft_version_id !== null,
      definition: version.definition,
      issues: await this.issuesFor(this.database, row.company_id, version.definition),
      people: [
        ...(
          await peopleById(
            this.database,
            version.definition.steps.map((step) => (step.assignee.type === "user" ? step.assignee.userId : "")),
            row.company_id,
          )
        ).values(),
      ],
      version: row.version,
    };
  }

  async createTemplate(actor: Actor, input: SaveWorkflowTemplateInput): Promise<WorkflowTemplateResponse> {
    const id = await this.database.transaction(async (transaction) => {
      const template = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.workflow_templates (company_id, name, description, created_by) VALUES (${actor.companyId}, ${input.name}, ${input.description ?? null}, ${actor.userId}) RETURNING id`);
      const templateId = template.rows[0]!.id;
      await transaction.execute(sql`
        INSERT INTO office.workflow_template_versions (template_id, version_no, definition, created_by) VALUES (${templateId}, 1, ${JSON.stringify(input.definition)}::jsonb, ${actor.userId})`);
      await this.auditService.record(
        { ...this.audit(actor, "office_workflow_template"), action: "office.workflow_template.create", entityId: templateId, afterData: { name: input.name } },
        transaction,
      );
      return templateId;
    });
    return this.template(actor, id);
  }

  // Lưu bản nháp: mẫu đang dùng chưa có nháp thì tạo phiên bản nháp mới (QUYTAC_NGHIEPVU_361).
  async saveTemplate(actor: Actor, id: string, input: SaveWorkflowTemplateInput): Promise<WorkflowTemplateResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadTemplate(transaction, actor, id, true);
      // Sửa phải gửi phiên bản đang xem (khóa lạc quan).
      if (input.version === undefined) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { version: "required" } });
      if (input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`UPDATE office.workflow_templates SET name = ${input.name}, description = ${input.description ?? null}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      if (row.draft_version_id) {
        await transaction.execute(sql`UPDATE office.workflow_template_versions SET definition = ${JSON.stringify(input.definition)}::jsonb WHERE id = ${row.draft_version_id}`);
      } else {
        await transaction.execute(sql`
          INSERT INTO office.workflow_template_versions (template_id, version_no, definition, created_by)
          SELECT ${id}, COALESCE(max(version_no), 0) + 1, ${JSON.stringify(input.definition)}::jsonb, ${actor.userId} FROM office.workflow_template_versions WHERE template_id = ${id}`);
      }
      await this.auditService.record({ ...this.audit(actor, "office_workflow_template"), action: "office.workflow_template.update", entityId: id }, transaction);
    });
    return this.template(actor, id);
  }

  async activateTemplate(actor: Actor, id: string): Promise<WorkflowTemplateResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadTemplate(transaction, actor, id, true);
      if (!row.draft_version_id) {
        // Không có nháp: dùng lại mẫu đã ngừng.
        if (row.status === "inactive" && row.active_version_id) {
          await transaction.execute(sql`UPDATE office.workflow_templates SET status = 'active', updated_at = now(), version = version + 1 WHERE id = ${id}`);
          return;
        }
        throw new ApiError("BUSINESS_RULE", "workflowNothingToActivate");
      }
      const draft = (await transaction.execute<{ definition: WorkflowDefinition }>(sql`SELECT definition FROM office.workflow_template_versions WHERE id = ${row.draft_version_id}`)).rows[0]!;
      const parsed = workflowDefinitionSchema.parse(draft.definition);
      if ((await this.issuesFor(transaction, row.company_id, parsed)).length > 0) throw new ApiError("BUSINESS_RULE", "workflowInvalid");
      if (row.active_version_id) await transaction.execute(sql`UPDATE office.workflow_template_versions SET status = 'retired' WHERE id = ${row.active_version_id}`);
      await transaction.execute(sql`UPDATE office.workflow_template_versions SET status = 'active', activated_at = now() WHERE id = ${row.draft_version_id}`);
      await transaction.execute(sql`
        UPDATE office.workflow_templates SET status = 'active', active_version_id = ${row.draft_version_id}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record(
        { ...this.audit(actor, "office_workflow_template"), action: "office.workflow_template.activate", entityId: id, afterData: { versionNo: row.draft_version_no } },
        transaction,
      );
    });
    return this.template(actor, id);
  }

  async deactivateTemplate(actor: Actor, id: string): Promise<WorkflowTemplateResponse> {
    await this.database.transaction(async (transaction) => {
      const row = await this.loadTemplate(transaction, actor, id, true);
      if (row.status !== "active") throw new ApiError("BUSINESS_RULE", "workflowNotActive");
      await transaction.execute(sql`UPDATE office.workflow_templates SET status = 'inactive', updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor, "office_workflow_template"), action: "office.workflow_template.deactivate", entityId: id }, transaction);
    });
    return this.template(actor, id);
  }

  // Mẫu người dùng được khởi tạo: đang dùng, không giới hạn phòng ban hoặc phòng ban của người dùng trong danh sách (QUYTAC_NGHIEPVU_361).
  async startOptions(actor: Actor): Promise<WorkflowStartOption[]> {
    const department = (
      await this.database.execute<{ department_id: string | null }>(sql`
        SELECT department_id FROM core.user_company_memberships WHERE user_id = ${actor.userId} AND company_id = ${actor.companyId} AND status = 'active'`)
    ).rows[0]?.department_id;
    const rows = (
      await this.database.execute<{ id: string; name: string; description: string | null; version_no: number; definition: WorkflowDefinition }>(sql`
        SELECT t.id, t.name, t.description, v.version_no, v.definition FROM office.workflow_templates t
        JOIN office.workflow_template_versions v ON v.id = t.active_version_id
        WHERE t.company_id = ${actor.companyId} AND t.status = 'active' ORDER BY t.name`)
    ).rows;
    return rows
      .filter((row) => row.definition.starterDepartmentIds.length === 0 || (department && row.definition.starterDepartmentIds.includes(department)))
      .map((row) => ({ templateId: row.id, name: row.name, description: row.description, versionNo: row.version_no, fields: row.definition.fields }));
  }

  // Kiểm giá trị biểu mẫu khởi tạo theo kiểu trường.
  private async checkValues(executor: Executor, companyId: string, fields: WorkflowField[], values: Values): Promise<Values> {
    const errors: Record<string, "required" | "invalidValue"> = {};
    const clean: Values = {};
    for (const field of fields) {
      const raw = values[field.key];
      const empty = raw === undefined || raw === null || raw === "";
      if (empty) {
        if (field.required && field.type !== "boolean") errors[`values.${field.key}`] = "required";
        clean[field.key] = field.type === "boolean" ? false : null;
        continue;
      }
      const text = typeof raw === "string" ? raw.trim() : raw;
      let ok = true;
      if (field.type === "number") ok = typeof text === "string" && decimal.test(text);
      if (field.type === "date") ok = typeof text === "string" && isoDate.test(text);
      if (field.type === "select") ok = typeof text === "string" && (field.options ?? []).includes(text);
      if (field.type === "boolean") ok = typeof text === "boolean";
      if (field.type === "text") ok = typeof text === "string";
      if (field.type === "user") ok = typeof text === "string" && (await activeGroupUsers(executor, companyId, [text])).has(text);
      if (!ok) errors[`values.${field.key}`] = "invalidValue";
      clean[field.key] = text;
    }
    if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: errors });
    return clean;
  }

  async startRun(actor: Actor, input: { templateId: string; title: string; values: Values }): Promise<WorkflowRunResponse> {
    const option = (await this.startOptions(actor)).find((item) => item.templateId === input.templateId);
    if (!option) throw new ApiError("NOT_FOUND", "notFound");
    const id = await this.database.transaction(async (transaction) => {
      const template = (
        await transaction.execute<{ active_version_id: string; status: string }>(sql`
          SELECT active_version_id, status FROM office.workflow_templates WHERE id = ${input.templateId} AND company_id = ${actor.companyId} FOR SHARE`)
      ).rows[0];
      if (!template || template.status !== "active") throw new ApiError("NOT_FOUND", "notFound");
      const values = await this.checkValues(transaction, actor.companyId, option.fields, input.values);
      // Công ty chưa cấu hình dãy số phiên quy trình: tạo mặc định trong cùng giao dịch.
      await transaction.execute(sql`
        INSERT INTO core.number_sequences (company_id, document_type_code, period_key, prefix, reset_period, padding, next_value)
        SELECT ${actor.companyId}, 'office.workflow_run', ${periodKey("year", this.permissionService.today())}, 'QT', 'year', 5, 1
        WHERE NOT EXISTS (SELECT 1 FROM core.number_sequences WHERE company_id = ${actor.companyId} AND document_type_code = 'office.workflow_run')
        ON CONFLICT DO NOTHING`);
      const runNo = await this.sequences.next(actor.companyId, "office.workflow_run", transaction);
      const run = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.workflow_runs (company_id, template_id, template_version_id, run_no, title, field_values, initiator_id)
        VALUES (${actor.companyId}, ${input.templateId}, ${template.active_version_id}, ${runNo}, ${input.title}, ${JSON.stringify(values)}::jsonb, ${actor.userId})
        RETURNING id`);
      const runId = run.rows[0]!.id;
      const row = await this.loadRun(transaction, runId, true);
      await this.openTargets(transaction, row, [row.definition.firstStepKey]);
      await this.settle(transaction, runId);
      await this.auditService.record({ ...this.audit(actor, "office_workflow_run"), action: "office.workflow_run.start", entityId: runId, afterData: { runNo } }, transaction);
      return runId;
    });
    return this.run(actor, id);
  }

  private async loadRun(executor: Executor, id: string, lock = false): Promise<RunRow> {
    if (lock) await executor.execute(sql`SELECT 1 FROM office.workflow_runs WHERE id = ${id} FOR UPDATE`);
    const row = (
      await executor.execute<RunRow>(sql`
        SELECT r.id, r.company_id, r.template_id, r.template_version_id, v.version_no, t.name AS template_name, r.run_no, r.title, r.field_values, r.initiator_id, r.status,
          r.step_count, r.cancel_reason, r.created_at, r.completed_at, v.definition, r.version
        FROM office.workflow_runs r
        JOIN office.workflow_templates t ON t.id = r.template_id
        JOIN office.workflow_template_versions v ON v.id = r.template_version_id
        WHERE r.id = ${id}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Mở các bước đích: bước gộp còn bước khác đang mở thì chờ; vượt 100 bước thì phiên bị chặn (QUYTAC_NGHIEPVU_362).
  private async openTargets(executor: Executor, run: RunRow, targets: string[]): Promise<void> {
    for (const target of targets) {
      if (target === workflowEnd) continue;
      const step = run.definition.steps.find((item) => item.key === target)!;
      if (step.kind === "join") {
        const waiting = await executor.execute(sql`SELECT 1 FROM office.workflow_step_instances WHERE run_id = ${run.id} AND step_key = ${target} AND status = 'waiting'`);
        if (waiting.rows.length === 0) await executor.execute(sql`INSERT INTO office.workflow_step_instances (run_id, step_key, status) VALUES (${run.id}, ${target}, 'waiting')`);
        continue;
      }
      await this.activate(executor, run, step, null);
    }
  }

  // Tạo việc cho một lượt bước; không xác định được người thực hiện thì lượt bị chặn.
  private async activate(executor: Executor, run: RunRow, step: WorkflowStep, existingInstanceId: string | null): Promise<void> {
    const counted = (await executor.execute<{ step_count: number }>(sql`UPDATE office.workflow_runs SET step_count = step_count + 1 WHERE id = ${run.id} RETURNING step_count`)).rows[0]!;
    if (counted.step_count > workflowStepMaximumRuns) {
      await this.block(executor, run, existingInstanceId, step.key, "stepLimit");
      return;
    }
    const assignee = await this.resolveAssignee(executor, run, step);
    if (!assignee) {
      await this.block(executor, run, existingInstanceId, step.key, "noAssignee");
      return;
    }
    const instanceId = existingInstanceId
      ? (await executor.execute<{ id: string }>(sql`UPDATE office.workflow_step_instances SET status = 'open', blocked_reason = NULL WHERE id = ${existingInstanceId} RETURNING id`)).rows[0]!.id
      : (await executor.execute<{ id: string }>(sql`INSERT INTO office.workflow_step_instances (run_id, step_key, status) VALUES (${run.id}, ${step.key}, 'open') RETURNING id`)).rows[0]!.id;
    await this.createStepTask(executor, run, step, instanceId, assignee);
  }

  private async createStepTask(executor: Executor, run: RunRow, step: WorkflowStep, instanceId: string, assignee: { userId: string } | { roleId: string }): Promise<void> {
    const dueAt = new Date(this.clock.now().getTime() + step.days * 86_400_000).toISOString();
    const ownerId = "userId" in assignee ? assignee.userId : null;
    const roleId = "roleId" in assignee ? assignee.roleId : null;
    const title = `${run.run_no} · ${step.name}`;
    const task = await executor.execute<{ id: string }>(sql`
      INSERT INTO office.tasks (company_id, title, description, priority, due_at, assigned_by, owner_user_id, candidate_role_id, workflow_step_instance_id)
      VALUES (${run.company_id}, ${title.slice(0, 200)}, ${step.instructions ?? null}, 'normal', ${dueAt}, ${run.initiator_id}, ${ownerId}, ${roleId}, ${instanceId})
      RETURNING id`);
    const taskId = task.rows[0]!.id;
    await executor.execute(sql`UPDATE office.workflow_step_instances SET task_id = ${taskId} WHERE id = ${instanceId}`);
    await executor.execute(sql`INSERT INTO office.task_events (task_id, actor_id, action, details) VALUES (${taskId}, NULL, 'created', ${JSON.stringify({ runNo: run.run_no })}::jsonb)`);
    const recipients = ownerId ? [ownerId] : await this.roleHolders(executor, run.company_id, roleId!);
    await notify(
      executor,
      recipients.map((userId) => ({
        userId,
        companyId: run.company_id,
        kind: "office_task_assigned",
        title: `Việc mới: ${title}`,
        link: `/office/tasks/${taskId}`,
        payload: { taskId, runId: run.id },
      })),
    );
  }

  private async roleHolders(executor: Executor, companyId: string, roleId: string): Promise<string[]> {
    const today = this.permissionService.today();
    return (
      await executor.execute<{ user_id: string }>(sql`
        SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.users u ON u.id = a.user_id AND u.status = 'active'
        JOIN core.user_company_memberships m ON m.user_id = a.user_id AND m.company_id = ${companyId} AND m.status = 'active'
        WHERE a.role_id = ${roleId} AND (a.scope_type = 'group' OR a.company_id = ${companyId})
          AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)`)
    ).rows.map((row) => row.user_id);
  }

  private async resolveAssignee(executor: Executor, run: RunRow, step: WorkflowStep): Promise<{ userId: string } | { roleId: string } | null> {
    const assignee = step.assignee;
    const usable = async (userId: string | null | undefined) => (userId && (await activeGroupUsers(executor, run.company_id, [userId])).has(userId) ? { userId } : null);
    if (assignee.type === "user") return usable(assignee.userId);
    if (assignee.type === "initiator") return usable(run.initiator_id);
    if (assignee.type === "field") {
      const value = run.field_values[assignee.fieldKey];
      return usable(typeof value === "string" ? value : null);
    }
    if (assignee.type === "role") return (await this.roleHolders(executor, run.company_id, assignee.roleId)).length > 0 ? { roleId: assignee.roleId } : null;
    // Trưởng phòng của người khởi tạo: người quản lý phòng ban của thành viên công ty.
    const manager = (
      await executor.execute<{ manager_user_id: string | null }>(sql`
        SELECT d.manager_user_id FROM core.user_company_memberships m JOIN core.departments d ON d.id = m.department_id
        WHERE m.user_id = ${run.initiator_id} AND m.company_id = ${run.company_id} AND m.status = 'active'`)
    ).rows[0]?.manager_user_id;
    return usable(manager);
  }

  private async block(executor: Executor, run: RunRow, existingInstanceId: string | null, stepKey: string, reason: "noAssignee" | "stepLimit"): Promise<void> {
    if (existingInstanceId) await executor.execute(sql`UPDATE office.workflow_step_instances SET status = 'blocked', blocked_reason = ${reason} WHERE id = ${existingInstanceId}`);
    else await executor.execute(sql`INSERT INTO office.workflow_step_instances (run_id, step_key, status, blocked_reason) VALUES (${run.id}, ${stepKey}, 'blocked', ${reason})`);
    await executor.execute(sql`UPDATE office.workflow_runs SET status = 'blocked', version = version + 1 WHERE id = ${run.id} AND status = 'running'`);
    const managers = await executor.execute<{ user_id: string }>(sql`
      SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id AND rp.permission_code = 'office.workflow.manage'
      JOIN core.users u ON u.id = a.user_id AND u.status = 'active'
      WHERE (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${run.company_id}))
        AND a.valid_from <= ${this.permissionService.today()}::date AND (a.valid_to IS NULL OR a.valid_to >= ${this.permissionService.today()}::date)`);
    const recipients = new Set([run.initiator_id, ...managers.rows.map((row) => row.user_id)]);
    const items: NotificationInput[] = [...recipients].map((userId) => ({
      userId,
      companyId: run.company_id,
      kind: "office_workflow_blocked",
      title: `${run.run_no}: phiên quy trình bị chặn`,
      link: `/office/workflow-runs/${run.id}`,
      payload: { runId: run.id, reason },
    }));
    await notify(executor, items);
  }

  // Sau mỗi thay đổi: không còn bước mở thì mở bước gộp đang chờ; không còn gì thì phiên hoàn thành.
  private async settle(executor: Executor, runId: string): Promise<void> {
    for (let guard = 0; guard < workflowStepMaximumRuns + 2; guard++) {
      const run = await this.loadRun(executor, runId);
      if (run.status === "cancelled" || run.status === "completed") return;
      const counts = (
        await executor.execute<{ open: number; blocked: number; waiting_id: string | null; waiting_key: string | null }>(sql`
          SELECT count(*) FILTER (WHERE status = 'open')::int AS open, count(*) FILTER (WHERE status = 'blocked')::int AS blocked,
            (SELECT id FROM office.workflow_step_instances WHERE run_id = ${runId} AND status = 'waiting' ORDER BY created_at LIMIT 1) AS waiting_id,
            (SELECT step_key FROM office.workflow_step_instances WHERE run_id = ${runId} AND status = 'waiting' ORDER BY created_at LIMIT 1) AS waiting_key
          FROM office.workflow_step_instances WHERE run_id = ${runId}`)
      ).rows[0]!;
      if (counts.open > 0 || counts.blocked > 0) return;
      if (counts.waiting_id) {
        const step = run.definition.steps.find((item) => item.key === counts.waiting_key)!;
        await this.activate(executor, run, step, counts.waiting_id);
        continue;
      }
      await executor.execute(sql`UPDATE office.workflow_runs SET status = 'completed', completed_at = now(), version = version + 1 WHERE id = ${runId}`);
      await notify(executor, [
        {
          userId: run.initiator_id,
          companyId: run.company_id,
          kind: "office_workflow_completed",
          title: `${run.run_no}: phiên quy trình đã hoàn thành`,
          link: `/office/workflow-runs/${run.id}`,
          payload: { runId },
        },
      ]);
      return;
    }
  }

  // Móc nối khi việc của bước hoàn thành: ghi kết quả, xét quy tắc chuyển theo thứ tự, dòng đầu thỏa thì mở các bước đích.
  private async stepCompleted(executor: Executor, instanceId: string, outcome: string): Promise<void> {
    const instance = (await executor.execute<{ run_id: string; step_key: string }>(sql`SELECT run_id, step_key FROM office.workflow_step_instances WHERE id = ${instanceId}`)).rows[0]!;
    const run = await this.loadRun(executor, instance.run_id, true);
    await executor.execute(sql`UPDATE office.workflow_step_instances SET status = 'done', outcome = ${outcome}, completed_at = now() WHERE id = ${instanceId}`);
    if (run.status !== "running" && run.status !== "blocked") return;
    const step = run.definition.steps.find((item) => item.key === instance.step_key)!;
    const fields = new Map(run.definition.fields.map((field) => [field.key, field]));
    const matched = step.transitions.find(
      (transition) =>
        (transition.outcome === null || transition.outcome === outcome) && (!transition.condition || compare(fields.get(transition.condition.fieldKey)!, transition.condition, run.field_values)),
    );
    await this.openTargets(executor, run, matched ? matched.targets : (step.otherwise ?? [workflowEnd]));
    await this.settle(executor, run.id);
  }

  private async taskInfo(stepInstanceId: string, candidateRoleId: string | null): Promise<OfficeTaskResponse["workflow"]> {
    const row = (
      await this.database.execute<{ run_id: string; run_no: string; step_key: string; definition: WorkflowDefinition }>(sql`
        SELECT r.id AS run_id, r.run_no, i.step_key, v.definition FROM office.workflow_step_instances i
        JOIN office.workflow_runs r ON r.id = i.run_id JOIN office.workflow_template_versions v ON v.id = r.template_version_id WHERE i.id = ${stepInstanceId}`)
    ).rows[0];
    if (!row) return null;
    const step = row.definition.steps.find((item) => item.key === row.step_key)!;
    const role = candidateRoleId ? ((await this.database.execute<{ name_vi: string }>(sql`SELECT name_vi FROM core.roles WHERE id = ${candidateRoleId}`)).rows[0]?.name_vi ?? null) : null;
    return { runId: row.run_id, runNo: row.run_no, stepName: step.name, outcomes: step.outcomes, instructions: step.instructions ?? null, candidateRoleName: role };
  }

  // Người xem được phiên: người khởi tạo, người làm một bước của phiên, người có quyền xem mọi việc hoặc quản lý quy trình của công ty.
  private async canView(actor: Actor, run: RunRow): Promise<{ view: boolean; manage: boolean }> {
    const granted = await this.covering(actor, run.company_id);
    const manage = granted.has("office.workflow.manage");
    if (run.initiator_id === actor.userId || manage || granted.has("office.task.view_all")) return { view: true, manage };
    const involved = await this.database.execute(sql`
      SELECT 1 FROM office.workflow_step_instances i JOIN office.tasks t ON t.id = i.task_id WHERE i.run_id = ${run.id} AND t.owner_user_id = ${actor.userId} LIMIT 1`);
    return { view: involved.rows.length > 0, manage };
  }

  async run(actor: Actor, id: string): Promise<WorkflowRunResponse> {
    const row = await this.loadRun(this.database, id);
    const access = await this.canView(actor, row);
    if (!access.view) throw new ApiError("NOT_FOUND", "notFound");
    const instances = (
      await this.database.execute<InstanceRow>(sql`
        SELECT i.id, i.run_id, i.step_key, i.status, i.task_id, i.outcome, i.blocked_reason, i.created_at, i.completed_at, t.owner_user_id
        FROM office.workflow_step_instances i LEFT JOIN office.tasks t ON t.id = i.task_id WHERE i.run_id = ${id} ORDER BY i.created_at, i.id`)
    ).rows;
    const userFields = row.definition.fields
      .filter((field) => field.type === "user")
      .map((field) => row.field_values[field.key])
      .filter((value): value is string => typeof value === "string");
    const people = await peopleById(this.database, [row.initiator_id, ...instances.map((item) => item.owner_user_id ?? ""), ...userFields], row.company_id);
    const valueLabels: Record<string, string> = {};
    for (const field of row.definition.fields) {
      const value = row.field_values[field.key];
      if (field.type === "user" && typeof value === "string") valueLabels[field.key] = people.get(value)?.fullName ?? "";
    }
    const stepName = (key: string) => row.definition.steps.find((step) => step.key === key)?.name ?? key;
    const active = row.status === "running" || row.status === "blocked";
    return {
      ...this.runListItem(row, people.get(row.initiator_id)!, instances),
      templateId: row.template_id,
      versionNo: row.version_no,
      definition: row.definition,
      values: row.field_values,
      valueLabels,
      steps: instances.map((item) => ({
        id: item.id,
        stepKey: item.step_key,
        stepName: stepName(item.step_key),
        status: item.status,
        taskId: item.task_id,
        owner: item.owner_user_id ? (people.get(item.owner_user_id) ?? null) : null,
        outcome: item.outcome,
        blockedReason: item.blocked_reason,
        createdAt: iso(item.created_at)!,
        completedAt: iso(item.completed_at),
      })),
      cancelReason: row.cancel_reason,
      completedAt: iso(row.completed_at),
      canCancel: active && (row.initiator_id === actor.userId || access.manage),
      canAssign: row.status === "blocked" && (row.initiator_id === actor.userId || access.manage),
      version: row.version,
    };
  }

  private runListItem(row: RunRow, initiator: WorkflowRunListItem["initiator"], instances: Pick<InstanceRow, "status" | "step_key">[]): WorkflowRunListItem {
    const stepName = (key: string) => row.definition.steps.find((step) => step.key === key)?.name ?? key;
    return {
      id: row.id,
      runNo: row.run_no,
      title: row.title,
      templateName: row.template_name,
      initiator,
      openSteps: instances.filter((item) => item.status === "open" || item.status === "blocked").map((item) => stepName(item.step_key)),
      status: row.status,
      createdAt: iso(row.created_at)!,
    };
  }

  async runs(actor: Actor, query: z.infer<typeof workflowRunListQuerySchema>): Promise<PageResponse<WorkflowRunListItem>> {
    const conditions: SQL[] = [];
    if (query.scope === "mine") conditions.push(sql`r.initiator_id = ${actor.userId}`);
    if (query.scope === "involved")
      conditions.push(sql`EXISTS (SELECT 1 FROM office.workflow_step_instances i JOIN office.tasks t ON t.id = i.task_id WHERE i.run_id = r.id AND t.owner_user_id = ${actor.userId})`);
    if (query.scope === "company") {
      const granted = await this.covering(actor, actor.companyId);
      if (!granted.has("office.task.view_all") && !granted.has("office.workflow.manage")) throw new ApiError("FORBIDDEN", "forbidden");
    }
    conditions.push(sql`r.company_id = ${actor.companyId}`);
    if (query.status !== "all") conditions.push(sql`r.status = ${query.status}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM office.workflow_runs r WHERE ${where}`)).rows[0]!.total;
    const ids = (
      await this.database.execute<{ id: string }>(
        sql`SELECT r.id FROM office.workflow_runs r WHERE ${where} ORDER BY r.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      )
    ).rows;
    const data: WorkflowRunListItem[] = [];
    for (const { id } of ids) {
      const row = await this.loadRun(this.database, id);
      const instances = (await this.database.execute<{ status: WorkflowStepInstanceStatus; step_key: string }>(sql`SELECT status, step_key FROM office.workflow_step_instances WHERE run_id = ${id}`))
        .rows;
      const people = await peopleById(this.database, [row.initiator_id], row.company_id);
      data.push(this.runListItem(row, people.get(row.initiator_id)!, instances));
    }
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  // Chỉ định người thực hiện cho lượt bị chặn; phiên chạy tiếp.
  async assign(actor: Actor, id: string, input: { stepInstanceId: string; userId: string; version: number }): Promise<WorkflowRunResponse> {
    await this.database.transaction(async (transaction) => {
      const run = await this.loadRun(transaction, id, true);
      const access = await this.canView(actor, run);
      if (!access.view) throw new ApiError("NOT_FOUND", "notFound");
      if (run.initiator_id !== actor.userId && !access.manage) throw new ApiError("FORBIDDEN", "forbidden");
      if (run.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const instance = (
        await transaction.execute<{ step_key: string; blocked_reason: string | null }>(sql`
          SELECT step_key, blocked_reason FROM office.workflow_step_instances WHERE id = ${input.stepInstanceId} AND run_id = ${id} AND status = 'blocked'`)
      ).rows[0];
      if (!instance) throw new ApiError("NOT_FOUND", "notFound");
      if (instance.blocked_reason === "stepLimit") throw new ApiError("BUSINESS_RULE", "workflowStepLimit");
      if (!(await activeGroupUsers(transaction, run.company_id, [input.userId])).has(input.userId))
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { userId: "officeParticipantOutsideGroup" } });
      const step = run.definition.steps.find((item) => item.key === instance.step_key)!;
      await transaction.execute(sql`UPDATE office.workflow_step_instances SET status = 'open', blocked_reason = NULL WHERE id = ${input.stepInstanceId}`);
      await this.createStepTask(transaction, run, step, input.stepInstanceId, { userId: input.userId });
      const stillBlocked = await transaction.execute(sql`SELECT 1 FROM office.workflow_step_instances WHERE run_id = ${id} AND status = 'blocked'`);
      if (stillBlocked.rows.length === 0) await transaction.execute(sql`UPDATE office.workflow_runs SET status = 'running' WHERE id = ${id}`);
      await transaction.execute(sql`UPDATE office.workflow_runs SET version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor, "office_workflow_run"), action: "office.workflow_run.assign", entityId: id, afterData: { stepKey: instance.step_key } }, transaction);
    });
    return this.run(actor, id);
  }

  async cancel(actor: Actor, id: string, reason: string, version: number): Promise<WorkflowRunResponse> {
    await this.database.transaction(async (transaction) => {
      // Khóa việc trước rồi mới khóa phiên, cùng thứ tự với báo xong việc của bước để không khóa chéo.
      await transaction.execute(sql`
        SELECT t.id FROM office.tasks t JOIN office.workflow_step_instances s ON s.id = t.workflow_step_instance_id
        WHERE s.run_id = ${id} AND t.status NOT IN ('completed', 'cancelled') ORDER BY t.id FOR UPDATE OF t`);
      const run = await this.loadRun(transaction, id, true);
      const access = await this.canView(actor, run);
      if (!access.view) throw new ApiError("NOT_FOUND", "notFound");
      if (run.initiator_id !== actor.userId && !access.manage) throw new ApiError("FORBIDDEN", "forbidden");
      if (run.status !== "running" && run.status !== "blocked") throw new ApiError("BUSINESS_RULE", "workflowRunClosed");
      if (run.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const tasks = await transaction.execute<{ id: string; owner_user_id: string | null; company_id: string; title: string }>(sql`
        UPDATE office.tasks SET status = 'cancelled', status_reason = ${reason}, cancelled_at = now(), updated_at = now(), version = version + 1
        WHERE workflow_step_instance_id IN (SELECT id FROM office.workflow_step_instances WHERE run_id = ${id}) AND status NOT IN ('completed', 'cancelled')
        RETURNING id, owner_user_id, company_id, title`);
      for (const task of tasks.rows) {
        await transaction.execute(
          sql`INSERT INTO office.task_events (task_id, actor_id, action, details) VALUES (${task.id}, ${actor.userId}, 'status_cancel', ${JSON.stringify({ reason, byRun: true })}::jsonb)`,
        );
      }
      await transaction.execute(sql`UPDATE office.workflow_step_instances SET status = 'cancelled' WHERE run_id = ${id} AND status IN ('open', 'waiting', 'blocked')`);
      await transaction.execute(sql`UPDATE office.workflow_runs SET status = 'cancelled', cancel_reason = ${reason}, completed_at = now(), version = version + 1 WHERE id = ${id}`);
      await notify(
        transaction,
        tasks.rows
          .filter((task) => task.owner_user_id && task.owner_user_id !== actor.userId)
          .map((task) => ({
            userId: task.owner_user_id!,
            companyId: task.company_id,
            kind: "office_task_status",
            title: `${task.title}: Đã hủy`,
            link: `/office/tasks/${task.id}`,
            payload: { taskId: task.id },
          })),
      );
      await this.auditService.record({ ...this.audit(actor, "office_workflow_run"), action: "office.workflow_run.cancel", entityId: id, afterData: { reason } }, transaction);
    });
    return this.run(actor, id);
  }
}
