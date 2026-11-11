// Ca dự kiến và công từng ngày (CONG_VIEC_47; QUYTAC_NGHIEPVU_303, 305): xác định ca dự kiến theo thứ tự xếp ca → lịch nhân viên → lịch phòng ban → lịch mặc định,
// tính lại hr.attendance_days từ lượt chấm. Việc nền `hr-attendance-recalculate` tính lại ngày hôm trước lúc 1 giờ.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { addDays, assignPunches, calculateDay, weekdayIndex, type DayLeave, type LeavePayGroup, type PlannedDay, type ShiftDefinition } from "./attendance-calculator";

type Executor = Pick<Database, "execute">;

export const weekdayColumns = ["monday_shift_id", "tuesday_shift_id", "wednesday_shift_id", "thursday_shift_id", "friday_shift_id", "saturday_shift_id", "sunday_shift_id"] as const;

type ShiftRow = { id: string; code: string; start_time: string; end_time: string; break_start: string | null; break_minutes: number; break_paid: boolean; work_units: string };
type ScheduleRow = { id: string } & Record<(typeof weekdayColumns)[number], string | null>;

export const toShift = (row: ShiftRow): ShiftDefinition => ({
  id: row.id,
  code: row.code,
  startTime: row.start_time,
  endTime: row.end_time,
  breakStart: row.break_start,
  breakMinutes: row.break_minutes,
  breakPaid: row.break_paid,
  workUnits: Number(row.work_units),
});

export type EmployeeCalendar = {
  employeeId: string;
  companyId: string;
  hireDate: string;
  terminationDate: string | null;
  birthDate: string;
  days: PlannedDay[];
};

// Tháng (YYYY-MM) của các ngày; dùng kiểm kỳ bảng công đã chốt.
const monthsOf = (dates: string[]) => [...new Set(dates.map((date) => date.slice(0, 7)))];

// Kỳ bảng công đã chốt thì không ghi dữ liệu thuộc tháng đó (QUYTAC_NGHIEPVU_311).
export async function assertMonthsOpen(executor: Executor, companyId: string, dates: string[]): Promise<void> {
  const months = monthsOf(dates);
  if (months.length === 0) return;
  const closed = await executor.execute(sql`
    SELECT 1 FROM hr.timesheet_periods WHERE company_id = ${companyId} AND status = 'closed'
      AND (year::text || '-' || lpad(month::text, 2, '0')) IN (${sql.join(
        months.map((month) => sql`${month}`),
        sql`, `,
      )}) LIMIT 1`);
  if (closed.rows.length > 0) throw new ApiError("BUSINESS_RULE", "timesheetClosed");
}

async function closedMonths(executor: Executor, companyId: string): Promise<Set<string>> {
  const rows = await executor.execute<{ month: string }>(sql`
    SELECT year::text || '-' || lpad(month::text, 2, '0') AS month FROM hr.timesheet_periods WHERE company_id = ${companyId} AND status = 'closed'`);
  return new Set(rows.rows.map((row) => row.month));
}

export const datesBetween = (from: string, to: string): string[] => {
  const dates: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) dates.push(day);
  return dates;
};

@Injectable()
export class AttendanceDaysService {
  private readonly logger = new Logger("HrAttendance");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  today(): string {
    return vietnamDate(this.clock.now());
  }

  async shifts(executor: Executor, companyId: string): Promise<Map<string, ShiftDefinition>> {
    const rows = await executor.execute<ShiftRow>(sql`
      SELECT id, code, start_time::text, end_time::text, break_start::text, break_minutes, break_paid, work_units::text FROM hr.shifts WHERE company_id = ${companyId}`);
    return new Map(rows.rows.map((row) => [row.id, toShift(row)]));
  }

  // Ca dự kiến của nhiều hồ sơ trong khoảng ngày (gồm cả ngày lễ, ngày nghỉ).
  async calendars(executor: Executor, companyId: string, employeeIds: string[], from: string, to: string): Promise<Map<string, EmployeeCalendar>> {
    const result = new Map<string, EmployeeCalendar>();
    if (employeeIds.length === 0) return result;
    const ids = sql.join(
      employeeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    );
    const shifts = await this.shifts(executor, companyId);
    const employees = await executor.execute<{ id: string; hire_date: string; termination_date: string | null; birth_date: string; nationality: string }>(sql`
      SELECT id, hire_date::text, termination_date::text, birth_date::text, nationality FROM hr.employees WHERE company_id = ${companyId} AND id IN (${ids})`);
    const schedules = new Map(
      (
        await executor.execute<ScheduleRow & { is_default: boolean }>(sql`
        SELECT id, is_default, ${sql.raw(weekdayColumns.join(", "))} FROM hr.work_schedules WHERE company_id = ${companyId}`)
      ).rows.map((row) => [row.id, row]),
    );
    const defaultSchedule = [...schedules.values()].find((row) => row.is_default) ?? null;
    const assignments = (
      await executor.execute<{ schedule_id: string; department_id: string | null; employee_id: string | null; effective_from: string }>(sql`
      SELECT schedule_id, department_id, employee_id, effective_from::text FROM hr.work_schedule_assignments
      WHERE company_id = ${companyId} AND effective_from <= ${to}::date ORDER BY effective_from DESC`)
    ).rows;
    const departments = (
      await executor.execute<{ employee_id: string; department_id: string; effective_date: string }>(sql`
      SELECT employee_id, department_id, effective_date::text FROM hr.work_events
      WHERE employee_id IN (${ids}) AND department_id IS NOT NULL AND effective_date <= ${to}::date ORDER BY effective_date DESC`)
    ).rows;
    const daily = (
      await executor.execute<{ employee_id: string; work_date: string; shift_id: string | null }>(sql`
      SELECT employee_id, work_date::text, shift_id FROM hr.shift_assignments WHERE employee_id IN (${ids}) AND work_date BETWEEN ${from}::date AND ${to}::date`)
    ).rows;
    const dailyByKey = new Map(daily.map((row) => [`${row.employee_id}|${row.work_date}`, row.shift_id]));
    const holidays = (
      await executor.execute<{ holiday_date: string; foreigners_only: boolean }>(sql`
      SELECT holiday_date::text, foreigners_only FROM hr.holidays
      WHERE (company_id IS NULL OR company_id = ${companyId}) AND holiday_date BETWEEN ${from}::date AND ${to}::date`)
    ).rows;

    // Nghỉ theo đơn đã duyệt (QUYTAC_NGHIEPVU_309).
    const leaves = (
      await executor.execute<{ employee_id: string; leave_date: string; half: string; pay_group: LeavePayGroup; leave_type_id: string }>(sql`
      SELECT d.employee_id, d.leave_date::text, d.half, t.pay_group, r.leave_type_id
      FROM hr.leave_request_days d JOIN hr.leave_requests r ON r.id = d.leave_request_id JOIN hr.leave_types t ON t.id = r.leave_type_id
      WHERE d.employee_id IN (${ids}) AND r.status = 'approved' AND d.leave_date BETWEEN ${from}::date AND ${to}::date`)
    ).rows;
    // Hai đơn nửa ngày cùng ngày (sáng, chiều) thành nghỉ cả ngày; nhóm lương lấy theo đơn đầu (bảng công tính số ngày theo từng đơn).
    const leaveByKey = new Map<string, DayLeave>();
    for (const row of leaves) {
      const key = `${row.employee_id}|${row.leave_date}`;
      const existing = leaveByKey.get(key);
      leaveByKey.set(key, existing ? { ...existing, portion: 1 } : { portion: row.half === "full" ? 1 : 0.5, payGroup: row.pay_group, typeId: row.leave_type_id });
    }

    for (const employee of employees.rows) {
      const foreigner = employee.nationality !== "VN";
      const holidayDates = new Set(holidays.filter((row) => !row.foreigners_only || foreigner).map((row) => row.holiday_date));
      const days: PlannedDay[] = datesBetween(from, to).map((date) => {
        const key = `${employee.id}|${date}`;
        let shiftId: string | null;
        if (dailyByKey.has(key)) shiftId = dailyByKey.get(key) ?? null;
        else {
          const department = departments.find((row) => row.employee_id === employee.id && row.effective_date <= date)?.department_id;
          const assignment =
            assignments.find((row) => row.employee_id === employee.id && row.effective_from <= date) ??
            (department ? assignments.find((row) => row.department_id === department && row.effective_from <= date) : undefined);
          const schedule = assignment ? schedules.get(assignment.schedule_id) : defaultSchedule;
          shiftId = schedule ? schedule[weekdayColumns[weekdayIndex(date)]!] : null;
        }
        return { date, shift: shiftId ? (shifts.get(shiftId) ?? null) : null, holiday: holidayDates.has(date), leave: leaveByKey.get(key) ?? null };
      });
      result.set(employee.id, {
        employeeId: employee.id,
        companyId,
        hireDate: employee.hire_date,
        terminationDate: employee.termination_date,
        birthDate: employee.birth_date,
        days,
      });
    }
    return result;
  }

  private async graceMinutes(executor: Executor, companyId: string): Promise<number> {
    const row = (await executor.execute<{ grace_minutes: number }>(sql`SELECT grace_minutes FROM hr.attendance_settings WHERE company_id = ${companyId}`)).rows[0];
    return row?.grace_minutes ?? 5;
  }

  // Tính lại công các ngày [from, to] của các hồ sơ; bỏ qua ngày sau hôm nay, ngoài khoảng làm việc, thuộc kỳ đã chốt.
  async recalculate(executor: Executor, companyId: string, employeeIds: string[], from: string, to: string): Promise<void> {
    const today = this.today();
    const last = to > today ? today : to;
    if (employeeIds.length === 0 || from > last) return;
    const now = this.clock.now();
    const closed = await closedMonths(executor, companyId);
    const grace = await this.graceMinutes(executor, companyId);
    // Lấy thêm một ngày hai đầu để chia lượt chấm của ca qua đêm đúng ngày.
    const calendars = await this.calendars(executor, companyId, employeeIds, addDays(from, -1), addDays(last, 1));
    const punches = await executor.execute<{ employee_id: string; punched_at: Date }>(sql`
      SELECT employee_id, punched_at FROM hr.attendance_punches
      WHERE employee_id IN (${sql.join(
        employeeIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}) AND deleted_at IS NULL
        AND punched_at >= ${addDays(from, -1)}::date - interval '7 hours' AND punched_at < ${addDays(last, 3)}::date - interval '7 hours'`);
    for (const calendar of calendars.values()) {
      const own = punches.rows.filter((row) => row.employee_id === calendar.employeeId).map((row) => new Date(row.punched_at));
      const byDay = assignPunches(calendar.days, own);
      const end = calendar.terminationDate && calendar.terminationDate < last ? calendar.terminationDate : last;
      for (const day of calendar.days) {
        if (day.date < from || day.date > end || day.date < calendar.hireDate || closed.has(day.date.slice(0, 7))) continue;
        const result = calculateDay(day, byDay.get(day.date) ?? [], grace, now);
        await executor.execute(sql`
          INSERT INTO hr.attendance_days (company_id, employee_id, work_date, day_kind, shift_id, shift_code, planned_start, planned_end, standard_minutes, planned_units,
            first_in, last_out, punch_count, worked_minutes, night_minutes, late_minutes, early_minutes, worked_units, absent_units, leave_units, leave_pay_group, leave_type_id, status, calculated_at)
          VALUES (${companyId}, ${calendar.employeeId}, ${result.workDate}::date, ${result.dayKind}, ${result.shiftId}, ${result.shiftCode},
            ${result.plannedStart?.toISOString() ?? null}::timestamptz, ${result.plannedEnd?.toISOString() ?? null}::timestamptz, ${result.standardMinutes}, ${result.plannedUnits},
            ${result.firstIn?.toISOString() ?? null}::timestamptz, ${result.lastOut?.toISOString() ?? null}::timestamptz, ${result.punchCount}, ${result.workedMinutes},
            ${result.nightMinutes}, ${result.lateMinutes}, ${result.earlyMinutes}, ${result.workedUnits}, ${result.absentUnits}, ${result.leaveUnits}, ${result.leavePayGroup}, ${result.leaveTypeId}, ${result.status}, now())
          ON CONFLICT (employee_id, work_date) DO UPDATE SET day_kind = EXCLUDED.day_kind, shift_id = EXCLUDED.shift_id, shift_code = EXCLUDED.shift_code,
            planned_start = EXCLUDED.planned_start, planned_end = EXCLUDED.planned_end, standard_minutes = EXCLUDED.standard_minutes, planned_units = EXCLUDED.planned_units,
            first_in = EXCLUDED.first_in, last_out = EXCLUDED.last_out, punch_count = EXCLUDED.punch_count, worked_minutes = EXCLUDED.worked_minutes,
            night_minutes = EXCLUDED.night_minutes, late_minutes = EXCLUDED.late_minutes, early_minutes = EXCLUDED.early_minutes, worked_units = EXCLUDED.worked_units,
            absent_units = EXCLUDED.absent_units, leave_units = EXCLUDED.leave_units, leave_pay_group = EXCLUDED.leave_pay_group, leave_type_id = EXCLUDED.leave_type_id,
            status = EXCLUDED.status, calculated_at = now()`);
      }
    }
  }

  // Hồ sơ có khoảng làm việc giao [from, to].
  async employeesInRange(executor: Executor, companyId: string, from: string, to: string): Promise<string[]> {
    const rows = await executor.execute<{ id: string }>(sql`
      SELECT id FROM hr.employees WHERE company_id = ${companyId} AND hire_date <= ${to}::date AND (termination_date IS NULL OR termination_date >= ${from}::date)`);
    return rows.rows.map((row) => row.id);
  }

  // Thay đổi cài đặt, ca, lịch, ngày lễ: tính lại cả công ty từ ngày ảnh hưởng (không sớm hơn đầu tháng trước) đến hôm nay.
  async recalculateCompany(executor: Executor, companyId: string, from: string): Promise<void> {
    const today = this.today();
    const floor = `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
    const start = from < floor ? floor : from;
    if (start > today) return;
    await this.recalculate(executor, companyId, await this.employeesInRange(executor, companyId, start, today), start, today);
  }

  // Việc nền: tính lại ngày hôm trước và hôm nay cho mọi công ty có cài đặt hoặc ca làm.
  async recalculateRecent(): Promise<number> {
    const today = this.today();
    const yesterday = addDays(today, -1);
    const companies = await this.database.execute<{ company_id: string }>(sql`SELECT DISTINCT company_id FROM hr.shifts`);
    for (const { company_id: companyId } of companies.rows) {
      try {
        await this.database.transaction(async (transaction) => {
          await this.recalculate(transaction, companyId, await this.employeesInRange(transaction, companyId, yesterday, today), yesterday, today);
        });
      } catch (error) {
        this.logger.error(`Tính lại công công ty ${companyId} lỗi: ${(error as Error).message}`);
      }
    }
    return companies.rows.length;
  }
}
