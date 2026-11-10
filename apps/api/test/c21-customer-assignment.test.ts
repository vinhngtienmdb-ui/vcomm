// CONG_VIEC_21: Gán khách hàng cho nhân viên kinh doanh (KICHBAN_KIEMTHU_278 trở đi).
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
let sellerA: Session;
let sellerB: Session;
let manager: Session;
const ids: Record<string, string> = {};
const customers: Record<string, string> = {};
const orders: Record<string, string> = {};
let channelId: string;
let warehouseId: string;
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
async function order(key: string, customerId: string | null, createdBy: string, commissionUserId: string | null = null) {
  orders[key] = (
    await pool.query<{ id: string }>(
      `INSERT INTO sales.orders (company_id, customer_id, buyer_name, channel_id, warehouse_id, order_date, currency, created_by, commission_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'VND', $7, $8) RETURNING id`,
      [retail, customerId, customerId ? null : "Khách lẻ", channelId, warehouseId, today, createdBy, commissionUserId],
    )
  ).rows[0]!.id;
}
const listed = async (session: Session, path: string) => ((await as(session, "get", path)).body.data as { id: string }[]).map((item) => item.id);

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  ids.admin = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'quantri.vcr@vcomm.test'")).rows[0]!.id;
  accountant = await assign("accountant", "ketoan.gk@vcomm.test", "Kế Toán Giao", "accountant");
  sellerA = await assign("sellerA", "banhang.a@vcomm.test", "Bán Hàng A", "salesperson");
  sellerB = await assign("sellerB", "banhang.b@vcomm.test", "Bán Hàng B", "salesperson");
  manager = await assign("manager", "truongphong.kd@vcomm.test", "Trưởng Phòng KD", "salesperson");
  // Phòng Kinh doanh (trưởng phòng) có phòng con Kinh doanh 1 (nhân viên A); nhân viên B ngoài phòng.
  const department = async (code: string, parentId: string | null, managerId: string | null) =>
    (
      await pool.query<{ id: string }>("INSERT INTO core.departments (company_id, parent_id, code, name, manager_user_id) VALUES ($1, $2, $3, $3, $4) RETURNING id", [
        retail,
        parentId,
        code,
        managerId,
      ])
    ).rows[0]!.id;
  const sales = await department("KD", null, ids.manager!);
  const salesOne = await department("KD1", sales, null);
  await pool.query("UPDATE core.user_company_memberships SET department_id = $1 WHERE user_id = $2 AND company_id = $3", [salesOne, ids.sellerA, retail]);

  channelId = (await as(retailAdmin, "post", "/catalog/sales-channels/defaults")).body.find((item: { code: string }) => item.code === "BAN_LE").id;
  warehouseId = (await as(retailAdmin, "post", "/inventory/warehouses", { branchId: testIds.binhDuongWarehouse, code: "BDGK", name: "Kho giao khách", usesLocations: false })).body.id;
  await customer("A", "0321000001", ids.sellerA!);
  await customer("B", "0321000002", ids.sellerB!);
  await customer("none", "0321000003", null);
  await order("ofA", customers.A!, ids.admin!);
  await order("ofB", customers.B!, ids.admin!);
  await order("walkIn", null, ids.sellerA!);
  await order("commission", customers.none!, ids.admin!, ids.sellerA!);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_21 phạm vi xem theo nhân viên phụ trách", () => {
  it("KICHBAN_KIEMTHU_278: nhân viên chỉ thấy khách mình phụ trách, đơn của khách đó, đơn mình lập, đơn mình hưởng hoa hồng; khách, đơn khác nhận 404; thêm đối tác thì tự phụ trách", async () => {
    expect(await listed(sellerA, "/crm/partners")).toEqual([customers.A]);
    expect((await as(sellerA, "get", `/crm/partners/${customers.B}`)).status).toBe(404);
    expect((await as(sellerA, "get", `/crm/partners/${customers.A}`)).status).toBe(200);
    expect(((await as(sellerA, "get", "/sales/options")).body.customers as { id: string }[]).map((item) => item.id)).toEqual([customers.A]);
    expect((await listed(sellerA, "/sales/orders")).sort()).toEqual([orders.ofA, orders.walkIn, orders.commission].sort());
    expect((await as(sellerA, "get", `/sales/orders/${orders.ofB}`)).status).toBe(404);
    expect((await as(sellerA, "post", `/sales/orders/${orders.ofB}/cancel`, { version: 1 })).status).toBe(404);
    expect((await as(sellerA, "get", `/sales/orders/${orders.commission}`)).status).toBe(200);
    // Lập đơn cho khách người khác phụ trách bị từ chối.
    const foreign = await as(sellerA, "post", "/sales/orders", {
      customerId: customers.B,
      channelId,
      warehouseId,
      orderDate: today,
      lines: [{ variantId: "00000000-0000-4000-8000-000000000000", unitId: "00000000-0000-4000-8000-000000000000", quantity: "1" }],
    });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.fields.customerId).toBeDefined();
    // Nhân viên thêm đối tác mới: tự có hồ sơ khách hàng do mình phụ trách, thanh toán ngay, hạn mức 0.
    const created = await as(sellerA, "post", "/crm/partners", { kind: "organization", name: "Khách tự tìm", taxCode: "0321000009" });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.profile).toMatchObject({ isCustomer: true, paymentTermDays: 0, ownerUserName: "Bán Hàng A" });
    const stored = (await pool.query("SELECT credit_limit::text FROM crm.partner_profiles WHERE partner_id = $1 AND company_id = $2", [created.body.id, retail])).rows[0];
    expect(Number(stored.credit_limit)).toBe(0);
    expect((await pool.query("SELECT 1 FROM crm.partner_owner_history WHERE partner_id = $1 AND user_id = $2 AND valid_to IS NULL", [created.body.id, ids.sellerA])).rows).toHaveLength(1);
    expect(await listed(sellerA, "/crm/partners?owner=mine")).toContain(created.body.id);
    expect(await listed(sellerB, "/crm/partners")).toEqual([customers.B]);
  });

  it("KICHBAN_KIEMTHU_279: người có quyền xem mọi khách (quản trị công ty, kế toán) xem như cũ; lọc theo nhân viên phụ trách", async () => {
    for (const session of [retailAdmin, accountant]) {
      const partners = await listed(session, "/crm/partners?pageSize=100");
      expect(partners).toEqual(expect.arrayContaining([customers.A, customers.B, customers.none]));
      expect((await as(session, "get", `/crm/partners/${customers.B}`)).status).toBe(200);
    }
    expect((await listed(retailAdmin, "/sales/orders")).sort()).toEqual(Object.values(orders).sort());
    expect(await listed(retailAdmin, `/crm/partners?owner=${ids.sellerB}`)).toEqual([customers.B]);
    const item = (await as(retailAdmin, "get", `/crm/partners?owner=${ids.sellerA}`)).body.data.find((row: { id: string }) => row.id === customers.A);
    expect(item.ownerUserName).toBe("Bán Hàng A");
  });

  it("KICHBAN_KIEMTHU_280 (phần xem): trưởng phòng thấy khách của nhân viên phòng mình và phòng con, không thấy khách ngoài phòng", async () => {
    const partners = await listed(manager, "/crm/partners");
    expect(partners).toContain(customers.A);
    expect(partners).not.toContain(customers.B);
    expect((await as(manager, "get", `/sales/orders/${orders.ofA}`)).status).toBe(200);
    expect((await as(manager, "get", `/sales/orders/${orders.ofB}`)).status).toBe(404);
  });

  it("KICHBAN_KIEMTHU_284 (phần hồ sơ): hồ sơ chỉ đặt nhân viên phụ trách khi chưa có, có lịch sử; đổi phải dùng phiếu giao khách", async () => {
    const profile = async (id: string) => (await as(retailAdmin, "get", `/crm/partners/${id}`)).body.profile;
    const body = (current: { version: number }, ownerUserId: string | null) => ({ isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: null, ownerUserId, version: current.version });
    const changed = await as(retailAdmin, "put", `/crm/partners/${customers.A}/profile`, body(await profile(customers.A!), ids.sellerB!));
    expect(changed.status).toBe(400);
    expect(changed.body.error.fields.ownerUserId).toBe("Khách đã có nhân viên phụ trách; đổi nhân viên bằng phiếu giao khách.");
    const cleared = await as(retailAdmin, "put", `/crm/partners/${customers.A}/profile`, body(await profile(customers.A!), null));
    expect(cleared.status).toBe(400);
    const kept = await as(retailAdmin, "put", `/crm/partners/${customers.A}/profile`, { ...body(await profile(customers.A!), ids.sellerA!), paymentTermDays: 15 });
    expect(kept.status, JSON.stringify(kept.body)).toBe(200);
    const first = await as(retailAdmin, "put", `/crm/partners/${customers.none}/profile`, body(await profile(customers.none!), ids.sellerB!));
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const history = await pool.query("SELECT user_id, valid_to FROM crm.partner_owner_history WHERE partner_id = $1 AND company_id = $2", [customers.none, retail]);
    expect(history.rows).toEqual([{ user_id: ids.sellerB, valid_to: null }]);
  });
});
