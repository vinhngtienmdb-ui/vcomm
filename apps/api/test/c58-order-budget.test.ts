// CONG_VIEC_58 lát L2: kiểm tra ngân sách khi lập, gửi duyệt đơn mua (TIEUCHI_NGHIEMTHU_416, 417; KICHBAN_KIEMTHU_590 đến 592).
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
let purchaser: Session;
let approver: Session;
const retail: string = testIds.retailCompany;
let food: string;
let drink: string;
let warehouseId: string;
let supplierId: string;
let unitId: string;
const variants: Record<string, string> = {};

async function policy(documentTypeCode: string) {
  const response = await retailAdmin.call("post", "/approval-policies", {
    companyId: retail,
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
const line = (key: string, quantity: number, unitPrice: number, extra: Record<string, unknown> = {}) => ({
  variantId: variants[key],
  unitId,
  quantity: String(quantity),
  unitPrice: String(unitPrice),
  vatRate: "10",
  ...extra,
});
async function createOrder(orderDate: string, lines: ReturnType<typeof line>[]) {
  const created = await purchaser.call("post", "/purchasing/orders", { companyId: retail, body: { supplierId, warehouseId, orderDate, note: null, lines } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body as { id: string; version: number };
}
const submit = (id: string) => purchaser.call("post", `/purchasing/orders/${id}/submit`, { companyId: retail });
const requestType = async (requestId: string) => (await pool.query("SELECT document_type_code FROM core.approval_requests WHERE id = $1", [requestId])).rows[0]!.document_type_code as string;

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  retailAdmin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  const purchaserId = await createTestUser(pool, "muahang.nsdm@vcomm.test", "Đinh Văn Mua", [{ companyId: retail }]);
  const role = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'purchaser' AND company_id IS NULL")).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [purchaserId, role, retail]);
  purchaser = await signIn(application, "muahang.nsdm@vcomm.test");

  const category = async (code: string, extra: Record<string, unknown> = {}) =>
    (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code, nameVi: `Ngành ${code}`, nameEn: code, ...extra } })).body.id as string;
  food = await category("DMTP");
  const foodLeaf = await category("DMTPA", { parentId: food });
  drink = await category("DMDU");
  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  for (const [key, categoryId] of [
    ["rice", foodLeaf],
    ["water", drink],
  ] as const) {
    const created = await retailAdmin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId, name: `Hàng ${key}`, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    variants[key] = created.body.variants[0].id;
  }
  warehouseId = (
    await retailAdmin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "DMNS", name: "Kho đơn ngân sách", usesLocations: false } })
  ).body.id;
  const partner = await retailAdmin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Nhà cung cấp ngân sách", taxCode: "0310000158" } });
  supplierId = partner.body.id;
  await retailAdmin.call("put", `/crm/partners/${supplierId}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: true, paymentTermDays: 30, creditLimit: null, version: 0 },
  });
  // Kế hoạch đã duyệt tháng 11/2026: Thực phẩm, kho, 1.000.000.
  const plan = await pool.query<{ id: string }>(
    "INSERT INTO purchasing.budget_plans (company_id, document_no, from_month, to_month, currency, status, created_by) VALUES ($1, 'NSM-DM-1', '2026-11-01', '2026-11-01', 'VND', 'approved', $2) RETURNING id",
    [retail, testIds.retailAdmin],
  );
  await pool.query("INSERT INTO purchasing.budget_lines (plan_id, category_id, warehouse_id, month, amount) VALUES ($1, $2, $3, '2026-11-01', 1000000)", [plan.rows[0]!.id, food, warehouseId]);
  await policy("purchasing.order");
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_416: cảnh báo ngân sách khi lập đơn", () => {
  it("KICHBAN_KIEMTHU_590: trong ngân sách, vượt một ô, ô chưa có, tháng chưa áp dụng; khi sửa không tính chính đơn", async () => {
    const check = (body: Record<string, unknown>) => purchaser.call("post", "/purchasing/orders/budget-check", { companyId: retail, body: { warehouseId, orderDate: "2026-11-10", ...body } });
    const within = await check({ lines: [{ variantId: variants.rice, quantity: "4", unitPrice: "100000" }] });
    expect(within.status, JSON.stringify(within.body)).toBe(201);
    expect(within.body).toMatchObject({ applies: true, overBudget: false, currency: "VND" });
    expect(within.body.cells).toEqual([expect.objectContaining({ categoryId: food, budget: "1000000", used: "0", order: "400000", remainingAfter: "600000", status: "within", month: "2026-11" })]);

    const over = await check({
      lines: [
        { variantId: variants.rice, quantity: "11", unitPrice: "100000" },
        { variantId: variants.water, quantity: "1", unitPrice: "5000" },
      ],
    });
    expect(over.body.overBudget).toBe(true);
    expect(over.body.cells.map((cell: { categoryId: string; status: string; remainingAfter: string | null }) => [cell.categoryId, cell.status, cell.remainingAfter])).toEqual([
      [drink, "missing", null],
      [food, "over", "-100000"],
    ]);
    const notApplied = await check({ orderDate: "2027-03-01", lines: [{ variantId: variants.rice, quantity: "100", unitPrice: "100000" }] });
    expect(notApplied.body).toEqual({ applies: false, overBudget: false, currency: "VND", cells: [] });

    // Đơn đã duyệt 600.000 rồi sửa: kiểm tra không tính chính đơn.
    const approved = await createOrder("2026-11-10", [line("rice", 6, 100000)]);
    const submitted = await submit(approved.id);
    expect(submitted.body.budgetCheck.cells[0]).toMatchObject({ used: "0", order: "600000", remainingAfter: "400000", status: "within" });
    await decide(submitted.body.approvalRequestId, "approved");
    const editing = await check({ orderId: approved.id, lines: [{ variantId: variants.rice, quantity: "9", unitPrice: "100000" }] });
    expect(editing.body.cells[0]).toMatchObject({ used: "0", order: "900000", status: "within" });
    const other = await check({ lines: [{ variantId: variants.rice, quantity: "5", unitPrice: "100000" }] });
    expect(other.body.cells[0]).toMatchObject({ used: "600000", remainingAfter: "-100000", status: "over" });
    expect((await check({ orderId: "00000000-0000-4000-8000-0000000000ff", lines: [] })).status).toBe(404);
    await pool.query("UPDATE purchasing.orders SET status = 'closed' WHERE id = $1", [approved.id]);
  });
});

describe("TIEUCHI_NGHIEMTHU_417: chuyển luồng duyệt khi vượt ngân sách", () => {
  it("KICHBAN_KIEMTHU_591: trong ngân sách đi luồng cũ; vượt khi chưa có chính sách vượt thì lỗi; có chính sách thì đi luồng vượt, duyệt xong đơn đã duyệt; tháng chưa áp dụng đi luồng cũ; duyệt lại vượt đi luồng vượt", async () => {
    // Đơn đóng ở kịch bản trước không nhận gì: đã dùng 0.
    const normal = await createOrder("2026-11-11", [line("rice", 3, 100000)]);
    const pending = await submit(normal.id);
    expect(pending.body.status).toBe("pending");
    expect(await requestType(pending.body.approvalRequestId)).toBe("purchasing.order");
    expect(pending.body.budgetSnapshot).toBeNull();
    await decide(pending.body.approvalRequestId, "approved");

    const big = await createOrder("2026-11-12", [line("rice", 8, 100000)]);
    const refused = await submit(big.id);
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toBe('Đơn vượt hoặc chưa có ngân sách nhưng chưa có chính sách duyệt "Đơn mua vượt ngân sách". Nhờ quản trị công ty cấu hình ở Nền tảng › Chính sách duyệt.');
    expect((await purchaser.call("get", `/purchasing/orders/${big.id}`, { companyId: retail })).body).toMatchObject({ status: "draft", documentNo: null });

    await policy("purchasing.order_over_budget");
    const over = await submit(big.id);
    expect(over.body.status, JSON.stringify(over.body)).toBe("pending");
    expect(await requestType(over.body.approvalRequestId)).toBe("purchasing.order_over_budget");
    expect(over.body.budgetSnapshot).toEqual([expect.objectContaining({ categoryId: food, used: "300000", order: "800000", remainingAfter: "-100000", status: "over" })]);
    await decide(over.body.approvalRequestId, "approved");
    expect((await purchaser.call("get", `/purchasing/orders/${big.id}`, { companyId: retail })).body.status).toBe("approved");
    expect((await purchaser.call("get", "/purchasing/open-to-buy?year=2026", { companyId: retail })).body.rows[0]).toMatchObject({ used: "1100000", remaining: "-100000" });

    const later = await createOrder("2027-03-01", [line("water", 100, 100000)]);
    const laterSubmitted = await submit(later.id);
    expect(await requestType(laterSubmitted.body.approvalRequestId)).toBe("purchasing.order");

    // Duyệt lại sau khi sửa tăng giá trị đơn đã duyệt: ngân sách đã âm nên đi luồng vượt.
    const current = (await purchaser.call("get", `/purchasing/orders/${normal.id}`, { companyId: retail })).body;
    const increased = await purchaser.call("patch", `/purchasing/orders/${normal.id}`, {
      companyId: retail,
      body: { supplierId, warehouseId, orderDate: "2026-11-11", note: null, lines: [line("rice", 4, 100000, { id: current.lines[0].id })], version: current.version },
    });
    expect(increased.body.status, JSON.stringify(increased.body)).toBe("pending");
    expect(await requestType(increased.body.approvalRequestId)).toBe("purchasing.order_over_budget");
  });

  it("KICHBAN_KIEMTHU_591 (miễn duyệt): đơn lấy từ đề nghị mua đã duyệt, không vượt giá ước tính nhưng vượt ngân sách vẫn đi luồng vượt", async () => {
    // Công ty chưa có chính sách duyệt đề nghị mua: đề nghị duyệt ngay (QUYTAC_NGHIEPVU_62).
    const requisition = await purchaser.call("post", "/purchasing/requisitions", {
      companyId: retail,
      body: { warehouseId, neededBy: "2026-11-25", reason: "Bổ sung hàng", lines: [{ variantId: variants.rice, unitId, quantity: "2", estimatedUnitPrice: "100000" }] },
    });
    expect(requisition.status, JSON.stringify(requisition.body)).toBe(201);
    const approvedRequisition = await purchaser.call("post", `/purchasing/requisitions/${requisition.body.id}/submit`, { companyId: retail });
    expect(approvedRequisition.body.status).toBe("approved");
    const exempt = await createOrder("2026-11-15", [line("rice", 2, 100000, { requisitionLineId: approvedRequisition.body.lines[0].id })]);
    const submitted = await submit(exempt.id);
    expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("pending");
    expect(await requestType(submitted.body.approvalRequestId)).toBe("purchasing.order_over_budget");
    await decide(submitted.body.approvalRequestId, "approved");
  });

  // Đơn chờ duyệt không giữ chỗ ngân sách (QUYTAC_NGHIEPVU_446); khóa có tác dụng với đơn được duyệt ngay khi gửi (miễn duyệt, chưa có chính sách đơn mua).
  it("KICHBAN_KIEMTHU_592: hai đơn được duyệt ngay gửi đồng thời, mỗi đơn vừa đủ phần còn lại: chỉ một đơn đi luồng thường", async () => {
    await pool.query("UPDATE purchasing.budget_lines SET adjusted_amount = 1500000 WHERE category_id = $1", [food]);
    await pool.query("UPDATE core.approval_policies SET effective_to = '2026-01-01' WHERE document_type_code = 'purchasing.order'");
    // Đã dùng: 300.000 (lần duyệt trước của đơn đang duyệt lại) + 800.000 = 1.100.000; còn 1.400.000.
    const first = await createOrder("2026-11-20", [line("rice", 14, 100000)]);
    const second = await createOrder("2026-11-21", [line("rice", 14, 100000)]);
    const results = await Promise.all([submit(first.id), submit(second.id)]);
    for (const result of results) await application.get(OutboxService).dispatchPending();
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    // Một đơn duyệt ngay (không còn chính sách đơn mua), đơn kia vượt nên chờ duyệt theo luồng vượt ngân sách.
    expect(results.map((result) => result.body.status).sort()).toEqual(["approved", "pending"]);
    const pendingOne = results.find((result) => result.body.status === "pending")!;
    expect(await requestType(pendingOne.body.approvalRequestId)).toBe("purchasing.order_over_budget");
    const audit = await pool.query("SELECT after_data->>'overBudget' AS over FROM core.audit_events WHERE action = 'purchase_order.submit' AND entity_id = ANY($1)", [[first.id, second.id]]);
    expect(audit.rows.map((row) => row.over).sort()).toEqual(["false", "true"]);
  });
});
