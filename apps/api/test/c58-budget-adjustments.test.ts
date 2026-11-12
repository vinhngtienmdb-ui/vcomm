// CONG_VIEC_58 lát L3: phiếu điều chỉnh ngân sách (TIEUCHI_NGHIEMTHU_418, 419; KICHBAN_KIEMTHU_593, 594).
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
const retail: string = testIds.retailCompany;
const trading: string = testIds.tradingCompany;
let food: string;
let drink: string;
let warehouseId: string;
let planId: string;
let draftPlanId: string;

async function decide(requestId: string, decision: "approved" | "rejected") {
  const response = await approver.call("post", `/approval-requests/${requestId}/decisions`, { body: { decision, comment: "Kiểm thử" } });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  await application.get(OutboxService).dispatchPending();
}
async function userWith(email: string, role: string, branchId?: string) {
  const id = await createTestUser(pool, email, email, [{ companyId: retail, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    retail,
    branchId ?? null,
  ]);
  return { id, session: await signIn(application, email) };
}
const cellOf = async (categoryId: string, month: string) =>
  (await pool.query("SELECT amount::text, adjusted_amount::text FROM purchasing.budget_lines WHERE plan_id = $1 AND category_id = $2 AND month = $3", [planId, categoryId, `${month}-01`])).rows[0];

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  const managerUser = await userWith("ngansach.dc@vcomm.test", "purchaser");
  const role = await pool.query<{ id: string }>(
    "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'budget_dc', 'Ngân sách', 'Budget', false, 'active') RETURNING id",
    [retail],
  );
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'purchasing.budget.manage')", [role.rows[0]!.id]);
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [
    managerUser.id,
    role.rows[0]!.id,
    retail,
  ]);
  manager = managerUser.session;
  purchaser = (await userWith("muahang.dc@vcomm.test", "purchaser")).session;
  keeper = (await userWith("thukho.dc@vcomm.test", "warehouse_keeper", testIds.binhDuongWarehouse)).session;

  const category = async (code: string) => (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: `Ngành ${code}`, nameEn: code } })).body.id as string;
  food = await category("DCTP");
  drink = await category("DCDU");
  const leaf = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "DCTPA", nameVi: "Lá", nameEn: "Leaf", parentId: food } })).body.id as string;
  const unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const product = await retailAdmin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: leaf, name: "Hàng điều chỉnh", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  warehouseId = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "DCNS", name: "Kho điều chỉnh", usesLocations: false } })
  ).body.id;
  const supplier = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Nhà cung cấp điều chỉnh", taxCode: "0310000258" } });

  planId = (
    await pool.query<{ id: string }>(
      "INSERT INTO purchasing.budget_plans (company_id, document_no, from_month, to_month, currency, status, created_by) VALUES ($1, 'NSM-DC-1', '2026-10-01', '2026-12-01', 'VND', 'approved', $2) RETURNING id",
      [retail, testIds.retailAdmin],
    )
  ).rows[0]!.id;
  await pool.query("INSERT INTO purchasing.budget_lines (plan_id, category_id, warehouse_id, month, amount) VALUES ($1, $2, $3, '2026-11-01', 1000000)", [planId, food, warehouseId]);
  draftPlanId = (
    await pool.query<{ id: string }>(
      "INSERT INTO purchasing.budget_plans (company_id, from_month, to_month, currency, status, created_by) VALUES ($1, '2027-01-01', '2027-01-01', 'VND', 'draft', $2) RETURNING id",
      [retail, testIds.retailAdmin],
    )
  ).rows[0]!.id;
  // Đơn đã duyệt dùng 700.000 của ô Thực phẩm tháng 11.
  const order = await pool.query<{ id: string }>(
    `INSERT INTO purchasing.orders (company_id, supplier_id, warehouse_id, order_date, currency, status, total_amount, approved_total, created_by)
     VALUES ($1, $2, $3, '2026-11-05', 'VND', 'approved', 700000, 700000, $4) RETURNING id`,
    [retail, supplier.body.id, warehouseId, testIds.retailAdmin],
  );
  await pool.query(
    "INSERT INTO purchasing.order_lines (order_id, line_no, variant_id, unit_id, quantity, base_quantity, unit_price, vat_rate, amount) VALUES ($1, 1, $2, $3, 7, 7, 100000, '10', 700000)",
    [order.rows[0]!.id, product.body.variants[0].id, unitId],
  );
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_418: phiếu điều chỉnh ngân sách", () => {
  it("KICHBAN_KIEMTHU_593: tăng, giảm, chuyển khác tháng; giảm dưới đã dùng bị từ chối; duyệt xong áp đúng vào ô; từ chối không đổi", async () => {
    const transfer = (lines: { categoryId: string; month: string; delta: string }[], extra: Record<string, unknown> = {}) => ({
      planId,
      reason: "Chuyển ngân sách Thực phẩm tháng 11 sang Đồ uống tháng 12",
      lines: lines.map((line) => ({ ...line, warehouseId })),
      ...extra,
    });
    expect(
      (await manager.call("post", "/purchasing/budget-adjustments", { companyId: retail, body: { ...transfer([{ categoryId: food, month: "2026-11", delta: "1" }]), planId: draftPlanId } })).body.error
        .fields,
    ).toEqual({
      planId: "Chỉ điều chỉnh kế hoạch ngân sách đã duyệt.",
    });
    const outside = await manager.call("post", "/purchasing/budget-adjustments", { companyId: retail, body: transfer([{ categoryId: food, month: "2027-01", delta: "1" }]) });
    expect(outside.body.error.fields).toEqual({ "lines.0.month": "Tháng nằm ngoài kỳ kế hoạch." });
    expect((await manager.call("post", "/purchasing/budget-adjustments", { companyId: retail, body: transfer([{ categoryId: food, month: "2026-11", delta: "0" }]) })).status).toBe(400);

    // Giảm 400.000: còn 600.000 < đã dùng 700.000 → bị từ chối khi gửi.
    const tooMuch = await manager.call("post", "/purchasing/budget-adjustments", {
      companyId: retail,
      body: transfer([
        { categoryId: food, month: "2026-11", delta: "-400000" },
        { categoryId: drink, month: "2026-12", delta: "400000" },
      ]),
    });
    expect(tooMuch.status, JSON.stringify(tooMuch.body)).toBe(201);
    expect(tooMuch.body).toMatchObject({ status: "draft", totalIncrease: "400000", totalDecrease: "400000", canSubmit: true, planDocumentNo: "NSM-DC-1" });
    expect(tooMuch.body.lines[0]).toMatchObject({ currentBudget: "1000000", used: "700000", after: "600000", delta: "-400000" });
    expect(tooMuch.body.lines[1]).toMatchObject({ currentBudget: "0", used: "0", after: "400000" });
    const noPolicy = await manager.call("post", `/purchasing/budget-adjustments/${tooMuch.body.id}/submit`, { companyId: retail, body: { version: tooMuch.body.version } });
    expect(noPolicy.body.error.fields).toEqual({ "lines.0.delta": "Ngân sách sau điều chỉnh nhỏ hơn số đã dùng của ô." });

    const fixed = await manager.call("patch", `/purchasing/budget-adjustments/${tooMuch.body.id}`, {
      companyId: retail,
      body: transfer(
        [
          { categoryId: food, month: "2026-11", delta: "-300000" },
          { categoryId: drink, month: "2026-12", delta: "300000" },
        ],
        { version: tooMuch.body.version },
      ),
    });
    expect(fixed.status, JSON.stringify(fixed.body)).toBe(200);
    const missingPolicy = await manager.call("post", `/purchasing/budget-adjustments/${fixed.body.id}/submit`, { companyId: retail, body: { version: fixed.body.version } });
    expect(missingPolicy.status).toBe(409);
    expect(missingPolicy.body.error.message).toBe("Chưa có chính sách duyệt cho loại chứng từ này.");

    const created = await retailAdmin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "purchasing.budget_adjustment",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    expect(created.status).toBe(201);
    const pending = await manager.call("post", `/purchasing/budget-adjustments/${fixed.body.id}/submit`, { companyId: retail, body: { version: fixed.body.version } });
    expect(pending.body).toMatchObject({ status: "pending", canEdit: false, canWithdraw: true });
    expect(pending.body.documentNo).toMatch(/^DCNS-VCR-\d{4}-000001$/);
    const request = await pool.query("SELECT amount::text FROM core.approval_requests WHERE id = $1", [pending.body.approvalRequestId]);
    expect(request.rows[0].amount).toBe("300000.0000");
    expect(await cellOf(food, "2026-11")).toEqual({ amount: "1000000.0000", adjusted_amount: "0.0000" });
    await decide(pending.body.approvalRequestId, "approved");
    expect(await cellOf(food, "2026-11")).toEqual({ amount: "1000000.0000", adjusted_amount: "-300000.0000" });
    expect(await cellOf(drink, "2026-12")).toEqual({ amount: "0.0000", adjusted_amount: "300000.0000" });
    const approved = await manager.call("get", `/purchasing/budget-adjustments/${fixed.body.id}`, { companyId: retail });
    expect(approved.body).toMatchObject({ status: "approved", canEdit: false, canCancel: false });
    expect(approved.body.lines[0]).toMatchObject({ currentBudget: "1000000", after: "700000" });
    const openToBuy = await manager.call("get", "/purchasing/open-to-buy?year=2026", { companyId: retail });
    expect(openToBuy.body.rows.find((row: { categoryId: string }) => row.categoryId === food)).toMatchObject({ budget: "1000000", adjusted: "-300000", used: "700000", remaining: "0" });
    expect(openToBuy.body.rows.find((row: { categoryId: string }) => row.categoryId === drink)).toMatchObject({ budget: "0", adjusted: "300000", hasBudget: true });
    const applied = await pool.query("SELECT 1 FROM core.audit_events WHERE action = 'budget_adjustment.apply' AND entity_id = $1", [fixed.body.id]);
    expect(applied.rows).toHaveLength(1);

    // Phiếu tăng bị từ chối: ô không đổi; rút, hủy.
    const increase = await manager.call("post", "/purchasing/budget-adjustments", { companyId: retail, body: transfer([{ categoryId: food, month: "2026-10", delta: "500000" }], { reason: "Tăng" }) });
    const submitted = await manager.call("post", `/purchasing/budget-adjustments/${increase.body.id}/submit`, { companyId: retail, body: { version: increase.body.version } });
    await decide(submitted.body.approvalRequestId, "rejected");
    expect(await cellOf(food, "2026-10")).toBeUndefined();
    const rejected = await manager.call("get", `/purchasing/budget-adjustments/${increase.body.id}`, { companyId: retail });
    expect(rejected.body).toMatchObject({ status: "rejected", canEdit: true });
    const again = await manager.call("post", `/purchasing/budget-adjustments/${increase.body.id}/submit`, { companyId: retail, body: { version: rejected.body.version } });
    const withdrawn = await manager.call("post", `/purchasing/budget-adjustments/${increase.body.id}/withdraw`, { companyId: retail });
    expect(withdrawn.body.status).toBe("withdrawn");
    expect(again.body.status).toBe("pending");
    const cancelled = await manager.call("post", `/purchasing/budget-adjustments/${increase.body.id}/cancel`, { companyId: retail, body: { version: withdrawn.body.version } });
    expect(cancelled.body.status).toBe("cancelled");
    const list = await manager.call("get", `/purchasing/budget-adjustments?planId=${planId}`, { companyId: retail });
    expect(list.body.data.map((item: { status: string }) => item.status)).toEqual(["cancelled", "approved"]);
  });
});

describe("TIEUCHI_NGHIEMTHU_419: phân quyền phiếu điều chỉnh", () => {
  it("KICHBAN_KIEMTHU_594: nhân viên mua hàng chỉ xem; thủ kho không xem; công ty khác 404", async () => {
    const id = (await manager.call("get", "/purchasing/budget-adjustments", { companyId: retail })).body.data[0].id as string;
    const viewed = await purchaser.call("get", `/purchasing/budget-adjustments/${id}`, { companyId: retail });
    expect(viewed.status).toBe(200);
    expect(viewed.body).toMatchObject({ canEdit: false, canSubmit: false, canCancel: false });
    expect(
      (await purchaser.call("post", "/purchasing/budget-adjustments", { companyId: retail, body: { planId, reason: "x", lines: [{ categoryId: food, warehouseId, month: "2026-11", delta: "1" }] } }))
        .status,
    ).toBe(403);
    expect((await keeper.call("get", "/purchasing/budget-adjustments", { companyId: retail })).status).toBe(403);
    expect((await groupAdmin.call("get", `/purchasing/budget-adjustments/${id}`, { companyId: trading })).status).toBe(404);
  });
});
