// Cài đặt chấm công, ca làm, lịch tuần, xếp ca, ngày lễ (CONG_VIEC_47; CHUC_NANG_165; QUYTAC_NGHIEPVU_302, 303; API_150).
import { Inject, Injectable } from "@nestjs/common";
import type {
  AttendanceSettingsResponse,
  HolidayItem,
  HolidayListResponse,
  RosterResponse,
  RosterRow,
  RosterWarning,
  ScheduleItem,
  ShiftItem,
  assignScheduleSchema,
  attendanceSettingsSchema,
  rosterQuerySchema,
  saveHolidaySchema,
  saveRosterSchema,
  saveScheduleSchema,
  saveShiftSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { addDays, breakInsideShift, nightMinutesOfShift, shiftInterval, standardMinutes, weekdayIndex, type ShiftDefinition } from "./attendance-calculator";
import { attendanceAccess, attendancePermission, employeeScope, requireAttendanceManage, requireAttendanceView } from "./attendance-access";
import { AttendanceDaysService, assertMonthsOpen, datesBetween, toShift, weekdayColumns } from "./attendance-days.service";
import { ageAt, hrAudit } from "./hr-context";

type Transaction = Pick<Database, "execute" | "insert">;
type SettingsInput = z.output<typeof attendanceSettingsSchema>;
type ShiftInput = z.output<typeof saveShiftSchema>;
type ScheduleInput = z.output<typeof saveScheduleSchema>;

const defaultSettings: Omit<AttendanceSettingsResponse, "version"> = {
  workingTimeMode: "daily",
  graceMinutes: 5,
  appLocationScope: "branch",
  carryoverMode: "expire",
  carryoverMonths: 3,
  allowAdvanceLeave: false,
  overtimeAnnualLimit: 200,
  overtimeExtendedReason: null,
  correctionMonthlyLimit: 0,
};

// Ngày lễ dương lịch cố định (Bộ luật Lao động Điều 112 khoản 1); Tết âm lịch, Giỗ Tổ, ngày liền kề Quốc khánh, nghỉ bù khai báo thêm hằng năm.
const fixedHolidays = [
  ["01-01", "Tết Dương lịch"],
  ["04-30", "Ngày Chiến thắng"],
  ["05-01", "Ngày Quốc tế lao động"],
  ["09-02", "Quốc khánh"],
] as const;

type ShiftRow = {
  id: string;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_minutes: number;
  break_paid: boolean;
  work_units: string;
  status: "active" | "inactive";
  version: number;
};

const hhmm = (value: string | null) => (value ? value.slice(0, 5) : null);
const maximumWeekMinutes = 48 * 60;
const minorWeekMinutes = 40 * 60;
const minorDayMinutes = 8 * 60;

export function shiftItem(row: ShiftRow): ShiftItem {
  const shift = toShift(row);
  const standard = standardMinutes(shift);
  const night = nightMinutesOfShift("2026-01-05", shift);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    startTime: hhmm(row.start_time)!,
    endTime: hhmm(row.end_time)!,
    breakStart: hhmm(row.break_start),
    breakMinutes: row.break_minutes,
    breakPaid: row.break_paid,
    workUnits: Number(row.work_units) === 1 ? "1" : "0.5",
    status: row.status,
    standardMinutes: standard,
    nightMinutes: night,
    // Bộ luật Lao động Điều 109; Nghị định 145 Điều 64: từ 6 giờ phải nghỉ ít nhất 30 phút, có từ 3 giờ ban đêm thì 45 phút.
    shortBreakWarning: standard >= 360 && row.break_minutes < (night >= 180 ? 45 : 30),
    version: row.version,
  };
}

@Injectable()
export class AttendanceSetupService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly days: AttendanceDaysService,
  ) {}

  private access(actor: Actor) {
    return attendanceAccess(this.permissionService, this.database, actor);
  }

  // Cài đặt; công ty chưa lưu thì trả giá trị mặc định.
  async settingsOf(executor: Pick<Database, "execute">, companyId: string): Promise<AttendanceSettingsResponse> {
    const row = (
      await executor.execute<{
        working_time_mode: "daily" | "weekly";
        grace_minutes: number;
        app_location_scope: "branch" | "company";
        carryover_mode: "expire" | "never";
        carryover_months: number;
        allow_advance_leave: boolean;
        overtime_annual_limit: 200 | 300;
        overtime_extended_reason: string | null;
        correction_monthly_limit: number;
        version: number;
      }>(sql`SELECT * FROM hr.attendance_settings WHERE company_id = ${companyId}`)
    ).rows[0];
    if (!row) return { ...defaultSettings, version: 0 };
    return {
      workingTimeMode: row.working_time_mode,
      graceMinutes: row.grace_minutes,
      appLocationScope: row.app_location_scope,
      carryoverMode: row.carryover_mode,
      carryoverMonths: row.carryover_months,
      allowAdvanceLeave: row.allow_advance_leave,
      overtimeAnnualLimit: row.overtime_annual_limit,
      overtimeExtendedReason: row.overtime_extended_reason,
      correctionMonthlyLimit: row.correction_monthly_limit,
      version: row.version,
    };
  }

  async settings(actor: Actor): Promise<AttendanceSettingsResponse> {
    requireAttendanceView(await this.access(actor));
    return this.settingsOf(this.database, actor.companyId);
  }

  async saveSettings(actor: Actor, input: SettingsInput): Promise<AttendanceSettingsResponse> {
    requireAttendanceManage(await this.access(actor));
    if (input.overtimeAnnualLimit === 300 && !input.overtimeExtendedReason) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { overtimeExtendedReason: "required" } });
    }
    await this.database.transaction(async (transaction) => {
      const before = await this.settingsOf(transaction, actor.companyId);
      if ((input.version ?? 0) !== before.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const reason = input.overtimeAnnualLimit === 300 ? input.overtimeExtendedReason : null;
      await transaction.execute(sql`
        INSERT INTO hr.attendance_settings (company_id, working_time_mode, grace_minutes, app_location_scope, carryover_mode, carryover_months, allow_advance_leave,
          overtime_annual_limit, overtime_extended_reason, correction_monthly_limit, updated_by)
        VALUES (${actor.companyId}, ${input.workingTimeMode}, ${input.graceMinutes}, ${input.appLocationScope}, ${input.carryoverMode}, ${input.carryoverMonths},
          ${input.allowAdvanceLeave}, ${input.overtimeAnnualLimit}, ${reason}, ${input.correctionMonthlyLimit}, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET working_time_mode = EXCLUDED.working_time_mode, grace_minutes = EXCLUDED.grace_minutes,
          app_location_scope = EXCLUDED.app_location_scope, carryover_mode = EXCLUDED.carryover_mode, carryover_months = EXCLUDED.carryover_months,
          allow_advance_leave = EXCLUDED.allow_advance_leave, overtime_annual_limit = EXCLUDED.overtime_annual_limit,
          overtime_extended_reason = EXCLUDED.overtime_extended_reason, correction_monthly_limit = EXCLUDED.correction_monthly_limit,
          updated_by = EXCLUDED.updated_by, updated_at = now(), version = hr.attendance_settings.version + 1`);
      await this.auditService.record({ ...hrAudit(actor, "attendance_settings"), action: "attendance_settings.update", entityId: actor.companyId, beforeData: before, afterData: input }, transaction);
      if (before.graceMinutes !== input.graceMinutes) await this.days.recalculateCompany(transaction, actor.companyId, "2000-01-01");
    });
    return this.settingsOf(this.database, actor.companyId);
  }

  // ---- Ca làm ----

  async shifts(actor: Actor): Promise<ShiftItem[]> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const rows = await this.database.execute<ShiftRow>(sql`
      SELECT id, code, name, start_time::text, end_time::text, break_start::text, break_minutes, break_paid, work_units::text, status, version
      FROM hr.shifts WHERE company_id = ${actor.companyId} ORDER BY status, code`);
    return rows.rows.map(shiftItem);
  }

  private async validateShift(executor: Pick<Database, "execute">, actor: Actor, input: ShiftInput, id: string | null): Promise<void> {
    const fields: Record<string, "required" | "invalidValue" | "shiftTooLong" | "breakOutsideShift" | "shiftCodeExists"> = {};
    const breakStart = input.breakMinutes > 0 ? (input.breakStart ?? null) : null;
    if (input.breakMinutes > 0 && !breakStart) fields.breakStart = "required";
    const definition: ShiftDefinition = {
      id: "",
      code: input.code,
      startTime: input.startTime,
      endTime: input.endTime,
      breakStart,
      breakMinutes: input.breakMinutes,
      breakPaid: input.breakPaid,
      workUnits: Number(input.workUnits),
    };
    const standard = standardMinutes(definition);
    const settings = await this.settingsOf(executor, actor.companyId);
    // Bộ luật Lao động Điều 105: không quá 8 giờ/ngày; quy định theo tuần thì không quá 10 giờ/ngày.
    if (standard <= 0) fields.endTime = "invalidValue";
    else if (standard > (settings.workingTimeMode === "weekly" ? 600 : 480)) fields.endTime = "shiftTooLong";
    if (breakStart && !breakInsideShift(definition)) fields.breakStart = "breakOutsideShift";
    const duplicate = await executor.execute(sql`
      SELECT 1 FROM hr.shifts WHERE company_id = ${actor.companyId} AND lower(code) = lower(${input.code})${id ? sql` AND id <> ${id}` : sql``}`);
    if (duplicate.rows.length > 0) fields.code = "shiftCodeExists";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  async createShift(actor: Actor, input: ShiftInput): Promise<ShiftItem> {
    requireAttendanceManage(await this.access(actor));
    const id = await this.database.transaction(async (transaction) => {
      await this.validateShift(transaction, actor, input, null);
      const breakStart = input.breakMinutes > 0 ? input.breakStart : null;
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.shifts (company_id, code, name, start_time, end_time, break_start, break_minutes, break_paid, work_units, status, created_by)
        VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.startTime}::time, ${input.endTime}::time, ${breakStart ?? null}::time, ${input.breakMinutes},
          ${input.breakPaid}, ${input.workUnits}::numeric, ${input.status ?? "active"}, ${actor.userId}) RETURNING id`);
      const shiftId = inserted.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "shift"), action: "shift.create", entityId: shiftId, beforeData: null, afterData: input }, transaction);
      return shiftId;
    });
    return (await this.shifts(actor)).find((shift) => shift.id === id)!;
  }

  async updateShift(actor: Actor, id: string, input: ShiftInput): Promise<ShiftItem> {
    requireAttendanceManage(await this.access(actor));
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.shifts WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (input.version !== before.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validateShift(transaction, actor, input, id);
      const breakStart = input.breakMinutes > 0 ? input.breakStart : null;
      await transaction.execute(sql`
        UPDATE hr.shifts SET code = ${input.code}, name = ${input.name}, start_time = ${input.startTime}::time, end_time = ${input.endTime}::time,
          break_start = ${breakStart ?? null}::time, break_minutes = ${input.breakMinutes}, break_paid = ${input.breakPaid}, work_units = ${input.workUnits}::numeric,
          status = ${input.status ?? "active"}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "shift"), action: "shift.update", entityId: id, beforeData: before, afterData: input }, transaction);
      // Ngày của kỳ đã chốt giữ kết quả cũ; còn lại tính theo ca mới.
      await this.days.recalculateCompany(transaction, actor.companyId, "2000-01-01");
    });
    return (await this.shifts(actor)).find((shift) => shift.id === id)!;
  }

  // ---- Lịch tuần ----

  async schedules(actor: Actor): Promise<ScheduleItem[]> {
    requireAttendanceView(await this.access(actor));
    const shifts = await this.days.shifts(this.database, actor.companyId);
    const rows = await this.database.execute<{ id: string; name: string; is_default: boolean; version: number } & Record<(typeof weekdayColumns)[number], string | null>>(sql`
      SELECT id, name, is_default, version, ${sql.raw(weekdayColumns.join(", "))} FROM hr.work_schedules WHERE company_id = ${actor.companyId} ORDER BY is_default DESC, name`);
    const assignments = await this.database.execute<{
      id: string;
      schedule_id: string;
      department_id: string | null;
      department_name: string | null;
      employee_id: string | null;
      employee_name: string | null;
      effective_from: string;
    }>(sql`
      SELECT a.id, a.schedule_id, a.department_id, d.name AS department_name, a.employee_id, e.full_name AS employee_name, a.effective_from::text
      FROM hr.work_schedule_assignments a LEFT JOIN core.departments d ON d.id = a.department_id LEFT JOIN hr.employees e ON e.id = a.employee_id
      WHERE a.company_id = ${actor.companyId} ORDER BY a.effective_from DESC`);
    return rows.rows.map((row) => {
      const shiftIds = weekdayColumns.map((column) => row[column]);
      return {
        id: row.id,
        name: row.name,
        isDefault: row.is_default,
        shiftIds,
        shiftCodes: shiftIds.map((shiftId) => (shiftId ? (shifts.get(shiftId)?.code ?? null) : null)),
        weeklyMinutes: shiftIds.reduce((total, shiftId) => total + (shiftId && shifts.get(shiftId) ? standardMinutes(shifts.get(shiftId)!) : 0), 0),
        assignments: assignments.rows
          .filter((assignment) => assignment.schedule_id === row.id)
          .map((assignment) => ({
            id: assignment.id,
            departmentId: assignment.department_id,
            departmentName: assignment.department_name,
            employeeId: assignment.employee_id,
            employeeName: assignment.employee_name,
            effectiveFrom: assignment.effective_from,
          })),
        version: row.version,
      };
    });
  }

  private async validateSchedule(executor: Pick<Database, "execute">, actor: Actor, input: ScheduleInput): Promise<void> {
    const shifts = await this.days.shifts(executor, actor.companyId);
    const active = new Set((await executor.execute<{ id: string }>(sql`SELECT id FROM hr.shifts WHERE company_id = ${actor.companyId} AND status = 'active'`)).rows.map((row) => row.id));
    const fields: Record<string, "invalidValue" | "scheduleWeekTooLong"> = {};
    input.shiftIds.forEach((shiftId, index) => {
      if (shiftId && !active.has(shiftId)) fields[`shiftIds.${index}`] = "invalidValue";
    });
    const total = input.shiftIds.reduce((sum, shiftId) => sum + (shiftId && shifts.get(shiftId) ? standardMinutes(shifts.get(shiftId)!) : 0), 0);
    // Bộ luật Lao động Điều 105: không quá 48 giờ trong 01 tuần.
    if (total > maximumWeekMinutes) fields.shiftIds = "scheduleWeekTooLong";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  async createSchedule(actor: Actor, input: ScheduleInput): Promise<ScheduleItem> {
    requireAttendanceManage(await this.access(actor));
    const id = await this.database.transaction(async (transaction) => {
      await this.validateSchedule(transaction, actor, input);
      const hasDefault = (await transaction.execute(sql`SELECT 1 FROM hr.work_schedules WHERE company_id = ${actor.companyId} AND is_default`)).rows.length > 0;
      const isDefault = input.isDefault || !hasDefault;
      if (isDefault) await transaction.execute(sql`UPDATE hr.work_schedules SET is_default = false, version = version + 1 WHERE company_id = ${actor.companyId} AND is_default`);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.work_schedules (company_id, name, is_default, ${sql.raw(weekdayColumns.join(", "))}, created_by)
        VALUES (${actor.companyId}, ${input.name}, ${isDefault}, ${sql.join(
          input.shiftIds.map((shiftId) => sql`${shiftId}::uuid`),
          sql`, `,
        )}, ${actor.userId}) RETURNING id`);
      const scheduleId = inserted.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "work_schedule"), action: "work_schedule.create", entityId: scheduleId, beforeData: null, afterData: input }, transaction);
      if (isDefault) await this.days.recalculateCompany(transaction, actor.companyId, "2000-01-01");
      return scheduleId;
    });
    return (await this.schedules(actor)).find((schedule) => schedule.id === id)!;
  }

  async updateSchedule(actor: Actor, id: string, input: ScheduleInput): Promise<ScheduleItem> {
    requireAttendanceManage(await this.access(actor));
    await this.database.transaction(async (transaction) => {
      const before = (
        await transaction.execute<{ version: number; is_default: boolean }>(sql`
        SELECT version, is_default FROM hr.work_schedules WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (input.version !== before.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validateSchedule(transaction, actor, input);
      // Luôn giữ đúng một lịch mặc định: bỏ chọn mặc định ở lịch đang mặc định thì không cho.
      const isDefault = input.isDefault || before.is_default;
      if (isDefault && !before.is_default) {
        await transaction.execute(sql`UPDATE hr.work_schedules SET is_default = false, version = version + 1 WHERE company_id = ${actor.companyId} AND is_default`);
      }
      await transaction.execute(sql`
        UPDATE hr.work_schedules SET name = ${input.name}, is_default = ${isDefault},
          ${sql.join(
            weekdayColumns.map((column, index) => sql`${sql.raw(column)} = ${input.shiftIds[index]}::uuid`),
            sql`, `,
          )}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "work_schedule"), action: "work_schedule.update", entityId: id, beforeData: before, afterData: input }, transaction);
      await this.days.recalculateCompany(transaction, actor.companyId, "2000-01-01");
    });
    return (await this.schedules(actor)).find((schedule) => schedule.id === id)!;
  }

  async assignSchedule(actor: Actor, scheduleId: string, input: z.output<typeof assignScheduleSchema>): Promise<ScheduleItem> {
    requireAttendanceManage(await this.access(actor));
    const departmentId = input.departmentId ?? null;
    const employeeId = input.employeeId ?? null;
    if ((departmentId === null) === (employeeId === null)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { departmentId: "required" } });
    await this.database.transaction(async (transaction) => {
      const schedule = await transaction.execute(sql`SELECT 1 FROM hr.work_schedules WHERE id = ${scheduleId} AND company_id = ${actor.companyId}`);
      if (schedule.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      const target = departmentId
        ? await transaction.execute(sql`SELECT 1 FROM core.departments WHERE id = ${departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)
        : await transaction.execute(sql`SELECT 1 FROM hr.employees WHERE id = ${employeeId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (target.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [departmentId ? "departmentId" : "employeeId"]: "invalidValue" } });
      await assertMonthsOpen(transaction, actor.companyId, [input.effectiveFrom]);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.work_schedule_assignments (company_id, schedule_id, department_id, employee_id, effective_from, created_by)
        VALUES (${actor.companyId}, ${scheduleId}, ${departmentId}, ${employeeId}, ${input.effectiveFrom}::date, ${actor.userId})
        ON CONFLICT DO NOTHING RETURNING id`);
      if (inserted.rows.length === 0) {
        // Cùng đối tượng, cùng ngày: thay lịch.
        await transaction.execute(sql`
          UPDATE hr.work_schedule_assignments SET schedule_id = ${scheduleId}, created_by = ${actor.userId}, created_at = now()
          WHERE company_id = ${actor.companyId} AND effective_from = ${input.effectiveFrom}::date
            AND ${departmentId ? sql`department_id = ${departmentId}` : sql`employee_id = ${employeeId}`}`);
      }
      await this.auditService.record({ ...hrAudit(actor, "work_schedule"), action: "work_schedule.assign", entityId: scheduleId, beforeData: null, afterData: input }, transaction);
      await this.days.recalculateCompany(transaction, actor.companyId, input.effectiveFrom);
    });
    return (await this.schedules(actor)).find((schedule) => schedule.id === scheduleId)!;
  }

  // ---- Xếp ca theo tuần ----

  async roster(actor: Actor, query: z.output<typeof rosterQuerySchema>): Promise<RosterResponse> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    if (weekdayIndex(query.weekStart) !== 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { weekStart: "invalidValue" } });
    const weekEnd = addDays(query.weekStart, 6);
    const dates = datesBetween(query.weekStart, weekEnd);
    const employees = await this.database.execute<{ id: string; code: string; full_name: string; department_name: string | null; birth_date: string }>(sql`
      SELECT e.id, e.code, e.full_name, d.name AS department_name, e.birth_date::text
      FROM hr.employees e
      CROSS JOIN LATERAL (SELECT ${this.positionSql(query.weekStart)}) position
      LEFT JOIN core.departments d ON d.id = position.department_id
      WHERE e.company_id = ${actor.companyId} AND e.hire_date <= ${weekEnd}::date AND (e.termination_date IS NULL OR e.termination_date >= ${query.weekStart}::date)
        AND ${employeeScope(access, query.weekStart)}
        ${query.departmentId ? sql`AND position.department_id = ${query.departmentId}` : sql``}
      ORDER BY e.full_name LIMIT 500`);
    const ids = employees.rows.map((row) => row.id);
    const calendars = await this.days.calendars(this.database, actor.companyId, ids, query.weekStart, addDays(weekEnd, 1));
    const roster = ids.length
      ? await this.database.execute<{ employee_id: string; work_date: string }>(sql`
        SELECT employee_id, work_date::text FROM hr.shift_assignments WHERE employee_id IN (${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}) AND work_date BETWEEN ${query.weekStart}::date AND ${weekEnd}::date`)
      : { rows: [] };
    const explicit = new Set(roster.rows.map((row) => `${row.employee_id}|${row.work_date}`));
    const closed = await this.closedMonthSet(actor.companyId);
    const shifts = await this.shifts(actor);
    const rows: RosterRow[] = employees.rows.map((employee) => {
      const days = calendars.get(employee.id)!.days;
      const isMinor = ageAt(employee.birth_date, query.weekStart) < 18;
      return {
        employeeId: employee.id,
        code: employee.code,
        fullName: employee.full_name,
        departmentName: employee.department_name,
        isMinor,
        cells: dates.map((date, index) => ({
          date,
          shiftId: days[index]!.shift?.id ?? null,
          fromRoster: explicit.has(`${employee.id}|${date}`),
          holiday: days[index]!.holiday,
          locked: closed.has(date.slice(0, 7)),
        })),
        ...this.weekCheck(days, isMinor),
      };
    });
    return { weekStart: query.weekStart, dates, shifts: shifts.filter((shift) => shift.status === "active"), rows, canEditAll: access.manage };
  }

  private positionSql(day: string) {
    return sql`(SELECT w.department_id FROM hr.work_events w WHERE w.employee_id = e.id AND w.department_id IS NOT NULL AND w.effective_date <= GREATEST(${day}::date, e.hire_date) ORDER BY w.effective_date DESC LIMIT 1) AS department_id`;
  }

  private async closedMonthSet(companyId: string): Promise<Set<string>> {
    const rows = await this.database.execute<{ month: string }>(sql`
      SELECT year::text || '-' || lpad(month::text, 2, '0') AS month FROM hr.timesheet_periods WHERE company_id = ${companyId} AND status = 'closed'`);
    return new Set(rows.rows.map((row) => row.month));
  }

  // Tổng giờ tuần, cảnh báo thiếu ngày nghỉ, nghỉ giữa hai ca dưới 12 giờ (Bộ luật Lao động Điều 105, 110, 111, 146). days gồm 7 ngày tuần và ngày đầu tuần sau.
  private weekCheck(days: { date: string; shift: ShiftDefinition | null; holiday: boolean }[], isMinor: boolean): { weeklyMinutes: number; warnings: RosterWarning[] } {
    const week = days.slice(0, 7);
    const working = week.filter((day) => day.shift && !day.holiday);
    const weeklyMinutes = working.reduce((total, day) => total + standardMinutes(day.shift!), 0);
    const warnings: RosterWarning[] = [];
    const tooLongDay = isMinor && working.some((day) => standardMinutes(day.shift!) > minorDayMinutes);
    if (weeklyMinutes > (isMinor ? minorWeekMinutes : maximumWeekMinutes) || tooLongDay) warnings.push("weeklyHoursExceeded");
    if (working.length === 7) warnings.push("noRestDay");
    for (let index = 0; index < days.length - 1; index += 1) {
      const current = days[index]!;
      const next = days[index + 1]!;
      if (!current.shift || !next.shift || current.holiday || next.holiday) continue;
      if (shiftInterval(next.date, next.shift)[0] - shiftInterval(current.date, current.shift)[1] < 12 * 3_600_000) {
        warnings.push("shortRestBetweenShifts");
        break;
      }
    }
    return { weeklyMinutes, warnings };
  }

  async saveRoster(actor: Actor, input: z.output<typeof saveRosterSchema>): Promise<{ saved: number }> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const today = this.days.today();
    await this.database.transaction(async (transaction) => {
      const employeeIds = [...new Set(input.cells.map((cell) => cell.employeeId))];
      const allowed = await transaction.execute<{ id: string; birth_date: string }>(sql`
        SELECT e.id, e.birth_date::text FROM hr.employees e
        WHERE e.company_id = ${actor.companyId} AND e.status = 'active' AND e.id IN (${sql.join(
          employeeIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )}) AND ${access.manage ? sql`TRUE` : employeeScope({ ...access, viewAll: false }, today)} FOR UPDATE`);
      if (allowed.rows.length !== employeeIds.length) throw new ApiError("FORBIDDEN", "forbidden");
      await assertMonthsOpen(
        transaction,
        actor.companyId,
        input.cells.map((cell) => cell.date),
      );
      const shifts = new Set((await transaction.execute<{ id: string }>(sql`SELECT id FROM hr.shifts WHERE company_id = ${actor.companyId} AND status = 'active'`)).rows.map((row) => row.id));
      for (const cell of input.cells) {
        if (cell.shiftId && !shifts.has(cell.shiftId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { shiftId: "invalidValue" } });
        if (cell.clear) {
          await transaction.execute(sql`DELETE FROM hr.shift_assignments WHERE employee_id = ${cell.employeeId} AND work_date = ${cell.date}::date`);
        } else {
          await transaction.execute(sql`
            INSERT INTO hr.shift_assignments (company_id, employee_id, work_date, shift_id, updated_by)
            VALUES (${actor.companyId}, ${cell.employeeId}, ${cell.date}::date, ${cell.shiftId}, ${actor.userId})
            ON CONFLICT (employee_id, work_date) DO UPDATE SET shift_id = EXCLUDED.shift_id, updated_by = EXCLUDED.updated_by, updated_at = now()`);
        }
      }
      // Kiểm giới hạn giờ tuần sau khi xếp (Bộ luật Lao động Điều 105, 146).
      const weeks = [...new Set(input.cells.map((cell) => addDays(cell.date, -weekdayIndex(cell.date))))];
      for (const weekStart of weeks) {
        const calendars = await this.days.calendars(transaction, actor.companyId, employeeIds, weekStart, addDays(weekStart, 7));
        for (const employee of allowed.rows) {
          const check = this.weekCheck(calendars.get(employee.id)!.days, ageAt(employee.birth_date, weekStart) < 18);
          if (check.warnings.includes("weeklyHoursExceeded")) throw new ApiError("BUSINESS_RULE", "weeklyHoursExceeded");
        }
      }
      await this.auditService.record(
        { ...hrAudit(actor, "shift_assignment"), action: "shift_assignment.save", entityId: actor.companyId, beforeData: null, afterData: { cells: input.cells.length } },
        transaction,
      );
      const dates = input.cells.map((cell) => cell.date).sort();
      await this.days.recalculate(transaction, actor.companyId, employeeIds, dates[0]!, dates[dates.length - 1]!);
    });
    return { saved: input.cells.length };
  }

  // ---- Ngày lễ ----

  private async canManageGroupHolidays(actor: Actor): Promise<boolean> {
    return (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" })).has(attendancePermission.manage);
  }

  async holidays(actor: Actor, year: number): Promise<HolidayListResponse> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const group = await this.canManageGroupHolidays(actor);
    const rows = await this.database.execute<{ id: string; holiday_date: string; name: string; foreigners_only: boolean; company_id: string | null }>(sql`
      SELECT id, holiday_date::text, name, foreigners_only, company_id FROM hr.holidays
      WHERE (company_id IS NULL OR company_id = ${actor.companyId}) AND extract(year FROM holiday_date) = ${year} ORDER BY holiday_date, company_id NULLS FIRST`);
    const items: HolidayItem[] = rows.rows.map((row) => ({
      id: row.id,
      date: row.holiday_date,
      name: row.name,
      foreignersOnly: row.foreigners_only,
      scope: row.company_id ? "company" : "group",
      canDelete: row.company_id ? access.manage : group,
    }));
    return { year, canManageGroup: group, canManageCompany: access.manage, items };
  }

  private async afterHolidayChange(transaction: Transaction, actor: Actor, scope: "group" | "company", date: string): Promise<void> {
    if (scope === "company") {
      await assertMonthsOpen(transaction, actor.companyId, [date]);
      await this.days.recalculateCompany(transaction, actor.companyId, date);
      return;
    }
    // Lịch chung: tính lại mọi công ty có chấm công; công ty đã chốt tháng đó giữ nguyên kết quả.
    const companies = await transaction.execute<{ company_id: string }>(sql`SELECT DISTINCT company_id FROM hr.shifts`);
    for (const row of companies.rows) await this.days.recalculateCompany(transaction, row.company_id, date);
  }

  async addHoliday(actor: Actor, input: z.output<typeof saveHolidaySchema>): Promise<HolidayItem> {
    const access = await this.access(actor);
    if (input.scope === "group" ? !(await this.canManageGroupHolidays(actor)) : !access.manage) throw new ApiError("FORBIDDEN", "forbidden");
    const id = await this.database.transaction(async (transaction) => {
      const companyId = input.scope === "company" ? actor.companyId : null;
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.holidays (company_id, holiday_date, name, foreigners_only, created_by)
        VALUES (${companyId}, ${input.date}::date, ${input.name}, ${input.foreignersOnly}, ${actor.userId}) ON CONFLICT DO NOTHING RETURNING id`);
      if (inserted.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { date: "holidayExists" } });
      const holidayId = inserted.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "holiday"), action: "holiday.create", entityId: holidayId, beforeData: null, afterData: input }, transaction);
      await this.afterHolidayChange(transaction, actor, input.scope, input.date);
      return holidayId;
    });
    return (await this.holidays(actor, Number(input.date.slice(0, 4)))).items.find((item) => item.id === id)!;
  }

  async deleteHoliday(actor: Actor, id: string): Promise<void> {
    const access = await this.access(actor);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ company_id: string | null; holiday_date: string; name: string }>(sql`
        SELECT company_id, holiday_date::text, name FROM hr.holidays WHERE id = ${id} AND (company_id IS NULL OR company_id = ${actor.companyId}) FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      const scope = row.company_id ? "company" : "group";
      if (scope === "group" ? !(await this.canManageGroupHolidays(actor)) : !access.manage) throw new ApiError("FORBIDDEN", "forbidden");
      if (scope === "company") await assertMonthsOpen(transaction, actor.companyId, [row.holiday_date]);
      // Ngày lễ không phải chứng từ; xóa dòng lịch, nhật ký thao tác giữ giá trị cũ.
      await transaction.execute(sql`DELETE FROM hr.holidays WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "holiday"), action: "holiday.delete", entityId: id, beforeData: row, afterData: null }, transaction);
      await this.afterHolidayChange(transaction, actor, scope, row.holiday_date);
    });
  }

  // Tạo năm mới: điền các ngày lễ dương lịch cố định vào lịch chung.
  async generateHolidays(actor: Actor, year: number): Promise<HolidayListResponse> {
    if (!(await this.canManageGroupHolidays(actor))) throw new ApiError("FORBIDDEN", "forbidden");
    await this.database.transaction(async (transaction) => {
      for (const [day, name] of fixedHolidays) {
        await transaction.execute(sql`
          INSERT INTO hr.holidays (company_id, holiday_date, name, foreigners_only, created_by) VALUES (NULL, ${`${year}-${day}`}::date, ${name}, false, ${actor.userId}) ON CONFLICT DO NOTHING`);
      }
      await this.auditService.record({ ...hrAudit(actor, "holiday"), action: "holiday.generate", entityId: actor.companyId, beforeData: null, afterData: { year } }, transaction);
      await this.afterHolidayChange(transaction, actor, "group", `${year}-01-01`);
    });
    return this.holidays(actor, year);
  }
}
