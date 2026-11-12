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

async function draftOrder(lines: { variantId: string; quantity: string }[], warehouseId = dropshipWarehouse, customerId: string | null = null) {
  const created = await call(admin, "post", "/sales/orders", {
    channelId,
    warehouseId,
    orderDate: today,
    ...(customerId ? { customerId } : { buyerName: "Khách lẻ" }),
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
  expect((await groupAdmin.call("post", "/finance/ledger/setup", { companyId: retail })).status).toBe(201);
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

// Lát L2: đơn mua tự lập, báo giao, ghi sổ, giao thất bại.
type DropshipOrder = {
  id: string;
  documentNo: string;
  status: string;
  supplierName: string;
  version: number;
  totalAmount: string;
  receipt: { id: string } | null;
  issue: { id: string } | null;
  lines: { quantity: string; unitPrice: string }[];
};
let supplierB: string;
let customerId: string;
async function confirmedDropshipOrder(lines: { variantId: string; quantity: string }[]) {
  const order = await draftOrder(lines, dropshipWarehouse, customerId);
  const submitted = await call(admin, "post", `/sales/orders/${order.id}/submit`);
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
  expect(submitted.body.status).toBe("confirmed");
  return submitted.body as { id: string; dropship: { id: string; documentNo: string; supplierName: string; status: string }[] };
}
async function dropshipOrder(id: string): Promise<DropshipOrder> {
  const detail = await call(purchaser, "get", `/purchasing/dropship-orders/${id}`);
  expect(detail.status, JSON.stringify(detail.body)).toBe(200);
  return detail.body as DropshipOrder;
}

describe("TIEUCHI_NGHIEMTHU_461: đơn mua tự lập theo nhà cung cấp", () => {
  it("KICHBAN_KIEMTHU_642: đơn bán hai nhà cung cấp xác nhận thì có hai đơn mua Đã duyệt, giá theo bảng giá mua, không có yêu cầu duyệt mua", async () => {
    supplierB = await partner("Hợp tác xã Ong Tràm U Minh", "0320006203", { isSupplier: true });
    customerId = await partner("Công ty TNHH Khách dropship", "0320006204", { isCustomer: true, paymentTermDays: 10 });
    variants.tea = await product("Trà ô long 100g");
    await supplierPrice(variants.tea, supplierB, "88000");
    expect((await call(purchaser, "post", "/purchasing/dropship-products", { variantId: variants.tea, supplierId: supplierB, unitId: unit("CAI"), declaredQuantity: "50" })).status).toBe(201);
    const priceList = (await pool.query<{ id: string }>("SELECT id FROM catalog.price_lists WHERE company_id = $1 AND code = 'DSHIP'", [retail])).rows[0]!.id;
    const change = await call(admin, "post", "/catalog/price-changes", { priceListId: priceList, effectiveFrom: today, lines: [{ variantId: variants.tea, unitId: unit("CAI"), price: "120000" }] });
    expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
    const requestsBefore = (await pool.query<{ total: number }>("SELECT count(*)::int AS total FROM core.approval_requests WHERE document_type_code LIKE 'purchasing.%'")).rows[0]!.total;

    const sales = await confirmedDropshipOrder([
      { variantId: variants.honey!, quantity: "2" },
      { variantId: variants.tea!, quantity: "3" },
    ]);
    expect(sales.dropship).toHaveLength(2);
    expect(sales.dropship.every((item) => item.status === "awaiting")).toBe(true);
    const bySupplier = Object.fromEntries(await Promise.all(sales.dropship.map(async (item) => [item.supplierName, await dropshipOrder(item.id)] as const)));
    expect(bySupplier["Công ty TNHH Nông sản Hòa Bình"]!.lines).toMatchObject([{ quantity: "2", unitPrice: "215000" }]);
    expect(bySupplier["Hợp tác xã Ong Tràm U Minh"]!.lines).toMatchObject([{ quantity: "3", unitPrice: "88000" }]);
    const statuses = await pool.query<{ status: string; warehouse_id: string }>("SELECT status, warehouse_id FROM purchasing.orders WHERE dropship_sales_order_id = $1", [sales.id]);
    expect(statuses.rows.every((row) => row.status === "approved" && row.warehouse_id === dropshipWarehouse)).toBe(true);
    expect((await pool.query<{ total: number }>("SELECT count(*)::int AS total FROM core.approval_requests WHERE document_type_code LIKE 'purchasing.%'")).rows[0]!.total).toBe(requestsBefore);
    // Giữ chỗ không hết hạn khi đã có đơn mua.
    const held = await pool.query<{ expires_at: Date | null }>("SELECT expires_at FROM inventory.reservations WHERE source_id = $1 AND status = 'active'", [sales.id]);
    expect(held.rows.length).toBe(2);
    expect(held.rows.every((row) => row.expires_at === null)).toBe(true);
  });
});

describe("TIEUCHI_NGHIEMTHU_462: báo đã giao ghi sổ nhập mua, xuất bán", () => {
  it("KICHBAN_KIEMTHU_643: chứng từ, công nợ hai bên, bút toán, giá vốn bằng giá mua, tồn về 0; báo lại không đổi; hai yêu cầu cùng lúc chỉ một bộ chứng từ", async () => {
    const sales = await confirmedDropshipOrder([{ variantId: variants.honey!, quantity: "2" }]);
    const order = await dropshipOrder(sales.dropship[0]!.id);
    const shipping = await call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/shipping`, { carrierName: "Viettel Post", trackingCode: "VTP8812345601", version: order.version });
    expect(shipping.status, JSON.stringify(shipping.body)).toBe(201);
    expect(shipping.body).toMatchObject({ status: "shipping", carrierName: "Viettel Post", trackingCode: "VTP8812345601" });
    const future = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const wrongDate = await call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/delivered`, { deliveredOn: future, version: shipping.body.version });
    expect(wrongDate.status).toBe(400);

    const [first, second] = await Promise.all([
      call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/delivered`, { deliveredOn: today, version: shipping.body.version }),
      call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/delivered`, { deliveredOn: today, version: shipping.body.version }),
    ]);
    expect([first.status, second.status].sort(), JSON.stringify([first.body, second.body])).toContain(201);
    const delivered = await dropshipOrder(order.id);
    expect(delivered).toMatchObject({ status: "delivered", deliveredOn: today });
    expect(delivered.receipt).not.toBeNull();
    expect(delivered.issue).not.toBeNull();
    const again = await call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/delivered`, { deliveredOn: today, version: delivered.version });
    expect(again.status).toBe(201);

    const documents = await pool.query<{ id: string; type: string; status: string; document_date: string }>(
      "SELECT id, type, status, document_date::text FROM inventory.documents WHERE (source_id = $1 AND type = 'purchase_receipt') OR (source_id = $2 AND type = 'sales_issue')",
      [order.id, sales.id],
    );
    expect(documents.rows.map((row) => [row.type, row.status, row.document_date]).sort()).toEqual([
      ["purchase_receipt", "posted", today],
      ["sales_issue", "posted", today],
    ]);
    const issueId = documents.rows.find((row) => row.type === "sales_issue")!.id;
    const cost = await pool.query<{ cost_value: string }>("SELECT abs(cost_value)::text AS cost_value FROM inventory.document_lines WHERE document_id = $1", [issueId]);
    expect(Number(cost.rows[0]!.cost_value)).toBe(430000);
    const balance = await pool.query<{ quantity: string }>("SELECT coalesce(sum(quantity), 0)::text AS quantity FROM inventory.balances WHERE warehouse_id = $1", [dropshipWarehouse]);
    expect(Number(balance.rows[0]!.quantity)).toBe(0);
    const debts = await pool.query<{ side: string; partner_id: string; amount: string }>(
      "SELECT side, partner_id, amount::text FROM finance.debt_items WHERE source_id = ANY($1::uuid[]) ORDER BY side",
      [documents.rows.map((row) => row.id)],
    );
    expect(debts.rows.map((row) => [row.side, row.partner_id, Number(row.amount)])).toEqual([
      ["payable", supplierId, 464400],
      ["receivable", customerId, 120000],
    ]);
    const journals = await pool.query<{ total: number }>("SELECT count(*)::int AS total FROM accounting.journals WHERE source_type = 'inventory_document' AND source_id = ANY($1::uuid[])", [
      documents.rows.map((row) => row.id),
    ]);
    expect(journals.rows[0]!.total).toBe(2);
    const lines = await pool.query<{ code: string; debit: string; credit: string }>(
      `SELECT a.code, sum(jl.debit)::text AS debit, sum(jl.credit)::text AS credit FROM accounting.journals j JOIN accounting.journal_lines jl ON jl.journal_id = j.id
       JOIN accounting.accounts a ON a.id = jl.account_id WHERE j.source_type = 'inventory_document' AND j.source_id = ANY($1::uuid[]) GROUP BY a.code ORDER BY a.code`,
      [documents.rows.map((row) => row.id)],
    );
    const byAccount = Object.fromEntries(lines.rows.map((row) => [row.code, Number(row.debit) - Number(row.credit)]));
    expect(byAccount).toMatchObject({ "156": 0, "632": 430000, "331": -464400, "131": 120000 });
    const salesAfter = await call(admin, "get", `/sales/orders/${sales.id}`);
    expect(salesAfter.body.status).toBe("delivered");
    expect(salesAfter.body.dropship[0]).toMatchObject({ status: "delivered", trackingCode: "VTP8812345601" });
    expect((await pool.query("SELECT 1 FROM inventory.reservations WHERE source_id = $1 AND status = 'active'", [sales.id])).rows).toHaveLength(0);
    expect((await call(keeper, "get", `/purchasing/dropship-orders/${order.id}`)).status).toBe(403);
  });
});

describe("TIEUCHI_NGHIEMTHU_463: giao thất bại", () => {
  it("KICHBAN_KIEMTHU_644: thất bại khi chưa nhà cung cấp nào giao thì hủy đơn bán; khi nhà cung cấp kia đã giao thì đóng phần còn lại", async () => {
    const declaredBefore = (await call(purchaser, "get", `/purchasing/dropship-products?search=${encodeURIComponent("Trà ô long")}`)).body.data[0];
    const single = await confirmedDropshipOrder([{ variantId: variants.tea!, quantity: "2" }]);
    const order = await dropshipOrder(single.dropship[0]!.id);
    const noReason = await call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/failed`, { reason: "", version: order.version });
    expect(noReason.status).toBe(400);
    const failed = await call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/failed`, { reason: "Người nhận không nghe máy", version: order.version });
    expect(failed.status, JSON.stringify(failed.body)).toBe(201);
    expect(failed.body).toMatchObject({ status: "failed", reason: "Người nhận không nghe máy" });
    expect((await call(admin, "get", `/sales/orders/${single.id}`)).body.status).toBe("cancelled");
    const declaredAfter = (await call(purchaser, "get", `/purchasing/dropship-products?search=${encodeURIComponent("Trà ô long")}`)).body.data[0];
    expect(declaredAfter.availableQuantity).toBe(declaredBefore.availableQuantity);
    expect(declaredAfter.declaredQuantity).toBe(declaredBefore.declaredQuantity);
    const reopen = await call(purchaser, "post", `/purchasing/dropship-orders/${order.id}/shipping`, { carrierName: null, trackingCode: null, version: failed.body.version });
    expect(reopen.status).toBe(409);

    const mixed = await confirmedDropshipOrder([
      { variantId: variants.honey!, quantity: "1" },
      { variantId: variants.tea!, quantity: "1" },
    ]);
    const honey = mixed.dropship.find((item) => item.supplierName === "Công ty TNHH Nông sản Hòa Bình")!;
    const tea = mixed.dropship.find((item) => item.supplierName === "Hợp tác xã Ong Tràm U Minh")!;
    const honeyOrder = await dropshipOrder(honey.id);
    expect((await call(purchaser, "post", `/purchasing/dropship-orders/${honey.id}/delivered`, { deliveredOn: today, version: honeyOrder.version })).status).toBe(201);
    expect((await call(admin, "get", `/sales/orders/${mixed.id}`)).body.status).toBe("confirmed");
    const teaOrder = await dropshipOrder(tea.id);
    expect((await call(purchaser, "post", `/purchasing/dropship-orders/${tea.id}/cancel`, { reason: "Nhà cung cấp hết hàng", version: teaOrder.version })).status).toBe(201);
    const closed = await call(admin, "get", `/sales/orders/${mixed.id}`);
    expect(closed.body.status).toBe("closed");
    expect((await pool.query("SELECT 1 FROM inventory.reservations WHERE source_id = $1 AND status = 'active'", [mixed.id])).rows).toHaveLength(0);
  });
});
