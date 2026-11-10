// CONG_VIEC_09: Giao dịch nội bộ giữa công ty con (TIEUCHI_NGHIEMTHU_93 đến 98; KICHBAN_KIEMTHU_185 trở đi).
// Công ty bán: VComm Bán lẻ (VCR); công ty mua: VComm Thương mại (VCT). Một hộp bên VCT bằng 12 cái bên VCR.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let keeper: Session;
let tradingSeller: Session;
let today: string;
let sellerWarehouse: string;
let buyerWarehouse: string;
let internalChannelId: string;
let retailChannelId: string;
let retailAsPartner: string;
let tradingAsPartner: string;
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
const sell = (session: Session, path: string, body?: unknown, method: "get" | "post" | "put" = body === undefined ? "get" : "post") => session.call(method, path, { companyId: retail, body });
const buy = (session: Session, path: string, body?: unknown, method: "get" | "post" | "put" | "patch" = body === undefined ? "get" : "post") =>
  session.call(method, path, { companyId: trading, body });
const salesBody = (quantity: string, extra: Record<string, unknown> = {}) => ({
  customerId: tradingAsPartner,
  channelId: internalChannelId,
  warehouseId: sellerWarehouse,
  orderDate: today,
  lines: [{ variantId: items.retailBiscuit, unitId: units.CAI, quantity, discountPercent: "0" }],
  ...extra,
});
const purchaseBody = (quantity: string, extra: Record<string, unknown> = {}) => ({
  supplierId: retailAsPartner,
  warehouseId: buyerWarehouse,
  orderDate: today,
  lines: [{ variantId: items.tradingBiscuit, unitId: units.HOP, quantity, unitPrice: "1", vatRate: "0" }],
  ...extra,
});
const reserved = async () => Number((await sell(retailAdmin, `/inventory/stock?warehouseId=${sellerWarehouse}&onlyInStock=false&search=${encodeURIComponent("Bánh nội bộ")}`)).body.data[0].reserved);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  keeper = await assign("thukho.noibo@vcomm.test", "Mạc Văn Kho", "warehouse_keeper", retail, testIds.binhDuongWarehouse);
  tradingSeller = await assign("banhang.vct.noibo@vcomm.test", "Ông Thị Bán", "salesperson", trading);

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (companyId: string, code: string) => groupAdmin.call("post", "/catalog/categories", { companyId, body: { code, nameVi: code, nameEn: code } });
  const categoryId = (await category(retail, "BANHNB")).body.id;
  const serialCategoryId = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "MAYNB", nameVi: "MAYNB", nameEn: "MAYNB", tracksSerials: true } })).body.id;
  const product = async (key: string, companyId: string, name: string, baseUnit: string, serial = false) => {
    const created = await groupAdmin.call("post", "/catalog/products", {
      companyId,
      body: {
        categoryId: serial ? serialCategoryId : categoryId,
        name,
        vatRate: "10",
        tracksLots: false,
        tracksSerials: serial,
        warrantyMonths: 0,
        baseUnitId: units[baseUnit],
        variants: [{ barcodes: [] }],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("retailBiscuit", retail, "Bánh nội bộ", "CAI");
  await product("retailUnlinked", retail, "Bánh chưa liên kết", "CAI");
  await product("tradingBiscuit", trading, "Bánh nội bộ hộp", "HOP");
  await product("retailMachine", retail, "Máy nội bộ", "CAI", true);
  await product("tradingMachine", trading, "Máy nội bộ nhận", "CAI", true);
  expect((await groupAdmin.call("post", "/catalog/variant-links", { companyId: retail, body: { variantId: items.retailMachine, linkedVariantId: items.tradingMachine, factor: "1" } })).status).toBe(
    201,
  );
  // Một hộp bên VCT bằng 12 cái bên VCR.
  const link = await groupAdmin.call("post", "/catalog/variant-links", { companyId: trading, body: { variantId: items.tradingBiscuit, linkedVariantId: items.retailBiscuit, factor: "12" } });
  expect(link.status, JSON.stringify(link.body)).toBe(201);

  sellerWarehouse = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "NBB", name: "Kho bán nội bộ", usesLocations: false } })
  ).body.id;
  buyerWarehouse = (
    await retailAdmin.call("post", "/inventory/warehouses", {
      companyId: retail,
      body: { branchId: testIds.binhDuongWarehouse, code: "NBM", name: "Kho nhận VCT", usesLocations: false, ownerCompanyIds: [trading] },
    })
  ).body.id;
  const receipt = await retailAdmin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "receipt_other",
      warehouseId: sellerWarehouse,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [
        { variantId: items.retailBiscuit, unitId: units.CAI, quantity: "500", unitCost: "6000" },
        { variantId: items.retailUnlinked, unitId: units.CAI, quantity: "10", unitCost: "6000" },
        { variantId: items.retailMachine, unitId: units.CAI, quantity: "3", unitCost: "2000000", serials: ["MAY-01", "MAY-02", "MAY-03"] },
      ],
    },
  });
  expect((await retailAdmin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");

  // Kênh Nội bộ của VCR, bảng giá Nội bộ chưa thuế 10.000 một cái; bảng giá chung bán lẻ.
  const channels = (await retailAdmin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  internalChannelId = channels.find((channel) => channel.code === "NOI_BO")!.id;
  retailChannelId = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const priceList = async (code: string, extra: Record<string, unknown>) =>
    (await retailAdmin.call("post", "/catalog/price-lists", { companyId: retail, body: { code, name: code, ...extra } })).body.id as string;
  const price = async (priceListId: string, lines: Record<string, unknown>[]) => {
    const draft = await retailAdmin.call("post", "/catalog/price-changes", { companyId: retail, body: { priceListId, effectiveFrom: today, lines } });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect((await retailAdmin.call("post", `/catalog/price-changes/${draft.body.id}/submit`, { companyId: retail })).status).toBe(201);
  };
  await price(await priceList("NB", { includesVat: false, channelId: internalChannelId }), [
    { variantId: items.retailBiscuit, unitId: units.CAI, price: "10000" },
    { variantId: items.retailUnlinked, unitId: units.CAI, price: "10000" },
    { variantId: items.retailMachine, unitId: units.CAI, price: "3000000" },
  ]);
  await price(await priceList("LE", { includesVat: true }), [{ variantId: items.retailBiscuit, unitId: units.CAI, price: "15000" }]);

  // Đối tác nội bộ tự đồng bộ khi khởi động; hồ sơ khách hàng ở VCR, nhà cung cấp ở VCT.
  const partnerOf = async (companyId: string) => (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [companyId])).rows[0]!.id;
  retailAsPartner = await partnerOf(retail);
  tradingAsPartner = await partnerOf(trading);
  const profile = async (companyId: string, partnerId: string, body: Record<string, unknown>) => {
    const saved = await groupAdmin.call("put", `/crm/partners/${partnerId}/profile`, {
      companyId,
      body: { isCustomer: false, isSupplier: false, paymentTermDays: 30, creditLimit: null, version: 0, ...body },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  };
  await profile(retail, tradingAsPartner, { isCustomer: true });
  await profile(trading, retailAsPartner, { isSupplier: true });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_93: đơn bán nội bộ sinh đơn mua đối ứng", () => {
  it("KICHBAN_KIEMTHU_185: kênh Nội bộ, mặt hàng liên kết; xác nhận sinh đơn mua chờ xác nhận đúng mặt hàng, số lượng, giá; chưa duyệt đơn mua thì chưa giao; bên mua xác nhận chọn kho", async () => {
    // Sai kênh, mặt hàng chưa liên kết bị từ chối.
    const wrongChannel = await sell(retailAdmin, "/sales/orders", salesBody("24", { channelId: retailChannelId }));
    expect(wrongChannel.body.error.fields).toEqual({ channelId: "Đơn bán cho công ty con phải dùng kênh bán Nội bộ." });
    const unlinked = await sell(retailAdmin, "/sales/orders", salesBody("1", { lines: [{ variantId: items.retailUnlinked, unitId: units.CAI, quantity: "1", discountPercent: "0" }] }));
    expect(unlinked.body.error.fields).toEqual({ "lines.0.variantId": "Mặt hàng chưa liên kết với sản phẩm của công ty bên kia." });

    // 24 cái × 10.000 = 240.000 chưa thuế: đơn mua đối ứng 2 hộp × 120.000, thuế 10%.
    const created = await sell(retailAdmin, "/sales/orders", salesBody("24"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const confirmed = (await sell(retailAdmin, `/sales/orders/${created.body.id}/submit`, {})).body;
    expect(confirmed).toMatchObject({ status: "confirmed", isInternal: true, isCounterpart: false, counterpart: { companyName: "VComm Thương mại", documentNo: null, status: "counterpart_pending" } });
    const purchaseId = (await pool.query<{ id: string }>("SELECT id FROM purchasing.orders WHERE counterpart_order_id = $1", [created.body.id])).rows[0]!.id;
    const pending = (await buy(groupAdmin, `/purchasing/orders/${purchaseId}`)).body;
    expect(pending).toMatchObject({
      status: "counterpart_pending",
      supplierName: "Công ty Cổ phần VComm Bán lẻ Miền Nam",
      warehouseId: null,
      isInternal: true,
      isCounterpart: true,
      canConfirmCounterpart: true,
      canEdit: false,
      canSubmit: false,
      totalAmount: "240000",
      taxAmount: "24000",
      counterpart: { companyName: "VComm Bán lẻ Miền Nam", documentNo: confirmed.documentNo },
    });
    expect(pending.lines).toEqual([expect.objectContaining({ variantId: items.tradingBiscuit, unitId: units.HOP, quantity: "2", unitPrice: "120000", vatRate: "10" })]);

    // Chưa duyệt đơn mua đối ứng thì chưa giao.
    const early = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: { orderId: created.body.id, documentDate: today, lines: [{ orderLineId: confirmed.lines[0].id, quantity: "1" }] },
    });
    expect(early.status).toBe(409);
    expect(early.body.error.message).toBe("Đơn mua đối ứng của công ty mua chưa được duyệt, chưa giao được.");

    // Bên mua sửa đơn đối ứng bị từ chối; xác nhận chọn kho nhận, chưa có chính sách duyệt thì duyệt ngay.
    expect((await buy(groupAdmin, `/purchasing/orders/${purchaseId}`, { ...purchaseBody("5"), version: pending.version }, "patch")).status).toBe(409);
    const approved = await buy(groupAdmin, `/purchasing/orders/${purchaseId}/counterpart-confirm`, { warehouseId: buyerWarehouse, version: pending.version });
    expect(approved.body).toMatchObject({ status: "approved", warehouseId: buyerWarehouse, documentNo: expect.stringMatching(/^DMH/) });
    const issue = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: { orderId: created.body.id, documentDate: today, lines: [{ orderLineId: confirmed.lines[0].id, quantity: "1" }] },
    });
    expect(issue.status, JSON.stringify(issue.body)).toBe(201);
  });
});

describe("TIEUCHI_NGHIEMTHU_94: đơn mua nội bộ sinh đơn bán đối ứng", () => {
  it("KICHBAN_KIEMTHU_186: giá theo bảng giá Nội bộ bên bán, không sửa tay; duyệt sinh đơn bán chờ xác nhận; bên bán xác nhận giữ hàng; từ chối thì đơn mua đóng", async () => {
    const lookup = await buy(groupAdmin, `/purchasing/supplier-prices/lookup?supplierId=${retailAsPartner}&variantId=${items.tradingBiscuit}&unitId=${units.HOP}`);
    expect(lookup.body).toEqual({ unitPrice: "120000.0000", priceId: null, internal: { vatRate: "10" } });

    // Giá nhập tay 1 bị thay bằng 120.000 một hộp.
    const created = await buy(groupAdmin, "/purchasing/orders", purchaseBody("3"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.lines[0]).toMatchObject({ unitPrice: "120000", vatRate: "10" });
    const approved = (await buy(groupAdmin, `/purchasing/orders/${created.body.id}/submit`, {})).body;
    expect(approved).toMatchObject({ status: "approved", isInternal: true, canEdit: false, counterpart: { companyName: "VComm Bán lẻ Miền Nam", status: "counterpart_pending" } });

    const salesId = (await pool.query<{ id: string }>("SELECT id FROM sales.orders WHERE counterpart_order_id = $1", [created.body.id])).rows[0]!.id;
    const pending = (await sell(retailAdmin, `/sales/orders/${salesId}`)).body;
    expect(pending).toMatchObject({ status: "counterpart_pending", warehouseId: null, isCounterpart: true, canConfirmCounterpart: true, canEdit: false, canCancel: false, netAmount: "360000" });
    expect(pending.lines).toEqual([expect.objectContaining({ variantId: items.retailBiscuit, unitId: units.CAI, quantity: "36", listPrice: "10000" })]);

    const before = await reserved();
    const confirmed = await sell(retailAdmin, `/sales/orders/${salesId}/counterpart-confirm`, { warehouseId: sellerWarehouse, version: pending.version });
    expect(confirmed.body).toMatchObject({ status: "confirmed", documentNo: expect.stringMatching(/^DBH/), warehouseId: sellerWarehouse });
    expect((await reserved()) - before).toBe(36);
    // Đơn bán đối ứng đã xác nhận: giao được ngay vì đơn mua khởi tạo đã duyệt.
    const issue = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: { orderId: salesId, documentDate: today, lines: [{ orderLineId: confirmed.body.lines[0].id, quantity: "1" }] },
    });
    expect(issue.status, JSON.stringify(issue.body)).toBe(201);

    // Bên bán từ chối đơn đối ứng khác: đơn mua đóng kèm lý do.
    const second = await buy(groupAdmin, "/purchasing/orders", purchaseBody("1"));
    await buy(groupAdmin, `/purchasing/orders/${second.body.id}/submit`, {});
    const secondSales = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM sales.orders WHERE counterpart_order_id = $1", [second.body.id])).rows[0]!;
    expect((await sell(retailAdmin, `/sales/orders/${secondSales.id}/counterpart-reject`, { reason: "Hết hàng", version: secondSales.version })).body).toMatchObject({
      status: "cancelled",
      counterpartRejectedReason: "Hết hàng",
    });
    expect((await buy(groupAdmin, `/purchasing/orders/${second.body.id}`)).body).toMatchObject({ status: "closed", closedReason: "Bên bán từ chối: Hết hàng" });
  });
});

describe("TIEUCHI_NGHIEMTHU_97: hủy, đóng hai bên; phân quyền", () => {
  it("KICHBAN_KIEMTHU_187: bên mua từ chối thì đơn bán hủy, nhả hàng giữ; bên bán hủy thì đơn mua đóng; đóng đơn mua thì đơn bán đã giao một phần đóng; công ty khác, người không có quyền không xem, không xác nhận được", async () => {
    // Bên mua từ chối: đơn bán khởi tạo hủy, nhả 12 cái đang giữ.
    const first = (await sell(retailAdmin, "/sales/orders", salesBody("12"))).body;
    const before = await reserved();
    await sell(retailAdmin, `/sales/orders/${first.id}/submit`, {});
    expect((await reserved()) - before).toBe(12);
    const firstPurchase = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM purchasing.orders WHERE counterpart_order_id = $1", [first.id])).rows[0]!;
    // Nhân viên bán hàng VCT không có quyền quản lý đơn mua.
    expect((await buy(tradingSeller, `/purchasing/orders/${firstPurchase.id}/counterpart-reject`, { reason: "Không cần", version: firstPurchase.version })).status).toBe(403);
    // Công ty bán không xem được đơn mua của công ty mua.
    expect((await sell(retailAdmin, `/purchasing/orders/${firstPurchase.id}`)).status).toBe(404);
    expect((await buy(groupAdmin, `/purchasing/orders/${firstPurchase.id}/counterpart-reject`, { reason: "Không cần", version: firstPurchase.version })).body.status).toBe("closed");
    expect((await sell(retailAdmin, `/sales/orders/${first.id}`)).body).toMatchObject({ status: "cancelled", closedReason: "Bên mua từ chối: Không cần" });
    expect(await reserved()).toBe(before);

    // Bên bán hủy đơn đã xác nhận chưa giao: đơn mua đối ứng đang chờ xác nhận đóng theo.
    const second = (await sell(retailAdmin, "/sales/orders", salesBody("12"))).body;
    const secondNow = (await sell(retailAdmin, `/sales/orders/${second.id}/submit`, {})).body;
    expect((await sell(retailAdmin, `/sales/orders/${second.id}/cancel`, { version: secondNow.version })).body.status).toBe("cancelled");
    const secondPurchase = (await pool.query<{ status: string; closed_reason: string }>("SELECT status, closed_reason FROM purchasing.orders WHERE counterpart_order_id = $1", [second.id])).rows[0];
    expect(secondPurchase).toEqual({ status: "closed", closed_reason: "Bên bán hủy đơn bán đối ứng" });

    // Đóng đơn mua khởi tạo khi đơn bán đối ứng đã giao một phần: đơn bán đóng, nhả phần giữ còn lại.
    const purchase = (await buy(groupAdmin, "/purchasing/orders", purchaseBody("2"))).body;
    await buy(groupAdmin, `/purchasing/orders/${purchase.id}/submit`, {});
    const sales = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM sales.orders WHERE counterpart_order_id = $1", [purchase.id])).rows[0]!;
    const salesNow = (await sell(retailAdmin, `/sales/orders/${sales.id}/counterpart-confirm`, { warehouseId: sellerWarehouse, version: sales.version })).body;
    const delivered = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: { orderId: sales.id, documentDate: today, lines: [{ orderLineId: salesNow.lines[0].id, quantity: "12" }] },
    });
    // Còn phiếu xuất nháp thì bên mua chưa đóng được.
    const purchaseNow = (await buy(groupAdmin, `/purchasing/orders/${purchase.id}`)).body;
    expect((await buy(groupAdmin, `/purchasing/orders/${purchase.id}/close`, { reason: "Đủ dùng", version: purchaseNow.version })).status).toBe(409);
    expect((await keeper.call("post", `/inventory/documents/${delivered.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    const beforeClose = await reserved();
    expect((await buy(groupAdmin, `/purchasing/orders/${purchase.id}/close`, { reason: "Đủ dùng", version: purchaseNow.version })).body.status).toBe("closed");
    expect((await sell(retailAdmin, `/sales/orders/${sales.id}`)).body).toMatchObject({ status: "closed", closedReason: "Bên mua đóng đơn mua đối ứng: Đủ dùng" });
    expect(await reserved()).toBe(beforeClose - 12);
  });
});

// Bán nội bộ đã có đơn mua đối ứng được duyệt; trả về đơn bán và phiếu xuất đã ghi sổ.
async function shipped(lines: { variantId: string | undefined; quantity: string; serials?: string[] }[]) {
  const created = await sell(
    retailAdmin,
    "/sales/orders",
    salesBody("1", { lines: lines.map((line) => ({ variantId: line.variantId, unitId: units.CAI, quantity: line.quantity, discountPercent: "0" })) }),
  );
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const order = (await sell(retailAdmin, `/sales/orders/${created.body.id}/submit`, {})).body;
  const purchase = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM purchasing.orders WHERE counterpart_order_id = $1", [order.id])).rows[0]!;
  expect((await buy(groupAdmin, `/purchasing/orders/${purchase.id}/counterpart-confirm`, { warehouseId: buyerWarehouse, version: purchase.version })).body.status).toBe("approved");
  const draft = await keeper.call("post", "/inventory/sales-issues", {
    companyId: retail,
    body: {
      orderId: order.id,
      documentDate: today,
      lines: lines.map((line, index) => ({ orderLineId: order.lines[index].id, quantity: line.quantity, serials: line.serials ?? [] })),
    },
  });
  expect(draft.status, JSON.stringify(draft.body)).toBe(201);
  const issue = (await keeper.call("post", `/inventory/documents/${draft.body.id}/submit`, { companyId: retail })).body;
  expect(issue.status, JSON.stringify(issue)).toBe("posted");
  const receiptId = (await pool.query<{ id: string }>("SELECT id FROM inventory.documents WHERE counterpart_document_id = $1", [issue.id])).rows[0]!.id;
  return { order, purchaseId: purchase.id, issue, receipt: (await buy(groupAdmin, `/inventory/documents/${receiptId}`)).body };
}
const tradingStock = async (name: string) => (await buy(groupAdmin, `/inventory/stock?warehouseId=${buyerWarehouse}&onlyInStock=false&search=${encodeURIComponent(name)}`)).body.data[0];

describe("TIEUCHI_NGHIEMTHU_95: xuất giao hàng nội bộ sinh phiếu nhập chờ nhận", () => {
  it("KICHBAN_KIEMTHU_188: phiếu nhập chờ nhận đúng mặt hàng, số lượng, đơn giá, serial; nhận vượt, serial không xuất bị từ chối; nhận đủ thì đơn mua nhận đủ", async () => {
    const { purchaseId, issue, receipt } = await shipped([
      { variantId: items.retailBiscuit, quantity: "24" },
      { variantId: items.retailMachine, quantity: "2", serials: ["MAY-01", "MAY-02"] },
    ]);
    expect(receipt).toMatchObject({
      type: "purchase_receipt",
      status: "in_transit",
      companyId: trading,
      warehouseId: buyerWarehouse,
      canReceiveInternal: true,
      internalReceipt: {
        issueDocumentNo: issue.documentNo,
        sellerCompanyName: "VComm Bán lẻ Miền Nam",
        lines: [
          { lineId: receipt.lines[0].id, shippedBaseQuantity: "2", shippedSerials: [] },
          { lineId: receipt.lines[1].id, shippedBaseQuantity: "2", shippedSerials: ["MAY-01", "MAY-02"] },
        ],
      },
    });
    expect(receipt.lines[0]).toMatchObject({ variantId: items.tradingBiscuit, unitId: units.HOP, quantity: "2", unitCost: "120000" });
    // Người không có quyền nhập mua tại kho nhận không nhận được.
    const forbidden = await tradingSeller.call("post", `/inventory/internal-receipts/${receipt.id}/receive`, {
      companyId: trading,
      body: { lines: receipt.lines.map((line: { id: string }) => ({ lineId: line.id, receivedQuantity: "1" })), version: receipt.version },
    });
    expect([403, 404]).toContain(forbidden.status);
    const receive = (lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
      buy(groupAdmin, `/inventory/internal-receipts/${receipt.id}/receive`, { lines, version: receipt.version, ...extra });
    const over = await receive([
      { lineId: receipt.lines[0].id, receivedQuantity: "3" },
      { lineId: receipt.lines[1].id, receivedQuantity: "2", serials: ["MAY-01", "MAY-03"] },
    ]);
    expect(over.body.error.fields).toEqual({ "lines.0.receivedQuantity": "Số nhận vượt số đã xuất.", "lines.1.serials": "Serial không có trong phiếu xuất gốc." });
    const received = await receive([
      { lineId: receipt.lines[0].id, receivedQuantity: "2" },
      { lineId: receipt.lines[1].id, receivedQuantity: "2", serials: ["MAY-01", "MAY-02"] },
    ]);
    expect(received.body).toMatchObject({ status: "posted", documentNo: expect.stringMatching(/^NM/), canReceiveInternal: false });
    expect(await tradingStock("Bánh nội bộ hộp")).toMatchObject({ onHand: "2" });
    expect(await tradingStock("Máy nội bộ nhận")).toMatchObject({ onHand: "2" });
    expect((await buy(groupAdmin, `/purchasing/orders/${purchaseId}`)).body).toMatchObject({ status: "received" });
    // Nhận lần nữa bị từ chối.
    expect((await receive([{ lineId: receipt.lines[0].id, receivedQuantity: "2" }])).status).toBe(409);
  });
});

describe("TIEUCHI_NGHIEMTHU_96: biên bản chênh lệch nội bộ", () => {
  it("KICHBAN_KIEMTHU_189: nhận thiếu phải ghi lý do, sinh biên bản ở công ty bán; nhập lại kho ghi sổ phiếu trả; ghi tổn thất đóng biên bản; mỗi biên bản xử lý một lần", async () => {
    const first = await shipped([{ variantId: items.retailBiscuit, quantity: "24" }]);
    const receiveFirst = (extra: Record<string, unknown>) =>
      buy(groupAdmin, `/inventory/internal-receipts/${first.receipt.id}/receive`, {
        lines: [{ lineId: first.receipt.lines[0].id, receivedQuantity: "1" }],
        version: first.receipt.version,
        ...extra,
      });
    expect((await receiveFirst({})).body.error.fields).toEqual({ shortageReason: "Nhận thiếu phải ghi lý do." });
    expect((await receiveFirst({ shortageReason: "Rách thùng" })).body.status).toBe("posted");

    // Công ty mua không thấy biên bản của công ty bán; thủ kho công ty bán thấy, giá trị theo giá vốn phiếu xuất.
    expect((await buy(groupAdmin, "/inventory/internal-discrepancies")).body).toEqual([]);
    const list = (await keeper.call("get", "/inventory/internal-discrepancies?status=open", { companyId: retail })).body;
    expect(list).toEqual([
      expect.objectContaining({
        issueDocumentNo: first.issue.documentNo,
        buyerCompanyName: "VComm Thương mại",
        sku: expect.any(String),
        shortageBaseQuantity: "12",
        value: null,
        reason: "Rách thùng",
        status: "open",
        canResolve: true,
      }),
    ]);
    // Giá trị chỉ hiện cho người xem được giá vốn.
    expect((await sell(retailAdmin, "/inventory/internal-discrepancies?status=open")).body[0].value).toBe("72000");
    const before = Number((await sell(retailAdmin, `/inventory/stock?warehouseId=${sellerWarehouse}&onlyInStock=false&search=${encodeURIComponent("Bánh nội bộ")}`)).body.data[0].onHand);
    const resolved = await keeper.call("post", `/inventory/internal-discrepancies/${list[0].id}/resolve`, {
      companyId: retail,
      body: { action: "return", note: "Hàng về lại kho", version: list[0].version },
    });
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(201);
    const returnedItem = resolved.body.find((item: { id: string }) => item.id === list[0].id);
    expect(returnedItem).toMatchObject({ status: "returned", returnDocumentId: expect.any(String), canResolve: false });
    expect((await sell(retailAdmin, `/inventory/documents/${returnedItem.returnDocumentId}`)).body).toMatchObject({ type: "sales_return", status: "posted" });
    expect(Number((await sell(retailAdmin, `/inventory/stock?warehouseId=${sellerWarehouse}&onlyInStock=false&search=${encodeURIComponent("Bánh nội bộ")}`)).body.data[0].onHand)).toBe(before + 12);
    // Xử lý lần nữa bị từ chối.
    expect(
      (await keeper.call("post", `/inventory/internal-discrepancies/${list[0].id}/resolve`, { companyId: retail, body: { action: "write_off", note: null, version: list[0].version } })).status,
    ).toBe(409);

    // Không nhận được gì của máy có serial: biên bản giữ serial chưa nhận; ghi tổn thất.
    const second = await shipped([{ variantId: items.retailMachine, quantity: "1", serials: ["MAY-03"] }]);
    const nothing = await buy(groupAdmin, `/inventory/internal-receipts/${second.receipt.id}/receive`, {
      lines: [{ lineId: second.receipt.lines[0].id, receivedQuantity: "0" }],
      shortageReason: "Thất lạc",
      version: second.receipt.version,
    });
    expect(nothing.body).toMatchObject({ status: "posted", lines: [] });
    const lost = (await keeper.call("get", "/inventory/internal-discrepancies?status=open", { companyId: retail })).body;
    expect(lost).toEqual([expect.objectContaining({ shortageBaseQuantity: "1", serials: ["MAY-03"] })]);
    expect((await sell(retailAdmin, "/inventory/internal-discrepancies?status=open")).body[0].value).toBe("2000000");
    const written = await keeper.call("post", `/inventory/internal-discrepancies/${lost[0].id}/resolve`, {
      companyId: retail,
      body: { action: "write_off", note: "Ghi tổn thất", version: lost[0].version },
    });
    expect(written.body.find((item: { id: string }) => item.id === lost[0].id)).toMatchObject({ status: "written_off", resolutionNote: "Ghi tổn thất", returnDocumentId: null });
  });
});

describe("TIEUCHI_NGHIEMTHU_95, 97: đơn mua nội bộ không nhận thường; rút, hủy khi đang chờ duyệt", () => {
  it("KICHBAN_KIEMTHU_190: đơn mua nội bộ không lập phiếu nhập thường; bên bán hủy khi đơn mua đối ứng chờ duyệt thì yêu cầu duyệt bị rút; bên mua rút đơn đối ứng thì đơn bán hủy", async () => {
    // Đơn mua nội bộ đã duyệt chỉ nhận theo phiếu xuất của công ty bán.
    const internalPurchase = (await buy(groupAdmin, "/purchasing/orders", purchaseBody("1"))).body;
    expect((await buy(groupAdmin, `/purchasing/orders/${internalPurchase.id}/submit`, {})).body.status).toBe("approved");
    expect((await buy(groupAdmin, "/inventory/purchase-orders")).body.map((item: { id: string }) => item.id)).not.toContain(internalPurchase.id);
    const normal = await buy(groupAdmin, "/inventory/purchase-receipts", {
      orderId: internalPurchase.id,
      documentDate: today,
      lines: [{ orderLineId: internalPurchase.lines[0].id, quantity: "1" }],
    });
    expect(normal.status).toBe(409);
    expect(normal.body.error.message).toBe("Đơn mua nội bộ chỉ nhận theo phiếu nhập sinh từ phiếu xuất của công ty bán.");

    // Chính sách duyệt đơn mua ở VCT: đơn mua đối ứng xác nhận xong thì chờ duyệt.
    const tradingApprover = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'banhang.vct.noibo@vcomm.test'")).rows[0]!.id;
    const policy = await groupAdmin.call("post", "/approval-policies", {
      companyId: trading,
      body: {
        documentTypeCode: "purchasing.order",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: tradingApprover }, substitute: { type: "user", userId: testIds.groupAdmin }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const confirmPending = async () => {
      const order = (await sell(retailAdmin, "/sales/orders", salesBody("12"))).body;
      const confirmed = (await sell(retailAdmin, `/sales/orders/${order.id}/submit`, {})).body;
      const purchase = (await pool.query<{ id: string; version: number }>("SELECT id, version FROM purchasing.orders WHERE counterpart_order_id = $1", [order.id])).rows[0]!;
      const pending = (await buy(groupAdmin, `/purchasing/orders/${purchase.id}/counterpart-confirm`, { warehouseId: buyerWarehouse, version: purchase.version })).body;
      expect(pending).toMatchObject({ status: "pending", canWithdraw: true });
      return { order: confirmed, purchase: pending };
    };

    // Bên bán hủy: đơn mua đóng, yêu cầu duyệt bị rút khỏi hộp duyệt.
    const first = await confirmPending();
    expect((await sell(retailAdmin, `/sales/orders/${first.order.id}/cancel`, { version: first.order.version })).body.status).toBe("cancelled");
    expect((await buy(groupAdmin, `/purchasing/orders/${first.purchase.id}`)).body.status).toBe("closed");
    expect((await pool.query("SELECT status FROM core.approval_requests WHERE id = $1", [first.purchase.approvalRequestId])).rows[0]).toEqual({ status: "withdrawn" });

    // Bên mua rút đơn đối ứng đang chờ duyệt: đơn mua đóng, đơn bán hủy, nhả hàng giữ.
    const second = await confirmPending();
    const before = await reserved();
    expect((await buy(groupAdmin, `/purchasing/orders/${second.purchase.id}/withdraw`, {})).status).toBe(201);
    expect((await buy(groupAdmin, `/purchasing/orders/${second.purchase.id}`)).body).toMatchObject({ status: "closed", closedReason: "Bên mua rút đơn mua đối ứng" });
    expect((await sell(retailAdmin, `/sales/orders/${second.order.id}`)).body).toMatchObject({ status: "cancelled", closedReason: "Bên mua rút đơn mua đối ứng" });
    expect(await reserved()).toBe(before - 12);
  });
});

describe("TIEUCHI_NGHIEMTHU_106: công nợ khi ghi tổn thất hàng thiếu nội bộ (CONG_VIEC_13)", () => {
  it("KICHBAN_KIEMTHU_209: bên bán ghi tổn thất thì phải thu của phiếu xuất giảm đúng giá trị phần thiếu theo giá đơn bán; bên mua không có phải trả cho phần không nhận", async () => {
    const written = (
      await pool.query<{ id: string; issue_document_id: string; receipt_document_id: string }>(
        "SELECT id, issue_document_id, receipt_document_id FROM inventory.internal_discrepancies WHERE status = 'written_off'",
      )
    ).rows;
    expect(written).toHaveLength(1);
    const credit = (await pool.query("SELECT amount::text, open_amount::text, original_item_id FROM finance.debt_items WHERE source_type = 'internal_write_off' AND source_id = $1", [written[0]!.id]))
      .rows[0];
    const issue = (await pool.query("SELECT id, amount::text, open_amount::text FROM finance.debt_items WHERE source_id = $1 AND direction = 'debit'", [written[0]!.issue_document_id])).rows[0];
    // Cả phiếu xuất (1 máy) thất lạc: khoản giảm bằng toàn bộ phải thu của phiếu xuất, phiếu xuất hết nợ.
    expect(credit).toMatchObject({ amount: issue.amount, open_amount: "0.0000", original_item_id: issue.id });
    expect(issue.open_amount).toBe("0.0000");
    expect((await pool.query("SELECT 1 FROM finance.debt_items WHERE source_id = $1", [written[0]!.receipt_document_id])).rows).toHaveLength(0);
  });
});
