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

  it("KICHBAN_KIEMTHU_421: đơn bán tay có hàng hóa bị từ chối khi tắt cài đặt, được khi bật; đơn chỉ dịch vụ lập, gửi không giữ hàng, giao đủ", async () => {
    const goods = await as(accountant, "post", "/sales/orders", orderBody([{ variantId: store.variants.cream, quantity: "1" }]));
    expect(goods.status).toBe(409);
    expect(goods.body.error.message).toBe("Đơn bán lập tay chỉ gồm mặt hàng dịch vụ. Hàng hóa bán qua sàn VComm.");
    const service = await as(accountant, "post", "/sales/orders", orderBody([{ variantId: serviceProduct.variantId, quantity: "2" }]));
    expect(service.status, JSON.stringify(service.body)).toBe(201);
    const submitted = await as(accountant, "post", `/sales/orders/${service.body.id}/submit`);
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
    // Đơn chỉ dịch vụ xác nhận là giao đủ ngay (lát L3).
    expect(submitted.body.status).toBe("delivered");
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

  it("KICHBAN_KIEMTHU_421: đơn chỉ dịch vụ xác nhận: phiếu xuất dịch vụ ghi sổ, không đổi tồn, giao đủ; công nợ phải thu, hóa đơn điện tử, bút toán Nợ 131 / Có 511 / Có 33311", async () => {
    // Khởi tạo kế toán (TT99), bật hóa đơn điện tử giả lập.
    expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
    const year = Number(store.today.slice(0, 4));
    const einvoice = await store.call("put", "/finance/einvoice-settings", {
      enabled: true,
      startDate: "2026-01-01",
      provider: "simulator",
      environment: "test",
      withTaxCode: true,
      templateCode: "1",
      appId: null,
      taxCode: null,
      username: null,
      simulation: "normal",
      series: [{ year, series: `C${store.today.slice(2, 4)}TAA` }],
      version: 0,
    });
    expect(einvoice.status, JSON.stringify(einvoice.body)).toBe(200);
    const movementsBefore = Number((await pool.query("SELECT count(*)::int AS total FROM inventory.movements")).rows[0].total);
    // 3 lần × 1.100.000 gồm thuế (1.000.000 chưa thuế, thuế 10%).
    const created = await as(accountant, "post", "/sales/orders", orderBody([{ variantId: serviceProduct.variantId, quantity: "3" }]));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const order = (await as(accountant, "post", `/sales/orders/${created.body.id}/submit`)).body;
    expect(order).toMatchObject({ status: "delivered" });
    expect(order.lines[0]).toMatchObject({ deliveredBaseQuantity: "3" });
    const documents = (
      await pool.query<{ id: string; type: string; status: string; is_service: boolean; document_no: string }>(
        "SELECT id, type, status, is_service, document_no FROM inventory.documents WHERE source_id = $1",
        [order.id],
      )
    ).rows;
    expect(documents).toEqual([expect.objectContaining({ type: "sales_issue", status: "posted", is_service: true, document_no: expect.stringMatching(/^XBH/) })]);
    const documentId = documents[0]!.id;
    // Không ghi thẻ kho, không giá vốn.
    expect(Number((await pool.query("SELECT count(*)::int AS total FROM inventory.movements")).rows[0].total)).toBe(movementsBefore);
    expect((await pool.query("SELECT cost_value::text FROM inventory.document_lines WHERE document_id = $1", [documentId])).rows).toEqual([{ cost_value: "0.0000" }]);
    // Công nợ phải thu, hạn theo hồ sơ khách 15 ngày.
    const debt = (await pool.query("SELECT side, direction, amount::text, open_amount::text FROM finance.debt_items WHERE source_id = $1", [documentId])).rows;
    expect(debt).toEqual([{ side: "receivable", direction: "debit", amount: "3300000.0000", open_amount: "3300000.0000" }]);
    // Hóa đơn điện tử chờ gửi.
    expect((await pool.query("SELECT kind, total_amount::text FROM finance.einvoices WHERE source_document_id = $1", [documentId])).rows).toEqual([{ kind: "original", total_amount: "3300000.0000" }]);
    // Bút toán Nợ 131 / Có 511 / Có 33311, không giá vốn, không hàng hóa.
    const journal = (
      await pool.query<{ code: string; debit: string; credit: string }>(
        `SELECT a.code, jl.debit::text, jl.credit::text FROM accounting.journals j JOIN accounting.journal_lines jl ON jl.journal_id = j.id JOIN accounting.accounts a ON a.id = jl.account_id
         WHERE j.source_type = 'inventory_document' AND j.source_id = $1 ORDER BY jl.line_no`,
        [documentId],
      )
    ).rows;
    expect(journal).toEqual([
      { code: "131", debit: "3300000.0000", credit: "0.0000" },
      { code: "511", debit: "0.0000", credit: "3000000.0000" },
      { code: "33311", debit: "0.0000", credit: "300000.0000" },
    ]);
    // Đơn đã giao đủ không hủy được (luật cũ); kho không lập tay phiếu cho dịch vụ.
    expect((await as(accountant, "post", `/sales/orders/${order.id}/cancel`, { version: order.version })).status).toBe(409);
  });
});
