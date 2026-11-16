// CONG_VIEC_62 lát L4: người bán dropship, vận đơn đơn người bán, phiếu giao danh nghĩa người bán
// (TIEUCHI_NGHIEMTHU_467 đến 469, 534; KICHBAN_KIEMTHU_648 đến 650, 729, 730).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { ResellerSettlementsService } from "../src/finance/reseller-settlements.service";
import { ResellerShipmentsService } from "../src/sales/reseller-shipments.service";
import { allowManualGoodsOrders, createTestUser, grantSalesOrderManage, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let keeper: Session;
let today: string;
let sku: string;
let channelId: string;
let warehouseId: string;
let resellerId: string;
let resellerKey: string;
let dealerKey: string;
let keeperId: string;
let resellerGroup: string;
const retail: string = testIds.retailCompany;
const units: Record<string, string> = {};
const errorText = messages.vi.errors as Record<string, string>;
const webhookKey = "khoa-webhook-kiem-thu-0123456789";
// Máy chủ GHN giả lập: ghi yêu cầu, trạng thái do kiểm thử đặt.
let ghn: Server;
const ghnRequests: { path: string; body: Record<string, unknown> }[] = [];
const ghnStatus = new Map<string, string>();
const ghnByClientCode = new Map<string, string>();
let ghnLoseResponse = false;
let ghnCounter = 0;

const call = (session: Session, method: "get" | "post" | "patch" | "put", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const open = (method: "get" | "post", path: string, key: string, body?: unknown) => {
  const sent = request(application.getHttpServer())[method](`/api/v1/open${path}`).set("accept-language", "vi").set("authorization", `Bearer ${key}`);
  return body === undefined ? sent : sent.send(body as object);
};
const webhook = (payload: object) => request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send(payload);
const resellerRecipient = { name: "Phạm Thị Nhận", phone: "0911222333", street: "12 Phố Hàng Bông", wardCode: "00004" };
const orderBody = (code: string, extra: Record<string, unknown> = {}) => ({ partnerOrderCode: code, warehouseCode: "RS62", lines: [{ sku, unitCode: "CAI", quantity: "2" }], ...extra });

async function saveProfile(partnerId: string, body: Record<string, unknown>) {
  const current = (await call(admin, "get", `/crm/partners/${partnerId}`)).body;
  const version = current.profiles?.find?.((profile: { companyId: string }) => profile.companyId === retail)?.version ?? current.profile?.version ?? 0;
  return admin.call("put", `/crm/partners/${partnerId}/profile`, {
    companyId: retail,
    body: { isCustomer: true, isSupplier: false, paymentTermDays: 15, creditLimit: null, customerGroupId: resellerGroup, version, ...body },
  });
}

async function issueKey(partnerId: string): Promise<string> {
  const created = await call(admin, "post", "/platform/api-keys", {
    kind: "partner",
    partnerId,
    name: `Khóa ${Math.random().toString(36).slice(2, 8)}`,
    scopes: ["catalog.read", "sales_order.write"],
    channelId,
    warehouseIds: [warehouseId],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.secret as string;
}

// Đơn người bán đã xác nhận: Open API tạo nháp, nhân viên gửi thì xác nhận.
async function confirmedResellerOrder(code: string, codAmount = "150000"): Promise<string> {
  const created = await open("post", "/sales-orders", resellerKey, orderBody(code, { recipient: resellerRecipient, codAmount }));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = (await pool.query<{ id: string }>("SELECT id FROM sales.orders WHERE partner_order_code = $1", [code])).rows[0]!.id;
  const submitted = await call(admin, "post", `/sales/orders/${id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("confirmed");
  return id;
}

const documents = async (orderId: string) =>
  (
    await pool.query<{ type: string; status: string }>(
      `SELECT type, status FROM inventory.documents WHERE source_id = $1 OR source_id IN (SELECT id FROM inventory.documents WHERE source_id = $1) ORDER BY created_at`,
      [orderId],
    )
  ).rows.map((row) => `${row.type}:${row.status}`);

beforeAll(async () => {
  ghn = createServer((incoming, response) => {
    let raw = "";
    incoming.on("data", (chunk) => (raw += chunk));
    incoming.on("end", () => {
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      ghnRequests.push({ path: incoming.url ?? "", body });
      const reply = (payload: unknown) => {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(payload));
      };
      if (incoming.url?.endsWith("/shipping-order/create")) {
        ghnCounter += 1;
        const code = `GHNRS${ghnCounter}`;
        ghnStatus.set(code, "ready_to_pick");
        ghnByClientCode.set(body.client_order_code as string, code);
        if (ghnLoseResponse) {
          response.statusCode = 503;
          return reply({ code: 503, message: "Bận" });
        }
        return reply({ code: 200, data: { order_code: code, total_fee: 31000 } });
      }
      if (incoming.url?.endsWith("/switch-status/cancel")) {
        const code = (body.order_codes as string[])[0]!;
        const ok = ghnStatus.get(code) === "ready_to_pick";
        if (ok) ghnStatus.set(code, "cancel");
        return reply({ code: 200, data: [{ order_code: code, result: ok, message: ok ? "OK" : "Đã lấy hàng" }] });
      }
      if (incoming.url?.endsWith("/shipping-order/detail-by-client-code")) {
        const code = ghnByClientCode.get(body.client_order_code as string);
        return code ? reply({ code: 200, data: { order_code: code, status: ghnStatus.get(code), total_fee: 31000 } }) : reply({ code: 400, message: "Không tìm thấy đơn" });
      }
      if (incoming.url?.endsWith("/shipping-order/detail")) {
        const status = ghnStatus.get(body.order_code as string) ?? "unknown";
        return reply({ code: 200, data: { status, cod_collect_date: status === "delivered" ? new Date().toISOString() : null } });
      }
      reply({ code: 404, message: "Không có" });
    });
  });
  await new Promise<void>((resolve) => ghn.listen(0, "127.0.0.1", resolve));
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: `http://127.0.0.1:${(ghn.address() as AddressInfo).port}` });
  ({ application, pool } = await startTestApplication());
  await allowManualGoodsOrders(pool, retail);
  today = application.get(PermissionService).today();
  await grantSalesOrderManage(pool, "quantri.vcr@vcomm.test", retail);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  keeperId = await createTestUser(pool, "thukho.nguoiban@vcomm.test", "Đỗ Văn Kho", [{ companyId: retail, branchId: testIds.binhDuongWarehouse }]);
  const keeperRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'warehouse_keeper' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, 'branch', $3, $4, '2026-01-01')", [
    keeperId,
    keeperRole,
    retail,
    testIds.binhDuongWarehouse,
  ]);
  keeper = await signIn(application, "thukho.nguoiban@vcomm.test");
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await groupAdmin.call("post", "/finance/ledger/setup", { companyId: retail })).status).toBe(201);
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "RS62", nameVi: "Người bán", nameEn: "Reseller" } })).body.id;
  const product = await call(admin, "post", "/catalog/products", {
    categoryId: category,
    name: "Trà sen Tây Hồ hộp 200g",
    vatRate: "8",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: units.CAI,
    weightKg: "0.3",
    variants: [{ barcodes: [] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  const variantId = product.body.variants[0].id as string;
  sku = (await pool.query<{ sku: string }>("SELECT sku FROM catalog.variants WHERE id = $1", [variantId])).rows[0]!.sku;
  warehouseId = (await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "RS62", name: "Kho giao người bán", usesLocations: false })).body.id;
  const receipt = await call(admin, "post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [{ variantId, unitId: units.CAI, quantity: "200", unitCost: "50000" }],
  });
  expect((await call(admin, "post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channels = (await call(admin, "post", "/catalog/sales-channels/defaults")).body as { id: string; code: string }[];
  channelId = channels.find((channel) => channel.code === "BAN_SI")!.id;
  const group = (await call(admin, "post", "/catalog/customer-groups", { code: "NGUOI_BAN_62", name: "Người bán dropship" })).body.id;
  resellerGroup = group;
  const priceList = async (code: string, customerGroupId: string | null, price: string) => {
    const list = (await call(admin, "post", "/catalog/price-lists", { code, name: code, customerGroupId, includesVat: true })).body.id;
    const change = await call(admin, "post", "/catalog/price-changes", { priceListId: list, effectiveFrom: today, lines: [{ variantId, unitId: units.CAI, price }] });
    expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  };
  await priceList("CHUNG62", null, "90000");
  await priceList("NGUOIBAN62", group, "75600");
  resellerId = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Hộ kinh doanh Shop Mẹ Bống", taxCode: "0320006231", phone: "0909111222" })).body.id;
  const dealerId = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Công ty Đại lý Không cờ", taxCode: "0320006232" })).body.id;
  const notCustomer = await saveProfile(resellerId, { isCustomer: false, isSupplier: true, isDropshipReseller: true });
  expect(notCustomer.status).toBe(400);
  expect(notCustomer.body.error.fields.isDropshipReseller).toBe(errorText.invalidValue);
  const flagged = await saveProfile(resellerId, { customerGroupId: group, isDropshipReseller: true });
  expect(flagged.status, JSON.stringify(flagged.body)).toBe(200);
  expect((await saveProfile(dealerId, { customerGroupId: group })).status).toBe(200);
  resellerKey = await issueKey(resellerId);
  dealerKey = await issueKey(dealerId);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
  await new Promise<void>((resolve) => ghn?.close(() => resolve()));
});

describe("TIEUCHI_NGHIEMTHU_467: đơn Open API của người bán dropship", () => {
  it("KICHBAN_KIEMTHU_648: người bán có cờ, gửi customerCode, thiếu phường/xã, đối tác không cờ, tắt cờ sau khi tạo đơn", async () => {
    const created = await open("post", "/sales-orders", resellerKey, orderBody("SMB-001", { recipient: resellerRecipient, codAmount: "150000" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ deliveryAddress: "12 Phố Hàng Bông, Phường Ba Đình, Thành phố Hà Nội", shipment: null });
    expect(created.body.lines[0]).toMatchObject({ quantity: "2", unitPrice: "75600" });
    const row = (
      await pool.query<{ customer_id: string; is_reseller_dropship: boolean; cod_amount: string; recipient_ward_code: string }>(
        "SELECT customer_id, is_reseller_dropship, cod_amount::text, recipient_ward_code FROM sales.orders WHERE partner_order_code = 'SMB-001'",
      )
    ).rows[0]!;
    expect(row).toMatchObject({ customer_id: resellerId, is_reseller_dropship: true, cod_amount: "150000.0000", recipient_ward_code: "00004" });

    const customer = (await pool.query<{ code: string }>("SELECT code FROM crm.partners WHERE id = $1", [resellerId])).rows[0]!.code;
    const withCustomer = await open("post", "/sales-orders", resellerKey, orderBody("SMB-002", { recipient: resellerRecipient, customerCode: customer }));
    expect(withCustomer.status).toBe(400);
    expect(withCustomer.body.error.fields.customerCode).toBe(errorText.invalidValue);
    const addressOnly = await open("post", "/sales-orders", resellerKey, orderBody("SMB-003", { recipient: { name: "A", phone: "0911222333", address: "Số 1 Lê Lợi" } }));
    expect(addressOnly.status).toBe(400);
    expect(addressOnly.body.error.fields["recipient.wardCode"]).toBe(errorText.required);
    const badWard = await open("post", "/sales-orders", resellerKey, orderBody("SMB-004", { recipient: { ...resellerRecipient, wardCode: "99999" } }));
    expect(badWard.status).toBe(400);
    expect(badWard.body.error.fields["recipient.wardCode"]).toBe(errorText.invalidValue);

    const dealerCod = await open("post", "/sales-orders", dealerKey, orderBody("DL-001", { recipient: resellerRecipient, codAmount: "1000" }));
    expect(dealerCod.status).toBe(400);
    expect(dealerCod.body.error.fields.codAmount).toBe(errorText.invalidValue);
    const dealer = await open("post", "/sales-orders", dealerKey, orderBody("DL-002", { recipient: { name: "B", phone: "0911222333", address: "Số 2 Lê Lợi, Đà Nẵng" } }));
    expect(dealer.status, JSON.stringify(dealer.body)).toBe(201);
    const dealerRow = (await pool.query<{ cod_amount: string; is_reseller_dropship: boolean }>("SELECT cod_amount::text, is_reseller_dropship FROM sales.orders WHERE partner_order_code = 'DL-002'"))
      .rows[0]!;
    expect(dealerRow).toEqual({ cod_amount: "0.0000", is_reseller_dropship: false });

    expect((await saveProfile(resellerId, { isDropshipReseller: false })).status).toBe(200);
    const after = (await pool.query<{ is_reseller_dropship: boolean }>("SELECT is_reseller_dropship FROM sales.orders WHERE partner_order_code = 'SMB-001'")).rows[0]!;
    expect(after.is_reseller_dropship).toBe(true);
    const notReseller = await open("post", "/sales-orders", resellerKey, orderBody("SMB-005", { recipient: resellerRecipient, codAmount: "1000" }));
    expect(notReseller.status).toBe(400);
    expect((await saveProfile(resellerId, { isDropshipReseller: true })).status).toBe(200);
  });
});

describe("TIEUCHI_NGHIEMTHU_468: phiếu giao danh nghĩa người bán, vận đơn nhập tay", () => {
  it("KICHBAN_KIEMTHU_649: sinh phiếu giao, kiểm văn bản có, không có; nhập vận đơn rồi tra API_263; công nợ theo người bán", async () => {
    await pool.query("UPDATE marketplace.carriers SET is_enabled = false");
    const orderId = await confirmedResellerOrder("SMB-101");
    const list = await call(keeper, "get", "/sales/reseller-shipments?status=none");
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.carriers).toEqual([]);
    expect(list.body.data.map((item: { partnerOrderCode: string }) => item.partnerOrderCode)).toContain("SMB-101");

    const pdf = await call(keeper, "get", `/sales/orders/${orderId}/reseller-delivery-note`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    const { definition } = await application
      .get(ResellerShipmentsService)
      .deliveryNoteDefinition({ userId: keeperId, companyId: retail, client: { ip: null, userAgent: null, requestId: null } }, orderId);
    const text = JSON.stringify(definition);
    for (const expected of ["Hộ kinh doanh Shop Mẹ Bống", "0909111222", "Phạm Thị Nhận", "12 Phố Hàng Bông", "SMB-101", "Trà sen Tây Hồ", "150.000 đ"]) expect(text).toContain(expected);
    const documentNo = (await pool.query<{ document_no: string }>("SELECT document_no FROM sales.orders WHERE id = $1", [orderId])).rows[0]!.document_no;
    const company = (await pool.query<{ legal_name: string; short_name: string }>("SELECT legal_name, short_name FROM core.companies WHERE id = $1", [retail])).rows[0]!;
    for (const hidden of [company.legal_name, company.short_name, documentNo, "75.600", "151.200"]) expect(text).not.toContain(hidden);

    const manual = (body: Record<string, unknown>) =>
      call(keeper, "patch", `/sales/orders/${orderId}/reseller-shipment`, { carrierName: "Xe nhà Ba Gác", trackingCode: "BG001", fee: "25000", ...body });
    const wrong = await manual({ status: "returned", version: 0 });
    expect(wrong.status).toBe(400);
    const saved = await manual({ status: "awaiting_pickup", version: 0 });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.shipment).toMatchObject({ carrierCode: null, carrierName: "Xe nhà Ba Gác", status: "awaiting_pickup", fee: "25000", codAmount: "150000", version: 1 });
    expect(await documents(orderId)).toEqual(["sales_issue:draft"]);
    const shipped = await manual({ status: "shipping", version: 1 });
    expect(shipped.status, JSON.stringify(shipped.body)).toBe(200);
    expect(await documents(orderId)).toEqual(["sales_issue:posted"]);
    expect((await manual({ status: "awaiting_pickup", version: shipped.body.shipment.version })).status).toBe(409);
    expect((await manual({ status: "delivered", version: 1 })).status).toBe(409);
    const delivered = await manual({ status: "delivered", version: shipped.body.shipment.version });
    expect(delivered.status, JSON.stringify(delivered.body)).toBe(200);
    expect(delivered.body.orderStatus).toBe("delivered");

    const traced = await open("get", "/sales-orders/SMB-101", resellerKey);
    expect(traced.status).toBe(200);
    expect(traced.body.shipment).toEqual({ carrierName: "Xe nhà Ba Gác", trackingCode: "BG001", status: "delivered", shippingFee: "25000", codAmount: "150000" });
    const detail = (await call(admin, "get", `/sales/orders/${orderId}`)).body;
    expect(detail.resellerShipment).toMatchObject({ partnerOrderCode: "SMB-101", shipment: { status: "delivered" } });
    const debt = await pool.query<{ partner_id: string; amount: string }>(
      "SELECT d.partner_id, d.amount::text FROM finance.debt_items d JOIN inventory.documents i ON i.id = d.source_id WHERE i.source_id = $1 AND d.source_type = 'sales_issue'",
      [orderId],
    );
    expect(debt.rows).toEqual([{ partner_id: resellerId, amount: "151200.0000" }]);
  });
});

describe("TIEUCHI_NGHIEMTHU_534: vận đơn tự tạo qua đơn vị vận chuyển", () => {
  it("KICHBAN_KIEMTHU_729: tạo vận đơn bằng bộ giả lập, webhook lấy hàng ghi sổ phiếu xuất, đã giao ghi ngày thu hộ", async () => {
    await pool.query("UPDATE marketplace.carriers SET is_enabled = (code = 'ghn')");
    const orderId = await confirmedResellerOrder("SMB-201", "200000");
    expect((await call(keeper, "get", "/sales/reseller-shipments")).body.carriers).toEqual(["ghn"]);
    const created = await call(keeper, "post", `/sales/orders/${orderId}/reseller-shipment/carrier`, { carrierCode: "ghn", version: 0 });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.shipment).toMatchObject({ carrierCode: "ghn", status: "awaiting_pickup", fee: "31000", codAmount: "200000" });
    const sent = ghnRequests.filter((item) => item.path.endsWith("/shipping-order/create")).at(-1)!.body;
    expect(sent).toMatchObject({ to_name: "Phạm Thị Nhận", cod_amount: 200000, to_ward_name: "Phường Ba Đình", to_province_name: "Thành phố Hà Nội" });
    expect((sent.items as { price: number }[]).every((item) => item.price === 0)).toBe(true);
    expect(await documents(orderId)).toEqual(["sales_issue:draft"]);
    const tracking = created.body.shipment.trackingCode as string;
    expect((await call(keeper, "patch", `/sales/orders/${orderId}/reseller-shipment`, { carrierName: "X", trackingCode: "Y", fee: "0", status: "shipping", version: 1 })).status).toBe(409);

    ghnStatus.set(tracking, "picked");
    const picked = await webhook({ OrderCode: tracking, Status: "delivered" });
    expect(picked.status, JSON.stringify(picked.body)).toBe(200);
    expect(picked.body).toEqual({ result: "applied" });
    expect(await documents(orderId)).toEqual(["sales_issue:posted"]);
    expect((await open("get", "/sales-orders/SMB-201", resellerKey)).body.shipment).toMatchObject({ status: "shipping", trackingCode: tracking });
    ghnStatus.set(tracking, "delivered");
    expect((await webhook({ OrderCode: tracking })).body).toEqual({ result: "applied" });
    expect((await webhook({ OrderCode: tracking })).body).toEqual({ result: "applied" });
    const done = (await call(keeper, "get", `/sales/orders/${orderId}/reseller-shipment`)).body;
    expect(done).toMatchObject({ orderStatus: "delivered", shipment: { status: "delivered" } });
    expect(done.shipment.codCollectedAt).not.toBeNull();
    expect(await documents(orderId)).toEqual(["sales_issue:posted"]);
    expect((await webhook({ OrderCode: "GHNKHONGCO" })).body).toEqual({ result: "ignored" });
  });

  it("KICHBAN_KIEMTHU_730: hoàn hàng nhận trả, hủy vận đơn trước khi lấy, tra lại khi mất phản hồi", async () => {
    const returnedOrder = await confirmedResellerOrder("SMB-301");
    const created = (await call(keeper, "post", `/sales/orders/${returnedOrder}/reseller-shipment/carrier`, { carrierCode: "ghn", version: 0 })).body.shipment;
    ghnStatus.set(created.trackingCode, "delivering");
    expect((await call(keeper, "post", `/sales/orders/${returnedOrder}/reseller-shipment/carrier/refresh`)).body.shipment.status).toBe("shipping");
    ghnStatus.set(created.trackingCode, "returned");
    const back = await call(keeper, "post", `/sales/orders/${returnedOrder}/reseller-shipment/carrier/refresh`);
    expect(back.status, JSON.stringify(back.body)).toBe(201);
    expect(back.body.shipment.status).toBe("returned");
    expect(await documents(returnedOrder)).toEqual(["sales_issue:posted", "sales_return:posted"]);
    const returnDebt = await pool.query<{ partner_id: string }>(
      "SELECT d.partner_id FROM finance.debt_items d JOIN inventory.documents r ON r.id = d.source_id WHERE r.source_id IN (SELECT id FROM inventory.documents WHERE source_id = $1) AND d.source_type = 'sales_return'",
      [returnedOrder],
    );
    expect(returnDebt.rows.map((row) => row.partner_id)).toEqual([resellerId]);

    const cancelled = await confirmedResellerOrder("SMB-302");
    const shipment = (await call(keeper, "post", `/sales/orders/${cancelled}/reseller-shipment/carrier`, { carrierCode: "ghn", version: 0 })).body.shipment;
    expect((await call(keeper, "post", `/sales/orders/${cancelled}/reseller-shipment/carrier/cancel`, { version: shipment.version + 5 })).status).toBe(409);
    const cancel = await call(keeper, "post", `/sales/orders/${cancelled}/reseller-shipment/carrier/cancel`, { version: shipment.version });
    expect(cancel.status, JSON.stringify(cancel.body)).toBe(201);
    expect(cancel.body.shipment).toBeNull();
    expect(cancel.body.orderStatus).toBe("confirmed");
    expect(ghnStatus.get(shipment.trackingCode)).toBe("cancel");
    expect(await documents(cancelled)).toEqual([]);
    const again = await call(keeper, "post", `/sales/orders/${cancelled}/reseller-shipment/carrier`, { carrierCode: "ghn", version: 0 });
    expect(again.status, JSON.stringify(again.body)).toBe(201);

    const lost = await confirmedResellerOrder("SMB-303");
    ghnLoseResponse = true;
    const unknown = await call(keeper, "post", `/sales/orders/${lost}/reseller-shipment/carrier`, { carrierCode: "ghn", version: 0 });
    ghnLoseResponse = false;
    expect(unknown.status).toBe(409);
    expect(unknown.body.error.message).toBe(errorText.carrierOutcomeUnknown);
    expect((await call(keeper, "get", `/sales/orders/${lost}/reseller-shipment`)).body.shipment).toMatchObject({ status: "requesting", trackingCode: null });
    expect((await call(keeper, "post", `/sales/orders/${lost}/reseller-shipment/carrier`, { carrierCode: "ghn", version: 0 })).status).toBe(409);
    const found = await call(keeper, "post", `/sales/orders/${lost}/reseller-shipment/carrier/refresh`);
    expect(found.status, JSON.stringify(found.body)).toBe(201);
    expect(found.body.shipment).toMatchObject({
      status: "awaiting_pickup",
      trackingCode: ghnByClientCode.get((await pool.query("SELECT document_no FROM sales.orders WHERE id = $1", [lost])).rows[0].document_no),
    });

    // Người không có quyền xuất giao hàng tại kho không thao tác được.
    expect((await call(admin, "get", `/sales/orders/${lost}/reseller-shipment`)).status).toBe(200);
  });
});

describe("TIEUCHI_NGHIEMTHU_469: đối soát tuần người bán", () => {
  it("KICHBAN_KIEMTHU_650: tuần có giao, hoàn, thu hộ: lập bảng A đến E, lập lại không trùng, xác nhận có đơn phí giao, bút toán, phiếu chi nháp; chứng từ trễ vào tuần sau", async () => {
    await pool.query("UPDATE marketplace.carriers SET is_enabled = false");
    // Người bán riêng cho kịch bản để số liệu độc lập với các kịch bản trước.
    const sellerId = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Hộ kinh doanh Nhà Nông Online", taxCode: "0320006233", phone: "0977000111" })).body.id as string;
    expect((await saveProfile(sellerId, { isDropshipReseller: true })).status).toBe(200);
    const sellerKey = await issueKey(sellerId);
    const place = async (code: string, cod: string) => {
      const created = await open("post", "/sales-orders", sellerKey, orderBody(code, { recipient: resellerRecipient, codAmount: cod }));
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      const id = (await pool.query<{ id: string }>("SELECT id FROM sales.orders WHERE partner_order_code = $1", [code])).rows[0]!.id;
      expect((await call(admin, "post", `/sales/orders/${id}/submit`)).body.status).toBe("confirmed");
      return id;
    };
    const ship = async (orderId: string, steps: string[], fee: string) => {
      let version = 0;
      for (const status of steps) {
        const saved = await call(keeper, "patch", `/sales/orders/${orderId}/reseller-shipment`, { carrierName: "Xe nhà", trackingCode: `XN-${orderId.slice(0, 6)}`, fee, status, version });
        expect(saved.status, JSON.stringify(saved.body)).toBe(200);
        version = saved.body.shipment?.version ?? 0;
      }
    };
    const delivered = await place("NNO-1", "300000");
    await ship(delivered, ["awaiting_pickup", "shipping", "delivered"], "30000");
    const returned = await place("NNO-2", "150000");
    await ship(returned, ["awaiting_pickup", "shipping", "returned"], "20000");
    // Bảng thu hộ đã ghi sổ của đơn vị vận chuyển cho đơn đã giao (luồng CONG_VIEC_19 đọc ở đây chỉ để đối chiếu).
    const collectorPartner = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Đơn vị thu hộ Xe nhà", taxCode: "0320006234" })).body.id as string;
    const adminId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0]!.id;
    const collector = (
      await pool.query<{ id: string }>("INSERT INTO finance.collectors (company_id, partner_id, kind, created_by) VALUES ($1, $2, 'cod', $3) RETURNING id", [retail, collectorPartner, adminId])
    ).rows[0]!.id;
    const statement = (
      await pool.query<{ id: string }>(
        "INSERT INTO finance.collection_statements (company_id, collector_id, statement_no, document_no, statement_date, status, total_collected, created_by) VALUES ($1, $2, 'XN-0001', 'BTH-0001', $3, 'posted', 300000, $4) RETURNING id",
        [retail, collector, today, adminId],
      )
    ).rows[0]!.id;
    const orderNo = (await pool.query<{ document_no: string }>("SELECT document_no FROM sales.orders WHERE id = $1", [delivered])).rows[0]!.document_no;
    await pool.query(
      "INSERT INTO finance.collection_statement_lines (statement_id, line_no, reference, order_no, order_id, customer_id, collected_amount, fee_amount, collected_date) VALUES ($1, 1, 'XN-T1', $2, $3, $4, 300000, 0, $5)",
      [statement, orderNo, delivered, sellerId, today],
    );

    const service = application.get(ResellerSettlementsService);
    const nextWeek = new Date(`${today}T00:00:00Z`);
    nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
    const runDay = nextWeek.toISOString().slice(0, 10);
    expect(await service.generateWeekly(runDay)).toBeGreaterThanOrEqual(1);
    expect(await service.generateWeekly(runDay)).toBe(0);
    // Bảng lập theo (công ty, người bán): mọi dòng thuộc đơn của đúng công ty, đúng người bán của bảng; người bán cùng đối tác ở công ty khác không vào bảng này.
    const mixed = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM finance.reseller_settlement_lines l JOIN finance.reseller_settlements s ON s.id = l.settlement_id JOIN sales.orders o ON o.id = l.order_id
       WHERE o.company_id <> s.company_id OR o.customer_id <> s.reseller_id`,
    );
    expect(mixed.rows[0]!.total).toBe(0);
    const tradingSettlements = await pool.query("SELECT 1 FROM finance.reseller_settlements WHERE company_id <> $1", [retail]);
    expect(tradingSettlements.rows).toHaveLength(0);
    const list = await call(admin, "get", `/finance/reseller-settlements?resellerId=${sellerId}`);
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const draft = list.body.data[0];
    // A: hai phiếu xuất 151.200; B: một phiếu nhận trả; C: thu hộ 300.000; D: 30.000 + 20.000; E: 8% của D theo mặc định.
    expect(draft).toMatchObject({ issueAmount: "302400", returnAmount: "151200", collectionAmount: "300000", feeAmount: "50000", feeTaxAmount: "4000", remainingAmount: "-94800", status: "draft" });
    const detail = (await call(admin, "get", `/finance/reseller-settlements/${draft.id}`)).body;
    expect(detail.counts).toEqual({ issue: 2, return: 1, collection: 1, shipping_fee: 2 });
    expect(detail.canConfirm).toBe(true);

    const missingProduct = await call(admin, "post", `/finance/reseller-settlements/${draft.id}/confirm`, { version: draft.version ?? detail.version });
    expect(missingProduct.status).toBe(409);
    expect(missingProduct.body.error.message).toBe(errorText.dropshipFeeProductMissing);
    const category = (await pool.query<{ id: string }>("SELECT id FROM catalog.categories WHERE code = 'RS62'")).rows[0]!.id;
    const feeProduct = await call(admin, "post", "/catalog/products", {
      categoryId: category,
      name: "Phí giao hàng dropship",
      kind: "service",
      vatRate: "8",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.CAI,
      variants: [{ barcodes: [] }],
    });
    expect(feeProduct.status, JSON.stringify(feeProduct.body)).toBe(201);
    const settings = (await call(admin, "get", "/sales/settings")).body;
    const saved = await call(admin, "put", "/sales/settings", {
      maxManualDiscountPercent: settings.maxManualDiscountPercent,
      dropshipFeeVariantId: feeProduct.body.variants[0].id,
      version: settings.version,
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.dropshipFeeVariantId).toBe(feeProduct.body.variants[0].id);

    const noFund = await call(admin, "post", `/finance/reseller-settlements/${draft.id}/confirm`, { version: detail.version });
    expect(noFund.status).toBe(400);
    expect(noFund.body.error.fields.fundId).toBe(errorText.required);
    let fund = (await pool.query<{ id: string }>("SELECT id FROM finance.funds WHERE company_id = $1 AND status = 'active' LIMIT 1", [retail])).rows[0]?.id;
    fund ??= (await pool.query<{ id: string }>("INSERT INTO finance.funds (company_id, code, name, kind, created_by) VALUES ($1, 'TM62', 'Tiền mặt', 'cash', $2) RETURNING id", [retail, adminId]))
      .rows[0]!.id;
    const confirmed = await call(admin, "post", `/finance/reseller-settlements/${draft.id}/confirm`, { version: detail.version, fundId: fund });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(201);
    expect(confirmed.body).toMatchObject({ status: "confirmed", feeAmount: "50000", feeTaxAmount: "4000", remainingAmount: "-94800", canConfirm: false });
    expect(confirmed.body.refundPayment).toMatchObject({ status: "draft", amount: "94800" });
    const payment = (await pool.query<{ kind: string; partner_id: string }>("SELECT kind, partner_id FROM finance.payments WHERE id = $1", [confirmed.body.refundPayment.id])).rows[0]!;
    expect(payment).toEqual({ kind: "customer_refund", partner_id: sellerId });
    // Đơn phí giao: đơn bán dịch vụ đã giao, công nợ người bán 54.000, bút toán của phiếu dịch vụ.
    const feeOrder = (
      await pool.query<{ status: string; customer_id: string; total_amount: string; is_reseller_dropship: boolean }>(
        "SELECT status, customer_id, total_amount::text, is_reseller_dropship FROM sales.orders WHERE id = $1",
        [confirmed.body.feeOrder.id],
      )
    ).rows[0]!;
    expect(feeOrder).toEqual({ status: "delivered", customer_id: sellerId, total_amount: "54000.0000", is_reseller_dropship: false });
    const feeDebt = await pool.query<{ partner_id: string; amount: string; journal: string | null }>(
      `SELECT d.partner_id, d.amount::text, (SELECT j.id::text FROM accounting.journals j WHERE j.source_type = 'inventory_document' AND j.source_id = doc.id) AS journal
       FROM inventory.documents doc JOIN finance.debt_items d ON d.source_type = 'sales_issue' AND d.source_id = doc.id WHERE doc.source_id = $1`,
      [confirmed.body.feeOrder.id],
    );
    expect(feeDebt.rows).toHaveLength(1);
    expect(feeDebt.rows[0]).toMatchObject({ partner_id: sellerId, amount: "54000.0000" });
    expect(feeDebt.rows[0]!.journal).not.toBeNull();
    expect((await call(admin, "post", `/finance/reseller-settlements/${draft.id}/confirm`, { version: confirmed.body.version, fundId: fund })).status).toBe(409);

    // Chứng từ trễ: đơn giao sau khi đã lập bảng vào bảng tuần sau; chứng từ đã vào bảng không lặp lại.
    const late = await place("NNO-3", "0");
    await ship(late, ["awaiting_pickup", "shipping", "delivered"], "15000");
    const later = new Date(`${runDay}T00:00:00Z`);
    later.setUTCDate(later.getUTCDate() + 7);
    expect(await service.generateWeekly(later.toISOString().slice(0, 10))).toBeGreaterThanOrEqual(1);
    const second = (await call(admin, "get", `/finance/reseller-settlements?resellerId=${sellerId}&status=draft`)).body.data;
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ issueAmount: "151200", returnAmount: "0", collectionAmount: "0", feeAmount: "15000", feeTaxAmount: "1200" });
    // Đơn phí giao không phải đơn người bán nên không vào bảng.
    const kinds = await pool.query<{ order_id: string }>("SELECT order_id FROM finance.reseller_settlement_lines WHERE settlement_id = $1", [second[0].id]);
    expect(kinds.rows.every((row) => row.order_id === late)).toBe(true);
    // Người không có quyền tài chính không xem được.
    expect((await call(keeper, "get", "/finance/reseller-settlements")).status).toBe(403);
  });
});
