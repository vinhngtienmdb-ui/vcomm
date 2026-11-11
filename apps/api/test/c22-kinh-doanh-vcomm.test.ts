// CONG_VIEC_22 (THAY_DOI_26): phần Kinh doanh của ứng dụng VComm (KICHBAN_KIEMTHU_573 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
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
