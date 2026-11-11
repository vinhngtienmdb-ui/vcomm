// CONG_VIEC_56 lát L0: quỹ ngoại tệ, phiếu mua ngoại tệ, phiếu chi trả nợ ngoại tệ (TIEUCHI_NGHIEMTHU_380 đến 382; KICHBAN_KIEMTHU_547 đến 550).
// Nợ nhà cung cấp nước ngoài: phiếu nhập hôm qua 850 USD theo tỷ giá 25.400 (21.590.000), phiếu nhập hôm nay 425 USD theo tỷ giá 26.000 (11.050.000).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { messages, type Messages } from "i18n";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let purchaser: Session;
let keeper: Session;
let accountant: Session;
let approver: Session;
let today: string;
let yesterday: string;
let warehouseId: string;
let supplierId: string;
let variantId: string;
let pieceUnitId: string;
let vndFundId: string;
let usdFundId: string;
// Khoản nợ của hai phiếu nhập.
let firstDebtId: string;
let secondDebtId: string;
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
async function decide(requestId: string) {
  const decided = await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "Kiểm thử" } });
  expect(decided.status, JSON.stringify(decided.body)).toBeLessThan(300);
  await application.get(OutboxService).dispatchPending();
}
// Nhập kho theo đơn nhập khẩu USD đã duyệt, trả về khoản công nợ sinh ra.
async function importDebt(quantity: string, documentDate: string): Promise<string> {
  const order = await purchaser.call("post", "/purchasing/orders", {
    companyId: retail,
    body: { supplierId, warehouseId, orderDate: documentDate, isImport: true, currency: "USD", lines: [{ variantId, unitId: pieceUnitId, quantity, unitPrice: "8.5", vatRate: "10" }] },
  });
  expect(order.status, JSON.stringify(order.body)).toBe(201);
  const submitted = await purchaser.call("post", `/purchasing/orders/${order.body.id}/submit`, { companyId: retail });
  await decide(submitted.body.approvalRequestId);
  const receipt = await keeper.call("post", "/inventory/purchase-receipts", {
    companyId: retail,
    body: { orderId: order.body.id, documentDate, lines: [{ orderLineId: order.body.lines[0].id, quantity }] },
  });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  const posted = await keeper.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail });
  expect(posted.status, JSON.stringify(posted.body)).toBe(201);
  return (await pool.query<{ id: string }>("SELECT id FROM finance.debt_items WHERE source_id = $1 AND direction = 'debit'", [receipt.body.id])).rows[0]!.id;
}
// Gửi phiếu, duyệt, trả về phiếu sau ghi sổ (hoặc bị từ chối).
async function submitAndApprove(paymentId: string, version: number) {
  const submitted = await accountant.call("post", `/finance/payments/${paymentId}/submit`, { companyId: retail, body: { version } });
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
  expect(submitted.body.status).toBe("pending");
  await decide(submitted.body.approvalRequestId);
  return (await accountant.call("get", `/finance/payments/${paymentId}`, { companyId: retail })).body;
}
// Lỗi từng ô trả về theo câu thông báo tiếng Việt.
const fieldsOf = (fields: Record<string, keyof Messages["errors"]>) => Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, messages.vi.errors[value]]));
const trim = (value: string) => (value.includes(".") ? value.replace(/\.?0+$/, "") : value);
async function entries(sourceId: string) {
  const rows = await pool.query<{ code: string; debit: string; credit: string }>(
    `SELECT a.code, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_id = $1 ORDER BY l.line_no`,
    [sourceId],
  );
  return rows.rows.map((row) => [row.code, trim(row.debit), trim(row.credit)]);
}
async function debt(id: string) {
  return (
    await pool.query<{ open_amount: string; open_foreign_amount: string; book_rate: string }>(
      "SELECT open_amount::text, open_foreign_amount::text, book_rate::text FROM finance.debt_items WHERE id = $1",
      [id],
    )
  ).rows[0]!;
}
const fund = async (id: string) => (await accountant.call("get", `/finance/funds/${id}`, { companyId: retail })).body;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  purchaser = await assign("muahang.ngoaite@vcomm.test", "Đặng Văn Mua", "purchaser");
  keeper = await assign("thukho.ngoaite@vcomm.test", "Kha Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  accountant = await assign("ketoan.ngoaite@vcomm.test", "Mai Thị Toán", "chief_accountant");

  pieceUnitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "NTNT", nameVi: "Hàng ngoại tệ", nameEn: "Foreign goods" } })).body.id;
  const product = await retailAdmin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Loa nhập khẩu", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: pieceUnitId, variants: [{ barcodes: [] }] },
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  variantId = product.body.variants[0].id;
  warehouseId = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BDNT", name: "Kho ngoại tệ BD", usesLocations: false } })
  ).body.id;
  const created = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Công ty Thương mại Mẫu Thâm Quyến", taxCode: "9990000056" } });
  supplierId = created.body.id;
  await retailAdmin.call("put", `/crm/partners/${supplierId}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: true, paymentTermDays: 30, creditLimit: null, version: 0 },
  });
  await pool.query(
    "INSERT INTO core.exchange_rates (rate_date, from_currency, to_currency, rate_type, rate, source) VALUES ($1, 'USD', 'VND', 'accounting', 25400, 'manual'), ($2, 'USD', 'VND', 'accounting', 26000, 'manual')",
    [yesterday, today],
  );
  for (const documentTypeCode of ["purchasing.order", "finance.payment"]) {
    const policy = await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode,
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
  }
  expect((await accountant.call("post", "/finance/ledger/setup", { companyId: retail })).status).toBe(201);
  firstDebtId = await importDebt("100", yesterday);
  secondDebtId = await importDebt("50", today);
  const vnd = await accountant.call("post", "/finance/funds", {
    companyId: retail,
    body: { code: "NH-VND", name: "Vietcombank VND", kind: "bank", bankName: "Vietcombank", accountNo: "0071000000056", openingBalance: "500000000" },
  });
  expect(vnd.status, JSON.stringify(vnd.body)).toBe(201);
  vndFundId = vnd.body.id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_380: quỹ ngoại tệ, phiếu mua ngoại tệ", () => {
  it("KICHBAN_KIEMTHU_547: quỹ USD đầu kỳ 1.000 USD tỷ giá 25.000; không đổi tiền tệ khi đã có chứng từ; mua 175 USD tỷ giá 25.500", async () => {
    // Thiếu tỷ giá đầu kỳ, số lẻ quá đơn vị của USD bị từ chối.
    const missing = await accountant.call("post", "/finance/funds", {
      companyId: retail,
      body: { code: "NH-USD", name: "Vietcombank USD", kind: "bank", bankName: "Vietcombank", accountNo: "0071370000056", currency: "USD", openingForeignBalance: "1000.005" },
    });
    expect(missing.body.error.fields).toEqual(fieldsOf({ openingForeignBalance: "invalidValue", openingExchangeRate: "required" }));
    const created = await accountant.call("post", "/finance/funds", {
      companyId: retail,
      body: {
        code: "NH-USD",
        name: "Vietcombank USD",
        kind: "bank",
        bankName: "Vietcombank",
        accountNo: "0071370000056",
        currency: "USD",
        openingForeignBalance: "1000",
        openingExchangeRate: "25000",
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    usdFundId = created.body.id;
    expect(created.body).toMatchObject({ openingBalance: "25000000", balance: "25000000", currency: "VND", foreign: { currency: "USD", openingBalance: "1000", balance: "1000", bookRate: "25000" } });

    // Phiếu mua ngoại tệ: quỹ chi phải là quỹ tiền Việt, quỹ nhận phải là quỹ ngoại tệ.
    const wrong = await accountant.call("post", "/finance/currency-purchases", {
      companyId: retail,
      body: { fundId: usdFundId, counterFundId: vndFundId, paymentDate: today, foreignAmount: "175", exchangeRate: "25500" },
    });
    expect(wrong.body.error.fields).toEqual(fieldsOf({ fundId: "fundCurrencyMismatch", counterFundId: "fundCurrencyMismatch" }));
    const purchase = await accountant.call("post", "/finance/currency-purchases", {
      companyId: retail,
      body: { fundId: vndFundId, counterFundId: usdFundId, paymentDate: today, foreignAmount: "175", exchangeRate: "25500", note: "Mua USD trả nhà cung cấp" },
    });
    expect(purchase.status, JSON.stringify(purchase.body)).toBe(201);
    expect(purchase.body).toMatchObject({
      kind: "currency_purchase",
      partner: null,
      amount: "4462500",
      foreign: { currency: "USD", amount: "175", exchangeRate: "25500", counterFund: { id: usdFundId } },
    });
    const posted = await submitAndApprove(purchase.body.id, purchase.body.version);
    expect(posted.status, JSON.stringify(posted)).toBe("posted");
    expect(posted.documentNo).toMatch(/^PC/);
    expect(await entries(purchase.body.id)).toEqual([
      ["112", "4462500", "0"],
      ["112", "0", "4462500"],
    ]);
    expect((await fund(vndFundId)).balance).toBe("495537500");
    expect(await fund(usdFundId)).toMatchObject({ balance: "29462500", hasPostings: true, foreign: { balance: "1175" } });

    // Sổ quỹ USD: nhận 175 USD, giá trị 4.462.500.
    const ledger = await accountant.call("get", `/finance/funds/${usdFundId}/ledger?from=${yesterday}&to=${today}`, { companyId: retail });
    expect(ledger.body.foreign).toEqual({ currency: "USD", openingBalance: "1000", closingBalance: "1175" });
    expect(ledger.body.entries).toMatchObject([{ kind: "currency_purchase", receipt: "4462500", payment: "0", foreign: { receipt: "175", payment: "0", balance: "1175" } }]);

    // Quỹ đã có chứng từ: không đổi tiền tệ, số dư đầu.
    const usd = await fund(usdFundId);
    const changed = await accountant.call("patch", `/finance/funds/${usdFundId}`, {
      companyId: retail,
      body: { code: "NH-USD", name: "Vietcombank USD", kind: "bank", bankName: "Vietcombank", accountNo: "0071370000056", currency: null, version: usd.version },
    });
    expect(changed.body.error.fields).toEqual(fieldsOf({ currency: "fundHasPostings" }));
  });
});

describe("TIEUCHI_NGHIEMTHU_381: trả nợ ngoại tệ từ quỹ ngoại tệ", () => {
  it("KICHBAN_KIEMTHU_548: chi một phần theo bình quân, lãi tỷ giá; chi hết số dư quỹ, trả hết một khoản nợ", async () => {
    expect(await debt(firstDebtId)).toEqual({ open_amount: "21590000.0000", open_foreign_amount: "850.0000", book_rate: "25400.00000000" });
    // Trả 500 USD khoản nợ thứ nhất: giảm nợ 500 × 25.400 = 12.700.000; giá trị ra 29.462.500 × 500 / 1.175 = 12.537.234; lãi 162.766.
    const body = { kind: "supplier_payment", partnerId: supplierId, fundId: usdFundId, paymentDate: today, currency: "USD", lines: [{ debitItemId: firstDebtId, foreignAmount: "500" }] };
    const preview = await accountant.call("post", "/finance/payments/fx-preview", { companyId: retail, body });
    expect(preview.body).toMatchObject({ foreignTotal: "500", bookTotal: "12700000", fundValue: "12537234", exchangeDifference: "162766" });
    const created = await accountant.call("post", "/finance/payments", { companyId: retail, body });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ amount: "12537234", foreign: { currency: "USD", amount: "500", exchangeRate: null } });
    const posted = await submitAndApprove(created.body.id, created.body.version);
    expect(posted).toMatchObject({ status: "posted", amount: "12537234", foreign: { exchangeDifference: "162766" } });
    expect(posted.lines[0]).toMatchObject({ allocated: "12700000", allocatedForeign: "500" });
    expect(await entries(created.body.id)).toEqual([
      ["331", "12700000", "0"],
      ["112", "0", "12537234"],
      ["515", "0", "162766"],
    ]);
    expect(await debt(firstDebtId)).toMatchObject({ open_amount: "8890000.0000", open_foreign_amount: "350.0000" });
    expect(await fund(usdFundId)).toMatchObject({ balance: "16925266", foreign: { balance: "675" } });

    // Chi hết 675 USD: khoản thứ nhất trả hết 350 USD (giảm đúng 8.890.000), khoản thứ hai 325 USD × 26.000 = 8.450.000; giá trị ra là toàn bộ 16.925.266.
    const all = await accountant.call("post", "/finance/payments", {
      companyId: retail,
      body: {
        ...body,
        lines: [
          { debitItemId: firstDebtId, foreignAmount: "350" },
          { debitItemId: secondDebtId, foreignAmount: "325" },
        ],
      },
    });
    expect(all.status, JSON.stringify(all.body)).toBe(201);
    const allPosted = await submitAndApprove(all.body.id, all.body.version);
    expect(allPosted).toMatchObject({ status: "posted", amount: "16925266", foreign: { exchangeDifference: "414734" } });
    expect(await entries(all.body.id)).toEqual([
      ["331", "17340000", "0"],
      ["112", "0", "16925266"],
      ["515", "0", "414734"],
    ]);
    expect(await debt(firstDebtId)).toMatchObject({ open_amount: "0.0000", open_foreign_amount: "0.0000" });
    expect(await debt(secondDebtId)).toMatchObject({ open_amount: "2600000.0000", open_foreign_amount: "100.0000" });
    expect(await fund(usdFundId)).toMatchObject({ balance: "0", foreign: { balance: "0", bookRate: null } });
  });
});

describe("TIEUCHI_NGHIEMTHU_382: trả nợ ngoại tệ từ quỹ tiền Việt, các trường hợp từ chối", () => {
  it("KICHBAN_KIEMTHU_549: quỹ tiền Việt tỷ giá 26.350, lỗ tỷ giá; vượt số còn nợ, vượt số dư ngoại tệ, khác tiền tệ quỹ bị từ chối", async () => {
    const base = { kind: "supplier_payment", partnerId: supplierId, paymentDate: today, currency: "USD" };
    // Vượt số ngoại tệ còn nợ; quỹ tiền Việt thiếu tỷ giá.
    const exceeded = await accountant.call("post", "/finance/payments", { companyId: retail, body: { ...base, fundId: vndFundId, lines: [{ debitItemId: secondDebtId, foreignAmount: "100.01" }] } });
    expect(exceeded.body.error.fields).toEqual(fieldsOf({ "lines.0.foreignAmount": "debtAllocationExceeded", exchangeRate: "required" }));
    // Khoản đã trả hết không chọn được nữa.
    const closed = await accountant.call("post", "/finance/payments", { companyId: retail, body: { ...base, fundId: usdFundId, lines: [{ debitItemId: firstDebtId, foreignAmount: "1" }] } });
    expect(closed.body.error.fields).toEqual(fieldsOf({ "lines.0.foreignAmount": "debtAllocationExceeded" }));
    // Quỹ khác tiền tệ của phiếu.
    const cny = await accountant.call("post", "/finance/funds", {
      companyId: retail,
      body: { code: "TM-CNY", name: "Tiền mặt CNY", kind: "cash", currency: "CNY", openingForeignBalance: "1000", openingExchangeRate: "3500" },
    });
    expect(cny.status, JSON.stringify(cny.body)).toBe(201);
    const mismatch = await accountant.call("post", "/finance/payments", { companyId: retail, body: { ...base, fundId: cny.body.id, lines: [{ debitItemId: secondDebtId, foreignAmount: "10" }] } });
    expect(mismatch.body.error.fields).toEqual(fieldsOf({ fundId: "fundCurrencyMismatch" }));

    // Quỹ USD đã hết tiền: vượt số dư ngoại tệ.
    const empty = await accountant.call("post", "/finance/payments", { companyId: retail, body: { ...base, fundId: usdFundId, lines: [{ debitItemId: secondDebtId, foreignAmount: "10" }] } });
    expect(empty.body.error.fields).toEqual(fieldsOf({ fundId: "insufficientFundBalance" }));

    // Trả hết 100 USD còn lại từ quỹ tiền Việt, tỷ giá bán 26.350: chi 2.635.000, giảm nợ 2.600.000, lỗ 35.000.
    const paid = await accountant.call("post", "/finance/payments", {
      companyId: retail,
      body: { ...base, fundId: vndFundId, exchangeRate: "26350", lines: [{ debitItemId: secondDebtId, foreignAmount: "100" }] },
    });
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    expect(paid.body).toMatchObject({ amount: "2635000", foreign: { amount: "100", exchangeRate: "26350" } });
    const posted = await submitAndApprove(paid.body.id, paid.body.version);
    expect(posted).toMatchObject({ status: "posted", amount: "2635000", foreign: { exchangeDifference: "-35000" } });
    expect(await entries(paid.body.id)).toEqual([
      ["331", "2600000", "0"],
      ["635", "35000", "0"],
      ["112", "0", "2635000"],
    ]);
    expect(await debt(secondDebtId)).toMatchObject({ open_amount: "0.0000", open_foreign_amount: "0.0000" });
    expect((await fund(vndFundId)).balance).toBe("492902500");
  });

  it("KICHBAN_KIEMTHU_550: khoản nợ ngoại tệ không trừ bằng phiếu chi tiền Việt, không trừ tự động vào trả trước tiền Việt; phiếu tiền Việt giữ nguyên hành vi", async () => {
    const thirdDebtId = await importDebt("10", today);
    const vnd = await accountant.call("post", "/finance/payments", {
      companyId: retail,
      body: { kind: "supplier_payment", partnerId: supplierId, fundId: vndFundId, paymentDate: today, amount: "1000000", lines: [{ debitItemId: thirdDebtId, amount: "1000000" }] },
    });
    expect(vnd.body.error.fields).toEqual(fieldsOf({ "lines.0.debitItemId": "foreignDebtRequiresForeignPayment" }));
    // Quỹ ngoại tệ không dùng cho phiếu chi tiền Việt.
    const foreignFund = await accountant.call("post", "/finance/payments", {
      companyId: retail,
      body: { kind: "supplier_payment", partnerId: supplierId, fundId: usdFundId, paymentDate: today, amount: "1000000" },
    });
    expect(foreignFund.body.error.fields).toEqual(fieldsOf({ fundId: "fundCurrencyMismatch" }));
    // Trả trước tiền Việt không chọn chứng từ: không trừ khoản nợ ngoại tệ, còn là tiền trả trước.
    const advance = await accountant.call("post", "/finance/payments", {
      companyId: retail,
      body: { kind: "supplier_payment", partnerId: supplierId, fundId: vndFundId, paymentDate: today, amount: "1000000" },
    });
    expect(advance.status, JSON.stringify(advance.body)).toBe(201);
    const posted = await submitAndApprove(advance.body.id, advance.body.version);
    expect(posted).toMatchObject({ status: "posted", unallocated: "1000000", foreign: null });
    expect(await entries(advance.body.id)).toEqual([
      ["331", "1000000", "0"],
      ["112", "0", "1000000"],
    ]);
    expect(await debt(thirdDebtId)).toMatchObject({ open_amount: "2210000.0000", open_foreign_amount: "85.0000" });
    const open = await accountant.call("get", `/finance/debts/open?side=payable&partnerId=${supplierId}`, { companyId: retail });
    expect(open.body.advance).toBe("1000000");
    expect(open.body.items.find((item: { id: string }) => item.id === thirdDebtId)).toMatchObject({ foreign: { currency: "USD", amount: "85", openAmount: "85", bookRate: "26000" } });
  });
});
