// Dữ liệu dùng chung cho kiểm thử trạm giao hàng O2O (CONG_VIEC_57): VComm, hai trạm, người mua có địa chỉ gần trạm và ở Hà Nội.
// Trạm Thủ Đức: xã Linh Xuân, nhận tại trạm và trạm giao Linh Xuân, Tam Bình (phí 15.000, miễn từ 600.000), kho 5 kem. Trạm Quận 1: chỉ nhận tại trạm, kho 1 kem.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { expect } from "vitest";
import { type BuyerCall, prepareMarketplace, type MarketplaceFixture } from "./marketplace-fixture";
import { createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";

export interface StationFixture {
  market: MarketplaceFixture;
  shop: RetailFixture;
  buyer: BuyerCall;
  nearAddress: string;
  farAddress: string;
  thuDuc: string;
  quanMot: string;
}

export async function prepareStations(application: NestExpressApplication, pool: Pool): Promise<StationFixture> {
  const market = await prepareMarketplace(application, pool);
  const shop = await createRetailFixture(application, pool);

  const admin = shop.admin;
  const call = (method: "get" | "post" | "patch", path: string, body?: unknown) => admin.call(method, path, { companyId: retail, body });
  const units = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  // Kho Thủ Đức có 5 kem; kho Quận 1 có 1 kem.
  for (const [warehouseId, quantity] of [
    [shop.warehouseId, "5"],
    [shop.otherBranchWarehouse, "1"],
  ] as const) {
    const receipt = await call("post", "/inventory/documents", {
      type: "receipt_other",
      warehouseId,
      companyId: retail,
      documentDate: market.today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu trạm",
      lines: [{ variantId: market.variants.cream, unitId: units, quantity, unitCost: "100000" }],
    });
    expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
    expect((await call("post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  }
  const station = async (branchId: string, warehouseId: string, body: Record<string, unknown>) => {
    const created = await call("post", "/retail/stores", storeBody(shop, { branchId, warehouseId }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const saved = await call("patch", `/retail/stores/${created.body.id}/station`, {
      pickupEnabled: true,
      deliveryEnabled: false,
      provinceCode: "79",
      wardCode: "26800",
      streetAddress: "45 Hoàng Diệu 2",
      phone: "02838961234",
      openingHours: "7:00 – 21:00",
      holdDays: 3,
      deliveryFee: "0",
      deliveryWardCodes: [],
      version: 1,
      ...body,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    return created.body.id as string;
  };
  const thuDuc = await station(shop.storeBranch, shop.warehouseId, {
    displayName: "VComm Thủ Đức",
    deliveryEnabled: true,
    deliveryFee: "15000",
    freeDeliveryThreshold: "600000",
    deliveryWardCodes: ["26800", "26803"],
  });
  const quanMot = await station(shop.otherStoreBranch, shop.otherBranchWarehouse, { displayName: "VComm Quận 1", wardCode: "26824" });
  expect((await market.call("put", "/marketplace/payment-methods/pay_at_station", { isEnabled: true })).status).toBe(200);
  expect((await market.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  await market.register("0912570001", "Khách Thủ Đức");
  const buyer = await market.buyerSession("0912570001");
  const farAddress = await market.addressOf(buyer);
  const near = await buyer("post", "/buyer/addresses", { recipientName: "Khách Thủ Đức", phone: "0912570001", provinceCode: "79", wardCode: "26800", streetAddress: "12 Võ Văn Ngân" });
  expect(near.status, JSON.stringify(near.body)).toBe(201);
  const nearAddress = near.body.find((item: { wardCode: string }) => item.wardCode === "26800").id;
  return { market, shop, buyer, nearAddress, farAddress, thuDuc, quanMot };
}
