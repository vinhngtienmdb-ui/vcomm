// CONG_VIEC_48: đọc bảng công tháng của CONG_VIEC_47 và khóa mở lại kỳ công khi bảng lương được duyệt (QUYTAC_NGHIEPVU_316, 322; KICHBAN_KIEMTHU_460).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { DatabaseTimesheetReader } from "../src/hr/payroll-timesheet";
import { signIn } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let database: Database;
const retail: string = testIds.retailCompany;
const reader = new DatabaseTimesheetReader();

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  database = application.get(DATABASE);
});

afterAll(async () => {
  testClock.fixed = null;
  await application.close();
});

describe("Nguồn bảng công thật (hr.timesheet_periods, hr.timesheet_lines)", () => {
  it("chưa có kỳ: null; kỳ đang mở: chưa chốt; kỳ đã chốt: chốt", async () => {
    expect(await reader.read(database, retail, "2026-11-01")).toBeNull();
    await pool.query("INSERT INTO hr.timesheet_periods (company_id, year, month) VALUES ($1, 2026, 11)", [retail]);
    expect(await reader.read(database, retail, "2026-11-01")).toMatchObject({ closed: false });
    await pool.query("UPDATE hr.timesheet_periods SET status = 'closed', closed_at = now() WHERE company_id = $1 AND year = 2026 AND month = 11", [retail]);
    const sheet = await reader.read(database, retail, "2026-11-01");
    expect(sheet?.closed).toBe(true);
  });

  it("khóa và mở khóa kỳ công theo bảng lương", async () => {
    await reader.lock(database, retail, "2026-11-01", true);
    const locked = await pool.query<{ payroll_locked_at: Date | null }>("SELECT payroll_locked_at FROM hr.timesheet_periods WHERE company_id = $1 AND year = 2026 AND month = 11", [retail]);
    expect(locked.rows[0]!.payroll_locked_at).not.toBeNull();
    await reader.lock(database, retail, "2026-11-01", false);
    const unlocked = await pool.query<{ payroll_locked_at: Date | null }>("SELECT payroll_locked_at FROM hr.timesheet_periods WHERE company_id = $1 AND year = 2026 AND month = 11", [retail]);
    expect(unlocked.rows[0]!.payroll_locked_at).toBeNull();
  });

  it("đọc dòng bảng công: ngày không lương = không lương + bảo hiểm xã hội chi trả + vắng; 7 nhóm tăng ca; chỉ dòng của công ty", async () => {
    const admin = await signIn(application, "quantri.vcr@vcomm.test");
    const department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'BC', 'Phòng Bán hàng') RETURNING id", [retail])).rows[0]!.id;
    const created = await admin.call("post", "/hr/employees", {
      companyId: retail,
      body: {
        code: "BC0001",
        fullName: "Lê Thu Hà",
        gender: "female",
        birthDate: "1994-02-03",
        identityNumber: "079194000001",
        residence: "Thành phố Hồ Chí Minh",
        hireDate: "2026-01-05",
        departmentId: department,
        branchId: testIds.headOfficeBranch,
        jobTitle: "Nhân viên",
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const employeeId: string = created.body.id;
    const periodId = (await pool.query<{ id: string }>("SELECT id FROM hr.timesheet_periods WHERE company_id = $1 AND year = 2026 AND month = 11", [retail])).rows[0]!.id;
    await pool.query(
      `INSERT INTO hr.timesheet_lines (period_id, company_id, employee_id, employment_from, employment_to, month_standard_units, paid_units, unpaid_leave_units, social_insurance_leave_units, absent_units,
         night_hours, overtime_weekday_hours, overtime_weekday_night_hours, overtime_weekday_night_after_day_hours, overtime_rest_day_hours, overtime_rest_day_night_hours,
         overtime_holiday_hours, overtime_holiday_night_hours, annual_leave_payout_units)
       VALUES ($1, $2, $3, '2026-11-01', '2026-11-30', 25, 19.5, 2, 3, 0.5, 8, 4, 1.5, 2, 8, 1, 3, 0.5, 1.5)`,
      [periodId, retail, employeeId],
    );
    const sheet = await reader.read(database, retail, "2026-11-01");
    expect(sheet?.employees.get(employeeId)).toEqual({
      standardDays: "25.00",
      paidDays: "19.50",
      unpaidDays: "5.50",
      nightHours: "8.00",
      overtimeHours: { weekday: "4.00", weekdayNight: "1.50", weekdayNightAfterDay: "2.00", weeklyRest: "8.00", weeklyRestNight: "1.00", holiday: "3.00", holidayNight: "0.50" },
      settledLeaveDays: "1.50",
    });
    expect(await reader.read(database, testIds.tradingCompany, "2026-11-01")).toBeNull();
  });
});
