// CONG_VIEC_05 lát L1: phiếu nhập khác, xuất khác, điều chỉnh; ghi sổ, tồn, lô, serial, giá vốn, thẻ kho
// (TIEUCHI_NGHIEMTHU_65 đến 68, 74; KICHBAN_KIEMTHU_148 đến 152).
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
let retailAdmin: Session;
let keeper: Session;
let approver: Session;
let tradingManager: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, { variantId: string; productId: string }> = {};
let warehouseId: string;
let shelfWarehouseId: string;
let shelf: Record<string, string> = {};
let today: string;

type Line = Record<string, unknown>;
const document = (type: string, reasonCode: string, lines: Line[], extra: Record<string, unknown> = {}) => ({
  type,
  warehouseId,
  companyId: retail,
  documentDate: today,
  reasonCode,
  reason: "Kiểm thử",
  lines,
  ...extra,
});
const draft = (session: Session, body: unknown) => session.call("post", "/inventory/documents", { companyId: retail, body });
async function submitted(session: Session, body: unknown) {
  const created = await draft(session, body);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return session.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail });
}
const stock = async (variant: string, warehouse = warehouseId) =>
  (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouse}&onlyInStock=false&search=${variant}`, { companyId: retail })).body.data[0];

async function policy(documentTypeCode: string) {
  const response = await retailAdmin.call("post", "/approval-policies", {
    companyId: retail,
    body: {
      documentTypeCode,
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
    },
  });
  expect(response.status).toBe(201);
}
async function decide(requestId: string, decision: "approved" | "rejected") {
  await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Kiểm thử" } });
  await application.get(OutboxService).dispatchPending();
}

async function product(company: string, session: Session, code: string, name: string, categoryId: string, baseUnit: string, extra: Record<string, unknown> = {}) {
  const created = await session.call("post", "/catalog/products", {
    companyId: company,
    body: { categoryId, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units[baseUnit], variants: [{ barcodes: [] }], ...extra },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  items[code] = { variantId: created.body.variants[0].id, productId: created.body.id };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  const keeperRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'warehouse_keeper' AND company_id IS NULL")).rows[0]!.id;
  const keeperId = await createTestUser(pool, "thukho.l1@vcomm.test", "Võ Văn Thủ", [{ companyId: retail, branchId: testIds.binhDuongWarehouse }]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, 'branch', $3, $4, '2026-01-01')", [
    keeperId,
    keeperRole,
    retail,
    testIds.binhDuongWarehouse,
  ]);
  keeper = await signIn(application, "thukho.l1@vcomm.test");
  const managerRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'warehouse_manager' AND company_id IS NULL")).rows[0]!.id;
  const managerId = await createTestUser(pool, "quanly.l1.vct@vcomm.test", "Hồ Thị Chủ", [{ companyId: trading }]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [managerId, managerRole, trading]);
  tradingManager = await signIn(application, "quanly.l1.vct@vcomm.test");

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } })).body.id;
  const water = await category("NUOCK");
  const milk = await category("SUAK", { tracksLots: true });
  const phone = await category("DTK", { tracksSerials: true });
  await product(retail, retailAdmin, "water", "Nước suối kho", water, "CHAI", { units: [{ unitId: units.THUNG, factor: "24" }] });
  await product(retail, retailAdmin, "milk", "Sữa hộp kho", milk, "HOP", { tracksLots: true });
  await product(retail, retailAdmin, "phone", "Điện thoại kho", phone, "CAI", { tracksSerials: true, warrantyMonths: 12 });
  await product(trading, groupAdmin, "tradingWater", "Nước của VCT", water, "CHAI");

  const created = await retailAdmin.call("post", "/inventory/warehouses", {
    companyId: retail,
    body: { branchId: testIds.binhDuongWarehouse, code: "BD1", name: "Kho BD 1", usesLocations: false, ownerCompanyIds: [trading] },
  });
  warehouseId = created.body.id;
  const shelved = await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BD2", name: "Kho BD 2", usesLocations: true } });
  shelfWarehouseId = shelved.body.id;
  const locations = await retailAdmin.call("post", `/inventory/warehouses/${shelfWarehouseId}/locations`, { companyId: retail, body: { locations: [{ code: "A-01" }, { code: "A-02" }] } });
  shelf = Object.fromEntries(locations.body.map((location: { id: string; code: string }) => [location.code, location.id]));
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_66: nhập khác có duyệt, giá vốn bình quân, thẻ kho", () => {
  it("KICHBAN_KIEMTHU_148: tồn, giá vốn chỉ đổi sau khi duyệt; giá vốn bình quân qua hai lần nhập; xuất theo giá vốn; thẻ kho đúng tồn sau", async () => {
    await policy("inventory.receipt_other");
    const first = await submitted(keeper, document("receipt_other", "opening_balance", [{ variantId: items.water!.variantId, unitId: units.THUNG, quantity: "10", unitCost: "240000" }]));
    expect(first.body).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^NK-VCR-\d{4}-000001$/) });
    expect(first.body.lines[0]).toMatchObject({ quantity: "10", baseQuantity: "240" });
    expect((await stock("NUOCK"))?.onHand ?? "0").toBe("0");
    await decide(first.body.approvalRequestId, "approved");
    expect(await stock("NUOCK")).toMatchObject({ onHand: "240", averageCost: "10000", value: "2400000" });
    expect((await keeper.call("get", `/inventory/documents/${first.body.id}`, { companyId: retail })).body).toMatchObject({ status: "posted", totalValue: null });

    const second = await submitted(keeper, document("receipt_other", "other", [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "60", unitCost: "12000" }]));
    const rejected = await submitted(keeper, document("receipt_other", "other", [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "1000", unitCost: "1" }]));
    await decide(second.body.approvalRequestId, "approved");
    await decide(rejected.body.approvalRequestId, "rejected");
    expect((await retailAdmin.call("get", `/inventory/documents/${rejected.body.id}`, { companyId: retail })).body.status).toBe("rejected");
    expect(await stock("NUOCK")).toMatchObject({ onHand: "300", averageCost: "10400", value: "3120000" });

    // Xuất khác chưa có chính sách duyệt: ghi sổ ngay theo giá vốn bình quân.
    const issued = await submitted(keeper, document("issue_other", "internal_use", [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "100" }]));
    expect(issued.body.status).toBe("posted");
    expect((await retailAdmin.call("get", `/inventory/documents/${issued.body.id}`, { companyId: retail })).body.lines[0].costValue).toBe("1040000");
    expect(await stock("NUOCK")).toMatchObject({ onHand: "200", averageCost: "10400", value: "2080000", available: "200" });

    const card = await retailAdmin.call("get", `/inventory/stock-card?warehouseId=${warehouseId}&companyId=${retail}&variantId=${items.water!.variantId}&from=${today}&to=${today}`, {
      companyId: retail,
    });
    expect(card.body.opening).toEqual({ quantity: "0", value: "0" });
    expect(card.body.movements.map((movement: { quantity: string; balanceAfter: string }) => [movement.quantity, movement.balanceAfter])).toEqual([
      ["240", "240"],
      ["60", "300"],
      ["-100", "200"],
    ]);
    expect(card.body.closing).toEqual({ quantity: "200", value: "2080000" });
    // Thẻ kho chỉ thêm.
    await expect(pool.query("UPDATE inventory.movements SET quantity = 0")).rejects.toThrow();
  });
});

describe("TIEUCHI_NGHIEMTHU_67: không xuất quá tồn khả dụng, tồn không âm", () => {
  it("KICHBAN_KIEMTHU_149: xuất quá tồn bị từ chối; phiếu chờ duyệt giữ hàng; hai phiếu đồng thời xuất món hàng cuối chỉ một phiếu ghi sổ", async () => {
    const tooMany = await submitted(keeper, document("issue_other", "internal_use", [{ variantId: items.water!.variantId, unitId: units.THUNG, quantity: "9" }]));
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.fields).toEqual({ "lines.0.quantity": "Không đủ hàng trong kho." });

    await policy("inventory.issue_other");
    const held = await submitted(keeper, document("issue_other", "gift", [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "150" }]));
    expect(held.body.status).toBe("pending");
    expect(await stock("NUOCK")).toMatchObject({ onHand: "200", reserved: "150", available: "50" });
    const blocked = await submitted(keeper, document("issue_other", "gift", [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "60" }]));
    expect(blocked.body.error.fields).toEqual({ "lines.0.quantity": "Không đủ hàng khả dụng (một phần đang được giữ)." });
    // Rút phiếu thì nhả hàng giữ.
    expect((await keeper.call("post", `/inventory/documents/${held.body.id}/withdraw`, { companyId: retail })).body.status).toBe("withdrawn");
    expect(await stock("NUOCK")).toMatchObject({ reserved: "0", available: "200" });

    const drafts = await Promise.all([1, 2].map(() => draft(keeper, document("issue_other", "gift", [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "150" }]))));
    const results = await Promise.all(drafts.map((created) => keeper.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail })));
    // Phiếu thua luôn nhận lỗi gắn vào dòng hàng, dù bị chặn ở bước kiểm tra hay trong khóa giữ hàng (LOI_03).
    expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
    expect(results.find((result) => result.status === 400)!.body.error.fields).toEqual({ "lines.0.quantity": "Không đủ hàng khả dụng (một phần đang được giữ)." });
    expect(await stock("NUOCK")).toMatchObject({ onHand: "200", reserved: "150", available: "50" });
    const pending = results.find((result) => result.status === 201)!.body;
    await decide(pending.approvalRequestId, "approved");
    expect(await stock("NUOCK")).toMatchObject({ onHand: "50", reserved: "0" });
    const negative = await pool.query("SELECT count(*)::int AS total FROM inventory.balances WHERE quantity < 0");
    expect(negative.rows[0].total).toBe(0);
  });
});

describe("TIEUCHI_NGHIEMTHU_68: lô hết hạn trước, serial", () => {
  it("KICHBAN_KIEMTHU_150: gợi ý lô hết hạn trước; chọn lô khác phải có lý do; lô hết hạn chỉ xuất khi hủy hàng hết hạn; hạn dùng lô trùng sai", async () => {
    const milk = (lotNo: string, expiresOn: string, quantity = "10") => ({ variantId: items.milk!.variantId, unitId: units.HOP, quantity, unitCost: "8000", lotNo, expiresOn });
    expect((await draft(keeper, document("receipt_other", "other", [{ variantId: items.milk!.variantId, unitId: units.HOP, quantity: "1", unitCost: "1" }]))).body.error.fields).toEqual({
      "lines.0.lotNo": "Vui lòng nhập thông tin này.",
      "lines.0.expiresOn": "Vui lòng nhập thông tin này.",
    });
    await decide(
      (await submitted(keeper, document("receipt_other", "other", [milk("L-HET", "2020-01-01"), milk("L-SOM", "2098-01-01"), milk("L-MUON", "2099-01-01")]))).body.approvalRequestId,
      "approved",
    );
    expect((await submitted(keeper, document("receipt_other", "other", [milk("L-SOM", "2098-06-01")]))).body.error.fields).toEqual({ "lines.0.expiresOn": "Lô đã có với hạn dùng khác." });

    const suggestions = (await keeper.call("get", `/inventory/documents/lot-suggestions?warehouseId=${warehouseId}&companyId=${retail}&variantId=${items.milk!.variantId}`, { companyId: retail }))
      .body;
    expect(suggestions.map((lot: { lotNo: string; expired: boolean; suggested: boolean }) => [lot.lotNo, lot.expired, lot.suggested])).toEqual([
      ["L-HET", true, false],
      ["L-SOM", false, true],
      ["L-MUON", false, false],
    ]);
    const lot = (lotNo: string) => suggestions.find((item: { lotNo: string }) => item.lotNo === lotNo).lotId;
    const issueMilk = (lotId: string, extra: Record<string, unknown> = {}) => ({ variantId: items.milk!.variantId, unitId: units.HOP, quantity: "2", lotId, ...extra });
    expect((await submitted(keeper, document("issue_other", "internal_use", [issueMilk(lot("L-MUON"))]))).body.error.fields).toEqual({
      "lines.0.lotOverrideReason": "Chọn lô khác lô gợi ý phải ghi lý do.",
    });
    const expired = await submitted(keeper, document("issue_other", "internal_use", [issueMilk(lot("L-HET"), { lotOverrideReason: "Thử" })]));
    expect(expired.body.error.fields).toEqual({ "lines.0.lotId": "Lô đã hết hạn dùng." });
    // Lý do "Kiểm kê" trên phiếu điều chỉnh lập tay không được giảm lô hết hạn.
    const manualStocktake = await submitted(keeper, document("adjustment", "stocktake", [issueMilk(lot("L-HET"), { quantity: "-1", lotOverrideReason: "Thử" })]));
    expect(manualStocktake.body.error.fields).toEqual({ "lines.0.lotId": "Lô đã hết hạn dùng." });
    const disposal = await submitted(keeper, document("issue_other", "expired_disposal", [issueMilk(lot("L-HET"), { quantity: "10" })]));
    expect(disposal.body.status).toBe("pending");
    const chosen = await submitted(keeper, document("issue_other", "gift", [issueMilk(lot("L-MUON"), { lotOverrideReason: "Khách yêu cầu hạn dài" })]));
    await decide(disposal.body.approvalRequestId, "approved");
    await decide(chosen.body.approvalRequestId, "approved");
    const detail = (await keeper.call("get", `/inventory/stock/${items.milk!.variantId}/details?warehouseId=${warehouseId}&companyId=${retail}`, { companyId: retail })).body;
    expect(detail.balances.map((balance: { lotNo: string; quantity: string }) => [balance.lotNo, balance.quantity])).toEqual([
      ["L-SOM", "10"],
      ["L-MUON", "8"],
    ]);
  });

  it("KICHBAN_KIEMTHU_151: serial nhập, xuất đích danh; số serial sai số lượng, serial trùng, serial không có trong kho bị từ chối; kho có vị trí bắt buộc chọn vị trí", async () => {
    const phone = (quantity: string, serials: string[], extra: Record<string, unknown> = {}) => ({ variantId: items.phone!.variantId, unitId: units.CAI, quantity, serials, ...extra });
    expect((await draft(keeper, document("receipt_other", "other", [phone("2", ["IMEI-1"], { unitCost: "5000000" })]))).body.error.fields).toEqual({
      "lines.0.serials": "Số serial phải bằng số lượng theo đơn vị cơ sở.",
    });
    const shelfDocument = (type: string, reasonCode: string, lines: Line[]) => document(type, reasonCode, lines, { warehouseId: shelfWarehouseId });
    expect((await draft(keeper, shelfDocument("receipt_other", "other", [phone("2", ["IMEI-1", "IMEI-2"], { unitCost: "5000000" })]))).body.error.fields).toEqual({
      "lines.0.locationId": "Vui lòng nhập thông tin này.",
    });
    const received = await submitted(
      keeper,
      shelfDocument("receipt_other", "other", [phone("1", ["IMEI-1"], { unitCost: "5000000", locationId: shelf["A-01"] }), phone("1", ["IMEI-2"], { unitCost: "5200000", locationId: shelf["A-02"] })]),
    );
    await decide(received.body.approvalRequestId, "approved");
    expect(await stock("DTK", shelfWarehouseId)).toMatchObject({ onHand: "2", averageCost: "5100000" });
    expect((await submitted(keeper, document("receipt_other", "other", [phone("1", ["IMEI-1"], { unitCost: "1" })]))).body.error.fields).toEqual({ "lines.0.serials": "Serial đã có trong kho." });
    expect((await submitted(keeper, shelfDocument("issue_other", "gift", [phone("1", ["IMEI-1"], { locationId: shelf["A-02"] })]))).body.error.fields).toEqual({
      "lines.0.serials": "Serial không có trong kho, vị trí này.",
    });
    const issued = await submitted(keeper, shelfDocument("issue_other", "gift", [phone("1", ["IMEI-2"], { locationId: shelf["A-02"] })]));
    await decide(issued.body.approvalRequestId, "approved");
    expect((await retailAdmin.call("get", `/inventory/documents/${issued.body.id}`, { companyId: retail })).body.lines[0]).toMatchObject({ costValue: "5200000", serials: ["IMEI-2"] });
    const linked = await pool.query("SELECT ls.serial_no, s.serial_no AS linked FROM inventory.document_line_serials ls JOIN inventory.serials s ON s.id = ls.serial_id");
    expect(linked.rows.every((row) => row.serial_no === row.linked)).toBe(true);
    const detail = (await retailAdmin.call("get", `/inventory/stock/${items.phone!.variantId}/details?warehouseId=${shelfWarehouseId}&companyId=${retail}`, { companyId: retail })).body;
    expect(detail.serials).toEqual([{ serialNo: "IMEI-1", locationCode: "A-01", unitCost: "5000000" }]);
  });
});

describe("TIEUCHI_NGHIEMTHU_65: công ty chủ hàng", () => {
  it("KICHBAN_KIEMTHU_152: phiếu chỉ chứa hàng của công ty chủ hàng; kho không nhận chủ hàng thì từ chối; chủ hàng khác chỉ xem tồn của mình; điều chỉnh tăng giảm", async () => {
    expect((await draft(keeper, document("receipt_other", "other", [{ variantId: items.tradingWater!.variantId, unitId: units.CHAI, quantity: "5", unitCost: "1000" }]))).body.error.fields).toEqual({
      "lines.0.variantId": "Mặt hàng không thuộc công ty chủ hàng hoặc đã ngừng bán.",
    });
    const forTrading = document("receipt_other", "other", [{ variantId: items.tradingWater!.variantId, unitId: units.CHAI, quantity: "5", unitCost: "1000" }], { companyId: trading });
    expect((await draft(keeper, { ...forTrading, warehouseId: shelfWarehouseId })).body.error.fields).toMatchObject({ companyId: "Kho không nhận hàng của công ty này." });
    // Thủ kho của kho lập phiếu cho hàng công ty khác; phiếu đánh số theo công ty chủ hàng.
    const tradingReceipt = await submitted(keeper, forTrading);
    expect(tradingReceipt.body).toMatchObject({ status: "posted", companyName: "VComm Thương mại", documentNo: expect.stringMatching(/^NK-VCT-/) });
    const tradingStock = (await tradingManager.call("get", "/inventory/stock?onlyInStock=false", { companyId: trading })).body.data;
    expect(tradingStock.map((row: { sku: string; onHand: string }) => [row.sku, row.onHand])).toEqual([[expect.any(String), "5"]]);
    expect((await tradingManager.call("get", `/inventory/documents/${tradingReceipt.body.id}`, { companyId: trading })).status).toBe(200);
    expect(
      (await tradingManager.call("get", `/inventory/documents/${(await keeper.call("get", "/inventory/documents?type=issue_other", { companyId: retail })).body.data[0].id}`, { companyId: trading }))
        .status,
    ).toBe(404);

    // Sản phẩm đã phát sinh giao dịch kho: không đổi đơn vị cơ sở, hệ số quy đổi (QUYTAC_NGHIEPVU_40).
    const product = (await retailAdmin.call("get", `/catalog/products/${items.water!.productId}`, { companyId: retail })).body;
    const changed = await retailAdmin.call("patch", `/catalog/products/${product.id}`, {
      companyId: retail,
      body: {
        categoryId: product.categoryId,
        name: product.name,
        vatRate: product.vatRate,
        tracksLots: product.tracksLots,
        tracksSerials: product.tracksSerials,
        warrantyMonths: product.warrantyMonths,
        baseUnitId: units.HOP,
        units: [{ unitId: units.THUNG, factor: "12" }],
        variants: product.variants.map((variant: { id: string; sku: string; optionValues: string[] }) => ({ id: variant.id, sku: variant.sku, optionValues: variant.optionValues, barcodes: [] })),
        version: product.version,
      },
    });
    expect(changed.body.error.fields).toEqual({ baseUnitId: "Sản phẩm đã phát sinh giao dịch kho, không đổi được.", units: "Sản phẩm đã phát sinh giao dịch kho, không đổi được." });
    // Điều chỉnh: dòng âm giảm, dòng dương tăng theo giá vốn bình quân.
    const adjusted = await submitted(
      keeper,
      document("adjustment", "found", [
        { variantId: items.water!.variantId, unitId: units.CHAI, quantity: "-10" },
        { variantId: items.water!.variantId, unitId: units.THUNG, quantity: "1" },
      ]),
    );
    expect(adjusted.body.status).toBe("posted");
    expect(await stock("NUOCK")).toMatchObject({ onHand: "64", averageCost: "10400" });
  });

  it("KICHBAN_KIEMTHU_153: phiếu 200 dòng ghi sổ dưới 2 giây; danh sách 50.000 dòng tồn trả trang đầu dưới 500 ms", async () => {
    const productId = items.water!.productId;
    await pool.query(`INSERT INTO catalog.variants (product_id, company_id, sku, option_values) SELECT $1, $2, 'NUOCK-T' || n, '[]'::jsonb FROM generate_series(1, 50000) n`, [productId, retail]);
    const variants = (await pool.query<{ id: string }>("SELECT id FROM catalog.variants WHERE sku LIKE 'NUOCK-T%' ORDER BY sku LIMIT 200")).rows;
    const big = await draft(
      keeper,
      document(
        "adjustment",
        "found",
        variants.map((variant) => ({ variantId: variant.id, unitId: units.CHAI, quantity: "1", unitCost: "1000" })),
      ),
    );
    expect(big.status).toBe(201);
    let started = performance.now();
    const posted = await keeper.call("post", `/inventory/documents/${big.body.id}/submit`, { companyId: retail });
    expect(posted.body.status).toBe("posted");
    expect(performance.now() - started).toBeLessThan(2000);
    await pool.query(
      `INSERT INTO inventory.costs (warehouse_id, company_id, variant_id, quantity, value, average_cost)
       SELECT $1, $2, v.id, 1, 1000, 1000 FROM catalog.variants v WHERE v.sku LIKE 'NUOCK-T%' ON CONFLICT DO NOTHING`,
      [warehouseId, retail],
    );
    started = performance.now();
    const page = await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}`, { companyId: retail });
    const elapsed = performance.now() - started;
    expect(page.body.total).toBeGreaterThanOrEqual(50000);
    expect(elapsed).toBeLessThan(500);
  }, 60_000);
});
