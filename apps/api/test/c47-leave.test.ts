// CONG_VIEC_47 lát L2: sổ phép năm, đơn nghỉ (TIEUCHI_NGHIEMTHU_298, 299; KICHBAN_KIEMTHU_448, 449).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { LeaveService, carryoverDeadline, entitlementOn, monthlyAccrual } from "../src/hr/leave.service";
import { signIn, type Session } from "./helpers";
import { department, hrEmployee, officeSetup, retail, userWithRole } from "./c47-helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hr: Session;
let worker: Session;
let manager: Session;
let outsider: Session;
let employeeId: string;
let otherEmployee: string;
let types: Record<string, string>;
const pdf = Buffer.from("%PDF-1.4 giay ra vien");
const call = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const request = (session: Session, path: string, values: Record<string, string>, file?: Buffer) => {
  let builder = session.call("post", path, { companyId: retail });
  for (const [key, value] of Object.entries(values)) builder = builder.field(key, value);
  return file ? builder.attach("file", file, "giay.pdf") : builder;
};
const mine = (values: Record<string, string>) => request(worker, "/hr/me/leave/requests", values);
const balance = async () => (await call(worker, "get", "/hr/me/leave")).body.balance;
const accrue = () => application.get(LeaveService).accrueDue();

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T10:00:00+07:00");
  hr = (await userWithRole(application, pool, "nhansu.phep@vcomm.test", "Nhân sự phép", "hr_staff")).session;
  const workerUser = await userWithRole(application, pool, "nhanvien.phep@vcomm.test", "Nhân viên nghỉ phép", null);
  worker = workerUser.session;
  const managerUser = await userWithRole(application, pool, "truongphong.phep@vcomm.test", "Trưởng phòng phép", null);
  manager = managerUser.session;
  outsider = (await userWithRole(application, pool, "ngoai.phep@vcomm.test", "Người ngoài", null)).session;
  const team = await department(pool, "PHEP", "Phòng nghỉ phép", managerUser.id);
  const other = await department(pool, "PHEPK", "Phòng khác", null);
  await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2 AND company_id = $3", [team, workerUser.id, retail]);
  employeeId = await hrEmployee(hr, { fullName: "Lê Thị Bích Ngọc", departmentId: team, userId: workerUser.id, hireDate: "2021-03-01" });
  otherEmployee = await hrEmployee(hr, { fullName: "Trần Minh Khoa", departmentId: other });
  await officeSetup(hr);
  const listed = (await call(hr, "get", "/hr/leave/types")).body as { id: string; systemCode: string | null }[];
  types = Object.fromEntries(listed.map((type) => [type.systemCode, type.id]));
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_47 số ngày phép năm (KICHBAN_KIEMTHU_448)", () => {
  it("chế độ, chưa thành niên, thâm niên; cộng dần 12 tháng đúng số ngày cả năm; hạn phép tồn", () => {
    const employee = { birth_date: "1995-01-01", hire_date: "2021-03-01", work_condition: null, seniority_start: null };
    expect(entitlementOn(employee, "2026-02-28")).toBe(12);
    expect(entitlementOn(employee, "2026-03-01")).toBe(13);
    expect(entitlementOn({ ...employee, work_condition: "very_hazardous" }, "2025-01-01")).toBe(16);
    expect(entitlementOn({ ...employee, birth_date: "2010-01-01", hire_date: "2026-01-01" }, "2026-06-01")).toBe(14);
    for (const days of [12, 13, 14, 16])
      expect(Math.round(Array.from({ length: 12 }, (_, index) => monthlyAccrual(days, index + 1)).reduce((total, value) => total + value, 0) * 100) / 100).toBe(days);
    expect(carryoverDeadline(2025, 3)).toBe("2026-03-31");
    expect(carryoverDeadline(2025, 12)).toBe("2026-12-31");
    expect(carryoverDeadline(2025, 36)).toBe("2028-12-31");
  });

  it("việc nền cộng phép tháng một lần; điều chỉnh số dư ban đầu; loại nghỉ theo luật tạo sẵn", async () => {
    expect(Object.keys(types)).toEqual(expect.arrayContaining(["annual", "marriage", "bereavement", "unpaid_personal", "sick", "maternity"]));
    const first = await accrue();
    expect(first.accrued).toBeGreaterThanOrEqual(2);
    expect((await accrue()).accrued).toBe(0);
    const settings = (await call(hr, "get", "/hr/attendance/settings")).body;
    expect((await call(hr, "put", "/hr/attendance/settings", { ...settings, carryoverMonths: 12 })).status).toBe(200);
    expect((await call(worker, "post", "/hr/leave/adjustments", { employeeId, leaveYear: 2025, days: "2", reason: "Số dư cũ" })).status).toBe(403);
    expect((await call(hr, "post", "/hr/leave/adjustments", { employeeId, leaveYear: 2025, days: "2", reason: "Số dư năm 2025 từ hệ thống cũ" })).status).toBe(201);
    expect((await call(hr, "post", "/hr/leave/adjustments", { employeeId, leaveYear: 2026, days: "8", reason: "Số dư năm 2026 từ hệ thống cũ" })).status).toBe(201);
    const current = await balance();
    // Tháng 11 năm làm việc thứ 6: 13 ngày/năm, cộng 11,92 − 10,83 = 1,09.
    expect(current).toMatchObject({ entitlementDays: 13, available: "11.09" });
    expect(current.years.map((year: { leaveYear: number; balance: string }) => [year.leaveYear, year.balance])).toEqual([
      [2025, "2.00"],
      [2026, "9.09"],
    ]);
  });
});

describe("CONG_VIEC_47 đơn nghỉ (KICHBAN_KIEMTHU_449)", () => {
  it("chưa có chính sách duyệt: gửi là duyệt; số ngày theo lịch (nửa ngày, ca nửa công); trừ năm cũ trước; công ghi nghỉ", async () => {
    const preview = await call(worker, "post", "/hr/me/leave/preview", { leaveTypeId: types.annual, fromDate: "2026-11-09", fromHalf: "full", toDate: "2026-11-10", toHalf: "morning" });
    expect(preview.body).toMatchObject({ days: "1.50", availableBefore: "11.09", availableAfter: "9.59" });
    const created = await mine({ leaveTypeId: types.annual!, fromDate: "2026-11-09", fromHalf: "full", toDate: "2026-11-10", toHalf: "morning", reason: "Việc gia đình" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "approved", days: "1.50", requestNo: expect.stringMatching(/^NP-VCR-2026-/), source: "self" });
    const years = (await balance()).years.map((year: { leaveYear: number; balance: string }) => [year.leaveYear, year.balance]);
    expect(years).toEqual([
      [2025, "0.50"],
      [2026, "9.09"],
    ]);
    const full = (await call(hr, "get", `/hr/attendance/days/${employeeId}/2026-11-09`)).body.day;
    expect(full).toMatchObject({ status: "leave", leaveUnits: "1.00", leavePayGroup: "annual", workedUnits: "0.00" });
    const half = (await call(hr, "get", `/hr/attendance/days/${employeeId}/2026-11-10`)).body.day;
    expect(half).toMatchObject({ status: "absent", leaveUnits: "0.50" });
    const saturday = await call(worker, "post", "/hr/me/leave/preview", { leaveTypeId: types.annual, fromDate: "2026-11-07", fromHalf: "full", toDate: "2026-11-08", toHalf: "full" });
    expect(saturday.body.days).toBe("0.50");
    expect((await call(worker, "post", "/hr/me/leave/preview", { leaveTypeId: types.annual, fromDate: "2026-11-08", fromHalf: "full", toDate: "2026-11-08", toHalf: "full" })).status).toBe(409);
  });

  it("chặn trùng thời gian, vượt số dư, vượt số ngày theo luật; loại bảo hiểm xã hội chỉ nhân sự ghi nhận kèm tệp", async () => {
    const overlap = await mine({ leaveTypeId: types.annual!, fromDate: "2026-11-10", fromHalf: "full", toDate: "2026-11-10", toHalf: "full" });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.message).toContain("Trùng");
    const afternoon = await mine({ leaveTypeId: types.unpaid_agreed!, fromDate: "2026-11-10", fromHalf: "afternoon", toDate: "2026-11-10", toHalf: "full" });
    expect(afternoon.status, JSON.stringify(afternoon.body)).toBe(201);
    expect((await mine({ leaveTypeId: types.annual!, fromDate: "2026-11-16", fromHalf: "full", toDate: "2026-12-04", toHalf: "full" })).body.error.message).toContain("không đủ");
    expect((await mine({ leaveTypeId: types.marriage!, fromDate: "2026-11-23", fromHalf: "full", toDate: "2026-11-26", toHalf: "full" })).body.error.message).toContain("Điều 115");
    expect((await mine({ leaveTypeId: types.sick!, fromDate: "2026-11-05", fromHalf: "full", toDate: "2026-11-05", toHalf: "full" })).status).toBe(409);
    const noFile = await request(hr, "/hr/leave/requests", { employeeId, leaveTypeId: types.sick!, fromDate: "2026-11-05", fromHalf: "full", toDate: "2026-11-06", toHalf: "full" });
    expect(noFile.status).toBe(400);
    const sick = await request(
      hr,
      "/hr/leave/requests",
      { employeeId, leaveTypeId: types.sick!, fromDate: "2026-11-05", fromHalf: "full", toDate: "2026-11-06", toHalf: "full", reason: "Giấy ra viện" },
      pdf,
    );
    expect(sick.status, JSON.stringify(sick.body)).toBe(201);
    expect(sick.body).toMatchObject({ status: "approved", source: "hr", days: "2.00", hasAttachment: true });
    expect((await call(hr, "get", `/hr/attendance/days/${employeeId}/2026-11-05`)).body.day).toMatchObject({ status: "leave", leavePayGroup: "social_insurance" });
    expect((await request(worker, "/hr/leave/requests", { employeeId, leaveTypeId: types.sick!, fromDate: "2026-11-03", fromHalf: "full", toDate: "2026-11-03", toHalf: "full" }, pdf)).status).toBe(
      403,
    );
  });

  it("có chính sách duyệt trưởng phòng: chờ duyệt giữ chỗ số dư, rút, duyệt xong trừ phép; trưởng phòng chỉ thấy phòng mình", async () => {
    const admin = await signIn(application, "quantri.vcr@vcomm.test");
    const policy = await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "hr.leave_request",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "department_manager" }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const pending = await mine({ leaveTypeId: types.annual!, fromDate: "2026-11-23", fromHalf: "full", toDate: "2026-11-24", toHalf: "full" });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true });
    expect((await balance()).pending).toBe("2.00");
    expect((await call(worker, "post", `/hr/me/leave/requests/${pending.body.id}/withdraw`)).body.status).toBe("withdrawn");
    const again = await mine({ leaveTypeId: types.annual!, fromDate: "2026-11-23", fromHalf: "full", toDate: "2026-11-24", toHalf: "full" });
    const visible = (await call(manager, "get", "/hr/leave/requests?status=pending")).body.map((item: { id: string }) => item.id);
    expect(visible).toEqual([again.body.id]);
    await request(hr, "/hr/leave/requests", { employeeId: otherEmployee, leaveTypeId: types.unpaid_agreed!, fromDate: "2026-11-02", fromHalf: "full", toDate: "2026-11-02", toHalf: "full" });
    expect((await call(manager, "get", "/hr/leave/requests")).body.every((item: { employeeId: string }) => item.employeeId === employeeId)).toBe(true);
    expect((await call(outsider, "get", "/hr/leave/requests")).status).toBe(403);
    await manager.call("post", `/approval-requests/${again.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    const after = await balance();
    expect(after).toMatchObject({ pending: "0.00", available: "7.59" });
  });

  it("hủy đơn: người lao động trước ngày bắt đầu, nhân sự khi kỳ chưa chốt; hoàn phép, tính lại công; phép tồn hết hạn", async () => {
    const requests = (await call(worker, "get", "/hr/me/leave")).body.requests as { id: string; fromDate: string; status: string; canCancel: boolean }[];
    const future = requests.find((item) => item.fromDate === "2026-11-23" && item.status === "approved")!;
    const past = requests.find((item) => item.fromDate === "2026-11-09")!;
    expect(future.canCancel).toBe(true);
    expect(past.canCancel).toBe(false);
    expect((await call(worker, "post", `/hr/me/leave/requests/${past.id}/cancel`, { reason: "Đổi lịch" })).status).toBe(409);
    expect((await call(worker, "post", `/hr/me/leave/requests/${future.id}/cancel`, { reason: "Đổi lịch" })).body.status).toBe("cancelled");
    expect((await call(hr, "post", `/hr/leave/requests/${past.id}/cancel`, { reason: "Đi làm bình thường" })).body.status).toBe("cancelled");
    expect((await balance()).available).toBe("11.09");
    expect((await call(hr, "get", `/hr/attendance/days/${employeeId}/2026-11-09`)).body.day).toMatchObject({ status: "absent", leaveUnits: "0.00" });
    const settings = (await call(hr, "get", "/hr/attendance/settings")).body;
    await call(hr, "put", "/hr/attendance/settings", { ...settings, carryoverMonths: 3 });
    expect((await accrue()).expired).toBeGreaterThanOrEqual(1);
    const expired = await balance();
    expect(expired.years.find((year: { leaveYear: number }) => year.leaveYear === 2025)).toMatchObject({ expired: "2.00", balance: "0.00" });
    expect(expired.available).toBe("9.09");
    const ledger = (await call(hr, "get", `/hr/leave/balances/${employeeId}`)).body.map((entry: { kind: string }) => entry.kind);
    expect(ledger).toEqual(expect.arrayContaining(["accrual", "adjustment", "usage", "expiry"]));
  });
});
