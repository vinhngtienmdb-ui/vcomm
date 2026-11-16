// CONG_VIEC_60 L2: phiếu thu, phiếu chi nợ nội bộ điểm gắn bảng đối soát; không vượt số còn lại; Đã thanh toán một phần, Đã tất toán; kỳ sau nhận số sau thanh toán
// (KICHBAN_KIEMTHU_616; TIEUCHI_NGHIEMTHU_438).
import { randomUUID } from "node:crypto";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATABASE, type Database } from "../src/database/database.module";
import { testIds } from "../src/database/seed";
import { LoyaltyLedgerService } from "../src/loyalty/ledger.service";
import { LedgerService } from "../src/accounting/ledger.service";
import { paymentDraft } from "../src/accounting/postings";
import { LoyaltySettlementsService, settlementFigures } from "../src/loyalty/settlements.service";
import { createTestUser, signIn, type Session } from "./helpers";
import { prepareMarketplace, retail, type MarketplaceFixture } from "./marketplace-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: MarketplaceFixture;
let database: Database;
let settlements: LoyaltySettlementsService;
let group: Session;
const trading = testIds.tradingCompany;
let settlementId: string;
let operatorFund: string;
let companyFund: string;

const firstOfNextMonth = (day: string) => {
  const value = new Date(`${day.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
};
const operatorCall = (method: "get" | "post", path: string, body?: object) => store.call(method, path, body);
const companyCall = (method: "get" | "post", path: string, body?: object) => group.call(method, path, { companyId: trading, ...(body ? { body } : {}) });
// Dòng bút toán theo vai trò: [vai trò, Nợ, Có].
async function journal(paymentId: string): Promise<[string, number, number][]> {
  const rows = await pool.query(
    `SELECT r.role, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ('cash', 'loyalty_intercompany_receivable', 'loyalty_intercompany_payable')
     WHERE j.source_type = 'payment' AND j.source_id = $1 ORDER BY r.role`,
    [paymentId],
  );
  return rows.rows.map((row): [string, number, number] => [row.role, row.debit, row.credit]);
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareMarketplace(application, pool);
  database = application.get(DATABASE);
  settlements = application.get(LoyaltySettlementsService);
  const ledger = application.get(LoyaltyLedgerService);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  group = await signIn(application, "quantri.tapdoan@vcomm.test");
  expect((await group.call("post", "/finance/ledger/setup", { companyId: trading })).status).toBe(201);
  operatorFund = (await store.call("post", "/finance/funds", { code: "TM", name: "Quỹ tiền mặt", kind: "cash", openingBalance: "0" })).body.id;
  companyFund = (await companyCall("post", "/finance/funds", { code: "TM", name: "Quỹ tiền mặt", kind: "cash", openingBalance: "100000" })).body.id;
  const phase = {
    startsOn: store.today,
    endsOn: null,
    earnPercent: "2",
    pointValue: "1",
    redeemMaxPercent: "50",
    redeemMinPoints: 1000,
    validityMonths: 12,
    orderCapPoints: null,
    monthlyCapPoints: null,
  };
  expect((await store.call("post", "/loyalty/phases", phase)).status).toBe(201);
  const buyerId = await store.register("0939600201", "Khách Thanh Toán Nội Bộ");
  // Công ty con: tích 20.000, dùng 5.000 → công ty con còn phải trả 15.000.
  await database.transaction((transaction) =>
    ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: randomUUID(), userId: buyerId, companyId: trading, day: store.today, goodsAmount: 1000000 }),
  );
  await database.transaction((transaction) =>
    ledger.redeemWithin(transaction, { userId: buyerId, companyId: trading, sourceType: "retail_sale", sourceId: randomUUID(), day: store.today, goodsAmount: 100000, points: 5000 }),
  );
  await settlements.buildMonthly(firstOfNextMonth(store.today));
  settlementId = (await pool.query("SELECT id FROM loyalty.settlements WHERE company_id = $1", [trading])).rows[0].id;
});

afterAll(async () => {
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_60 phiếu thu chi nợ nội bộ điểm", () => {
  it("KICHBAN_KIEMTHU_616: chỉ lập khi đã xác nhận; đúng loại theo bên; không vượt số còn lại; hạch toán; một phần, tất toán; kỳ sau", async () => {
    const payment = { fundId: companyFund, paymentDate: store.today, amount: "10000" };
    // Chưa đủ hai bên xác nhận: không lập được.
    let detail = (await companyCall("get", `/loyalty/settlements/${settlementId}`)).body;
    expect(detail).toMatchObject({ paymentKind: null, payerCompanyName: "VComm Thương mại" });
    const early = await companyCall("post", `/loyalty/settlements/${settlementId}/payments`, payment);
    expect(early.status).toBe(409);
    expect(early.body.error.message).toBe("Bảng đối soát chưa xác nhận đủ hai bên hoặc công ty này không lập loại phiếu này.");
    detail = (await companyCall("post", `/loyalty/settlements/${settlementId}/confirm`, { version: detail.version })).body;
    detail = (await operatorCall("post", `/loyalty/settlements/${settlementId}/confirm`, { version: detail.version })).body;
    expect(detail).toMatchObject({ status: "confirmed", netClosing: "15000", paymentKind: "loyalty_intercompany_receipt", paymentRemaining: "15000" });
    // Người chỉ có quyền đối soát (không có quyền lập phiếu thu chi): bị từ chối, không để lại phiếu nháp.
    const settlementOnly = await createTestUser(pool, "doisoat.vct@vcomm.test", "Người đối soát", [{ companyId: trading }]);
    const role = await pool.query<{ id: string }>(
      "INSERT INTO core.roles (company_id, code, name_vi, name_en, is_system, status) VALUES ($1, 'doi_soat_diem', 'Đối soát điểm', 'Points reconciliation', false, 'active') RETURNING id",
      [trading],
    );
    await pool.query("INSERT INTO core.role_permissions (role_id, permission_code) VALUES ($1, 'finance.access'), ($1, 'loyalty.settlement.manage')", [role.rows[0]!.id]);
    await pool.query("INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, valid_from) VALUES ($1, $2, 'company', $3, '2026-01-01')", [
      settlementOnly,
      role.rows[0]!.id,
      trading,
    ]);
    const reconciler = await signIn(application, "doisoat.vct@vcomm.test");
    expect((await reconciler.call("post", `/loyalty/settlements/${settlementId}/payments`, { companyId: trading, body: payment })).status).toBe(403);
    expect((await pool.query("SELECT count(*)::int AS total FROM finance.payments WHERE loyalty_settlement_id = $1", [settlementId])).rows[0].total).toBe(0);
    // Công ty con (bên trả) lập phiếu chi; vượt số còn lại bị từ chối.
    const over = await companyCall("post", `/loyalty/settlements/${settlementId}/payments`, { ...payment, amount: "15001" });
    expect(over.status).toBe(409);
    expect(over.body.error.message).toBe("Số tiền vượt số còn lại của bảng đối soát.");
    detail = (await companyCall("post", `/loyalty/settlements/${settlementId}/payments`, payment)).body;
    expect(detail).toMatchObject({ status: "partially_paid", paidAmount: "10000", receivedAmount: "0", paymentKind: "loyalty_intercompany_payment", paymentRemaining: "5000" });
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({ kind: "loyalty_intercompany_payment", companyName: "VComm Thương mại", amount: "10000", status: "posted" });
    expect(detail.payments[0].documentNo).toMatch(/^PC-/);
    // Phiếu chi công ty con: Nợ phải trả nội bộ điểm (đối tác: công ty vận hành sàn) / Có tiền mặt.
    expect(await journal(detail.payments[0].id)).toEqual([
      ["cash", 0, 10000],
      ["loyalty_intercompany_payable", 10000, 0],
    ]);
    // Phiếu nợ nội bộ điểm không sửa qua màn hình phiếu thu chi chung.
    const generic = await companyCall("get", `/finance/payments/${detail.payments[0].id}`);
    expect(generic.body).toMatchObject({ kind: "loyalty_intercompany_payment", status: "posted" });
    // Công ty vận hành sàn (bên nhận) lập phiếu thu toàn bộ; công ty con trả nốt 5.000.
    detail = (await operatorCall("post", `/loyalty/settlements/${settlementId}/payments`, { fundId: operatorFund, paymentDate: store.today, amount: "15000" })).body;
    expect(detail).toMatchObject({ status: "partially_paid", receivedAmount: "15000", paymentKind: null });
    expect(await journal(detail.payments[1].id)).toEqual([
      ["cash", 15000, 0],
      ["loyalty_intercompany_receivable", 0, 15000],
    ]);
    expect((await operatorCall("post", `/loyalty/settlements/${settlementId}/payments`, { fundId: operatorFund, paymentDate: store.today, amount: "1" })).status).toBe(409);
    detail = (await companyCall("post", `/loyalty/settlements/${settlementId}/payments`, { ...payment, amount: "5000" })).body;
    expect(detail).toMatchObject({ status: "settled", paidAmount: "15000", receivedAmount: "15000", paymentKind: null });
    expect(detail.events.filter((event: { kind: string }) => event.kind === "paid")).toHaveLength(3);
    // Quỹ: công ty con còn 100.000 − 15.000; công ty vận hành sàn 15.000.
    const funds = async (call: typeof operatorCall) => (await call("get", "/finance/funds")).body.map((fund: { balance: string }) => fund.balance);
    expect(await funds(companyCall)).toEqual(["85000"]);
    expect(await funds(operatorCall)).toEqual(["15000"]);
    // Kỳ sau: số đầu kỳ 0 (đã thanh toán hết), sổ hai bên khớp.
    const nextId = await database.transaction((transaction) => settlements.buildWithin(transaction, retail, trading, firstOfNextMonth(store.today), null));
    const next = (await operatorCall("get", `/loyalty/settlements/${nextId}`)).body;
    expect(next).toMatchObject({ netOpening: "0", netClosing: "0", status: "pending", mismatches: [] });
    // Bảng này còn tính thanh toán trong tháng: phát sinh thanh toán −15.000 theo sổ công ty vận hành sàn.
    const rebuilt = await database.transaction((transaction) => settlementFigures(transaction, retail, trading, `${store.today.slice(0, 7)}-01`));
    expect(rebuilt).toMatchObject({ netClosing: 0, companyNetClosing: 0, mismatches: [] });
    expect(rebuilt.movements).toContainEqual({ kind: "payment", amount: "-15000" });
  });

  it("KICHBAN_KIEMTHU_616: chỉ một bên ghi phiếu thì sổ hai bên lệch phần thanh toán", async () => {
    const ledger = application.get(LoyaltyLedgerService);
    const buyerId = (await pool.query("SELECT user_id FROM loyalty.accounts LIMIT 1")).rows[0].user_id as string;
    await database.transaction((transaction) =>
      ledger.earnWithin(transaction, { sourceType: "retail_sale", sourceId: randomUUID(), userId: buyerId, companyId: trading, day: store.today, goodsAmount: 500000 }),
    );
    const period = `${store.today.slice(0, 7)}-01`;
    // Giả lập phiếu thu ghi sổ ở công ty vận hành sàn mà công ty con chưa ghi phiếu chi.
    const fake = await pool.query(
      `INSERT INTO finance.payments (company_id, kind, partner_id, fund_id, payment_date, amount, status, posted_at, created_by, loyalty_settlement_id, document_no)
       SELECT $1, 'loyalty_intercompany_receipt', p.id, $2, $3::date, 1000, 'posted', now(), $4, $5, 'PT-THU' FROM crm.partners p WHERE p.company_id = $6 RETURNING id`,
      [retail, operatorFund, store.today, testIds.groupAdmin, settlementId, trading],
    );
    await database.transaction(async (transaction) => application.get(LedgerService).record(transaction, await paymentDraft(transaction, fake.rows[0].id)));
    const figures = await database.transaction((transaction) => settlementFigures(transaction, retail, trading, period));
    expect(figures.mismatches).toEqual([{ sourceType: "payment", sourceId: "payments", label: "payments", day: expect.any(String), operatorAmount: "-16000", companyAmount: "-15000" }]);
  });
});
