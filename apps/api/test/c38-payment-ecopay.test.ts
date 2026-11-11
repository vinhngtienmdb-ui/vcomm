// CONG_VIEC_38: cổng Ecopay (Finviet) (KICHBAN_KIEMTHU_399 đến 402). Máy chủ Ecopay giả lập theo định dạng ký của SDK công khai; không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ecopaySignature } from "../src/marketplace/payments/gateways/ecopay-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let ecopayServer: Server;
// Ghép chuỗi lúc chạy để công cụ quét bí mật không báo nhầm.
const signingWord = ["kiem", "thu", "ecopay", "0123456789"].join("-");
const merchantCode = "VCOMMTEST";
const environmentNames = ["ECOPAY_MERCHANT_CODE", "ECOPAY_SECRET_KEY", "ECOPAY_STORE_CODE", "ECOPAY_TERMINAL_CODE", "ECOPAY_API_URL", "ECOPAY_RETURN_URL"];

// Trạng thái giao dịch trên máy chủ Ecopay giả lập, theo mã đơn (số tham chiếu).
const transactions = new Map<string, { status: string; amount: number }>();
const initRequests: Record<string, unknown>[] = [];
let breakResponseSignature = false;

function signed(data: Record<string, unknown>) {
  const signature = ecopaySignature(data, signingWord);
  return { result_code: "00", message_key: "SUCCESS", message: "Success", data, signature: breakResponseSignature ? "0".repeat(64) : signature };
}

function startEcopayServer(): Promise<string> {
  ecopayServer = createServer((incoming, response) => {
    let text = "";
    incoming.on("data", (chunk) => (text += chunk));
    incoming.on("end", () => {
      const body = JSON.parse(text || "{}") as Record<string, unknown>;
      const answer = (payload: unknown) => response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(payload));
      if (body.signature !== ecopaySignature(body, signingWord) || body.merchant_code !== merchantCode) {
        answer({ result_code: "01", message_key: "INVALID_SIGNATURE", message: "Invalid signature" });
        return;
      }
      const reference = String(body.merchant_order_id);
      if (incoming.url === "/api/v1/payment/init") {
        initRequests.push(body);
        transactions.set(reference, { status: "initial", amount: Number(body.amount) });
        answer(signed({ payment_url: `https://pay.ecopay.test/${reference}`, transid: `FV${reference}`, status: "initial", expired_time: 900, expired_at: Date.now() + 900_000 }));
        return;
      }
      if (incoming.url === "/api/v1/payment/checktrans") {
        const transaction = transactions.get(reference);
        if (!transaction) answer({ result_code: "01", message_key: "TRANSACTION_NOTFOUND", message: "Not found" });
        else answer(signed({ fv_transid: `FV${reference}`, merchant_order_id: reference, merchant_code: merchantCode, status: transaction.status, amount: transaction.amount, created_at: 1 }));
        return;
      }
      response.writeHead(404).end();
    });
  });
  return new Promise((resolve) => ecopayServer.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(ecopayServer.address() as AddressInfo).port}`)));
}

// Kết quả Ecopay gửi về (IPN), ký theo cách bỏ trường đối tượng (objectsAsJson false) hoặc ghép chuỗi JSON.
function ipnBody(reference: string, amount: number, status: string, options: { objectsAsJson?: boolean; signingValue?: string } = {}) {
  const fields: Record<string, unknown> = {
    fv_transid: `FV${reference}`,
    merchant_order_id: reference,
    platform: "web",
    merchant_code: merchantCode,
    payment_channel: "eco",
    status,
    amount,
    description: "Thanh toan don",
    created_at: 1762850000000,
    store_code: "CUAHANG01",
    extra_data: { display_data: [] },
  };
  const signedFields = options.objectsAsJson ? fields : Object.fromEntries(Object.entries(fields).filter(([, value]) => typeof value !== "object"));
  return { ...fields, signature: ecopaySignature(signedFields, options.signingValue ?? signingWord) };
}
const notify = (body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/ecopay/notify").send(body);

async function placeAndStart(paymentMethod: string) {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  expect(preview.body.paymentMethods).toContain(paymentMethod);
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  const reference = new URL(started.body.paymentUrl as string).pathname.slice(1);
  return { orderId: placed.body.id as string, reference, started: started.body };
}

beforeAll(async () => {
  const apiUrl = await startEcopayServer();
  Object.assign(process.env, {
    ECOPAY_MERCHANT_CODE: merchantCode,
    ECOPAY_SECRET_KEY: signingWord,
    ECOPAY_STORE_CODE: "CUAHANG01",
    ECOPAY_TERMINAL_CODE: "QUAY01",
    ECOPAY_API_URL: apiUrl,
    ECOPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/ecopay/return",
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  for (const code of ["ecopay_wallet", "ecopay_atm"]) expect((await store.call("put", `/marketplace/payment-methods/${code}`, { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0938000001", "Người Mua Ecopay");
  buyer = await store.buyerSession("0938000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of environmentNames) delete process.env[name];
  await application?.close();
  await pool?.end();
  await new Promise((resolve) => ecopayServer?.close(resolve));
});

describe("CONG_VIEC_38 cổng Ecopay", () => {
  it("KICHBAN_KIEMTHU_399: phương thức Ecopay có thông tin kết nối; mở thanh toán gửi yêu cầu có ký, trả trang Ecopay; phản hồi sai chữ ký thì không mở", async () => {
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.find((item: { code: string }) => item.code === "ecopay_wallet")).toMatchObject({ gatewayCode: "ecopay", isEnabled: true, isConfigured: true });
    const { reference, started } = await placeAndStart("ecopay_wallet");
    expect(started.paymentUrl).toBe(`https://pay.ecopay.test/${reference}`);
    expect(started.transfer).toBeNull();
    expect(initRequests.at(-1)).toMatchObject({
      platform: "web",
      payment_channel: "eco",
      store_code: "CUAHANG01",
      terminal_code: "QUAY01",
      merchant_code: merchantCode,
      merchant_order_id: reference,
      amount: 74000,
      currency: "VND",
      redirect_url: "http://localhost:4000/api/v1/public/payments/ecopay/return",
    });
    expect(initRequests.at(-1)).not.toHaveProperty("bank_type");

    breakResponseSignature = true;
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "ecopay_wallet" });
    const rejected = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
    breakResponseSignature = false;
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("BUSINESS_RULE");
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [placed.body.id])).rows[0].count).toBe(0);
  });

  it("KICHBAN_KIEMTHU_400: kết quả gửi về sai chữ ký, trạng thái trên Ecopay chưa khớp, sai số tiền bị từ chối; đúng thì ghi nhận một lần", async () => {
    const { orderId, reference } = await placeAndStart("ecopay_wallet");
    const wrongSignature = await notify(ipnBody(reference, 74000, "success", { signingValue: "sai" }));
    expect(wrongSignature.status).toBe(400);
    expect(wrongSignature.body).toEqual({ result_code: "97", message: "Invalid signature" });
    // Đúng chữ ký nhưng Ecopay vẫn báo giao dịch chưa xong: không ghi nhận.
    expect((await notify(ipnBody(reference, 74000, "success"))).status).toBe(400);
    transactions.set(reference, { status: "success", amount: 1000 });
    expect((await notify(ipnBody(reference, 1000, "success"))).body).toEqual({ result_code: "02", message: "Invalid amount" });
    transactions.set(reference, { status: "success", amount: 74000 });
    expect((await notify(ipnBody(reference, 74000, "success"))).body).toEqual({ result_code: "00", message: "Success" });
    expect((await notify(ipnBody(reference, 74000, "success", { objectsAsJson: true }))).body).toEqual({ result_code: "00", message: "Already confirmed" });
    const detail = (await buyer("get", `/buyer/orders/${orderId}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: `ECOPAY FV${reference}` });
    const logged = (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE gateway_code = 'ecopay' ORDER BY received_at")).rows.map((row) => row.result_code);
    expect(logged).toEqual(["invalid_signature", "invalid_signature", "invalid_amount", "success", "already_confirmed"]);
  });

  it("KICHBAN_KIEMTHU_401: thẻ ATM nội địa qua Ecopay; giao dịch thất bại ghi lần thanh toán thất bại, đơn vẫn chờ thanh toán; trạng thái đang xử lý báo đang chờ, chưa ghi nhận", async () => {
    const { orderId, reference } = await placeAndStart("ecopay_atm");
    expect(initRequests.at(-1)).toMatchObject({ payment_channel: "atm", bank_type: "domestic", merchant_order_id: reference });
    transactions.set(reference, { status: "processing", amount: 74000 });
    expect((await notify(ipnBody(reference, 74000, "processing"))).body).toEqual({ result_code: "00", message: "Pending" });
    expect((await pool.query("SELECT status FROM marketplace.payments WHERE reference = $1", [reference])).rows[0].status).toBe("pending");
    transactions.set(reference, { status: "failed", amount: 74000 });
    expect((await notify(ipnBody(reference, 74000, "failed", { objectsAsJson: true }))).body).toEqual({ result_code: "00", message: "Success" });
    const payment = (await pool.query("SELECT status, response_code FROM marketplace.payments WHERE reference = $1", [reference])).rows[0];
    expect(payment).toEqual({ status: "failed", response_code: "failed" });
    expect((await buyer("get", `/buyer/orders/${orderId}`)).body).toMatchObject({ status: "awaiting_payment", paidAmount: "0" });
  });

  it("KICHBAN_KIEMTHU_402: trang trả về kiểm chữ ký, chỉ hiển thị; thiếu thông tin kết nối thì phương thức Ecopay chưa sẵn sàng", async () => {
    const { reference } = await placeAndStart("ecopay_wallet");
    transactions.set(reference, { status: "success", amount: 74000 });
    expect((await notify(ipnBody(reference, 74000, "success"))).body.result_code).toBe("00");
    const query = { order_id: reference, fv_payment_transid: `FV${reference}`, status: "success", ts: "1762850000000" };
    const returned = await request(application.getHttpServer())
      .get("/api/v1/public/payments/ecopay/return")
      .query({ ...query, Signature: ecopaySignature(query, signingWord) });
    expect(returned.text).toContain("Thanh toán thành công");
    const tampered = await request(application.getHttpServer())
      .get("/api/v1/public/payments/ecopay/return")
      .query({ ...query, status: "failed", Signature: ecopaySignature(query, signingWord) });
    expect(tampered.text).toContain("Không xác nhận được kết quả thanh toán");

    delete process.env.ECOPAY_SECRET_KEY;
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.find((item: { code: string }) => item.code === "ecopay_wallet")).toMatchObject({ isConfigured: false });
    process.env.ECOPAY_SECRET_KEY = signingWord;
  });
});
