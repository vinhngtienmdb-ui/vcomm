// CONG_VIEC_50: báo cáo tồn kho và luân chuyển (KICHBAN_KIEMTHU_481).
// Hàng A giá vốn 10.000: nhập 100 vào kho K1, bán 10 từ K1, chuyển 30 từ K1 sang K2, xuất khác 5 từ K2.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { allowManualGoodsOrders, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let groupAdmin: Session;
let today: string;
let tomorrow: string;
let itemA: string;
let unitId: string;
const warehouses: Record<string, string> = {};
const retail: string = testIds.retailCompany;
const call = (method: "get" | "post" | "put", path: string, body?: unknown) => admin.call(method, path, { companyId: retail, body });
const report = (query: string) => groupAdmin.call("get", `/analytics/inventory?${query}`, { companyId: retail });
type Row = Record<string, string | null> & { key: string };
const byKey = (rows: Row[]) => Object.fromEntries(rows.map((row) => [row.key, row]));

async function posted(body: Record<string, unknown>) {
  const created = await call("post", "/inventory/documents", { companyId: retail, documentDate: today, reason: "Kiểm thử báo cáo", ...body });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return (await call("post", `/inventory/documents/${created.body.id}/submit`)).body;
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  await allowManualGoodsOrders(pool, retail);
  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "TKBC", nameVi: "TKBC", nameEn: "TKBC" } })).body.id;
  const product = await call("post", "/catalog/products", {
    categoryId: category,
    name: "Hàng tồn kho A",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: unitId,
    variants: [{ barcodes: [] }],
  });
  itemA = product.body.variants[0].id;
  for (const code of ["K1", "K2"]) {
    warehouses[code] = (await call("post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code, name: `Kho ${code}`, usesLocations: false })).body.id;
  }
  expect((await posted({ type: "receipt_other", warehouseId: warehouses.K1, reasonCode: "opening_balance", lines: [{ variantId: itemA, unitId, quantity: "100", unitCost: "10000" }] })).status).toBe(
    "posted",
  );
  // Bán 10 từ K1.
  const channel = ((await call("post", "/catalog/sales-channels/defaults")).body as { id: string; code: string }[]).find((item) => item.code === "BAN_LE")!.id;
  const priceList = (await call("post", "/catalog/price-lists", { code: "CHUNG", name: "Chung", includesVat: true })).body.id;
  const change = await call("post", "/catalog/price-changes", { priceListId: priceList, effectiveFrom: today, lines: [{ variantId: itemA, unitId, price: "22000" }] });
  await call("post", `/catalog/price-changes/${change.body.id}/submit`);
  const order = await call("post", "/sales/orders", {
    channelId: channel,
    warehouseId: warehouses.K1,
    orderDate: today,
    buyerName: "Khách lẻ",
    lines: [{ variantId: itemA, unitId, quantity: "10", discountPercent: "0" }],
  });
  expect(order.status, JSON.stringify(order.body)).toBe(201);
  const confirmed = (await call("post", `/sales/orders/${order.body.id}/submit`)).body;
  const issue = await call("post", "/inventory/sales-issues", { orderId: confirmed.id, documentDate: today, lines: [{ orderLineId: confirmed.lines[0].id, quantity: "10" }] });
  expect((await call("post", `/inventory/documents/${issue.body.id}/submit`)).body.status).toBe("posted");
  // Chuyển 30 từ K1 sang K2.
  const transfer = await posted({ type: "transfer", warehouseId: warehouses.K1, destinationWarehouseId: warehouses.K2, reasonCode: "transfer", lines: [{ variantId: itemA, unitId, quantity: "30" }] });
  expect((await call("post", `/inventory/documents/${transfer.id}/ship`)).status).toBe(201);
  const shipped = (await call("get", `/inventory/documents/${transfer.id}`)).body;
  const received = await call("post", `/inventory/documents/${transfer.id}/receive`, {
    lines: shipped.lines.map((line: { id: string }) => ({ lineId: line.id, receivedQuantity: "30", destinationLocationId: null, serials: [] })),
    note: null,
  });
  expect(received.status, JSON.stringify(received.body)).toBe(201);
  // Xuất khác 5 từ K2.
  expect((await posted({ type: "issue_other", warehouseId: warehouses.K2, reasonCode: "internal_use", lines: [{ variantId: itemA, unitId, quantity: "5" }] })).status).toBe("posted");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_50 tồn kho và luân chuyển", () => {
  it("KICHBAN_KIEMTHU_481: đầu kỳ, nhập, xuất, cuối kỳ theo kho, công ty, sản phẩm khớp thẻ kho và tồn hiện tại; vòng quay, số ngày tồn; kỳ không phát sinh", async () => {
    const byWarehouse = await report(`from=${today}&to=${today}&groupBy=warehouse`);
    expect(byWarehouse.status, JSON.stringify(byWarehouse.body)).toBe(200);
    const rows = byKey(byWarehouse.body.rows);
    expect(rows[warehouses.K1!]).toMatchObject({
      openingQuantity: "0",
      openingValue: "0",
      inQuantity: "100",
      inValue: "1000000",
      outQuantity: "40",
      outValue: "400000",
      closingQuantity: "60",
      closingValue: "600000",
      costOfSales: "100000",
      turnover: "0.33",
      daysOfInventory: "3",
    });
    expect(rows[warehouses.K1!]!.label).toBe("K1 · Kho K1 (VCR)");
    expect(rows[warehouses.K2!]).toMatchObject({
      inQuantity: "30",
      inValue: "300000",
      outQuantity: "5",
      outValue: "50000",
      closingQuantity: "25",
      closingValue: "250000",
      costOfSales: "0",
      turnover: null,
      daysOfInventory: null,
    });
    expect(byWarehouse.body.warehouses.map((warehouse: { id: string }) => warehouse.id)).toEqual(expect.arrayContaining([warehouses.K1, warehouses.K2]));

    // Theo công ty: chuyển kho cộng cả nhập và xuất, tồn cuối kỳ không đổi.
    const company = byKey((await report(`from=${today}&to=${today}&groupBy=company`)).body.rows)[retail]!;
    expect(company).toMatchObject({ inQuantity: "130", outQuantity: "45", closingQuantity: "85", closingValue: "850000", costOfSales: "100000", turnover: "0.24", daysOfInventory: "4.3" });
    // Tồn cuối kỳ đến hôm nay khớp tồn hiện tại (giá vốn bình quân theo kho).
    const current = (await pool.query("SELECT sum(quantity)::float AS quantity, sum(value)::float AS value FROM inventory.costs WHERE company_id = $1", [retail])).rows[0];
    expect([Number(company.closingQuantity), Number(company.closingValue)]).toEqual([current.quantity, current.value]);
    const product = (await report(`from=${today}&to=${today}&groupBy=product`)).body;
    expect(product.rows).toEqual([expect.objectContaining({ key: itemA, closingQuantity: "85", label: expect.stringContaining("Hàng tồn kho A") })]);
    expect(product.totals).toMatchObject({ openingValue: "0", inValue: "1300000", outValue: "450000", closingValue: "850000", costOfSales: "100000", turnover: "0.24" });

    // Kỳ sau không phát sinh: mọi thứ là đầu kỳ.
    const later = byKey((await report(`from=${tomorrow}&to=${tomorrow}&groupBy=company`)).body.rows)[retail]!;
    expect(later).toMatchObject({ openingQuantity: "85", openingValue: "850000", inQuantity: "0", outQuantity: "0", closingValue: "850000", costOfSales: "0", turnover: null });

    // Lọc một kho; kho ngoài phạm vi bị từ chối.
    const only = await report(`from=${today}&to=${today}&groupBy=warehouse&warehouseId=${warehouses.K2}`);
    expect(only.body.rows.map((row: Row) => row.key)).toEqual([warehouses.K2]);
    expect(only.body.totals).toMatchObject({ closingValue: "250000", costOfSales: "0", turnover: null });
    expect((await report(`from=${today}&to=${today}&warehouseId=${warehouses.K2}&companyIds=${testIds.tradingCompany}`)).status).toBe(403);

    const keeper = await signIn(application, "thukho.bd@vcomm.test");
    expect((await keeper.call("get", `/analytics/inventory?from=${today}&to=${today}`, { companyId: retail })).status).toBe(403);
  });
});
