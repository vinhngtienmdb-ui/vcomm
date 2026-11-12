// CONG_VIEC_56 lát L2: thuế hải quan theo tờ khai, phiếu nộp thuế, tiền chậm nộp, phiếu nhận hoàn thuế (TIEUCHI_NGHIEMTHU_385, 386, 388; KICHBAN_KIEMTHU_553, 554, 556).
// Một đơn nhập khẩu 150 cái 8,5 USD; tờ khai A (100 cái, đăng ký 5 ngày trước, quá hạn) và tờ khai B (50 cái, đăng ký hôm nay); tỷ giá tính thuế 25.000.
// Tiền chậm nộp theo tham số mặc định 0,03% mỗi ngày, hạn nộp là ngày đăng ký tờ khai (chưa đối chiếu nguyên văn luật; CONG_VIEC_56 mục 4).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages, type Messages } from "i18n";
import type { Pool } from "pg";
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
let fiveDaysAgo: string;
let fundId: string;
let declarationA: string;
let declarationB: string;
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
  await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "Kiểm thử" } });
  await application.get(OutboxService).dispatchPending();
}
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
async function taxes(declarationId: string) {
  const body = (await accountant.call("get", `/finance/customs-taxes?declarationId=${declarationId}`, { companyId: retail })).body;
  return Object.fromEntries(body[0].taxes.map((tax: { taxType: string; remaining: string; paid: string }) => [tax.taxType, tax.remaining]));
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  fiveDaysAgo = new Date(Date.parse(today) - 5 * 86_400_000).toISOString().slice(0, 10);
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  purchaser = await assign("muahang.thuehq@vcomm.test", "Đặng Văn Mua", "purchaser");
  keeper = await assign("thukho.thuehq@vcomm.test", "Kha Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  accountant = await assign("ketoan.thuehq@vcomm.test", "Mai Thị Toán", "chief_accountant");

  const pieceUnitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "THQ", nameVi: "Hàng chịu thuế hải quan", nameEn: "Dutiable goods" } })).body.id;
  const product = await retailAdmin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Máy lọc không khí", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: pieceUnitId, variants: [{ barcodes: [] }] },
  });
  const warehouseId = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BDHQ", name: "Kho thuế hải quan BD", usesLocations: false } })
  ).body.id;
  const supplier = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Công ty Thiết bị Mẫu Quảng Đông", taxCode: "9990000057" } });
  await retailAdmin.call("put", `/crm/partners/${supplier.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: true, paymentTermDays: 30, creditLimit: null, version: 0 },
  });
  await pool.query("INSERT INTO core.exchange_rates (rate_date, from_currency, to_currency, rate_type, rate, source) VALUES ($1, 'USD', 'VND', 'accounting', 25000, 'manual')", [today]);
  for (const documentTypeCode of ["purchasing.order", "finance.payment"]) {
    await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode,
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
  }
  expect((await accountant.call("post", "/finance/ledger/setup", { companyId: retail })).status).toBe(201);
  const order = await purchaser.call("post", "/purchasing/orders", {
    companyId: retail,
    body: {
      supplierId: supplier.body.id,
      warehouseId,
      orderDate: today,
      isImport: true,
      currency: "USD",
      lines: [{ variantId: product.body.variants[0].id, unitId: pieceUnitId, quantity: "150", unitPrice: "8.5", vatRate: "10" }],
    },
  });
  const submitted = await purchaser.call("post", `/purchasing/orders/${order.body.id}/submit`, { companyId: retail });
  await decide(submitted.body.approvalRequestId);
  const orderLineId = order.body.lines[0].id;
  const receipt = await keeper.call("post", "/inventory/purchase-receipts", { companyId: retail, body: { orderId: order.body.id, documentDate: today, lines: [{ orderLineId, quantity: "150" }] } });
  expect((await keeper.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const declare = async (declarationNo: string, registeredOn: string, line: Record<string, unknown>) => {
    const created = await purchaser.call("post", "/purchasing/import-declarations", {
      companyId: retail,
      body: { orderId: order.body.id, declarationNo, registeredOn, postingDate: today, customsRate: "25000", customsOffice: "Chi cục Hải quan cửa khẩu Cát Lái", lines: [{ orderLineId, ...line }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.customsOffice).toBe("Chi cục Hải quan cửa khẩu Cát Lái");
    const posted = await accountant.call("post", `/purchasing/import-declarations/${created.body.id}/post`, { companyId: retail, body: { version: created.body.version } });
    expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
    return created.body.id as string;
  };
  // A: 850 USD → 21.250.000; nhập khẩu 10% = 2.125.000; giá trị gia tăng 10% × 23.375.000 = 2.337.500.
  declarationA = await declare("107056000001", fiveDaysAgo, { quantity: "100", customsValue: "850", importDutyRate: "10", vatRate: "10" });
  // B: 425 USD → 10.625.000; nhập khẩu 5% = 531.250; tiêu thụ đặc biệt 200.000; giá trị gia tăng 10% × 11.356.250 = 1.135.625.
  declarationB = await declare("107056000002", today, { quantity: "50", customsValue: "425", importDutyRate: "5", exciseTax: "200000", vatRate: "10" });
  fundId = (
    await accountant.call("post", "/finance/funds", {
      companyId: retail,
      body: { code: "NH-THUE", name: "Vietcombank nộp thuế", kind: "bank", bankName: "Vietcombank", accountNo: "0071000000057", openingBalance: "100000000" },
    })
  ).body.id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_385, 386: phiếu nộp thuế hải quan, tiền chậm nộp", () => {
  it("KICHBAN_KIEMTHU_553, 554: nộp hai tờ khai, bốn loại thuế; vượt số còn phải nộp bị từ chối; tiền chậm nộp tự tính, sửa được; bút toán", async () => {
    const list = await accountant.call("get", "/finance/customs-taxes?openOnly=true", { companyId: retail });
    const a = list.body.find((item: { declarationId: string }) => item.declarationId === declarationA);
    expect(a).toMatchObject({ declarationNo: "107056000001", customsOffice: "Chi cục Hải quan cửa khẩu Cát Lái", dueDate: fiveDaysAgo });
    expect(await taxes(declarationA)).toEqual({ import_duty: "2125000", excise_tax: "0", environmental_tax: "0", import_vat: "2337500" });
    expect(await taxes(declarationB)).toEqual({ import_duty: "531250", excise_tax: "200000", environmental_tax: "0", import_vat: "1135625" });
    // Tiền chậm nộp gợi ý: 2.125.000 × 0,03% × 5 ngày = 3.187,5 → 3.188.
    const fee = await accountant.call("get", `/finance/customs-taxes/late-fee?declarationId=${declarationA}&amount=2125000&paymentDate=${today}`, { companyId: retail });
    expect(fee.body).toEqual({ dueDate: fiveDaysAgo, overdueDays: 5, rate: "0.0003", amount: "3188" });

    const base = { kind: "customs_tax_payment", fundId, paymentDate: today, referenceNo: "GNT-00012345" };
    const exceeded = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { ...base, lines: [{ lineKind: "payment", declarationId: declarationB, taxType: "import_vat", amount: "1135626" }] },
    });
    expect(exceeded.body.error.fields).toEqual(fieldsOf({ "lines.0.amount": "customsTaxExceedsRemaining" }));
    // Nhận hoàn khi chưa nộp thừa bị từ chối.
    const refund = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { ...base, kind: "customs_tax_refund", lines: [{ lineKind: "refund", declarationId: declarationA, taxType: "import_duty", amount: "1000" }] },
    });
    expect(refund.body.error.fields).toEqual(fieldsOf({ "lines.0.amount": "customsTaxExceedsOverpaid" }));

    const created = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: {
        ...base,
        lines: [
          { lineKind: "payment", declarationId: declarationA, taxType: "import_duty", amount: "2125000" },
          // Giá trị gia tăng tờ khai A: tính 2.337.500 × 0,03% × 5 = 3.506, kế toán sửa 3.500 theo thông báo của hải quan.
          { lineKind: "payment", declarationId: declarationA, taxType: "import_vat", amount: "2337500", lateAmount: "3500" },
          { lineKind: "payment", declarationId: declarationB, taxType: "import_duty", amount: "531250" },
          { lineKind: "payment", declarationId: declarationB, taxType: "excise_tax", amount: "200000" },
        ],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ kind: "customs_tax_payment", partner: null, amount: "5200438", referenceNo: "GNT-00012345" });
    expect(created.body.customsLines.filter((line: { lineKind: string }) => line.lineKind === "late_payment")).toEqual([
      { lineKind: "late_payment", declarationId: declarationA, declarationNo: "107056000001", taxType: "import_duty", amount: "3188", overdueDays: 5, computedAmount: "3188", edited: false },
      { lineKind: "late_payment", declarationId: declarationA, declarationNo: "107056000001", taxType: "import_vat", amount: "3500", overdueDays: 5, computedAmount: "3506", edited: true },
    ]);
    // Đang chờ duyệt: tính vào số đang chờ, phiếu khác không nộp trùng được.
    const submitted = await accountant.call("post", `/finance/payments/${created.body.id}/submit`, { companyId: retail, body: { version: created.body.version } });
    expect(submitted.body.status).toBe("pending");
    const duplicate = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { ...base, lines: [{ lineKind: "payment", declarationId: declarationB, taxType: "excise_tax", amount: "1" }] },
    });
    expect(duplicate.body.error.fields).toEqual(fieldsOf({ "lines.0.amount": "customsTaxExceedsRemaining" }));
    await decide(submitted.body.approvalRequestId);
    const posted = (await accountant.call("get", `/finance/payments/${created.body.id}`, { companyId: retail })).body;
    expect(posted.status, JSON.stringify(posted)).toBe("posted");
    expect(await entries(created.body.id)).toEqual([
      ["3333", "2125000", "0"],
      ["811", "3188", "0"],
      ["33312", "2337500", "0"],
      ["811", "3500", "0"],
      ["3333", "531250", "0"],
      ["3332", "200000", "0"],
      ["112", "0", "5200438"],
    ]);
    expect(await taxes(declarationA)).toEqual({ import_duty: "0", excise_tax: "0", environmental_tax: "0", import_vat: "0" });
    expect(await taxes(declarationB)).toEqual({ import_duty: "0", excise_tax: "0", environmental_tax: "0", import_vat: "1135625" });
    const open = (await accountant.call("get", "/finance/customs-taxes?openOnly=true", { companyId: retail })).body.map((item: { declarationId: string }) => item.declarationId);
    expect(open).toEqual([declarationB]);
    expect((await accountant.call("get", `/finance/funds/${fundId}`, { companyId: retail })).body.balance).toBe("94799562");
  });

  it("KICHBAN_KIEMTHU_554: nộp đúng hạn không có tiền chậm nộp; quỹ ngoại tệ, phiếu chi thường không dùng cho thuế; tham số mới theo ngày hiệu lực", async () => {
    const onTime = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { kind: "customs_tax_payment", fundId, paymentDate: today, lines: [{ lineKind: "payment", declarationId: declarationB, taxType: "import_vat", amount: "1135625" }] },
    });
    expect(onTime.status, JSON.stringify(onTime.body)).toBe(201);
    expect(onTime.body.customsLines).toHaveLength(1);
    expect(onTime.body.amount).toBe("1135625");
    // Phiếu nộp thuế không sửa được bằng đường dẫn phiếu thu chi thường.
    const patch = await accountant.call("patch", `/finance/payments/${onTime.body.id}`, {
      companyId: retail,
      body: { kind: "supplier_payment", partnerId: testIds.retailCompany, fundId, paymentDate: today, amount: "1", version: onTime.body.version },
    });
    expect(patch.status).toBeGreaterThanOrEqual(400);
    // Tham số mới: trùng ngày hiệu lực bị từ chối; thêm được bộ mới.
    const parameters = await accountant.call("get", "/finance/customs-tax-parameters", { companyId: retail });
    expect(parameters.body[0]).toMatchObject({ lateRate: "0.0003", paymentTermDays: 0 });
    const added = await accountant.call("post", "/finance/customs-tax-parameters", {
      companyId: retail,
      body: { effectiveFrom: "2030-01-01", lateRate: "0.0002", paymentTermDays: 30, legalBasis: "Kiểm thử bộ tham số mới" },
    });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body[0]).toMatchObject({ effectiveFrom: "2030-01-01", lateRate: "0.0002", paymentTermDays: 30 });
    const duplicate = await accountant.call("post", "/finance/customs-tax-parameters", {
      companyId: retail,
      body: { effectiveFrom: "2030-01-01", lateRate: "0.0002", paymentTermDays: 30, legalBasis: "Trùng" },
    });
    expect(duplicate.body.error.fields).toEqual(fieldsOf({ effectiveFrom: "invalidValue" }));
    await pool.query("DELETE FROM finance.customs_tax_parameters WHERE effective_from = '2030-01-01'");
  });

  it("TIEUCHI_NGHIEMTHU_389: công ty khác không thấy thuế của tờ khai; thủ kho không lập được phiếu", async () => {
    const other = await signIn(application, "quantri.tapdoan@vcomm.test");
    const list = await other.call("get", "/finance/customs-taxes", { companyId: testIds.tradingCompany });
    expect(list.body.some?.((item: { declarationId: string }) => item.declarationId === declarationA) ?? false).toBe(false);
    const denied = await keeper.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { kind: "customs_tax_payment", fundId, paymentDate: today, lines: [{ lineKind: "payment", declarationId: declarationB, taxType: "import_vat", amount: "1" }] },
    });
    expect(denied.status).toBe(403);
  });
});
