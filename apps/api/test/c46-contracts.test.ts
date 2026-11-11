// CONG_VIEC_46 lát L1: hợp đồng lao động, phụ lục, nghỉ việc (TIEUCHI_NGHIEMTHU_290, 291, 293; KICHBAN_KIEMTHU_437, 438, 439, 441).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { WorkEventsService } from "../src/hr/work-events.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let hrStaff: Session;
let viewer: Session;
let approver: Session;
let department: string;
let otherDepartment: string;
let employeeUser: string;
// Phiếu thay đổi CONG_VIEC_48 mục 15: dòng phụ cấp lưu mới phải có loại phụ cấp.
let allowanceType: string;
const retail: string = testIds.retailCompany;
const branch: string = testIds.headOfficeBranch;
const pdf = Buffer.from("%PDF-1.4 ban da ky");
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "patch" | "delete", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const sign = (session: Session, path: string, signDate = "2026-11-10") => session.call("post", path, { companyId: retail }).field("signDate", signDate).attach("file", pdf, "ban-da-ky.pdf");

async function assign(email: string, name: string, role: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
  return signIn(application, email);
}

async function employee(name: string, identity: string, extra: Record<string, unknown> = {}) {
  const created = await call(hrStaff, "post", "/hr/employees", {
    fullName: name,
    gender: "male",
    birthDate: "1995-01-01",
    identityNumber: identity,
    residence: "Thành phố Hồ Chí Minh",
    hireDate: "2024-01-01",
    departmentId: department,
    branchId: branch,
    jobTitle: "Nhân viên",
    ...extra,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.id as string;
}

const contract = (employeeId: string, values: Record<string, unknown>) => ({
  employeeId,
  kind: "fixed_term",
  jobTitle: "Nhân viên",
  departmentId: department,
  branchId: branch,
  salary: "15000000",
  allowances: [{ name: "Ăn trưa", amount: "730000", allowanceTypeId: allowanceType }],
  signerName: "Nguyễn Văn An",
  signerTitle: "Giám đốc",
  ...values,
});

// Lập, gửi (chưa có chính sách duyệt thì duyệt ngay), xác nhận ký.
async function signedContract(employeeId: string, values: Record<string, unknown>) {
  const created = await call(hrStaff, "post", "/hr/contracts", contract(employeeId, values));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(hrStaff, "post", `/hr/contracts/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("approved");
  const signed = await sign(hrStaff, `/hr/contracts/${created.body.id}/sign`);
  expect(signed.status, JSON.stringify(signed.body)).toBe(201);
  return signed.body;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  hrStaff = await assign("nhanvien.nhansu.hd@vcomm.test", "Nhân viên nhân sự", "hr_staff");
  viewer = await assign("xem.hoso@vcomm.test", "Người xem hồ sơ", "employee");
  approver = await signIn(application, "phuc.le@vcomm.test");
  allowanceType = (
    await pool.query<{ id: string }>(
      "INSERT INTO hr.allowance_types (company_id, name, tax_mode, created_by, updated_by) SELECT $1, 'Phụ cấp chung', 'taxable', id, id FROM core.users WHERE email = 'quantri.vcr@vcomm.test' RETURNING id",
      [retail],
    )
  ).rows[0]!.id;
  // Người xem hồ sơ: chỉ hr.access, hr.employee.view (vai trò riêng công ty).
  const role = await pool.query<{ id: string }>(
    "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'hr_viewer', 'Xem hồ sơ', 'HR viewer', false, 'active') RETURNING id",
    [retail],
  );
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'hr.access'), ($1, 'hr.employee.view')", [role.rows[0]!.id]);
  const viewerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'xem.hoso@vcomm.test'")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [viewerId, role.rows[0]!.id, retail]);
  viewer = await signIn(application, "xem.hoso@vcomm.test");
  const departments = await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KD', 'Phòng Kinh doanh'), ($1, 'MK', 'Phòng Tiếp thị') RETURNING id", [
    retail,
  ]);
  department = departments.rows[0]!.id;
  otherDepartment = departments.rows[1]!.id;
  employeeUser = await createTestUser(pool, "khoa.tran@vcomm.test", "Trần Minh Khoa", [{ companyId: retail }]);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_46 hợp đồng lao động", () => {
  it("KICHBAN_KIEMTHU_437: kiểm luật, luồng duyệt, xác nhận ký, quyền xem lương", async () => {
    const id = await employee("Trần Minh Khoa", "079095000001", { userId: employeeUser });
    const tooLong = await call(hrStaff, "post", "/hr/contracts", contract(id, { effectiveDate: "2026-12-01", endDate: "2029-12-01" }));
    expect(tooLong.body.error.fields.endDate).toBe(message("contractOverThirtySixMonths"));
    expect((await call(hrStaff, "post", "/hr/contracts", contract(id, { effectiveDate: "2026-12-01", endDate: "2029-11-30" }))).status).toBe(201);
    const overlap = await call(hrStaff, "post", "/hr/contracts", contract(id, { kind: "indefinite", effectiveDate: "2027-01-01" }));
    expect(overlap.body.error.fields.effectiveDate).toBe(message("contractOverlap"));

    // Thử việc: số ngày theo mức công việc, lương ít nhất 85%.
    const probation = { kind: "probation", effectiveDate: "2026-09-01", probationLevel: "college", officialSalary: "15000000" };
    expect((await call(hrStaff, "post", "/hr/contracts", contract(id, { ...probation, endDate: "2026-10-31", salary: "13000000" }))).body.error.fields).toMatchObject({
      endDate: message("probationTooLong"),
    });
    expect((await call(hrStaff, "post", "/hr/contracts", contract(id, { ...probation, endDate: "2026-10-30", salary: "12000000" }))).body.error.fields.salary).toBe(message("probationSalaryTooLow"));
    const other = await call(hrStaff, "post", "/hr/contracts", contract(id, { ...probation, probationLevel: "other", effectiveDate: "2026-11-02", endDate: "2026-11-09", salary: "12750000" }));
    expect(other.body.error.fields.endDate).toBe(message("probationTooLong"));
    const trial = await call(hrStaff, "post", "/hr/contracts", contract(id, { ...probation, endDate: "2026-10-30", salary: "12750000" }));
    expect(trial.status, JSON.stringify(trial.body)).toBe(201);

    // Luồng duyệt: chính sách duyệt của loại hr.contract; người duyệt từ chối rồi đồng ý.
    await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "hr.contract",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    const pending = (await call(hrStaff, "post", `/hr/contracts/${trial.body.id}/submit`)).body;
    expect(pending).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^HDLD-VCR-2026-/), canWithdraw: true });
    expect((await sign(hrStaff, `/hr/contracts/${trial.body.id}/sign`)).body.error.code).toBe("BUSINESS_RULE");
    await approver.call("post", `/approval-requests/${pending.approvalRequestId}/decisions`, { body: { decision: "rejected", comment: "Sai lương" } });
    await application.get(OutboxService).dispatchPending();
    const rejected = (await call(hrStaff, "get", `/hr/contracts/${trial.body.id}`)).body;
    expect(rejected.status).toBe("rejected");
    const resubmitted = (await call(hrStaff, "post", `/hr/contracts/${trial.body.id}/submit`)).body;
    expect(resubmitted.documentNo).toBe(pending.documentNo);
    await approver.call("post", `/approval-requests/${resubmitted.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(hrStaff, "get", `/hr/contracts/${trial.body.id}`)).body.status).toBe("approved");
    const noFile = await hrStaff.call("post", `/hr/contracts/${trial.body.id}/sign`, { companyId: retail }).field("signDate", "2026-08-30");
    expect(noFile.body.error.fields.file).toBe(message("required"));
    const signed = await sign(hrStaff, `/hr/contracts/${trial.body.id}/sign`, "2026-08-30");
    expect(signed.body).toMatchObject({ status: "signed", validity: "expired", hasSignedFile: true, signDate: "2026-08-30" });
    expect((await call(hrStaff, "patch", `/hr/contracts/${trial.body.id}`, contract(id, { ...probation, endDate: "2026-10-30", salary: "13000000", version: signed.body.version }))).status).toBe(409);
    await pool.query("UPDATE core.approval_policies SET effective_from = '2026-01-01', effective_to = '2026-01-01' WHERE document_type_code = 'hr.contract'");

    // Quyền: người chỉ xem hồ sơ không thấy lương, không lập được; công việc khác không thử việc lại.
    const seen = await call(viewer, "get", `/hr/contracts/${trial.body.id}`);
    expect(seen.body).toMatchObject({ salary: null, canManage: false, current: { salary: null, allowances: null } });
    expect((await call(viewer, "post", "/hr/contracts", contract(id, { kind: "indefinite", effectiveDate: "2030-01-01" }))).status).toBe(403);
    expect((await call(viewer, "get", `/hr/contracts/${trial.body.id}/signed-file`)).status).toBe(403);
    const again = await call(hrStaff, "post", "/hr/contracts", contract(id, { ...probation, effectiveDate: "2026-11-01", endDate: "2026-11-20", salary: "12750000" }));
    expect(again.body.error.fields.kind).toBe(message("probationRepeated"));

    // Nhân viên xem hợp đồng đã ký của mình kèm lương, tải bản đã ký của mình.
    const own = await signIn(application, "khoa.tran@vcomm.test");
    const mine = await call(own, "get", "/hr/me/contracts");
    expect(mine.body.contracts).toHaveLength(1);
    expect(mine.body.contracts[0]).toMatchObject({ documentNo: pending.documentNo, salary: "12750000", approvalRequestId: null });
    expect((await call(own, "get", `/hr/me/contracts/${trial.body.id}/signed-file`)).status).toBe(200);
  });

  it("KICHBAN_KIEMTHU_438: chỉ ký thêm 01 lần hợp đồng xác định thời hạn; ngoại lệ có lý do; người nước ngoài", async () => {
    const id = await employee("Võ Thanh Tâm", "079095000002");
    await signedContract(id, { effectiveDate: "2024-01-01", endDate: "2024-12-31" });
    await signedContract(id, { effectiveDate: "2025-01-15", endDate: "2026-01-14" });
    const third = await call(hrStaff, "post", "/hr/contracts", contract(id, { effectiveDate: "2026-02-01", endDate: "2027-01-31" }));
    const blocked = await call(hrStaff, "post", `/hr/contracts/${third.body.id}/submit`);
    expect(blocked.body.error.fields.kind).toBe(message("fixedTermLimitReached"));
    // Cách quá 30 ngày thì chuỗi bị ngắt; ngoại lệ có lý do thì gửi được.
    const exception = await call(
      hrStaff,
      "patch",
      `/hr/contracts/${third.body.id}`,
      contract(id, { effectiveDate: "2026-02-01", endDate: "2027-01-31", legalExceptionReason: "Người lao động cao tuổi", version: third.body.version }),
    );
    expect((await call(hrStaff, "post", `/hr/contracts/${third.body.id}/submit`)).body).toMatchObject({
      status: "approved",
      legalExceptionReason: "Người lao động cao tuổi",
      version: exception.body.version + 1,
    });

    const foreigner = await employee("Kim Min Jun", "M12345678", { nationality: "KR", workPermitNumber: "GP-001", workPermitExpiry: "2026-06-30" });
    await signedContract(foreigner, { effectiveDate: "2024-01-01", endDate: "2024-12-31" });
    await signedContract(foreigner, { effectiveDate: "2025-01-01", endDate: "2025-12-31" });
    const beyond = await call(hrStaff, "post", "/hr/contracts", contract(foreigner, { effectiveDate: "2026-01-01", endDate: "2026-12-31" }));
    expect(beyond.body.error.fields.endDate).toBe(message("contractBeyondWorkPermit"));
    await signedContract(foreigner, { effectiveDate: "2026-01-01", endDate: "2026-06-30" });
  });

  it("KICHBAN_KIEMTHU_439: phụ lục không đổi thời hạn, giá trị hiện hành theo ngày, đổi vị trí tạo quyết định công tác", async () => {
    const id = await employee("Lê Văn Hùng", "079095000003", { userId: await createTestUser(pool, "hung.le@vcomm.test", "Lê Văn Hùng", [{ companyId: retail }]) });
    const signed = await signedContract(id, { effectiveDate: "2026-01-01", endDate: "2027-12-31" });
    expect((await call(hrStaff, "post", `/hr/contracts/${signed.id}/appendices`, { effectiveDate: "2028-01-15", salary: "18000000", description: "Tăng lương" })).body.error.fields.effectiveDate).toBe(
      message("appendixOutsideContract"),
    );
    expect((await call(hrStaff, "post", `/hr/contracts/${signed.id}/appendices`, { effectiveDate: "2026-06-01", endDate: "2029-01-01", description: "Gia hạn" })).status).toBe(400);
    const raise = await call(hrStaff, "post", `/hr/contracts/${signed.id}/appendices`, {
      effectiveDate: "2026-06-01",
      salary: "16500000",
      jobTitle: "Trưởng nhóm",
      allowances: [{ name: "Điện thoại", amount: "300000", allowanceTypeId: allowanceType }],
      description: "Sửa Điều 3: mức lương 16.500.000 đồng; chức danh Trưởng nhóm",
    });
    expect(raise.status, JSON.stringify(raise.body)).toBe(201);
    const appendixId = raise.body.appendices[0].id;
    const submitted = await call(hrStaff, "post", `/hr/contracts/${signed.id}/appendices/${appendixId}/submit`);
    expect(submitted.body.appendices[0]).toMatchObject({ status: "approved", documentNo: `${signed.documentNo}/PL01` });
    expect(submitted.body.current.salary).toBe("15000000");
    const after = await sign(hrStaff, `/hr/contracts/${signed.id}/appendices/${appendixId}/sign`);
    expect(after.status, JSON.stringify(after.body)).toBe(201);
    expect(after.body.current).toMatchObject({ salary: "16500000", jobTitle: "Trưởng nhóm", allowances: [{ name: "Điện thoại", amount: "300000" }] });
    expect(after.body.original).toMatchObject({ salary: "15000000", jobTitle: "Nhân viên" });
    expect(after.body.endDate).toBe("2027-12-31");
    const listed = await call(hrStaff, "get", `/hr/contracts?employeeId=${id}`);
    expect(listed.body.data[0].salary).toBe("16500000");
    const events = (await call(hrStaff, "get", `/hr/employees/${id}/work-events`)).body;
    expect(events.find((event: { effectiveDate: string }) => event.effectiveDate === "2026-06-01")).toMatchObject({ kind: "contract", jobTitle: "Trưởng nhóm", sourceType: "appendix" });
    const membership = await pool.query("SELECT job_title FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id WHERE u.email = 'hung.le@vcomm.test'");
    expect(membership.rows[0].job_title).toBe("Trưởng nhóm");

    // Phụ lục tương lai đổi phòng ban: đến ngày hiệu lực mới cập nhật tài khoản.
    const move = await call(hrStaff, "post", `/hr/contracts/${signed.id}/appendices`, { effectiveDate: "2026-12-01", departmentId: otherDepartment, description: "Điều chuyển Phòng Tiếp thị" });
    const moveId = move.body.appendices.find((item: { effectiveDate: string }) => item.effectiveDate === "2026-12-01").id;
    await call(hrStaff, "post", `/hr/contracts/${signed.id}/appendices/${moveId}/submit`);
    await sign(hrStaff, `/hr/contracts/${signed.id}/appendices/${moveId}/sign`);
    const department = () => pool.query("SELECT department_id FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id WHERE u.email = 'hung.le@vcomm.test'");
    expect((await department()).rows[0].department_id).not.toBe(otherDepartment);
    testClock.fixed = new Date("2026-12-01T01:00:00+07:00");
    await application.get(WorkEventsService).applyDue();
    expect((await department()).rows[0].department_id).toBe(otherDepartment);
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
  });

  it("KICHBAN_KIEMTHU_441: nghỉ việc chấm dứt hợp đồng, hủy hợp đồng chưa ký, hồ sơ đã nghỉ chỉ người quản lý hồ sơ thấy; lao động chưa thành niên", async () => {
    const id = await employee("Đặng Quốc Việt", "079095000004", { userId: await createTestUser(pool, "viet.dang@vcomm.test", "Đặng Quốc Việt", [{ companyId: retail }]) });
    const signed = await signedContract(id, { effectiveDate: "2025-01-01", endDate: "2027-12-31" });
    const draft = await call(hrStaff, "post", "/hr/contracts", contract(id, { effectiveDate: "2028-01-01", endDate: "2028-12-31" }));
    expect(draft.status).toBe(201);
    expect((await call(hrStaff, "post", `/hr/employees/${id}/terminate`, { terminationDate: "2026-11-30", reason: "mutual", note: "Thỏa thuận" })).status).toBe(204);
    expect((await call(hrStaff, "get", `/hr/contracts/${signed.id}`)).body).toMatchObject({ status: "terminated", terminationDate: "2026-11-30", terminationReason: "mutual", validity: "terminated" });
    expect((await call(hrStaff, "get", `/hr/contracts/${draft.body.id}`)).body).toMatchObject({ status: "cancelled", cancelReason: "employee_terminated" });
    const notice = await pool.query("SELECT 1 FROM core.notifications WHERE kind = 'hr.employee.terminated' AND user_id = $1", [testIds.retailAdmin]);
    expect(notice.rows.length).toBeGreaterThan(0);
    expect((await call(viewer, "get", `/hr/employees/${id}`)).body.status).toBe("active");
    testClock.fixed = new Date("2026-11-30T01:00:00+07:00");
    await application.get(WorkEventsService).applyDue();
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
    expect((await call(viewer, "get", `/hr/employees/${id}`)).status).toBe(404);
    expect((await call(hrStaff, "get", `/hr/employees/${id}`)).body).toMatchObject({ status: "terminated", canManage: false });
    expect((await call(viewer, "get", "/hr/employees?status=terminated")).body.data.every((item: { status: string }) => item.status === "active")).toBe(true);

    // Lao động chưa thành niên: ký cần văn bản đồng ý của người đại diện.
    const minor = await employee("Phạm Gia Huy", "074209000123", { birthDate: "2009-05-20", hireDate: "2026-11-03" });
    const minorContract = await call(hrStaff, "post", "/hr/contracts", contract(minor, { effectiveDate: "2026-11-03", endDate: "2027-11-02" }));
    await call(hrStaff, "post", `/hr/contracts/${minorContract.body.id}/submit`);
    expect((await sign(hrStaff, `/hr/contracts/${minorContract.body.id}/sign`)).body.error.message).toBe(message("guardianConsentMissing"));
    await hrStaff.call("post", `/hr/employees/${minor}/documents`, { companyId: retail }).field("kind", "guardian_consent").attach("file", pdf, "dong-y-cha-me.pdf");
    expect((await sign(hrStaff, `/hr/contracts/${minorContract.body.id}/sign`)).body.status).toBe("signed");
  });
});
