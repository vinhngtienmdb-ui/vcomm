// CONG_VIEC_25 L3: hoàn tiền (KICHBAN_KIEMTHU_324).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareMarketplace, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let buyer: BuyerCall;
let addressId: string;
let ghn: GhnMock;
const webhookKey = "khoa-webhook-kiem-thu-hoan-0123456789";
const webhook = (trackingCode: string) => request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: trackingCode });

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0937000001", "Người Mua Trả Hàng");
  buyer = await store.buyerSession("0937000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_25 hoàn tiền", () => {
  it("KICHBAN_KIEMTHU_324: nhận hàng trả lập việc hoàn đúng số tiền; người mua nhập tài khoản; kế toán ghi đã hoàn; phân quyền", async () => {
    // Hai kem 500.000 (miễn phí giao), một xà phòng 44.000: tổng 544.000 thu hộ.
    const lines = [
      { variantId: store.variants.cream, quantity: 2 },
      { variantId: store.variants.soap, quantity: 1 },
    ];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    expect(preview.body).toMatchObject({ goodsAmount: "544000", shippingFee: "0" });
    const placed = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total })).body;
    const shipped = (await store.call("post", `/marketplace/orders/${placed.id}/ship`, { carrierCode: "ghn", version: placed.version })).body;
    ghn.orders.set(shipped.trackingCode, { status: "delivered", codCollectDate: "2026-11-11T03:00:00Z" });
    expect((await webhook(shipped.trackingCode)).body.result).toBe("applied");
    const delivered = (await buyer("get", `/buyer/orders/${placed.id}`)).body;
    expect(delivered).toMatchObject({ status: "delivered", paymentStatus: "paid", refunds: [], needsBankAccount: false });

    // Trả một kem.
    const creamLine = delivered.lines.find((line: { variantId: string }) => line.variantId === store.variants.cream);
    const created = await buyer("post", `/buyer/orders/${placed.id}/return-requests`, {
      reason: "defective",
      description: "Nắp hộp bị nứt",
      lines: [{ orderLineId: creamLine.orderLineId, quantity: 1 }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const requestId = created.body[0].id as string;
    const approved = await store.call("post", `/marketplace/return-requests/${requestId}/approve`, { note: null, version: 1 });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const received = await store.call("post", `/marketplace/return-requests/${requestId}/receive`, { note: null, version: approved.body.version });
    expect(received.status, JSON.stringify(received.body)).toBe(200);
    const withRefund = (await buyer("get", `/buyer/orders/${placed.id}`)).body;
    expect(withRefund).toMatchObject({ paymentStatus: "refund_pending", needsBankAccount: true });
    expect(withRefund.refunds).toEqual([{ amount: "250000", reason: "return_received", status: "pending", refundedOn: null }]);

    // Tài khoản nhận hoàn tiền.
    expect((await buyer("get", "/buyer/bank-account")).body).toEqual({ bankAccount: null });
    const invalid = await buyer("put", "/buyer/bank-account", { bankName: "Vietcombank", accountNumber: "12AB", accountHolder: "NGUYEN VAN A" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.fields.accountNumber).toBeTruthy();
    const account = { bankName: "Vietcombank", accountNumber: "0123456789", accountHolder: "NGUYEN VAN A" };
    expect((await buyer("put", "/buyer/bank-account", account)).body).toEqual({ bankAccount: account });
    expect((await buyer("get", `/buyer/orders/${placed.id}`)).body.needsBankAccount).toBe(false);

    // Phân quyền: người mua không xem được danh sách hoàn tiền.
    expect((await buyer("get", "/marketplace/refunds")).status).toBe(403);
    const pending = await store.call("get", "/marketplace/refunds");
    expect(pending.status, JSON.stringify(pending.body)).toBe(200);
    const item = pending.body.data.find((refund: { orderId: string }) => refund.orderId === placed.id);
    expect(item).toMatchObject({ amount: "250000", reason: "return_received", status: "pending", bankAccount: account, buyerPhone: "0937000001", documentNo: placed.documentNo });

    // Ghi đã hoàn: ngày tương lai, sai phiên bản bị từ chối.
    expect((await store.call("post", `/marketplace/refunds/${item.id}/complete`, { bankTransactionNo: "FT2611110001", refundedOn: "2999-01-01", note: null, version: item.version })).status).toBe(400);
    expect((await store.call("post", `/marketplace/refunds/${item.id}/complete`, { bankTransactionNo: "FT2611110001", refundedOn: store.today, note: null, version: item.version + 1 })).status).toBe(
      409,
    );
    const completed = await store.call("post", `/marketplace/refunds/${item.id}/complete`, { bankTransactionNo: "FT2611110001", refundedOn: store.today, note: "Đã chuyển", version: item.version });
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect(completed.body).toMatchObject({ status: "completed", bankTransactionNo: "FT2611110001", refundedOn: store.today, note: "Đã chuyển" });
    const again = await store.call("post", `/marketplace/refunds/${item.id}/complete`, { bankTransactionNo: "FT2", refundedOn: store.today, note: null, version: completed.body.version });
    expect(again.body.error.message).toBe("Việc hoàn tiền không còn chờ xử lý.");
    const after = (await buyer("get", `/buyer/orders/${placed.id}`)).body;
    expect(after).toMatchObject({ paymentStatus: "partially_refunded", refundedAmount: "250000", paidAmount: "544000" });
    expect(after.refunds[0]).toMatchObject({ status: "completed", refundedOn: store.today });
    expect(after.events.at(-1)).toMatchObject({ status: "refunded", note: "250000" });
    expect((await store.call("get", "/marketplace/refunds?status=completed")).body.data.map((refund: { id: string }) => refund.id)).toContain(item.id);
    const notice = (await pool.query("SELECT title FROM core.notifications WHERE kind = 'marketplace_refund.completed' ORDER BY created_at DESC LIMIT 1")).rows[0];
    expect(notice.title).toBe("VComm đã hoàn tiền cho đơn hàng của bạn");
  });
});
