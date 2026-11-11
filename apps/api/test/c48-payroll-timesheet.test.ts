// CONG_VIEC_48: đọc bảng công tháng của CONG_VIEC_47 và khóa mở lại kỳ công khi bảng lương được duyệt (QUYTAC_NGHIEPVU_316, 322; KICHBAN_KIEMTHU_460).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { DatabaseTimesheetReader } from "../src/hr/payroll-timesheet";
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
});
