// CONG_VIEC_53 lát L2: bán hàng tại quầy, thanh toán tiền mặt, ghi sổ (TIEUCHI_NGHIEMTHU_351, 352, 353; KICHBAN_KIEMTHU_512 đến 515, 520).
// Hàng thuế 10%, giá bảng giá kênh Bán lẻ gồm thuế: Gạo 110.000 (giá vốn 80.000 chưa thuế), Sữa 33.000 (khuyến mãi giảm 10%), Nước rửa chén 22.000 (tặng khi mua 2 Gạo),
// Bánh theo lô 11.000, Điện thoại theo serial 5.500.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let admin: Session;
let cashier: Session;
let otherBranchCashier: Session;
let manager: Session;
let today: string;
let shiftId: string;
const units: Record<string, string> = {};
const items: Record<string, string> = {};

const call = (session: Session, method: "get" | "post" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const line = (key: string, quantity: string, extra: Record<string, unknown> = {}) => ({ variantId: items[key], unitId: units.CAI, quantity, ...extra });
const sale = (lines: Record<string, unknown>[], expectedTotal: string, payments: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  call(cashier, "post", "/retail/sales", { shiftId, clientKey: randomUUID(), lines, expectedTotal, payments, ...extra });
const stock = async (key: string) =>
  Number((await pool.query<{ quantity: string }>("SELECT quantity FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [fixture.warehouseId, items[key]])).rows[0]?.quantity ?? 0);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  fixture = await createRetailFixture(application, pool);
  admin = fixture.admin;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const categoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "BANLE", nameVi: "Bán lẻ", nameEn: "Retail" } })).body.id;
  const product = async (key: string, name: string, extra: Record<string, unknown> = {}) => {
    const created = await call(admin, "post", "/catalog/products", {
      categoryId,
      name,
      vatRate: "10",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.CAI,
      variants: [{ barcodes: [] }],
      ...extra,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("rice", "Gạo ST25 túi 5kg", { variants: [{ barcodes: [{ unitId: units.CAI, barcode: "8936012345678" }] }] });
  await product("milk", "Sữa tươi tiệt trùng 1L");
  await product("soap", "Nước rửa chén 750ml");
  await product("cake", "Bánh quy bơ", { tracksLots: true });
  await product("phone", "Điện thoại VPhone", { tracksSerials: true });
  await product("repair", "Dịch vụ sửa chữa", { kind: "service" });
  const receipt = await call(admin, "post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId: fixture.warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu cửa hàng",
    lines: [
      line("rice", "10", { unitCost: "80000" }),
      line("milk", "20", { unitCost: "20000" }),
      line("soap", "5", { unitCost: "10000" }),
      line("cake", "2", { unitCost: "5000", lotNo: "L-SOM", expiresOn: "2026-12-01" }),
      line("cake", "10", { unitCost: "6000", lotNo: "L-MUON", expiresOn: "2027-03-01" }),
      line("phone", "3", { unitCost: "4000000", serials: ["IMEI-1", "IMEI-2", "IMEI-3"] }),
    ],
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  expect((await call(admin, "post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const priceList = (await call(admin, "post", "/catalog/price-lists", { code: "BANLE", name: "Giá bán lẻ", includesVat: true, channelId: fixture.retailChannel })).body.id;
  const prices = { rice: "110000", milk: "33000", soap: "22000", cake: "11000", phone: "5500000", repair: "200000" };
  const change = await call(admin, "post", "/catalog/price-changes", {
    priceListId: priceList,
    effectiveFrom: today,
    lines: Object.entries(prices).map(([key, price]) => ({ variantId: items[key], unitId: units.CAI, price })),
  });
  expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  const promotion = async (body: Record<string, unknown>) => {
    const created = await call(admin, "post", "/sales/promotions", { validFrom: today, validTo: "2026-12-31", channelIds: [fixture.retailChannel], ...body });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect((await call(admin, "post", `/sales/promotions/${created.body.id}/submit`)).body.status).toBe("active");
  };
  await promotion({ name: "Tuần lễ sữa", kind: "product_discount", items: [{ variantId: items.milk, discountPercent: "10" }] });
  await promotion({ name: "Mua 2 gạo tặng nước rửa chén", kind: "buy_get", buyVariantId: items.rice, buyQuantity: "2", giftVariantId: items.soap, giftQuantity: "1" });
  await call(admin, "put", "/sales/settings", { maxManualDiscountPercent: "10", version: 0 });
  expect((await call(admin, "post", "/finance/ledger/setup")).status).toBe(201);

  const store = (await call(admin, "post", "/retail/stores", storeBody(fixture))).body;
  const withRegister = (await call(admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q01", name: "Quầy 1" })).body;
  cashier = await assignRetailRole(application, pool, "thungan.td@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  otherBranchCashier = await assignRetailRole(application, pool, "thungan.q1@vcomm.test", "Phan Thị Một", "cashier", fixture.otherStoreBranch);
  manager = await assignRetailRole(application, pool, "cuahangtruong.td@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  shiftId = (await call(cashier, "post", "/retail/shifts", { registerId: withRegister.registers[0].id, openingCash: "1000000" })).body.id;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Tìm, quét hàng (KICHBAN_KIEMTHU_512)", () => {
  it("quét mã vạch, serial thêm đúng mặt hàng; tìm theo tên; không trả dịch vụ; cần ca của mình", async () => {
    const scanned = (await call(cashier, "get", `/retail/items?shiftId=${shiftId}&search=8936012345678`)).body;
    expect(scanned).toEqual([expect.objectContaining({ variantId: items.rice, unitId: units.CAI, exact: true, available: "10", serial: null })]);
    const serial = (await call(cashier, "get", `/retail/items?shiftId=${shiftId}&search=IMEI-2`)).body;
    expect(serial).toEqual([expect.objectContaining({ variantId: items.phone, serial: "IMEI-2", exact: true, tracksSerials: true })]);
    const byName = (await call(cashier, "get", `/retail/items?shiftId=${shiftId}&search=${encodeURIComponent("sữa")}`)).body;
    expect(byName.map((item: { variantId: string; exact: boolean }) => [item.variantId, item.exact])).toEqual([[items.milk, false]]);
    expect((await call(cashier, "get", `/retail/items?shiftId=${shiftId}&search=${encodeURIComponent("Dịch vụ")}`)).body).toEqual([]);
    expect((await call(manager, "get", `/retail/items?shiftId=${shiftId}&search=gao`)).status).toBe(404);
  });
});

describe("Tính giỏ (KICHBAN_KIEMTHU_513)", () => {
  it("giá kênh, khuyến mãi, hàng tặng, giảm tay; tiền hàng trừ khuyến mãi, giảm tay bằng phải trả", async () => {
    const quote = await call(cashier, "post", "/retail/quote", { shiftId, lines: [line("rice", "2", { discountPercent: "5" }), line("milk", "3")] });
    expect(quote.status, JSON.stringify(quote.body)).toBe(200);
    expect(
      quote.body.lines.map((item: { productName: string; isGift: boolean; total: string; promotionName: string | null }) => [item.productName, item.isGift, item.total, item.promotionName]),
    ).toEqual([
      ["Gạo ST25 túi 5kg", false, "209000", null],
      ["Sữa tươi tiệt trùng 1L", false, "89100", "Tuần lễ sữa"],
      ["Nước rửa chén 750ml", true, "0", "Mua 2 gạo tặng nước rửa chén"],
    ]);
    expect(quote.body).toMatchObject({ totalAmount: "298100", manualDiscount: "11000", maxManualDiscountPercent: "10" });
    expect(Number(quote.body.goodsAmount) - Number(quote.body.promotionAmount) - Number(quote.body.manualDiscount)).toBe(298100);
  });

  it("chặn giảm tay vượt mức, dịch vụ, mặt hàng không có giá", async () => {
    const over = await call(cashier, "post", "/retail/quote", { shiftId, lines: [line("rice", "1", { discountPercent: "10.01" })] });
    expect(over.body.error.fields).toEqual({ "lines.0.discountPercent": "Giảm tay vượt mức tối đa trong cài đặt bán hàng." });
    expect((await call(cashier, "post", "/retail/quote", { shiftId, lines: [line("rice", "1", { discountPercent: "10" })] })).status).toBe(200);
    expect((await call(cashier, "post", "/retail/quote", { shiftId, lines: [line("repair", "1")] })).body.error.fields).toEqual({
      "lines.0.variantId": "Quầy chỉ bán hàng hóa. Dịch vụ bán qua đơn bán dịch vụ.",
    });
  });
});

describe("Thanh toán, ghi sổ (KICHBAN_KIEMTHU_514, 515)", () => {
  let saleId: string;

  it("thiếu tiền, tổng đổi bị chặn và không ghi gì", async () => {
    const lines = [line("rice", "2", { discountPercent: "5" }), line("milk", "3")];
    expect((await sale(lines, "298100", [{ method: "cash", amount: "298000" }])).body.error.message).toBe("Tiền khách đưa chưa đủ số phải trả.");
    expect((await sale(lines, "298000", [{ method: "cash", amount: "300000" }])).body.error.message).toBe("Giá hoặc khuyến mãi vừa thay đổi. Kiểm tra tổng mới rồi thanh toán lại.");
    expect(await stock("rice")).toBe(10);
    expect((await pool.query("SELECT 1 FROM sales.orders WHERE is_retail")).rows).toHaveLength(0);
  });

  it("tiền mặt có tiền thừa: ghi đơn bán, phiếu xuất, giá vốn, bút toán; không có công nợ; gửi lại cùng khóa không ghi trùng", async () => {
    const clientKey = randomUUID();
    const body = { shiftId, clientKey, lines: [line("rice", "2", { discountPercent: "5" }), line("milk", "3")], expectedTotal: "298100", payments: [{ method: "cash", amount: "400000" }] };
    const created = await call(cashier, "post", "/retail/sales", body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    saleId = created.body.id;
    expect(created.body).toMatchObject({
      documentNo: expect.stringMatching(/^BL/),
      totalAmount: "298100",
      tenderedAmount: "400000",
      changeAmount: "101900",
      manualDiscount: "11000",
      cashierName: "Nguyễn Thị Lan",
      store: { name: "Cửa hàng Thủ Đức", returnDays: 7, receiptFooter: "Đổi trả trong 7 ngày kèm hóa đơn này." },
      company: { taxCode: "0312345678" },
      payments: [{ method: "cash", amount: "400000" }],
      stockDocument: { documentNo: expect.stringMatching(/^XBH/) },
    });
    expect(created.body.lines).toHaveLength(3);
    const again = await call(cashier, "post", "/retail/sales", body);
    expect(again.body.id).toBe(saleId);
    expect((await pool.query("SELECT count(*)::int AS total FROM retail.sales")).rows[0].total).toBe(1);

    expect([await stock("rice"), await stock("milk"), await stock("soap")]).toEqual([8, 17, 4]);
    const order = (await pool.query("SELECT status, is_retail, customer_id FROM sales.orders WHERE id = $1", [created.body.salesOrder.id])).rows[0];
    expect(order).toEqual({ status: "delivered", is_retail: true, customer_id: null });
    const document = (await pool.query("SELECT status, partner_id FROM inventory.documents WHERE id = $1", [created.body.stockDocument.id])).rows[0];
    expect(document).toEqual({ status: "posted", partner_id: null });
    expect((await pool.query("SELECT 1 FROM finance.debt_items WHERE source_id = $1", [created.body.stockDocument.id])).rows).toHaveLength(0);
    const journal = await pool.query<{ code: string; debit: string; credit: string }>(
      `SELECT a.code, sum(l.debit)::text AS debit, sum(l.credit)::text AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
       JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_type = 'inventory_document' AND j.source_id = $1 GROUP BY a.code ORDER BY a.code`,
      [created.body.stockDocument.id],
    );
    const byCode = Object.fromEntries(journal.rows.map((row) => [row.code, [Number(row.debit), Number(row.credit)]]));
    expect(byCode["131"]).toEqual([298100, 0]);
    expect(byCode["632"]).toEqual([2 * 80000 + 3 * 20000 + 10000, 0]);
    expect(byCode["156"]).toEqual([0, 2 * 80000 + 3 * 20000 + 10000]);
    expect(byCode["511"]![1] + byCode["33311"]![1]).toBe(298100);
  });

  it("chặn dưới giá vốn, thiếu tồn, serial thiếu; lô xuất hết hạn trước", async () => {
    await call(admin, "put", "/sales/settings", { maxManualDiscountPercent: "30", version: 1 });
    expect((await sale([line("rice", "1", { discountPercent: "30" })], "77000", [{ method: "cash", amount: "77000" }])).body.error.message).toBe(
      "Giá sau giảm thấp hơn giá vốn. Giảm ít hơn hoặc báo cửa hàng trưởng.",
    );
    await call(admin, "put", "/sales/settings", { maxManualDiscountPercent: "10", version: 2 });
    expect((await sale([line("milk", "18")], "534600", [{ method: "cash", amount: "534600" }])).status).toBe(409);
    expect((await sale([line("phone", "2", { serials: ["IMEI-1"] })], "11000000", [{ method: "cash", amount: "11000000" }])).body.error.message).toBe(
      "Số serial quét chưa khớp số lượng hàng theo serial.",
    );
    const phone = await sale([line("phone", "1", { serials: ["IMEI-2"] })], "5500000", [{ method: "cash", amount: "5500000" }]);
    expect(phone.status, JSON.stringify(phone.body)).toBe(201);
    expect((await pool.query("SELECT status FROM inventory.serials WHERE serial_no = 'IMEI-2'")).rows[0].status).toBe("issued");
    const cake = await sale([line("cake", "3")], "33000", [{ method: "cash", amount: "50000" }]);
    expect(cake.status, JSON.stringify(cake.body)).toBe(201);
    const lots = await pool.query<{ lot_no: string; quantity: string }>(
      "SELECT lt.lot_no, abs(l.base_quantity)::text AS quantity FROM inventory.document_lines l JOIN inventory.lots lt ON lt.id = l.lot_id WHERE l.document_id = $1 ORDER BY lt.lot_no",
      [cake.body.stockDocument.id],
    );
    expect(lots.rows.map((row) => [row.lot_no, Number(row.quantity)])).toEqual([
      ["L-MUON", 1],
      ["L-SOM", 2],
    ]);
  });

  it("ca cộng tiền mặt đã trừ tiền thừa; người chi nhánh khác không xem được hóa đơn", async () => {
    const shift = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    expect(shift.saleCount).toBe(3);
    expect(shift.summary[0]).toMatchObject({ method: "cash", sales: String(298100 + 5500000 + 33000) });
    expect(shift.expectedCash).toBe(String(1000000 + 298100 + 5500000 + 33000));
    expect((await call(manager, "get", `/retail/sales/${saleId}`)).status).toBe(200);
    expect((await call(otherBranchCashier, "get", `/retail/sales/${saleId}`)).status).toBe(404);
    expect((await call(manager, "get", "/retail/sales")).body.total).toBe(3);
    expect((await otherBranchCashier.call("get", "/retail/sales", { companyId: testIds.retailCompany })).body.total).toBe(0);
  });
});
