// CONG_VIEC_14: Kế toán tổng hợp (TIEUCHI_NGHIEMTHU_111 đến 116; KICHBAN_KIEMTHU_210 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000 (chưa thuế 10.000); giá vốn 8.000; giá mua chưa thuế 8.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
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
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("ketoantruong.kt@vcomm.test", "Đào Thị Toán", "chief_accountant");
  seller = await assign("banhang.kt@vcomm.test", "Lạc Văn Bán", "salesperson");
  keeper = await assign("thukho.kt@vcomm.test", "Trịnh Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  approver = await signIn(application, "phuc.le@vcomm.test");

  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "KTO", nameVi: "KTO", nameEn: "KTO" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Hàng công nợ A", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  itemA = product.body.variants[0].id;
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "KTW", name: "Kho kế toán", usesLocations: false } })).body
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
  customer = await partner("Khách công nợ", "0320001401", { isCustomer: true, paymentTermDays: 30 });
  supplier = await partner("Nhà cung cấp công nợ", "0320001402", { isSupplier: true, paymentTermDays: 15 });
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

describe("TIEUCHI_NGHIEMTHU_111: khởi tạo kế toán, tài khoản", () => {
  it("KICHBAN_KIEMTHU_210: khởi tạo theo Thông tư 99/2025 nạp tài khoản, tạo bút toán cho chứng từ đã ghi sổ; tài khoản chi tiết đúng quy tắc số hiệu, nhận định khoản của tài khoản cha; đổi chế độ khi có bút toán bị từ chối; không có quyền không khởi tạo được", async () => {
    expect((await call(accountant, "get", "/finance/ledger/setup")).body).toMatchObject({ initialized: false, canSetup: true });
    expect((await call(seller, "post", "/finance/ledger/setup")).status).toBe(403);
    const setup = await call(accountant, "post", "/finance/ledger/setup");
    expect(setup.status, JSON.stringify(setup.body)).toBe(201);
    expect(setup.body).toMatchObject({ initialized: true, regime: "TT99_2025", lockedThrough: null });
    const accounts = (await call(accountant, "get", "/finance/accounts")).body as { id: string; code: string; postable: boolean }[];
    expect(accounts).toHaveLength(184);
    // Phiếu nhập tồn đầu (ghi sổ trước khi khởi tạo): Nợ 156 / Có 3388 (giá trị 1.000 × 8.000).
    const opening = (await pool.query<{ id: string }>("SELECT id FROM inventory.documents WHERE company_id = $1 AND reason_code = 'opening_balance' AND warehouse_id = $2", [retail, warehouseId]))
      .rows[0]!.id;
    expect(await entries(opening)).toEqual([
      ["156", "8000000", "0"],
      ["3388", "0", "8000000"],
    ]);
    // Đổi chế độ kế toán của công ty khi đã có bút toán: từ chối; khởi tạo lần nữa: từ chối.
    const company = (await pool.query<{ version: number }>("SELECT version FROM core.companies WHERE id = $1", [retail])).rows[0]!;
    const changed = await groupAdmin.call("patch", `/companies/${retail}`, { body: { accountingRegime: "TT133", version: company.version } });
    expect(changed.body.error.fields).toEqual({ accountingRegime: "Công ty đã có bút toán, không đổi được chế độ kế toán." });
    expect((await call(accountant, "post", "/finance/ledger/setup")).status).toBe(409);

    const receivable = accounts.find((account) => account.code === "131")!;
    expect((await call(accountant, "post", "/finance/accounts", { parentId: receivable.id, code: "1411", name: "Sai" })).body.error.fields).toEqual({ code: expect.any(String) });
    expect((await call(accountant, "post", "/finance/accounts", { parentId: receivable.id, code: "131", name: "Trùng" })).body.error.fields).toEqual({ code: expect.any(String) });
    const created = await call(accountant, "post", "/finance/accounts", { parentId: receivable.id, code: "1311", name: "Phải thu khách hàng trong nước" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.find((account: { code: string }) => account.code === "131")).toMatchObject({ postable: false });
    expect((await call(accountant, "get", "/finance/posting-rules")).body.find((rule: { role: string }) => rule.role === "receivable")).toMatchObject({ accountCode: "1311" });
    const detail = created.body.find((account: { code: string }) => account.code === "1311");
    const system = created.body.find((account: { code: string }) => account.code === "632");
    expect((await call(accountant, "patch", `/finance/accounts/${system.id}`, { name: "Giá vốn", status: "inactive", version: system.version })).body.error.fields).toEqual({
      status: expect.any(String),
    });
    expect((await call(accountant, "patch", `/finance/accounts/${detail.id}`, { name: "Phải thu khách hàng", status: "active", version: detail.version })).status).toBe(200);
  });
});

describe("TIEUCHI_NGHIEMTHU_112: bút toán tự sinh", () => {
  it("KICHBAN_KIEMTHU_211: xuất giao hàng, nhận hàng trả lại, nhập mua, trả hàng nhà cung cấp, xuất làm quà tặng, phiếu thu sinh bút toán cân đúng tài khoản; đổi định khoản áp dụng cho chứng từ sau", async () => {
    const order = await confirmedOrder("10", customer);
    const issue = await deliver(order, "4");
    expect(await entries(issue.id)).toEqual([
      ["1311", "44000", "0"],
      ["511", "0", "40000"],
      ["33311", "0", "4000"],
      ["632", "32000", "0"],
      ["156", "0", "32000"],
    ]);
    expect(
      (await pool.query("SELECT l.partner_id FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id WHERE j.source_id = $1 AND l.line_no = 1", [issue.id])).rows[0]
        .partner_id,
    ).toBe(customer);
    const returned = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issue.id, documentDate: today, reason: "Lỗi", lines: [{ issueLineId: issue.lines[0]!.id, quantity: "1" }] },
    });
    expect((await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    expect(await entries(returned.body.id)).toEqual([
      ["521", "10000", "0"],
      ["33311", "1000", "0"],
      ["1311", "0", "11000"],
      ["156", "8000", "0"],
      ["632", "0", "8000"],
    ]);

    const purchase = await admin.call("post", "/purchasing/orders", {
      companyId: retail,
      body: { supplierId: supplier, warehouseId, orderDate: today, lines: [{ variantId: itemA, unitId, quantity: "10", unitPrice: "8000", vatRate: "10" }] },
    });
    await admin.call("post", `/purchasing/orders/${purchase.body.id}/submit`, { companyId: retail });
    const lineId = (await admin.call("get", `/purchasing/orders/${purchase.body.id}`, { companyId: retail })).body.lines[0].id;
    const received = await keeper.call("post", "/inventory/purchase-receipts", {
      companyId: retail,
      body: { orderId: purchase.body.id, documentDate: today, lines: [{ orderLineId: lineId, quantity: "10" }] },
    });
    const receipt = (await keeper.call("post", `/inventory/documents/${received.body.id}/submit`, { companyId: retail })).body;
    expect(await entries(receipt.id)).toEqual([
      ["156", "80000", "0"],
      ["1331", "8000", "0"],
      ["331", "0", "88000"],
    ]);
    const back = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: receipt.id, documentDate: today, reason: "Hàng lỗi", lines: [{ receiptLineId: receipt.lines[0].id, quantity: "2" }] },
    });
    await keeper.call("post", `/inventory/documents/${back.body.id}/submit`, { companyId: retail });
    expect(await entries(back.body.id)).toEqual([
      ["331", "17600", "0"],
      ["156", "0", "16000"],
      ["1331", "0", "1600"],
    ]);

    const gift = await admin.call("post", "/inventory/documents", {
      companyId: retail,
      body: { type: "issue_other", warehouseId, companyId: retail, documentDate: today, reasonCode: "gift", reason: "Tặng khách", lines: [{ variantId: itemA, unitId, quantity: "1" }] },
    });
    expect((await admin.call("post", `/inventory/documents/${gift.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    expect(await entries(gift.body.id)).toEqual([
      ["6418", "8000", "0"],
      ["156", "0", "8000"],
    ]);

    const fund = (await call(accountant, "post", "/finance/funds", { code: "TM", name: "Quỹ tiền mặt", kind: "cash" })).body.id;
    const created = await call(accountant, "post", "/finance/payments", { kind: "customer_receipt", partnerId: customer, fundId: fund, paymentDate: today, amount: "20000" });
    const paid = await call(accountant, "post", `/finance/payments/${created.body.id}/submit`, { version: created.body.version });
    expect(paid.body.status).toBe("posted");
    expect(await entries(created.body.id)).toEqual([
      ["111", "20000", "0"],
      ["1311", "0", "20000"],
    ]);

    // Mở tài khoản chi tiết 5111 dưới 511: định khoản doanh thu chuyển sang 5111 cho chứng từ sau.
    const revenue = ((await call(accountant, "get", "/finance/accounts")).body as { id: string; code: string }[]).find((account) => account.code === "511")!;
    await call(accountant, "post", "/finance/accounts", { parentId: revenue.id, code: "5111", name: "Doanh thu bán hàng hóa" });
    const next = await deliver(order, "1");
    expect((await entries(next.id))[1]).toEqual(["5111", "0", "10000"]);
    // Bút toán cũ giữ nguyên tài khoản 511.
    expect((await entries(issue.id))[1]).toEqual(["511", "0", "40000"]);
  });
});

const accountId = async (code: string) => ((await call(accountant, "get", "/finance/accounts")).body as { id: string; code: string }[]).find((account) => account.code === code)!.id;
async function journal(body: Record<string, unknown>) {
  const created = await call(accountant, "post", "/finance/journals", body);
  if (created.status !== 201) return created;
  return call(accountant, "post", `/finance/journals/${created.body.id}/submit`, { version: created.body.version });
}
const line = async (code: string, debit: string, credit: string) => ({ accountId: await accountId(code), debit, credit });

describe("TIEUCHI_NGHIEMTHU_113: phiếu kế toán", () => {
  it("KICHBAN_KIEMTHU_212: lệch Nợ Có, dòng ghi cả hai bên bị từ chối; chưa có chính sách thì ghi sổ ngay, cấp số; có chính sách thì chờ duyệt; đã ghi sổ không sửa; không có quyền không lập được", async () => {
    const unbalanced = await call(accountant, "post", "/finance/journals", { journalDate: "2026-10-01", description: "Lệch", lines: [await line("111", "100", "0"), await line("41111", "0", "90")] });
    expect(unbalanced.body.error.fields).toEqual({ lines: "Tổng Nợ phải bằng tổng Có." });
    const twoSides = await call(accountant, "post", "/finance/journals", {
      journalDate: "2026-10-01",
      description: "Hai bên",
      lines: [await line("111", "100", "100"), await line("41111", "0", "0")],
    });
    expect(Object.keys(twoSides.body.error.fields).sort()).toEqual(["lines.0.debit", "lines.1.debit"]);
    expect((await call(seller, "post", "/finance/journals", { journalDate: "2026-10-01", description: "X", lines: [] })).status).toBe(403);
    // Số dư đầu kỳ tài khoản: vốn góp 5.000.000 bằng tiền mặt.
    const opening = await journal({ journalDate: "2026-10-01", description: "Số dư đầu kỳ", lines: [await line("111", "5000000", "0"), await line("41111", "0", "5000000")] });
    expect(opening.body).toMatchObject({ status: "posted", journalNo: expect.stringMatching(/^PKT/), totalAmount: "5000000", canEdit: false });
    expect(
      (
        await call(accountant, "patch", `/finance/journals/${opening.body.id}`, {
          journalDate: "2026-10-01",
          description: "Sửa",
          lines: [await line("111", "1", "0"), await line("41111", "0", "1")],
          version: opening.body.version,
        })
      ).status,
    ).toBe(409);

    await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "accounting.journal",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    const pending = await journal({ journalDate: "2026-10-20", description: "Chi phí khác tháng 10", lines: [await line("6428", "100000", "0"), await line("111", "0", "100000")] });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true });
    const approver = await signIn(application, "phuc.le@vcomm.test");
    await approver.call("post", `/approval-requests/${pending.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(accountant, "get", `/finance/journals/${pending.body.id}`)).body.status).toBe("posted");
    const income = await journal({ journalDate: "2026-10-25", description: "Thu nhập khác tháng 10", lines: [await line("111", "300000", "0"), await line("711", "0", "300000")] });
    await approver.call("post", `/approval-requests/${income.body.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(accountant, "get", "/finance/journals?sourceType=manual&status=posted")).body).toHaveLength(3);
  });
});

describe("TIEUCHI_NGHIEMTHU_114: khóa sổ", () => {
  it("KICHBAN_KIEMTHU_213: khóa tháng 10 kết chuyển chi phí, thu nhập sang 911, lãi sang 4212; chứng từ ngày trong kỳ khóa bị từ chối; tháng chưa kết thúc không khóa; mở lại xóa kết chuyển", async () => {
    const periods = (await call(accountant, "get", "/finance/ledger/periods")).body;
    expect(periods).toMatchObject({ lockedThrough: null, nextMonth: "2026-10", canClose: true, canReopen: false });
    expect((await call(seller, "post", "/finance/ledger/periods/close", { month: "2026-10" })).status).toBe(403);
    const closed = await call(accountant, "post", "/finance/ledger/periods/close", { month: "2026-10" });
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    expect(closed.body).toMatchObject({ lockedThrough: "2026-10-31", nextMonth: "2026-11", canClose: false, canReopen: true });
    const closing = (await call(accountant, "get", "/finance/journals?sourceType=closing")).body[0];
    expect(
      (await call(accountant, "get", `/finance/journals/${closing.id}`)).body.lines.map((item: { accountCode: string; debit: string; credit: string }) => [item.accountCode, item.debit, item.credit]),
    ).toEqual([
      ["911", "100000", "0"],
      ["6428", "0", "100000"],
      ["711", "300000", "0"],
      ["911", "0", "300000"],
      ["911", "200000", "0"],
      ["4212", "0", "200000"],
    ]);
    const locked = await call(accountant, "post", "/finance/journals", { journalDate: "2026-10-31", description: "Muộn", lines: [await line("6428", "1", "0"), await line("111", "0", "1")] });
    expect(locked.body.error.message).toBe("Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.");
    const lateReceipt = await admin.call("post", "/inventory/documents", {
      companyId: retail,
      body: {
        type: "receipt_other",
        warehouseId,
        companyId: retail,
        documentDate: "2026-10-15",
        reasonCode: "found",
        reason: "Thừa",
        lines: [{ variantId: itemA, unitId, quantity: "1", unitCost: "8000" }],
      },
    });
    const lateSubmit = await admin.call("post", `/inventory/documents/${lateReceipt.body.id}/submit`, { companyId: retail });
    expect(lateSubmit.status).toBe(409);
    expect((await call(accountant, "post", "/finance/ledger/periods/close", { month: "2026-11" })).status).toBe(409);

    const reopened = await call(accountant, "post", "/finance/ledger/periods/reopen");
    expect(reopened.body).toMatchObject({ lockedThrough: null, nextMonth: "2026-10" });
    expect((await call(accountant, "get", "/finance/journals?sourceType=closing")).body).toEqual([]);
    expect((await call(accountant, "post", "/finance/ledger/periods/close", { month: "2026-10" })).body.lockedThrough).toBe("2026-10-31");
  });
});

describe("TIEUCHI_NGHIEMTHU_115: sổ sách", () => {
  it("KICHBAN_KIEMTHU_214: bảng cân đối số phát sinh cân ở mọi cột, cộng dồn lên tài khoản cha; sổ cái tiền mặt đúng số dư lũy kế, tài khoản đối ứng", async () => {
    const balance = (await call(accountant, "get", `/finance/ledger/trial-balance?from=2026-11-01&to=${today}`)).body;
    expect(balance.totals.openingDebit).toBe(balance.totals.openingCredit);
    expect(balance.totals.debit).toBe(balance.totals.credit);
    expect(balance.totals.closingDebit).toBe(balance.totals.closingCredit);
    // Đầu tháng 11: tiền mặt 5.000.000 − 100.000 + 300.000; lợi nhuận năm nay 200.000.
    expect(balance.rows.find((row: { code: string }) => row.code === "111")).toMatchObject({ openingDebit: "5200000" });
    expect(balance.rows.find((row: { code: string }) => row.code === "421")).toMatchObject({ openingCredit: "200000", depth: 0 });
    expect(balance.rows.find((row: { code: string }) => row.code === "4212")).toMatchObject({ openingCredit: "200000", depth: 1 });
    expect(balance.rows.find((row: { code: string }) => row.code === "131")).toMatchObject({ debit: "55000" });

    const cash = await accountId("111");
    const ledger = (await call(accountant, "get", `/finance/ledger/accounts/${cash}?from=2026-10-01&to=${today}`)).body;
    expect(ledger).toMatchObject({ openingBalance: "0", totalDebit: "5320000", totalCredit: "100000", closingBalance: "5220000" });
    expect(ledger.entries.map((entry: { counterAccounts: string[]; balance: string }) => [entry.counterAccounts, entry.balance])).toEqual([
      [["41111"], "5000000"],
      [["6428"], "4900000"],
      [["711"], "5200000"],
      [["1311"], "5220000"],
    ]);
  });
});
