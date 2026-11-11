// Quá trình công tác (CONG_VIEC_46; CHUC_NANG_162; QUYTAC_NGHIEPVU_296; API_146): quyết định điều chuyển, đổi chức danh;
// đến ngày hiệu lực thì cập nhật phòng ban, chi nhánh, chức danh của thành viên công ty (việc nền `hr-work-events`).
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { WorkEventItem, WorkEventKind, saveWorkEventSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { updateMembershipPlacement } from "../users/membership-placement";
import { hrAudit, hrPermission, positionAt, requireHrPermission } from "./hr-context";

type Executor = Pick<Database, "execute">;
type Input = z.output<typeof saveWorkEventSchema>;

@Injectable()
export class WorkEventsService {
  private readonly logger = new Logger("HrWorkEvents");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Hồ sơ trong công ty; hồ sơ đã nghỉ chỉ người quản lý hồ sơ thấy.
  private async employee(executor: Executor, actor: Actor, employeeId: string, granted: Set<string>, lock = false) {
    const row = (
      await executor.execute<{ id: string; status: string; hire_date: string }>(sql`
      SELECT id, status, hire_date::text FROM hr.employees WHERE id = ${employeeId} AND company_id = ${actor.companyId}${lock ? sql` FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row || (row.status !== "active" && !granted.has(hrPermission.manage))) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async list(actor: Actor, employeeId: string): Promise<WorkEventItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.view, hrPermission.manage);
    await this.employee(this.database, actor, employeeId, granted);
    return this.items(employeeId);
  }

  async items(employeeId: string): Promise<WorkEventItem[]> {
    const today = this.permissionService.today();
    const rows = await this.database.execute<{
      id: string;
      kind: WorkEventKind;
      effective_date: string;
      decision_no: string | null;
      department_name: string | null;
      branch_name: string | null;
      job_title: string | null;
      note: string | null;
      source_type: WorkEventItem["sourceType"];
      applied_at: Date | null;
      version: number;
    }>(sql`
      SELECT w.id, w.kind, w.effective_date::text, w.decision_no, d.name AS department_name, b.name AS branch_name, w.job_title, w.note, w.source_type, w.applied_at, w.version
      FROM hr.work_events w LEFT JOIN core.departments d ON d.id = w.department_id LEFT JOIN core.branches b ON b.id = w.branch_id
      WHERE w.employee_id = ${employeeId} ORDER BY w.effective_date DESC`);
    return rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      effectiveDate: row.effective_date,
      decisionNo: row.decision_no,
      departmentName: row.department_name,
      branchName: row.branch_name,
      jobTitle: row.job_title,
      note: row.note,
      sourceType: row.source_type,
      effective: row.effective_date <= today,
      appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
      version: row.version,
    }));
  }

  // Quyết định ghi lùi ngày được phép (áp dụng ngay), nhưng sau ngày vào làm và không trùng ngày quyết định khác.
  private async validate(executor: Executor, actor: Actor, employee: { id: string; hire_date: string }, input: Input, exceptId: string | null): Promise<void> {
    const fields: Record<string, ErrorMessageKey> = {};
    if (input.effectiveDate <= employee.hire_date) fields.effectiveDate = "workEventBeforeHire";
    if (!input.departmentId && !input.branchId && !input.jobTitle) fields.departmentId = "workEventEmpty";
    if (
      input.departmentId &&
      (await executor.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0
    )
      fields.departmentId = "invalidValue";
    if (input.branchId && (await executor.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
      fields.branchId = "invalidValue";
    if (Object.keys(fields).length === 0) {
      const sameDay = await executor.execute(sql`
        SELECT 1 FROM hr.work_events WHERE employee_id = ${employee.id} AND effective_date = ${input.effectiveDate}::date AND id IS DISTINCT FROM ${exceptId}::uuid`);
      if (sameDay.rows.length > 0) fields.effectiveDate = "workEventSameDay";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  async create(actor: Actor, employeeId: string, input: Input): Promise<WorkEventItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.database.transaction(async (transaction) => {
      const employee = await this.employee(transaction, actor, employeeId, granted, true);
      if (employee.status !== "active") throw new ApiError("BUSINESS_RULE", "employeeTerminated");
      await this.validate(transaction, actor, employee, input, null);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.work_events (company_id, employee_id, kind, effective_date, decision_no, department_id, branch_id, job_title, note, created_by)
        VALUES (${actor.companyId}, ${employeeId}, ${input.kind}, ${input.effectiveDate}::date, ${input.decisionNo}, ${input.departmentId ?? null}, ${input.branchId ?? null},
          ${input.jobTitle}, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.applyEmployee(transaction, employeeId, actor.userId);
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.work_event.add", entityId: employeeId, afterData: { id: created, ...input } }, transaction);
    });
    return this.items(employeeId);
  }

  // Chỉ sửa, xóa quyết định nhập tay chưa đến ngày hiệu lực.
  private async editable(executor: Executor, actor: Actor, employeeId: string, eventId: string) {
    const row = (
      await executor.execute<{ id: string; effective_date: string; source_type: string; version: number }>(sql`
      SELECT id, effective_date::text, source_type, version FROM hr.work_events WHERE id = ${eventId} AND employee_id = ${employeeId} AND company_id = ${actor.companyId} FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.effective_date <= this.permissionService.today() || row.source_type !== "manual") throw new ApiError("BUSINESS_RULE", "workEventLocked");
    return row;
  }

  async update(actor: Actor, employeeId: string, eventId: string, input: Input): Promise<WorkEventItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.database.transaction(async (transaction) => {
      const employee = await this.employee(transaction, actor, employeeId, granted, true);
      if (employee.status !== "active") throw new ApiError("BUSINESS_RULE", "employeeTerminated");
      const before = await this.editable(transaction, actor, employeeId, eventId);
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validate(transaction, actor, employee, input, eventId);
      await transaction.execute(sql`
        UPDATE hr.work_events SET kind = ${input.kind}, effective_date = ${input.effectiveDate}::date, decision_no = ${input.decisionNo}, department_id = ${input.departmentId ?? null},
          branch_id = ${input.branchId ?? null}, job_title = ${input.jobTitle}, note = ${input.note}, version = version + 1
        WHERE id = ${eventId}`);
      await this.applyEmployee(transaction, employeeId, actor.userId);
      await this.auditService.record(
        { ...hrAudit(actor, "employee"), action: "employee.work_event.update", entityId: employeeId, beforeData: before, afterData: { id: eventId, ...input } },
        transaction,
      );
    });
    return this.items(employeeId);
  }

  async remove(actor: Actor, employeeId: string, eventId: string): Promise<WorkEventItem[]> {
    const granted = await requireHrPermission(this.permissionService, actor, hrPermission.manage);
    await this.database.transaction(async (transaction) => {
      const employee = await this.employee(transaction, actor, employeeId, granted, true);
      if (employee.status !== "active") throw new ApiError("BUSINESS_RULE", "employeeTerminated");
      const before = await this.editable(transaction, actor, employeeId, eventId);
      await transaction.execute(sql`DELETE FROM hr.work_events WHERE id = ${eventId}`);
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.work_event.remove", entityId: employeeId, beforeData: before }, transaction);
    });
    return this.items(employeeId);
  }

  // Áp dụng các quyết định đã đến ngày hiệu lực của một hồ sơ: cập nhật thành viên công ty theo vị trí hiện hành (nếu có tài khoản liên kết)
  // và đánh dấu đã áp dụng, trong giao dịch của bên gọi. Chạy lại không đổi gì thêm.
  async applyEmployee(executor: Executor, employeeId: string, actorUserId: string | null): Promise<void> {
    const today = this.permissionService.today();
    const employee = (
      await executor.execute<{ company_id: string; user_id: string | null; status: string; department_id: string | null; branch_id: string | null; job_title: string | null }>(sql`
      SELECT e.company_id, e.user_id, e.status, position.* FROM hr.employees e CROSS JOIN LATERAL (SELECT ${positionAt(sql`e.id`, sql`${today}::date`)}) position WHERE e.id = ${employeeId}`)
    ).rows[0];
    if (!employee) return;
    const due = await executor.execute(sql`UPDATE hr.work_events SET applied_at = now() WHERE employee_id = ${employeeId} AND applied_at IS NULL AND effective_date <= ${today}::date RETURNING id`);
    if (employee.user_id && employee.status === "active" && due.rows.length > 0) {
      await updateMembershipPlacement(
        executor,
        employee.user_id,
        employee.company_id,
        { departmentId: employee.department_id, branchId: employee.branch_id, jobTitle: employee.job_title },
        actorUserId,
      );
    }
  }

  // Áp dụng khi liên kết tài khoản mới: cập nhật ngay theo vị trí hiện hành dù các quyết định đã áp dụng trước đó.
  async applyLinkedUser(executor: Executor, employeeId: string, actorUserId: string): Promise<void> {
    await executor.execute(sql`UPDATE hr.work_events SET applied_at = NULL WHERE employee_id = ${employeeId} AND effective_date <= ${this.permissionService.today()}::date`);
    await this.applyEmployee(executor, employeeId, actorUserId);
  }

  // Việc nền lúc 0 giờ 5 phút giờ Việt Nam (QUYTAC_NGHIEPVU_296).
  async applyDue(): Promise<number> {
    const today = this.permissionService.today();
    const employees = await this.database.execute<{ employee_id: string }>(
      sql`SELECT DISTINCT employee_id FROM hr.work_events WHERE applied_at IS NULL AND effective_date <= ${today}::date LIMIT 5000`,
    );
    let applied = 0;
    for (const row of employees.rows) {
      try {
        await this.database.transaction(async (transaction) => {
          await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${row.employee_id} FOR UPDATE`);
          await this.applyEmployee(transaction, row.employee_id, null);
        });
        applied += 1;
      } catch (error) {
        this.logger.error(`Không áp dụng được quyết định công tác của hồ sơ ${row.employee_id}: ${(error as Error).message}`);
      }
    }
    return applied;
  }
}
