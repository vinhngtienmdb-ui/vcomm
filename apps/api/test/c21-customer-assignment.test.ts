// CONG_VIEC_21: Gán khách hàng cho nhân viên kinh doanh (KICHBAN_KIEMTHU_278 trở đi).
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

const ownerOf = async (partnerId: string) =>
  (await pool.query<{ owner_user_id: string | null }>("SELECT owner_user_id FROM crm.partner_profiles WHERE partner_id = $1 AND company_id = $2", [partnerId, retail])).rows[0]!.owner_user_id;
const assignment = (targetUserId: string, partnerIds: string[], extra: Record<string, unknown> = {}) => ({ targetUserId, reason: "Chia lại khách theo vùng", partnerIds, ...extra });

describe("CONG_VIEC_21 phiếu giao khách", () => {
  it("KICHBAN_KIEMTHU_280 (phần giao): trưởng phòng giao khách trong phòng; không giao được khách, nhân viên ngoài phòng; nhân viên không phải trưởng phòng không lập được", async () => {
    const options = await as(manager, "get", "/crm/customer-assignment-options");
    expect(options.status).toBe(200);
    expect(options.body.canAssignAll).toBe(false);
    expect((options.body.users as { id: string }[]).map((user) => user.id).sort()).toEqual([ids.manager, ids.sellerA].sort());
    const outside = await as(manager, "post", "/crm/customer-assignments", assignment(ids.sellerB!, [customers.B!]));
    expect(outside.status).toBe(400);
    expect(Object.keys(outside.body.error.fields).sort()).toEqual(["partnerIds.0", "targetUserId"]);
    expect((await as(sellerB, "get", "/crm/customer-assignment-options")).status).toBe(403);
    expect((await as(sellerB, "post", "/crm/customer-assignments", assignment(ids.sellerB!, [customers.A!]))).status).toBe(403);
    // Bỏ phiếu nháp chưa gửi.
    const draft = await as(manager, "post", "/crm/customer-assignments", assignment(ids.manager!, [customers.A!]));
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect(draft.body).toMatchObject({ status: "draft", canDiscard: true, customerCount: 1 });
    expect((await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/discard`, { version: draft.body.version })).status).toBe(204);
    expect((await as(manager, "get", `/crm/customer-assignments/${draft.body.id}`)).status).toBe(404);
  });

  it("KICHBAN_KIEMTHU_281: chưa có chính sách duyệt thì áp dụng ngay; nhân viên cũ không còn thấy khách; đơn đã gán hoa hồng giữ nhân viên cũ", async () => {
    const draft = await as(manager, "post", "/crm/customer-assignments", assignment(ids.manager!, [customers.A!]));
    const applied = await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/submit`, { version: draft.body.version });
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    expect(applied.body).toMatchObject({ status: "applied", documentNo: expect.stringMatching(/^GK/) });
    expect(applied.body.lines[0]).toMatchObject({ partnerId: customers.A, previousOwnerName: "Bán Hàng A", currentOwnerName: "Trưởng Phòng KD" });
    expect(await ownerOf(customers.A!)).toBe(ids.manager);
    expect(await listed(sellerA, "/crm/partners")).not.toContain(customers.A);
    expect((await as(sellerA, "get", `/sales/orders/${orders.ofA}`)).status).toBe(404);
    expect((await as(sellerA, "get", `/sales/orders/${orders.commission}`)).status).toBe(200);
    const commission = await pool.query("SELECT commission_user_id FROM sales.orders WHERE id = $1", [orders.commission]);
    expect(commission.rows[0].commission_user_id).toBe(ids.sellerA);
    const notices = await pool.query<{ user_id: string; title: string }>("SELECT user_id, title FROM core.notifications WHERE kind LIKE 'crm.customer_assignment.%' ORDER BY title");
    expect(notices.rows).toEqual([
      { user_id: ids.sellerA, title: `1 khách hàng của bạn đã chuyển cho nhân viên khác theo phiếu ${applied.body.documentNo}` },
      { user_id: ids.manager, title: `Bạn được giao 1 khách hàng theo phiếu ${applied.body.documentNo}` },
    ]);
    // Nhân viên nhận xem được phiếu giao cho mình.
    expect((await as(manager, "get", "/crm/customer-assignments")).body.total).toBe(1);
  });

  it("KICHBAN_KIEMTHU_282: có chính sách duyệt thì chờ duyệt; rút, gửi lại giữ số; khách đổi nhân viên trong lúc chờ thì bị từ chối; sửa, gửi lại, duyệt thì áp dụng", async () => {
    const policy = await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "crm.customer_assignment",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.retailAdmin }, substitute: { type: "user", userId: testIds.purchasingManager }, dueHours: 8 }],
      },
    });
    expect(policy.status, JSON.stringify(policy.body)).toBe(201);
    const draft = await as(manager, "post", "/crm/customer-assignments", assignment(ids.sellerA!, [customers.A!]));
    const pending = await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/submit`, { version: draft.body.version });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true, canEdit: false });
    expect(await ownerOf(customers.A!)).toBe(ids.manager);
    const withdrawn = await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/withdraw`);
    expect(withdrawn.body).toMatchObject({ status: "withdrawn", canEdit: true });
    const again = await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/submit`, { version: withdrawn.body.version });
    expect(again.body).toMatchObject({ status: "pending", documentNo: pending.body.documentNo });
    const decide = async () => {
      const requestId = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM crm.customer_assignments WHERE id = $1", [draft.body.id])).rows[0]!.approval_request_id;
      const decided = await retailAdmin.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "" } });
      expect(decided.status, JSON.stringify(decided.body)).toBe(200);
      await application.get(OutboxService).dispatchPending();
      return (await as(manager, "get", `/crm/customer-assignments/${draft.body.id}`)).body;
    };
    // Khách đổi nhân viên trong lúc chờ duyệt (phiếu khác đã áp dụng).
    await pool.query("UPDATE crm.partner_profiles SET owner_user_id = $1 WHERE partner_id = $2 AND company_id = $3", [ids.sellerB, customers.A, retail]);
    const rejected = await decide();
    expect(rejected).toMatchObject({ status: "rejected", canEdit: true, applyError: "assignmentOwnersChanged", applyErrorDetail: "Khách A" });
    expect(await ownerOf(customers.A!)).toBe(ids.sellerB);
    await pool.query("UPDATE crm.partner_profiles SET owner_user_id = $1 WHERE partner_id = $2 AND company_id = $3", [ids.manager, customers.A, retail]);
    const edited = await as(
      manager,
      "patch",
      `/crm/customer-assignments/${draft.body.id}`,
      assignment(ids.sellerA!, [customers.A!], { reason: "Trả khách cho nhân viên A", version: rejected.version }),
    );
    expect(edited.body).toMatchObject({ status: "draft", reason: "Trả khách cho nhân viên A", applyError: null });
    await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/submit`, { version: edited.body.version });
    expect(await decide()).toMatchObject({ status: "applied" });
    expect(await ownerOf(customers.A!)).toBe(ids.sellerA);
    expect(await listed(sellerA, "/crm/partners")).toContain(customers.A);
  });

  it("KICHBAN_KIEMTHU_283: lịch sử phụ trách ghi đủ các lần, kèm số phiếu; người không thấy khách không xem được lịch sử", async () => {
    const history = await as(retailAdmin, "get", `/crm/partners/${customers.A}/owner-history`);
    expect(history.status).toBe(200);
    expect(
      (history.body as { userName: string; validTo: string | null; documentNo: string | null }[]).map((item) => [item.userName, item.validTo === null, item.documentNo?.startsWith("GK") ?? false]),
    ).toEqual([
      ["Bán Hàng A", true, true],
      ["Trưởng Phòng KD", false, true],
      ["Bán Hàng A", false, false],
    ]);
    expect((await as(sellerB, "get", `/crm/partners/${customers.A}/owner-history`)).status).toBe(404);
    expect((await as(sellerA, "get", `/crm/partners/${customers.A}/owner-history`)).status).toBe(200);
  });
});

describe("CONG_VIEC_21 sửa lỗi rà soát", () => {
  it("KICHBAN_KIEMTHU_286: nhận đối tác có sẵn làm khách; nhân viên nhận ngừng làm việc thì phiếu bị từ chối; sửa đơn nháp của khách đã chuyển đi; giá không lấy nhóm khách ngoài phạm vi", async () => {
    // Đối tác có sẵn trong tập đoàn, công ty chưa có hồ sơ: nhân viên nhận làm khách của mình.
    const shared = await as(retailAdmin, "post", "/crm/partners", { kind: "organization", name: "Đối tác dùng chung", taxCode: "0321000010" });
    const lookup = await as(sellerB, "get", "/crm/partners/lookup?taxCode=0321000010");
    expect(lookup.body).toMatchObject({ partner: { id: shared.body.id }, canClaim: true });
    expect((await as(retailAdmin, "get", "/crm/partners/lookup?taxCode=0321000010")).body.canClaim).toBe(false);
    const claimed = await as(sellerB, "post", `/crm/partners/${shared.body.id}/claim`);
    expect(claimed.status, JSON.stringify(claimed.body)).toBe(201);
    expect(claimed.body.profile).toMatchObject({ isCustomer: true, paymentTermDays: 0, ownerUserName: "Bán Hàng B" });
    const again = await as(sellerA, "post", `/crm/partners/${shared.body.id}/claim`);
    expect(again.status).toBe(409);
    expect((await as(sellerA, "get", "/crm/partners/lookup?taxCode=0321000010")).body.canClaim).toBe(false);

    // Nhân viên nhận ngừng ở công ty trong lúc chờ duyệt: phiếu bị từ chối, khách giữ nguyên.
    const draft = await as(manager, "post", "/crm/customer-assignments", assignment(ids.manager!, [customers.A!]));
    const pending = await as(manager, "post", `/crm/customer-assignments/${draft.body.id}/submit`, { version: draft.body.version });
    expect(pending.body.status).toBe("pending");
    await pool.query("UPDATE core.user_company_memberships SET status = 'inactive' WHERE user_id = $1 AND company_id = $2", [ids.manager, retail]);
    const requestId = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM crm.customer_assignments WHERE id = $1", [draft.body.id])).rows[0]!.approval_request_id;
    expect((await retailAdmin.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "approved", comment: "" } })).status).toBe(200);
    await application.get(OutboxService).dispatchPending();
    await pool.query("UPDATE core.user_company_memberships SET status = 'active' WHERE user_id = $1 AND company_id = $2", [ids.manager, retail]);
    expect((await as(retailAdmin, "get", `/crm/customer-assignments/${draft.body.id}`)).body).toMatchObject({ status: "rejected", applyError: "assignmentTargetInactive" });
    expect(await ownerOf(customers.A!)).toBe(ids.sellerA);

    // Đơn nháp do nhân viên B lập cho khách B; khách B chuyển cho nhân viên A: nhân viên B vẫn sửa được đơn với khách đang có.
    await order("draftOfB", customers.B!, ids.sellerB!);
    await pool.query("UPDATE crm.partner_profiles SET owner_user_id = $1 WHERE partner_id = $2 AND company_id = $3", [ids.sellerA, customers.B, retail]);
    const line = { variantId: "00000000-0000-4000-8000-000000000000", unitId: "00000000-0000-4000-8000-000000000000", quantity: "1" };
    const kept = await as(sellerB, "patch", `/sales/orders/${orders.draftOfB}`, { customerId: customers.B, channelId, warehouseId, orderDate: today, lines: [line], version: 1 });
    expect(kept.status).toBe(400);
    expect(kept.body.error.fields.customerId).toBeUndefined();
    const switched = await as(sellerB, "patch", `/sales/orders/${orders.draftOfB}`, { customerId: customers.A, channelId, warehouseId, orderDate: today, lines: [line], version: 1 });
    expect(switched.body.error.fields.customerId).toBeDefined();
  });
});
