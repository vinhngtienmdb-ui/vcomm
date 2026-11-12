// CONG_VIEC_56 lát L3: tờ khai bổ sung, bù trừ, nhận hoàn thuế nộp thừa (TIEUCHI_NGHIEMTHU_387, 388, 389; KICHBAN_KIEMTHU_555, 556, 557).
// Đơn nhập khẩu: máy X 100 cái 8,5 USD (tờ khai A), máy Y 60 cái 10 USD (tờ khai B 50 cái đã ghi sổ, tờ khai C 10 cái để nháp); tỷ giá tính thuế 25.000; đăng ký hôm nay.
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages, type Messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { CostAdjustmentsService } from "../src/inventory/cost-adjustments.service";
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
let fundId: string;
let warehouseId: string;
let pieceUnitId: string;
let variantX: string;
let lineX: string;
let declarationA: string;
let declarationB: string;
let declarationC: string;
let declarationLineA: string;
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
  return Object.fromEntries(body[0].taxes.map((tax: { taxType: string; remaining: string }) => [tax.taxType, tax.remaining]));
}
async function stockOf(variantId: string) {
  const row = (await pool.query<{ quantity: string; value: string }>("SELECT quantity::text, value::text FROM inventory.costs WHERE warehouse_id = $1 AND variant_id = $2", [warehouseId, variantId]))
    .rows[0]!;
  return { quantity: trim(row.quantity), value: trim(row.value) };
}
// Lập, gửi, duyệt phiếu nộp, nhận hoàn thuế hải quan; trả về phiếu đã ghi sổ.
async function customsPayment(body: Record<string, unknown>) {
  const created = await accountant.call("post", "/finance/customs-tax-payments", { companyId: retail, body: { fundId, paymentDate: today, ...body } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await accountant.call("post", `/finance/payments/${created.body.id}/submit`, { companyId: retail, body: { version: created.body.version } });
  await decide(submitted.body.approvalRequestId);
  const posted = (await accountant.call("get", `/finance/payments/${created.body.id}`, { companyId: retail })).body;
  expect(posted.status, JSON.stringify(posted)).toBe("posted");
  return posted;
}
const amendmentBody = (amendmentNo: string, lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({
  declarationId: declarationA,
  amendmentNo,
  registeredOn: today,
  postingDate: today,
  reason: "Hải quan xác định lại mã số hàng hóa",
  lines,
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  purchaser = await assign("muahang.khaibs@vcomm.test", "Đặng Văn Mua", "purchaser");
  keeper = await assign("thukho.khaibs@vcomm.test", "Kha Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  accountant = await assign("ketoan.khaibs@vcomm.test", "Mai Thị Toán", "chief_accountant");

  pieceUnitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "KBS", nameVi: "Hàng khai bổ sung", nameEn: "Amended goods" } })).body.id;
  const product = async (name: string) =>
    (
      await retailAdmin.call("post", "/catalog/products", {
        companyId: retail,
        body: { categoryId: category, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: pieceUnitId, variants: [{ barcodes: [] }] },
      })
    ).body.variants[0].id as string;
  variantX = await product("Máy hút ẩm X");
  const variantY = await product("Máy sấy Y");
  warehouseId = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BDBS", name: "Kho khai bổ sung BD", usesLocations: false } })
  ).body.id;
  const supplier = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Công ty Điện máy Mẫu Thâm Quyến", taxCode: "9990000058" } });
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
      lines: [
        { variantId: variantX, unitId: pieceUnitId, quantity: "100", unitPrice: "8.5", vatRate: "10" },
        { variantId: variantY, unitId: pieceUnitId, quantity: "60", unitPrice: "10", vatRate: "10" },
      ],
    },
  });
  const submitted = await purchaser.call("post", `/purchasing/orders/${order.body.id}/submit`, { companyId: retail });
  await decide(submitted.body.approvalRequestId);
  lineX = order.body.lines[0].id;
  const lineY = order.body.lines[1].id;
  const receipt = await keeper.call("post", "/inventory/purchase-receipts", {
    companyId: retail,
    body: {
      orderId: order.body.id,
      documentDate: today,
      lines: [
        { orderLineId: lineX, quantity: "100" },
        { orderLineId: lineY, quantity: "60" },
      ],
    },
  });
  expect((await keeper.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const declare = async (declarationNo: string, line: Record<string, unknown>, post: boolean) => {
    const created = await purchaser.call("post", "/purchasing/import-declarations", {
      companyId: retail,
      body: { orderId: order.body.id, declarationNo, registeredOn: today, postingDate: today, customsRate: "25000", customsOffice: "Chi cục Hải quan cửa khẩu Cát Lái", lines: [line] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    if (post) {
      const posted = await accountant.call("post", `/purchasing/import-declarations/${created.body.id}/post`, { companyId: retail, body: { version: created.body.version } });
      expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
    }
    return created.body;
  };
  // A: 850 USD → 21.250.000; nhập khẩu 10% = 2.125.000; giá trị gia tăng 10% × 23.375.000 = 2.337.500.
  const a = await declare("107056100001", { orderLineId: lineX, quantity: "100", customsValue: "850", importDutyRate: "10", vatRate: "10" }, true);
  declarationA = a.id;
  declarationLineA = a.lines[0].id;
  // B: 500 USD → 12.500.000; nhập khẩu 5% = 625.000; giá trị gia tăng 10% × 13.125.000 = 1.312.500.
  declarationB = (await declare("107056100002", { orderLineId: lineY, quantity: "50", customsValue: "500", importDutyRate: "5", vatRate: "10" }, true)).id;
  declarationC = (await declare("107056100003", { orderLineId: lineY, quantity: "10", customsValue: "100", importDutyRate: "5", vatRate: "10" }, false)).id;
  fundId = (
    await accountant.call("post", "/finance/funds", {
      companyId: retail,
      body: { code: "NH-KBS", name: "Vietcombank thuế bổ sung", kind: "bank", bankName: "Vietcombank", accountNo: "0071000000058", openingBalance: "100000000" },
    })
  ).body.id;
  // Nộp đủ thuế tờ khai A.
  await customsPayment({
    kind: "customs_tax_payment",
    lines: [
      { lineKind: "payment", declarationId: declarationA, taxType: "import_duty", amount: "2125000" },
      { lineKind: "payment", declarationId: declarationA, taxType: "import_vat", amount: "2337500" },
    ],
  });
  // Xuất dùng nội bộ 40 máy X: còn tồn 60 trên 100 khai, giá trị tồn 60 × 233.750 = 14.025.000.
  const issue = await retailAdmin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "issue_other",
      warehouseId,
      companyId: retail,
      documentDate: today,
      reasonCode: "internal_use",
      reason: "Kiểm thử",
      lines: [{ variantId: variantX, unitId: pieceUnitId, quantity: "40" }],
    },
  });
  expect((await retailAdmin.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  expect(await stockOf(variantX)).toEqual({ quantity: "60", value: "14025000" });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_387: tờ khai bổ sung tăng, giảm thuế", () => {
  it("KICHBAN_KIEMTHU_555: bổ sung tăng khi đã xuất một phần: gợi ý theo thuế suất mới, chia tồn và giá vốn, điều chỉnh khấu trừ, số phải nộp đổi", async () => {
    const base = (await accountant.call("get", `/purchasing/import-amendments/current?declarationId=${declarationA}`, { companyId: retail })).body;
    expect(base).toMatchObject({ declarationNo: "107056100001", status: "posted", companyCurrency: "VND" });
    expect(base.lines[0]).toMatchObject({ declarationLineId: declarationLineA, importDutyRate: "10", vatRate: "10", before: { importDuty: "2125000", vatAmount: "2337500" } });
    const created = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS1", [{ declarationLineId: declarationLineA, importDutyRate: "15" }]),
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", declarationNo: "107056100001", canEdit: true });
    // Nhập khẩu 15% × 21.250.000 = 3.187.500; giá trị gia tăng 10% × 24.437.500 = 2.443.750.
    expect(created.body.lines[0]).toMatchObject({
      importDutyRate: "15",
      before: { importDuty: "2125000", exciseTax: "0", environmentalTax: "0", vatAmount: "2337500" },
      after: { importDuty: "3187500", exciseTax: "0", environmentalTax: "0", vatAmount: "2443750" },
      difference: { importDuty: "1062500", exciseTax: "0", environmentalTax: "0", vatAmount: "106250" },
      stockValue: null,
    });
    const preview = (await accountant.call("get", `/purchasing/import-amendments/${created.body.id}/allocation-preview`, { companyId: retail })).body;
    expect(preview.lines[0]).toMatchObject({ amount: "1062500", onHand: "60", baseQuantity: "100", stockValue: "637500", expensedValue: "425000" });
    // Nháp chưa đổi số phải nộp.
    expect(await taxes(declarationA)).toEqual({ import_duty: "0", excise_tax: "0", environmental_tax: "0", import_vat: "0" });

    const posted = await accountant.call("post", `/purchasing/import-amendments/${created.body.id}/post`, { companyId: retail, body: { version: created.body.version } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body).toMatchObject({ status: "posted", canEdit: false, totalDifference: { importDuty: "1062500", vatAmount: "106250" } });
    expect(posted.body.lines[0]).toMatchObject({ stockValue: "637500", expensedValue: "425000", difference: { importDuty: "1062500", vatAmount: "106250" } });
    expect(await entries(created.body.id)).toEqual([
      ["156", "637500", "0"],
      ["632", "425000", "0"],
      ["3333", "0", "1062500"],
      ["1331", "106250", "0"],
      ["33312", "0", "106250"],
    ]);
    expect(await stockOf(variantX)).toEqual({ quantity: "60", value: "14662500" });
    expect(await taxes(declarationA)).toEqual({ import_duty: "1062500", excise_tax: "0", environmental_tax: "0", import_vat: "106250" });
    // Đã ghi sổ không sửa được.
    const edit = await accountant.call("patch", `/purchasing/import-amendments/${created.body.id}`, {
      companyId: retail,
      body: amendmentBody("107056100001-BS1", [{ declarationLineId: declarationLineA, importDutyRate: "20" }], { version: posted.body.version }),
    });
    expect(edit.status).toBe(409);
    const list = (await accountant.call("get", `/purchasing/import-amendments?declarationId=${declarationA}`, { companyId: retail })).body;
    expect(list).toEqual([{ id: created.body.id, amendmentNo: "107056100001-BS1", registeredOn: today, status: "posted", totalDifference: "1168750" }]);
  });

  it("KICHBAN_KIEMTHU_555: bổ sung giảm: số trước gồm bổ sung đã ghi sổ; ghi giảm tồn, giá vốn, khấu trừ; phần giảm vượt giá trị tồn vào giá vốn", async () => {
    const created = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS2", [{ declarationLineId: declarationLineA, importDutyRate: "0" }]),
    });
    const current = (await accountant.call("get", `/purchasing/import-amendments/current?declarationId=${declarationA}`, { companyId: retail })).body;
    expect(current.lines[0]).toMatchObject({ importDutyRate: "15", before: { importDuty: "3187500", vatAmount: "2443750" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.lines[0]).toMatchObject({
      before: { importDuty: "3187500", vatAmount: "2443750" },
      after: { importDuty: "0", vatAmount: "2125000" },
      difference: { importDuty: "-3187500", vatAmount: "-318750" },
    });
    const posted = await accountant.call("post", `/purchasing/import-amendments/${created.body.id}/post`, { companyId: retail, body: { version: created.body.version } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body.lines[0]).toMatchObject({ stockValue: "-1912500", expensedValue: "-1275000" });
    expect(await entries(created.body.id)).toEqual([
      ["156", "0", "1912500"],
      ["632", "0", "1275000"],
      ["3333", "3187500", "0"],
      ["1331", "0", "318750"],
      ["33312", "318750", "0"],
    ]);
    expect(await stockOf(variantX)).toEqual({ quantity: "60", value: "12750000" });
    // Nộp thừa: nhập khẩu 2.125.000, giá trị gia tăng 212.500.
    expect(await taxes(declarationA)).toEqual({ import_duty: "-2125000", excise_tax: "0", environmental_tax: "0", import_vat: "-212500" });

    // Phần giảm của tồn không làm giá trị tồn âm: giảm 30.000.000 trên 100 cái khai, tồn 60 cái giá trị 12.750.000.
    const shares = await application
      .get(CostAdjustmentsService)
      .shares(application.get<Database>(DATABASE), retail, warehouseId, [{ orderLineId: lineX, variantId: variantX, baseQuantity: "100", amount: "-30000000" }]);
    expect(Number(shares[0]!.onHand)).toBe(60);
    expect(Number(shares[0]!.stockValue)).toBe(-12750000);
    expect(Number(shares[0]!.expensedValue)).toBe(-17250000);
  });

  it("KICHBAN_KIEMTHU_555: tờ khai gốc nháp, dòng không thuộc tờ khai, số trùng bị từ chối; nháp hủy được; kỳ khóa bị từ chối", async () => {
    const draft = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100003-BS1", [{ declarationLineId: declarationLineA, importDutyRate: "8" }], { declarationId: declarationC }),
    });
    expect(draft.body.error.fields).toEqual(fieldsOf({ declarationId: "declarationNotPosted" }));
    const foreignLine = (await accountant.call("get", `/purchasing/import-declarations/${declarationB}`, { companyId: retail })).body.lines[0].id;
    const wrongLine = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS3", [{ declarationLineId: foreignLine, importDutyRate: "8" }]),
    });
    expect(wrongLine.body.error.fields).toEqual(fieldsOf({ "lines.0.declarationLineId": "invalidValue" }));
    const duplicate = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS1", [{ declarationLineId: declarationLineA, importDutyRate: "8" }]),
    });
    expect(duplicate.body.error.fields).toEqual(fieldsOf({ amendmentNo: "declarationNoDuplicate" }));

    const cancelled = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS3", [{ declarationLineId: declarationLineA, exciseTax: "500000" }]),
    });
    expect(cancelled.body.lines[0]).toMatchObject({ after: { importDuty: "0", exciseTax: "500000", vatAmount: "2175000" } });
    const done = await accountant.call("post", `/purchasing/import-amendments/${cancelled.body.id}/cancel`, { companyId: retail, body: { version: cancelled.body.version } });
    expect(done.body.status).toBe("cancelled");

    const locked = await accountant.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS3", [{ declarationLineId: declarationLineA, exciseTax: "500000" }]),
    });
    expect(locked.status, JSON.stringify(locked.body)).toBe(201);
    const previous = (await pool.query<{ locked_through: string | null }>("SELECT locked_through::text FROM accounting.settings WHERE company_id = $1", [retail])).rows[0]!.locked_through;
    await pool.query("UPDATE accounting.settings SET locked_through = $2 WHERE company_id = $1", [retail, today]);
    const rejected = await accountant.call("post", `/purchasing/import-amendments/${locked.body.id}/post`, { companyId: retail, body: { version: locked.body.version } });
    await pool.query("UPDATE accounting.settings SET locked_through = $2 WHERE company_id = $1", [retail, previous]);
    expect(rejected.status).toBe(409);
    expect(JSON.stringify(rejected.body)).toContain("Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.");
    expect((await accountant.call("get", `/purchasing/import-amendments/${locked.body.id}`, { companyId: retail })).body.status).toBe("draft");
    await accountant.call("post", `/purchasing/import-amendments/${locked.body.id}/cancel`, { companyId: retail, body: { version: locked.body.version } });
  });
});

describe("TIEUCHI_NGHIEMTHU_388: nộp thừa sau tờ khai bổ sung giảm", () => {
  it("KICHBAN_KIEMTHU_556: bù trừ sang tờ khai khác trên phiếu nộp; nhận hoàn bằng phiếu thu; vượt số nộp thừa bị từ chối", async () => {
    const pay = [
      { lineKind: "payment", declarationId: declarationB, taxType: "import_duty", amount: "625000" },
      { lineKind: "payment", declarationId: declarationB, taxType: "import_vat", amount: "1312500" },
    ];
    const exceeded = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { kind: "customs_tax_payment", fundId, paymentDate: today, lines: [...pay, { lineKind: "offset", declarationId: declarationA, taxType: "import_duty", amount: "2125001" }] },
    });
    expect(exceeded.body.error.fields).toEqual(fieldsOf({ "lines.2.amount": "customsTaxExceedsOverpaid" }));
    const offset = await customsPayment({ kind: "customs_tax_payment", lines: [...pay, { lineKind: "offset", declarationId: declarationA, taxType: "import_duty", amount: "1600000" }] });
    expect(offset.amount).toBe("337500");
    expect(await entries(offset.id)).toEqual([
      ["3333", "625000", "0"],
      ["33312", "1312500", "0"],
      ["3333", "0", "1600000"],
      ["112", "0", "337500"],
    ]);
    expect(await taxes(declarationA)).toEqual({ import_duty: "-525000", excise_tax: "0", environmental_tax: "0", import_vat: "-212500" });
    expect(await taxes(declarationB)).toEqual({ import_duty: "0", excise_tax: "0", environmental_tax: "0", import_vat: "0" });

    const refundOver = await accountant.call("post", "/finance/customs-tax-payments", {
      companyId: retail,
      body: { kind: "customs_tax_refund", fundId, paymentDate: today, lines: [{ lineKind: "refund", declarationId: declarationA, taxType: "import_duty", amount: "525001" }] },
    });
    expect(refundOver.body.error.fields).toEqual(fieldsOf({ "lines.0.amount": "customsTaxExceedsOverpaid" }));
    const refund = await customsPayment({
      kind: "customs_tax_refund",
      referenceNo: "QĐ-HOAN-0058",
      lines: [
        { lineKind: "refund", declarationId: declarationA, taxType: "import_duty", amount: "525000" },
        { lineKind: "refund", declarationId: declarationA, taxType: "import_vat", amount: "212500" },
      ],
    });
    expect(refund.amount).toBe("737500");
    expect(await entries(refund.id)).toEqual([
      ["112", "737500", "0"],
      ["3333", "0", "525000"],
      ["33312", "0", "212500"],
    ]);
    expect(await taxes(declarationA)).toEqual({ import_duty: "0", excise_tax: "0", environmental_tax: "0", import_vat: "0" });
    // 100.000.000 − 4.462.500 − 337.500 + 737.500.
    expect((await accountant.call("get", `/finance/funds/${fundId}`, { companyId: retail })).body.balance).toBe("95937500");
  });
});

describe("TIEUCHI_NGHIEMTHU_389: phân quyền tờ khai bổ sung", () => {
  it("KICHBAN_KIEMTHU_557: thủ kho không lập được; công ty khác không xem được", async () => {
    const denied = await keeper.call("post", "/purchasing/import-amendments", {
      companyId: retail,
      body: amendmentBody("107056100001-BS9", [{ declarationLineId: declarationLineA, importDutyRate: "8" }]),
    });
    expect(denied.status).toBe(403);
    const id = (await accountant.call("get", `/purchasing/import-amendments?declarationId=${declarationA}`, { companyId: retail })).body[0].id;
    const other = await signIn(application, "quantri.tapdoan@vcomm.test");
    const hidden = await other.call("get", `/purchasing/import-amendments/${id}`, { companyId: testIds.tradingCompany });
    expect(hidden.status).toBe(404);
  });
});
