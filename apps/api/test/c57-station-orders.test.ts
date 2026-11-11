// CONG_VIEC_57 lát L2: đặt đơn VComm nhận tại trạm hoặc trạm giao (TIEUCHI_NGHIEMTHU_391, 392, 393, 401 phần đơn cũ; KICHBAN_KIEMTHU_561 đến 563).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { BuyerCall, MarketplaceFixture } from "./marketplace-fixture";
import type { RetailFixture } from "./retail-fixture";
import { prepareStations } from "./station-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let market: MarketplaceFixture;
let shop: RetailFixture;
let buyer: BuyerCall;
let nearAddress: string;
let farAddress: string;
let thuDuc: string;
let quanMot: string;

const cream = (quantity: number) => [{ variantId: market.variants.cream, quantity }];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  ({ market, shop, buyer, nearAddress, farAddress, thuDuc, quanMot } = await prepareStations(application, pool));
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Danh sách trạm khi đặt (KICHBAN_KIEMTHU_561)", () => {
  it("chỉ trạm bật cách nhận, đủ hàng, có xã của địa chỉ; sắp cùng xã trước; phương thức theo cách nhận", async () => {
    const pickup = await buyer("post", "/buyer/orders/preview", { addressId: nearAddress, lines: cream(1), fulfillmentMode: "station_pickup" });
    expect(pickup.status, JSON.stringify(pickup.body)).toBe(200);
    expect(pickup.body.stations.map((item: { name: string; sameWard: boolean }) => [item.name, item.sameWard])).toEqual([
      ["VComm Thủ Đức", true],
      ["VComm Quận 1", false],
    ]);
    expect(pickup.body).toMatchObject({ shippingFee: "0", station: null });
    expect(pickup.body.paymentMethods).toContain("pay_at_station");
    expect(pickup.body.paymentMethods).not.toContain("cod");
    // Hai kem: kho Quận 1 không đủ.
    const two = await buyer("post", "/buyer/orders/preview", { addressId: nearAddress, lines: cream(2), fulfillmentMode: "station_pickup", stationId: thuDuc });
    expect(two.body.stations.map((item: { id: string }) => item.id)).toEqual([thuDuc]);
    expect(two.body).toMatchObject({ station: { id: thuDuc, address: "45 Hoàng Diệu 2, Linh Xuân, Hồ Chí Minh" }, goodsAmount: "500000", shippingFee: "0", total: "500000" });
    expect(two.body.station.warehouseId).toBeUndefined();
    // Trạm giao: chỉ trạm có xã của địa chỉ; địa chỉ Hà Nội không có trạm.
    const delivery = await buyer("post", "/buyer/orders/preview", { addressId: nearAddress, lines: cream(2), fulfillmentMode: "station_delivery", stationId: thuDuc });
    expect(delivery.body.stations.map((item: { id: string }) => item.id)).toEqual([thuDuc]);
    expect(delivery.body).toMatchObject({ shippingFee: "15000", total: "515000" });
    const free = await buyer("post", "/buyer/orders/preview", { addressId: nearAddress, lines: cream(3), fulfillmentMode: "station_delivery", stationId: thuDuc });
    expect(free.body).toMatchObject({ goodsAmount: "750000", shippingFee: "0" });
    expect((await buyer("post", "/buyer/orders/preview", { addressId: farAddress, lines: cream(1), fulfillmentMode: "station_delivery" })).body.stations).toEqual([]);
    const carrier = await buyer("post", "/buyer/orders/preview", { addressId: nearAddress, lines: cream(1) });
    expect(carrier.body).toMatchObject({ fulfillmentMode: "carrier", stations: [], shippingFee: "30000" });
    expect(carrier.body.paymentMethods).not.toContain("pay_at_station");
  });
});

describe("Đặt đơn nhận tại trạm, trạm giao (KICHBAN_KIEMTHU_562)", () => {
  it("chặn sai trạm, sai phương thức, kho trạm thiếu hàng", async () => {
    const base = { addressId: nearAddress, lines: cream(2), expectedTotal: "500000", paymentMethod: "pay_at_station", fulfillmentMode: "station_pickup" };
    expect((await buyer("post", "/buyer/orders", base)).status).toBe(400);
    expect((await buyer("post", "/buyer/orders", { ...base, stationId: quanMot })).body.error.message).toBe("Trạm đã chọn không còn đủ hàng. Chọn trạm khác.");
    expect((await buyer("post", "/buyer/orders", { ...base, stationId: quanMot, fulfillmentMode: "station_delivery" })).body.error.message).toBe(
      "Trạm đã chọn không còn nhận đơn cho cách nhận hoặc địa chỉ này. Chọn trạm khác.",
    );
    expect((await buyer("post", "/buyer/orders", { ...base, stationId: thuDuc, addressId: farAddress, fulfillmentMode: "station_delivery" })).status).toBe(409);
    expect((await buyer("post", "/buyer/orders", { ...base, stationId: thuDuc, paymentMethod: "cod" })).body.error.message).toBe(
      "Phương thức thanh toán này hiện không dùng được. Chọn phương thức khác.",
    );
    expect((await buyer("post", "/buyer/orders", { ...base, fulfillmentMode: "carrier", expectedTotal: "530000" })).status).toBe(409);
  });

  it("nhận tại trạm: phí 0, giữ hàng ở kho trạm, chờ soạn hàng, phải thu tại trạm; không giao qua đơn vị vận chuyển", async () => {
    const placed = await buyer("post", "/buyer/orders", {
      addressId: nearAddress,
      lines: cream(2),
      expectedTotal: "500000",
      paymentMethod: "pay_at_station",
      fulfillmentMode: "station_pickup",
      stationId: thuDuc,
    });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    expect(placed.body).toMatchObject({
      status: "awaiting_shipment",
      fulfillmentMode: "station_pickup",
      station: { id: thuDuc, name: "VComm Thủ Đức" },
      shippingFee: "0",
      paymentMethod: "pay_at_station",
    });
    const row = (
      await pool.query("SELECT m.warehouse_id, m.cod_amount::text, m.station_id, so.delivery_address FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = $1", [
        placed.body.id,
      ])
    ).rows[0];
    expect(row).toMatchObject({ warehouse_id: shop.warehouseId, cod_amount: "500000.0000", station_id: thuDuc });
    expect(row.delivery_address).toContain("nhận tại trạm VComm Thủ Đức");
    const reserved = await pool.query(
      "SELECT r.warehouse_id, r.quantity::text FROM inventory.reservations r JOIN marketplace.orders m ON m.sales_order_id = r.source_id WHERE m.id = $1 AND r.status = 'active'",
      [placed.body.id],
    );
    expect(reserved.rows).toEqual([{ warehouse_id: shop.warehouseId, quantity: "2.0000" }]);
    const ship = await market.call("post", `/marketplace/orders/${placed.body.id}/ship`, { carrierCode: "ghn", version: placed.body.version });
    expect(ship.status).toBe(409);
  });

  it("trạm giao: phí theo trạm; đơn qua đơn vị vận chuyển giữ hàng ở kho VComm như cũ", async () => {
    const delivery = await buyer("post", "/buyer/orders", {
      addressId: nearAddress,
      lines: cream(1),
      expectedTotal: "265000",
      paymentMethod: "pay_at_station",
      fulfillmentMode: "station_delivery",
      stationId: thuDuc,
    });
    expect(delivery.status, JSON.stringify(delivery.body)).toBe(201);
    expect(delivery.body).toMatchObject({ fulfillmentMode: "station_delivery", shippingFee: "15000" });
    const carrier = await buyer("post", "/buyer/orders", { addressId: nearAddress, lines: cream(1), expectedTotal: "280000", paymentMethod: "cod" });
    expect(carrier.status, JSON.stringify(carrier.body)).toBe(201);
    expect(carrier.body).toMatchObject({ fulfillmentMode: "carrier", station: null, shippingFee: "30000" });
    expect((await pool.query("SELECT warehouse_id FROM marketplace.orders WHERE id = $1", [carrier.body.id])).rows[0].warehouse_id).toBe(market.warehouseId);
  });
});

describe("Mua chung (KICHBAN_KIEMTHU_563)", () => {
  it("đơn mua chung chỉ giao qua đơn vị vận chuyển", async () => {
    const preview = await buyer("post", "/buyer/orders/preview", {
      addressId: nearAddress,
      lines: cream(1),
      fulfillmentMode: "station_pickup",
      groupBuyId: "00000000-0000-4000-8000-0000000000aa",
    });
    expect(preview.body.error.message).toBe("Đơn mua chung chỉ giao qua đơn vị vận chuyển, chưa nhận tại trạm.");
  });
});
