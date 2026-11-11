// Đọc bảng công tháng của CONG_VIEC_47 cho tính lương (CONG_VIEC_48 mục 9). Tách riêng để phần tính lương không phụ thuộc chi tiết bảng của chấm công.
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import type { TimesheetFigures } from "./payroll-calculation";

type Executor = Pick<Database, "execute">;
export const PAYROLL_TIMESHEET = Symbol("PAYROLL_TIMESHEET");

export interface MonthTimesheet {
  // Kỳ đã chốt (QUYTAC_NGHIEPVU_311 của CONG_VIEC_47); chưa chốt thì chỉ tính xem trước, không gửi duyệt.
  closed: boolean;
  employees: Map<string, TimesheetFigures>;
}
export interface PayrollTimesheetReader {
  read(executor: Executor, companyId: string, month: string): Promise<MonthTimesheet | null>;
  // Bảng lương được duyệt: ghi payroll_locked_at của kỳ công để CONG_VIEC_47 chặn mở lại bảng công; false thì xóa.
  lock(executor: Executor, companyId: string, month: string, locked: boolean): Promise<void>;
}

type LineRow = {
  employee_id: string;
  month_standard_units: string;
  paid_units: string;
  unpaid_units: string;
  night_hours: string;
  overtime_weekday_hours: string;
  overtime_weekday_night_hours: string;
  overtime_weekday_night_after_day_hours: string;
  overtime_rest_day_hours: string;
  overtime_rest_day_night_hours: string;
  overtime_holiday_hours: string;
  overtime_holiday_night_hours: string;
  annual_leave_payout_units: string;
};

// Bảng hr.timesheet_periods (database migration 0073), hr.timesheet_lines (0075) của CONG_VIEC_47.
@Injectable()
export class DatabaseTimesheetReader implements PayrollTimesheetReader {
  private async exists(executor: Executor, table: string): Promise<boolean> {
    return (await executor.execute<{ found: boolean }>(sql`SELECT to_regclass(${table}) IS NOT NULL AS found`)).rows[0]!.found;
  }

  async read(executor: Executor, companyId: string, month: string): Promise<MonthTimesheet | null> {
    if (!(await this.exists(executor, "hr.timesheet_periods"))) return null;
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    const period = (
      await executor.execute<{ id: string; status: string }>(sql`
      SELECT id, status FROM hr.timesheet_periods WHERE company_id = ${companyId} AND year = ${year} AND month = ${monthNumber}`)
    ).rows[0];
    if (!period) return null;
    const employees = new Map<string, TimesheetFigures>();
    // Dòng bảng công chưa có (CONG_VIEC_47 chưa tổng hợp): mọi dòng lương cảnh báo "Chưa có bảng công".
    if (await this.exists(executor, "hr.timesheet_lines")) {
      const rows = await executor.execute<LineRow>(sql`
        SELECT employee_id, month_standard_units::text, paid_units::text,
          (unpaid_leave_units + social_insurance_leave_units + absent_units)::text AS unpaid_units,
          night_hours::text, overtime_weekday_hours::text, overtime_weekday_night_hours::text, overtime_weekday_night_after_day_hours::text, overtime_rest_day_hours::text,
          overtime_rest_day_night_hours::text, overtime_holiday_hours::text, overtime_holiday_night_hours::text, annual_leave_payout_units::text
        FROM hr.timesheet_lines WHERE period_id = ${period.id} AND company_id = ${companyId}`);
      for (const row of rows.rows) {
        employees.set(row.employee_id, {
          standardDays: row.month_standard_units,
          paidDays: row.paid_units,
          // Ngày không làm việc, không hưởng lương: nghỉ không lương, nghỉ bảo hiểm xã hội chi trả, vắng không phép (QUYTAC_NGHIEPVU_319).
          unpaidDays: row.unpaid_units,
          nightHours: row.night_hours,
          overtimeHours: {
            weekday: row.overtime_weekday_hours,
            weekdayNight: row.overtime_weekday_night_hours,
            weekdayNightAfterDay: row.overtime_weekday_night_after_day_hours,
            weeklyRest: row.overtime_rest_day_hours,
            weeklyRestNight: row.overtime_rest_day_night_hours,
            holiday: row.overtime_holiday_hours,
            holidayNight: row.overtime_holiday_night_hours,
          },
          settledLeaveDays: row.annual_leave_payout_units,
        });
      }
    }
    return { closed: period.status === "closed", employees };
  }

  async lock(executor: Executor, companyId: string, month: string, locked: boolean): Promise<void> {
    if (!(await this.exists(executor, "hr.timesheet_periods"))) return;
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    await executor.execute(sql`
      UPDATE hr.timesheet_periods SET payroll_locked_at = ${locked ? sql`now()` : sql`NULL`}, updated_at = now()
      WHERE company_id = ${companyId} AND year = ${year} AND month = ${monthNumber}`);
  }
}
