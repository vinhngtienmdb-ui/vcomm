// CONG_VIEC_47 lát L1: địa điểm chấm công, chấm trên ứng dụng (GPS, mạng công ty, mã QR động), đơn giải trình qua luồng duyệt
// (TIEUCHI_NGHIEMTHU_296, 297; KICHBAN_KIEMTHU_447).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { qrToken } from "../src/hr/attendance-locations.service";
import { signIn, type Session } from "./helpers";
import { department, hrEmployee, officeSetup, retail, userWithRole } from "./c47-helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hr: Session;
let worker: Session;
let stranger: Session;
let manager: Session;
let employeeId: string;
let gpsLocation: string;
let qrLocation: string;
const office = { latitude: 10.7296, longitude: 106.7218 };
const call = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const at = (instant: string) => {
  testClock.fixed = new Date(instant);
};
const location = (values: Record<string, unknown>) => ({ name: "Văn phòng", branchId: testIds.headOfficeBranch, ipRanges: [], qrEnabled: false, ...values });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  at("2026-11-09T07:50:00+07:00");
  hr = (await userWithRole(application, pool, "nhansu.ungdung@vcomm.test", "Nhân sự ứng dụng", "hr_staff")).session;
  const workerUser = await userWithRole(application, pool, "nhanvien.ungdung@vcomm.test", "Nhân viên chấm ứng dụng", null);
  worker = workerUser.session;
  stranger = (await userWithRole(application, pool, "khonglienket.ungdung@vcomm.test", "Chưa liên kết hồ sơ", null)).session;
  const managerUser = await userWithRole(application, pool, "truongphong.ungdung@vcomm.test", "Trưởng phòng ứng dụng", null);
  manager = managerUser.session;
  const team = await department(pool, "UDCC", "Phòng chấm ứng dụng", managerUser.id);
  await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2 AND company_id = $3", [team, workerUser.id, retail]);
  employeeId = await hrEmployee(hr, { fullName: "Võ Thị Thanh Hương", departmentId: team, userId: workerUser.id });
  await officeSetup(hr);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_47 địa điểm chấm công", () => {
  it("bắt buộc ít nhất một cách; GPS đủ ba trường; IP đúng dạng; quyền", async () => {
    expect((await call(hr, "post", "/hr/attendance/locations", location({}))).body.error.fields.qrEnabled).toBeDefined();
    expect((await call(hr, "post", "/hr/attendance/locations", location({ latitude: 10.7 }))).status).toBe(400);
    expect((await call(hr, "post", "/hr/attendance/locations", location({ ipRanges: ["300.1.1.0/24"] }))).body.error.fields["ipRanges.0"]).toBeDefined();
    expect((await call(worker, "post", "/hr/attendance/locations", location({ qrEnabled: true }))).status).toBe(403);
  });

  it("chưa có địa điểm thì không chấm được; người chưa liên kết hồ sơ bị chặn", async () => {
    const today = (await call(worker, "get", "/hr/me/attendance")).body;
    expect(today).toMatchObject({ employee: { id: employeeId }, shift: { code: "HC", start: "08:00", end: "17:00" }, nextAction: "in", locations: [] });
    const rejected = await call(worker, "post", "/hr/me/attendance/punch", { ...office, accuracyMeters: 10 });
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.message).toContain("địa điểm");
    expect((await call(stranger, "get", "/hr/me/attendance")).body.employee).toBeNull();
    expect((await call(stranger, "post", "/hr/me/attendance/punch", { ...office, accuracyMeters: 10 })).status).toBe(403);
  });
});

describe("CONG_VIEC_47 chấm công trên ứng dụng (KICHBAN_KIEMTHU_447)", () => {
  it("GPS: ngoài bán kính, độ chính xác kém bị từ chối; trong bán kính được nhận; chấm lặp trong 1 phút bị chặn", async () => {
    const created = await call(hr, "post", "/hr/attendance/locations", location({ ...office, radiusMeters: 150 }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    gpsLocation = created.body.id;
    expect((await call(worker, "post", "/hr/me/attendance/punch", { latitude: 10.74, longitude: 106.7218, accuracyMeters: 10 })).body.error.message).toContain("bán kính");
    expect((await call(worker, "post", "/hr/me/attendance/punch", { ...office, accuracyMeters: 500 })).status).toBe(409);
    const accepted = await call(worker, "post", "/hr/me/attendance/punch", { latitude: 10.7305, longitude: 106.7218, accuracyMeters: 15 });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
    expect(accepted.body).toMatchObject({ nextAction: "out", punches: [{ source: "app", method: "gps", locationName: "Văn phòng" }] });
    expect((await call(worker, "post", "/hr/me/attendance/punch", { ...office, accuracyMeters: 10 })).body.error.message).toContain("1 phút");
    const stored = (await pool.query("SELECT latitude::text, accuracy_meters::text, ip_address::text FROM hr.attendance_punches WHERE employee_id = $1", [employeeId])).rows[0];
    expect(stored).toMatchObject({ latitude: "10.730500", accuracy_meters: "15.0" });
  });

  it("mã QR động: mã hiện tại và mã liền trước được nhận; mã cũ hơn, mã giả bị từ chối; chỉ người quản lý chấm công mở màn hình mã", async () => {
    const created = await call(hr, "post", "/hr/attendance/locations", location({ name: "Kho QR", qrEnabled: true }));
    qrLocation = created.body.id;
    expect((await call(worker, "get", `/hr/attendance/locations/${qrLocation}/qr`)).status).toBe(403);
    expect((await call(hr, "get", `/hr/attendance/locations/${gpsLocation}/qr`)).status).toBe(409);
    at("2026-11-09T17:05:10+07:00");
    const qr = (await call(hr, "get", `/hr/attendance/locations/${qrLocation}/qr`)).body;
    expect(qr.path).toContain(`l=${qrLocation}&t=${qr.token}`);
    expect(qr.expiresInSeconds).toBeLessThanOrEqual(30);
    at("2026-11-09T17:05:40+07:00");
    expect((await call(worker, "post", "/hr/me/attendance/punch", { locationId: qrLocation, qrToken: "gia-mao-ma-qr" })).body.error.message).toContain("QR");
    const accepted = await call(worker, "post", "/hr/me/attendance/punch", { locationId: qrLocation, qrToken: qr.token });
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
    expect(accepted.body.punches.map((punch: { method: string }) => punch.method)).toEqual(["gps", "qr"]);
    at("2026-11-10T08:00:00+07:00");
    const old = qrToken(qrLocation, Math.floor(new Date("2026-11-10T07:58:00+07:00").getTime() / 30000));
    expect((await call(worker, "post", "/hr/me/attendance/punch", { locationId: qrLocation, qrToken: old })).status).toBe(409);
    const month = (await call(worker, "get", "/hr/me/attendance/month?month=2026-11")).body;
    expect(month.days.find((day: { date: string }) => day.date === "2026-11-09")).toMatchObject({ status: "present", workedUnits: "1.00" });
  });

  it("mạng công ty: địa chỉ IP thuộc dải thì nhận không cần GPS; địa điểm chi nhánh khác không áp dụng", async () => {
    const other = await call(hr, "post", "/hr/attendance/locations", location({ name: "Kho Bình Dương", branchId: testIds.binhDuongWarehouse, ipRanges: ["127.0.0.0/8", "::1/128"] }));
    expect(other.status, JSON.stringify(other.body)).toBe(201);
    expect((await call(worker, "post", "/hr/me/attendance/punch", {})).status).toBe(409);
    const own = await call(hr, "patch", `/hr/attendance/locations/${gpsLocation}`, location({ ...office, radiusMeters: 150, ipRanges: ["127.0.0.0/8", "::1/128"], version: 1 }));
    expect(own.status, JSON.stringify(own.body)).toBe(200);
    expect((await call(worker, "get", "/hr/me/attendance")).body.networkMatched).toBe(true);
    const accepted = await call(worker, "post", "/hr/me/attendance/punch", {});
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
    expect(accepted.body.punches.at(-1)).toMatchObject({ method: "ip" });
    const week = (await call(worker, "get", "/hr/me/attendance/week?weekStart=2026-11-09")).body;
    expect(week.days.map((day: { shiftCode: string | null }) => day.shiftCode)).toEqual(["HC", "HC", "HC", "HC", "HC", "T7", null]);
  });
});

describe("CONG_VIEC_47 đơn giải trình công (KICHBAN_KIEMTHU_447)", () => {
  it("chưa có chính sách duyệt: gửi xong là duyệt, ghi lượt giải trình, công cập nhật", async () => {
    at("2026-11-11T09:00:00+07:00");
    const future = await worker
      .call("post", "/hr/me/attendance/corrections", { companyId: retail })
      .field("workDate", "2026-11-12")
      .field("kind", "forgot")
      .field("checkIn", "08:00")
      .field("reason", "Quên");
    expect(future.status).toBe(400);
    const noTime = await worker.call("post", "/hr/me/attendance/corrections", { companyId: retail }).field("workDate", "2026-11-10").field("kind", "forgot").field("reason", "Quên");
    expect(noTime.status).toBe(400);
    const badFile = await worker
      .call("post", "/hr/me/attendance/corrections", { companyId: retail })
      .field("workDate", "2026-11-10")
      .field("kind", "forgot")
      .field("checkOut", "17:00")
      .field("reason", "Quên")
      .attach("file", Buffer.from("khong phai pdf"), "gia.pdf");
    expect(badFile.status).toBe(400);
    const created = await worker
      .call("post", "/hr/me/attendance/corrections", { companyId: retail })
      .field("workDate", "2026-11-10")
      .field("kind", "forgot")
      .field("checkOut", "17:00")
      .field("reason", "Quên chấm ra ca")
      .attach("file", Buffer.from("%PDF-1.4 xac nhan"), "xac-nhan.pdf");
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "approved", correctionNo: expect.stringMatching(/^GT-VCR-2026-/), hasAttachment: true });
    const day = (await call(hr, "get", `/hr/attendance/days/${employeeId}/2026-11-10`)).body;
    expect(day.punches.map((punch: { source: string }) => punch.source)).toEqual(["app", "correction"]);
    expect(day.day.status).toBe("present");
    expect((await call(hr, "get", `/hr/attendance/corrections/${created.body.id}/attachment`)).status).toBe(200);
    expect((await call(stranger, "get", `/hr/attendance/corrections/${created.body.id}/attachment`)).status).toBe(404);
  });

  it("có chính sách duyệt trưởng phòng: chờ duyệt, rút được; duyệt xong ghi lượt; giới hạn số đơn mỗi tháng", async () => {
    const admin = await signIn(application, "quantri.vcr@vcomm.test");
    const policy = await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "hr.attendance_correction",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "department_manager" }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const first = await worker
      .call("post", "/hr/me/attendance/corrections", { companyId: retail })
      .field("workDate", "2026-11-05")
      .field("kind", "business_trip")
      .field("checkIn", "08:00")
      .field("checkOut", "17:00")
      .field("reason", "Công tác Long An");
    expect(first.body).toMatchObject({ status: "pending", canWithdraw: true });
    const withdrawn = await call(worker, "post", `/hr/me/attendance/corrections/${first.body.id}/withdraw`);
    expect(withdrawn.body.status).toBe("withdrawn");
    const second = await worker
      .call("post", "/hr/me/attendance/corrections", { companyId: retail })
      .field("workDate", "2026-11-05")
      .field("kind", "business_trip")
      .field("checkIn", "08:00")
      .field("checkOut", "17:00")
      .field("reason", "Công tác Long An");
    const inbox = (await manager.call("get", "/approval-requests/inbox")).body;
    expect(inbox.map((item: { documentNo: string }) => item.documentNo)).toContain(second.body.correctionNo);
    expect((await call(manager, "get", "/hr/attendance/corrections?status=pending")).body.map((item: { id: string }) => item.id)).toEqual([second.body.id]);
    await manager.call("post", `/approval-requests/${second.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(worker, "get", "/hr/me/attendance/corrections")).body.find((item: { id: string }) => item.id === second.body.id).status).toBe("approved");
    expect((await call(hr, "get", `/hr/attendance/days/${employeeId}/2026-11-05`)).body.day).toMatchObject({ status: "present", workedUnits: "1.00" });
    const settings = (await call(hr, "get", "/hr/attendance/settings")).body;
    expect((await call(hr, "put", "/hr/attendance/settings", { ...settings, correctionMonthlyLimit: 2 })).status).toBe(200);
    const third = await worker
      .call("post", "/hr/me/attendance/corrections", { companyId: retail })
      .field("workDate", "2026-11-06")
      .field("kind", "forgot")
      .field("checkIn", "08:00")
      .field("reason", "Quên");
    expect(third.status).toBe(409);
    expect(third.body.error.message).toContain("tối đa");
  });
});
