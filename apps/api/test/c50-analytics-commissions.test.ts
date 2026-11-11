// CONG_VIEC_50: báo cáo hoa hồng và ví, tổng quan (KICHBAN_KIEMTHU_483, 477).
// Kem 250.000 gồm thuế; hoa hồng giới thiệu 5% trên tiền hàng chưa thuế. Đơn 2 kem hoàn tất: 5% × 454.545 = 22.727; đơn 1 kem chưa hoàn tất: ước tính 11.364.
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testIds } from "../src/database/seed";
import { MarketplaceOrdersService } from "../src/marketplace/marketplace-orders.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { prepareMarketplace, retail, startGhnMock, type BuyerCall, type GhnMock, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let ghn: GhnMock;
let store: MarketplaceFixture;
let groupAdmin: Session;
let referrerId: string;
let nextMonth: string;
const webhookKey = "khoa-webhook-kiem-thu-hoa-hong-bao-cao-0123";
const report = (query: string, session: Session = groupAdmin) => session.call("get", `/analytics/commissions?${query}`, { companyId: retail });
const period = () => `from=${store.today.slice(0, 8)}01&to=${store.today}`;

async function delivered(buyer: BuyerCall, quantity: number): Promise<string> {
  const addressId = await store.addressOf(buyer);
  const lines = [{ variantId: store.variants.cream, quantity }];
  const preview = await buyer("post", "/buyer/orders/preview", { addressId, lines });
  const placed = await buyer("post", "/buyer/orders", { addressId, lines, expectedTotal: preview.body.total, paymentMethod: "cod" });
  expect(placed.status, JSON.stringify(placed.body)).toBe(201);
  const shipped = await store.call("post", `/marketplace/orders/${placed.body.id}/ship`, { carrierCode: "ghn", version: placed.body.version });
  ghn.orders.set(shipped.body.trackingCode, { status: "delivered", codCollectDate: null });
  await request(application.getHttpServer()).post(`/api/v1/public/carriers/ghn/webhook/${webhookKey}`).send({ OrderCode: shipped.body.trackingCode, Type: "switch_status" });
  return placed.body.id;
}

beforeAll(async () => {
  ghn = await startGhnMock();
  Object.assign(process.env, { GHN_API_TOKEN: "token-kiem-thu", GHN_SHOP_ID: "885", GHN_WEBHOOK_KEY: webhookKey, GHN_BASE_URL: ghn.url });
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  const next = new Date(Date.UTC(Number(store.today.slice(0, 4)), Number(store.today.slice(5, 7)), 1));
  nextMonth = next.toISOString().slice(0, 10);
  groupAdmin = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await store.call("put", "/marketplace/carriers/ghn", { isEnabled: true })).status).toBe(200);
  expect((await store.call("put", "/marketplace/ordering-open", { orderingOpen: true })).status).toBe(200);
  const settings = { calculation: "percent", referral: "5", staff: "0", teamHead: "0", regionalDirector: "0", director: "0", version: 0 };
  expect((await store.call("put", `/marketplace/listings/${store.products.cream}/commission`, settings)).status).toBe(200);
  referrerId = await store.register("0938600001", "Người Giới Thiệu Báo Cáo");
  await store.register("0938600002", "Khách Được Giới Thiệu", "0938600001");
  const buyer = await store.buyerSession("0938600002");
  // Đơn hoàn tất: cộng ví người giới thiệu.
  const completed = await delivered(buyer, 2);
  await pool.query("UPDATE marketplace.orders SET delivered_at = now() - interval '169 hours' WHERE id = $1", [completed]);
  await application.get(MarketplaceOrdersService).completeDue();
  // Đơn đã giao chưa hoàn tất: hoa hồng đang chờ.
  await delivered(buyer, 1);
  // Rút 150.000 đã chi (ví thêm 200.000 làm dữ liệu thử để đủ mức rút tối thiểu); người khác rút 100.000 đang chờ duyệt.
  await pool.query("UPDATE marketplace.wallets SET balance = balance + 200000 WHERE user_id = $1", [referrerId]);
  const referrer = await store.buyerSession("0938600001");
  await referrer("put", "/buyer/bank-account", { bankName: "Vietcombank", accountNumber: "0123456789", accountHolder: "NGUOI GIOI THIEU" });
  const withdrawal = (await referrer("post", "/buyer/withdrawals", { amount: "150000" })).body;
  expect((await store.call("post", `/marketplace/withdrawals/${withdrawal.id}/approve`, { version: 1 })).status).toBe(200);
  expect((await store.call("post", `/marketplace/withdrawals/${withdrawal.id}/pay`, { bankTransactionNo: "FT050", paidOn: store.today, version: 2 })).status).toBe(200);
  const otherId = await store.register("0938600003", "Người Rút Đang Chờ");
  await pool.query("INSERT INTO marketplace.wallets (user_id, balance) VALUES ($1, 120000)", [otherId]);
  const other = await store.buyerSession("0938600003");
  await other("put", "/buyer/bank-account", { bankName: "Vietcombank", accountNumber: "0123456780", accountHolder: "NGUOI RUT" });
  expect((await other("post", "/buyer/withdrawals", { amount: "100000" })).status).toBe(201);
});

afterAll(async () => {
  ghn?.close();
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_50 hoa hồng và ví", () => {
  it("KICHBAN_KIEMTHU_483: hoa hồng ghi có theo phần hưởng, người hưởng, đang chờ, rút tiền đã chi, rút đang chờ, số dư ví", async () => {
    const response = await report(`${period()}&groupBy=share`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const walletTotal = (await pool.query("SELECT sum(balance)::text AS total FROM marketplace.wallets")).rows[0].total;
    expect(response.body.summary).toEqual({
      credited: "22727",
      creditedLines: 1,
      pending: "11364",
      paid: { count: 1, amount: "150000", taxAmount: "0", feeAmount: "0", netAmount: "150000" },
      pendingWithdrawals: { count: 1, amount: "100000" },
      walletBalance: String(Number(walletTotal)),
    });
    expect(Number(walletTotal)).toBe(72727 + 20000);
    expect(response.body.rows).toEqual([{ key: "referral", label: "Giới thiệu", lines: 1, amount: "22727" }]);
    expect(response.body.withdrawals).toEqual([expect.objectContaining({ userName: "Người Giới Thiệu Báo Cáo", paidOn: store.today, amount: "150000", netAmount: "150000" })]);
    expect(JSON.stringify(response.body)).not.toContain("0938600001");
    const beneficiary = await report(`${period()}&groupBy=beneficiary`);
    expect(beneficiary.body.rows).toEqual([{ key: referrerId, label: "Người Giới Thiệu Báo Cáo", lines: 1, amount: "22727" }]);
    // Kỳ sau: chưa ghi có, chưa chi; đang chờ và số dư ví vẫn tính tại hôm nay.
    const later = (await report(`from=${nextMonth}&to=${nextMonth}`)).body.summary;
    expect(later).toMatchObject({ credited: "0", creditedLines: 0, pending: "11364", paid: { count: 0, amount: "0" }, walletBalance: "92727" });
    // Công ty không vận hành VComm: không có hoa hồng, không có số dư ví.
    expect((await report(`${period()}&companyIds=${testIds.tradingCompany}`)).body.summary).toMatchObject({ credited: "0", pending: "0", walletBalance: null });
    const file = await groupAdmin.call("get", `/analytics/commissions?${period()}&format=xlsx`, { companyId: retail });
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("spreadsheetml");
  });

  it("KICHBAN_KIEMTHU_477: tổng quan chỉ có chỉ tiêu của nhóm được xem", async () => {
    const all = await groupAdmin.call("get", `/analytics/overview?${period()}`, { companyId: retail });
    expect(all.status, JSON.stringify(all.body)).toBe(200);
    expect(all.body.sales.totals).toMatchObject({ revenue: "681818" });
    expect(all.body.inventory).toMatchObject({ costOfSales: "300000" });
    expect(all.body.debt).toMatchObject({ receivable: { balance: "0" } });
    expect(all.body.commission).toEqual({ credited: "22727", pending: "11364", walletBalance: "92727" });
    const keeperId = await createTestUser(pool, "quanlykho.baocao@vcomm.test", "Quản Lý Kho Báo Cáo", [{ companyId: retail }]);
    const roleId = (await pool.query<{ id: string }>("SELECT id FROM core.roles WHERE code = 'warehouse_manager' AND company_id IS NULL")).rows[0]!.id;
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [keeperId, roleId, retail]);
    const keeper = await signIn(application, "quanlykho.baocao@vcomm.test");
    const own = await keeper.call("get", `/analytics/overview?${period()}`, { companyId: retail });
    expect(own.body).toMatchObject({ sales: null, debt: null, commission: null, inventory: expect.objectContaining({ costOfSales: "300000" }) });
    expect((await keeper.call("get", `/analytics/overview?${period()}&companyIds=${testIds.tradingCompany}`, { companyId: retail })).status).toBe(403);
    for (const path of [`sales?${period()}`, "debts", `commissions?${period()}`]) expect((await keeper.call("get", `/analytics/${path}`, { companyId: retail })).status).toBe(403);
  });
});
