// CONG_VIEC_46 lát L0: hồ sơ nhân sự, dữ liệu nhạy cảm, quá trình công tác (TIEUCHI_NGHIEMTHU_287 đến 289, 293; KICHBAN_KIEMTHU_434, 435, 436, 441 phần hồ sơ của tôi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { messages } from "i18n";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { WorkEventsService } from "../src/hr/work-events.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let hrManager: Session;
let hrStaff: Session;
let tradingAdmin: Session;
let accountingDepartment: string;
let financeDepartment: string;
let linkedUser: string;
const retail: string = testIds.retailCompany;
const headOffice: string = testIds.headOfficeBranch;
const warehouseBranch: string = testIds.binhDuongWarehouse;
const pdfHeader = Buffer.from("%PDF-1.4 tep thu");
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);

async function assign(email: string, name: string, role: string, companyId = retail) {
  const id = await createTestUser(pool, email, name, [{ companyId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, companyId]);
  return { id, session: await signIn(application, email) };
}
// Lỗi từng trường trả câu đã dịch theo khóa.
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "patch" | "delete", path: string, body?: unknown, companyId = retail) => session.call(method, path, { companyId, body });

const baseEmployee = {
  fullName: "Lê Thị Bích Ngọc",
  gender: "female",
  birthDate: "1998-04-12",
  identityNumber: "079198003456",
  residence: "Quận 7, Thành phố Hồ Chí Minh",
  phone: "0912345678",
  bankName: "Vietcombank",
  bankAccountNumber: "0071001237890",
  taxCode: "8312345678",
  hireDate: "2025-09-15",
  jobTitle: "Kế toán viên tập sự",
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  hrManager = (await assign("quanly.nhansu@vcomm.test", "Quản lý nhân sự", "hr_manager")).session;
  hrStaff = (await assign("nhanvien.nhansu@vcomm.test", "Nhân viên nhân sự", "hr_staff")).session;
  tradingAdmin = (await assign("quantri.vct.ns@vcomm.test", "Quản trị VCT", "company_admin", testIds.tradingCompany)).session;
  const departments = await pool.query<{ id: string }>(`INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KT', 'Phòng Kế toán'), ($1, 'TC', 'Phòng Tài chính') RETURNING id`, [
    retail,
  ]);
  accountingDepartment = departments.rows[0]!.id;
  financeDepartment = departments.rows[1]!.id;
  linkedUser = await createTestUser(pool, "ngoc.le@vcomm.test", "Lê Thị Bích Ngọc", [{ companyId: retail }]);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_46 hồ sơ nhân sự", () => {
  let employeeId: string;

  it("KICHBAN_KIEMTHU_434: lập hồ sơ, mã tự cấp, kiểm dữ liệu, liên kết tài khoản", async () => {
    const missing = await call(hrStaff, "post", "/hr/employees", { ...baseEmployee, identityNumber: "123", departmentId: undefined });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields).toMatchObject({ identityNumber: message("citizenIdInvalid"), departmentId: message("required"), branchId: message("required") });

    const child = await call(hrStaff, "post", "/hr/employees", { ...baseEmployee, birthDate: "2011-01-01", departmentId: accountingDepartment, branchId: headOffice });
    expect(child.status).toBe(400);
    expect(child.body.error.fields.birthDate).toBe(message("employeeUnderFifteen"));

    const created = await call(hrStaff, "post", "/hr/employees", { ...baseEmployee, departmentId: accountingDepartment, branchId: headOffice, userId: linkedUser });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    employeeId = created.body.id;
    expect(created.body.code).toBe("NV-VCR-000001");
    expect(created.body).toMatchObject({ identityNumber: "********3456", bankAccountNumber: "********7890", jobTitle: "Kế toán viên tập sự", departmentName: "Phòng Kế toán", isMinor: false });

    // Vào làm đã hiệu lực: phòng ban, chức danh của tài khoản liên kết cập nhật ngay.
    const membership = await pool.query("SELECT department_id, default_branch_id, job_title FROM core.user_company_memberships WHERE user_id = $1 AND company_id = $2", [linkedUser, retail]);
    expect(membership.rows[0]).toEqual({ department_id: accountingDepartment, default_branch_id: headOffice, job_title: "Kế toán viên tập sự" });

    const duplicate = await call(hrStaff, "post", "/hr/employees", { ...baseEmployee, fullName: "Người khác", departmentId: accountingDepartment, branchId: headOffice });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.fields.identityNumber).toBe(message("employeeIdentityExists"));

    const manualCode = await call(hrStaff, "post", "/hr/employees", {
      ...baseEmployee,
      code: "nv-cu-01",
      fullName: "Phạm Gia Huy",
      birthDate: "2009-05-20",
      identityNumber: "074209000123",
      hireDate: "2026-11-03",
      departmentId: accountingDepartment,
      branchId: warehouseBranch,
      jobTitle: "Nhân viên kho",
      userId: linkedUser,
    });
    expect(manualCode.status).toBe(400);
    expect(manualCode.body.error.fields.userId).toBe(message("employeeUserLinked"));
    const minor = await call(hrStaff, "post", "/hr/employees", {
      ...baseEmployee,
      code: "nv-cu-01",
      fullName: "Phạm Gia Huy",
      birthDate: "2009-05-20",
      identityNumber: "074209000123",
      hireDate: "2026-11-03",
      departmentId: accountingDepartment,
      branchId: warehouseBranch,
      jobTitle: "Nhân viên kho",
    });
    expect(minor.status).toBe(201);
    expect(minor.body).toMatchObject({ code: "nv-cu-01", isMinor: true });
    const sameCode = await call(hrStaff, "post", "/hr/employees", { ...baseEmployee, code: "NV-CU-01", identityNumber: "001200000999", departmentId: accountingDepartment, branchId: headOffice });
    expect(sameCode.body.error.fields.code).toBe(message("employeeCodeExists"));

    const list = await call(hrStaff, "get", "/hr/employees?search=Ngọc");
    expect(list.body.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ code: "NV-VCR-000001", departmentName: "Phòng Kế toán", branchName: "Trụ sở Thành phố Hồ Chí Minh" });
  });

  it("KICHBAN_KIEMTHU_435: số giấy tờ mã hóa, hiện có nhật ký, quyền, cách ly công ty", async () => {
    const stored = await pool.query("SELECT identity_encrypted::text AS identity, bank_account_encrypted::text AS bank, tax_code_last4 FROM hr.employees WHERE id = $1", [employeeId]);
    expect(stored.rows[0].identity).not.toContain("079198003456");
    expect(Buffer.from(stored.rows[0].identity.replace(/^\\x/, ""), "hex").toString("latin1")).not.toContain("079198003456");
    expect(stored.rows[0].tax_code_last4).toBe("5678");

    expect((await call(hrStaff, "post", `/hr/employees/${employeeId}/reveal`, { field: "identityNumber" })).status).toBe(403);
    const revealed = await call(hrManager, "post", `/hr/employees/${employeeId}/reveal`, { field: "identityNumber" });
    expect(revealed.status).toBe(201);
    expect(revealed.body.value).toBe("079198003456");
    const audit = await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'employee.reveal' AND entity_id = $1", [employeeId]);
    expect(audit.rows).toHaveLength(1);
    expect(JSON.stringify(audit.rows[0].after_data)).not.toContain("079198003456");
    const createAudit = await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'employee.create' AND entity_id = $1", [employeeId]);
    expect(JSON.stringify(createAudit.rows[0].after_data)).not.toContain("079198003456");
    expect(JSON.stringify(createAudit.rows[0].after_data)).not.toContain("0071001237890");

    // Tệp giấy tờ: nhân viên nhân sự tải lên được, không tải xuống được; thiếu đồng ý thì cảnh báo.
    const upload = await hrStaff.call("post", `/hr/employees/${employeeId}/documents`, { companyId: retail }).field("kind", "identity_image").attach("file", pngHeader, "can-cuoc.png");
    expect(upload.status, JSON.stringify(upload.body)).toBe(201);
    expect((await call(hrStaff, "get", `/hr/employees/${employeeId}`)).body.missingConsent).toBe(true);
    const wrongType = await hrStaff.call("post", `/hr/employees/${employeeId}/documents`, { companyId: retail }).field("kind", "other").attach("file", pdfHeader, "gia.png");
    expect(wrongType.body.error.fields.file).toBe(message("attachmentTypeInvalid"));
    const noDate = await hrStaff.call("post", `/hr/employees/${employeeId}/documents`, { companyId: retail }).field("kind", "data_consent").attach("file", pdfHeader, "dong-y.pdf");
    expect(noDate.body.error.fields.consentDate).toBe(message("required"));
    const consent = await hrStaff
      .call("post", `/hr/employees/${employeeId}/documents`, { companyId: retail })
      .field("kind", "data_consent")
      .field("consentDate", "2025-09-15")
      .attach("file", pdfHeader, "dong-y-du-lieu.pdf");
    expect(consent.status).toBe(201);
    const detail = await call(hrStaff, "get", `/hr/employees/${employeeId}`);
    expect(detail.body).toMatchObject({ missingConsent: false, consentDate: "2025-09-15", canViewIdentity: false });
    const documentId = consent.body.find((item: { kind: string }) => item.kind === "identity_image").id;
    expect((await call(hrStaff, "get", `/hr/documents/${documentId}`)).status).toBe(403);
    const download = await call(hrManager, "get", `/hr/documents/${documentId}`);
    expect(download.status).toBe(200);
    expect(download.headers["cache-control"]).toBe("no-store");
    expect((await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'employee.document.download' AND entity_id = $1", [employeeId])).rows).toHaveLength(1);

    // Người phụ thuộc: số định danh che.
    const dependents = await call(hrStaff, "post", `/hr/employees/${employeeId}/dependents`, {
      fullName: "Nguyễn Minh An",
      relationship: "child",
      birthDate: "2022-06-02",
      identityNumber: "079222000011",
      deductionFrom: "2025-09-01",
    });
    expect(dependents.status).toBe(201);
    expect(dependents.body[0]).toMatchObject({ identityNumber: "********0011", deductionTo: null });
    const badMonth = await call(hrStaff, "post", `/hr/employees/${employeeId}/dependents`, { fullName: "A", relationship: "child", birthDate: "2022-06-02", deductionFrom: "2025-09-15" });
    expect(badMonth.status).toBe(400);

    // Công ty khác: 404; người không có quyền nhân sự: 403.
    expect((await call(tradingAdmin, "get", `/hr/employees/${employeeId}`, undefined, testIds.tradingCompany)).status).toBe(404);
    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    expect((await call(keeper, "get", "/hr/employees")).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_436: quyết định công tác cập nhật thành viên công ty khi đến ngày hiệu lực", async () => {
    const future = await call(hrStaff, "post", `/hr/employees/${employeeId}/work-events`, {
      kind: "transfer",
      effectiveDate: "2026-12-01",
      decisionNo: "QĐ-15/2026",
      departmentId: financeDepartment,
    });
    expect(future.status, JSON.stringify(future.body)).toBe(201);
    const pending = future.body.find((item: { effectiveDate: string }) => item.effectiveDate === "2026-12-01");
    expect(pending).toMatchObject({ effective: false, appliedAt: null, departmentName: "Phòng Tài chính" });
    const membership = () =>
      pool.query("SELECT department_id, job_title FROM core.user_company_memberships WHERE user_id = $1 AND company_id = $2", [linkedUser, retail]).then((result) => result.rows[0]);
    expect((await membership()).department_id).toBe(accountingDepartment);

    // Ghi lùi ngày: áp dụng ngay (chỉ đổi chức danh, giữ phòng ban).
    const backdated = await call(hrStaff, "post", `/hr/employees/${employeeId}/work-events`, { kind: "title_change", effectiveDate: "2026-03-01", jobTitle: "Kế toán viên" });
    expect(backdated.status).toBe(201);
    expect(await membership()).toEqual({ department_id: accountingDepartment, job_title: "Kế toán viên" });
    expect((await call(hrStaff, "post", `/hr/employees/${employeeId}/work-events`, { kind: "transfer", effectiveDate: "2026-03-01", branchId: warehouseBranch })).body.error.fields.effectiveDate).toBe(
      message("workEventSameDay"),
    );
    expect((await call(hrStaff, "post", `/hr/employees/${employeeId}/work-events`, { kind: "transfer", effectiveDate: "2025-01-01", branchId: warehouseBranch })).body.error.fields.effectiveDate).toBe(
      message("workEventBeforeHire"),
    );
    const applied = backdated.body.find((item: { effectiveDate: string }) => item.effectiveDate === "2026-03-01");
    expect((await call(hrStaff, "delete", `/hr/employees/${employeeId}/work-events/${applied.id}`)).status).toBe(409);

    // Đến ngày hiệu lực: việc nền áp dụng đúng một lần.
    testClock.fixed = new Date("2026-12-01T00:10:00+07:00");
    const workEvents = application.get(WorkEventsService);
    expect(await workEvents.applyDue()).toBe(1);
    expect(await membership()).toEqual({ department_id: financeDepartment, job_title: "Kế toán viên" });
    expect(await workEvents.applyDue()).toBe(0);
    const detail = await call(hrStaff, "get", `/hr/employees/${employeeId}`);
    expect(detail.body).toMatchObject({ departmentName: "Phòng Tài chính", jobTitle: "Kế toán viên" });
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
  });

  it("KICHBAN_KIEMTHU_441 (hồ sơ của tôi): nhân viên xem hồ sơ của mình, hiện số giấy tờ của mình", async () => {
    const own = await signIn(application, "ngoc.le@vcomm.test");
    const me = await call(own, "get", "/hr/me");
    expect(me.status).toBe(200);
    expect(me.body.employee).toMatchObject({ code: "NV-VCR-000001", identityNumber: "********3456", canManage: false });
    expect(me.body.workEvents.length).toBeGreaterThanOrEqual(3);
    expect((await call(own, "post", "/hr/me/reveal", { field: "bankAccountNumber" })).body.value).toBe("0071001237890");
    expect((await call(own, "get", `/hr/employees/${employeeId}`)).status).toBe(403);
    expect((await call(retailAdmin, "get", "/hr/me")).status).toBe(404);
  });

  it("sửa hồ sơ: giữ số mã hóa khi bỏ trống, xung đột phiên bản", async () => {
    const before = await call(hrStaff, "get", `/hr/employees/${employeeId}`);
    const { identityNumber: _identity, bankAccountNumber: _bank, taxCode: _tax, hireDate: _hire, jobTitle: _title, ...rest } = baseEmployee;
    const updated = await call(hrStaff, "patch", `/hr/employees/${employeeId}`, { ...rest, phone: "0909000111", version: before.body.version });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body).toMatchObject({ phone: "0909000111", identityNumber: "********3456", bankAccountNumber: "********7890", taxCode: "********5678" });
    expect((await call(hrStaff, "patch", `/hr/employees/${employeeId}`, { ...rest, version: before.body.version })).status).toBe(409);
  });
});
