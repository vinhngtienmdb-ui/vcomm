// CONG_VIEC_54 lát L1: phỏng vấn, email, đề nghị nhận việc, lập hồ sơ nhân sự, xóa dữ liệu ứng viên (TIEUCHI_NGHIEMTHU_361 đến 364; KICHBAN_KIEMTHU_525 đến 528).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { CandidatesService } from "../src/hr/candidates.service";
import { JobOffersService } from "../src/hr/job-offers.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { sentMessages, startTestApplication, testClock, testStorage } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hrStaff: Session;
let interviewer: Session;
let otherInterviewer: Session;
let outsider: Session;
let interviewerId: string;
let otherInterviewerId: string;
let department: string;
const retail: string = testIds.retailCompany;
const branch: string = testIds.headOfficeBranch;
const pdf = Buffer.from("%PDF-1.4 so yeu ly lich");
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "patch" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const anonymous = () => request(application.getHttpServer());

async function assign(email: string, name: string, role: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
  return { id, session: await signIn(application, email) };
}

// Nhu cầu đã duyệt (số lượng tùy chọn), tin đang đăng, một ứng viên nộp công khai; trả mã hồ sơ ứng tuyển.
async function candidate(headcount = 2, email = "ung.vien@example.test", phone = "0901000001", locale = "vi") {
  const created = await call(hrStaff, "post", "/hr/recruitment-requests", {
    departmentId: department,
    branchId: branch,
    jobTitle: "Nhân viên kho",
    headcount,
    contractKind: "probation_then_official",
    salaryMin: "8000000",
    salaryMax: "10000000",
    neededBy: "2026-12-01",
    reason: "expansion",
  });
  await call(hrStaff, "post", `/hr/recruitment-requests/${created.body.id}/submit`);
  const posting = await call(hrStaff, "post", "/hr/job-postings", {
    requestId: created.body.id,
    title: "Nhân viên kho",
    location: "Bình Dương",
    workType: "full_time",
    description: "Nhận, xuất hàng.",
    salaryDisplay: "request_range",
    deadline: "2026-11-30",
    contactEmail: "tuyendung@vcr.vcomm.test",
    isPublic: true,
  });
  await call(hrStaff, "post", `/hr/job-postings/${posting.body.id}/publish`);
  const applied = await anonymous()
    .post(`/api/v1/careers/postings/${posting.body.id}/applications`)
    .field("data", JSON.stringify({ fullName: "Trần Thị Mai", email, phone, locale, termsVersion: "2026-11-11", recruitmentConsent: true, talentPoolConsent: false }))
    .attach("resume", pdf, "cv.pdf");
  expect(applied.status, JSON.stringify(applied.body)).toBe(201);
  const candidateId = (await pool.query<{ id: string }>("SELECT id FROM hr.candidates WHERE reference = $1", [applied.body.reference])).rows[0]!.id;
  const detail = await call(hrStaff, "get", `/hr/candidates/${candidateId}`);
  return { candidateId, applicationId: detail.body.applications[0].id as string, requestId: created.body.id as string, postingId: posting.body.id as string };
}

const interview = (values: Record<string, unknown> = {}) => ({
  name: "Phỏng vấn chuyên môn",
  startsAt: "2026-11-13T09:00:00+07:00",
  durationMinutes: 60,
  mode: "onsite",
  location: "Kho VCR-BD, cổng 2",
  interviewerIds: [interviewerId],
  sendEmail: true,
  message: "Vui lòng mang bản sao bằng cấp.",
  ...values,
});

const offer = (applicationId: string, values: Record<string, unknown> = {}) => ({
  applicationId,
  jobTitle: "Nhân viên kho",
  departmentId: department,
  branchId: branch,
  contractKind: "probation_then_official",
  salary: "9500000",
  startDate: "2026-12-01",
  responseDeadline: "2026-11-20",
  ...values,
});

async function sentOffer(applicationId: string) {
  const created = await call(hrStaff, "post", "/hr/job-offers", offer(applicationId));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect((await call(hrStaff, "post", `/hr/job-offers/${created.body.id}/submit`)).body.status).toBe("approved");
  sentMessages.length = 0;
  const sent = await call(hrStaff, "post", `/hr/job-offers/${created.body.id}/send`, { sendEmail: true });
  expect(sent.body.status, JSON.stringify(sent.body)).toBe("sent");
  const token = /\/hr\/careers\/offers\/([A-Za-z0-9_-]{43})/.exec(sentMessages[0]!.body)![1]!;
  return { offerId: created.body.id as string, token };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  hrStaff = (await assign("nhansu.quytrinh@vcomm.test", "Nhân viên tuyển dụng", "hr_staff")).session;
  ({ id: interviewerId, session: interviewer } = await assign("phongvan.mot@vcomm.test", "Phạm Văn Đức", "employee"));
  ({ id: otherInterviewerId, session: otherInterviewer } = await assign("phongvan.hai@vcomm.test", "Lê Thu", "employee"));
  outsider = (await assign("khong.lien.quan@vcomm.test", "Không liên quan", "employee")).session;
  department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'KHO2', 'Kho Bình Dương') RETURNING id", [retail])).rows[0]!.id;
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_54 phỏng vấn và email", () => {
  it("KICHBAN_KIEMTHU_525, 526: vòng phỏng vấn, tệp lịch, người phỏng vấn chỉ thấy ứng viên được giao, phiếu đánh giá, email báo kết quả", async () => {
    const { candidateId, applicationId } = await candidate(2, "mai.tran@example.test", "0903111222", "en");
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/interviews`, interview({ location: null }))).body.error.fields.location).toBe(message("required"));
    expect((await call(hrStaff, "post", `/hr/applications/${applicationId}/interviews`, interview({ interviewerIds: [testIds.retailCompany] }))).body.error.fields.interviewerIds).toBe(
      message("interviewerInvalid"),
    );
    sentMessages.length = 0;
    const created = await call(hrStaff, "post", `/hr/applications/${applicationId}/interviews`, interview({ interviewerIds: [interviewerId, otherInterviewerId] }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.applications[0].stage).toBe("interview");
    // Email ứng viên (tiếng Anh theo ngôn ngữ đã nộp) và hai người phỏng vấn, đều kèm tệp lịch.
    expect(sentMessages.map((item) => item.to).sort()).toEqual(["mai.tran@example.test", "phongvan.hai@vcomm.test", "phongvan.mot@vcomm.test"]);
    const toCandidate = sentMessages.find((item) => item.to === "mai.tran@example.test")!;
    expect(toCandidate.subject).toContain("invites you to interview");
    expect(toCandidate.body).toContain("Vui lòng mang bản sao bằng cấp.");
    const ics = toCandidate.attachments![0]!;
    expect(ics.fileName).toBe("invite.ics");
    expect(ics.content).toContain("METHOD:REQUEST");
    expect(ics.content).toContain("DTSTART:20261113T020000Z");
    expect(ics.content).toContain("SEQUENCE:0");
    const process = await call(hrStaff, "get", `/hr/candidates/${candidateId}/process`);
    const interviewId = process.body.interviews[0].id as string;
    expect(process.body.emails[0]).toMatchObject({ kind: "interview_invitation", recipient: "mai.tran@example.test" });
    const notified = await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'hr.interview.assigned' AND link = $1", [`/hr/interviews/${interviewId}`]);
    expect(notified.rows[0].total).toBe(2);

    // Đổi giờ: tăng SEQUENCE; người phỏng vấn thấy danh sách được giao, người ngoài không.
    sentMessages.length = 0;
    await call(hrStaff, "patch", `/hr/interviews/${interviewId}`, interview({ interviewerIds: [interviewerId, otherInterviewerId], startsAt: "2026-11-13T14:00:00+07:00" }));
    expect(sentMessages[0]!.attachments![0]!.content).toContain("SEQUENCE:1");
    expect((await call(interviewer, "get", "/hr/my-interviews")).body.map((item: { interviewId: string }) => item.interviewId)).toContain(interviewId);
    expect((await call(outsider, "get", `/hr/my-interviews/${interviewId}`)).status).toBe(404);
    expect((await call(outsider, "get", `/hr/candidates/${candidateId}`)).status).toBe(403);
    const mine = await call(interviewer, "get", `/hr/my-interviews/${interviewId}`);
    expect(mine.body.candidate).toMatchObject({ fullName: "Trần Thị Mai", resumeFileName: "cv.pdf" });
    expect(Object.keys(mine.body.candidate)).not.toContain("email");
    expect((await call(interviewer, "get", `/hr/my-interviews/${interviewId}/files/${mine.body.candidate.resumeFileId}`)).status).toBe(200);
    // Chưa có phiếu thì chưa đánh dấu xong; người phỏng vấn chưa nộp không thấy phiếu người khác.
    expect((await call(hrStaff, "post", `/hr/interviews/${interviewId}/complete`)).body.error.message).toBe(message("interviewNoEvaluation"));
    await call(otherInterviewer, "post", `/hr/my-interviews/${interviewId}/evaluation`, { score: 3, recommendation: "consider", comment: "Cần thêm kinh nghiệm kho lạnh" });
    expect((await call(interviewer, "get", `/hr/my-interviews/${interviewId}`)).body.interview.evaluations).toHaveLength(0);
    expect((await call(interviewer, "post", `/hr/my-interviews/${interviewId}/evaluation`, { score: 6, recommendation: "pass" })).status).toBe(400);
    const evaluated = await call(interviewer, "post", `/hr/my-interviews/${interviewId}/evaluation`, { score: 4, recommendation: "pass", comment: "Tốt" });
    expect(evaluated.body.interview.evaluations).toHaveLength(2);
    expect(evaluated.body.myEvaluation).toMatchObject({ score: 4, recommendation: "pass" });
    expect((await call(hrStaff, "post", `/hr/interviews/${interviewId}/complete`)).status).toBe(201);

    // Loại kèm email báo kết quả; lịch sử email ghi đủ; hồ sơ kết thúc thì không sửa phiếu được.
    sentMessages.length = 0;
    const ended = await call(hrStaff, "post", `/hr/applications/${applicationId}/end`, { outcome: "rejected", reason: "failed_interview", sendEmail: true, message: "Chúc bạn thành công." });
    expect(ended.status, JSON.stringify(ended.body)).toBe(201);
    expect(sentMessages[0]).toMatchObject({ to: "mai.tran@example.test", subject: expect.stringContaining("update on your application") });
    expect((await call(hrStaff, "get", `/hr/candidates/${candidateId}/process`)).body.emails.map((item: { kind: string }) => item.kind)).toEqual([
      "rejection",
      "interview_update",
      "interview_invitation",
    ]);
    expect((await call(interviewer, "post", `/hr/my-interviews/${interviewId}/evaluation`, { score: 5, recommendation: "pass" })).body.error.message).toBe(message("interviewClosed"));

    // Hủy vòng: METHOD:CANCEL.
    const second = await candidate(2, "huy@example.test", "0901000002");
    await call(hrStaff, "post", `/hr/applications/${second.applicationId}/interviews`, interview({ sendEmail: false }));
    const secondInterview = (await call(hrStaff, "get", `/hr/candidates/${second.candidateId}/process`)).body.interviews[0].id;
    sentMessages.length = 0;
    expect((await call(hrStaff, "post", `/hr/interviews/${secondInterview}/cancel`, { sendEmail: true })).status).toBe(201);
    expect(sentMessages[0]!.attachments![0]!.content).toContain("METHOD:CANCEL");
    expect((await call(interviewer, "get", `/hr/my-interviews/${secondInterview}`)).status).toBe(404);
  });
});

describe("CONG_VIEC_54 đề nghị nhận việc", () => {
  it("KICHBAN_KIEMTHU_527: khoảng lương, luồng duyệt, liên kết trả lời, lập hồ sơ nhân sự, đủ số lượng", async () => {
    const { candidateId, applicationId, requestId, postingId } = await candidate(1, "toan@example.test", "0901000003");
    const outside = await call(hrStaff, "post", "/hr/job-offers", offer(applicationId, { salary: "10500000" }));
    expect(outside.body.error.fields.outsideRangeReason).toBe(message("offerOutsideRange"));
    expect((await call(hrStaff, "post", "/hr/job-offers", offer(applicationId, { responseDeadline: "2026-12-05" }))).body.error.fields.responseDeadline).toBe(message("offerDeadlineInvalid"));
    const { offerId, token } = await sentOffer(applicationId);
    expect((await call(hrStaff, "post", "/hr/job-offers", offer(applicationId))).body.error.message).toBe(message("offerOpenExists"));
    expect(sentMessages[0]!.body).toContain("9.500.000");
    const stored = await pool.query("SELECT body FROM hr.candidate_emails WHERE kind = 'offer' AND candidate_id = $1", [candidateId]);
    expect(stored.rows[0].body).not.toContain(token);
    // Trang trả lời công khai: mã sai 404; trả lời một lần.
    expect((await anonymous().get(`/api/v1/job-offer-responses/${"x".repeat(43)}`)).status).toBe(404);
    const page = await anonymous().get(`/api/v1/job-offer-responses/${token}`);
    expect(page.body).toMatchObject({ jobTitle: "Nhân viên kho", salary: "9500000", answered: null });
    const answered = await anonymous().post(`/api/v1/job-offer-responses/${token}`).send({ accepted: true });
    expect(answered.status, JSON.stringify(answered.body)).toBe(200);
    expect(answered.body.answered).toBe("accepted");
    expect((await anonymous().post(`/api/v1/job-offer-responses/${token}`).send({ accepted: false })).status).toBe(409);
    const accepted = await call(hrStaff, "get", `/hr/job-offers/${offerId}`);
    expect(accepted.body).toMatchObject({ status: "accepted", responseChannel: "link", canHire: true });
    expect((await call(hrStaff, "get", `/hr/candidates/${candidateId}`)).body.applications[0].stage).toBe("hired");

    // Lập hồ sơ nhân sự: điền sẵn, chép sơ yếu lý lịch, tăng số đã tuyển, đủ số thì hoàn thành nhu cầu, đóng tin.
    const draft = await call(hrStaff, "get", `/hr/job-offers/${offerId}/employee-draft`);
    expect(draft.body).toMatchObject({ fullName: "Trần Thị Mai", personalEmail: "toan@example.test", hireDate: "2026-12-01", jobTitle: "Nhân viên kho" });
    const filesBefore = testStorage.files.size;
    const employeeBody = {
      fullName: draft.body.fullName,
      gender: "female",
      birthDate: "1998-04-12",
      identityNumber: "079198005401",
      residence: "Bình Dương",
      phone: draft.body.phone,
      personalEmail: draft.body.personalEmail,
      hireDate: draft.body.hireDate,
      departmentId: draft.body.departmentId,
      branchId: draft.body.branchId,
      jobTitle: draft.body.jobTitle,
    };
    const hired = await call(hrStaff, "post", `/hr/job-offers/${offerId}/hire`, employeeBody);
    expect(hired.status, JSON.stringify(hired.body)).toBe(201);
    expect(testStorage.files.size).toBe(filesBefore + 1);
    const documents = await call(hrStaff, "get", `/hr/employees/${hired.body.id}/documents`);
    expect(documents.body.map((item: { kind: string }) => item.kind)).toEqual(["resume"]);
    expect((await call(hrStaff, "get", `/hr/recruitment-requests/${requestId}`)).body).toMatchObject({ status: "completed", hiredCount: 1 });
    expect((await call(hrStaff, "get", `/hr/job-postings/${postingId}`)).body.status).toBe("closed");
    expect((await call(hrStaff, "get", `/hr/job-offers/${offerId}`)).body).toMatchObject({ canHire: false, employeeId: hired.body.id });
    expect((await call(hrStaff, "post", `/hr/job-offers/${offerId}/hire`, employeeBody)).body.error.message).toBe(message("candidateHired"));
    expect((await call(hrStaff, "get", `/hr/candidates/${candidateId}`)).body.eraseDue).toBeNull();
  });

  it("KICHBAN_KIEMTHU_527: từ chối, hết hạn, hủy, nhân sự ghi thay", async () => {
    const declined = await candidate(2, "tu.choi@example.test", "0901000004");
    const first = await sentOffer(declined.applicationId);
    await anonymous().post(`/api/v1/job-offer-responses/${first.token}`).send({ accepted: false, note: "Đã nhận nơi khác" });
    const afterDecline = await call(hrStaff, "get", `/hr/candidates/${declined.candidateId}`);
    expect(afterDecline.body.applications[0]).toMatchObject({ outcome: "rejected", outcomeReason: "declined_offer" });
    expect(afterDecline.body.eraseDue).toBe("2026-12-11");
    expect((await anonymous().get(`/api/v1/job-offer-responses/${first.token}`)).body.answered).toBe("declined");

    // Nhân sự ghi thay; liên kết cũ hết hiệu lực khi gửi lại thư.
    const manual = await candidate(2, "ghi.tay@example.test", "0901000005");
    const second = await sentOffer(manual.applicationId);
    await call(hrStaff, "post", `/hr/job-offers/${second.offerId}/send`, { sendEmail: true });
    expect((await anonymous().get(`/api/v1/job-offer-responses/${second.token}`)).status).toBe(404);
    expect((await call(hrStaff, "post", `/hr/job-offers/${second.offerId}/response`, { accepted: true, respondedOn: "2026-11-11" })).body).toMatchObject({
      status: "accepted",
      responseChannel: "manual",
    });

    // Hết hạn trả lời: việc nền chuyển hết hạn, liên kết 404; hủy đề nghị đưa hồ sơ về phỏng vấn.
    const late = await candidate(2, "tre.han@example.test", "0901000006");
    const third = await sentOffer(late.applicationId);
    testClock.fixed = new Date("2026-11-21T03:00:00Z");
    expect(await application.get(JobOffersService).expireDue()).toBeGreaterThanOrEqual(1);
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
    expect((await call(hrStaff, "get", `/hr/job-offers/${third.offerId}`)).body.status).toBe("expired");
    expect((await anonymous().get(`/api/v1/job-offer-responses/${third.token}`)).status).toBe(404);
    const again = await call(hrStaff, "post", "/hr/job-offers", offer(late.applicationId));
    const cancelled = await call(hrStaff, "post", `/hr/job-offers/${again.body.id}/cancel`, { reason: "Đổi vị trí" });
    expect(cancelled.body.status).toBe("cancelled");
    expect((await call(hrStaff, "get", `/hr/candidates/${late.candidateId}`)).body.applications[0].stage).toBe("interview");
  });
});

describe("CONG_VIEC_54 lưu giữ và xóa", () => {
  it("KICHBAN_KIEMTHU_528: xóa theo hạn, theo yêu cầu, rút đồng ý kho, giữ số liệu thống kê, chạy lại không lỗi", async () => {
    const retention = await candidate(2, "xoa.han@example.test", "0901000007");
    await call(hrStaff, "post", `/hr/applications/${retention.applicationId}/interviews`, interview({ sendEmail: true }));
    const interviewId = (await call(hrStaff, "get", `/hr/candidates/${retention.candidateId}/process`)).body.interviews[0].id;
    await call(interviewer, "post", `/hr/my-interviews/${interviewId}/evaluation`, { score: 2, recommendation: "fail", comment: "Nhận xét có tên người" });
    await call(hrStaff, "post", `/hr/applications/${retention.applicationId}/end`, { outcome: "rejected", reason: "failed_interview", note: "ghi chú" });
    const keys = (await pool.query<{ storage_key: string }>("SELECT storage_key FROM hr.candidate_files WHERE candidate_id = $1", [retention.candidateId])).rows.map((row) => row.storage_key);
    expect(keys.every((key) => testStorage.files.has(key))).toBe(true);
    // Chưa đến hạn: không xóa; đến hạn (30 ngày sau kết thúc): xóa hết trường cá nhân và tệp.
    const service = application.get(CandidatesService);
    testClock.fixed = new Date("2026-12-10T03:00:00Z");
    await service.eraseDue();
    expect((await pool.query("SELECT erased_at FROM hr.candidates WHERE id = $1", [retention.candidateId])).rows[0].erased_at).toBeNull();
    testClock.fixed = new Date("2026-12-11T03:00:00Z");
    expect((await service.eraseDue()).erased).toBeGreaterThanOrEqual(1);
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
    const row = (await pool.query("SELECT * FROM hr.candidates WHERE id = $1", [retention.candidateId])).rows[0];
    expect(row).toMatchObject({ full_name: "-", email: null, phone: null, email_key: null, erasure_reason: "retention", source: "careers_page" });
    expect(keys.some((key) => testStorage.files.has(key))).toBe(false);
    expect((await pool.query("SELECT terms_text, ip FROM hr.candidate_consents WHERE candidate_id = $1", [retention.candidateId])).rows[0]).toEqual({ terms_text: null, ip: null });
    const evaluation = (await pool.query("SELECT score, comment FROM hr.interview_evaluations WHERE interview_id = $1", [interviewId])).rows[0];
    expect(evaluation).toEqual({ score: 2, comment: null });
    expect(
      (await pool.query("SELECT recipient, body FROM hr.candidate_emails WHERE candidate_id = $1", [retention.candidateId])).rows.every((item) => item.recipient === null && item.body === null),
    ).toBe(true);
    expect((await pool.query("SELECT stage, outcome_reason, outcome_note FROM hr.applications WHERE candidate_id = $1", [retention.candidateId])).rows[0]).toEqual({
      stage: "interview",
      outcome_reason: "failed_interview",
      outcome_note: null,
    });
    await service.erase(retention.candidateId, "retention", null);
    expect((await call(hrStaff, "get", "/hr/candidates")).body.data.map((item: { id: string }) => item.id)).not.toContain(retention.candidateId);
    expect((await call(interviewer, "get", "/hr/my-interviews")).body.map((item: { interviewId: string }) => item.interviewId)).not.toContain(interviewId);
    const audit = await pool.query("SELECT after_data FROM core.audit_events WHERE entity_id = $1 AND action = 'candidate.erase'", [retention.candidateId]);
    expect(audit.rows).toHaveLength(1);

    // Kho ứng viên: ghi đồng ý (tệp bằng chứng), rút đồng ý tính lại ngày xóa.
    const pooled = await candidate(2, "kho@example.test", "0901000008");
    await call(hrStaff, "post", `/hr/applications/${pooled.applicationId}/end`, { outcome: "withdrawn" });
    const recorded = await hrStaff.call("post", `/hr/candidates/${pooled.candidateId}/pool-consents`, { companyId: retail }).field("consentDate", "2026-11-11").attach("file", pdf, "dong-y.pdf");
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(201);
    expect(recorded.body).toMatchObject({ poolUntil: "2027-11-11", eraseDue: "2027-11-11" });
    expect((await call(hrStaff, "post", `/hr/candidates/${pooled.candidateId}/pool-consents/withdraw`)).body).toMatchObject({ poolUntil: null, eraseDue: "2026-12-11" });

    // Yêu cầu xóa: kết thúc hồ sơ, hủy đề nghị, xóa ngay; ứng viên đã thành nhân viên không xóa được.
    const requested = await candidate(2, "yeu.cau@example.test", "0901000009");
    const { token } = await sentOffer(requested.applicationId);
    const erased = await call(hrStaff, "post", `/hr/candidates/${requested.candidateId}/erasure`, { receivedOn: "2026-11-11", channel: "email" });
    expect(erased.status, JSON.stringify(erased.body)).toBe(201);
    expect(erased.body).toMatchObject({ fullName: "-", email: null, erasedAt: expect.any(String) });
    expect(erased.body.applications[0]).toMatchObject({ outcome: "withdrawn", candidateErased: true });
    expect((await anonymous().get(`/api/v1/job-offer-responses/${token}`)).status).toBe(404);
    expect((await call(hrStaff, "post", `/hr/candidates/${requested.candidateId}/erasure`, { receivedOn: "2026-11-11", channel: "email" })).body.error.message).toBe(message("candidateErased"));

    // Kho lưu trữ lỗi khi xóa theo yêu cầu: yêu cầu vẫn ghi, ngày xóa là hôm nay, việc nền chạy lại với lý do "theo yêu cầu".
    const failing = await candidate(2, "kho.loi@example.test", "0901000010");
    const remove = testStorage.remove;
    testStorage.remove = async () => {
      throw new Error("Kho lưu trữ lỗi");
    };
    const pending = await call(hrStaff, "post", `/hr/candidates/${failing.candidateId}/erasure`, { receivedOn: "2026-11-11", channel: "phone" });
    testStorage.remove = remove;
    expect(pending.status, JSON.stringify(pending.body)).toBe(201);
    expect(pending.body).toMatchObject({ erasedAt: null, eraseDue: "2026-11-11" });
    expect((await application.get(CandidatesService).eraseDue()).failed).toBe(0);
    expect((await pool.query("SELECT full_name, erasure_reason, erased_at IS NOT NULL AS erased FROM hr.candidates WHERE id = $1", [failing.candidateId])).rows[0]).toEqual({
      full_name: "-",
      erasure_reason: "request",
      erased: true,
    });
    const hiredCandidate = (await pool.query<{ candidate_id: string }>("SELECT candidate_id FROM hr.applications WHERE employee_id IS NOT NULL LIMIT 1")).rows[0]!.candidate_id;
    expect((await call(hrStaff, "post", `/hr/candidates/${hiredCandidate}/erasure`, { receivedOn: "2026-11-11", channel: "email" })).body.error.message).toBe(message("candidateHired"));
  });
});
