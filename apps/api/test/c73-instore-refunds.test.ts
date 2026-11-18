// CONG_VIEC_73 lát L7: hủy giao dịch đã thu hộ, hoàn tiền, ghi ngược L ở bảng chuyển tiền tiếp theo, việc chờ xử lý hóa đơn ủy nhiệm
// (QUYTAC_NGHIEPVU_583, 585, 587; lựa chọn người dùng 2026-11-17: công ty vận hành sàn chịu phí cổng, 3388 phải trả hoàn tiền khách).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EinvoicesService } from "../src/einvoice/einvoices.service";
import { InstoreEinvoicesService } from "../src/instore/mandated-einvoices.service";
import { InstorePayoutsService } from "../src/instore/payouts.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareAffiliate, operator, type AffiliateFixture } from "./c55-fixture";
import type { Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let hoa: { id: string; call: BuyerCall; phone: string };
let year: number;
let ipnNo = 14000900;
let saleA: { checkoutId: string; transactionId: string };
let saleB: { checkoutId: string; transactionId: string };
let firstPayout: string;

const http = () => request(application.getHttpServer());
const admin = (method: "get" | "put" | "post" | "patch", path: string, body?: object) => fixture.admin.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
const portal = (session: Session, method: "get" | "post", path: string, body?: object) => session.call(method, `/merchant-portal${path}`, body ? { body } : {});
const nextDay = (day: string, days = 1) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

async function journal(sourceType: string, sourceId: string) {
  const rows = await pool.query<{ code: string; debit: string; credit: string }>(
    `SELECT a.code, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_type = $1 AND j.source_id = $2 ORDER BY l.debit DESC, a.code`,
    [sourceType, sourceId],
  );
  return rows.rows.map((row) => [row.code, Number(row.debit), Number(row.credit)]);
}

async function sale(billAmount: number): Promise<{ checkoutId: string; transactionId: string }> {
  const created = await portal(fixture.cashier, "post", "/checkouts", { clientKey: randomUUID(), outletId: fixture.outletA, billAmount: String(billAmount), collectInApp: true });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect((await hoa.call("post", "/buyer/instore/checkouts/claim", { token: created.body.qrUrl.split("/tt/")[1] })).status).toBe(200);
  const paid = await hoa.call("post", `/buyer/instore/checkouts/${created.body.id}/pay`, { points: 0, method: "vnpay_qr" });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  ipnNo += 1;
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(billAmount * 100),
    vnp_TxnRef: new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: String(ipnNo),
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  const ipn = await http()
    .get("/api/v1/public/payments/vnpay/ipn")
    .query({ ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash });
  expect(ipn.body.RspCode).toBe("00");
  const result = (await portal(fixture.cashier, "get", `/checkouts/${created.body.id}`)).body;
  expect(result.status).toBe("completed");
  return { checkoutId: created.body.id, transactionId: result.transactionId };
}

beforeAll(async () => {
  Object.assign(process.env, {
    VNPAY_TMN_CODE: tmnCode,
    VNPAY_HASH_SECRET: secret,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  });
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool);
  year = Number(fixture.today.slice(0, 4));
  expect((await fixture.call("post", "/finance/ledger/setup")).status).toBe(201);
  expect((await admin("put", "/marketplace/payment-methods/vnpay_qr", { isEnabled: true })).status).toBe(200);
  expect((await admin("put", "/finance/instore/gateway-fees", { rates: [{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: fixture.today }] })).status).toBe(200);
  const partner = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [fixture.merchantId])).rows[0].partner_id as string;
  const account = (
    await pool.query("INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, is_default) VALUES ($1, 'Vietcombank', '0071009998887', 'HAT NAU', true) RETURNING id", [
      partner,
    ])
  ).rows[0].id as string;
  const collection = (await admin("get", `/affiliate/merchants/${fixture.merchantId}/collection`)).body;
  expect(
    (await admin("patch", `/affiliate/merchants/${fixture.merchantId}/collection`, { enabled: true, feePercent: "2", payoutBankAccountId: account, acknowledged: true, version: collection.version }))
      .status,
  ).toBe(200);
  const settings = (await admin("get", "/finance/einvoice-settings")).body;
  expect(
    (
      await admin("put", "/finance/einvoice-settings", {
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
        cashRegisterSeries: [],
        version: settings.version,
      })
    ).status,
  ).toBe(200);
  const mandate = await admin("put", `/affiliate/merchants/${fixture.merchantId}/einvoice-mandate`, {
    sellerName: "Hộ kinh doanh Cà phê Hạt Nâu",
    taxCode: "0311111119",
    address: "12 Lê Lợi, Quận 1",
    taxMethod: "deduction",
    defaultVatRate: "8",
    mandateNo: "UN-01",
    effectiveFrom: `${year}-01-01`,
    expiresOn: null,
    series: [{ year, series: `C${String(year).slice(2)}THN` }],
    version: 0,
  });
  expect(mandate.status, JSON.stringify(mandate.body)).toBe(200);
  hoa = await fixture.register("0938750003", "Phạm Thị Hoa");
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Hủy giao dịch đã thu hộ (QUYTAC_NGHIEPVU_583)", () => {
  it("chưa vào bảng chuyển tiền: hoàn tiền khách, Nợ 331 / Có 3388; hóa đơn ủy nhiệm đã phát hành thành việc chờ điều chỉnh; giao dịch rời khỏi bảng", async () => {
    saleA = await sale(108000);
    await application.get(EinvoicesService).sendDue();
    // Thu ngân không hủy được; chủ cửa hàng hủy toàn bộ.
    expect((await portal(fixture.cashier, "post", `/transactions/${saleA.transactionId}/cancel`, { reason: "Khách đổi ý" })).status).toBe(403);
    const cancelled = await portal(fixture.owner, "post", `/transactions/${saleA.transactionId}/cancel`, { reason: "Khách đổi ý" });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect(cancelled.body.status).toBe("cancelled");
    expect((await pool.query("SELECT status, reversal_amount::text FROM instore.checkouts WHERE id = $1", [saleA.checkoutId])).rows[0]).toEqual({
      status: "refunded",
      reversal_amount: "0.0000",
    });
    expect((await pool.query("SELECT reason, amount::text, status FROM marketplace.refunds WHERE checkout_id = $1", [saleA.checkoutId])).rows).toEqual([
      { reason: "transaction_cancelled", amount: "108000.0000", status: "pending" },
    ]);
    expect(await journal("instore_checkout_cancel", saleA.checkoutId)).toEqual([
      ["331", 108000, 0],
      ["3388", 0, 108000],
    ]);
    // Hóa đơn ủy nhiệm đã phát hành: việc chờ ở thẻ Chờ xử lý; lập hóa đơn điều chỉnh giảm toàn bộ.
    const tasks = (await admin("get", "/finance/einvoice-returns")).body as { id: string; affiliateTransactionId: string; returnAmount: string; canResolve: boolean; version: number }[];
    const task = tasks.find((item) => item.affiliateTransactionId === saleA.transactionId)!;
    expect(task).toMatchObject({ returnAmount: "108000", canResolve: true });
    const adjusted = await admin("post", `/finance/einvoice-returns/${task.id}/adjust`, { version: task.version });
    expect(adjusted.status, JSON.stringify(adjusted.body)).toBe(201);
    expect(adjusted.body).toMatchObject({ kind: "adjustment", status: "issued", series: `C${String(year).slice(2)}THN`, totalAmount: "-108000", mandated: true });
  });

  it("đã vào bảng đã lập: ghi ngược phí, L = G − H − I − K trừ ở bảng tiếp theo; hóa đơn chưa phát hành thì Đã hủy", async () => {
    // Hóa đơn của giao dịch này chưa gửi (không chạy việc nền gửi).
    saleB = await sale(200000);
    const payouts = application.get(InstorePayoutsService);
    firstPayout = (await payouts.generateDaily(fixture.today))[0]!;
    const detail = (await fixture.call("get", `/finance/instore/payouts/${firstPayout}`)).body;
    // H 2 % = 4.000; I 10 % = 400; K 0,9 % + 1.100 = 2.900; chuyển 192.700.
    expect(detail).toMatchObject({ collectedAmount: "200000", platformFee: "4000", platformFeeTax: "400", gatewayFee: "2900", amount: "192700" });
    const cancelled = await portal(fixture.owner, "post", `/transactions/${saleB.transactionId}/cancel`, { reason: "Trả lại toàn bộ" });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect((await pool.query("SELECT reversal_amount::text, reversal_fee::text, reversal_fee_tax::text FROM instore.checkouts WHERE id = $1", [saleB.checkoutId])).rows[0]).toEqual({
      reversal_amount: "192700.0000",
      reversal_fee: "4000.0000",
      reversal_fee_tax: "400.0000",
    });
    expect(await journal("instore_checkout_cancel", saleB.checkoutId)).toEqual([
      ["331", 200000, 0],
      ["511", 4000, 0],
      ["6418", 2900, 0],
      ["33311", 400, 0],
      ["331", 0, 7300],
      ["3388", 0, 200000],
    ]);
    expect((await pool.query("SELECT status FROM finance.einvoices WHERE affiliate_transaction_id = $1", [saleB.transactionId])).rows).toEqual([{ status: "cancelled" }]);
    expect((await pool.query("SELECT 1 FROM finance.einvoice_return_tasks WHERE affiliate_transaction_id = $1", [saleB.transactionId])).rows).toHaveLength(0);
    // Bảng tiếp theo: L 192.700, tiền chuyển 0, số âm mang sang.
    const [second] = await payouts.generateDaily(nextDay(fixture.today));
    const next = (await fixture.call("get", `/finance/instore/payouts/${second}`)).body;
    expect(next).toMatchObject({ reversalAmount: "192700", amount: "0", collectedAmount: "0" });
    expect((await pool.query("SELECT reversal_payout_id FROM instore.checkouts WHERE id = $1", [saleB.checkoutId])).rows[0].reversal_payout_id).toBe(second);
    // Không trừ lần hai.
    expect(await payouts.generateDaily(nextDay(fixture.today, 2))).toHaveLength(1);
    expect(Number((await pool.query("SELECT reversal_amount FROM instore.payouts WHERE business_date = $1", [nextDay(fixture.today, 2)])).rows[0].reversal_amount)).toBe(0);
  });

  it("hóa đơn phí sàn tháng trừ phần ghi ngược: còn 0 thì không lập", async () => {
    const month = `${fixture.today.slice(0, 7)}-01`;
    // Bảng tháng này: H 4.000 (giao dịch B), ghi ngược 4.000 ở bảng sau (nếu cùng tháng); khác tháng thì bảng sau không thuộc tháng này.
    const sameMonth = nextDay(fixture.today).slice(0, 7) === fixture.today.slice(0, 7);
    const created = await application.get(InstoreEinvoicesService).generateMonthlyFeeInvoices(month);
    expect(created).toHaveLength(sameMonth ? 0 : 1);
  });
});

describe("Hoàn tiền đơn tại cửa hàng ở MAN_HINH_98", () => {
  it("việc chờ hoàn của đơn TT… hiện ở danh sách; ghi đã hoàn: Nợ 3388 / Có 112, báo khách", async () => {
    const list = (await admin("get", "/marketplace/refunds?status=pending")).body as { data: { id: string; checkoutId: string | null; documentNo: string; placeName: string | null; reason: string }[] };
    const item = list.data.find((row) => row.checkoutId === saleA.checkoutId)!;
    expect(item).toMatchObject({ reason: "transaction_cancelled", documentNo: expect.stringMatching(/^TT/), placeName: "Cà phê Hạt Nâu" });
    const refund = (await pool.query("SELECT version FROM marketplace.refunds WHERE id = $1", [item.id])).rows[0];
    const done = await admin("post", `/marketplace/refunds/${item.id}/complete`, { bankTransactionNo: "FT2632100001", refundedOn: fixture.today, note: null, version: refund.version });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "completed", checkoutId: saleA.checkoutId, orderId: null });
    expect(await journal("instore_refund", item.id)).toEqual([
      ["3388", 108000, 0],
      ["112", 0, 108000],
    ]);
    const notified = await pool.query("SELECT 1 FROM core.notifications WHERE user_id = $1 AND kind = 'instore.refund_completed'", [hoa.id]);
    expect(notified.rows).toHaveLength(1);
  });
});
