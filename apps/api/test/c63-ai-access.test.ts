// CONG_VIEC_63 L1: trợ lý AI – cài đặt công ty, điều kiện dùng, thông báo xử lý dữ liệu cá nhân, hạn mức, nhật ký lượt
// (TIEUCHI_NGHIEMTHU_470, 472, 473, 474; KICHBAN_KIEMTHU_653, 654, 657, 658, 659). Mọi lượt gọi mô hình dùng bộ giả lập.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { AiFeatureStatus, AiMeResponse } from "contracts";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AiAccessService, type UsageRecord } from "../src/ai/ai-access.service";
import { testIds } from "../src/database/seed";
import type { Actor } from "../src/permissions/roles.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testAiConfig, testClock, testModel } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let groupAdmin: Session;
let employee: Session;
let adminId: string;
let groupAdminId: string;
const retail: string = testIds.retailCompany;
// Giữa tháng theo giờ Việt Nam để không vướng ranh giới ngày, tháng.
const midNovember = new Date("2026-11-17T03:00:00Z");

const userId = async (email: string) => (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = $1", [email])).rows[0]!.id;
const actorOf = (id: string, companyId = retail): Actor => ({ userId: id, companyId, client: { ip: "127.0.0.1", userAgent: "kiem-thu", requestId: null } as unknown as Actor["client"] });
const me = async (session: Session, companyId = retail): Promise<AiMeResponse> => {
  const response = await session.call("get", "/ai/me", { companyId });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
};
const chat = (status: AiMeResponse): AiFeatureStatus => status.features.find((item) => item.feature === "chat")!;
const settings = async (session: Session, companyId = retail) => (await session.call("get", "/ai/settings", { companyId })).body;
async function save(session: Session, body: Record<string, unknown>, companyId = retail) {
  const current = await settings(session, companyId);
  const response = await session.call("patch", "/ai/settings", {
    companyId,
    body: {
      chatEnabled: current.chatEnabled,
      productContentEnabled: current.productContentEnabled,
      monthlyBudgetUsd: current.monthlyBudgetUsd,
      dailyTurnsPerUser: current.dailyTurnsPerUser,
      version: current.version,
      ...body,
    },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return response.body;
}
// 25.000 token vào, 1.000 token ra với đơn giá mặc định 2 / 10 USD: 0,06 USD một lượt.
const turn = (extra: Partial<UsageRecord> = {}): UsageRecord => ({
  feature: "chat",
  model: "claude-sonnet-5-5",
  usage: { inputTokens: 25_000, outputTokens: 1_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
  toolCalls: 1,
  status: "ok",
  durationMs: 1_200,
  ...extra,
});
const access = () => application.get(AiAccessService);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = midNovember;
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  await createTestUser(pool, "nhanvien.ai@vcomm.test", "Nhân viên chưa có quyền AI", [{ companyId: retail }]);
  const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $1, 'company', $2, '2026-01-01' FROM core.users WHERE email = $3", [
    employeeRole,
    retail,
    "nhanvien.ai@vcomm.test",
  ]);
  employee = await signIn(application, "nhanvien.ai@vcomm.test");
  adminId = await userId("quantri.vcr@vcomm.test");
  groupAdminId = await userId("quantri.tapdoan@vcomm.test");
});

afterEach(() => {
  testAiConfig.provider = "fake";
  testAiConfig.noticeVersion = 1;
  testClock.fixed = midNovember;
  testModel.reset();
});

afterAll(async () => {
  testClock.fixed = null;
  await application.close();
  await pool.end();
});

describe("KICHBAN_KIEMTHU_653: cài đặt công ty", () => {
  it("công ty mới: hai tính năng tắt, hạn mức 0, chưa có phiên bản; người không có quyền không đọc được", async () => {
    const current = await settings(admin);
    expect(current).toMatchObject({ chatEnabled: false, productContentEnabled: false, monthlyBudgetUsd: "0.00", dailyTurnsPerUser: 30, version: 0, canManage: true });
    expect(current).toMatchObject({ configured: true, model: testAiConfig.model, prices: { input: "2", output: "10" }, month: "2026-11", spentThisMonthUsd: "0.00" });
    expect((await employee.call("get", "/ai/settings", { companyId: retail })).status).toBe(403);
    expect((await employee.call("patch", "/ai/settings", { companyId: retail, body: { chatEnabled: true, productContentEnabled: false, monthlyBudgetUsd: "1", dailyTurnsPerUser: 5, version: 0 } })).status).toBe(403);
  });

  it("lưu lần đầu, sửa đúng phiên bản; phiên bản cũ nhận 409; giá trị sai báo đúng trường; có nhật ký thao tác", async () => {
    const first = await save(admin, { chatEnabled: true, monthlyBudgetUsd: "50", dailyTurnsPerUser: 20 });
    expect(first).toMatchObject({ chatEnabled: true, monthlyBudgetUsd: "50.00", dailyTurnsPerUser: 20, version: 1 });
    const stale = await admin.call("patch", "/ai/settings", { companyId: retail, body: { chatEnabled: false, productContentEnabled: false, monthlyBudgetUsd: "1", dailyTurnsPerUser: 5, version: 0 } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("CONFLICT_VERSION");
    const invalid = await admin.call("patch", "/ai/settings", { companyId: retail, body: { chatEnabled: true, productContentEnabled: false, monthlyBudgetUsd: "10000.01", dailyTurnsPerUser: 501, version: 1 } });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fields).sort()).toEqual(["dailyTurnsPerUser", "monthlyBudgetUsd"]);
    const second = await save(admin, { monthlyBudgetUsd: "100.5" });
    expect(second).toMatchObject({ monthlyBudgetUsd: "100.50", version: 2 });
    const audit = await pool.query("SELECT before_data, after_data FROM core.audit_events WHERE action = 'ai.settings.update' AND company_id = $1 ORDER BY occurred_at", [retail]);
    expect(audit.rows).toHaveLength(2);
    expect(audit.rows[1].before_data).toMatchObject({ monthlyBudgetUsd: "50.00" });
    expect(audit.rows[1].after_data).toMatchObject({ monthlyBudgetUsd: "100.50", chatEnabled: true });
  });
});

describe("KICHBAN_KIEMTHU_654, 657: trạng thái của người dùng, thông báo xử lý dữ liệu cá nhân", () => {
  it("nêu đúng lý do theo từng điều kiện thiếu", async () => {
    expect(chat(await me(employee))).toMatchObject({ permitted: false, available: false, reason: "no_permission" });
    testAiConfig.provider = null;
    expect(chat(await me(admin)).reason).toBe("not_configured");
    expect((await settings(admin)).configured).toBe(false);
    testAiConfig.provider = "fake";
    // Soạn nội dung chưa bật.
    expect((await me(admin)).features.find((item) => item.feature === "product_content")!.reason).toBe("disabled");
    await save(admin, { monthlyBudgetUsd: "0" });
    expect(chat(await me(admin)).reason).toBe("no_budget");
    await save(admin, { monthlyBudgetUsd: "100" });
    expect(chat(await me(admin))).toMatchObject({ permitted: true, available: false, reason: "notice_required" });
  });

  it("xác nhận thông báo thì dùng được; sai phiên bản báo lỗi; tăng phiên bản phải xác nhận lại", async () => {
    const wrong = await admin.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 2 } });
    expect(wrong.status).toBe(400);
    const accepted = await admin.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } });
    expect(accepted.status).toBe(200);
    expect(accepted.body.notice).toEqual({ version: 1, acknowledged: true, provider: "fake" });
    expect(chat(accepted.body)).toMatchObject({ available: true, reason: null });
    // Gửi lại không lỗi.
    expect((await admin.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } })).status).toBe(200);
    await expect(access().begin(actorOf(adminId), "chat")).resolves.toMatchObject({ available: true });
    testAiConfig.noticeVersion = 2;
    expect(chat(await me(admin)).reason).toBe("notice_required");
    await expect(access().begin(actorOf(adminId), "chat")).rejects.toMatchObject({ code: "AI_NOTICE_REQUIRED" });
    testAiConfig.noticeVersion = 1;
    expect((await settings(admin)).notice).toEqual({ version: 1, acknowledgedUsers: 1 });
  });

  it("người không có quyền gọi lượt bị từ chối FORBIDDEN", async () => {
    const employeeId = await userId("nhanvien.ai@vcomm.test");
    await expect(access().begin(actorOf(employeeId), "chat")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("KICHBAN_KIEMTHU_658: hạn mức tháng", () => {
  it("đạt hạn mức thì khóa, báo quản trị đúng một lần; sang tháng sau hoặc tăng hạn mức thì mở lại", async () => {
    await save(admin, { chatEnabled: true, monthlyBudgetUsd: "0.10", dailyTurnsPerUser: 100 });
    await pool.query("DELETE FROM ai.usage_events");
    await access().record(actorOf(adminId), turn());
    expect(chat(await me(admin)).available).toBe(true);
    await access().record(actorOf(adminId), turn());
    const blocked = chat(await me(admin));
    expect(blocked).toMatchObject({ available: false, reason: "quota_exceeded", reopensAt: "2026-12-01T00:00:00+07:00" });
    await expect(access().begin(actorOf(adminId), "chat")).rejects.toMatchObject({ code: "AI_QUOTA_EXCEEDED" });
    // Lượt đang chạy vẫn được ghi; không báo lần hai.
    await access().record(actorOf(adminId), turn());
    const notices = await pool.query<{ user_id: string; title: string }>("SELECT user_id, title FROM core.notifications WHERE kind = 'ai.quota_exceeded' AND company_id = $1", [retail]);
    const recipients = notices.rows.map((row) => row.user_id);
    expect(new Set(recipients).size).toBe(recipients.length);
    expect(recipients).toEqual(expect.arrayContaining([adminId, groupAdminId]));
    expect(notices.rows[0]!.title).toContain("0.10 USD tháng 11/2026");
    expect((await settings(admin)).spentThisMonthUsd).toBe("0.18");
    // Tháng sau dùng lại được, chi phí tháng tính lại từ 0.
    testClock.fixed = new Date("2026-12-02T03:00:00Z");
    expect(chat(await me(admin)).available).toBe(true);
    expect((await settings(admin)).spentThisMonthUsd).toBe("0.00");
    testClock.fixed = midNovember;
    await save(admin, { monthlyBudgetUsd: "1" });
    expect(chat(await me(admin)).available).toBe(true);
  });
});

describe("KICHBAN_KIEMTHU_659: lượt mỗi ngày, nhật ký lượt", () => {
  it("hết lượt hôm nay thì khóa riêng người đó tới 0 giờ hôm sau", async () => {
    await save(admin, { chatEnabled: true, monthlyBudgetUsd: "100", dailyTurnsPerUser: 2 });
    await pool.query("DELETE FROM ai.usage_events");
    await groupAdmin.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } });
    await access().record(actorOf(adminId), turn());
    expect((await me(admin)).remainingTurnsToday).toBe(1);
    await access().record(actorOf(adminId), turn({ status: "refusal" }));
    expect(chat(await me(admin))).toMatchObject({ reason: "daily_limit", reopensAt: "2026-11-18T00:00:00+07:00" });
    expect((await me(admin)).remainingTurnsToday).toBe(0);
    await expect(access().begin(actorOf(adminId), "chat")).rejects.toMatchObject({ code: "AI_DAILY_LIMIT" });
    expect(chat(await me(groupAdmin)).available).toBe(true);
    testClock.fixed = new Date("2026-11-18T01:00:00Z");
    expect(chat(await me(admin)).available).toBe(true);
  });

  it("mỗi lượt một dòng đúng token, chi phí, trạng thái; không có cột nội dung", async () => {
    await pool.query("DELETE FROM ai.usage_events");
    await access().record(actorOf(adminId), turn());
    await access().record(actorOf(adminId), turn({ status: "error", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, toolCalls: 0 }));
    await access().record(actorOf(adminId), turn({ feature: "product_content", status: "max_tokens", usage: { inputTokens: 1_000, outputTokens: 200, cacheReadTokens: 10_000, cacheWriteTokens: 4_000 } }));
    const rows = await pool.query("SELECT * FROM ai.usage_events ORDER BY id");
    expect(rows.rows.map((row) => [row.feature, row.status, row.cost_usd, row.input_tokens, row.output_tokens, row.provider, row.model])).toEqual([
      ["chat", "ok", "0.060000", 25_000, 1_000, "fake", "claude-sonnet-5-5"],
      ["chat", "error", "0.000000", 0, 0, "fake", "claude-sonnet-5-5"],
      ["product_content", "max_tokens", "0.015000", 1_000, 200, "fake", "claude-sonnet-5-5"],
    ]);
    const columns = await pool.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'ai' AND table_name = 'usage_events'");
    expect(columns.rows.map((row) => row.column_name)).not.toEqual(expect.arrayContaining(["content", "prompt", "answer"]));
  });

  it("bộ giả lập không gọi mạng và ghi lại yêu cầu", async () => {
    testModel.script.push({ text: "Xin chào" });
    const deltas: string[] = [];
    const response = await testModel.send({ system: "s", messages: [{ role: "user", content: "hỏi" }], maxTokens: 100, effort: "low", onText: (delta) => deltas.push(delta) });
    expect(response).toMatchObject({ text: "Xin chào", stopReason: "end_turn", model: "claude-sonnet-5-5" });
    expect(deltas.join("")).toBe("Xin chào");
    expect(testModel.requests).toHaveLength(1);
  });
});
