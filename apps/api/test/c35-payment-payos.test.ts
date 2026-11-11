// CONG_VIEC_35: cổng PayOS (KICHBAN_KIEMTHU_387 đến 390): tạo link, VietQR, webhook ký HMAC-SHA256, trang trả về; máy chủ PayOS giả lập theo tài liệu công khai.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { payosDataSignature } from "../src/marketplace/payments/gateways/payos-gateway";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

// Khóa giả ghép lúc chạy để công cụ quét bí mật không báo nhầm.
const checksum = ["kiem", "tra", "payos", "0123456789"].join("-");
const clientId = "client-kiem-thu";
const apiCredential = ["api", "kiem", "thu"].join("-");
const qrData = "00020101021238570010A000000727012700069704220113VQRQ0000000010208QRIBFTTA53037045404740005802VN62110807DHT01016304ABCD";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let payosServer: Server;
// Yêu cầu tạo link PayOS đã nhận; failNext: lần tạo kế tiếp PayOS báo lỗi.
const created: { headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
let failNext = false;

async function startPayosMock(): Promise<string> {
  payosServer = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const body = JSON.parse(raw || "{}") as Record<string, unknown>;
      response.setHeader("content-type", "application/json");
      if (incoming.method !== "POST" || incoming.url !== "/v2/payment-requests") return response.end(JSON.stringify({ code: "404", desc: "Not found", data: null }));
      created.push({ headers: incoming.headers, body });
      const signed = `amount=${body.amount}&cancelUrl=${body.cancelUrl}&description=${body.description}&orderCode=${body.orderCode}&returnUrl=${body.returnUrl}`;
      const signatureOk = createHmac("sha256", checksum).update(signed).digest("hex") === body.signature;
      if (failNext || !signatureOk || incoming.headers["x-api-key"] !== apiCredential) {
        failNext = false;
        return response.end(JSON.stringify({ code: "20", desc: "Thông tin truyền lên không đúng", data: null }));
      }
      response.end(
        JSON.stringify({
          code: "00",
          desc: "success",
          data: {
            bin: "970422",
            accountNumber: "VQRQ00000001",
            accountName: "CONG TY VCOMM",
            amount: body.amount,
            description: `CSPAYOS ${body.description}`,
            orderCode: body.orderCode,
            currency: "VND",
            paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
            status: "PENDING",
            checkoutUrl: "https://pay.payos.vn/web/124c33293c43417ab7879e14c8d9eb18",
            qrCode: qrData,
          },
          signature: "khong-kiem",
        }),
      );
    });
  });
  await new Promise<void>((resolve) => payosServer.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(payosServer.address() as AddressInfo).port}`;
}

// Webhook PayOS gửi về, ký data bằng khóa checksum (giả lập máy chủ PayOS).
function webhook(orderCode: number, amount: number, options: { code?: string; signWith?: string; tamper?: Record<string, unknown> } = {}) {
  const data: Record<string, unknown> = {
    orderCode,
    amount,
    description: "CSPAYOS 0001T01",
    accountNumber: "VQRQ00000001",
    reference: "FT26315000001",
    transactionDateTime: "2026-11-11 10:30:00",
    currency: "VND",
    paymentLinkId: "124c33293c43417ab7879e14c8d9eb18",
    code: options.code ?? "00",
    desc: options.code && options.code !== "00" ? "failed" : "success",
    counterAccountBankId: "970436",
    counterAccountBankName: "",
    counterAccountName: null,
    counterAccountNumber: "",
    virtualAccountName: "",
    virtualAccountNumber: "",
  };
  const signature = payosDataSignature(data, options.signWith ?? checksum);
  const payload = { code: options.code ?? "00", desc: "success", success: (options.code ?? "00") === "00", data: { ...data, ...options.tamper }, signature };
  return request(application.getHttpServer()).post("/api/v1/public/payments/payos/notify").send(payload);
}
const returnPage = (query: Record<string, string>) => request(application.getHttpServer()).get("/api/v1/public/payments/payos/return").query(query);

async function placeOrder() {
  const lines = [{ variantId: store.variants.soap, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "payos_vietqr" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  return placed.body as { id: string; total: string; documentNo: string };
}
async function start(orderId: string) {
  const started = await buyer("post", `/buyer/orders/${orderId}/payments`);
  expect(started.status, JSON.stringify(started.body)).toBe(201);
  const payment = (await pool.query("SELECT reference, gateway_order_code FROM marketplace.payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1", [orderId])).rows[0];
  return { body: started.body, reference: payment.reference as string, orderCode: Number(payment.gateway_order_code) };
}

beforeAll(async () => {
  Object.assign(process.env, {
    PAYOS_CLIENT_ID: clientId,
    PAYOS_API_KEY: apiCredential,
    PAYOS_CHECKSUM_KEY: checksum,
    PAYOS_RETURN_URL: "http://localhost:4000/api/v1/public/payments/payos/return",
    PAYOS_BANK_NAME: "Ngân hàng Quân đội (MB)",
    PAYOS_API_URL: await startPayosMock(),
  });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/payment-methods/payos_vietqr", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0953500001", "Người Mua PayOS");
  buyer = await store.buyerSession("0953500001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  for (const name of ["PAYOS_CLIENT_ID", "PAYOS_API_KEY", "PAYOS_CHECKSUM_KEY", "PAYOS_RETURN_URL", "PAYOS_BANK_NAME", "PAYOS_API_URL"]) delete process.env[name];
  payosServer?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_35 cổng PayOS", () => {
  it("KICHBAN_KIEMTHU_387: mở thanh toán tạo link PayOS ký đúng, trả thông tin chuyển khoản và chuỗi VietQR; mã đơn số lưu cùng lần thanh toán", async () => {
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.find((item: { code: string }) => item.code === "payos_vietqr")).toMatchObject({ gatewayCode: "payos", isEnabled: true, isConfigured: true });
    const order = await placeOrder();
    const { body, reference, orderCode } = await start(order.id);
    expect(reference).toBe(`${order.documentNo.replace(/[^A-Za-z0-9]/g, "")}T01`);
    expect(Number.isSafeInteger(orderCode) && orderCode > 0).toBe(true);
    const sent = created.at(-1)!;
    expect(sent.headers).toMatchObject({ "x-client-id": clientId, "x-api-key": apiCredential });
    expect(sent.body).toMatchObject({ orderCode, amount: 74000, description: reference.slice(-9), returnUrl: process.env.PAYOS_RETURN_URL, cancelUrl: process.env.PAYOS_RETURN_URL });
    expect(sent.body.expiredAt).toBe(Math.floor(new Date(body.deadline).getTime() / 1000));
    expect(body.paymentUrl).toBeNull();
    expect(body.transfer).toEqual({
      bankName: "Ngân hàng Quân đội (MB)",
      accountNumber: "VQRQ00000001",
      accountName: "CONG TY VCOMM",
      amount: "74000",
      content: `CSPAYOS ${reference.slice(-9)}`,
      qrData,
      qrImageUrl: null,
    });
  });

  it("KICHBAN_KIEMTHU_388: webhook sai chữ ký, sửa dữ liệu bị từ chối; sai số tiền, mã đơn lạ không ghi nhận; đúng thì đã thu một lần, nhận trùng không ghi thêm", async () => {
    const order = await placeOrder();
    const { reference, orderCode } = await start(order.id);
    expect((await webhook(orderCode, 74000, { signWith: "khoa-sai" })).status).toBe(400);
    const tampered = await webhook(orderCode, 1000, { tamper: { amount: 74000 } });
    expect(tampered.status).toBe(400);
    expect(tampered.body).toEqual({ success: false, message: "Invalid signature" });
    expect((await webhook(orderCode, 1000)).body).toEqual({ success: true, message: "Invalid amount" });
    // Bản thử khi đăng ký webhook trên trang PayOS: mã đơn 123 không tồn tại, vẫn trả 200.
    const probe = await webhook(123, 3000);
    expect(probe.status).toBe(200);
    expect(probe.body).toEqual({ success: true, message: "Order not found" });
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.status).toBe("awaiting_payment");

    const confirmed = await webhook(orderCode, 74000);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toEqual({ success: true, message: "Confirm Success" });
    const paid = (await buyer("get", `/buyer/orders/${order.id}`)).body;
    expect(paid).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(paid.events.at(-1)).toMatchObject({ status: "paid", note: "PAYOS FT26315000001" });
    expect((await webhook(orderCode, 74000)).body).toEqual({ success: true, message: "Order already confirmed" });
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.paidAmount).toBe("74000");
    const admin = (await store.call("get", `/marketplace/orders/${order.id}`)).body;
    expect(admin.payments).toEqual([expect.objectContaining({ reference, method: "payos_vietqr", amount: "74000", status: "succeeded", transactionNo: "FT26315000001", responseCode: "00" })]);
    const logged = (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE reference = $1 ORDER BY received_at", [reference])).rows.map((row) => row.result_code);
    expect(logged).toEqual(["invalid_amount", "success", "already_confirmed"]);
    const unsigned = (await pool.query("SELECT count(*)::int AS count FROM marketplace.payment_notifications WHERE gateway_code = 'payos' AND reference IS NULL AND result_code = 'invalid_signature'"))
      .rows[0];
    expect(unsigned.count).toBe(2);
  });

  it("KICHBAN_KIEMTHU_389: trang trả về không có chữ ký chỉ hiển thị; hủy thì báo không thành công; đã thu thì báo thành công theo cơ sở dữ liệu", async () => {
    const order = await placeOrder();
    const { orderCode } = await start(order.id);
    // Tham số giả mạo "PAID" không làm đơn thành đã thu.
    expect((await returnPage({ code: "00", id: "x", cancel: "false", status: "PAID", orderCode: String(orderCode) })).text).toContain("VComm đang chờ kết quả từ cổng thanh toán");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body.status).toBe("awaiting_payment");
    expect((await returnPage({ code: "00", id: "x", cancel: "true", status: "CANCELLED", orderCode: String(orderCode) })).text).toContain("Thanh toán không thành công");
    expect((await returnPage({ code: "00", orderCode: "999" })).text).toContain("Không xác nhận được kết quả thanh toán");
    expect((await returnPage({ code: "00", orderCode: "abc" })).text).toContain("Không xác nhận được kết quả thanh toán");
    expect((await webhook(orderCode, 74000)).body.message).toBe("Confirm Success");
    const paidPage = await returnPage({ code: "00", id: "x", cancel: "false", status: "PAID", orderCode: String(orderCode) });
    expect(paidPage.text).toContain("Thanh toán thành công");
    expect(paidPage.text).toContain(`don-hang/${order.id}`);
  });

  it("KICHBAN_KIEMTHU_390: PayOS báo lỗi khi tạo link thì không tính lần thanh toán; giao dịch thất bại giữ đơn chờ thanh toán; thiếu cấu hình không mở được", async () => {
    const order = await placeOrder();
    failNext = true;
    expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).status).toBe(500);
    expect((await pool.query("SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = $1", [order.id])).rows[0].count).toBe(0);
    const { reference, orderCode } = await start(order.id);
    expect(reference.endsWith("T01")).toBe(true);
    expect((await webhook(orderCode, 74000, { code: "01" })).body.message).toBe("Confirm Success");
    expect((await buyer("get", `/buyer/orders/${order.id}`)).body).toMatchObject({ status: "awaiting_payment", paymentStatus: "unpaid", canPay: true });
    expect((await pool.query("SELECT status FROM marketplace.payments WHERE reference = $1", [reference])).rows[0].status).toBe("failed");
    const retry = await start(order.id);
    expect(retry.reference.endsWith("T02")).toBe(true);
    expect(retry.orderCode).not.toBe(orderCode);

    const saved = process.env.PAYOS_CHECKSUM_KEY;
    delete process.env.PAYOS_CHECKSUM_KEY;
    try {
      expect((await buyer("post", `/buyer/orders/${order.id}/payments`)).body.error.message).toBe("Cổng thanh toán chưa có thông tin kết nối (mã website, khóa bí mật, địa chỉ trả về) trên máy chủ.");
      expect((await webhook(retry.orderCode, 74000)).status).toBe(500);
    } finally {
      process.env.PAYOS_CHECKSUM_KEY = saved;
    }
    expect((await webhook(retry.orderCode, 74000)).body.message).toBe("Confirm Success");
  });
});
