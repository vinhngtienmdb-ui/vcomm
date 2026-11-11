// CONG_VIEC_44: ứng dụng kho – đăng nhập ứng dụng kho, thao tác kho bằng token, đếm kiểm kê cộng dồn (TIEUCHI_NGHIEMTHU_278 đến 280).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, totpCode, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let groupAdmin: Session;
let today: string;
const retail: string = testIds.retailCompany;
const ids: Record<string, string> = {};
const units: Record<string, string> = {};
const items: Record<string, string> = {};
const warehouses: Record<string, string> = {};

const http = () => request(application.getHttpServer());
const appLogin = (identifier: string) => http().post("/api/v1/auth/warehouse-app/login").send({ identifier, password: "MatKhauThu@2026" });
// Gọi API bằng header Authorization như ứng dụng kho: không cookie, không CSRF.
const bearer = (token: string) => (method: "get" | "post" | "put", path: string, body?: object) => {
  const call = http()[method](`/api/v1${path}`).set("authorization", `Bearer ${token}`).set("x-company-id", retail).set("accept-language", "vi");
  return body ? call.send(body) : call;
};
type Caller = ReturnType<typeof bearer>;

async function assign(key: string, email: string, role: string, branchId: string) {
  ids[key] = await createTestUser(pool, email, `Kho ${key}`, [{ companyId: retail, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, 'branch', $3, $4, '2026-01-01')", [
    ids[key],
    roleId,
    retail,
    branchId,
  ]);
}
async function tokenOf(email: string): Promise<Caller> {
  const login = await appLogin(email);
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  return bearer(login.body.tokens.accessToken as string);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  await assign("keeper", "thukho.app@vcomm.test", "warehouse_keeper", testIds.binhDuongWarehouse);
  await assign("keeperTwo", "thukho.app2@vcomm.test", "warehouse_keeper", testIds.binhDuongWarehouse);
  await assign("keeperHead", "thukho.truso@vcomm.test", "warehouse_keeper", testIds.headOfficeBranch);
  await assign("manager", "quanlykho.app@vcomm.test", "warehouse_manager", testIds.binhDuongWarehouse);
  // Quản lý kho có quyền nhạy cảm xem giá vốn nên bắt buộc xác thực hai lớp (QUYTAC_NGHIEPVU_09).
  await pool.query("UPDATE core.users SET mfa_required = true WHERE id = $1", [ids.manager]);
  ids.noAccess = await createTestUser(pool, "khongkho.app@vcomm.test", "Không Có Kho", [{ companyId: retail }]);

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = async (code: string, extra: object) => {
    const created = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: code, nameEn: code, ...extra } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  const plain = await category("UDKA", {});
  const lots = await category("UDKB", { tracksLots: true });
  const serials = await category("UDKC", { tracksSerials: true });
  const product = async (key: string, categoryId: string, baseUnit: string, extra: Record<string, unknown> = {}) => {
    const created = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId, name: key, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units[baseUnit], variants: [{ barcodes: [] }], ...extra },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  };
  await product("water", plain, "CHAI");
  await product("milk", lots, "HOP", { tracksLots: true });
  await product("phone", serials, "CAI", { tracksSerials: true });
  for (const [code, branchId] of [
    ["UDK1", testIds.binhDuongWarehouse],
    ["UDK2", testIds.headOfficeBranch],
  ] as const) {
    const created = await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId, code, name: `Kho ${code}`, usesLocations: false } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    warehouses[code] = created.body.id;
  }
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

const document = (type: string, warehouseId: string, reasonCode: string, lines: Record<string, unknown>[], extra: object = {}) => ({
  type,
  warehouseId,
  companyId: retail,
  documentDate: today,
  reasonCode,
  reason: "Ứng dụng kho",
  lines,
  ...extra,
});
async function createAndSubmit(caller: Caller, payload: object) {
  const created = await caller("post", "/inventory/documents", payload);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return caller("post", `/inventory/documents/${created.body.id}/submit`);
}
const onHand = async (warehouseId: string, key: string) =>
  (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false&search=${key}`, { companyId: retail })).body.data[0]?.onHand as string | undefined;

describe("TIEUCHI_NGHIEMTHU_278: đăng nhập ứng dụng kho", () => {
  it("KICHBAN_KIEMTHU_423: phiên warehouse_app làm mới được; không có quyền kho bị từ chối, phiên bị thu hồi; tài khoản bắt buộc xác thực hai lớp phải nhập mã", async () => {
    const login = await appLogin("thukho.app@vcomm.test");
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.headers["set-cookie"]).toBeUndefined();
    const session = (await pool.query("SELECT client_type FROM core.sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1", [ids.keeper])).rows[0];
    expect(session.client_type).toBe("warehouse_app");
    const days = (Date.parse(login.body.tokens.refreshExpiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    const refreshed = await http().post("/api/v1/auth/app/refresh").send({ refreshToken: login.body.tokens.refreshToken });
    expect(refreshed.status).toBe(200);
    expect((await bearer(refreshed.body.accessToken)("get", "/inventory/warehouses")).status).toBe(200);

    expect((await http().post("/api/v1/auth/warehouse-app/login").send({ identifier: "thukho.app@vcomm.test", password: "SaiMatKhau@1" })).status).toBe(401);

    const denied = await appLogin("khongkho.app@vcomm.test");
    expect(denied.status).toBe(403);
    expect(denied.body.error.message).toBe("Tài khoản không có quyền dùng ứng dụng kho.");
    const revoked = await pool.query("SELECT revoked_at FROM core.sessions WHERE user_id = $1", [ids.noAccess]);
    expect(revoked.rows.length).toBe(1);
    expect(revoked.rows[0].revoked_at).not.toBeNull();

    const manager = await appLogin("quanlykho.app@vcomm.test");
    expect(manager.status).toBe(200);
    expect(manager.body).toMatchObject({ mfaRequired: true, mfaEnrolled: false });
    const managerCall = bearer(manager.body.tokens.accessToken);
    expect((await managerCall("get", "/inventory/warehouses")).body.error.code).toBe("MFA_REQUIRED");
    const enrolled = await managerCall("post", "/auth/mfa/enroll");
    expect(enrolled.status).toBe(201);
    expect((await managerCall("post", "/auth/mfa/enroll/confirm", { code: totpCode(enrolled.body.secretForManualEntry) })).status).toBe(201);
    expect((await managerCall("get", "/inventory/warehouses")).status).toBe(200);
  });
});

describe("TIEUCHI_NGHIEMTHU_279: thao tác kho bằng token ứng dụng", () => {
  it("KICHBAN_KIEMTHU_424: nhập khác, xuất khác, chuyển kho xuất và nhận bằng token; Thủ kho chi nhánh khác bị từ chối", async () => {
    const keeper = await tokenOf("thukho.app@vcomm.test");
    const keeperHead = await tokenOf("thukho.truso@vcomm.test");
    const receipt = await createAndSubmit(keeper, document("receipt_other", warehouses.UDK1!, "opening_balance", [{ variantId: items.water, unitId: units.CHAI, quantity: "30", unitCost: "1000" }]));
    expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
    expect(receipt.body.status).toBe("posted");
    expect(await onHand(warehouses.UDK1!, "water")).toBe("30");
    const issue = await createAndSubmit(keeper, document("issue_other", warehouses.UDK1!, "internal_use", [{ variantId: items.water, unitId: units.CHAI, quantity: "4" }]));
    expect(issue.body.status).toBe("posted");
    expect(await onHand(warehouses.UDK1!, "water")).toBe("26");

    // Thủ kho chi nhánh khác không thao tác được kho của chi nhánh Bình Dương.
    const visible = (await keeperHead("get", "/inventory/warehouses")).body as { id: string; canOperate: boolean }[];
    expect(visible.find((warehouse) => warehouse.id === warehouses.UDK2)?.canOperate).toBe(true);
    expect(visible.find((warehouse) => warehouse.id === warehouses.UDK1)?.canOperate ?? false).toBe(false);
    const foreign = await keeperHead("post", "/inventory/documents", document("issue_other", warehouses.UDK1!, "internal_use", [{ variantId: items.water, unitId: units.CHAI, quantity: "1" }]));
    expect([403, 404]).toContain(foreign.status);

    const transfer = await createAndSubmit(
      keeper,
      document("transfer", warehouses.UDK1!, "transfer", [{ variantId: items.water, unitId: units.CHAI, quantity: "6" }], { destinationWarehouseId: warehouses.UDK2 }),
    );
    expect(transfer.body).toMatchObject({ status: "posted", canShip: true });
    expect((await keeperHead("post", `/inventory/documents/${transfer.body.id}/ship`)).status).toBe(404);
    const shipped = await keeper("post", `/inventory/documents/${transfer.body.id}/ship`);
    expect(shipped.body.status).toBe("in_transit");
    expect(await onHand(warehouses.UDK1!, "water")).toBe("20");
    const received = await keeperHead("post", `/inventory/documents/${transfer.body.id}/receive`, {
      lines: shipped.body.lines.map((line: { id: string; baseQuantity: string }) => ({ lineId: line.id, receivedQuantity: line.baseQuantity, serials: [] })),
    });
    expect(received.status, JSON.stringify(received.body)).toBe(201);
    expect(received.body.status).toBe("received");
    expect(await onHand(warehouses.UDK2!, "water")).toBe("6");
    const card = await retailAdmin.call("get", `/inventory/stock-card?warehouseId=${warehouses.UDK1}&companyId=${retail}&variantId=${items.water}&from=${today}&to=${today}`, {
      companyId: retail,
    });
    expect(card.status, JSON.stringify(card.body)).toBe(200);
    expect(card.body.closing.quantity).toBe("20");
    expect(card.body.movements.map((movement: { balanceAfter: string }) => movement.balanceAfter)).toEqual(["30", "26", "20"]);
  });
});

describe("TIEUCHI_NGHIEMTHU_280: đếm kiểm kê cộng dồn, đếm mù", () => {
  let stocktakeId: string;
  let lotId: string;
  let keeper: Caller;
  let keeperTwo: Caller;

  beforeAll(async () => {
    keeper = await tokenOf("thukho.app@vcomm.test");
    keeperTwo = await tokenOf("thukho.app2@vcomm.test");
    const opening = await createAndSubmit(
      keeper,
      document("receipt_other", warehouses.UDK1!, "opening_balance", [
        { variantId: items.milk, unitId: units.HOP, quantity: "10", unitCost: "5000", lotNo: "UDK-L1", expiresOn: "2099-01-01" },
        { variantId: items.phone, unitId: units.CAI, quantity: "2", unitCost: "900000", serials: ["UDK-P1", "UDK-P2"] },
      ]),
    );
    expect(opening.body.status, JSON.stringify(opening.body)).toBe("posted");
    lotId = (await retailAdmin.call("get", `/inventory/documents/lot-suggestions?warehouseId=${warehouses.UDK1}&companyId=${retail}&variantId=${items.milk}`, { companyId: retail })).body[0].lotId;
    const created = await retailAdmin.call("post", "/inventory/stocktakes", {
      companyId: retail,
      body: { warehouseId: warehouses.UDK1, companyId: retail, scopeType: "variants", scopeIds: [items.water, items.milk, items.phone] },
    });
    stocktakeId = created.body.id;
  });

  it("KICHBAN_KIEMTHU_425: cộng dồn, cộng âm, không cho âm, dòng mới, đồng thời; đợt không đang đếm bị từ chối", async () => {
    const add = (caller: Caller, additions: object[]) => caller("post", `/inventory/stocktakes/${stocktakeId}/count-additions`, { additions });
    expect((await add(keeper, [{ variantId: items.water, quantity: "1" }])).body.error.code).toBe("BUSINESS_RULE");
    expect((await retailAdmin.call("post", `/inventory/stocktakes/${stocktakeId}/start`, { companyId: retail })).body.status).toBe("counting");

    const first = await add(keeper, [{ variantId: items.water, quantity: "12" }]);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const second = await add(keeperTwo, [{ variantId: items.water, quantity: "5" }]);
    expect(second.body.lines.find((line: { variantId: string }) => line.variantId === items.water)).toMatchObject({ countedQuantity: "17", systemQuantity: null, difference: null });
    expect((await add(keeper, [{ variantId: items.water, quantity: "-2" }])).body.lines[0].countedQuantity).toBe("15");
    const negative = await add(keeper, [{ variantId: items.water, quantity: "-16" }]);
    expect(negative.status).toBe(400);
    expect(negative.body.error.fields).toEqual({ "additions.0.quantity": "Số đếm sau khi cộng không được âm." });
    expect((await add(keeper, [{ variantId: items.water, quantity: "0" }])).status).toBe(400);
    // Hàng theo lô phải ghi lô.
    expect((await add(keeper, [{ variantId: items.milk, quantity: "1" }])).body.error.fields).toEqual({
      "additions.0.lotId": "Hàng theo lô: ghi số đếm theo lô đã có; lô mới nhập bằng phiếu nhập khác.",
    });

    // Hai người cộng đồng thời vào cùng dòng: cả hai lần đều được tính.
    const together = await Promise.all(Array.from({ length: 6 }, (_, index) => add(index % 2 === 0 ? keeper : keeperTwo, [{ variantId: items.milk, lotId, quantity: "1" }])));
    expect(together.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200]);
    const lines = (await pool.query("SELECT counted_quantity::text FROM inventory.stocktake_lines WHERE stocktake_id = $1 AND variant_id = $2", [stocktakeId, items.milk])).rows;
    expect(lines).toEqual([{ counted_quantity: "6.0000" }]);

    // Mặt hàng không có trong sổ sách của đợt (dòng mới) được thêm với tồn sổ sách 0; người quản lý thấy chênh lệch.
    const extra = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: {
        categoryId: (await pool.query("SELECT category_id FROM catalog.products p JOIN catalog.variants v ON v.product_id = p.id WHERE v.id = $1", [items.water])).rows[0].category_id,
        name: "water2",
        vatRate: "10",
        tracksLots: false,
        tracksSerials: false,
        warrantyMonths: 0,
        baseUnitId: units.CHAI,
        variants: [{ barcodes: [] }],
      },
    });
    const water2 = extra.body.variants[0].id as string;
    await Promise.all([add(keeper, [{ variantId: water2, quantity: "1" }]), add(keeperTwo, [{ variantId: water2, quantity: "2" }])]);
    const managed = (await retailAdmin.call("get", `/inventory/stocktakes/${stocktakeId}`, { companyId: retail })).body;
    const newLines = managed.lines.filter((line: { variantId: string }) => line.variantId === water2);
    expect(newLines).toHaveLength(1);
    expect(newLines[0]).toMatchObject({ systemQuantity: "0", countedQuantity: "3", difference: "3" });
    expect(managed.lines.find((line: { variantId: string }) => line.variantId === items.water)).toMatchObject({ systemQuantity: "20", countedQuantity: "15", difference: "-5" });
    expect(managed).toMatchObject({ canManage: true, canCount: true });
  });

  it("KICHBAN_KIEMTHU_426: serial thêm, bỏ, trùng dòng khác; quyền Thủ kho; đếm mù; lịch sử đếm", async () => {
    const add = (caller: Caller, additions: object[]) => caller("post", `/inventory/stocktakes/${stocktakeId}/count-additions`, { additions });
    const added = await add(keeper, [{ variantId: items.phone, serials: ["UDK-P1", "UDK-P2", "UDK-P9"] }]);
    expect(added.status, JSON.stringify(added.body)).toBe(200);
    const phoneLine = () => added.body.lines.find((line: { variantId: string }) => line.variantId === items.phone);
    expect(phoneLine()).toMatchObject({ countedQuantity: "3", countedSerials: ["UDK-P1", "UDK-P2", "UDK-P9"] });
    const removed = await add(keeperTwo, [{ variantId: items.phone, removedSerials: ["UDK-P9"] }]);
    expect(removed.body.lines.find((line: { variantId: string }) => line.variantId === items.phone)).toMatchObject({ countedQuantity: "2", countedSerials: ["UDK-P1", "UDK-P2"] });
    expect((await add(keeper, [{ variantId: items.phone, serials: ["UDK-P3", "UDK-P3"] }])).body.error.fields).toEqual({ "additions.0.serials": "Serial bị lặp." });
    // Serial đã đếm ở dòng khác của đợt (dòng mới cùng mặt hàng nhưng khác lô không có ở hàng serial; thử bằng dòng hàng theo lô không serial không áp dụng): giả lập dòng khác bằng cơ sở dữ liệu.
    await pool.query("UPDATE inventory.stocktake_lines SET counted_serials = ARRAY['UDK-X1'] WHERE stocktake_id = $1 AND variant_id = $2", [stocktakeId, items.water]);
    expect((await add(keeper, [{ variantId: items.phone, serials: ["UDK-X1"] }])).body.error.fields).toEqual({
      "additions.0.serials": "Serial đã được đếm ở dòng khác của đợt kiểm kê.",
    });
    await pool.query("UPDATE inventory.stocktake_lines SET counted_serials = NULL WHERE stocktake_id = $1 AND variant_id = $2", [stocktakeId, items.water]);

    // Thủ kho cộng được nhưng không lưu số tuyệt đối, không kết thúc, không lập, không hủy.
    const blind = (await keeper("get", `/inventory/stocktakes/${stocktakeId}`)).body;
    expect(blind).toMatchObject({ canManage: false, canCount: true });
    expect(blind.lines.every((line: { systemQuantity: string | null; difference: string | null }) => line.systemQuantity === null && line.difference === null)).toBe(true);
    expect((await keeper("put", `/inventory/stocktakes/${stocktakeId}/counts`, { counts: [{ lineId: blind.lines[0].id, countedQuantity: "1" }] })).status).toBe(403);
    expect((await keeper("post", `/inventory/stocktakes/${stocktakeId}/finish`, { version: blind.version })).status).toBe(403);
    expect((await keeper("post", `/inventory/stocktakes/${stocktakeId}/cancel`)).status).toBe(403);
    expect((await keeper("post", "/inventory/stocktakes", { warehouseId: warehouses.UDK1, companyId: retail, scopeType: "full" })).status).toBe(403);
    // Thủ kho chi nhánh khác không thấy đợt kiểm kê.
    const keeperHead = await tokenOf("thukho.truso@vcomm.test");
    expect((await keeperHead("post", `/inventory/stocktakes/${stocktakeId}/count-additions`, { additions: [{ variantId: items.water, quantity: "1" }] })).status).toBe(404);

    // Đếm mù: dòng chưa ai đếm không hiện với Thủ kho, vẫn hiện với người quản lý.
    const fresh = await retailAdmin.call("post", "/inventory/stocktakes", { companyId: retail, body: { warehouseId: warehouses.UDK2, companyId: retail, scopeType: "full" } });
    await retailAdmin.call("post", `/inventory/stocktakes/${fresh.body.id}/start`, { companyId: retail });
    expect((await retailAdmin.call("get", `/inventory/stocktakes/${fresh.body.id}`, { companyId: retail })).body.lines.length).toBeGreaterThan(0);
    expect((await keeperHead("get", `/inventory/stocktakes/${fresh.body.id}`)).body.lines).toEqual([]);
    await retailAdmin.call("post", `/inventory/stocktakes/${fresh.body.id}/cancel`, { companyId: retail });

    // Lịch sử đếm: đủ từng lần, lọc của tôi.
    const all = (await retailAdmin.call("get", `/inventory/stocktakes/${stocktakeId}/count-entries`, { companyId: retail })).body;
    const mine = (await keeperTwo("get", `/inventory/stocktakes/${stocktakeId}/count-entries?mine=true`)).body;
    expect(all.length).toBe(13);
    expect(mine.every((entry: { countedById: string }) => entry.countedById === ids.keeperTwo)).toBe(true);
    expect(mine.length).toBe(6);
    expect(mine[0]).toMatchObject({ productName: "phone", quantity: "-1", removedSerials: ["UDK-P9"] });
    const clientTypes = (await pool.query("SELECT DISTINCT client_type FROM inventory.stocktake_count_entries WHERE stocktake_id = $1", [stocktakeId])).rows;
    expect(clientTypes).toEqual([{ client_type: "warehouse_app" }]);

    // Kết thúc bằng người quản lý dùng số đếm cộng dồn.
    const managed = (await retailAdmin.call("get", `/inventory/stocktakes/${stocktakeId}`, { companyId: retail })).body;
    const finished = await retailAdmin.call("post", `/inventory/stocktakes/${stocktakeId}/finish`, { companyId: retail, body: { version: managed.version } });
    expect(finished.status, JSON.stringify(finished.body)).toBe(201);
    expect(await onHand(warehouses.UDK1!, "water")).toBe("15");
    expect((await add(keeper, [{ variantId: items.water, quantity: "1" }])).body.error.code).toBe("BUSINESS_RULE");
  });
});
