// CONG_VIEC_25 L2: đối soát COD theo API GHN, ghi tay đã thu tiền thu hộ (KICHBAN_KIEMTHU_327).
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
const webhookKey = "khoa-webhook-kiem-thu-cod-0123456789";

const webhook = (trackingCode: string) => request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: trackingCode, Type: "switch_status" });

async function shippedCodOrder(): Promise<{ id: string; trackingCode: string; total: string }> {
  const lines = [{ variantId: store.variants.cream, quantity: 1 }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const shipped = await store.call("post", `/marketplace/orders/${placed.body.id}/ship`, { carrierCode: "ghn", version: placed.body.version });
  expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
  return { id: placed.body.id, trackingCode: shipped.body.trackingCode, total: placed.body.total };
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await store.register("0936000001", "Người Mua COD");
  buyer = await store.buyerSession("0936000001");
  addressId = await store.addressOf(buyer);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_25 đối soát COD", () => {
  it("KICHBAN_KIEMTHU_327: GHN báo đã thu tiền người mua thì đơn tự ghi đã thu một lần; ghi tay đã thu có phân quyền", async () => {
    // Đơn 250.000 + phí 30.000 = 280.000, thu hộ toàn bộ.
    const first = await shippedCodOrder();
    expect(first.total).toBe("280000");
    ghn.orders.set(first.trackingCode, { status: "picked", codCollectDate: null });
    expect((await webhook(first.trackingCode)).body.result).toBe("applied");
    let detail = (await buyer("get", `/buyer/orders/${first.id}`)).body;
    expect(detail).toMatchObject({ status: "shipping", paymentStatus: "unpaid", paidAmount: "0" });
    ghn.orders.set(first.trackingCode, { status: "delivered", codCollectDate: "2026-11-11T03:15:00Z" });
    expect((await webhook(first.trackingCode)).body.result).toBe("applied");
    detail = (await buyer("get", `/buyer/orders/${first.id}`)).body;
    expect(detail).toMatchObject({ status: "delivered", paymentStatus: "paid", paidAmount: "280000" });
    // Nhận lại không ghi thêm.
    expect((await webhook(first.trackingCode)).body.result).toBe("applied");
    const events = (await buyer("get", `/buyer/orders/${first.id}`)).body.events.map((event: { status: string; note: string | null }) => [event.status, event.note]);
    expect(events.filter(([status]: [string]) => status === "paid")).toEqual([["paid", "GHN: COD"]]);
    expect((await pool.query("SELECT paid_at FROM marketplace.orders WHERE id = $1", [first.id])).rows[0].paid_at.toISOString()).toBe("2026-11-11T03:15:00.000Z");
    expect((await store.call("get", `/marketplace/orders/${first.id}`)).body.canRecordCod).toBe(false);

    // GHN chưa báo thu: kế toán ghi tay kèm số phiên đối soát.
    const second = await shippedCodOrder();
    ghn.orders.set(second.trackingCode, { status: "delivered", codCollectDate: null });
    expect((await webhook(second.trackingCode)).body.result).toBe("applied");
    const before = (await store.call("get", `/marketplace/orders/${second.id}`)).body;
    expect(before).toMatchObject({ status: "delivered", paymentStatus: "unpaid", canRecordCod: true });
    // Người mua không có quyền.
    expect((await buyer("post", `/marketplace/orders/${second.id}/cod-collected`, { collectedOn: store.today, reference: "PH01", version: before.version })).status).toBe(403);
    const future = await store.call("post", `/marketplace/orders/${second.id}/cod-collected`, { collectedOn: "2999-01-01", reference: "PH01", version: before.version });
    expect(future.status).toBe(400);
    expect((await store.call("post", `/marketplace/orders/${second.id}/cod-collected`, { collectedOn: store.today, reference: "PH01", version: before.version + 1 })).status).toBe(409);
    const recorded = await store.call("post", `/marketplace/orders/${second.id}/cod-collected`, { collectedOn: store.today, reference: "PH01", version: before.version });
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(200);
    expect(recorded.body).toMatchObject({ paymentStatus: "paid", paidAmount: "280000", canRecordCod: false, canCancel: false });
    expect(recorded.body.events.at(-1)).toMatchObject({ status: "paid", note: "COD · PH01" });
    const again = await store.call("post", `/marketplace/orders/${second.id}/cod-collected`, { collectedOn: store.today, reference: "PH02", version: recorded.body.version });
    expect(again.body.error.message).toBe("Đơn không thanh toán khi nhận hàng, chưa giao cho đơn vị vận chuyển hoặc đã ghi đã thu.");
    // GHN báo thu sau khi đã ghi tay: không ghi thêm.
    ghn.orders.set(second.trackingCode, { status: "delivered", codCollectDate: "2026-11-11T05:00:00Z" });
    expect((await webhook(second.trackingCode)).body.result).toBe("applied");
    expect((await store.call("get", `/marketplace/orders/${second.id}`)).body.paidAmount).toBe("280000");
    // Đơn chưa giao cho đơn vị vận chuyển không ghi được.
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    const waiting = (await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total })).body;
    expect((await store.call("get", `/marketplace/orders/${waiting.id}`)).body.canRecordCod).toBe(false);
    expect((await store.call("post", `/marketplace/orders/${waiting.id}/cod-collected`, { collectedOn: store.today, reference: "PH03", version: waiting.version })).status).toBe(409);
  });
});
