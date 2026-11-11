// CONG_VIEC_25 L4: bút toán tiền thu, phí giao hàng, hoàn tiền; hóa đơn có dòng phí giao hàng (KICHBAN_KIEMTHU_325).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let ghn: GhnMock;
const secret = "BIMATKIEMTHU0123456789";
const webhookKey = "khoa-webhook-kiem-thu-butoan-0123456789";
const http = () => request(application.getHttpServer());

function ipnQuery(reference: string, amount: number): Record<string, string> {
  const parameters = { vnp_TmnCode: "VCOMMTST", vnp_Amount: String(amount * 100), vnp_TxnRef: reference, vnp_ResponseCode: "00", vnp_TransactionStatus: "00", vnp_TransactionNo: "15000001" };
  return { ...parameters, vnp_SecureHash: signedQuery(parameters, secret).hash };
}
// Dòng bút toán theo nguồn: số hiệu tài khoản, Nợ, Có.
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
  Object.assign(process.env, {
    GHN_API_TOKEN: "token-kiem-thu",
    GHN_SHOP_ID: "885",
    GHN_WEBHOOK_KEY: webhookKey,
    GHN_BASE_URL: ghn.url,
    VNPAY_TMN_CODE: "VCOMMTST",
    VNPAY_HASH_SECRET: secret,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/payment-methods/vnpay_atm", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const setup = await store.call("post", "/finance/ledger/setup");
  expect(setup.status, JSON.stringify(setup.body)).toBe(201);
  const year = Number(store.today.slice(0, 4));
  const einvoice = await store.call("put", "/finance/einvoice-settings", {
    enabled: true,
    startDate: `${year}-01-01`,
    provider: "simulator",
    environment: "test",
    withTaxCode: true,
    templateCode: "1",
    appId: null,
    taxCode: null,
    username: null,
    simulation: "normal",
    series: [{ year, series: `C${String(year).slice(2)}TAA` }],
    version: 0,
  });
  expect(einvoice.status, JSON.stringify(einvoice.body)).toBe(200);
  await store.register("0938000001", "Người Mua Bút Toán");
  buyer = await store.buyerSession("0938000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL"]) delete process.env[name];
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_25 bút toán, hóa đơn phí giao hàng", () => {
  it("KICHBAN_KIEMTHU_325: thu VNPAY Nợ 1121/Có 131; xuất hàng có phí giao hàng vào doanh thu dịch vụ, thuế 10%; hóa đơn có dòng phí giao hàng; hoàn tiền Nợ 131/Có 1121", async () => {
    const regime = (await pool.query("SELECT accounting_regime FROM core.companies WHERE id = $1", [retail])).rows[0].accounting_regime as string;
    const codes = regime === "TT133" ? { bank: "1121", revenue: "5111", service: "5113" } : { bank: "112", revenue: "511", service: "511" };
    // Một xà phòng 44.000 (gồm thuế 10%: 40.000 + 4.000) + phí giao hàng 30.000 (27.273 + 2.727).
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const placed = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "74000", paymentMethod: "vnpay_atm" })).body;
    expect(placed.status).toBe("awaiting_payment");
    const started = await buyer("post", `/buyer/orders/${placed.id}/payments`);
    const reference = new URL(started.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    expect((await http().get("/api/v1/public/payments/vnpay/ipn").query(ipnQuery(reference, 74000))).body.RspCode).toBe("00");
    const paymentId = (await pool.query("SELECT id FROM marketplace.payments WHERE reference = $1", [reference])).rows[0].id;
    expect(await journalLines("marketplace_payment", paymentId)).toEqual([
      [codes.bank, 74000, 0],
      ["131", 0, 74000],
    ]);

    // Giao: GHN lấy hàng thì phiếu xuất ghi sổ, bút toán có phí giao hàng.
    const current = (await store.call("get", `/marketplace/orders/${placed.id}`)).body;
    const shipped = (await store.call("post", `/marketplace/orders/${placed.id}/ship`, { carrierCode: "ghn", version: current.version })).body;
    expect(shipped.trackingCode).toBeTruthy();
    // Đơn thanh toán trực tuyến: vận đơn không thu hộ.
    ghn.orders.set(shipped.trackingCode, { status: "delivered", codCollectDate: null });
    expect((await http().post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.trackingCode })).body.result).toBe("applied");
    const issue = (
      await pool.query("SELECT d.id FROM inventory.documents d JOIN marketplace.orders m ON m.sales_order_id = d.source_id WHERE m.id = $1 AND d.type = 'sales_issue' AND d.status = 'posted'", [
        placed.id,
      ])
    ).rows[0].id;
    const issueLines = await journalLines("inventory_document", issue);
    const sum = (code: string, side: 1 | 2) => issueLines.filter((line) => line[0] === code).reduce((total, line) => total + line[side], 0);
    expect(sum("131", 1)).toBe(74000);
    expect(sum("33311", 2)).toBe(4000 + 2727);
    if (codes.service === codes.revenue) expect(sum(codes.revenue, 2)).toBe(40000 + 27273);
    else {
      expect(sum(codes.revenue, 2)).toBe(40000);
      expect(sum(codes.service, 2)).toBe(27273);
    }
    const invoice = (await pool.query("SELECT id, net_amount::float AS net, tax_amount::float AS tax, total_amount::float AS total FROM finance.einvoices WHERE source_document_id = $1", [issue]))
      .rows[0];
    expect(invoice).toMatchObject({ net: 67273, tax: 6727, total: 74000 });
    const invoiceLines = (
      await pool.query(
        "SELECT item_name, quantity::float AS quantity, unit_price::float AS price, vat_rate, total_amount::float AS total FROM finance.einvoice_lines WHERE invoice_id = $1 ORDER BY line_no",
        [invoice.id],
      )
    ).rows;
    expect(invoiceLines.at(-1)).toEqual({ item_name: "Phí giao hàng", quantity: 1, price: 27273, vat_rate: "10", total: 30000 });

    // Trả hàng: hoàn 44.000 (không hoàn phí giao hàng); kế toán ghi đã hoàn thì bút toán Nợ 131 / Có tiền gửi.
    const detail = (await buyer("get", `/buyer/orders/${placed.id}`)).body;
    const created = await buyer("post", `/buyer/orders/${placed.id}/return-requests`, {
      reason: "wrong_item",
      description: "Giao nhầm mùi",
      lines: [{ orderLineId: detail.lines[0].orderLineId, quantity: 1 }],
    });
    const requestId = created.body[0].id;
    const approved = (await store.call("post", `/marketplace/return-requests/${requestId}/approve`, { note: null, version: 1 })).body;
    expect((await store.call("post", `/marketplace/return-requests/${requestId}/receive`, { note: null, version: approved.version })).status).toBe(200);
    const refund = (await store.call("get", "/marketplace/refunds")).body.data.find((item: { orderId: string }) => item.orderId === placed.id);
    expect(refund.amount).toBe("44000");
    const done = await store.call("post", `/marketplace/refunds/${refund.id}/complete`, { bankTransactionNo: "FT9988", refundedOn: store.today, note: null, version: refund.version });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(await journalLines("marketplace_refund", refund.id)).toEqual([
      ["131", 44000, 0],
      [codes.bank, 0, 44000],
    ]);
    const journal = (await pool.query("SELECT journal_no, journal_date::text AS date FROM accounting.journals WHERE source_type = 'marketplace_refund' AND source_id = $1", [refund.id])).rows[0];
    expect(journal).toEqual({ journal_no: `${placed.documentNo}-HT`, date: store.today });
  });

  it("KICHBAN_KIEMTHU_323 (sửa sau rà soát): đơn vị vận chuyển hủy vận đơn của đơn đã thanh toán trực tuyến thì đơn hủy, lập việc chờ hoàn toàn bộ tiền đã thu", async () => {
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const placed = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "74000", paymentMethod: "vnpay_atm" })).body;
    const started = await buyer("post", `/buyer/orders/${placed.id}/payments`);
    const reference = new URL(started.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    expect((await http().get("/api/v1/public/payments/vnpay/ipn").query(ipnQuery(reference, 74000))).body.RspCode).toBe("00");
    const current = (await store.call("get", `/marketplace/orders/${placed.id}`)).body;
    const shipped = (await store.call("post", `/marketplace/orders/${placed.id}/ship`, { carrierCode: "ghn", version: current.version })).body;
    ghn.orders.set(shipped.trackingCode, { status: "cancel", codCollectDate: null });
    expect((await http().post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.trackingCode })).body.result).toBe("applied");
    const detail = (await buyer("get", `/buyer/orders/${placed.id}`)).body;
    expect(detail).toMatchObject({ status: "cancelled", paymentStatus: "refund_pending" });
    expect(detail.refunds).toEqual([{ amount: "74000", reason: "order_cancelled", status: "pending", refundedOn: null }]);
  });
});
