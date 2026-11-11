// CONG_VIEC_53 lát L2, L3: bán hàng tại quầy, thanh toán tiền mặt, chuyển khoản, ghi sổ, chứng từ quỹ khi đóng ca
// (TIEUCHI_NGHIEMTHU_351 đến 354; KICHBAN_KIEMTHU_512 đến 516, 520). Hàng, giá, khuyến mãi: createRetailCatalog trong retail-fixture.ts.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { signIn, type Session } from "./helpers";
import { assignRetailRole, createRetailCatalog, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
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
let units: Record<string, string> = {};
let items: Record<string, string> = {};

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
  ({ units, items } = await createRetailCatalog(application, pool, fixture, today));

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
    const byCode = Object.fromEntries(journal.rows.map((row) => [row.code, [Number(row.debit), Number(row.credit)] as const]));
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

describe("Chuyển khoản, nhiều phương thức, đóng ca (KICHBAN_KIEMTHU_514, 516)", () => {
  it("kết hợp chuyển khoản và tiền mặt; chuyển khoản vượt số phải trả bị chặn", async () => {
    expect((await sale([line("rice", "1")], "110000", [{ method: "bank_transfer", amount: "110001" }])).body.error.message).toBe("Tiền chuyển khoản, điểm không được vượt số phải trả.");
    const mixed = await sale([line("rice", "1")], "110000", [
      { method: "bank_transfer", amount: "60000", bankReference: "FT2631512345" },
      { method: "cash", amount: "100000" },
    ]);
    expect(mixed.status, JSON.stringify(mixed.body)).toBe(201);
    expect(mixed.body).toMatchObject({
      changeAmount: "50000",
      payments: [
        { method: "bank_transfer", amount: "60000", bankReference: "FT2631512345" },
        { method: "cash", amount: "100000" },
      ],
    });
    const shift = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    expect(shift.store.bankTransfer).toEqual({ bankBin: "970436", accountNo: "0123456789", accountName: "CONG TY VCOMM BAN LE" });
    expect(shift.summary.slice(0, 2)).toMatchObject([
      { method: "cash", sales: String(298100 + 5500000 + 33000 + 50000) },
      { method: "bank_transfer", sales: "60000" },
    ]);
  });

  it("đóng ca thiếu tiền: phiếu thu theo quỹ, phiếu chi thiếu tiền; phải thu không đối tượng về 0; số dư quỹ khớp tiền đếm được", async () => {
    const shift = (await call(cashier, "get", `/retail/shifts/${shiftId}`)).body;
    const cashSales = 298100 + 5500000 + 33000 + 50000;
    expect(shift.expectedCash).toBe(String(1000000 + cashSales));
    const closed = await call(cashier, "post", `/retail/shifts/${shiftId}/close`, { countedCash: String(1000000 + cashSales - 10000), differenceReason: "Trả nhầm tiền thừa", version: shift.version });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    expect(closed.body.fundDocuments.map((document: { kind: string; amount: string; fundName: string }) => [document.kind, document.fundName, document.amount]).sort()).toEqual(
      [
        ["cash_shortage", "Tiền mặt Cửa hàng Thủ Đức", "10000"],
        ["retail_receipt", "Tiền mặt Cửa hàng Thủ Đức", String(cashSales)],
        ["retail_receipt", "Vietcombank Thủ Đức", "60000"],
      ].sort(),
    );
    const shortage = (await pool.query("SELECT partner_id, staff_user_id, status FROM finance.payments WHERE kind = 'cash_shortage'")).rows[0];
    expect(shortage).toMatchObject({ partner_id: null, status: "posted", staff_user_id: expect.any(String) });
    const receivable = await pool.query<{ balance: string }>(
      `
      SELECT coalesce(sum(l.debit - l.credit), 0)::text AS balance FROM accounting.journal_lines l JOIN accounting.accounts a ON a.id = l.account_id JOIN accounting.journals j ON j.id = l.journal_id
      WHERE a.code = '131' AND l.partner_id IS NULL AND j.company_id = $1`,
      [retail],
    );
    expect(Number(receivable.rows[0]!.balance)).toBe(0);
    const staff = await pool.query<{ debit: string }>(
      `
      SELECT sum(l.debit)::text AS debit FROM accounting.journal_lines l JOIN accounting.accounts a ON a.id = l.account_id JOIN accounting.journals j ON j.id = l.journal_id
      WHERE a.code = '1388' AND j.source_type = 'payment' AND j.company_id = $1`,
      [retail],
    );
    expect(Number(staff.rows[0]!.debit)).toBe(10000);
    const fund = (await call(admin, "get", `/finance/funds/${fixture.cashFund}`)).body;
    expect(fund.balance).toBe(String(cashSales - 10000));
    const payments = (await call(admin, "get", "/finance/payments")).body as { kind: string; partnerName: string | null }[];
    expect(payments.filter((payment) => payment.kind.startsWith("retail_") || payment.kind.startsWith("cash_")).every((payment) => payment.partnerName === null)).toBe(true);
    expect(
      (await call(cashier, "post", "/retail/sales", { shiftId, clientKey: randomUUID(), lines: [line("rice", "1")], expectedTotal: "110000", payments: [{ method: "cash", amount: "110000" }] })).body
        .error.message,
    ).toBe("Ca đã đóng.");
  });
});
