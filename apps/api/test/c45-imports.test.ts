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
// Đơn USD của KICHBAN_KIEMTHU_428 (đã nhận 60, trả 10): dùng tiếp cho tờ khai.
let importOrderId: string;
let importOrderLineId: string;
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
    importOrderId = order.id;
    importOrderLineId = orderLineId;

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

const declarationBody = (extra: Record<string, unknown> = {}, line: Record<string, unknown> = {}) => ({
  orderId: importOrderId,
  declarationNo: "107012345670",
  registeredOn: today,
  postingDate: today,
  customsRate: "25400",
  lines: [{ orderLineId: importOrderLineId, quantity: "50", customsValue: "425", importDutyRate: "10", vatRate: "10", ...line }],
  ...extra,
});
let declarationId: string;

describe("TIEUCHI_NGHIEMTHU_283: tờ khai, thuế gợi ý", () => {
  it("KICHBAN_KIEMTHU_429: thuế gợi ý theo công thức; sửa số thuế có đánh dấu; khai vượt số đặt, trùng số tờ khai bị từ chối; thủ kho không lập được", async () => {
    expect((await keeper.call("post", "/purchasing/import-declarations", { companyId: retail, body: declarationBody() })).status).toBe(403);
    const options = (await purchaser.call("get", "/purchasing/import-orders", { companyId: retail })).body;
    expect(options.find((option: { id: string }) => option.id === importOrderId).lines[0]).toMatchObject({ orderedBaseQuantity: "100", declaredBaseQuantity: "0", receivedBaseQuantity: "50" });

    // 425 USD × 25.400 = 10.795.000; thuế nhập khẩu 10% = 1.079.500; giá trị gia tăng 10% × (10.795.000 + 1.079.500) = 1.187.450.
    const created = await purchaser.call("post", "/purchasing/import-declarations", { companyId: retail, body: declarationBody() });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", currency: "USD", customsValue: "425", customsValueConverted: "10795000", canPost: true });
    expect(created.body.lines[0]).toMatchObject({
      baseQuantity: "50",
      importDuty: "1079500",
      suggestedImportDuty: "1079500",
      importDutyEdited: false,
      vatAmount: "1187450",
      suggestedVatAmount: "1187450",
      vatEdited: false,
    });
    declarationId = created.body.id;

    // Sửa thuế nhập khẩu cho khớp tờ khai: đánh dấu đã sửa, thuế giá trị gia tăng gợi ý tính lại trên số đã sửa.
    const edited = await purchaser.call("patch", `/purchasing/import-declarations/${declarationId}`, {
      companyId: retail,
      body: declarationBody({ version: created.body.version }, { importDuty: "1080000" }),
    });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect(edited.body.lines[0]).toMatchObject({ importDuty: "1080000", importDutyEdited: true, suggestedImportDuty: "1079500", vatAmount: "1187500", vatEdited: false });

    // Thuế suất 0: không có thuế.
    const zero = await purchaser.call("post", "/purchasing/import-declarations", {
      companyId: retail,
      body: declarationBody({ declarationNo: "107012345671" }, { quantity: "1", customsValue: "8.5", importDutyRate: "0", vatRate: "0" }),
    });
    expect(zero.body.lines[0]).toMatchObject({ customsValueConverted: "215900", importDuty: "0", vatAmount: "0" });
    expect((await purchaser.call("post", `/purchasing/import-declarations/${zero.body.id}/cancel`, { companyId: retail, body: { version: zero.body.version } })).body.status).toBe("cancelled");

    // Đã khai 50 trên tờ khai nháp: khai thêm 60 vượt số đặt 100; trùng số tờ khai chưa hủy.
    const over = await purchaser.call("post", "/purchasing/import-declarations", { companyId: retail, body: declarationBody({ declarationNo: "107012345672" }, { quantity: "60" }) });
    expect(over.body.error.fields).toEqual({ "lines.0.quantity": "Vượt số lượng đặt còn khai được của dòng đơn mua." });
    const duplicate = await purchaser.call("post", "/purchasing/import-declarations", { companyId: retail, body: declarationBody({}, { quantity: "1" }) });
    expect(duplicate.body.error.fields).toEqual({ declarationNo: "Số tờ khai đã có trong công ty." });
    // Đơn trong nước không lập tờ khai.
    expect((await purchaser.call("get", "/purchasing/import-orders", { companyId: retail })).body.every((option: { currency: string }) => option.currency === "USD")).toBe(true);
  });
});

describe("TIEUCHI_NGHIEMTHU_284: ghi sổ tờ khai, phân bổ thuế vào giá vốn", () => {
  it("KICHBAN_KIEMTHU_430: đã xuất một phần thì chia tồn và giá vốn hàng bán; chưa nhập đủ, kỳ đã khóa bị từ chối; đã ghi sổ không sửa được", async () => {
    // Xuất dùng nội bộ 10 cái: còn tồn 40 trên 50 khai.
    const issue = await retailAdmin.call("post", "/inventory/documents", {
      companyId: retail,
      body: {
        type: "issue_other",
        warehouseId,
        companyId: retail,
        documentDate: today,
        reasonCode: "internal_use",
        reason: "Kiểm thử",
        lines: [{ variantId: headphoneVariantId, unitId: pieceUnitId, quantity: "10" }],
      },
    });
    expect(issue.status, JSON.stringify(issue.body)).toBe(201);
    expect((await retailAdmin.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");

    const preview = (await accountant.call("get", `/purchasing/import-declarations/${declarationId}/allocation-preview`, { companyId: retail })).body;
    expect(preview.lines[0]).toMatchObject({ amount: "1080000", onHand: "40", baseQuantity: "50", stockValue: "864000", expensedValue: "216000" });

    const current = (await accountant.call("get", `/purchasing/import-declarations/${declarationId}`, { companyId: retail })).body;
    const posted = await accountant.call("post", `/purchasing/import-declarations/${declarationId}/post`, { companyId: retail, body: { version: current.version } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body).toMatchObject({ status: "posted", canEdit: false, canPost: false });
    expect(posted.body.lines[0]).toMatchObject({ stockValue: "864000", expensedValue: "216000" });

    // Giá trị tồn: 40 × 212.500 = 8.500.000 cộng 864.000.
    const stock = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Tai nghe không dây`, { companyId: retail })).body.data[0];
    expect(stock).toMatchObject({ onHand: "40", value: "9364000", averageCost: "234100" });
    expect(await entries(declarationId)).toEqual([
      ["156", "864000", "0"],
      ["632", "216000", "0"],
      ["3333", "0", "1080000"],
      ["1331", "1187500", "0"],
      ["33312", "0", "1187500"],
    ]);
    // Thẻ kho: dòng điều chỉnh giá trị số lượng 0.
    const movement = (
      await pool.query("SELECT m.quantity::text, m.value::text FROM inventory.movements m JOIN inventory.documents d ON d.id = m.document_id WHERE d.type = 'cost_adjustment' AND d.source_id = $1", [
        declarationId,
      ])
    ).rows;
    expect(movement).toEqual([{ quantity: "0.0000", value: "864000.0000" }]);

    // Đã ghi sổ: không sửa, không ghi sổ lại.
    const locked = await accountant.call("patch", `/purchasing/import-declarations/${declarationId}`, { companyId: retail, body: declarationBody({ version: posted.body.version }) });
    expect(locked.status).toBe(409);

    // Tờ khai thứ hai 30 cái: kỳ tháng 10 đã khóa thì từ chối; ngày hôm nay thì chưa nhập đủ (đã ghi sổ 50 trên nhận 50).
    const second = await accountant.call("post", "/purchasing/import-declarations", {
      companyId: retail,
      body: declarationBody({ declarationNo: "107012349999", postingDate: "2026-10-31" }, { quantity: "30" }),
    });
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    // Kế toán khởi tạo trong tháng hiện tại nên không khóa tháng 10 qua API được: đặt ngày khóa sổ trực tiếp.
    await pool.query("UPDATE accounting.settings SET locked_through = '2026-10-31' WHERE company_id = $1", [retail]);
    const lockedPeriod = await accountant.call("post", `/purchasing/import-declarations/${second.body.id}/post`, { companyId: retail, body: { version: second.body.version } });
    expect(lockedPeriod.status).toBe(409);
    expect(JSON.stringify(lockedPeriod.body)).toContain("Ngày chứng từ thuộc kỳ kế toán đã khóa sổ.");
    const moved = await accountant.call("patch", `/purchasing/import-declarations/${second.body.id}`, {
      companyId: retail,
      body: declarationBody({ declarationNo: "107012349999", version: second.body.version }, { quantity: "30" }),
    });
    const notReceived = await accountant.call("post", `/purchasing/import-declarations/${second.body.id}/post`, { companyId: retail, body: { version: moved.body.version } });
    expect(notReceived.body.error.fields).toEqual({ "lines.0.quantity": "Hàng của dòng chưa nhập kho đủ số lượng khai." });
  });
});

describe("TIEUCHI_NGHIEMTHU_284: hàng serial, công ty theo Thông tư 133", () => {
  it("KICHBAN_KIEMTHU_431: serial còn trong kho nhận phần thuế đều nhau, serial đã xuất vào giá vốn hàng bán; định khoản thuế nhập khẩu theo Thông tư 133", async () => {
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const category = (
      await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "NKDT", nameVi: "Điện thoại nhập khẩu", nameEn: "Imported phones", tracksSerials: true } })
    ).body.id;
    const product = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId: category, name: "Điện thoại nhập khẩu", vatRate: "10", tracksLots: false, tracksSerials: true, warrantyMonths: 12, baseUnitId: pieceUnitId, variants: [{ barcodes: [] }] },
    });
    expect(product.status, JSON.stringify(product.body)).toBe(201);
    const phoneVariantId = product.body.variants[0].id as string;
    const created = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody({ lines: [{ variantId: phoneVariantId, unitId: pieceUnitId, quantity: "3", unitPrice: "100", vatRate: "not_declared" }] }),
    });
    const submitted = await purchaser.call("post", `/purchasing/orders/${created.body.id}/submit`, { companyId: retail });
    await decide(submitted.body.approvalRequestId);
    const orderLineId = created.body.lines[0].id as string;
    const receipt = await keeper.call("post", "/inventory/purchase-receipts", {
      companyId: retail,
      body: { orderId: created.body.id, documentDate: today, lines: [{ orderLineId, quantity: "3", serials: ["NK-S1", "NK-S2", "NK-S3"] }] },
    });
    expect((await keeper.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    // Xuất một serial: 2 trên 3 serial còn trong kho.
    const issue = await retailAdmin.call("post", "/inventory/documents", {
      companyId: retail,
      body: {
        type: "issue_other",
        warehouseId,
        companyId: retail,
        documentDate: today,
        reasonCode: "internal_use",
        reason: "Kiểm thử",
        lines: [{ variantId: phoneVariantId, unitId: pieceUnitId, quantity: "1", serials: ["NK-S3"] }],
      },
    });
    expect(issue.status, JSON.stringify(issue.body)).toBe(201);
    expect((await retailAdmin.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");

    // 300 USD × 25.400 = 7.620.000; thuế nhập khẩu 10% = 762.000: 2/3 vào tồn (508.000, mỗi serial 254.000), 1/3 vào giá vốn hàng bán.
    const declaration = await accountant.call("post", "/purchasing/import-declarations", {
      companyId: retail,
      body: { ...declarationBody({ orderId: created.body.id, declarationNo: "107099990001" }), lines: [{ orderLineId, quantity: "3", customsValue: "300", importDutyRate: "10", vatRate: "10" }] },
    });
    expect(declaration.status, JSON.stringify(declaration.body)).toBe(201);
    const posted = await accountant.call("post", `/purchasing/import-declarations/${declaration.body.id}/post`, { companyId: retail, body: { version: declaration.body.version } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body.lines[0]).toMatchObject({ importDuty: "762000", stockValue: "508000", expensedValue: "254000" });
    const serials = (await pool.query("SELECT serial_no, status, unit_cost::text FROM inventory.serials WHERE serial_no LIKE 'NK-S%' ORDER BY serial_no")).rows;
    expect(serials).toEqual([
      { serial_no: "NK-S1", status: "in_stock", unit_cost: "2754000.0000" },
      { serial_no: "NK-S2", status: "in_stock", unit_cost: "2754000.0000" },
      { serial_no: "NK-S3", status: "issued", unit_cost: "2500000.0000" },
    ]);
    const stock = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Điện thoại nhập khẩu`, { companyId: retail })).body.data[0];
    expect(stock).toMatchObject({ onHand: "2", value: "5508000" });

    // Công ty theo Thông tư 133: thuế bảo vệ môi trường ghi 3338 (Thông tư 99: 33381); thuế nhập khẩu 3333, giá trị gia tăng hàng nhập khẩu 33312.
    const trading = testIds.tradingCompany;
    await pool.query("UPDATE core.companies SET accounting_regime = 'TT133' WHERE id = $1", [trading]);
    const userId = await createTestUser(pool, "ketoan.vct.nhapkhau@vcomm.test", "Kế Toán VCT", [{ companyId: trading }]);
    const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'chief_accountant' AND company_id IS NULL")).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [userId, roleId, trading]);
    const tradingAccountant = await signIn(application, "ketoan.vct.nhapkhau@vcomm.test");
    expect((await tradingAccountant.call("post", "/finance/ledger/setup", { companyId: trading })).status).toBe(201);
    const rules = async (companyId: string) =>
      Object.fromEntries(
        (
          await pool.query<{ role: string; code: string }>(
            "SELECT r.role, a.code FROM accounting.posting_rules r JOIN accounting.accounts a ON a.id = r.account_id WHERE r.company_id = $1 AND r.role IN ('import_duty', 'excise_tax', 'environmental_tax', 'import_vat')",
            [companyId],
          )
        ).rows.map((row) => [row.role, row.code]),
      );
    expect(await rules(trading)).toEqual({ import_duty: "3333", excise_tax: "3332", environmental_tax: "3338", import_vat: "33312" });
    expect(await rules(retail)).toEqual({ import_duty: "3333", excise_tax: "3332", environmental_tax: "33381", import_vat: "33312" });
  });
});

describe("TIEUCHI_NGHIEMTHU_286: phân quyền tờ khai", () => {
  it("KICHBAN_KIEMTHU_433: công ty khác không xem, không ghi sổ được; thủ kho không xem được tờ khai", async () => {
    const otherCompany = await signIn(application, "ketoan.vct.nhapkhau@vcomm.test");
    expect((await otherCompany.call("get", `/purchasing/import-declarations/${declarationId}`, { companyId: testIds.tradingCompany })).status).toBe(404);
    expect((await otherCompany.call("get", `/purchasing/import-declarations/${declarationId}`, { companyId: retail })).status).toBe(403);
    expect((await otherCompany.call("post", `/purchasing/import-declarations/${declarationId}/post`, { companyId: testIds.tradingCompany, body: { version: 1 } })).status).toBe(404);
    expect((await otherCompany.call("get", "/purchasing/import-declarations", { companyId: testIds.tradingCompany })).body.data).toEqual([]);
    expect((await keeper.call("get", "/purchasing/import-declarations", { companyId: retail })).status).toBe(403);
    expect((await keeper.call("get", `/purchasing/import-declarations/${declarationId}`, { companyId: retail })).status).toBe(403);
  });
});

describe("TIEUCHI_NGHIEMTHU_285: chứng từ chi phí nhập khẩu, phân bổ", () => {
  it("KICHBAN_KIEMTHU_432: hai tiêu thức chia ba dòng, tổng đúng bằng khoản; phần đã xuất vào giá vốn hàng bán; chi phí ngoại tệ quy đổi; công nợ, bút toán; tờ khai chưa ghi sổ không chọn được", async () => {
    const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
    const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "NKPK", nameVi: "Phụ kiện nhập khẩu", nameEn: "Imported accessories" } })).body.id;
    const product = async (name: string) => {
      const created = await retailAdmin.call("post", "/catalog/products", {
        companyId: retail,
        body: { categoryId: category, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: pieceUnitId, variants: [{ barcodes: [] }] },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      return created.body.variants[0].id as string;
    };
    const cableVariantId = await product("Cáp sạc nhập khẩu");
    const caseVariantId = await product("Ốp lưng nhập khẩu");
    const created = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody({
        lines: [
          { variantId: headphoneVariantId, unitId: pieceUnitId, quantity: "10", unitPrice: "10", vatRate: "not_declared" },
          { variantId: cableVariantId, unitId: pieceUnitId, quantity: "20", unitPrice: "3", vatRate: "not_declared" },
          { variantId: caseVariantId, unitId: pieceUnitId, quantity: "30", unitPrice: "1", vatRate: "not_declared" },
        ],
      }),
    });
    const submitted = await purchaser.call("post", `/purchasing/orders/${created.body.id}/submit`, { companyId: retail });
    await decide(submitted.body.approvalRequestId);
    const orderLines = created.body.lines as { id: string; quantity: string }[];
    const receipt = await keeper.call("post", "/inventory/purchase-receipts", {
      companyId: retail,
      body: { orderId: created.body.id, documentDate: today, lines: orderLines.map((line) => ({ orderLineId: line.id, quantity: line.quantity })) },
    });
    expect((await keeper.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    // Xuất 5 ốp lưng: còn 25 trên 30.
    const issue = await retailAdmin.call("post", "/inventory/documents", {
      companyId: retail,
      body: {
        type: "issue_other",
        warehouseId,
        companyId: retail,
        documentDate: today,
        reasonCode: "internal_use",
        reason: "Kiểm thử",
        lines: [{ variantId: caseVariantId, unitId: pieceUnitId, quantity: "5" }],
      },
    });
    expect((await retailAdmin.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    // Tờ khai: trị giá 100, 60, 30 USD × 25.400 = 2.540.000; 1.524.000; 762.000; không thuế.
    const declaration = await accountant.call("post", "/purchasing/import-declarations", {
      companyId: retail,
      body: {
        ...declarationBody({ orderId: created.body.id, declarationNo: "107055550001" }),
        lines: orderLines.map((line, index) => ({ orderLineId: line.id, quantity: line.quantity, customsValue: ["100", "60", "30"][index], importDutyRate: "0", vatRate: "0" })),
      },
    });
    expect(declaration.status, JSON.stringify(declaration.body)).toBe(201);
    const forwarderId = await partner("Công ty Giao nhận Mẫu", "0310000046");
    const costBody = (extra: Record<string, unknown> = {}) => ({
      declarationId: declaration.body.id,
      supplierId: forwarderId,
      invoiceNo: "00001234",
      documentDate: today,
      lines: [
        { kind: "international_freight", description: "Cước biển", amount: "1000000", vatRate: "not_declared", basis: "value" },
        { kind: "insurance", description: "Bảo hiểm hàng hóa", amount: "100000", vatRate: "10", basis: "value" },
        { kind: "domestic_freight", description: "Cảng về kho", amount: "100001", vatRate: "8", basis: "quantity" },
      ],
      ...extra,
    });
    // Tờ khai chưa ghi sổ: không lập chứng từ chi phí.
    const notPosted = await accountant.call("post", "/purchasing/landed-costs", { companyId: retail, body: costBody() });
    expect(notPosted.body.error.fields).toEqual({ declarationId: "Chọn tờ khai nhập khẩu đã ghi sổ." });
    expect((await accountant.call("post", `/purchasing/import-declarations/${declaration.body.id}/post`, { companyId: retail, body: { version: declaration.body.version } })).status).toBe(201);
    expect((await keeper.call("post", "/purchasing/landed-costs", { companyId: retail, body: costBody() })).status).toBe(403);

    const cost = await accountant.call("post", "/purchasing/landed-costs", { companyId: retail, body: costBody() });
    expect(cost.status, JSON.stringify(cost.body)).toBe(201);
    expect(cost.body).toMatchObject({ status: "draft", documentNo: null, currency: "VND", netAmount: "1200001", vatAmount: "18000", canPost: true });
    // Theo giá trị: 526.316 / 315.789 / 157.895 và 52.632 / 31.579 / 15.789; theo số lượng 10/20/30: 16.667 / 33.334 / 50.000 (phần lẻ vào dòng lớn nhất).
    const preview = (await accountant.call("get", `/purchasing/landed-costs/${cost.body.id}/allocation`, { companyId: retail })).body;
    expect(preview.lines.map((line: { byCostLine: string[]; amount: string }) => [line.byCostLine, line.amount])).toEqual([
      [["526316", "52632", "16667"], "595615"],
      [["315789", "31579", "33334"], "380702"],
      [["157895", "15789", "50000"], "223684"],
    ]);
    expect(preview.lines[2]).toMatchObject({ onHand: "25", stockValue: "186403", expensedValue: "37281" });

    const posted = await accountant.call("post", `/purchasing/landed-costs/${cost.body.id}/post`, { companyId: retail, body: { version: cost.body.version } });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body).toMatchObject({ status: "posted", documentNo: expect.stringMatching(/^CPNK/), canEdit: false });
    const stored = (await accountant.call("get", `/purchasing/landed-costs/${cost.body.id}/allocation`, { companyId: retail })).body;
    expect(stored.lines.map((line: { stockValue: string; expensedValue: string }) => [line.stockValue, line.expensedValue])).toEqual([
      ["595615", "0"],
      ["380702", "0"],
      ["186403", "37281"],
    ]);
    const stock = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Ốp lưng nhập khẩu`, { companyId: retail })).body.data[0];
    // 25 × 25.000 = 625.000 cộng 186.403.
    expect(stock).toMatchObject({ onHand: "25", value: "811403" });
    const debts = (await accountant.call("get", `/finance/debts/partners/${forwarderId}?side=payable`, { companyId: retail })).body;
    expect(debts.items[0]).toMatchObject({ sourceType: "landed_cost", amount: "1218001", documentNo: posted.body.documentNo, foreign: null });
    expect(await entries(cost.body.id)).toEqual([
      ["156", "1162720", "0"],
      ["632", "37281", "0"],
      ["1331", "18000", "0"],
      ["331", "0", "1218001"],
    ]);
    // Đã ghi sổ: không sửa.
    expect((await accountant.call("patch", `/purchasing/landed-costs/${cost.body.id}`, { companyId: retail, body: { ...costBody(), version: posted.body.version } })).status).toBe(409);

    // Chi phí bằng USD: 40 USD × 25.000 = 1.000.000; ngày chưa có tỷ giá bị từ chối; công nợ kèm 40 USD.
    const usdBody = costBody({ currency: "USD", invoiceNo: "INV-USD-1", lines: [{ kind: "other", amount: "40", vatRate: "not_declared", basis: "quantity" }] });
    const missingRate = await accountant.call("post", "/purchasing/landed-costs", { companyId: retail, body: { ...usdBody, documentDate: yesterday } });
    expect(missingRate.body.error.fields).toEqual({ currency: "Chưa có tỷ giá hạch toán ngày lập chứng từ." });
    const usd = await accountant.call("post", "/purchasing/landed-costs", { companyId: retail, body: usdBody });
    expect(usd.body).toMatchObject({ currency: "USD", exchangeRate: "25000", netAmount: "1000000" });
    expect(usd.body.lines[0]).toMatchObject({ amount: "40", amountConverted: "1000000" });
    const usdPosted = await accountant.call("post", `/purchasing/landed-costs/${usd.body.id}/post`, { companyId: retail, body: { version: usd.body.version } });
    expect(usdPosted.status, JSON.stringify(usdPosted.body)).toBe(201);
    const usdDebt = (await accountant.call("get", `/finance/debts/partners/${forwarderId}?side=payable`, { companyId: retail })).body.items.find(
      (item: { documentNo: string }) => item.documentNo === usdPosted.body.documentNo,
    );
    expect(usdDebt).toMatchObject({ amount: "1000000", foreign: { currency: "USD", amount: "40", exchangeRate: "25000" } });
  });
});
