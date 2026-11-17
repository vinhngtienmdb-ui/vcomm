// CONG_VIEC_73 lát L4: thu hộ qua ứng dụng VComm tại cửa hàng liên kết (QUYTAC_NGHIEPVU_573, 575 đến 578, 581, 584, 586;
// TIEUCHI_NGHIEMTHU_550, 551; KICHBAN_KIEMTHU_753, 756, 757).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { merchantExposure } from "../src/affiliate/transactions.service";
import { OutboxService } from "../src/common/outbox.service";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { InstoreCheckoutsService } from "../src/instore/checkouts.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareAffiliate, operator, type AffiliateFixture } from "./c55-fixture";
import { signIn, type Session } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication, testClock } from "./setup-database";

const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let minh: { id: string; call: BuyerCall; phone: string; secret: string; prefix: string };
let hoa: { id: string; call: BuyerCall; phone: string };
let voucherCodeId: string;
let bankAccountId: string;

const http = () => request(application.getHttpServer());
const totp = (base32: string, offsetSteps = 0) => new TOTP({ secret: Secret.fromBase32(base32), digits: 6, period: 30 }).generate({ timestamp: Date.now() + offsetSteps * 30_000 });
const balance = async (userId: string) => Number((await pool.query("SELECT balance FROM loyalty.accounts WHERE user_id = $1", [userId])).rows[0]?.balance ?? 0);
const portal = (session: Session, method: "get" | "post", path: string, body?: object) => session.call(method, `/merchant-portal${path}`, body ? { body } : {});
const newCheckout = (session: Session, body: object) =>
  portal(session, "post", "/checkouts", { clientKey: randomUUID(), outletId: fixture.outletA, billAmount: "450000", collectInApp: true, ...body });

function vnpayQuery(reference: string, amount: number): Record<string, string> {
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000099",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  return { ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash };
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

  // Khách có Smart OTP (dùng mã thanh toán) và khách chưa kích hoạt.
  const registered = await fixture.register("0938730001", "Trần Văn Minh");
  expect((await registered.call("post", "/buyer/loyalty/smart-otp/send-code")).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'smart_otp' AND consumed_at IS NULL", [
    createHash("sha256").update("246810").digest("hex"),
    "+84938730001",
  ]);
  const activated = await registered.call("post", "/buyer/loyalty/smart-otp/activate", { code: "246810", deviceName: "iPhone", platform: "ios" });
  expect(activated.status, JSON.stringify(activated.body)).toBe(201);
  await pool.query("UPDATE core.account_security SET redeem_locked_until = NULL WHERE user_id = $1", [registered.id]);
  const prefix = (await registered.call("post", "/buyer/instore/pay-code")).body.prefix as string;
  minh = { ...registered, secret: activated.body.secret, prefix };
  hoa = await fixture.register("0938730002", "Phạm Thị Hoa");
  await fixture.grantPoints(minh.id, 300);
  await fixture.grantPoints(hoa.id, 300);

  // Voucher miễn phí của cửa hàng: giảm 10 %, tối đa 30.000 đồng, hóa đơn từ 100.000 đồng (duyệt qua quy trình phê duyệt).
  const policy = await fixture.call("post", "/approval-policies", {
    documentTypeCode: "affiliate.voucher",
    currency: "VND",
    effectiveFrom: "2026-01-01",
    levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
  });
  expect(policy.status, JSON.stringify(policy.body)).toBe(201);
  const created = await fixture.owner.call("post", "/merchant-portal/vouchers", {
    body: {
      issuer: "merchant_free",
      titleVi: "Giảm 10 % đồ uống",
      titleEn: "10% off drinks",
      discountKind: "percent",
      discountValue: "10",
      maxDiscount: "30000",
      minBill: "100000",
      totalQuantity: 5,
      perBuyerLimit: 1,
      claimFrom: fixture.today,
      claimTo: fixture.today,
      validDays: 30,
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const sent = await fixture.owner.call("post", `/merchant-portal/vouchers/${created.body.id}/submit`, { body: { version: 1 } });
  const approver = await signIn(application, "phuc.le@vcomm.test");
  expect((await approver.call("post", `/approval-requests/${sent.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } })).status).toBe(200);
  await application.get(OutboxService).dispatchPending();
  const claimed = await minh.call("post", `/buyer/affiliate/vouchers/${created.body.id}/claim`, {});
  expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
  voucherCodeId = claimed.body.id;
  const partner = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [fixture.merchantId])).rows[0].partner_id as string;
  bankAccountId = (
    await pool.query("INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, is_default) VALUES ($1, 'Vietcombank', '0071001234567', 'HO KINH DOANH HAT NAU', true) RETURNING id", [
      partner,
    ])
  ).rows[0].id;
});

afterAll(async () => {
  testClock.fixed = null;
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Cài đặt thu hộ và biểu phí cổng (QUYTAC_NGHIEPVU_573, 584; MAN_HINH_279, 280)", () => {
  it("chưa bật thu hộ thì không tạo đơn thu hộ; bật cần tài khoản nhận tiền và xác nhận cảnh báo lần đầu", async () => {
    expect((await newCheckout(fixture.cashier, {})).body.error.message).toBe('Cửa hàng chưa bật thu hộ qua ứng dụng VComm. Chọn "Khách trả tại quầy".');
    const current = await fixture.call("get", `/affiliate/merchants/${fixture.merchantId}/collection`);
    expect(current.body).toMatchObject({ enabled: false, feePercent: "0", payoutBankAccountId: null, canManage: true });
    expect(current.body.bankAccounts).toEqual([{ id: bankAccountId, bankName: "Vietcombank", accountNo: "0071001234567", accountHolder: "HO KINH DOANH HAT NAU" }]);
    const patch = (body: object) => fixture.admin.call("patch", `/affiliate/merchants/${fixture.merchantId}/collection`, { companyId: operator, body });
    expect((await patch({ enabled: true, feePercent: "1.5", payoutBankAccountId: null, version: current.body.version })).status).toBe(400);
    const unconfirmed = await patch({ enabled: true, feePercent: "1.5", payoutBankAccountId: bankAccountId, version: current.body.version });
    expect(unconfirmed.body.error.message).toContain("trung gian thanh toán");
    const saved = await patch({ enabled: true, feePercent: "1.5", payoutBankAccountId: bankAccountId, acknowledged: true, version: current.body.version });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({ enabled: true, feePercent: "1.5", payoutBankAccountId: bankAccountId, acknowledgedAt: expect.any(String) });
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE entity_id = $1 AND action = 'affiliate_merchant.collection'", [fixture.merchantId]);
    expect(audit.rows).toHaveLength(1);
  });

  it("biểu phí cổng: thêm mức áp dụng từ hôm nay; ngày đã qua bị từ chối", async () => {
    const put = (rates: object[]) => fixture.admin.call("put", "/finance/instore/gateway-fees", { companyId: operator, body: { rates } });
    expect((await put([{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: "2026-01-01" }])).status).toBe(400);
    const saved = await put([{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: fixture.today }]);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.rows).toContainEqual({ method: "vnpay_qr", gatewayCode: "vnpay", percent: "0.9", fixedAmount: "1100", effectiveFrom: fixture.today, scheduled: null });
    expect((await fixture.cashier.call("get", "/finance/instore/gateway-fees")).status).toBe(403);
  });
});

describe("Đơn chờ ở cổng cửa hàng liên kết (KICHBAN_KIEMTHU_756, 757)", () => {
  it("luồng 1 thu hộ: quét mã thanh toán, khách dùng voucher và điểm, trả qua VNPAY; ghi LK… kèm tiền thu hộ, phí", async () => {
    const created = await newCheckout(fixture.cashier, { payCode: minh.prefix + totp(minh.secret) });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "awaiting_buyer", collectInApp: true, buyer: { maskedName: expect.any(String) }, qrUrl: null });
    const view = (await minh.call("get", `/buyer/instore/checkouts/${created.body.id}`)).body;
    expect(view.vouchers).toEqual([expect.objectContaining({ codeId: voucherCodeId, discount: "30000", maxPoints: 210 })]);
    expect(view.loyalty).toMatchObject({ balance: 300, minPoints: 10, maxPoints: 225 });
    const before = await balance(minh.id);
    const paid = await minh.call("post", `/buyer/instore/checkouts/${created.body.id}/pay`, { points: 100, voucherCodeId, method: "vnpay_qr" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(paid.body.checkout).toMatchObject({ status: "awaiting_payment", points: 100, pointsAmount: "100000.0000", voucherAmount: "30000.0000", amountDue: "320000.0000" });
    expect(await balance(minh.id)).toBe(before - 100);
    expect((await pool.query("SELECT status FROM affiliate.voucher_codes WHERE id = $1", [voucherCodeId])).rows[0].status).toBe("used");
    const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    expect((await http().get("/api/v1/public/payments/vnpay/ipn").query(vnpayQuery(reference, 320000))).body.RspCode).toBe("00");
    const result = (await portal(fixture.cashier, "get", `/checkouts/${created.body.id}`)).body;
    // Phí thu hộ 1,5 % = 4.800 và thuế 10 % = 480; phí cổng 0,9 % + 1.100 = 3.980; VComm chuyển 310.740.
    expect(result).toMatchObject({
      status: "completed",
      transactionNo: expect.stringMatching(/^LK/),
      collectedAmount: "320000",
      collectionFee: "4800",
      collectionFeeTax: "480",
      gatewayFee: "3980",
      payoutAmount: "310740",
      feePercent: "1.5000",
    });
    const transaction = (
      await pool.query(
        "SELECT status, source, method, redeemed_points, voucher_discount::text, paid_amount::text, collected_amount::text, platform_fee::text, gateway_fee::text, earned_points FROM affiliate.transactions WHERE id = $1",
        [result.transactionId],
      )
    ).rows[0];
    expect(transaction).toMatchObject({
      status: "completed",
      source: "portal",
      method: "buyer_qr",
      redeemed_points: 100,
      voucher_discount: "30000.0000",
      paid_amount: "320000.0000",
      collected_amount: "320000.0000",
      platform_fee: "4800.0000",
      gateway_fee: "3980.0000",
    });
    expect(transaction.earned_points).toBeGreaterThan(0);
    expect((await minh.call("get", `/buyer/instore/checkouts/${created.body.id}`)).body.saleDocumentNo).toBe(result.transactionNo);
    // Tiền thu hộ chờ chuyển giảm dư nợ của cửa hàng (QUYTAC_NGHIEPVU_586).
    expect(await merchantExposure(application.get<Database>(DATABASE), fixture.merchantId)).toBe(0);
    // Giao dịch có tiền thu hộ không hủy riêng phần điểm.
    const cancel = await fixture.owner.call("post", `/merchant-portal/transactions/${result.transactionId}/cancel`, { body: { reason: "Khách đổi ý" } });
    expect(cancel.body.error.message).toContain("VComm thu hộ");
  });

  it("luồng 2 thu tại quầy: khách quét mã QR, xác nhận; hoàn tất ngay, cửa hàng thu phần còn lại", async () => {
    const created = await newCheckout(fixture.cashier, { collectInApp: false, billAmount: "200000" });
    expect(created.body.qrUrl).toMatch(/\/tt\/[A-Za-z0-9_-]{32}$/);
    const claimed = await hoa.call("post", "/buyer/instore/checkouts/claim", { token: created.body.qrUrl.split("/tt/")[1] });
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
    expect(claimed.body).toMatchObject({ collectInApp: false, vouchers: [] });
    const confirmed = await hoa.call("post", `/buyer/instore/checkouts/${created.body.id}/pay`, { points: 0 });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body).toMatchObject({ paymentUrl: null, checkout: { status: "completed", amountDue: "200000.0000", saleDocumentNo: expect.stringMatching(/^LK/) } });
    const result = (await portal(fixture.cashier, "get", `/checkouts/${created.body.id}`)).body;
    expect(result).toMatchObject({ status: "completed", collectedAmount: "0", payoutAmount: "0", amountDue: "200000.0000", transactionNo: expect.stringMatching(/^LK/) });
    const transaction = (await pool.query("SELECT method, collected_amount::text, paid_amount::text FROM affiliate.transactions WHERE id = $1", [result.transactionId])).rows[0];
    expect(transaction).toEqual({ method: "merchant_qr", collected_amount: "0.0000", paid_amount: "200000.0000" });
  });

  it("hết hạn sau khi khách bấm thanh toán: trả voucher, hoàn điểm, giao dịch LK… hết hạn", async () => {
    // Trả voucher đã dùng ở kiểm thử trước để dùng lại (giả lập khách còn voucher khác).
    await pool.query("UPDATE affiliate.voucher_codes SET status = 'unused', transaction_id = NULL WHERE id = $1", [voucherCodeId]);
    await pool.query("UPDATE affiliate.vouchers SET used_count = used_count - 1 WHERE id = (SELECT voucher_id FROM affiliate.voucher_codes WHERE id = $1)", [voucherCodeId]);
    const created = (await newCheckout(fixture.cashier, { payCode: minh.prefix + totp(minh.secret, 1) })).body;
    const before = await balance(minh.id);
    const paid = await minh.call("post", `/buyer/instore/checkouts/${created.id}/pay`, { points: 50, voucherCodeId, method: "vnpay_qr" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    expect(await balance(minh.id)).toBe(before - 50);
    const transactionId = (await pool.query("SELECT affiliate_transaction_id FROM instore.checkouts WHERE id = $1", [created.id])).rows[0].affiliate_transaction_id as string;
    testClock.fixed = new Date(Date.now() + 11 * 60_000);
    try {
      expect(await application.get(InstoreCheckoutsService).expireDue()).toBeGreaterThanOrEqual(1);
    } finally {
      testClock.fixed = null;
    }
    expect(await balance(minh.id)).toBe(before);
    expect((await pool.query("SELECT status FROM affiliate.voucher_codes WHERE id = $1", [voucherCodeId])).rows[0].status).toBe("unused");
    expect((await pool.query("SELECT status FROM affiliate.transactions WHERE id = $1", [transactionId])).rows[0].status).toBe("expired");
    expect((await portal(fixture.cashier, "get", `/checkouts/${created.id}`)).body.status).toBe("expired");
  });

  it("mỗi thu ngân tối đa ba đơn chờ; mã thanh toán sai thì không giữ đơn vừa tạo", async () => {
    const wrong = await newCheckout(fixture.cashier, { payCode: "000000000000123456" });
    expect(wrong.body.error.message).toBe("Mã thanh toán không đúng hoặc đã hết hạn. Nhờ khách mở lại Mã thanh toán trong ứng dụng VComm.");
    const ids: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const created = await newCheckout(fixture.cashier, {});
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      ids.push(created.body.id);
    }
    expect((await newCheckout(fixture.cashier, {})).body.error.message).toBe("Bạn đang có 3 đơn chờ khách thanh toán. Hủy bớt hoặc chờ đơn hoàn tất rồi tạo đơn mới.");
    for (const id of ids) expect((await portal(fixture.cashier, "post", `/checkouts/${id}/cancel`, { reason: "Dọn" })).body.status).toBe("cancelled");
    // Thu ngân điểm bán khác không xem được đơn; chủ cửa hàng xem được.
    expect((await portal(fixture.owner, "get", `/checkouts/${ids[0]}`)).status).toBe(200);
  });

  it("móc của phần mềm cửa hàng (iPOS) chạy trong giao dịch hoàn tất, ghi mã chứng từ vào đơn", async () => {
    const instore = application.get(InstoreCheckoutsService);
    const invoiceId = randomUUID();
    const calls: { documentNo: string; dueAtCounter: string; appAmount: string }[] = [];
    instore.registerCompletionHook("ipos", async (_transaction, _row, result) => {
      calls.push({ documentNo: result.documentNo, dueAtCounter: result.dueAtCounter, appAmount: result.appAmount });
      return invoiceId;
    });
    const cashierId = (await pool.query("SELECT user_id FROM affiliate.members WHERE phone = '+84912333444'")).rows[0].user_id as string;
    const created = await application.get<Database>(DATABASE).transaction((transaction) =>
      instore.create(transaction, {
        operatorCompanyId: operator,
        place: { kind: "affiliate", merchantId: fixture.merchantId, outletId: fixture.outletA },
        creator: { source: "ipos", userId: cashierId },
        idempotencyKey: randomUUID(),
        billAmount: "150000",
        lines: [{ name: "Cà phê sữa", unit: "Ly", quantity: "3", unitPrice: "50000", amount: "150000", gift: false }],
        collectInApp: false,
      }),
    );
    await hoa.call("post", "/buyer/instore/checkouts/claim", { token: created.qrToken });
    const confirmed = await hoa.call("post", `/buyer/instore/checkouts/${created.checkout.id}/pay`, { points: 0 });
    expect(confirmed.body.checkout.status).toBe("completed");
    expect(calls).toEqual([{ documentNo: expect.stringMatching(/^LK/), dueAtCounter: "150000", appAmount: "0" }]);
    const row = (await pool.query("SELECT c.ipos_invoice_id, t.source FROM instore.checkouts c JOIN affiliate.transactions t ON t.id = c.affiliate_transaction_id WHERE c.id = $1", [created.checkout.id]))
      .rows[0];
    expect(row).toEqual({ ipos_invoice_id: invoiceId, source: "ipos" });
  });
});
