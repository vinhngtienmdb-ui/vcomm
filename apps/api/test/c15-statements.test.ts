// CONG_VIEC_15: Báo cáo tài chính (TIEUCHI_NGHIEMTHU_117 đến 120; KICHBAN_KIEMTHU_218 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000 (chưa thuế 10.000); giá vốn 8.000; giá mua chưa thuế 8.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session, salespersonSeesAllCustomers } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let admin: Session;
let accountant: Session;
let seller: Session;
let keeper: Session;
let approver: Session;
let cashFund: string;
let today: string;
let warehouseId: string;
let retailChannel: string;
let customer: string;
let supplier: string;
let itemA: string;
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
const call = (session: Session, method: "get" | "post" | "patch" | "delete", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
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
async function confirmedOrder(quantity: string, customerId: string | null) {
  const created = await call(seller, "post", "/sales/orders", {
    channelId: retailChannel,
    warehouseId,
    orderDate: today,
    ...(customerId ? { customerId } : { buyerName: "Khách lẻ" }),
    lines: [{ variantId: itemA, unitId, quantity, discountPercent: "0" }],
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
const items = async (session: Session, partnerId: string, side: "receivable" | "payable") => (await call(session, "get", `/finance/debts/partners/${partnerId}?side=${side}`)).body;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  await salespersonSeesAllCustomers(pool);
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("ketoantruong.bc@vcomm.test", "Đào Thị Toán", "chief_accountant");
  seller = await assign("banhang.bc@vcomm.test", "Lạc Văn Bán", "salesperson");
  keeper = await assign("thukho.bc@vcomm.test", "Trịnh Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  approver = await signIn(application, "phuc.le@vcomm.test");

  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "BCT", nameVi: "BCT", nameEn: "BCT" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Hàng công nợ A", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  itemA = product.body.variants[0].id;
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BCW", name: "Kho báo cáo", usesLocations: false } })).body
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
      lines: [{ variantId: itemA, unitId, quantity: "1000", unitCost: "8000" }],
    },
  });
  expect((await admin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  retailChannel = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const general = (await admin.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "CHUNG", name: "Chung", includesVat: true } })).body.id;
  const change = await admin.call("post", "/catalog/price-changes", { companyId: retail, body: { priceListId: general, effectiveFrom: today, lines: [{ variantId: itemA, unitId, price: "11000" }] } });
  expect((await admin.call("post", `/catalog/price-changes/${change.body.id}/submit`, { companyId: retail })).status).toBe(201);
  customer = await partner("Khách công nợ", "0320001501", { isCustomer: true, paymentTermDays: 30 });
  supplier = await partner("Nhà cung cấp công nợ", "0320001502", { isSupplier: true, paymentTermDays: 15 });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

const trim = (value: string) => (value.includes(".") ? value.replace(/\.?0+$/, "") : value);
// Dòng bút toán của một chứng từ: [số hiệu tài khoản, Nợ, Có].
async function entries(sourceId: string) {
  const rows = await pool.query<{ code: string; debit: string; credit: string; partner_id: string | null }>(
    `SELECT a.code, l.debit::text, l.credit::text, l.partner_id FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_id = $1 ORDER BY l.line_no`,
    [sourceId],
  );
  return rows.rows.map((row) => [row.code, trim(row.debit), trim(row.credit)]);
}

const accountId = async (code: string) => ((await call(accountant, "get", "/finance/accounts")).body as { id: string; code: string }[]).find((account) => account.code === code)!.id;
async function journal(date: string, lines: { code: string; debit?: string; credit?: string; partnerId?: string }[]) {
  const body = {
    journalDate: date,
    description: "Phiếu kế toán thử",
    lines: await Promise.all(lines.map(async (item) => ({ accountId: await accountId(item.code), partnerId: item.partnerId ?? null, debit: item.debit ?? "0", credit: item.credit ?? "0" }))),
  };
  const created = await call(accountant, "post", "/finance/journals", body);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return call(accountant, "post", `/finance/journals/${created.body.id}/submit`, { version: created.body.version });
}
type Report = { form: string; forms: string[]; lines: { code: string; current: string; previous: string }[]; columns: { label: string; from: string | null; to: string }[] };
const value = (report: Report, code: string, column: "current" | "previous" = "current") => report.lines.find((line) => line.code === code)![column];
const statement = async (query: string) => (await call(accountant, "get", `/finance/statements?${query}`)).body as Report;

describe("TIEUCHI_NGHIEMTHU_117, 118: báo cáo theo Thông tư 99/2025", () => {
  it("KICHBAN_KIEMTHU_218: kỳ chưa khóa sổ: kết quả kinh doanh đúng doanh thu, giá vốn, lợi nhuận; tình hình tài chính cân, lợi nhuận năm nay gồm phần chưa kết chuyển; số đầu năm; không có quyền không xem được", async () => {
    await call(accountant, "post", "/finance/ledger/setup");
    await journal("2026-01-02", [
      { code: "111", debit: "100000000" },
      { code: "41111", credit: "100000000" },
    ]);
    await deliver(await confirmedOrder("10", customer), "4");
    const income = await statement(`kind=income_statement&from=2026-01-01&to=${today}`);
    expect(income.form).toBe("B02-DN");
    expect([value(income, "01"), value(income, "02"), value(income, "10"), value(income, "11"), value(income, "20"), value(income, "50"), value(income, "60")]).toEqual([
      "40000",
      "0",
      "40000",
      "32000",
      "8000",
      "8000",
      "8000",
    ]);
    expect(income.columns.map((column) => column.label)).toEqual(["currentPeriod", "previousPeriod"]);
    expect(value(income, "01", "previous")).toBe("0");

    const balance = await statement(`kind=balance_sheet&to=${today}`);
    expect(balance.form).toBe("B01-DN");
    expect(value(balance, "280")).toBe(value(balance, "440"));
    expect(Number(value(balance, "280"))).toBeGreaterThan(0);
    expect(value(balance, "131")).toBe("44000");
    expect(value(balance, "420b")).toBe("8000");
    // Số đầu năm (cuối ngày 31/12/2025): chưa có số liệu.
    expect(balance.columns[1]).toMatchObject({ label: "startOfYear", to: "2025-12-31" });
    expect(value(balance, "280", "previous")).toBe("0");
    expect((await call(seller, "get", `/finance/statements?kind=balance_sheet&to=${today}`)).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_219: sau khi khóa sổ số liệu không đổi; giảm trừ doanh thu vào chỉ tiêu 02; tài khoản chi tiết đánh dấu dài hạn vào chỉ tiêu dài hạn", async () => {
    // Hàng bán bị trả lại tháng 1: giảm trừ doanh thu 1.000 (Nợ 521, Nợ 33311 / Có 131).
    await journal("2026-01-15", [
      { code: "521", debit: "1000" },
      { code: "33311", debit: "100" },
      { code: "131", credit: "1100", partnerId: customer },
    ]);
    const before = await statement(`kind=income_statement&from=2026-01-01&to=${today}`);
    expect([value(before, "02"), value(before, "10"), value(before, "60")]).toEqual(["1000", "39000", "7000"]);
    // Khóa sổ tháng 1 (kết chuyển 521 sang 511, doanh thu, chi phí sang 911, lãi lỗ sang 4212): báo cáo không đổi.
    expect((await call(accountant, "post", "/finance/ledger/periods/close", { month: "2026-01" })).status).toBe(201);
    const after = await statement(`kind=income_statement&from=2026-01-01&to=${today}`);
    expect([value(after, "02"), value(after, "10"), value(after, "60")]).toEqual(["1000", "39000", "7000"]);
    const balance = await statement(`kind=balance_sheet&to=${today}`);
    expect(value(balance, "280")).toBe(value(balance, "440"));
    expect(value(balance, "420b")).toBe("7000");

    // Phải trả người bán: tài khoản chi tiết 3311 (ngắn hạn), 3312 đánh dấu dài hạn.
    const payable = await accountId("331");
    await call(accountant, "post", "/finance/accounts", { parentId: payable, code: "3311", name: "Phải trả người bán ngắn hạn" });
    const accounts = (await call(accountant, "post", "/finance/accounts", { parentId: payable, code: "3312", name: "Phải trả người bán dài hạn" })).body as {
      id: string;
      code: string;
      version: number;
    }[];
    const longAccount = accounts.find((account) => account.code === "3312")!;
    const system = accounts.find((account) => account.code === "331")!;
    expect(
      (await call(accountant, "patch", `/finance/accounts/${system.id}`, { name: "Phải trả cho người bán", status: "active", isLongTerm: true, version: (system as { version: number }).version }))
        .status,
    ).toBe(400);
    const marked = await call(accountant, "patch", `/finance/accounts/${longAccount.id}`, { name: "Phải trả người bán dài hạn", status: "active", isLongTerm: true, version: longAccount.version });
    expect(marked.body.find((account: { code: string }) => account.code === "3312")).toMatchObject({ isLongTerm: true });
    await journal(today, [
      { code: "156", debit: "5000" },
      { code: "3311", credit: "3000", partnerId: supplier },
      { code: "3312", credit: "2000", partnerId: supplier },
    ]);
    const split = await statement(`kind=balance_sheet&to=${today}`);
    expect([value(split, "311"), value(split, "331")]).toEqual(["3000", "2000"]);
    expect(value(split, "280")).toBe(value(split, "440"));
  });
});

describe("TIEUCHI_NGHIEMTHU_119, 120: Thông tư 133, xuất tệp", () => {
  it("KICHBAN_KIEMTHU_220: công ty theo Thông tư 133 chọn được B01a-DNN, B01b-DNN, kết quả B02-DNN; xuất Excel, PDF", async () => {
    const trading = testIds.tradingCompany;
    const company = (await pool.query<{ version: number }>("SELECT version FROM core.companies WHERE id = $1", [trading])).rows[0]!;
    expect((await groupAdmin.call("patch", `/companies/${trading}`, { body: { accountingRegime: "TT133", version: company.version } })).status).toBe(200);
    const admin133 = (path: string, method: "get" | "post" = "get", body?: unknown) => groupAdmin.call(method, path, { companyId: trading, body });
    expect((await admin133("/finance/ledger/setup", "post")).status).toBe(201);
    const accounts = (await admin133("/finance/accounts")).body as { id: string; code: string }[];
    const id = (code: string) => accounts.find((account) => account.code === code)!.id;
    const created = await admin133("/finance/journals", "post", {
      journalDate: today,
      description: "Góp vốn, bán hàng thu tiền ngay",
      lines: [
        { accountId: id("1111"), debit: "51000000", credit: "0" },
        { accountId: id("4111"), debit: "0", credit: "50000000" },
        { accountId: id("5111"), debit: "0", credit: "1000000" },
      ],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect((await admin133(`/finance/journals/${created.body.id}/submit`, "post", { version: created.body.version })).body.status).toBe("posted");
    const income = (await admin133(`/finance/statements?kind=income_statement&from=2026-01-01&to=${today}`)).body as Report;
    expect(income.form).toBe("B02-DNN");
    expect([value(income, "01"), value(income, "10"), value(income, "60")]).toEqual(["1000000", "1000000", "1000000"]);
    const b01a = (await admin133(`/finance/statements?kind=balance_sheet&to=${today}`)).body as Report;
    expect(b01a).toMatchObject({ form: "B01a-DNN", forms: ["B01a-DNN", "B01b-DNN"] });
    expect(value(b01a, "200")).toBe(value(b01a, "500"));
    expect(value(b01a, "200")).toBe("51000000");
    const b01b = (await admin133(`/finance/statements?kind=balance_sheet&to=${today}&form=B01b-DNN`)).body as Report;
    expect(b01b.form).toBe("B01b-DNN");

    const excel = await call(accountant, "get", `/finance/statements?kind=balance_sheet&to=${today}&format=xlsx`).responseType("blob");
    expect(excel.status).toBe(200);
    expect(String(excel.headers["content-disposition"])).toContain("B01-DN");
    expect(
      Buffer.from(excel.body as Buffer)
        .subarray(0, 2)
        .toString(),
    ).toBe("PK");
    const pdf = await call(accountant, "get", `/finance/statements?kind=income_statement&from=2026-01-01&to=${today}&format=pdf`).responseType("blob");
    expect(pdf.status).toBe(200);
    expect(String(pdf.headers["content-type"])).toContain("application/pdf");
    expect(
      Buffer.from(pdf.body as Buffer)
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
  });
});

describe("TIEUCHI_NGHIEMTHU_117, 118: trường hợp biên", () => {
  it("KICHBAN_KIEMTHU_221: phiếu kế toán kết chuyển thủ công qua 911 không làm sai kết quả kinh doanh; cùng kỳ năm trước giữ ngày cuối tháng; thiếu từ ngày, mẫu không hợp lệ bị từ chối", async () => {
    const before = await statement(`kind=income_statement&from=2026-01-01&to=${today}`);
    const posted = await journal(today, [
      { code: "911", debit: "5000" },
      { code: "632", credit: "5000" },
    ]);
    expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
    const after = await statement(`kind=income_statement&from=2026-01-01&to=${today}`);
    expect([value(after, "01"), value(after, "11"), value(after, "60")]).toEqual([value(before, "01"), value(before, "11"), value(before, "60")]);
    const balance = await statement(`kind=balance_sheet&to=${today}`);
    expect(value(balance, "280")).toBe(value(balance, "440"));

    const february = await statement("kind=income_statement&from=2025-02-01&to=2025-02-28");
    expect(february.columns[1]).toMatchObject({ from: "2024-02-01", to: "2024-02-29" });
    const leap = await statement("kind=income_statement&from=2024-02-01&to=2024-02-29");
    expect(leap.columns[1]).toMatchObject({ from: "2023-02-01", to: "2023-02-28" });

    expect((await call(accountant, "get", `/finance/statements?kind=income_statement&to=${today}`)).status).toBe(400);
    expect((await call(accountant, "get", `/finance/statements?kind=balance_sheet&to=${today}&form=B09-XX`)).status).toBe(400);
  });
});
