// CONG_VIEC_13: Công nợ phải thu, phải trả (TIEUCHI_NGHIEMTHU_105 đến 110; KICHBAN_KIEMTHU_201 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000; giá mua chưa thuế 8.000 (gồm thuế 8.800). Khách được nợ 30 ngày, nhà cung cấp 15 ngày.
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
  accountant = await assign("ketoan.cn@vcomm.test", "Đào Thị Toán", "accountant");
  seller = await assign("banhang.cn@vcomm.test", "Lạc Văn Bán", "salesperson");
  keeper = await assign("thukho.cn@vcomm.test", "Trịnh Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  approver = await signIn(application, "phuc.le@vcomm.test");

  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "CNO", nameVi: "CNO", nameEn: "CNO" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Hàng công nợ A", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  itemA = product.body.variants[0].id;
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "CNW", name: "Kho công nợ", usesLocations: false } })).body
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
  customer = await partner("Khách công nợ", "0320001301", { isCustomer: true, paymentTermDays: 30 });
  supplier = await partner("Nhà cung cấp công nợ", "0320001302", { isSupplier: true, paymentTermDays: 15 });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_105: quỹ", () => {
  it("KICHBAN_KIEMTHU_201: thêm quỹ tiền mặt, ngân hàng; thiếu thông tin ngân hàng, trùng mã bị từ chối; nhân viên bán hàng không quản lý được quỹ; sửa, ngừng dùng", async () => {
    const cash = await call(accountant, "post", "/finance/funds", { code: "TM", name: "Quỹ tiền mặt", kind: "cash", openingBalance: "1000000" });
    expect(cash.status, JSON.stringify(cash.body)).toBe(201);
    cashFund = cash.body.id;
    expect(cash.body).toMatchObject({ code: "TM", kind: "cash", openingBalance: "1000000", balance: "1000000", status: "active", hasPostings: false, canManage: true });
    expect((await call(accountant, "post", "/finance/funds", { code: "NH", name: "Ngân hàng", kind: "bank" })).body.error.fields).toEqual({
      bankName: expect.any(String),
      accountNo: expect.any(String),
    });
    expect((await call(accountant, "post", "/finance/funds", { code: "tm", name: "Trùng", kind: "cash" })).body.error.fields).toEqual({ code: "Mã quỹ đã có trong công ty." });
    expect((await call(seller, "post", "/finance/funds", { code: "X", name: "X", kind: "cash" })).status).toBe(403);
    expect((await call(seller, "get", "/finance/funds")).status).toBe(403);
    const bank = await call(accountant, "post", "/finance/funds", { code: "NH", name: "Ngân hàng A", kind: "bank", bankName: "Ngân hàng A", accountNo: "0123456789", accountHolder: "VComm Bán lẻ" });
    expect(bank.status, JSON.stringify(bank.body)).toBe(201);
    const renamed = await call(accountant, "patch", `/finance/funds/${bank.body.id}`, {
      code: "NH",
      name: "Tài khoản Ngân hàng A",
      kind: "bank",
      bankName: "Ngân hàng A",
      accountNo: "0123456789",
      openingBalance: "500000",
      status: "inactive",
      version: bank.body.version,
    });
    expect(renamed.body).toMatchObject({ name: "Tài khoản Ngân hàng A", openingBalance: "500000", status: "inactive" });
    expect((await call(accountant, "get", "/finance/funds")).body.map((fund: { code: string }) => fund.code)).toEqual(["TM", "NH"]);
  });
});

describe("TIEUCHI_NGHIEMTHU_106: công nợ tự phát sinh từ phiếu kho", () => {
  it("KICHBAN_KIEMTHU_202: giao hàng tăng phải thu có hạn; trả hàng trừ vào phiếu gốc; đơn không có khách không sinh công nợ; nhập mua tăng phải trả; trả hàng nhà cung cấp giảm phải trả", async () => {
    const order = await confirmedOrder("10", customer);
    const issue = await deliver(order, "4");
    let detail = await items(accountant, customer, "receivable");
    expect(detail.items).toEqual([
      expect.objectContaining({ direction: "debit", sourceType: "sales_issue", sourceId: issue.id, documentNo: issue.documentNo, amount: "44000", openAmount: "44000", dueDate: addDays(today, 30) }),
    ]);
    const returned = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issue.id, documentDate: today, reason: "Lỗi", lines: [{ issueLineId: issue.lines[0]!.id, quantity: "1" }] },
    });
    expect((await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    detail = await items(accountant, customer, "receivable");
    expect(detail).toMatchObject({ balance: "33000", advance: "0", ageing: { notDue: "33000" } });
    const credit = detail.items.find((item: { direction: string }) => item.direction === "credit");
    expect(credit).toMatchObject({
      sourceType: "sales_return",
      amount: "11000",
      openAmount: "0",
      dueDate: null,
      allocations: [expect.objectContaining({ documentNo: issue.documentNo, amount: "11000" })],
    });

    // Đơn không có khách hàng: không sinh công nợ.
    const before = Number((await pool.query("SELECT count(*) FROM finance.debt_items")).rows[0].count);
    await deliver(await confirmedOrder("1", null), "1");
    expect(Number((await pool.query("SELECT count(*) FROM finance.debt_items")).rows[0].count)).toBe(before);

    // Nhập mua 10 cái giá 8.000 chưa thuế, thuế 10%: phải trả 88.000, hạn 15 ngày; trả 2 cái: giảm 17.600.
    const purchase = await admin.call("post", "/purchasing/orders", {
      companyId: retail,
      body: { supplierId: supplier, warehouseId, orderDate: today, lines: [{ variantId: itemA, unitId, quantity: "10", unitPrice: "8000", vatRate: "10" }] },
    });
    expect(purchase.status, JSON.stringify(purchase.body)).toBe(201);
    expect((await admin.call("post", `/purchasing/orders/${purchase.body.id}/submit`, { companyId: retail })).body.status).toBe("approved");
    const lineId = (await admin.call("get", `/purchasing/orders/${purchase.body.id}`, { companyId: retail })).body.lines[0].id;
    const received = await keeper.call("post", "/inventory/purchase-receipts", {
      companyId: retail,
      body: { orderId: purchase.body.id, documentDate: today, lines: [{ orderLineId: lineId, quantity: "10" }] },
    });
    const receipt = (await keeper.call("post", `/inventory/documents/${received.body.id}/submit`, { companyId: retail })).body;
    expect(receipt.status).toBe("posted");
    const back = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: receipt.id, documentDate: today, reason: "Hàng lỗi", lines: [{ receiptLineId: receipt.lines[0].id, quantity: "2" }] },
    });
    expect((await keeper.call("post", `/inventory/documents/${back.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    const payable = await items(accountant, supplier, "payable");
    expect(payable).toMatchObject({ balance: "70400" });
    expect(payable.items.find((item: { direction: string }) => item.direction === "debit")).toMatchObject({
      sourceType: "purchase_receipt",
      amount: "88000",
      openAmount: "70400",
      dueDate: addDays(today, 15),
    });

    const summary = await call(accountant, "get", "/finance/debts?side=receivable");
    expect(summary.body.partners).toEqual([expect.objectContaining({ partnerId: customer, balance: "33000", notDue: "33000", overdueOver90: "0" })]);
    expect((await call(seller, "get", "/finance/debts?side=receivable")).status).toBe(403);
  });
});

describe("TIEUCHI_NGHIEMTHU_109: số dư đầu kỳ, tuổi nợ", () => {
  it("KICHBAN_KIEMTHU_203: số dư đầu kỳ còn nợ quá hạn vào nhóm trên 90 ngày; trả trước đầu kỳ tự trừ nợ cũ nhất; đã trừ thì không xóa; đối tác sai phía bị từ chối", async () => {
    const overdue = await call(accountant, "post", "/finance/debts/opening", {
      partnerId: customer,
      side: "receivable",
      direction: "debit",
      documentNo: "HD-CU-01",
      documentDate: "2026-01-01",
      dueDate: "2026-02-01",
      amount: "50000",
    });
    expect(overdue.status, JSON.stringify(overdue.body)).toBe(201);
    expect(overdue.body).toMatchObject({ balance: "83000", ageing: { notDue: "33000", overdueOver90: "50000" } });
    expect(overdue.body.items.find((item: { documentNo: string }) => item.documentNo === "HD-CU-01")).toMatchObject({ sourceType: "opening", canDelete: true, overdueDays: expect.any(Number) });
    expect((await call(accountant, "get", "/finance/debts?side=receivable&overdueOnly=true")).body.partners).toEqual([expect.objectContaining({ partnerId: customer, overdueOver90: "50000" })]);
    expect((await call(accountant, "get", "/finance/debts?side=receivable&search=khong-co")).body.partners).toEqual([]);

    // Trả trước đầu kỳ cho nhà cung cấp 20.000: tự trừ vào phiếu nhập còn nợ.
    const advance = await call(accountant, "post", "/finance/debts/opening", {
      partnerId: supplier,
      side: "payable",
      direction: "credit",
      documentNo: "UT-01",
      documentDate: "2026-01-05",
      amount: "20000",
    });
    expect(advance.body).toMatchObject({ balance: "50400", advance: "0" });
    const advanceItem = advance.body.items.find((item: { documentNo: string }) => item.documentNo === "UT-01");
    expect(advanceItem).toMatchObject({ openAmount: "0", canDelete: false });
    expect((await call(accountant, "delete", `/finance/debts/opening/${advanceItem.id}`)).body.error.message).toBe("Khoản số dư đầu kỳ đã được trừ nợ, không xóa được.");

    const wrongSide = await call(accountant, "post", "/finance/debts/opening", {
      partnerId: supplier,
      side: "receivable",
      direction: "debit",
      documentNo: "X",
      documentDate: today,
      dueDate: today,
      amount: "1",
    });
    expect(wrongSide.body.error.fields).toEqual({ partnerId: "Đối tác không phải khách hàng của công ty." });
    expect(
      (await call(accountant, "post", "/finance/debts/opening", { partnerId: customer, side: "receivable", direction: "debit", documentNo: "X", documentDate: today, amount: "1" })).body.error.fields,
    ).toEqual({
      dueDate: expect.any(String),
    });
    expect((await call(seller, "post", "/finance/debts/opening", { partnerId: customer, side: "receivable", direction: "credit", documentNo: "X", documentDate: today, amount: "1" })).status).toBe(
      403,
    );

    const removable = await call(accountant, "post", "/finance/debts/opening", {
      partnerId: customer,
      side: "receivable",
      direction: "debit",
      documentNo: "HD-CU-02",
      documentDate: today,
      dueDate: today,
      amount: "1000",
    });
    const removableId = removable.body.items.find((item: { documentNo: string }) => item.documentNo === "HD-CU-02").id;
    expect((await call(accountant, "delete", `/finance/debts/opening/${removableId}`)).body.balance).toBe("83000");
    expect((await call(accountant, "get", `/finance/partners?side=receivable&search=${encodeURIComponent("công nợ")}`)).body).toEqual([expect.objectContaining({ id: customer })]);
  });
});

async function payment(session: Session, body: Record<string, unknown>) {
  const created = await call(session, "post", "/finance/payments", { fundId: cashFund, paymentDate: today, ...body });
  if (created.status !== 201) return created;
  return call(session, "post", `/finance/payments/${created.body.id}/submit`, { version: created.body.version });
}
const fundBalance = async () => (await call(accountant, "get", `/finance/funds/${cashFund}`)).body.balance as string;
async function decide(requestId: string, decision: "approved" | "rejected") {
  await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Ý kiến" } });
  await application.get(OutboxService).dispatchPending();
}

describe("TIEUCHI_NGHIEMTHU_107: phiếu thu trừ nợ theo chứng từ", () => {
  it("KICHBAN_KIEMTHU_204: thu không chọn chứng từ trừ cũ nhất trước, thừa thành trả trước; khoản nợ mới tự trừ trả trước; chọn chứng từ thì trừ đúng chứng từ; vượt số còn lại, vượt số tiền bị từ chối; quỹ có phiếu không sửa số dư đầu", async () => {
    // Đang nợ: HD-CU-01 50.000 (quá hạn) và phiếu xuất 33.000. Thu 100.000: trừ hết cả hai, thừa 17.000.
    const receipt = await payment(accountant, { kind: "customer_receipt", partnerId: customer, amount: "100000", note: "Thu tiền hàng" });
    expect(receipt.body, JSON.stringify(receipt.body)).toMatchObject({ status: "posted", documentNo: expect.stringMatching(/^PT/), unallocated: "17000" });
    expect(receipt.body.lines.map((line: { documentNo: string; allocated: string }) => [line.documentNo, line.allocated])).toEqual([
      ["HD-CU-01", "50000"],
      [expect.stringMatching(/^XBH/), "33000"],
    ]);
    expect(await items(accountant, customer, "receivable")).toMatchObject({ balance: "-17000", advance: "17000" });
    expect(await fundBalance()).toBe("1100000");

    // Giao thêm 1 cái 11.000: tự trừ vào trả trước, còn trả trước 6.000.
    await deliver(await confirmedOrder("1", customer), "1");
    expect(await items(accountant, customer, "receivable")).toMatchObject({ balance: "-6000", advance: "6000" });
    // Giao 2 cái 22.000: trừ 6.000 trả trước, còn nợ 16.000; thu 20.000 chọn đúng phiếu, trừ 10.000: còn nợ 6.000, trả trước 10.000.
    await deliver(await confirmedOrder("2", customer), "2");
    const open = (await call(accountant, "get", `/finance/debts/open?side=receivable&partnerId=${customer}`)).body;
    expect(open).toMatchObject({ advance: "0", items: [expect.objectContaining({ openAmount: "16000" })] });
    const chosen = open.items[0].id;
    const over = await call(accountant, "post", "/finance/payments", {
      kind: "customer_receipt",
      partnerId: customer,
      fundId: cashFund,
      paymentDate: today,
      amount: "20000",
      lines: [{ debitItemId: chosen, amount: "16001" }],
    });
    expect(over.body.error.fields).toEqual({ "lines.0.amount": "Số trừ vượt số còn nợ của chứng từ." });
    const exceeded = await call(accountant, "post", "/finance/payments", {
      kind: "customer_receipt",
      partnerId: customer,
      fundId: cashFund,
      paymentDate: today,
      amount: "5000",
      lines: [{ debitItemId: chosen, amount: "10000" }],
    });
    expect(exceeded.body.error.fields).toEqual({ amount: "Tổng số trừ vượt số tiền phiếu." });
    const partial = await payment(accountant, { kind: "customer_receipt", partnerId: customer, amount: "20000", lines: [{ debitItemId: chosen, amount: "10000" }] });
    expect(partial.body).toMatchObject({ status: "posted", unallocated: "10000", lines: [expect.objectContaining({ id: chosen, allocated: "10000", openAmount: "6000" })] });
    expect(await items(accountant, customer, "receivable")).toMatchObject({ balance: "-4000", advance: "10000" });

    const fund = (await call(accountant, "get", `/finance/funds/${cashFund}`)).body;
    const locked = await call(accountant, "patch", `/finance/funds/${cashFund}`, { code: "TM", name: fund.name, kind: "cash", openingBalance: "2000000", version: fund.version });
    expect(locked.body.error.fields).toEqual({ openingBalance: "Quỹ đã có phiếu thu chi, không sửa được số dư đầu." });
    const ledger = (await call(accountant, "get", `/finance/funds/${cashFund}/ledger?from=${today}&to=${today}`)).body;
    expect(ledger).toMatchObject({ openingBalance: "1000000", closingBalance: "1120000" });
    expect(ledger.entries).toHaveLength(2);
  });
});

describe("TIEUCHI_NGHIEMTHU_108: phiếu chi qua luồng duyệt, hoàn tiền", () => {
  it("KICHBAN_KIEMTHU_205: phiếu chi chờ duyệt, duyệt xong mới ghi sổ; vượt số dư quỹ thì bị từ chối kèm lý do; rút; hoàn tiền không vượt trả trước; không có quyền không lập được", async () => {
    await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "finance.payment",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect((await call(seller, "post", "/finance/payments", { kind: "supplier_payment", partnerId: supplier, fundId: cashFund, paymentDate: today, amount: "1" })).status).toBe(403);
    const before = await fundBalance();
    // Phải trả còn 50.400; chi 30.000 không chọn chứng từ.
    const pending = await payment(accountant, { kind: "supplier_payment", partnerId: supplier, amount: "30000" });
    expect(pending.body).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^PC/), canWithdraw: true });
    expect(await fundBalance()).toBe(before);
    await decide(pending.body.approvalRequestId, "approved");
    expect((await call(accountant, "get", `/finance/payments/${pending.body.id}`)).body).toMatchObject({ status: "posted", unallocated: "0" });
    expect(await items(accountant, supplier, "payable")).toMatchObject({ balance: "20400" });
    expect(Number(await fundBalance())).toBe(Number(before) - 30000);

    // Vượt số dư quỹ: duyệt xong không ghi sổ được, phiếu về bị từ chối kèm lý do.
    const tooMuch = await payment(accountant, { kind: "supplier_payment", partnerId: supplier, amount: "5000000" });
    await decide(tooMuch.body.approvalRequestId, "approved");
    expect((await call(accountant, "get", `/finance/payments/${tooMuch.body.id}`)).body).toMatchObject({ status: "rejected", postError: "Số dư quỹ không đủ.", canEdit: true });

    // Rút khi chờ duyệt.
    const withdrawn = await payment(accountant, { kind: "supplier_payment", partnerId: supplier, amount: "1000" });
    expect((await call(accountant, "post", `/finance/payments/${withdrawn.body.id}/withdraw`)).body.status).toBe("withdrawn");

    // Hoàn tiền cho khách: trả trước đang còn 10.000.
    const refundOver = await call(accountant, "post", "/finance/payments", { kind: "customer_refund", partnerId: customer, fundId: cashFund, paymentDate: today, amount: "10001" });
    expect(refundOver.body.error.fields).toEqual({ amount: "Số tiền hoàn vượt tiền trả trước đang còn." });
    const refund = await payment(accountant, { kind: "customer_refund", partnerId: customer, amount: "4000" });
    await decide(refund.body.approvalRequestId, "approved");
    expect((await call(accountant, "get", `/finance/payments/${refund.body.id}`)).body.status).toBe("posted");
    expect(await items(accountant, customer, "receivable")).toMatchObject({ balance: "0", advance: "6000" });
    // Nhà cung cấp hoàn tiền khi không có trả trước: từ chối.
    expect((await call(accountant, "post", "/finance/payments", { kind: "supplier_refund", partnerId: supplier, fundId: cashFund, paymentDate: today, amount: "1" })).body.error.fields).toEqual({
      amount: "Số tiền hoàn vượt tiền trả trước đang còn.",
    });
    expect((await call(accountant, "get", "/finance/payments?kind=supplier_payment")).body).toHaveLength(3);
  });
});

describe("TIEUCHI_NGHIEMTHU_109: hạn mức công nợ theo dư nợ thật", () => {
  it("KICHBAN_KIEMTHU_206: đơn bán vượt hạn mức theo số dư công nợ cộng phần chưa giao thì sinh ngoại lệ; khách trả tiền thì hết vượt", async () => {
    // Đơn 10 cái từ KICHBAN_KIEMTHU_202 còn 6 cái chưa giao (66.000); số dư công nợ 0 (còn nợ 6.000, trả trước 6.000): dư nợ 66.000.
    const profile = (await admin.call("get", `/crm/partners/${customer}`, { companyId: retail })).body.profile;
    await admin.call("put", `/crm/partners/${customer}/profile`, {
      companyId: retail,
      body: { isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: "80000", version: profile.version },
    });
    const draft = async () => {
      const created = await call(seller, "post", "/sales/orders", {
        channelId: retailChannel,
        warehouseId,
        orderDate: today,
        customerId: customer,
        lines: [{ variantId: itemA, unitId, quantity: "3", discountPercent: "0" }],
      });
      return (await call(seller, "post", `/sales/orders/${created.body.id}/submit`)).body;
    };
    // 66.000 + 33.000 > 80.000: ngoại lệ (chưa có chính sách duyệt đơn bán nên đơn vẫn xác nhận, thêm 33.000 chưa giao).
    expect((await draft()).exceptions).toEqual([expect.objectContaining({ kind: "credit_limit" })]);
    await payment(accountant, { kind: "customer_receipt", partnerId: customer, amount: "60000" });
    // Thu 60.000 (trừ 6.000 còn nợ, thừa 54.000): số dư −60.000, chưa giao 99.000: dư nợ 39.000 + 33.000 ≤ 80.000.
    expect((await draft()).exceptions).toEqual([]);
  });
});
