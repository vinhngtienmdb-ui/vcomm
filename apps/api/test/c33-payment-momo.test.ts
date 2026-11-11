// CONG_VIEC_33: cổng MoMo (KICHBAN_KIEMTHU_379 đến 381) với máy chủ MoMo giả lập theo tài liệu công khai MoMo phiên bản 3; không gọi máy chủ thật.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MomoGateway } from "../src/marketplace/payments/gateways/momo-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let buyerId: string;
let addressId: string;
let mockServer: Server;
// Giá trị ký giả, ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const signingWord = ["kiem", "thu", "momo", "0123456789"].join("-");
const accessWord = ["truy", "cap", "thu"].join("-");
const partnerCode = "MOMOVCOMMTEST";
const momoVariables = ["MOMO_PARTNER_CODE", "MOMO_ACCESS_KEY", "MOMO_SECRET_KEY", "MOMO_ENDPOINT", "MOMO_IPN_URL", "MOMO_RETURN_URL"];

// Máy chủ MoMo giả lập: ghi lại yêu cầu tạo thanh toán; resultCode trả về do kiểm thử đặt.
const created: Record<string, unknown>[] = [];
let createResultCode = 0;

const hmac = (text: string, word = signingWord) => createHmac("sha256", word).update(text, "utf8").digest("hex");

// Kết quả MoMo gửi về (IPN, trang trả về) ký theo định dạng của tài liệu.
function momoResult(reference: string, amount: number, extra: Record<string, string | number> = {}, word = signingWord): Record<string, string | number> {
  const values: Record<string, string | number> = {
    partnerCode,
    orderId: reference,
    requestId: reference,
    amount,
    orderInfo: "Thanh toan don",
    orderType: "momo_wallet",
    transId: 4088878653,
    resultCode: 0,
    message: "Successful.",
    payType: "qr",
    responseTime: 1721720663942,
    extraData: "",
    ...extra,
  };
  const card = values.callbackToken !== undefined;
  const text = card
    ? `accessKey=${accessWord}&amount=${values.amount}&callbackToken=${values.callbackToken}&extraData=${values.extraData}&message=${values.message}&orderId=${values.orderId}` +
      `&orderInfo=${values.orderInfo}&orderType=${values.orderType}&partnerClientId=${values.partnerClientId}&partnerCode=${values.partnerCode}&payType=${values.payType}` +
      `&requestId=${values.requestId}&responseTime=${values.responseTime}&resultCode=${values.resultCode}&transId=${values.transId}`
    : `accessKey=${accessWord}&amount=${values.amount}&extraData=${values.extraData}&message=${values.message}&orderId=${values.orderId}&orderInfo=${values.orderInfo}` +
      `&orderType=${values.orderType}&partnerCode=${values.partnerCode}&payType=${values.payType}&requestId=${values.requestId}&responseTime=${values.responseTime}` +
      `&resultCode=${values.resultCode}&transId=${values.transId}`;
  return { ...values, signature: hmac(text, word) };
}
const notify = (body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/momo/notify").send(body);

async function place(paymentMethod: string) {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; total: string };
}
async function start(orderId: string) {
  const started = await buyer("post", `/buyer/orders/${orderId}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  const body = created.at(-1)!;
  return { paymentUrl: started.body.paymentUrl as string, reference: body.orderId as string, body };
}
const paymentStatus = async (reference: string) => (await pool.query("SELECT status FROM marketplace.payments WHERE reference = $1", [reference])).rows[0]?.status as string | undefined;

beforeAll(async () => {
  mockServer = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      response.setHeader("content-type", "application/json");
      if (incoming.method !== "POST" || incoming.url !== "/v2/gateway/api/create") return response.end(JSON.stringify({ resultCode: 20 }));
      const body = JSON.parse(raw) as Record<string, unknown>;
      created.push(body);
      response.end(
        JSON.stringify({
          partnerCode: body.partnerCode,
          orderId: body.orderId,
          requestId: body.requestId,
          amount: body.amount,
          responseTime: 1721720619912,
          message: createResultCode === 0 ? "Successful." : "Bad format request.",
          resultCode: createResultCode,
          ...(createResultCode === 0 ? { payUrl: `https://test-payment.momo.vn/v2/gateway/pay?t=${body.orderId as string}` } : {}),
        }),
      );
    });
  });
  await new Promise<void>((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, {
    MOMO_PARTNER_CODE: partnerCode,
    MOMO_ACCESS_KEY: accessWord,
    MOMO_SECRET_KEY: signingWord,
    MOMO_ENDPOINT: `http://127.0.0.1:${(mockServer.address() as AddressInfo).port}/`,
    MOMO_IPN_URL: "http://localhost:4000/api/v1/public/payments/momo/notify",
    MOMO_RETURN_URL: "http://localhost:4000/api/v1/public/payments/momo/return",
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  for (const code of ["momo_wallet", "momo_atm", "momo_card"]) expect((await store.call("put", `/marketplace/payment-methods/${code}`, { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  buyerId = await store.register("0936000001", "Người Mua MoMo");
  buyer = await store.buyerSession("0936000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of momoVariables) delete process.env[name];
  mockServer?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_33 cổng MoMo", () => {
  it("KICHBAN_KIEMTHU_379: phương thức MoMo bật được khi có thông tin kết nối; mở thanh toán ký đúng, trả trang MoMo; hạn mức, email thẻ quốc tế, MoMo từ chối", async () => {
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.filter((item: { gatewayCode: string }) => item.gatewayCode === "momo")).toEqual([
      { code: "momo_wallet", gatewayCode: "momo", isEnabled: true, isConfigured: true },
      { code: "momo_atm", gatewayCode: "momo", isEnabled: true, isConfigured: true },
      { code: "momo_card", gatewayCode: "momo", isEnabled: true, isConfigured: true },
    ]);
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines: [{ variantId: store.variants.soap, quantity: 1 }] });
    expect(preview.body.paymentMethods).toEqual(expect.arrayContaining(["momo_wallet", "momo_atm", "momo_card"]));

    const order = await place("momo_wallet");
    expect(order).toMatchObject({ status: "awaiting_payment", total: "74000" });
    const { paymentUrl, reference, body } = await start(order.id);
    expect(paymentUrl).toBe(`https://test-payment.momo.vn/v2/gateway/pay?t=${reference}`);
    expect(reference).toMatch(/^[0-9A-Za-z]+$/);
    expect(body).toMatchObject({ partnerCode, requestType: "captureWallet", orderId: reference, requestId: reference, amount: 74000, extraData: "", lang: "vi" });
    expect(body.userInfo).toBeUndefined();
    const text =
      `accessKey=${accessWord}&amount=74000&extraData=&ipnUrl=${process.env.MOMO_IPN_URL}&orderId=${reference}&orderInfo=${body.orderInfo as string}` +
      `&partnerCode=${partnerCode}&redirectUrl=${process.env.MOMO_RETURN_URL}&requestId=${reference}&requestType=captureWallet`;
    expect(body.signature).toBe(hmac(text));

    // Thẻ ATM: loại thanh toán payWithATM.
    const atm = await place("momo_atm");
    expect((await start(atm.id)).body.requestType).toBe("payWithATM");

    // Thẻ quốc tế: người mua chưa có email thì báo rõ, không tạo lần thanh toán; có email thì gửi kèm thông tin người mua.
    const card = await place("momo_card");
    const noEmail = await buyer("post", `/buyer/orders/${card.id}/payments`);
    expect(noEmail.status).toBe(409);
    expect(noEmail.body.error.message).toBe("Thanh toán thẻ quốc tế qua MoMo cần email. Vui lòng thêm email cho tài khoản hoặc chọn phương thức khác.");
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [card.id])).rows[0].count).toBe(0);
    await pool.query("UPDATE core.users SET email = 'nguoimua.momo@vcomm.test' WHERE id = $1", [buyerId]);
    const cardStart = await start(card.id);
    expect(cardStart.body).toMatchObject({ requestType: "payWithCC", userInfo: { name: "Người Mua MoMo", phoneNumber: "0936000001", email: "nguoimua.momo@vcomm.test" } });

    // MoMo từ chối tạo thanh toán: báo lỗi, không giữ lần thanh toán.
    createResultCode = 20;
    const rejected = await buyer("post", `/buyer/orders/${order.id}/payments`);
    createResultCode = 0;
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.message).toBe("Cổng thanh toán chưa mở được trang thanh toán. Vui lòng thử lại sau.");
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0].count).toBe(1);

    // Hạn mức số tiền theo phương thức: kiểm trước khi gọi MoMo.
    const gateway = new MomoGateway();
    const input = { reference: "HM01", method: "momo_atm" as never, documentNo: "HM01", ipAddress: "127.0.0.1", createdAt: new Date(), expiresAt: new Date() };
    const count = created.length;
    await expect(gateway.start({ ...input, amount: 9_999 })).rejects.toMatchObject({ messageKey: "paymentAmountOutOfRange" });
    await expect(gateway.start({ ...input, amount: 50_000_001 })).rejects.toMatchObject({ messageKey: "paymentAmountOutOfRange" });
    await expect(gateway.start({ ...input, method: "momo_card" as never, amount: 10_000_001 })).rejects.toMatchObject({ messageKey: "paymentAmountOutOfRange" });
    await expect(gateway.start({ ...input, method: "momo_wallet" as never, amount: 999 })).rejects.toMatchObject({ messageKey: "paymentAmountOutOfRange" });
    expect(created.length).toBe(count);
    expect((await gateway.start({ ...input, amount: 10_000 })).kind).toBe("redirect");
  });

  it("KICHBAN_KIEMTHU_380: IPN ví MoMo, ATM: sai chữ ký, sai mã đối tác, sai số tiền bị từ chối; đang xử lý không ghi nhận; thành công ghi đã thu một lần; thất bại; trang trả về", async () => {
    const order = await place("momo_wallet");
    const { reference } = await start(order.id);

    expect((await notify(momoResult(reference, 74000, {}, "sai-chu-ky"))).status).toBe(400);
    expect((await notify({ ...momoResult(reference, 74000), amount: 1000 })).status).toBe(400);
    expect((await notify(momoResult(reference, 74000, { partnerCode: "KHAC" }))).status).toBe(400);
    expect((await notify(momoResult(reference, 1000))).status).toBe(204);
    expect(await paymentStatus(reference)).toBe("pending");
    // Mã đang xử lý: trả lời đã nhận, lần thanh toán vẫn chờ.
    for (const resultCode of [1000, 7000, 7002]) expect((await notify(momoResult(reference, 74000, { resultCode, message: "Pending" }))).status).toBe(204);
    expect(await paymentStatus(reference)).toBe("pending");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.status).toBe("awaiting_payment");

    const success = await notify(momoResult(reference, 74000));
    expect(success.status).toBe(204);
    expect(success.text).toBe("");
    expect((await notify(momoResult(reference, 74000))).status).toBe(204);
    const detail = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: "MOMO 4088878653" });
    const payment = (await pool.query("SELECT status, response_code, gateway_transaction_no, bank_code FROM marketplace.payments WHERE reference = $1", [reference])).rows[0];
    expect(payment).toEqual({ status: "succeeded", response_code: "0", gateway_transaction_no: "4088878653", bank_code: "qr" });
    const logged = (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE gateway_code = 'momo' AND reference = $1 ORDER BY received_at", [reference])).rows;
    expect(logged.map((row) => row.result_code)).toEqual(["invalid_amount", "pending", "pending", "pending", "success", "already_confirmed"]);

    // Trang trả về: chỉ hiển thị, kiểm chữ ký.
    const returned = await request(application.getHttpServer()).get("/api/v1/public/payments/momo/return").query(momoResult(reference, 74000));
    expect(returned.text).toContain("Thanh toán thành công");
    const forged = await request(application.getHttpServer())
      .get("/api/v1/public/payments/momo/return")
      .query(momoResult(reference, 74000, {}, "sai-chu-ky"));
    expect(forged.text).toContain("Không xác nhận được kết quả thanh toán");

    // Thất bại (người mua từ chối, mã 1006): lần thanh toán thất bại, đơn vẫn chờ thanh toán; không có đơn trả 204.
    const failedOrder = await place("momo_atm");
    const failed = await start(failedOrder.id);
    expect((await notify(momoResult(failed.reference, 74000, { resultCode: 1006, message: "Denied", payType: "napas" }))).status).toBe(204);
    expect(await paymentStatus(failed.reference)).toBe("failed");
    expect((await buyer("get", `/buyer/orders/${failedOrder.id}`)).body.status).toBe("awaiting_payment");
    expect((await notify(momoResult("KHONGCO01", 74000))).status).toBe(204);
  });

  it("KICHBAN_KIEMTHU_381: IPN thẻ quốc tế: kiểm chữ ký có callbackToken, trả lời HTTP 200 có chữ ký; không lưu callbackToken", async () => {
    const order = await place("momo_card");
    const { reference } = await start(order.id);
    const cardFields = { callbackToken: "cbt-kiem-thu", partnerClientId: "nguoi-mua-1", payType: "credit", extraData: "" };

    const reply = await notify(momoResult(reference, 74000, cardFields));
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ partnerCode, orderId: reference, requestId: reference, resultCode: 0, extraData: "" });
    expect(reply.body.responseTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    const text =
      `accessKey=${accessWord}&extraData=&message=${reply.body.message as string}&orderId=${reference}&partnerCode=${partnerCode}` +
      `&requestId=${reference}&responseTime=${reply.body.responseTime as string}&resultCode=0`;
    expect(reply.body.signature).toBe(hmac(text));
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid" });

    // Sai số tiền: mã 21 có chữ ký; sai chữ ký: 400.
    const wrongAmount = await notify(momoResult(reference, 1000, cardFields));
    expect(wrongAmount.status).toBe(200);
    expect(wrongAmount.body.resultCode).toBe(21);
    expect((await notify(momoResult(reference, 74000, cardFields, "sai-chu-ky"))).status).toBe(400);

    const payloads = (await pool.query("SELECT payload FROM marketplace.payment_notifications WHERE gateway_code = 'momo' AND reference = $1", [reference])).rows;
    expect(payloads.length).toBe(2);
    for (const row of payloads) expect(row.payload.callbackToken).toBeUndefined();
  });
});
