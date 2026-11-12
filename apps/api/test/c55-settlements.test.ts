// CONG_VIEC_55 L3: đối soát tuần, xác nhận, khiếu nại, tự xác nhận, công nợ, thanh toán, quá hạn chặn tích; bút toán giao dịch, hủy, đối soát
// (KICHBAN_KIEMTHU_544, 545; TIEUCHI_NGHIEMTHU_373, 376, 377).
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AffiliateSettlementsService } from "../src/affiliate/settlements.service";
import type { BuyerCall } from "./marketplace-fixture";
import { operator, prepareAffiliate, type AffiliateFixture } from "./c55-fixture";
import { startTestApplication } from "./setup-database";

let application: NestExpressApplication;
let pool: Pool;
let fixture: AffiliateFixture;
let buyer: { id: string; call: BuyerCall; phone: string };
let partnerId: string;

// Dòng bút toán theo vai trò định khoản: [vai trò, Nợ, Có].
async function journal(sourceType: string, sourceId: string): Promise<[string, number, number][]> {
  const rows = await pool.query<{ role: string; debit: number; credit: number }>(
    `SELECT r.role, l.debit::float AS debit, l.credit::float AS credit FROM accounting.journals j JOIN accounting.journal_lines l ON l.journal_id = j.id
     JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN
       ('affiliate_receivable', 'affiliate_payable', 'affiliate_fee_revenue', 'affiliate_fee_tax', 'affiliate_voucher_deferred', 'loyalty_liability', 'loyalty_expense')
     WHERE j.source_type = $1 AND j.source_id = $2 AND j.company_id = $3 ORDER BY l.line_no`,
    [sourceType, sourceId, operator],
  );
  return rows.rows.map((row) => [row.role, row.debit, row.credit]);
}
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Giao dịch cách 1: thu ngân lập, khách quét và xác nhận số điểm dùng.
async function sale(billAmount: string, points: number) {
  const created = await fixture.cashier.call("post", "/merchant-portal/transactions", { body: { outletId: fixture.outletA, billAmount, method: "merchant_qr" } });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const confirmed = await buyer.call("post", `/buyer/affiliate/transactions/${created.body.transaction.id}/confirm`, { points, code: created.body.qrCode });
  expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
  return { id: created.body.transaction.id as string, ...confirmed.body };
}

beforeAll(async () => {
  ({ application, pool } = await startTestApplication());
  fixture = await prepareAffiliate(application, pool);
  expect((await fixture.call("post", "/finance/ledger/setup")).status).toBe(201);
  buyer = await fixture.register("0938200001", "Phạm Thu Trang");
  await fixture.grantPoints(buyer.id, 300);
  partnerId = (await pool.query("SELECT partner_id FROM affiliate.merchants WHERE id = $1", [fixture.merchantId])).rows[0].partner_id;
});

afterAll(async () => {
  await application.close();
  await pool.end();
});

describe("TIEUCHI_NGHIEMTHU_376, 377: đối soát tuần và bút toán", () => {
  let settlementId: string;
  let first: string;

  it("KICHBAN_KIEMTHU_545: bút toán giao dịch tích, dùng điểm và hủy giao dịch", async () => {
    // Hóa đơn 400.000, dùng 100 điểm (100.000): khách trả 300.000, tích 2 % = 6 điểm (6.000 cửa hàng phải trả).
    const sold = await sale("400000", 100);
    first = sold.id;
    expect(sold).toMatchObject({ redeemedAmount: "100000", paidAmount: "300000", earnedPoints: 6 });
    // Nợ phải thu cửa hàng 6.000 / Có nghĩa vụ 6.000; Nợ nghĩa vụ 100.000 (giá trị lúc tích) / Có phải trả cửa hàng 100.000: gộp Nợ nghĩa vụ 94.000.
    expect(await journal("affiliate_transaction", first)).toEqual([
      ["affiliate_receivable", 6000, 0],
      ["loyalty_liability", 94000, 0],
      ["affiliate_payable", 0, 100000],
    ]);
    const partnerLines = await pool.query(
      "SELECT count(*)::int AS total FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id WHERE j.source_id = $1 AND l.partner_id = $2",
      [first, partnerId],
    );
    expect(partnerLines.rows[0].total).toBe(2);
    // Hóa đơn 200.000 tích 4 điểm, chủ cửa hàng hủy: trừ lại 4 điểm, ghi ngược phải thu.
    const second = await sale("200000", 0);
    expect(second.earnedPoints).toBe(4);
    const cancelled = await fixture.owner.call("post", `/merchant-portal/transactions/${second.id}/cancel`, { body: { reason: "Thu ngân nhập nhầm" } });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(201);
    expect(await journal("affiliate_transaction_cancel", second.id)).toEqual([
      ["loyalty_liability", 4000, 0],
      ["affiliate_receivable", 0, 4000],
    ]);
  });

  it("KICHBAN_KIEMTHU_544: lập bảng tuần, số liệu A đến E; khiếu nại, trả lời kèm điều chỉnh; công nợ phải trả; phiếu chi trả hết thì đã thanh toán", async () => {
    // Chạy việc nền của tuần sau: bảng tuần này gồm hai giao dịch (một đã hủy).
    const service = application.get(AffiliateSettlementsService);
    const created = await service.generateWeekly(addDays(fixture.today, 7));
    expect(created).toHaveLength(1);
    settlementId = created[0]!;
    expect(await service.generateWeekly(addDays(fixture.today, 7))).toEqual([]);
    const list = await fixture.owner.call("get", "/merchant-portal/settlements");
    expect(list.status).toBe(200);
    // Phí 8 % × 100.000 = 8.000; thuế 10 % = 800; số còn lại = 6.000 + 8.000 + 800 − 100.000 = −85.200 (công ty phải trả).
    expect(list.body.data[0]).toMatchObject({
      id: settlementId,
      documentNo: expect.stringMatching(/^DS/),
      transactionCount: 2,
      earnedAmount: "6000",
      redeemedAmount: "100000",
      companyVoucherAmount: "0",
      shortfallAmount: "0",
      feeAmount: "8000",
      feeTaxAmount: "800",
      netAmount: "-85200",
      status: "awaiting_confirmation",
    });
    // Thu ngân không xem đối soát; tuần đã chốt không hủy được giao dịch.
    expect((await fixture.cashier.call("get", "/merchant-portal/settlements")).status).toBe(403);
    const late = await fixture.owner.call("post", `/merchant-portal/transactions/${first}/cancel`, { body: { reason: "Hủy muộn" } });
    expect(late.body.error.message).toBe("Tuần của giao dịch đã chốt đối soát, không hủy được.");
    const detail = await fixture.owner.call("get", `/merchant-portal/settlements/${settlementId}`);
    expect(detail.body.transactions.map((item: { status: string }) => item.status).sort()).toEqual(["cancelled", "completed"]);

    // Khiếu nại; xác nhận sau khiếu nại bị từ chối; công ty trả lời, điều chỉnh công ty trả thêm 5.000 và chốt lại.
    const disputed = await fixture.owner.call("post", `/merchant-portal/settlements/${settlementId}/dispute`, { body: { reason: "Thiếu một giao dịch chiều thứ Sáu", version: detail.body.version } });
    expect(disputed.body).toMatchObject({ status: "disputed", disputeReason: "Thiếu một giao dịch chiều thứ Sáu", disputedByName: "Trần Minh Khoa" });
    const again = await fixture.owner.call("post", `/merchant-portal/settlements/${settlementId}/confirm`, { body: { version: disputed.body.version } });
    expect(again.body.error.message).toBe("Bảng đối soát không ở trạng thái chờ cửa hàng xác nhận.");
    const missingReason = await fixture.call("post", `/affiliate/settlements/${settlementId}/resolve`, { note: "Đã kiểm tra", adjustmentAmount: "-5000", version: disputed.body.version });
    expect(missingReason.body.error.fields).toEqual({ adjustmentReason: expect.any(String) });
    const resolved = await fixture.call("post", `/affiliate/settlements/${settlementId}/resolve`, {
      note: "Đã kiểm tra, bù giao dịch thiếu",
      adjustmentAmount: "-5000",
      adjustmentReason: "Giao dịch LK thiếu do mất mạng",
      version: disputed.body.version,
    });
    expect(resolved.status, JSON.stringify(resolved.body)).toBe(200);
    expect(resolved.body).toMatchObject({ status: "confirmed", adjustmentAmount: "-5000", netAmount: "-90200", openAmount: "90200", overdue: false, autoConfirmed: false });
    expect(resolved.body.dueDate).toBe(addDays(fixture.today, 7));
    // Phí Nợ phải trả 8.800 / Có doanh thu 8.000, thuế 800; điều chỉnh Nợ chi phí 5.000 / Có phải trả; bù trừ Nợ phải trả / Có phải thu 6.000.
    expect(await journal("affiliate_settlement", settlementId)).toEqual([
      ["affiliate_payable", 8800, 0],
      ["affiliate_fee_revenue", 0, 8000],
      ["affiliate_fee_tax", 0, 800],
      ["loyalty_expense", 5000, 0],
      ["affiliate_payable", 0, 5000],
      ["affiliate_payable", 6000, 0],
      ["affiliate_receivable", 0, 6000],
    ]);
    // Phải thu cửa hàng về 0; phải trả còn 90.200 khớp công nợ.
    const balances = await pool.query<{ role: string; balance: number }>(
      `SELECT r.role, sum(l.debit - l.credit)::float AS balance FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
       JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ('affiliate_receivable', 'affiliate_payable')
       WHERE j.company_id = $1 AND l.partner_id = $2 GROUP BY r.role ORDER BY r.role`,
      [operator, partnerId],
    );
    expect(balances.rows).toEqual([
      { role: "affiliate_payable", balance: -90200 },
      { role: "affiliate_receivable", balance: 0 },
    ]);

    // Phiếu chi trả cửa hàng 90.200: bảng đã thanh toán.
    const fund = await fixture.call("post", "/finance/funds", { code: "TMLK", name: "Quỹ tiền mặt liên kết", kind: "cash", openingBalance: "1000000" });
    expect(fund.status, JSON.stringify(fund.body)).toBe(201);
    const payment = await fixture.call("post", "/finance/payments", { kind: "supplier_payment", partnerId, fundId: fund.body.id, paymentDate: fixture.today, amount: "90200", note: "Trả đối soát" });
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);
    const posted = await fixture.call("post", `/finance/payments/${payment.body.id}/submit`, { version: payment.body.version });
    expect(posted.body.status, JSON.stringify(posted.body)).toBe("posted");
    const paid = await fixture.call("get", `/affiliate/settlements/${settlementId}`);
    expect(paid.body).toMatchObject({ status: "paid", openAmount: "0", paidAt: expect.any(String) });
  });

  it("KICHBAN_KIEMTHU_544: tự xác nhận khi quá hạn; phải thu quá hạn thanh toán chặn tích nhưng vẫn dùng điểm được", async () => {
    const service = application.get(AffiliateSettlementsService);
    // Hóa đơn 1.000.000 không dùng điểm: tích 20 điểm, cửa hàng phải trả 20.000.
    await sale("1000000", 0);
    const [id] = await service.generateWeekly(addDays(fixture.today, 14));
    await service.autoConfirmDue();
    expect((await fixture.call("get", `/affiliate/settlements/${id}`)).body.status).toBe("awaiting_confirmation");
    await pool.query("UPDATE affiliate.settlements SET confirm_due_at = now() - interval '1 minute' WHERE id = $1", [id]);
    await service.autoConfirmDue();
    const confirmed = await fixture.call("get", `/affiliate/settlements/${id}`);
    expect(confirmed.body).toMatchObject({ status: "confirmed", autoConfirmed: true, confirmedByName: null, netAmount: "20000", openAmount: "20000", overdue: false });
    // Quá hạn thanh toán: lọc quá hạn, giao dịch mới không tích (lý do quá hạn) nhưng vẫn dùng điểm.
    await pool.query("UPDATE finance.debt_items SET due_date = due_date - 30 WHERE source_type = 'affiliate_settlement' AND source_id = $1", [id]);
    const overdue = await fixture.call("get", "/affiliate/settlements?overdue=true");
    expect(overdue.body.data.map((item: { id: string }) => item.id)).toEqual([id]);
    const blocked = await sale("100000", 10);
    expect(blocked).toMatchObject({ redeemedPoints: 10, earnedPoints: 0 });
    const row = (await pool.query("SELECT skip_reason FROM affiliate.transactions WHERE id = $1", [blocked.id])).rows[0];
    expect(row.skip_reason).toBe("overdue");
    // Phiếu thu đủ: hết quá hạn, tích lại bình thường.
    const fund = (await pool.query("SELECT id FROM finance.funds WHERE code = 'TMLK'")).rows[0].id;
    const receipt = await fixture.call("post", "/finance/payments", { kind: "customer_receipt", partnerId, fundId: fund, paymentDate: fixture.today, amount: "20000", note: "Thu đối soát" });
    expect((await fixture.call("post", `/finance/payments/${receipt.body.id}/submit`, { version: receipt.body.version })).body.status).toBe("posted");
    expect((await fixture.call("get", `/affiliate/settlements/${id}`)).body.status).toBe("paid");
    expect((await sale("100000", 0)).earnedPoints).toBe(2);
  });
});
