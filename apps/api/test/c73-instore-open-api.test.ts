// CONG_VIEC_73 lát L7: Open API đơn chờ thanh toán (QUYTAC_NGHIEPVU_590; API_330) và webhook (QUYTAC_NGHIEPVU_591; API_331).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateWebhooksService, webhookRetryMinutes, webhookSignature } from "../src/affiliate/webhooks.service";
import { signedQuery } from "../src/marketplace/payments/vnpay";
import { prepareAffiliate, operator, type AffiliateFixture } from "./c55-fixture";
import type { BuyerCall } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

const secret = "BIMATKIEMTHU0123456789";
const tmnCode = "VCOMMTST";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let hoa: { id: string; call: BuyerCall; phone: string };
let keyId: string;
let apiKey: string;
let webhookSecret: string;
let ipnNo = 14001200;
let respondWith = 200;
const received: { url: string; headers: Record<string, string>; body: string }[] = [];

const http = () => request(application.getHttpServer());
const admin = (method: "get" | "put" | "post" | "patch", path: string, body?: object) => fixture.admin.call(method, path, { companyId: operator, ...(body ? { body } : {}) });
const open = (method: "get" | "post", path: string, body?: object) => {
  const sent = http()[method](`/api/v1/open/instore${path}`).set("accept-language", "vi").set("authorization", `Bearer ${apiKey}`);
  return body ? sent.send(body) : sent;
};
const webhooks = () => application.get(AffiliateWebhooksService);
const events = () => received.map((item) => JSON.parse(item.body) as { type: string; data: { checkoutNo: string; status: string; refund: { status: string } } });

async function payQr(qrUrl: string, checkoutNo: string, amount: number): Promise<void> {
  const claimed = await hoa.call("post", "/buyer/instore/checkouts/claim", { token: qrUrl.split("/tt/")[1] });
  expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
  const paid = await hoa.call("post", `/buyer/instore/checkouts/${claimed.body.id}/pay`, { points: 0, method: "vnpay_qr" });
  expect(paid.status, JSON.stringify(paid.body)).toBe(200);
  ipnNo += 1;
  const parameters: Record<string, string> = {
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(amount * 100),
    vnp_TxnRef: new URL(paid.body.paymentUrl).searchParams.get("vnp_TxnRef")!,
    vnp_ResponseCode: "00",
    vnp_TransactionStatus: "00",
    vnp_TransactionNo: String(ipnNo),
    vnp_BankCode: "NCB",
    vnp_PayDate: "20261117103000",
    vnp_OrderInfo: checkoutNo,
  };
  const ipn = await http()
    .get("/api/v1/public/payments/vnpay/ipn")
    .query({ ...parameters, vnp_SecureHashType: "HmacSHA512", vnp_SecureHash: signedQuery(parameters, secret).hash });
  expect(ipn.body.RspCode).toBe("00");
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
  expect((await admin("put", "/marketplace/payment-methods/vnpay_qr", { isEnabled: true })).status).toBe(200);
  expect((await admin("put", "/finance/instore/gateway-fees", { rates: [{ method: "vnpay_qr", percent: "0.9", fixedAmount: "1100", effectiveFrom: fixture.today }] })).status).toBe(200);
  const partner = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [fixture.merchantId])).rows[0].partner_id as string;
  const account = (
    await pool.query("INSERT INTO crm.partner_bank_accounts (partner_id, bank_name, account_no, account_holder, is_default) VALUES ($1, 'Vietcombank', '0071009998111', 'HAT NAU', true) RETURNING id", [
      partner,
    ])
  ).rows[0].id as string;
  const collection = (await admin("get", `/affiliate/merchants/${fixture.merchantId}/collection`)).body;
  await admin("patch", `/affiliate/merchants/${fixture.merchantId}/collection`, { enabled: true, feePercent: "2", payoutBankAccountId: account, acknowledged: true, version: collection.version });
  hoa = await fixture.register("0938760003", "Phạm Thị Hoa");
  // Máy nhận webhook giả.
  webhooks().transport = async (url, init) => {
    received.push({ url, headers: init.headers, body: init.body });
    return { status: respondWith };
  };
});

afterAll(async () => {
  for (const name of ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL", "VNPAY_PAYMENT_URL"]) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("Phạm vi instore.checkout và webhook của khóa (API_331)", () => {
  it("khóa chưa có phạm vi bị từ chối; gán phạm vi; cài địa chỉ HTTPS, cấp khóa ký hiện một lần, gửi thử có chữ ký", async () => {
    const created = await admin("post", `/affiliate/merchants/${fixture.merchantId}/api-keys`, { name: "Hạt Nâu · iPOS", outletIds: [fixture.outletA] });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    keyId = created.body.key.id;
    apiKey = created.body.secret;
    expect(created.body.key).toMatchObject({ instoreCheckout: false, webhook: { url: null, secretSet: false } });
    expect((await open("get", "/checkouts")).body.error.code).toBe("SCOPE_NOT_GRANTED");
    const updated = await admin("put", `/affiliate/api-keys/${keyId}`, { name: "Hạt Nâu · iPOS", outletIds: [fixture.outletA], instoreCheckout: true, version: created.body.key.version });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.instoreCheckout).toBe(true);
    expect((await pool.query("SELECT scopes FROM core.api_keys WHERE id = $1", [keyId])).rows[0].scopes).toEqual(["loyalty.member", "instore.checkout"]);

    expect((await admin("put", `/affiliate/api-keys/${keyId}/webhook`, { url: "http://pos.example.vn/hook", version: 0 })).status).toBe(400);
    const configured = await admin("put", `/affiliate/api-keys/${keyId}/webhook`, { url: "https://pos.example.vn/hook", version: 0 });
    expect(configured.status, JSON.stringify(configured.body)).toBe(200);
    const rotated = await admin("post", `/affiliate/api-keys/${keyId}/webhook/rotate-secret`);
    expect(rotated.status).toBe(200);
    webhookSecret = rotated.body.secret;
    expect(webhookSecret).toMatch(/^whsec_[A-Za-z0-9_-]{43}$/);
    const listed = await admin("get", `/affiliate/merchants/${fixture.merchantId}/api-keys`);
    expect(JSON.stringify(listed.body)).not.toContain(webhookSecret);
    expect(listed.body[0].webhook).toMatchObject({ url: "https://pos.example.vn/hook", secretSet: true });
    const audit = await pool.query("SELECT action, after_data::text FROM core.audit_events WHERE entity_id = $1 AND action LIKE 'affiliate_api_key.webhook%' ORDER BY occurred_at", [keyId]);
    expect(audit.rows.map((row) => row.action)).toEqual(["affiliate_api_key.webhook", "affiliate_api_key.webhook_secret"]);
    expect(audit.rows.some((row) => row.after_data.includes(webhookSecret))).toBe(false);

    const tested = await admin("post", `/affiliate/api-keys/${keyId}/webhook/test`);
    expect(tested.body).toMatchObject({ eventType: "webhook.test", status: "succeeded", attemptCount: 1, lastStatusCode: 200 });
    const sent = received.at(-1)!;
    expect(sent.url).toBe("https://pos.example.vn/hook");
    expect(sent.headers["x-vcomm-signature"]).toBe(webhookSignature(webhookSecret, sent.headers["x-vcomm-timestamp"]!, sent.body));
    expect(sent.headers["x-vcomm-event-id"]).toBe(tested.body.eventId);
    // Chủ cửa hàng xem nhật ký gửi; thu ngân không xem được.
    expect((await fixture.owner.call("get", `/merchant-portal/api-keys/${keyId}/webhook/deliveries`)).body).toHaveLength(1);
    expect((await fixture.cashier.call("get", `/merchant-portal/api-keys/${keyId}/webhook/deliveries`)).status).toBe(403);
  });
});

describe("Đơn chờ qua Open API (API_330)", () => {
  let checkoutNo: string;

  it("tạo đơn luồng 2 (đường dẫn QR), gửi lại cùng mã trả đơn cũ; tra theo mã đơn, số TT…; khách trả; webhook checkout.completed", async () => {
    const body = { partnerCheckoutCode: "IPOS-0001", outletId: fixture.outletA, billAmount: "150000", lines: [{ name: "Cà phê sữa", unit: "Ly", quantity: "3", unitPrice: "50000", amount: "150000", vatRate: "8" }] };
    const created = await open("post", "/checkouts", body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ partnerCheckoutCode: "IPOS-0001", status: "awaiting_buyer", collectInApp: true, qrUrl: expect.stringContaining("/tt/"), refund: { status: "none" } });
    checkoutNo = created.body.checkoutNo;
    const again = await open("post", "/checkouts", body);
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ checkoutNo, qrUrl: null });
    expect((await open("get", `/checkouts/${checkoutNo}`)).body.partnerCheckoutCode).toBe("IPOS-0001");
    // Đơn chưa thanh toán không hoàn tiền được.
    expect((await open("post", "/checkouts/IPOS-0001/refund", { reason: "Thử" })).body.error.message).toBe("Đơn chưa thanh toán xong: dùng hủy đơn (cancel).");
    await payQr(created.body.qrUrl, checkoutNo, 150000);
    const detail = (await open("get", "/checkouts/IPOS-0001")).body;
    expect(detail).toMatchObject({ status: "completed", transactionNo: expect.stringMatching(/^LK/), collectedAmount: "150000", platformFee: "3000", gatewayFee: "2450" });
    await webhooks().deliverDue();
    expect(events().find((event) => event.type === "checkout.completed")?.data).toMatchObject({ checkoutNo, status: "completed" });
    const list = (await open("get", "/checkouts?status=completed")).body;
    expect(list.data.map((item: { checkoutNo: string }) => item.checkoutNo)).toEqual([checkoutNo]);
  });

  it("hủy đơn chưa thanh toán; đơn đã thanh toán thì phải dùng refund", async () => {
    const created = await open("post", "/checkouts", { partnerCheckoutCode: "IPOS-0002", outletId: fixture.outletA, billAmount: "54000" });
    expect(created.status).toBe(201);
    const cancelled = await open("post", "/checkouts/IPOS-0002/cancel", { reason: "Khách đi" });
    expect(cancelled.body).toMatchObject({ status: "cancelled", cancelReason: "Khách đi" });
    expect((await open("post", "/checkouts/IPOS-0001/cancel", { reason: "Thử" })).body.error.message).toBe("Đơn đã thanh toán: dùng hủy và hoàn tiền (refund).");
    await webhooks().deliverDue();
    expect(events().some((event) => event.type === "checkout.cancelled" && event.data.checkoutNo === created.body.checkoutNo)).toBe(true);
  });

  it("hủy đơn đã thanh toán và hoàn tiền: gọi lại trả kết quả cũ; kế toán ghi đã hoàn thì webhook refund.completed", async () => {
    const refunded = await open("post", "/checkouts/IPOS-0001/refund", { reason: "Trả lại toàn bộ" });
    expect(refunded.status, JSON.stringify(refunded.body)).toBe(200);
    expect(refunded.body).toMatchObject({ status: "refunded", refund: { status: "pending", amount: "150000" } });
    expect((await open("post", "/checkouts/IPOS-0001/refund", { reason: "Trả lại toàn bộ" })).body).toMatchObject({ status: "refunded" });
    const cancelledBy = (await pool.query("SELECT cancelled_api_key_id FROM affiliate.transactions WHERE document_no = $1", [refunded.body.transactionNo])).rows[0];
    expect(cancelledBy.cancelled_api_key_id).toBe(keyId);
    await webhooks().deliverDue();
    expect(events().find((event) => event.type === "transaction.cancelled")?.data).toMatchObject({ status: "refunded", refund: { status: "pending" } });
    const refund = (await pool.query("SELECT f.id, f.version FROM marketplace.refunds f JOIN instore.checkouts c ON c.id = f.checkout_id WHERE c.document_no = $1", [refunded.body.checkoutNo])).rows[0];
    const done = await admin("post", `/marketplace/refunds/${refund.id}/complete`, { bankTransactionNo: "FT2632100099", refundedOn: fixture.today, note: null, version: refund.version });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    await webhooks().deliverDue();
    expect(events().find((event) => event.type === "refund.completed")?.data).toMatchObject({ refund: { status: "completed", refundedOn: fixture.today } });
    expect((await open("get", "/checkouts/IPOS-0001")).body.refund).toEqual({ status: "completed", amount: "150000", refundedOn: fixture.today });
  });

  it("máy nhận lỗi: thử lại theo lịch 1, 5, 30 phút, 2, 6, 24 giờ rồi dừng; gửi lại bằng tay", async () => {
    respondWith = 500;
    const tested = await admin("post", `/affiliate/api-keys/${keyId}/webhook/test`);
    expect(tested.body).toMatchObject({ status: "pending", attemptCount: 1, lastStatusCode: 500, lastError: "HTTP 500" });
    for (let attempt = 2; attempt <= webhookRetryMinutes.length + 1; attempt++) {
      await pool.query("UPDATE affiliate.webhook_deliveries SET next_attempt_at = now() - interval '1 second' WHERE id = $1", [tested.body.id]);
      await webhooks().deliverDue();
    }
    const stopped = (await pool.query("SELECT status, attempt_count FROM affiliate.webhook_deliveries WHERE id = $1", [tested.body.id])).rows[0];
    expect(stopped).toEqual({ status: "failed", attempt_count: webhookRetryMinutes.length + 1 });
    respondWith = 204;
    const resent = await fixture.owner.call("post", `/merchant-portal/webhook-deliveries/${tested.body.id}/resend`);
    expect(resent.body).toMatchObject({ status: "succeeded", attemptCount: 1, lastStatusCode: 204 });
  });
});
