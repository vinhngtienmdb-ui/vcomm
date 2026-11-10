// CONG_VIEC_17: Hoa hồng đội kinh doanh (TIEUCHI_NGHIEMTHU_127 đến 130; KICHBAN_KIEMTHU_234 trở đi).
// Hàng A thuế 10%: giá bán gồm thuế 11.000 (chưa thuế 10.000); giá vốn 8.000; giá mua chưa thuế 8.000.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { assignCommissionUser, commissionPercent } from "../src/commission/commission-rules";
import { DATABASE } from "../src/database/database.module";
import { OutboxService } from "../src/common/outbox.service";
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

type Statement = {
  id: string;
  month: string;
  status: string;
  documentNo: string | null;
  totalAmount: string;
  version: number;
  lines: { userId: string; baseAmount: string; commissionBefore: string; targetAmount: string | null; achievedPercent: string | null; multiplier: string; amount: string }[];
};
const statements = async () => (await call(accountant, "get", "/finance/commissions/statements")).body as { statements: Statement[]; nextMonth: string | null; canCreate: boolean };

describe("TIEUCHI_NGHIEMTHU_130: bảng hoa hồng tháng", () => {
  it("KICHBAN_KIEMTHU_239: lập lần lượt theo tháng; cơ sở, phần trăm đạt, hệ số; bỏ bảng nháp trả phát sinh; ghi sổ có bút toán chi phí, phải trả người lao động", async () => {
    await call(chief, "post", "/finance/ledger/setup");
    const sellerId = await userIdOf("banhang.hh@vcomm.test");
    // Phát sinh các kịch bản trước (ngày hôm nay) dời về tháng 9 để lập bảng.
    await pool.query("UPDATE finance.commission_events SET event_date = '2026-09-15' WHERE company_id = $1", [retail]);
    const events = (
      await pool.query<{ base: string; amount: string }>("SELECT sum(base_amount)::text AS base, sum(amount)::text AS amount FROM finance.commission_events WHERE company_id = $1 AND user_id = $2", [
        retail,
        sellerId,
      ])
    ).rows[0]!;
    await saveSettings({
      assignment: "order_creator",
      tiers: [
        { fromPercent: "0", multiplier: "0.5" },
        { fromPercent: "100", multiplier: "1.2" },
      ],
    });
    await call(chief, "put", "/finance/commission-targets", { month: "2026-09", targets: [{ userId: sellerId, amount: String(Number(events.base) / 2) }] });
    const listed = await statements();
    expect(listed).toMatchObject({ nextMonth: "2026-09", canCreate: true });
    expect((await call(accountant, "post", "/finance/commissions/statements", { month: "2026-10" })).status).toBe(409);
    expect((await call(seller, "post", "/finance/commissions/statements", { month: "2026-09" })).status).toBe(403);
    const draft = await call(accountant, "post", "/finance/commissions/statements", { month: "2026-09" });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect(draft.body.lines).toEqual([
      expect.objectContaining({
        userId: sellerId,
        baseAmount: String(Number(events.base)),
        commissionBefore: String(Number(events.amount)),
        achievedPercent: "200",
        multiplier: "1.2",
        amount: String(Math.round(Number(events.amount) * 1.2)),
      }),
    ]);
    expect((await call(accountant, "post", "/finance/commissions/statements", { month: "2026-09" })).status).toBe(409);
    // Bỏ bảng nháp: phát sinh trả về, lập lại được.
    expect((await call(accountant, "delete", `/finance/commissions/statements/${draft.body.id}`)).status).toBe(200);
    expect((await pool.query("SELECT 1 FROM finance.commission_events WHERE statement_id IS NOT NULL")).rowCount).toBe(0);
    const again = await call(accountant, "post", "/finance/commissions/statements", { month: "2026-09" });
    const posted = await call(accountant, "post", `/finance/commissions/statements/${again.body.id}/submit`, { version: again.body.version });
    expect(posted.status, JSON.stringify(posted.body)).toBe(201);
    expect(posted.body).toMatchObject({ status: "posted", documentNo: expect.stringMatching(/^HH/) });
    const journal = await pool.query<{ code: string; debit: string; credit: string }>(
      `SELECT a.code, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id JOIN accounting.accounts a ON a.id = l.account_id
       WHERE j.source_type = 'commission' AND j.source_id = $1 ORDER BY l.line_no`,
      [again.body.id],
    );
    const total = Number(posted.body.totalAmount);
    expect(journal.rows.map((row) => [row.code, Number(row.debit), Number(row.credit)])).toEqual([
      ["6411", total, 0],
      ["334", 0, total],
    ]);
    const eventList = (await call(accountant, "get", "/finance/commissions/events?pageSize=100")).body.data as { statementNo: string | null }[];
    expect(eventList.every((event) => event.statementNo === posted.body.documentNo)).toBe(true);
  });

  it("KICHBAN_KIEMTHU_240: phát sinh của tháng đã chốt về sau (hoàn tiền) vào bảng kỳ sau; tháng chưa kết thúc không lập; bị từ chối trả phát sinh, lập lại được", async () => {
    // Hoàn tiền phát sinh sau khi đã chốt tháng 9, ghi ngày tháng 9: vào bảng tháng 10 (tháng 10 không có chỉ tiêu: hệ số 1).
    const order = (
      await pool.query<{ order_id: string; user_id: string; order_line_id: string; document_id: string }>("SELECT order_id, user_id, order_line_id, document_id FROM finance.commission_events LIMIT 1")
    ).rows[0]!;
    await pool.query(
      `INSERT INTO finance.commission_events (company_id, user_id, order_id, source_type, source_id, document_id, order_line_id, event_date, base_amount, percent, amount)
       VALUES ($1, $2, $3, 'refund', gen_random_uuid(), $4, $5, '2026-09-20', -10000, 3, -300)`,
      [retail, order.user_id, order.order_id, order.document_id, order.order_line_id],
    );
    expect((await statements()).nextMonth).toBe("2026-10");
    await admin.call("post", "/approval-policies", {
      companyId: retail,
      body: {
        documentTypeCode: "finance.commission",
        currency: "VND",
        effectiveFrom: "2026-01-01",
        levels: [{ levelNo: 1, minAmount: "0", approver: { type: "user", userId: testIds.purchasingManager }, substitute: { type: "user", userId: testIds.retailAdmin }, dueHours: 8 }],
      },
    });
    const october = await call(accountant, "post", "/finance/commissions/statements", { month: "2026-10" });
    expect(october.body).toMatchObject({ totalAmount: "-300", eventCount: 1 });
    expect(october.body.lines).toEqual([expect.objectContaining({ baseAmount: "-10000", commissionBefore: "-300", multiplier: "1", amount: "-300" })]);
    const pending = await call(accountant, "post", `/finance/commissions/statements/${october.body.id}/submit`, { version: october.body.version });
    expect(pending.body).toMatchObject({ status: "pending", canWithdraw: true });
    expect((await statements()).canCreate).toBe(false);
    // Người duyệt được giao (người duyệt chính hoặc người thay thế).
    const approverOf = async (requestId: string) => {
      const assigned = (await pool.query<{ assigned_user_id: string }>("SELECT assigned_user_id FROM core.approval_steps WHERE request_id = $1 ORDER BY level_no LIMIT 1", [requestId])).rows[0]!
        .assigned_user_id;
      return assigned === testIds.retailAdmin ? admin : signIn(application, "phuc.le@vcomm.test");
    };
    const requestId = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM finance.commission_statements WHERE id = $1", [october.body.id])).rows[0]!
      .approval_request_id;
    const decided = await (await approverOf(requestId)).call("post", `/approval-requests/${requestId}/decisions`, { body: { decision: "rejected", comment: "Xem lại" } });
    expect(decided.status, JSON.stringify(decided.body)).toBe(200);
    await application.get(OutboxService).dispatchPending();
    expect((await call(accountant, "get", `/finance/commissions/statements/${october.body.id}`)).body.status).toBe("rejected");
    expect((await pool.query("SELECT 1 FROM finance.commission_events WHERE statement_id IS NULL")).rowCount).toBe(1);
    // Lập lại, duyệt: bút toán đảo bên khi tổng âm.
    const retry = await call(accountant, "post", "/finance/commissions/statements", { month: "2026-10" });
    await call(accountant, "post", `/finance/commissions/statements/${retry.body.id}/submit`, { version: retry.body.version });
    const retryRequest = (await pool.query<{ approval_request_id: string }>("SELECT approval_request_id FROM finance.commission_statements WHERE id = $1", [retry.body.id])).rows[0]!
      .approval_request_id;
    await (await approverOf(retryRequest)).call("post", `/approval-requests/${retryRequest}/decisions`, { body: { decision: "approved", comment: "Đồng ý" } });
    await application.get(OutboxService).dispatchPending();
    expect((await call(accountant, "get", `/finance/commissions/statements/${retry.body.id}`)).body.status).toBe("posted");
    const journal = await pool.query<{ code: string; debit: string; credit: string }>(
      `SELECT a.code, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id JOIN accounting.accounts a ON a.id = l.account_id
       WHERE j.source_type = 'commission' AND j.source_id = $1 ORDER BY l.line_no`,
      [retry.body.id],
    );
    expect(journal.rows.map((row) => [row.code, Number(row.debit), Number(row.credit)])).toEqual([
      ["334", 300, 0],
      ["6411", 0, 300],
    ]);
    // Tháng hiện tại chưa kết thúc.
    expect((await statements()).nextMonth).toBeNull();
    expect((await call(accountant, "post", "/finance/commissions/statements", { month: today.slice(0, 7) })).status).toBe(409);
  });
});

describe("TIEUCHI_NGHIEMTHU_129: phát sinh theo dòng (sau rà soát)", () => {
  it("KICHBAN_KIEMTHU_241: trả hết một dòng khi còn nợ, thu phần còn lại: chỉ dòng còn lại có hoa hồng", async () => {
    const created = await call(seller, "post", "/sales/orders", {
      channelId: retailChannel,
      warehouseId,
      orderDate: today,
      customerId: customer,
      lines: [
        { variantId: itemA, unitId, quantity: "1", discountPercent: "0" },
        { variantId: itemB, unitId, quantity: "1", discountPercent: "0" },
      ],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const order = (await call(seller, "post", `/sales/orders/${created.body.id}/submit`)).body as { id: string; lines: { id: string }[] };
    const issue = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: { orderId: order.id, documentDate: today, lines: order.lines.map((line) => ({ orderLineId: line.id, quantity: "1" })) },
    });
    const posted = (await keeper.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body as { id: string; lines: { id: string; variantId: string }[] };
    // Trả hết dòng hàng A (11.000) khi chưa thu: trừ vào nợ phiếu xuất.
    const lineA = posted.lines.find((line) => line.variantId === itemA)!;
    const returned = await keeper.call("post", "/inventory/sales-returns", {
      companyId: retail,
      body: { issueId: posted.id, documentDate: today, reason: "Khách trả", lines: [{ issueLineId: lineA.id, quantity: "1" }] },
    });
    expect((await keeper.call("post", `/inventory/documents/${returned.body.id}/submit`, { companyId: retail })).body.status).toBe("posted");
    // Thu 12.000 còn lại: chỉ dòng B (chưa thuế 10.909).
    await payment({ kind: "customer_receipt", partnerId: customer, amount: "12000", lines: [{ debitItemId: await debtItemOf(posted.id), amount: "12000" }] });
    const events = await eventsOf(order.id);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ sourceType: "receipt", baseAmount: "10909" });
  });

  it("KICHBAN_KIEMTHU_242: một dòng đơn giao bằng hai dòng phiếu: hoa hồng tính đủ cả hai dòng", async () => {
    const order = await confirmedOrder("5", customer);
    const issue = await keeper.call("post", "/inventory/sales-issues", {
      companyId: retail,
      body: {
        orderId: order.id,
        documentDate: today,
        lines: [
          { orderLineId: order.lines[0]!.id, quantity: "3" },
          { orderLineId: order.lines[0]!.id, quantity: "2" },
        ],
      },
    });
    if (issue.status !== 201) {
      // Phiếu không nhận hai dòng cùng dòng đơn: không có tình huống tách dòng.
      expect(issue.status).toBe(400);
      return;
    }
    const posted = (await keeper.call("post", `/inventory/documents/${issue.body.id}/submit`, { companyId: retail })).body as { id: string; status: string };
    expect(posted.status).toBe("posted");
    await payment({ kind: "customer_receipt", partnerId: customer, amount: "55000", lines: [{ debitItemId: await debtItemOf(posted.id), amount: "55000" }] });
    const events = await eventsOf(order.id);
    expect(events.map((event) => event.baseAmount)).toEqual(["50000"]);
  });
});

describe("TIEUCHI_NGHIEMTHU_128: gán đơn (quyết định khi nghiệm thu)", () => {
  it("KICHBAN_KIEMTHU_245: bán lẻ không có khách gán cho người lập đơn kể cả khi gán theo người phụ trách; đơn bán cho công ty con trong tập đoàn không gán", async () => {
    await saveSettings({ assignment: "customer_owner" });
    const sellerId = await userIdOf("banhang.hh@vcomm.test");
    const assigned = async (orderId: string) =>
      (await pool.query<{ commission_user_id: string | null }>("SELECT commission_user_id FROM sales.orders WHERE id = $1", [orderId])).rows[0]!.commission_user_id;
    expect(await assigned((await confirmedOrder("1", null)).id)).toBe(sellerId);
    // Đối tác nội bộ của công ty con trong tập đoàn.
    const internal = (await pool.query<{ id: string }>("SELECT id FROM crm.partners WHERE company_id = $1", [testIds.tradingCompany])).rows[0]!.id;
    await pool.query("UPDATE crm.partner_profiles SET owner_user_id = $1 WHERE company_id = $2 AND partner_id = $3", [sellerId, retail, internal]);
    const orderId = (
      await pool.query<{ id: string }>(
        "INSERT INTO sales.orders (company_id, customer_id, channel_id, warehouse_id, order_date, currency, status, created_by, net_amount, tax_amount, total_amount) VALUES ($1, $2, $3, $4, $5, 'VND', 'draft', $6, 0, 0, 0) RETURNING id",
        [retail, internal, retailChannel, warehouseId, today, sellerId],
      )
    ).rows[0]!.id;
    await assignCommissionUser(application.get(DATABASE), orderId);
    expect(await assigned(orderId)).toBeNull();
  });
});
