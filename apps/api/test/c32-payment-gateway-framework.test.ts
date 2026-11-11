// CONG_VIEC_32: khung nhiều cổng thanh toán (KICHBAN_KIEMTHU_376 đến 378): cổng chuyển khoản giả lập đăng ký vào danh sách, đường dẫn nhận kết quả chung.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../src/marketplace/payments/payment-gateway";
import { paymentGateways } from "../src/marketplace/payments/payment-gateway-registry";
import { prepareMarketplace, type BuyerCall, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

// Cổng chuyển khoản giả lập: xác thực bằng khóa trong tiêu đề, nội dung JSON.
class TestTransferGateway implements PaymentGatewayAdapter {
  readonly code = "kiemthu" as never;
  configured() {
    return true;
  }
  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    return {
      kind: "transfer",
      transfer: { bankName: "Ngân hàng thử", accountNumber: "0123456789", accountName: "VCOMM", amount: String(input.amount), content: input.reference, qrData: "000201", qrImageUrl: null },
    };
  }
  async verify(incoming: GatewayRequest): Promise<GatewayNotification | null> {
    if (incoming.headers["x-khoa"] !== "khoa-kiem-thu") return null;
    const body = incoming.body as { reference: string; amount: number; transactionId: string };
    return { reference: body.reference, amount: body.amount, success: true, responseCode: "OK", transactionNo: body.transactionId, bankCode: null };
  }
  reply(outcome: NotificationOutcome) {
    return { status: outcome === "invalid_signature" ? 401 : 200, body: { result: outcome } };
  }
}

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;

beforeAll(async () => {
  paymentGateways.push(new TestTransferGateway());
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  await pool.query("INSERT INTO marketplace.payment_methods (code, gateway_code, sort_order, is_enabled) VALUES ('kiemthu_chuyen_khoan', 'kiemthu', 90, true) ON CONFLICT DO NOTHING");
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0940000001", "Người Mua Chuyển Khoản");
  buyer = await store.buyerSession("0940000001");
});

afterAll(async () => {
  paymentGateways.splice(
    paymentGateways.findIndex((gateway) => gateway.code === ("kiemthu" as never)),
    1,
  );
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_32 khung nhiều cổng thanh toán", () => {
  it("KICHBAN_KIEMTHU_376 đến 378: phương thức của cổng mới hiện cho người mua; mở thanh toán trả hướng dẫn chuyển khoản; đường dẫn chung xác thực, ghi nhận một lần; cổng không có trả 404", async () => {
    const addressId = await store.addressOf(buyer);
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    expect(preview.body.paymentMethods).toContain("kiemthu_chuyen_khoan");
    const settings = (await store.call("get", "/marketplace/store-settings")).body;
    expect(settings.paymentMethods.find((item: { code: string }) => item.code === "kiemthu_chuyen_khoan")).toMatchObject({ gatewayCode: "kiemthu", isEnabled: true, isConfigured: true });
    const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "kiemthu_chuyen_khoan" });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body.status).toBe("awaiting_payment");
    const started = await buyer("post", `/buyer/orders/${placed.body.id}/payments`);
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    expect(started.body.paymentUrl).toBeNull();
    expect(started.body.transfer).toMatchObject({ bankName: "Ngân hàng thử", amount: "74000", qrData: "000201" });
    const reference = started.body.transfer.content as string;

    const notify = (headers: Record<string, string>, body: object) => request(application.getHttpServer()).post("/api/v1/public/payments/kiemthu/notify").set(headers).send(body);
    expect((await notify({ "x-khoa": "sai" }, { reference, amount: 74000, transactionId: "GD1" })).status).toBe(401);
    expect((await notify({ "x-khoa": "khoa-kiem-thu" }, { reference, amount: 1000, transactionId: "GD1" })).body).toEqual({ result: "invalid_amount" });
    expect((await notify({ "x-khoa": "khoa-kiem-thu" }, { reference, amount: 74000, transactionId: "GD1" })).body).toEqual({ result: "success" });
    expect((await notify({ "x-khoa": "khoa-kiem-thu" }, { reference, amount: 74000, transactionId: "GD1" })).body).toEqual({ result: "already_confirmed" });
    const detail = (await buyer("get", `/buyer/orders/${placed.body.id}`)).body;
    expect(detail).toMatchObject({ status: "awaiting_shipment", paymentStatus: "paid", paidAmount: "74000" });
    expect(detail.events.at(-1)).toMatchObject({ status: "paid", note: "KIEMTHU GD1" });
    // Số tham chiếu của cổng khác không khớp cổng này.
    expect((await request(application.getHttpServer()).post("/api/v1/public/payments/khongco/notify").send({})).status).toBe(404);
    const logged = (await pool.query("SELECT result_code FROM marketplace.payment_notifications WHERE gateway_code = 'kiemthu' ORDER BY received_at")).rows.map((row) => row.result_code);
    expect(logged).toEqual(["invalid_signature", "invalid_amount", "success", "already_confirmed"]);
  });
});
