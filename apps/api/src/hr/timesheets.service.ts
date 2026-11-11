// Bảng công tháng (CONG_VIEC_47; CHUC_NANG_167; QUYTAC_NGHIEPVU_311; API_155): tổng hợp dòng từ công ngày, người lao động xác nhận hoặc giải trình,
// nhân sự chốt (đóng băng, khóa dữ liệu tháng), mở lại khi bảng lương chưa chốt; đầu vào CONG_VIEC_48 (đọc dòng của kỳ đã chốt).
import { Inject, Injectable } from "@nestjs/common";
import type { MyTimesheetResponse, TimesheetLineItem, TimesheetResponse, TimesheetStatus } from "contracts";
import { sql } from "drizzle-orm";
import writeXlsxFile from "write-excel-file/node";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { recordEvent } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { addDays } from "./attendance-calculator";
import { attendanceAccess, attendancePermission, employeeScope, requireAttendanceView, type AttendanceAccess } from "./attendance-access";
import { AttendanceDaysService } from "./attendance-days.service";
import { hrAudit } from "./hr-context";
import { LeaveService } from "./leave.service";

type Transaction = Pick<Database, "execute" | "insert">;
type PeriodRow = { id: string; status: TimesheetStatus; confirmation_deadline: string | null; closed_at: Date | null; payroll_locked_at: Date | null; version: number };

const lastDayOfMonth = (month: string) => addDays(`${addDays(`${month}-28`, 4).slice(0, 7)}-01`, -1);
const fixed = (value: number) => (Math.round(value * 100) / 100).toFixed(2);

// Các cột số của dòng (tên cột, khóa trả về); dùng chung để so thay đổi, trả về và xuất Excel.
const numericColumns = [
  ["month_standard_units", "monthStandardUnits"],
  ["standard_units", "standardUnits"],
  ["standard_hours", "standardHours"],
  ["worked_units", "workedUnits"],
  ["worked_hours", "workedHours"],
  ["holiday_units", "holidayUnits"],
  ["annual_leave_units", "annualLeaveUnits"],
  ["paid_personal_leave_units", "paidPersonalLeaveUnits"],
  ["other_paid_leave_units", "otherPaidLeaveUnits"],
  ["unpaid_leave_units", "unpaidLeaveUnits"],
  ["social_insurance_leave_units", "socialInsuranceLeaveUnits"],
  ["absent_units", "absentUnits"],
  ["paid_units", "paidUnits"],
  ["night_hours", "nightHours"],
  ["overtime_weekday_hours", "overtimeWeekdayHours"],
  ["overtime_weekday_night_hours", "overtimeWeekdayNightHours"],
  ["overtime_weekday_night_after_day_hours", "overtimeWeekdayNightAfterDayHours"],
  ["overtime_rest_day_hours", "overtimeRestDayHours"],
  ["overtime_rest_day_night_hours", "overtimeRestDayNightHours"],
  ["overtime_holiday_hours", "overtimeHolidayHours"],
  ["overtime_holiday_night_hours", "overtimeHolidayNightHours"],
  ["annual_leave_payout_units", "annualLeavePayoutUnits"],
  ["annual_leave_balance_end", "annualLeaveBalanceEnd"],
] as const;
const integerColumns = [
  ["late_count", "lateCount"],
  ["late_minutes", "lateMinutes"],
  ["early_leave_count", "earlyLeaveCount"],
  ["early_leave_minutes", "earlyLeaveMinutes"],
] as const;
type Computed = Record<(typeof numericColumns)[number][0], string> & Record<(typeof integerColumns)[number][0], number>;

@Injectable()
export class TimesheetsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly days: AttendanceDaysService,
    private readonly leave: LeaveService,
  ) {}

  private access(actor: Actor): Promise<AttendanceAccess> {
    return attendanceAccess(this.permissionService, this.database, actor);
  }

  private requireManage(access: AttendanceAccess): void {
    if (!access.granted.has(attendancePermission.timesheet)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  private async period(executor: Pick<Database, "execute">, companyId: string, month: string, lock = false): Promise<PeriodRow> {
    const year = Number(month.slice(0, 4));
    const number = Number(month.slice(5, 7));
    await executor.execute(sql`INSERT INTO hr.timesheet_periods (company_id, year, month) VALUES (${companyId}, ${year}, ${number}) ON CONFLICT DO NOTHING`);
    return (
      await executor.execute<PeriodRow>(sql`
      SELECT id, status, confirmation_deadline::text, closed_at, payroll_locked_at, version FROM hr.timesheet_periods
      WHERE company_id = ${companyId} AND year = ${year} AND month = ${number}${lock ? sql` FOR UPDATE` : sql``}`)
    ).rows[0]!;
  }

  // Tính dòng cho mọi hồ sơ có khoảng làm việc giao tháng; dòng đổi sau khi đã xác nhận thì về chờ xác nhận và thông báo lại.
  private async refresh(transaction: Transaction, companyId: string, month: string, period: PeriodRow): Promise<void> {
    if (period.status === "closed") return;
    const from = `${month}-01`;
    const to = lastDayOfMonth(month);
    const employees = await transaction.execute<{ id: string; hire_date: string; termination_date: string | null; user_id: string | null }>(sql`
      SELECT id, hire_date::text, termination_date::text, user_id FROM hr.employees
      WHERE company_id = ${companyId} AND hire_date <= ${to}::date AND (termination_date IS NULL OR termination_date >= ${from}::date)`);
    if (employees.rows.length === 0) return;
    const ids = employees.rows.map((row) => row.id);
    const calendars = await this.days.calendars(transaction, companyId, ids, from, to);
    const balances = await this.leaveBalances(transaction, ids);
    for (const employee of employees.rows) {
      const employmentFrom = employee.hire_date > from ? employee.hire_date : from;
      const employmentTo = employee.termination_date && employee.termination_date < to ? employee.termination_date : to;
      const planned = calendars.get(employee.id)!.days;
      const units = (days: typeof planned) => days.reduce((total, day) => total + (day.shift ? day.shift.workUnits : 0), 0);
      const inRange = planned.filter((day) => day.date >= employmentFrom && day.date <= employmentTo);
      const standardMinutes = inRange.filter((day) => day.shift && !day.holiday).reduce((total, day) => total + this.standardOf(day.shift!), 0);
      const sums = (
        await transaction.execute<Record<string, string>>(sql`
        SELECT COALESCE(sum(worked_units), 0)::text AS worked_units, COALESCE(sum(worked_minutes), 0)::text AS worked_minutes,
          COALESCE(sum(planned_units) FILTER (WHERE day_kind = 'holiday'), 0)::text AS holiday_units, COALESCE(sum(absent_units), 0)::text AS absent_units,
          COALESCE(sum(night_minutes), 0)::text AS night_minutes,
          COALESCE(sum(overtime_day_minutes) FILTER (WHERE overtime_kind = 'weekday'), 0)::text AS weekday_day,
          COALESCE(sum(overtime_night_minutes) FILTER (WHERE overtime_kind = 'weekday'), 0)::text AS weekday_night,
          COALESCE(sum(overtime_night_after_day_minutes) FILTER (WHERE overtime_kind = 'weekday'), 0)::text AS weekday_night_after_day,
          COALESCE(sum(overtime_day_minutes) FILTER (WHERE overtime_kind = 'rest_day'), 0)::text AS rest_day,
          COALESCE(sum(overtime_night_minutes + overtime_night_after_day_minutes) FILTER (WHERE overtime_kind = 'rest_day'), 0)::text AS rest_night,
          COALESCE(sum(overtime_day_minutes) FILTER (WHERE overtime_kind = 'holiday'), 0)::text AS holiday_day,
          COALESCE(sum(overtime_night_minutes + overtime_night_after_day_minutes) FILTER (WHERE overtime_kind = 'holiday'), 0)::text AS holiday_night,
          count(*) FILTER (WHERE late_minutes > 0)::text AS late_count, COALESCE(sum(late_minutes), 0)::text AS late_minutes,
          count(*) FILTER (WHERE early_minutes > 0)::text AS early_count, COALESCE(sum(early_minutes), 0)::text AS early_minutes
        FROM hr.attendance_days WHERE employee_id = ${employee.id} AND work_date BETWEEN ${employmentFrom}::date AND ${employmentTo}::date`)
      ).rows[0]!;
      // Ngày nghỉ theo từng đơn đã duyệt (hai đơn nửa ngày cùng ngày tính đúng nhóm của mỗi đơn).
      const leaves = (
        await transaction.execute<{ pay_group: string; units: string }>(sql`
        SELECT t.pay_group, sum(d.units)::text AS units FROM hr.leave_request_days d JOIN hr.leave_requests r ON r.id = d.leave_request_id JOIN hr.leave_types t ON t.id = r.leave_type_id
        WHERE d.employee_id = ${employee.id} AND r.status = 'approved' AND d.leave_date BETWEEN ${employmentFrom}::date AND ${employmentTo}::date GROUP BY t.pay_group`)
      ).rows;
      const leaveOf = (group: string) => Number(leaves.find((row) => row.pay_group === group)?.units ?? 0);
      const hours = (key: string) => Number(sums[key]) / 60;
      const worked = Number(sums.worked_units);
      const holiday = Number(sums.holiday_units);
      const balance = balances.get(employee.id) ?? 0;
      const terminatedInMonth = employee.termination_date !== null && employee.termination_date <= to;
      const computed: Computed = {
        month_standard_units: fixed(units(planned)),
        standard_units: fixed(units(inRange)),
        standard_hours: fixed(standardMinutes / 60),
        worked_units: fixed(worked),
        worked_hours: fixed(hours("worked_minutes")),
        holiday_units: fixed(holiday),
        annual_leave_units: fixed(leaveOf("annual")),
        paid_personal_leave_units: fixed(leaveOf("paid_personal")),
        other_paid_leave_units: fixed(leaveOf("paid_other")),
        unpaid_leave_units: fixed(leaveOf("unpaid")),
        social_insurance_leave_units: fixed(leaveOf("social_insurance")),
        absent_units: fixed(Number(sums.absent_units)),
        paid_units: fixed(worked + holiday + leaveOf("annual") + leaveOf("paid_personal") + leaveOf("paid_other")),
        night_hours: fixed(hours("night_minutes")),
        overtime_weekday_hours: fixed(hours("weekday_day")),
        overtime_weekday_night_hours: fixed(hours("weekday_night")),
        overtime_weekday_night_after_day_hours: fixed(hours("weekday_night_after_day")),
        overtime_rest_day_hours: fixed(hours("rest_day")),
        overtime_rest_day_night_hours: fixed(hours("rest_night")),
        overtime_holiday_hours: fixed(hours("holiday_day")),
        overtime_holiday_night_hours: fixed(hours("holiday_night")),
        // Bộ luật Lao động Điều 113 khoản 3: nghỉ việc trong tháng thì thanh toán phép chưa nghỉ.
        annual_leave_payout_units: fixed(terminatedInMonth ? balance : 0),
        annual_leave_balance_end: fixed(balance),
        late_count: Number(sums.late_count),
        late_minutes: Number(sums.late_minutes),
        early_leave_count: Number(sums.early_count),
        early_leave_minutes: Number(sums.early_minutes),
      };
      const position = (
        await transaction.execute<{ department_id: string | null; branch_id: string | null }>(sql`
        SELECT (SELECT w.department_id FROM hr.work_events w WHERE w.employee_id = ${employee.id} AND w.department_id IS NOT NULL AND w.effective_date <= ${employmentTo}::date ORDER BY w.effective_date DESC LIMIT 1) AS department_id,
          (SELECT w.branch_id FROM hr.work_events w WHERE w.employee_id = ${employee.id} AND w.branch_id IS NOT NULL AND w.effective_date <= ${employmentTo}::date ORDER BY w.effective_date DESC LIMIT 1) AS branch_id`)
      ).rows[0]!;
      const existing = (
        await transaction.execute<Record<string, string | number> & { confirmation_status: string }>(sql`
        SELECT ${sql.raw([...numericColumns.map(([column]) => `${column}::text`), ...integerColumns.map(([column]) => column), "confirmation_status"].join(", "))}
        FROM hr.timesheet_lines WHERE period_id = ${period.id} AND employee_id = ${employee.id}`)
      ).rows[0];
      const changed = !existing || [...numericColumns, ...integerColumns].some(([column]) => String(existing[column]) !== String(computed[column]));
      if (!changed) continue;
      const resetConfirmation = existing && (existing.confirmation_status === "confirmed" || existing.confirmation_status === "auto_confirmed");
      const assignments = [...numericColumns, ...integerColumns].map(([column]) => sql`${sql.raw(column)} = ${computed[column]}`);
      if (existing) {
        await transaction.execute(sql`
          UPDATE hr.timesheet_lines SET ${sql.join(assignments, sql`, `)}, department_id = ${position.department_id}, branch_id = ${position.branch_id},
            employment_from = ${employmentFrom}::date, employment_to = ${employmentTo}::date,
            ${resetConfirmation ? sql`confirmation_status = 'pending', confirmed_at = NULL,` : sql``} updated_at = now()
          WHERE period_id = ${period.id} AND employee_id = ${employee.id}`);
        if (resetConfirmation && employee.user_id && period.status === "confirming") {
          await notify(transaction, [
            {
              userId: employee.user_id,
              companyId,
              kind: "hr.timesheet.changed",
              title: `Bảng công tháng ${month.slice(5)}/${month.slice(0, 4)} của bạn đã thay đổi, vui lòng xác nhận lại`,
              link: "/hr/my-attendance",
            },
          ]);
        }
      } else {
        await transaction.execute(sql`
          INSERT INTO hr.timesheet_lines (period_id, company_id, employee_id, department_id, branch_id, employment_from, employment_to,
            ${sql.raw([...numericColumns, ...integerColumns].map(([column]) => column).join(", "))})
          VALUES (${period.id}, ${companyId}, ${employee.id}, ${position.department_id}, ${position.branch_id}, ${employmentFrom}::date, ${employmentTo}::date,
            ${sql.join(
              [...numericColumns, ...integerColumns].map(([column]) => sql`${computed[column]}`),
              sql`, `,
            )})`);
      }
    }
  }

  private standardOf(shift: { startTime: string; endTime: string; breakMinutes: number; breakPaid: boolean }): number {
    const [startHours, startMinutes] = shift.startTime.split(":").map(Number) as [number, number];
    const [endHours, endMinutes] = shift.endTime.split(":").map(Number) as [number, number];
    let length = endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
    if (length <= 0) length += 24 * 60;
    return length - (shift.breakPaid ? 0 : shift.breakMinutes);
  }

  // Số dư phép năm còn hiệu lực (gồm số âm khi nghỉ trước).
  private async leaveBalances(executor: Pick<Database, "execute">, employeeIds: string[]): Promise<Map<string, number>> {
    const rows = await executor.execute<{ employee_id: string; balance: string }>(sql`
      SELECT employee_id, sum(days)::text AS balance FROM hr.leave_ledger WHERE employee_id IN (${sql.join(
        employeeIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) GROUP BY employee_id`);
    return new Map(rows.rows.map((row) => [row.employee_id, Number(row.balance)]));
  }

  private async lines(executor: Pick<Database, "execute">, periodId: string, scope: ReturnType<typeof employeeScope> | null, employeeId: string | null): Promise<TimesheetLineItem[]> {
    const rows = await executor.execute<Record<string, string | number | Date | null>>(sql`
      SELECT l.employee_id, e.code AS employee_code, e.full_name AS employee_name, d.name AS department_name, l.employment_from::text, l.employment_to::text,
        ${sql.raw([...numericColumns.map(([column]) => `l.${column}::text AS ${column}`), ...integerColumns.map(([column]) => `l.${column}`)].join(", "))},
        l.confirmation_status, l.confirmed_at, l.dispute_note, l.dispute_reply
      FROM hr.timesheet_lines l JOIN hr.employees e ON e.id = l.employee_id LEFT JOIN core.departments d ON d.id = l.department_id
      WHERE l.period_id = ${periodId}${scope ? sql` AND ${scope}` : sql``}${employeeId ? sql` AND l.employee_id = ${employeeId}` : sql``} ORDER BY e.full_name`);
    return rows.rows.map((row) => {
      const item: Record<string, unknown> = {
        employeeId: row.employee_id,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        departmentName: row.department_name,
        employmentFrom: row.employment_from,
        employmentTo: row.employment_to,
        confirmationStatus: row.confirmation_status,
        confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
        disputeNote: row.dispute_note,
        disputeReply: row.dispute_reply,
      };
      for (const [column, key] of numericColumns) item[key] = row[column];
      for (const [column, key] of integerColumns) item[key] = Number(row[column]);
      return item as unknown as TimesheetLineItem;
    });
  }

  async detail(actor: Actor, month: string): Promise<TimesheetResponse> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const period = await this.database.transaction(async (transaction) => {
      const row = await this.period(transaction, actor.companyId, month, true);
      await this.refresh(transaction, actor.companyId, month, row);
      return row;
    });
    const lines = await this.lines(this.database, period.id, employeeScope(access, this.days.today()), null);
    return {
      month,
      status: period.status,
      monthEnded: lastDayOfMonth(month) < this.days.today(),
      confirmationDeadline: period.confirmation_deadline,
      closedAt: period.closed_at ? new Date(period.closed_at).toISOString() : null,
      payrollLocked: period.payroll_locked_at !== null,
      counts: {
        total: lines.length,
        confirmed: lines.filter((line) => line.confirmationStatus === "confirmed" || line.confirmationStatus === "auto_confirmed").length,
        disputed: lines.filter((line) => line.confirmationStatus === "disputed").length,
        pending: lines.filter((line) => line.confirmationStatus === "pending").length,
      },
      canManage: access.granted.has(attendancePermission.timesheet),
      lines,
    };
  }

  // Mở xác nhận sau khi tháng kết thúc: tính lại công cả tháng, cập nhật dòng, thông báo người lao động.
  async openConfirmation(actor: Actor, month: string, deadline: string): Promise<TimesheetResponse> {
    this.requireManage(await this.access(actor));
    const today = this.days.today();
    if (lastDayOfMonth(month) >= today) throw new ApiError("BUSINESS_RULE", "timesheetMonthNotEnded");
    if (deadline <= today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { deadline: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      const period = await this.period(transaction, actor.companyId, month, true);
      if (period.status === "closed") throw new ApiError("BUSINESS_RULE", "timesheetClosed");
      const from = `${month}-01`;
      const to = lastDayOfMonth(month);
      await this.days.recalculate(transaction, actor.companyId, await this.days.employeesInRange(transaction, actor.companyId, from, to), from, to);
      await transaction.execute(
        sql`UPDATE hr.timesheet_periods SET status = 'confirming', confirmation_deadline = ${deadline}::date, updated_at = now(), version = version + 1 WHERE id = ${period.id}`,
      );
      await this.refresh(transaction, actor.companyId, month, { ...period, status: "confirming" });
      const users = await transaction.execute<{ user_id: string }>(sql`
        SELECT e.user_id FROM hr.timesheet_lines l JOIN hr.employees e ON e.id = l.employee_id WHERE l.period_id = ${period.id} AND e.user_id IS NOT NULL`);
      await notify(
        transaction,
        users.rows.map((row) => ({
          userId: row.user_id,
          companyId: actor.companyId,
          kind: "hr.timesheet.confirm",
          title: `Bảng công tháng ${month.slice(5)}/${month.slice(0, 4)}: xác nhận hoặc giải trình đến hết ngày ${deadline.split("-").reverse().join("/")}`,
          link: "/hr/my-attendance",
        })),
      );
      await this.auditService.record(
        { ...hrAudit(actor, "timesheet"), action: "timesheet.open_confirmation", entityId: period.id, beforeData: { status: period.status }, afterData: { deadline } },
        transaction,
      );
    });
    return this.detail(actor, month);
  }

  async reply(actor: Actor, month: string, employeeId: string, reply: string): Promise<TimesheetResponse> {
    this.requireManage(await this.access(actor));
    await this.database.transaction(async (transaction) => {
      const period = await this.period(transaction, actor.companyId, month, true);
      const line = (
        await transaction.execute<{ user_id: string | null }>(sql`
        UPDATE hr.timesheet_lines l SET dispute_reply = ${reply}, confirmation_status = 'pending', updated_at = now() FROM hr.employees e
        WHERE l.period_id = ${period.id} AND l.employee_id = ${employeeId} AND l.confirmation_status = 'disputed' AND e.id = l.employee_id RETURNING e.user_id`)
      ).rows[0];
      if (!line) throw new ApiError("BUSINESS_RULE", "timesheetNotDisputed");
      if (line.user_id) {
        await notify(transaction, [
          {
            userId: line.user_id,
            companyId: actor.companyId,
            kind: "hr.timesheet.reply",
            title: `Nhân sự đã trả lời giải trình bảng công tháng ${month.slice(5)}/${month.slice(0, 4)}`,
            link: "/hr/my-attendance",
          },
        ]);
      }
      await this.auditService.record({ ...hrAudit(actor, "timesheet"), action: "timesheet.reply", entityId: period.id, beforeData: null, afterData: { employeeId, reply } }, transaction);
    });
    return this.detail(actor, month);
  }

  // Chốt: không còn giải trình chưa trả lời; đóng băng dòng; trừ phép tháng dưới 50%; ghi thanh toán phép người nghỉ việc; sự kiện cho CONG_VIEC_48.
  async close(actor: Actor, month: string): Promise<TimesheetResponse> {
    this.requireManage(await this.access(actor));
    if (lastDayOfMonth(month) >= this.days.today()) throw new ApiError("BUSINESS_RULE", "timesheetMonthNotEnded");
    await this.database.transaction(async (transaction) => {
      const period = await this.period(transaction, actor.companyId, month, true);
      if (period.status === "closed") throw new ApiError("BUSINESS_RULE", "timesheetClosed");
      await this.refresh(transaction, actor.companyId, month, period);
      const disputed = await transaction.execute(sql`SELECT 1 FROM hr.timesheet_lines WHERE period_id = ${period.id} AND confirmation_status = 'disputed' LIMIT 1`);
      if (disputed.rows.length > 0) throw new ApiError("BUSINESS_RULE", "timesheetHasDisputes");
      await transaction.execute(sql`
        UPDATE hr.timesheet_periods SET status = 'closed', closed_at = now(), closed_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${period.id}`);
      const reversed = await this.leave.reverseShortMonths(transaction, actor.companyId, month);
      await transaction.execute(sql`
        INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, reason, created_by)
        SELECT l.company_id, l.employee_id, ${Number(month.slice(0, 4))}, 'payout', -l.annual_leave_payout_units, ${`Bảng công ${month}`}, ${actor.userId}
        FROM hr.timesheet_lines l WHERE l.period_id = ${period.id} AND l.annual_leave_payout_units <> 0`);
      await recordEvent(transaction, "hr.timesheet.closed", "timesheet_period", period.id, actor.companyId, {
        periodId: period.id,
        companyId: actor.companyId,
        year: Number(month.slice(0, 4)),
        month: Number(month.slice(5, 7)),
      });
      await this.auditService.record({ ...hrAudit(actor, "timesheet"), action: "timesheet.close", entityId: period.id, beforeData: { status: period.status }, afterData: { reversed } }, transaction);
    });
    return this.detail(actor, month);
  }

  // Mở lại: chỉ khi bảng lương của kỳ chưa chốt (payroll_locked_at do CONG_VIEC_48 ghi).
  async reopen(actor: Actor, month: string, reason: string): Promise<TimesheetResponse> {
    this.requireManage(await this.access(actor));
    await this.database.transaction(async (transaction) => {
      const period = await this.period(transaction, actor.companyId, month, true);
      if (period.status !== "closed") throw new ApiError("BUSINESS_RULE", "timesheetNotClosed");
      if (period.payroll_locked_at) throw new ApiError("BUSINESS_RULE", "timesheetPayrollLocked");
      await transaction.execute(sql`
        UPDATE hr.timesheet_periods SET status = 'open', closed_at = NULL, closed_by = NULL, confirmation_deadline = NULL, updated_at = now(), version = version + 1 WHERE id = ${period.id}`);
      await this.leave.undoMonthReversal(transaction, actor.companyId, month);
      // Dòng thanh toán phép do lần chốt sinh ra, tính lại khi chốt lần sau.
      await transaction.execute(sql`DELETE FROM hr.leave_ledger WHERE company_id = ${actor.companyId} AND kind = 'payout' AND reason = ${`Bảng công ${month}`}`);
      await recordEvent(transaction, "hr.timesheet.reopened", "timesheet_period", period.id, actor.companyId, {
        periodId: period.id,
        companyId: actor.companyId,
        year: Number(month.slice(0, 4)),
        month: Number(month.slice(5, 7)),
      });
      await this.auditService.record({ ...hrAudit(actor, "timesheet"), action: "timesheet.reopen", entityId: period.id, beforeData: { status: "closed" }, afterData: { reason } }, transaction);
    });
    return this.detail(actor, month);
  }

  async export(actor: Actor, month: string): Promise<Buffer> {
    const detail = await this.detail(actor, month);
    const header = ["Mã", "Họ tên", "Phòng ban", "Từ ngày", "Đến ngày", ...numericColumns.map(([column]) => column), ...integerColumns.map(([column]) => column), "Xác nhận"];
    const rows = detail.lines.map((line) => [
      line.employeeCode,
      line.employeeName,
      line.departmentName ?? "",
      line.employmentFrom,
      line.employmentTo,
      ...numericColumns.map(([, key]) => Number(line[key])),
      ...integerColumns.map(([, key]) => line[key]),
      line.confirmationStatus,
    ]);
    await this.auditService.record({ ...hrAudit(actor, "timesheet"), action: "timesheet.export", entityId: actor.companyId, afterData: { month } });
    return writeXlsxFile([header.map((value) => ({ value, fontWeight: "bold" as const })), ...rows.map((row) => row.map((value) => ({ value })))], { sheet: `Bang cong ${month}` }).toBuffer();
  }

  // ---- Của tôi ----

  private async myEmployeeId(actor: Actor): Promise<string> {
    const row = (await this.database.execute<{ id: string }>(sql`SELECT id FROM hr.employees WHERE company_id = ${actor.companyId} AND user_id = ${actor.userId}`)).rows[0];
    if (!row) throw new ApiError("FORBIDDEN", "noLinkedEmployee");
    return row.id;
  }

  async mine(actor: Actor, month: string): Promise<MyTimesheetResponse> {
    const employeeId = await this.myEmployeeId(actor);
    const period = (
      await this.database.execute<PeriodRow>(sql`
      SELECT id, status, confirmation_deadline::text, closed_at, payroll_locked_at, version FROM hr.timesheet_periods
      WHERE company_id = ${actor.companyId} AND year = ${Number(month.slice(0, 4))} AND month = ${Number(month.slice(5, 7))}`)
    ).rows[0];
    if (!period || period.status === "open") return { month, status: period?.status ?? null, confirmationDeadline: null, line: null };
    if (period.status === "confirming") await this.database.transaction((transaction) => this.refresh(transaction, actor.companyId, month, period));
    return { month, status: period.status, confirmationDeadline: period.confirmation_deadline, line: (await this.lines(this.database, period.id, null, employeeId))[0] ?? null };
  }

  async respond(actor: Actor, month: string, decision: { confirm: true } | { note: string }): Promise<MyTimesheetResponse> {
    const employeeId = await this.myEmployeeId(actor);
    await this.database.transaction(async (transaction) => {
      const period = (
        await transaction.execute<PeriodRow>(sql`
        SELECT id, status FROM hr.timesheet_periods WHERE company_id = ${actor.companyId} AND year = ${Number(month.slice(0, 4))} AND month = ${Number(month.slice(5, 7))} FOR UPDATE`)
      ).rows[0];
      if (!period || period.status !== "confirming") throw new ApiError("BUSINESS_RULE", "timesheetNotConfirming");
      const updated =
        "confirm" in decision
          ? await transaction.execute(sql`
            UPDATE hr.timesheet_lines SET confirmation_status = 'confirmed', confirmed_at = now(), updated_at = now() WHERE period_id = ${period.id} AND employee_id = ${employeeId} RETURNING id`)
          : await transaction.execute(sql`
            UPDATE hr.timesheet_lines SET confirmation_status = 'disputed', dispute_note = ${decision.note}, dispute_reply = NULL, confirmed_at = NULL, updated_at = now()
            WHERE period_id = ${period.id} AND employee_id = ${employeeId} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await this.auditService.record(
        { ...hrAudit(actor, "timesheet"), action: "confirm" in decision ? "timesheet.confirm" : "timesheet.dispute", entityId: period.id, beforeData: null, afterData: decision },
        transaction,
      );
    });
    return this.mine(actor, month);
  }

  // Việc nền 0 giờ 30 phút: hết hạn xác nhận thì dòng chờ chuyển "Xác nhận do hết hạn".
  async autoConfirm(): Promise<number> {
    const result = await this.database.execute(sql`
      UPDATE hr.timesheet_lines l SET confirmation_status = 'auto_confirmed', confirmed_at = now(), updated_at = now() FROM hr.timesheet_periods p
      WHERE p.id = l.period_id AND p.status = 'confirming' AND p.confirmation_deadline < ${this.days.today()}::date AND l.confirmation_status = 'pending' RETURNING l.id`);
    return result.rows.length;
  }
}
