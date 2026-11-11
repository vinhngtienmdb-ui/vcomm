// CONG_VIEC_25 L0: phương thức thanh toán theo cổng, mở đặt hàng (KICHBAN_KIEMTHU_321).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareMarketplace, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
const vnpayVariables = ["VNPAY_TMN_CODE", "VNPAY_HASH_SECRET", "VNPAY_RETURN_URL"] as const;

beforeAll(async () => {
  for (const name of vnpayVariables) delete process.env[name];
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
});

afterAll(async () => {
  for (const name of vnpayVariables) delete process.env[name];
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_25 phương thức thanh toán, mở đặt hàng", () => {
  it("KICHBAN_KIEMTHU_321: bật tắt theo cổng; mở đặt hàng chỉ khi có phương thức bật; người mua chỉ chọn phương thức đang bật", async () => {
    const settings = await store.call("get", "/marketplace/store-settings");
    expect(settings.body.orderingOpen).toBe(false);
    // Chỉ so phương thức của COD, VNPAY: các cổng khác (CONG_VIEC_33 đến 39) thêm phương thức vào danh mục.
    expect(settings.body.paymentMethods.filter((item: { gatewayCode: string }) => ["cod", "vnpay"].includes(item.gatewayCode))).toEqual([
      { code: "cod", gatewayCode: "cod", isEnabled: true, isConfigured: true },
      { code: "vnpay_qr", gatewayCode: "vnpay", isEnabled: false, isConfigured: false },
      { code: "vnpay_atm", gatewayCode: "vnpay", isEnabled: false, isConfigured: false },
      { code: "vnpay_card", gatewayCode: "vnpay", isEnabled: false, isConfigured: false },
    ]);
    // Cổng chưa có thông tin kết nối thì không bật được; mã không có bị từ chối.
    expect((await store.call("put", "/marketplace/payment-methods/vnpay_qr", { isEnabled: true })).body.error.message).toBe(
      "Cổng thanh toán chưa có thông tin kết nối (mã website, khóa bí mật, địa chỉ trả về) trên máy chủ.",
    );
    expect((await store.call("put", "/marketplace/payment-methods/momo", { isEnabled: true })).status).toBe(404);

    // Người mua thường: chưa mở đặt hàng thì không đặt được.
    await store.register("0934000001", "Người Mua Thường");
    const buyer = await store.buyerSession("0934000001");
    const addressId = await store.addressOf(buyer);
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const closed = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    expect(closed.body).toMatchObject({ canOrder: false, paymentMethods: ["cod"], total: "74000" });
    expect((await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "74000", paymentMethod: "cod" })).body.error.message).toBe("VComm chưa mở đặt hàng trên ứng dụng.");
    expect((await buyer("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(403);

    // Không còn phương thức nào bật thì không mở được.
    expect((await store.call("put", "/marketplace/payment-methods/cod", { isEnabled: false })).body.paymentMethods[0].isEnabled).toBe(false);
    expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).body.error.message).toBe(
      "Đang mở đặt hàng nên phải còn ít nhất một phương thức thanh toán đang bật. Tắt đặt hàng trước hoặc bật phương thức khác.",
    );
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines })).body).toMatchObject({ canOrder: false, paymentMethods: [] });
    expect((await store.call("put", "/marketplace/payment-methods/cod", { isEnabled: true })).status).toBe(200);
    const opened = await store.call("put", "/marketplace/ordering-open", { orderingOpen: true });
    expect(opened.status, JSON.stringify(opened.body)).toBe(200);
    expect(opened.body.orderingOpen).toBe(true);
    // Đang mở: không tắt được phương thức cuối cùng.
    expect((await store.call("put", "/marketplace/payment-methods/cod", { isEnabled: false })).status).toBe(409);
    expect((await store.call("get", "/marketplace/store-settings")).body.paymentMethods[0].isEnabled).toBe(true);

    // Có thông tin kết nối VNPAY: bật được, người mua thấy theo thứ tự.
    Object.assign(process.env, { VNPAY_TMN_CODE: "VCOMMTST", VNPAY_HASH_SECRET: "BIMATKIEMTHU0123456789", VNPAY_RETURN_URL: "http://localhost:4000/api/v1/public/payments/vnpay/return" });
    const enabled = await store.call("put", "/marketplace/payment-methods/vnpay_qr", { isEnabled: true });
    expect(enabled.body.paymentMethods[1]).toEqual({ code: "vnpay_qr", gatewayCode: "vnpay", isEnabled: true, isConfigured: true });
    const open = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    expect(open.body).toMatchObject({ canOrder: true, paymentMethods: ["cod", "vnpay_qr"] });
    // Phương thức đang tắt bị từ chối.
    expect((await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "74000", paymentMethod: "vnpay_atm" })).body.error.message).toBe(
      "Phương thức thanh toán này hiện không dùng được. Chọn phương thức khác.",
    );
    // Mất thông tin kết nối: phương thức của cổng đó không hiện cho người mua.
    for (const name of vnpayVariables) delete process.env[name];
    expect((await buyer("post", "/buyer/orders/preview", { addressId, lines })).body.paymentMethods).toEqual(["cod"]);

    // Người mua thường đặt được đơn thanh toán khi nhận hàng; không gửi phương thức thì mặc định khi nhận hàng.
    const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: "74000" });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body).toMatchObject({ status: "awaiting_shipment", paymentMethod: "cod", total: "74000" });
    const row = (await pool.query("SELECT payment_method, cod_amount::int FROM marketplace.orders WHERE id = $1", [placed.body.id])).rows[0];
    expect(row).toEqual({ payment_method: "cod", cod_amount: 74000 });
    // Đóng đặt hàng.
    expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: false })).body.orderingOpen).toBe(false);
    const audits = (await pool.query("SELECT action FROM core.audit_events WHERE action IN ('marketplace.payment_method.update', 'marketplace.ordering_open.update') ORDER BY occurred_at")).rows;
    expect(audits.map((audit) => audit.action)).toEqual([
      "marketplace.payment_method.update",
      "marketplace.payment_method.update",
      "marketplace.ordering_open.update",
      "marketplace.payment_method.update",
      "marketplace.ordering_open.update",
    ]);
  });
});
