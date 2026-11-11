// CONG_VIEC_51 L1: sổ cái điểm chỉ thêm, tích điểm khi đơn VComm hoàn tất, hạng thành viên, điểm của tôi
// (KICHBAN_KIEMTHU_487, 488, 489, 493; TIEUCHI_NGHIEMTHU_330, 331, 335).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LoyaltyAccountsService } from "../src/loyalty/accounts.service";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { prepareMarketplace, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-diem-thuong-0123456789";
const buyers: Record<"first" | "second" | "tester" | "locked", { call: BuyerCall; id: string }> = {} as never;

async function placeOrder(buyer: BuyerCall, lines: { variantId: string; quantity: number }[]): Promise<{ id: string; version: number }> {
  const addressId = await store.addressOf(buyer);
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body;
}
// Giao thành công, quá 7 ngày, chạy việc nền hoàn tất.
async function deliver(order: { id: string; version: number }): Promise<void> {
  const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
  expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
}
async function complete(orderId: string): Promise<void> {
  await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [orderId]);
  await application.get(MarketplaceOrdersService).completeDue();
}
const balanceOf = async (userId: string) => (await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? null;

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const phones = { first: "0939000001", second: "0939000002", tester: "0939000003", locked: "0939000004" } as const;
  for (const [key, phone] of Object.entries(phones) as [keyof typeof phones, string][]) {
    const id = await store.register(phone, `Người Mua Điểm ${key}`);
    buyers[key] = { id, call: await store.buyerSession(phone) };
  }
  // Tích 2%, 1 điểm = 1 đồng; trần 9.000 điểm mỗi đơn, 9.000 điểm mỗi tháng. Hạng thử: từ 300.000 đồng hệ số 1,5.
  const phase = {
    startsOn: store.today,
    endsOn: null,
    earnPercent: "2",
    pointValue: "1",
    redeemMaxPercent: "50",
    redeemMinPoints: 1000,
    validityMonths: 12,
    orderCapPoints: 9000,
    monthlyCapPoints: 9000,
  };
  expect((await store.call("post", "/loyalty/phases", phase)).status).toBe(201);
  const tiers = [
    { nameVi: "Thành viên", nameEn: "Member", minAnnualSpend: "0", multiplier: "1" },
    { nameVi: "Bạc", nameEn: "Silver", minAnnualSpend: "300000", multiplier: "1.5" },
  ];
  expect((await store.call("put", "/loyalty/tiers", { tiers })).status).toBe(200);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_51 tích điểm", () => {
  it("KICHBAN_KIEMTHU_488: tích khi hoàn tất theo giá trị hoàn tất (trừ hàng trả), trần mỗi đơn, trần tháng; điểm dự kiến lúc đặt; hạn 12 tháng", async () => {
    const { first } = buyers;
    // Kem 2 + xà phòng 1: tiền hàng 544.000, miễn phí giao. Dự kiến 10.880 điểm, trần đơn 9.000.
    const order = await placeOrder(first.call, [
      { variantId: store.variants.cream, quantity: 2 },
      { variantId: store.variants.soap, quantity: 1 },
    ]);
    const placed = (await first.call("get", `/buyer/orders/${order.id}`)).body;
    expect(placed.points).toMatchObject({ expectedPoints: 9000, earnedPoints: null, earnStatus: "pending", tierName: "Thành viên", multiplier: "1", earnPercent: "2", pointValue: "1" });
    expect(placed.pointsAmount).toBe("0");
    await deliver(order);
    // Trả 1 kem trước khi hoàn tất: giá trị hoàn tất 294.000 → 5.880 điểm.
    const delivered = (await first.call("get", `/buyer/orders/${order.id}`)).body;
    const creamLine = delivered.lines.find((line: { productName: string }) => line.productName === "Kem dưỡng da VComm").orderLineId;
    const returned = (await first.call("post", `/buyer/orders/${order.id}/return-requests`, { reason: "defective", description: "Vỡ nắp", lines: [{ orderLineId: creamLine, quantity: 1 }] })).body[0];
    const approved = (await store.call("post", `/marketplace/return-requests/${returned.id}/approve`, { note: null, version: returned.version })).body;
    expect((await store.call("post", `/marketplace/return-requests/${approved.id}/receive`, { note: null, version: approved.version })).body.status).toBe("received");
    await complete(order.id);
    const completed = (await store.call("get", `/marketplace/orders/${order.id}`)).body;
    expect(completed.points).toMatchObject({ earnedPoints: 5880, earnStatus: "earned", skipReason: null });
    const nextYear = `${Number(store.today.slice(0, 4)) + 1}${store.today.slice(4)}`;
    expect(completed.points.expiresOn).toBe(nextYear);
    expect(await balanceOf(first.id)).toBe(5880);
    // Chạy lại việc nền không tích thêm.
    await application.get(MarketplaceOrdersService).completeDue();
    expect(await balanceOf(first.id)).toBe(5880);

    // Đơn 2: kem 2 = 500.000 → 10.000, trần đơn 9.000, trần tháng còn 3.120.
    const second = await placeOrder(first.call, [{ variantId: store.variants.cream, quantity: 2 }]);
    await deliver(second);
    await complete(second.id);
    expect((await first.call("get", `/buyer/orders/${second.id}`)).body.points).toMatchObject({ earnedPoints: 3120, earnStatus: "earned" });
    expect(await balanceOf(first.id)).toBe(9000);
    // Đơn 3: trần tháng đã hết → không tích, lý do 0 điểm.
    const third = await placeOrder(first.call, [{ variantId: store.variants.soap, quantity: 1 }]);
    await deliver(third);
    await complete(third.id);
    expect((await first.call("get", `/buyer/orders/${third.id}`)).body.points).toMatchObject({ earnedPoints: null, earnStatus: "skipped", skipReason: "zero" });

    // Điểm của tôi: số dư, lịch sử có số đơn, hạn dùng; người khác chỉ thấy ví của mình.
    const mine = (await first.call("get", "/buyer/loyalty")).body;
    expect(mine).toMatchObject({ balance: 9000, locked: false, pointValue: "1", expiringPoints: 0 });
    const entries = (await first.call("get", "/buyer/loyalty/entries?pageSize=1")).body;
    expect(entries).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(entries.data[0]).toMatchObject({
      kind: "earn",
      points: 3120,
      balanceAfter: 9000,
      sourceType: "marketplace_order",
      sourceId: second.id,
      documentNo: expect.any(String),
      expiresOn: nextYear,
    });
    expect((await buyers.second.call("get", "/buyer/loyalty")).body).toMatchObject({ balance: 0 });
    expect((await buyers.second.call("get", "/buyer/loyalty/entries")).body.total).toBe(0);
    // Thông báo trong ứng dụng.
    const notices = await pool.query("SELECT kind FROM core.notifications WHERE user_id = $1 AND kind LIKE 'loyalty.%' ORDER BY created_at", [first.id]);
    expect(notices.rows.map((row) => row.kind)).toEqual(["loyalty.earned", "loyalty.tier_up", "loyalty.earned"]);
  });

  it("KICHBAN_KIEMTHU_493: hạng theo chi tiêu năm nay và năm trước, lên hạng ngay, hệ số theo hạng lúc đặt, đầu năm xét lại", async () => {
    const { first, second } = buyers;
    // Người mua 1: chi tiêu 294.000 + 500.000 + 44.000 (đơn không tích vẫn tính chi tiêu) → Bạc từ đơn 2.
    const account = (await first.call("get", "/buyer/loyalty")).body;
    expect(account).toMatchObject({ spendCurrentYear: "838000", spendPreviousYear: "0", tier: { nameVi: "Bạc" }, nextTier: null, remainingToNext: null });
    const history = await pool.query("SELECT t.name_vi, h.reason FROM loyalty.tier_history h JOIN loyalty.tiers t ON t.id = h.to_tier_id WHERE h.user_id = $1", [first.id]);
    expect(history.rows).toEqual([{ name_vi: "Bạc", reason: "order_completed" }]);

    // Người mua 2: chi tiêu năm trước 400.000 → Bạc; đơn 294.000 tích theo hệ số 1,5 = 8.820.
    const year = Number(store.today.slice(0, 4));
    await pool.query("INSERT INTO loyalty.accounts (user_id, spend_year, spend_current_year) VALUES ($1, $2, 400000)", [second.id, year - 1]);
    expect((await second.call("get", "/buyer/loyalty")).body).toMatchObject({ spendPreviousYear: "400000", spendCurrentYear: "0", tier: { nameVi: "Bạc" } });
    const order = await placeOrder(second.call, [
      { variantId: store.variants.cream, quantity: 1 },
      { variantId: store.variants.soap, quantity: 1 },
    ]);
    expect((await second.call("get", `/buyer/orders/${order.id}`)).body.points).toMatchObject({ tierName: "Bạc", multiplier: "1.5", expectedPoints: 8820 });
    await deliver(order);
    await complete(order.id);
    expect(await balanceOf(second.id)).toBe(8820);

    // Đầu năm: chi tiêu năm nay thành năm trước; hạng giữ theo năm trước.
    await pool.query("UPDATE loyalty.accounts SET spend_year = spend_year - 1 WHERE user_id = $1", [first.id]);
    expect(await application.get(LoyaltyAccountsService).yearStart()).toBe(0);
    expect((await first.call("get", "/buyer/loyalty")).body).toMatchObject({ spendCurrentYear: "0", spendPreviousYear: "838000", tier: { nameVi: "Bạc" } });
    // Hai năm không mua: về hạng thấp nhất.
    await pool.query("UPDATE loyalty.accounts SET spend_year = spend_year - 1 WHERE user_id = $1", [first.id]);
    expect(await application.get(LoyaltyAccountsService).yearStart()).toBe(1);
    expect((await first.call("get", "/buyer/loyalty")).body).toMatchObject({ spendPreviousYear: "0", tier: { nameVi: "Thành viên" }, nextTier: { nameVi: "Bạc" }, remainingToNext: "300000" });
  });

  it("KICHBAN_KIEMTHU_489: đơn hủy không tích; người mua thử, ví khóa không tích", async () => {
    const { tester, locked, second } = buyers;
    const cancelled = await placeOrder(second.call, [{ variantId: store.variants.soap, quantity: 1 }]);
    expect((await second.call("post", `/buyer/orders/${cancelled.id}/cancel`, { reason: "Đổi ý", version: cancelled.version })).status).toBe(200);
    expect((await second.call("get", `/buyer/orders/${cancelled.id}`)).body.points).toMatchObject({ earnStatus: "cancelled", earnedPoints: null });

    expect((await store.call("put", `/marketplace/buyers/${tester.id}/test-buyer`, { isTestBuyer: true })).status).toBe(200);
    const testOrder = await placeOrder(tester.call, [{ variantId: store.variants.soap, quantity: 1 }]);
    await deliver(testOrder);
    await complete(testOrder.id);
    expect((await tester.call("get", `/buyer/orders/${testOrder.id}`)).body.points).toMatchObject({ earnStatus: "skipped", skipReason: "test_buyer" });

    const lockedOrder = await placeOrder(locked.call, [{ variantId: store.variants.soap, quantity: 1 }]);
    await pool.query("UPDATE loyalty.accounts SET locked = true, lock_reason = 'Kiểm thử' WHERE user_id = $1", [locked.id]);
    await deliver(lockedOrder);
    await complete(lockedOrder.id);
    expect((await locked.call("get", `/buyer/orders/${lockedOrder.id}`)).body.points).toMatchObject({ earnStatus: "skipped", skipReason: "locked" });
    expect((await locked.call("get", "/buyer/loyalty")).body).toMatchObject({ balance: 0, locked: true, spendCurrentYear: "44000" });
  });

  it("KICHBAN_KIEMTHU_487: sổ cái chỉ thêm; số dư = tổng bút toán = tổng lô còn lại; không âm", async () => {
    await expect(pool.query("UPDATE loyalty.entries SET points = points + 1")).rejects.toThrow(/chỉ được thêm/);
    await expect(pool.query("DELETE FROM loyalty.entries")).rejects.toThrow(/chỉ được thêm/);
    await expect(pool.query("DELETE FROM loyalty.entry_lots")).rejects.toThrow(/chỉ được thêm/);
    await expect(pool.query("UPDATE loyalty.accounts SET balance = -1 WHERE user_id = $1", [buyers.first.id])).rejects.toThrow();
    const mismatched = await pool.query(`
      SELECT a.user_id FROM loyalty.accounts a
      WHERE a.balance <> coalesce((SELECT sum(e.points) FROM loyalty.entries e WHERE e.user_id = a.user_id), 0)
         OR a.balance <> coalesce((SELECT sum(l.remaining) FROM loyalty.lots l WHERE l.user_id = a.user_id), 0)
         OR EXISTS (SELECT 1 FROM loyalty.entries e WHERE e.user_id = a.user_id
           AND e.points <> (SELECT sum(el.points) FROM loyalty.entry_lots el WHERE el.entry_id = e.id))`);
    expect(mismatched.rows).toEqual([]);
    expect((await pool.query("SELECT count(*)::int AS count FROM loyalty.entries")).rows[0].count).toBe(3);
  });
});
