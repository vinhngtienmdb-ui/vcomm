// CONG_VIEC_34: cổng SePay (KICHBAN_KIEMTHU_383 đến 386). Webhook giả lập theo định dạng công khai của SePay, không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { referenceFromTransfer } from "../src/marketplace/payments/gateways/sepay-gateway";
import { MarketplacePaymentsService } from "../src/marketplace/payments/payments.service";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
// Khóa giả ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const webhookPass = ["kiem", "thu", "sepay", "0123456789"].join("-");
const environment = {
  SEPAY_WEBHOOK_API_KEY: webhookPass,
  SEPAY_BANK_CODE: "MBBank",
  SEPAY_BANK_NAME: "Ngân hàng Quân đội (MB)",
  SEPAY_ACCOUNT_NUMBER: "0123456789",
  SEPAY_ACCOUNT_NAME: "CONG TY VCOMM",
};
let transactionId = 92700;

// Thân webhook SePay (https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook).
function transfer(content: string, amount: number, extra: Record<string, unknown> = {}) {
  transactionId += 1;
  return {
    id: transactionId,
    gateway: "MBBank",
    transactionDate: "2026-11-11 10:15:00",
    accountNumber: "0123456789",
    code: null,
    content,
    transferType: "in",
    transferAmount: amount,
    accumulated: 50000000,
    subAccount: null,
    referenceCode: `FT${transactionId}`,
    description: "",
    ...extra,
  };
}
const webhook = (body: object, authorization = `Apikey ${webhookPass}`) =>
  request(application.getHttpServer()).post("/api/v1/public/payments/sepay/notify").set("Authorization", authorization).send(body);
const logged = async () => (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE gateway_code = 'sepay' ORDER BY received_at")).rows.map((row) => row.result_code);

async function placeAndStart(quantity = 1) {
  const lines = [{ variantId: store.variants.soap, quantity }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  expect(preview.body.paymentMethods).toContain("sepay_bank_transfer");
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "sepay_bank_transfer" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  return { order: placed.body as { id: string; total: string; documentNo: string }, started: started.body };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0934000001", "Người Mua SePay");
  buyer = await store.buyerSession("0934000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of Object.keys(environment)) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_34 cổng SePay", () => {
  it("KICHBAN_KIEMTHU_383: thiếu biến môi trường thì cổng chưa cấu hình, không bật được; đủ thì bật, người mua thấy và đặt được", async () => {
    const before = (await store.call("get", "/marketplace/store-settings")).body;
    expect(before.paymentMethods.find((item: { code: string }) => item.code === "sepay_bank_transfer")).toMatchObject({ gatewayCode: "sepay", isEnabled: false, isConfigured: false });
    expect((await store.call("put", "/marketplace/payment-methods/sepay_bank_transfer", { isEnabled: true })).status).toBe(409);
    Object.assign(process.env, environment, { SEPAY_ACCOUNT_NAME: " " });
    expect((await store.call("put", "/marketplace/payment-methods/sepay_bank_transfer", { isEnabled: true })).status).toBe(409);
    Object.assign(process.env, environment);
    expect((await store.call("put", "/marketplace/payment-methods/sepay_bank_transfer", { isEnabled: true })).status).toBe(200);
    const after = (await store.call("get", "/marketplace/store-settings")).body;
    expect(after.paymentMethods.find((item: { code: string }) => item.code === "sepay_bank_transfer")).toMatchObject({ isEnabled: true, isConfigured: true });
    const { order } = await placeAndStart();
    expect(order).toMatchObject({ paymentMethod: "sepay_bank_transfer", status: "awaiting_payment" });
  });

  it("KICHBAN_KIEMTHU_384: mở thanh toán trả hướng dẫn chuyển khoản, nội dung là số tham chiếu, ảnh mã QR VietQR của SePay", async () => {
    const { order, started } = await placeAndStart();
    const reference = `${order.documentNo.replace(/[^A-Za-z0-9]/g, "")}T01`;
    expect(started.paymentUrl).toBeNull();
    expect(started.transfer).toMatchObject({ bankName: "Ngân hàng Quân đội (MB)", accountNumber: "0123456789", accountName: "CONG TY VCOMM", amount: "74000", content: reference, qrData: null });
    const image = new URL(started.transfer.qrImageUrl);
    expect(image.origin + image.pathname).toBe("https://qr.sepay.vn/img");
    expect(Object.fromEntries(image.searchParams)).toEqual({ acc: "0123456789", bank: "MBBank", amount: "74000", des: reference });
  });

  it("KICHBAN_KIEMTHU_385: sai khóa, sai số tài khoản bị từ chối; sai số tiền, tiền ra, không có số tham chiếu không ghi nhận; nội dung bị ngân hàng chèn chữ vẫn ghi nhận một lần", async () => {
    await pool.query("DELETE FROM marketplace.payment_notifications WHERE gateway_code = 'sepay'");
    const { order, started } = await placeAndStart();
    const reference = started.transfer.content as string;
    const content = `MBVCB.1234.${reference.toLowerCase()}.CT tu 0123 NGUYEN VAN A`;
    expect((await webhook(transfer(content, 74000), "Apikey sai")).status).toBe(401);
    expect((await webhook(transfer(content, 74000), "")).status).toBe(401);
    expect((await webhook(transfer(content, 74000, { accountNumber: "9999999999" }))).status).toBe(401);
    expect((await webhook({ id: 1, content })).status).toBe(401);
    for (const body of [transfer(content, 70000), transfer(content, 74000, { transferType: "out" }), transfer("CHUYEN TIEN AN TRUA", 74000)]) {
      const response = await webhook(body);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    }
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body).toMatchObject({ status: "awaiting_payment", paidAmount: "0" });
    const paid = transfer(content, 74000);
    expect((await webhook(paid)).body).toEqual({ success: true });
    // SePay gửi lại cùng giao dịch: trả thành công, không ghi nhận thêm.
    expect((await webhook(paid)).body).toEqual({ success: true });
    const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: `SEPAY ${paid.referenceCode}` });
    expect(await logged()).toEqual(["invalid_signature", "invalid_signature", "invalid_signature", "invalid_signature", "invalid_amount", "not_found", "not_found", "success", "already_confirmed"]);
    const payment = (await pool.query("SELECT status, response_code, gateway_transaction_no FROM marketplace.payments WHERE reference = $1", [reference])).rows[0];
    expect(payment).toEqual({ status: "succeeded", response_code: "in", gateway_transaction_no: paid.referenceCode });
  });

  it("KICHBAN_KIEMTHU_386: mã thanh toán SePay tách sẵn được ưu tiên; tiền về sau khi đơn quá hạn tự hủy thì lập việc chờ hoàn", async () => {
    expect(referenceFromTransfer("DBHABC001T02", "DBHABC001T01")).toBe("DBHABC001T02");
    expect(referenceFromTransfer(null, "Thanh toan dbhabc001t01 cam on")).toBe("DBHABC001T01");
    expect(referenceFromTransfer(null, "TT01 T5")).toBe("");
    const { order, started } = await placeAndStart(2);
    await pool.query("UPDATE marketplace.orders SET payment_deadline = now() - interval '1 second' WHERE id = $1", [order.id]);
    expect(await application.get(MarketplacePaymentsService).expireDue()).toBeGreaterThanOrEqual(1);
    const response = await webhook(transfer("CK", Number(started.transfer.amount), { code: started.transfer.content }));
    expect(response.body).toEqual({ success: true });
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body).toMatchObject({ status: "cancelled", paymentStatus: "refund_pending" });
    expect((await pool.query("SELECT reason, amount::int FROM marketplace.refunds WHERE order_id = $1", [order.id])).rows).toEqual([
      { reason: "paid_after_cancel", amount: Number(started.transfer.amount) },
    ]);
  });
});
