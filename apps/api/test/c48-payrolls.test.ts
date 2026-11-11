// CONG_VIEC_48 lát L1, L2: bảng lương tháng, bút toán, trả lương, phiếu lương (TIEUCHI_NGHIEMTHU_305, 306, 308, 309; KICHBAN_KIEMTHU_456, 460, 461). Bảng công tháng lấy từ bản giả (testTimesheet) để dựng số liệu; đọc bảng công thật của CONG_VIEC_47 kiểm ở c48-payroll-timesheet.test.ts.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { overtimeGroups, type OvertimeGroup } from "../src/hr/payroll-calculation";
import { createTestUser, signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testClock, testTimesheet } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let hrStaff: Session;
let accountant: Session;
let outsider: Session;
let approver: Session;
let selling: string;
let administration: string;
let lunch: string;
let cashFund: string;
let ngocUser: Session;
let khoaUser: Session;
const employees: Record<string, string> = {};
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const branch: string = testIds.headOfficeBranch;
const month = "2026-11-01";
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown, companyId = retail) => session.call(method, path, { companyId, body });
const noOvertime = Object.fromEntries(overtimeGroups.map((group) => [group, "0"])) as Record<OvertimeGroup, string>;
const figures = (paidDays: string, extra: Record<string, unknown> = {}) => ({
  standardDays: "25",
  paidDays,
  unpaidDays: "0",
  nightHours: "0",
  overtimeHours: noOvertime,
  settledLeaveDays: "0",
  ...extra,
});

async function assign(email: string, name: string, role: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
  return signIn(application, email);
}

// Hồ sơ và hợp đồng đã ký lập thẳng trong cơ sở dữ liệu (luồng lập, ký đã kiểm ở c46-contracts).
async function employee(
  code: string,
  name: string,
  department: string,
  contract: { kind: string; effective: string; end: string | null; salary: string; official?: string },
  extra: Record<string, unknown> = {},
) {
  const created = await call(hrStaff, "post", "/hr/employees", {
    code,
    fullName: name,
    gender: "female",
    birthDate: "1995-04-12",
    identityNumber: `0791950${code.slice(-5).padStart(5, "0")}`,
    residence: "Thành phố Hồ Chí Minh",
    hireDate: contract.effective,
    departmentId: department,
    branchId: branch,
    jobTitle: "Nhân viên",
    ...extra,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const contractId = (
    await pool.query<{ id: string }>(
      `INSERT INTO hr.contracts (company_id, employee_id, kind, status, effective_date, end_date, job_title, department_id, branch_id, salary, probation_level, official_salary,
         signer_name, signer_title, created_by, sign_date, signed_storage_key)
       VALUES ($1, $2, $3, 'signed', $4, $5, 'Nhân viên', $6, $7, $8, $9, $10, 'Nguyễn Văn An', 'Giám đốc', $11, $4, 'hr/ban-da-ky/' || gen_random_uuid()) RETURNING id`,
      [
        retail,
        created.body.id,
        contract.kind,
        contract.effective,
        contract.end,
        department,
        branch,
        contract.salary,
        contract.kind === "probation" ? "college" : null,
        contract.official ?? null,
        testIds.retailAdmin,
      ],
    )
  ).rows[0]!.id;
  employees[name] = created.body.id;
  return { employeeId: created.body.id as string, contractId };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  hrStaff = await assign("nhansu.bangluong@vcomm.test", "Nhân sự bảng lương", "hr_staff");
  accountant = await assign("ketoantruong.luong@vcomm.test", "Kế toán trưởng", "chief_accountant");
  outsider = await assign("nhanvien.thuong@vcomm.test", "Nhân viên thường", "employee");
  const departments = await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KD', 'Phòng Kinh doanh'), ($1, 'KT', 'Phòng Kế toán') RETURNING id", [
    retail,
  ]);
  selling = departments.rows[0]!.id;
  administration = departments.rows[1]!.id;
  await call(admin, "put", "/hr/payroll-settings/departments", { items: [{ departmentId: selling, costGroup: "selling" }] });
  lunch = (await call(admin, "post", "/hr/allowance-types", { name: "Ăn trưa", taxMode: "exempt_up_to", exemptLimit: "730000", prorated: true, overtimeBase: false })).body[0].id;
  const phone = (await call(admin, "post", "/hr/allowance-types", { name: "Điện thoại", taxMode: "taxable", prorated: false, overtimeBase: false })).body.find(
    (type: { name: string }) => type.name === "Điện thoại",
  ).id;

  // Kế toán đã khởi tạo (Thông tư 99/2025), có quỹ tiền mặt.
  expect((await call(admin, "post", "/finance/ledger/setup")).status).toBe(201);
  cashFund = (await call(admin, "post", "/finance/funds", { code: "TM", name: "Quỹ tiền mặt", kind: "cash", openingBalance: "100000000" })).body.id;
  const ngocUserId = await createTestUser(pool, "ngoc.le.luong@vcomm.test", "Lê Thị Bích Ngọc", [{ companyId: retail }]);
  const khoaUserId = await createTestUser(pool, "khoa.tran.luong@vcomm.test", "Trần Minh Khoa", [{ companyId: retail }]);
  const ngoc = await employee(
    "NV000124",
    "Lê Thị Bích Ngọc",
    administration,
    { kind: "fixed_term", effective: "2025-11-15", end: "2027-11-14", salary: "15000000" },
    { userId: ngocUserId, personalEmail: "ngoc.canhan@example.test" },
  );
  // Phụ lục tăng lương từ 01/11/2026, thay phụ cấp.
  const appendix = (
    await pool.query<{ id: string }>(
      `INSERT INTO hr.contract_appendices (company_id, contract_id, effective_date, salary, replaces_allowances, description, status, sign_date, signed_storage_key, created_by, document_no, sequence_no)
       VALUES ($1, $2, '2026-11-01', 16500000, true, 'Tăng lương', 'signed', '2026-10-30', 'hr/pl', $3, 'HDLD/PL01', 1) RETURNING id`,
      [retail, ngoc.contractId, testIds.retailAdmin],
    )
  ).rows[0]!.id;
  await pool.query(
    "INSERT INTO hr.contract_allowances (contract_id, appendix_id, sort_order, name, amount, allowance_type_id) VALUES ($1, $2, 1, 'Ăn trưa', 730000, $3), ($1, $2, 2, 'Điện thoại', 300000, $4)",
    [ngoc.contractId, appendix, lunch, phone],
  );
  await call(hrStaff, "post", `/hr/employees/${ngoc.employeeId}/insurance-salaries`, { effectiveMonth: "2026-03-01", amount: "16500000" });
  await call(hrStaff, "post", `/hr/employees/${ngoc.employeeId}/dependents`, { fullName: "Nguyễn Minh An", relationship: "child", birthDate: "2022-06-02", deductionFrom: "2025-09-01" });

  const khoa = await employee("NV000123", "Trần Minh Khoa", administration, { kind: "indefinite", effective: "2025-03-01", end: null, salary: "30000000" }, { userId: khoaUserId });
  ngocUser = await signIn(application, "ngoc.le.luong@vcomm.test");
  khoaUser = await signIn(application, "khoa.tran.luong@vcomm.test");
  await call(hrStaff, "post", `/hr/employees/${khoa.employeeId}/insurance-salaries`, { effectiveMonth: "2025-03-01", amount: "30000000" });
  await call(hrStaff, "post", `/hr/employees/${khoa.employeeId}/dependents`, { fullName: "Trần Minh Anh", relationship: "child", birthDate: "2020-01-01", deductionFrom: "2025-03-01" });

  await employee("NV000131", "Phạm Gia Huy", selling, { kind: "probation", effective: "2026-11-03", end: "2026-12-02", salary: "6375000", official: "7500000" });
  const bao = await employee("NV000098", "Đỗ Quốc Bảo", selling, { kind: "fixed_term", effective: "2024-11-02", end: "2027-11-01", salary: "22000000" });
  await call(hrStaff, "post", `/hr/employees/${bao.employeeId}/insurance-salaries`, { effectiveMonth: "2024-11-01", amount: "22000000" });

  testTimesheet.data = new Map([
    [
      `${retail}:${month}`,
      {
        closed: false,
        employees: new Map([
          [employees["Lê Thị Bích Ngọc"]!, figures("25", { overtimeHours: { ...noOvertime, weekday: "8" } })],
          [employees["Trần Minh Khoa"]!, figures("25")],
          [employees["Phạm Gia Huy"]!, figures("24")],
          [employees["Đỗ Quốc Bảo"]!, figures("10", { unpaidDays: "15" })],
        ]),
      },
    ],
  ]);
});

afterAll(async () => {
  testTimesheet.data = null;
  testClock.fixed = null;
  await application.close();
});

describe("KICHBAN_KIEMTHU_460: lập, tính, khoản nhập tay, luồng duyệt", () => {
  let payrollId: string;

  it("lập bảng lương tháng: tính từ hợp đồng, phụ lục, bảng công, hồ sơ lương", async () => {
    expect((await call(outsider, "post", "/hr/payrolls", { month })).status).toBe(403);
    expect((await call(accountant, "post", "/hr/payrolls", { month })).status).toBe(403);
    const created = await call(hrStaff, "post", "/hr/payrolls", { month });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    payrollId = created.body.id;
    expect(created.body).toMatchObject({ status: "draft", documentNo: null, employeeCount: 4, parameterEffectiveFrom: "2026-07-01", timesheetClosed: false, canSubmit: true });
    const line = (name: string) => created.body.lines.find((item: { employeeName: string }) => item.employeeName === name);
    // Chi nhánh chưa chọn vùng: cảnh báo chặn.
    expect(line("Lê Thị Bích Ngọc").warnings).toContain("branchRegionMissing");
    await call(admin, "put", "/hr/payroll-settings/branches", { items: [{ branchId: branch, region: 1 }] });
    const recalculated = (await call(hrStaff, "post", `/hr/payrolls/${payrollId}/recalculate`)).body;
    const after = (name: string) => recalculated.lines.find((item: { employeeName: string }) => item.employeeName === name);
    expect(after("Lê Thị Bích Ngọc")).toMatchObject({
      timePay: "16500000",
      allowancePay: "1030000",
      overtimePay: "990000",
      grossIncome: "18520000",
      employeeInsurance: "1732500",
      personalIncomeTax: "0",
      netPay: "16787500",
      costGroup: "admin",
      warnings: ["missingTaxCode"],
    });
    expect(after("Trần Minh Khoa")).toMatchObject({ grossIncome: "30000000", personalIncomeTax: "257500", netPay: "26592500", employerCost: "37050000" });
    expect(after("Phạm Gia Huy")).toMatchObject({ timePay: "6120000", taxMethod: "flat", personalIncomeTax: "612000", netPay: "5508000", costGroup: "selling" });
    expect(after("Phạm Gia Huy").warnings).toEqual(["probationNoInsurance", "missingTaxCode", "flatWithholding"]);
    expect(after("Đỗ Quốc Bảo")).toMatchObject({ timePay: "8800000", employeeInsurance: "0", netPay: "8800000" });
    expect(after("Đỗ Quốc Bảo").warnings).toContain("unpaidDaysNoInsurance");
    expect(recalculated).toMatchObject({ grossIncome: "63440000", blockingCount: 0 });
    // Lập trùng tháng bị chặn.
    expect((await call(hrStaff, "post", "/hr/payrolls", { month })).body.error.message).toBe(message("payrollExists"));
  });

  it("khoản nhập tay: tính lại ngay, thực lĩnh âm là cảnh báo chặn", async () => {
    const detail = (await call(hrStaff, "get", `/hr/payrolls/${payrollId}`)).body;
    const ngoc = detail.lines.find((item: { employeeName: string }) => item.employeeName === "Lê Thị Bích Ngọc");
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/adjustments`, { employeeId: ngoc.employeeId, kind: "deduction", category: "bonus", description: "Sai", amount: "1" })).status).toBe(
      400,
    );
    const advance = await call(hrStaff, "post", `/hr/payrolls/${payrollId}/adjustments`, {
      employeeId: ngoc.employeeId,
      kind: "deduction",
      category: "advance",
      description: "Tạm ứng lương 15/11/2026",
      amount: "2000000",
    });
    expect(advance.status, JSON.stringify(advance.body)).toBe(201);
    expect(advance.body).toMatchObject({ netPay: "55688000", deductions: "2000000", employerCost: "74367500" });
    // Tính lại tạo lại dòng: mã dòng cũ không còn.
    expect((await call(hrStaff, "get", `/hr/payrolls/${payrollId}/lines/${ngoc.id}`)).status).toBe(404);
    const fresh = advance.body.lines.find((item: { employeeName: string }) => item.employeeName === "Lê Thị Bích Ngọc");
    const explained = (await call(accountant, "get", `/hr/payrolls/${payrollId}/lines/${fresh.id}`)).body;
    expect(explained).toMatchObject({ netPay: "14787500", explanation: { hourlyRate: "82500" }, canEdit: false });
    expect(explained.adjustments).toMatchObject([{ kind: "deduction", category: "advance", amount: "2000000" }]);
    const huge = await call(hrStaff, "post", `/hr/payrolls/${payrollId}/adjustments`, {
      employeeId: fresh.employeeId,
      kind: "deduction",
      category: "other",
      description: "Thử âm",
      amount: "99000000",
    });
    expect(huge.body.blockingCount).toBe(1);
    const negative = huge.body.lines.find((item: { employeeName: string }) => item.employeeName === "Lê Thị Bích Ngọc");
    expect(negative.warnings).toContain("negativeNet");
    const adjustments = (await call(hrStaff, "get", `/hr/payrolls/${payrollId}/lines/${negative.id}`)).body.adjustments;
    const removed = await call(hrStaff, "delete", `/hr/payrolls/${payrollId}/adjustments/${adjustments[1].id}`);
    expect(removed.body.blockingCount).toBe(0);
  });

  it("gửi duyệt: chặn khi bảng công chưa chốt; luồng duyệt; đã duyệt không sửa", async () => {
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/submit`)).body.error.message).toBe(message("timesheetNotClosed"));
    testTimesheet.data!.get(`${retail}:${month}`)!.closed = true;
    const policy = await call(admin, "post", "/approval-policies", {
      documentTypeCode: "hr.payroll",
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const pending = (await call(hrStaff, "post", `/hr/payrolls/${payrollId}/submit`)).body;
    expect(pending).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^BL-VCR-2026-/), canWithdraw: true, canEdit: false, timesheetClosed: true });
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/recalculate`)).status).toBe(409);
    await approver.call("post", `/approval-requests/${pending.approvalRequestId}/decisions`, { body: { decision: "rejected", comment: "Xem lại tăng ca" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(hrStaff, "get", `/hr/payrolls/${payrollId}`)).body.status).toBe("rejected");
    const resubmitted = (await call(hrStaff, "post", `/hr/payrolls/${payrollId}/submit`)).body;
    expect(resubmitted.documentNo).toBe(pending.documentNo);
    await approver.call("post", `/approval-requests/${resubmitted.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    const approved = (await call(accountant, "get", `/hr/payrolls/${payrollId}`)).body;
    expect(approved).toMatchObject({ status: "approved", canEdit: false, canCancel: false, canPay: false, emailFailedCount: 0 });
    // Bút toán trích lương theo Thông tư 99/2025 (QUYTAC_NGHIEPVU_323), khớp bản mẫu MAN_HINH_127.
    expect(approved.journals).toHaveLength(1);
    const journal = approved.journals[0];
    expect(journal).toMatchObject({ journalNo: approved.documentNo, journalDate: "2026-11-30", sourceType: "payroll" });
    const lines = Object.fromEntries(journal.lines.map((line: { accountCode: string; debit: string; credit: string }, index: number) => [`${line.accountCode}:${index}`, [line.debit, line.credit]]));
    expect(Object.values(lines)).toEqual([
      ["14920000", "0"],
      ["59447500", "0"],
      ["0", "63440000"],
      ["0", "11857500"],
      ["0", "2092500"],
      ["0", "930000"],
      ["0", "930000"],
      ["7752000", "0"],
      ["0", "869500"],
      ["0", "2000000"],
    ]);
    expect(journal.lines.map((line: { accountCode: string }) => line.accountCode)).toEqual(["6411", "6421", "334", "3383", "3384", "3386", "3382", "334", "3335", "3388"]);
    expect(testTimesheet.locks).toContain(`${retail}:${month}:true`);
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/cancel`, { reason: "Thử" })).status).toBe(409);
    // Bộ tham số đã được bảng lương đã duyệt dùng thì không sửa.
    const settings = (await call(admin, "get", "/hr/payroll-settings")).body;
    expect(settings.parameters.find((item: { effectiveFrom: string }) => item.effectiveFrom === "2026-07-01").used).toBe(true);
    await pool.query("UPDATE core.approval_policies SET effective_from = '2026-01-01', effective_to = '2026-01-01' WHERE document_type_code = 'hr.payroll'");
  });

  it("cách ly công ty, quyền xem, xuất Excel, hủy bảng lương nháp", async () => {
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    expect((await call(groupAdmin, "get", `/hr/payrolls/${payrollId}`, undefined, trading)).status).toBe(404);
    expect((await call(outsider, "get", `/hr/payrolls/${payrollId}`)).status).toBe(403);
    const list = await call(accountant, "get", "/hr/payrolls?year=2026");
    expect(list.body).toMatchObject({ canManage: false, data: [{ id: payrollId, status: "approved" }] });
    const file = await call(accountant, "get", `/hr/payrolls/${payrollId}/export`);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("spreadsheetml");
    const october = await call(hrStaff, "post", "/hr/payrolls", { month: "2026-10-01" });
    expect(october.body.lines.every((line: { warnings: string[] }) => line.warnings.includes("timesheetMissing"))).toBe(true);
    expect((await call(hrStaff, "post", `/hr/payrolls/${october.body.id}/submit`)).status).toBe(409);
    const cancelled = await call(hrStaff, "post", `/hr/payrolls/${october.body.id}/cancel`, { reason: "Lập nhầm" });
    expect(cancelled.body).toMatchObject({ status: "cancelled", cancelReason: "Lập nhầm" });
    expect((await call(hrStaff, "post", "/hr/payrolls", { month: "2026-06-01" })).body.error.message).toBe(message("payrollParametersMissing"));
  });
});

describe("KICHBAN_KIEMTHU_461: trả lương, phiếu lương, email, chế độ Thông tư 133", () => {
  let payrollId: string;

  it("phiếu lương: chuông, email tới email cá nhân, nhân viên chỉ xem phiếu của mình", async () => {
    payrollId = (await call(hrStaff, "get", "/hr/payrolls?year=2026")).body.data.find((item: { month: string; status: string }) => item.month === month && item.status === "approved").id;
    const mail = sentMessages.filter((sent) => sent.to === "ngoc.canhan@example.test");
    expect(mail).toHaveLength(1);
    expect(mail[0]!.subject).toContain("phiếu lương tháng 11/2026");
    expect(mail[0]!.body).toContain("Thực lĩnh: 14.787.500 đồng");
    const bell = await pool.query("SELECT n.title FROM core.notifications n JOIN core.users u ON u.id = n.user_id WHERE u.email = 'ngoc.le.luong@vcomm.test' AND n.kind = 'hr.payslip.issued'");
    expect(bell.rows).toHaveLength(1);
    const mine = await call(ngocUser, "get", "/hr/me/payslips");
    expect(mine.body).toMatchObject([{ month, netPay: "14787500", status: "approved", paymentDate: null }]);
    const slip = await call(ngocUser, "get", `/hr/me/payslips/${mine.body[0].lineId}`);
    expect(slip.body).toMatchObject({ employeeName: "Lê Thị Bích Ngọc", line: { grossIncome: "18520000", netPay: "14787500", canEdit: false, adjustments: [{ category: "advance" }] } });
    // Người khác (có hồ sơ liên kết) không xem được phiếu của Ngọc; công ty khác không thấy.
    expect((await call(khoaUser, "get", `/hr/me/payslips/${mine.body[0].lineId}`)).status).toBe(404);
    expect((await call(khoaUser, "get", "/hr/me/payslips")).body).toHaveLength(1);
    expect((await call(outsider, "get", "/hr/me/payslips")).body).toEqual([]);
  });

  it("ghi đã trả lương: ngày, quỹ, bút toán trả lương; không trả hai lần", async () => {
    expect((await call(accountant, "post", `/hr/payrolls/${payrollId}/pay`, { paymentDate: "2026-11-11", fundId: cashFund })).status).toBe(403);
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/pay`, { paymentDate: "2026-11-12", fundId: cashFund })).body.error.fields).toEqual({ paymentDate: message("invalidValue") });
    const foreignFund = (
      await pool.query<{ id: string }>("INSERT INTO finance.funds (company_id, code, name, kind, created_by) VALUES ($1, 'TM2', 'Quỹ khác', 'cash', $2) RETURNING id", [trading, testIds.groupAdmin])
    ).rows[0]!.id;
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/pay`, { paymentDate: "2026-11-11", fundId: foreignFund })).body.error.fields).toEqual({ fundId: message("invalidValue") });
    const before = (await call(hrStaff, "get", `/hr/payrolls/${payrollId}`)).body;
    expect(before.canPay).toBe(true);
    expect(before.funds.map((fund: { id: string }) => fund.id)).toContain(cashFund);
    const paid = await call(hrStaff, "post", `/hr/payrolls/${payrollId}/pay`, { paymentDate: "2026-11-11", fundId: cashFund });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(paid.body).toMatchObject({ status: "paid", paymentDate: "2026-11-11", fundName: "Quỹ tiền mặt", canPay: false });
    const payment = paid.body.journals.find((journal: { sourceType: string }) => journal.sourceType === "payroll_payment");
    expect(payment).toMatchObject({ journalNo: `${paid.body.documentNo}-TT`, journalDate: "2026-11-11" });
    expect(payment.lines).toMatchObject([
      { accountCode: "334", debit: "55688000", credit: "0" },
      { accountCode: "111", debit: "0", credit: "55688000" },
    ]);
    expect((await call(hrStaff, "post", `/hr/payrolls/${payrollId}/pay`, { paymentDate: "2026-11-11", fundId: cashFund })).status).toBe(409);
    expect((await call(ngocUser, "get", "/hr/me/payslips")).body[0]).toMatchObject({ status: "paid", paymentDate: "2026-11-11" });
  });

  it("định khoản mặc định theo Thông tư 133: chi phí 6421, 6422; bảo hiểm thất nghiệp 3385", async () => {
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    await pool.query("UPDATE core.companies SET accounting_regime = 'TT133' WHERE id = $1", [trading]);
    expect((await call(groupAdmin, "post", "/finance/ledger/setup", undefined, trading)).status).toBe(201);
    const rules = (await call(groupAdmin, "get", "/finance/posting-rules", undefined, trading)).body as { role: string; accountCode: string }[];
    const code = (role: string) => rules.find((rule) => rule.role === role)?.accountCode;
    expect([code("salary_expense_selling"), code("salary_expense_admin"), code("unemployment_insurance_payable"), code("salary_payable"), code("personal_income_tax")]).toEqual([
      "6421",
      "6422",
      "3385",
      "334",
      "3335",
    ]);
  });
});
