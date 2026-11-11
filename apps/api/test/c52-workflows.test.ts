// CONG_VIEC_52 lát L1: quy trình theo mẫu (TIEUCHI_NGHIEMTHU_342, 343; KICHBAN_KIEMTHU_501, 502, phần quy trình của 507).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let initiator: Session;
let manager: Session;
let director: Session;
let purchaser: Session;
let accountant: Session;
let receiver: Session;
let outsider: Session;
const ids: Record<string, string> = {};
const retail = testIds.retailCompany;

async function employee(email: string, name: string, departmentId?: string): Promise<string> {
  const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role, retail]);
  if (departmentId) await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2", [departmentId, id]);
  return id;
}

// Mẫu "Mua văn phòng phẩm": rẽ nhánh theo kết quả và số tiền, song song, gộp, quay lại bước trước.
const definition = () => ({
  fields: [
    { key: "noi_dung", label: "Nội dung cần mua", type: "text", required: true },
    { key: "so_tien", label: "Số tiền dự kiến", type: "number", required: true },
    { key: "nguoi_nhan", label: "Người nhận hàng", type: "user", required: true },
  ],
  firstStepKey: "truong_phong",
  steps: [
    {
      key: "truong_phong",
      name: "Trưởng phòng xem xét",
      days: 2,
      assignee: { type: "initiator_manager" },
      outcomes: ["Đồng ý", "Không đồng ý"],
      transitions: [
        { outcome: "Đồng ý", condition: { fieldKey: "so_tien", operator: "gt", value: "5000000" }, targets: ["giam_doc"] },
        { outcome: "Đồng ý", condition: null, targets: ["hanh_chinh", "ke_toan"] },
      ],
      otherwise: ["end"],
    },
    {
      key: "giam_doc",
      name: "Giám đốc duyệt",
      days: 2,
      assignee: { type: "role", roleId: ids.directorRole },
      outcomes: ["Đồng ý", "Xem lại"],
      transitions: [{ outcome: "Đồng ý", condition: null, targets: ["hanh_chinh", "ke_toan"] }],
      otherwise: ["truong_phong"],
    },
    { key: "hanh_chinh", name: "Hành chính mua", days: 3, assignee: { type: "user", userId: ids.purchaser }, outcomes: ["Hoàn thành"], otherwise: ["nhan_hang"] },
    { key: "ke_toan", name: "Kế toán thanh toán", days: 3, assignee: { type: "user", userId: ids.accountant }, outcomes: ["Hoàn thành"], otherwise: ["nhan_hang"] },
    { key: "nhan_hang", name: "Nhận hàng", kind: "join", days: 1, assignee: { type: "field", fieldKey: "nguoi_nhan" }, outcomes: ["Đã nhận"], otherwise: ["end"] },
  ],
});

const run = (session: Session, id: string | undefined) => session.call("get", `/office/workflow-runs/${id}`, { companyId: retail });
const openTask = async (session: Session, runId: string | undefined, stepKey: string) => {
  const detail = await run(admin, runId);
  const step = detail.body.steps.filter((item: { stepKey: string; status: string }) => item.stepKey === stepKey && item.status === "open").pop();
  const task = await session.call("get", `/office/tasks/${step.taskId}`, { companyId: retail });
  expect(task.status).toBe(200);
  return task.body;
};
const finish = async (session: Session, runId: string | undefined, stepKey: string, outcome: string) => {
  const task = await openTask(session, runId, stepKey);
  const response = await session.call("post", `/office/tasks/${task.id}/transition`, { companyId: retail, body: { action: "report_done", outcome, version: task.version } });
  expect(response.status).toBe(200);
  expect(response.body.status).toBe("completed");
};
const start = (session: Session, title: string, amount: string) =>
  session.call("post", "/office/workflow-runs", { companyId: retail, body: { templateId: ids.template, title, values: { noi_dung: "Giấy A4, mực in", so_tien: amount, nguoi_nhan: ids.receiver } } });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const department = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name) VALUES ($1, 'HC', 'Phòng Hành chính') RETURNING id", [retail])).rows[0]!.id;
  ids.department = department;
  ids.manager = await employee("truong.phong.hc@vcomm.test", "Đặng Văn Trưởng", department);
  await pool.query("UPDATE core.departments SET manager_user_id = $1 WHERE id = $2", [ids.manager, department]);
  ids.initiator = await employee("khoi.tao@vcomm.test", "Phạm Gia Huy", department);
  ids.director = await employee("giam.doc@vcomm.test", "Nguyễn Văn An");
  ids.purchaser = await employee("hanh.chinh@vcomm.test", "Mai Anh");
  ids.accountant = await employee("ke.toan.tt@vcomm.test", "Lê Thị Bích Ngọc");
  ids.receiver = await employee("nhan.hang@vcomm.test", "Trần Văn Nhận");
  ids.outsider = await employee("khong.lien.quan@vcomm.test", "Vũ Không Liên Quan");
  ids.directorRole = (
    await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en) VALUES ($1, 'giam_doc', 'Giám đốc', 'Director') RETURNING id", [retail])
  ).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [
    ids.director,
    ids.directorRole,
    retail,
  ]);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  initiator = await signIn(application, "khoi.tao@vcomm.test");
  manager = await signIn(application, "truong.phong.hc@vcomm.test");
  director = await signIn(application, "giam.doc@vcomm.test");
  purchaser = await signIn(application, "hanh.chinh@vcomm.test");
  accountant = await signIn(application, "ke.toan.tt@vcomm.test");
  receiver = await signIn(application, "nhan.hang@vcomm.test");
  outsider = await signIn(application, "khong.lien.quan@vcomm.test");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("KICHBAN_KIEMTHU_501: kiểm tra hợp lệ, phiên bản mẫu", () => {
  it("chỉ người quản lý quy trình thiết kế mẫu", async () => {
    expect((await initiator.call("get", "/office/workflow-templates", { companyId: retail })).status).toBe(403);
  });

  it("mẫu sai bị chặn kích hoạt, sửa xong kích hoạt được", async () => {
    const broken = definition();
    broken.steps[0]!.otherwise = null as unknown as string[];
    broken.steps.push({ key: "thua", name: "Bước thừa", days: 1, assignee: { type: "initiator" }, outcomes: ["Xong"], otherwise: ["end"] } as never);
    (broken.steps[1]!.transitions as { condition: unknown }[])[0]!.condition = { fieldKey: "noi_dung", operator: "gt", value: "abc" };
    broken.steps[4]!.kind = "task";
    const created = await admin.call("post", "/office/workflow-templates", { companyId: retail, body: { name: "Mua văn phòng phẩm", definition: broken } });
    expect(created.status).toBe(201);
    ids.template = created.body.id;
    const codes = created.body.issues.map((issue: { stepKey: string | null; code: string }) => `${issue.stepKey}:${issue.code}`);
    expect(codes).toEqual(expect.arrayContaining(["truong_phong:missingOtherwise", "thua:unreachable", "giam_doc:fieldTypeMismatch"]));
    expect((await admin.call("post", `/office/workflow-templates/${ids.template}/activate`, { companyId: retail })).status).toBe(409);

    const join = definition();
    join.steps[3]!.otherwise = ["end"];
    const oneInput = await admin.call("patch", `/office/workflow-templates/${ids.template}`, { companyId: retail, body: { name: "Mua văn phòng phẩm", definition: join } });
    expect(oneInput.body.issues).toEqual([{ stepKey: "nhan_hang", code: "joinNeedsTwoInputs" }]);

    const fixed = await admin.call("patch", `/office/workflow-templates/${ids.template}`, { companyId: retail, body: { name: "Mua văn phòng phẩm", definition: definition() } });
    expect(fixed.body.issues).toEqual([]);
    const activated = await admin.call("post", `/office/workflow-templates/${ids.template}/activate`, { companyId: retail });
    expect(activated.status).toBe(200);
    expect(activated.body).toMatchObject({ status: "active", activeVersionNo: 1, hasDraft: false });
  });

  it("phiên bản mới không ảnh hưởng phiên đang chạy", async () => {
    const first = await start(initiator, "Giấy tháng 11", "1000000");
    expect(first.status).toBe(201);
    ids.versionRun = first.body.id;
    const changed = definition();
    changed.steps[0]!.name = "Trưởng phòng xem xét (bản 2)";
    const draft = await admin.call("patch", `/office/workflow-templates/${ids.template}`, { companyId: retail, body: { name: "Mua văn phòng phẩm", definition: changed } });
    expect(draft.body).toMatchObject({ editingVersionNo: 2, editingIsDraft: true, activeVersionNo: 1 });
    expect((await admin.call("post", `/office/workflow-templates/${ids.template}/activate`, { companyId: retail })).body.activeVersionNo).toBe(2);
    const old = await run(initiator, ids.versionRun);
    expect(old.body).toMatchObject({ versionNo: 1, steps: [{ stepName: "Trưởng phòng xem xét" }] });
    const second = await start(initiator, "Mực in", "1000000");
    expect(second.body).toMatchObject({ versionNo: 2, steps: [{ stepName: "Trưởng phòng xem xét (bản 2)" }] });
    expect((await initiator.call("post", `/office/workflow-runs/${second.body.id}/cancel`, { companyId: retail, body: { reason: "Thử phiên bản", version: second.body.version } })).status).toBe(200);
  });

  it("kiểm tra biểu mẫu khởi tạo; giới hạn phòng ban được khởi tạo", async () => {
    const missing = await initiator.call("post", "/office/workflow-runs", { companyId: retail, body: { templateId: ids.template, title: "Thiếu", values: { so_tien: "abc" } } });
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields).toMatchObject({ "values.noi_dung": expect.any(String), "values.so_tien": expect.any(String) });
    const limited = { ...definition(), starterDepartmentIds: [ids.department] };
    await admin.call("patch", `/office/workflow-templates/${ids.template}`, { companyId: retail, body: { name: "Mua văn phòng phẩm", definition: limited } });
    await admin.call("post", `/office/workflow-templates/${ids.template}/activate`, { companyId: retail });
    expect((await outsider.call("get", "/office/workflow-start-options", { companyId: retail })).body).toEqual([]);
    expect((await start(outsider, "Không được", "1000")).status).toBe(404);
    expect((await initiator.call("get", "/office/workflow-start-options", { companyId: retail })).body.map((item: { name: string }) => item.name)).toEqual(["Mua văn phòng phẩm"]);
  });
});

describe("KICHBAN_KIEMTHU_502: chạy quy trình", () => {
  it("số tiền nhỏ: song song hai nhánh, bước gộp mở một lần khi cả hai xong", async () => {
    const versionRun = await run(initiator, ids.versionRun);
    expect(versionRun.body).toMatchObject({ status: "running", openSteps: ["Trưởng phòng xem xét"] });
    expect(versionRun.body.runNo).toMatch(/^QT-VCR-2026-\d{5}$/);
    const task = await openTask(manager, ids.versionRun, "truong_phong");
    expect(task.workflow).toMatchObject({ outcomes: ["Đồng ý", "Không đồng ý"], stepName: "Trưởng phòng xem xét" });
    expect(task.allowedActions).not.toContain("cancel");
    expect((await manager.call("post", `/office/tasks/${task.id}/transition`, { companyId: retail, body: { action: "report_done", version: task.version } })).status).toBe(400);
    expect((await manager.call("post", `/office/tasks/${task.id}/transition`, { companyId: retail, body: { action: "report_done", outcome: "Sai", version: task.version } })).status).toBe(400);
    await finish(manager, ids.versionRun, "truong_phong", "Đồng ý");
    expect((await run(initiator, ids.versionRun)).body.openSteps.sort()).toEqual(["Hành chính mua", "Kế toán thanh toán"]);
    await finish(purchaser, ids.versionRun, "hanh_chinh", "Hoàn thành");
    const waiting = await run(initiator, ids.versionRun);
    expect(waiting.body.steps.find((step: { stepKey: string }) => step.stepKey === "nhan_hang")).toMatchObject({ status: "waiting", taskId: null });
    await finish(accountant, ids.versionRun, "ke_toan", "Hoàn thành");
    const joined = await run(initiator, ids.versionRun);
    expect(joined.body.steps.filter((step: { stepKey: string }) => step.stepKey === "nhan_hang")).toHaveLength(1);
    expect(joined.body.openSteps).toEqual(["Nhận hàng"]);
    await finish(receiver, ids.versionRun, "nhan_hang", "Đã nhận");
    const done = await run(initiator, ids.versionRun);
    expect(done.body.status).toBe("completed");
    expect((await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND kind = 'office_workflow_completed'", [ids.initiator])).rowCount).toBe(1);
  });

  it("số tiền lớn: giám đốc theo vai trò nhận việc, xem lại quay về trưởng phòng, không đồng ý thì kết thúc", async () => {
    const started = await start(initiator, "Máy in mới", "7200000");
    const runId = started.body.id;
    await finish(manager, runId, "truong_phong", "Đồng ý");
    const roleTask = await openTask(director, runId, "giam_doc");
    expect(roleTask).toMatchObject({ owner: null, allowedActions: ["claim"], workflow: { candidateRoleName: "Giám đốc" } });
    expect((await outsider.call("get", `/office/tasks/${roleTask.id}`, { companyId: retail })).status).toBe(404);
    const claimed = await director.call("post", `/office/tasks/${roleTask.id}/transition`, { companyId: retail, body: { action: "claim", version: roleTask.version } });
    expect(claimed.body.owner.id).toBe(ids.director);
    await finish(director, runId, "giam_doc", "Xem lại");
    const back = await run(initiator, runId);
    expect(back.body.steps.filter((step: { stepKey: string }) => step.stepKey === "truong_phong")).toHaveLength(2);
    expect(back.body.openSteps).toEqual(["Trưởng phòng xem xét"]);
    await finish(manager, runId, "truong_phong", "Không đồng ý");
    expect((await run(initiator, runId)).body.status).toBe("completed");
    expect((await run(outsider, runId)).status).toBe(404);
    expect((await run(director, runId)).status).toBe(200);
  });

  it("không xác định được người thực hiện: phiên bị chặn, chỉ định người thì chạy tiếp; hủy phiên hủy việc đang mở", async () => {
    await pool.query("UPDATE core.departments SET manager_user_id = NULL WHERE id = $1", [ids.department]);
    const started = await start(initiator, "Bút bi", "100000");
    expect(started.body).toMatchObject({ status: "blocked", canAssign: true, steps: [{ status: "blocked", blockedReason: "noAssignee" }] });
    expect((await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND kind = 'office_workflow_blocked'", [ids.initiator])).rowCount).toBeGreaterThan(0);
    expect(
      (
        await outsider.call("post", `/office/workflow-runs/${started.body.id}/assign`, {
          companyId: retail,
          body: { stepInstanceId: started.body.steps[0].id, userId: ids.manager, version: started.body.version },
        })
      ).status,
    ).toBe(404);
    const assigned = await admin.call("post", `/office/workflow-runs/${started.body.id}/assign`, {
      companyId: retail,
      body: { stepInstanceId: started.body.steps[0].id, userId: ids.manager, version: started.body.version },
    });
    expect(assigned.body).toMatchObject({ status: "running", openSteps: ["Trưởng phòng xem xét"] });
    await pool.query("UPDATE core.departments SET manager_user_id = $1 WHERE id = $2", [ids.manager, ids.department]);
    const task = await openTask(manager, started.body.id, "truong_phong");
    expect((await initiator.call("post", `/office/workflow-runs/${started.body.id}/cancel`, { companyId: retail, body: { version: assigned.body.version } })).status).toBe(400);
    const cancelled = await initiator.call("post", `/office/workflow-runs/${started.body.id}/cancel`, { companyId: retail, body: { reason: "Không cần nữa", version: assigned.body.version } });
    expect(cancelled.body.status).toBe("cancelled");
    expect((await manager.call("get", `/office/tasks/${task.id}`, { companyId: retail })).body.status).toBe("cancelled");
    expect((await initiator.call("post", `/office/workflow-runs/${started.body.id}/cancel`, { companyId: retail, body: { reason: "Lần nữa", version: cancelled.body.version } })).status).toBe(409);
  });

  it("phiên mở quá 100 bước thì bị chặn", async () => {
    const started = await start(initiator, "Vòng lặp", "7200000");
    await finish(manager, started.body.id, "truong_phong", "Đồng ý");
    await pool.query("UPDATE office.workflow_runs SET step_count = 100 WHERE id = $1", [started.body.id]);
    const roleTask = await openTask(director, started.body.id, "giam_doc");
    await director.call("post", `/office/tasks/${roleTask.id}/transition`, { companyId: retail, body: { action: "claim", version: roleTask.version } });
    await finish(director, started.body.id, "giam_doc", "Xem lại");
    const blocked = await run(initiator, started.body.id);
    expect(blocked.body.status).toBe("blocked");
    expect(blocked.body.steps.pop()).toMatchObject({ status: "blocked", blockedReason: "stepLimit" });
  });

  it("danh sách phiên theo phạm vi", async () => {
    const mine = await initiator.call("get", "/office/workflow-runs?scope=mine", { companyId: retail });
    expect(mine.body.total).toBeGreaterThanOrEqual(5);
    const involved = await receiver.call("get", "/office/workflow-runs?scope=involved", { companyId: retail });
    expect(involved.body.data.map((item: { id: string }) => item.id)).toEqual([ids.versionRun]);
    expect((await initiator.call("get", "/office/workflow-runs?scope=company", { companyId: retail })).status).toBe(403);
    expect((await admin.call("get", "/office/workflow-runs?scope=company", { companyId: retail })).status).toBe(200);
  });
});
