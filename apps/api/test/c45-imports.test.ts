// CONG_VIEC_45: Nhập khẩu và phân bổ chi phí mua hàng (TIEUCHI_NGHIEMTHU_282 đến 286; KICHBAN_KIEMTHU_428 đến 433).
// Tai nghe nhập khẩu: 8,5 USD một cái; tỷ giá hạch toán hôm nay 25.000 VND một USD.
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
let retailAdmin: Session;
let purchaser: Session;
let keeper: Session;
let accountant: Session;
let approver: Session;
let today: string;
let yesterday: string;
let warehouseId: string;
let foreignSupplierId: string;
let localSupplierId: string;
let headphoneVariantId: string;
let pieceUnitId: string;
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
async function partner(name: string, taxCode: string) {
  const created = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const saved = await retailAdmin.call("put", `/crm/partners/${created.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: true, paymentTermDays: 30, creditLimit: null, version: 0 },
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return created.body.id as string;
}
async function decide(requestId: string) {
  await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "Kiểm thử" } });
  await application.get(OutboxService).dispatchPending();
}
const orderBody = (extra: Record<string, unknown> = {}) => ({
  supplierId: foreignSupplierId,
  warehouseId,
  orderDate: today,
  isImport: true,
  currency: "USD",
  lines: [{ variantId: headphoneVariantId, unitId: pieceUnitId, quantity: "100", unitPrice: "8.5", vatRate: "10" }],
  ...extra,
});
async function receive(orderId: string, orderLineId: string, quantity: string, documentDate = today) {
  const created = await keeper.call("post", "/inventory/purchase-receipts", { companyId: retail, body: { orderId, documentDate, lines: [{ orderLineId, quantity }] } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return { draft: created.body, submitted: await keeper.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail }) };
}
const trim = (value: string) => (value.includes(".") ? value.replace(/\.?0+$/, "") : value);
// Dòng bút toán của một chứng từ: [số hiệu tài khoản, Nợ, Có].
async function entries(sourceId: string) {
  const rows = await pool.query<{ code: string; debit: string; credit: string }>(
    `SELECT a.code, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.accounts a ON a.id = l.account_id WHERE j.source_id = $1 ORDER BY l.line_no`,
    [sourceId],
  );
  return rows.rows.map((row) => [row.code, trim(row.debit), trim(row.credit)]);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  yesterday = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  purchaser = await assign("nhapkhau.vcr@vcomm.test", "Đặng Văn Nhập", "purchaser");
  keeper = await assign("thukho.nhapkhau@vcomm.test", "Kha Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);
  accountant = await assign("ketoan.nhapkhau@vcomm.test", "Mai Thị Toán", "chief_accountant");

  pieceUnitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "NKTN", nameVi: "Tai nghe nhập khẩu", nameEn: "Imported headphones" } })).body.id;
  const product = await retailAdmin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Tai nghe không dây", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: pieceUnitId, variants: [{ barcodes: [] }] },
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  headphoneVariantId = product.body.variants[0].id;
  warehouseId = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BDNK", name: "Kho nhập khẩu BD", usesLocations: false } })
  ).body.id;
  foreignSupplierId = await partner("Công ty Thương mại Mẫu Thâm Quyến", "9990000001");
  localSupplierId = await partner("Công ty TNHH Phụ kiện Trong nước", "0310000045");

  // Tỷ giá hạch toán hôm nay; hôm qua chưa có tỷ giá.
  await pool.query("INSERT INTO core.exchange_rates (rate_date, from_currency, to_currency, rate_type, rate, source) VALUES ($1, 'USD', 'VND', 'accounting', 25000, 'manual')", [today]);
  // Đơn mua đi luồng duyệt cấp 1 từ 0 đồng.
  const policy = await retailAdmin.call("post", "/approval-policies", {
    companyId: retail,
    body: {
      documentTypeCode: "purchasing.order",
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
    },
  });
  expect(policy.status, JSON.stringify(policy.body)).toBe(201);
  expect((await accountant.call("post", "/finance/ledger/setup", { companyId: retail })).status).toBe(201);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_282: đơn mua nhập khẩu bằng ngoại tệ", () => {
  it("KICHBAN_KIEMTHU_428: đơn USD đi duyệt quy đổi; nhập kho theo tỷ giá ngày phiếu; thiếu tỷ giá không gửi được; công nợ, bút toán kèm ngoại tệ; trả hàng; đơn trong nước giữ nguyên", async () => {
    // Đơn nhập khẩu: thuế suất dòng về "Không kê khai", tổng theo USD, quy đổi theo tỷ giá hôm nay.
    const created = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: orderBody() });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ isImport: true, currency: "USD", companyCurrency: "VND", totalAmount: "850", taxAmount: "0", convertedTotal: "21250000", currencyLocked: false });
    expect(created.body.lines[0].vatRate).toBe("not_declared");
    // Tiền tệ không tồn tại bị từ chối.
    const unknown = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: orderBody({ currency: "XYZ" }) });
    expect(Object.keys(unknown.body.error.fields)).toEqual(["currency"]);

    const submitted = await purchaser.call("post", `/purchasing/orders/${created.body.id}/submit`, { companyId: retail });
    expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("pending");
    const request = (await pool.query("SELECT currency, exchange_rate::text, amount_in_policy_currency::text FROM core.approval_requests WHERE id = $1", [submitted.body.approvalRequestId])).rows[0];
    expect(request).toEqual({ currency: "USD", exchange_rate: "25000.00000000", amount_in_policy_currency: "21250000.0000" });
    await decide(submitted.body.approvalRequestId);
    const order = (await purchaser.call("get", `/purchasing/orders/${created.body.id}`, { companyId: retail })).body;
    expect(order.status).toBe("approved");
    const orderLineId = order.lines[0].id as string;

    // Ngày phiếu chưa có tỷ giá: không gửi được.
    const missing = await receive(order.id, orderLineId, "60", yesterday);
    expect(missing.submitted.status).toBe(409);
    expect(JSON.stringify(missing.submitted.body)).toContain("Chưa có tỷ giá hạch toán ngày lập chứng từ.");
    await keeper.call("delete", `/inventory/documents/${missing.draft.id}`, { companyId: retail });

    // Nhập 60 cái: 8,5 USD × 25.000 = 212.500 đồng một cái.
    const { submitted: posted } = await receive(order.id, orderLineId, "60");
    expect(posted.body, JSON.stringify(posted.body)).toMatchObject({ status: "posted", currency: "USD", exchangeRate: "25000" });
    const receipt = (await retailAdmin.call("get", `/inventory/documents/${posted.body.id}`, { companyId: retail })).body;
    expect(receipt).toMatchObject({ foreignAmount: "510" });
    expect(receipt.lines[0].costValue).toBe("12750000");
    const stock = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Tai nghe không dây`, { companyId: retail })).body.data[0];
    expect(stock).toMatchObject({ onHand: "60", averageCost: "212500", value: "12750000" });

    // Công nợ theo tiền tệ công ty, kèm 510 USD và tỷ giá; bút toán Nợ 156 / Có 331, không có thuế đầu vào.
    const debts = (await accountant.call("get", `/finance/debts/partners/${foreignSupplierId}?side=payable`, { companyId: retail })).body;
    expect(debts.items[0]).toMatchObject({ sourceType: "purchase_receipt", amount: "12750000", foreign: { currency: "USD", amount: "510", exchangeRate: "25000" } });
    expect(await entries(posted.body.id)).toEqual([
      ["156", "12750000", "0"],
      ["331", "0", "12750000"],
    ]);

    // Đã có phiếu nhập: không đổi tiền tệ, không bỏ đánh dấu nhập khẩu.
    const locked = (await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body;
    expect(locked.currencyLocked).toBe(true);
    const changed = await purchaser.call("patch", `/purchasing/orders/${order.id}`, {
      companyId: retail,
      body: {
        ...orderBody({ currency: "EUR", lines: [{ id: orderLineId, variantId: headphoneVariantId, unitId: pieceUnitId, quantity: "100", unitPrice: "8.5", vatRate: "not_declared" }] }),
        version: locked.version,
      },
    });
    expect(Object.keys(changed.body.error.fields)).toEqual(["currency"]);

    // Trả 10 cái theo tỷ giá phiếu nhập gốc: giảm nợ 2.125.000 đồng, kèm 85 USD.
    const returned = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: posted.body.id, documentDate: today, reason: "Hàng lỗi", lines: [{ receiptLineId: receipt.lines[0].id, quantity: "10" }] },
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    const returnPosted = await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail });
    expect(returnPosted.body).toMatchObject({ status: "posted", currency: "USD", exchangeRate: "25000" });
    const afterReturn = (await accountant.call("get", `/finance/debts/partners/${foreignSupplierId}?side=payable`, { companyId: retail })).body;
    expect(afterReturn.items.find((item: { sourceType: string }) => item.sourceType === "purchase_return")).toMatchObject({
      amount: "2125000",
      foreign: { currency: "USD", amount: "85", exchangeRate: "25000" },
    });
    expect(afterReturn.balance).toBe("10625000");
    expect(await entries(returnPosted.body.id)).toEqual([
      ["331", "2125000", "0"],
      ["156", "0", "2125000"],
    ]);

    // Đơn trong nước: gửi kèm tiền tệ khác vẫn theo tiền tệ công ty, giữ thuế suất dòng.
    const domestic = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody({ supplierId: localSupplierId, isImport: false, lines: [{ variantId: headphoneVariantId, unitId: pieceUnitId, quantity: "2", unitPrice: "200000", vatRate: "10" }] }),
    });
    expect(domestic.status, JSON.stringify(domestic.body)).toBe(201);
    expect(domestic.body).toMatchObject({ isImport: false, currency: "VND", convertedTotal: null, taxAmount: "40000" });
    expect(domestic.body.lines[0].vatRate).toBe("10");
  });
});
