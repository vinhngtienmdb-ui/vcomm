// CONG_VIEC_41: Apple Pay qua trang thanh toán ZaloPay (KICHBAN_KIEMTHU_411 đến 414). Máy chủ ZaloPay giả lập theo đặc tả công khai, không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { zalopayMac, zalopayTransactionId } from "../src/marketplace/payments/gateways/apple-pay-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

// Khóa giả ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const requestMacSeed = ["kiem", "thu", "mot"].join("-");
const callbackMacSeed = ["kiem", "thu", "hai"].join("-");
const appId = "2554";
const environmentNames = ["ZALOPAY_APP_ID", "ZALOPAY_KEY1", "ZALOPAY_KEY2", "ZALOPAY_ENDPOINT", "ZALOPAY_PUBLIC_API_URL", "ZALOPAY_APPLE_PAY_PREFERRED_METHODS"];

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let zalopayServer: Server;
// Yêu cầu tạo đơn máy chủ giả lập nhận được; trả lời tiếp theo có thể đổi để giả lập lỗi.
const received: Record<string, string>[] = [];
let nextCreateReply: object | null = null;

function startZalopayServer(): Promise<string> {
  zalopayServer = createServer((incoming, response) => {
    let text = "";
    incoming.on("data", (chunk) => (text += chunk));
    incoming.on("end", () => {
      const form = Object.fromEntries(new URLSearchParams(text));
      received.push(form);
      const expected = zalopayMac(requestMacSeed, [form.app_id, form.app_trans_id, form.app_user, form.amount, form.app_time, form.embed_data, form.item].join("|"));
      const reply =
        incoming.url !== "/v2/create" || form.mac !== expected
          ? { return_code: 2, return_message: "mac sai", sub_return_code: -402 }
          : (nextCreateReply ?? { return_code: 1, return_message: "Giao dịch thành công", order_url: `https://qcgateway.zalopay.vn/openinapp?order=${form.app_trans_id}`, zp_trans_token: "AC1" });
      nextCreateReply = null;
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(reply));
    });
  });
  return new Promise((resolve) => zalopayServer.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(zalopayServer.address() as AddressInfo).port}`)));
}

// Kết quả ZaloPay gửi về: data là chuỗi JSON, mac = HMAC-SHA256(key2, data).
function callbackBody(transactionId: string, amount: number, macSeed = callbackMacSeed) {
  const data = JSON.stringify({
    app_id: Number(appId),
    app_trans_id: transactionId,
    app_time: Date.now(),
    app_user: "vcomm",
    amount,
    embed_data: "{}",
    item: "[]",
    zp_trans_id: 261111000006575,
    server_time: Date.now(),
    channel: 38,
    merchant_user_id: "nguoi-mua-gia",
    user_fee_amount: 0,
    discount_amount: 0,
  });
  return { data, mac: zalopayMac(macSeed, data), type: 1 };
}
const notify = (body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/apple_pay/notify").send(body);
function returnQuery(transactionId: string, amount: number, status: string) {
  const fields = { appid: appId, apptransid: transactionId, pmcid: "38", bankcode: "", amount: String(amount), discountamount: "0", status };
  return { ...fields, checksum: zalopayMac(callbackMacSeed, Object.values(fields).join("|")) };
}

async function placeApplePay() {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  expect(preview.body.paymentMethods).toContain("apple_pay_wallet");
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "apple_pay_wallet" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; total: string; documentNo: string };
}

beforeAll(async () => {
  const endpoint = await startZalopayServer();
  Object.assign(process.env, {
    ZALOPAY_APP_ID: appId,
    ZALOPAY_KEY1: requestMacSeed,
    ZALOPAY_KEY2: callbackMacSeed,
    ZALOPAY_ENDPOINT: endpoint,
    ZALOPAY_PUBLIC_API_URL: "https://api.vcomm.test/",
    ZALOPAY_APPLE_PAY_PREFERRED_METHODS: "",
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/payment-methods/apple_pay_wallet", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0941000001", "Người Mua Apple Pay");
  buyer = await store.buyerSession("0941000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of environmentNames) delete process.env[name];
  await application?.close();
  await pool?.end();
  await new Promise((resolve) => zalopayServer?.close(resolve));
});

describe("CONG_VIEC_41 Apple Pay qua ZaloPay", () => {
  it("KICHBAN_KIEMTHU_411: phương thức Apple Pay hiện cho người mua; mở thanh toán tạo đơn ZaloPay ký đúng, trả trang thanh toán; ZaloPay từ chối thì không ghi lần thanh toán", async () => {
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.find((item: { code: string }) => item.code === "apple_pay_wallet")).toMatchObject({ gatewayCode: "apple_pay", isEnabled: true, isConfigured: true });
    const order = await placeApplePay();
    expect(order.total).toBe("74000");

    nextCreateReply = { return_code: 2, return_message: "Giao dịch thất bại", sub_return_code: -68 };
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(500);
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0].count).toBe(0);

    const started = await buyer("post", `/buyer/orders/${order.id}/payments`);
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    expect(started.body.transfer).toBeNull();
    const form = received.at(-1)!;
    expect(form).toMatchObject({ app_id: appId, app_user: "vcomm", amount: "74000", item: "[]", bank_code: "", callback_url: "https://api.vcomm.test/api/v1/public/payments/apple_pay/notify" });
    expect(started.body.paymentUrl).toBe(`https://qcgateway.zalopay.vn/openinapp?order=${form.app_trans_id}`);
    expect(JSON.parse(form.embed_data!)).toEqual({ preferred_payment_method: [], redirecturl: "https://api.vcomm.test/api/v1/public/payments/apple_pay/return" });
    expect(Number(form.expire_duration_seconds)).toBeGreaterThanOrEqual(300);
    const payment = (await pool.query("SELECT reference, gateway_code, method FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0];
    expect(payment).toMatchObject({ gateway_code: "apple_pay", method: "apple_pay_wallet" });
    expect(form.app_trans_id).toMatch(new RegExp(`^\\d{6}_${payment.reference}$`));
  });

  it("KICHBAN_KIEMTHU_412: kết quả ZaloPay sai chữ ký, sai số tiền bị từ chối; đúng thì ghi đã thu một lần, đơn Chờ giao; gửi lại trả thành công không ghi thêm", async () => {
    const order = await placeApplePay();
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(201);
    const transactionId = received.at(-1)!.app_trans_id!;

    expect((await notify(callbackBody(transactionId, 74000, "khoa-sai"))).body).toEqual({ return_code: -1, return_message: "mac not equal" });
    expect((await request(application.getHttpServer()).get("/api/v1/public/payments/apple_pay/notify").query(callbackBody(transactionId, 74000))).body.return_code).toBe(-1);
    expect((await notify(callbackBody(transactionId, 1000))).body).toEqual({ return_code: 2, return_message: "invalid amount" });
    expect((await notify(callbackBody("261111_KHONGCOT01", 74000))).body).toEqual({ return_code: 2, return_message: "order not found" });
    expect((await notify(callbackBody(transactionId, 74000))).body).toEqual({ return_code: 1, return_message: "success" });
    expect((await notify(callbackBody(transactionId, 74000))).body).toEqual({ return_code: 1, return_message: "already confirmed" });

    const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: "APPLE_PAY 261111000006575" });
    const payment = (await pool.query("SELECT status, gateway_transaction_no, bank_code FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0];
    expect(payment).toEqual({ status: "succeeded", gateway_transaction_no: "261111000006575", bank_code: "38" });
    const logged = (await pool.query("SELECT result_code, reference FROM marketplace.payment_notifications WHERE gateway_code = 'apple_pay' ORDER BY received_at")).rows;
    expect(logged.map((row) => row.result_code)).toEqual(["invalid_signature", "invalid_signature", "invalid_amount", "not_found", "success", "already_confirmed"]);
    expect(logged[0].reference).toBeNull();
  });

  it("KICHBAN_KIEMTHU_413: trang trả về kiểm checksum, chỉ hiển thị kết quả", async () => {
    const order = await placeApplePay();
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(201);
    const transactionId = received.at(-1)!.app_trans_id!;
    const page = (query: Record<string, string>) => request(application.getHttpServer()).get("/api/v1/public/payments/apple_pay/return").query(query);

    expect((await page({ ...returnQuery(transactionId, 74000, "1"), amount: "1" })).text).toContain("Không xác nhận được kết quả thanh toán");
    // Trang trả về báo thành công nhưng chưa có kết quả gửi về: đang chờ, không ghi nhận tiền.
    expect((await page(returnQuery(transactionId, 74000, "1"))).text).toContain("đang chờ kết quả");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.paymentStatus).toBe("unpaid");
    expect((await page(returnQuery(transactionId, 74000, "-49"))).text).toContain("Thanh toán không thành công");
    expect((await notify(callbackBody(transactionId, 74000))).body.return_code).toBe(1);
    const succeeded = await page(returnQuery(transactionId, 74000, "1"));
    expect(succeeded.text).toContain("Thanh toán thành công");
    expect(succeeded.text).toContain(`don-hang/${order.id}`);
  });

  it("KICHBAN_KIEMTHU_414: thiếu thông tin kết nối ZaloPay thì không bật, không mở được thanh toán Apple Pay; số giao dịch theo ngày giờ Việt Nam", async () => {
    expect(zalopayTransactionId("SO1T01", new Date("2026-11-11T17:30:00Z"))).toBe("261112_SO1T01");
    expect(zalopayTransactionId("SO1T01", new Date("2026-11-11T16:59:00Z"))).toBe("261111_SO1T01");
    const order = await placeApplePay();
    delete process.env.ZALOPAY_KEY2;
    try {
      const settings = (await store.call("get", "/marketplace/store-settings")).body;
      expect(settings.paymentMethods.find((item: { code: string }) => item.code === "apple_pay_wallet")).toMatchObject({ isConfigured: false });
      const started = await buyer("post", `/buyer/orders/${order.id}/payments`);
      expect(started.status).toBe(409);
      expect((await notify(callbackBody("261111_SO1T01", 74000))).body).toEqual({ return_code: 0, return_message: "retry" });
    } finally {
      process.env.ZALOPAY_KEY2 = callbackMacSeed;
    }
  });
});
