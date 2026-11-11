// Lượt chấm và công ngày (CONG_VIEC_47; CHUC_NANG_165; QUYTAC_NGHIEPVU_304, 305; API_151): lưới công tháng, chi tiết ngày, ghi thủ công, nhập tệp máy chấm công, mã chấm công.
import { Inject, Injectable } from "@nestjs/common";
import type {
  AttendanceDayCell,
  AttendanceDayResponse,
  AttendanceGridResponse,
  AttendanceImportItem,
  AttendanceImportResponse,
  AttendancePunchItem,
  attendanceGridQuerySchema,
  manualPunchSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { readSheet } from "read-excel-file/node";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { addDays, punchInstants, vietnamDateOf, vietnamTime } from "./attendance-calculator";
import { attendanceAccess, employeeScope, requireAttendanceManage, requireAttendanceView, type AttendanceAccess } from "./attendance-access";
import { AttendanceDaysService, assertMonthsOpen, datesBetween } from "./attendance-days.service";
import { hrAudit } from "./hr-context";

type Executor = Pick<Database, "execute">;
export type UploadedSheet = { buffer: Buffer; size: number; originalname: string };

export const importMaximumBytes = 5 * 1024 * 1024;
const importMaximumRows = 20_000;

type DayRow = {
  employee_id: string;
  work_date: string;
  status: AttendanceDayCell["status"];
  day_kind: AttendanceDayCell["dayKind"];
  shift_code: string | null;
  planned_units: string;
  worked_units: string;
  late_minutes: number;
  early_minutes: number;
  leave_units: string;
  leave_pay_group: AttendanceDayCell["leavePayGroup"];
  first_in: Date | null;
  last_out: Date | null;
  worked_minutes: number;
  standard_minutes: number;
  night_minutes: number;
  planned_start: Date | null;
  planned_end: Date | null;
};

const cell = (row: DayRow): AttendanceDayCell => ({
  date: row.work_date,
  status: row.status,
  dayKind: row.day_kind,
  shiftCode: row.shift_code,
  plannedUnits: Number(row.planned_units).toFixed(2),
  workedUnits: Number(row.worked_units).toFixed(2),
  lateMinutes: row.late_minutes,
  earlyMinutes: row.early_minutes,
  leaveUnits: Number(row.leave_units).toFixed(2),
  leavePayGroup: row.leave_pay_group,
});

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const lastDayOfMonth = (month: string) => addDays(`${addDays(`${month}-28`, 4).slice(0, 7)}-01`, -1);

// Đọc thời điểm trong tệp: "YYYY-MM-DD", "DD/MM/YYYY" kèm "HH:MM[:SS]"; ô ngày của Excel đọc theo giờ ghi trên ô (giờ Việt Nam).
function parseDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const parts = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
  if (!parts) return null;
  const text = `${parts[0]}-${parts[1]!.padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
  const check = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== text ? null : text;
}
function parseTime(value: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}
const excelWallClock = (value: Date) => ({ date: value.toISOString().slice(0, 10), time: value.toISOString().slice(11, 16) });
function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const wall = excelWallClock(value);
    return wall.time === "00:00" ? wall.date : `${wall.date} ${wall.time}`;
  }
  return String(value).trim();
}

export function parsePunchRow(values: unknown[]): { code: string; instant: Date; device: string | null } | "invalid" {
  const texts = values.map(cellText);
  const code = texts[0] ?? "";
  if (!code) return "invalid";
  const combined = /^(\S+)[ T](\d{1,2}:\d{2}(?::\d{2})?)$/.exec(texts[1] ?? "");
  let date: string | null;
  let time: string | null;
  let device: string | null;
  if (combined) {
    date = parseDate(combined[1]!);
    time = parseTime(combined[2]!);
    device = texts[2] || null;
  } else {
    date = parseDate(texts[1] ?? "");
    time = parseTime(texts[2] ?? "");
    device = texts[3] || null;
  }
  if (!date || !time) return "invalid";
  return { code, instant: vietnamTime(date, time), device: device ? device.slice(0, 50) : null };
}

function parseCsv(content: string): string[][] {
  const lines = content
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  const delimiter = [";", "\t", ","].find((candidate) => lines[0]?.includes(candidate)) ?? ",";
  return lines.map((line) => line.split(delimiter).map((value) => value.trim().replace(/^"(.*)"$/, "$1")));
}

@Injectable()
export class AttendanceService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly days: AttendanceDaysService,
  ) {}

  private access(actor: Actor): Promise<AttendanceAccess> {
    return attendanceAccess(this.permissionService, this.database, actor);
  }

  private async monthClosed(companyId: string, month: string): Promise<boolean> {
    const row = await this.database.execute(sql`
      SELECT 1 FROM hr.timesheet_periods WHERE company_id = ${companyId} AND year = ${Number(month.slice(0, 4))} AND month = ${Number(month.slice(5, 7))} AND status = 'closed'`);
    return row.rows.length > 0;
  }

  async grid(actor: Actor, query: z.output<typeof attendanceGridQuerySchema>): Promise<AttendanceGridResponse> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const from = `${query.month}-01`;
    const to = lastDayOfMonth(query.month);
    const employees = await this.database.execute<{ id: string; code: string; full_name: string; department_name: string | null; attendance_code: string | null }>(sql`
      SELECT e.id, e.code, e.full_name, d.name AS department_name, e.attendance_code
      FROM hr.employees e
      CROSS JOIN LATERAL (SELECT
        (SELECT w.department_id FROM hr.work_events w WHERE w.employee_id = e.id AND w.department_id IS NOT NULL AND w.effective_date <= GREATEST(LEAST(${to}::date, ${this.days.today()}::date), e.hire_date) ORDER BY w.effective_date DESC LIMIT 1) AS department_id,
        (SELECT w.branch_id FROM hr.work_events w WHERE w.employee_id = e.id AND w.branch_id IS NOT NULL AND w.effective_date <= GREATEST(LEAST(${to}::date, ${this.days.today()}::date), e.hire_date) ORDER BY w.effective_date DESC LIMIT 1) AS branch_id) position
      LEFT JOIN core.departments d ON d.id = position.department_id
      WHERE e.company_id = ${actor.companyId} AND e.hire_date <= ${to}::date AND (e.termination_date IS NULL OR e.termination_date >= ${from}::date)
        AND ${employeeScope(access, to < this.days.today() ? to : this.days.today())}
        ${query.departmentId ? sql`AND position.department_id = ${query.departmentId}` : sql``}
        ${query.branchId ? sql`AND position.branch_id = ${query.branchId}` : sql``}
      ORDER BY e.full_name LIMIT 1000`);
    const ids = employees.rows.map((row) => row.id);
    const dayRows = ids.length
      ? (
          await this.database.execute<DayRow>(sql`
          SELECT employee_id, work_date::text, status, day_kind, shift_code, planned_units::text, worked_units::text, late_minutes, early_minutes, leave_units::text, leave_pay_group,
            first_in, last_out, worked_minutes, standard_minutes, night_minutes, planned_start, planned_end
          FROM hr.attendance_days WHERE company_id = ${actor.companyId} AND work_date BETWEEN ${from}::date AND ${to}::date
            AND employee_id IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`)
        ).rows
      : [];
    const rows = employees.rows
      .map((employee) => {
        const days = dayRows
          .filter((row) => row.employee_id === employee.id)
          .sort((first, second) => first.work_date.localeCompare(second.work_date))
          .map(cell);
        return {
          employeeId: employee.id,
          code: employee.code,
          fullName: employee.full_name,
          departmentName: employee.department_name,
          attendanceCode: employee.attendance_code,
          days,
          workedUnits: days.reduce((total, day) => total + Number(day.workedUnits), 0).toFixed(2),
        };
      })
      .filter((row) => {
        if (!query.status) return true;
        if (query.status === "late") return row.days.some((day) => day.lateMinutes > 0 || day.earlyMinutes > 0);
        return row.days.some((day) => day.status === query.status);
      });
    return { month: query.month, dates: datesBetween(from, to), canManage: access.manage, monthClosed: await this.monthClosed(actor.companyId, query.month), rows };
  }

  // Hồ sơ trong công ty và trong phạm vi xem.
  private async employeeInScope(executor: Executor, actor: Actor, access: AttendanceAccess, employeeId: string) {
    const row = (
      await executor.execute<{ id: string; code: string; full_name: string; hire_date: string; termination_date: string | null }>(sql`
      SELECT e.id, e.code, e.full_name, e.hire_date::text, e.termination_date::text FROM hr.employees e
      WHERE e.id = ${employeeId} AND e.company_id = ${actor.companyId} AND ${employeeScope(access, this.days.today())}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async day(actor: Actor, employeeId: string, date: string): Promise<AttendanceDayResponse> {
    const access = await this.access(actor);
    requireAttendanceView(access);
    const employee = await this.employeeInScope(this.database, actor, access, employeeId);
    const row = (
      await this.database.execute<DayRow>(sql`
      SELECT employee_id, work_date::text, status, day_kind, shift_code, planned_units::text, worked_units::text, late_minutes, early_minutes, leave_units::text, leave_pay_group,
        first_in, last_out, worked_minutes, standard_minutes, night_minutes, planned_start, planned_end
      FROM hr.attendance_days WHERE employee_id = ${employeeId} AND work_date = ${date}::date`)
    ).rows[0];
    // Lượt của ngày: trong khoảng ca dự kiến mở rộng, hoặc trong ngày dương lịch nếu không có ca.
    const windowStart = row?.planned_start ? new Date(new Date(row.planned_start).getTime() - 4 * 3_600_000) : vietnamTime(date, "00:00");
    const windowEnd = row?.planned_end ? new Date(new Date(row.planned_end).getTime() + 8 * 3_600_000) : vietnamTime(addDays(date, 1), "00:00");
    const closed = await this.monthClosed(actor.companyId, date.slice(0, 7));
    const punches = await this.database.execute<{
      id: string;
      punched_at: Date;
      source: AttendancePunchItem["source"];
      device_code: string | null;
      method: AttendancePunchItem["method"];
      location_name: string | null;
      distance: number | null;
      reason: string | null;
      created_by_name: string;
    }>(sql`
      SELECT p.id, p.punched_at, p.source, p.device_code, p.method, l.name AS location_name, p.reason, u.full_name AS created_by_name,
        CASE WHEN p.latitude IS NOT NULL AND l.latitude IS NOT NULL THEN round(6371000 * 2 * asin(sqrt(
          power(sin(radians(p.latitude - l.latitude) / 2), 2) + cos(radians(l.latitude)) * cos(radians(p.latitude)) * power(sin(radians(p.longitude - l.longitude) / 2), 2))))::integer END AS distance
      FROM hr.attendance_punches p JOIN core.users u ON u.id = p.created_by LEFT JOIN hr.attendance_locations l ON l.id = p.location_id
      WHERE p.employee_id = ${employeeId} AND p.deleted_at IS NULL AND p.punched_at >= ${windowStart.toISOString()}::timestamptz AND p.punched_at < ${windowEnd.toISOString()}::timestamptz
      ORDER BY p.punched_at`);
    return {
      employeeId,
      code: employee.code,
      fullName: employee.full_name,
      date,
      day: row
        ? {
            ...cell(row),
            firstIn: iso(row.first_in),
            lastOut: iso(row.last_out),
            workedMinutes: row.worked_minutes,
            standardMinutes: row.standard_minutes,
            nightMinutes: row.night_minutes,
            plannedStart: iso(row.planned_start),
            plannedEnd: iso(row.planned_end),
          }
        : null,
      punches: punches.rows.map((punch) => ({
        id: punch.id,
        punchedAt: new Date(punch.punched_at).toISOString(),
        source: punch.source,
        deviceCode: punch.device_code,
        method: punch.method,
        locationName: punch.location_name,
        distanceMeters: punch.distance,
        reason: punch.reason,
        createdByName: punch.created_by_name,
        canDelete: access.manage && punch.source === "manual" && !closed,
      })),
      canManage: access.manage && !closed,
    };
  }

  // Ghi thủ công giờ vào, giờ ra của một ngày (QUYTAC_NGHIEPVU_304). Giờ ra trước giờ vào, hoặc ca dự kiến qua đêm, thì là ngày hôm sau.
  async addManualPunches(actor: Actor, input: z.output<typeof manualPunchSchema>): Promise<AttendanceDayResponse> {
    const access = await this.access(actor);
    requireAttendanceManage(access);
    await this.database.transaction(async (transaction) => {
      const employee = await this.employeeInScope(transaction, actor, access, input.employeeId);
      if (input.workDate < employee.hire_date || (employee.termination_date && input.workDate > employee.termination_date) || input.workDate > this.days.today()) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { workDate: "punchOutsideEmployment" } });
      }
      await assertMonthsOpen(transaction, actor.companyId, [input.workDate]);
      const planned = (await this.days.calendars(transaction, actor.companyId, [input.employeeId], input.workDate, input.workDate)).get(input.employeeId)!.days[0]!;
      const instants = punchInstants(planned, input.checkIn, input.checkOut);
      for (const instant of instants) {
        const inserted = await transaction.execute(sql`
          INSERT INTO hr.attendance_punches (company_id, employee_id, punched_at, source, reason, created_by)
          VALUES (${actor.companyId}, ${input.employeeId}, ${instant.toISOString()}::timestamptz, 'manual', ${input.reason}, ${actor.userId})
          ON CONFLICT DO NOTHING RETURNING id`);
        if (inserted.rows.length === 0) throw new ApiError("BUSINESS_RULE", "punchDuplicate");
      }
      await this.auditService.record({ ...hrAudit(actor, "attendance_punch"), action: "attendance_punch.manual", entityId: input.employeeId, beforeData: null, afterData: input }, transaction);
      await this.days.recalculate(transaction, actor.companyId, [input.employeeId], addDays(input.workDate, -1), addDays(input.workDate, 1));
    });
    return this.day(actor, input.employeeId, input.workDate);
  }

  async deletePunch(actor: Actor, punchId: string, reason: string): Promise<void> {
    const access = await this.access(actor);
    requireAttendanceManage(access);
    await this.database.transaction(async (transaction) => {
      const punch = (
        await transaction.execute<{ employee_id: string; punched_at: Date; source: string }>(sql`
        SELECT employee_id, punched_at, source FROM hr.attendance_punches WHERE id = ${punchId} AND company_id = ${actor.companyId} AND deleted_at IS NULL FOR UPDATE`)
      ).rows[0];
      if (!punch) throw new ApiError("NOT_FOUND", "notFound");
      // Lượt từ máy, ứng dụng, giải trình không xóa (QUYTAC_NGHIEPVU_304).
      if (punch.source !== "manual") throw new ApiError("BUSINESS_RULE", "punchNotDeletable");
      const date = vietnamDateOf(new Date(punch.punched_at));
      await assertMonthsOpen(transaction, actor.companyId, [date, addDays(date, -1)]);
      await transaction.execute(sql`UPDATE hr.attendance_punches SET deleted_at = now(), deleted_by = ${actor.userId} WHERE id = ${punchId}`);
      await this.auditService.record(
        { ...hrAudit(actor, "attendance_punch"), action: "attendance_punch.delete", entityId: punchId, beforeData: { punchedAt: punch.punched_at }, afterData: { reason } },
        transaction,
      );
      await this.days.recalculate(transaction, actor.companyId, [punch.employee_id], addDays(date, -1), addDays(date, 1));
    });
  }

  async setAttendanceCode(actor: Actor, employeeId: string, code: string | null): Promise<{ attendanceCode: string | null }> {
    const access = await this.access(actor);
    requireAttendanceManage(access);
    await this.database.transaction(async (transaction) => {
      await this.employeeInScope(transaction, actor, access, employeeId);
      if (code) {
        const taken = await transaction.execute(sql`
          SELECT 1 FROM hr.employees WHERE company_id = ${actor.companyId} AND lower(attendance_code) = lower(${code}) AND id <> ${employeeId}`);
        if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { attendanceCode: "attendanceCodeExists" } });
      }
      await transaction.execute(sql`UPDATE hr.employees SET attendance_code = ${code}, updated_at = now() WHERE id = ${employeeId}`);
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.attendance_code", entityId: employeeId, beforeData: null, afterData: { attendanceCode: code } }, transaction);
    });
    return { attendanceCode: code };
  }

  async recalculateMonth(actor: Actor, month: string): Promise<{ month: string }> {
    requireAttendanceManage(await this.access(actor));
    const from = `${month}-01`;
    const to = lastDayOfMonth(month);
    await this.database.transaction(async (transaction) => {
      await this.days.recalculate(transaction, actor.companyId, await this.days.employeesInRange(transaction, actor.companyId, from, to), from, to);
    });
    return { month };
  }

  async imports(actor: Actor): Promise<AttendanceImportItem[]> {
    requireAttendanceView(await this.access(actor));
    const rows = await this.database.execute<{
      id: string;
      file_name: string;
      imported_at: Date;
      imported_by_name: string;
      accepted_count: number;
      duplicate_count: number;
      error_count: number;
    }>(sql`
      SELECT i.id, i.file_name, i.imported_at, u.full_name AS imported_by_name, i.accepted_count, i.duplicate_count, i.error_count
      FROM hr.attendance_imports i JOIN core.users u ON u.id = i.imported_by WHERE i.company_id = ${actor.companyId} ORDER BY i.imported_at DESC LIMIT 100`);
    return rows.rows.map((row) => ({
      id: row.id,
      fileName: row.file_name,
      importedAt: new Date(row.imported_at).toISOString(),
      importedByName: row.imported_by_name,
      accepted: row.accepted_count,
      duplicates: row.duplicate_count,
      errors: row.error_count,
    }));
  }

  private async readRows(file: UploadedSheet): Promise<unknown[][]> {
    if (file.size > importMaximumBytes) throw new ApiError("VALIDATION_FAILED", "fileTooLarge");
    const name = file.originalname.toLowerCase();
    try {
      if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(file.buffer.toString("utf8"));
      if (name.endsWith(".xlsx")) return (await readSheet(file.buffer)) as unknown[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "fileInvalidTemplate");
    }
    throw new ApiError("VALIDATION_FAILED", "fileInvalidTemplate");
  }

  // Nhập tệp máy chấm công: confirm = false chỉ xem trước; true ghi các dòng đạt (QUYTAC_NGHIEPVU_304).
  async importPunches(actor: Actor, file: UploadedSheet, confirm: boolean): Promise<AttendanceImportResponse> {
    const access = await this.access(actor);
    requireAttendanceManage(access);
    let rows = await this.readRows(file);
    // Bỏ dòng tiêu đề: dòng đầu không đọc được còn dòng sau đọc được.
    let headerRows = 0;
    if (rows.length > 1 && parsePunchRow(rows[0]!) === "invalid" && parsePunchRow(rows[1]!) !== "invalid") {
      rows = rows.slice(1);
      headerRows = 1;
    }
    if (rows.length === 0) throw new ApiError("VALIDATION_FAILED", "fileInvalidTemplate");
    if (rows.length > importMaximumRows) throw new ApiError("VALIDATION_FAILED", "attendanceFileTooManyRows");
    return this.database.transaction(async (transaction) => {
      const employees = await transaction.execute<{ id: string; code: string; hire_date: string; termination_date: string | null }>(sql`
        SELECT id, lower(attendance_code) AS code, hire_date::text, termination_date::text FROM hr.employees WHERE company_id = ${actor.companyId} AND attendance_code IS NOT NULL`);
      const byCode = new Map(employees.rows.map((row) => [row.code, row]));
      const closed = new Set(
        (
          await transaction.execute<{ month: string }>(sql`
          SELECT year::text || '-' || lpad(month::text, 2, '0') AS month FROM hr.timesheet_periods WHERE company_id = ${actor.companyId} AND status = 'closed'`)
        ).rows.map((row) => row.month),
      );
      const errors: { row: number; messageKey: ErrorMessageKey }[] = [];
      const valid: { employeeId: string; instant: Date; device: string | null }[] = [];
      const seen = new Set<string>();
      let duplicates = 0;
      const today = this.days.today();
      rows.forEach((values, index) => {
        // Số dòng theo tệp (gồm dòng tiêu đề) để người dùng tìm được.
        const rowNumber = index + 1 + headerRows;
        const parsed = parsePunchRow(values);
        if (parsed === "invalid") return errors.push({ row: rowNumber, messageKey: "attendanceTimeInvalid" });
        const employee = byCode.get(parsed.code.toLowerCase());
        if (!employee) return errors.push({ row: rowNumber, messageKey: "attendanceCodeNotFound" });
        const date = vietnamDateOf(parsed.instant);
        if (date < employee.hire_date || (employee.termination_date && date > addDays(employee.termination_date, 1)) || date > today) {
          return errors.push({ row: rowNumber, messageKey: "punchOutsideEmployment" });
        }
        if (closed.has(date.slice(0, 7))) return errors.push({ row: rowNumber, messageKey: "timesheetClosed" });
        const key = `${employee.id}|${parsed.instant.getTime()}`;
        if (seen.has(key)) {
          duplicates += 1;
          return;
        }
        seen.add(key);
        valid.push({ employeeId: employee.id, instant: parsed.instant, device: parsed.device });
      });
      // Lượt đã có trong cơ sở dữ liệu cũng tính là trùng.
      let accepted = 0;
      if (confirm && valid.length > 0) {
        const imported = await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.attendance_imports (company_id, file_name, accepted_count, duplicate_count, error_count, imported_by)
          VALUES (${actor.companyId}, ${file.originalname.slice(0, 200)}, 0, 0, ${errors.length}, ${actor.userId}) RETURNING id`);
        const importId = imported.rows[0]!.id;
        for (const punch of valid) {
          const inserted = await transaction.execute(sql`
            INSERT INTO hr.attendance_punches (company_id, employee_id, punched_at, source, import_id, device_code, created_by)
            VALUES (${actor.companyId}, ${punch.employeeId}, ${punch.instant.toISOString()}::timestamptz, 'device', ${importId}, ${punch.device}, ${actor.userId})
            ON CONFLICT DO NOTHING RETURNING id`);
          if (inserted.rows.length > 0) accepted += 1;
          else duplicates += 1;
        }
        await transaction.execute(sql`UPDATE hr.attendance_imports SET accepted_count = ${accepted}, duplicate_count = ${duplicates} WHERE id = ${importId}`);
        await this.auditService.record(
          {
            ...hrAudit(actor, "attendance_import"),
            action: "attendance_import.create",
            entityId: importId,
            beforeData: null,
            afterData: { fileName: file.originalname, accepted, duplicates, errors: errors.length },
          },
          transaction,
        );
        const byEmployee = new Map<string, string[]>();
        for (const punch of valid) byEmployee.set(punch.employeeId, [...(byEmployee.get(punch.employeeId) ?? []), vietnamDateOf(punch.instant)]);
        for (const [employeeId, dates] of byEmployee) {
          dates.sort();
          await this.days.recalculate(transaction, actor.companyId, [employeeId], addDays(dates[0]!, -1), addDays(dates[dates.length - 1]!, 1));
        }
      } else if (!confirm && valid.length > 0) {
        const existing = await transaction.execute<{ total: number }>(sql`
          SELECT count(*)::integer AS total FROM hr.attendance_punches p
          JOIN jsonb_to_recordset(${JSON.stringify(valid.map((punch) => ({ employee_id: punch.employeeId, punched_at: punch.instant.toISOString() })))}::jsonb)
            AS c(employee_id uuid, punched_at timestamptz) ON c.employee_id = p.employee_id AND c.punched_at = p.punched_at
          WHERE p.deleted_at IS NULL`);
        duplicates += existing.rows[0]!.total;
        accepted = valid.length - existing.rows[0]!.total;
      }
      return { fileName: file.originalname, totalRows: rows.length, accepted, duplicates, errors: errors.slice(0, 500), imported: confirm && valid.length > 0 };
    });
  }
}

export const datesOfMonth = (month: string) => datesBetween(`${month}-01`, lastDayOfMonth(month));
