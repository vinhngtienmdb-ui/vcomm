// CONG_VIEC_43 lát L2: giao dịch nội bộ chỉ gồm dịch vụ (KICHBAN_KIEMTHU_422; TIEUCHI_NGHIEMTHU_277; QUYTAC_NGHIEPVU_277).
// Công ty bán: VComm Bán lẻ (VCR); công ty mua: VComm Thương mại (VCT).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let today: string;
let sellerWarehouse: string;
let buyerWarehouse: string;
let internalChannelId: string;
let retailAsPartner: string;
let tradingAsPartner: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};

const sell = (path: string, body?: unknown) => groupAdmin.call(body === undefined ? "get" : "post", path, { companyId: retail, body });
const buy = (path: string, body?: unknown) => groupAdmin.call(body === undefined ? "get" : "post", path, { companyId: trading, body });
const salesBody = (variantId: string) => ({
  customerId: tradingAsPartner,
  channelId: internalChannelId,
  warehouseId: sellerWarehouse,
  orderDate: today,
  lines: [{ variantId, unitId: units.CAI, quantity: "2", discountPercent: "0" }],
});
const purchaseBody = (variantId: string) => ({
  supplierId: retailAsPartner,
  warehouseId: buyerWarehouse,
  orderDate: today,
  lines: [{ variantId, unitId: units.CAI, quantity: "3", unitPrice: "1", vatRate: "0" }],
});
const stockDocuments = async () => Number((await pool.query("SELECT count(*)::int AS total FROM inventory.documents")).rows[0].total);
const reservations = async (orderId: string) => Number((await pool.query("SELECT count(*)::int AS total FROM inventory.reservations WHERE source_id = $1", [orderId])).rows[0].total);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "DVNB", nameVi: "DVNB", nameEn: "DVNB" } })).body.id;
  const product = async (key: string, companyId: string, name: string, kind: "goods" | "service") => {
    const created = await groupAdmin.call("post", "/catalog/products", {
      companyId,
      body: { categoryId, name, kind, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units.CAI, variants: [{ barcodes: [] }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("retailService", retail, "Dịch vụ kế toán nội bộ", "service");
  await product("tradingService", trading, "Dịch vụ kế toán nhận", "service");
  await product("retailGoods", retail, "Hàng hóa nội bộ", "goods");
  await product("tradingGoods", trading, "Hàng hóa nội bộ nhận", "goods");
  for (const [variantId, linkedVariantId] of [
    [items.retailService, items.tradingService],
    [items.retailGoods, items.tradingGoods],
  ])
    expect((await groupAdmin.call("post", "/catalog/variant-links", { companyId: retail, body: { variantId, linkedVariantId, factor: "1" } })).status).toBe(201);

  sellerWarehouse = (await groupAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "DVB", name: "Kho bán", usesLocations: false } }))
    .body.id;
  buyerWarehouse = (
    await groupAdmin.call("post", "/inventory/warehouses", {
      companyId: retail,
      body: { branchId: testIds.binhDuongWarehouse, code: "DVM", name: "Kho VCT", usesLocations: false, ownerCompanyIds: [trading] },
    })
  ).body.id;
  const channels = (await groupAdmin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  internalChannelId = channels.find((channel) => channel.code === "NOI_BO")!.id;
  const priceListId = (await groupAdmin.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "NBDV", name: "NBDV", includesVat: false, channelId: internalChannelId } })).body.id;
  const draft = await groupAdmin.call("post", "/catalog/price-changes", {
    companyId: retail,
    body: {
      priceListId,
      effectiveFrom: today,
      lines: [
        { variantId: items.retailService, unitId: units.CAI, price: "500000" },
        { variantId: items.retailGoods, unitId: units.CAI, price: "10000" },
      ],
    },
  });
  expect((await groupAdmin.call("post", `/catalog/price-changes/${draft.body.id}/submit`, { companyId: retail })).status).toBe(201);
  const partnerOf = async (companyId: string) => (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [companyId])).rows[0]!.id;
  retailAsPartner = await partnerOf(retail);
  tradingAsPartner = await partnerOf(trading);
  const profile = async (companyId: string, partnerId: string, body: Record<string, unknown>) =>
    expect(
      (
        await groupAdmin.call("put", `/crm/partners/${partnerId}/profile`, {
          companyId,
          body: { isCustomer: false, isSupplier: false, paymentTermDays: 30, creditLimit: null, version: 0, ...body },
        })
      ).status,
    ).toBe(200);
  await profile(retail, tradingAsPartner, { isCustomer: true });
  await profile(trading, retailAsPartner, { isSupplier: true });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_277: giao dịch nội bộ chỉ dịch vụ", () => {
  it("KICHBAN_KIEMTHU_422: đơn bán, đơn mua nội bộ có hàng hóa bị từ chối ở đúng dòng", async () => {
    const sale = await sell("/sales/orders", salesBody(items.retailGoods!));
    expect(sale.status).toBe(400);
    expect(sale.body.error.fields).toEqual({ "lines.0.variantId": "Giao dịch nội bộ chỉ gồm mặt hàng dịch vụ." });
    const purchase = await buy("/purchasing/orders", purchaseBody(items.tradingGoods!));
    expect(purchase.status).toBe(400);
    expect(purchase.body.error.fields).toEqual({ "lines.0.variantId": "Giao dịch nội bộ chỉ gồm mặt hàng dịch vụ." });
  });

  it("KICHBAN_KIEMTHU_422: đơn bán dịch vụ sinh đơn mua đối ứng; bên mua xác nhận; không giữ hàng, không phiếu kho", async () => {
    const documentsBefore = await stockDocuments();
    const created = await sell("/sales/orders", salesBody(items.retailService!));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const confirmed = (await sell(`/sales/orders/${created.body.id}/submit`, {})).body;
    expect(confirmed).toMatchObject({ status: "confirmed", isInternal: true, counterpart: { status: "counterpart_pending" } });
    expect(await reservations(created.body.id)).toBe(0);
    const purchase = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM purchasing.orders WHERE counterpart_order_id = $1", [created.body.id])).rows[0]!;
    const pending = (await buy(`/purchasing/orders/${purchase.id}`)).body;
    expect(pending.lines).toEqual([expect.objectContaining({ variantId: items.tradingService, quantity: "2", unitPrice: "500000" })]);
    const approved = await buy(`/purchasing/orders/${purchase.id}/counterpart-confirm`, { warehouseId: buyerWarehouse, version: purchase.version });
    expect(approved.body).toMatchObject({ status: "approved" });
    // Kho không có việc xuất giao cho đơn chỉ dịch vụ.
    const open = (await groupAdmin.call("get", "/inventory/sales-orders", { companyId: retail })).body as { id: string }[];
    expect(open.map((order) => order.id)).not.toContain(created.body.id);
    expect(await stockDocuments()).toBe(documentsBefore);
  });

  it("KICHBAN_KIEMTHU_422: đơn mua dịch vụ sinh đơn bán đối ứng; bên bán xác nhận không giữ hàng", async () => {
    const created = await buy("/purchasing/orders", purchaseBody(items.tradingService!));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect((await buy(`/purchasing/orders/${created.body.id}/submit`, {})).body.status).toBe("approved");
    const sales = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM sales.orders WHERE counterpart_order_id = $1", [created.body.id])).rows[0]!;
    const confirmed = await sell(`/sales/orders/${sales.id}/counterpart-confirm`, { warehouseId: sellerWarehouse, version: sales.version });
    expect(confirmed.body).toMatchObject({ status: "confirmed" });
    expect(await reservations(sales.id)).toBe(0);
  });

  // Đơn mua đối ứng chỉ dịch vụ khi bên mua xác nhận coi là đã nhận đủ, đơn bán coi là đã giao đủ (QUYTAC_NGHIEPVU_276, 277): chưa làm, chờ người dùng chọn phương án (báo cáo lát L2).
  it.todo("KICHBAN_KIEMTHU_422: bên mua xác nhận đơn mua đối ứng chỉ dịch vụ thì coi là đã nhận đủ, có công nợ phải trả");
});
