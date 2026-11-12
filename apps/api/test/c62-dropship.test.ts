// CONG_VIEC_62 lát L1: kho Dropship, sản phẩm dropship, tồn nhà cung cấp, giữ chỗ (TIEUCHI_NGHIEMTHU_458 đến 460; KICHBAN_KIEMTHU_639 đến 641).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { messages } from "i18n";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { allowManualGoodsOrders, createTestUser, grantSalesOrderManage, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let purchaser: Session;
let keeper: Session;
let today: string;
let dropshipWarehouse: string;
let standardWarehouse: string;
let channelId: string;
let supplierId: string;
let otherSupplierId: string;
let serviceVariant: string;
let lotVariant: string;
const variants: Record<string, string> = {};
const retail: string = testIds.retailCompany;
const units: Record<string, string> = {};
const unit = (code: string): string => units[code]!;
const errorText = messages.vi.errors as Record<string, string>;
const fieldsOf = (object: Record<string, string>) => Object.fromEntries(Object.entries(object).map(([field, key]) => [field, errorText[key]]));
const call = (session: Session, method: "get" | "post" | "patch" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });

async function assign(email: string, name: string, role: string, branchId?: string): Promise<Session> {
  const id = await createTestUser(pool, email, name, [{ companyId: retail, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    retail,
    branchId ?? null,
  ]);
  return signIn(application, email);
}

async function product(name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const category = (await pool.query<{ id: string }>("SELECT id FROM catalog.categories WHERE code = 'DSHIP'")).rows[0]!.id;
  const created = await call(admin, "post", "/catalog/products", {
    categoryId: category,
    name,
    vatRate: "8",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: unit("CAI"),
    units: [{ unitId: unit("HOP"), factor: "10" }],
    variants: [{ barcodes: [] }],
    ...extra,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.variants[0].id as string;
}

async function supplierPrice(variantId: string, supplier: string, unitPrice: string): Promise<void> {
  const created = await call(purchaser, "post", "/purchasing/supplier-prices", {
    supplierId: supplier,
    variantId,
    unitId: unit("CAI"),
    minQuantity: "0",
    unitPrice,
    supplierSku: null,
    validFrom: today,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
}

async function partner(name: string, taxCode: string, profile: Record<string, unknown>): Promise<string> {
  const created = await call(admin, "post", "/crm/partners", { kind: "organization", name, taxCode });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const saved = await admin.call("put", `/crm/partners/${created.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: false, paymentTermDays: 0, creditLimit: null, version: 0, ...profile },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return created.body.id as string;
}

async function draftOrder(lines: { variantId: string; quantity: string }[], warehouseId = dropshipWarehouse) {
  const created = await call(admin, "post", "/sales/orders", {
    channelId,
    warehouseId,
    orderDate: today,
    buyerName: "Khách lẻ",
    deliveryAddress: "45 Nguyễn Gia Trí, Bình Thạnh, TP. Hồ Chí Minh",
    lines: lines.map((line) => ({ ...line, unitId: unit("CAI"), discountPercent: "0" })),
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body as { id: string; version: number };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  await allowManualGoodsOrders(pool, retail);
  today = application.get(PermissionService).today();
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  await grantSalesOrderManage(pool, "quantri.vcr@vcomm.test", retail);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  purchaser = await assign("muahang.dropship@vcomm.test", "Lê Văn Dropship", "purchaser");
  keeper = await assign("thukho.dropship@vcomm.test", "Kiều Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "DSHIP", nameVi: "Dropship", nameEn: "Dropship" } })).status).toBe(201);
  variants.juice = await product("Nước cốt bưởi 500ml");
  variants.honey = await product("Mật ong tràm 1kg");
  variants.noPrice = await product("Khô gà lá chanh");
  serviceVariant = await product("Phí gói quà", { kind: "service" });
  lotVariant = await product("Bánh pía theo lô", { tracksLots: true });
  supplierId = await partner("Công ty TNHH Nông sản Hòa Bình", "0320006201", { isSupplier: true });
  otherSupplierId = await partner("Khách hàng không cung cấp", "0320006202", { isCustomer: true });
  await supplierPrice(variants.juice!, supplierId, "38000");
  await supplierPrice(variants.honey!, supplierId, "215000");
  const channels = (await call(admin, "post", "/catalog/sales-channels/defaults")).body as { id: string; code: string }[];
  channelId = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const list = (await call(admin, "post", "/catalog/price-lists", { code: "DSHIP", name: "Dropship", customerGroupId: null, includesVat: true })).body.id;
  const change = await call(admin, "post", "/catalog/price-changes", {
    priceListId: list,
    effectiveFrom: today,
    lines: [variants.juice, variants.honey, variants.noPrice].map((variantId) => ({ variantId, unitId: unit("CAI"), price: "60000" })),
  });
  expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  standardWarehouse = (await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "DSTD", name: "Kho thường", usesLocations: false })).body.id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_458: kho Dropship", () => {
  it("KICHBAN_KIEMTHU_639: tạo kho Dropship, chặn kho thứ hai, vị trí, phiếu tay, chuyển kho, kiểm kê, giữ tay, đơn mua tay", async () => {
    const withLocations = await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "DSX", name: "Kho Dropship", usesLocations: true, kind: "dropship" });
    expect(withLocations.status).toBe(400);
    expect(withLocations.body.error.fields).toMatchObject(fieldsOf({ usesLocations: "invalidValue" }));
    const created = await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "DS", name: "Kho Dropship", usesLocations: false, kind: "dropship" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.kind).toBe("dropship");
    dropshipWarehouse = created.body.id;
    const second = await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "DS2", name: "Kho Dropship 2", usesLocations: false, kind: "dropship" });
    expect(second.status).toBe(400);
    expect(second.body.error.fields).toMatchObject(fieldsOf({ kind: "dropshipWarehouseExists" }));

    const manual = await call(admin, "post", "/inventory/documents", {
      type: "receipt_other",
      warehouseId: dropshipWarehouse,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [{ variantId: variants.juice, unitId: unit("CAI"), quantity: "5", unitCost: "1000" }],
    });
    expect(manual.status).toBe(400);
    expect(manual.body.error.fields).toMatchObject(fieldsOf({ warehouseId: "dropshipWarehouseManual" }));
    const transfer = await call(admin, "post", "/inventory/documents", {
      type: "transfer",
      warehouseId: standardWarehouse,
      destinationWarehouseId: dropshipWarehouse,
      companyId: retail,
      documentDate: today,
      reasonCode: "transfer",
      reason: "Chuyển",
      lines: [{ variantId: variants.juice, unitId: unit("CAI"), quantity: "1" }],
    });
    expect(transfer.status).toBe(400);
    expect(transfer.body.error.fields).toMatchObject(fieldsOf({ destinationWarehouseId: "dropshipWarehouseManual" }));
    const stocktake = await call(admin, "post", "/inventory/stocktakes", { warehouseId: dropshipWarehouse, companyId: retail, scopeType: "full", note: null });
    expect(stocktake.status).toBe(409);
    const reservation = await call(admin, "post", "/inventory/reservations", { warehouseId: dropshipWarehouse, companyId: retail, variantId: variants.juice, quantity: "1", note: "Giữ" });
    expect(reservation.status).toBe(409);
    const order = await call(purchaser, "post", "/purchasing/orders", {
      supplierId,
      warehouseId: dropshipWarehouse,
      orderDate: today,
      expectedDate: today,
      note: null,
      lines: [{ variantId: variants.juice, unitId: unit("CAI"), quantity: "1", unitPrice: "38000", vatRate: "8" }],
    });
    expect(order.status).toBe(400);
    expect(order.body.error.fields).toMatchObject(fieldsOf({ warehouseId: "invalidValue" }));
  });
});

describe("TIEUCHI_NGHIEMTHU_459: sản phẩm dropship", () => {
  it("KICHBAN_KIEMTHU_640: thêm sai, thêm đúng, sửa tồn hai lần có lịch sử, nhập tệp", async () => {
    const wrong = async (body: Record<string, unknown>, field: string, key: string) => {
      const response = await call(purchaser, "post", "/purchasing/dropship-products", { supplierId, unitId: unit("CAI"), ...body });
      expect(response.status, JSON.stringify(response.body)).toBe(400);
      expect(response.body.error.fields[field]).toBe(errorText[key]);
    };
    await wrong({ variantId: serviceVariant }, "variantId", "serviceNotStocked");
    await wrong({ variantId: lotVariant }, "variantId", "dropshipTrackedNotAllowed");
    await wrong({ variantId: variants.juice, supplierId: otherSupplierId }, "supplierId", "supplierNotActive");
    await wrong({ variantId: variants.juice, declaredQuantity: "1.5" }, "declaredQuantity", "invalidValue");

    const juice = await call(purchaser, "post", "/purchasing/dropship-products", { variantId: variants.juice, supplierId, unitId: unit("CAI"), declaredQuantity: "10" });
    expect(juice.status, JSON.stringify(juice.body)).toBe(201);
    expect(juice.body).toMatchObject({ declaredQuantity: "10", reservedQuantity: "0", availableQuantity: "10", purchasePrice: "38000", supplierName: "Công ty TNHH Nông sản Hòa Bình" });
    await wrong({ variantId: variants.juice }, "variantId", "dropshipProductExists");
    for (const variantId of [variants.honey, variants.noPrice]) {
      expect((await call(purchaser, "post", "/purchasing/dropship-products", { variantId, supplierId, unitId: unit("CAI"), declaredQuantity: "3" })).status).toBe(201);
    }

    const first = await call(purchaser, "patch", `/purchasing/dropship-products/${juice.body.id}/stock`, { declaredQuantity: "12", version: juice.body.version });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const stale = await call(purchaser, "patch", `/purchasing/dropship-products/${juice.body.id}/stock`, { declaredQuantity: "11", version: juice.body.version });
    expect(stale.status).toBe(409);
    expect((await call(purchaser, "patch", `/purchasing/dropship-products/${juice.body.id}/stock`, { declaredQuantity: "10", version: first.body.version })).status).toBe(200);
    const detail = await call(purchaser, "get", `/purchasing/dropship-products/${juice.body.id}`);
    expect(detail.body.changes.map((change: { oldQuantity: string; newQuantity: string; changedByName: string }) => [change.oldQuantity, change.newQuantity, change.changedByName])).toEqual([
      ["12", "10", "Lê Văn Dropship"],
      ["10", "12", "Lê Văn Dropship"],
      ["0", "10", "Lê Văn Dropship"],
    ]);

    const sku = (await pool.query<{ sku: string }>("SELECT sku FROM catalog.variants WHERE id = $1", [variants.honey])).rows[0]!.sku;
    const writeXlsxFile = (await import("write-excel-file/node")).default;
    const file = await writeXlsxFile([["Mã biến thể", "Tồn khai báo"].map((value) => ({ value })), [sku, "35"].map((value) => ({ value })), ["KHONG-CO", "5"].map((value) => ({ value }))], {
      sheet: "Tồn",
    }).toBuffer();
    const imported = await purchaser.call("post", "/purchasing/dropship-products/stock-import", { companyId: retail }).attach("file", file as Buffer, "ton.xlsx");
    expect(imported.status, JSON.stringify(imported.body)).toBe(201);
    expect(imported.body.updated).toBe(1);
    expect(imported.body.errors).toHaveLength(1);
    expect(imported.body.errors[0].row).toBe(3);

    expect((await call(keeper, "get", "/purchasing/dropship-products")).status).toBe(403);
  });
});

describe("TIEUCHI_NGHIEMTHU_460: giữ chỗ theo tồn khai báo", () => {
  it("KICHBAN_KIEMTHU_641: khai báo 10, đơn A 6 giữ chỗ, đơn B 5 bị từ chối, đơn B 4 được; dòng không dropship; không có giá mua", async () => {
    const orderA = await draftOrder([{ variantId: variants.juice!, quantity: "6" }]);
    const submittedA = await call(admin, "post", `/sales/orders/${orderA.id}/submit`);
    expect(submittedA.status, JSON.stringify(submittedA.body)).toBe(201);
    expect(["confirmed", "pending"]).toContain(submittedA.body.status);
    const list = await call(purchaser, "get", `/purchasing/dropship-products?search=${encodeURIComponent("bưởi")}`);
    expect(list.body.data[0]).toMatchObject({ declaredQuantity: "10", reservedQuantity: "6", availableQuantity: "4" });

    const orderB = await draftOrder([{ variantId: variants.juice!, quantity: "5" }]);
    const tooMany = await call(admin, "post", `/sales/orders/${orderB.id}/submit`);
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.fields).toMatchObject(fieldsOf({ "lines.0.quantity": "insufficientAvailableStock" }));
    const orderC = await draftOrder([{ variantId: variants.juice!, quantity: "4" }]);
    expect((await call(admin, "post", `/sales/orders/${orderC.id}/submit`)).status).toBe(201);

    // Mặt hàng không phải sản phẩm dropship; sản phẩm dropship chưa có giá mua.
    const other = await product("Hàng thường");
    const priceList = (await pool.query<{ id: string }>("SELECT id FROM catalog.price_lists WHERE company_id = $1 AND code = 'DSHIP'", [retail])).rows[0]!.id;
    const change = await call(admin, "post", "/catalog/price-changes", { priceListId: priceList, effectiveFrom: today, lines: [{ variantId: other, unitId: unit("CAI"), price: "50000" }] });
    expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
    const notDropship = await draftOrder([{ variantId: other, quantity: "1" }]);
    const rejected = await call(admin, "post", `/sales/orders/${notDropship.id}/submit`);
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.fields).toMatchObject(fieldsOf({ "lines.0.variantId": "dropshipProductMissing" }));
    const noPrice = await draftOrder([{ variantId: variants.noPrice!, quantity: "1" }]);
    const missing = await call(admin, "post", `/sales/orders/${noPrice.id}/submit`);
    expect(missing.status).toBe(400);
    expect(missing.body.error.fields).toMatchObject(fieldsOf({ "lines.0.variantId": "dropshipPriceMissing" }));
  });
});
