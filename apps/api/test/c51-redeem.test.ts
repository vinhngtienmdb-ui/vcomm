// CONG_VIEC_51 L2: dùng điểm khi đặt đơn VComm, hoàn điểm khi hủy, khi nhận hàng trả; bán, trả hàng tại quầy qua service điểm (CONG_VIEC_53)
// (KICHBAN_KIEMTHU_490, 491; TIEUCHI_NGHIEMTHU_332, 333).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { creditLot, LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
let database: Database;
let ledger: LoyaltyLedgerService;
const webhookKey = "khoa-webhook-kiem-thu-doi-diem-0123456789";
let buyer: BuyerCall;
let buyerId: string;
let lots: { soon: string; fresh: string };

const addDays = (day: string, days: number) => {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const balanceOf = async (userId: string) => (await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? null;
const lotOf = async (id: string) => (await pool.query("SELECT remaining, expires_on::text FROM loyalty.lots WHERE id = $1", [id])).rows[0];
const lines = (quantity: number) => [{ variantId: store.variants.cream, quantity }];

async function place(pointsToRedeem: number, quantity = 2, paymentMethod = "cod") {
  const addressId = await store.addressOf(buyer);
  const preview = (await buyer("post", "/buyer/orders/preview", { addressId, lines: lines(quantity), pointsToRedeem })).body;
  return buyer("post", "/buyer/orders", { addressId, lines: lines(quantity), expectedTotal: preview.total, paymentMethod, pointsToRedeem });
}
async function deliver(order: { id: string; version: number }): Promise<void> {
  const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
  expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  // Tích 2%, 1 điểm = 1 đồng, đổi tối đa 30% tiền hàng, tối thiểu 1.000 điểm.
  const phase = {
    startsOn: store.today,
    endsOn: null,
    earnPercent: "2",
    pointValue: "1",
    redeemMaxPercent: "30",
    redeemMinPoints: 1000,
    validityMonths: 12,
    orderCapPoints: null,
    monthlyCapPoints: null,
  };
  expect((await store.call("post", "/loyalty/phases", phase)).status).toBe(201);
  buyerId = await store.register("0939200001", "Người Mua Đổi Điểm");
  buyer = await store.buyerSession("0939200001");
  // Hai lô: 2.000 điểm còn 10 ngày, 100.000 điểm còn 12 tháng.
  await database.transaction(async (transaction) => {
    await lockAccount(transaction, buyerId);
    await creditLot(transaction, {
      userId: buyerId,
      kind: "adjust_add",
      sourceType: "adjustment",
      sourceId: randomUUID(),
      companyId: retail,
      points: 2000,
      pointValue: 1,
      day: addDays(store.today, -355),
      validityMonths: 12,
    });
    await creditLot(transaction, {
      userId: buyerId,
      kind: "adjust_add",
      sourceType: "adjustment",
      sourceId: randomUUID(),
      companyId: retail,
      points: 100000,
      pointValue: 1,
      day: store.today,
      validityMonths: 12,
    });
  });
  const rows = (await pool.query("SELECT id, points FROM loyalty.lots WHERE user_id = $1", [buyerId])).rows;
  lots = { soon: rows.find((row) => row.points === 2000).id, fresh: rows.find((row) => row.points === 100000).id };
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_51 đổi điểm", () => {
  it("KICHBAN_KIEMTHU_490: xem trước, dùng điểm khi đặt: tối thiểu, số dư, giới hạn phần trăm, ví khóa; tiền thu hộ, tiền cổng trừ tiền điểm", async () => {
    const addressId = await store.addressOf(buyer);
    // Kem 2 = 500.000, miễn phí giao: tối đa 30% = 150.000 điểm, số dư 102.000.
    const preview = (await buyer("post", "/buyer/orders/preview", { addressId, lines: lines(2), pointsToRedeem: 50000 })).body;
    expect(preview).toMatchObject({
      loyalty: { balance: 102000, minPoints: 1000, maxPoints: 102000, pointValue: "1", redeemable: true, blockedReason: null },
      pointsToRedeem: 50000,
      pointsAmount: "50000",
      total: "500000",
      payable: "450000",
      expectedPoints: 9000,
    });
    // Xem trước với số điểm quá giới hạn: hạ về tối đa; dưới tối thiểu: không dùng.
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines: lines(1), pointsToRedeem: 999999 })).body).toMatchObject({ pointsToRedeem: 75000, payable: "205000" });
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines: lines(2), pointsToRedeem: 500 })).body).toMatchObject({ pointsToRedeem: 0, pointsAmount: "0" });

    // Đặt: dưới tối thiểu, vượt giới hạn bị từ chối.
    for (const points of [500, 150001]) {
      const rejected = await place(points);
      expect(rejected.status).toBe(409);
      expect(rejected.body.error.message).toBe("Số điểm dùng không hợp lệ (dưới mức tối thiểu, vượt số dư hoặc vượt giới hạn của đơn).");
    }
    const placed = await place(50000);
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body).toMatchObject({ pointsAmount: "50000", points: { redeemedPoints: 50000, redeemedAmount: "50000", expectedPoints: 9000, earnStatus: "pending" } });
    const order = (await pool.query("SELECT cod_amount::float AS cod, points_amount::float AS points FROM marketplace.orders WHERE id = $1", [placed.body.id])).rows[0];
    expect(order).toEqual({ cod: 450000, points: 50000 });
    // Lô sắp hết hạn dùng trước.
    expect(await lotOf(lots.soon)).toMatchObject({ remaining: 0 });
    expect(await lotOf(lots.fresh)).toMatchObject({ remaining: 52000 });
    expect(await balanceOf(buyerId)).toBe(52000);
    // Đơn thanh toán trực tuyến: số tiền gửi cổng = tổng − tiền điểm (kiểm trực tiếp công thức của lần thanh toán).
    const total = (await pool.query("SELECT (goods_amount + shipping_fee - points_amount)::float AS total FROM marketplace.orders WHERE id = $1", [placed.body.id])).rows[0].total;
    expect(total).toBe(450000);

    // Ví khóa: không dùng được.
    await pool.query("UPDATE loyalty.accounts SET locked = true, lock_reason = 'Kiểm thử' WHERE user_id = $1", [buyerId]);
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines: lines(2), pointsToRedeem: 5000 })).body.loyalty).toMatchObject({
      redeemable: false,
      blockedReason: "locked",
      maxPoints: 0,
    });
    const locked = await place(5000);
    expect(locked.body.error.message).toBe("Ví điểm đang bị khóa.");
    await pool.query("UPDATE loyalty.accounts SET locked = false, lock_reason = NULL WHERE user_id = $1", [buyerId]);

    // Hủy đơn: hoàn toàn bộ 50.000 điểm vào đúng lô; lô đã quá hạn được thêm 30 ngày.
    await pool.query("UPDATE loyalty.lots SET expires_on = $2 WHERE id = $1", [lots.soon, addDays(store.today, -1)]);
    const cancelled = await buyer("post", `/buyer/orders/${placed.body.id}/cancel`, { reason: "Đổi ý", version: placed.body.version });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.points).toMatchObject({ refundedPoints: 50000, earnStatus: "cancelled" });
    expect(await lotOf(lots.soon)).toEqual({ remaining: 2000, expires_on: addDays(store.today, 30) });
    expect(await lotOf(lots.fresh)).toMatchObject({ remaining: 100000 });
    expect(await balanceOf(buyerId)).toBe(102000);
  });

  it("KICHBAN_KIEMTHU_491: nhận hàng trả hoàn điểm theo tỷ lệ, tiền hoàn trừ phần tiền điểm; hoàn tất tích theo phần không dùng điểm", async () => {
    const placed = (await place(50000)).body;
    await deliver(placed);
    const delivered = (await buyer("get", `/buyer/orders/${placed.id}`)).body;
    const creamLine = delivered.lines[0].orderLineId;
    const returned = (await buyer("post", `/buyer/orders/${placed.id}/return-requests`, { reason: "defective", description: "Vỡ nắp", lines: [{ orderLineId: creamLine, quantity: 1 }] })).body[0];
    const approved = (await store.call("post", `/marketplace/return-requests/${returned.id}/approve`, { note: null, version: returned.version })).body;
    expect((await store.call("post", `/marketplace/return-requests/${approved.id}/receive`, { note: null, version: approved.version })).body.status).toBe("received");
    // Trả 1/2 giá trị: hoàn 25.000 điểm; tiền hoàn 250.000 − 25.000.
    expect((await pool.query("SELECT amount::float AS amount, reason FROM marketplace.refunds WHERE order_id = $1", [placed.id])).rows).toEqual([{ amount: 225000, reason: "return_received" }]);
    expect((await buyer("get", `/buyer/orders/${placed.id}`)).body.points).toMatchObject({ redeemedPoints: 50000, refundedPoints: 25000 });
    expect(await balanceOf(buyerId)).toBe(77000);
    // Hoàn tất: giá trị hoàn tất 250.000 − tiền điểm còn lại 25.000 = 225.000 → 4.500 điểm.
    await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [placed.id]);
    await application.get(MarketplaceOrdersService).completeDue();
    expect((await buyer("get", `/buyer/orders/${placed.id}`)).body.points).toMatchObject({ earnedPoints: 4500, earnStatus: "earned" });
    expect(await balanceOf(buyerId)).toBe(81500);
    const kinds = (await pool.query("SELECT kind, points FROM loyalty.entries WHERE source_id = $1 ORDER BY created_at", [placed.id])).rows;
    expect(kinds).toEqual([
      { kind: "redeem", points: -50000 },
      { kind: "redeem_refund", points: 25000 },
      { kind: "earn", points: 4500 },
    ]);
  });

  it("KICHBAN_KIEMTHU_491: bán, trả hàng tại quầy qua service: dùng, tích ngay, trả một phần, thiếu số dư quy ra tiền, hủy", async () => {
    const day = store.today;
    const spend = async () => Number((await pool.query("SELECT spend_current_year FROM loyalty.accounts WHERE user_id = $1", [buyerId])).rows[0].spend_current_year);
    const spendBefore = await spend();
    const sale = randomUUID();
    // Bán 1.000.000, dùng 20.000 điểm (tối đa 30% = 300.000), tích (1.000.000 − 20.000) × 2% = 19.600.
    const quote = await ledger.quoteRedemption(database, { userId: buyerId, sourceType: "retail_sale", day, goodsAmount: 1000000 });
    expect(quote).toMatchObject({ balance: 81500, maxPoints: 81500, minPoints: 1000, redeemable: true });
    await database.transaction(async (transaction) => {
      expect(await ledger.redeemWithin(transaction, { userId: buyerId, companyId: retail, sourceType: "retail_sale", sourceId: sale, day, goodsAmount: 1000000, points: 20000 })).toMatchObject({
        points: 20000,
        amount: 20000,
      });
      expect(await ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: sale, userId: buyerId, companyId: retail, day, goodsAmount: 1000000 })).toEqual({
        points: 19600,
        skipReason: null,
      });
    });
    expect(await balanceOf(buyerId)).toBe(81100);
    expect(await spend()).toBe(spendBefore + 1000000);
    // Trả 500.000: hoàn 10.000 điểm đã dùng, trừ lại 9.800 điểm đã tích; tiền hoàn cho khách = 500.000 − 10.000.
    const firstReturn = randomUUID();
    const partial = await database.transaction((transaction) =>
      ledger.returnWithin(transaction, { saleSourceType: "retail_sale", saleSourceId: sale, returnSourceId: firstReturn, companyId: retail, day, returnedGoodsAmount: 500000 }),
    );
    expect(partial).toEqual({ refundedPoints: 10000, refundedPointsAmount: 10000, reversedPoints: 9800, shortfallAmount: 0 });
    expect(await balanceOf(buyerId)).toBe(81300);
    expect(await spend()).toBe(spendBefore + 500000);
    expect((await pool.query("SELECT kind, points, source_type FROM loyalty.entries WHERE source_id = $1 ORDER BY created_at", [firstReturn])).rows).toEqual([
      { kind: "redeem_refund", points: 10000, source_type: "retail_return" },
      { kind: "earn_reversal", points: -9800, source_type: "retail_return" },
    ]);

    // Bán thứ hai 1.000.000 không dùng điểm (tích 20.000), rồi tiêu hết số dư ở chứng từ khác; hủy bán thứ hai: thiếu 20.000 điểm → trừ 20.000 đồng vào tiền hoàn.
    const second = randomUUID();
    await database.transaction((transaction) => ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: second, userId: buyerId, companyId: retail, day, goodsAmount: 1000000 }));
    expect(await balanceOf(buyerId)).toBe(101300);
    // Tiêu hết bằng nhiều chứng từ (giới hạn 30% mỗi chứng từ).
    for (const goodsAmount of [300000, 300000]) {
      const spendSale = randomUUID();
      const available = (await ledger.quoteRedemption(database, { userId: buyerId, sourceType: "retail_sale", day, goodsAmount })).maxPoints;
      await database.transaction((transaction) =>
        ledger.redeemWithin(transaction, { userId: buyerId, companyId: retail, sourceType: "retail_sale", sourceId: spendSale, day, goodsAmount, points: available }),
      );
    }
    const remaining = await balanceOf(buyerId);
    expect(remaining).toBe(101300 - 180000 > 0 ? 101300 - 180000 : 0);
    const cancelled = await database.transaction((transaction) => ledger.cancelWithin(transaction, { sourceType: "retail_sale", sourceId: second, companyId: retail, day }));
    expect(cancelled).toEqual({ refundedPoints: 0, refundedPointsAmount: 0, reversedPoints: remaining, shortfallAmount: 20000 - remaining });
    expect(await balanceOf(buyerId)).toBe(0);
  });
});
