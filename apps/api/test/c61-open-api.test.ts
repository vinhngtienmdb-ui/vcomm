// CONG_VIEC_61 lát L1: Open API cho đối tác – khóa API, xác thực, IP, phạm vi, giới hạn tần suất, nhật ký gọi, sản phẩm, giá, tồn
// (TIEUCHI_NGHIEMTHU_444 đến 452; KICHBAN_KIEMTHU_623 đến 633).
// Giá: bảng chung gồm thuế 11.000 một cái; bảng nhóm Đại lý 9.900 một cái, 95.000 một hộp (hộp = 10 cái).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { ApiCallLogsService } from "../src/open-api/api-call-logs.service";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication, testClock, testRateLimit } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let admin: Session;
let tradingAdmin: Session;
let employee: Session;
let today: string;
let warehouseId: string;
let otherWarehouseId: string;
let channelId: string;
let dealerId: string;
let inactivePartnerId: string;
let variantId: string;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
const units: Record<string, string> = {} as Record<string, string>;
const unit = (code: string): string => units[code]!;

const call = (session: Session, method: "get" | "post" | "patch", path: string, body?: unknown, companyId = retail) => session.call(method, path, { companyId, body });
// Gọi API đối tác bằng khóa, giả lập IP người gọi qua X-Forwarded-For (trust proxy 1).
const open = (path: string, key: string | null, ip = "203.113.10.24") => {
  const sent = request(application.getHttpServer()).get(`/api/v1/open${path}`).set("accept-language", "vi").set("x-forwarded-for", ip);
  return key ? sent.set("authorization", `Bearer ${key}`) : sent;
};
const keyBody = (extra: Record<string, unknown> = {}) => ({
  kind: "partner",
  partnerId: dealerId,
  name: `Đại lý ${Math.random().toString(36).slice(2, 8)}`,
  scopes: ["catalog.read"],
  channelId,
  warehouseIds: [warehouseId],
  ...extra,
});
async function issue(extra: Record<string, unknown> = {}): Promise<{ id: string; secret: string; version: number }> {
  const created = await call(admin, "post", "/platform/api-keys", keyBody(extra));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return { id: created.body.key.id, secret: created.body.secret, version: created.body.key.version };
}
const tomorrow = () => new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  tradingAdmin = groupAdmin;
  await createTestUser(pool, "nhanvien.openapi@vcomm.test", "Nhân viên thường", [{ companyId: retail }]);
  const employeeRole = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'employee' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) SELECT id, $1, 'company', $2, '2026-01-01' FROM core.users WHERE email = $3", [
    employeeRole,
    retail,
    "nhanvien.openapi@vcomm.test",
  ]);
  employee = await signIn(application, "nhanvien.openapi@vcomm.test");

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "OAPI", nameVi: "Open API", nameEn: "Open API" } })).body.id;
  const product = await call(admin, "post", "/catalog/products", {
    categoryId: category,
    name: "Bánh quy Open API",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: unit("CAI"),
    units: [{ unitId: unit("HOP"), factor: "10" }],
    variants: [{ barcodes: [{ barcode: "8930000000611", unitId: unit("CAI") }] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  variantId = product.body.variants[0].id;
  const warehouse = async (code: string) =>
    (await call(admin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code, name: `Kho ${code}`, usesLocations: false })).body.id as string;
  warehouseId = await warehouse("OAPI1");
  otherWarehouseId = await warehouse("OAPI2");
  for (const [target, quantity] of [
    [warehouseId, "120"],
    [otherWarehouseId, "7"],
  ] as const) {
    const receipt = await call(admin, "post", "/inventory/documents", {
      type: "receipt_other",
      warehouseId: target,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [{ variantId, unitId: unit("CAI"), quantity, unitCost: "8000" }],
    });
    expect((await call(admin, "post", `/inventory/documents/${receipt.body.id}/submit`)).body.status).toBe("posted");
  }
  // Giữ 20 cái ở kho thứ nhất: khả dụng 100.
  await pool.query(
    "INSERT INTO inventory.reservations (company_id, warehouse_id, variant_id, quantity, source_type, source_id, status) VALUES ($1, $2, $3, 20, 'sales_order', gen_random_uuid(), 'active')",
    [retail, warehouseId, variantId],
  );
  const channels = (await call(admin, "post", "/catalog/sales-channels/defaults")).body as { id: string; code: string }[];
  channelId = channels.find((channel) => channel.code === "BAN_SI")!.id;
  const dealerGroup = (await call(admin, "post", "/catalog/customer-groups", { code: "DAI_LY", name: "Đại lý cấp 1" })).body.id;
  const priceList = async (code: string, customerGroupId: string | null, lines: { unitId: string; price: string }[]) => {
    const list = (await call(admin, "post", "/catalog/price-lists", { code, name: code, customerGroupId, includesVat: true })).body.id;
    const change = await call(admin, "post", "/catalog/price-changes", { priceListId: list, effectiveFrom: today, lines: lines.map((line) => ({ variantId, ...line })) });
    expect((await call(admin, "post", `/catalog/price-changes/${change.body.id}/submit`)).status).toBe(201);
  };
  await priceList("CHUNG", null, [{ unitId: unit("CAI"), price: "11000" }]);
  await priceList("DAILY", dealerGroup, [
    { unitId: unit("CAI"), price: "9900" },
    { unitId: unit("HOP"), price: "95000" },
  ]);
  const partner = async (name: string, taxCode: string, active: boolean) => {
    const id = (await call(admin, "post", "/crm/partners", { kind: "organization", name, taxCode })).body.id as string;
    const profile = await admin.call("put", `/crm/partners/${id}/profile`, {
      companyId: retail,
      body: { isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: null, customerGroupId: dealerGroup, version: 0 },
    });
    expect(profile.status, JSON.stringify(profile.body)).toBe(200);
    if (!active) await pool.query("UPDATE crm.partner_profiles SET status = 'inactive' WHERE partner_id = $1", [id]);
    return id;
  };
  dealerId = await partner("Công ty TNHH Phân phối Minh Long", "0320006101", true);
  inactivePartnerId = await partner("Đại lý đã ngừng", "0320006102", false);
});

afterAll(async () => {
  testClock.fixed = null;
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_444: cấp khóa, khóa chỉ hiện một lần", () => {
  it("KICHBAN_KIEMTHU_623: kết quả cấp có khóa đầy đủ; cơ sở dữ liệu, danh sách, chi tiết chỉ có băm và 8 ký tự đầu", async () => {
    const created = await call(admin, "post", "/platform/api-keys", keyBody({ name: "Minh Long · máy chủ chính", allowedIps: ["203.113.10.24", "203.113.10.0/28"], expiresOn: "2027-12-31" }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const secret = created.body.secret as string;
    expect(secret).toMatch(/^vck_[A-Za-z0-9]{32}$/);
    expect(created.body.key).toMatchObject({
      kind: "partner",
      keyPrefix: secret.slice(4, 12),
      partnerId: dealerId,
      status: "active",
      rateLimitPerMinute: 60,
      partnerCustomerGroupName: "Đại lý cấp 1",
    });
    expect(created.body.key.allowedIps).toEqual(["203.113.10.24", "203.113.10.0/28"]);
    const stored = await pool.query("SELECT key_hash, key_prefix FROM core.api_keys WHERE id = $1", [created.body.key.id]);
    expect(stored.rows[0].key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored.rows)).not.toContain(secret);
    const listed = await call(admin, "get", "/platform/api-keys");
    expect(listed.status).toBe(200);
    expect(JSON.stringify(listed.body)).not.toContain(secret);
    const detail = await call(admin, "get", `/platform/api-keys/${created.body.key.id}`);
    expect(JSON.stringify(detail.body)).not.toContain(secret);
    expect(detail.body.warehouses.map((warehouse: { id: string }) => warehouse.id)).toEqual([warehouseId]);
  });

  it("nhân viên không có quyền nhận 403; danh sách lựa chọn chỉ có khách hàng đang giao dịch", async () => {
    expect((await call(employee, "get", "/platform/api-keys")).status).toBe(403);
    expect((await call(employee, "post", "/platform/api-keys", keyBody())).status).toBe(403);
    expect((await call(employee, "get", "/platform/api-call-logs")).status).toBe(403);
    const options = await call(admin, "get", "/platform/api-keys/options");
    expect(options.body.partners.map((partner: { id: string }) => partner.id)).toContain(dealerId);
    expect(options.body.partners.map((partner: { id: string }) => partner.id)).not.toContain(inactivePartnerId);
  });
});

describe("TIEUCHI_NGHIEMTHU_445: cấp khóa sai báo lỗi đúng trường", () => {
  it("KICHBAN_KIEMTHU_624: bảy trường hợp", async () => {
    const tradingWarehouse = (await call(tradingAdmin, "post", "/inventory/warehouses", { branchId: null, code: "OAPIT", name: "Kho thương mại", usesLocations: false }, trading)).body?.id;
    const cases: [Record<string, unknown>, string, number][] = [
      [{ scopes: [] }, "scopes", 400],
      [{ rateLimitPerMinute: 601 }, "rateLimitPerMinute", 400],
      [{ rateLimitPerMinute: 0 }, "rateLimitPerMinute", 400],
      [{ partnerId: inactivePartnerId }, "partnerId", 400],
      [{ allowedIps: ["300.1.1.1"] }, "allowedIps", 400],
      [{ expiresOn: today }, "expiresOn", 400],
      [{ warehouseIds: [] }, "warehouseIds", 400],
    ];
    if (tradingWarehouse) cases.push([{ warehouseIds: [tradingWarehouse] }, "warehouseIds", 400]);
    for (const [extra, field, status] of cases) {
      const response = await call(admin, "post", "/platform/api-keys", keyBody(extra));
      expect(response.status, JSON.stringify(extra)).toBe(status);
      expect(Object.keys(response.body.error.fields ?? {}).join(","), JSON.stringify(response.body)).toContain(field);
    }
    const name = "Tên trùng";
    await issue({ name });
    const duplicate = await call(admin, "post", "/platform/api-keys", keyBody({ name }));
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error.fields.name).toBe("Tên khóa đã có trong công ty.");
    // Khóa nội bộ không gắn đối tác.
    const internal = await call(admin, "post", "/platform/api-keys", keyBody({ kind: "internal", partnerId: null, name: "Phần mềm kế toán" }));
    expect(internal.status, JSON.stringify(internal.body)).toBe(201);
    expect(internal.body.key.partnerId).toBeNull();
    expect((await call(admin, "post", "/platform/api-keys", keyBody({ kind: "internal", partnerId: dealerId }))).status).toBe(400);
  });
});

describe("TIEUCHI_NGHIEMTHU_446: khóa không hợp lệ nhận 401 cùng thông báo", () => {
  it("KICHBAN_KIEMTHU_625: thiếu, sai, hết hạn, thu hồi, chuỗi cũ sau cấp lại, đối tác ngừng giao dịch", async () => {
    const expiring = await issue({ expiresOn: tomorrow() });
    const revoked = await issue();
    const rotated = await issue();
    const partnerStopped = await issue();
    expect((await open("/products", expiring.secret)).status).toBe(200);
    expect((await call(admin, "post", `/platform/api-keys/${revoked.id}/revoke`, { reason: "Đối tác ngừng hợp tác", version: revoked.version })).status).toBe(200);
    const newSecret = (await call(admin, "post", `/platform/api-keys/${rotated.id}/rotate`, { version: rotated.version })).body.secret as string;
    expect(newSecret).not.toBe(rotated.secret);
    expect((await open("/products", newSecret)).status).toBe(200);
    await pool.query("UPDATE crm.partners SET status = 'inactive' WHERE id = $1", [dealerId]);
    const stoppedResponse = await open("/products", partnerStopped.secret);
    await pool.query("UPDATE crm.partners SET status = 'active' WHERE id = $1", [dealerId]);
    testClock.fixed = new Date(Date.parse(`${tomorrow()}T12:00:00+07:00`) + 86_400_000);
    const expiredResponse = await open("/products", expiring.secret);
    testClock.fixed = null;
    const responses = [
      await open("/products", null),
      await open("/products", "vck_saikhoasaikhoasaikhoasaikhoa12"),
      await open("/products", "khong-dung-dinh-dang"),
      expiredResponse,
      await open("/products", revoked.secret),
      await open("/products", rotated.secret),
      stoppedResponse,
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "Khóa API không hợp lệ, đã hết hạn hoặc đã bị thu hồi." });
    }
    // Khóa đã thu hồi không sửa, không cấp lại được.
    const detail = (await call(admin, "get", `/platform/api-keys/${revoked.id}`)).body;
    expect(detail).toMatchObject({ status: "revoked", revokedReason: "Đối tác ngừng hợp tác" });
    expect((await call(admin, "post", `/platform/api-keys/${revoked.id}/rotate`, { version: detail.version })).status).toBe(409);
  });

  it("KICHBAN_KIEMTHU_626: sai khóa 21 lần một phút từ một IP thì lần 21 nhận 429", async () => {
    testRateLimit.perMinute = 20;
    testClock.fixed = new Date();
    try {
      for (let attempt = 1; attempt <= 20; attempt += 1) expect((await open("/stock", "vck_saikhoasaikhoasaikhoasaikhoa12", "198.51.100.7")).status).toBe(401);
      const limited = await open("/stock", "vck_saikhoasaikhoasaikhoasaikhoa12", "198.51.100.7");
      expect(limited.status).toBe(429);
      expect(limited.headers["retry-after"]).toBeTruthy();
    } finally {
      testRateLimit.perMinute = 1_000_000;
      testClock.fixed = null;
    }
  });
});

describe("TIEUCHI_NGHIEMTHU_447: danh sách IP, phạm vi quyền", () => {
  it("KICHBAN_KIEMTHU_627: IP ngoài danh sách nhận 403; IP trong dải CIDR, IPv6 được", async () => {
    const key = await issue({ allowedIps: ["203.113.10.24", "203.113.20.0/28", "2001:db8::/32"] });
    expect((await open("/products", key.secret, "203.113.10.24")).status).toBe(200);
    expect((await open("/products", key.secret, "203.113.20.9")).status).toBe(200);
    expect((await open("/products", key.secret, "2001:db8::1")).status).toBe(200);
    const denied = await open("/products", key.secret, "203.113.20.16");
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("IP_NOT_ALLOWED");
  });

  it("KICHBAN_KIEMTHU_628: khóa không có phạm vi Sản phẩm nhận 403 SCOPE_NOT_GRANTED", async () => {
    const key = await issue({ scopes: ["sales_order.write"] });
    const response = await open("/stock", key.secret);
    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: "SCOPE_NOT_GRANTED", message: "Khóa API không được cấp quyền dùng API này." });
  });
});

describe("TIEUCHI_NGHIEMTHU_448: giới hạn tần suất theo khóa", () => {
  it("KICHBAN_KIEMTHU_629: giới hạn 3, lần 4 nhận 429; khóa khác vẫn gọi được", async () => {
    const limited = await issue({ rateLimitPerMinute: 3 });
    const other = await issue({ rateLimitPerMinute: 3 });
    testClock.fixed = new Date();
    try {
      const remaining: string[] = [];
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const response = await open("/stock", limited.secret);
        expect(response.status).toBe(200);
        expect(response.headers["x-ratelimit-limit"]).toBe("3");
        remaining.push(String(response.headers["x-ratelimit-remaining"]));
      }
      expect(remaining).toEqual(["2", "1", "0"]);
      const blocked = await open("/stock", limited.secret);
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
      expect((await open("/stock", other.secret)).status).toBe(200);
      // Sửa giới hạn có hiệu lực từ lần gọi kế tiếp.
      const detail = (await call(admin, "get", `/platform/api-keys/${limited.id}`)).body;
      const updated = await call(admin, "patch", `/platform/api-keys/${limited.id}`, {
        name: detail.name,
        scopes: detail.scopes,
        channelId,
        warehouseIds: [warehouseId],
        rateLimitPerMinute: 10,
        expiresOn: null,
        allowedIps: [],
        version: detail.version,
      });
      expect(updated.status, JSON.stringify(updated.body)).toBe(200);
      expect((await open("/stock", limited.secret)).status).toBe(200);
    } finally {
      testClock.fixed = null;
    }
  });
});

describe("TIEUCHI_NGHIEMTHU_449: nhật ký gọi", () => {
  it("KICHBAN_KIEMTHU_630: mỗi lần gọi có một dòng, không có nội dung; bỏ tham số ngoài danh sách; dọn dòng quá 90 ngày", async () => {
    const key = await issue({ name: "Khóa nhật ký" });
    expect((await open("/stock?warehouse=OAPI1&sku=BI-MAT", key.secret)).status).toBe(200);
    expect((await open("/products?pageSize=1000", key.secret)).status).toBe(400);
    // Nhật ký ghi sau khi trả kết quả.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const logs = await call(admin, "get", `/platform/api-call-logs?apiKeyId=${key.id}`);
    expect(logs.status).toBe(200);
    expect(logs.body.total).toBe(2);
    const [validation, success] = logs.body.data;
    expect(success).toMatchObject({ apiKeyName: "Khóa nhật ký", method: "GET", path: "/api/v1/open/stock?warehouse=OAPI1", statusCode: 200, errorCode: null, ip: "203.113.10.24" });
    expect(success.requestId).toBeTruthy();
    expect(validation).toMatchObject({ statusCode: 400, errorCode: "VALIDATION_FAILED", path: "/api/v1/open/products?pageSize=1000" });
    expect((await call(admin, "get", `/platform/api-call-logs?apiKeyId=${key.id}&result=client_error`)).body.total).toBe(1);
    expect((await call(admin, "get", `/platform/api-call-logs?apiKeyId=${key.id}&result=success`)).body.total).toBe(1);
    expect((await call(admin, "get", `/platform/api-keys/${key.id}`)).body.stats).toMatchObject({ calls24h: 2, errors24h: 1, lastIp: "203.113.10.24" });
    await pool.query(
      "INSERT INTO core.api_call_logs (api_key_id, company_id, called_at, method, path, status_code, duration_ms) VALUES ($1, $2, now() - interval '91 days', 'GET', '/api/v1/open/stock', 200, 5), ($1, $2, now() - interval '89 days', 'GET', '/api/v1/open/stock', 200, 5)",
      [key.id, retail],
    );
    expect(await application.get(ApiCallLogsService).purgeExpired(new Date())).toBeGreaterThanOrEqual(1);
    expect((await call(admin, "get", `/platform/api-call-logs?apiKeyId=${key.id}`)).body.total).toBe(3);
  });
});

describe("TIEUCHI_NGHIEMTHU_450: không lộ dữ liệu giữa công ty", () => {
  it("KICHBAN_KIEMTHU_631: khóa, nhật ký của công ty khác trả 404 hoặc rỗng", async () => {
    const key = await issue({ name: "Khóa riêng VCR" });
    expect((await call(tradingAdmin, "get", `/platform/api-keys/${key.id}`, undefined, trading)).status).toBe(404);
    expect((await call(tradingAdmin, "post", `/platform/api-keys/${key.id}/rotate`, { version: key.version }, trading)).status).toBe(404);
    expect((await call(tradingAdmin, "get", "/platform/api-keys", undefined, trading)).body).toEqual([]);
    expect((await call(tradingAdmin, "get", `/platform/api-call-logs?apiKeyId=${key.id}`, undefined, trading)).body.total).toBe(0);
    // Quản trị công ty VCR không chọn được công ty VCT.
    expect((await call(admin, "get", "/platform/api-keys", undefined, trading)).status).toBe(403);
  });
});

describe("TIEUCHI_NGHIEMTHU_451: sản phẩm, giá, tồn", () => {
  it("KICHBAN_KIEMTHU_632: khóa đối tác thấy giá nhóm Đại lý; khóa nội bộ thấy giá chung; tồn trừ giữ hàng, chỉ kho của khóa", async () => {
    const dealer = await issue();
    const products = await open("/products", dealer.secret);
    expect(products.status).toBe(200);
    const item = products.body.data.find((row: { productName: string }) => row.productName === "Bánh quy Open API");
    expect(item).toMatchObject({ vatRate: "10", baseUnitCode: "CAI", barcodes: [{ barcode: "8930000000611", unitCode: "CAI" }] });
    expect(item.units).toEqual([
      { unitCode: "CAI", unitName: "Cái", factor: "1", price: "9900", priceIncludesVat: true },
      { unitCode: "HOP", unitName: "Hộp", factor: "10", price: "95000", priceIncludesVat: true },
    ]);
    const internal = await issue({ kind: "internal", partnerId: null });
    const internalItem = (await open("/products", internal.secret)).body.data.find((row: { productName: string }) => row.productName === "Bánh quy Open API");
    expect(internalItem.units).toEqual([
      { unitCode: "CAI", unitName: "Cái", factor: "1", price: "11000", priceIncludesVat: true },
      { unitCode: "HOP", unitName: "Hộp", factor: "10", price: "110000", priceIncludesVat: true },
    ]);
    const stock = await open(`/stock?sku=${item.sku}`, dealer.secret);
    expect(stock.body.data).toEqual([{ sku: item.sku, warehouseCode: "OAPI1", available: "100", unitCode: "CAI" }]);
    const both = await issue({ warehouseIds: [warehouseId, otherWarehouseId] });
    expect((await open(`/stock?sku=${item.sku.toLowerCase()}`, both.secret)).body.data.map((row: { available: string }) => row.available)).toEqual(["100", "7"]);
    expect((await open(`/stock?sku=${item.sku}&warehouse=OAPI2`, both.secret)).body.data).toEqual([{ sku: item.sku, warehouseCode: "OAPI2", available: "7", unitCode: "CAI" }]);
  });
});

describe("TIEUCHI_NGHIEMTHU_452: nhật ký thao tác không chứa khóa", () => {
  it("KICHBAN_KIEMTHU_633: cấp, sửa, cấp lại, thu hồi đều ghi nhật ký", async () => {
    const key = await issue({ name: "Khóa kiểm nhật ký" });
    const detail = (await call(admin, "get", `/platform/api-keys/${key.id}`)).body;
    const updated = await call(admin, "patch", `/platform/api-keys/${key.id}`, {
      name: "Khóa kiểm nhật ký mới",
      scopes: ["catalog.read", "sales_order.write"],
      channelId,
      warehouseIds: [warehouseId],
      rateLimitPerMinute: 30,
      expiresOn: null,
      allowedIps: [],
      version: detail.version,
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    const stale = await call(admin, "patch", `/platform/api-keys/${key.id}`, {
      name: "Khóa cũ",
      scopes: ["catalog.read"],
      channelId,
      warehouseIds: [warehouseId],
      rateLimitPerMinute: 30,
      expiresOn: null,
      allowedIps: [],
      version: detail.version,
    });
    expect(stale.status).toBe(409);
    const rotated = await call(admin, "post", `/platform/api-keys/${key.id}/rotate`, { version: updated.body.version });
    expect((await call(admin, "post", `/platform/api-keys/${key.id}/revoke`, { reason: "Lộ khóa", version: rotated.body.key.version })).status).toBe(200);
    const audit = await pool.query("SELECT action, after_data::text AS data FROM core.audit_events WHERE entity_type = 'api_key' AND entity_id = $1 ORDER BY occurred_at", [key.id]);
    expect(audit.rows.map((row) => row.action)).toEqual(["api_key.create", "api_key.update", "api_key.rotate", "api_key.revoke"]);
    const text = audit.rows.map((row) => row.data).join(" ");
    expect(text).not.toContain(key.secret);
    expect(text).not.toContain(rotated.body.secret);
    const history = (await call(admin, "get", `/platform/api-keys/${key.id}`)).body.history;
    expect(history.map((entry: { action: string }) => entry.action)).toEqual(["api_key.revoke", "api_key.rotate", "api_key.update", "api_key.create"]);
  });
});

// ---------- Lát L2: đơn bán qua Open API (TIEUCHI_NGHIEMTHU_453 đến 456; KICHBAN_KIEMTHU_634 đến 637) ----------

const send = (method: "post" | "get", path: string, key: string, body?: unknown) => {
  const sent = request(application.getHttpServer())[method](`/api/v1/open${path}`).set("accept-language", "vi").set("x-forwarded-for", "203.113.10.24").set("authorization", `Bearer ${key}`);
  return body === undefined ? sent : sent.send(body as object);
};
const orderBody = (code: string, extra: Record<string, unknown> = {}) => ({
  partnerOrderCode: code,
  warehouseCode: "OAPI1",
  deliveryAddress: "Số 12 Trần Phú, Hà Đông, Hà Nội",
  note: "Giao trước 17 giờ",
  lines: [{ sku: skuOf(), unitCode: "CAI", quantity: "10" }],
  ...extra,
});
let sku = "";
const skuOf = () => sku;

describe("TIEUCHI_NGHIEMTHU_453: đối tác tạo đơn bán Nháp", () => {
  it("KICHBAN_KIEMTHU_634: đơn Nháp, khách là đối tác, giá như đơn nhập trên web; cài đặt hàng hóa tắt thì từ chối", async () => {
    sku = (await pool.query<{ sku: string }>("SELECT sku FROM catalog.variants WHERE id = $1", [variantId])).rows[0]!.sku;
    const key = await issue({ name: "Đơn bán Minh Long", scopes: ["catalog.read", "sales_order.write"] });
    // QUYTAC_NGHIEPVU_276: công ty chưa bật cài đặt hàng hóa thì đơn qua API chỉ được dịch vụ.
    const blocked = await send("post", "/sales-orders", key.secret, orderBody("ML-0001"));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toContain("dịch vụ");
    await pool.query("INSERT INTO sales.settings (company_id, allow_manual_goods_orders, version) VALUES ($1, true, 0) ON CONFLICT (company_id) DO UPDATE SET allow_manual_goods_orders = true", [
      retail,
    ]);
    const created = await send("post", "/sales-orders", key.secret, orderBody("ML-0001"));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({
      partnerOrderCode: "ML-0001",
      status: "draft",
      documentNo: null,
      warehouseCode: "OAPI1",
      totalAmount: "99000",
      deliveryAddress: "Số 12 Trần Phú, Hà Đông, Hà Nội",
    });
    expect(created.body.lines).toMatchObject([{ sku, unitCode: "CAI", quantity: "10", totalAmount: "99000", isGift: false }]);
    // Nhân viên thấy nguồn Open API, mã đơn đối tác; người lập là người cấp khóa.
    const listed = await call(admin, "get", "/sales/orders?source=open_api&search=ML-0001");
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    const order = listed.body.data[0];
    expect(order).toMatchObject({ customerId: dealerId, status: "draft", createdByName: "Trần Minh Quân", openApi: { keyName: "Đơn bán Minh Long", partnerOrderCode: "ML-0001" } });
    expect((await call(admin, "get", "/sales/orders?source=web")).body.data.map((item: { id: string }) => item.id)).not.toContain(order.id);
    // Cùng hàng, cùng khách nhập trên web ra cùng tổng tiền.
    const web = await call(admin, "post", "/sales/orders", {
      customerId: dealerId,
      channelId,
      warehouseId,
      orderDate: today,
      lines: [{ variantId, unitId: unit("CAI"), quantity: "10", discountPercent: "0" }],
    });
    expect(web.status, JSON.stringify(web.body)).toBe(201);
    expect(web.body.totalAmount).toBe(order.totalAmount);
    const audit = await pool.query("SELECT actor_user_id, after_data FROM core.audit_events WHERE action = 'sales_order.create' AND entity_id = $1", [order.id]);
    expect(audit.rows[0].actor_user_id).toBeNull();
    expect(audit.rows[0].after_data.openApi).toMatchObject({ keyName: "Đơn bán Minh Long", partnerOrderCode: "ML-0001" });
  });
});

describe("TIEUCHI_NGHIEMTHU_454: không tạo trùng theo mã đơn đối tác", () => {
  it("KICHBAN_KIEMTHU_635: hai yêu cầu cùng lúc một đơn; gửi lại nhận 200 đơn cũ", async () => {
    const key = await issue({ name: "Đơn song song", scopes: ["sales_order.write"] });
    const [first, second] = await Promise.all([send("post", "/sales-orders", key.secret, orderBody("ML-SS-1")), send("post", "/sales-orders", key.secret, orderBody("ML-SS-1"))]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    const again = await send("post", "/sales-orders", key.secret, orderBody("ML-SS-1", { lines: [{ sku, unitCode: "HOP", quantity: "1" }] }));
    expect(again.status).toBe(200);
    expect(again.body.lines[0].unitCode).toBe("CAI");
    // Khóa khác của cùng đối tác dùng chung phạm vi mã đơn.
    const sibling = await issue({ name: "Đơn song song 2", scopes: ["sales_order.write"] });
    expect((await send("post", "/sales-orders", sibling.secret, orderBody("ML-SS-1"))).status).toBe(200);
    const count = await pool.query("SELECT count(*)::int AS total FROM sales.orders WHERE partner_order_code = 'ML-SS-1'");
    expect(count.rows[0].total).toBe(1);
  });
});

describe("TIEUCHI_NGHIEMTHU_455: dữ liệu đơn sai bị từ chối đúng dòng", () => {
  it("KICHBAN_KIEMTHU_636: kho ngoài khóa, mã hàng, đơn vị sai, khách hàng với khóa đối tác", async () => {
    const key = await issue({ name: "Đơn sai", scopes: ["sales_order.write"] });
    const cases: [Record<string, unknown>, string][] = [
      [{ warehouseCode: "OAPI2" }, "warehouseCode"],
      [{ lines: [{ sku: "KHONG-CO", unitCode: "CAI", quantity: "1" }] }, "lines.0.sku"],
      [
        {
          lines: [
            { sku, unitCode: "CAI", quantity: "1" },
            { sku, unitCode: "CHIEC", quantity: "1" },
          ],
        },
        "lines.1.unitCode",
      ],
      [{ customerCode: "DT999999" }, "customerCode"],
      [{ lines: [{ sku, unitCode: "CAI", quantity: "0" }] }, "lines.0.quantity"],
    ];
    for (const [extra, field] of cases) {
      const response = await send("post", "/sales-orders", key.secret, orderBody(`ML-SAI-${field}`, extra));
      expect(response.status, JSON.stringify(response.body)).toBe(400);
      expect(Object.keys(response.body.error.fields)).toContain(field);
    }
    expect((await send("post", "/sales-orders", key.secret, { ...orderBody("mã có dấu cách") })).status).toBe(400);
    expect((await pool.query("SELECT count(*)::int AS total FROM sales.orders WHERE partner_order_code LIKE 'ML-SAI-%'")).rows[0].total).toBe(0);
  });
});

describe("TIEUCHI_NGHIEMTHU_456: hủy, tra đơn trong phạm vi đối tác", () => {
  it("KICHBAN_KIEMTHU_637: hủy Nháp được; đã gửi duyệt nhận 409; đối tác khác, khóa nội bộ không thấy", async () => {
    const key = await issue({ name: "Đơn hủy", scopes: ["sales_order.write"] });
    expect((await send("post", "/sales-orders", key.secret, orderBody("ML-HUY-1"))).status).toBe(201);
    expect((await send("post", "/sales-orders", key.secret, orderBody("ML-HUY-2"))).status).toBe(201);
    const cancelled = await send("post", "/sales-orders/ML-HUY-1/cancel", key.secret, { reason: "Khách đổi ý" });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.status).toBe("cancelled");
    const audit = await pool.query("SELECT after_data FROM core.audit_events WHERE action = 'sales_order.cancel' AND after_data->>'reason' = 'Khách đổi ý'");
    expect(audit.rows).toHaveLength(1);
    // Nhân viên gửi duyệt đơn thứ hai: đối tác không hủy được nữa.
    const staffOrder = (await call(admin, "get", "/sales/orders?search=ML-HUY-2")).body.data[0];
    const submitted = await call(admin, "post", `/sales/orders/${staffOrder.id}/submit`);
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
    const late = await send("post", "/sales-orders/ML-HUY-2/cancel", key.secret, { reason: "Muộn" });
    expect(late.status).toBe(409);
    const viewed = await send("get", "/sales-orders/ML-HUY-2", key.secret);
    expect(viewed.body.status).not.toBe("draft");
    expect(viewed.body.documentNo).toBeTruthy();
    const listed = await send("get", "/sales-orders?status=cancelled", key.secret);
    expect(listed.body.data.map((item: { partnerOrderCode: string }) => item.partnerOrderCode)).toContain("ML-HUY-1");
    // Đối tác khác và khóa nội bộ không tra được đơn của Minh Long.
    const otherPartner = await call(admin, "post", "/crm/partners", { kind: "organization", name: "Đại lý khác", taxCode: "0320006103" });
    await admin.call("put", `/crm/partners/${otherPartner.body.id}/profile`, {
      companyId: retail,
      body: { isCustomer: true, isSupplier: false, paymentTermDays: 0, creditLimit: null, customerGroupId: null, version: 0 },
    });
    const other = await issue({ name: "Đại lý khác", partnerId: otherPartner.body.id, scopes: ["sales_order.write"] });
    expect((await send("get", "/sales-orders/ML-HUY-2", other.secret)).status).toBe(404);
    expect((await send("get", "/sales-orders", other.secret)).body.total).toBe(0);
    const internal = await issue({ name: "Nội bộ đơn", kind: "internal", partnerId: null, scopes: ["sales_order.write"] });
    expect((await send("get", "/sales-orders/ML-HUY-2", internal.secret)).status).toBe(404);
    // Khóa nội bộ đặt cho khách của công ty theo mã đối tác.
    const dealerCode = (await pool.query<{ code: string }>("SELECT code FROM crm.partners WHERE id = $1", [dealerId])).rows[0]!.code;
    const internalOrder = await send("post", "/sales-orders", internal.secret, orderBody("ML-HUY-2", { customerCode: dealerCode }));
    expect(internalOrder.status, JSON.stringify(internalOrder.body)).toBe(201);
    expect(internalOrder.body.customerCode).toBe(dealerCode);
  });
});
