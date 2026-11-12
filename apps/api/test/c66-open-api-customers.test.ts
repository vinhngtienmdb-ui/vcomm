// CONG_VIEC_66 lát L1: khách hàng do đối tác tạo qua Open API, đơn giao thẳng người nhận (TIEUCHI_NGHIEMTHU_494 đến 501; KICHBAN_KIEMTHU_681 đến 690).
// Giá: bảng chung gồm thuế 11.000 một cái; bảng nhóm Đại lý 9.900 một cái.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { allowManualGoodsOrders, createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let groupAdmin: Session;
let accountant: Session;
let chief: Session;
let today: string;
let warehouseId: string;
let channelId: string;
let dealerId: string;
let otherDealerId: string;
let dealerGroup: string;
let variantId: string;
let sku: string;
let dealerKey: string;
let siblingKey: string;
let otherDealerKey: string;
let internalKey: string;
let tradingKey: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {};

const call = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown, companyId = retail) => session.call(method, path, { companyId, body });
const send = (method: "post" | "get" | "patch", path: string, key: string, body?: unknown) => {
  const sent = request(application.getHttpServer())[method](`/api/v1/open${path}`).set("accept-language", "vi").set("x-forwarded-for", "203.113.10.24").set("authorization", `Bearer ${key}`);
  return body === undefined ? sent : sent.send(body as object);
};
async function issue(companyId: string, extra: Record<string, unknown>): Promise<string> {
  const created = await call(
    companyId === retail ? admin : groupAdmin,
    "post",
    "/platform/api-keys",
    {
      name: `Khóa ${Math.random().toString(36).slice(2, 8)}`,
      scopes: ["catalog.read", "sales_order.write", "customer.write"],
      channelId,
      warehouseIds: [warehouseId],
      ...extra,
    },
    companyId,
  );
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.secret as string;
}
const organization = (taxCode: string, extra: Record<string, unknown> = {}) => ({ kind: "organization", name: `Công ty ${taxCode}`, taxCode, address: "Số 1 Lê Lợi, Đà Nẵng", ...extra });
const individual = (extra: Record<string, unknown> = {}) => ({ kind: "individual", name: "Nguyễn Thị Lan", phone: "0912 345 678", personalDataConsent: true, ...extra });
const orderBody = (code: string, extra: Record<string, unknown> = {}) => ({ partnerOrderCode: code, warehouseCode: "OC661", lines: [{ sku, unitCode: "CAI", quantity: "10" }], ...extra });
const recipient = { name: "Trần Văn Bình", phone: "0987654321", address: "Số 20 Nguyễn Huệ, Quận 1, Thành phố Hồ Chí Minh" };

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  await allowManualGoodsOrders(pool, retail);
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const assign = async (email: string, name: string, role: string) => {
    const id = await createTestUser(pool, email, name, [{ companyId: retail }]);
    const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, roleId, retail]);
    return signIn(application, email);
  };
  accountant = await assign("ketoan.c66@vcomm.test", "Đào Thị Toán", "accountant");
  chief = await assign("ketoantruong.c66@vcomm.test", "Mai Văn Trưởng", "chief_accountant");

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "OC66", nameVi: "Open API 66", nameEn: "Open API 66" } })).body.id;
  const product = await call(admin, "post", "/catalog/products", {
    categoryId: category,
    name: "Bánh quy khách đối tác",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: units.CAI,
    units: [],
    variants: [{ barcodes: [{ barcode: "8930000000666", unitId: units.CAI }] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  variantId = product.body.variants[0].id;
  sku = (await pool.query<{ sku: string }>("SELECT sku FROM catalog.variants WHERE id = $1", [variantId])).rows[0]!.sku;
  warehouseId = (await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "OC661", name: "Kho OC661", usesLocations: false })).body.id;
  const receipt = await call(admin, "post", "/inventory/documents", {
    type: "receipt_other",
    warehouseId,
    companyId: retail,
    documentDate: today,
    reasonCode: "opening_balance",
    reason: "Tồn đầu",
    lines: [{ variantId, unitId: units.CAI, quantity: "500", unitCost: "8000" }],
  });
  expect((await call(admin, "post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  const channels = (await call(admin, "post", "/catalog/sales-channels/defaults")).body as { id: string; code: string }[];
  channelId = channels.find((channel) => channel.code === "BAN_SI")!.id;
  dealerGroup = (await call(admin, "post", "/catalog/customer-groups", { code: "DAI_LY_66", name: "Đại lý cấp 1" })).body.id;
  const priceList = async (code: string, customerGroupId: string | null, price: string) => {
    const list = (await call(admin, "post", "/catalog/price-lists", { code, name: code, customerGroupId, includesVat: true })).body.id;
    const change = await call(admin, "post", "/catalog/price-changes", { priceListId: list, effectiveFrom: today, lines: [{ variantId, unitId: units.CAI, price }] });
    expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  };
  await priceList("CHUNG66", null, "11000");
  await priceList("DAILY66", dealerGroup, "9900");
  const partner = async (name: string, taxCode: string) => {
    const id = (await call(admin, "post", "/crm/partners", { kind: "organization", name, taxCode })).body.id as string;
    const profile = await call(admin, "put", `/crm/partners/${id}/profile`, { isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: null, customerGroupId: dealerGroup, version: 0 });
    expect(profile.status, JSON.stringify(profile.body)).toBe(200);
    return id;
  };
  dealerId = await partner("Công ty TNHH Phân phối Minh Long", "0320066101");
  otherDealerId = await partner("Công ty Bán Hộ Khác", "0320066102");
  dealerKey = await issue(retail, { kind: "partner", partnerId: dealerId });
  siblingKey = await issue(retail, { kind: "partner", partnerId: dealerId });
  otherDealerKey = await issue(retail, { kind: "partner", partnerId: otherDealerId });
  internalKey = await issue(retail, { kind: "internal" });
  const tradingChannels = (await call(groupAdmin, "post", "/catalog/sales-channels/defaults", undefined, trading)).body as { id: string; code: string }[];
  const tradingCreated = await call(
    groupAdmin,
    "post",
    "/platform/api-keys",
    { kind: "internal", name: "Khóa công ty B", scopes: ["customer.write"], channelId: tradingChannels[0]!.id, warehouseIds: [] },
    trading,
  );
  expect(tradingCreated.status, JSON.stringify(tradingCreated.body)).toBe(201);
  tradingKey = tradingCreated.body.secret;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_494: tạo khách, hồ sơ khách theo đối tác", () => {
  it("KICHBAN_KIEMTHU_681: khách tổ chức bằng khóa đối tác: hồ sơ Do đối tác tạo, nhóm của đối tác, hạn 0 ngày", async () => {
    const created = await send("post", "/customers", dealerKey, organization("0320066201"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ kind: "organization", managedByPartner: true, name: "Công ty 0320066201", taxCode: "0320066201", address: "Số 1 Lê Lợi, Đà Nẵng", version: 1 });
    expect(created.body.code).toMatch(/^DT\d{6}$/);
    const stored = (
      await pool.query(
        `SELECT p.created_via_api_key_id IS NOT NULL AS via, pp.is_customer, pp.payment_term_days, pp.credit_limit, pp.customer_group_id, l.scope_id, l.is_owner
         FROM crm.partners p JOIN crm.partner_profiles pp ON pp.partner_id = p.id AND pp.company_id = $2 JOIN crm.open_api_customers l ON l.partner_id = p.id WHERE p.code = $1`,
        [created.body.code, retail],
      )
    ).rows[0];
    expect(stored).toEqual({ via: true, is_customer: true, payment_term_days: 0, credit_limit: null, customer_group_id: dealerGroup, scope_id: dealerId, is_owner: true });
  });

  it("KICHBAN_KIEMTHU_682: khách cá nhân bằng khóa nội bộ: không nhóm, phạm vi là khóa, không có căn cước", async () => {
    const created = await send("post", "/customers", internalKey, individual({ email: "lan@example.com" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ kind: "individual", phone: "+84912345678", taxCode: null, managedByPartner: true });
    expect(created.body.personalDataConsentAt).not.toBeNull();
    expect(created.body).not.toHaveProperty("citizenId");
    const stored = (
      await pool.query(
        "SELECT p.citizen_id, pp.customer_group_id, l.scope_id FROM crm.partners p JOIN crm.partner_profiles pp ON pp.partner_id = p.id JOIN crm.open_api_customers l ON l.partner_id = p.id WHERE p.code = $1",
        [created.body.code],
      )
    ).rows[0];
    expect(stored.citizen_id).toBeNull();
    expect(stored.customer_group_id).toBeNull();
    expect(stored.scope_id).not.toBe(dealerId);
    // Nhân viên sửa hồ sơ cá nhân do đối tác tạo không bắt buộc căn cước.
    const partnerId = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE code = $1", [created.body.code])).rows[0]!.id;
    const edited = await call(admin, "patch", `/crm/partners/${partnerId}`, { kind: "individual", name: "Nguyễn Thị Lan (sửa)", phone: "+84912345678", version: 1 });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
  });
});

describe("TIEUCHI_NGHIEMTHU_495: thông tin bắt buộc theo loại khách", () => {
  it("KICHBAN_KIEMTHU_683: sáu trường hợp sai báo đúng trường", async () => {
    const cases: [Record<string, unknown>, string, string][] = [
      [organization("0320066301", { taxCode: undefined }), "taxCode", "Vui lòng nhập thông tin này."],
      [organization("0320066302", { address: undefined }), "address", "Vui lòng nhập thông tin này."],
      [individual({ phone: undefined }), "phone", "Vui lòng nhập thông tin này."],
      [individual({ personalDataConsent: false }), "personalDataConsent", "Vui lòng nhập thông tin này."],
      [organization("12345"), "taxCode", "Giá trị không hợp lệ."],
      [individual({ email: "khong-phai-email" }), "email", "Giá trị không hợp lệ."],
    ];
    for (const [body, field, message] of cases) {
      const response = await send("post", "/customers", dealerKey, body);
      expect(response.status, `${field} ${JSON.stringify(response.body)}`).toBe(400);
      expect(response.body.error.fields[field], field).toBe(message);
    }
  });
});

describe("TIEUCHI_NGHIEMTHU_496: trùng mã số thuế, căn cước", () => {
  it("KICHBAN_KIEMTHU_684: dùng lại hồ sơ có sẵn, chỉ trả mã; hồ sơ ngừng hoặc chỉ nhà cung cấp trả 409", async () => {
    const staff = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Siêu thị Hòa Bình", taxCode: "0320066401", address: "Hà Nội" })).body;
    const reused = await send("post", "/customers", dealerKey, organization("0320066401", { name: "Tên đối tác gửi" }));
    expect(reused.status, JSON.stringify(reused.body)).toBe(200);
    expect(reused.body).toEqual({ code: staff.code, kind: "organization", managedByPartner: false });
    const after = (await pool.query("SELECT name, version FROM crm.partners WHERE id = $1", [staff.id])).rows[0];
    expect(after).toEqual({ name: "Siêu thị Hòa Bình", version: 1 });
    expect((await pool.query("SELECT is_customer, customer_group_id FROM crm.partner_profiles WHERE partner_id = $1 AND company_id = $2", [staff.id, retail])).rows[0]).toEqual({
      is_customer: true,
      customer_group_id: dealerGroup,
    });
    // Hồ sơ ngừng giao dịch, hồ sơ chỉ là nhà cung cấp.
    const stopped = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Đã ngừng", taxCode: "0320066402" })).body.id;
    await pool.query("UPDATE crm.partners SET status = 'inactive' WHERE id = $1", [stopped]);
    expect((await send("post", "/customers", dealerKey, organization("0320066402"))).status).toBe(409);
    const supplier = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Nhà cung cấp", taxCode: "0320066403" })).body.id;
    await call(admin, "put", `/crm/partners/${supplier}/profile`, { isCustomer: false, isSupplier: true, paymentTermDays: 0, creditLimit: null, version: 0 });
    const rejected = await send("post", "/customers", dealerKey, organization("0320066403"));
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("BUSINESS_RULE");
    // Gửi lại khách do chính phạm vi tạo: 200 đủ thông tin; hai lần gửi đồng thời chỉ một hồ sơ.
    const [first, second] = await Promise.all([send("post", "/customers", dealerKey, organization("0320066404")), send("post", "/customers", siblingKey, organization("0320066404"))]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(second.body.code).toBe(first.body.code);
    const again = await send("post", "/customers", dealerKey, organization("0320066404"));
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ managedByPartner: true, name: "Công ty 0320066404" });
    expect((await pool.query("SELECT count(*)::int AS total FROM crm.partners WHERE tax_code = '0320066404'")).rows[0].total).toBe(1);
  });
});

describe("TIEUCHI_NGHIEMTHU_497: phạm vi xem, sửa", () => {
  it("KICHBAN_KIEMTHU_685: khóa cùng đối tác thấy khách; đối tác khác, công ty khác nhận 404", async () => {
    const created = (await send("post", "/customers", dealerKey, organization("0320066501"))).body;
    expect((await send("get", `/customers/${created.code}`, siblingKey)).body).toMatchObject({ code: created.code, managedByPartner: true });
    const listed = await send("get", "/customers?pageSize=100", siblingKey);
    expect(listed.body.data.map((item: { code: string }) => item.code)).toContain(created.code);
    expect((await send("get", `/customers/${created.code}`, otherDealerKey)).status).toBe(404);
    expect((await send("get", `/customers/${created.code}`, internalKey)).status).toBe(404);
    expect((await send("get", `/customers/${created.code}`, tradingKey)).status).toBe(404);
    expect((await send("get", "/customers", tradingKey)).body.total).toBe(0);
    expect((await send("patch", `/customers/${created.code}`, otherDealerKey, { name: "Đổi", version: 1 })).status).toBe(404);
  });

  it("KICHBAN_KIEMTHU_686: sửa khách mình tạo theo version; khách gắn do trùng 409; không sửa mã số thuế", async () => {
    const created = (await send("post", "/customers", dealerKey, organization("0320066601"))).body;
    const updated = await send("patch", `/customers/${created.code}`, siblingKey, { name: "Công ty đã đổi tên", phone: "0901 234 567", email: null, version: 1 });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body).toMatchObject({ name: "Công ty đã đổi tên", phone: "+84901234567", email: null, address: "Số 1 Lê Lợi, Đà Nẵng", version: 2 });
    expect((await send("patch", `/customers/${created.code}`, dealerKey, { name: "Cũ", version: 1 })).status).toBe(409);
    expect((await send("patch", `/customers/${created.code}`, dealerKey, { taxCode: "0320066699", version: 2 })).status).toBe(400);
    const staff = (await call(admin, "post", "/crm/partners", { kind: "organization", name: "Hồ sơ nhân viên", taxCode: "0320066602" })).body;
    await send("post", "/customers", dealerKey, organization("0320066602"));
    const blocked = await send("patch", `/customers/${staff.code}`, dealerKey, { name: "Đổi", version: 1 });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toBe("Khách này không do đối tác tạo, đối tác không sửa được.");
  });
});

describe("TIEUCHI_NGHIEMTHU_498, 499: đơn ghi khách do đối tác tạo, người nhận", () => {
  it("KICHBAN_KIEMTHU_687: đơn ghi khách trong phạm vi, giá theo nhóm; khách ngoài phạm vi, ngừng dùng bị từ chối", async () => {
    const customer = (await send("post", "/customers", dealerKey, individual({ phone: "0911000001" }))).body;
    const created = await send("post", "/sales-orders", dealerKey, orderBody("WEB-6601", { customerCode: customer.code, recipient }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ customerCode: customer.code, totalAmount: "99000" });
    const other = (await send("post", "/customers", otherDealerKey, individual({ phone: "0911000002" }))).body;
    const outside = await send("post", "/sales-orders", dealerKey, orderBody("WEB-6602", { customerCode: other.code }));
    expect(outside.status).toBe(400);
    expect(outside.body.error.fields).toEqual({ customerCode: "Đối tác chưa có hồ sơ khách hàng đang dùng ở công ty." });
    await pool.query("UPDATE crm.partner_profiles SET status = 'inactive' WHERE partner_id = (SELECT id FROM crm.partners WHERE code = $1)", [customer.code]);
    expect((await send("post", "/sales-orders", dealerKey, orderBody("WEB-6603", { customerCode: customer.code }))).status).toBe(400);
    await pool.query("UPDATE crm.partner_profiles SET status = 'active' WHERE partner_id = (SELECT id FROM crm.partners WHERE code = $1)", [customer.code]);
  });

  it("KICHBAN_KIEMTHU_688: người nhận lưu, trả về; thiếu trường, sai điện thoại, có cả địa chỉ giao bị 400; nhân viên sửa đơn giữ người nhận", async () => {
    const created = await send("post", "/sales-orders", dealerKey, orderBody("WEB-6611", { recipient }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.recipient).toEqual({ name: "Trần Văn Bình", phone: "+84987654321", address: recipient.address });
    expect(created.body.deliveryAddress).toBe(recipient.address);
    expect((await send("get", "/sales-orders/WEB-6611", siblingKey)).body.recipient).toEqual(created.body.recipient);
    expect((await send("post", "/sales-orders", dealerKey, orderBody("WEB-6612"))).body.recipient).toBeNull();
    for (const [extra, field] of [
      [{ recipient: { ...recipient, name: undefined } }, "recipient.name"],
      [{ recipient: { ...recipient, phone: "12345" } }, "recipient.phone"],
      [{ recipient, deliveryAddress: "Địa chỉ khác" }, "deliveryAddress"],
    ] as const) {
      const response = await send("post", "/sales-orders", dealerKey, orderBody(`WEB-6613-${field}`, extra));
      expect(response.status, field).toBe(400);
      expect(Object.keys(response.body.error.fields), field).toEqual([field]);
    }
    const orderId = (await pool.query<{ id: string }>("SELECT id FROM sales.orders WHERE partner_order_code = 'WEB-6611'")).rows[0]!.id;
    const detail = (await call(admin, "get", `/sales/orders/${orderId}`)).body;
    expect(detail.recipient).toEqual({ name: "Trần Văn Bình", phone: "+84987654321" });
    const edit = (deliveryAddress: string | null, version: number) =>
      call(admin, "patch", `/sales/orders/${orderId}`, {
        customerId: dealerId,
        channelId,
        warehouseId,
        orderDate: today,
        deliveryAddress,
        note: "Nhân viên sửa",
        lines: [{ variantId, unitId: units.CAI, quantity: "5", discountPercent: "0" }],
        version,
      });
    const cleared = await edit(null, detail.version);
    expect(cleared.status).toBe(400);
    expect(cleared.body.error.fields).toEqual({ deliveryAddress: "Vui lòng nhập thông tin này." });
    const saved = await edit(recipient.address, detail.version);
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(saved.body.recipient).toEqual({ name: "Trần Văn Bình", phone: "+84987654321" });
  });
});

describe("TIEUCHI_NGHIEMTHU_500: hóa đơn, công nợ theo khách do đối tác tạo", () => {
  it("KICHBAN_KIEMTHU_689: ghi sổ phiếu xuất sinh hóa đơn mang tên, mã số thuế khách; công nợ theo khách", async () => {
    expect((await call(chief, "post", "/finance/ledger/setup")).status).toBe(201);
    const current = (await call(chief, "get", "/finance/einvoice-settings")).body as { version: number };
    const settings = await call(chief, "put", "/finance/einvoice-settings", {
      enabled: true,
      startDate: "2026-01-01",
      provider: "simulator",
      environment: "test",
      withTaxCode: true,
      templateCode: "1",
      appId: null,
      taxCode: null,
      username: null,
      simulation: "normal",
      series: [{ year: Number(today.slice(0, 4)), series: `C${today.slice(2, 4)}TAA` }],
      version: current.version,
    });
    expect(settings.status, JSON.stringify(settings.body)).toBe(200);
    const customer = (await send("post", "/customers", dealerKey, organization("0320066901", { name: "Công ty Nội thất An Phú" }))).body;
    expect((await send("post", "/sales-orders", dealerKey, orderBody("WEB-6901", { customerCode: customer.code, recipient }))).status).toBe(201);
    const order = (await pool.query<{ id: string; customer_id: string }>("SELECT id, customer_id FROM sales.orders WHERE partner_order_code = 'WEB-6901'")).rows[0]!;
    const submitted = await call(admin, "post", `/sales/orders/${order.id}/submit`);
    expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("confirmed");
    const issued = await call(admin, "post", "/inventory/sales-issues", { orderId: order.id, documentDate: today, lines: [{ orderLineId: submitted.body.lines[0].id, quantity: "10" }] });
    expect(issued.status, JSON.stringify(issued.body)).toBe(201);
    const posted = await call(admin, "post", `/inventory/documents/${issued.body.id}/submit`);
    expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
    const invoiceId = (await pool.query<{ id: string }>("SELECT id FROM finance.einvoices WHERE source_document_id = $1 AND kind = 'original'", [issued.body.id])).rows[0]!.id;
    const invoice = (await call(accountant, "get", `/finance/einvoices/${invoiceId}`)).body;
    expect(invoice.buyer).toMatchObject({ name: "Công ty Nội thất An Phú", taxCode: "0320066901" });
    const receivable = await pool.query(
      `SELECT DISTINCT l.partner_id FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id JOIN accounting.accounts a ON a.id = l.account_id
       WHERE j.source_id = $1 AND a.code LIKE '131%'`,
      [issued.body.id],
    );
    expect(receivable.rows).toEqual([{ partner_id: order.customer_id }]);
  });
});

describe("TIEUCHI_NGHIEMTHU_501: nhật ký thao tác, nhật ký gọi", () => {
  it("KICHBAN_KIEMTHU_690: tác nhân là khóa, không có số căn cước; nhật ký gọi không có dữ liệu cá nhân", async () => {
    const created = (await send("post", "/customers", dealerKey, individual({ phone: "0911000090", citizenId: "001090000666" }))).body;
    const partnerId = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE code = $1", [created.code])).rows[0]!.id;
    await send("patch", `/customers/${created.code}`, dealerKey, { address: "Số 9 Hai Bà Trưng", version: 1 });
    await send("post", "/customers", siblingKey, individual({ phone: "0911000091", citizenId: "001090000666" }));
    const audit = await pool.query("SELECT action, actor_user_id, after_data::text AS data FROM core.audit_events WHERE entity_type = 'partner' AND entity_id = $1 ORDER BY occurred_at", [partnerId]);
    expect(audit.rows.map((row) => row.action)).toEqual(["partner.create", "partner.update"]);
    expect(audit.rows.every((row) => row.actor_user_id === null)).toBe(true);
    const text = audit.rows.map((row) => row.data).join(" ");
    expect(text).not.toContain("001090000666");
    expect(text).toContain('"keyPrefix"');
    await send("get", "/customers?pageSize=5&q=Nguyen%20Thi%20Lan", dealerKey);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const paths = (await pool.query<{ path: string }>("SELECT path FROM core.api_call_logs WHERE path LIKE '/api/v1/open/customers%'")).rows.map((row) => row.path).join(" ");
    expect(paths).toContain("/api/v1/open/customers?pageSize=5");
    expect(paths).not.toContain("Nguyen");
    expect(paths).not.toContain("0911000090");
  });
});
