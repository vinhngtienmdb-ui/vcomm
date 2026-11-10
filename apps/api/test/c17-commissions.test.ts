// CONG_VIEC_17: Hoa hồng đội kinh doanh (TIEUCHI_NGHIEMTHU_127 đến 130; KICHBAN_KIEMTHU_234 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000 (chưa thuế 10.000); giá vốn 8.000; giá mua chưa thuế 8.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { commissionPercent } from "../src/commission/commission-rules";
import { PermissionService } from "../src/permissions/permission.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let groupAdmin: Session;
let admin: Session;
let accountant: Session;
let seller: Session;
let keeper: Session;
let chief: Session;
let cashFund: string;
let today: string;
let warehouseId: string;
let retailChannel: string;
let customer: string;
let itemA: string;
let itemB: string;
let unitId: string;
const retail: string = testIds.retailCompany;

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
const call = (session: Session, method: "get" | "post" | "put" | "patch" | "delete", path: string, body?: unknown) => session.call(method, path, { companyId: retail, body });
const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

async function partner(name: string, taxCode: string, profile: Record<string, unknown>) {
  const created = await admin.call("post", "/crm/partners", { companyId: retail, body: { kind: "organization", name, taxCode } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  await admin.call("put", `/crm/partners/${created.body.id}/profile`, {
    companyId: retail,
    body: { isCustomer: false, isSupplier: false, paymentTermDays: 0, creditLimit: null, version: 0, ...profile },
  });
  return created.body.id as string;
}
// Đơn bán đã xác nhận (chưa có chính sách duyệt) rồi giao một phần.
async function confirmedOrder(quantity: string, customerId: string | null, variantId = itemA) {
  const created = await call(seller, "post", "/sales/orders", {
    channelId: retailChannel,
    warehouseId,
    orderDate: today,
    ...(customerId ? { customerId } : { buyerName: "Khách lẻ" }),
    lines: [{ variantId, unitId, quantity, discountPercent: "0" }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const submitted = await call(seller, "post", `/sales/orders/${created.body.id}/submit`);
  expect(submitted.body.status, JSON.stringify(submitted.body)).toBe("confirmed");
  return submitted.body as { id: string; lines: { id: string }[] };
}
async function deliver(order: { id: string; lines: { id: string }[] }, quantity: string) {
  const issue = await keeper.call("post", "/inventory/sales-issues", { companyId: retail, body: { orderId: order.id, documentDate: today, lines: [{ orderLineId: order.lines[0]!.id, quantity }] } });
  expect(issue.status, JSON.stringify(issue.body)).toBe(201);
  const posted = await keeper.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail });
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
  return posted.body as { id: string; documentNo: string; lines: { id: string }[] };
}
beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  today = application.get(PermissionService).today();
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  admin = await signIn(application, "quantri.vcr@vcomm.test");
  accountant = await assign("ketoan.hh@vcomm.test", "Đào Thị Toán", "accountant");
  chief = await assign("ketoantruong.hh@vcomm.test", "Mai Văn Trưởng", "chief_accountant");
  seller = await assign("banhang.hh@vcomm.test", "Lạc Văn Bán", "salesperson");
  keeper = await assign("thukho.hh@vcomm.test", "Trịnh Văn Kho", "warehouse_keeper", testIds.binhDuongWarehouse);

  unitId = (await pool.query<{ id: string }>("SELECT id FROM catalog.units WHERE code = 'CAI'")).rows[0]!.id;
  const category = (await groupAdmin.call("post", "/catalog/categories", { companyId: retail, body: { code: "HHT", nameVi: "HHT", nameEn: "HHT" } })).body.id;
  const product = await admin.call("post", "/catalog/products", {
    companyId: retail,
    body: { categoryId: category, name: "Hàng công nợ A", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
  });
  itemA = product.body.variants[0].id;
  // Hàng B giá gồm thuế 12.000: đơn giá chưa thuế lẻ (10.909,09...).
  itemB = (
    await admin.call("post", "/catalog/products", {
      companyId: retail,
      body: { categoryId: category, name: "Hàng hoa hồng B", vatRate: "10", tracksLots: false, tracksSerials: false, warrantyMonths: 0, baseUnitId: unitId, variants: [{ barcodes: [] }] },
    })
  ).body.variants[0].id;
  warehouseId = (await admin.call("post", "/inventory/warehouses", { companyId: retail, body: { branchId: testIds.binhDuongWarehouse, code: "HHW", name: "Kho hoa hồng", usesLocations: false } })).body
    .id;
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
        { variantId: itemA, unitId, quantity: "1000", unitCost: "8000" },
        { variantId: itemB, unitId, quantity: "100", unitCost: "8000" },
      ],
    },
  });
  expect((await admin.call("post", `/inventory/documents/${receipt.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
  const channels = (await admin.call("post", "/catalog/sales-channels/defaults", { companyId: retail })).body as { id: string; code: string }[];
  retailChannel = channels.find((channel) => channel.code === "BAN_LE")!.id;
  const general = (await admin.call("post", "/catalog/price-lists", { companyId: retail, body: { code: "CHUNG", name: "Chung", includesVat: true } })).body.id;
  const change = await admin.call("post", "/catalog/price-changes", {
    companyId: retail,
    body: {
      priceListId: general,
      effectiveFrom: today,
      lines: [
        { variantId: itemA, unitId, price: "11000" },
        { variantId: itemB, unitId, price: "12000" },
      ],
    },
  });
  expect((await admin.call("post", `/catalog/price-changes/${change.body.id}/submit`, { companyId: retail })).status).toBe(201);
  customer = await partner("Khách công nợ", "0320001701", { isCustomer: true, paymentTermDays: 30 });
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

const userIdOf = async (email: string) => (await pool.query<{ id: string }>("SELECT id FROM core.users WHERE email = $1", [email])).rows[0]!.id;
const settingsBody = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  startDate: "2026-01-01",
  assignment: "customer_owner",
  combination: "matrix",
  defaultPercent: "2",
  tiers: [{ fromPercent: "0", multiplier: "1" }],
  rates: [],
  channelFactors: [],
  version: 0,
  ...overrides,
});
async function saveSettings(overrides: Record<string, unknown> = {}) {
  const current = (await call(chief, "get", "/finance/commission-settings")).body as { version: number };
  const saved = await call(chief, "put", "/finance/commission-settings", settingsBody({ version: current.version, ...overrides }));
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  return saved.body;
}
async function payment(body: Record<string, unknown>) {
  const created = await call(accountant, "post", "/finance/payments", { fundId: cashFund, paymentDate: today, ...body });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const posted = await call(accountant, "post", `/finance/payments/${created.body.id}/submit`, { version: created.body.version });
  expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
  return posted.body;
}
const debtItemOf = async (documentId: string) => (await pool.query<{ id: string }>("SELECT id FROM finance.debt_items WHERE source_id = $1", [documentId])).rows[0]!.id;
type Event = { sourceType: string; baseAmount: string; percent: string; amount: string; orderId: string; userId: string };
const eventsOf = async (orderId: string) => ((await call(accountant, "get", "/finance/commissions/events?pageSize=100")).body.data as Event[]).filter((event) => event.orderId === orderId);
async function returnGoods(issue: { id: string; lines: { id: string }[] }, quantity: string) {
  const created = await keeper.call("post", "/inventory/sales-returns", {
    companyId: retail,
    body: { issueId: issue.id, documentDate: today, reason: "Khách trả", lines: [{ issueLineId: issue.lines[0]!.id, quantity }] },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const posted = await keeper.call("post", `/inventory/documents/${created.body.id}/submit`, { companyId: retail });
  expect(posted.body.status).toBe("posted");
  return posted.body as { id: string };
}

describe("TIEUCHI_NGHIEMTHU_127, 128: cài đặt, gán đơn", () => {
  it("KICHBAN_KIEMTHU_234: kiểm cài đặt, bậc, mức; chỉ tiêu; chỉ người có quyền cài đặt sửa được", async () => {
    expect((await call(accountant, "get", "/finance/commission-settings")).body).toMatchObject({ enabled: false, canSetup: false, version: 0 });
    expect((await call(accountant, "put", "/finance/commission-settings", settingsBody())).status).toBe(403);
    expect((await call(seller, "get", "/finance/commission-settings")).status).toBe(403);
    const category = (await call(chief, "get", "/finance/commission-settings")).body.categories.find((item: { code: string }) => item.code === "HHT").id;
    const invalid = await call(
      chief,
      "put",
      "/finance/commission-settings",
      settingsBody({
        startDate: null,
        tiers: [{ fromPercent: "50", multiplier: "1" }],
        rates: [
          { categoryId: category, channelId: null, percent: "5" },
          { categoryId: category, channelId: null, percent: "6" },
        ],
        defaultPercent: "101",
      }),
    );
    expect(invalid.status).toBe(400);
    const fixed = await call(
      chief,
      "put",
      "/finance/commission-settings",
      settingsBody({
        startDate: null,
        tiers: [{ fromPercent: "50", multiplier: "1" }],
        rates: [
          { categoryId: category, channelId: null, percent: "5" },
          { categoryId: category, channelId: null, percent: "6" },
        ],
      }),
    );
    expect(Object.keys(fixed.body.error.fields).sort()).toEqual(["rates.1.categoryId", "startDate", "tiers"]);
    const saved = await saveSettings({
      rates: [
        { categoryId: category, channelId: retailChannel, percent: "3" },
        { categoryId: category, channelId: null, percent: "5" },
      ],
    });
    expect(saved).toMatchObject({ enabled: true, defaultPercent: "2", version: 1 });
    expect(saved.rates).toHaveLength(2);
    expect((await call(chief, "put", "/finance/commission-settings", settingsBody({ version: 0 }))).status).toBe(409);

    const sellerId = await userIdOf("banhang.hh@vcomm.test");
    const month = today.slice(0, 7);
    expect((await call(accountant, "put", "/finance/commission-targets", { month, targets: [{ userId: sellerId, amount: "100000" }] })).status).toBe(403);
    const targets = await call(chief, "put", "/finance/commission-targets", { month, targets: [{ userId: sellerId, amount: "100000" }] });
    expect(targets.status, JSON.stringify(targets.body)).toBe(200);
    expect(targets.body.staff.find((item: { userId: string }) => item.userId === sellerId)).toMatchObject({ amount: "100000" });
    expect((await call(chief, "put", "/finance/commission-targets", { month, targets: [{ userId: "00000000-0000-4000-8000-000000000999", amount: "1" }] })).status).toBe(400);
  });

  it("KICHBAN_KIEMTHU_235: gán theo nhân viên phụ trách khách hoặc người lập đơn; khách không có người phụ trách thì không gán; đổi cài đặt không đổi đơn đã gán", async () => {
    const sellerId = await userIdOf("banhang.hh@vcomm.test");
    const owned = await partner("Khách có người phụ trách", "0320001702", { isCustomer: true, paymentTermDays: 30, ownerUserId: sellerId });
    const first = await confirmedOrder("1", owned);
    const unowned = await confirmedOrder("1", customer);
    const assigned = async (orderId: string) =>
      (await pool.query<{ commission_user_id: string | null }>("SELECT commission_user_id FROM sales.orders WHERE id = $1", [orderId])).rows[0]!.commission_user_id;
    expect(await assigned(first.id)).toBe(sellerId);
    expect(await assigned(unowned.id)).toBeNull();
    await saveSettings({ assignment: "order_creator", rates: [] });
    const created = await confirmedOrder("1", customer);
    expect(await assigned(created.id)).toBe(sellerId);
    expect(await assigned(unowned.id)).toBeNull();
    await saveSettings({ enabled: false, assignment: "order_creator" });
    expect(await assigned((await confirmedOrder("1", customer)).id)).toBeNull();
  });
});

describe("TIEUCHI_NGHIEMTHU_129: phát sinh hoa hồng", () => {
  it("KICHBAN_KIEMTHU_236: thu tiền chia theo dòng, tiền chưa thuế, mức theo ngành hàng và kênh; trả hàng phần chưa thu không phát sinh; hoàn tiền ghi âm", async () => {
    cashFund = (await call(accountant, "post", "/finance/funds", { code: "TM", name: "Quỹ tiền mặt", kind: "cash", openingBalance: "0" })).body.id;
    const category = (await call(chief, "get", "/finance/commission-settings")).body.categories.find((item: { code: string }) => item.code === "HHT").id;
    await saveSettings({
      assignment: "order_creator",
      rates: [
        { categoryId: category, channelId: retailChannel, percent: "3" },
        { categoryId: category, channelId: null, percent: "5" },
      ],
    });
    const order = await confirmedOrder("10", customer);
    const issue = await deliver(order, "4");
    expect(await eventsOf(order.id)).toEqual([]);
    // Thu 22.000 của phiếu 44.000: tiền chưa thuế 20.000 × 3% (kênh bán lẻ).
    await payment({ kind: "customer_receipt", partnerId: customer, amount: "22000", lines: [{ debitItemId: await debtItemOf(issue.id), amount: "22000" }] });
    expect(await eventsOf(order.id)).toEqual([expect.objectContaining({ sourceType: "receipt", baseAmount: "20000", percent: "3", amount: "600" })]);
    // Trả 1 cái khi còn nợ: trừ vào phần chưa thu, không phát sinh.
    const firstReturn = await returnGoods(issue, "1");
    expect(await eventsOf(order.id)).toHaveLength(1);
    // Thu nốt 11.000, trả thêm 1 cái đã thu đủ, hoàn tiền 11.000: phát sinh âm.
    await payment({ kind: "customer_receipt", partnerId: customer, amount: "11000", lines: [{ debitItemId: await debtItemOf(issue.id), amount: "11000" }] });
    const secondReturn = await returnGoods(issue, "1");
    expect(firstReturn.id).not.toBe(secondReturn.id);
    await payment({ kind: "customer_refund", partnerId: customer, amount: "11000" });
    const events = await eventsOf(order.id);
    expect(events.map((event) => [event.sourceType, event.baseAmount, event.amount]).sort()).toEqual(
      [
        ["receipt", "20000", "600"],
        ["receipt", "10000", "300"],
        ["refund", "-10000", "-300"],
      ].sort(),
    );
    expect((await call(seller, "get", "/finance/commissions/events")).status).toBe(403);
  });

  it("KICHBAN_KIEMTHU_237: kênh nhân hệ số; thu trước giao sau; bán lẻ không có khách tính khi giao, trả hàng ghi âm", async () => {
    const category = (await call(chief, "get", "/finance/commission-settings")).body.categories.find((item: { code: string }) => item.code === "HHT").id;
    await saveSettings({
      assignment: "order_creator",
      combination: "channel_factor",
      rates: [{ categoryId: category, channelId: null, percent: "5" }],
      channelFactors: [{ channelId: retailChannel, factor: "0.5" }],
    });
    // Thu trước 11.000 (trả trước), giao sau: phát sinh khi khoản nợ mới tự trừ trả trước.
    const prepaid = await confirmedOrder("1", customer);
    await payment({ kind: "customer_receipt", partnerId: customer, amount: "11000" });
    await deliver(prepaid, "1");
    expect(await eventsOf(prepaid.id)).toEqual([expect.objectContaining({ sourceType: "receipt", baseAmount: "10000", percent: "2.5", amount: "250" })]);
    const retailOrder = await confirmedOrder("2", null);
    const retailIssue = await deliver(retailOrder, "2");
    expect(await eventsOf(retailOrder.id)).toEqual([expect.objectContaining({ sourceType: "retail_delivery", baseAmount: "20000", percent: "2.5", amount: "500" })]);
    await returnGoods(retailIssue, "1");
    expect((await eventsOf(retailOrder.id)).map((event) => [event.sourceType, event.amount]).sort()).toEqual([
      ["retail_delivery", "500"],
      ["retail_return", "-250"],
    ]);
  });

  it("KICHBAN_KIEMTHU_238: mức theo ngành hàng cha gần nhất; bảng ngành hàng và kênh", () => {
    const settings = {
      combination: "matrix" as const,
      defaultPercent: 1,
      rates: new Map([
        ["root:", 4],
        ["root:kenh-a", 6],
      ]),
      factors: new Map([["kenh-b", 2]]),
      parents: new Map<string, string | null>([
        ["root", null],
        ["child", "root"],
        ["other", null],
      ]),
    };
    expect(commissionPercent(settings, "child", "kenh-a")).toBe(6);
    expect(commissionPercent(settings, "child", "kenh-b")).toBe(4);
    expect(commissionPercent(settings, "other", "kenh-a")).toBe(1);
    expect(commissionPercent({ ...settings, combination: "channel_factor" }, "child", "kenh-b")).toBe(8);
    expect(commissionPercent({ ...settings, combination: "channel_factor" }, "child", "kenh-a")).toBe(4);
  });
});
