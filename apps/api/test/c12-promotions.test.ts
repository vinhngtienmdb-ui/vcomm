// CONG_VIEC_12: Khuyến mãi (TIEUCHI_NGHIEMTHU_99 đến 104; KICHBAN_KIEMTHU_193 trở đi).
// Bảng giá chung gồm thuế: bánh 11.000, kẹo 22.000, quà 5.500 một cái (thuế 10%); giá vốn bánh 9.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutboxService } from "../src/common/outbox.service";
import { testIds } from "../src/database/seed";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session, grantSalesOrderManage } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let admin: Session;
let seller: Session;
let keeper: Session;
let approver: Session;
let today: string;
let warehouseId: string;
let retailChannel: string;
let wholesaleChannel: string;
let internalChannel: string;
let vipGroup: string;
let vipCustomer: string;
const retail: string = testIds.retailCompany;
const units: Record<string, string> = {};
const items: Record<string, string> = {};

async function assign(email: string, name: string, role: string, branchId?: string) {
  const id = await createTestUser(pool, email, name, [{ companyId: retail, branchId }]);
  const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = $1 AND company_id IS NULL", [role])).rows[0]!.id;
  await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from) VALUES ($1, $2, $3, $4, $5, '2026-01-01')", [
    id,
    roleId,
    branchId ? "branch" : "company",
    retail,
    branchId ?? null,
  ]);
  return signIn(application, email);
}
const call = (session: Session, method: "get" | "post" | "patch", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
// Tạo, gửi chương trình (chưa có chính sách duyệt thì chạy ngay).
async function running(body: Record<string, unknown>) {
  const created = await call(admin, "post", "/sales/promotions", { validFrom: today, validTo: "2026-12-31", ...body });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(admin, "post", `/sales/promotions/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("active");
  return submitted.body as { id: string; version: number };
}
const order = (lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) => ({ channelId: retailChannel, warehouseId, orderDate: today, lines, ...extra });
const line = (key: string, quantity: string, discountPercent = "0") => ({ variantId: items[key], unitId: units.CAI, quantity, discountPercent });
async function saved(body: Record<string, unknown>) {
  const created = await call(seller, "post", "/sales/orders", body);
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body;
}
async function stopAll() {
  for (const promotion of (await call(admin, "get", "/sales/promotions?status=active")).body) {
    await call(admin, "post", `/sales/promotions/${promotion.id}/stop`, { reason: "Hết kịch bản", version: (await call(admin, "get", `/sales/promotions/${promotion.id}`)).body.version });
  }
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  approver = await signIn(application, "phuc.le@vcomm.test");
  seller = await assign("banhang.km@vcomm.test", "Lạc Văn Bán", "salesperson");
  await grantSalesOrderManage(pool, "banhang.km@vcomm.test", retail);
  keeper = await assign("thukho.km@vcomm.test", "Trịnh Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);

  for (const row of (await pool.query("SELECT id, code FROM catalog.units")).rows) units[row.code] = row.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "KMAI", nameVi: "KMAI", nameEn: "KMAI" } })).body.id;
  for (const [key, name] of [
    ["biscuit", "Bánh khuyến mãi"],
    ["candy", "Kẹo khuyến mãi"],
    ["gift", "Quà tặng khuyến mãi"],
  ] as const) {
    const created = await admin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId: category, name, vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: units.CAI, variants: [{ barcodes: [] }] },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    items[key] = created.body.variants[0].id;
  }
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "KMW", name: "Kho khuyến mãi", usesLocations: false } }))
    .body.id;
  const receipt = await admin.call("post", "/inventory/documents", {
    companyId: retail,
    body: {
      type: "receipt_other",
      warehouseId,
      companyId: retail,
      documentDate: today,
      reasonCode: "opening_balance",
      reason: "Tồn đầu",
      lines: [
        { variantId: items.biscuit, unitId: units.CAI, quantity: "1000", unitCost: "9000" },
        { variantId: items.candy, unitId: units.CAI, quantity: "1000", unitCost: "10000" },
        { variantId: items.gift, unitId: units.CAI, quantity: "1000", unitCost: "3000" },
      ],
    },
  });
  expect((await admin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  retailChannel = channels.find((channel) => channel.code === "BAN_LE")!.id;
  wholesaleChannel = channels.find((channel) => channel.code === "BAN_SI")!.id;
  internalChannel = channels.find((channel) => channel.code === "NOI_BO")!.id;
  vipGroup = (await admin.call("post", "/catalog/customer-groups", { companyId: retail, body: { code: "VIP", name: "Khách thân thiết" } })).body.id;
  const general = (await admin.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "CHUNG", name: "Chung", includesVat: true } })).body.id;
  const change = await admin.call("post", "/catalog/price-changes", {
    companyId: retail,
    body: {
      priceListId: general,
      effectiveFrom: today,
      lines: [
        { variantId: items.biscuit, unitId: units.CAI, price: "11000" },
        { variantId: items.candy, unitId: units.CAI, price: "22000" },
        { variantId: items.gift, unitId: units.CAI, price: "5500" },
      ],
    },
  });
  expect((await admin.call("post", `/catalog/price-changes/${change.body.id}/submit`, { companyId: retail })).status).toBe(201);
  const partner = await admin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name: "Cửa hàng thân thiết", taxCode: "0320000901" } });
  vipCustomer = partner.body.id;
  await admin.call("put", `/crm/partners/${vipCustomer}/profile`, {
    companyId: retail,
    body: { isCustomer: true, isSupplier: false, paymentTermDays: 30, creditLimit: null, customerGroupId: vipGroup, version: 0 },
  });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("TIEUCHI_NGHIEMTHU_99: chương trình khuyến mãi", () => {
  it("KICHBAN_KIEMTHU_193: lập ba loại, thiếu dữ liệu bị từ chối; nhân viên bán hàng không lập được; gửi duyệt, từ chối sửa lại, duyệt thì chạy; đang chạy chỉ dừng", async () => {
    const base = { validFrom: today, validTo: "2026-12-31" };
    expect((await call(admin, "post", "/sales/promotions", { ...base, name: "Thiếu mặt hàng", kind: "product_discount" })).body.error.fields).toEqual({ items: expect.any(String) });
    expect(
      Object.keys((await call(admin, "post", "/sales/promotions", { ...base, name: "Thiếu quà", kind: "buy_get", buyVariantId: items.biscuit, buyQuantity: "3" })).body.error.fields).sort(),
    ).toEqual(["giftQuantity", "giftVariantId"]);
    expect((await call(seller, "post", "/sales/promotions", { ...base, name: "Không quyền", kind: "order_discount", minOrderAmount: "100000", orderDiscountPercent: "5" })).status).toBe(403);
    // Nhân viên bán hàng xem được danh sách.
    expect((await call(seller, "get", "/sales/promotions")).status).toBe(200);

    await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "sales.promotion",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    const created = await call(admin, "post", "/sales/promotions", {
      ...base,
      name: "Giảm bánh",
      kind: "product_discount",
      items: [{ variantId: items.biscuit, discountPercent: "10" }],
      channelIds: [retailChannel],
      budgetAmount: "1000000",
    });
    expect(created.body).toMatchObject({
      status: "draft",
      kind: "product_discount",
      items: [expect.objectContaining({ variantId: items.biscuit, discountPercent: "10" })],
      channels: [{ id: retailChannel }],
    });
    const pending = (await call(admin, "post", `/sales/promotions/${created.body.id}/submit`)).body;
    expect(pending).toMatchObject({ status: "pending", documentNo: expect.stringMatching(/^KM/) });
    await approver.call("post", `/approval-requests/${pending.approvalRequestId}/decisions`, { body: { decision: "rejected", comment: "Giảm sâu quá" } });
    await application.get(OutboxService).dispatchPending();
    const rejected = (await call(admin, "get", `/sales/promotions/${created.body.id}`)).body;
    expect(rejected).toMatchObject({ status: "rejected", canEdit: true });
    const edited = await call(admin, "patch", `/sales/promotions/${created.body.id}`, {
      ...base,
      name: "Giảm bánh",
      kind: "product_discount",
      items: [{ variantId: items.biscuit, discountPercent: "8" }],
      version: rejected.version,
    });
    expect(edited.body).toMatchObject({ status: "draft", channels: [] });
    const resubmitted = (await call(admin, "post", `/sales/promotions/${created.body.id}/submit`)).body;
    await approver.call("post", `/approval-requests/${resubmitted.approvalRequestId}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    const active = (await call(admin, "get", `/sales/promotions/${created.body.id}`)).body;
    expect(active).toMatchObject({ status: "active", canEdit: false, canStop: true });
    // Rút khi đang chờ duyệt: có nhật ký. Số suất vượt giới hạn bị từ chối, không lỗi máy chủ.
    const draft = await call(admin, "post", "/sales/promotions", { ...base, name: "Sẽ rút", kind: "order_discount", minOrderAmount: "100000", orderDiscountPercent: "5" });
    await call(admin, "post", `/sales/promotions/${draft.body.id}/submit`);
    expect((await call(admin, "post", `/sales/promotions/${draft.body.id}/withdraw`)).body.status).toBe("withdrawn");
    expect((await pool.query("SELECT 1 FROM core.audit_events WHERE entity_id = $1 AND action = 'promotion.withdraw'", [draft.body.id])).rowCount).toBe(1);
    const huge = await call(admin, "post", "/sales/promotions", {
      ...base,
      name: "Quá nhiều suất",
      kind: "buy_get",
      buyVariantId: items.biscuit,
      buyQuantity: "1",
      giftVariantId: items.gift,
      giftQuantity: "1",
      maxGiftSets: 3000000000,
    });
    expect(huge.body.error.fields).toEqual({ maxGiftSets: expect.any(String) });
    expect(
      (
        await call(admin, "patch", `/sales/promotions/${created.body.id}`, {
          ...base,
          name: "Sửa",
          kind: "product_discount",
          items: [{ variantId: items.biscuit, discountPercent: "50" }],
          version: active.version,
        })
      ).status,
    ).toBe(409);
    const stopped = await call(admin, "post", `/sales/promotions/${created.body.id}/stop`, { reason: "Đổi kế hoạch", version: active.version });
    expect(stopped.body).toMatchObject({ status: "stopped", stoppedReason: "Đổi kế hoạch", canStop: false });
    // Chính sách duyệt hết hiệu lực cho các kịch bản sau (chương trình chạy ngay).
    await pool.query("UPDATE core.approval_policies SET effective_from = '2026-01-01', effective_to = '2026-01-01' WHERE document_type_code = 'sales.promotion'");
  });
});

describe("TIEUCHI_NGHIEMTHU_100: áp khuyến mãi vào đơn bán", () => {
  it("KICHBAN_KIEMTHU_194: dòng chọn phần trăm cao nhất, trừ trước chiết khấu tay; theo đơn chọn mức lớn nhất, có trần; mua 3 tặng 1 thêm đúng số suất", async () => {
    await running({ name: "Bánh 10%", kind: "product_discount", items: [{ variantId: items.biscuit, discountPercent: "10" }] });
    await running({ name: "Bánh 15%", kind: "product_discount", items: [{ variantId: items.biscuit, discountPercent: "15" }] });
    await running({ name: "Đơn từ 200 nghìn giảm 10%", kind: "order_discount", minOrderAmount: "200000", orderDiscountPercent: "10", maxOrderDiscount: "15000" });
    await running({ name: "Đơn từ 200 nghìn giảm 5%", kind: "order_discount", minOrderAmount: "200000", orderDiscountPercent: "5" });
    await running({ name: "Mua 3 kẹo tặng 1 quà", kind: "buy_get", buyVariantId: items.candy, buyQuantity: "3", giftVariantId: items.gift, giftQuantity: "1" });

    // Bánh 10 cái: 11.000 × 85% × 98% (chiết khấu tay 2%) = 9.163 một cái.
    const small = await saved(order([line("biscuit", "10", "2")]));
    expect(small.lines).toEqual([expect.objectContaining({ promotionName: "Bánh 15%", promotionPercent: "15", unitPrice: "9163", totalAmount: "91630", isGift: false })]);
    // Thêm 7 kẹo (154.000): tổng 245.630 ≥ 200.000; 10% = 24.563 bị trần 15.000, 5% = 12.282 → chọn 15.000; 2 suất quà.
    const big = await saved(order([line("biscuit", "10", "2"), line("candy", "7")]));
    expect(big.lines).toHaveLength(3);
    const discount = big.lines.slice(0, 2).reduce((sum: number, item: { orderDiscountAmount: string }) => sum + Number(item.orderDiscountAmount), 0);
    expect(discount).toBe(15000);
    expect(big.lines[0]).toMatchObject({ orderPromotionName: "Đơn từ 200 nghìn giảm 10%" });
    expect(big.lines[2]).toMatchObject({ variantId: items.gift, quantity: "2", unitPrice: "0", totalAmount: "0", isGift: true, promotionName: "Mua 3 kẹo tặng 1 quà" });
    expect(big.totalAmount).toBe("230630");
    await stopAll();
  });
});

describe("TIEUCHI_NGHIEMTHU_101: điều kiện áp dụng", () => {
  it("KICHBAN_KIEMTHU_195: sai kênh, sai nhóm khách, ngoài thời gian, đã dừng, kênh Nội bộ thì không áp", async () => {
    const vip = await running({
      name: "Kẹo VIP bán sỉ",
      kind: "product_discount",
      items: [{ variantId: items.candy, discountPercent: "20" }],
      channelIds: [wholesaleChannel],
      customerGroupIds: [vipGroup],
    });
    await running({ name: "Kẹo tháng sau", kind: "product_discount", items: [{ variantId: items.candy, discountPercent: "30" }], validFrom: "2026-12-01", validTo: "2026-12-31" });
    const applied = (lines: { promotionName: string | null }[]) => lines[0]!.promotionName;
    expect(applied((await saved(order([line("candy", "1")], { channelId: wholesaleChannel, customerId: vipCustomer }))).lines)).toBe("Kẹo VIP bán sỉ");
    expect(applied((await saved(order([line("candy", "1")], { channelId: retailChannel, customerId: vipCustomer }))).lines)).toBeNull();
    expect(applied((await saved(order([line("candy", "1")], { channelId: wholesaleChannel }))).lines)).toBeNull();
    expect(applied((await saved(order([line("candy", "1")], { channelId: wholesaleChannel, customerId: vipCustomer, orderDate: "2026-12-05" }))).lines)).toBe("Kẹo tháng sau");
    // Chương trình không giới hạn kênh vẫn không áp cho kênh Nội bộ.
    await running({ name: "Kẹo mọi kênh", kind: "product_discount", items: [{ variantId: items.candy, discountPercent: "5" }] });
    expect(applied((await saved(order([line("candy", "1")], { channelId: internalChannel, buyerName: "Thử" }))).lines)).toBeNull();
    // Dừng: đơn lưu sau đó không áp.
    const now = (await call(admin, "get", `/sales/promotions/${vip.id}`)).body;
    await call(admin, "post", `/sales/promotions/${vip.id}/stop`, { reason: "Dừng", version: now.version });
    expect(applied((await saved(order([line("candy", "1")], { channelId: wholesaleChannel, customerId: vipCustomer }))).lines)).toBe("Kẹo mọi kênh");
    await stopAll();
  });
});

describe("TIEUCHI_NGHIEMTHU_102: ngân sách, số suất", () => {
  it("KICHBAN_KIEMTHU_196: hết ngân sách không áp vào đơn mới; gửi đơn vượt ngân sách bị từ chối, lưu lại thì tính lại; suất tặng không quá số suất còn lại", async () => {
    // Bánh giảm 10% = 1.100 một cái; ngân sách 20.000.
    const budget = await running({ name: "Bánh ngân sách", kind: "product_discount", items: [{ variantId: items.biscuit, discountPercent: "10" }], budgetAmount: "20000" });
    const first = await saved(order([line("biscuit", "10")]));
    const second = await saved(order([line("biscuit", "10")]));
    expect(first.lines[0].promotionName).toBe("Bánh ngân sách");
    expect(second.lines[0].promotionName).toBe("Bánh ngân sách");
    expect((await call(seller, "post", `/sales/orders/${first.id}/submit`)).body.status).toBe("confirmed");
    expect((await call(admin, "get", `/sales/promotions/${budget.id}`)).body.usedAmount).toBe("11000");
    const over = await call(seller, "post", `/sales/orders/${second.id}/submit`);
    expect(over.status).toBe(409);
    expect(over.body.error.message).toBe("Chương trình khuyến mãi đã hết ngân sách hoặc hết suất. Lưu lại đơn để tính lại khuyến mãi rồi gửi.");
    const resaved = await call(seller, "patch", `/sales/orders/${second.id}`, { ...order([line("biscuit", "10")]), version: second.version });
    expect(resaved.body.lines[0].promotionName).toBeNull();
    expect((await call(seller, "post", `/sales/orders/${second.id}/submit`)).body.status).toBe("confirmed");

    await running({ name: "Kẹo tặng 3 suất", kind: "buy_get", buyVariantId: items.candy, buyQuantity: "1", giftVariantId: items.gift, giftQuantity: "1", maxGiftSets: 3 });
    const two = await saved(order([line("candy", "2")]));
    expect((await call(seller, "post", `/sales/orders/${two.id}/submit`)).body.status).toBe("confirmed");
    const capped = await saved(order([line("candy", "5")]));
    expect(capped.lines[1]).toMatchObject({ isGift: true, quantity: "1" });
    await stopAll();
  });
});

describe("TIEUCHI_NGHIEMTHU_103: ngoại lệ, giữ hàng, giao hàng tặng", () => {
  it("KICHBAN_KIEMTHU_197: khuyến mãi làm giá dưới giá vốn không sinh ngoại lệ; chiết khấu tay vượt mức vẫn sinh ngoại lệ; dòng tặng được giữ hàng, giao hàng", async () => {
    await running({ name: "Bánh giảm sâu", kind: "product_discount", items: [{ variantId: items.biscuit, discountPercent: "50" }] });
    await running({ name: "Mua bánh tặng quà", kind: "buy_get", buyVariantId: items.biscuit, buyQuantity: "2", giftVariantId: items.gift, giftQuantity: "1" });
    // 11.000 × 50% = 5.500 gồm thuế < giá vốn 9.000 nhưng do khuyến mãi: không ngoại lệ, xác nhận ngay.
    const deep = await saved(order([line("biscuit", "2")]));
    const confirmed = (await call(seller, "post", `/sales/orders/${deep.id}/submit`)).body;
    expect(confirmed).toMatchObject({ status: "confirmed", exceptions: [] });
    // Chiết khấu tay 10% vượt mức 0%: ngoại lệ chiết khấu.
    const manual = await saved(order([line("candy", "1", "10")]));
    expect((await call(seller, "post", `/sales/orders/${manual.id}/submit`)).body.exceptions).toEqual([expect.objectContaining({ kind: "discount" })]);
    // Dòng tặng được giữ hàng và giao.
    const gift = confirmed.lines.find((item: { isGift: boolean }) => item.isGift);
    expect(gift).toMatchObject({ quantity: "1" });
    const reserved = (await pool.query("SELECT sum(quantity)::text AS quantity FROM inventory.reservations WHERE source_id = $1 AND variant_id = $2 AND status = 'active'", [confirmed.id, items.gift]))
      .rows[0];
    expect(Number(reserved.quantity)).toBe(1);
    const issue = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: { orderId: confirmed.id, documentDate: today, lines: confirmed.lines.map((item: { id: string; quantity: string }) => ({ orderLineId: item.id, quantity: item.quantity })) },
    });
    expect(issue.status, JSON.stringify(issue.body)).toBe(201);
    expect((await keeper.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    expect((await call(seller, "get", `/sales/orders/${confirmed.id}`)).body.status).toBe("delivered");
  });
});

describe("TIEUCHI_NGHIEMTHU_100: hàng tặng không tính là hàng mua", () => {
  it("KICHBAN_KIEMTHU_198: dòng tặng của chương trình này không làm đủ điều kiện mua của chương trình khác; mua X tặng Y không nhận ngân sách; tặng theo tồn còn lại", async () => {
    await stopAll();
    await running({ name: "Mua 2 bánh tặng 2 kẹo", kind: "buy_get", buyVariantId: items.biscuit, buyQuantity: "2", giftVariantId: items.candy, giftQuantity: "2" });
    await running({ name: "Mua 2 kẹo tặng 1 quà", kind: "buy_get", buyVariantId: items.candy, buyQuantity: "2", giftVariantId: items.gift, giftQuantity: "1" });
    const result = await saved(order([line("biscuit", "2")]));
    expect(result.lines.filter((item: { isGift: boolean }) => item.isGift)).toEqual([expect.objectContaining({ variantId: items.candy, quantity: "2" })]);
    const budget = await call(admin, "post", "/sales/promotions", {
      validFrom: today,
      validTo: "2026-12-31",
      name: "Sai ngân sách",
      kind: "buy_get",
      buyVariantId: items.biscuit,
      buyQuantity: "1",
      giftVariantId: items.gift,
      giftQuantity: "1",
      budgetAmount: "100000",
    });
    expect(budget.body.error.fields).toEqual({ budgetAmount: expect.any(String) });
    await stopAll();
    // Hàng tặng chỉ tặng theo tồn còn lại tại kho xuất: tồn quà dưới 1.200, mỗi suất 600 → tặng 1 suất, ghi thiếu 1 suất.
    await running({ name: "Mua 1 kẹo tặng 600 quà", kind: "buy_get", buyVariantId: items.candy, buyQuantity: "1", giftVariantId: items.gift, giftQuantity: "600" });
    const short = await saved(order([line("candy", "2")]));
    expect(short.lines.filter((item: { isGift: boolean }) => item.isGift)).toEqual([expect.objectContaining({ quantity: "600" })]);
    expect(short.giftShortages).toEqual([{ promotionName: "Mua 1 kẹo tặng 600 quà", missingSets: 1 }]);
    expect((await call(seller, "post", `/sales/orders/${short.id}/submit`)).body.status).toBe("confirmed");
    await stopAll();
  });
});
