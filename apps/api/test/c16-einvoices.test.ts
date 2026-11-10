// CONG_VIEC_16: Hóa đơn điện tử (TIEUCHI_NGHIEMTHU_121 đến 123; KICHBAN_KIEMTHU_224 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000 (chưa thuế 10.000); giá vốn 8.000; giá mua chưa thuế 8.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { EinvoicesService } from "../src/einvoice/einvoices.service";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let admin: Session;
let accountant: Session;
let seller: Session;
let keeper: Session;
let chief: Session;
let cashFund: string;
let today: string;
let warehouseId: string;
let retailChannel: string;
let customer: string;
let itemA: string;
let itemB: string;
let unitId: string;
const retail: string = testIds.retailCompany;

async function assign(email: string, name: string, role: string, branchId?: string) {
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
const call = (session: Session, method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

async function partner(name: string, taxCode: string, profile: Record<string, unknown>) {
  const created = await admin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await admin.call("put", `/crm/partners/${created.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: false, paymentTermDays: 0, creditLimit: null, version: 0, ...profile },
  });
  return created.body.id as string;
}
// Đơn bán đã xác nhận (chưa có chính sách duyệt) rồi giao một phần.
async function confirmedOrder(quantity: string, customerId: string | null, variantId = itemA) {
  const created = await call(seller, "post", "/sales/orders", {
    channelId: retailChannel,
    warehouseId,
    orderDate: today,
    ...(customerId ? { customerId } : { buyerName: "Khách lẻ" }),
    lines: [{ variantId, unitId, quantity, discountPercent: "0" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(seller, "post", `/sales/orders/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("confirmed");
  return submitted.body as { id: string; lines: { id: string }[] };
}
async function deliver(order: { id: string; lines: { id: string }[] }, quantity: string) {
  const issue = await keeper.call("post", "/inventory/sales-issues", { companyId: retail, body: { orderId: order.id, documentDate: today, lines: [{ orderLineId: order.lines[0]!.id, quantity }] } });
  expect(issue.status, JSON.stringify(issue.body)).toBe(201);
  const posted = await keeper.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail });
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
  return posted.body as { id: string; documentNo: string; lines: { id: string }[] };
}
beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("ketoan.hd@vcomm.test", "Đào Thị Toán", "accountant");
  chief = await assign("ketoantruong.hd@vcomm.test", "Mai Văn Trưởng", "chief_accountant");
  seller = await assign("banhang.hd@vcomm.test", "Lạc Văn Bán", "salesperson");
  keeper = await assign("thukho.hd@vcomm.test", "Trịnh Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);

  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HDT", nameVi: "HDT", nameEn: "HDT" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Hàng công nợ A", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  itemA = product.body.variants[0].id;
  // Hàng B giá gồm thuế 12.000: đơn giá chưa thuế lẻ (10.909,09...).
  itemB = (
    await admin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId: category, name: "Hàng hóa đơn B", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
    })
  ).body.variants[0].id;
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "HDW", name: "Kho hóa đơn", usesLocations: false } })).body
    .id;
  const receipt = await admin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "receipt_other",
      warehouseId,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [
        { variantId: itemA, unitId, quantity: "1000", unitCost: "8000" },
        { variantId: itemB, unitId, quantity: "100", unitCost: "8000" },
      ],
    },
  });
  expect((await admin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  retailChannel = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const general = (await admin.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "CHUNG", name: "Chung", includesVat: true } })).body.id;
  const change = await admin.call("post", "/catalog/price-changes", {
    companyId: retail,
    body: {
      priceListId: general,
      effectiveFrom: today,
      lines: [
        { variantId: itemA, unitId, price: "11000" },
        { variantId: itemB, unitId, price: "12000" },
      ],
    },
  });
  expect((await admin.call("post", `/catalog/price-changes/${change.body.id}/submit`, { companyId: retail })).status).toBe(201);
  customer = await partner("Khách công nợ", "0320001601", { isCustomer: true, paymentTermDays: 30 });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

type Invoice = {
  id: string;
  status: string;
  series: string | null;
  invoiceNo: string | null;
  taxAuthorityCode: string | null;
  buyer: { name: string | null; taxCode: string | null; anonymous?: boolean };
  seller: { name: string | null; taxCode: string | null };
  lines: { itemName: string; quantity: string; unitPrice: string; vatRate: string; netAmount: string; taxAmount: string; totalAmount: string }[];
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  taxSummary: { vatRate: string; netAmount: string; taxAmount: string }[];
  attempts: { operation: string; outcome: string | null }[];
  hasPdf: boolean;
  version: number;
  lastError: string | null;
};
const settingsBody = (overrides: Record<string, unknown> = {}) => ({
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
  series: [{ year: Number(today.slice(0, 4)), series: `C${today.slice(2, 4)}TAA` }],
  version: 0,
  ...overrides,
});
async function saveSettings(overrides: Record<string, unknown> = {}) {
  const current = (await call(chief, "get", "/finance/einvoice-settings")).body as { version: number };
  const saved = await call(chief, "put", "/finance/einvoice-settings", settingsBody({ version: current.version, ...overrides }));
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return saved.body;
}
const invoiceOf = async (documentId: string) => {
  const row = (await pool.query<{ id: string }>("SELECT id FROM finance.einvoices WHERE source_document_id = $1 AND kind = 'original'", [documentId])).rows[0];
  return row ? ((await call(accountant, "get", `/finance/einvoices/${row.id}`)).body as Invoice & { version: number }) : null;
};
const sendNow = async () => {
  await pool.query("UPDATE finance.einvoices SET next_attempt_at = now() WHERE status IN ('pending', 'retrying', 'awaiting_code')");
  await application.get(EinvoicesService).sendDue();
};

describe("TIEUCHI_NGHIEMTHU_121: cài đặt hóa đơn điện tử theo công ty", () => {
  it("KICHBAN_KIEMTHU_224: kiểm ký hiệu, ngày bắt đầu, thông tin kết nối; mật khẩu không hiện lại; chỉ người có quyền cài đặt sửa được", async () => {
    const year = Number(today.slice(0, 4));
    const empty = (await call(accountant, "get", "/finance/einvoice-settings")).body;
    expect(empty).toMatchObject({ enabled: false, provider: "simulator", canSetup: false, version: 0 });
    expect((await call(accountant, "put", "/finance/einvoice-settings", settingsBody())).status).toBe(403);
    expect((await call(seller, "get", "/finance/einvoice-settings")).status).toBe(403);
    const invalid = await call(chief, "put", "/finance/einvoice-settings", settingsBody({ startDate: null, series: [{ year, series: `K${String(year - 1).slice(2)}TAA` }] }));
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fields).sort()).toEqual(["series.0.series", "startDate"]);
    expect((await call(chief, "put", "/finance/einvoice-settings", settingsBody({ series: [{ year, series: "C2XTAA" }] }))).status).toBe(400);
    const misa = await call(chief, "put", "/finance/einvoice-settings", settingsBody({ provider: "misa" }));
    expect(Object.keys(misa.body.error.fields).sort()).toEqual(["appId", "password", "taxCode", "username"]);
    const saved = await call(
      chief,
      "put",
      "/finance/einvoice-settings",
      settingsBody({ enabled: false, provider: "misa", appId: "APP", taxCode: "0101010101", username: "ketoan", password: "MatKhauMisa1234" }),
    );
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body).toMatchObject({ provider: "misa", passwordLastFour: "1234", version: 1 });
    expect(JSON.stringify(saved.body)).not.toContain("MatKhauMisa");
    const stored = (await pool.query<{ secret_value: Buffer }>("SELECT secret_value FROM finance.einvoice_settings WHERE company_id = $1", [retail])).rows[0]!;
    expect(stored.secret_value.toString("utf8")).not.toContain("MatKhauMisa");
    // Sửa không nhập mật khẩu: giữ mật khẩu cũ.
    const kept = await call(chief, "put", "/finance/einvoice-settings", settingsBody({ enabled: false, provider: "misa", appId: "APP", taxCode: "0101010101", username: "ketoan", version: 1 }));
    expect(kept.body).toMatchObject({ passwordLastFour: "1234", version: 2 });
    expect((await call(chief, "put", "/finance/einvoice-settings", settingsBody({ version: 1 }))).status).toBe(409);
    await saveSettings();
  });
});

describe("TIEUCHI_NGHIEMTHU_122, 123: lập khi giao hàng, gửi nền", () => {
  it("KICHBAN_KIEMTHU_225: phiếu xuất giao hàng ghi sổ lập đúng một hóa đơn, nội dung đúng, tổng bằng công nợ; gửi nhận số liên tục, mã cơ quan thuế, PDF; đơn không có khách vẫn lập", async () => {
    await saveSettings({ simulation: "normal" });
    const order = await confirmedOrder("10", customer);
    const first = await deliver(order, "3");
    const invoice = (await invoiceOf(first.id))!;
    expect(invoice).toMatchObject({ status: "pending", series: `C${today.slice(2, 4)}TAA`, invoiceNo: null });
    expect(invoice.buyer).toMatchObject({ name: "Khách công nợ", taxCode: "0320001601", anonymous: false });
    expect(invoice.lines).toEqual([
      expect.objectContaining({ itemName: "Hàng công nợ A", quantity: "3", unitPrice: "10000", vatRate: "10", netAmount: "30000", taxAmount: "3000", totalAmount: "33000" }),
    ]);
    expect([invoice.netAmount, invoice.taxAmount, invoice.totalAmount]).toEqual(["30000", "3000", "33000"]);
    expect(invoice.taxSummary).toEqual([{ vatRate: "10", netAmount: "30000", taxAmount: "3000" }]);
    const debt = (await pool.query<{ gross: string }>("SELECT gross::text FROM finance.inventory_amounts($1)", [first.id])).rows[0]!;
    expect(Number(debt.gross)).toBe(Number(invoice.totalAmount));

    await sendNow();
    const issued = (await invoiceOf(first.id))!;
    expect(issued).toMatchObject({ status: "issued", invoiceNo: "1", hasPdf: true });
    expect(issued.taxAuthorityCode).toMatch(/^M\d{2}-[0-9A-F]{12}$/);
    const pdf = await call(accountant, "get", `/finance/einvoices/${issued.id}/file/pdf`).responseType("blob");
    expect(
      Buffer.from(pdf.body as Buffer)
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");

    // Giao lần hai, đơn không có khách: số tiếp theo; người mua không cung cấp thông tin.
    const second = await deliver(order, "7");
    const anonymousOrder = await confirmedOrder("1", null);
    const third = await deliver(anonymousOrder, "1");
    await sendNow();
    expect((await invoiceOf(second.id))!).toMatchObject({ status: "issued", invoiceNo: "2", totalAmount: "77000" });
    const anonymous = (await invoiceOf(third.id))!;
    expect(anonymous).toMatchObject({ status: "issued", invoiceNo: "3" });
    expect(anonymous.buyer).toMatchObject({ anonymous: true, taxCode: null });
    const listed = await call(accountant, "get", "/finance/einvoices?status=issued");
    expect(listed.body.total).toBe(3);
    // Đơn giá chưa thuế làm tròn đến đồng; thành tiền theo công nợ.
    const rounded = await deliver(await confirmedOrder("6", customer, itemB), "6");
    expect((await invoiceOf(rounded.id))!.lines).toEqual([expect.objectContaining({ quantity: "6", unitPrice: "10909", netAmount: "65455", taxAmount: "6545", totalAmount: "72000" })]);
    await sendNow();
    expect((await call(seller, "get", "/finance/einvoices")).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_226: lỗi tạm thời gửi lại không lập trùng; hết thời gian chờ thì tra trước khi gửi lại; lỗi dữ liệu dừng chờ gửi lại; chờ cấp mã", async () => {
    const order = await confirmedOrder("10", customer);
    await saveSettings({ simulation: "temporary_error" });
    const temporary = await deliver(order, "1");
    await sendNow();
    expect((await invoiceOf(temporary.id))!).toMatchObject({ status: "retrying", invoiceNo: null });
    const next = (await pool.query<{ minutes: number }>("SELECT extract(epoch FROM next_attempt_at - now()) / 60 AS minutes FROM finance.einvoices WHERE source_document_id = $1", [temporary.id]))
      .rows[0]!;
    expect(Number(next.minutes)).toBeGreaterThan(0);
    await sendNow();
    expect((await invoiceOf(temporary.id))!).toMatchObject({ status: "issued", invoiceNo: "5" });

    await saveSettings({ simulation: "timeout" });
    const timedOut = await deliver(order, "1");
    await sendNow();
    expect((await invoiceOf(timedOut.id))!).toMatchObject({ status: "retrying", invoiceNo: null });
    await sendNow();
    const resolved = (await invoiceOf(timedOut.id))!;
    // Lần sau tra trạng thái theo mã tham chiếu, nhận số đã cấp ở lần gửi đầu.
    expect(resolved).toMatchObject({ status: "issued", invoiceNo: "6" });
    expect(resolved.attempts.map((attempt) => [attempt.operation, attempt.outcome])).toEqual([
      ["status", "issued"],
      ["publish", "unknown"],
    ]);

    await saveSettings({ simulation: "data_error" });
    const broken = await deliver(order, "1");
    await sendNow();
    const failed = (await invoiceOf(broken.id))!;
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toContain("không hợp lệ");
    await sendNow();
    expect((await invoiceOf(broken.id))!.status).toBe("failed");
    await saveSettings({ simulation: "pending_code" });
    expect((await call(seller, "post", `/finance/einvoices/${failed.id}/resend`, { version: failed.version })).status).toBe(403);
    const resent = await call(accountant, "post", `/finance/einvoices/${failed.id}/resend`, { version: failed.version });
    expect(resent.status, JSON.stringify(resent.body)).toBe(201);
    expect(resent.body).toMatchObject({ status: "awaiting_code", invoiceNo: "7", taxAuthorityCode: null });
    await sendNow();
    expect((await invoiceOf(broken.id))!).toMatchObject({ status: "issued", invoiceNo: "7" });
    expect((await call(accountant, "post", `/finance/einvoices/${failed.id}/resend`, { version: resent.body.version })).status).toBe(409);
  });

  it("KICHBAN_KIEMTHU_227: thiếu ký hiệu của năm thì lỗi cài đặt, khai ký hiệu thì gửi; tắt hoặc trước ngày bắt đầu thì không lập; quá hạn báo kế toán", async () => {
    const order = await confirmedOrder("10", customer);
    await saveSettings({ simulation: "normal", series: [], enabled: false });
    const disabled = await deliver(order, "1");
    expect(await invoiceOf(disabled.id)).toBeNull();
    await saveSettings({ simulation: "normal", startDate: addDays(today, 1) });
    const early = await deliver(order, "1");
    expect(await invoiceOf(early.id)).toBeNull();
    // Ký hiệu chỉ khai cho năm sau: hóa đơn năm nay dừng ở lỗi cài đặt.
    const year = Number(today.slice(0, 4));
    await pool.query("DELETE FROM finance.einvoice_series WHERE company_id = $1", [retail]);
    await pool.query("UPDATE finance.einvoice_settings SET start_date = '2026-01-01' WHERE company_id = $1", [retail]);
    const missing = await deliver(order, "1");
    expect((await invoiceOf(missing.id))!).toMatchObject({ status: "setup_error", series: null });
    await saveSettings({ series: [{ year, series: `C${String(year).slice(2)}TAB` }] });
    expect((await invoiceOf(missing.id))!).toMatchObject({ status: "pending", series: `C${String(year).slice(2)}TAB` });
    await sendNow();
    expect((await invoiceOf(missing.id))!).toMatchObject({ status: "issued", invoiceNo: "1" });

    // Quá hạn: hóa đơn chưa phát hành sau ngày làm việc tiếp theo ngày hóa đơn.
    await saveSettings({ simulation: "data_error", series: [{ year, series: `C${String(year).slice(2)}TAB` }] });
    const late = await deliver(order, "1");
    await sendNow();
    await pool.query("UPDATE finance.einvoices SET due_date = due_date - 10 WHERE source_document_id = $1", [late.id]);
    const overdue = await call(accountant, "get", "/finance/einvoices?overdue=true");
    expect(overdue.body.data.map((item: { id: string }) => item.id)).toEqual([(await invoiceOf(late.id))!.id]);
    expect(await application.get(EinvoicesService).notifyOverdue()).toBeGreaterThan(0);
    const notified = await pool.query("SELECT 1 FROM core.notifications n JOIN core.users u ON u.id = n.user_id WHERE u.email = 'ketoan.hd@vcomm.test' AND n.kind = 'einvoice_overdue'");
    expect(notified.rowCount).toBe(1);
    expect(await application.get(EinvoicesService).notifyOverdue()).toBe(0);
  });
});
