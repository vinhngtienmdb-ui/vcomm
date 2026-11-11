// CONG_VIEC_40: cổng Google Pay qua trang thanh toán ZaloPay (KICHBAN_KIEMTHU_407 đến 410). Máy chủ ZaloPay giả lập theo đặc tả công khai, không gọi máy chủ thật.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { zalopaySignature } from "../src/marketplace/payments/gateways/google-pay-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let zalopay: Server;
// Giá trị ký giả, ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const requestSigning = ["kiem", "thu", "mot"].join("-");
const callbackSigning = ["kiem", "thu", "hai"].join("-");
const applicationId = "2553";
// Yêu cầu tạo đơn máy chủ giả lập đã nhận; failNext làm lần tạo đơn kế tiếp bị từ chối.
const received: Record<string, string>[] = [];
let failNext = false;

const environment = () => ({
  ZALOPAY_APP_ID: applicationId,
  ZALOPAY_KEY1: requestSigning,
  ZALOPAY_KEY2: callbackSigning,
  ZALOPAY_ENDPOINT: `http://127.0.0.1:${(zalopay.address() as AddressInfo).port}`,
  ZALOPAY_PUBLIC_API_URL: "https://api.vcomm.test/",
});

// Kết quả ZaloPay gửi về: data là chuỗi JSON, mac = HMAC-SHA256(key2, data).
function callbackBody(transactionId: string, amount: number, overrides: Record<string, unknown> = {}, signing = callbackSigning) {
  const data = JSON.stringify({
    app_id: Number(applicationId),
    app_trans_id: transactionId,
    app_time: Date.now(),
    app_user: "VComm",
    amount,
    embed_data: "{}",
    item: "[]",
    zp_trans_id: 240000123,
    server_time: Date.now(),
    channel: 36,
    merchant_user_id: "",
    user_fee_amount: 0,
    discount_amount: 0,
    ...overrides,
  });
  return { data, mac: zalopaySignature(signing, data), type: 1 };
}
const notify = (body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/google_pay/notify").send(body);

async function placeOrder() {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  expect(preview.body.paymentMethods).toContain("google_pay_card");
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "google_pay_card" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; status: string };
}

beforeAll(async () => {
  zalopay = createServer((incoming, response) => {
    let text = "";
    incoming.on("data", (chunk) => (text += chunk));
    incoming.on("end", () => {
      const fields = Object.fromEntries(new URLSearchParams(text));
      received.push(fields);
      const expected = zalopaySignature(requestSigning, [fields.app_id, fields.app_trans_id, fields.app_user, fields.amount, fields.app_time, fields.embed_data, fields.item].join("|"));
      const accepted = incoming.url === "/v2/create" && fields.mac === expected && !failNext;
      failNext = false;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify(
          accepted
            ? { return_code: 1, return_message: "Giao dịch thành công", sub_return_code: 1, order_url: `https://qcgateway.zalopay.vn/openinapp?order=${fields.app_trans_id}` }
            : { return_code: 2, return_message: "Giao dịch thất bại", sub_return_code: -401 },
        ),
      );
    });
  });
  await new Promise<void>((resolve) => zalopay.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, environment());
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0940400001", "Người Mua Google Pay");
  buyer = await store.buyerSession("0940400001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of Object.keys(environment())) delete process.env[name];
  await application?.close();
  await pool?.end();
  await new Promise((resolve) => zalopay?.close(resolve));
});

describe("CONG_VIEC_40 cổng Google Pay", () => {
  it("KICHBAN_KIEMTHU_407: phương thức Google Pay chỉ bật được khi có thông tin kết nối; bật thì người mua thấy, đặt được", async () => {
    const saved = process.env.ZALOPAY_KEY2;
    delete process.env.ZALOPAY_KEY2;
    const missing = (await store.call("get", "/marketplace/store-settings")).body.paymentMethods.find((item: { code: string }) => item.code === "google_pay_card");
    expect(missing).toEqual({ code: "google_pay_card", gatewayCode: "google_pay", isEnabled: false, isConfigured: false });
    expect((await store.call("put", "/marketplace/payment-methods/google_pay_card", { isEnabled: true })).status).toBe(409);
    process.env.ZALOPAY_KEY2 = saved;
    expect((await store.call("put", "/marketplace/payment-methods/google_pay_card", { isEnabled: true })).status).toBe(200);
    const order = await placeOrder();
    expect(order.status).toBe("awaiting_payment");
  });

  it("KICHBAN_KIEMTHU_408: mở thanh toán tạo đơn ZaloPay đúng chữ ký, trả trang thanh toán; ZaloPay từ chối thì không ghi lần thanh toán", async () => {
    const order = await placeOrder();
    const started = await buyer("post", `/buyer/orders/${order.id}/payments`);
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    expect(started.body.transfer).toBeNull();
    const sent = received.at(-1)!;
    expect(started.body.paymentUrl).toBe(`https://qcgateway.zalopay.vn/openinapp?order=${sent.app_trans_id}`);
    expect(sent).toMatchObject({
      app_id: applicationId,
      app_user: "VComm",
      amount: "74000",
      item: "[]",
      bank_code: "",
      callback_url: "https://api.vcomm.test/api/v1/public/payments/google_pay/notify",
    });
    expect(sent.app_trans_id).toMatch(/^\d{6}_[A-Za-z0-9]+T01$/);
    expect(JSON.parse(sent.embed_data!)).toEqual({ preferred_payment_method: ["international_card"], redirecturl: "https://api.vcomm.test/api/v1/public/payments/google_pay/return" });
    expect(Number(sent.expire_duration_seconds)).toBeGreaterThanOrEqual(300);

    const other = await placeOrder();
    failNext = true;
    const refused = await buyer("post", `/buyer/orders/${other.id}/payments`);
    expect(refused.status).toBeGreaterThanOrEqual(500);
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [other.id])).rows[0].count).toBe(0);
  });

  it("KICHBAN_KIEMTHU_409: kết quả ZaloPay gửi về: sai chữ ký, sai số tiền, sai mã ứng dụng bị từ chối; đúng thì ghi nhận một lần", async () => {
    const order = await placeOrder();
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(201);
    const transactionId = received.at(-1)!.app_trans_id!;
    expect((await notify(callbackBody(transactionId, 74000, {}, "sai"))).body).toEqual({ return_code: 2, return_message: "mac not equal" });
    expect((await notify(callbackBody(transactionId, 74000, { app_id: 9999 }))).body).toEqual({ return_code: 2, return_message: "mac not equal" });
    const tampered = callbackBody(transactionId, 74000);
    expect((await notify({ ...tampered, data: tampered.data.replace('"amount":74000', '"amount":100') })).body.return_code).toBe(2);
    expect((await notify(callbackBody(transactionId, 1000))).body).toEqual({ return_code: 2, return_message: "invalid amount" });
    expect((await notify(callbackBody("261111_KHONGCO01", 74000))).body).toEqual({ return_code: 2, return_message: "order not found" });
    expect((await notify(callbackBody(transactionId, 74000))).body).toEqual({ return_code: 1, return_message: "success" });
    expect((await notify(callbackBody(transactionId, 74000))).body).toEqual({ return_code: 1, return_message: "already confirmed" });
    const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: "GOOGLE_PAY 240000123" });
    const payment = (await pool.query("SELECT status, gateway_transaction_no, bank_code FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0];
    expect(payment).toEqual({ status: "succeeded", gateway_transaction_no: "240000123", bank_code: "36" });
    // Gọi bằng phương thức khác POST không được nhận.
    expect((await request(application.getHttpServer()).get("/api/v1/public/payments/google_pay/notify").query(callbackBody(transactionId, 74000))).body.return_code).toBe(2);
  });

  it("KICHBAN_KIEMTHU_410: trang trả về kiểm checksum, chỉ hiển thị, không ghi nhận tiền", async () => {
    const order = await placeOrder();
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(201);
    const transactionId = received.at(-1)!.app_trans_id!;
    const returnQuery = (status: string, signing = callbackSigning) => {
      const values = { appid: applicationId, apptransid: transactionId, pmcid: "36", bankcode: "", amount: "74000", discountamount: "0", status };
      return { ...values, checksum: zalopaySignature(signing, Object.values(values).join("|")) };
    };
    const page = (query: Record<string, string>) => request(application.getHttpServer()).get("/api/v1/public/payments/google_pay/return").query(query);
    const pending = await page(returnQuery("1"));
    expect(pending.status).toBe(200);
    expect(pending.text).toContain(`don-hang/${order.id}`);
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.paymentStatus).toBe("unpaid");
    expect((await page(returnQuery("1", "sai"))).text).not.toContain(`don-hang/${order.id}`);
    expect((await page(returnQuery("-49"))).text).toContain(`don-hang/${order.id}`);
  });
});
