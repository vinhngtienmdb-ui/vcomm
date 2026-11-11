// CONG_VIEC_08: Bán hàng – đơn bán, ngoại lệ, giữ hàng, giao hàng, trả hàng (TIEUCHI_NGHIEMTHU_87 đến 92; KICHBAN_KIEMTHU_172 trở đi).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session, grantSalesOrderManage } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let seller: Session;
let tradingSeller: Session;
let keeper: Session;
let otherKeeper: Session;
let approver: Session;
let today: string;
let warehouseId: string;
let channelId: string;
let wholesaleCustomer: string;
let retailCustomer: string;
let supplierOnly: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};

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
async function decide(requestId: string, decision: "approved" | "rejected") {
  await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Kiểm thử" } });
  await application.get(OutboxService).dispatchPending();
}
const orderBody = (lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ customerId: retailCustomer, channelId, warehouseId, orderDate: today, lines, ...extra });
const water = (quantity: string, extra: Record<string, unknown> = {}) => ({ variantId: items.water, unitId: units.THUNG, quantity, ...extra });
async function submitted(body: Record<string, unknown>) {
  const created = await seller.call("post", "/sales/orders", { companyId: retail, body });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return seller.call("post", `/sales/orders/${created.body.id}/submit`, { companyId: retail });
}
const stock = async (name: string) => (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=${name}`, { companyId: retail })).body.data[0];
async function deliver(session: Session, orderId: string, lines: Record<string, unknown>[]) {
  const created = await session.call("post", "/inventory/sales-issues", { companyId: retail, body: { orderId, documentDate: today, lines } });
  if (created.status !== 201) return created;
  return session.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail });
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  seller = await assign("banhang.vcr@vcomm.test", "Tạ Văn Bán", "salesperson", retail);
  await grantSalesOrderManage(pool, "banhang.vcr@vcomm.test", retail);
  tradingSeller = await assign("banhang.vct@vcomm.test", "Kha Thị Bán", "salesperson", trading);
  await grantSalesOrderManage(pool, "banhang.vct@vcomm.test", trading);
  keeper = await assign("thukho.ban@vcomm.test", "Đàm Văn Kho", "warehouse_keeper", retail, testIds.binhDuongWarehouse);
  otherKeeper = await assign("thukho.hcm.ban@vcomm.test", "Lò Văn Khác", "warehouse_keeper", retail, testIds.headOfficeBranch);

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } })).body.id;
  const product = async (key: string, name: string, categoryId: string, baseUnit: string, extra: Record<string, unknown> = {}) => {
    const created = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units[baseUnit], variants: [{ barcodes: [] }], ...extra },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  const drinks = await category("NUOCB");
  await product("water", "Nước suối bán", drinks, "CHAI", { units: [{ unitId: units.THUNG, factor: "24" }] });
  await product("noPrice", "Nước chưa có giá", drinks, "CHAI");
  const phones = await category("DTB", { tracksSerials: true });
  await product("phone", "Điện thoại bán", phones, "CAI", { tracksSerials: true });

  warehouseId = (await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "BDB", name: "Kho bán BD", usesLocations: false } }))
    .body.id;
  // Tồn đầu: 960 chai (40 thùng) nước giá vốn 4.000; 3 điện thoại giá vốn 5.000.000.
  const receipt = async (lines: Record<string, unknown>[]) => {
    const created = await retailAdmin.call("post", "/inventory/documents", {
      companyId: retail,
      body: { type: "receipt_other", warehouseId, companyId: retail, documentDate: today, reasonCode: "opening_balance", reason: "Tồn đầu", lines },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect((await retailAdmin.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  };
  await receipt([{ variantId: items.water, unitId: units.CHAI, quantity: "960", unitCost: "4000" }]);
  await receipt([{ variantId: items.phone, unitId: units.CAI, quantity: "3", unitCost: "5000000", serials: ["IMEI-B1", "IMEI-B2", "IMEI-B3"] }]);

  // Kênh bán, nhóm khách, bảng giá: chung gồm thuế 6.600 một chai; nhóm khách sỉ chưa thuế 5.000 một chai.
  const defaults = await retailAdmin.call("post", "/catalog/sales-channels/defaults", { companyId: retail });
  channelId = defaults.body.find((item: { code: string }) => item.code === "BAN_LE").id;
  const groupId = (await retailAdmin.call("post", "/catalog/customer-groups", { companyId: retail, body: { code: "SI", name: "Khách sỉ" } })).body.id;
  const priceList = async (code: string, extra: Record<string, unknown>) =>
    (await retailAdmin.call("post", "/catalog/price-lists", { companyId: retail, body: { code, name: code, ...extra } })).body.id;
  const general = await priceList("CHUNG", { includesVat: true });
  const wholesale = await priceList("SI", { includesVat: false, customerGroupId: groupId });
  const price = async (priceListId: string, lines: Record<string, unknown>[]) => {
    const draft = await retailAdmin.call("post", "/catalog/price-changes", { companyId: retail, body: { priceListId, effectiveFrom: today, lines } });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect((await retailAdmin.call("post", `/catalog/price-changes/${draft.body.id}/submit`, { companyId: retail })).status).toBe(201);
  };
  await price(general, [
    { variantId: items.water, unitId: units.CHAI, price: "6600" },
    { variantId: items.phone, unitId: units.CAI, price: "7700000" },
  ]);
  await price(wholesale, [{ variantId: items.water, unitId: units.CHAI, price: "5000" }]);

  const partner = async (taxCode: string, name: string, profile: Record<string, unknown>) => {
    const created = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const saved = await retailAdmin.call("put", `/crm/partners/${created.body.id}/profile`, {
      companyId: retail,
      body: { isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: null, version: 0, ...profile },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    return created.body.id as string;
  };
  wholesaleCustomer = await partner("0320000001", "Đại lý Sỉ Phú Thọ", { customerGroupId: groupId, creditLimit: "1000000" });
  retailCustomer = await partner("0320000002", "Cửa hàng Lẻ An Bình", {});
  supplierOnly = await partner("0320000003", "Nhà cung cấp không bán", { isCustomer: false, isSupplier: true });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_87: giá theo bảng giá, khách hàng", () => {
  it("KICHBAN_KIEMTHU_172: giá theo kênh, nhóm khách; mặt hàng chưa có giá, đối tác chưa là khách bị từ chối; người mua không lấy hóa đơn lập được", async () => {
    const lookup = (customerId?: string) =>
      seller.call("get", `/sales/price?${new URLSearchParams({ variantId: items.water!, unitId: units.THUNG!, channelId, ...(customerId ? { customerId } : {}) })}`, { companyId: retail });
    expect((await lookup()).body).toMatchObject({ price: "158400", priceListCode: "CHUNG", includesVat: true, vatRate: "10" });
    expect((await lookup(wholesaleCustomer)).body).toMatchObject({ price: "120000", priceListCode: "SI", includesVat: false });

    const noPrice = await seller.call("post", "/sales/orders", { companyId: retail, body: orderBody([{ variantId: items.noPrice, unitId: units.CHAI, quantity: "1" }]) });
    expect(noPrice.body.error.fields).toEqual({ "lines.0.variantId": expect.any(String) });
    const notCustomer = await seller.call("post", "/sales/orders", { companyId: retail, body: orderBody([water("1")], { customerId: supplierOnly }) });
    expect(notCustomer.body.error.fields).toEqual({ customerId: "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty." });

    // Giá gồm thuế: 2 thùng × 158.400 = 316.800 gồm thuế 10%.
    const walkIn = await seller.call("post", "/sales/orders", { companyId: retail, body: orderBody([water("2")], { customerId: null, buyerName: "Anh Tuấn" }) });
    expect(walkIn.status, JSON.stringify(walkIn.body)).toBe(201);
    expect(walkIn.body).toMatchObject({ customerId: null, buyerName: "Anh Tuấn", totalAmount: "316800", netAmount: "288000", taxAmount: "28800" });
    expect(walkIn.body.lines[0]).toMatchObject({ listPrice: "158400", priceIncludesVat: true, baseQuantity: "48" });
    // Giá chưa thuế: 1 thùng × 120.000, thuế 12.000.
    const wholesale = await seller.call("post", "/sales/orders", { companyId: retail, body: orderBody([water("1")], { customerId: wholesaleCustomer }) });
    expect(wholesale.body).toMatchObject({ netAmount: "120000", taxAmount: "12000", totalAmount: "132000" });
    // Thủ kho chỉ xem, không lập đơn.
    expect((await keeper.call("post", "/sales/orders", { companyId: retail, body: orderBody([water("1")]) })).status).toBe(403);
    expect((await keeper.call("get", `/sales/orders/${walkIn.body.id}`, { companyId: retail })).body).toMatchObject({ canEdit: false, canSubmit: false });
  });
});

describe("TIEUCHI_NGHIEMTHU_88, 89: ngoại lệ, giữ hàng", () => {
  it("KICHBAN_KIEMTHU_173: không ngoại lệ xác nhận ngay và giữ hàng; chiết khấu vượt mức, dưới giá vốn, vượt hạn mức chờ duyệt; từ chối nhả hàng giữ; không đủ hàng không gửi được", async () => {
    await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "sales.order",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    await retailAdmin.call("put", "/sales/settings", { companyId: retail, body: { maxManualDiscountPercent: "5", version: 0 } });

    const plain = await submitted(orderBody([water("2", { discountPercent: "5" })]));
    expect(plain.body).toMatchObject({ status: "confirmed", exceptions: [], documentNo: expect.stringMatching(/^DBH/) });
    expect(await stock("Nước suối bán")).toMatchObject({ onHand: "960", reserved: "48", available: "912" });

    // Chiết khấu 10% > 5%.
    const discounted = await submitted(orderBody([water("1", { discountPercent: "10" })]));
    expect(discounted.body).toMatchObject({ status: "pending", exceptions: [{ kind: "discount", lineNo: 1 }] });
    await decide(discounted.body.approvalRequestId, "approved");
    expect((await seller.call("get", `/sales/orders/${discounted.body.id}`, { companyId: retail })).body.status).toBe("confirmed");

    // Dưới giá vốn: 50% của 6.600 gồm thuế = 3.000 chưa thuế một chai < 4.000.
    await retailAdmin.call("put", "/sales/settings", { companyId: retail, body: { maxManualDiscountPercent: "60", version: 1 } });
    const belowCost = await submitted(orderBody([water("1", { discountPercent: "50" })]));
    expect(belowCost.body).toMatchObject({ status: "pending", exceptions: [{ kind: "below_cost", lineNo: 1 }] });
    // Từ chối: nhả hàng giữ của đơn.
    const beforeReject = await stock("Nước suối bán");
    await decide(belowCost.body.approvalRequestId, "rejected");
    expect((await seller.call("get", `/sales/orders/${belowCost.body.id}`, { companyId: retail })).body).toMatchObject({ status: "rejected", canEdit: true });
    expect(Number((await stock("Nước suối bán")).reserved)).toBe(Number(beforeReject.reserved) - 24);

    // Vượt hạn mức công nợ 1.000.000: 9 thùng × 132.000 gồm thuế = 1.188.000.
    const overCredit = await submitted(orderBody([water("9")], { customerId: wholesaleCustomer }));
    expect(overCredit.body).toMatchObject({ status: "pending", exceptions: [{ kind: "credit_limit", lineNo: null }] });
    await seller.call("post", `/sales/orders/${overCredit.body.id}/withdraw`, { companyId: retail });
    expect((await seller.call("get", `/sales/orders/${overCredit.body.id}`, { companyId: retail })).body.status).toBe("withdrawn");
    // Trong hạn mức: 7 thùng = 924.000.
    expect((await submitted(orderBody([water("7")], { customerId: wholesaleCustomer }))).body.status).toBe("confirmed");
    // Đơn đã xác nhận chưa giao tính vào dư nợ: thêm 1 thùng (132.000) vượt hạn mức.
    expect((await submitted(orderBody([water("1")], { customerId: wholesaleCustomer }))).body.exceptions).toEqual([expect.objectContaining({ kind: "credit_limit" })]);

    // Không đủ hàng khả dụng.
    const tooMany = await submitted(orderBody([water("50")]));
    expect(tooMany.body.error.fields).toEqual({ "lines.0.quantity": "Không đủ hàng khả dụng (một phần đang được giữ)." });

    // Hủy đơn đã xác nhận chưa giao: nhả hàng giữ.
    const reservedBefore = Number((await stock("Nước suối bán")).reserved);
    const plainNow = (await seller.call("get", `/sales/orders/${plain.body.id}`, { companyId: retail })).body;
    expect((await seller.call("post", `/sales/orders/${plain.body.id}/cancel`, { companyId: retail, body: { version: plainNow.version } })).body.status).toBe("cancelled");
    expect(Number((await stock("Nước suối bán")).reserved)).toBe(reservedBefore - 48);

    // Công ty khác không xem được đơn.
    expect((await tradingSeller.call("get", `/sales/orders/${plain.body.id}`, { companyId: trading })).status).toBe(404);
    expect((await tradingSeller.call("get", "/sales/orders", { companyId: trading })).body.total).toBe(0);
  });
});

describe("TIEUCHI_NGHIEMTHU_90, 92: giao hàng theo đơn bán", () => {
  it("KICHBAN_KIEMTHU_174: giao nhiều lần không vượt số đặt, theo giá vốn bình quân, dùng hàng đã giữ; giao đủ thì đơn đã giao đủ; đơn đã giao không hủy, chỉ đóng; thủ kho chi nhánh khác không giao", async () => {
    const order = (await submitted(orderBody([water("3")]))).body;
    expect(order.status).toBe("confirmed");
    const line = order.lines[0];
    expect((await otherKeeper.call("get", "/inventory/sales-orders", { companyId: retail })).body).toEqual([]);
    expect([403, 404]).toContain((await deliver(otherKeeper, order.id, [{ orderLineId: line.id, quantity: "1" }])).status);
    expect((await keeper.call("get", "/inventory/sales-orders", { companyId: retail })).body.map((item: { id: string }) => item.id)).toContain(order.id);

    const reservedBefore = Number((await stock("Nước suối bán")).reserved);
    const first = await deliver(keeper, order.id, [{ orderLineId: line.id, quantity: "1" }]);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ type: "sales_issue", status: "posted", documentNo: expect.stringMatching(/^XBH/), partnerName: "Cửa hàng Lẻ An Bình", sourceNo: order.documentNo });
    // Dùng phần đang giữ: giữ giảm 24, tồn giảm 24, theo giá vốn 4.000.
    const after = await stock("Nước suối bán");
    expect(Number(after.reserved)).toBe(reservedBefore - 24);
    expect((await retailAdmin.call("get", `/inventory/documents/${first.body.id}`, { companyId: retail })).body.lines[0].costValue).toBe("96000");

    // Đơn đã giao không hủy được.
    let current = (await seller.call("get", `/sales/orders/${order.id}`, { companyId: retail })).body;
    expect(current).toMatchObject({ status: "confirmed", canCancel: false, canClose: true });
    expect((await seller.call("post", `/sales/orders/${order.id}/cancel`, { companyId: retail, body: { version: current.version } })).status).toBe(409);
    // Giao quá số còn lại (2 thùng) bị từ chối.
    const over = await keeper.call("post", "/inventory/sales-issues", { companyId: retail, body: { orderId: order.id, documentDate: today, lines: [{ orderLineId: line.id, quantity: "3" }] } });
    expect(over.body.error.fields).toEqual({ "lines.0.quantity": "Vượt số còn phải giao của đơn bán." });
    expect((await deliver(keeper, order.id, [{ orderLineId: line.id, quantity: "2" }])).status).toBe(201);
    current = (await seller.call("get", `/sales/orders/${order.id}`, { companyId: retail })).body;
    expect(current).toMatchObject({ status: "delivered" });
    expect(current.lines[0].deliveredBaseQuantity).toBe("72");
    expect(current.documents).toHaveLength(2);
    expect((await deliver(keeper, order.id, [{ orderLineId: line.id, quantity: "1" }])).status).toBe(409);

    // Đóng đơn giao một phần: nhả phần giữ còn lại; không giao thêm được.
    const partial = (await submitted(orderBody([water("2")]))).body;
    expect((await deliver(keeper, partial.id, [{ orderLineId: partial.lines[0].id, quantity: "1" }])).status).toBe(201);
    const reservedMid = Number((await stock("Nước suối bán")).reserved);
    const partialNow = (await seller.call("get", `/sales/orders/${partial.id}`, { companyId: retail })).body;
    expect((await seller.call("post", `/sales/orders/${partial.id}/close`, { companyId: retail, body: { reason: "Khách đổi ý", version: partialNow.version } })).body.status).toBe("closed");
    expect(Number((await stock("Nước suối bán")).reserved)).toBe(reservedMid - 24);
    expect((await deliver(keeper, partial.id, [{ orderLineId: partial.lines[0].id, quantity: "1" }])).status).toBe(409);
    // Đơn chưa xác nhận không giao được.
    const draft = await seller.call("post", "/sales/orders", { companyId: retail, body: orderBody([water("1")]) });
    expect((await deliver(keeper, draft.body.id, [{ orderLineId: draft.body.lines[0].id, quantity: "1" }])).status).toBe(409);
    // Không lập phiếu xuất giao hàng bằng màn hình phiếu kho thường.
    const manual = await keeper.call("post", "/inventory/documents", {
      companyId: retail,
      body: { type: "sales_issue", warehouseId, companyId: retail, documentDate: today, reasonCode: "sale", reason: "Thử", lines: [{ variantId: items.water, unitId: units.CHAI, quantity: "1" }] },
    });
    expect(manual.status).toBe(400);
  });
});

describe("TIEUCHI_NGHIEMTHU_91: nhận hàng trả lại", () => {
  it("KICHBAN_KIEMTHU_175: nhập lại theo giá vốn phiếu xuất gốc; trả quá số đã giao, serial chưa giao bị từ chối", async () => {
    const order = (await submitted(orderBody([{ variantId: items.phone, unitId: units.CAI, quantity: "2" }]))).body;
    expect(order.status).toBe("confirmed");
    const issued = await deliver(keeper, order.id, [{ orderLineId: order.lines[0].id, quantity: "2", serials: ["IMEI-B1", "IMEI-B2"] }]);
    expect(issued.body.status, JSON.stringify(issued.body)).toBe("posted");
    const issueLine = issued.body.lines[0];

    const over = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issued.body.id, documentDate: today, reason: "Khách trả", lines: [{ issueLineId: issueLine.id, quantity: "3", serials: ["IMEI-B1", "IMEI-B2", "IMEI-B3"] }] },
    });
    expect(Object.keys(over.body.error.fields)).toContain("lines.0.serials");
    const wrongSerial = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issued.body.id, documentDate: today, reason: "Khách trả", lines: [{ issueLineId: issueLine.id, quantity: "1", serials: ["IMEI-B3"] }] },
    });
    expect(wrongSerial.body.error.fields).toEqual({ "lines.0.serials": expect.any(String) });

    const returned = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issued.body.id, documentDate: today, reason: "Lỗi màn hình", lines: [{ issueLineId: issueLine.id, quantity: "1", serials: ["IMEI-B2"] }] },
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    const posted = await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail });
    expect(posted.body).toMatchObject({ type: "sales_return", status: "posted", documentNo: expect.stringMatching(/^NTL/), sourceNo: issued.body.documentNo });
    expect((await retailAdmin.call("get", `/inventory/documents/${returned.body.id}`, { companyId: retail })).body.lines[0].costValue).toBe("5000000");
    expect(await stock("Điện thoại bán")).toMatchObject({ onHand: "2" });
    expect((await seller.call("get", `/sales/orders/${order.id}`, { companyId: retail })).body.lines[0].returnedBaseQuantity).toBe("1");

    // Trả lại serial đã trả: không còn để trả.
    const again = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issued.body.id, documentDate: today, reason: "Trả tiếp", lines: [{ issueLineId: issueLine.id, quantity: "2", serials: ["IMEI-B1", "IMEI-B2"] }] },
    });
    const againSubmit = again.status === 201 ? await keeper.call("post", `/inventory/documents/${again.body.id}/submit`, { companyId: retail }) : again;
    expect(againSubmit.status).toBe(400);
  });
});

describe("TIEUCHI_NGHIEMTHU_88, 91: trả một phần theo đơn vị cơ sở, gửi đồng thời, che giá vốn", () => {
  it("KICHBAN_KIEMTHU_183: giao 1 thùng trả 5 chai; hai phiếu trả gửi cùng lúc không vượt số đã giao; nhân viên bán hàng không thấy giá vốn trong ngoại lệ; kho không xem đơn chưa xác nhận", async () => {
    const order = (await submitted(orderBody([water("1")]))).body;
    const issued = await deliver(keeper, order.id, [{ orderLineId: order.lines[0].id, quantity: "1" }]);
    expect(issued.body.status, JSON.stringify(issued.body)).toBe("posted");
    const issueLine = issued.body.lines[0];
    const draftReturn = async (quantity: string) => {
      const created = await keeper.call("post", "/inventory/sales-returns", {
        companyId: retail,
        body: { issueId: issued.body.id, documentDate: today, reason: "Khách trả", lines: [{ issueLineId: issueLine.id, quantity, serials: [] }] },
      });
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      return created.body.id as string;
    };
    // Trả 5 chai của thùng 24 chai: nhập lại 5 chai theo giá vốn 4.000.
    const partial = await draftReturn("5");
    expect((await keeper.call("post", `/inventory/documents/${partial}/submit`, { companyId: retail })).body.status).toBe("posted");
    const partialLine = (await retailAdmin.call("get", `/inventory/documents/${partial}`, { companyId: retail })).body.lines[0];
    expect(partialLine).toMatchObject({ quantity: "5", baseQuantity: "5", costValue: "20000" });

    // Còn 19 chai trả được: hai phiếu 15 chai gửi cùng lúc, chỉ một phiếu ghi sổ.
    const [first, second] = [await draftReturn("15"), await draftReturn("15")];
    const results = await Promise.all([first, second].map((id) => keeper.call("post", `/inventory/documents/${id}/submit`, { companyId: retail })));
    expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
    expect((await seller.call("get", `/sales/orders/${order.id}`, { companyId: retail })).body.lines[0].returnedBaseQuantity).toBe("20");

    // Ngoại lệ dưới giá vốn: người có quyền xem giá vốn thấy chi tiết, nhân viên bán hàng không thấy.
    const belowCost = await submitted(orderBody([water("1", { discountPercent: "50" })]));
    expect(belowCost.body.exceptions).toEqual([{ kind: "below_cost", lineNo: 1, detail: "" }]);
    expect((await retailAdmin.call("get", `/sales/orders/${belowCost.body.id}`, { companyId: retail })).body.exceptions[0].detail).toMatch(/</);

    // Kho không xem dòng đơn chưa xác nhận.
    const draft = await seller.call("post", "/sales/orders", { companyId: retail, body: orderBody([water("1")]) });
    expect((await keeper.call("get", `/inventory/sales-orders/${draft.body.id}`, { companyId: retail })).status).toBe(404);
    expect((await keeper.call("get", `/inventory/sales-orders/${order.id}`, { companyId: retail })).status).toBe(200);
  });
});

describe("TIEUCHI_NGHIEMTHU_88: dư nợ tạm tính trừ hàng khách trả", () => {
  it("KICHBAN_KIEMTHU_184: đã giao tính vào dư nợ; hàng khách trả được trừ; đơn chờ duyệt không tính", async () => {
    const created = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Cửa hàng Hạn mức", taxCode: "0320000004" } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const customerId = created.body.id as string;
    const profile = await retailAdmin.call("put", `/crm/partners/${customerId}/profile`, {
      companyId: retail,
      body: { isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: "250000", version: 0 },
    });
    expect(profile.status, JSON.stringify(profile.body)).toBe(200);

    // Giao 1 thùng (24 chai × 6.600 = 158.400 gồm thuế).
    const first = (await submitted(orderBody([water("1")], { customerId }))).body;
    expect(first.status).toBe("confirmed");
    const issued = await deliver(keeper, first.id, [{ orderLineId: first.lines[0].id, quantity: "1" }]);
    expect(issued.body.status, JSON.stringify(issued.body)).toBe("posted");
    // Thêm 1 thùng: 316.800 > 250.000; đơn này chờ duyệt, không tính vào dư nợ của đơn sau.
    const over = (await submitted(orderBody([water("1")], { customerId }))).body;
    expect(over).toMatchObject({ status: "pending", exceptions: [expect.objectContaining({ kind: "credit_limit" })] });
    // Khách trả 12 chai (79.200): dư nợ còn 79.200; thêm 1 thùng thành 237.600, trong hạn mức.
    const returned = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: issued.body.id, documentDate: today, reason: "Khách trả", lines: [{ issueLineId: issued.body.lines[0].id, quantity: "12", serials: [] }] },
    });
    expect(returned.status, JSON.stringify(returned.body)).toBe(201);
    expect((await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    expect((await submitted(orderBody([water("1")], { customerId }))).body).toMatchObject({ status: "confirmed", exceptions: [] });
  });
});
