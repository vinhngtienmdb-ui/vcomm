// CONG_VIEC_63 L3: soạn nội dung sản phẩm, thống kê sử dụng (TIEUCHI_NGHIEMTHU_479, 480; KICHBAN_KIEMTHU_664, 665). Mô hình là bộ giả lập.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AiAccessService } from "../src/ai/ai-access.service";
import { testIds } from "../src/database/seed";
import type { Actor } from "../src/permissions/roles.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock, testModel } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let contentOnly: Session;
let usageViewer: Session;
let adminId: string;
let productId: string;
let sellerProductId: string;
let productBody: Record<string, unknown>;
const retail: string = testIds.retailCompany;
const midNovember = new Date("2026-11-17T03:00:00Z");

const draftBody = (extra: Record<string, unknown> = {}) => ({
  productId,
  product: {
    name: "Nồi chiên không dầu Lumi 6 lít",
    categoryName: "Gia dụng",
    brand: "Lumi",
    origin: "Việt Nam",
    description: "Nồi chiên 6L, 1500W. Hỗ trợ 0912345678",
    units: ["Cái"],
    specifications: [{ name: "Công suất", value: "1500W" }],
  },
  tone: "friendly",
  length: "short",
  keywords: ["ít dầu", "gia đình"],
  ...extra,
});
const fakeDraft = {
  description: "Nồi chiên Lumi 6 lít, 1500W, phù hợp gia đình, chiên ít dầu, lòng nồi [cần bổ sung: loại lớp phủ].",
  listingDescription: "Bữa ăn giòn ngon, ít dầu cho cả nhà.",
  highlights: ["Dung tích 6 lít", "Công suất 1500W", "Chiên ít dầu", " "],
  missing: ["loại lớp phủ"],
};
async function role(code: string, permissions: string[], email: string): Promise<Session> {
  await createTestUser(pool, email, code, [{ companyId: retail }]);
  const id = (await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, $2, $2, $2, false, 'active') RETURNING id", [retail, code])).rows[0]!.id;
  for (const permission of permissions) await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, $2)", [id, permission]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $1, 'company', $2, '2026-01-01' FROM core.users WHERE email = $3", [id, retail, email]);
  const session = await signIn(application, email);
  await session.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } });
  return session;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = midNovember;
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  adminId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0]!.id;
  const saved = await admin.call("patch", "/ai/settings", {
    companyId: retail,
    body: { chatEnabled: true, productContentEnabled: true, monthlyBudgetUsd: "100", dailyTurnsPerUser: 500, version: 0 },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  await admin.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } });
  contentOnly = await role("ai_soan_noi_dung", ["platform.access", "ai.product_content.use"], "soan.ai@vcomm.test");
  usageViewer = await role("ai_thong_ke", ["platform.access", "ai.usage.view"], "thongke.ai@vcomm.test");

  const units = Object.fromEntries((await pool.query<{ id: string; code: string }>("SELECT id, code FROM catalog.units")).rows.map((row) => [row.code, row.id]));
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "AI63C", nameVi: "Gia dụng AI", nameEn: "AI home" } })).body.id;
  productBody = { categoryId: category, name: "Nồi chiên không dầu Lumi 6 lít", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 12, baseUnitId: units.CAI, units: [], variants: [{ barcodes: [] }] };
  const created = await admin.call("post", "/catalog/products", { companyId: retail, body: productBody });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  productId = created.body.id;
  const other = await admin.call("post", "/catalog/products", { companyId: retail, body: { ...productBody, name: "Sản phẩm của nhà bán" } });
  sellerProductId = other.body.id;
  await pool.query("UPDATE catalog.products SET seller_id = gen_random_uuid() WHERE id = $1", [sellerProductId]);
});

afterEach(async () => {
  testModel.reset();
  testClock.fixed = midNovember;
  await pool.query("DELETE FROM ai.active_turns");
});

afterAll(async () => {
  testClock.fixed = null;
  await application.close();
  await pool.end();
});

describe("KICHBAN_KIEMTHU_664: soạn nội dung sản phẩm", () => {
  it("trả ba phần, gửi mô hình dữ liệu đã che, yêu cầu kết quả có cấu trúc; ghi nhật ký lượt gắn sản phẩm", async () => {
    testModel.script.push({ text: JSON.stringify(fakeDraft) });
    const response = await admin.call("post", "/ai/product-content", { companyId: retail, body: draftBody() });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body).toMatchObject({
      description: fakeDraft.description,
      listingDescription: fakeDraft.listingDescription,
      highlights: ["Dung tích 6 lít", "Công suất 1500W", "Chiên ít dầu"],
      missing: ["loại lớp phủ"],
    });
    expect(response.body.description).toContain("[cần bổ sung");
    const request = testModel.requests[0]!;
    expect(request.outputSchema).toMatchObject({ type: "object", required: expect.arrayContaining(["description", "listingDescription", "highlights", "missing"]) });
    expect(request.tools).toBeUndefined();
    const sent = request.messages[0]!.content as string;
    expect(sent).toContain("[ĐIỆN THOẠI]");
    expect(sent).not.toContain("0912345678");
    expect(sent).toContain("friendly");
    const usage = (await pool.query("SELECT feature, product_id, status FROM ai.usage_events ORDER BY id DESC LIMIT 1")).rows[0];
    expect(usage).toEqual({ feature: "product_content", product_id: productId, status: "ok" });
  });

  it("sản phẩm chưa lưu (không có mã) vẫn soạn được", async () => {
    testModel.script.push({ text: JSON.stringify(fakeDraft) });
    expect((await admin.call("post", "/ai/product-content", { companyId: retail, body: draftBody({ productId: null }) })).status).toBe(200);
  });

  it("thiếu quyền sửa sản phẩm 403; sản phẩm của nhà bán 404; tính năng tắt 403", async () => {
    expect((await contentOnly.call("post", "/ai/product-content", { companyId: retail, body: draftBody() })).status).toBe(403);
    expect((await admin.call("post", "/ai/product-content", { companyId: retail, body: draftBody({ productId: sellerProductId }) })).status).toBe(404);
    const current = (await admin.call("get", "/ai/settings", { companyId: retail })).body;
    await admin.call("patch", "/ai/settings", { companyId: retail, body: { chatEnabled: true, productContentEnabled: false, monthlyBudgetUsd: "100", dailyTurnsPerUser: 500, version: current.version } });
    const disabled = await admin.call("post", "/ai/product-content", { companyId: retail, body: draftBody() });
    expect(disabled.status).toBe(403);
    expect(disabled.body.error.code).toBe("AI_FEATURE_DISABLED");
    await admin.call("patch", "/ai/settings", { companyId: retail, body: { chatEnabled: true, productContentEnabled: true, monthlyBudgetUsd: "100", dailyTurnsPerUser: 500, version: current.version + 1 } });
  });

  it("mô hình từ chối 409; kết quả không đúng cấu trúc 502; cả hai đều ghi nhật ký lượt", async () => {
    testModel.script.push({ text: "", stopReason: "refusal" });
    const refused = await admin.call("post", "/ai/product-content", { companyId: retail, body: draftBody() });
    expect(refused.status).toBe(409);
    testModel.script.push({ text: "không phải JSON" });
    const broken = await admin.call("post", "/ai/product-content", { companyId: retail, body: draftBody() });
    expect(broken.status).toBe(502);
    expect(broken.body.error.code).toBe("AI_PROVIDER_ERROR");
    const statuses = (await pool.query("SELECT status FROM ai.usage_events WHERE feature = 'product_content' ORDER BY id DESC LIMIT 2")).rows.map((row) => row.status);
    expect(statuses).toEqual(["error", "refusal"]);
    expect((await pool.query("SELECT 1 FROM ai.active_turns")).rows).toHaveLength(0);
  });

  it("lưu sản phẩm sau khi dùng nội dung AI thì nhật ký thao tác ghi chú", async () => {
    const detail = (await admin.call("get", `/catalog/products/${productId}`, { companyId: retail })).body;
    const saved = await admin.call("patch", `/catalog/products/${productId}`, {
      companyId: retail,
      body: { ...productBody, description: fakeDraft.description, variants: [{ id: detail.variants[0].id, barcodes: [] }], version: detail.version, aiAssisted: true },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const audit = (await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'product.update' AND entity_id = $1 ORDER BY occurred_at DESC LIMIT 1", [productId])).rows[0];
    expect(audit.after_data).toMatchObject({ aiAssisted: true, description: fakeDraft.description });
  });
});

describe("KICHBAN_KIEMTHU_665: thống kê sử dụng", () => {
  it("số lượt, token, chi phí, đánh giá khớp nhật ký; người chỉ xem thống kê không đọc được nội dung; xuất Excel", async () => {
    await pool.query("DELETE FROM ai.conversations");
    await pool.query("DELETE FROM ai.usage_events");
    const access = application.get(AiAccessService);
    const actor = (userId: string): Actor => ({ userId, companyId: retail, client: { ip: "127.0.0.1", userAgent: "kiem-thu", requestId: null } as unknown as Actor["client"] });
    const viewerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'soan.ai@vcomm.test'")).rows[0]!.id;
    const usage = { inputTokens: 25_000, outputTokens: 1_000, cacheReadTokens: 2_000, cacheWriteTokens: 0 };
    // Một lượt hỏi đáp có câu trả lời được đánh giá Sai.
    testModel.script.push({ text: "Doanh số …", usage });
    const asked = await admin.call("post", "/ai/conversations/messages", { companyId: retail, body: { content: "Doanh số?" } });
    expect(asked.status).toBe(200);
    const messageId = /"messageId":"([^"]+)"/.exec(asked.text)![1]!;
    await admin.call("put", `/ai/messages/${messageId}/feedback`, { companyId: retail, body: { rating: "down", reason: "missing_data" } });
    await access.record(actor(adminId), { feature: "product_content", model: "claude-sonnet-5-5", usage, toolCalls: 0, status: "error", durationMs: 10 });
    await access.record(actor(viewerId), { feature: "product_content", model: "claude-sonnet-5-5", usage, toolCalls: 0, status: "ok", durationMs: 10 });
    // Tháng khác không tính.
    testClock.fixed = new Date("2026-10-15T03:00:00Z");
    await access.record(actor(adminId), { feature: "chat", model: "claude-sonnet-5-5", usage, toolCalls: 0, status: "ok", durationMs: 10 });
    testClock.fixed = midNovember;

    const report = await usageViewer.call("get", "/ai/usage?month=2026-11", { companyId: retail });
    expect(report.status, JSON.stringify(report.body)).toBe(200);
    // Mỗi lượt 25.000 × 2 + 1.000 × 10 + 2.000 × 0,1 = 0,0602 USD.
    expect(report.body.totals).toEqual({ turns: 3, inputTokens: 75_000, outputTokens: 3_000, cacheReadTokens: 6_000, costUsd: "0.180600", errors: 1, refusals: 0, users: 2 });
    expect(report.body.byFeature).toEqual([
      { feature: "chat", turns: 1, inputTokens: 25_000, outputTokens: 1_000, cacheReadTokens: 2_000, costUsd: "0.060200" },
      { feature: "product_content", turns: 2, inputTokens: 50_000, outputTokens: 2_000, cacheReadTokens: 4_000, costUsd: "0.120400" },
    ]);
    expect(report.body.byDay).toHaveLength(1);
    expect(report.body.byDay[0]).toMatchObject({ day: "2026-11-17", turns: 3 });
    expect(report.body.byUser.find((row: { userId: string }) => row.userId === adminId)).toMatchObject({ turns: 2, up: 0, down: 1, costUsd: "0.120400" });
    expect(report.body.feedback).toEqual({ up: 0, down: 1, byReason: { wrong_figures: 0, not_relevant: 0, missing_data: 1, other: 0 } });
    expect(report.body.budgetUsd).toBe("100.00");
    // Không có nội dung trong kết quả.
    expect(JSON.stringify(report.body)).not.toContain("Doanh số");
    const filtered = (await usageViewer.call("get", "/ai/usage?month=2026-11&feature=chat", { companyId: retail })).body;
    expect(filtered.totals.turns).toBe(1);
    // Người xem thống kê không có API đọc hội thoại.
    const conversationId = (await pool.query<{ id: string }>("SELECT id FROM ai.conversations LIMIT 1")).rows[0]!.id;
    expect((await usageViewer.call("get", `/ai/conversations/${conversationId}`, { companyId: retail })).status).toBe(403);
    expect((await usageViewer.call("get", "/ai/conversations", { companyId: retail })).status).toBe(403);
    expect((await contentOnly.call("get", "/ai/usage?month=2026-11", { companyId: retail })).status).toBe(403);
    const file = await usageViewer.call("get", "/ai/usage?month=2026-11&format=xlsx", { companyId: retail });
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("spreadsheetml");
    expect((await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'ai.usage.export'")).rows).toHaveLength(1);
    expect((await usageViewer.call("get", "/ai/usage?month=2026-13", { companyId: retail })).status).toBe(400);
  });
});
