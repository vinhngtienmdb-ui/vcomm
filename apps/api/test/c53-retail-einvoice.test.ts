// CONG_VIEC_53 lát L5: hóa đơn điện tử khởi tạo từ máy tính tiền (QUYTAC_NGHIEPVU_378; TIEUCHI_NGHIEMTHU_356; KICHBAN_KIEMTHU_518).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EinvoicesService } from "../src/einvoice/einvoices.service";
import { PermissionService } from "../src/permissions/permission.service";
import type { Session } from "./helpers";
import { assignRetailRole, createRetailCatalog, createRetailFixture, retail, storeBody, type RetailFixture } from "./retail-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: RetailFixture;
let cashier: Session;
let manager: Session;
let units: Record<string, string> = {};
let items: Record<string, string> = {};
let cashierShift: string;
let managerShift: string;
let today: string;
let year: number;

const call = (session: Session, method: "get" | "post" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const sell = (lines: Record<string, unknown>[], total: string, buyer?: Record<string, unknown>) =>
  call(cashier, "post", "/retail/sales", { shiftId: cashierShift, clientKey: randomUUID(), lines, buyer, expectedTotal: total, payments: [{ method: "cash", amount: total }] });
const rice = (quantity: string) => ({ variantId: items.rice, unitId: units.CAI, quantity });

async function saveSettings(overrides: Record<string, unknown> = {}) {
  const current = (await call(fixture.admin, "get", "/finance/einvoice-settings")).body as { version: number };
  return call(fixture.admin, "put", "/finance/einvoice-settings", {
    enabled: true,
    startDate: `${year}-01-01`,
    provider: "simulator",
    environment: "test",
    withTaxCode: true,
    templateCode: "1",
    appId: null,
    taxCode: null,
    username: null,
    simulation: "normal",
    series: [{ year, series: `C${String(year).slice(2)}TAA` }],
    cashRegisterSeries: [{ year, series: `C${String(year).slice(2)}MAA` }],
    version: current.version,
    ...overrides,
  });
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  year = Number(today.slice(0, 4));
  fixture = await createRetailFixture(application, pool);
  ({ units, items } = await createRetailCatalog(application, pool, fixture, today));
  const store = (await call(fixture.admin, "post", "/retail/stores", storeBody(fixture))).body;
  await call(fixture.admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q01", name: "Quầy 1" });
  const registers = (await call(fixture.admin, "post", `/retail/stores/${store.id}/registers`, { code: "Q02", name: "Quầy 2" })).body.registers;
  cashier = await assignRetailRole(application, pool, "thungan.hd@vcomm.test", "Nguyễn Thị Lan", "cashier", fixture.storeBranch);
  manager = await assignRetailRole(application, pool, "cuahangtruong.hd@vcomm.test", "Võ Văn Trưởng", "store_manager", fixture.storeBranch);
  cashierShift = (await call(cashier, "post", "/retail/shifts", { registerId: registers[0].id, openingCash: "0" })).body.id;
  managerShift = (await call(manager, "post", "/retail/shifts", { registerId: registers[1].id, openingCash: "500000" })).body.id;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("Hóa đơn điện tử khởi tạo từ máy tính tiền (KICHBAN_KIEMTHU_518)", () => {
  it("công ty chưa bật hóa đơn điện tử: bán bình thường, không lập hóa đơn", async () => {
    const sale = await sell([rice("1")], "110000");
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    expect(sale.body.einvoice).toBeNull();
  });

  it("ký hiệu máy tính tiền đúng định dạng, khớp năm và loại hóa đơn", async () => {
    expect((await saveSettings({ cashRegisterSeries: [{ year, series: `C${String(year).slice(2)}TAA` }] })).status).toBe(400);
    const wrongYear = await saveSettings({ cashRegisterSeries: [{ year, series: `C${String(year - 1).slice(2)}MAA` }] });
    expect(wrongYear.body.error.fields).toEqual({ "cashRegisterSeries.0.series": "Hai số sau chữ đầu phải là hai số cuối của năm." });
    const wrongKind = await saveSettings({ cashRegisterSeries: [{ year, series: `K${String(year).slice(2)}MAA` }] });
    expect(wrongKind.body.error.fields).toEqual({ "cashRegisterSeries.0.series": "Ký hiệu bắt đầu bằng C cho hóa đơn có mã, K cho hóa đơn không mã." });
  });

  it("chưa khai ký hiệu máy tính tiền của năm: chặn bán, không ghi gì", async () => {
    expect((await saveSettings({ cashRegisterSeries: [] })).status).toBe(200);
    const before = (await pool.query("SELECT count(*)::int AS count FROM retail.sales")).rows[0].count;
    const blocked = await sell([rice("1")], "110000");
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toBe("Chưa khai ký hiệu hóa đơn máy tính tiền cho năm nay. Báo kế toán khai trong cài đặt hóa đơn điện tử.");
    expect((await pool.query("SELECT count(*)::int AS count FROM retail.sales")).rows[0].count).toBe(before);
  });

  it("lập hóa đơn trong cùng giao dịch: ký hiệu riêng, số liên tục tại quầy, mã tra cứu, hạn gửi trong ngày; người mua theo yêu cầu", async () => {
    expect((await saveSettings()).status).toBe(200);
    const first = await sell([rice("1")], "110000");
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.einvoice).toMatchObject({ templateCode: "1", series: `C${String(year).slice(2)}MAA`, invoiceNo: "1", status: "pending", taxAuthorityCode: null });
    expect(first.body.einvoice.lookupCode).toMatch(/^[A-Z0-9]{12}$/);
    const second = await sell([rice("2")], "220000", { name: "Công ty TNHH Minh An", taxCode: "0312345678", address: "12 Lê Lợi, Quận 1" });
    expect(second.body.einvoice.invoiceNo).toBe("2");
    const row = (await pool.query("SELECT origin, due_date::text, invoice_date::text, buyer, total_amount::text FROM finance.einvoices WHERE id = $1", [second.body.einvoice.id])).rows[0];
    expect(row).toMatchObject({ origin: "cash_register", due_date: today, invoice_date: today, total_amount: "220000.0000" });
    expect(row.buyer).toMatchObject({ name: "Công ty TNHH Minh An", taxCode: "0312345678", address: "12 Lê Lợi, Quận 1", anonymous: false });
    const anonymous = (await pool.query("SELECT buyer FROM finance.einvoices WHERE id = $1", [first.body.einvoice.id])).rows[0].buyer;
    expect(anonymous.anonymous).toBe(true);

    // Ký hiệu đã cấp số thì không đổi, không bỏ được.
    const settings = (await call(fixture.admin, "get", "/finance/einvoice-settings")).body;
    expect(settings.cashRegisterSeries).toEqual([{ year, series: `C${String(year).slice(2)}MAA`, lastNo: 2 }]);
    const changed = await saveSettings({ cashRegisterSeries: [{ year, series: `C${String(year).slice(2)}MAB` }] });
    expect(changed.body.error.fields).toEqual({ cashRegisterSeries: "Ký hiệu máy tính tiền đã cấp số hóa đơn, không đổi hoặc xóa được." });
    expect((await saveSettings()).status).toBe(200);
  });

  it("gửi nền qua bộ giả lập giữ số đã cấp, nhận mã của cơ quan thuế; hóa đơn bán lẻ in được mã", async () => {
    const sale = await sell([rice("1")], "110000");
    await application.get(EinvoicesService).sendDue();
    const invoice = (await pool.query("SELECT status, invoice_no, tax_authority_code FROM finance.einvoices WHERE id = $1", [sale.body.einvoice.id])).rows[0];
    expect(invoice).toMatchObject({ status: "issued", invoice_no: "3" });
    expect(invoice.tax_authority_code).toBeTruthy();
    const detail = (await call(cashier, "get", `/retail/sales/${sale.body.id}`)).body;
    expect(detail.einvoice).toMatchObject({ invoiceNo: "3", status: "issued", taxAuthorityCode: invoice.tax_authority_code });
    const finance = (await call(fixture.admin, "get", `/finance/einvoices/${sale.body.einvoice.id}`)).body;
    expect(finance).toMatchObject({ origin: "cash_register", lookupCode: sale.body.einvoice.lookupCode, invoiceNo: "3" });
  });

  it("trả hàng tạo việc chờ xử lý hóa đơn như CONG_VIEC_16", async () => {
    const sale = await sell([rice("2")], "220000");
    const lineId = (await pool.query("SELECT id FROM sales.order_lines WHERE order_id = $1", [sale.body.salesOrder.id])).rows[0].id;
    const returned = await call(manager, "post", "/retail/returns", {
      shiftId: managerShift,
      saleId: sale.body.id,
      clientKey: randomUUID(),
      reason: "Khách đổi ý",
      lines: [{ orderLineId: lineId, quantity: "1" }],
      refund: { method: "cash" },
      expectedRefund: "110000",
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    const task = (await pool.query("SELECT original_invoice_id FROM finance.einvoice_return_tasks WHERE return_document_id = $1", [returned.body.stockDocument.id])).rows[0];
    expect(task.original_invoice_id).toBe(sale.body.einvoice.id);
  });

  it("nhà cung cấp chưa hỗ trợ máy tính tiền: vẫn bán, hóa đơn dừng ở lỗi cài đặt", async () => {
    expect((await saveSettings({ provider: "misa", appId: "APP", taxCode: "0101010101", username: "ketoan", password: "matkhau-thu" })).status).toBe(200);
    const sale = await sell([rice("1")], "110000");
    expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    expect(sale.body.einvoice).toMatchObject({ status: "setup_error", invoiceNo: "5" });
    const lastError = (await pool.query("SELECT last_error FROM finance.einvoices WHERE id = $1", [sale.body.einvoice.id])).rows[0].last_error;
    expect(lastError).toBe("einvoiceCashRegisterUnsupported");
  });
});
