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
