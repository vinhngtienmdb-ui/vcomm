// CONG_VIEC_05 lát L4: giữ hàng, tồn an toàn, cảnh báo, in tem (TIEUCHI_NGHIEMTHU_71, 72, 73; KICHBAN_KIEMTHU_157 đến 159).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { code128Patterns, code128Widths } from "../src/inventory/code128";
import { ReservationsService } from "../src/inventory/reservations.service";
import { StockLevelsService } from "../src/inventory/stock-levels.service";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let keeper: Session;
const retail: string = testIds.retailCompany;
const units: Record<string, string> = {};
let variantId: string;
let warehouseId: string;

const stock = async () => (await retailAdmin.call("get", `/inventory/stock?warehouseId=${warehouseId}&onlyInStock=false`, { companyId: retail })).body.data[0];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  const today = application.get(PermissionService).today();
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'warehouse_keeper' AND company_id IS NULL")).rows[0]!.id;
  const keeperId = await createTestUser(pool, "thukho.l4@vcomm.test", "Mai Văn Giữ", [{ companyId: retail, branchId: testIds.binhDuongWarehouse }]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, 'branch', $3, $4, '2026-01-01')", [
    keeperId,
    role,
    retail,
    testIds.binhDuongWarehouse,
  ]);
  keeper = await signIn(application, "thukho.l4@vcomm.test");
  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "GIUH", nameVi: "Giữ hàng", nameEn: "Hold" } })).body.id;
  const product = await retailAdmin.call("post", "/catalog/products", {
    companyId: retail,
    body: {
      categoryId: category,
      name: "Bánh quy bơ",
      vatRate: "8",
      tracksLots: false,
      tracksSerials: false,
      warrantyMonths: 0,
      baseUnitId: units.HOP,
      variants: [{ barcodes: [{ unitId: units.HOP, barcode: "8936000000017" }] }],
    },
  });
  variantId = product.body.variants[0].id;
  warehouseId = (await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "GH1", name: "Kho giữ hàng", usesLocations: true } }))
    .body.id;
  const location = (await retailAdmin.call("post", `/inventory/warehouses/${warehouseId}/locations`, { companyId: retail, body: { locations: [{ code: "G-01", name: "Kệ G" }, { code: "G-02" }] } }))
    .body[0].id;
  const created = await retailAdmin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "receipt_other",
      warehouseId,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [{ variantId, unitId: units.HOP, quantity: "10", unitCost: "20000", locationId: location }],
    },
  });
  expect((await retailAdmin.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_71: giữ hàng", () => {
  it("KICHBAN_KIEMTHU_157: không giữ quá tồn khả dụng; hết hạn tự nhả; gia hạn, nhả tay ghi nhật ký thao tác; hàng giữ cho phiếu kho không nhả tay", async () => {
    const body = (quantity: string) => ({ warehouseId, companyId: retail, variantId, quantity, note: "Khách hẹn lấy" });
    expect((await keeper.call("post", "/inventory/reservations", { companyId: retail, body: body("1") })).status).toBe(403);
    const held = await retailAdmin.call("post", "/inventory/reservations", { companyId: retail, body: body("8") });
    expect(held.status).toBe(201);
    expect(held.body).toMatchObject({ quantity: "8", status: "active", sourceNo: "Khách hẹn lấy" });
    const hours = (Date.parse(held.body.expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(71);
    expect(hours).toBeLessThanOrEqual(72);
    expect((await retailAdmin.call("post", "/inventory/reservations", { companyId: retail, body: body("3") })).body.error.message).toBe("Không đủ hàng khả dụng (một phần đang được giữ).");
    expect(await stock()).toMatchObject({ onHand: "10", reserved: "8", available: "2" });

    const extended = await retailAdmin.call("post", `/inventory/reservations/${held.body.id}/extend`, { companyId: retail, body: { hours: 24, version: 1 } });
    expect(Date.parse(extended.body.expiresAt) - Date.parse(held.body.expiresAt)).toBeGreaterThanOrEqual(24 * 3_600_000 - 1000);
    const released = await retailAdmin.call("post", `/inventory/reservations/${held.body.id}/release`, { companyId: retail, body: { version: 2 } });
    expect(released.body.status).toBe("released");
    const audit = await pool.query("SELECT action FROM core.audit_events WHERE entity_id = $1 ORDER BY occurred_at", [held.body.id]);
    expect(audit.rows.map((row) => row.action)).toEqual(["reservation.create", "reservation.extend", "reservation.release"]);

    const expiring = await retailAdmin.call("post", "/inventory/reservations", { companyId: retail, body: body("5") });
    await pool.query("UPDATE inventory.reservations SET expires_at = now() - interval '1 minute' WHERE id = $1", [expiring.body.id]);
    expect(await application.get(ReservationsService).releaseExpired()).toBe(1);
    expect(await stock()).toMatchObject({ reserved: "0", available: "10" });
    const list = await retailAdmin.call("get", "/inventory/reservations?status=released", { companyId: retail });
    expect(list.body.total).toBe(2);

    await pool.query("INSERT INTO inventory.reservations (warehouse_id, company_id, variant_id, quantity, source_type, source_id) VALUES ($1, $2, $3, 1, 'inventory.document', gen_random_uuid())", [
      warehouseId,
      retail,
      variantId,
    ]);
    const owned = (await retailAdmin.call("get", "/inventory/reservations", { companyId: retail })).body.data[0];
    expect((await retailAdmin.call("post", `/inventory/reservations/${owned.id}/release`, { companyId: retail, body: { version: 1 } })).status).toBe(409);
  });
});

describe("TIEUCHI_NGHIEMTHU_72: tồn an toàn, cảnh báo", () => {
  it("KICHBAN_KIEMTHU_158: dưới tối thiểu có cảnh báo, số gợi ý đúng; tối đa nhỏ hơn tối thiểu bị từ chối; thông báo hằng ngày", async () => {
    const level = (minimum: string, maximum: string) => ({ warehouseId, companyId: retail, variantId, minimum, maximum });
    expect((await retailAdmin.call("put", "/inventory/stock-levels", { companyId: retail, body: level("20", "10") })).status).toBe(400);
    expect((await keeper.call("put", "/inventory/stock-levels", { companyId: retail, body: level("20", "50") })).status).toBe(403);
    const saved = await retailAdmin.call("put", "/inventory/stock-levels", { companyId: retail, body: level("20", "50") });
    expect(saved.body).toMatchObject({ available: "9", belowMinimum: true, suggestedQuantity: "41" });
    expect((await retailAdmin.call("get", "/inventory/stock-alerts", { companyId: retail })).body.map((row: { sku: string; suggestedQuantity: string }) => row.suggestedQuantity)).toEqual(["41"]);
    expect((await keeper.call("get", "/inventory/stock", { companyId: retail })).body.data[0]).toMatchObject({ minimum: "20", belowMinimum: true });
    expect(await application.get(StockLevelsService).notifyAlerts()).toBeGreaterThan(0);
    const notification = await pool.query("SELECT kind, payload FROM core.notifications WHERE user_id = $1 AND kind = 'inventory_stock_alert'", [testIds.retailAdmin]);
    expect(notification.rows[0].payload).toEqual({ warehouse: "Kho giữ hàng", count: 1 });
    await retailAdmin.call("put", "/inventory/stock-levels", { companyId: retail, body: level("5", "50") });
    expect((await retailAdmin.call("get", "/inventory/stock-alerts", { companyId: retail })).body).toEqual([]);
  });
});

describe("TIEUCHI_NGHIEMTHU_73: in tem", () => {
  it("KICHBAN_KIEMTHU_159: mã Code 128 đúng cấu trúc; tem sản phẩm, tem vị trí ra PDF đúng số trang", async () => {
    expect(code128Patterns.slice(0, 106).every((pattern) => [...pattern].reduce((sum, digit) => sum + Number(digit), 0) === 11)).toBe(true);
    // "Hi": bắt đầu B (104), H (40, 231113), i (73, 142112), kiểm tra (104 + 40 + 146) mod 103 = 84 (124112), dừng.
    expect(code128Widths("Hi").join("")).toBe(["211214", "231113", "142112", "124112", "2331112"].join(""));
    const download = (path: string) =>
      retailAdmin
        .call("get", path, { companyId: retail })
        .buffer(true)
        .parse((response, callback) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => callback(null, Buffer.concat(chunks)));
        });
    const products = await download(`/inventory/labels/products?companyId=${retail}&variantIds=${variantId}&copies=3`);
    expect(products.status).toBe(200);
    expect(products.headers["content-type"]).toBe("application/pdf");
    const productPdf = (products.body as Buffer).toString("latin1");
    expect(productPdf.startsWith("%PDF")).toBe(true);
    expect(productPdf.match(/\/Type \/Page\b/g)).toHaveLength(3);
    expect(productPdf).toMatch(/\/MediaBox \[0 0 141\.73\d* 85\.03\d*\]/);
    const locations = await download(`/inventory/labels/locations?warehouseId=${warehouseId}`);
    expect((locations.body as Buffer).toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(2);
  });
});
