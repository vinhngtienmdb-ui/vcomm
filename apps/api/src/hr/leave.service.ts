// Nghỉ phép (CONG_VIEC_47; CHUC_NANG_166; QUYTAC_NGHIEPVU_307 đến 309; API_153): loại nghỉ, chế độ phép năm, sổ phép cộng dần theo tháng,
// phép tồn hết hạn, đơn nghỉ (người lao động lập qua luồng duyệt chung; nhân sự ghi nhận có hiệu lực ngay), hủy đơn.
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type {
  LeaveBalanceItem,
  LeaveLedgerEntry,
  LeavePayGroup,
  LeavePreviewResponse,
  LeaveRequestItem,
  LeaveTypeItem,
  LeaveYearBalance,
  MyLeaveResponse,
  WorkCondition,
  leaveAdjustmentSchema,
  leaveRequestBodySchema,
  leaveRequestListQuerySchema,
  saveLeavePolicySchema,
  saveLeaveTypeSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { addDays } from "./attendance-calculator";
import { attendanceAccess, attendancePermission, employeeScope, requireAttendanceView, type AttendanceAccess } from "./attendance-access";
import { AttendanceDaysService, assertMonthsOpen } from "./attendance-days.service";
import { AttendanceSetupService } from "./attendance-setup.service";
import { ageAt, hrAudit } from "./hr-context";
import { attachmentType, type UploadedAttachment } from "./my-attendance.service";

type Executor = Pick<Database, "execute">;
type Transaction = Pick<Database, "execute" | "insert">;
type RequestBody = z.output<typeof leaveRequestBodySchema>;
export const leaveDocumentType = "hr.leave_request";

// Loại nghỉ tạo sẵn (Bộ luật Lao động Điều 113, 115; chế độ bảo hiểm xã hội).
const systemTypes: { code: string; name: string; payGroup: LeavePayGroup; perEventDays: number | null; requiresAttachment: boolean }[] = [
  { code: "annual", name: "Phép năm", payGroup: "annual", perEventDays: null, requiresAttachment: false },
  { code: "marriage", name: "Kết hôn", payGroup: "paid_personal", perEventDays: 3, requiresAttachment: false },
  { code: "child_marriage", name: "Con kết hôn", payGroup: "paid_personal", perEventDays: 1, requiresAttachment: false },
  { code: "bereavement", name: "Tang cha, mẹ, vợ hoặc chồng, con", payGroup: "paid_personal", perEventDays: 3, requiresAttachment: false },
  { code: "unpaid_personal", name: "Việc riêng không lương (ông bà, anh chị em ruột mất; cha mẹ, anh chị em ruột kết hôn)", payGroup: "unpaid", perEventDays: 1, requiresAttachment: false },
  { code: "unpaid_agreed", name: "Không lương theo thỏa thuận", payGroup: "unpaid", perEventDays: null, requiresAttachment: false },
  { code: "sick", name: "Ốm đau", payGroup: "social_insurance", perEventDays: null, requiresAttachment: true },
  { code: "maternity", name: "Thai sản", payGroup: "social_insurance", perEventDays: null, requiresAttachment: true },
  { code: "work_accident", name: "Tai nạn lao động, bệnh nghề nghiệp", payGroup: "social_insurance", perEventDays: null, requiresAttachment: true },
];

// Số ngày phép năm cơ bản (Bộ luật Lao động Điều 113 khoản 1).
const baseDays: Record<WorkCondition, number> = { normal: 12, disabled: 14, hazardous: 14, very_hazardous: 16 };
const round2 = (value: number) => Math.round(value * 100) / 100;
const text2 = (value: number) => round2(value).toFixed(2);
const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;

type TypeRow = {
  id: string;
  system_code: string | null;
  name: string;
  pay_group: LeavePayGroup;
  per_event_days: string | null;
  yearly_max_days: string | null;
  requires_attachment: boolean;
  status: "active" | "inactive";
  version: number;
};
type EmployeeRow = {
  id: string;
  company_id: string;
  code: string;
  full_name: string;
  birth_date: string;
  hire_date: string;
  termination_date: string | null;
  status: string;
  user_id: string | null;
  work_condition: WorkCondition | null;
  seniority_start: string | null;
};

const typeItem = (row: TypeRow): LeaveTypeItem => ({
  id: row.id,
  systemCode: row.system_code,
  name: row.name,
  payGroup: row.pay_group,
  perEventDays: row.per_event_days,
  yearlyMaxDays: row.yearly_max_days,
  requiresAttachment: row.requires_attachment,
  status: row.status,
  selfService: row.pay_group !== "social_insurance",
  version: row.version,
});

// Ngày phép năm của một năm làm việc: cơ bản theo điều kiện (chưa thành niên ít nhất 14) + 1 ngày mỗi đủ 5 năm (Điều 114).
export function entitlementOn(employee: Pick<EmployeeRow, "birth_date" | "hire_date" | "work_condition" | "seniority_start">, day: string): number {
  const base = baseDays[employee.work_condition ?? "normal"];
  const minor = ageAt(employee.birth_date, day) < 18;
  const seniorityYears = Math.max(0, ageAt(employee.seniority_start ?? employee.hire_date, day));
  return Math.max(base, minor ? 14 : 0) + Math.floor(seniorityYears / 5);
}

// Phần cộng của tháng thứ m trong năm: lấy hiệu hai mốc làm tròn để 12 tháng cộng đúng số ngày cả năm (Nghị định 145 Điều 66 khoản 1).
export const monthlyAccrual = (entitlement: number, month: number) => round2((entitlement * month) / 12) - round2((entitlement * (month - 1)) / 12);

// Hạn dùng phép tồn của năm phát sinh: hết ngày cuối tháng thứ N của năm sau.
export const carryoverDeadline = (leaveYear: number, months: number) => addDays(`${leaveYear + 1 + Math.floor(months / 12)}-${String((months % 12) + 1).padStart(2, "0")}-01`, -1);

@Injectable()
export class LeaveService implements OnModuleInit {
  private readonly logger = new Logger("HrLeave");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly days: AttendanceDaysService,
    private readonly setup: AttendanceSetupService,
  ) {}

  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (String(event.payload.documentTypeCode) !== leaveDocumentType) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const row = (
          await transaction.execute<{ id: string }>(sql`
          UPDATE hr.leave_requests SET status = ${status}, completed_at = now() WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id`)
        ).rows[0];
        if (row && status === "approved") await this.takeEffect(transaction, row.id, null);
      });
    });
  }

  private access(actor: Actor): Promise<AttendanceAccess> {
    return attendanceAccess(this.permissionService, this.database, actor);
  }

  private requireLeaveManage(access: AttendanceAccess): void {
    if (!access.granted.has(attendancePermission.leave)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // ---- Loại nghỉ ----

  async ensureTypes(executor: Executor, companyId: string): Promise<void> {
    for (const type of systemTypes) {
      await executor.execute(sql`
        INSERT INTO hr.leave_types (company_id, system_code, name, pay_group, per_event_days, requires_attachment)
        VALUES (${companyId}, ${type.code}, ${type.name}, ${type.payGroup}, ${type.perEventDays}, ${type.requiresAttachment}) ON CONFLICT DO NOTHING`);
    }
  }

  private async typeRows(companyId: string): Promise<TypeRow[]> {
    await this.ensureTypes(this.database, companyId);
    return (
      await this.database.execute<TypeRow>(sql`
      SELECT id, system_code, name, pay_group, per_event_days::text, yearly_max_days::text, requires_attachment, status, version
      FROM hr.leave_types WHERE company_id = ${companyId} ORDER BY system_code IS NULL, created_at, name`)
    ).rows;
  }

  async types(actor: Actor): Promise<LeaveTypeItem[]> {
    requireAttendanceView(await this.access(actor));
    return (await this.typeRows(actor.companyId)).map(typeItem);
  }

  async createType(actor: Actor, input: z.output<typeof saveLeaveTypeSchema>): Promise<LeaveTypeItem> {
    this.requireLeaveManage(await this.access(actor));
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.leave_types (company_id, name, pay_group, yearly_max_days, requires_attachment, status, created_by)
        VALUES (${actor.companyId}, ${input.name}, ${input.payGroup ?? "paid_other"}, ${input.yearlyMaxDays ?? null}, ${input.requiresAttachment ?? false}, ${input.status ?? "active"}, ${actor.userId})
        ON CONFLICT DO NOTHING RETURNING id`);
      if (inserted.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "leaveTypeExists" } });
      await this.auditService.record({ ...hrAudit(actor, "leave_type"), action: "leave_type.create", entityId: inserted.rows[0]!.id, beforeData: null, afterData: input }, transaction);
      return inserted.rows[0]!.id;
    });
    return (await this.types(actor)).find((type) => type.id === id)!;
  }

  // Loại theo luật chỉ đổi tên, ngừng dùng (trừ phép năm); loại của công ty sửa được nhóm lương, giới hạn, tệp.
  async updateType(actor: Actor, id: string, input: z.output<typeof saveLeaveTypeSchema>): Promise<LeaveTypeItem> {
    this.requireLeaveManage(await this.access(actor));
    await this.database.transaction(async (transaction) => {
      const before = (
        await transaction.execute<TypeRow>(sql`
        SELECT id, system_code, name, pay_group, per_event_days::text, yearly_max_days::text, requires_attachment, status, version FROM hr.leave_types
        WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (input.version !== before.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const status = before.system_code === "annual" ? "active" : (input.status ?? before.status);
      const custom = before.system_code === null;
      const duplicate = await transaction.execute(sql`SELECT 1 FROM hr.leave_types WHERE company_id = ${actor.companyId} AND lower(name) = lower(${input.name}) AND id <> ${id}`);
      if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "leaveTypeExists" } });
      await transaction.execute(sql`
        UPDATE hr.leave_types SET name = ${input.name}, status = ${status},
          pay_group = ${custom ? (input.payGroup ?? before.pay_group) : before.pay_group},
          yearly_max_days = ${custom ? (input.yearlyMaxDays ?? null) : before.yearly_max_days}::numeric,
          requires_attachment = ${custom ? (input.requiresAttachment ?? before.requires_attachment) : before.requires_attachment},
          updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "leave_type"), action: "leave_type.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return (await this.types(actor)).find((type) => type.id === id)!;
  }

  // ---- Sổ phép ----

  private employeeSelect(condition: SQL): SQL {
    return sql`
      SELECT e.id, e.company_id, e.code, e.full_name, e.birth_date::text, e.hire_date::text, e.termination_date::text, e.status, e.user_id,
        p.work_condition, p.seniority_start::text
      FROM hr.employees e LEFT JOIN hr.employee_leave_policies p ON p.employee_id = e.id WHERE ${condition}`;
  }

  // Số dư theo năm và số ngày phép năm đang chờ duyệt của nhiều hồ sơ.
  private async balancesOf(executor: Executor, companyId: string, employees: EmployeeRow[]): Promise<LeaveBalanceItem[]> {
    if (employees.length === 0) return [];
    const ids = sql.join(
      employees.map((employee) => sql`${employee.id}::uuid`),
      sql`, `,
    );
    const settings = await this.setup.settingsOf(executor, companyId);
    const sums = await executor.execute<{ employee_id: string; leave_year: number; kind: LeaveLedgerEntry["kind"]; days: string }>(sql`
      SELECT employee_id, leave_year, kind, sum(days)::text AS days FROM hr.leave_ledger WHERE employee_id IN (${ids}) GROUP BY employee_id, leave_year, kind`);
    const pending = await executor.execute<{ employee_id: string; days: string }>(sql`
      SELECT r.employee_id, sum(r.days)::text AS days FROM hr.leave_requests r JOIN hr.leave_types t ON t.id = r.leave_type_id
      WHERE r.employee_id IN (${ids}) AND r.status = 'pending' AND t.pay_group = 'annual' GROUP BY r.employee_id`);
    const today = this.days.today();
    return employees.map((employee) => {
      const own = sums.rows.filter((row) => row.employee_id === employee.id);
      const years = [...new Set(own.map((row) => row.leave_year))].sort();
      const value = (year: number, kinds: string[]) => own.filter((row) => row.leave_year === year && kinds.includes(row.kind)).reduce((total, row) => total + Number(row.days), 0);
      const yearItems: LeaveYearBalance[] = years.map((year) => ({
        leaveYear: year,
        accrued: text2(value(year, ["accrual", "month_reversal"])),
        adjusted: text2(value(year, ["adjustment"])),
        used: text2(-value(year, ["usage"])),
        expired: text2(-value(year, ["expiry"])),
        paidOut: text2(-value(year, ["payout"])),
        balance: text2(value(year, ["accrual", "month_reversal", "adjustment", "usage", "expiry", "payout"])),
        expiresOn: settings.carryoverMode === "expire" ? carryoverDeadline(year, settings.carryoverMonths) : null,
      }));
      const available = yearItems.filter((item) => !item.expiresOn || item.expiresOn >= today).reduce((total, item) => total + Number(item.balance), 0);
      return {
        employeeId: employee.id,
        code: employee.code,
        fullName: employee.full_name,
        workCondition: employee.work_condition ?? "normal",
        isMinor: ageAt(employee.birth_date, today) < 18,
        seniorityStart: employee.seniority_start ?? employee.hire_date,
        entitlementDays: entitlementOn(employee, today),
        years: yearItems,
        available: text2(available),
        pending: text2(Number(pending.rows.find((row) => row.employee_id === employee.id)?.days ?? 0)),
      };
    });
  }

  async balances(actor: Actor): Promise<LeaveBalanceItem[]> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const employees = await this.database.execute<EmployeeRow>(
      this.employeeSelect(sql`e.company_id = ${actor.companyId} AND e.status = 'active' AND ${employeeScope(access, this.days.today())} ORDER BY e.full_name LIMIT 1000`),
    );
    return this.balancesOf(this.database, actor.companyId, employees.rows);
  }

  async ledger(actor: Actor, employeeId: string): Promise<LeaveLedgerEntry[]> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const employee = await this.database.execute(sql`SELECT 1 FROM hr.employees e WHERE e.id = ${employeeId} AND e.company_id = ${actor.companyId} AND ${employeeScope(access, this.days.today())}`);
    if (employee.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return this.ledgerRows(employeeId);
  }

  private async ledgerRows(employeeId: string): Promise<LeaveLedgerEntry[]> {
    const rows = await this.database.execute<{
      id: string;
      leave_year: number;
      kind: LeaveLedgerEntry["kind"];
      days: string;
      accrual_month: string | null;
      request_no: string | null;
      reason: string | null;
      created_at: Date;
    }>(sql`
      SELECT l.id, l.leave_year, l.kind, l.days::text, l.accrual_month::text, r.request_no, l.reason, l.created_at
      FROM hr.leave_ledger l LEFT JOIN hr.leave_requests r ON r.id = l.leave_request_id WHERE l.employee_id = ${employeeId} ORDER BY l.created_at DESC, l.leave_year DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      leaveYear: row.leave_year,
      kind: row.kind,
      days: row.days,
      accrualMonth: row.accrual_month,
      requestNo: row.request_no,
      reason: row.reason,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async savePolicy(actor: Actor, employeeId: string, input: z.output<typeof saveLeavePolicySchema>): Promise<LeaveBalanceItem> {
    this.requireLeaveManage(await this.access(actor));
    await this.database.transaction(async (transaction) => {
      const employee = await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${employeeId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (employee.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await transaction.execute(sql`
        INSERT INTO hr.employee_leave_policies (employee_id, company_id, work_condition, seniority_start, updated_by)
        VALUES (${employeeId}, ${actor.companyId}, ${input.workCondition}, ${input.seniorityStart ?? null}::date, ${actor.userId})
        ON CONFLICT (employee_id) DO UPDATE SET work_condition = EXCLUDED.work_condition, seniority_start = EXCLUDED.seniority_start,
          updated_by = EXCLUDED.updated_by, updated_at = now(), version = hr.employee_leave_policies.version + 1`);
      await this.auditService.record({ ...hrAudit(actor, "leave_policy"), action: "leave_policy.update", entityId: employeeId, beforeData: null, afterData: input }, transaction);
    });
    return (await this.balances(actor)).find((item) => item.employeeId === employeeId)!;
  }

  async adjust(actor: Actor, input: z.output<typeof leaveAdjustmentSchema>): Promise<LeaveBalanceItem> {
    this.requireLeaveManage(await this.access(actor));
    if (Number(input.days) === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { days: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      const employee = await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${input.employeeId} AND company_id = ${actor.companyId} AND status = 'active' FOR UPDATE`);
      if (employee.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, reason, created_by)
        VALUES (${actor.companyId}, ${input.employeeId}, ${input.leaveYear}, 'adjustment', ${input.days}::numeric, ${input.reason}, ${actor.userId}) RETURNING id`);
      await this.auditService.record({ ...hrAudit(actor, "leave_ledger"), action: "leave_ledger.adjust", entityId: inserted.rows[0]!.id, beforeData: null, afterData: input }, transaction);
    });
    return (await this.balances(actor)).find((item) => item.employeeId === input.employeeId)!;
  }

  // Việc nền 0 giờ 15 phút: cộng phép tháng hiện tại cho hồ sơ đang làm (mỗi tháng một lần), ghi hết hạn phép tồn quá hạn.
  async accrueDue(): Promise<{ accrued: number; expired: number }> {
    const today = this.days.today();
    const month = firstOfMonth(today);
    const monthNumber = Number(today.slice(5, 7));
    let accrued = 0;
    let expired = 0;
    const employees = await this.database.execute<EmployeeRow>(
      this.employeeSelect(sql`e.status = 'active' AND e.hire_date <= ${today}::date
        AND NOT EXISTS (SELECT 1 FROM hr.leave_ledger l WHERE l.employee_id = e.id AND l.kind = 'accrual' AND l.accrual_month = ${month}::date)`),
    );
    for (const employee of employees.rows) {
      const days = monthlyAccrual(entitlementOn(employee, today), monthNumber);
      const inserted = await this.database.execute(sql`
        INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, accrual_month)
        VALUES (${employee.company_id}, ${employee.id}, ${Number(today.slice(0, 4))}, 'accrual', ${days}, ${month}::date) ON CONFLICT DO NOTHING RETURNING id`);
      accrued += inserted.rows.length;
    }
    const companies = await this.database.execute<{ company_id: string; carryover_months: number }>(sql`
      SELECT company_id, carryover_months FROM hr.attendance_settings WHERE carryover_mode = 'expire'
      UNION SELECT DISTINCT l.company_id, 3 FROM hr.leave_ledger l WHERE NOT EXISTS (SELECT 1 FROM hr.attendance_settings s WHERE s.company_id = l.company_id)`);
    for (const company of companies.rows) {
      // Năm phát sinh có hạn trước hôm nay còn dư dương thì ghi hết hạn phần dư (mỗi năm một lần).
      const due = await this.database.execute<{ employee_id: string; leave_year: number; balance: string }>(sql`
        SELECT employee_id, leave_year, sum(days)::text AS balance FROM hr.leave_ledger WHERE company_id = ${company.company_id}
        GROUP BY employee_id, leave_year HAVING sum(days) > 0 AND bool_and(kind <> 'expiry')`);
      for (const row of due.rows) {
        if (carryoverDeadline(row.leave_year, company.carryover_months) >= today) continue;
        const inserted = await this.database.execute(sql`
          INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days) VALUES (${company.company_id}, ${row.employee_id}, ${row.leave_year}, 'expiry', ${-Number(row.balance)})
          ON CONFLICT DO NOTHING RETURNING id`);
        expired += inserted.rows.length;
      }
    }
    return { accrued, expired };
  }

  // ---- Đơn nghỉ ----

  // Ngày nghỉ và số công: ngày có ca dự kiến, không phải ngày lễ; nửa ngày tính một nửa hệ số ca (QUYTAC_NGHIEPVU_309).
  async leaveDates(executor: Executor, companyId: string, employeeId: string, body: RequestBody): Promise<LeavePreviewResponse["dates"]> {
    if (body.toDate < body.fromDate) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { toDate: "invalidValue" } });
    if (body.fromDate !== body.toDate && body.fromHalf === "morning") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fromHalf: "invalidValue" } });
    if (addDays(body.fromDate, 92) < body.toDate) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { toDate: "leaveRangeTooLong" } });
    const calendar = (await this.days.calendars(executor, companyId, [employeeId], body.fromDate, body.toDate)).get(employeeId)!;
    const dates: LeavePreviewResponse["dates"] = [];
    for (const day of calendar.days) {
      if (!day.shift || day.holiday) continue;
      let half: "full" | "morning" | "afternoon" = "full";
      if (body.fromDate === body.toDate) half = body.fromHalf;
      else if (day.date === body.fromDate && body.fromHalf === "afternoon") half = "afternoon";
      else if (day.date === body.toDate && body.toHalf === "morning") half = "morning";
      dates.push({ date: day.date, half, units: text2(day.shift.workUnits * (half === "full" ? 1 : 0.5)) });
    }
    if (dates.length === 0) throw new ApiError("BUSINESS_RULE", "leaveNoWorkingDays");
    return dates;
  }

  private async typeOf(executor: Executor, companyId: string, typeId: string): Promise<TypeRow> {
    await this.ensureTypes(executor, companyId);
    const row = (
      await executor.execute<TypeRow>(sql`
      SELECT id, system_code, name, pay_group, per_event_days::text, yearly_max_days::text, requires_attachment, status, version FROM hr.leave_types
      WHERE id = ${typeId} AND company_id = ${companyId} AND status = 'active'`)
    ).rows[0];
    if (!row) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { leaveTypeId: "invalidValue" } });
    return row;
  }

  // Phép năm còn được nghỉ: số dư chưa hết hạn trừ đơn chờ duyệt; cho nghỉ trước thì cộng phần còn được cộng đến hết năm.
  private async annualAvailable(executor: Executor, employee: EmployeeRow, excludeRequestId: string | null): Promise<number> {
    const balance = (await this.balancesOf(executor, employee.company_id, [employee]))[0]!;
    let pending = Number(balance.pending);
    if (excludeRequestId) {
      const own = await executor.execute<{ days: string }>(sql`SELECT days::text FROM hr.leave_requests WHERE id = ${excludeRequestId} AND status = 'pending'`);
      pending -= Number(own.rows[0]?.days ?? 0);
    }
    let available = Number(balance.available) - pending;
    const settings = await this.setup.settingsOf(executor, employee.company_id);
    if (settings.allowAdvanceLeave) {
      const today = this.days.today();
      const accruedThisYear = Number(balance.years.find((year) => year.leaveYear === Number(today.slice(0, 4)))?.accrued ?? 0);
      available += Math.max(0, entitlementOn(employee, today) - accruedThisYear);
    }
    return round2(available);
  }

  private async validate(executor: Executor, employee: EmployeeRow, type: TypeRow, body: RequestBody, dates: LeavePreviewResponse["dates"], excludeRequestId: string | null): Promise<number> {
    if (body.fromDate < employee.hire_date || (employee.termination_date && body.toDate > employee.termination_date)) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { fromDate: "punchOutsideEmployment" } });
    }
    const total = round2(dates.reduce((sum, item) => sum + Number(item.units), 0));
    // Trùng thời gian với đơn khác chưa hủy, chưa từ chối (cùng ngày, khác buổi vẫn được).
    const overlapping = await executor.execute<{ half: string; leave_date: string }>(sql`
      SELECT d.half, d.leave_date::text FROM hr.leave_request_days d JOIN hr.leave_requests r ON r.id = d.leave_request_id
      WHERE d.employee_id = ${employee.id} AND r.status IN ('pending', 'approved') AND d.leave_date BETWEEN ${body.fromDate}::date AND ${body.toDate}::date
        ${excludeRequestId ? sql`AND r.id <> ${excludeRequestId}` : sql``}`);
    for (const existing of overlapping.rows) {
      const mine = dates.find((item) => item.date === existing.leave_date);
      if (mine && (mine.half === "full" || existing.half === "full" || mine.half === existing.half)) throw new ApiError("BUSINESS_RULE", "leaveOverlap");
    }
    // Số ngày theo luật cho mỗi lần (Bộ luật Lao động Điều 115).
    if (type.per_event_days && total > Number(type.per_event_days)) throw new ApiError("BUSINESS_RULE", "leaveExceedsEvent");
    if (type.yearly_max_days) {
      const used = await executor.execute<{ days: string }>(sql`
        SELECT COALESCE(sum(days), 0)::text AS days FROM hr.leave_requests WHERE employee_id = ${employee.id} AND leave_type_id = ${type.id} AND status IN ('pending', 'approved')
          AND extract(year FROM from_date) = ${Number(body.fromDate.slice(0, 4))}${excludeRequestId ? sql` AND id <> ${excludeRequestId}` : sql``}`);
      if (Number(used.rows[0]!.days) + total > Number(type.yearly_max_days)) throw new ApiError("BUSINESS_RULE", "leaveExceedsYearly");
    }
    if (type.pay_group === "annual" && total > (await this.annualAvailable(executor, employee, excludeRequestId))) throw new ApiError("BUSINESS_RULE", "leaveBalanceInsufficient");
    return total;
  }

  async preview(actor: Actor, body: RequestBody, self: boolean): Promise<LeavePreviewResponse> {
    const employee = self ? await this.myEmployee(this.database, actor) : await this.employeeForHr(this.database, actor, body.employeeId);
    const type = await this.typeOf(this.database, actor.companyId, body.leaveTypeId);
    const dates = await this.leaveDates(this.database, actor.companyId, employee.id, body);
    const total = round2(dates.reduce((sum, item) => sum + Number(item.units), 0));
    const before = type.pay_group === "annual" ? await this.annualAvailable(this.database, employee, null) : null;
    return { days: text2(total), dates, availableBefore: before === null ? null : text2(before), availableAfter: before === null ? null : text2(before - total) };
  }

  private async myEmployee(executor: Executor, actor: Actor, lock = false): Promise<EmployeeRow> {
    const row = (
      await executor.execute<EmployeeRow>(
        sql`${this.employeeSelect(sql`e.company_id = ${actor.companyId} AND e.user_id = ${actor.userId} AND e.status = 'active'`)}${lock ? sql` FOR UPDATE OF e` : sql``}`,
      )
    ).rows[0];
    if (!row) throw new ApiError("FORBIDDEN", "noLinkedEmployee");
    return row;
  }

  private async employeeForHr(executor: Executor, actor: Actor, employeeId: string | undefined, lock = false): Promise<EmployeeRow> {
    if (!employeeId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "required" } });
    const row = (
      await executor.execute<EmployeeRow>(sql`${this.employeeSelect(sql`e.id = ${employeeId} AND e.company_id = ${actor.companyId} AND e.status = 'active'`)}${lock ? sql` FOR UPDATE OF e` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { employeeId: "invalidValue" } });
    return row;
  }

  // Đơn có hiệu lực: trừ phép năm theo năm phát sinh cũ nhất còn dư (thiếu thì ghi vào năm hiện tại), tính lại công các ngày nghỉ.
  private async takeEffect(transaction: Transaction, requestId: string, actorUserId: string | null): Promise<void> {
    const request = (
      await transaction.execute<{ company_id: string; employee_id: string; days: string; from_date: string; to_date: string; pay_group: LeavePayGroup }>(sql`
      SELECT r.company_id, r.employee_id, r.days::text, r.from_date::text, r.to_date::text, t.pay_group
      FROM hr.leave_requests r JOIN hr.leave_types t ON t.id = r.leave_type_id WHERE r.id = ${requestId}`)
    ).rows[0]!;
    if (request.pay_group === "annual") {
      let remaining = Number(request.days);
      const settings = await this.setup.settingsOf(transaction, request.company_id);
      const today = this.days.today();
      const buckets = await transaction.execute<{ leave_year: number; balance: string }>(sql`
        SELECT leave_year, sum(days)::text AS balance FROM hr.leave_ledger WHERE employee_id = ${request.employee_id} GROUP BY leave_year HAVING sum(days) > 0 ORDER BY leave_year`);
      for (const bucket of buckets.rows) {
        if (remaining <= 0) break;
        if (settings.carryoverMode === "expire" && carryoverDeadline(bucket.leave_year, settings.carryoverMonths) < today) continue;
        const take = Math.min(remaining, Number(bucket.balance));
        await transaction.execute(sql`
          INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, leave_request_id, created_by)
          VALUES (${request.company_id}, ${request.employee_id}, ${bucket.leave_year}, 'usage', ${-round2(take)}, ${requestId}, ${actorUserId})`);
        remaining = round2(remaining - take);
      }
      if (remaining > 0) {
        await transaction.execute(sql`
          INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, leave_request_id, created_by)
          VALUES (${request.company_id}, ${request.employee_id}, ${Number(today.slice(0, 4))}, 'usage', ${-remaining}, ${requestId}, ${actorUserId})`);
      }
    }
    await this.days.recalculate(transaction, request.company_id, [request.employee_id], request.from_date, request.to_date);
  }

  // Lập đơn: self = người lao động tự lập (qua luồng duyệt); còn lại nhân sự ghi nhận, có hiệu lực ngay.
  async create(actor: Actor, body: RequestBody, file: UploadedAttachment | undefined, self: boolean): Promise<LeaveRequestItem> {
    if (!self) this.requireLeaveManage(await this.access(actor));
    const contentType = file ? attachmentType(file) : null;
    await ensureSequence(this.database, this.sequences, actor, leaveDocumentType, "NP");
    const storageKey = file ? `hr/leave-requests/${actor.companyId}/${randomUUID()}` : null;
    if (file && storageKey) await this.storage.put(storageKey, file.buffer, contentType!);
    let id: string;
    let ownerId: string | null = null;
    try {
      id = await this.database.transaction(async (transaction) => {
        const employee = self ? await this.myEmployee(transaction, actor, true) : await this.employeeForHr(transaction, actor, body.employeeId, true);
        if (self) ownerId = employee.id;
        const type = await this.typeOf(transaction, actor.companyId, body.leaveTypeId);
        if (self && type.pay_group === "social_insurance") throw new ApiError("BUSINESS_RULE", "leaveTypeHrOnly");
        if (type.requires_attachment && !file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
        const dates = await this.leaveDates(transaction, actor.companyId, employee.id, body);
        await assertMonthsOpen(
          transaction,
          actor.companyId,
          dates.map((item) => item.date),
        );
        const total = await this.validate(transaction, employee, type, body, dates, null);
        const requestNo = await this.sequences.next(actor.companyId, leaveDocumentType, transaction);
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.leave_requests (company_id, employee_id, request_no, leave_type_id, from_date, from_half, to_date, to_half, days, reason,
            attachment_key, attachment_name, attachment_type, source, status, requested_by)
          VALUES (${actor.companyId}, ${employee.id}, ${requestNo}, ${type.id}, ${body.fromDate}::date, ${body.fromHalf}, ${body.toDate}::date, ${body.toHalf}, ${total},
            ${body.reason ?? null}, ${storageKey}, ${file?.originalname.slice(0, 200) ?? null}, ${contentType}, ${self ? "self" : "hr"}, 'pending', ${actor.userId}) RETURNING id`);
        const requestId = inserted.rows[0]!.id;
        for (const item of dates) {
          await transaction.execute(sql`
            INSERT INTO hr.leave_request_days (leave_request_id, employee_id, leave_date, half, units) VALUES (${requestId}, ${employee.id}, ${item.date}::date, ${item.half}, ${item.units}::numeric)`);
        }
        let approvalRequestId: string | null = null;
        if (self) {
          try {
            approvalRequestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
              documentTypeCode: leaveDocumentType,
              documentId: requestId,
              documentNo: requestNo,
              amount: text2(total),
              currency: await companyCurrency(transaction, actor.companyId),
              documentDate: this.days.today(),
            });
          } catch (error) {
            if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
          }
        }
        await transaction.execute(sql`
          UPDATE hr.leave_requests SET approval_request_id = ${approvalRequestId}, status = ${approvalRequestId ? "pending" : "approved"},
            completed_at = ${approvalRequestId ? null : this.clock.now().toISOString()}::timestamptz WHERE id = ${requestId}`);
        if (!approvalRequestId) await this.takeEffect(transaction, requestId, actor.userId);
        await this.auditService.record(
          { ...hrAudit(actor, "leave_request"), action: self ? "leave_request.submit" : "leave_request.record", entityId: requestId, beforeData: null, afterData: { ...body, requestNo, days: total } },
          transaction,
        );
        return requestId;
      });
    } catch (error) {
      if (storageKey) await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
    return (await this.items(sql`r.id = ${id}`, actor, ownerId))[0]!;
  }

  async withdraw(actor: Actor, id: string): Promise<LeaveRequestItem> {
    const employee = await this.myEmployee(this.database, actor);
    const row = (
      await this.database.execute<{ approval_request_id: string | null; status: string }>(sql`
      SELECT approval_request_id, status FROM hr.leave_requests WHERE id = ${id} AND employee_id = ${employee.id} AND requested_by = ${actor.userId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "pending" || !row.approval_request_id) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE hr.leave_requests SET status = 'withdrawn', completed_at = now() WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...hrAudit(actor, "leave_request"), action: "leave_request.withdraw", entityId: id }, transaction);
    });
    return (await this.items(sql`r.id = ${id}`, actor, employee.id))[0]!;
  }

  // Hủy đơn đã duyệt: người lao động trước ngày bắt đầu; nhân sự khi kỳ chưa chốt (QUYTAC_NGHIEPVU_309). Hoàn phép đã trừ, tính lại công.
  async cancel(actor: Actor, id: string, reason: string, self: boolean): Promise<LeaveRequestItem> {
    if (!self) this.requireLeaveManage(await this.access(actor));
    const mine = self ? await this.myEmployee(this.database, actor) : null;
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ employee_id: string; status: string; from_date: string; to_date: string }>(sql`
        SELECT employee_id, status, from_date::text, to_date::text FROM hr.leave_requests WHERE id = ${id} AND company_id = ${actor.companyId}
          ${mine ? sql`AND employee_id = ${mine.id}` : sql``} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "approved") throw new ApiError("BUSINESS_RULE", "leaveNotCancellable");
      if (self && row.from_date <= this.days.today()) throw new ApiError("BUSINESS_RULE", "leaveAlreadyStarted");
      const dates = await transaction.execute<{ leave_date: string }>(sql`SELECT leave_date::text FROM hr.leave_request_days WHERE leave_request_id = ${id}`);
      await assertMonthsOpen(
        transaction,
        actor.companyId,
        dates.rows.map((item) => item.leave_date),
      );
      await transaction.execute(sql`
        UPDATE hr.leave_requests SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by = ${actor.userId}, cancelled_at = now() WHERE id = ${id}`);
      // Hoàn phép năm đã trừ: ghi bút toán ngược theo từng năm phát sinh.
      await transaction.execute(sql`
        INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, leave_request_id, reason, created_by)
        SELECT company_id, employee_id, leave_year, 'usage', -sum(days), ${id}, ${reason}, ${actor.userId} FROM hr.leave_ledger
        WHERE leave_request_id = ${id} AND kind = 'usage' GROUP BY company_id, employee_id, leave_year HAVING sum(days) <> 0`);
      await this.auditService.record({ ...hrAudit(actor, "leave_request"), action: "leave_request.cancel", entityId: id, beforeData: { status: row.status }, afterData: { reason } }, transaction);
      await this.days.recalculate(transaction, actor.companyId, [row.employee_id], row.from_date, row.to_date);
    });
    return (await this.items(sql`r.id = ${id}`, actor, mine?.id ?? null))[0]!;
  }

  private async items(condition: SQL, actor: Actor, ownEmployeeId: string | null): Promise<LeaveRequestItem[]> {
    const access = await this.access(actor);
    const today = this.days.today();
    const rows = await this.database.execute<{
      id: string;
      request_no: string;
      employee_id: string;
      employee_code: string;
      employee_name: string;
      leave_type_id: string;
      leave_type_name: string;
      pay_group: LeavePayGroup;
      from_date: string;
      from_half: LeaveRequestItem["fromHalf"];
      to_date: string;
      to_half: LeaveRequestItem["toHalf"];
      days: string;
      reason: string | null;
      has_attachment: boolean;
      source: "self" | "hr";
      status: LeaveRequestItem["status"];
      approval_request_id: string | null;
      requested_at: Date;
      cancel_reason: string | null;
      requested_by: string;
    }>(sql`
      SELECT r.id, r.request_no, r.employee_id, e.code AS employee_code, e.full_name AS employee_name, r.leave_type_id, t.name AS leave_type_name, t.pay_group,
        r.from_date::text, r.from_half, r.to_date::text, r.to_half, r.days::text, r.reason, r.attachment_key IS NOT NULL AS has_attachment, r.source, r.status,
        r.approval_request_id, r.requested_at, r.cancel_reason, r.requested_by
      FROM hr.leave_requests r JOIN hr.employees e ON e.id = r.employee_id JOIN hr.leave_types t ON t.id = r.leave_type_id
      WHERE ${condition} ORDER BY r.from_date DESC, r.requested_at DESC LIMIT 300`);
    const manage = access.granted.has(attendancePermission.leave);
    return rows.rows.map((row) => {
      const own = ownEmployeeId === row.employee_id;
      return {
        id: row.id,
        requestNo: row.request_no,
        employeeId: row.employee_id,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        leaveTypeId: row.leave_type_id,
        leaveTypeName: row.leave_type_name,
        payGroup: row.pay_group,
        fromDate: row.from_date,
        fromHalf: row.from_half,
        toDate: row.to_date,
        toHalf: row.to_half,
        days: row.days,
        reason: row.reason,
        hasAttachment: row.has_attachment,
        source: row.source,
        status: row.status,
        approvalRequestId: row.approval_request_id,
        requestedAt: new Date(row.requested_at).toISOString(),
        cancelReason: row.cancel_reason,
        canWithdraw: own && row.status === "pending" && row.requested_by === actor.userId && row.approval_request_id !== null,
        canCancel: row.status === "approved" && (own ? row.from_date > today : manage),
      };
    });
  }

  async requests(actor: Actor, query: z.output<typeof leaveRequestListQuerySchema>): Promise<LeaveRequestItem[]> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const conditions = [sql`r.company_id = ${actor.companyId}`, employeeScope(access, this.days.today())];
    if (query.status) conditions.push(sql`r.status = ${query.status}`);
    if (query.leaveTypeId) conditions.push(sql`r.leave_type_id = ${query.leaveTypeId}`);
    if (query.month) conditions.push(sql`r.from_date <= (${`${query.month}-01`}::date + interval '1 month' - interval '1 day') AND r.to_date >= ${`${query.month}-01`}::date`);
    return this.items(sql.join(conditions, sql` AND `), actor, null);
  }

  async mine(actor: Actor): Promise<MyLeaveResponse> {
    const employee = await this.myEmployee(this.database, actor).catch(() => null);
    const types = (await this.typeRows(actor.companyId)).filter((row) => row.status === "active").map(typeItem);
    if (!employee) return { balance: null, types, requests: [] };
    return {
      balance: (await this.balancesOf(this.database, actor.companyId, [employee]))[0]!,
      types: types.filter((type) => type.selfService),
      requests: await this.items(sql`r.employee_id = ${employee.id}`, actor, employee.id),
    };
  }

  async myLedger(actor: Actor): Promise<LeaveLedgerEntry[]> {
    return this.ledgerRows((await this.myEmployee(this.database, actor)).id);
  }

  async attachment(actor: Actor, id: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    const access = await this.access(actor);
    const mine = await this.myEmployee(this.database, actor).catch(() => null);
    const row = (
      await this.database.execute<{ attachment_key: string | null; attachment_name: string | null; attachment_type: string | null }>(sql`
      SELECT r.attachment_key, r.attachment_name, r.attachment_type FROM hr.leave_requests r JOIN hr.employees e ON e.id = r.employee_id
      WHERE r.id = ${id} AND r.company_id = ${actor.companyId} AND (${mine ? sql`r.employee_id = ${mine.id} OR ` : sql``}${employeeScope(access, this.days.today())})`)
    ).rows[0];
    if (!row?.attachment_key) throw new ApiError("NOT_FOUND", "notFound");
    await this.auditService.record({ ...hrAudit(actor, "leave_request"), action: "leave_request.download", entityId: id });
    return { fileName: row.attachment_name!, contentType: row.attachment_type!, content: await this.storage.get(row.attachment_key) };
  }

  // Khi chốt bảng công tháng: tháng có ngày công hưởng lương dưới 50% công chuẩn thì trừ lại phần phép đã cộng (Nghị định 145 Điều 66 khoản 2).
  // Nghỉ hưởng bảo hiểm xã hội được coi là thời gian làm việc (Điều 65); nghỉ không lương không tính.
  async reverseShortMonths(transaction: Transaction, companyId: string, month: string): Promise<number> {
    const inserted = await transaction.execute(sql`
      INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, accrual_month, reason)
      SELECT l.company_id, l.employee_id, l.leave_year, 'month_reversal', -l.days, l.accrual_month, 'Tháng có ngày công hưởng lương dưới 50% công chuẩn'
      FROM hr.leave_ledger l
      JOIN LATERAL (
        SELECT sum(d.planned_units) AS standard,
          sum(d.worked_units + CASE WHEN d.day_kind = 'holiday' THEN d.planned_units ELSE 0 END + CASE WHEN d.leave_pay_group <> 'unpaid' THEN d.leave_units ELSE 0 END) AS paid
        FROM hr.attendance_days d WHERE d.employee_id = l.employee_id AND date_trunc('month', d.work_date) = ${`${month}-01`}::date
      ) totals ON true
      WHERE l.company_id = ${companyId} AND l.kind = 'accrual' AND l.accrual_month = ${`${month}-01`}::date AND totals.standard > 0 AND totals.paid * 2 < totals.standard
      ON CONFLICT DO NOTHING RETURNING id`);
    return inserted.rows.length;
  }

  // Mở lại bảng công: bỏ phần trừ của tháng để tính lại khi chốt lần sau (dòng do hệ thống sinh, tính lại được từ công ngày).
  async undoMonthReversal(transaction: Transaction, companyId: string, month: string): Promise<void> {
    await transaction.execute(sql`DELETE FROM hr.leave_ledger WHERE company_id = ${companyId} AND kind = 'month_reversal' AND accrual_month = ${`${month}-01`}::date`);
  }
}
