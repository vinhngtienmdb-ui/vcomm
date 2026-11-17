// CONG_VIEC_73 lát L5: bảng chuyển tiền thu hộ ngày, hạch toán (QUYTAC_NGHIEPVU_584 đến 587; API_333).
// Cửa hàng liên kết bật thu hộ: tiền cổng về (Nợ 112 / Có 331), lập bảng ngày với thuế suất phí cài riêng, khoản trừ khác làm âm thì mang sang bảng sau,
// bút toán phí khi lập bảng, ghi đã chuyển lập phiếu chi trừ công nợ; cổng cửa hàng xem bảng; nhắc bảng quá hạn.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addWorkingDays, InstorePayoutsService } from "../src/instore/payouts.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareAffiliate, operator, type AffiliateFixture } from "./c55-fixture";
import { signIn } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication, testClock } from "./setup-database";

const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let minh: { id: string; call: BuyerCall; secret: string; prefix: string };
let bankFund: string;
let merchantPartner: string;

const http = () => request(application.getHttpServer());
const totp = (base32: string, offsetSteps = 0) => new TOTP({ secret: Secret.fromBase32(base32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
const dayAfter = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Bút toán theo nguồn: [mã tài khoản, Nợ, Có, có đối tác].
async function journal(sourceType: string, sourceId: string) {
  const rows = await pool.query<{ code: string; debit: string; credit: string; partner: boolean }>(
    `SELECT a.code, l.debit::text, l.credit::text, l.partner_id IS NOT NULL AS partner FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_type = $1 AND j.source_id = $2 ORDER BY l.debit DESC, a.code`,
    [sourceType, sourceId],
  );
  return rows.rows.map((row) => [row.code, Number(row.debit), Number(row.credit), row.partner]);
}

// Đơn thu hộ: thu ngân quét mã thanh toán, khách trả toàn bộ qua VNPAY.
async function paidCheckout(bill: string, step: number): Promise<string> {
  const created = await fixture.cashier.call("post", "/merchant-portal/checkouts", {
    body: { clientKey: randomUUID(), outletId: fixture.outletA, billAmount: bill, collectInApp: true, payCode: minh.prefix + totp(minh.secret, step) },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const paid = await minh.call("post", `/buyer/instore/checkouts/${created.body.id}/pay`, { points: 0, method: "vnpay_qr" });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(Number(bill) * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000111",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  const ipn = await http()
    .get("/api/v1/public/payments/vnpay/ipn")
    .query({ ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash });
  expect(ipn.body.RspCode).toBe("00");
  return created.body.id as string;
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
  expect((await fixture.call("post", "/finance/ledger/setup")).status).toBe(201);
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/payment-methods/vnpay_qr", { companyId: operator, body: { isEnabled: true } })).status).toBe(200);
  const fund = await fixture.call("post", "/finance/funds", { code: "NHCT", name: "Vietcombank nhận tiền cổng", kind: "bank", bankName: "Vietcombank", accountNo: "0011009988", accountHolder: "VComm" });
  expect(fund.status, JSON.stringify(fund.body)).toBe(201);
  bankFund = fund.body.id;
  merchantPartner = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [fixture.merchantId])).rows[0].partner_id;
  const account = (
    await pool.query("INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, is_default) VALUES ($1, 'Vietcombank', '0071001234567', 'HAT NAU', true) RETURNING id", [
      merchantPartner,
    ])
  ).rows[0].id;
  const collection = (await fixture.call("get", `/affiliate/merchants/${fixture.merchantId}/collection`)).body;
  expect(
    (
      await fixture.admin.call("patch", `/affiliate/merchants/${fixture.merchantId}/collection`, {
        companyId: operator,
        body: { enabled: true, feePercent: "1.5", payoutBankAccountId: account, acknowledged: true, version: collection.version },
      })
    ).status,
  ).toBe(200);
  await fixture.admin.call("put", "/finance/instore/gateway-fees", {
    companyId: operator,
    body: { rates: [{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: fixture.today }] },
  });
  const registered = await fixture.register("0938750001", "Trần Văn Minh");
  expect((await registered.call("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = '+84938750001' AND purpose = 'smart_otp' AND consumed_at IS NULL", [
    createHash("sha256").update("246810").digest("hex"),
  ]);
  const activated = await registered.call("post", "/buyer/loyalty/smart-otp/activate", { code: "246810", deviceName: "iPhone", platform: "ios" });
  expect(activated.status, JSON.stringify(activated.body)).toBe(201);
  minh = { ...registered, secret: activated.body.secret, prefix: (await registered.call("post", "/buyer/instore/pay-code")).body.prefix };
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Hạch toán và bảng chuyển tiền thu hộ (QUYTAC_NGHIEPVU_585, 587)", () => {
  it("thuế suất phí cài riêng; tiền cổng về ghi Nợ 112 / Có 331 cửa hàng", async () => {
    const settings = await fixture.call("get", "/finance/instore/settings");
    expect(settings.body).toMatchObject({ feeTaxRate: "10", version: 0, canManage: true });
    const saved = await fixture.admin.call("put", "/finance/instore/settings", { companyId: operator, body: { feeTaxRate: "8", version: 0 } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({ feeTaxRate: "8", version: 1 });
    const checkout = await paidCheckout("450000", 0);
    expect(await journal("instore_checkout", checkout)).toEqual([
      ["112", 450000, 0, false],
      ["331", 0, 450000, true],
    ]);
  });

  it("khoản trừ khác làm tiền chuyển âm: bảng ghi 0, số âm mang sang bảng sau; bút toán phí khi lập bảng", async () => {
    const service = application.get(InstorePayoutsService);
    await pool.query(
      "INSERT INTO instore.payout_deductions (recipient_kind, merchant_id, business_date, kind, amount, note) VALUES ('merchant', $1, $2, 'ipos_subscription', 500000, 'Phí thuê bao iPOS tháng 11')",
      [fixture.merchantId, fixture.today],
    );
    const first = await service.generateDaily(fixture.today);
    expect(first).toHaveLength(1);
    // Chạy lại không lập trùng.
    expect(await service.generateDaily(fixture.today)).toEqual([]);
    const list = (await fixture.call("get", "/finance/instore/payouts")).body;
    // G 450.000; H 1,5 % = 6.750; I 8 % = 540; K 0,9 % + 1.100 = 5.150; N 500.000 → âm 62.440, ghi 0.
    expect(list.data[0]).toMatchObject({
      recipientKind: "merchant",
      recipientName: "Cà phê Hạt Nâu",
      collectedAmount: "450000",
      platformFee: "6750",
      platformFeeTax: "540",
      gatewayFee: "5150",
      deductionAmount: "500000",
      carriedAmount: "0",
      amount: "0",
      feeTaxRate: "8",
      status: "transferred",
    });
    expect(await journal("instore_payout", first[0]!)).toEqual([
      ["331", 12440, 0, true],
      ["33311", 0, 540, false],
      ["511", 0, 6750, false],
      ["6418", 0, 5150, false],
    ]);
    const detail = (await fixture.call("get", `/finance/instore/payouts/${first[0]}`)).body;
    expect(detail.lines).toHaveLength(1);
    expect(detail.deductions).toEqual([expect.objectContaining({ kind: "ipos_subscription", amount: "500000" })]);

    // Ngày sau: thu hộ 200.000; mang sang −62.440.
    await paidCheckout("200000", 1);
    const second = await service.generateDaily(dayAfter(fixture.today, 1));
    expect(second).toHaveLength(1);
    const next = (await fixture.call("get", `/finance/instore/payouts/${second[0]}`)).body;
    // H 3.000; I 240; K 2.900; 200.000 − 3.000 − 240 − 2.900 − 62.440 = 131.420.
    expect(next).toMatchObject({ collectedAmount: "200000", platformFee: "3000", platformFeeTax: "240", gatewayFee: "2900", carriedAmount: "-62440", amount: "131420", status: "pending" });
    const debt = (await pool.query("SELECT side, open_amount::text, partner_id FROM finance.debt_items WHERE source_type = 'instore_payout' AND source_id = $1", [second[0]])).rows;
    expect(debt).toEqual([{ side: "payable", open_amount: "131420.0000", partner_id: merchantPartner }]);
  });

  it("ghi đã chuyển: phiếu chi ghi sổ ngay, Nợ 331 / Có 112, trừ công nợ; chỉ bảng chờ chuyển", async () => {
    const pending = (await fixture.call("get", "/finance/instore/payouts?status=pending")).body.data[0];
    const body = (overrides: object = {}) => ({ transferredOn: dayAfter(pending.businessDate, 1), bankTransactionNo: "FT2632104455", fundId: bankFund, version: pending.version, ...overrides });
    const early = await fixture.admin.call("post", `/finance/instore/payouts/${pending.id}/transferred`, { companyId: operator, body: body({ transferredOn: "2026-01-01" }) });
    expect(early.status).toBe(400);
    const done = await fixture.admin.call("post", `/finance/instore/payouts/${pending.id}/transferred`, { companyId: operator, body: body() });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "transferred", bankTransactionNo: "FT2632104455", paymentNo: expect.stringMatching(/^PC/), receiptDraft: false });
    const payment = (await pool.query("SELECT id, kind, status, amount::text FROM finance.payments WHERE instore_payout_id = $1", [pending.id])).rows[0];
    expect(payment).toMatchObject({ kind: "instore_payout_payment", status: "posted", amount: "131420.0000" });
    expect(await journal("payment", payment.id)).toEqual([
      ["331", 131420, 0, true],
      ["112", 0, 131420, false],
    ]);
    expect((await pool.query("SELECT open_amount::text FROM finance.debt_items WHERE source_type = 'instore_payout' AND source_id = $1", [pending.id])).rows[0].open_amount).toBe("0.0000");
    const again = await fixture.admin.call("post", `/finance/instore/payouts/${pending.id}/transferred`, { companyId: operator, body: body({ version: done.body.version }) });
    expect(again.body.error.message).toBe("Bảng chuyển tiền không ở trạng thái chờ chuyển.");
  });

  it("cổng cửa hàng: chủ cửa hàng xem bảng của cửa hàng, thu ngân không xem được", async () => {
    const owned = await fixture.owner.call("get", "/merchant-portal/payouts");
    expect(owned.status, JSON.stringify(owned.body)).toBe(200);
    expect(owned.body.data).toHaveLength(2);
    expect((await fixture.owner.call("get", `/merchant-portal/payouts/${owned.body.data[0].id}`)).body.lines).toHaveLength(1);
    expect((await fixture.cashier.call("get", "/merchant-portal/payouts")).status).toBe(403);
  });

  it("bảng chờ chuyển quá 2 ngày làm việc: đánh dấu quá hạn, nhắc kế toán công ty vận hành sàn", async () => {
    expect(addWorkingDays("2026-11-13", 2)).toBe("2026-11-17");
    // Bước mã chưa dùng: đặt đồng hồ sang 5 phút sau.
    testClock.fixed = new Date(Date.now() + 300_000);
    try {
      await paidCheckout("100000", 10);
    } finally {
      testClock.fixed = null;
    }
    const [id] = await application.get(InstorePayoutsService).generateDaily(dayAfter(fixture.today, 2));
    await pool.query("UPDATE instore.payouts SET business_date = '2026-01-05' WHERE id = $1", [id]);
    const list = (await fixture.call("get", "/finance/instore/payouts?status=pending")).body;
    expect(list.overdueCount).toBe(1);
    expect(list.data[0].overdue).toBe(true);
    expect(await application.get(InstorePayoutsService).remindOverdue()).toBeGreaterThan(0);
    const notified = await pool.query("SELECT count(*)::int AS count FROM core.notifications WHERE kind = 'instore.payout_overdue'");
    expect(notified.rows[0].count).toBeGreaterThan(0);
  });
});
