// CONG_VIEC_47 lát L3: tăng ca, bảng công tháng (TIEUCHI_NGHIEMTHU_300, 301; KICHBAN_KIEMTHU_450, 451).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateDay, vietnamTime, type ShiftDefinition } from "../src/hr/attendance-calculator";
import { TimesheetsService } from "../src/hr/timesheets.service";
import type { Session } from "./helpers";
import { department, hrEmployee, officeSetup, retail, userWithRole } from "./c47-helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hr: Session;
let worker: Session;
let manager: Session;
let viewer: Session;
let employeeId: string;
let minorId: string;
let offlineId: string;
const pdf = Buffer.from("%PDF-1.4 van ban dong y lam them gio");
const call = (session: Session, method: "get" | "post" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const overtime = (values: Record<string, string>) => ({ workContent: "Kiểm kê cuối tháng", workLocation: "Kho Bình Dương", ...values });
const at = (instant: string) => {
  testClock.fixed = new Date(instant);
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  at("2026-11-11T10:00:00+07:00");
  hr = (await userWithRole(application, pool, "nhansu.tangca@vcomm.test", "Nhân sự tăng ca", "hr_staff")).session;
  const workerUser = await userWithRole(application, pool, "nhanvien.tangca@vcomm.test", "Nhân viên tăng ca", null);
  worker = workerUser.session;
  const managerUser = await userWithRole(application, pool, "truongphong.tangca@vcomm.test", "Trưởng phòng tăng ca", null);
  manager = managerUser.session;
  viewer = (await userWithRole(application, pool, "nhanvien.xem.tangca@vcomm.test", "Không quyền", null)).session;
  const team = await department(pool, "TCA", "Phòng tăng ca", managerUser.id);
  await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2 AND company_id = $3", [team, workerUser.id, retail]);
  employeeId = await hrEmployee(hr, { fullName: "Đỗ Quốc Bảo", departmentId: team, userId: workerUser.id });
  minorId = await hrEmployee(hr, { fullName: "Phạm Gia Huy", departmentId: team, birthDate: "2009-05-20", hireDate: "2026-06-01" });
  offlineId = await hrEmployee(hr, { fullName: "Nguyễn Văn Tâm", departmentId: team });
  await officeSetup(hr);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_47 giờ tăng ca trong công ngày", () => {
  it("giờ được tính là phần giao với thời gian có mặt; tách giờ đêm sau tăng ca ban ngày; ngày nghỉ, ghi nhận kèm văn bản", () => {
    const office: ShiftDefinition = { id: "hc", code: "HC", startTime: "08:00", endTime: "17:00", breakStart: "12:00", breakMinutes: 60, breakPaid: false, workUnits: 1 };
    const later = new Date("2026-12-01T00:00:00+07:00");
    const window = (start: string, end: string, full = false) => ({ start: vietnamTime("2026-11-09", start).getTime(), end: vietnamTime("2026-11-09", end).getTime(), full });
    const weekday = calculateDay(
      { date: "2026-11-09", shift: office, holiday: false, overtime: [window("18:00", "23:00")] },
      [vietnamTime("2026-11-09", "07:58"), vietnamTime("2026-11-09", "22:30")],
      5,
      later,
    );
    expect(weekday).toMatchObject({ overtimeKind: "weekday", overtimeDayMinutes: 240, overtimeNightMinutes: 0, overtimeNightAfterDayMinutes: 30, workedUnits: 1 });
    const nightOnly = calculateDay(
      { date: "2026-11-09", shift: office, holiday: false, overtime: [window("22:00", "23:00")] },
      [vietnamTime("2026-11-09", "08:00"), vietnamTime("2026-11-09", "23:10")],
      5,
      later,
    );
    expect(nightOnly).toMatchObject({ overtimeDayMinutes: 0, overtimeNightMinutes: 60 });
    const rest = calculateDay({ date: "2026-11-09", shift: null, holiday: false, overtime: [window("08:00", "12:00", true)] }, [], 5, later);
    expect(rest).toMatchObject({ status: "rest", overtimeKind: "rest_day", overtimeDayMinutes: 240 });
  });
});

describe("CONG_VIEC_47 tăng ca (KICHBAN_KIEMTHU_450)", () => {
  it("người lao động tự lập là đồng ý; chưa có chính sách thì duyệt ngay; giờ tính theo lượt chấm", async () => {
    const preview = await call(worker, "post", "/hr/me/overtime/preview", overtime({ workDate: "2026-11-09", startTime: "18:00", endTime: "21:00" }));
    expect(preview.body).toMatchObject({ dayKind: "weekday", hours: "3.00", dayLimitHours: "4.00", monthLimitHours: 40, yearLimitHours: 200, violations: [] });
    const created = await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-11-09", startTime: "18:00", endTime: "21:00" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "approved", consentStatus: "agreed", requestNo: expect.stringMatching(/^TC-VCR-2026-/) });
    expect((await call(hr, "post", "/hr/attendance/punches", { employeeId, workDate: "2026-11-09", checkIn: "07:58", checkOut: "20:00", reason: "Máy hỏng" })).status).toBe(201);
    const mine = (await call(worker, "get", "/hr/me/overtime")).body;
    expect(mine[0]).toMatchObject({ countedHours: "2.00" });
  });

  it("chặn vượt 50% giờ chuẩn, trùng giờ ca, trùng phiếu, 40 giờ tháng, người chưa thành niên", async () => {
    expect((await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-11-10", startTime: "17:30", endTime: "22:00" }))).body.error.message).toContain("trong ngày");
    expect((await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-11-10", startTime: "16:00", endTime: "18:00" }))).body.error.message).toContain("ca làm việc");
    expect((await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-11-09", startTime: "20:00", endTime: "21:00" }))).body.error.message).toContain("Trùng");
    for (const date of ["2026-11-08", "2026-11-15", "2026-11-22"]) {
      const rest = await call(worker, "post", "/hr/me/overtime", overtime({ workDate: date, startTime: "08:00", endTime: "20:00" }));
      expect(rest.status, JSON.stringify(rest.body)).toBe(201);
      expect(rest.body.dayKind).toBe("rest_day");
    }
    const preview = await call(worker, "post", "/hr/me/overtime/preview", overtime({ workDate: "2026-11-29", startTime: "08:00", endTime: "10:00" }));
    expect(preview.body).toMatchObject({ monthUsedHours: "39.00", violations: ["monthLimit"] });
    expect((await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-11-29", startTime: "08:00", endTime: "10:00" }))).body.error.message).toContain("40 giờ");
    expect((await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-11-30", startTime: "08:00", endTime: "21:00" }))).status).toBe(400);
    const minor = await call(manager, "post", "/hr/overtime", overtime({ employeeId: minorId, workDate: "2026-12-05", startTime: "13:00", endTime: "15:00" }));
    expect(minor.body.error.message).toContain("chưa thành niên");
  });

  it("trưởng phòng lập: chờ người lao động đồng ý hoặc từ chối; người không có tài khoản: nhân sự ghi nhận kèm văn bản", async () => {
    const asked = await call(manager, "post", "/hr/overtime", overtime({ employeeId, workDate: "2026-12-02", startTime: "18:00", endTime: "20:00" }));
    expect(asked.status, JSON.stringify(asked.body)).toBe(201);
    expect(asked.body).toMatchObject({ status: "awaiting_consent", consentStatus: "pending" });
    const notice = await pool.query("SELECT 1 FROM core.notifications WHERE kind = 'hr.overtime.consent'");
    expect(notice.rows.length).toBeGreaterThan(0);
    expect((await call(manager, "post", `/hr/me/overtime/${asked.body.id}/consent`, { agree: true })).status).toBe(403);
    const agreed = await call(worker, "post", `/hr/me/overtime/${asked.body.id}/consent`, { agree: true });
    expect(agreed.body).toMatchObject({ status: "approved", consentStatus: "agreed" });
    const second = await call(manager, "post", "/hr/overtime", overtime({ employeeId, workDate: "2026-12-03", startTime: "18:00", endTime: "20:00" }));
    expect((await call(worker, "post", `/hr/me/overtime/${second.body.id}/consent`, { agree: false })).body.status).toBe("declined");
    expect((await call(manager, "post", "/hr/overtime", overtime({ employeeId: offlineId, workDate: "2026-12-02", startTime: "18:00", endTime: "20:00" }))).status).toBe(400);
    const withFile = await manager
      .call("post", "/hr/overtime", { companyId: retail })
      .field("employeeId", offlineId)
      .field("workDate", "2026-12-02")
      .field("startTime", "18:00")
      .field("endTime", "20:00")
      .field("workContent", "Kiểm kê")
      .field("workLocation", "Kho")
      .attach("file", pdf, "dong-y.pdf");
    expect(withFile.status).toBe(403);
    const recorded = await hr
      .call("post", "/hr/overtime", { companyId: retail })
      .field("employeeId", offlineId)
      .field("workDate", "2026-12-02")
      .field("startTime", "18:00")
      .field("endTime", "20:00")
      .field("workContent", "Kiểm kê")
      .field("workLocation", "Kho")
      .attach("file", pdf, "dong-y.pdf");
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(201);
    expect(recorded.body).toMatchObject({ status: "approved", consentStatus: "document" });
    const list = (await call(manager, "get", "/hr/overtime?month=2026-12")).body;
    expect(list.length).toBe(3);
    expect((await call(viewer, "get", "/hr/overtime?month=2026-12")).status).toBe(403);
    const totals = (await call(hr, "get", "/hr/overtime/totals?month=2026-11")).body;
    expect(totals.find((row: { employeeId: string }) => row.employeeId === employeeId)).toMatchObject({ monthHours: "39.00", monthRemaining: "1.00" });
  });
});

describe("CONG_VIEC_47 bảng công tháng (KICHBAN_KIEMTHU_451)", () => {
  it("tổng hợp dòng từ công ngày, nghỉ, tăng ca; chỉ mở xác nhận khi tháng đã kết thúc", async () => {
    await call(hr, "post", "/hr/attendance/punches", { employeeId, workDate: "2026-10-01", checkIn: "08:00", checkOut: "17:00", reason: "Nhập bù" });
    await call(hr, "post", "/hr/leave/adjustments", { employeeId, leaveYear: 2026, days: "5", reason: "Số dư ban đầu" });
    const types = (await call(hr, "get", "/hr/leave/types")).body as { id: string; systemCode: string }[];
    const leave = await hr
      .call("post", "/hr/leave/requests", { companyId: retail })
      .field("employeeId", employeeId)
      .field("leaveTypeId", types.find((type) => type.systemCode === "annual")!.id)
      .field("fromDate", "2026-10-02")
      .field("fromHalf", "full")
      .field("toDate", "2026-10-02")
      .field("toHalf", "full");
    expect(leave.status, JSON.stringify(leave.body)).toBe(201);
    const rest = await hr
      .call("post", "/hr/overtime", { companyId: retail })
      .field("employeeId", employeeId)
      .field("workDate", "2026-10-04")
      .field("startTime", "08:00")
      .field("endTime", "12:00")
      .field("workContent", "Kiểm kê")
      .field("workLocation", "Kho")
      .attach("file", pdf, "dong-y.pdf");
    expect(rest.status, JSON.stringify(rest.body)).toBe(201);
    expect((await call(viewer, "get", "/hr/timesheets/2026-10")).status).toBe(403);
    const sheet = (await call(hr, "get", "/hr/timesheets/2026-10")).body;
    expect(sheet).toMatchObject({ status: "open", monthEnded: true, canManage: true });
    const line = sheet.lines.find((item: { employeeId: string }) => item.employeeId === employeeId);
    expect(line).toMatchObject({
      monthStandardUnits: "24.50",
      standardUnits: "24.50",
      standardHours: "196.00",
      workedUnits: "1.00",
      workedHours: "8.00",
      annualLeaveUnits: "1.00",
      absentUnits: "22.50",
      paidUnits: "2.00",
      overtimeRestDayHours: "4.00",
      annualLeaveBalanceEnd: "4.00",
      confirmationStatus: "pending",
    });
    expect(sheet.lines.find((item: { employeeId: string }) => item.employeeId === minorId)).toMatchObject({ employmentFrom: "2026-10-01", standardUnits: "24.50" });
    expect((await call(hr, "post", "/hr/timesheets/2026-11/open-confirmation", { deadline: "2026-12-05" })).status).toBe(409);
    expect((await call(hr, "post", "/hr/timesheets/2026-10/open-confirmation", { deadline: "2026-11-11" })).status).toBe(400);
    expect((await call(manager, "post", "/hr/timesheets/2026-10/open-confirmation", { deadline: "2026-11-13" })).status).toBe(403);
    const opened = await call(hr, "post", "/hr/timesheets/2026-10/open-confirmation", { deadline: "2026-11-13" });
    expect(opened.body).toMatchObject({ status: "confirming", confirmationDeadline: "2026-11-13" });
  });

  it("người lao động giải trình, nhân sự trả lời; dữ liệu đổi thì xác nhận lại; hết hạn tự xác nhận; chốt khóa dữ liệu tháng", async () => {
    expect((await call(worker, "get", "/hr/me/timesheets/2026-10")).body.line).toMatchObject({ workedUnits: "1.00", confirmationStatus: "pending" });
    await call(worker, "post", "/hr/me/timesheets/2026-10/dispute", { note: "Ngày 05/10 tôi có đi làm, máy không nhận vân tay" });
    expect((await call(hr, "post", "/hr/timesheets/2026-10/close")).body.error.message).toContain("giải trình");
    await call(hr, "post", "/hr/attendance/punches", { employeeId, workDate: "2026-10-05", checkIn: "08:00", checkOut: "17:00", reason: "Đối chiếu camera" });
    const replied = await call(hr, "post", `/hr/timesheets/2026-10/lines/${employeeId}/reply`, { reply: "Đã ghi công ngày 05/10" });
    expect(replied.body.lines.find((item: { employeeId: string }) => item.employeeId === employeeId)).toMatchObject({ workedUnits: "2.00", confirmationStatus: "pending" });
    expect((await call(worker, "post", "/hr/me/timesheets/2026-10/confirm")).body.line).toMatchObject({ confirmationStatus: "confirmed" });
    await call(hr, "post", "/hr/attendance/punches", { employeeId, workDate: "2026-10-06", checkIn: "08:00", checkOut: "17:00", reason: "Bổ sung" });
    expect((await call(worker, "get", "/hr/me/timesheets/2026-10")).body.line.confirmationStatus).toBe("pending");
    at("2026-11-14T10:00:00+07:00");
    expect(await application.get(TimesheetsService).autoConfirm()).toBeGreaterThan(0);
    expect((await call(worker, "get", "/hr/me/timesheets/2026-10")).body.line.confirmationStatus).toBe("auto_confirmed");
    // Tháng 10 có phần phép đã cộng; ngày công hưởng lương dưới 50% nên bị trừ lại khi chốt.
    await pool.query("INSERT INTO hr.leave_ledger (company_id, employee_id, leave_year, kind, days, accrual_month) VALUES ($1, $2, 2026, 'accrual', 1, '2026-10-01')", [retail, employeeId]);
    const closed = await call(hr, "post", "/hr/timesheets/2026-10/close");
    expect(closed.body).toMatchObject({ status: "closed" });
    const reversal = await pool.query("SELECT days::text FROM hr.leave_ledger WHERE employee_id = $1 AND kind = 'month_reversal'", [employeeId]);
    expect(reversal.rows).toEqual([{ days: "-1.00" }]);
    const event = await pool.query("SELECT payload FROM core.outbox_events WHERE event_type = 'hr.timesheet.closed'");
    expect(event.rows[0].payload).toMatchObject({ companyId: retail, year: 2026, month: 10 });
    expect((await call(hr, "post", "/hr/attendance/punches", { employeeId, workDate: "2026-10-07", checkIn: "08:00", reason: "Sau chốt" })).status).toBe(409);
    expect((await call(worker, "post", "/hr/me/overtime", overtime({ workDate: "2026-10-10", startTime: "13:00", endTime: "15:00" }))).status).toBe(409);
  });

  it("mở lại chỉ khi bảng lương chưa chốt; hoàn phần trừ phép", async () => {
    await pool.query("UPDATE hr.timesheet_periods SET payroll_locked_at = now() WHERE company_id = $1 AND year = 2026 AND month = 10", [retail]);
    expect((await call(hr, "post", "/hr/timesheets/2026-10/reopen", { reason: "Sai công" })).body.error.message).toContain("Bảng lương");
    await pool.query("UPDATE hr.timesheet_periods SET payroll_locked_at = NULL WHERE company_id = $1 AND year = 2026 AND month = 10", [retail]);
    const reopened = await call(hr, "post", "/hr/timesheets/2026-10/reopen", { reason: "Sai công" });
    expect(reopened.body.status).toBe("open");
    expect((await pool.query("SELECT 1 FROM hr.leave_ledger WHERE employee_id = $1 AND kind = 'month_reversal'", [employeeId])).rows).toHaveLength(0);
    const exported = await call(hr, "get", "/hr/timesheets/2026-10/export");
    expect(exported.status).toBe(200);
    expect(exported.headers["content-type"]).toContain("spreadsheetml");
  });
});
