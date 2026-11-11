// CONG_VIEC_42: cổng ZaloPay (KICHBAN_KIEMTHU_415 đến 418) với máy chủ ZaloPay giả lập theo tài liệu công khai, không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { queryOrder, zalopayConfiguration, zalopayMac } from "../src/marketplace/payments/gateways/zalopay-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let gatewayServer: Server;
// Khóa giả ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const requestMac = ["kiem", "thu", "mot", "ZP"].join("-");
const callbackMac = ["kiem", "thu", "hai", "ZP"].join("-");
const appId = "2553";
const environmentNames = ["ZALOPAY_APP_ID", "ZALOPAY_KEY1", "ZALOPAY_KEY2", "ZALOPAY_CALLBACK_URL", "ZALOPAY_RETURN_URL", "ZALOPAY_API_URL"];

// Máy chủ ZaloPay giả lập: kiểm mac của yêu cầu, ghi lại yêu cầu, trả lời theo chế độ đang đặt.
const gateway = {
  createRequests: [] as Record<string, string>[],
  queryRequests: [] as Record<string, string>[],
  createReply: { return_code: 1, return_message: "Giao dịch thành công" } as Record<string, unknown>,
  queryReply: { return_code: 3, return_message: "Đang xử lý" } as Record<string, unknown>,
};

function startGatewayServer(): Promise<string> {
  gatewayServer = createServer((incoming, outgoing) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const parameters = Object.fromEntries(new URLSearchParams(raw));
      outgoing.setHeader("Content-Type", "application/json");
      if (incoming.url === "/v2/create") {
        gateway.createRequests.push(parameters);
        const signed = [parameters.app_id, parameters.app_trans_id, parameters.app_user, parameters.amount, parameters.app_time, parameters.embed_data, parameters.item].join("|");
        if (parameters.mac !== zalopayMac(requestMac, signed)) return outgoing.end(JSON.stringify({ return_code: 2, return_message: "mac sai", sub_return_code: -402 }));
        const reply = gateway.createReply.return_code === 1 ? { ...gateway.createReply, order_url: `https://qcgateway.zalopay.vn/openinapp?order=${parameters.app_trans_id}` } : gateway.createReply;
        return outgoing.end(JSON.stringify(reply));
      }
      if (incoming.url === "/v2/query") {
        gateway.queryRequests.push(parameters);
        if (parameters.mac !== zalopayMac(requestMac, [parameters.app_id, parameters.app_trans_id, requestMac].join("|")))
          return outgoing.end(JSON.stringify({ return_code: 2, sub_return_code: -402 }));
        return outgoing.end(JSON.stringify(gateway.queryReply));
      }
      outgoing.statusCode = 404;
      outgoing.end("{}");
    });
  });
  return new Promise((resolve) => gatewayServer.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(gatewayServer.address() as AddressInfo).port}`)));
}

// Kết quả ZaloPay gửi về: data là chuỗi JSON, mac là HMAC key2 trên data.
function callbackBody(transactionId: string, amount: number, macKey = callbackMac, extra: Record<string, unknown> = {}) {
  const data = JSON.stringify({
    app_id: Number(appId),
    app_trans_id: transactionId,
    app_time: Date.now(),
    app_user: "VComm",
    amount,
    embed_data: "{}",
    item: "[]",
    zp_trans_id: 251111000000123,
    server_time: Date.now(),
    channel: 38,
    merchant_user_id: "",
    user_fee_amount: 0,
    discount_amount: 0,
    ...extra,
  });
  return { data, mac: zalopayMac(macKey, data), type: 1 };
}
const notify = (body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/zalopay/notify").send(body);

// Trang trả về: checksum là HMAC key2 trên appid|apptransid|pmcid|bankcode|amount|discountamount|status.
function redirectQuery(transactionId: string, amount: number, status: string, macKey = callbackMac) {
  const query = { appid: appId, apptransid: transactionId, pmcid: "38", bankcode: "", amount: String(amount), discountamount: "0", status };
  return { ...query, checksum: zalopayMac(macKey, Object.values(query).join("|")) };
}
const returnPage = (query: Record<string, string>) => request(application.getHttpServer()).get("/api/v1/public/payments/zalopay/return").query(query);

async function placeOrder(paymentMethod: string) {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  expect(preview.body.paymentMethods).toContain(paymentMethod);
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; total: string; documentNo: string };
}

beforeAll(async () => {
  const apiUrl = await startGatewayServer();
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  // Chưa có thông tin kết nối thì không bật được phương thức ZaloPay.
  expect((await store.call("put", "/marketplace/payment-methods/zalopay_wallet", { isEnabled: true })).status).toBe(409);
  Object.assign(process.env, {
    ZALOPAY_APP_ID: appId,
    ZALOPAY_KEY1: requestMac,
    ZALOPAY_KEY2: callbackMac,
    ZALOPAY_CALLBACK_URL: "https://api.vcomm.test/api/v1/public/payments/zalopay/notify",
    ZALOPAY_RETURN_URL: "https://api.vcomm.test/api/v1/public/payments/zalopay/return",
    ZALOPAY_API_URL: apiUrl,
  });
  for (const code of ["zalopay_wallet", "zalopay_atm", "zalopay_card"]) expect((await store.call("put", `/marketplace/payment-methods/${code}`, { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0942000001", "Người Mua ZaloPay");
  buyer = await store.buyerSession("0942000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of environmentNames) delete process.env[name];
  await application?.close();
  await pool?.end();
  await new Promise((resolve) => gatewayServer?.close(resolve));
});

describe("CONG_VIEC_42 cổng ZaloPay", () => {
  it("KICHBAN_KIEMTHU_415: tạo đơn trên ZaloPay ký đúng, mở trang của phương thức đã chọn; ZaloPay từ chối thì báo lỗi, không tính lần thanh toán", async () => {
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.filter((item: { gatewayCode: string }) => item.gatewayCode === "zalopay")).toEqual([
      { code: "zalopay_wallet", gatewayCode: "zalopay", isEnabled: true, isConfigured: true },
      { code: "zalopay_atm", gatewayCode: "zalopay", isEnabled: true, isConfigured: true },
      { code: "zalopay_card", gatewayCode: "zalopay", isEnabled: true, isConfigured: true },
    ]);
    const order = await placeOrder("zalopay_atm");
    const started = await buyer("post", `/buyer/orders/${order.id}/payments`);
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    const sent = gateway.createRequests.at(-1)!;
    const reference = `${order.documentNo.replace(/[^A-Za-z0-9]/g, "")}T01`;
    expect(sent.app_trans_id).toMatch(new RegExp(`^\\d{6}_${reference}$`));
    expect(started.body).toMatchObject({ paymentUrl: `https://qcgateway.zalopay.vn/openinapp?order=${sent.app_trans_id}`, transfer: null });
    expect(sent).toMatchObject({ app_id: appId, app_user: "VComm", amount: "74000", item: "[]", bank_code: "", description: `VComm - Thanh toan don ${order.documentNo}` });
    expect(sent.callback_url).toBe("https://api.vcomm.test/api/v1/public/payments/zalopay/notify");
    expect(JSON.parse(sent.embed_data!)).toEqual({ redirecturl: "https://api.vcomm.test/api/v1/public/payments/zalopay/return", preferred_payment_method: ["domestic_card", "account"] });
    // Hạn thanh toán 15 phút, trong khoảng ZaloPay cho phép.
    expect(Number(sent.expire_duration_seconds)).toBeGreaterThanOrEqual(300);
    expect(Number(sent.expire_duration_seconds)).toBeLessThanOrEqual(900);

    gateway.createReply = { return_code: 2, return_message: "Giao dịch thất bại", sub_return_code: -54 };
    const refused = await buyer("post", `/buyer/orders/${order.id}/payments`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Phương thức thanh toán này hiện không dùng được. Chọn phương thức khác.");
    gateway.createReply = { return_code: 1, return_message: "Giao dịch thành công" };
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0].count).toBe(1);
    // Mở lại: lần thanh toán thứ hai có số tham chiếu mới.
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(201);
    expect(gateway.createRequests.at(-1)!.app_trans_id).toMatch(/T02$/);
  });

  it("KICHBAN_KIEMTHU_416, 417: kết quả gửi về sai chữ ký, sai số tiền bị từ chối; đúng thì ghi nhận một lần; trang trả về chỉ hiển thị", async () => {
    const order = await placeOrder("zalopay_wallet");
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(201);
    const transactionId = gateway.createRequests.at(-1)!.app_trans_id!;
    expect(JSON.parse(gateway.createRequests.at(-1)!.embed_data!).preferred_payment_method).toEqual(["zalopay_wallet"]);

    expect((await notify(callbackBody(transactionId, 74000, "khoa-sai"))).body).toEqual({ return_code: -1, return_message: "mac not equal" });
    const tampered = { ...callbackBody(transactionId, 74000), data: callbackBody(transactionId, 100).data };
    expect((await notify(tampered)).body.return_code).toBe(-1);
    expect((await request(application.getHttpServer()).get("/api/v1/public/payments/zalopay/notify").query(callbackBody(transactionId, 74000))).body.return_code).toBe(-1);
    expect((await notify(callbackBody(transactionId, 74000, callbackMac, { app_id: 9999 }))).body.return_code).toBe(-1);
    expect((await notify(callbackBody(transactionId, 1000))).body).toEqual({ return_code: 2, return_message: "invalid amount" });
    expect((await notify(callbackBody("251111_KHONGCO01", 74000))).body).toEqual({ return_code: 2, return_message: "order not found" });

    // Trang trả về trước khi có kết quả: chỉ hiển thị chờ; sai checksum không xác nhận được; status khác 1 là không thành công.
    expect((await returnPage(redirectQuery(transactionId, 74000, "1"))).text).toContain("VComm đang chờ kết quả từ cổng thanh toán");
    expect((await returnPage(redirectQuery(transactionId, 74000, "1", "khoa-sai"))).text).toContain("Không xác nhận được kết quả thanh toán.");
    expect((await returnPage(redirectQuery(transactionId, 74000, "-49"))).text).toContain("Thanh toán không thành công.");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.status).toBe("awaiting_payment");

    expect((await notify(callbackBody(transactionId, 74000))).body).toEqual({ return_code: 1, return_message: "success" });
    const paid = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(paid).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    // Nhận trùng: không ghi thêm.
    expect((await notify(callbackBody(transactionId, 74000))).body).toEqual({ return_code: 2, return_message: "already confirmed" });
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.paidAmount).toBe("74000");
    expect((await returnPage(redirectQuery(transactionId, 74000, "1"))).text).toContain("Thanh toán thành công");
    const admin = (await store.call("get", `/marketplace/orders/${order.id}`)).body;
    expect(admin.payments).toEqual([expect.objectContaining({ method: "zalopay_wallet", amount: "74000", status: "succeeded", transactionNo: "251111000000123", responseCode: "1" })]);
    const logged = await pool.query("SELECT result_code, reference FROM marketplace.payment_notifications WHERE gateway_code = 'zalopay' ORDER BY received_at");
    expect(logged.rows.map((row) => row.result_code)).toEqual([
      "invalid_signature",
      "invalid_signature",
      "invalid_signature",
      "invalid_signature",
      "invalid_amount",
      "not_found",
      "success",
      "already_confirmed",
    ]);
  });

  it("KICHBAN_KIEMTHU_418: tra cứu trạng thái đơn trên ZaloPay ký đúng, đọc thành công, thất bại, đang xử lý", async () => {
    const configuration = zalopayConfiguration()!;
    const createdAt = new Date("2026-11-11T18:30:00Z");
    gateway.queryReply = { return_code: 1, return_message: "Thành công", amount: 74000, zp_trans_id: 251112000000001, is_processing: false };
    expect(await queryOrder(configuration, "DH0001T01", createdAt)).toEqual({ state: "succeeded", amount: 74000, transactionNo: "251112000000001" });
    // Ngày trong mã giao dịch theo giờ Việt Nam (18:30 UTC là 01:30 ngày hôm sau).
    expect(gateway.queryRequests.at(-1)).toMatchObject({ app_id: appId, app_trans_id: "261112_DH0001T01" });
    gateway.queryReply = { return_code: 2, return_message: "Thất bại" };
    expect(await queryOrder(configuration, "DH0001T01", createdAt)).toEqual({ state: "failed", returnCode: 2 });
    gateway.queryReply = { return_code: 3, return_message: "Đang xử lý", is_processing: true };
    expect(await queryOrder(configuration, "DH0001T01", createdAt)).toEqual({ state: "processing", returnCode: 3 });
    expect(await queryOrder({ ...configuration, apiUrl: "http://127.0.0.1:1" }, "DH0001T01", createdAt)).toEqual({ state: "unknown", returnCode: null });
  });
});
