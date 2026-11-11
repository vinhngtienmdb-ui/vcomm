// CONG_VIEC_43 lát L2: loại sản phẩm dịch vụ, đơn bán tay chỉ dịch vụ (KICHBAN_KIEMTHU_421; TIEUCHI_NGHIEMTHU_276).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { prepareMarketplace, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let groupAdmin: Session;
let accountant: Session;
let customerId: string;
let serviceProduct: { productId: string; variantId: string };
const units: Record<string, string> = {};
const retail: string = testIds.retailCompany;

const as = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const orderBody = (lines: { variantId: string; quantity: string }[]) => ({
  customerId,
  channelId: store.channelId,
  warehouseId: store.warehouseId,
  orderDate: store.today,
  lines: lines.map((line) => ({ ...line, unitId: units.CAI })),
});
const productBody = (categoryId: string, name: string, kind: "goods" | "service", extra: Record<string, unknown> = {}) => ({
  categoryId,
  name,
  kind,
  vatRate: "10",
  tracksLots: false,
  tracksSerials: false,
  warrantyMonths: 0,
  baseUnitId: units.CAI,
  variants: [{ barcodes: [] }],
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  // Cửa hàng VComm có hai mặt hàng hàng hóa còn tồn, kênh, bảng giá VCOMM (dùng lại cho đơn bán tay).
  store = await prepareMarketplace(application, pool);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const accountantId = await createTestUser(pool, "ketoan.dv43@vcomm.test", "Kế Toán Dịch Vụ", [{ companyId: retail }]);
  await pool.query(
    "INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT $1, id, 'company', $2, '2026-01-01' FROM core.roles WHERE code = 'accountant' AND company_id IS NULL",
    [accountantId, retail],
  );
  accountant = await signIn(application, "ketoan.dv43@vcomm.test");
  const categoryId = (await as(groupAdmin, "post", "/catalog/categories", { code: "DVLD", nameVi: "Dịch vụ", nameEn: "Services" })).body.id as string;
  const created = await store.call("post", "/catalog/products", productBody(categoryId, "Dịch vụ lắp đặt", "service"));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  serviceProduct = { productId: created.body.id, variantId: created.body.variants[0].id };
  const priceListId = (await store.call("get", "/catalog/price-lists")).body.find((item: { code: string }) => item.code === "VCOMM").id as string;
  const draft = await store.call("post", "/catalog/price-changes", { priceListId, effectiveFrom: store.today, lines: [{ variantId: serviceProduct.variantId, unitId: units.CAI, price: "1100000" }] });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  expect((await store.call("post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  const partner = await store.call("post", "/crm/partners", { kind: "organization", name: "Khách dịch vụ", taxCode: "0343100001" });
  customerId = partner.body.id as string;
  expect((await store.call("put", `/crm/partners/${customerId}/profile`, { isCustomer: true, isSupplier: false, paymentTermDays: 15, creditLimit: null, version: 0 })).status).toBe(200);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_276: sản phẩm dịch vụ, đơn bán tay chỉ dịch vụ", () => {
  it("KICHBAN_KIEMTHU_421: dịch vụ không theo dõi lô, serial; không vào phiếu kho; đổi loại khi đã có tồn bị từ chối", async () => {
    const product = await store.call("get", `/catalog/products/${serviceProduct.productId}`);
    expect(product.body).toMatchObject({ kind: "service", tracksLots: false, tracksSerials: false });
    const categoryId = product.body.categoryId as string;
    const tracked = await store.call("post", "/catalog/products", productBody(categoryId, "Dịch vụ có lô", "service", { tracksLots: true }));
    expect(tracked.status).toBe(400);
    expect(Object.keys(tracked.body.error.fields)).toEqual(["tracksLots"]);
    // Phiếu nhập khác có dòng dịch vụ bị từ chối ở đúng dòng.
    const receipt = await store.call("post", "/inventory/documents", {
      type: "receipt_other",
      warehouseId: store.warehouseId,
      companyId: retail,
      documentDate: store.today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [{ variantId: serviceProduct.variantId, unitId: units.CAI, quantity: "1", unitCost: "1000" }],
    });
    expect(receipt.status).toBe(400);
    expect(receipt.body.error.fields["lines.0.variantId"]).toBe("Mặt hàng dịch vụ không theo dõi tồn kho: không lập phiếu kho, giữ hàng, kiểm kê.");
    // Hàng hóa đã có tồn: không đổi sang dịch vụ.
    const cream = (await store.call("get", `/catalog/products/${store.products.cream}`)).body;
    const changed = await as(store.admin, "patch", `/catalog/products/${store.products.cream}`, {
      categoryId: cream.categoryId,
      code: cream.code,
      name: cream.name,
      kind: "service",
      vatRate: cream.vatRate,
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: cream.baseUnitId,
      variants: cream.variants.map((variant: { id: string; sku: string }) => ({ id: variant.id, sku: variant.sku, barcodes: [] })),
      version: cream.version,
    });
    expect(changed.status).toBe(409);
    expect(changed.body.error.message).toBe("Sản phẩm đã phát sinh tồn kho, chứng từ kho; không đổi loại được.");
  });

  it("KICHBAN_KIEMTHU_421: đơn bán tay có hàng hóa bị từ chối khi tắt cài đặt, được khi bật; đơn chỉ dịch vụ lập, gửi không giữ hàng", async () => {
    const goods = await as(accountant, "post", "/sales/orders", orderBody([{ variantId: store.variants.cream, quantity: "1" }]));
    expect(goods.status).toBe(409);
    expect(goods.body.error.message).toBe("Đơn bán lập tay chỉ gồm mặt hàng dịch vụ. Hàng hóa bán qua sàn VComm.");
    const service = await as(accountant, "post", "/sales/orders", orderBody([{ variantId: serviceProduct.variantId, quantity: "2" }]));
    expect(service.status, JSON.stringify(service.body)).toBe(201);
    const submitted = await as(accountant, "post", `/sales/orders/${service.body.id}/submit`);
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
    expect(submitted.body.status).toBe("confirmed");
    expect((await pool.query("SELECT count(*)::int AS total FROM inventory.reservations WHERE source_id = $1", [service.body.id])).rows[0].total).toBe(0);
    // Bật cài đặt: đơn có hàng hóa lập được.
    const settings = (await store.call("get", "/sales/settings")).body;
    expect(settings.allowManualGoodsOrders).toBe(false);
    const saved = await store.call("put", "/sales/settings", { maxManualDiscountPercent: settings.maxManualDiscountPercent, allowManualGoodsOrders: true, version: settings.version });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.allowManualGoodsOrders).toBe(true);
    const allowed = await as(accountant, "post", "/sales/orders", orderBody([{ variantId: store.variants.cream, quantity: "1" }]));
    expect(allowed.status, JSON.stringify(allowed.body)).toBe(201);
    // Giữ nguyên phần trăm chiết khấu khi chỉ đổi công tắc; bỏ trống công tắc thì giữ giá trị đang lưu.
    const kept = await store.call("put", "/sales/settings", { maxManualDiscountPercent: "5", version: saved.body.version });
    expect(kept.body).toMatchObject({ maxManualDiscountPercent: "5", allowManualGoodsOrders: true });
    await store.call("put", "/sales/settings", { maxManualDiscountPercent: "0", allowManualGoodsOrders: false, version: kept.body.version });
  });

  it("KICHBAN_KIEMTHU_421: đơn VComm hàng hóa vẫn lập, xác nhận, giữ hàng khi cài đặt tắt", async () => {
    expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
    await store.register("0943000001", "Người Mua Bốn Ba");
    const buyer = await store.buyerSession("0943000001");
    const addressId = await store.addressOf(buyer);
    const lines = [{ variantId: store.variants.soap, quantity: 1 }];
    const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
    const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total });
    expect(placed.status, JSON.stringify(placed.body)).toBe(201);
    const order = (await pool.query("SELECT o.id, o.status FROM sales.orders o JOIN marketplace.orders m ON m.sales_order_id = o.id WHERE m.id = $1", [placed.body.id])).rows[0];
    expect(order.status).toBe("confirmed");
    expect((await pool.query("SELECT count(*)::int AS total FROM inventory.reservations WHERE source_id = $1 AND status = 'active'", [order.id])).rows[0].total).toBe(1);
  });

  // Đơn chỉ dịch vụ khi xác nhận coi là đã giao đủ, có công nợ, hóa đơn, bút toán (QUYTAC_NGHIEPVU_276): chưa làm, chờ người dùng chọn phương án (báo cáo lát L2).
  it.todo("KICHBAN_KIEMTHU_421: đơn chỉ dịch vụ xác nhận là đã giao, có công nợ phải thu, hóa đơn điện tử, bút toán doanh thu");
});
