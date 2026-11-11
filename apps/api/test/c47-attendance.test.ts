// CONG_VIEC_47 lát L0: ca, lịch, xếp ca, ngày lễ, lượt chấm thủ công, nhập tệp, công ngày
// (TIEUCHI_NGHIEMTHU_295, 296; KICHBAN_KIEMTHU_444, 445, 446).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { signIn, type Session } from "./helpers";
import { department, hrEmployee, officeSetup, retail, userWithRole } from "./c47-helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hr: Session;
let manager: Session;
let viewer: Session;
let plain: Session;
let groupAdmin: Session;
let sales: string;
let warehouse: string;
let khoa: string;
let huy: string;
let shifts: { office: string; saturday: string; schedule: string };
const call = (session: Session, method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const csv = (content: string) => Buffer.from(content, "utf8");
const upload = (session: Session, content: Buffer, name: string, confirm: boolean) =>
  session.call("post", "/hr/attendance/imports", { companyId: retail }).field("confirm", String(confirm)).attach("file", content, name);
const grid = async (session: Session, month = "2026-11") => (await call(session, "get", `/hr/attendance/grid?month=${month}`)).body;
const dayOf = async (employeeId: string, date: string) => (await call(hr, "get", `/hr/attendance/days/${employeeId}/${date}`)).body;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T10:00:00+07:00");
  hr = (await userWithRole(application, pool, "nhansu.chamcong@vcomm.test", "Nhân viên nhân sự chấm công", "hr_staff")).session;
  const managerUser = await userWithRole(application, pool, "truongkho.chamcong@vcomm.test", "Trưởng kho", null);
  manager = managerUser.session;
  viewer = (await userWithRole(application, pool, "xem.chamcong@vcomm.test", "Chỉ xem chấm công", null)).session;
  plain = (await userWithRole(application, pool, "nhanvien.chamcong@vcomm.test", "Nhân viên thường", null)).session;
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const viewRole = (
    await pool.query<{ id: string }>(
      "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'xem_cham_cong', 'Xem chấm công', 'View attendance', false, 'active') RETURNING id",
      [retail],
    )
  ).rows[0]!.id;
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'hr.access'), ($1, 'hr.attendance.view')", [viewRole]);
  const viewerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'xem.chamcong@vcomm.test'")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2020-01-01')", [viewerId, viewRole, retail]);
  sales = await department(pool, "KDCC", "Phòng Kinh doanh chấm công", null);
  warehouse = await department(pool, "KHOCC", "Kho chấm công", managerUser.id);
  khoa = await hrEmployee(hr, { fullName: "Trần Minh Khoa", departmentId: sales });
  huy = await hrEmployee(hr, { fullName: "Phạm Gia Huy", departmentId: warehouse, birthDate: "2009-05-20", hireDate: "2026-11-02" });
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_47 ca, lịch, ngày lễ (KICHBAN_KIEMTHU_444)", () => {
  it("chặn ca vượt 8 giờ, nghỉ ngoài ca, trùng mã; quyền", async () => {
    const tooLong = await call(hr, "post", "/hr/attendance/shifts", {
      code: "DAI",
      name: "Ca dài",
      startTime: "07:00",
      endTime: "17:00",
      breakStart: "12:00",
      breakMinutes: 60,
      breakPaid: false,
      workUnits: "1",
    });
    expect(tooLong.status, JSON.stringify(tooLong.body)).toBe(400);
    expect(tooLong.body.error.fields.endTime).toBeDefined();
    const outside = await call(hr, "post", "/hr/attendance/shifts", {
      code: "NGOAI",
      name: "Ca",
      startTime: "08:00",
      endTime: "12:00",
      breakStart: "13:00",
      breakMinutes: 30,
      breakPaid: false,
      workUnits: "0.5",
    });
    expect(outside.status).toBe(400);
    expect((await call(viewer, "post", "/hr/attendance/shifts", { code: "X", name: "X", startTime: "08:00", endTime: "12:00", breakMinutes: 0, breakPaid: false, workUnits: "0.5" })).status).toBe(403);
    expect((await call(plain, "get", "/hr/attendance/shifts")).status).toBe(403);
    shifts = await officeSetup(hr);
    const duplicate = await call(hr, "post", "/hr/attendance/shifts", { code: "hc", name: "Trùng", startTime: "08:00", endTime: "12:00", breakMinutes: 0, breakPaid: false, workUnits: "0.5" });
    expect(duplicate.status).toBe(400);
    expect((await call(viewer, "get", "/hr/attendance/shifts")).body).toHaveLength(2);
  });

  it("theo tuần cho phép ca 10 giờ; lịch tuần không quá 48 giờ", async () => {
    const settings = (await call(hr, "get", "/hr/attendance/settings")).body;
    expect(settings).toMatchObject({ workingTimeMode: "daily", graceMinutes: 5, version: 0 });
    const weekly = await call(hr, "put", "/hr/attendance/settings", { ...settings, workingTimeMode: "weekly" });
    expect(weekly.status, JSON.stringify(weekly.body)).toBe(200);
    const long = await call(hr, "post", "/hr/attendance/shifts", {
      code: "C10",
      name: "Ca 10 giờ",
      startTime: "07:00",
      endTime: "18:00",
      breakStart: "12:00",
      breakMinutes: 60,
      breakPaid: false,
      workUnits: "1",
    });
    expect(long.status, JSON.stringify(long.body)).toBe(201);
    const tooMany = await call(hr, "post", "/hr/attendance/schedules", {
      name: "Quá giờ",
      isDefault: false,
      shiftIds: [long.body.id, long.body.id, long.body.id, long.body.id, long.body.id, null, null],
    });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.fields.shiftIds).toBeDefined();
    const back = await call(hr, "put", "/hr/attendance/settings", { ...weekly.body, workingTimeMode: "daily" });
    expect(back.status).toBe(200);
    await call(hr, "patch", `/hr/attendance/shifts/${long.body.id}`, { ...long.body, status: "inactive", startTime: "07:00", endTime: "15:00", breakStart: "11:00" });
  });

  it("ngày lễ chung chỉ quyền tập đoàn; ngày nghỉ riêng của công ty", async () => {
    expect((await call(hr, "post", "/hr/attendance/holidays/generate", { year: 2026 })).status).toBe(403);
    const generated = await call(groupAdmin, "post", "/hr/attendance/holidays/generate", { year: 2026 });
    expect(generated.status, JSON.stringify(generated.body)).toBe(201);
    expect(generated.body.items.map((item: { date: string }) => item.date)).toEqual(["2026-01-01", "2026-04-30", "2026-05-01", "2026-09-02"]);
    const own = await call(hr, "post", "/hr/attendance/holidays", { date: "2026-11-06", name: "Ngày thành lập công ty", foreignersOnly: false, scope: "company" });
    expect(own.status, JSON.stringify(own.body)).toBe(201);
    expect((await call(hr, "post", "/hr/attendance/holidays", { date: "2026-11-06", name: "Trùng", foreignersOnly: false, scope: "company" })).status).toBe(400);
    expect((await call(hr, "post", "/hr/attendance/holidays", { date: "2026-11-09", name: "Chung", foreignersOnly: false, scope: "group" })).status).toBe(403);
    const list = (await call(viewer, "get", "/hr/attendance/holidays?year=2026")).body;
    expect(list.items).toHaveLength(5);
    expect(list.canManageCompany).toBe(false);
  });
});

describe("CONG_VIEC_47 lượt chấm, công ngày (KICHBAN_KIEMTHU_445, 446)", () => {
  it("nhập tệp: xem trước lỗi, ghi lượt đạt, bỏ trùng", async () => {
    expect((await call(hr, "put", `/hr/attendance/codes/${khoa}`, { attendanceCode: "1001" })).status).toBe(200);
    const taken = await call(hr, "put", `/hr/attendance/codes/${huy}`, { attendanceCode: "1001" });
    expect(taken.status).toBe(400);
    expect((await call(hr, "put", `/hr/attendance/codes/${huy}`, { attendanceCode: "1002" })).status).toBe(200);
    const file = csv(
      [
        "Mã chấm công,Ngày giờ,Mã máy",
        "1001,2026-11-02 07:58,MAY01",
        "1001,02/11/2026 17:10,MAY01",
        "1001,2026-11-03 08:29,MAY01",
        "1001,2026-11-03 17:02,MAY01",
        "1001,2026-11-04 07:59,MAY01",
        "1001,2026-11-04 07:59,MAY01",
        "9999,2026-11-04 08:00,MAY01",
        "1002,2026-11-03 ngày sai,MAY01",
        "1002,2026-11-02 07:50,MAY02",
        "1002,2026-11-02 17:05,MAY02",
      ].join("\n"),
    );
    const preview = await upload(hr, file, "may-cham-cong.csv", false);
    expect(preview.status, JSON.stringify(preview.body)).toBe(201);
    expect(preview.body).toMatchObject({ totalRows: 10, accepted: 7, duplicates: 1, imported: false });
    expect(preview.body.errors).toEqual([
      { row: 8, messageKey: "attendanceCodeNotFound" },
      { row: 9, messageKey: "attendanceTimeInvalid" },
    ]);
    expect((await upload(viewer, file, "may-cham-cong.csv", true)).status).toBe(403);
    const imported = await upload(hr, file, "may-cham-cong.csv", true);
    expect(imported.body).toMatchObject({ accepted: 7, duplicates: 1, imported: true });
    const again = await upload(hr, file, "may-cham-cong.csv", true);
    expect(again.body).toMatchObject({ accepted: 0, duplicates: 8 });
    expect((await call(viewer, "get", "/hr/attendance/imports")).body[0]).toMatchObject({ fileName: "may-cham-cong.csv" });
  });

  it("lưới công: đủ công, đi muộn, thiếu lượt, ngày lễ công ty, vắng; trưởng phòng chỉ thấy phòng mình", async () => {
    const all = await grid(hr);
    const row = all.rows.find((item: { employeeId: string }) => item.employeeId === khoa);
    const byDate = Object.fromEntries(row.days.map((day: { date: string }) => [day.date, day]));
    expect(byDate["2026-11-02"]).toMatchObject({ status: "present", workedUnits: "1.00" });
    expect(byDate["2026-11-03"]).toMatchObject({ status: "present", workedUnits: "0.94", lateMinutes: 29 });
    expect(byDate["2026-11-04"]).toMatchObject({ status: "missing_punch", workedUnits: "0.00" });
    expect(byDate["2026-11-05"]).toMatchObject({ status: "absent" });
    expect(byDate["2026-11-06"]).toMatchObject({ status: "holiday", dayKind: "holiday" });
    expect(byDate["2026-11-07"]).toMatchObject({ status: "absent", plannedUnits: "0.50" });
    expect(byDate["2026-11-08"]).toMatchObject({ status: "rest" });
    expect(byDate["2026-11-11"]).toMatchObject({ status: "scheduled" });
    expect(byDate["2026-11-12"]).toBeUndefined();
    const own = await grid(manager);
    expect(own.rows.map((item: { employeeId: string }) => item.employeeId)).toEqual([huy]);
    expect(own.canManage).toBe(false);
    expect((await call(manager, "get", `/hr/attendance/days/${khoa}/2026-11-02`)).status).toBe(404);
    expect((await call(plain, "get", "/hr/attendance/grid?month=2026-11")).status).toBe(403);
    const late = await call(hr, "get", "/hr/attendance/grid?month=2026-11&status=late");
    expect(late.body.rows.map((item: { employeeId: string }) => item.employeeId)).toEqual([khoa]);
  });

  it("ghi thủ công bổ sung lượt ra; chỉ xóa được lượt thủ công", async () => {
    expect((await call(manager, "post", "/hr/attendance/punches", { employeeId: huy, workDate: "2026-11-03", checkIn: "08:00", reason: "Máy hỏng" })).status).toBe(403);
    const noReason = await call(hr, "post", "/hr/attendance/punches", { employeeId: khoa, workDate: "2026-11-04", checkOut: "17:00" });
    expect(noReason.status).toBe(400);
    const fixed = await call(hr, "post", "/hr/attendance/punches", { employeeId: khoa, workDate: "2026-11-04", checkOut: "17:00", reason: "Máy chấm công kho mất điện" });
    expect(fixed.status, JSON.stringify(fixed.body)).toBe(201);
    expect(fixed.body.day).toMatchObject({ status: "present", workedUnits: "1.00" });
    const manual = fixed.body.punches.find((punch: { source: string }) => punch.source === "manual");
    const device = fixed.body.punches.find((punch: { source: string }) => punch.source === "device");
    expect(manual).toMatchObject({ reason: "Máy chấm công kho mất điện", canDelete: true });
    expect(device.canDelete).toBe(false);
    expect((await call(hr, "post", "/hr/attendance/punches", { employeeId: khoa, workDate: "2026-11-04", checkOut: "17:00", reason: "Lặp" })).status).toBe(409);
    expect((await call(hr, "post", `/hr/attendance/punches/${device.id}/delete`, { reason: "Sai" })).status).toBe(409);
    expect((await call(hr, "post", `/hr/attendance/punches/${manual.id}/delete`, { reason: "Ghi nhầm" })).status).toBe(204);
    expect((await dayOf(khoa, "2026-11-04")).day.status).toBe("missing_punch");
    expect((await call(hr, "post", "/hr/attendance/punches", { employeeId: huy, workDate: "2026-11-01", checkIn: "08:00", reason: "Trước ngày vào làm" })).status).toBe(400);
  });

  it("đổi ân hạn tính lại công", async () => {
    const settings = (await call(hr, "get", "/hr/attendance/settings")).body;
    expect((await call(hr, "put", "/hr/attendance/settings", { ...settings, graceMinutes: 30 })).status).toBe(200);
    expect((await dayOf(khoa, "2026-11-03")).day).toMatchObject({ lateMinutes: 0, workedUnits: "1.00" });
    expect((await call(hr, "put", "/hr/attendance/settings", { ...settings, graceMinutes: 5 })).status).toBe(409);
  });
});

describe("CONG_VIEC_47 xếp ca theo tuần (KICHBAN_KIEMTHU_444)", () => {
  it("trưởng phòng xếp ca phòng mình; chặn vượt 40 giờ với người chưa thành niên; kỳ đã chốt bị chặn", async () => {
    const roster = await call(manager, "get", "/hr/attendance/roster?weekStart=2026-11-16");
    expect(roster.status, JSON.stringify(roster.body)).toBe(200);
    expect(roster.body.rows).toHaveLength(1);
    expect(roster.body.rows[0]).toMatchObject({ employeeId: huy, isMinor: true, weeklyMinutes: 2640, warnings: ["weeklyHoursExceeded"] });
    // Lịch mặc định 44 giờ vượt 40 giờ của người chưa thành niên: đổi thứ bảy thành nghỉ thì đạt.
    const saved = await call(manager, "put", "/hr/attendance/roster", { cells: [{ employeeId: huy, date: "2026-11-21", shiftId: null }] });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const after = (await call(manager, "get", "/hr/attendance/roster?weekStart=2026-11-16")).body.rows[0];
    expect(after).toMatchObject({ weeklyMinutes: 2400, warnings: [] });
    expect(after.cells[5]).toMatchObject({ shiftId: null, fromRoster: true });
    const tooMuch = await call(manager, "put", "/hr/attendance/roster", { cells: [{ employeeId: huy, date: "2026-11-21", shiftId: shifts.saturday }] });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error.message).toContain("40 giờ");
    expect((await call(manager, "put", "/hr/attendance/roster", { cells: [{ employeeId: khoa, date: "2026-11-21", shiftId: null }] })).status).toBe(403);
    expect((await call(manager, "get", "/hr/attendance/roster?weekStart=2026-11-17")).status).toBe(400);
    await pool.query("INSERT INTO hr.timesheet_periods (company_id, year, month, status, closed_at) VALUES ($1, 2026, 10, 'closed', now())", [retail]);
    const closed = await call(hr, "put", "/hr/attendance/roster", { cells: [{ employeeId: khoa, date: "2026-10-30", shiftId: null }] });
    expect(closed.status).toBe(409);
    expect((await call(hr, "post", "/hr/attendance/punches", { employeeId: khoa, workDate: "2026-10-30", checkIn: "08:00", reason: "Kỳ đã chốt" })).status).toBe(409);
  });

  it("gán lịch cho phòng ban có hiệu lực theo ngày; công ty khác không thấy", async () => {
    const shiftOnly = await call(hr, "post", "/hr/attendance/schedules", {
      name: "Kinh doanh nghỉ thứ bảy",
      isDefault: false,
      shiftIds: [shifts.office, shifts.office, shifts.office, shifts.office, shifts.office, null, null],
    });
    expect(shiftOnly.status).toBe(201);
    const assigned = await call(hr, "post", `/hr/attendance/schedules/${shiftOnly.body.id}/assignments`, { departmentId: sales, effectiveFrom: "2026-11-07" });
    expect(assigned.status, JSON.stringify(assigned.body)).toBe(201);
    expect((await dayOf(khoa, "2026-11-07")).day).toMatchObject({ status: "rest", dayKind: "rest_day" });
    const other = await signIn(application, "quantri.tapdoan@vcomm.test");
    const foreign = await other.call("get", `/hr/attendance/days/${khoa}/2026-11-02`, { companyId: testIds.tradingCompany });
    expect(foreign.status).toBe(404);
  });
});
