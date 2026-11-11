// CONG_VIEC_54 lát L0: nhu cầu tuyển dụng, tin tuyển dụng, trang tuyển dụng công khai, ứng viên (TIEUCHI_NGHIEMTHU_359, 360, 361; KICHBAN_KIEMTHU_522 đến 525).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { RecruitmentService } from "../src/hr/recruitment.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let hrStaff: Session;
let requester: Session;
let otherRequester: Session;
let outsider: Session;
let otherCompanyHr: Session;
let department: string;
const retail: string = testIds.retailCompany;
const branch: string = testIds.headOfficeBranch;
const pdf = Buffer.from("%PDF-1.4 so yeu ly lich");
const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "patch" | "put", path: string, body?: unknown, companyId: string = retail) => session.call(method, path, { companyId, body });
const anonymous = () => request(application.getHttpServer());

async function assign(email: string, name: string, role: string, companyId: string = retail) {
  const id = await createTestUser(pool, email, name, [{ companyId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, companyId]);
  return signIn(application, email);
}

const requestBody = (values: Record<string, unknown> = {}) => ({
  departmentId: department,
  branchId: branch,
  jobTitle: "Nhân viên kho",
  headcount: 2,
  contractKind: "probation_then_official",
  salaryMin: "8000000",
  salaryMax: "10000000",
  neededBy: "2026-12-01",
  reason: "expansion",
  ...values,
});

async function approvedRequest(values: Record<string, unknown> = {}) {
  const created = await call(hrStaff, "post", "/hr/recruitment-requests", requestBody(values));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(hrStaff, "post", `/hr/recruitment-requests/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("approved");
  return submitted.body.id as string;
}

const postingBody = (requestId: string, values: Record<string, unknown> = {}) => ({
  requestId,
  title: "Nhân viên kho – Bình Dương",
  location: "Bình Dương",
  workType: "full_time",
  description: "Nhận, xuất hàng theo phiếu.",
  salaryDisplay: "request_range",
  deadline: "2026-11-30",
  contactEmail: "tuyendung@vcr.vcomm.test",
  isPublic: true,
  ...values,
});

async function openPosting(values: Record<string, unknown> = {}) {
  const requestId = await approvedRequest();
  const created = await call(hrStaff, "post", "/hr/job-postings", postingBody(requestId, values));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const published = await call(hrStaff, "post", `/hr/job-postings/${created.body.id}/publish`);
  expect(published.status, JSON.stringify(published.body)).toBe(201);
  return published.body.id as string;
}

const applicant = (values: Record<string, unknown> = {}) => ({
  fullName: "Nguyễn Văn Toàn",
  email: "toan.nv@example.test",
  phone: "0912 333 444",
  experienceYears: 2,
  locale: "vi",
  termsVersion: "2026-11-11",
  recruitmentConsent: true,
  talentPoolConsent: false,
  ...values,
});
const apply = (postingId: string, data: unknown, file: { content: Buffer; name: string } | null = { content: pdf, name: "cv.pdf" }) => {
  const sent = anonymous().post(`/api/v1/careers/postings/${postingId}/applications`).set("accept-language", "vi").field("data", JSON.stringify(data));
  return file ? sent.attach("resume", file.content, file.name) : sent;
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  hrStaff = await assign("nhansu.tuyendung@vcomm.test", "Nhân viên tuyển dụng", "hr_staff");
  outsider = await assign("nhanvien.thuong@vcomm.test", "Nhân viên thường", "employee");
  otherCompanyHr = await assign("nhansu.congtykhac@vcomm.test", "Nhân sự công ty khác", "hr_staff", testIds.tradingCompany);
  // Trưởng phòng: vai trò riêng công ty chỉ có hr.access, hr.recruitment.request.
  const role = await pool.query<{ id: string }>(
    "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'department_head', 'Trưởng phòng', 'Department head', false, 'active') RETURNING id",
    [retail],
  );
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'hr.access'), ($1, 'hr.recruitment.request')", [role.rows[0]!.id]);
  for (const email of ["truongphong.kho@vcomm.test", "truongphong.khac@vcomm.test"]) {
    const id = await createTestUser(pool, email, "Trưởng phòng", [{ companyId: retail }]);
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role.rows[0]!.id, retail]);
  }
  requester = await signIn(application, "truongphong.kho@vcomm.test");
  otherRequester = await signIn(application, "truongphong.khac@vcomm.test");
  department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KHO', 'Kho Bình Dương') RETURNING id", [retail])).rows[0]!.id;
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_54 nhu cầu tuyển dụng", () => {
  it("KICHBAN_KIEMTHU_522: kiểm trường, luồng duyệt, rút, hủy, quyền xem của người lập", async () => {
    const invalid = await call(requester, "post", "/hr/recruitment-requests", requestBody({ salaryMax: "7000000" }));
    expect(invalid.body.error.fields.salaryMax).toBe(message("recruitmentSalaryRange"));
    expect((await call(requester, "post", "/hr/recruitment-requests", requestBody({ departmentId: testIds.headOfficeBranch }))).body.error.fields.departmentId).toBe(message("invalidValue"));

    const created = await call(requester, "post", "/hr/recruitment-requests", requestBody({ neededBy: "2026-11-01" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", documentNo: null, canSubmit: true, canClose: false });
    // Gửi với ngày cần người đã qua bị chặn.
    expect((await call(requester, "post", `/hr/recruitment-requests/${created.body.id}/submit`)).body.error.fields.neededBy).toBe(message("recruitmentNeededByPast"));
    expect((await call(requester, "patch", `/hr/recruitment-requests/${created.body.id}`, requestBody({ version: created.body.version }))).status).toBe(200);

    // Có chính sách duyệt: chờ duyệt; giá trị duyệt = lương tối đa × số lượng.
    const policy = await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "hr.recruitment_request",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const submitted = await call(requester, "post", `/hr/recruitment-requests/${created.body.id}/submit`);
    expect(submitted.body, JSON.stringify(submitted.body)).toMatchObject({ status: "pending", canWithdraw: true });
    expect(submitted.body.documentNo).toMatch(/^TD-/);
    const approval = await pool.query("SELECT amount::text FROM core.approval_requests WHERE id = $1", [submitted.body.approvalRequestId]);
    expect(approval.rows[0].amount).toBe("20000000.0000");

    // Người lập khác không thấy (404); nhân sự thấy; người không có quyền nhận 403.
    expect((await call(otherRequester, "get", `/hr/recruitment-requests/${created.body.id}`)).status).toBe(404);
    expect((await call(otherRequester, "get", "/hr/recruitment-requests")).body.total).toBe(0);
    expect((await call(hrStaff, "get", `/hr/recruitment-requests/${created.body.id}`)).status).toBe(200);
    expect((await call(outsider, "get", "/hr/recruitment-requests")).status).toBe(403);
    expect((await call(otherCompanyHr, "get", `/hr/recruitment-requests/${created.body.id}`, undefined, testIds.tradingCompany)).status).toBe(404);

    // Rút về rồi hủy; duyệt qua hộp duyệt chuyển "đã duyệt".
    expect((await call(requester, "post", `/hr/recruitment-requests/${created.body.id}/withdraw`)).body.status).toBe("withdrawn");
    expect((await call(requester, "post", `/hr/recruitment-requests/${created.body.id}/cancel`, { reason: "Đổi kế hoạch" })).body.status).toBe("cancelled");
    const second = await call(requester, "post", "/hr/recruitment-requests", requestBody());
    const pending = await call(requester, "post", `/hr/recruitment-requests/${second.body.id}/submit`);
    const approver = await signIn(application, "phuc.le@vcomm.test");
    await approver.call("post", `/approval-requests/${pending.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(requester, "get", `/hr/recruitment-requests/${second.body.id}`)).body.status).toBe("approved");
    await pool.query("UPDATE core.approval_policies SET effective_from = '2026-01-01', effective_to = '2026-01-01' WHERE document_type_code = 'hr.recruitment_request'");
  });
});

describe("CONG_VIEC_54 tin tuyển dụng", () => {
  it("KICHBAN_KIEMTHU_523: chỉ lập từ nhu cầu đã duyệt, khoảng lương, đăng, đóng, mở lại, tự đóng khi quá hạn", async () => {
    const draft = await call(hrStaff, "post", "/hr/recruitment-requests", requestBody());
    expect((await call(hrStaff, "post", "/hr/job-postings", postingBody(draft.body.id))).body.error.message).toBe(message("recruitmentNotApproved"));
    const requestId = await approvedRequest();
    expect((await call(hrStaff, "post", "/hr/job-postings", postingBody(requestId, { deadline: "2026-11-10" }))).body.error.fields.deadline).toBe(message("postingDeadlinePast"));
    const outside = await call(hrStaff, "post", "/hr/job-postings", postingBody(requestId, { salaryDisplay: "custom_range", salaryMin: "8000000", salaryMax: "12000000" }));
    expect(outside.body.error.fields.salaryMax).toBe(message("postingSalaryOutsideRequest"));
    expect((await call(hrStaff, "post", "/hr/job-postings", postingBody(requestId, { description: "<script>x</script>" }))).body.error.fields.description).toBe(message("invalidValue"));
    const created = await call(hrStaff, "post", "/hr/job-postings", postingBody(requestId, { salaryDisplay: "custom_range", salaryMin: "8500000", salaryMax: "9500000" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", canPublish: true, salaryMin: "8500000", stageCounts: { new: 0 } });
    expect((await call(requester, "get", `/hr/job-postings/${created.body.id}`)).status).toBe(403);
    const published = await call(hrStaff, "post", `/hr/job-postings/${created.body.id}/publish`);
    expect(published.body.status).toBe("open");
    expect((await call(hrStaff, "post", `/hr/job-postings/${created.body.id}/publish`)).body.error.message).toBe(message("postingStatusInvalid"));
    const audit = await pool.query("SELECT count(*)::int AS total FROM core.audit_events WHERE entity_id = $1 AND action LIKE 'job_posting.%'", [created.body.id]);
    expect(audit.rows[0].total).toBe(2);
    expect((await call(hrStaff, "post", `/hr/job-postings/${created.body.id}/close`)).body.status).toBe("closed");
    expect((await call(hrStaff, "post", `/hr/job-postings/${created.body.id}/reopen`, { deadline: "2026-12-15" })).body).toMatchObject({ status: "open", deadline: "2026-12-15" });

    // Việc nền đóng tin quá hạn nộp; hồ sơ mới, sàng lọc kết thúc "tin đã đóng".
    const postingId = await openPosting({ deadline: "2026-11-12" });
    const applied = await apply(postingId, applicant({ email: "het.han@example.test", phone: "0900000001" }));
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    testClock.fixed = new Date("2026-11-13T03:00:00Z");
    expect((await application.get(RecruitmentService).runDaily()).closedPostings).toBeGreaterThanOrEqual(1);
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
    const closed = await call(hrStaff, "get", `/hr/job-postings/${postingId}`);
    expect(closed.body.status).toBe("closed");
    expect(closed.body.applications[0]).toMatchObject({ outcome: "rejected", outcomeReason: "posting_closed" });
    expect(closed.body.stageCounts.ended).toBe(1);
  });
});

describe("CONG_VIEC_54 trang tuyển dụng công khai", () => {
  it("KICHBAN_KIEMTHU_524: chỉ tin công khai, không lộ trường nội bộ, nộp không đăng nhập, đồng ý, tệp, trùng", async () => {
    const postingId = await openPosting();
    const hidden = await openPosting({ isPublic: false, title: "Tin nội bộ" });
    const list = await anonymous().get("/api/v1/careers/postings").query({ search: "Nhân viên kho" });
    expect(list.status).toBe(200);
    expect(list.body.data.map((item: { id: string }) => item.id)).toContain(postingId);
    expect(list.body.data.map((item: { id: string }) => item.id)).not.toContain(hidden);
    expect(list.body.companies.map((company: { id: string }) => company.id)).toContain(retail);
    expect((await anonymous().get(`/api/v1/careers/postings/${hidden}`)).status).toBe(404);
    const detail = await anonymous().get(`/api/v1/careers/postings/${postingId}`).query({ locale: "en" });
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ salaryMin: "8000000", salaryMax: "10000000", negotiable: false, contactEmail: "tuyendung@vcr.vcomm.test" });
    expect(Object.keys(detail.body)).not.toEqual(expect.arrayContaining(["requestId", "headcount", "requestSalaryMin", "createdBy"]));
    expect(detail.body.terms.recruitment).toContain("30 days");
    expect(detail.body.terms.version).toBe("2026-11-11");

    // Thiếu đồng ý tuyển dụng, điều khoản cũ, tệp sai loại, không có tệp, tệp quá lớn đều bị chặn.
    expect((await apply(postingId, applicant({ recruitmentConsent: false }))).body.error.fields.recruitmentConsent).toBe(message("consentRequired"));
    expect((await apply(postingId, applicant({ termsVersion: "2025-01-01" }))).body.error.message).toBe(message("termsOutdated"));
    expect((await apply(postingId, applicant(), { content: png, name: "cv.pdf" })).body.error.fields.resume).toBe(message("resumeTypeInvalid"));
    expect((await apply(postingId, applicant(), null)).body.error.fields.resume).toBe(message("required"));
    const big = Buffer.concat([pdf, Buffer.alloc(10 * 1024 * 1024)]);
    expect((await apply(postingId, applicant(), { content: big, name: "cv.pdf" })).body.error.fields.resume).toBe(message("attachmentTooLarge"));
    expect((await apply(postingId, applicant({ phone: "12345" }))).body.error.fields.phone).toBeDefined();
    expect((await apply(postingId, { ...applicant(), gender: "male" })).status).toBe(400);
    const storedBefore = (await pool.query("SELECT count(*)::int AS total FROM hr.candidate_files")).rows[0].total;

    // Nộp được không đăng nhập, nhiều lần (không giới hạn); bằng chứng đồng ý đủ; lần sau đánh dấu trùng.
    const first = await apply(postingId, applicant({ talentPoolConsent: true }), { content: docx, name: "cv.docx" });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.reference).toMatch(/^UV-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(first.body.contactEmail).toBe("tuyendung@vcr.vcomm.test");
    const second = await apply(postingId, applicant({ email: "TOAN.NV@example.test", phone: "+84912333444" }));
    expect(second.status).toBe(201);
    expect((await pool.query("SELECT count(*)::int AS total FROM hr.candidate_files")).rows[0].total).toBe(storedBefore + 2);
    const consents = await pool.query(
      "SELECT k.purpose, k.terms_version, k.terms_text, k.ip, k.user_agent, k.channel FROM hr.candidate_consents k JOIN hr.candidates c ON c.id = k.candidate_id WHERE c.reference = $1 ORDER BY k.purpose",
      [first.body.reference],
    );
    expect(consents.rows.map((row) => row.purpose)).toEqual(["recruitment", "talent_pool"]);
    expect(consents.rows[0]).toMatchObject({ terms_version: "2026-11-11", channel: "careers_page" });
    expect(consents.rows[0].terms_text).toContain("Nhân viên kho – Bình Dương");
    expect(consents.rows[0].ip).toBeTruthy();

    const posting = await call(hrStaff, "get", `/hr/job-postings/${postingId}`);
    expect(posting.body.stageCounts.new).toBe(2);
    expect(posting.body.applications.every((item: { possibleDuplicate: boolean; source: string }) => item.possibleDuplicate && item.source === "careers_page")).toBe(true);
    const candidate = await call(hrStaff, "get", `/hr/candidates/${posting.body.applications[1].candidateId}`);
    expect(candidate.body.duplicates).toHaveLength(1);
    expect(candidate.body.poolUntil).toBe("2027-11-11");
    expect(candidate.body.eraseDue).toBeNull();
    const resume = candidate.body.files.find((file: { kind: string }) => file.kind === "resume");
    const downloaded = await call(hrStaff, "get", `/hr/candidate-files/${resume.id}`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-type"]).toContain("wordprocessingml");
    expect((await call(otherCompanyHr, "get", `/hr/candidate-files/${resume.id}`, undefined, testIds.tradingCompany)).status).toBe(404);

    // Tin đã đóng không nhận hồ sơ.
    await call(hrStaff, "post", `/hr/job-postings/${postingId}/close`);
    expect((await apply(postingId, applicant({ email: "muon@example.test" }))).status).toBe(404);
  });
});

describe("CONG_VIEC_54 ứng viên", () => {
  it("KICHBAN_KIEMTHU_525: nhập tay cần bằng chứng đồng ý, giai đoạn, kết thúc, kho ứng viên, ngày xóa, quyền", async () => {
    const postingId = await openPosting();
    const otherPostingId = await openPosting({ title: "Kế toán tổng hợp" });
    const data = {
      postingId,
      fullName: "Trần Thị Mai",
      email: "mai.tran@example.test",
      phone: "0903111222",
      source: "referral",
      sourceNote: "Anh Đức giới thiệu",
      consentDate: "2026-11-08",
    };
    const create = (body: unknown, files: Record<string, { content: Buffer; name: string }>) => {
      let sent = call(hrStaff, "post", "/hr/candidates").field("data", JSON.stringify(body));
      for (const [field, file] of Object.entries(files)) sent = sent.attach(field, file.content, file.name);
      return sent;
    };
    expect((await create(data, { resume: { content: pdf, name: "cv.pdf" } })).body.error.fields.consentEvidence).toBe(message("required"));
    expect((await create(data, { consentEvidence: { content: docx, name: "dong-y.docx" } })).body.error.fields.consentEvidence).toBe(message("evidenceTypeInvalid"));
    expect((await create({ ...data, poolConsentDate: "2026-11-09" }, { consentEvidence: { content: png, name: "dong-y.png" } })).body.error.fields.poolEvidence).toBe(message("required"));
    const created = await create(data, { resume: { content: pdf, name: "cv.pdf" }, consentEvidence: { content: png, name: "dong-y.png" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ source: "referral", possibleDuplicate: false, poolUntil: null, eraseDue: null });
    expect(created.body.consents[0]).toMatchObject({ purpose: "recruitment", channel: "manual", consentedOn: "2026-11-08" });
    const applicationId = created.body.applications[0].id as string;
    expect((await call(outsider, "get", `/hr/candidates/${created.body.id}`)).status).toBe(403);
    expect((await call(otherCompanyHr, "get", `/hr/candidates/${created.body.id}`, undefined, testIds.tradingCompany)).status).toBe(404);

    // Chuyển giai đoạn tự do giữa mới, sàng lọc, phỏng vấn; "đề nghị" không chuyển tay được.
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/stage`, { stage: "interview" })).body.applications[0].stage).toBe("interview");
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/stage`, { stage: "offer" })).status).toBe(400);
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/stage`, { stage: "screening" })).body.applications[0].stage).toBe("screening");
    // Không có kho ứng viên: không thêm vào tin khác được.
    expect((await call(hrStaff, "post", `/hr/candidates/${created.body.id}/applications`, { postingId: otherPostingId })).body.error.message).toBe(message("candidatePoolExpired"));
    // Loại cần lý do; kết thúc không mở lại; ngày xóa = ngày kết thúc + 30.
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/end`, { outcome: "rejected" })).body.error.fields.reason).toBe(message("required"));
    const ended = await call(hrStaff, "post", `/hr/applications/${applicationId}/end`, { outcome: "rejected", reason: "not_qualified" });
    expect(ended.body).toMatchObject({ eraseDue: "2026-12-11" });
    expect(ended.body.applications[0]).toMatchObject({ outcome: "rejected", outcomeReason: "not_qualified" });
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/stage`, { stage: "new" })).body.error.message).toBe(message("applicationEnded"));
    expect((await call(hrStaff, "get", "/hr/candidates", undefined)).body.data.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    expect((await call(hrStaff, "get", "/hr/candidates?tab=due")).body.data.some((item: { id: string }) => item.id === created.body.id)).toBe(false);

    // Đổi cài đặt lưu giữ thì tính lại ngày xóa; danh sách sắp đến hạn xóa.
    expect((await call(hrStaff, "put", "/hr/candidates/settings", { rejectedRetentionDays: 5, poolRetentionMonths: 6 })).body).toEqual({ rejectedRetentionDays: 5, poolRetentionMonths: 6 });
    expect((await call(hrStaff, "get", `/hr/candidates/${created.body.id}`)).body.eraseDue).toBe("2026-11-16");
    expect((await call(hrStaff, "get", "/hr/candidates?tab=due")).body.data.map((item: { id: string }) => item.id)).toContain(created.body.id);
    await call(hrStaff, "put", "/hr/candidates/settings", { rejectedRetentionDays: 30, poolRetentionMonths: 12 });

    // Ứng viên trong kho: thêm vào tin khác, không trùng hồ sơ đang xử lý.
    const pooled = await create(
      { ...data, email: "ha.phan@example.test", phone: "0987555666", fullName: "Phan Thu Hà", poolConsentDate: "2026-11-10" },
      { consentEvidence: { content: png, name: "dong-y.png" }, poolEvidence: { content: pdf, name: "kho.pdf" } },
    );
    expect(pooled.body.poolUntil).toBe("2027-11-10");
    const added = await call(hrStaff, "post", `/hr/candidates/${pooled.body.id}/applications`, { postingId: otherPostingId });
    expect(added.body.applications).toHaveLength(2);
    expect((await call(hrStaff, "post", `/hr/candidates/${pooled.body.id}/applications`, { postingId: otherPostingId })).body.error.message).toBe(message("applicationExists"));
    expect((await call(hrStaff, "get", "/hr/candidates?tab=pool")).body.data.map((item: { id: string }) => item.id)).toContain(pooled.body.id);
    expect((await call(hrStaff, "get", "/hr/candidates?tab=pool")).body.data.map((item: { id: string }) => item.id)).not.toContain(created.body.id);
    // Hết hồ sơ đang xử lý: ngày xóa là ngày muộn hơn giữa kho và kết thúc + 30.
    for (const item of added.body.applications) await call(hrStaff, "post", `/hr/applications/${item.id}/end`, { outcome: "withdrawn" });
    expect((await call(hrStaff, "get", `/hr/candidates/${pooled.body.id}`)).body.eraseDue).toBe("2027-11-10");

    // Sửa ứng viên: nhật ký chỉ ghi tên trường.
    const current = await call(hrStaff, "get", `/hr/candidates/${created.body.id}`);
    const updated = await call(hrStaff, "patch", `/hr/candidates/${created.body.id}`, {
      fullName: "Trần Thị Mai",
      email: "mai.moi@example.test",
      phone: "0903111222",
      sourceNote: "Anh Đức giới thiệu",
      version: current.body.version,
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    const log = await pool.query("SELECT after_data FROM core.audit_events WHERE entity_id = $1 AND action = 'candidate.update'", [created.body.id]);
    expect(log.rows[0].after_data).toEqual({ changed: ["email"] });
  });
});
