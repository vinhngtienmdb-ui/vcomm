// CONG_VIEC_63 L2: hỏi đáp số liệu – công cụ theo quyền, che dữ liệu, dòng trả lời, hội thoại, đánh giá, xóa sau 90 ngày
// (TIEUCHI_NGHIEMTHU_471, 475 đến 478; KICHBAN_KIEMTHU_656, 660 đến 663). Mô hình là bộ giả lập theo kịch bản.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AiChatService } from "../src/ai/ai-chat.service";
import { toolResultText, truncateRows } from "../src/ai/ai-tools";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock, testModel } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let inventoryOnly: Session;
let productId: string;
const retail: string = testIds.retailCompany;
const midNovember = new Date("2026-11-17T03:00:00Z");

type StreamEvent = { type: string } & Record<string, unknown>;
function parseStream(text: string): StreamEvent[] {
  return text
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const type = /^event: (.+)$/m.exec(block)![1]!;
      return { type, ...JSON.parse(/^data: (.+)$/m.exec(block)![1]!) };
    });
}
async function ask(session: Session, body: Record<string, unknown>, companyId = retail): Promise<{ status: number; events: StreamEvent[]; error: { code: string } | null }> {
  const response = await session
    .call("post", "/ai/conversations/messages", { companyId, body })
    .buffer(true)
    .parse((stream, done) => {
      let text = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk: string) => (text += chunk));
      stream.on("end", () => done(null, text));
    });
  const text = response.body as string;
  if (response.status !== 200) return { status: response.status, events: [], error: JSON.parse(text).error };
  expect(response.headers["content-type"]).toContain("text/event-stream");
  return { status: 200, events: parseStream(text), error: null };
}
const done = (events: StreamEvent[]) => events.find((event) => event.type === "done") as StreamEvent & { messageId: string; toolCalls: { name: string; ok: boolean; input: unknown }[] };
// Nội dung kết quả công cụ mô hình nhận ở lần gọi thứ `index`.
const toolResults = (index: number) => {
  const last = testModel.requests[index]!.messages.at(-1)!;
  return Array.isArray(last.content) ? last.content.filter((block) => block.type === "tool_result") : [];
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  testClock.fixed = midNovember;
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const current = (await admin.call("get", "/ai/settings", { companyId: retail })).body;
  const saved = await admin.call("patch", "/ai/settings", {
    companyId: retail,
    body: { chatEnabled: true, productContentEnabled: false, monthlyBudgetUsd: "100", dailyTurnsPerUser: 500, version: current.version },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  expect((await admin.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } })).status).toBe(200);

  // Người chỉ có quyền báo cáo tồn kho và trợ lý.
  await createTestUser(pool, "tonkho.ai@vcomm.test", "Người xem tồn kho", [{ companyId: retail }]);
  const role = (
    await pool.query<{ id: string }>("INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'ai_ton_kho', 'Xem tồn kho, trợ lý', 'Stock and AI', false, 'active') RETURNING id", [
      retail,
    ])
  ).rows[0]!.id;
  for (const permission of ["platform.access", "ai.chat.use", "analytics.access", "analytics.inventory.view"]) {
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, $2)", [role, permission]);
  }
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $1, 'company', $2, '2026-01-01' FROM core.users WHERE email = $3", [
    role,
    retail,
    "tonkho.ai@vcomm.test",
  ]);
  inventoryOnly = await signIn(application, "tonkho.ai@vcomm.test");
  expect((await inventoryOnly.call("post", "/ai/me/acknowledge", { companyId: retail, body: { noticeVersion: 1 } })).status).toBe(200);

  // Sản phẩm có số điện thoại, email trong tên, mô tả để kiểm che dữ liệu ở kết quả công cụ.
  const units = Object.fromEntries((await pool.query<{ id: string; code: string }>("SELECT id, code FROM catalog.units")).rows.map((row) => [row.code, row.id]));
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "AI63", nameVi: "Trợ lý AI", nameEn: "AI" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: {
      categoryId: category,
      name: "Bánh quy liên hệ 0912345678",
      description: "Đặt hàng qua email banhang@vcomm.vn hoặc STK 0071000123456",
      vatRate: "10",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.CAI,
      units: [],
      variants: [{ barcodes: [] }],
    },
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  productId = product.body.id;
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

describe("KICHBAN_KIEMTHU_661: dòng trả lời", () => {
  it("phát sự kiện đúng thứ tự, lưu hội thoại, câu hỏi đã che", async () => {
    testModel.script.push({ text: "Chào bạn, tôi là trợ lý số liệu." });
    const result = await ask(admin, { content: "Xin chào, số tôi là 0912 345 678" });
    expect(result.status).toBe(200);
    expect(result.events.map((event) => event.type)).toEqual(["conversation", "delta", "delta", "delta", "done"]);
    expect(result.events.filter((event) => event.type === "delta").map((event) => event.text).join("")).toBe("Chào bạn, tôi là trợ lý số liệu.");
    expect(done(result.events)).toMatchObject({ status: "ok", toolCalls: [], remainingTurnsToday: 499 });
    // Câu hỏi tới mô hình đã che, có phần ngữ cảnh ngày và ngôn ngữ.
    const sent = testModel.requests[0]!.messages.at(-1)!.content as string;
    expect(sent).toContain("[ĐIỆN THOẠI]");
    expect(sent).not.toContain("0912");
    expect(sent).toContain("hôm nay 2026-11-17");
    const conversationId = result.events[0]!.id as string;
    const detail = (await admin.call("get", `/ai/conversations/${conversationId}`, { companyId: retail })).body;
    expect(detail).toMatchObject({ title: "Xin chào, số tôi là [ĐIỆN THOẠI]", messageCount: 2 });
    expect(detail.messages.map((message: { role: string; content: string }) => [message.role, message.content])).toEqual([
      ["user", "Xin chào, số tôi là [ĐIỆN THOẠI]"],
      ["assistant", "Chào bạn, tôi là trợ lý số liệu."],
    ]);
    // Hỏi tiếp trong cùng hội thoại: lịch sử gửi lại dạng văn bản.
    testModel.script.push({ text: "Vâng." });
    expect((await ask(admin, { conversationId, content: "Cảm ơn" })).status).toBe(200);
    expect(testModel.requests[1]!.messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    const listed = (await admin.call("get", "/ai/conversations", { companyId: retail })).body;
    expect(listed.data[0]).toMatchObject({ id: conversationId, messageCount: 4 });
  });

  it("quá 8 lần gọi công cụ thì dừng; kết quả công cụ quá 50 dòng bị cắt có ghi chú", async () => {
    testModel.script.push({ toolUses: Array.from({ length: 9 }, () => ({ name: "products", input: { search: "Bánh" } })) }, { text: "Đã tra cứu." });
    const result = await ask(admin, { content: "Liệt kê sản phẩm bánh" });
    expect(result.events.filter((event) => event.type === "tool")).toHaveLength(8);
    expect(done(result.events).toolCalls).toHaveLength(8);
    const results = toolResults(1);
    expect(results).toHaveLength(9);
    expect(results.slice(0, 8).every((block) => block.type === "tool_result" && !block.isError)).toBe(true);
    expect(results[8]).toMatchObject({ isError: true });
    expect(testModel.requests).toHaveLength(2);
    const rows = truncateRows(Array.from({ length: 120 }, (_value, index) => ({ index }))) as unknown[];
    expect(rows).toHaveLength(51);
    expect(JSON.stringify(rows[50])).toContain("Đã bỏ 70 dòng");
  });

  it("mô hình từ chối, nhà cung cấp lỗi đều ghi nhật ký lượt đúng trạng thái", async () => {
    testModel.script.push({ text: "", stopReason: "refusal" });
    const refused = await ask(admin, { content: "Câu hỏi bị từ chối" });
    expect(done(refused.events)).toMatchObject({ status: "refusal" });
    testModel.script.push({ fail: true });
    const failed = await ask(admin, { content: "Câu hỏi khi nhà cung cấp lỗi" });
    expect(failed.events.at(-1)).toMatchObject({ type: "error", code: "AI_PROVIDER_ERROR" });
    const statuses = (await pool.query("SELECT status FROM ai.usage_events ORDER BY id DESC LIMIT 2")).rows.map((row) => row.status);
    expect(statuses).toEqual(["error", "refusal"]);
  });
});

describe("KICHBAN_KIEMTHU_660, 656: công cụ theo quyền, che dữ liệu ở kết quả công cụ", () => {
  it("số liệu công cụ bằng màn hình báo cáo cùng tham số", async () => {
    const input = { from: "2026-11-01", to: "2026-11-17", groupBy: "channel" };
    testModel.script.push({ toolUses: [{ name: "sales_report", input }] }, { text: "Doanh số tháng 11 là …" });
    const result = await ask(admin, { content: "Doanh số tháng này theo kênh?" });
    expect(done(result.events).toolCalls).toEqual([{ name: "sales_report", input, ok: true }]);
    expect(result.events.find((event) => event.type === "tool")).toEqual({ type: "tool", name: "sales_report" });
    const screen = await admin.call("get", "/analytics/sales?from=2026-11-01&to=2026-11-17&groupBy=channel", { companyId: retail });
    expect(screen.status).toBe(200);
    expect(toolResults(1)[0]).toMatchObject({ content: toolResultText(screen.body), isError: false });
  });

  it("người chỉ có quyền tồn kho không được cấp công cụ bán hàng; gọi bừa thì nhận lỗi quyền", async () => {
    testModel.script.push({ toolUses: [{ name: "sales_report", input: { from: "2026-11-01", to: "2026-11-17" } }] }, { text: "Tôi không xem được doanh số." });
    const result = await ask(inventoryOnly, { content: "Doanh số tháng này?" });
    expect(testModel.requests[0]!.tools!.map((tool) => tool.name).sort()).toEqual(["inventory_report", "overview_report"]);
    expect(done(result.events).toolCalls).toEqual([{ name: "sales_report", input: { from: "2026-11-01", to: "2026-11-17" }, ok: false }]);
    expect(toolResults(1)[0]).toMatchObject({ isError: true });
    expect((toolResults(1)[0] as { content: string }).content).toContain("không có quyền");
  });

  it("tham số sai trả lỗi kiểm tra về mô hình, không làm hỏng lượt", async () => {
    testModel.script.push({ toolUses: [{ name: "sales_report", input: { from: "hôm qua" } }] }, { text: "Xin lỗi." });
    const result = await ask(admin, { content: "Doanh số hôm qua?" });
    expect(done(result.events)).toMatchObject({ status: "ok", toolCalls: [{ name: "sales_report", ok: false }] });
    expect((toolResults(1)[0] as { content: string }).content).toContain("Tham số không hợp lệ");
  });

  it("điện thoại, email, số tài khoản trong dữ liệu sản phẩm tới mô hình đã là nhãn che", async () => {
    testModel.script.push({ toolUses: [{ name: "product_detail", input: { id: productId } }] }, { text: "Sản phẩm …" });
    await ask(admin, { content: "Cho xem sản phẩm bánh quy" });
    const content = (toolResults(1)[0] as { content: string }).content;
    expect(content).toContain("Bánh quy liên hệ [ĐIỆN THOẠI]");
    expect(content).toContain("[EMAIL]");
    expect(content).toContain("STK [SỐ TÀI KHOẢN]");
    expect(content).not.toMatch(/0912345678|banhang@vcomm\.vn|0071000123456/);
  });
});

describe("KICHBAN_KIEMTHU_662: quyền sở hữu, một lượt mỗi người, xóa sau 90 ngày", () => {
  it("người khác không đọc, không xóa được; xóa của mình thì mất hẳn", async () => {
    testModel.script.push({ text: "Có." });
    const id = (await ask(admin, { content: "Hội thoại riêng" })).events[0]!.id as string;
    expect((await inventoryOnly.call("get", `/ai/conversations/${id}`, { companyId: retail })).status).toBe(404);
    expect((await inventoryOnly.call("delete", `/ai/conversations/${id}`, { companyId: retail })).status).toBe(404);
    expect((await ask(inventoryOnly, { conversationId: id, content: "Chen vào" })).status).toBe(404);
    expect((await admin.call("delete", `/ai/conversations/${id}`, { companyId: retail })).status).toBe(204);
    expect((await admin.call("get", `/ai/conversations/${id}`, { companyId: retail })).status).toBe(404);
    expect((await pool.query("SELECT 1 FROM ai.messages m WHERE m.conversation_id = $1", [id])).rows).toHaveLength(0);
  });

  it("đang có lượt chạy thì câu hỏi sau nhận 409 AI_BUSY; lượt treo quá 3 phút được thay", async () => {
    const adminId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0]!.id;
    await pool.query("INSERT INTO ai.active_turns (user_id, started_at) VALUES ($1, $2)", [adminId, midNovember.toISOString()]);
    const busy = await ask(admin, { content: "Hỏi chen" });
    expect(busy).toMatchObject({ status: 409, error: { code: "AI_BUSY" } });
    // Người khác vẫn hỏi được.
    testModel.script.push({ text: "Được." });
    expect((await ask(inventoryOnly, { content: "Tồn kho?" })).status).toBe(200);
    testClock.fixed = new Date(midNovember.getTime() + 4 * 60_000);
    testModel.script.push({ text: "Được." });
    expect((await ask(admin, { content: "Hỏi lại sau 4 phút" })).status).toBe(200);
    expect((await pool.query("SELECT 1 FROM ai.active_turns")).rows).toHaveLength(0);
  });

  it("tác vụ dọn xóa hội thoại có tin nhắn cuối 91 ngày, giữ 89 ngày, nhật ký lượt còn", async () => {
    testModel.script.push({ text: "Cũ." }, { text: "Mới." });
    const old = (await ask(admin, { content: "Hội thoại cũ" })).events[0]!.id as string;
    testClock.fixed = new Date(midNovember.getTime() + 2 * 86_400_000);
    const recent = (await ask(admin, { content: "Hội thoại mới hơn" })).events[0]!.id as string;
    const usageBefore = Number((await pool.query("SELECT count(*) FROM ai.usage_events")).rows[0].count);
    testClock.fixed = new Date(midNovember.getTime() + 91 * 86_400_000);
    const purged = await application.get(AiChatService).purgeExpired();
    expect(purged.conversations).toBeGreaterThanOrEqual(1);
    const left = (await pool.query<{ id: string }>("SELECT id FROM ai.conversations WHERE id = ANY($1)", [[old, recent]])).rows.map((row) => row.id);
    expect(left).toEqual([recent]);
    expect(Number((await pool.query("SELECT count(*) FROM ai.usage_events")).rows[0].count)).toBe(usageBefore);
  });
});

describe("KICHBAN_KIEMTHU_663: đánh giá", () => {
  it("Đúng, đổi Sai có lý do, Sai thiếu lý do báo lỗi, bỏ đánh giá; người khác không đánh giá được", async () => {
    testModel.script.push({ text: "Trả lời." });
    const result = await ask(admin, { content: "Câu để đánh giá" });
    const { messageId } = done(result.events);
    const path = `/ai/messages/${messageId}/feedback`;
    expect((await admin.call("put", path, { companyId: retail, body: { rating: "up" } })).body).toEqual({ rating: "up", reason: null, note: null });
    const missing = await admin.call("put", path, { companyId: retail, body: { rating: "down" } });
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.error.fields)).toEqual(["reason"]);
    expect((await admin.call("put", path, { companyId: retail, body: { rating: "down", reason: "wrong_figures", note: "Sai doanh số kênh Đại lý" } })).status).toBe(200);
    const conversationId = result.events[0]!.id as string;
    const detail = (await admin.call("get", `/ai/conversations/${conversationId}`, { companyId: retail })).body;
    expect(detail.messages[1].feedback).toEqual({ rating: "down", reason: "wrong_figures", note: "Sai doanh số kênh Đại lý" });
    expect((await inventoryOnly.call("put", path, { companyId: retail, body: { rating: "up" } })).status).toBe(404);
    // Không đánh giá câu hỏi của chính mình.
    expect((await admin.call("put", `/ai/messages/${result.events[0]!.userMessageId}/feedback`, { companyId: retail, body: { rating: "up" } })).status).toBe(404);
    expect((await admin.call("delete", path, { companyId: retail })).status).toBe(204);
    expect((await pool.query("SELECT 1 FROM ai.feedback WHERE message_id = $1", [messageId])).rows).toHaveLength(0);
  });
});
