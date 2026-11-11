// CONG_VIEC_52 lát L0: công việc (TIEUCHI_NGHIEMTHU_339 đến 341; KICHBAN_KIEMTHU_498 đến 500, phần công việc của 507).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { OfficeTasksService } from "../src/office/office-tasks.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let assigner: Session;
let owner: Session;
let crossCompany: Session;
let bystander: Session;
let admin: Session;
let outsiderCompanyUser: string;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;
const trading = testIds.tradingCompany;
const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\n");
const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

async function employee(email: string, name: string, companyId: string): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId }]);
  const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role, companyId]);
  return id;
}

const createTask = (session: Session, body: Record<string, unknown>, companyId = retail) => session.call("post", "/office/tasks", { companyId, body });
const act = (session: Session, id: string | undefined, action: string, version: number, reason?: string) =>
  session.call("post", `/office/tasks/${id ?? ""}/transition`, { companyId: retail, body: { action, version, ...(reason ? { reason } : {}) } });
const notificationsOf = async (userId: string | undefined, kind: string) =>
  (await pool.query<{ title: string }>("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = $2 ORDER BY created_at", [userId, kind])).rows;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  ids.assigner = await employee("giao.viec@vcomm.test", "Nguyễn Thị Giao", retail);
  ids.owner = await employee("chu.tri@vcomm.test", "Trần Văn Chủ Trì", retail);
  ids.crossCompany = await employee("cong.ty.khac@vcomm.test", "Võ Thành Đạt", trading);
  ids.bystander = await employee("nguoi.ngoai.viec@vcomm.test", "Lê Văn Ngoài", retail);
  // Công ty ngoài tập đoàn (không có công ty mẹ chung) để thử chặn giao việc.
  const outside = (await pool.query<{ id: string }>("INSERT INTO core.companies (code, legal_name, short_name) VALUES ('NGOAI', 'Công ty Ngoài', 'Ngoài') RETURNING id")).rows[0]!.id;
  outsiderCompanyUser = await createTestUser(pool, "ngoai.tap.doan@vcomm.test", "Phạm Ngoài Tập Đoàn", [{ companyId: outside }]);
  assigner = await signIn(application, "giao.viec@vcomm.test");
  owner = await signIn(application, "chu.tri@vcomm.test");
  crossCompany = await signIn(application, "cong.ty.khac@vcomm.test");
  bystander = await signIn(application, "nguoi.ngoai.viec@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_498: lập việc, trạng thái, việc con", () => {
  it("kiểm tra dữ liệu khi lập việc", async () => {
    expect((await createTask(assigner, { title: "", ownerUserId: ids.owner })).status).toBe(400);
    const dueBeforeStart = await createTask(assigner, { title: "Việc sai hạn", ownerUserId: ids.owner, startDate: "2030-01-10", dueAt: "2030-01-09T10:00:00+07:00" });
    expect(dueBeforeStart.status).toBe(400);
    expect(dueBeforeStart.body.error.fields.dueAt).toBeDefined();
    const duplicate = await createTask(assigner, { title: "Trùng vai trò", ownerUserId: ids.owner, followerIds: [ids.owner] });
    expect(duplicate.status).toBe(400);
  });

  it("chủ trì bắt đầu, báo xong; người giao trả lại, xác nhận; việc con", async () => {
    const created = await createTask(assigner, {
      title: "Đối soát kho Bình Dương tháng 10",
      description: "Đối chiếu tồn cuối kỳ",
      ownerUserId: ids.owner,
      collaboratorIds: [ids.crossCompany],
      dueAt: inHours(72),
      priority: "high",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "new", priority: "high", progress: 0, companyId: retail, owner: { id: ids.owner }, collaborators: [{ id: ids.crossCompany }] });
    expect(created.body.allowedActions).toEqual(expect.arrayContaining(["edit", "cancel", "add_child"]));
    ids.task = created.body.id;
    expect((await notificationsOf(ids.owner, "office_task_assigned")).length).toBe(1);
    expect((await notificationsOf(ids.crossCompany, "office_task_assigned")).length).toBe(1);

    // Người giao không bắt đầu thay chủ trì; người ngoài việc không thấy việc.
    expect((await act(assigner, ids.task, "start", 1)).status).toBe(409);
    expect((await act(bystander, ids.task, "start", 1)).status).toBe(404);
    const started = await act(owner, ids.task, "start", 1);
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("in_progress");
    expect((await act(owner, ids.task, "report_done", 1)).status).toBe(409);

    // Việc con: hạn không sau hạn việc cha, một cấp.
    expect((await createTask(owner, { title: "Kiểm kho lạnh", ownerUserId: ids.owner, parentId: ids.task, dueAt: inHours(100) })).status).toBe(400);
    const child = await createTask(owner, { title: "Kiểm kho lạnh", ownerUserId: ids.owner, parentId: ids.task, dueAt: inHours(48) });
    expect(child.status).toBe(201);
    expect((await createTask(owner, { title: "Cháu", ownerUserId: ids.owner, parentId: child.body.id, dueAt: inHours(24) })).status).toBe(409);
    expect((await createTask(bystander, { title: "Không được", ownerUserId: ids.owner, parentId: ids.task, dueAt: inHours(24) })).status).toBe(404);

    const parent = await owner.call("get", `/office/tasks/${ids.task}`, { companyId: retail });
    expect(parent.body.children).toHaveLength(1);
    const blocked = await act(owner, ids.task, "report_done", parent.body.version);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain("việc con");
    expect((await act(owner, child.body.id, "report_done", 1)).body.status).toBe("completed");

    const done = await act(owner, ids.task, "report_done", parent.body.version);
    expect(done.body).toMatchObject({ status: "pending_confirmation", progress: 100 });
    expect((await act(assigner, ids.task, "return", done.body.version)).status).toBe(400);
    const returned = await act(assigner, ids.task, "return", done.body.version, "Thiếu kho lạnh");
    expect(returned.body).toMatchObject({ status: "in_progress", statusReason: "Thiếu kho lạnh" });
    expect((await act(assigner, ids.task, "confirm", returned.body.version)).status).toBe(409);
    const again = await act(owner, ids.task, "report_done", returned.body.version);
    const confirmed = await act(assigner, ids.task, "confirm", again.body.version);
    expect(confirmed.body.status).toBe("completed");
    expect(confirmed.body.allowedActions).toEqual([]);

    const edit = await assigner.call("patch", `/office/tasks/${ids.task}`, { companyId: retail, body: { title: "Sửa", ownerUserId: ids.owner, version: confirmed.body.version } });
    expect(edit.status).toBe(409);
  });

  it("người giao là chủ trì thì báo xong là hoàn thành; hủy việc cha hủy việc con; xung đột phiên bản", async () => {
    const self = await createTask(assigner, { title: "Việc của mình", ownerUserId: ids.assigner });
    expect((await act(assigner, self.body.id, "report_done", 1)).body.status).toBe("completed");

    const parent = await createTask(assigner, { title: "Chuẩn bị họp", ownerUserId: ids.owner, dueAt: inHours(50) });
    const child = await createTask(assigner, { title: "Đặt phòng họp", ownerUserId: ids.owner, parentId: parent.body.id, dueAt: inHours(20) });
    expect((await act(assigner, parent.body.id, "cancel", 1)).status).toBe(400);
    expect((await act(assigner, parent.body.id, "cancel", 2, "Hoãn họp")).status).toBe(409);
    const cancelled = await act(assigner, parent.body.id, "cancel", 1, "Hoãn họp");
    expect(cancelled.body.status).toBe("cancelled");
    const childAfter = await assigner.call("get", `/office/tasks/${child.body.id}`, { companyId: retail });
    expect(childAfter.body).toMatchObject({ status: "cancelled", statusReason: "Hoãn họp" });
  });

  it("sửa việc: chỉ người giao; thêm người tham gia mới được thông báo", async () => {
    const task = await createTask(assigner, { title: "Soạn kế hoạch quý", ownerUserId: ids.owner });
    expect((await owner.call("patch", `/office/tasks/${task.body.id}`, { companyId: retail, body: { title: "x", ownerUserId: ids.owner, version: 1 } })).status).toBe(403);
    const updated = await assigner.call("patch", `/office/tasks/${task.body.id}`, {
      companyId: retail,
      body: { title: "Soạn kế hoạch quý 1", ownerUserId: ids.owner, followerIds: [ids.bystander], priority: "urgent", version: 1 },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ title: "Soạn kế hoạch quý 1", priority: "urgent", followers: [{ id: ids.bystander }], version: 2 });
    expect((await notificationsOf(ids.bystander, "office_task_assigned")).length).toBe(1);
    const progress = await owner.call("post", `/office/tasks/${task.body.id}/progress`, { companyId: retail, body: { progress: 40, version: 2 } });
    expect(progress.body.progress).toBe(40);
    expect((await assigner.call("post", `/office/tasks/${task.body.id}/progress`, { companyId: retail, body: { progress: 50, version: 3 } })).status).toBe(403);
  });
});

describe("KICHBAN_KIEMTHU_499: quyền xem, việc liên công ty, cách ly", () => {
  it("người công ty khác trong tập đoàn thấy đúng việc mình tham gia", async () => {
    const mine = await crossCompany.call("get", "/office/tasks?view=mine&status=all", { companyId: trading });
    expect(mine.status).toBe(200);
    expect(mine.body.data.map((item: { id: string }) => item.id)).toContain(ids.task);
    expect(mine.body.data.find((item: { id: string }) => item.id === ids.task).companyName).toBe("VComm Bán lẻ Miền Nam");
    expect((await crossCompany.call("get", `/office/tasks/${ids.task}`, { companyId: trading })).status).toBe(200);
    const other = await createTask(assigner, { title: "Việc riêng công ty bán lẻ", ownerUserId: ids.owner });
    ids.privateTask = other.body.id;
    expect((await crossCompany.call("get", `/office/tasks/${other.body.id}`, { companyId: trading })).status).toBe(404);
    expect((await crossCompany.call("get", `/office/tasks/${other.body.id}/comments`, { companyId: trading })).status).toBe(404);
    // Không là thành viên công ty bán lẻ thì không chọn được công ty đó.
    expect((await crossCompany.call("get", "/office/tasks", { companyId: retail })).status).toBe(403);
  });

  it("người không tham gia nhận 404; thẻ Của công ty cần quyền xem mọi việc", async () => {
    expect((await bystander.call("get", `/office/tasks/${ids.privateTask}`, { companyId: retail })).status).toBe(404);
    expect((await bystander.call("get", "/office/tasks?view=company", { companyId: retail })).status).toBe(403);
    const company = await admin.call("get", "/office/tasks?view=company&status=all", { companyId: retail });
    expect(company.status).toBe(200);
    expect(company.body.data.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining([ids.task, ids.privateTask]));
    expect((await admin.call("get", `/office/tasks/${ids.privateTask}`, { companyId: retail })).status).toBe(200);
  });

  it("chặn giao cho người ngoài tập đoàn; tìm người chỉ trả thông tin hiển thị", async () => {
    const outside = await createTask(assigner, { title: "Giao ra ngoài", ownerUserId: outsiderCompanyUser });
    expect(outside.status).toBe(400);
    expect(outside.body.error.fields.ownerUserId).toBeDefined();
    const people = await assigner.call("get", `/office/people?search=${encodeURIComponent("Đạt")}`, { companyId: retail });
    expect(people.status).toBe(200);
    expect(people.body).toEqual([{ id: ids.crossCompany, fullName: "Võ Thành Đạt", companyId: trading, companyName: "VComm Thương mại", departmentName: null }]);
    const none = await assigner.call("get", `/office/people?search=${encodeURIComponent("Ngoài Tập Đoàn")}`, { companyId: retail });
    expect(none.body).toEqual([]);
  });

  it("không có quyền vào mini app thì 403", async () => {
    await createTestUser(pool, "khong.quyen@vcomm.test", "Không Quyền", [{ companyId: retail }]);
    const noRole = await signIn(application, "khong.quyen@vcomm.test");
    expect((await noRole.call("get", "/office/tasks", { companyId: retail })).status).toBe(403);
  });
});

describe("KICHBAN_KIEMTHU_500: bình luận, tệp, lịch sử, nhắc hạn", () => {
  it("bình luận: thông báo người tham gia, sửa, xóa mềm của mình", async () => {
    const task = await createTask(assigner, { title: "Trao đổi giá vận chuyển", ownerUserId: ids.owner, collaboratorIds: [ids.crossCompany] });
    ids.commentTask = task.body.id;
    const added = await crossCompany.call("post", `/office/tasks/${task.body.id}/comments`, { companyId: trading, body: { body: "Đã nhận, tôi gửi bảng giá chiều nay." } });
    expect(added.status).toBe(201);
    expect(added.body[0]).toMatchObject({ body: "Đã nhận, tôi gửi bảng giá chiều nay.", canEdit: true, deleted: false, author: { id: ids.crossCompany } });
    expect((await notificationsOf(ids.assigner, "office_task_comment")).length).toBe(1);
    expect((await notificationsOf(ids.owner, "office_task_comment")).length).toBe(1);
    expect((await notificationsOf(ids.crossCompany, "office_task_comment")).length).toBe(0);
    const commentId = added.body[0].id;
    expect((await assigner.call("patch", `/office/tasks/${task.body.id}/comments/${commentId}`, { companyId: retail, body: { body: "Sửa hộ" } })).status).toBe(403);
    const edited = await crossCompany.call("patch", `/office/tasks/${task.body.id}/comments/${commentId}`, { companyId: trading, body: { body: "Gửi bảng giá sáng mai." } });
    expect(edited.body[0].editedAt).not.toBeNull();
    const removed = await crossCompany.call("delete", `/office/tasks/${task.body.id}/comments/${commentId}`, { companyId: trading });
    expect(removed.body[0]).toMatchObject({ deleted: true, body: null, canEdit: false });
    expect((await bystander.call("post", `/office/tasks/${task.body.id}/comments`, { companyId: retail, body: { body: "Xen vào" } })).status).toBe(404);
  });

  it("tệp: kiểm loại, người tham gia tải được, chỉ người tải lên xóa", async () => {
    const upload = await owner.call("post", `/office/tasks/${ids.commentTask}/files`, { companyId: retail }).attach("file", pdf, "bang-gia.pdf");
    expect(upload.status).toBe(201);
    expect(upload.body[0]).toMatchObject({ fileName: "bang-gia.pdf", contentType: "application/pdf", canDelete: true });
    const fileId = upload.body[0].id;
    const fake = await owner.call("post", `/office/tasks/${ids.commentTask}/files`, { companyId: retail }).attach("file", Buffer.from("khong phai pdf"), "gia.pdf");
    expect(fake.status).toBe(400);
    expect(fake.body.error.fields.file).toBeDefined();
    const exe = await owner.call("post", `/office/tasks/${ids.commentTask}/files`, { companyId: retail }).attach("file", Buffer.from("MZ"), "chay.exe");
    expect(exe.status).toBe(400);
    const download = await crossCompany.call("get", `/office/tasks/${ids.commentTask}/files/${fileId}`, { companyId: trading }).buffer(true);
    expect(download.status).toBe(200);
    expect(Buffer.compare(download.body as Buffer, pdf)).toBe(0);
    expect((await bystander.call("get", `/office/tasks/${ids.commentTask}/files/${fileId}`, { companyId: retail })).status).toBe(404);
    expect((await assigner.call("delete", `/office/tasks/${ids.commentTask}/files/${fileId}`, { companyId: retail })).status).toBe(403);
    const removed = await owner.call("delete", `/office/tasks/${ids.commentTask}/files/${fileId}`, { companyId: retail });
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual([]);
    const history = await assigner.call("get", `/office/tasks/${ids.commentTask}/history`, { companyId: retail });
    expect(history.body.map((event: { action: string }) => event.action)).toEqual(["file_removed", "file_added", "created"]);
  });

  it("nhắc còn 24 giờ và quá hạn, mỗi mốc một lần", async () => {
    const service = application.get(OfficeTasksService);
    const task = await createTask(assigner, { title: "Nộp báo cáo thuế", ownerUserId: ids.owner, collaboratorIds: [ids.crossCompany], dueAt: inHours(10) });
    await service.remindDue();
    await service.remindDue();
    expect((await notificationsOf(ids.owner, "office_task_due_soon")).filter((item) => item.title.includes("Nộp báo cáo thuế"))).toHaveLength(1);
    expect((await notificationsOf(ids.crossCompany, "office_task_due_soon")).filter((item) => item.title.includes("Nộp báo cáo thuế"))).toHaveLength(1);
    testClock.fixed = new Date(Date.now() + 11 * 3_600_000);
    await service.remindDue();
    await service.remindDue();
    expect((await notificationsOf(ids.assigner, "office_task_overdue")).filter((item) => item.title.includes("Nộp báo cáo thuế"))).toHaveLength(1);
    expect((await notificationsOf(ids.owner, "office_task_overdue")).filter((item) => item.title.includes("Nộp báo cáo thuế"))).toHaveLength(1);
    const overdue = await owner.call("get", "/office/tasks?view=mine&due=overdue", { companyId: retail });
    expect(overdue.body.data.find((item: { id: string }) => item.id === task.body.id)).toMatchObject({ overdue: true });
    testClock.fixed = null;
  });
});
