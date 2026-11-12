// CONG_VIEC_22 (THAY_DOI_26): phần Kinh doanh của ứng dụng VComm (KICHBAN_KIEMTHU_573 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { SalesCareService } from "../src/marketplace/sales-care.service";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-kinh-doanh-0123456789";
// Đội: Phòng 1 (Trưởng phòng, Nhân viên Một) dưới Khối; Phòng 2 (Nhân viên Hai) dưới Khối, không cùng nhánh với Trưởng phòng.
const people = { head: "", staff: "", other: "", plain: "" };
const customers = { ofStaff: "", ofOther: "", ofPlain: "", ofHead: "" };
const sessions: Record<"head" | "staff" | "other" | "plain" | "buyer", BuyerCall> = {} as never;

async function department(code: string, name: string, parent: string | null, type: "division" | "region" | "team"): Promise<string> {
  const id = (await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, code, name, parent_id) VALUES ($1, $2, $3, $4) RETURNING id", [retail, code, name, parent])).rows[0]!.id;
  expect((await store.call("put", `/marketplace/sales-units/${id}`, { type })).status).toBe(200);
  return id;
}
async function member(phone: string, fullName: string, departmentId: string): Promise<string> {
  const userId = await store.register(phone, fullName);
  const detail = await store.call("get", `/marketplace/buyers/${userId}`);
  expect((await store.call("post", `/marketplace/buyers/${userId}/sales-flag`, { departmentId, version: detail.body.version })).status).toBe(200);
  return userId;
}
async function placeOrder(buyer: BuyerCall, lines: { variantId: string; quantity: number }[]): Promise<{ id: string; version: number }> {
  const addressId = await store.addressOf(buyer);
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body;
}
// Giao thành công qua webhook GHN rồi chạy hoàn tất sau 7 ngày trả hàng.
async function complete(order: { id: string; version: number }) {
  const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
  expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
  await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [order.id]);
  await application.get(MarketplaceOrdersService).completeDue();
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const division = await department("KHOI-KD", "Khối Kinh doanh", null, "division");
  const teamOne = await department("PKD-1", "Phòng Kinh doanh 1", division, "team");
  const teamTwo = await department("PKD-2", "Phòng Kinh doanh 2", division, "team");
  people.head = await member("0939000001", "Trưởng Phòng Một", teamOne);
  people.staff = await member("0939000002", "Nhân Viên Một", teamOne);
  people.other = await member("0939000003", "Nhân Viên Hai", teamTwo);
  expect((await store.call("put", `/marketplace/sales-units/${teamOne}/manager`, { userId: people.head })).status).toBe(200);
  people.plain = await store.register("0939000004", "Người Giới Thiệu Thường");
  customers.ofStaff = await store.register("0939100001", "Khách Của Nhân Viên", "0939000002");
  customers.ofOther = await store.register("0939100002", "Khách Phòng Hai", "0939000003");
  customers.ofPlain = await store.register("0939100003", "Khách Người Thường", "0939000004");
  customers.ofHead = await store.register("0939100004", "Khách Của Trưởng Phòng", "0939000001");
  sessions.head = await store.buyerSession("0939000001");
  sessions.staff = await store.buyerSession("0939000002");
  sessions.other = await store.buyerSession("0939000003");
  sessions.plain = await store.buyerSession("0939000004");
  sessions.buyer = await store.buyerSession("0939100001");
  const percent = { calculation: "percent", referral: "5", staff: "10", teamHead: "3", regionalDirector: "2", director: "1", version: 0 };
  expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, percent)).status).toBe(200);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_22 chi tiết khách", () => {
  it("KICHBAN_KIEMTHU_573: khách của mình, của người trong nhánh xem được; khách ngoài nhánh, của người giới thiệu thường, mã không có nhận 404; người không được đánh dấu nhận 403", async () => {
    const path = (id: string) => `/buyer/sales/customers/${id}`;
    const own = await sessions.staff("get", path(customers.ofStaff));
    expect(own.status, JSON.stringify(own.body)).toBe(200);
    expect(own.body).toMatchObject({ id: customers.ofStaff, fullName: "Khách Của Nhân Viên", phone: "0939100001", ownerUserId: people.staff, ownerName: "Nhân Viên Một", ownerTitle: "staff" });
    // Trưởng phòng xem khách của cấp dưới và của chính mình.
    expect((await sessions.head("get", path(customers.ofStaff))).body.ownerName).toBe("Nhân Viên Một");
    expect((await sessions.head("get", path(customers.ofHead))).body.ownerTitle).toBe("team_head");
    // Ngoài nhánh: phòng khác, người giới thiệu thường; nhân viên không xem khách của trưởng phòng.
    expect((await sessions.head("get", path(customers.ofOther))).status).toBe(404);
    expect((await sessions.head("get", path(customers.ofPlain))).status).toBe(404);
    expect((await sessions.staff("get", path(customers.ofHead))).status).toBe(404);
    expect((await sessions.staff("get", path("00000000-0000-4000-8000-000000000000"))).status).toBe(404);
    expect((await sessions.staff("get", path("khong-phai-ma"))).status).toBe(404);
    // Người mua thường, người giới thiệu thường không được đánh dấu: 403.
    expect((await sessions.plain("get", path(customers.ofPlain))).status).toBe(403);
    expect((await sessions.buyer("get", path(customers.ofStaff))).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_574: số liệu đơn hoàn tất (theo tiền hoàn tất), đang xử lý, 10 đơn gần nhất, hoa hồng của chính người xem; đơn hủy không tính; không có địa chỉ, người nhận", async () => {
    // Đơn 1: kem 2, hoàn tất (tiền hoàn tất đã trừ trả hàng do CONG_VIEC_24 tính, kiểm ở c26). Đơn 2: kem 1 đang chờ giao. Đơn 3: kem 1 bị hủy.
    const first = await placeOrder(sessions.buyer, [{ variantId: store.variants.cream, quantity: 2 }]);
    const second = await placeOrder(sessions.buyer, [{ variantId: store.variants.cream, quantity: 1 }]);
    const third = await placeOrder(sessions.buyer, [{ variantId: store.variants.cream, quantity: 1 }]);
    expect((await sessions.buyer("post", `/buyer/orders/${third.id}/cancel`, { reason: "Đổi ý", version: third.version })).status).toBe(200);
    await complete(first);
    const order = (await pool.query("SELECT status, completed_amount::float AS amount, goods_amount::float AS goods FROM marketplace.orders WHERE id = $1", [first.id])).rows[0];
    expect(order.status).toBe("completed");
    const pendingGoods = (await pool.query("SELECT goods_amount::float AS goods FROM marketplace.orders WHERE id = $1", [second.id])).rows[0].goods as number;

    const detail = (await sessions.staff("get", `/buyer/sales/customers/${customers.ofStaff}`)).body;
    expect(detail).toMatchObject({ completedOrderCount: 1, completedAmount: String(order.amount), openOrderCount: 1, openAmount: String(pendingGoods) });
    expect(detail.recentOrders.map((item: { id: string }) => item.id)).toEqual([third.id, second.id, first.id]);
    expect(detail.recentOrders[0]).toMatchObject({ status: "cancelled", documentNo: expect.any(String), goodsAmount: expect.any(String), orderedAt: expect.any(String) });
    // Không lộ địa chỉ, người nhận.
    const text = JSON.stringify(detail);
    for (const field of ["street", "recipient", "province", "ward", "address"]) expect(text.toLowerCase()).not.toContain(field);
    // Hoa hồng của chính người xem: nhân viên (giới thiệu và nhân viên) khác trưởng phòng; đơn hủy không tính.
    const staffCommission = (
      await pool.query(`SELECT coalesce(sum(c.amount) FILTER (WHERE c.status = 'credited'), 0)::float AS credited FROM marketplace.order_commissions c WHERE c.beneficiary_user_id = $1`, [
        people.staff,
      ])
    ).rows[0].credited as number;
    expect(Number(detail.myCommission.credited)).toBeCloseTo(staffCommission, 2);
    expect(Number(detail.myCommission.credited)).toBeGreaterThan(0);
    expect(Number(detail.myCommission.pending)).toBeGreaterThan(0);
    const head = (await sessions.head("get", `/buyer/sales/customers/${customers.ofStaff}`)).body;
    expect(Number(head.myCommission.credited)).toBeLessThan(Number(detail.myCommission.credited));
    expect(Number(head.myCommission.credited)).toBeGreaterThan(0);
  });
});

describe("CONG_VIEC_22 ghi chú chăm sóc, hẹn", () => {
  const vietnamToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const shift = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  const notesPath = (customerId: string) => `/buyer/sales/customers/${customerId}/notes`;

  it("KICHBAN_KIEMTHU_575: ghi chú kiểm kênh, độ dài, ngày hẹn; không sửa, không xóa; người trong phạm vi xem được; nhật ký thao tác không chứa nội dung", async () => {
    const today = vietnamToday();
    const created = await sessions.staff("post", notesPath(customers.ofStaff), { channel: "call", content: "  Khách hỏi sữa tắm loại 1 lít  ", followUpOn: shift(today, 2) });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ channel: "call", content: "Khách hỏi sữa tắm loại 1 lít", followUpOn: shift(today, 2), followUpDoneAt: null, authorName: "Nhân Viên Một" });
    // Sai kênh, nội dung rỗng, quá 1.000 ký tự, ngày hẹn quá khứ, quá 365 ngày, trường lạ.
    const bad = [
      { channel: "email", content: "x" },
      { channel: "call", content: "   " },
      { channel: "call", content: "x".repeat(1001) },
      { channel: "call", content: "x", followUpOn: shift(today, -1) },
      { channel: "call", content: "x", followUpOn: shift(today, 366) },
      { channel: "call", content: "x", authorUserId: people.head },
    ];
    for (const body of bad) expect((await sessions.staff("post", notesPath(customers.ofStaff), body)).status, JSON.stringify(body)).toBe(400);
    const range = await sessions.staff("post", notesPath(customers.ofStaff), { channel: "call", content: "x", followUpOn: shift(today, 366) });
    expect(range.body.error.fields.followUpOn).toBe("Ngày hẹn phải từ hôm nay đến 365 ngày sau.");
    // Hẹn hôm nay, 365 ngày sau, không hẹn đều được; trưởng phòng ghi được cho khách của cấp dưới.
    expect((await sessions.staff("post", notesPath(customers.ofStaff), { channel: "message", content: "Nhắn mẫu mới", followUpOn: today })).status).toBe(201);
    expect((await sessions.staff("post", notesPath(customers.ofStaff), { channel: "meeting", content: "Gặp tại nhà", followUpOn: shift(today, 365) })).status).toBe(201);
    expect((await sessions.head("post", notesPath(customers.ofStaff), { channel: "other", content: "Trưởng phòng gọi hỏi thăm" })).status).toBe(201);
    // Ngoài phạm vi: 404; không được đánh dấu: 403.
    expect((await sessions.staff("post", notesPath(customers.ofHead), { channel: "call", content: "x" })).status).toBe(404);
    expect((await sessions.head("post", notesPath(customers.ofOther), { channel: "call", content: "x" })).status).toBe(404);
    expect((await sessions.plain("post", notesPath(customers.ofPlain), { channel: "call", content: "x" })).status).toBe(403);
    expect((await sessions.head("get", notesPath(customers.ofOther))).status).toBe(404);
    // Không có API sửa, xóa.
    expect((await sessions.staff("put", `${notesPath(customers.ofStaff)}/${created.body.id}`, { content: "sửa" })).status).toBe(404);
    expect((await sessions.staff("delete", `${notesPath(customers.ofStaff)}/${created.body.id}`)).status).toBe(404);
    // Người trong phạm vi (nhân viên, trưởng phòng) thấy mọi ghi chú của khách, mới nhất trước; chi tiết khách có 20 ghi chú gần nhất.
    const byHead = (await sessions.head("get", notesPath(customers.ofStaff))).body;
    expect(byHead.notes.map((note: { content: string }) => note.content)).toEqual(["Trưởng phòng gọi hỏi thăm", "Gặp tại nhà", "Nhắn mẫu mới", "Khách hỏi sữa tắm loại 1 lít"]);
    expect(byHead.hasMore).toBe(false);
    const detail = (await sessions.staff("get", `/buyer/sales/customers/${customers.ofStaff}`)).body;
    expect(detail.notes).toHaveLength(4);
    expect(detail.hasMoreNotes).toBe(false);
    // Phân trang 20 ghi chú.
    for (let index = 0; index < 18; index += 1) await sessions.staff("post", notesPath(customers.ofStaff), { channel: "call", content: `Lần ${index}` });
    expect((await sessions.staff("get", `/buyer/sales/customers/${customers.ofStaff}`)).body.hasMoreNotes).toBe(true);
    expect((await sessions.staff("get", `${notesPath(customers.ofStaff)}?page=2`)).body.notes).toHaveLength(2);
    // Nhật ký thao tác không chứa nội dung ghi chú.
    const audit = await pool.query("SELECT after_data::text AS data FROM core.audit_events WHERE action = 'sales.care_note.create' AND entity_id = $1", [created.body.id]);
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0].data).not.toContain("sữa tắm");
  });

  it("KICHBAN_KIEMTHU_576: hẹn của tôi chia quá hạn, hôm nay, 7 ngày tới theo giờ Việt Nam; chỉ người ghi đánh dấu xong, một lần; mất phạm vi thì không hiện", async () => {
    const today = vietnamToday();
    const add = async (session: BuyerCall, customerId: string, content: string, followUpOn: string | null) => {
      const created = await session("post", notesPath(customerId), { channel: "call", content, followUpOn });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      return created.body.id as string;
    };
    const overdue = await add(sessions.other, customers.ofOther, "Hẹn cũ", today);
    await pool.query("UPDATE marketplace.customer_care_notes SET follow_up_on = $1 WHERE id = $2", [shift(today, -3), overdue]);
    const dueToday = await add(sessions.other, customers.ofOther, "Hẹn hôm nay", today);
    const soon = await add(sessions.other, customers.ofOther, "Hẹn tuần này", shift(today, 7));
    await add(sessions.other, customers.ofOther, "Hẹn xa", shift(today, 8));
    await add(sessions.other, customers.ofOther, "Không hẹn", null);
    const list = (await sessions.other("get", "/buyer/sales/follow-ups")).body;
    expect(list.today).toBe(today);
    expect(list.overdue.map((item: { noteId: string }) => item.noteId)).toEqual([overdue]);
    expect(list.dueToday.map((item: { noteId: string }) => item.noteId)).toEqual([dueToday]);
    expect(list.upcoming.map((item: { noteId: string }) => item.noteId)).toEqual([soon]);
    expect(list.dueToday[0]).toMatchObject({ customerId: customers.ofOther, customerName: "Khách Phòng Hai", customerPhone: "0939100002", content: "Hẹn hôm nay" });
    // Người khác (kể cả người thấy khách) không đánh dấu được hẹn của người ghi; mã không có: 404.
    expect((await sessions.head("post", `/buyer/sales/follow-ups/${dueToday}/done`)).status).toBe(404);
    const done = await sessions.other("post", `/buyer/sales/follow-ups/${dueToday}/done`);
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.followUpDoneAt).toEqual(expect.any(String));
    expect((await sessions.other("post", `/buyer/sales/follow-ups/${dueToday}/done`)).status).toBe(409);
    expect((await sessions.other("get", "/buyer/sales/follow-ups")).body.dueToday).toEqual([]);
    // Ghi chú không hẹn không đánh dấu được.
    const plainNote = (await pool.query("SELECT id FROM marketplace.customer_care_notes WHERE content = 'Không hẹn'")).rows[0].id as string;
    expect((await sessions.other("post", `/buyer/sales/follow-ups/${plainNote}/done`)).status).toBe(404);
    // Khách đổi người giới thiệu sang người thường: người ghi không còn thấy hẹn, không đánh dấu được.
    await pool.query("UPDATE marketplace.buyer_accounts SET referrer_user_id = $1 WHERE user_id = $2", [people.plain, customers.ofOther]);
    expect((await sessions.other("get", "/buyer/sales/follow-ups")).body).toMatchObject({ overdue: [], dueToday: [], upcoming: [] });
    expect((await sessions.other("post", `/buyer/sales/follow-ups/${soon}/done`)).status).toBe(404);
    await pool.query("UPDATE marketplace.buyer_accounts SET referrer_user_id = $1 WHERE user_id = $2", [people.other, customers.ofOther]);
  });

  it("KICHBAN_KIEMTHU_577: nhắc hẹn tạo đúng một thông báo trong ứng dụng mỗi người mỗi ngày, đúng số hôm nay, quá hạn; chạy lại không trùng; không nhắc hẹn đã xong, người hết phạm vi, người bị bỏ đánh dấu", async () => {
    const today = vietnamToday();
    await pool.query("DELETE FROM core.notifications WHERE kind = 'sales.follow_up_due'");
    // Hẹn còn chờ từ kịch bản trước coi như đã xong để đếm đúng.
    await pool.query("UPDATE marketplace.customer_care_notes SET follow_up_done_at = now() WHERE follow_up_on IS NOT NULL AND follow_up_done_at IS NULL");
    // Trưởng phòng: 1 hẹn hôm nay, 2 quá hạn (khách của cấp dưới và của mình), 1 hẹn đã xong, 1 hẹn ngày mai.
    const add = async (session: BuyerCall, customerId: string, followUpOn: string) =>
      (await session("post", notesPath(customerId), { channel: "call", content: "Nhắc", followUpOn })).body.id as string;
    await add(sessions.head, customers.ofStaff, today);
    const late = await add(sessions.head, customers.ofHead, today);
    const later = await add(sessions.head, customers.ofStaff, today);
    await pool.query("UPDATE marketplace.customer_care_notes SET follow_up_on = $1 WHERE id = ANY($2)", [shift(today, -2), [late, later]]);
    const finished = await add(sessions.head, customers.ofHead, today);
    expect((await sessions.head("post", `/buyer/sales/follow-ups/${finished}/done`)).status).toBe(200);
    await add(sessions.head, customers.ofHead, shift(today, 1));
    const service = application.get(SalesCareService);
    await service.remindDue();
    const mine = await pool.query("SELECT user_id, title, link, payload FROM core.notifications WHERE kind = 'sales.follow_up_due' AND user_id = $1", [people.head]);
    expect(mine.rows).toHaveLength(1);
    expect(mine.rows[0]).toMatchObject({ link: "/hen", payload: { date: today, dueToday: 1, overdue: 2 } });
    expect(mine.rows[0].title).toBe("Bạn có 1 hẹn chăm sóc hôm nay, 2 hẹn quá hạn");
    // Chạy lại trong ngày: không trùng.
    await service.remindDue();
    expect((await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'sales.follow_up_due' AND user_id = $1", [people.head])).rows[0].total).toBe(1);
    // Nhân viên Hai: khách đã chuyển sang người thường thì không nhắc.
    const other = await add(sessions.other, customers.ofOther, today);
    await pool.query("UPDATE marketplace.buyer_accounts SET referrer_user_id = $1 WHERE user_id = $2", [people.plain, customers.ofOther]);
    await service.remindDue();
    expect((await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'sales.follow_up_due' AND user_id = $1", [people.other])).rows[0].total).toBe(0);
    await pool.query("UPDATE marketplace.buyer_accounts SET referrer_user_id = $1 WHERE user_id = $2", [people.other, customers.ofOther]);
    // Bỏ đánh dấu nhân viên kinh doanh: không nhắc.
    await pool.query("UPDATE marketplace.buyer_accounts SET is_sales_staff = false, sales_company_id = NULL, sales_department_id = NULL WHERE user_id = $1", [people.other]);
    await service.remindDue();
    expect((await pool.query("SELECT count(*)::int AS total FROM core.notifications WHERE kind = 'sales.follow_up_due' AND user_id = $1", [people.other])).rows[0].total).toBe(0);
    expect(other).toEqual(expect.any(String));
    // QUYTAC_NGHIEPVU_438: ứng dụng đọc thông báo của chính mình qua API_48, đánh dấu đã đọc.
    const list = await sessions.head("get", "/notifications");
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    const reminder = list.body.data.find((item: { kind: string }) => item.kind === "sales.follow_up_due");
    expect(reminder).toMatchObject({ title: "Bạn có 1 hẹn chăm sóc hôm nay, 2 hẹn quá hạn", link: "/hen", readAt: null });
    const unread = list.body.unreadCount as number;
    expect((await sessions.head("post", `/notifications/${reminder.id}/read`)).status).toBe(204);
    expect((await sessions.head("get", "/notifications")).body.unreadCount).toBe(unread - 1);
    // Không đọc được thông báo của người khác.
    expect((await sessions.staff("post", `/notifications/${reminder.id}/read`)).status).toBe(404);
  });
});
