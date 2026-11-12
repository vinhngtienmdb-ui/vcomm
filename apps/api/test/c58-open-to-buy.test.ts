// CONG_VIEC_58 lát L1: số đã dùng, số còn được mua (TIEUCHI_NGHIEMTHU_414, 415; KICHBAN_KIEMTHU_588, 589).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let retailAdmin: Session;
let manager: Session;
let keeper: Session;
const retail: string = testIds.retailCompany;
let food: string;
let foodChild: string;
let drink: string;
let warehouseA: string;
let warehouseB: string;
let supplierId: string;
let unitId: string;
const variants: Record<string, string> = {};

async function assign(email: string, roles: string[], branchId?: string) {
  const id = await createTestUser(pool, email, email, [{ companyId: retail, branchId }]);
  for (const role of roles) {
    const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
      id,
      roleId,
      branchId ? "branch" : "company",
      retail,
      branchId ?? null,
    ]);
  }
  return signIn(application, email);
}

// Đơn mua ghi thẳng vào cơ sở dữ liệu với trạng thái cần thử; dòng: [mặt hàng, số lượng, đơn giá].
async function order(status: string, orderDate: string, warehouseId: string, lines: [string, number, number][], extra: { currency?: string; approvedTotal?: number } = {}) {
  const total = lines.reduce((sum, [, quantity, price]) => sum + quantity * price, 0);
  const created = await pool.query<{ id: string }>(
    `INSERT INTO purchasing.orders (company_id, supplier_id, warehouse_id, order_date, currency, status, total_amount, approved_total, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      retail,
      supplierId,
      warehouseId,
      orderDate,
      extra.currency ?? "VND",
      status,
      total,
      extra.approvedTotal ?? (["approved", "received", "closed"].includes(status) ? total : null),
      testIds.retailAdmin,
    ],
  );
  const lineIds: string[] = [];
  for (const [index, [key, quantity, price]] of lines.entries()) {
    const line = await pool.query<{ id: string }>(
      `INSERT INTO purchasing.order_lines (order_id, line_no, variant_id, unit_id, quantity, base_quantity, unit_price, vat_rate, amount)
       VALUES ($1, $2, $3, $4, $5, $5, $6, '10', $7) RETURNING id`,
      [created.rows[0]!.id, index + 1, variants[key], unitId, quantity, price, quantity * price],
    );
    lineIds.push(line.rows[0]!.id);
  }
  return { id: created.rows[0]!.id, lineIds };
}

// Phiếu nhập mua theo dòng đơn (đã ghi sổ hoặc chờ kiểm tra).
async function receipt(orderId: string, orderLineId: string, key: string, quantity: number, status = "posted", rejected = 0) {
  const document = await pool.query<{ id: string }>(
    `INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, status, created_by, source_type, source_id, partner_id)
     VALUES ($1, $2, 'purchase_receipt', '2026-10-20', 'purchase', 'Nhập mua', $3, $4, 'purchasing.order', $5, $6) RETURNING id`,
    [retail, warehouseA, status, testIds.retailAdmin, orderId, supplierId],
  );
  const line = await pool.query<{ id: string }>(
    `INSERT INTO inventory.document_lines (document_id, line_no, variant_id, unit_id, quantity, base_quantity, source_line_id, rejected_base_quantity) VALUES ($1, 1, $2, $3, $4, $4, $5, $6) RETURNING id`,
    [document.rows[0]!.id, variants[key], unitId, quantity, orderLineId, rejected],
  );
  return { documentId: document.rows[0]!.id, lineId: line.rows[0]!.id };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  manager = await assign("ngansach.otb@vcomm.test", ["purchaser"]);
  const role = await pool.query<{ id: string }>(
    "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'budget_otb', 'Ngân sách', 'Budget', false, 'active') RETURNING id",
    [retail],
  );
  await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'purchasing.budget.manage')", [role.rows[0]!.id]);
  const managerId = (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = 'ngansach.otb@vcomm.test'")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [managerId, role.rows[0]!.id, retail]);
  keeper = await assign("thukho.otb@vcomm.test", ["warehouse_keeper"], testIds.binhDuongWarehouse);

  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: `Ngành ${code}`, nameEn: code, ...extra } })).body.id as string;
  food = await category("OTBTP");
  foodChild = await category("OTBTPC", { parentId: food });
  const foodGrandChild = await category("OTBTPD", { parentId: foodChild });
  const foodOther = await category("OTBTPK", { parentId: food });
  drink = await category("OTBDU");
  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const product = async (key: string, categoryId: string) => {
    const created = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId, name: `Hàng ${key}`, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    variants[key] = created.body.variants[0].id;
  };
  await product("rice", foodGrandChild);
  await product("noodle", foodOther);
  await product("water", drink);
  const warehouse = async (branchId: string, code: string) =>
    (await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId, code, name: `Kho ${code}`, usesLocations: false } })).body.id as string;
  warehouseA = await warehouse(testIds.binhDuongWarehouse, "OTBA");
  warehouseB = await warehouse(testIds.headOfficeBranch, "OTBB");
  supplierId = (await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Nhà cung cấp OTB", taxCode: "0310000058" } })).body.id as string;
  await pool.query("INSERT INTO core.exchange_rates (rate_date, from_currency, to_currency, rate_type, rate, source) VALUES ('2026-10-01', 'USD', 'VND', 'accounting', 25000, 'manual')");

  // Kế hoạch đã duyệt tháng 10, 11/2026 (duyệt thẳng trong cơ sở dữ liệu; luồng duyệt đã thử ở c58-budget-plans).
  const plan = await pool.query<{ id: string }>(
    "INSERT INTO purchasing.budget_plans (company_id, document_no, from_month, to_month, currency, status, created_by) VALUES ($1, 'NSM-OTB-1', '2026-10-01', '2026-11-01', 'VND', 'approved', $2) RETURNING id",
    [retail, testIds.retailAdmin],
  );
  await pool.query(
    `INSERT INTO purchasing.budget_lines (plan_id, category_id, warehouse_id, month, amount, adjusted_amount) VALUES
     ($1, $2, $3, '2026-10-01', 10000000, 0), ($1, $2, $3, '2026-11-01', 8000000, 1000000), ($1, $4, $3, '2026-10-01', 2000000, 0)`,
    [plan.rows[0]!.id, food, warehouseA, drink],
  );
  // Kế hoạch nháp tháng 12: chưa áp dụng.
  await pool.query("INSERT INTO purchasing.budget_plans (company_id, from_month, to_month, currency, status, created_by) VALUES ($1, '2026-12-01', '2026-12-01', 'VND', 'draft', $2)", [
    retail,
    testIds.retailAdmin,
  ]);

  // Tháng 10, Thực phẩm (cấp 1 qua ngành hàng cấp 3), kho A.
  await order("approved", "2026-10-03", warehouseA, [["rice", 10, 100000]]); // 1.000.000
  const received = await order("received", "2026-10-05", warehouseA, [
    ["noodle", 20, 50000],
    ["water", 10, 30000],
  ]); // 1.000.000 thực phẩm, 300.000 đồ uống
  // Trả nhà cung cấp 5 gói từ phiếu nhập của đơn nhận đủ: không giảm số đã dùng (quyết định người dùng 2026-11-12).
  const receiptLine = await receipt(received.id, received.lineIds[0]!, "noodle", 20);
  const returned = await pool.query<{ id: string }>(
    `INSERT INTO inventory.documents (company_id, warehouse_id, type, document_date, reason_code, reason, status, created_by, source_type, source_id, partner_id)
     VALUES ($1, $2, 'purchase_return', '2026-10-25', 'purchase_return', 'Trả hàng', 'posted', $3, 'inventory.purchase_receipt', $4, $5) RETURNING id`,
    [retail, warehouseA, testIds.retailAdmin, receiptLine.documentId, supplierId],
  );
  await pool.query("INSERT INTO inventory.document_lines (document_id, line_no, variant_id, unit_id, quantity, base_quantity, source_line_id) VALUES ($1, 1, $2, $3, 5, 5, $4)", [
    returned.rows[0]!.id,
    variants.noodle,
    unitId,
    receiptLine.lineId,
  ]);
  const closed = await order("closed", "2026-10-07", warehouseA, [["rice", 100, 10000]]); // nhận đạt 30 (40 nhập, 10 không đạt) → 300.000
  await receipt(closed.id, closed.lineIds[0]!, "rice", 40, "posted", 10);
  await receipt(closed.id, closed.lineIds[0]!, "rice", 50, "quality_check");
  await order("pending", "2026-10-08", warehouseA, [["rice", 1, 9000000]]); // chờ duyệt lần đầu: không tính
  await order("draft", "2026-10-09", warehouseA, [["rice", 1, 9000000]]);
  await order("rejected", "2026-10-09", warehouseA, [["rice", 1, 9000000]]); // bị từ chối lần đầu: không tính
  await order("pending", "2026-10-10", warehouseA, [["noodle", 10, 60000]], { approvedTotal: 400000 }); // duyệt lại: tính 400.000
  await order("approved", "2026-10-12", warehouseA, [["noodle", 2, 10]], { currency: "USD" }); // 20 USD × 25.000 = 500.000
  await order("approved", "2026-10-15", warehouseB, [["water", 5, 100000]]); // đồ uống kho B: chưa có ô → hiện "chưa có ngân sách"
  // Tháng 11 và tháng 12 (chưa áp dụng).
  await order("approved", "2026-11-02", warehouseA, [["rice", 1, 9500000]]); // vượt: còn 8.000.000 + 1.000.000 − 9.500.000 = −500.000
  await order("approved", "2026-12-01", warehouseA, [["rice", 1, 7000000]]);
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_414: số đã dùng theo trạng thái đơn", () => {
  it("KICHBAN_KIEMTHU_588: đã duyệt, nhận đủ, đóng sớm, chờ duyệt, duyệt lại, ngoại tệ; kế hoạch hiện đã dùng từng ô", async () => {
    const list = await manager.call("get", "/purchasing/budget-plans?year=2026&status=approved", { companyId: retail });
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    const planId = list.body.data[0].id as string;
    // Thực phẩm A tháng 10: 1.000.000 + 1.000.000 + 300.000 + 400.000 + 500.000 = 3.200.000; đồ uống A tháng 10: 300.000; đồ uống B: 500.000; tháng 11: 9.500.000.
    expect(list.body.data[0].usedAmount).toBe("13500000");
    const detail = await manager.call("get", `/purchasing/budget-plans/${planId}`, { companyId: retail });
    const usedOf = (categoryId: string, month: string) => detail.body.lines.find((line: { categoryId: string; month: string }) => line.categoryId === categoryId && line.month === month).usedAmount;
    expect(usedOf(food, "2026-10")).toBe("3200000");
    expect(usedOf(food, "2026-11")).toBe("9500000");
    expect(usedOf(drink, "2026-10")).toBe("300000");
    const draft = (await manager.call("get", "/purchasing/budget-plans?status=draft", { companyId: retail })).body.data[0];
    expect(draft.usedAmount).toBeNull();
  });
});

describe("TIEUCHI_NGHIEMTHU_415: số còn được mua theo kỳ", () => {
  it("KICHBAN_KIEMTHU_589: theo tháng, quý, năm; lọc ngành hàng, kho; ô chưa có ngân sách; tháng chưa áp dụng không hiện; đơn của một ô", async () => {
    const monthly = await manager.call("get", "/purchasing/open-to-buy?year=2026&period=month", { companyId: retail });
    expect(monthly.status, JSON.stringify(monthly.body)).toBe(200);
    const pick = (rows: { categoryId: string; warehouseId: string; period: string }[], categoryId: string, warehouseId: string, period: string) =>
      rows.find((row) => row.categoryId === categoryId && row.warehouseId === warehouseId && row.period === period);
    expect(pick(monthly.body.rows, food, warehouseA, "2026-10")).toMatchObject({ budget: "10000000", adjusted: "0", used: "3200000", remaining: "6800000", hasBudget: true, month: "2026-10" });
    expect(pick(monthly.body.rows, food, warehouseA, "2026-11")).toMatchObject({ budget: "8000000", adjusted: "1000000", used: "9500000", remaining: "-500000" });
    expect(pick(monthly.body.rows, drink, warehouseB, "2026-10")).toMatchObject({ budget: "0", used: "500000", remaining: "-500000", hasBudget: false });
    expect(pick(monthly.body.rows, food, warehouseA, "2026-12")).toBeUndefined();
    expect(monthly.body.total).toEqual({ budget: "20000000", adjusted: "1000000", used: "13500000", remaining: "7500000" });

    const quarterly = await manager.call("get", "/purchasing/open-to-buy?year=2026&period=quarter", { companyId: retail });
    expect(pick(quarterly.body.rows, food, warehouseA, "2026-Q4")).toMatchObject({ budget: "18000000", adjusted: "1000000", used: "12700000", remaining: "6300000", month: null });
    const yearly = await manager.call("get", `/purchasing/open-to-buy?year=2026&period=year&categoryId=${drink}`, { companyId: retail });
    expect(yearly.body.rows.map((row: { warehouseId: string }) => row.warehouseId).sort()).toEqual([warehouseA, warehouseB].sort());
    const byWarehouse = await manager.call("get", `/purchasing/open-to-buy?year=2026&warehouseId=${warehouseB}`, { companyId: retail });
    expect(byWarehouse.body.rows).toHaveLength(1);
    expect((await manager.call("get", "/purchasing/open-to-buy?year=2025", { companyId: retail })).body.rows).toEqual([]);

    const orders = await manager.call("get", `/purchasing/open-to-buy/orders?categoryId=${food}&warehouseId=${warehouseA}&month=2026-10`, { companyId: retail });
    expect(orders.status).toBe(200);
    expect(orders.body.map((item: { amount: string }) => item.amount)).toEqual(["1000000", "1000000", "300000", "400000", "500000"]);
    expect(orders.body.map((item: { status: string }) => item.status)).toEqual(["approved", "received", "closed", "pending", "approved"]);

    expect((await keeper.call("get", "/purchasing/open-to-buy?year=2026", { companyId: retail })).status).toBe(403);
    expect((await manager.call("get", "/purchasing/open-to-buy", { companyId: retail })).status).toBe(400);
  });
});
