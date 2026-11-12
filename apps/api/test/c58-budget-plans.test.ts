// CONG_VIEC_58 lát L0: kế hoạch ngân sách mua (TIEUCHI_NGHIEMTHU_412, 413, 419; KICHBAN_KIEMTHU_585 đến 587, 594).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let manager: Session;
let purchaser: Session;
let keeper: Session;
let approver: Session;
let tradingAdmin: Session;
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
let food: string;
let drink: string;
let subCategory: string;
let warehouseA: string;
let warehouseB: string;
let tradingWarehouse: string;

async function assign(email: string, name: string, roles: string[], companyId: string, branchId?: string) {
  const id = await createTestUser(pool, email, name, [{ companyId, branchId }]);
  for (const role of roles) {
    const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
      id,
      roleId,
      branchId ? "branch" : "company",
      companyId,
      branchId ?? null,
    ]);
  }
  return { id, session: await signIn(application, email) };
}

async function budgetManager(email: string, name: string, companyId: string) {
  const { id, session } = await assign(email, name, ["purchaser"], companyId);
  // Vai trò tự tạo có quyền lập ngân sách (QUYTAC_NGHIEPVU_453: không gán sẵn cho vai trò hệ thống nghiệp vụ).
  const role = await pool.query<{ id: string }>(
    "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, $2, 'Trưởng phòng mua hàng', 'Purchasing manager', false, 'active') RETURNING id",
    [companyId, `budget_${companyId.slice(0, 8)}`],
  );
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'purchasing.budget.manage'), ($1, 'purchasing.budget.view'), ($1, 'purchasing.access')", [
    role.rows[0]!.id,
  ]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [id, role.rows[0]!.id, companyId]);
  return session;
}

async function policy(session: Session, companyId: string, documentTypeCode: string) {
  const response = await session.call("post", "/approval-policies", {
    companyId,
    body: {
      documentTypeCode,
      currency: "VND",
      effectiveFrom: "2026-01-01",
      levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
    },
  });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
}

async function decide(requestId: string, decision: "approved" | "rejected") {
  const response = await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Kiểm thử" } });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  await application.get(OutboxService).dispatchPending();
}

const plan = (fromMonth: string, toMonth: string, lines: { categoryId: string; warehouseId: string; month: string; amount: string | number }[], extra: Record<string, unknown> = {}) => ({
  fromMonth,
  toMonth,
  note: "Ngân sách quý",
  lines,
  ...extra,
});

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  manager = await budgetManager("ngansach.vcr@vcomm.test", "Trương Văn Ngân", retail);
  purchaser = (await assign("muahang.ns@vcomm.test", "Đinh Văn Mua", ["purchaser"], retail)).session;
  keeper = (await assign("thukho.ns@vcomm.test", "Kiều Văn Kho", ["warehouse_keeper"], retail, testIds.binhDuongWarehouse)).session;
  tradingAdmin = groupAdmin;

  const category = async (code: string, extra: Record<string, unknown> = {}) => {
    const created = await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: `Ngành ${code}`, nameEn: code, ...extra } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  food = await category("NSTP");
  drink = await category("NSDU");
  subCategory = await category("NSTPC", { parentId: food });
  const warehouse = async (company: string, session: Session, branchId: string, code: string) => {
    const created = await session.call("post", "/inventory/warehouses", { companyId: company, body: { branchId, code, name: `Kho ${code}`, usesLocations: false } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    return created.body.id as string;
  };
  warehouseA = await warehouse(retail, retailAdmin, testIds.binhDuongWarehouse, "NSA");
  warehouseB = await warehouse(retail, retailAdmin, testIds.headOfficeBranch, "NSB");
  const tradingBranch = (
    await pool.query<{ id: string }>("INSERT INTO core.branches (company_id, code, name, branch_type, province_code) VALUES ($1, 'VCT-NS', 'Kho Hà Nội', 'warehouse', '01') RETURNING id", [trading])
  ).rows[0]!.id;
  tradingWarehouse = await warehouse(trading, tradingAdmin, tradingBranch, "NSC");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_412: lập, sửa kế hoạch ngân sách", () => {
  it("KICHBAN_KIEMTHU_585: lập 3 tháng × 2 ngành hàng × 2 kho, sửa; kiểm tra kỳ, số âm, ngành hàng cấp 2, kho công ty khác", async () => {
    const lines = [food, drink].flatMap((categoryId) =>
      [warehouseA, warehouseB].flatMap((warehouseId) => ["2026-10", "2026-11", "2026-12"].map((month) => ({ categoryId, warehouseId, month, amount: "100000000" }))),
    );
    const created = await manager.call("post", "/purchasing/budget-plans", { companyId: retail, body: plan("2026-10", "2026-12", lines) });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body).toMatchObject({ status: "draft", documentNo: null, currency: "VND", totalAmount: "1200000000", fromMonth: "2026-10", toMonth: "2026-12", canEdit: true, canSubmit: true });
    expect(created.body.lines).toHaveLength(12);

    const updated = await manager.call("patch", `/purchasing/budget-plans/${created.body.id}`, {
      companyId: retail,
      body: plan("2026-10", "2026-12", [{ categoryId: food, warehouseId: warehouseA, month: "2026-11", amount: "250000000.5" }], { version: created.body.version }),
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.totalAmount).toBe("250000000.5");
    expect(updated.body.lines[0]).toMatchObject({ categoryCode: "NSTP", warehouseName: "Kho NSA", month: "2026-11", amount: "250000000.5", adjustedAmount: "0" });

    const stale = await manager.call("patch", `/purchasing/budget-plans/${created.body.id}`, { companyId: retail, body: plan("2026-10", "2026-12", [], { version: created.body.version }) });
    expect(stale.status).toBe(409);

    const tooLong = await manager.call("post", "/purchasing/budget-plans", { companyId: retail, body: plan("2026-01", "2027-01", []) });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.error.fields).toEqual({ toMonth: "Đến tháng phải từ từ tháng trở đi; kỳ kế hoạch tối đa 12 tháng." });
    const reversed = await manager.call("post", "/purchasing/budget-plans", { companyId: retail, body: plan("2026-05", "2026-04", []) });
    expect(reversed.body.error.fields.toMonth).toBeDefined();

    const negative = await manager.call("post", "/purchasing/budget-plans", {
      companyId: retail,
      body: plan("2026-10", "2026-12", [{ categoryId: food, warehouseId: warehouseA, month: "2026-10", amount: "-5" }]),
    });
    expect(negative.status).toBe(400);
    const wrong = await manager.call("post", "/purchasing/budget-plans", {
      companyId: retail,
      body: plan("2026-10", "2026-12", [
        { categoryId: subCategory, warehouseId: warehouseA, month: "2026-10", amount: "1" },
        { categoryId: food, warehouseId: tradingWarehouse, month: "2026-10", amount: "1" },
        { categoryId: food, warehouseId: warehouseA, month: "2027-01", amount: "1" },
        { categoryId: drink, warehouseId: warehouseA, month: "2026-10", amount: "1" },
        { categoryId: drink, warehouseId: warehouseA, month: "2026-10", amount: "2" },
      ]),
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields).toEqual({
      "lines.0.categoryId": "Chỉ lập ngân sách cho ngành hàng cấp 1 đang dùng.",
      "lines.1.warehouseId": "Giá trị không hợp lệ.",
      "lines.2.month": "Tháng nằm ngoài kỳ kế hoạch.",
      "lines.4.month": "Ô ngân sách bị trùng (cùng ngành hàng, kho, tháng).",
    });
  });
});

describe("TIEUCHI_NGHIEMTHU_413: gửi duyệt, rút, hủy kế hoạch", () => {
  let planId: string;
  it("KICHBAN_KIEMTHU_586: chưa có chính sách thì lỗi; có chính sách thì chờ duyệt; từ chối, rút quay về sửa được; duyệt xong có hiệu lực", async () => {
    const created = await manager.call("post", "/purchasing/budget-plans", {
      companyId: retail,
      body: plan("2027-01", "2027-03", [{ categoryId: food, warehouseId: warehouseA, month: "2027-01", amount: "500000000" }]),
    });
    planId = created.body.id;
    const empty = await manager.call("post", "/purchasing/budget-plans", { companyId: retail, body: plan("2027-06", "2027-06", []) });
    const emptySubmit = await manager.call("post", `/purchasing/budget-plans/${empty.body.id}/submit`, { companyId: retail, body: { version: empty.body.version } });
    expect(emptySubmit.body.error.message).toBe("Kế hoạch chưa có ô ngân sách nào.");

    const noPolicy = await manager.call("post", `/purchasing/budget-plans/${planId}/submit`, { companyId: retail, body: { version: created.body.version } });
    expect(noPolicy.status).toBe(409);
    expect(noPolicy.body.error.message).toBe("Chưa có chính sách duyệt kế hoạch ngân sách mua. Nhờ quản trị công ty cấu hình ở Nền tảng › Chính sách duyệt.");
    expect((await manager.call("get", `/purchasing/budget-plans/${planId}`, { companyId: retail })).body).toMatchObject({ status: "draft", documentNo: null });

    await policy(retailAdmin, retail, "purchasing.budget_plan");
    const submitted = await manager.call("post", `/purchasing/budget-plans/${planId}/submit`, { companyId: retail, body: { version: created.body.version } });
    expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
    expect(submitted.body).toMatchObject({ status: "pending", canEdit: false, canWithdraw: true });
    expect(submitted.body.documentNo).toMatch(/^NSM-VCR-\d{4}-000001$/);
    const request = await pool.query("SELECT amount::text, document_type_code FROM core.approval_requests WHERE id = $1", [submitted.body.approvalRequestId]);
    expect(request.rows[0]).toEqual({ amount: "500000000.0000", document_type_code: "purchasing.budget_plan" });

    const withdrawn = await manager.call("post", `/purchasing/budget-plans/${planId}/withdraw`, { companyId: retail });
    expect(withdrawn.body).toMatchObject({ status: "withdrawn", canEdit: true });
    const again = await manager.call("post", `/purchasing/budget-plans/${planId}/submit`, { companyId: retail, body: { version: withdrawn.body.version } });
    await decide(again.body.approvalRequestId, "rejected");
    const rejected = await manager.call("get", `/purchasing/budget-plans/${planId}`, { companyId: retail });
    expect(rejected.body).toMatchObject({ status: "rejected", canEdit: true, documentNo: submitted.body.documentNo });

    const third = await manager.call("post", `/purchasing/budget-plans/${planId}/submit`, { companyId: retail, body: { version: rejected.body.version } });
    await decide(third.body.approvalRequestId, "approved");
    const approved = await manager.call("get", `/purchasing/budget-plans/${planId}`, { companyId: retail });
    expect(approved.body).toMatchObject({ status: "approved", canEdit: false, canCancel: false, canAdjust: true });
    const edit = await manager.call("patch", `/purchasing/budget-plans/${planId}`, { companyId: retail, body: plan("2027-01", "2027-03", [], { version: approved.body.version }) });
    expect(edit.status).toBe(409);
  });

  it("KICHBAN_KIEMTHU_587: kế hoạch trùng tháng với kế hoạch đã duyệt bị từ chối khi gửi; hủy kế hoạch nháp", async () => {
    const overlapping = await manager.call("post", "/purchasing/budget-plans", {
      companyId: retail,
      body: plan("2027-03", "2027-05", [{ categoryId: drink, warehouseId: warehouseB, month: "2027-04", amount: "1000" }]),
    });
    const refused = await manager.call("post", `/purchasing/budget-plans/${overlapping.body.id}/submit`, { companyId: retail, body: { version: overlapping.body.version } });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe("Kỳ kế hoạch trùng tháng với kế hoạch khác đang chờ duyệt hoặc đã duyệt.");

    const cancelled = await manager.call("post", `/purchasing/budget-plans/${overlapping.body.id}/cancel`, { companyId: retail, body: { version: overlapping.body.version } });
    expect(cancelled.body).toMatchObject({ status: "cancelled", canEdit: false, canSubmit: false });
    const approvedCancel = await manager.call("post", `/purchasing/budget-plans/${planId}/cancel`, { companyId: retail, body: { version: 99 } });
    expect(approvedCancel.status).toBe(409);

    const list = await manager.call("get", "/purchasing/budget-plans?year=2027", { companyId: retail });
    expect(list.body.data.map((item: { status: string }) => item.status).sort()).toEqual(["approved", "cancelled", "draft"]);
    expect((await manager.call("get", "/purchasing/budget-plans?status=approved", { companyId: retail })).body.total).toBe(1);
  });
});

describe("TIEUCHI_NGHIEMTHU_419: phân quyền kế hoạch ngân sách", () => {
  it("KICHBAN_KIEMTHU_594: nhân viên mua hàng chỉ xem; thủ kho không xem; công ty khác 404; nhật ký thao tác", async () => {
    const list = await manager.call("get", "/purchasing/budget-plans", { companyId: retail });
    const id = list.body.data[0].id as string;
    const viewed = await purchaser.call("get", `/purchasing/budget-plans/${id}`, { companyId: retail });
    expect(viewed.status).toBe(200);
    expect(viewed.body).toMatchObject({ canEdit: false, canSubmit: false, canCancel: false, canAdjust: false });
    expect((await purchaser.call("post", "/purchasing/budget-plans", { companyId: retail, body: plan("2028-01", "2028-01", []) })).status).toBe(403);
    expect((await keeper.call("get", "/purchasing/budget-plans", { companyId: retail })).status).toBe(403);
    expect((await keeper.call("get", "/purchasing/budget-options", { companyId: retail })).status).toBe(403);
    expect((await groupAdmin.call("get", `/purchasing/budget-plans/${id}`, { companyId: trading })).status).toBe(404);

    const options = await purchaser.call("get", "/purchasing/budget-options", { companyId: retail });
    expect(options.body.currency).toBe("VND");
    expect(options.body.categories.map((category: { code: string }) => category.code)).toEqual(expect.arrayContaining(["NSTP", "NSDU"]));
    expect(options.body.categories.map((category: { code: string }) => category.code)).not.toContain("NSTPC");
    expect(options.body.warehouses.map((warehouse: { code: string }) => warehouse.code)).toEqual(expect.arrayContaining(["NSA", "NSB"]));
    expect(options.body.warehouses.map((warehouse: { code: string }) => warehouse.code)).not.toContain("NSC");

    const actions = (await pool.query("SELECT DISTINCT action FROM core.audit_events WHERE entity_type = 'budget_plan' ORDER BY action")).rows.map((row) => row.action);
    expect(actions).toEqual(["budget_plan.cancel", "budget_plan.create", "budget_plan.submit", "budget_plan.update", "budget_plan.withdraw"]);
  });
});
