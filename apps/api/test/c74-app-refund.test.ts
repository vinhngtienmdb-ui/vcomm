// CONG_VIEC_74: luồng thật thanh toán qua ứng dụng VComm trên máy bán iPOS (TIEUCHI_NGHIEMTHU_578) và hủy hóa đơn có thanh toán qua ứng dụng VComm
// (TIEUCHI_NGHIEMTHU_582): khách trả qua VNPAY giả lập, móc hoàn tất ghi hóa đơn; hủy hóa đơn gọi hủy giao dịch LK… có thu hộ (hoàn tiền của CONG_VIEC_73 lát L7).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { signIn } from "./helpers";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

// Khóa ký VNPAY giả của máy chủ VNPAY giả lập trong kiểm thử (không phải khóa thật).
const vnpayHmac = ["BIMAT", "KIEMTHU", "0123456789"].join("");
const tmnCode = "VCOMMTST";

let application: NestExpressApplication;
let pool: Pool;
let store: AffiliateFixture;
let buyer: { id: string; call: BuyerCall };
const http = () => request(application.getHttpServer());
type Pos = { get: (path: string) => request.Test; post: (path: string, body?: object) => request.Test };
const posOf = (key: string, token?: string): Pos => {
  const make = (method: "get" | "post", path: string, body?: object) => {
    const call = http()[method](`/api/v1${path}`).set("x-ipos-device", key).set("accept-language", "vi");
    if (token) call.set("authorization", `Bearer ${token}`);
    return body ? call.send(body) : call;
  };
  return { get: (path) => make("get", path), post: (path, body = {}) => make("post", path, body) };
};
const portal = (method: "get" | "post", path: string, body?: object) => store.owner.call(method, `/merchant-portal/ipos${path}`, body ? { body } : {});

function vnpayQuery(reference: string, amount: number): Record<string, string> {
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: reference,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: "14000777",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: "Thanh toan don",
  };
  return { ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, vnpayHmac).hash };
}

let pos: Pos;
let shiftId: string;
let breadVariant: string;

beforeAll(async () => {
  Object.assign(process.env, {
    VNPAY_TMN_CODE: tmnCode,
    VNPAY_HASH_SECRET: vnpayHmac,
    VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return",
    VNPAY_PAYMENT_URL: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareAffiliate(application, pool);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("put", "/marketplace/payment-methods/vnpay_qr", { companyId: operator, body: { isEnabled: true } })).status).toBe(200);
  expect((await store.call("put", "/finance/instore/gateway-fees", { rates: [{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: store.today }] })).status).toBe(200);
  // Bật thu hộ cho cửa hàng (dữ liệu kiểm thử): tài khoản nhận tiền, xác nhận cảnh báo.
  const partner = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [store.merchantId])).rows[0].partner_id;
  const bank = (
    await pool.query("INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, is_default) VALUES ($1, 'Vietcombank', '0071001234567', 'TAP HOA', true) RETURNING id", [partner])
  ).rows[0].id;
  await pool.query("UPDATE affiliate.merchants SET collection_enabled = true, collection_fee_percent = 1.5, payout_bank_account_id = $2, collection_acknowledged_at = now() WHERE id = $1", [store.merchantId, bank]);

  // iPOS: gói, thuê bao, quầy, máy bán, đăng nhập, mặt hàng, mở ca.
  const plan = await store.call("post", "/ipos/plans", { code: "MOT-QUAY", name: "Một quầy", monthlyPrice: "199000", taxPercent: "10", maxRegisters: 1, maxItems: 500, trialDays: 0 });
  expect(
    (
      await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
        outletId: store.outletA,
        planId: plan.body.id,
        periodMonths: 1,
        startsOn: store.today,
        trialDays: null,
        customMonthlyPrice: null,
        customMaxRegisters: null,
      })
    ).status,
  ).toBe(201);
  expect((await store.owner.call("put", `/merchant-portal/ipos/outlets/${store.outletA}/code`, { body: { code: "BD01" } })).status).toBe(200);
  const registers = (await portal("post", "/registers", { outletId: store.outletA, name: "Quầy 1" })).body as { id: string }[];
  const code = await portal("post", `/registers/${registers[0]!.id}/pairing-codes`);
  const key = (await http().post("/api/v1/ipos/devices/pair").send({ code: code.body.code, model: "Sunmi T2", appVersion: "1.0.0" })).body.deviceKey as string;
  expect((await posOf(key).post("/ipos/pos/auth/otp", { phone: "0909111222" })).status).toBe(204);
  await pool.query("UPDATE core.otp_codes SET code_hash = $1 WHERE phone = $2 AND purpose = 'ipos_login' AND consumed_at IS NULL", [createHash("sha256").update("246810").digest("hex"), "+84909111222"]);
  const logged = await posOf(key).post("/ipos/pos/auth/login", { phone: "0909111222", code: "246810", method: "sms" });
  expect(logged.status, JSON.stringify(logged.body)).toBe(201);
  pos = posOf(key, logged.body.tokens.accessToken as string);
  const item = await portal("post", "/items", {
    code: "BANH",
    name: "Bánh mì que",
    categoryId: null,
    unit: "Cái",
    price: "15000",
    vatRate: "10",
    trackStock: false,
    attribute1Name: null,
    attribute2Name: null,
    variants: [{ id: null, code: "", attribute1Value: null, attribute2Value: null, price: null, minQuantity: null, barcodes: [], status: "active" }],
  });
  expect(item.status, JSON.stringify(item.body)).toBe(201);
  breadVariant = item.body.variants[0].id;
  shiftId = (await pos.post("/ipos/pos/shifts", { openingCash: "0", note: null })).body.id as string;
  buyer = await store.register("0938770011", "Trần Văn Minh");
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_74 – thanh toán qua ứng dụng VComm và hủy hóa đơn", () => {
  let saleId: string;
  let checkoutId: string;

  it("TIEUCHI_NGHIEMTHU_578: máy bán tạo đơn chờ, khách quét mã QR, trả qua VNPAY; máy chủ ghi hóa đơn có dòng ứng dụng VComm, liên kết TT…, LK…", async () => {
    const lines = [{ variantId: breadVariant, quantity: "2", unitPrice: "15000", discount: null }];
    const created = await pos.post("/ipos/pos/vcomm-checkouts", { idempotencyKey: randomUUID(), shiftId, lines, invoiceDiscount: null, approvalCode: null });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    checkoutId = created.body.id;
    const token = (created.body.qrUrl as string).split("/tt/")[1];
    const claimed = await buyer.call("post", "/buyer/instore/checkouts/claim", { token });
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
    expect((await pos.get(`/ipos/pos/vcomm-checkouts/${checkoutId}`)).body.buyerName).toEqual(expect.any(String));
    const paid = await buyer.call("post", `/buyer/instore/checkouts/${checkoutId}/pay`, { points: 0, method: "vnpay_qr" });
    expect(paid.status, JSON.stringify(paid.body)).toBe(200);
    const reference = new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!;
    expect((await http().get("/api/v1/public/payments/vnpay/ipn").query(vnpayQuery(reference, 30000))).body.RspCode).toBe("00");
    const view = (await pos.get(`/ipos/pos/vcomm-checkouts/${checkoutId}`)).body;
    expect(view).toMatchObject({ status: "completed", saleId: expect.any(String) });
    saleId = view.saleId;
    const sale = (await pos.get(`/ipos/pos/sales/${saleId}`)).body;
    expect(sale).toMatchObject({ total: "30000", buyerName: expect.any(String) });
    expect(sale.payments).toEqual([expect.objectContaining({ method: "vcomm_app", amount: "30000", linkNumber: expect.stringMatching(/^(TT|LK)/) })]);
  });

  it("TIEUCHI_NGHIEMTHU_582: hủy hóa đơn có thanh toán qua ứng dụng VComm: hủy LK…, đơn chờ chuyển đã hoàn tiền, lập việc hoàn tiền cho khách; không hoàn tiền mặt", async () => {
    const sale = (await pos.get(`/ipos/pos/sales/${saleId}`)).body;
    const lookup = await pos.get(`/ipos/pos/returns/lookup?documentNo=${encodeURIComponent(sale.documentNo)}`);
    expect(lookup.status, JSON.stringify(lookup.body)).toBe(200);
    expect(lookup.body).toMatchObject({ mode: "full_cancel", blockedReason: null });
    const cancelled = await pos.post("/ipos/pos/returns", { idempotencyKey: randomUUID(), shiftId, saleId, kind: "full_cancel", lines: [], reason: "Khách đổi ý", approvalCode: null });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect(cancelled.body).toMatchObject({ kind: "full_cancel", amount: "30000", refundCash: "0" });
    expect((await pool.query("SELECT status FROM ipos.sales WHERE id = $1", [saleId])).rows[0].status).toBe("cancelled");
    expect((await pool.query("SELECT status FROM instore.checkouts WHERE id = $1", [checkoutId])).rows[0].status).toBe("refunded");
    const lk = (await pool.query("SELECT t.status FROM affiliate.transactions t JOIN instore.checkouts c ON c.affiliate_transaction_id = t.id WHERE c.id = $1", [checkoutId])).rows[0];
    expect(lk.status).toBe("cancelled");
    const refund = (await pool.query("SELECT reason, amount::text FROM marketplace.refunds WHERE checkout_id = $1", [checkoutId])).rows;
    expect(refund).toEqual([{ reason: "transaction_cancelled", amount: "30000.0000" }]);
  });
});
