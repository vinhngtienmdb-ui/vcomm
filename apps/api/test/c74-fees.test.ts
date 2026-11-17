// CONG_VIEC_74 L7: phí thuê bao iPOS – phiếu PI…, công nợ, bút toán, VietQR, trừ đối soát tuần (khoản G), hủy, lập lại (KICHBAN_KIEMTHU_799, 801).
import type { NestExpressApplication } from "@nestjs/platform-express";
import { messages } from "i18n";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateSettlementsService } from "../src/affiliate/settlements.service";
import { IposFeesService } from "../src/ipos/ipos-fees.service";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { startTestApplication, testClock } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let store: AffiliateFixture;
let planId: string;
let partnerId: string;
let fundId: string;
const message = (key: keyof (typeof messages)["vi"]["errors"]) => messages.vi.errors[key];
const addDays = (day: string, days: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const at = (day: string) => {
  testClock.fixed = new Date(`${day}T03:00:00Z`);
};
const subscribe = async (outletId: string) => {
  const created = await store.call("post", `/affiliate/merchants/${store.merchantId}/ipos-subscriptions`, {
    outletId,
    planId,
    periodMonths: 1,
    startsOn: store.today,
    trialDays: 0,
    customMonthlyPrice: null,
    customMaxRegisters: null,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body.id as string;
};
const invoicesOf = async (subscriptionId: string) =>
  (await pool.query("SELECT id, document_no, period_start::text, period_end::text, status, total::text, method FROM ipos.fee_invoices WHERE subscription_id = $1 ORDER BY created_at", [subscriptionId])).rows;
const receive = async (amount: string) => {
  const receipt = await store.call("post", "/finance/payments", { kind: "customer_receipt", partnerId, fundId, paymentDate: testClock.now().toISOString().slice(0, 10), amount, note: "Thu phí thuê bao iPOS" });
  expect(receipt.status, JSON.stringify(receipt.body)).toBe(201);
  expect((await store.call("post", `/finance/payments/${receipt.body.id}/submit`, { version: receipt.body.version })).body.status).toBe("posted");
};

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  store = await prepareAffiliate(application, pool);
  expect((await store.call("post", "/finance/ledger/setup")).status).toBe(201);
  const plan = await store.call("post", "/ipos/plans", { code: "TIEU-CHUAN", name: "Tiêu chuẩn", monthlyPrice: "299000", taxPercent: "10", maxRegisters: 3, maxItems: 500, trialDays: 0 });
  expect(plan.status, JSON.stringify(plan.body)).toBe(201);
  planId = plan.body.id;
  partnerId = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [store.merchantId])).rows[0].partner_id;
  const fund = await store.call("post", "/finance/funds", { code: "TMIPOS", name: "Quỹ tiền mặt phí iPOS", kind: "cash", openingBalance: "0" });
  expect(fund.status, JSON.stringify(fund.body)).toBe(201);
  fundId = fund.body.id;
});

afterAll(async () => {
  testClock.fixed = null;
  delete process.env.BANK_TRANSFER_BANK_BIN;
  delete process.env.BANK_TRANSFER_BANK_NAME;
  delete process.env.BANK_TRANSFER_ACCOUNT_NUMBER;
  delete process.env.BANK_TRANSFER_ACCOUNT_NAME;
  await application?.close();
  await pool?.end();
});

describe("CONG_VIEC_74 L7 – phiếu phí thuê bao iPOS", () => {
  let subscriptionId: string;

  it("KICHBAN_KIEMTHU_799: lập phiếu kỳ đầu đúng tiền, thuế; công nợ, bút toán 131 / 511 / 3331; chạy lại không lập trùng; cổng cửa hàng xem, mã VietQR", async () => {
    at(store.today);
    // Cửa hàng chưa chọn cách thu: thu bằng VietQR.
    subscriptionId = await subscribe(store.outletA);
    const fees = application.get(IposFeesService);
    expect((await fees.runDaily()).issued).toBe(1);
    expect((await fees.runDaily()).issued).toBe(0);
    const [invoice] = await invoicesOf(subscriptionId);
    expect(invoice).toMatchObject({ document_no: expect.stringMatching(/^PI\d{8}$/), period_start: store.today, status: "awaiting", total: "328900", method: "vietqr" });
    const debt = (await pool.query("SELECT side, open_amount::text FROM finance.debt_items WHERE source_type = 'ipos_fee_invoice' AND source_id = $1", [invoice.id])).rows;
    expect(debt).toEqual([{ side: "receivable", open_amount: "328900.0000" }]);
    const lines = await pool.query<{ role: string; debit: string; credit: string }>(
      `SELECT r.role, l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
       JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ('ipos_fee_receivable', 'ipos_fee_revenue', 'vat_output')
       WHERE j.source_type = 'ipos_fee_invoice' AND j.source_id = $1 ORDER BY r.role`,
      [invoice.id],
    );
    expect(lines.rows.map((row) => [row.role, Number(row.debit), Number(row.credit)])).toEqual([
      ["ipos_fee_receivable", 328900, 0],
      ["ipos_fee_revenue", 0, 299000],
      ["vat_output", 0, 29900],
    ]);
    // ERP: danh sách, chi tiết.
    const list = await store.call("get", "/ipos/fee-invoices?status=awaiting");
    expect(list.body.data).toEqual([expect.objectContaining({ documentNo: invoice.document_no, total: "328900", remaining: "328900", taxAmount: "29900", method: "vietqr" })]);
    const detail = await store.call("get", `/ipos/fee-invoices/${invoice.id}`);
    expect(detail.body).toMatchObject({ debtOpenAmount: "328900", journalNos: [invoice.document_no], canManage: true });
    // Cổng cửa hàng: thuê bao, phiếu; mã VietQR cần tài khoản nhận tiền của công ty vận hành sàn.
    const overview = await store.owner.call("get", "/merchant-portal/ipos/subscription");
    expect(overview.body).toMatchObject({ billingMethod: null, invoices: [expect.objectContaining({ documentNo: invoice.document_no })] });
    expect((await store.owner.call("get", `/merchant-portal/ipos/fee-invoices/${invoice.id}/vietqr`)).body.error.message).toBe(message("iposFeeVietqrNotConfigured"));
    Object.assign(process.env, { BANK_TRANSFER_BANK_BIN: "970436", BANK_TRANSFER_BANK_NAME: "Vietcombank", BANK_TRANSFER_ACCOUNT_NUMBER: "0011009999999", BANK_TRANSFER_ACCOUNT_NAME: "CONG TY VCOMM" });
    const qr = await store.owner.call("get", `/merchant-portal/ipos/fee-invoices/${invoice.id}/vietqr`);
    expect(qr.body).toMatchObject({ documentNo: invoice.document_no, amount: "328900", content: invoice.document_no, accountNumber: "0011009999999" });
    expect(qr.body.payload).toContain(invoice.document_no);
  });

  it("thu một phần vẫn chờ thu; thu đủ thì đã thu; kỳ sau lập trước hạn 7 ngày; hủy (bút toán đảo, đóng công nợ), lập lại", async () => {
    const [invoice] = await invoicesOf(subscriptionId);
    await receive("100000");
    expect((await store.call("get", `/ipos/fee-invoices/${invoice.id}`)).body).toMatchObject({ status: "awaiting", paidAmount: "100000", remaining: "228900" });
    await receive("228900");
    expect((await store.call("get", `/ipos/fee-invoices/${invoice.id}`)).body).toMatchObject({ status: "paid", paidAmount: "328900", remaining: "0" });
    const endsOn = (await pool.query("SELECT ends_on::text FROM ipos.subscriptions WHERE id = $1", [subscriptionId])).rows[0].ends_on as string;
    expect(endsOn).toBe(invoice.period_end);

    // Còn 8 ngày: chưa lập; còn 7 ngày: lập kỳ tiếp.
    const fees = application.get(IposFeesService);
    at(addDays(endsOn, -8));
    expect((await fees.runDaily()).issued).toBe(0);
    at(addDays(endsOn, -7));
    expect((await fees.runDaily()).issued).toBe(1);
    const second = (await invoicesOf(subscriptionId))[1]!;
    expect(second).toMatchObject({ period_start: endsOn, status: "awaiting" });

    const detail = (await store.call("get", `/ipos/fee-invoices/${second.id}`)).body;
    expect((await store.call("post", `/ipos/fee-invoices/${second.id}/void`, { reason: "Lập sai kỳ", version: detail.version + 1 })).status).toBe(409);
    const voided = await store.call("post", `/ipos/fee-invoices/${second.id}/void`, { reason: "Lập sai giá", version: detail.version });
    expect(voided.status, JSON.stringify(voided.body)).toBe(201);
    expect(voided.body).toMatchObject({ status: "voided", voidReason: "Lập sai giá", debtOpenAmount: "0", remaining: "0" });
    expect(voided.body.journalNos).toHaveLength(2);
    // Phiếu đã thu không hủy được.
    expect((await store.call("post", `/ipos/fee-invoices/${invoice.id}/void`, { reason: "Thử", version: (await store.call("get", `/ipos/fee-invoices/${invoice.id}`)).body.version })).body.error.message).toBe(message("iposFeeNotVoidable"));
    const reissued = await store.call("post", `/ipos/subscriptions/${subscriptionId}/fee-invoices`, { periodStart: endsOn });
    expect(reissued.status, JSON.stringify(reissued.body)).toBe(201);
    expect(reissued.body).toMatchObject({ status: "awaiting", periodStart: endsOn, total: "328900" });
    expect(reissued.body.documentNo).not.toBe(second.document_no);
    expect((await store.call("post", `/ipos/subscriptions/${subscriptionId}/fee-invoices`, { periodStart: endsOn })).body.error.message).toBe(message("iposFeeReissueInvalid"));
    // Thẻ Phí: tổng phải thu, đã thu, còn lại (phiếu hủy không tính).
    const summary = await store.call("get", `/ipos/reconciliation/fees?from=${store.today}&to=${addDays(endsOn, 1)}`);
    expect(summary.body.totals).toMatchObject({ invoices: 2, total: "657800", paid: "328900", remaining: "328900" });
    // Thu đủ phiếu lập lại để các kiểm thử sau không bị lẫn công nợ.
    await receive("328900");
  });

  it("KICHBAN_KIEMTHU_801 phần đối soát tuần: phiếu trừ đối soát vào bảng tuần thành khoản G (không có giao dịch vẫn lập bảng); xác nhận chuyển công nợ; thanh toán bảng thì phiếu đã thu", async () => {
    at(store.today);
    const billing = (await store.call("get", `/affiliate/merchants/${store.merchantId}/ipos`)).body.billing;
    const saved = await store.call("put", `/affiliate/merchants/${store.merchantId}/ipos-billing`, { method: "settlement_deduction", freeUntil: null, freeReason: null, version: billing?.version ?? null });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const second = await subscribe(store.outletB);
    expect((await application.get(IposFeesService).runDaily()).issued).toBe(1);
    const [invoice] = await invoicesOf(second);
    expect(invoice).toMatchObject({ method: "settlement_deduction", total: "328900" });

    const settlements = application.get(AffiliateSettlementsService);
    const [settlementId] = await settlements.generateWeekly(addDays(store.today, 7));
    expect(settlementId).toEqual(expect.any(String));
    const settlement = (await pool.query("SELECT ipos_fee_amount::text, net_amount::text, transaction_count FROM affiliate.settlements WHERE id = $1", [settlementId])).rows[0];
    expect(settlement).toEqual({ ipos_fee_amount: "328900.0000", net_amount: "328900.0000", transaction_count: 0 });
    expect((await pool.query("SELECT settlement_id FROM ipos.fee_invoices WHERE id = $1", [invoice.id])).rows[0].settlement_id).toBe(settlementId);

    await pool.query("UPDATE affiliate.settlements SET confirm_due_at = now() - interval '1 minute' WHERE id = $1", [settlementId]);
    await settlements.autoConfirmDue();
    // Công nợ của phiếu đóng; công nợ của bảng phải thu 328.900; bút toán chuyển 131 phí thuê bao sang phải thu cửa hàng liên kết.
    expect((await pool.query("SELECT open_amount::text FROM finance.debt_items WHERE source_type = 'ipos_fee_invoice' AND source_id = $1 AND direction = 'debit'", [invoice.id])).rows[0].open_amount).toBe("0.0000");
    const balances = await pool.query<{ role: string; balance: number }>(
      `SELECT r.role, sum(l.debit - l.credit)::float AS balance FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
       JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role = 'ipos_fee_receivable'
       WHERE j.company_id = $1 AND l.partner_id = $2 GROUP BY r.role`,
      [operator, partnerId],
    );
    // Phải thu phí thuê bao và phải thu cửa hàng liên kết cùng tài khoản 131: số dư của cửa hàng bằng công nợ của bảng (phiếu đã chuyển vào bảng).
    expect(balances.rows).toEqual([{ role: "ipos_fee_receivable", balance: 328900 }]);
    const moved = await pool.query<{ debit: string; credit: string }>(
      `SELECT l.debit::text, l.credit::text FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
       WHERE j.source_type = 'affiliate_settlement' AND j.source_id = $1 AND l.partner_id = $2 ORDER BY l.debit DESC`,
      [settlementId, partnerId],
    );
    expect(moved.rows.map((row) => [Number(row.debit), Number(row.credit)])).toEqual([
      [328900, 0],
      [0, 328900],
    ]);
    expect((await store.call("get", `/ipos/fee-invoices/${invoice.id}`)).body).toMatchObject({ status: "awaiting", settlementNo: expect.stringMatching(/^DS/) });

    await receive("328900");
    expect((await pool.query("SELECT status FROM affiliate.settlements WHERE id = $1", [settlementId])).rows[0].status).toBe("paid");
    const after = await pool.query<{ balance: number }>(
      `SELECT sum(l.debit - l.credit)::float AS balance FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
       JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role = 'ipos_fee_receivable'
       WHERE j.company_id = $1 AND l.partner_id = $2`,
      [operator, partnerId],
    );
    expect(after.rows[0]!.balance).toBe(0);
    expect((await store.call("get", `/ipos/fee-invoices/${invoice.id}`)).body).toMatchObject({ status: "paid", paidAmount: "328900" });
  });
});
