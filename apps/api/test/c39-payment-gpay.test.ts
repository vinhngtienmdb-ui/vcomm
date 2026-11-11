// CONG_VIEC_39: cổng thanh toán G-Pay (KICHBAN_KIEMTHU_403 đến 406). Máy chủ G-Pay giả lập theo mã mẫu chính thức (github.com/gpay86/devportal); không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { notificationSigningText } from "../src/marketplace/payments/gateways/gpay-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

// Cặp khóa sinh lúc chạy: của VComm (ký yêu cầu) và của G-Pay (ký kết quả gửi về).
const merchantPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const gatewayPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherPair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = (value: KeyObject, type: "pkcs8" | "spki") => value.export({ type, format: "pem" }).toString();
const clientPassword = ["mat", "khau", "gpay"].join("-");
const variables = ["GPAY_API_URL", "GPAY_CLIENT_ID", "GPAY_CLIENT_SECRET", "GPAY_MERCHANT_PRIVATE_KEY", "GPAY_MERCHANT_CERTIFICATE", "GPAY_PUBLIC_KEY", "GPAY_WEBHOOK_URL", "GPAY_RETURN_URL"] as const;

interface ReceivedOrder {
  body: Record<string, unknown>;
  signatureValid: boolean;
  authorization: string | undefined;
  certificate: string | undefined;
}

// Máy chủ G-Pay giả lập: lấy mã truy cập, tạo đơn (kiểm chữ ký của VComm), tra cứu đơn.
const gpay = {
  server: null as Server | null,
  url: "",
  tokenCalls: 0,
  orders: [] as ReceivedOrder[],
  statuses: new Map<string, string>(),
};

function startGpayMock(): Promise<void> {
  gpay.server = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const reply = (status: number, payload: unknown) => {
        response.statusCode = status;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      if (incoming.url === "/v1/auth/token") {
        gpay.tokenCalls += 1;
        if (body.client_id !== "VCOMMTEST" || body.client_secret !== clientPassword) return reply(401, { meta: { code: "401", msg: "Unauthorized" } });
        return reply(200, { meta: { code: "200", msg: "Success" }, data: { access_token: "ma-truy-cap-kiem-thu", expires_in: 3600, token_type: "Bearer" } });
      }
      const header = (name: string) => incoming.headers[name] as string | undefined;
      const signatureValid = verify(
        "sha256",
        Buffer.from(`${header("x-timestamp")}${header("x-requests-id")}${raw}`, "utf8"),
        merchantPair.publicKey,
        Buffer.from(header("signature") ?? "", "base64"),
      );
      if (header("authorization") !== "Bearer ma-truy-cap-kiem-thu" || !signatureValid) return reply(401, { meta: { code: "1009", msg: "Invalid Signature" } });
      if (incoming.url === "/v1/payments/gateway/init-order") {
        gpay.orders.push({ body, signatureValid, authorization: header("authorization"), certificate: header("x-certificate") });
        gpay.statuses.set(body.request_id as string, "ORDER_PROCESSING");
        return reply(200, {
          meta: { code: "200", msg: "Success" },
          data: { bill_id: `BILL${gpay.orders.length}`, bill_url: `https://sandbox.g-pay.vn/bill/BILL${gpay.orders.length}`, request_id: body.request_id, expired_time: "" },
        });
      }
      if (incoming.url === "/v1/payments/gateway/query-order") {
        const order = gpay.orders.find((item) => item.body.request_id === body.merchant_order_id);
        if (!order) return reply(200, { meta: { code: "404", msg: "Not found" } });
        return reply(200, {
          meta: { code: "200", msg: "Success" },
          data: {
            merchant_order_id: order.body.request_id,
            gpay_bill_id: "BILL1",
            gpay_trans_id: "GT1",
            status: gpay.statuses.get(order.body.request_id as string),
            embed_data: order.body.embed_data,
            user_payment_method: "BANK_ATM",
          },
        });
      }
      reply(404, { meta: { code: "404", msg: "Not found" } });
    });
  });
  return new Promise((resolve) =>
    gpay.server!.listen(0, "127.0.0.1", () => {
      gpay.url = `http://127.0.0.1:${(gpay.server!.address() as AddressInfo).port}/v1`;
      resolve();
    }),
  );
}

// Kết quả G-Pay gửi về, ký bằng khóa của G-Pay.
function webhook(fields: Record<string, string>, signer: KeyObject = gatewayPair.privateKey): Record<string, string> {
  return { ...fields, signature: sign("sha256", Buffer.from(notificationSigningText(fields), "utf8"), signer).toString("base64") };
}

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;

const notify = (body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/gpay/notify").send(body);

async function placeAndStart(paymentMethod: string) {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  return { orderId: placed.body.id as string, started: started.body, sent: gpay.orders.at(-1)! };
}

beforeAll(async () => {
  await startGpayMock();
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  await store.register("0939000001", "Người Mua G-Pay");
  buyer = await store.buyerSession("0939000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of variables) delete process.env[name];
  gpay.server?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_39 cổng thanh toán G-Pay", () => {
  it("KICHBAN_KIEMTHU_403: chưa có thông tin kết nối thì không bật được; có thì bật được, người mua thấy theo thứ tự", async () => {
    const before = (await store.call("get", "/marketplace/store-settings")).body.paymentMethods;
    expect(before.filter((item: { gatewayCode: string }) => item.gatewayCode === "gpay")).toEqual([
      { code: "gpay_atm", gatewayCode: "gpay", isEnabled: false, isConfigured: false },
      { code: "gpay_international", gatewayCode: "gpay", isEnabled: false, isConfigured: false },
      { code: "gpay_va", gatewayCode: "gpay", isEnabled: false, isConfigured: false },
    ]);
    expect((await store.call("put", "/marketplace/payment-methods/gpay_atm", { isEnabled: true })).status).toBe(409);
    // Khóa không đọc được thì coi như chưa có thông tin kết nối.
    Object.assign(process.env, {
      GPAY_API_URL: gpay.url,
      GPAY_CLIENT_ID: "VCOMMTEST",
      GPAY_CLIENT_SECRET: clientPassword,
      GPAY_MERCHANT_PRIVATE_KEY: "khong-phai-khoa",
      GPAY_MERCHANT_CERTIFICATE: "Q0VSVElGSUNBVEU=",
      GPAY_PUBLIC_KEY: pem(gatewayPair.publicKey, "spki"),
      GPAY_WEBHOOK_URL: "http://localhost:4000/api/v1/public/payments/gpay/notify",
      GPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/gpay/return",
    });
    expect((await store.call("put", "/marketplace/payment-methods/gpay_atm", { isEnabled: true })).status).toBe(409);
    // Khóa viết trên một dòng (\n) vẫn đọc được.
    process.env.GPAY_MERCHANT_PRIVATE_KEY = pem(merchantPair.privateKey, "pkcs8").replace(/\n/g, "\\n");
    for (const code of ["gpay_atm", "gpay_international", "gpay_va"]) {
      const enabled = await store.call("put", `/marketplace/payment-methods/${code}`, { isEnabled: true });
      expect(enabled.status, JSON.stringify(enabled.body)).toBe(200);
    }
    expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: store.variants.soap, quantity: 1 }] });
    expect(preview.body.paymentMethods).toEqual(["cod", "gpay_atm", "gpay_international", "gpay_va"]);
  });

  it("KICHBAN_KIEMTHU_404: mở thanh toán gọi G-Pay đúng chữ ký, chuyển tới trang G-Pay; kết quả sai chữ ký, sai số tiền bị từ chối; thành công ghi nhận một lần", async () => {
    const { orderId, started, sent } = await placeAndStart("gpay_atm");
    expect(started.paymentUrl).toBe(`https://sandbox.g-pay.vn/bill/BILL${gpay.orders.length}`);
    expect(started.transfer).toBeNull();
    const reference = sent.body.request_id as string;
    expect(sent).toMatchObject({ signatureValid: true, authorization: "Bearer ma-truy-cap-kiem-thu", certificate: "Q0VSVElGSUNBVEU=" });
    expect(sent.body).toMatchObject({
      amount: 74000,
      payment_method: "BANK_ATM",
      payment_type: "IMMEDIATE",
      embed_data: `${reference}|74000`,
      webhook_url: "http://localhost:4000/api/v1/public/payments/gpay/notify",
      callback_url: "http://localhost:4000/api/v1/public/payments/gpay/return",
    });
    const fields = { merchant_order_id: reference, gpay_trans_id: "GT1001", gpay_bill_id: "BILL1", status: "ORDER_SUCCESS", embed_data: `${reference}|74000`, user_payment_method: "BANK_ATM" };
    // Sai chữ ký: ký bằng khóa khác, hoặc sửa nội dung sau khi ký.
    expect((await notify(webhook(fields, otherPair.privateKey))).status).toBe(401);
    expect((await notify({ ...webhook(fields), gpay_trans_id: "GT9999" })).status).toBe(401);
    expect((await notify({ ...fields, signature: "" })).status).toBe(401);
    // Đúng chữ ký nhưng số tiền trong dữ liệu riêng khác lần thanh toán.
    const wrongAmount = await notify(webhook({ ...fields, embed_data: `${reference}|1000` }));
    expect(wrongAmount.status).toBe(400);
    expect(wrongAmount.body).toEqual({ code: "04", message: "Invalid amount" });
    // Số tham chiếu trong dữ liệu riêng phải trùng mã đơn.
    expect((await notify(webhook({ ...fields, embed_data: `KHACDON01|74000` }))).status).toBe(401);
    expect((await notify(webhook({ ...fields, merchant_order_id: "KHONGCO01", embed_data: "KHONGCO01|74000" }))).body).toEqual({ code: "01", message: "Order not found" });
    const success = await notify(webhook(fields));
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ code: "00", message: "OK" });
    const duplicate = await notify(webhook(fields));
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toEqual({ code: "02", message: "Order already confirmed" });
    const detail = (await buyer("get", `/buyer/orders/${orderId}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: "GPAY GT1001" });
    const payment = (await pool.query("SELECT status, response_code, gateway_transaction_no, bank_code FROM marketplace.payments WHERE reference = $1", [reference])).rows[0];
    expect(payment).toEqual({ status: "succeeded", response_code: "ORDER_SUCCESS", gateway_transaction_no: "GT1001", bank_code: "BANK_ATM" });
    // Mã truy cập dùng lại cho các lần gọi sau.
    expect(gpay.tokenCalls).toBe(1);
  });

  it("KICHBAN_KIEMTHU_405: thanh toán thất bại ghi lần thanh toán thất bại, đơn vẫn chờ thanh toán; phương thức thẻ quốc tế, tài khoản ảo gửi đúng phương thức G-Pay", async () => {
    const { orderId, sent } = await placeAndStart("gpay_international");
    expect(sent.body.payment_method).toBe("BANK_INTERNATIONAL");
    const reference = sent.body.request_id as string;
    const failed = await notify(
      webhook({ merchant_order_id: reference, gpay_trans_id: "GT2001", gpay_bill_id: "BILL2", status: "ORDER_FAILED", embed_data: `${reference}|74000`, user_payment_method: "BANK_INTERNATIONAL" }),
    );
    expect(failed.status).toBe(200);
    expect((await pool.query("SELECT status FROM marketplace.payments WHERE reference = $1", [reference])).rows[0].status).toBe("failed");
    // Trạng thái chưa kết thúc không được ghi nhận.
    const processing = await placeAndStart("gpay_atm");
    const processingReference = processing.sent.body.request_id as string;
    const notFinished = {
      merchant_order_id: processingReference,
      gpay_trans_id: "GT2002",
      gpay_bill_id: "BILL3",
      status: "ORDER_PROCESSING",
      embed_data: `${processingReference}|74000`,
      user_payment_method: "BANK_ATM",
    };
    expect((await notify(webhook(notFinished))).status).toBe(401);
    expect((await pool.query("SELECT status FROM marketplace.payments WHERE reference = $1", [processingReference])).rows[0].status).toBe("pending");
    expect((await buyer("get", `/buyer/orders/${orderId}`)).body).toMatchObject({ status: "awaiting_payment", paymentStatus: "unpaid", canPay: true });
    expect((await placeAndStart("gpay_va")).sent.body.payment_method).toBe("VA");
  });

  it("KICHBAN_KIEMTHU_406: trang trả về tra cứu đơn với G-Pay, không tin tham số trên đường dẫn; G-Pay lỗi thì trả lỗi cho người mua", async () => {
    const { orderId, sent } = await placeAndStart("gpay_atm");
    const reference = sent.body.request_id as string;
    const page = (query: Record<string, string>) => request(application.getHttpServer()).get("/api/v1/public/payments/gpay/return").query(query);
    // Đường dẫn ghi thành công nhưng G-Pay chưa xác nhận: chờ kết quả.
    const pending = await page({ merchant_order_id: reference, status: "ORDER_SUCCESS" });
    expect(pending.text).toContain("đang chờ kết quả");
    expect(pending.text).toContain(`don-hang/${orderId}`);
    gpay.statuses.set(reference, "ORDER_FAILED");
    expect((await page({ merchant_order_id: reference })).text).toContain("Thanh toán không thành công");
    expect((await page({ merchant_order_id: "KHONGCO01" })).text).toContain("Không xác nhận được kết quả thanh toán");
    expect((await page({})).text).toContain("Không xác nhận được kết quả thanh toán");
    // G-Pay không trả lời khi mở thanh toán: báo phương thức không dùng được, không tạo lần thanh toán.
    const attempts = async () => (await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [orderId])).rows[0].count as number;
    const before = await attempts();
    process.env.GPAY_API_URL = "http://127.0.0.1:1/v1";
    const unavailable = await buyer("post", `/buyer/orders/${orderId}/payments`);
    expect(unavailable.status).toBe(409);
    expect(unavailable.body.error.message).toBe("Phương thức thanh toán này hiện không dùng được. Chọn phương thức khác.");
    expect(await attempts()).toBe(before);
    process.env.GPAY_API_URL = gpay.url;
  });
});
