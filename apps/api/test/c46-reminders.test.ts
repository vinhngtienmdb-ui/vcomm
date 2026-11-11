// CONG_VIEC_46 lát L2: nhắc hết hạn hợp đồng, danh sách sắp hết hạn (TIEUCHI_NGHIEMTHU_292; KICHBAN_KIEMTHU_440).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { ContractRemindersService, reminderMilestone } from "../src/hr/contract-reminders.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hrStaff: Session;
let hrStaffId: string;
let managerId: string;
let department: string;
const retail: string = testIds.retailCompany;
const pdf = Buffer.from("%PDF-1.4 ban da ky");
const call = (session: Session, method: "get" | "post", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const at = (day: string) => {
  testClock.fixed = new Date(`${day}T07:00:00+07:00`);
};
const sendDue = () => application.get(ContractRemindersService).sendDue();
const notices = (userId: string) =>
  pool
    .query<{ title: string; payload: { milestone: string } }>("SELECT title, payload FROM core.notifications WHERE kind = 'hr.contract.expiring' AND user_id = $1 ORDER BY created_at", [userId])
    .then((result) => result.rows);

async function signed(employeeId: string, values: Record<string, unknown>) {
  const created = await call(hrStaff, "post", "/hr/contracts", {
    employeeId,
    kind: "fixed_term",
    jobTitle: "Nhân viên",
    departmentId: department,
    branchId: testIds.headOfficeBranch,
    salary: "15000000",
    signerName: "Nguyễn Văn An",
    signerTitle: "Giám đốc",
    ...values,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await call(hrStaff, "post", `/hr/contracts/${created.body.id}/submit`);
  const result = await hrStaff.call("post", `/hr/contracts/${created.body.id}/sign`, { companyId: retail }).field("signDate", "2025-01-01").attach("file", pdf, "ky.pdf");
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body.id as string;
}

async function employee(name: string, identity: string) {
  const created = await call(hrStaff, "post", "/hr/employees", {
    fullName: name,
    gender: "female",
    birthDate: "1995-01-01",
    identityNumber: identity,
    residence: "Thành phố Hồ Chí Minh",
    hireDate: "2024-01-01",
    departmentId: department,
    branchId: testIds.headOfficeBranch,
    jobTitle: "Nhân viên",
  });
  return created.body.id as string;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  at("2026-11-11");
  hrStaffId = await createTestUser(pool, "nhansu.nhac@vcomm.test", "Nhân viên nhân sự", [{ companyId: retail }]);
  const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'hr_staff' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [hrStaffId, role, retail]);
  hrStaff = await signIn(application, "nhansu.nhac@vcomm.test");
  managerId = await createTestUser(pool, "truongphong.kd@vcomm.test", "Trưởng phòng Kinh doanh", [{ companyId: retail }]);
  department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name, manager_user_id) VALUES ($1, 'KD', 'Phòng Kinh doanh', $2) RETURNING id", [retail, managerId]))
    .rows[0]!.id;
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_46 nhắc hết hạn hợp đồng", () => {
  it("mốc nhắc theo số ngày còn lại", () => {
    expect([31, 30, 8, 7, 0, -1, -7, -8, -15, -22, -29, -35, -36].map(reminderMilestone)).toEqual([
      null,
      "before_30",
      "before_30",
      "before_7",
      "before_7",
      "after_1",
      "after_1",
      "after_8",
      "after_15",
      "after_22",
      "after_29",
      "after_29",
      null,
    ]);
  });

  it("KICHBAN_KIEMTHU_440: nhắc đúng mốc, một lần, đúng người nhận; hợp đồng tiếp theo dừng nhắc; danh sách sắp hết hạn", async () => {
    const first = await employee("Nguyễn Thu Hà", "079095100001");
    const contract = await signed(first, { effectiveDate: "2025-12-12", endDate: "2026-12-11" });
    const probationEmployee = await employee("Trần Văn Nam", "079095100002");
    await signed(probationEmployee, { kind: "probation", effectiveDate: "2026-10-01", endDate: "2026-11-09", probationLevel: "college", officialSalary: "15000000", salary: "13000000" });
    const old = await employee("Lý Thị Mai", "079095100003");
    await signed(old, { effectiveDate: "2025-10-01", endDate: "2026-09-30" });

    // Hôm nay 11/11: hợp đồng còn 30 ngày (mốc trước 30 ngày), thử việc đã hết 2 ngày; hợp đồng hết 42 ngày không nhắc nữa.
    expect(await sendDue()).toBe(2);
    expect(await sendDue()).toBe(0);
    const staff = await notices(hrStaffId);
    expect(staff.map((item) => item.payload.milestone).sort()).toEqual(["after_1", "before_30"]);
    expect(staff.find((item) => item.payload.milestone === "after_1")!.title).toContain("cần thông báo kết quả thử việc");
    expect((await notices(managerId)).length).toBe(2);
    expect((await notices(testIds.retailAdmin)).length).toBe(2);
    expect((await notices(testIds.warehouseKeeper)).length).toBe(0);

    const expiring = await call(hrStaff, "get", "/hr/contracts?expiring=true");
    expect(expiring.body.data.map((item: { employeeName: string; daysToEnd: number; overThirtyDays: boolean }) => [item.employeeName, item.daysToEnd, item.overThirtyDays])).toEqual([
      ["Lý Thị Mai", -42, true],
      ["Trần Văn Nam", -2, false],
      ["Nguyễn Thu Hà", 30, false],
    ]);

    at("2026-12-05");
    await sendDue();
    at("2026-12-12");
    await sendDue();
    const afterEnd = (await notices(hrStaffId)).find((item) => item.payload.milestone === "after_1" && item.title.includes("Nguyễn Thu Hà"));
    expect(afterEnd!.title).toContain("còn 29 ngày trước khi theo luật thành hợp đồng không xác định thời hạn");
    expect((await notices(hrStaffId)).filter((item) => item.title.includes("Nguyễn Thu Hà")).map((item) => item.payload.milestone)).toEqual(["before_30", "before_7", "after_1"]);

    // Ký hợp đồng tiếp theo trong 30 ngày: dừng nhắc, rời danh sách sắp hết hạn.
    await signed(first, { kind: "indefinite", effectiveDate: "2026-12-12" });
    at("2026-12-19");
    await sendDue();
    expect((await notices(hrStaffId)).filter((item) => item.title.includes("Nguyễn Thu Hà"))).toHaveLength(3);
    const after = await call(hrStaff, "get", "/hr/contracts?expiring=true");
    expect(after.body.data.some((item: { id: string }) => item.id === contract)).toBe(false);
    at("2026-11-11");
  });
});
