// CONG_VIEC_51 L3: hết hạn điểm, nhắc hạn, việc nền hằng ngày; hạch toán tích, dùng, hoàn, trừ lại, hết hạn, điều chỉnh, nợ nội bộ; báo cáo nghĩa vụ điểm
// (KICHBAN_KIEMTHU_492, 496; TIEUCHI_NGHIEMTHU_334, 337).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { LoyaltyJobsService } from "../src/loyalty/jobs.service";
import { creditLot, LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { lockAccount } from "../src/loyalty/tiers";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
let database: Database;
let ledger: LoyaltyLedgerService;
const trading = testIds.tradingCompany;
const webhookKey = "khoa-webhook-kiem-thu-diem-butoan-0123456789";
let buyer: BuyerCall;
let buyerId: string;
let counterBuyerId: string;

const addDays = (day: string, days: number) => {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
// Dòng bút toán theo vai trò định khoản của công ty: [vai trò, Nợ, Có].
async function journal(sourceType: string, sourceId: string, companyId: string): Promise<[string, number, number][]> {
  const rows = await pool.query(
    `SELECT r.role, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id
       AND r.role IN ('loyalty_expense', 'loyalty_liability', 'loyalty_intercompany_receivable', 'loyalty_intercompany_payable', 'receivable')
     WHERE j.source_type = $1 AND j.source_id = $2 AND j.company_id = $3 ORDER BY l.line_no`,
    [sourceType, sourceId, companyId],
  );
  // Thứ tự dòng không quan trọng: sắp theo vai trò.
  return rows.rows.map((row): [string, number, number] => [row.role, row.debit, row.credit]).sort((left, right) => left[0].localeCompare(right[0]) || left[1] - right[1]);
}
const sorted = (lines: [string, number, number][]) => [...lines].sort((left, right) => left[0].localeCompare(right[0]) || left[1] - right[1]);
const entryOf = async (kind: string, sourceId: string) => (await pool.query("SELECT id FROM loyalty.entries WHERE kind = $1 AND source_id = $2", [kind, sourceId])).rows[0].id as string;

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  const group = await signIn(application, "quantri.tapdoan@vcomm.test");
  const tradingSetup = await group.call("post", "/finance/ledger/setup", { companyId: trading });
  expect(tradingSetup.status, JSON.stringify(tradingSetup.body)).toBe(201);
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
  buyerId = await store.register("0939400001", "Người Mua Hạch Toán");
  buyer = await store.buyerSession("0939400001");
  counterBuyerId = await store.register("0939400002", "Khách Mua Tại Quầy");
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_51 hạch toán, hết hạn điểm", () => {
  it("KICHBAN_KIEMTHU_496: bút toán điều chỉnh, đơn VComm (dùng điểm gộp khi hoàn tất, tích), quầy cùng công ty, quầy công ty khác (nợ nội bộ), chênh lệch giá trị, thiếu quy tiền; nghĩa vụ khớp sổ cái", async () => {
    const adjustment = randomUUID();
    const valued = randomUUID();
    await database.transaction(async (transaction) => {
      await lockAccount(transaction, buyerId);
      await creditLot(transaction, {
        userId: buyerId,
        kind: "adjust_add",
        sourceType: "adjustment",
        sourceId: adjustment,
        companyId: retail,
        points: 100000,
        pointValue: 1,
        day: store.today,
        validityMonths: 12,
      });
    });
    expect(await journal("loyalty_entry", await entryOf("adjust_add", adjustment), retail)).toEqual(
      sorted([
        ["loyalty_expense", 100000, 0],
        ["loyalty_liability", 0, 100000],
      ]),
    );

    // Đơn VComm 500.000 dùng 50.000 điểm: không có bút toán lúc đặt, gộp khi hoàn tất; tích (500.000 − 50.000) × 2% = 9.000.
    const addressId = await store.addressOf(buyer);
    const orderLines = [{ variantId: store.variants.cream, quantity: 2 }];
    const preview = (await buyer("post", "/buyer/orders/preview", { addressId, lines: orderLines, pointsToRedeem: 50000 })).body;
    const order = (await buyer("post", "/buyer/orders", { addressId, lines: orderLines, expectedTotal: preview.total, paymentMethod: "cod", pointsToRedeem: 50000 })).body;
    expect(await journal("loyalty_entry", await entryOf("redeem", order.id), retail)).toEqual([]);
    const shipped = await store.call("post", `/marketplace/orders/${order.id}/ship`, { carrierCode: "ghn", version: order.version });
    ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
    await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
    await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [order.id]);
    await application.get(MarketplaceOrdersService).completeDue();
    expect(await journal("loyalty_order_redeem", order.id, retail)).toEqual(
      sorted([
        ["loyalty_liability", 50000, 0],
        ["receivable", 0, 50000],
      ]),
    );
    expect(await journal("loyalty_entry", await entryOf("earn", order.id), retail)).toEqual(
      sorted([
        ["loyalty_liability", 0, 9000],
        ["loyalty_expense", 9000, 0],
      ]),
    );

    // Lô giá trị 2 đồng một điểm dùng ở giai đoạn 1 đồng: nghĩa vụ giảm 2 × điểm, khách được trừ 1 × điểm, chênh lệch giảm chi phí.
    await database.transaction(async (transaction) => {
      await lockAccount(transaction, counterBuyerId);
      await creditLot(transaction, {
        userId: counterBuyerId,
        kind: "adjust_add",
        sourceType: "adjustment",
        sourceId: valued,
        companyId: retail,
        points: 10000,
        pointValue: 2,
        day: store.today,
        validityMonths: 12,
      });
    });
    const sameCompany = randomUUID();
    await database.transaction(async (transaction) => {
      await ledger.redeemWithin(transaction, { userId: counterBuyerId, companyId: retail, sourceType: "retail_sale", sourceId: sameCompany, day: store.today, goodsAmount: 100000, points: 10000 });
      await ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: sameCompany, userId: counterBuyerId, companyId: retail, day: store.today, goodsAmount: 100000 });
    });
    expect(await journal("loyalty_entry", await entryOf("redeem", sameCompany), retail)).toEqual(
      sorted([
        ["loyalty_liability", 20000, 0],
        ["loyalty_expense", 0, 10000],
        ["receivable", 0, 10000],
      ]),
    );
    // Tích (100.000 − 10.000) × 2% = 1.800 điểm.
    expect(await journal("loyalty_entry", await entryOf("earn", sameCompany), retail)).toEqual(
      sorted([
        ["loyalty_liability", 0, 1800],
        ["loyalty_expense", 1800, 0],
      ]),
    );

    // Quầy của công ty khác: tích 1.000.000 × 2% = 20.000 điểm; dùng 5.000 điểm ở chứng từ khác; trả toàn bộ chứng từ đầu khi số dư thiếu.
    const otherSale = randomUUID();
    await database.transaction((transaction) =>
      ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: otherSale, userId: counterBuyerId, companyId: trading, day: store.today, goodsAmount: 1000000 }),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("earn", otherSale), trading)).toEqual(
      sorted([
        ["loyalty_expense", 20000, 0],
        ["loyalty_intercompany_payable", 0, 20000],
      ]),
    );
    expect(await journal("loyalty_entry", await entryOf("earn", otherSale), retail)).toEqual(
      sorted([
        ["loyalty_liability", 0, 20000],
        ["loyalty_intercompany_receivable", 20000, 0],
      ]),
    );
    const otherRedeem = randomUUID();
    await database.transaction((transaction) =>
      ledger.redeemWithin(transaction, { userId: counterBuyerId, companyId: trading, sourceType: "retail_sale", sourceId: otherRedeem, day: store.today, goodsAmount: 100000, points: 21800 }),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("redeem", otherRedeem), trading)).toEqual(
      sorted([
        ["receivable", 0, 21800],
        ["loyalty_intercompany_payable", 21800, 0],
      ]),
    );
    expect(await journal("loyalty_entry", await entryOf("redeem", otherRedeem), retail)).toEqual(
      sorted([
        ["loyalty_liability", 21800, 0],
        ["loyalty_intercompany_receivable", 0, 21800],
      ]),
    );
    // Số dư 0: trả toàn bộ chứng từ đầu → thiếu 20.000 điểm quy 20.000 đồng: công ty bán Nợ 131, Có chi phí; không đổi nghĩa vụ.
    const returnId = randomUUID();
    const returned = await database.transaction((transaction) =>
      ledger.returnWithin(transaction, { saleSourceType: "retail_sale", saleSourceId: otherSale, returnSourceId: returnId, companyId: trading, day: store.today, returnedGoodsAmount: 1000000 }),
    );
    expect(returned).toEqual({ refundedPoints: 0, refundedPointsAmount: 0, reversedPoints: 0, shortfallAmount: 20000 });
    expect(await journal("loyalty_seller_entry", await entryOf("earn_reversal", returnId), trading)).toEqual(
      sorted([
        ["receivable", 20000, 0],
        ["loyalty_expense", 0, 20000],
      ]),
    );
    expect(await journal("loyalty_entry", await entryOf("earn_reversal", returnId), retail)).toEqual([]);

    // Nghĩa vụ điểm: số dư lô quy giá trị = số dư 3388 của các bút toán điểm ở công ty vận hành sàn.
    const report = (await store.call("get", `/loyalty/liability?year=${store.today.slice(0, 4)}`)).body;
    const lots = (await pool.query("SELECT coalesce(sum(remaining), 0)::int AS points, coalesce(sum(remaining * point_value), 0)::float AS value FROM loyalty.lots")).rows[0];
    expect(report).toMatchObject({ currentPoints: lots.points, currentValue: String(lots.value) });
    expect(report.months[0]).toMatchObject({ month: store.today.slice(0, 7), closingPoints: lots.points });
    const liability = (
      await pool.query(
        `SELECT coalesce(sum(l.credit - l.debit), 0)::float AS balance FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
         JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role = 'loyalty_liability'
         WHERE j.company_id = $1 AND j.source_type LIKE 'loyalty%'`,
        [retail],
      )
    ).rows[0].balance;
    expect(liability).toBe(lots.value);
    // Phân quyền: nhân viên không có quyền không xem được.
    expect((await (await signIn(application, "phuc.le@vcomm.test")).call("get", "/loyalty/liability?year=2026", { companyId: retail })).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_492: hết hạn đúng lô, bút toán hết hạn; nhắc một lần trước 30 ngày; việc nền hằng ngày", async () => {
    const expiring = randomUUID();
    const soon = randomUUID();
    await database.transaction(async (transaction) => {
      await lockAccount(transaction, buyerId);
      await creditLot(transaction, {
        userId: buyerId,
        kind: "adjust_add",
        sourceType: "adjustment",
        sourceId: expiring,
        companyId: retail,
        points: 3000,
        pointValue: 1,
        day: addDays(store.today, -366),
        validityMonths: 12,
      });
      await creditLot(transaction, {
        userId: buyerId,
        kind: "adjust_add",
        sourceType: "adjustment",
        sourceId: soon,
        companyId: retail,
        points: 4000,
        pointValue: 1,
        day: addDays(store.today, -355),
        validityMonths: 12,
      });
    });
    const before = (await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [buyerId])).rows[0].balance;
    const jobs = application.get(LoyaltyJobsService);
    const result = await jobs.runDaily();
    expect(result).toMatchObject({ expiredLots: 1, reminded: 1 });
    expect((await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [buyerId])).rows[0].balance).toBe(before - 3000);
    const expired = (
      await pool.query(
        "SELECT e.id, e.points FROM loyalty.entries e JOIN loyalty.entry_lots el ON el.entry_id = e.id JOIN loyalty.lots l ON l.id = el.lot_id WHERE e.kind = 'expire' AND l.source_id = $1",
        [expiring],
      )
    ).rows;
    expect(expired).toHaveLength(1);
    expect(expired[0].points).toBe(-3000);
    expect(await journal("loyalty_entry", expired[0].id, retail)).toEqual(
      sorted([
        ["loyalty_liability", 3000, 0],
        ["loyalty_expense", 0, 3000],
      ]),
    );
    // Chạy lại: không hết hạn, không nhắc lần hai.
    expect(await jobs.runDaily()).toMatchObject({ expiredLots: 0, reminded: 0 });
    const notices = await pool.query("SELECT title FROM core.notifications WHERE user_id = $1 AND kind = 'loyalty.expiring'", [buyerId]);
    expect(notices.rows).toEqual([{ title: `4.000 điểm thưởng sẽ hết hạn ngày ${addDays(store.today, 10).split("-").reverse().join("/")}` }]);
    // Ứng dụng: điểm sắp hết hạn.
    expect((await buyer("get", "/buyer/loyalty")).body).toMatchObject({ expiringPoints: 4000, expiringOn: addDays(store.today, 10) });
  });
});
