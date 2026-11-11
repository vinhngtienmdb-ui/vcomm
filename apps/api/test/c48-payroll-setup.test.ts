// CONG_VIEC_48 lát L0: tham số pháp luật, thiết lập công ty, loại phụ cấp, hồ sơ lương (TIEUCHI_NGHIEMTHU_303, 304; KICHBAN_KIEMTHU_454, 455).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let companyAdmin: Session;
let hrStaff: Session;
let outsider: Session;
let department: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const branch: string = testIds.headOfficeBranch;
const pdf = Buffer.from("%PDF-1.4 cam ket");
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown, companyId = retail) => session.call(method, path, { companyId, body });

async function assign(email: string, name: string, role: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
  return signIn(application, email);
}

const parameters = (effectiveFrom: string, extra: Record<string, unknown> = {}) => ({
  effectiveFrom,
  baseSalary: "2530000",
  regionMinimums: ["5700000", "5080000", "4450000", "4040000"],
  employeeSocialRate: "0.08",
  employeeHealthRate: "0.015",
  employeeUnemploymentRate: "0.01",
  employerRetirementRate: "0.14",
  employerSicknessRate: "0.03",
  employerHealthRate: "0.03",
  employerUnemploymentRate: "0.01",
  socialCapMultiplier: "20",
  healthCapMultiplier: "20",
  unemploymentCapMultiplier: "20",
  personalDeduction: "15500000",
  dependentDeduction: "6200000",
  flatWithholdingRate: "0.1",
  unpaidDaysThreshold: 14,
  taxBrackets: [
    { upperBound: "10000000", rate: "0.05" },
    { upperBound: "30000000", rate: "0.1" },
    { upperBound: null, rate: "0.2" },
  ],
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  companyAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  hrStaff = await assign("nhansu.luong@vcomm.test", "Nhân viên nhân sự lương", "hr_staff");
  outsider = await assign("khong.quyen.luong@vcomm.test", "Không quyền lương", "employee");
  department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KD', 'Phòng Kinh doanh') RETURNING id", [retail])).rows[0]!.id;
});

afterAll(async () => {
  testClock.fixed = null;
  await application.close();
});

describe("KICHBAN_KIEMTHU_454: tham số pháp luật, thiết lập công ty", () => {
  it("nạp sẵn hai bộ theo văn bản đã tra; bộ đang áp dụng là 01/07/2026", async () => {
    const settings = await call(companyAdmin, "get", "/hr/payroll-settings");
    expect(settings.status).toBe(200);
    expect(settings.body.parameters.map((item: { effectiveFrom: string }) => item.effectiveFrom)).toEqual(["2027-01-01", "2026-07-01"]);
    const current = settings.body.parameters.find((item: { current: boolean }) => item.current);
    expect(current).toMatchObject({ baseSalary: "2530000", regionMinimums: ["5310000", "4730000", "4140000", "3700000"], personalDeduction: "15500000", dependentDeduction: "6200000" });
    expect(current.taxBrackets).toEqual([
      { upperBound: "10000000", rate: "0.05" },
      { upperBound: "30000000", rate: "0.1" },
      { upperBound: "60000000", rate: "0.2" },
      { upperBound: "100000000", rate: "0.3" },
      { upperBound: null, rate: "0.35" },
    ]);
    expect(settings.body).toMatchObject({ canEditParameters: false, canEditCompany: true, company: { unionFeeEnabled: true, unionFeeRate: "0.02", accidentRate: "0.005", version: 0 } });
  });

  it("chỉ quyền thiết lập ở phạm vi tập đoàn sửa tham số pháp luật", async () => {
    expect((await call(companyAdmin, "post", "/hr/payroll-parameters", parameters("2027-07-01"))).status).toBe(403);
    expect((await call(hrStaff, "post", "/hr/payroll-parameters", parameters("2027-07-01"))).status).toBe(403);
    const created = await call(groupAdmin, "post", "/hr/payroll-parameters", parameters("2027-07-01"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const item = created.body.parameters.find((row: { effectiveFrom: string }) => row.effectiveFrom === "2027-07-01");
    expect(item.taxBrackets).toHaveLength(3);
    // Trùng ngày hiệu lực, không phải ngày đầu tháng, biểu thuế sai thứ tự.
    expect((await call(groupAdmin, "post", "/hr/payroll-parameters", parameters("2027-07-01"))).body.error.fields).toEqual({ effectiveFrom: message("payrollParametersExists") });
    expect((await call(groupAdmin, "post", "/hr/payroll-parameters", parameters("2027-08-15"))).status).toBe(400);
    const badBrackets = await call(
      groupAdmin,
      "post",
      "/hr/payroll-parameters",
      parameters("2027-09-01", {
        taxBrackets: [
          { upperBound: "30000000", rate: "0.05" },
          { upperBound: "10000000", rate: "0.1" },
          { upperBound: "1", rate: "0.2" },
        ],
      }),
    );
    expect(badBrackets.body.error.fields).toMatchObject({ "taxBrackets.1.upperBound": message("invalidValue"), "taxBrackets.2.upperBound": message("invalidValue") });
    const updated = await call(groupAdmin, "patch", `/hr/payroll-parameters/${item.id}`, parameters("2027-07-01", { baseSalary: "2700000", version: item.version }));
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.parameters.find((row: { id: string }) => row.id === item.id)).toMatchObject({ baseSalary: "2700000", version: 2 });
    expect((await call(groupAdmin, "patch", `/hr/payroll-parameters/${item.id}`, parameters("2027-07-01", { version: 1 }))).status).toBe(409);
    expect((await call(groupAdmin, "delete", `/hr/payroll-parameters/${item.id}`)).status).toBe(200);
  });

  it("thiết lập công ty, vùng chi nhánh, nhóm phòng ban theo công ty", async () => {
    const company = {
      unionFeeEnabled: false,
      unionFeeRate: "0.02",
      accidentRate: "0.003",
      withholdingThreshold: "2000000",
      fallbackStandardDays: 26,
      overtimeWeekdayRate: "1.5",
      overtimeWeeklyRestRate: "2",
      overtimeHolidayRate: "3",
      nightRate: "0.3",
      nightOvertimeRate: "0.2",
    };
    expect((await call(hrStaff, "put", "/hr/payroll-settings/company", company)).status).toBe(403);
    expect((await call(companyAdmin, "put", "/hr/payroll-settings/company", { ...company, overtimeWeekdayRate: "0.9" })).body.error.fields).toEqual({ overtimeWeekdayRate: message("invalidValue") });
    const saved = await call(companyAdmin, "put", "/hr/payroll-settings/company", company);
    expect(saved.body.company).toMatchObject({ unionFeeEnabled: false, accidentRate: "0.003", version: 1 });
    expect((await call(companyAdmin, "put", "/hr/payroll-settings/company", company)).status).toBe(409);
    const regions = await call(companyAdmin, "put", "/hr/payroll-settings/branches", { items: [{ branchId: branch, region: 1 }] });
    expect(regions.body.branches.find((row: { branchId: string }) => row.branchId === branch).region).toBe(1);
    const groups = await call(companyAdmin, "put", "/hr/payroll-settings/departments", { items: [{ departmentId: department, costGroup: "selling" }] });
    expect(groups.body.departments.find((row: { departmentId: string }) => row.departmentId === department).costGroup).toBe("selling");
    // Chi nhánh, phòng ban của công ty khác bị chặn; công ty khác không thấy thiết lập.
    const foreignDepartment = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KT', 'Phòng Kế toán') RETURNING id", [trading])).rows[0]!.id;
    expect((await call(companyAdmin, "put", "/hr/payroll-settings/departments", { items: [{ departmentId: foreignDepartment, costGroup: "admin" }] })).status).toBe(400);
    expect((await call(groupAdmin, "get", "/hr/payroll-settings", undefined, trading)).body.company.version).toBe(0);
    expect((await call(outsider, "get", "/hr/payroll-settings")).status).toBe(403);
  });
});

describe("KICHBAN_KIEMTHU_455: loại phụ cấp trên hợp đồng, hồ sơ lương", () => {
  let lunch: string;
  let employeeId: string;

  it("loại phụ cấp: tên không trùng, miễn đến mức cần số tiền", async () => {
    expect((await call(hrStaff, "post", "/hr/allowance-types", { name: "Ăn trưa", taxMode: "taxable", prorated: true, overtimeBase: false })).status).toBe(403);
    expect((await call(companyAdmin, "post", "/hr/allowance-types", { name: "Ăn trưa", taxMode: "exempt_up_to", prorated: true, overtimeBase: false })).body.error.fields).toEqual({
      exemptLimit: message("required"),
    });
    const created = await call(companyAdmin, "post", "/hr/allowance-types", { name: "Ăn trưa", taxMode: "exempt_up_to", exemptLimit: "730000", prorated: true, overtimeBase: false });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    lunch = created.body[0].id;
    expect(created.body[0]).toMatchObject({ name: "Ăn trưa", taxMode: "exempt_up_to", exemptLimit: "730000", status: "active" });
    expect((await call(companyAdmin, "post", "/hr/allowance-types", { name: "ăn TRƯA", taxMode: "taxable", prorated: true, overtimeBase: false })).body.error.fields).toEqual({
      name: message("allowanceTypeExists"),
    });
    // Người lập hợp đồng xem được danh mục để chọn.
    expect((await call(hrStaff, "get", "/hr/allowance-types")).body).toHaveLength(1);
  });

  it("hợp đồng lưu loại phụ cấp; loại của công ty khác, loại ngừng dùng, thiếu loại bị chặn", async () => {
    const employee = await call(hrStaff, "post", "/hr/employees", {
      fullName: "Nguyễn Văn Lương",
      gender: "male",
      birthDate: "1990-01-01",
      identityNumber: "079090004801",
      residence: "Thành phố Hồ Chí Minh",
      hireDate: "2026-01-05",
      departmentId: department,
      branchId: branch,
      jobTitle: "Nhân viên",
    });
    expect(employee.status, JSON.stringify(employee.body)).toBe(201);
    employeeId = employee.body.id;
    const body = (allowances: unknown) => ({
      employeeId,
      kind: "fixed_term",
      effectiveDate: "2026-01-05",
      endDate: "2027-01-04",
      jobTitle: "Nhân viên",
      departmentId: department,
      branchId: branch,
      salary: "16500000",
      allowances,
      signerName: "Nguyễn Văn An",
      signerTitle: "Giám đốc",
    });
    expect((await call(hrStaff, "post", "/hr/contracts", body([{ name: "Ăn trưa", amount: "730000" }]))).status).toBe(400);
    const foreign = (
      await pool.query<{ id: string }>("INSERT INTO hr.allowance_types (company_id, name, tax_mode, created_by, updated_by) VALUES ($1, 'Khác công ty', 'taxable', $2, $2) RETURNING id", [
        trading,
        testIds.groupAdmin,
      ])
    ).rows[0]!.id;
    expect((await call(hrStaff, "post", "/hr/contracts", body([{ name: "Ăn trưa", amount: "730000", allowanceTypeId: foreign }]))).body.error.fields).toEqual({
      "allowances.0.allowanceTypeId": message("invalidValue"),
    });
    const created = await call(hrStaff, "post", "/hr/contracts", body([{ name: "Ăn trưa", amount: "730000", allowanceTypeId: lunch }]));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.current.allowances).toEqual([{ name: "Ăn trưa", amount: "730000", allowanceTypeId: lunch, allowanceTypeName: "Ăn trưa" }]);
    // Dòng cũ (trước CONG_VIEC_48) không có loại vẫn đọc được.
    await pool.query("UPDATE hr.contract_allowances SET allowance_type_id = NULL WHERE contract_id = $1", [created.body.id]);
    expect((await call(hrStaff, "get", `/hr/contracts/${created.body.id}`)).body.current.allowances[0]).toMatchObject({ allowanceTypeId: null, allowanceTypeName: null });
    const types = await call(companyAdmin, "get", "/hr/allowance-types");
    await call(companyAdmin, "patch", `/hr/allowance-types/${lunch}`, {
      name: "Ăn trưa",
      taxMode: "exempt_up_to",
      exemptLimit: "730000",
      prorated: true,
      overtimeBase: false,
      status: "inactive",
      version: types.body[0].version,
    });
    const inactive = await call(hrStaff, "patch", `/hr/contracts/${created.body.id}`, { ...body([{ name: "Ăn trưa", amount: "730000", allowanceTypeId: lunch }]), version: created.body.version });
    expect(inactive.body.error.fields).toEqual({ "allowances.0.allowanceTypeId": message("invalidValue") });
  });

  it("hồ sơ lương: lương đóng bảo hiểm theo tháng, cảnh báo dưới lương tối thiểu vùng, miễn đóng cần lý do", async () => {
    const empty = await call(hrStaff, "get", `/hr/employees/${employeeId}/payroll-profile`);
    expect(empty.body).toMatchObject({ socialExempt: false, taxMethod: "auto", hasTaxCode: false, insuranceSalaries: [], version: null });
    const low = await call(hrStaff, "post", `/hr/employees/${employeeId}/insurance-salaries`, { effectiveMonth: "2026-11-01", amount: "5000000" });
    expect(low.body.insuranceSalaries[0]).toMatchObject({ effectiveMonth: "2026-11-01", amount: "5000000", belowRegionalMinimum: true });
    const fixed = await call(hrStaff, "post", `/hr/employees/${employeeId}/insurance-salaries`, { effectiveMonth: "2026-11-01", amount: "16500000", note: "Theo hợp đồng" });
    expect(fixed.body.insuranceSalaries).toHaveLength(1);
    expect(fixed.body.insuranceSalaries[0]).toMatchObject({ amount: "16500000", belowRegionalMinimum: false });
    expect((await call(hrStaff, "post", `/hr/employees/${employeeId}/insurance-salaries`, { effectiveMonth: "2026-11-15", amount: "1" })).status).toBe(400);
    const second = await call(hrStaff, "post", `/hr/employees/${employeeId}/insurance-salaries`, { effectiveMonth: "2027-01-01", amount: "18000000" });
    expect(second.body.insuranceSalaries.map((row: { effectiveMonth: string }) => row.effectiveMonth)).toEqual(["2027-01-01", "2026-11-01"]);
    expect((await call(hrStaff, "delete", `/hr/employees/${employeeId}/insurance-salaries/${second.body.insuranceSalaries[0].id}`)).body.insuranceSalaries).toHaveLength(1);
    // Nhật ký không ghi số tiền.
    const audit = await pool.query<{ after_data: unknown }>("SELECT after_data FROM core.audit_events WHERE action = 'employee.insurance_salary.save' AND entity_id = $1", [employeeId]);
    expect(JSON.stringify(audit.rows)).not.toContain("16500000");

    expect(
      (await call(hrStaff, "put", `/hr/employees/${employeeId}/payroll-profile`, { socialExempt: true, healthExempt: false, unemploymentExempt: false, taxMethod: "auto" })).body.error.fields,
    ).toEqual({
      exemptionReason: message("required"),
    });
    const profile = await call(hrStaff, "put", `/hr/employees/${employeeId}/payroll-profile`, {
      socialExempt: false,
      healthExempt: false,
      unemploymentExempt: true,
      exemptionReason: "Đang hưởng trợ cấp thất nghiệp nơi khác",
      taxMethod: "progressive",
    });
    expect(profile.body).toMatchObject({ unemploymentExempt: true, taxMethod: "progressive", version: 1 });
    expect(
      (await call(hrStaff, "put", `/hr/employees/${employeeId}/payroll-profile`, { socialExempt: false, healthExempt: false, unemploymentExempt: false, taxMethod: "auto", version: 7 })).status,
    ).toBe(409);

    const commitment = await hrStaff.call("post", `/hr/employees/${employeeId}/tax-commitments`, { companyId: retail }).field("year", "2026").attach("file", pdf, "cam-ket-08.pdf");
    expect(commitment.status, JSON.stringify(commitment.body)).toBe(201);
    expect(commitment.body.taxCommitments).toMatchObject([{ year: 2026, fileName: "cam-ket-08.pdf" }]);
    const replaced = await hrStaff.call("post", `/hr/employees/${employeeId}/tax-commitments`, { companyId: retail }).field("year", "2026").attach("file", pdf, "cam-ket-moi.pdf");
    expect(replaced.body.taxCommitments).toMatchObject([{ year: 2026, fileName: "cam-ket-moi.pdf" }]);
    const file = await call(hrStaff, "get", `/hr/employees/${employeeId}/tax-commitments/${replaced.body.taxCommitments[0].id}`);
    expect(file.status).toBe(200);
  });

  it("danh sách thiếu lương đóng bảo hiểm; cách ly công ty, quyền", async () => {
    const other = await call(hrStaff, "post", "/hr/employees", {
      fullName: "Trần Thị Chưa Khai",
      gender: "female",
      birthDate: "1996-02-02",
      identityNumber: "079196004802",
      residence: "Bình Dương",
      hireDate: "2026-11-02",
      departmentId: department,
      branchId: branch,
      jobTitle: "Nhân viên",
    });
    await pool.query(
      "INSERT INTO hr.contracts (company_id, employee_id, kind, status, effective_date, end_date, job_title, department_id, branch_id, salary, signer_name, signer_title, created_by, sign_date, signed_storage_key) VALUES ($1, $2, 'fixed_term', 'signed', '2026-11-02', '2027-11-01', 'Nhân viên', $3, $4, 9000000, 'A', 'B', $5, '2026-11-01', 'hr/ban-da-ky')",
      [retail, other.body.id, department, branch, testIds.retailAdmin],
    );
    const missing = await call(hrStaff, "get", "/hr/payroll-profiles/missing-insurance");
    expect(missing.body.map((row: { fullName: string }) => row.fullName)).toContain("Trần Thị Chưa Khai");
    expect(missing.body.map((row: { fullName: string }) => row.fullName)).not.toContain("Nguyễn Văn Lương");
    expect((await call(groupAdmin, "get", `/hr/employees/${employeeId}/payroll-profile`, undefined, trading)).status).toBe(404);
    expect((await call(outsider, "get", `/hr/employees/${employeeId}/payroll-profile`)).status).toBe(403);
  });
});
