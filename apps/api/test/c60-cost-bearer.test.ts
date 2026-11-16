// CONG_VIEC_60 L0: kiểu chia chi phí điểm theo giai đoạn; hạch toán ba kiểu khi khách tích ở công ty này, dùng ở công ty khác
// (KICHBAN_KIEMTHU_611 đến 613; TIEUCHI_NGHIEMTHU_434, 435).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { expireLot, LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { signIn } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let database: Database;
let ledger: LoyaltyLedgerService;
const trading = testIds.tradingCompany;

const addDays = (day: string, days: number) => {
  const value = new Date(`${day}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const phase = (startsOn: string, endsOn: string | null, overrides: object = {}) => ({
  startsOn,
  endsOn,
  earnPercent: "2",
  pointValue: "1",
  redeemMaxPercent: "50",
  redeemMinPoints: 1000,
  validityMonths: 12,
  orderCapPoints: null,
  monthlyCapPoints: null,
  ...overrides,
});
// Dòng bút toán theo vai trò định khoản của công ty: [vai trò, Nợ, Có], sắp theo vai trò.
async function journal(sourceType: string, sourceId: string, companyId: string): Promise<[string, number, number][]> {
  const rows = await pool.query(
    `SELECT r.role, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id
       AND r.role IN ('loyalty_expense', 'loyalty_liability', 'loyalty_intercompany_receivable', 'loyalty_intercompany_payable', 'receivable')
     WHERE j.source_type = $1 AND j.source_id = $2 AND j.company_id = $3`,
    [sourceType, sourceId, companyId],
  );
  return sorted(rows.rows.map((row): [string, number, number] => [row.role, row.debit, row.credit]));
}
const sorted = (lines: [string, number, number][]) => [...lines].sort((left, right) => left[0].localeCompare(right[0]) || left[1] - right[1]);
const entryOf = async (kind: string, sourceId: string) => (await pool.query("SELECT id FROM loyalty.entries WHERE kind = $1 AND source_id = $2", [kind, sourceId])).rows[0].id as string;
const earn = (sourceId: string, userId: string, goodsAmount: number) =>
  database.transaction((transaction) => ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId, userId, companyId: trading, day: store.today, goodsAmount }));

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  ledger = application.get(LoyaltyLedgerService);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  const group = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await group.call("post", "/finance/ledger/setup", { companyId: trading })).status).toBe(201);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_60 kiểu chia chi phí điểm", () => {
  it("KICHBAN_KIEMTHU_611: giai đoạn có kiểu chia chi phí (mặc định nơi tích chịu); giai đoạn đã bắt đầu không đổi được kiểu; lô lưu kiểu lúc tích", async () => {
    const created = await store.call("post", "/loyalty/phases", phase(store.today, addDays(store.today, 9), { costBearer: "operator" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.costBearer).toBe("operator");
    const upcoming = await store.call("post", "/loyalty/phases", phase(addDays(store.today, 10), addDays(store.today, 19)));
    expect(upcoming.body.costBearer).toBe("earning_company");
    // Giai đoạn sắp tới: đổi được kiểu.
    const changed = await store.call("put", `/loyalty/phases/${upcoming.body.id}`, {
      ...phase(addDays(store.today, 10), addDays(store.today, 19)),
      costBearer: "redeeming_company",
      version: upcoming.body.version,
    });
    expect(changed.status, JSON.stringify(changed.body)).toBe(200);
    expect(changed.body.costBearer).toBe("redeeming_company");
    // Giai đoạn đã bắt đầu: không đổi được kiểu, vẫn sửa được ngày kết thúc.
    const refused = await store.call("put", `/loyalty/phases/${created.body.id}`, { ...phase(store.today, addDays(store.today, 9)), costBearer: "earning_company", version: created.body.version });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe("BUSINESS_RULE");
    expect(refused.body.error.message).toBe("Giai đoạn đã bắt đầu, không đổi được kiểu chia chi phí.");
    const endChanged = await store.call("put", `/loyalty/phases/${created.body.id}`, { ...phase(store.today, addDays(store.today, 8)), costBearer: "operator", version: created.body.version });
    expect(endChanged.status, JSON.stringify(endChanged.body)).toBe(200);
    // Giá trị không hợp lệ.
    expect((await store.call("post", "/loyalty/phases", phase(addDays(store.today, 30), null, { costBearer: "seller" }))).status).toBe(400);
    const program = (await store.call("get", "/loyalty/program")).body;
    expect(program.phases.map((item: { costBearer: string }) => item.costBearer)).toEqual(["redeeming_company", "operator"]);
    // Lô lưu kiểu của giai đoạn lúc tích.
    const buyerId = await store.register("0939600001", "Khách Kiểu Chia");
    const sale = randomUUID();
    await earn(sale, buyerId, 100000);
    expect((await pool.query("SELECT cost_bearer FROM loyalty.lots WHERE source_id = $1", [sale])).rows[0].cost_bearer).toBe("operator");
  });

  it("KICHBAN_KIEMTHU_612: công ty vận hành sàn chịu và nơi dùng chịu: tích chỉ ghi ở công ty vận hành sàn; dùng điểm tách theo kiểu của lô", async () => {
    const buyerId = await store.register("0939600002", "Khách Liên Minh");
    // Giai đoạn đang hiệu lực kiểu công ty vận hành sàn chịu: tích 1.000.000 × 2% = 20.000 điểm.
    const operatorSale = randomUUID();
    await earn(operatorSale, buyerId, 1000000);
    expect(await journal("loyalty_entry", await entryOf("earn", operatorSale), retail)).toEqual(
      sorted([
        ["loyalty_expense", 20000, 0],
        ["loyalty_liability", 0, 20000],
      ]),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("earn", operatorSale), trading)).toEqual([]);
    // Lô kiểu nơi dùng chịu (giai đoạn đổi kiểu trước khi bắt đầu): tích 500.000 × 2% = 10.000 điểm, cũng chỉ ghi ở công ty vận hành sàn.
    await pool.query("UPDATE loyalty.program_phases SET cost_bearer = 'redeeming_company' WHERE starts_on = $1", [store.today]);
    const redeemingSale = randomUUID();
    await earn(redeemingSale, buyerId, 500000);
    expect(await journal("loyalty_entry", await entryOf("earn", redeemingSale), retail)).toEqual(
      sorted([
        ["loyalty_expense", 10000, 0],
        ["loyalty_liability", 0, 10000],
      ]),
    );
    // Dùng 25.000 điểm tại công ty con: 20.000 từ lô kiểu công ty vận hành sàn chịu (nợ nội bộ), 5.000 từ lô kiểu nơi dùng chịu (nơi dùng ghi chi phí).
    const redeem = randomUUID();
    await database.transaction((transaction) =>
      ledger.redeemWithin(transaction, { userId: buyerId, companyId: trading, sourceType: "retail_sale", sourceId: redeem, day: store.today, goodsAmount: 100000, points: 25000 }),
    );
    expect(await journal("loyalty_entry", await entryOf("redeem", redeem), retail)).toEqual(
      sorted([
        ["loyalty_expense", 0, 5000],
        ["loyalty_intercompany_receivable", 0, 20000],
        ["loyalty_liability", 25000, 0],
      ]),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("redeem", redeem), trading)).toEqual(
      sorted([
        ["loyalty_expense", 5000, 0],
        ["loyalty_intercompany_payable", 20000, 0],
        ["receivable", 0, 25000],
      ]),
    );
    // Trả toàn bộ chứng từ đầu: trừ lại 5.000 điểm còn lại (lô nơi dùng chịu), thiếu 15.000 điểm quy tiền theo kiểu lô chứng từ bán (công ty vận hành sàn chịu).
    const returnId = randomUUID();
    const returned = await database.transaction((transaction) =>
      ledger.returnWithin(transaction, { saleSourceType: "retail_sale", saleSourceId: operatorSale, returnSourceId: returnId, companyId: trading, day: store.today, returnedGoodsAmount: 1000000 }),
    );
    expect(returned).toEqual({ refundedPoints: 0, refundedPointsAmount: 0, reversedPoints: 5000, shortfallAmount: 15000 });
    expect(await journal("loyalty_entry", await entryOf("earn_reversal", returnId), retail)).toEqual(
      sorted([
        ["loyalty_expense", 0, 20000],
        ["loyalty_intercompany_receivable", 15000, 0],
        ["loyalty_liability", 5000, 0],
      ]),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("earn_reversal", returnId), trading)).toEqual(
      sorted([
        ["loyalty_intercompany_payable", 0, 15000],
        ["receivable", 15000, 0],
      ]),
    );
  });

  it("KICHBAN_KIEMTHU_613: nơi dùng chịu: hoàn điểm đã dùng ghi ngược; hết hạn gỡ chi phí tạm; cùng công ty cho kết quả như cũ", async () => {
    await pool.query("UPDATE loyalty.program_phases SET cost_bearer = 'redeeming_company' WHERE starts_on = $1", [store.today]);
    const buyerId = await store.register("0939600003", "Khách Nơi Dùng Chịu");
    const sale = randomUUID();
    await earn(sale, buyerId, 1000000);
    const redeem = randomUUID();
    await database.transaction((transaction) =>
      ledger.redeemWithin(transaction, { userId: buyerId, companyId: trading, sourceType: "retail_sale", sourceId: redeem, day: store.today, goodsAmount: 100000, points: 8000 }),
    );
    expect(await journal("loyalty_entry", await entryOf("redeem", redeem), retail)).toEqual(
      sorted([
        ["loyalty_expense", 0, 8000],
        ["loyalty_liability", 8000, 0],
      ]),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("redeem", redeem), trading)).toEqual(
      sorted([
        ["loyalty_expense", 8000, 0],
        ["receivable", 0, 8000],
      ]),
    );
    // Hủy chứng từ dùng điểm: hoàn 8.000 điểm, ghi ngược ở cả hai công ty.
    await database.transaction((transaction) => ledger.cancelWithin(transaction, { sourceType: "retail_sale", sourceId: redeem, companyId: trading, day: store.today }));
    expect(await journal("loyalty_entry", await entryOf("redeem_refund", redeem), retail)).toEqual(
      sorted([
        ["loyalty_expense", 8000, 0],
        ["loyalty_liability", 0, 8000],
      ]),
    );
    expect(await journal("loyalty_seller_entry", await entryOf("redeem_refund", redeem), trading)).toEqual(
      sorted([
        ["loyalty_expense", 0, 8000],
        ["receivable", 8000, 0],
      ]),
    );
    // Hết hạn: chỉ ở công ty vận hành sàn, gỡ chi phí tạm.
    const lot = (await pool.query("SELECT id FROM loyalty.lots WHERE source_id = $1", [sale])).rows[0].id as string;
    await pool.query("UPDATE loyalty.lots SET earned_on = $2::date - 400, expires_on = $2::date - 1 WHERE id = $1", [lot, store.today]);
    await database.transaction((transaction) => expireLot(transaction, lot, store.today));
    const expiry = (await pool.query("SELECT e.id FROM loyalty.entries e JOIN loyalty.entry_lots el ON el.entry_id = e.id WHERE e.kind = 'expire' AND el.lot_id = $1", [lot])).rows[0].id;
    expect(await journal("loyalty_entry", expiry, retail)).toEqual(
      sorted([
        ["loyalty_expense", 0, 20000],
        ["loyalty_liability", 20000, 0],
      ]),
    );
    // Cùng công ty (quầy của công ty vận hành sàn): một bút toán gộp như kiểu nơi tích chịu.
    const sameSale = randomUUID();
    await database.transaction((transaction) =>
      ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: sameSale, userId: buyerId, companyId: retail, day: store.today, goodsAmount: 100000 }),
    );
    const sameRedeem = randomUUID();
    await database.transaction((transaction) =>
      ledger.redeemWithin(transaction, { userId: buyerId, companyId: retail, sourceType: "retail_sale", sourceId: sameRedeem, day: store.today, goodsAmount: 10000, points: 1000 }),
    );
    expect(await journal("loyalty_entry", await entryOf("redeem", sameRedeem), retail)).toEqual(
      sorted([
        ["loyalty_liability", 1000, 0],
        ["receivable", 0, 1000],
      ]),
    );
  });
});
