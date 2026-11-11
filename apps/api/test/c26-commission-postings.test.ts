// CONG_VIEC_26 L4: bút toán hoa hồng đơn VComm, chi trả rút tiền, thuế thu nhập cá nhân khấu trừ (KICHBAN_KIEMTHU_360).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { prepareMarketplace, retail, startGhnMock, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-hh-butoan-0123456789";

async function journalLines(sourceType: string, sourceId: string): Promise<[string, number, number][]> {
  const rows = await pool.query(
    `SELECT a.code, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id JOIN accounting.accounts a ON a.id = l.account_id
     WHERE j.source_type = $1 AND j.source_id = $2 ORDER BY l.line_no`,
    [sourceType, sourceId],
  );
  return rows.rows.map((row) => [row.code, row.debit, row.credit]);
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const setup = await store.call("post", "/finance/ledger/setup");
  expect(setup.status, JSON.stringify(setup.body)).toBe(201);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_26 bút toán hoa hồng", () => {
  it("KICHBAN_KIEMTHU_360: đơn hoàn tất Nợ chi phí hoa hồng / Có 3388; ghi đã chi Nợ 3388 / Có ngân hàng số thực nhận / Có 3335 số thuế", async () => {
    const regime = (await pool.query("SELECT accounting_regime FROM core.companies WHERE id = $1", [retail])).rows[0].accounting_regime as string;
    const codes = regime === "TT133" ? { bank: "1121", expense: "6421" } : { bank: "112", expense: "6411" };
    const referrerId = await store.register("0936100001", "Người Giới Thiệu Bút Toán");
    await store.register("0936100002", "Người Mua Bút Toán", "0936100001");
    const buyer = await store.buyerSession("0936100002");
    expect(
      (
        await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, {
          calculation: "percent",
          referral: "10",
          staff: "0",
          teamHead: "0",
          regionalDirector: "0",
          director: "0",
          version: 0,
        })
      ).status,
    ).toBe(200);
    // Một kem 250.000 gồm thuế: hoa hồng giới thiệu 10% × 227.272,73 = 22.727.
    const addressId = await store.addressOf(buyer);
    const lines = [{ variantId: store.variants.cream, quantity: 1 }];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    const placed = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" })).body;
    const shipped = (await store.call("post", `/marketplace/orders/${placed.id}/ship`, { carrierCode: "ghn", version: placed.version })).body;
    ghn.orders.set(shipped.trackingCode, { status: "delivered", codCollectDate: null });
    await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.trackingCode, Type: "switch_status" });
    await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [placed.id]);
    expect(await application.get(MarketplaceOrdersService).completeDue()).toBe(1);
    expect(await journalLines("marketplace_commission", placed.id)).toEqual([
      [codes.expense, 22727, 0],
      ["3388", 0, 22727],
    ]);

    // Rút toàn bộ: ngưỡng thuế 10.000, tỷ lệ 10% (cấu hình được) nên khấu trừ 2.273, thực nhận 20.454.
    expect((await store.call("put", "/marketplace/commission-settings", { taxThreshold: "10000", taxRate: "10", minimumWithdrawal: "10000", version: 0 })).status).toBe(200);
    const referrer = await store.buyerSession("0936100001");
    expect((await referrer("put", "/buyer/bank-account", { bankName: "BIDV", accountNumber: "1234567890", accountHolder: "NGUOI GIOI THIEU" })).status).toBe(200);
    const withdrawal = (await referrer("post", "/buyer/withdrawals", { amount: "22727" })).body;
    const approved = (await store.call("post", `/marketplace/withdrawals/${withdrawal.id}/approve`, { version: withdrawal.version })).body;
    expect(approved).toMatchObject({ taxAmount: "2273", netAmount: "20454" });
    // Chưa chi: chưa có bút toán chi trả.
    expect(await journalLines("marketplace_withdrawal", withdrawal.id)).toEqual([]);
    expect((await store.call("post", `/marketplace/withdrawals/${withdrawal.id}/pay`, { bankTransactionNo: "FT9001", paidOn: store.today, version: approved.version })).status).toBe(200);
    expect(await journalLines("marketplace_withdrawal", withdrawal.id)).toEqual([
      ["3388", 22727, 0],
      [codes.bank, 0, 20454],
      ["3335", 0, 2273],
    ]);
    // Phần 3388 của hoa hồng về 0 sau khi chi hết (3388 còn dùng cho bút toán khác như tồn đầu kỳ).
    const payable = await pool.query(
      `SELECT sum(l.credit - l.debit)::float AS balance FROM accounting.journal_lines l JOIN accounting.accounts a ON a.id = l.account_id JOIN accounting.journals j ON j.id = l.journal_id
       WHERE a.company_id = $1 AND a.code = '3388' AND j.source_type IN ('marketplace_commission', 'marketplace_withdrawal')`,
      [retail],
    );
    expect(payable.rows[0].balance).toBe(0);
    expect((await pool.query("SELECT balance::float FROM marketplace.wallets WHERE user_id = $1", [referrerId])).rows[0].balance).toBe(0);
  });
});
