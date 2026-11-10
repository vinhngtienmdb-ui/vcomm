// CONG_VIEC_07: Mua hàng trong nước – bảng giá mua, đề nghị mua, đơn mua (TIEUCHI_NGHIEMTHU_80 đến 82, 86; KICHBAN_KIEMTHU_165 trở đi).
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
let purchaser: Session;
let tradingPurchaser: Session;
let keeper: Session;
let otherKeeper: Session;
let approver: Session;
let today: string;
let warehouseId: string;
let supplierId: string;
let otherPartnerId: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, { variantId: string; productId: string }> = {};

async function assign(email: string, name: string, role: string, companyId: string, branchId?: string) {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    companyId,
    branchId ?? null,
  ]);
  return signIn(application, email);
}

export async function policy(documentTypeCode: string, minAmount = "0") {
  const response = await retailAdmin.call("post", "/approval-policies", {
    companyId: retail,
    body: {
      documentTypeCode,
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount, approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
    },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
}
async function decide(requestId: string, decision: "approved" | "rejected") {
  await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Kiểm thử" } });
  await application.get(OutboxService).dispatchPending();
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  purchaser = await assign("muahang.vcr@vcomm.test", "Đinh Văn Mua", "purchaser", retail);
  tradingPurchaser = await assign("muahang.vct@vcomm.test", "Lạc Thị Mua", "purchaser", trading);
  keeper = await assign("thukho.mua@vcomm.test", "Kiều Văn Kho", "warehouse_keeper", retail, testIds.binhDuongWarehouse);

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } })).body.id;
  const product = async (company: string, session: Session, key: string, name: string, categoryId: string, baseUnit: string, extra: Record<string, unknown> = {}) => {
    const created = await session.call("post", "/catalog/products", {
      companyId: company,
      body: { categoryId, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units[baseUnit], variants: [{ barcodes: [] }], ...extra },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = { variantId: created.body.variants[0].id, productId: created.body.id };
  };
  const water = await category("NUOCM");
  await product(retail, retailAdmin, "water", "Nước suối mua", water, "CHAI", { units: [{ unitId: units.THUNG, factor: "24" }] });
  await product(retail, retailAdmin, "rice", "Gạo mua", water, "KG", { vatRate: "5" });
  await product(trading, groupAdmin, "tradingWater", "Nước của VCT", water, "CHAI");
  const checked = await category("THUCM", { tracksLots: true, requiresQualityCheck: true });
  await product(retail, retailAdmin, "milk", "Sữa tươi kiểm tra", checked, "HOP", { tracksLots: true });
  const phone = await category("DTM", { tracksSerials: true });
  await product(retail, retailAdmin, "phone", "Điện thoại mua", phone, "CAI", { tracksSerials: true });
  otherKeeper = await assign("thukho.hcm.mua@vcomm.test", "Mạc Văn Khác", "warehouse_keeper", retail, testIds.headOfficeBranch);

  warehouseId = (await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BDM", name: "Kho mua BD", usesLocations: false } }))
    .body.id;

  const partner = async (taxCode: string, name: string, profile: Record<string, unknown> | null) => {
    const created = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    if (profile) {
      const saved = await retailAdmin.call("put", `/crm/partners/${created.body.id}/profile`, {
        companyId: retail,
        body: { isCustomer: false, isSupplier: true, paymentTermDays: 30, creditLimit: null, version: 0, ...profile },
      });
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    }
    return created.body.id as string;
  };
  supplierId = await partner("0310000001", "Công ty TNHH Nước Sạch Miền Nam", {});
  otherPartnerId = await partner("0310000002", "Công ty Khách Hàng Lẻ", { isCustomer: true, isSupplier: false });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_80: bảng giá mua theo nhà cung cấp", () => {
  it("KICHBAN_KIEMTHU_165: giá chồng hiệu lực bị từ chối; giá gợi ý theo ngày, số lượng tối thiểu; nhà cung cấp chưa có hồ sơ bị từ chối", async () => {
    const base = { supplierId, variantId: items.water!.variantId, unitId: units.THUNG, unitPrice: "96000", validFrom: "2026-01-01", validTo: null };
    expect((await keeper.call("post", "/purchasing/supplier-prices", { companyId: retail, body: base })).status).toBe(403);
    const notSupplier = await purchaser.call("post", "/purchasing/supplier-prices", { companyId: retail, body: { ...base, supplierId: otherPartnerId } });
    expect(notSupplier.body.error.fields).toEqual({ supplierId: "Nhà cung cấp chưa có hồ sơ nhà cung cấp đang dùng ở công ty." });
    const wrongUnit = await purchaser.call("post", "/purchasing/supplier-prices", { companyId: retail, body: { ...base, unitId: units.KG } });
    expect(Object.keys(wrongUnit.body.error.fields)).toEqual(["unitId"]);

    const created = await purchaser.call("post", "/purchasing/supplier-prices", { companyId: retail, body: base });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ supplierName: "Công ty TNHH Nước Sạch Miền Nam", unitName: "Thùng", minQuantity: "0", unitPrice: "96000", status: "active" });
    const overlap = await purchaser.call("post", "/purchasing/supplier-prices", { companyId: retail, body: { ...base, unitPrice: "95000", validFrom: "2026-06-01" } });
    expect(overlap.body.error.fields).toEqual({ validFrom: "Đã có giá đang dùng cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu trùng thời gian hiệu lực." });
    // Giá theo bậc số lượng, giá tương lai không chồng giá cũ khi giá cũ có ngày kết thúc.
    const tier = await purchaser.call("post", "/purchasing/supplier-prices", { companyId: retail, body: { ...base, minQuantity: "10", unitPrice: "90000" } });
    expect(tier.status).toBe(201);
    const ended = await purchaser.call("patch", `/purchasing/supplier-prices/${created.body.id}`, { companyId: retail, body: { ...base, validTo: "2099-12-30", version: 1 } });
    expect(ended.body).toMatchObject({ validTo: "2099-12-30", version: 2 });
    expect((await purchaser.call("post", "/purchasing/supplier-prices", { companyId: retail, body: { ...base, unitPrice: "99000", validFrom: "2099-12-31" } })).status).toBe(201);

    const lookup = (quantity: string, date = today) =>
      purchaser.call("get", `/purchasing/supplier-prices/lookup?supplierId=${supplierId}&variantId=${items.water!.variantId}&unitId=${units.THUNG}&quantity=${quantity}&date=${date}`, {
        companyId: retail,
      });
    expect((await lookup("5")).body.unitPrice).toBe("96000");
    expect((await lookup("10")).body.unitPrice).toBe("90000");
    expect((await lookup("1", "2099-12-31")).body.unitPrice).toBe("99000");
    expect((await lookup("1", "2025-12-31")).body.unitPrice).toBeNull();

    // Ngừng dùng thì không gợi ý; dùng lại kiểm chồng hiệu lực.
    expect((await purchaser.call("post", `/purchasing/supplier-prices/${tier.body.id}/deactivate`, { companyId: retail, body: { version: 1 } })).body.status).toBe("inactive");
    expect((await lookup("10")).body.unitPrice).toBe("96000");
    const list = await purchaser.call("get", `/purchasing/supplier-prices?supplierId=${supplierId}&status=active`, { companyId: retail });
    expect(list.body.total).toBe(2);

    // Công ty khác không thấy giá mua của VCR.
    expect((await tradingPurchaser.call("get", "/purchasing/supplier-prices", { companyId: trading })).body.total).toBe(0);
    expect((await tradingPurchaser.call("patch", `/purchasing/supplier-prices/${created.body.id}`, { companyId: trading, body: { ...base, version: 2 } })).status).toBe(404);
    const options = await purchaser.call("get", "/purchasing/options", { companyId: retail });
    expect(options.body).toMatchObject({ currency: "VND", suppliers: [{ id: supplierId }], warehouses: [{ id: warehouseId }] });
  });
});

const orderBody = (lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ supplierId, warehouseId, orderDate: today, lines, ...extra });
const waterLine = (quantity: string, unitPrice: string, extra: Record<string, unknown> = {}) => ({
  variantId: items.water!.variantId,
  unitId: units.THUNG,
  quantity,
  unitPrice,
  vatRate: "10",
  ...extra,
});

describe("TIEUCHI_NGHIEMTHU_81: đề nghị mua, đơn mua có duyệt", () => {
  it("KICHBAN_KIEMTHU_166: đề nghị mua đi luồng duyệt; đơn từ đề nghị đã duyệt không vượt giá trị duyệt ngay, vượt thì chờ duyệt; đặt quá số còn lại bị từ chối", async () => {
    await policy("purchasing.requisition");
    await policy("purchasing.order");
    const requisitionBody = {
      warehouseId,
      neededBy: today,
      reason: "Bổ sung hàng bán Tết",
      lines: [
        { variantId: items.water!.variantId, unitId: units.THUNG, quantity: "10", estimatedUnitPrice: "96000", suggestedSupplierId: supplierId },
        { variantId: items.rice!.variantId, unitId: units.KG, quantity: "100", estimatedUnitPrice: "20000" },
      ],
    };
    expect((await purchaser.call("post", "/purchasing/requisitions", { companyId: retail, body: { ...requisitionBody, lines: [{ ...requisitionBody.lines[0], unitId: units.KG }] } })).status).toBe(
      400,
    );
    const requisition = await keeper.call("post", "/purchasing/requisitions", { companyId: retail, body: requisitionBody });
    expect(requisition.status, JSON.stringify(requisition.body)).toBe(201);
    expect(requisition.body).toMatchObject({ status: "draft", estimatedTotal: "2960000", canEdit: true });
    expect(requisition.body.lines[0]).toMatchObject({ baseQuantity: "240", orderedBaseQuantity: "0" });
    const submitted = await keeper.call("post", `/purchasing/requisitions/${requisition.body.id}/submit`, { companyId: retail });
    expect(submitted.body).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^DNM/) });
    // Đề nghị chưa duyệt chưa đặt được.
    const early = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody([waterLine("10", "96000", { requisitionLineId: requisition.body.lines[0].id })]),
    });
    expect(Object.keys(early.body.error.fields)).toEqual(["lines.0.requisitionLineId"]);
    await decide(submitted.body.approvalRequestId, "approved");
    const approved = await purchaser.call("get", `/purchasing/requisitions/${requisition.body.id}`, { companyId: retail });
    expect(approved.body).toMatchObject({ status: "approved", canOrder: true });
    expect((await purchaser.call("get", "/purchasing/requisitions?openOnly=true", { companyId: retail })).body.total).toBe(1);

    // Đơn từ đề nghị, giá không vượt ước tính: duyệt ngay không qua luồng duyệt.
    const fromRequisition = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody([waterLine("6", "95000", { requisitionLineId: requisition.body.lines[0].id })]),
    });
    expect(fromRequisition.status, JSON.stringify(fromRequisition.body)).toBe(201);
    expect(fromRequisition.body).toMatchObject({ status: "draft", totalAmount: "570000", taxAmount: "57000" });
    const exempt = await purchaser.call("post", `/purchasing/orders/${fromRequisition.body.id}/submit`, { companyId: retail });
    expect(exempt.body).toMatchObject({ status: "approved", approvalRequestId: null, documentNo: expect.stringMatching(/^DMH/) });
    expect((await purchaser.call("get", `/purchasing/requisitions/${requisition.body.id}`, { companyId: retail })).body.lines[0].orderedBaseQuantity).toBe("144");

    // Đặt quá số còn lại (còn 4 thùng) bị từ chối.
    const tooMany = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody([waterLine("5", "95000", { requisitionLineId: requisition.body.lines[0].id })]),
    });
    expect(tooMany.body.error.fields).toEqual({ "lines.0.quantity": "Vượt số lượng còn lại của dòng đề nghị mua." });

    // Giá vượt ước tính: phải duyệt.
    const pricier = await purchaser.call("post", "/purchasing/orders", {
      companyId: retail,
      body: orderBody([waterLine("4", "97000", { requisitionLineId: requisition.body.lines[0].id })]),
    });
    const pending = await purchaser.call("post", `/purchasing/orders/${pricier.body.id}/submit`, { companyId: retail });
    expect(pending.body).toMatchObject({ status: "pending", approvalRequestId: expect.any(String) });
    await decide(pending.body.approvalRequestId, "rejected");
    expect((await purchaser.call("get", `/purchasing/orders/${pricier.body.id}`, { companyId: retail })).body).toMatchObject({ status: "rejected", canEdit: true });
    // Đơn bị từ chối không giữ số lượng của đề nghị.
    expect((await purchaser.call("get", `/purchasing/requisitions/${requisition.body.id}`, { companyId: retail })).body.lines[0].orderedBaseQuantity).toBe("144");

    // Đơn trực tiếp (không từ đề nghị) luôn qua luồng duyệt.
    const direct = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: orderBody([waterLine("1", "1000")]) });
    expect((await purchaser.call("post", `/purchasing/orders/${direct.body.id}/submit`, { companyId: retail })).body.status).toBe("pending");
    // Thủ kho chỉ xem đơn, không lập đơn.
    expect((await keeper.call("post", "/purchasing/orders", { companyId: retail, body: orderBody([waterLine("1", "1000")]) })).status).toBe(403);
    expect((await keeper.call("get", `/purchasing/orders/${direct.body.id}`, { companyId: retail })).body).toMatchObject({ canEdit: false, canClose: false });
  });
});

describe("TIEUCHI_NGHIEMTHU_82, 86: sửa đơn đã duyệt, đóng đơn, phạm vi công ty", () => {
  it("KICHBAN_KIEMTHU_167: sửa tăng giá trị hoặc đổi nhà cung cấp về chờ duyệt; sửa giảm giữ trạng thái; đóng đơn; công ty khác không xem được", async () => {
    const created = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: orderBody([waterLine("10", "96000")], { note: "Giao trong tuần" }) });
    const submitted = await purchaser.call("post", `/purchasing/orders/${created.body.id}/submit`, { companyId: retail });
    await decide(submitted.body.approvalRequestId, "approved");
    let order = (await purchaser.call("get", `/purchasing/orders/${created.body.id}`, { companyId: retail })).body;
    expect(order).toMatchObject({ status: "approved", canClose: true });
    expect(order.lines[0]).toMatchObject({ receivableBaseQuantity: "240" });

    // Giảm số lượng: vẫn đã duyệt.
    const lineId = order.lines[0].id;
    const decreased = await purchaser.call("patch", `/purchasing/orders/${order.id}`, { companyId: retail, body: orderBody([waterLine("8", "96000", { id: lineId })], { version: order.version }) });
    expect(decreased.status, JSON.stringify(decreased.body)).toBe(200);
    expect(decreased.body).toMatchObject({ status: "approved", totalAmount: "768000" });
    // Tăng giá trị so với lần duyệt gần nhất: về chờ duyệt.
    const increased = await purchaser.call("patch", `/purchasing/orders/${order.id}`, {
      companyId: retail,
      body: orderBody([waterLine("8", "96000", { id: lineId }), waterLine("3", "96000")], { version: decreased.body.version }),
    });
    expect(increased.body).toMatchObject({ status: "pending", totalAmount: "1056000" });
    await decide(increased.body.approvalRequestId, "approved");
    order = (await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body;
    expect(order).toMatchObject({ status: "approved", documentNo: created.body.documentNo ?? submitted.body.documentNo });

    // Đổi nhà cung cấp: về chờ duyệt dù giá trị không tăng.
    const secondSupplier = (await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Nhà cung cấp thứ hai", taxCode: "0310000003" } })).body.id;
    await retailAdmin.call("put", `/crm/partners/${secondSupplier}/profile`, { companyId: retail, body: { isCustomer: false, isSupplier: true, paymentTermDays: 0, creditLimit: null, version: 0 } });
    const switched = await purchaser.call("patch", `/purchasing/orders/${order.id}`, {
      companyId: retail,
      body: orderBody(
        order.lines.map((line: { id: string; quantity: string }) => waterLine(line.quantity, "96000", { id: line.id })),
        { supplierId: secondSupplier, version: order.version },
      ),
    });
    expect(switched.body).toMatchObject({ status: "pending", supplierName: "Nhà cung cấp thứ hai" });
    await decide(switched.body.approvalRequestId, "approved");
    order = (await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body;

    // Công ty khác không xem, không đóng được.
    expect((await tradingPurchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: trading })).status).toBe(404);
    expect((await tradingPurchaser.call("get", "/purchasing/orders", { companyId: trading })).body.total).toBe(0);
    expect((await tradingPurchaser.call("post", `/purchasing/orders/${order.id}/close`, { companyId: trading, body: { reason: "Thử", version: order.version } })).status).toBe(409);

    const closed = await purchaser.call("post", `/purchasing/orders/${order.id}/close`, { companyId: retail, body: { reason: "Nhà cung cấp hết hàng", version: order.version } });
    expect(closed.body).toMatchObject({ status: "closed", closedReason: "Nhà cung cấp hết hàng", canEdit: false, canClose: false });
    expect(closed.body.lines[0].receivableBaseQuantity).toBe("0");
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE entity_id = $1 ORDER BY occurred_at", [order.id]);
    expect(audit.rows.map((row: { action: string }) => row.action)).toEqual([
      "purchase_order.create",
      "purchase_order.submit",
      "purchase_order.update",
      "purchase_order.update",
      "purchase_order.submit",
      "purchase_order.update",
      "purchase_order.submit",
      "purchase_order.close",
    ]);
  });
});

// Đơn mua đã duyệt (công ty chưa có chính sách duyệt đơn mua ở phần này thì dùng chính sách cấp 1, duyệt bằng người duyệt).
async function approvedOrder(lines: Record<string, unknown>[]) {
  const created = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: orderBody(lines) });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await purchaser.call("post", `/purchasing/orders/${created.body.id}/submit`, { companyId: retail });
  if (submitted.body.status === "pending") await decide(submitted.body.approvalRequestId, "approved");
  return (await purchaser.call("get", `/purchasing/orders/${created.body.id}`, { companyId: retail })).body;
}
async function receive(session: Session, orderId: string, lines: Record<string, unknown>[]) {
  const created = await session.call("post", "/inventory/purchase-receipts", { companyId: retail, body: { orderId, documentDate: today, lines } });
  if (created.status !== 201) return created;
  return session.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail });
}

describe("TIEUCHI_NGHIEMTHU_83, 86: nhận hàng theo đơn mua", () => {
  it("KICHBAN_KIEMTHU_168: dung sai nhận vượt; đơn chưa duyệt, đã đóng không nhận; giá nhập theo đơn; đơn nhận đủ; thủ kho chi nhánh khác không nhận", async () => {
    await retailAdmin.call("put", "/purchasing/settings", { companyId: retail, body: { overReceiptTolerancePercent: "5", version: 0 } });
    const order = await approvedOrder([waterLine("10", "96000"), { variantId: items.rice!.variantId, unitId: units.KG, quantity: "50", unitPrice: "20000", vatRate: "5" }]);
    expect(order.status).toBe("approved");
    const [water, rice] = order.lines;
    expect(water.receivableBaseQuantity).toBe("252");

    // Thủ kho chi nhánh khác không thấy đơn, không nhận vào kho Bình Dương.
    expect((await otherKeeper.call("get", "/inventory/purchase-orders", { companyId: retail })).body).toEqual([]);
    expect([403, 404]).toContain((await receive(otherKeeper, order.id, [{ orderLineId: water.id, quantity: "1" }])).status);
    expect((await keeper.call("get", "/inventory/purchase-orders", { companyId: retail })).body.map((item: { id: string }) => item.id)).toContain(order.id);

    // Vượt dung sai 5% (10,5 thùng) bị từ chối; 10,5 thùng được.
    const over = await keeper.call("post", "/inventory/purchase-receipts", { companyId: retail, body: { orderId: order.id, documentDate: today, lines: [{ orderLineId: water.id, quantity: "11" }] } });
    expect(over.body.error.fields).toEqual({ "lines.0.quantity": "Vượt số còn nhận được của đơn mua (đã tính dung sai)." });
    const first = await receive(keeper, order.id, [{ orderLineId: water.id, quantity: "6" }]);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({
      type: "purchase_receipt",
      status: "posted",
      documentNo: expect.stringMatching(/^NM/),
      partnerName: "Công ty TNHH Nước Sạch Miền Nam",
      sourceNo: order.documentNo,
    });
    // Giá nhập = đơn giá đơn mua quy về đơn vị cơ sở: 96.000 / 24 = 4.000 một chai.
    const waterStock = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Nước suối mua`, { companyId: retail })).body.data[0];
    expect(waterStock).toMatchObject({ onHand: "144", averageCost: "4000", value: "576000" });

    // Giảm số lượng dòng dưới số đã nhận bị từ chối.
    const below = await purchaser.call("patch", `/purchasing/orders/${order.id}`, {
      companyId: retail,
      body: orderBody([waterLine("5", "96000", { id: water.id }), { id: rice.id, variantId: items.rice!.variantId, unitId: units.KG, quantity: "50", unitPrice: "20000", vatRate: "5" }], {
        version: order.version,
      }),
    });
    expect(below.body.error.fields).toEqual({ "lines.0.quantity": "Số lượng nhỏ hơn số đã nhận." });

    // Nhận nốt trong dung sai: đơn chuyển "Đã nhận đủ" khi mọi dòng đủ.
    expect((await receive(keeper, order.id, [{ orderLineId: water.id, quantity: "4.5" }])).status).toBe(201);
    expect((await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body.status).toBe("approved");
    expect((await receive(keeper, order.id, [{ orderLineId: rice.id, quantity: "50" }])).status).toBe(201);
    const done = (await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body;
    expect(done).toMatchObject({ status: "received" });
    expect(done.lines[0]).toMatchObject({ receivedBaseQuantity: "252", receivableBaseQuantity: "0" });
    expect(done.receipts).toHaveLength(3);
    // Đơn đã nhận đủ, đơn nháp không nhận được.
    expect((await receive(keeper, order.id, [{ orderLineId: rice.id, quantity: "1" }])).body.error.message).toBe("Đơn mua chưa duyệt hoặc đã đóng, không nhận hàng được.");
    const draftOrder = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: orderBody([waterLine("1", "96000")]) });
    expect((await receive(keeper, draftOrder.body.id, [{ orderLineId: draftOrder.body.lines[0].id, quantity: "1" }])).status).toBe(409);

    // Đóng đơn còn thiếu: phần chưa nhận hủy, không nhận thêm được.
    const partial = await approvedOrder([waterLine("2", "96000")]);
    expect((await receive(keeper, partial.id, [{ orderLineId: partial.lines[0].id, quantity: "1" }])).status).toBe(201);
    const reloaded = (await purchaser.call("get", `/purchasing/orders/${partial.id}`, { companyId: retail })).body;
    expect((await purchaser.call("post", `/purchasing/orders/${partial.id}/close`, { companyId: retail, body: { reason: "Nhà cung cấp giao thiếu", version: reloaded.version } })).body.status).toBe(
      "closed",
    );
    expect((await receive(keeper, partial.id, [{ orderLineId: partial.lines[0].id, quantity: "1" }])).status).toBe(409);
    // Thủ kho không lập phiếu nhập mua bằng màn hình phiếu kho thường.
    const manual = await keeper.call("post", "/inventory/documents", {
      companyId: retail,
      body: {
        type: "purchase_receipt",
        warehouseId,
        companyId: retail,
        documentDate: today,
        reasonCode: "purchase",
        reason: "Thử",
        lines: [{ variantId: items.water!.variantId, unitId: units.CHAI, quantity: "1", unitCost: "1" }],
      },
    });
    expect(manual.status).toBe(400);
  });
});

describe("TIEUCHI_NGHIEMTHU_84: kiểm tra chất lượng khi nhập mua", () => {
  it("KICHBAN_KIEMTHU_169: hàng cần kiểm tra chưa vào tồn khi chờ kiểm; ghi sổ phần đạt; phần không đạt không tính đã nhận", async () => {
    const order = await approvedOrder([{ variantId: items.milk!.variantId, unitId: units.HOP, quantity: "100", unitPrice: "10000", vatRate: "5" }]);
    const line = order.lines[0];
    const received = await receive(keeper, order.id, [{ orderLineId: line.id, quantity: "100", lotNo: "L-SUA-01", expiresOn: "2099-01-01" }]);
    expect(received.body).toMatchObject({ status: "quality_check", canQualityCheck: true });
    expect(received.body.lines[0].requiresQualityCheck).toBe(true);
    const milkStock = async () => (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Sữa tươi kiểm tra`, { companyId: retail })).body.data[0];
    expect((await milkStock())?.onHand ?? "0").toBe("0");
    // Đang chờ kiểm vẫn tính vào số còn nhận được (dung sai 5% từ kịch bản trước: còn 5 hộp); đơn chưa đóng được.
    expect((await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body.lines[0]).toMatchObject({ receivedBaseQuantity: "0", receivableBaseQuantity: "5" });
    const reloaded = (await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body;
    expect((await purchaser.call("post", `/purchasing/orders/${order.id}/close`, { companyId: retail, body: { reason: "Thử", version: reloaded.version } })).body.error.message).toBe(
      "Đơn mua còn phiếu nhập nháp hoặc chờ kiểm tra, chưa đóng được.",
    );

    const missingReason = await keeper.call("post", `/inventory/documents/${received.body.id}/quality-check`, {
      companyId: retail,
      body: { lines: [{ lineId: received.body.lines[0].id, rejectedQuantity: "10" }], version: received.body.version },
    });
    expect(missingReason.body.error.fields).toEqual({ "lines.0.rejectionReason": "Vui lòng nhập thông tin này." });
    const checked = await keeper.call("post", `/inventory/documents/${received.body.id}/quality-check`, {
      companyId: retail,
      body: { lines: [{ lineId: received.body.lines[0].id, rejectedQuantity: "10", rejectionReason: "Hộp móp, rò rỉ" }], version: received.body.version },
    });
    expect(checked.status, JSON.stringify(checked.body)).toBe(201);
    expect(checked.body).toMatchObject({ status: "posted", canQualityCheck: false });
    expect(checked.body.lines[0]).toMatchObject({ rejectedBaseQuantity: "10", rejectionReason: "Hộp móp, rò rỉ" });
    expect((await retailAdmin.call("get", `/inventory/documents/${received.body.id}`, { companyId: retail })).body.lines[0].costValue).toBe("900000");
    expect(await milkStock()).toMatchObject({ onHand: "90", averageCost: "10000" });
    // Phần không đạt không tính đã nhận: còn nhận được 15 hộp (105 - 90).
    expect((await purchaser.call("get", `/purchasing/orders/${order.id}`, { companyId: retail })).body.lines[0]).toMatchObject({ receivedBaseQuantity: "90", receivableBaseQuantity: "15" });
    expect((await keeper.call("post", `/inventory/documents/${received.body.id}/quality-check`, { companyId: retail, body: { lines: [], version: checked.body.version } })).status).toBe(409);
  });
});

describe("TIEUCHI_NGHIEMTHU_85: trả hàng nhà cung cấp", () => {
  it("KICHBAN_KIEMTHU_170: trả theo giá phiếu nhập gốc, giá vốn bình quân phần còn lại tính lại; trả quá số đã nhập, serial chưa nhập bị từ chối", async () => {
    const cheap = await approvedOrder([waterLine("10", "96000")]);
    const expensive = await approvedOrder([waterLine("10", "120000")]);
    const firstReceipt = await receive(keeper, cheap.id, [{ orderLineId: cheap.lines[0].id, quantity: "10" }]);
    await receive(keeper, expensive.id, [{ orderLineId: expensive.lines[0].id, quantity: "10" }]);
    const before = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Nước suối mua`, { companyId: retail })).body.data[0];
    const beforeValue = Number(before.value);
    const beforeQuantity = Number(before.onHand);

    // Trả 1 thùng (24 chai) từ phiếu nhập giá 96.000: xuất đúng 96.000.
    const line = firstReceipt.body.lines[0];
    const tooMany = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: firstReceipt.body.id, documentDate: today, reason: "Hàng lỗi", lines: [{ receiptLineId: line.id, quantity: "11" }] },
    });
    const tooManySubmit = tooMany.status === 201 ? await keeper.call("post", `/inventory/documents/${tooMany.body.id}/submit`, { companyId: retail }) : tooMany;
    expect(tooManySubmit.body.error.fields).toEqual({ "lines.0.quantity": "Vượt số đã nhập còn trả được của phiếu nhập gốc." });
    if (tooMany.status === 201) await keeper.call("delete", `/inventory/documents/${tooMany.body.id}`, { companyId: retail });

    const returned = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: firstReceipt.body.id, documentDate: today, reason: "Hàng lỗi", lines: [{ receiptLineId: line.id, quantity: "1" }] },
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    const posted = await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail });
    expect(posted.body).toMatchObject({ type: "purchase_return", status: "posted", documentNo: expect.stringMatching(/^TNCC/), sourceNo: firstReceipt.body.documentNo });
    // Thủ kho không có quyền xem giá vốn: đọc giá trị bằng quản trị công ty.
    expect((await retailAdmin.call("get", `/inventory/documents/${returned.body.id}`, { companyId: retail })).body.lines[0].costValue).toBe("96000");
    const after = (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=Nước suối mua`, { companyId: retail })).body.data[0];
    expect(Number(after.value)).toBe(beforeValue - 96000);
    expect(Number(after.onHand)).toBe(beforeQuantity - 24);
    expect(Number(after.averageCost)).toBeCloseTo((beforeValue - 96000) / (beforeQuantity - 24), 3);
    expect((await purchaser.call("get", `/purchasing/orders/${cheap.id}`, { companyId: retail })).body.lines[0].returnedBaseQuantity).toBe("24");
    // Trả nốt phần còn lại của dòng gốc: tổng không vượt 10 thùng.
    const rest = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: firstReceipt.body.id, documentDate: today, reason: "Hàng lỗi", lines: [{ receiptLineId: line.id, quantity: "10" }] },
    });
    expect((await keeper.call("post", `/inventory/documents/${rest.body.id}/submit`, { companyId: retail })).status).toBe(400);

    // Hàng serial: chỉ trả serial đã nhập ở phiếu gốc.
    const phones = await approvedOrder([{ variantId: items.phone!.variantId, unitId: units.CAI, quantity: "2", unitPrice: "5000000", vatRate: "10" }]);
    const phoneReceipt = await receive(keeper, phones.id, [{ orderLineId: phones.lines[0].id, quantity: "2", serials: ["IMEI-M1", "IMEI-M2"] }]);
    expect(phoneReceipt.body.status).toBe("posted");
    const wrongSerial = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: phoneReceipt.body.id, documentDate: today, reason: "Lỗi màn hình", lines: [{ receiptLineId: phoneReceipt.body.lines[0].id, quantity: "1", serials: ["IMEI-KHAC"] }] },
    });
    expect(wrongSerial.body.error.fields).toEqual({ "lines.0.serials": expect.any(String) });
    const phoneReturn = await keeper.call("post", "/inventory/purchase-returns", {
      companyId: retail,
      body: { receiptId: phoneReceipt.body.id, documentDate: today, reason: "Lỗi màn hình", lines: [{ receiptLineId: phoneReceipt.body.lines[0].id, quantity: "1", serials: ["IMEI-M2"] }] },
    });
    const phoneReturned = await keeper.call("post", `/inventory/documents/${phoneReturn.body.id}/submit`, { companyId: retail });
    expect(phoneReturned.body).toMatchObject({ status: "posted" });
    expect(phoneReturned.body.lines[0]).toMatchObject({ serials: ["IMEI-M2"] });
    expect((await retailAdmin.call("get", `/inventory/documents/${phoneReturn.body.id}`, { companyId: retail })).body.lines[0].costValue).toBe("5000000");
  });
});
