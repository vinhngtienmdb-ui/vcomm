// CONG_VIEC_43 lát L1: tắt giao khách, phạm vi xem toàn công ty, quyền lập đơn bán (KICHBAN_KIEMTHU_420; TIEUCHI_NGHIEMTHU_275).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let retailAdmin: Session;
let accountant: Session;
let chiefAccountant: Session;
let seller: Session;
const ids: Record<string, string> = {};
const customers: Record<string, string> = {};
const units: Record<string, string> = {};
let variantId: string;
let channelId: string;
let warehouseId: string;
let orderOfOther: string;
let today: string;
const retail: string = testIds.retailCompany;

async function assign(key: string, email: string, name: string, role: string) {
  ids[key] = await createTestUser(pool, email, name, [{ companyId: retail }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [ids[key], roleId, retail]);
  return signIn(application, email);
}
const as = (session: Session, method: "get" | "post" | "put" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
async function customer(key: string, taxCode: string, owner: string | null) {
  const created = await as(retailAdmin, "post", "/crm/partners", { kind: "organization", name: `Khách ${key}`, taxCode });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const saved = await as(retailAdmin, "put", `/crm/partners/${created.body.id}/profile`, {
    isCustomer: true,
    isSupplier: false,
    paymentTermDays: 30,
    creditLimit: null,
    ownerUserId: owner,
    version: 0,
  });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  customers[key] = created.body.id;
}
const orderBody = (customerId: string) => ({ customerId, channelId, warehouseId, orderDate: today, lines: [{ variantId, unitId: units.CAI, quantity: "1" }] });

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("accountant", "ketoan.q43@vcomm.test", "Kế Toán Bốn Ba", "accountant");
  chiefAccountant = await assign("chief", "ketoantruong.q43@vcomm.test", "Kế Toán Trưởng Bốn Ba", "chief_accountant");
  seller = await assign("seller", "banhang.q43@vcomm.test", "Bán Hàng Bốn Ba", "salesperson");
  await assign("other", "banhang.khac43@vcomm.test", "Bán Hàng Khác Bốn Ba", "salesperson");

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  const categoryId = (await as(groupAdmin, "post", "/catalog/categories", { code: "DV43", nameVi: "DV43", nameEn: "DV43" })).body.id;
  const product = await as(retailAdmin, "post", "/catalog/products", {
    categoryId,
    name: "Dịch vụ lắp đặt",
    // CONG_VIEC_43 lát L2: đơn bán tay chỉ gồm dịch vụ (QUYTAC_NGHIEPVU_276).
    kind: "service",
    vatRate: "10",
    tracksLots: false,
    tracksSerials: false,
    warrantyMonths: 0,
    baseUnitId: units.CAI,
    variants: [{ barcodes: [] }],
  });
  expect(product.status, JSON.stringify(product.body)).toBe(201);
  variantId = product.body.variants[0].id;
  channelId = (await as(retailAdmin, "post", "/catalog/sales-channels/defaults")).body.find((item: { code: string }) => item.code === "BAN_LE").id;
  const priceListId = (await as(retailAdmin, "post", "/catalog/price-lists", { code: "CHUNG43", name: "CHUNG43", includesVat: true })).body.id;
  const draft = await as(retailAdmin, "post", "/catalog/price-changes", { priceListId, effectiveFrom: today, lines: [{ variantId, unitId: units.CAI, price: "1100000" }] });
  expect((await as(retailAdmin, "post", `/catalog/price-changes/${draft.body.id}/submit`)).status).toBe(201);
  warehouseId = (await as(retailAdmin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "BD43", name: "Kho 43", usesLocations: false })).body.id;
  // Khách do nhân viên khác phụ trách, khách chưa có người phụ trách; đơn bán do quản trị lập cho khách của nhân viên khác.
  await customer("other", "0343000001", ids.other!);
  await customer("none", "0343000002", null);
  const created = await as(retailAdmin, "post", "/sales/orders", orderBody(customers.other!));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  orderOfOther = created.body.id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_275: tắt giao khách, xem toàn công ty, quyền lập đơn bán", () => {
  it("KICHBAN_KIEMTHU_420: API giao khách, nhận khách, lịch sử phụ trách trả 404; quyền, loại chứng từ giao khách đã xóa", async () => {
    const id = customers.none!;
    for (const [method, path] of [
      ["get", "/crm/customer-assignments"],
      ["get", "/crm/customer-assignment-options"],
      ["post", "/crm/customer-assignments"],
      ["get", `/crm/customer-assignments/${id}`],
      ["patch", `/crm/customer-assignments/${id}`],
      ["post", `/crm/customer-assignments/${id}/submit`],
      ["post", `/crm/partners/${id}/claim`],
      ["get", `/crm/partners/${id}/owner-history`],
    ] as const)
      expect((await as(retailAdmin, method, path, method === "get" ? undefined : {})).status, `${method} ${path}`).toBe(404);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.permissions WHERE code IN ('crm.customer.view_all', 'crm.customer.assign')")).rows[0].total).toBe(0);
    expect((await pool.query("SELECT count(*)::int AS total FROM core.document_types WHERE code = 'crm.customer_assignment'")).rows[0].total).toBe(0);
    // Bảng dữ liệu giao khách cũ vẫn giữ.
    expect((await pool.query("SELECT to_regclass('crm.customer_assignments') IS NOT NULL AS kept")).rows[0].kept).toBe(true);
  });

  it("KICHBAN_KIEMTHU_420: nhân viên bán hàng xem mọi đối tác, đơn bán của công ty; người phụ trách sửa bằng tay trên hồ sơ", async () => {
    const partners = ((await as(seller, "get", "/crm/partners?role=customer")).body.data as { id: string }[]).map((item) => item.id);
    expect(partners).toEqual(expect.arrayContaining([customers.other, customers.none]));
    expect((await as(seller, "get", `/crm/partners/${customers.other}`)).status).toBe(200);
    expect(((await as(seller, "get", "/sales/options")).body.customers as { id: string }[]).map((item) => item.id)).toEqual(expect.arrayContaining([customers.other, customers.none]));
    expect(((await as(seller, "get", "/sales/orders")).body.data as { id: string }[]).map((item) => item.id)).toContain(orderOfOther);
    expect((await as(seller, "get", `/sales/orders/${orderOfOther}`)).status).toBe(200);
    // Nhân viên ghi ghé thăm, không quản lý hồ sơ, thêm đối tác thì tự có hồ sơ khách hàng mặc định (thanh toán ngay, hạn mức 0), không gán người phụ trách
    // (quyết định người dùng 2026-11-11, lát L4).
    const added = await as(seller, "post", "/crm/partners", { kind: "organization", name: "Đối tác nhân viên thêm", taxCode: "0343000003" });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body.profile).toMatchObject({ isCustomer: true, isSupplier: false, paymentTermDays: 0, ownerUserId: null, creditLimitHidden: true });
    expect((await as(retailAdmin, "get", `/crm/partners/${added.body.id}`)).body.profile.creditLimit).toBe("0");
    // Đổi người phụ trách đã có bằng tay (trước đây phải qua phiếu giao khách).
    const before = await as(retailAdmin, "get", `/crm/partners/${customers.other}`);
    const changed = await as(retailAdmin, "put", `/crm/partners/${customers.other}/profile`, {
      isCustomer: true,
      isSupplier: false,
      paymentTermDays: 30,
      creditLimit: null,
      ownerUserId: ids.seller,
      version: before.body.profile.version,
    });
    expect(changed.status, JSON.stringify(changed.body)).toBe(200);
    expect(changed.body.profile.ownerUserId).toBe(ids.seller);
  });

  it("KICHBAN_KIEMTHU_420: nhân viên bán hàng không lập được đơn bán (403); kế toán, kế toán trưởng lập được", async () => {
    expect((await as(seller, "post", "/sales/orders", orderBody(customers.none!))).status).toBe(403);
    expect((await as(seller, "post", `/sales/orders/${orderOfOther}/cancel`, { version: 1 })).status).toBe(403);
    const byAccountant = await as(accountant, "post", "/sales/orders", orderBody(customers.none!));
    expect(byAccountant.status, JSON.stringify(byAccountant.body)).toBe(201);
    const byChief = await as(chiefAccountant, "post", "/sales/orders", orderBody(customers.other!));
    expect(byChief.status, JSON.stringify(byChief.body)).toBe(201);
    expect((await as(accountant, "get", `/sales/orders/${byChief.body.id}`)).status).toBe(200);
  });
});
