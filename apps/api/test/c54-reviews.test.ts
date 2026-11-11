// CONG_VIEC_54 lát L2: đánh giá hiệu suất (TIEUCHI_NGHIEMTHU_365; KICHBAN_KIEMTHU_529).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { ReviewsService } from "../src/hr/reviews.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let hrStaff: Session;
let head: Session;
let worker: Session;
let colleague: Session;
let outsider: Session;
let headId: string;
let department: string;
let otherDepartment: string;
const retail: string = testIds.retailCompany;
const branch: string = testIds.headOfficeBranch;
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const call = (session: Session, method: "get" | "post" | "patch" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });

async function assign(email: string, name: string, role: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
  return { id, session: await signIn(application, email) };
}

async function employee(name: string, identity: string, departmentId: string, userId: string | null) {
  const created = await call(hrStaff, "post", "/hr/employees", {
    fullName: name,
    gender: "female",
    birthDate: "1995-01-01",
    identityNumber: identity,
    residence: "Thành phố Hồ Chí Minh",
    hireDate: "2025-01-01",
    departmentId,
    branchId: branch,
    jobTitle: "Kế toán viên",
    userId,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.id as string;
}

const cycleBody = (templateId: string, values: Record<string, unknown> = {}) => ({
  name: "Năm 2026",
  periodFrom: "2026-01-01",
  periodTo: "2026-12-31",
  templateId,
  goalWeight: 60,
  competencyWeight: 40,
  goalDeadline: "2026-11-20",
  selfDeadline: "2026-12-10",
  managerDeadline: "2026-12-20",
  allDepartments: false,
  departmentIds: [department],
  ...values,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = new Date("2026-11-11T03:00:00Z");
  hrStaff = (await assign("nhansu.danhgia@vcomm.test", "Nhân viên nhân sự", "hr_staff")).session;
  ({ id: headId, session: head } = await assign("truongphong.ketoan@vcomm.test", "Nguyễn Văn Bình", "employee"));
  const workerUser = await assign("ngoc.le@vcomm.test", "Lê Thị Bích Ngọc", "employee");
  worker = workerUser.session;
  const colleagueUser = await assign("dong.nghiep@vcomm.test", "Đồng nghiệp", "employee");
  colleague = colleagueUser.session;
  outsider = (await assign("ngoai.ky@vcomm.test", "Không trong kỳ", "employee")).session;
  const departments = await pool.query<{ id: string }>(
    "INSERT INTO core.departments (company_id, code, name, manager_user_id) VALUES ($1, 'KT', 'Phòng Kế toán', $2), ($1, 'TC', 'Phòng Tài chính', NULL) RETURNING id",
    [retail, headId],
  );
  department = departments.rows[0]!.id;
  otherDepartment = departments.rows[1]!.id;
  await employee("Lê Thị Bích Ngọc", "079195000101", department, workerUser.id);
  await employee("Nguyễn Văn Bình", "079195000102", department, headId);
  await employee("Đồng nghiệp", "079195000103", department, colleagueUser.id);
  await employee("Phòng khác", "079195000104", otherDepartment, null);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_54 đánh giá hiệu suất", () => {
  it("KICHBAN_KIEMTHU_529: mẫu, kỳ, phiếu, mục tiêu, tự đánh giá, chấm, điểm, xếp loại, hiệu chỉnh, chốt, công bố, quyền, nhắc", async () => {
    // Mẫu: tổng trọng số 100.
    const criteria = [
      { name: "Chuyên môn", weight: 40 },
      { name: "Tinh thần trách nhiệm", weight: 30 },
      { name: "Phối hợp", weight: 20 },
      { name: "Chủ động cải tiến", weight: 10 },
    ];
    expect((await call(hrStaff, "post", "/hr/review-templates", { name: "Văn phòng", criteria: criteria.slice(0, 3) })).body.error.fields.criteria).toBe(message("weightsNotHundred"));
    const template = await call(hrStaff, "post", "/hr/review-templates", { name: "Năng lực khối văn phòng", criteria });
    expect(template.status, JSON.stringify(template.body)).toBe(201);
    expect((await call(worker, "get", "/hr/review-templates")).status).toBe(403);

    // Kỳ: tỷ trọng 100, ngưỡng giảm dần, hạn tăng dần.
    expect((await call(hrStaff, "post", "/hr/review-cycles", cycleBody(template.body.id, { competencyWeight: 30 }))).body.error.fields.competencyWeight).toBe(message("weightsNotHundred"));
    expect((await call(hrStaff, "post", "/hr/review-cycles", cycleBody(template.body.id, { thresholdB: "4.6" }))).body.error.fields.thresholdC).toBe(message("reviewThresholdsOrder"));
    expect((await call(hrStaff, "post", "/hr/review-cycles", cycleBody(template.body.id, { selfDeadline: "2026-12-25" }))).body.error.fields.managerDeadline).toBe(message("reviewDeadlinesOrder"));
    const cycle = await call(hrStaff, "post", "/hr/review-cycles", cycleBody(template.body.id));
    expect(cycle.status, JSON.stringify(cycle.body)).toBe(201);
    // Mở kỳ: phiếu cho phòng ban đối tượng; người chấm là trưởng phòng, trừ phiếu của chính trưởng phòng.
    const opened = await call(hrStaff, "post", `/hr/review-cycles/${cycle.body.id}/open`);
    expect(opened.body.status).toBe("open");
    expect(opened.body.reviews.map((item: { employeeName: string }) => item.employeeName).sort()).toEqual(["Lê Thị Bích Ngọc", "Nguyễn Văn Bình", "Đồng nghiệp"]);
    const byName = (name: string) => opened.body.reviews.find((item: { employeeName: string }) => item.employeeName === name);
    expect(byName("Lê Thị Bích Ngọc")).toMatchObject({ reviewerName: "Nguyễn Văn Bình", phase: "goals" });
    expect(byName("Nguyễn Văn Bình").reviewerId).toBeNull();
    expect((await call(hrStaff, "patch", `/hr/review-templates/${template.body.id}`, { name: "Sửa", criteria })).body.error.message).toBe(message("reviewTemplateUsed"));
    const reviewId = byName("Lê Thị Bích Ngọc").id as string;
    const colleagueReview = byName("Đồng nghiệp").id as string;

    // Quyền: nhân viên chỉ phiếu của mình; người chấm phiếu được giao; người khác 404.
    expect((await call(colleague, "get", `/hr/reviews/${reviewId}`)).status).toBe(404);
    expect((await call(outsider, "get", `/hr/reviews/${reviewId}`)).status).toBe(404);
    expect((await call(worker, "get", "/hr/my-reviews")).body.own).toHaveLength(1);
    expect((await call(head, "get", "/hr/my-reviews")).body.scoring.map((item: { id: string }) => item.id).sort()).toEqual([reviewId, colleagueReview].sort());

    // Mục tiêu: tổng 100; nhân viên lập, người chấm xác nhận; chưa xác nhận thì chưa tự đánh giá, chưa chấm.
    expect((await call(worker, "put", `/hr/reviews/${reviewId}/goals`, { goals: [{ name: "Đóng sổ đúng hạn", weight: 50 }] })).body.error.fields.goals).toBe(message("weightsNotHundred"));
    const goals = await call(worker, "put", `/hr/reviews/${reviewId}/goals`, {
      goals: [
        { name: "Đóng sổ tháng đúng hạn", target: "12/12 tháng", weight: 50 },
        { name: "Giảm sai sót đối chiếu", weight: 30 },
        { name: "Khóa kế toán quản trị", weight: 20 },
      ],
    });
    expect(goals.status, JSON.stringify(goals.body)).toBe(200);
    expect(goals.body).toMatchObject({ canSelfAssess: false, canConfirmGoals: false });
    expect((await call(worker, "post", `/hr/reviews/${reviewId}/goals/confirm`)).status).toBe(409);
    expect((await call(head, "post", `/hr/reviews/${reviewId}/goals/confirm`)).body).toMatchObject({ phase: "self", canEditGoals: false });

    // Tự đánh giá: nộp cần đủ điểm.
    const sheet = (await call(worker, "get", `/hr/reviews/${reviewId}`)).body;
    const all = (value: number) => ({
      goals: sheet.goals.map((goal: { id: string }) => ({ id: goal.id, score: value })),
      criteria: sheet.criteria.map((item: { id: string }) => ({ id: item.id, score: value })),
    });
    expect((await call(worker, "put", `/hr/reviews/${reviewId}/self-assessment`, { ...all(4), goals: [], submit: true })).body.error.message).toBe(message("reviewScoresMissing"));
    const selfDone = await call(worker, "put", `/hr/reviews/${reviewId}/self-assessment`, { ...all(4), comment: "Tôi hoàn thành tốt", submit: true });
    expect(selfDone.body).toMatchObject({ phase: "manager", canSelfAssess: false });
    expect(selfDone.body.goals[0].selfScore).toBe(4);

    // Người chấm: điểm mục tiêu 5,4,3 → 4,20; năng lực 4,5,4,3 → 4,20... tính theo trọng số.
    const scores = {
      goals: sheet.goals.map((goal: { id: string }, index: number) => ({ id: goal.id, score: [5, 4, 3][index] })),
      criteria: sheet.criteria.map((item: { id: string }, index: number) => ({ id: item.id, score: [4, 5, 4, 3][index] })),
      comment: "Hoàn thành tốt việc đóng sổ",
    };
    expect((await call(worker, "put", `/hr/reviews/${reviewId}/manager-assessment`, { ...scores, submit: true })).status).toBe(409);
    const draftScore = await call(head, "put", `/hr/reviews/${reviewId}/manager-assessment`, scores);
    expect(draftScore.body.managerSubmittedAt).toBeNull();
    // Nhân viên chưa thấy điểm người chấm trước khi công bố.
    const beforePublish = (await call(worker, "get", `/hr/reviews/${reviewId}`)).body;
    expect(beforePublish.goals[0].managerScore).toBeNull();
    expect(beforePublish.managerComment).toBeNull();
    const submitted = await call(head, "put", `/hr/reviews/${reviewId}/manager-assessment`, { ...scores, submit: true });
    // Mục tiêu (5×50 + 4×30 + 3×20)/100 = 4,30; năng lực (4×40 + 5×30 + 4×20 + 3×10)/100 = 4,20; tổng (60×4,30 + 40×4,20)/100 = 4,26 → B.
    expect(submitted.body).toMatchObject({ goalScore: "4.30", competencyScore: "4.20", totalScore: "4.26", grade: "B", phase: "submitted", canScore: false });
    expect((await call(worker, "get", `/hr/reviews/${reviewId}`)).body).toMatchObject({ totalScore: null, grade: null });

    // Hiệu chỉnh: lý do bắt buộc, xếp loại theo điểm hiệu chỉnh; ghi nhật ký.
    expect((await call(hrStaff, "post", `/hr/reviews/${reviewId}/adjust`, { score: "4.6" })).status).toBe(400);
    expect((await call(head, "post", `/hr/reviews/${reviewId}/adjust`, { score: "4.6", reason: "x" })).status).toBe(409);
    const adjusted = await call(hrStaff, "post", `/hr/reviews/${reviewId}/adjust`, { score: "4.6", reason: "Họp hiệu chỉnh 18/12" });
    expect(adjusted.body).toMatchObject({ adjustedScore: "4.60", finalScore: "4.60", grade: "A" });
    const log = await pool.query("SELECT before_data, after_data FROM core.audit_events WHERE entity_id = $1 AND action = 'review.adjust'", [reviewId]);
    expect(log.rows[0]).toMatchObject({ before_data: { score: "4.26" }, after_data: { score: "4.6" } });

    // Chốt kỳ: còn phiếu chưa nộp thì không chốt; gán người chấm (không là chính nhân viên), loại phiếu có lý do.
    expect((await call(hrStaff, "post", `/hr/review-cycles/${cycle.body.id}/close`)).body.error.message).toBe(message("reviewCycleNotComplete"));
    const headReview = byName("Nguyễn Văn Bình").id as string;
    expect((await call(hrStaff, "put", `/hr/reviews/${headReview}/reviewer`, { reviewerId: headId })).body.error.fields.reviewerId).toBe(message("reviewerSelf"));
    expect((await call(hrStaff, "post", `/hr/reviews/${headReview}/exclude`, { reason: "Nghỉ thai sản" })).status).toBe(201);
    expect((await call(head, "get", `/hr/reviews/${headReview}`)).status).toBe(404);
    // Nhắc quá hạn đặt mục tiêu: mỗi hạn mỗi phiếu một lần.
    testClock.fixed = new Date("2026-11-21T03:00:00Z");
    const service = application.get(ReviewsService);
    expect(await service.sendReminders()).toBe(1);
    expect(await service.sendReminders()).toBe(0);
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
    const reminded = await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'hr.review.reminder' AND link = $1", [`/hr/my-reviews/${colleagueReview}`]);
    expect(reminded.rows[0].total).toBe(2);
    // Đồng nghiệp: mục tiêu, xác nhận, quá hạn tự đánh giá thì khóa bước tự đánh giá, người chấm vẫn chấm.
    await call(colleague, "put", `/hr/reviews/${colleagueReview}/goals`, { goals: [{ name: "Hỗ trợ kiểm toán", weight: 100 }] });
    await call(head, "post", `/hr/reviews/${colleagueReview}/goals/confirm`);
    testClock.fixed = new Date("2026-12-11T03:00:00Z");
    expect((await call(colleague, "get", `/hr/reviews/${colleagueReview}`)).body).toMatchObject({ phase: "manager", canSelfAssess: false });
    const colleagueSheet = (await call(head, "get", `/hr/reviews/${colleagueReview}`)).body;
    await call(head, "put", `/hr/reviews/${colleagueReview}/manager-assessment`, {
      goals: colleagueSheet.goals.map((goal: { id: string }) => ({ id: goal.id, score: 2 })),
      criteria: colleagueSheet.criteria.map((item: { id: string }) => ({ id: item.id, score: 3 })),
      submit: true,
    });
    testClock.fixed = new Date("2026-11-11T03:00:00Z");
    // Mở lại phiếu đã nộp rồi nộp lại.
    expect((await call(hrStaff, "post", `/hr/reviews/${colleagueReview}/reopen`)).body.totalScore).toBeNull();
    const resubmitted = await call(head, "put", `/hr/reviews/${colleagueReview}/manager-assessment`, { goals: [], criteria: [], submit: true });
    // (60×2 + 40×3)/100 = 2,40 → D.
    expect(resubmitted.body).toMatchObject({ totalScore: "2.40", grade: "D" });

    const closed = await call(hrStaff, "post", `/hr/review-cycles/${cycle.body.id}/close`);
    expect(closed.body).toMatchObject({ status: "closed", canPublish: true, gradeDistribution: { A: 1, B: 0, C: 0, D: 1 } });
    expect((await call(worker, "post", `/hr/reviews/${reviewId}/acknowledge`, {})).status).toBe(409);
    const published = await call(hrStaff, "post", `/hr/review-cycles/${cycle.body.id}/publish`);
    expect(published.body.status).toBe("published");
    const notified = await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'hr.review.published'");
    expect(notified.rows[0].total).toBe(2);
    // Sau công bố: nhân viên thấy điểm, xếp loại, nhận xét; xác nhận, ý kiến một lần.
    const result = (await call(worker, "get", `/hr/reviews/${reviewId}`)).body;
    expect(result).toMatchObject({ finalScore: "4.60", grade: "A", managerComment: "Hoàn thành tốt việc đóng sổ", adjustmentReason: null, canAcknowledge: true });
    expect(result.goals[0].managerScore).toBe(5);
    expect((await call(worker, "post", `/hr/reviews/${reviewId}/acknowledge`, { comment: "Cảm ơn anh" })).body).toMatchObject({ canAcknowledge: false, employeeComment: "Cảm ơn anh" });
    expect((await call(worker, "post", `/hr/reviews/${reviewId}/acknowledge`, { comment: "Lần hai" })).status).toBe(409);
    expect((await call(worker, "get", "/hr/my-reviews")).body.own[0]).toMatchObject({ published: true, grade: "A" });
  });
});
