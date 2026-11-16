// Bút toán tự sinh của đối tác liên minh điểm ở công ty vận hành sàn (CONG_VIEC_65; QUYTAC_NGHIEPVU_547). Đối tác của dòng phải thu, phải trả là đối tác liên minh.
// Đổi ra: Nợ nghĩa vụ điểm theo giá trị lúc tích của lô đã lấy / Có phải trả đối tác tiền theo đơn giá; chênh lệch vào chi phí điểm.
// Đổi vào (và tặng điểm, lát L3): Nợ phải thu đối tác tiền gồm thuế / Có nghĩa vụ điểm theo giá trị điểm; chênh lệch dương Có doanh thu liên minh, thuế; âm Nợ chi phí điểm.
import { sql } from "drizzle-orm";
import type { DraftJournal } from "../../accounting/postings";
import { affiliateLines } from "../../affiliate/postings";
import type { Database } from "../../database/database.module";

type Executor = Pick<Database, "execute">;

// Chênh lệch dương giữa tiền bán (chưa thuế) và giá trị điểm chịu thuế theo thuế suất hợp đồng; làm tròn đến đồng.
export function marginTax(amount: number, pointValueAmount: number, taxPercent: number): number {
  const margin = Math.round(amount) - Math.round(pointValueAmount);
  return margin > 0 ? Math.round((margin * taxPercent) / 100) : 0;
}

// Phát sinh phải thu đối tác (đổi vào, tặng điểm): Nợ 131 tiền gồm thuế / Có 3388 giá trị điểm; chênh lệch dương Có 511, 3331; âm Nợ 641. sign = -1: ghi ngược (hủy tặng).
function receivableLines(amount: number, value: number, tax: number, partnerId: string, sign: 1 | -1) {
  return affiliateLines([
    { role: "loyalty_partner_receivable", amount: sign * (amount + tax), partnerId },
    { role: "loyalty_liability", amount: -sign * value },
    ...(amount > value
      ? [
          { role: "loyalty_partner_revenue" as const, amount: -sign * (amount - value) },
          { role: "loyalty_partner_tax" as const, amount: -sign * tax },
        ]
      : [{ role: "loyalty_expense" as const, amount: sign * (value - amount) }]),
  ]);
}

export async function exchangeDraft(executor: Executor, exchangeId: string): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{
      company_id: string;
      partner_id: string;
      document_no: string;
      direction: "outbound" | "inbound";
      amount: string;
      tax_amount: string;
      point_value_amount: string;
      completed_on: string;
    }>(sql`
      SELECT c.company_id, c.partner_id, x.document_no, x.direction, x.amount::text, x.tax_amount::text, x.point_value_amount::text,
        (x.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS completed_on
      FROM loyalty.partner_exchanges x JOIN loyalty.partner_contracts c ON c.id = x.contract_id
      WHERE x.id = ${exchangeId} AND x.status = 'completed'`)
  ).rows[0];
  if (!row) return null;
  const partnerId = row.partner_id;
  const amount = Math.round(Number(row.amount));
  const value = Math.round(Number(row.point_value_amount));
  const tax = Math.round(Number(row.tax_amount));
  const lines =
    row.direction === "outbound"
      ? affiliateLines([
          { role: "loyalty_liability", amount: value },
          { role: "loyalty_expense", amount: amount - value },
          { role: "loyalty_partner_payable", amount: -amount, partnerId },
        ])
      : receivableLines(amount, value, tax, partnerId, 1);
  return {
    companyId: row.company_id,
    sourceType: "loyalty_partner_exchange",
    sourceId: exchangeId,
    journalNo: row.document_no,
    date: row.completed_on,
    description: row.direction === "outbound" ? `Đổi điểm VComm ra điểm đối tác ${row.document_no}` : `Đổi điểm đối tác vào điểm VComm ${row.document_no}`,
    lines,
  };
}

// Đối tác tặng điểm (ngày tặng) và hủy tặng (ngày hủy, ghi ngược).
export async function giftDraft(executor: Executor, giftId: string, cancel: boolean): Promise<DraftJournal | null> {
  const row = (
    await executor.execute<{ company_id: string; partner_id: string; document_no: string; amount: string; tax_amount: string; point_value_amount: string; day: string | null }>(sql`
      SELECT c.company_id, c.partner_id, g.document_no, g.amount::text, g.tax_amount::text, g.point_value_amount::text,
        (${cancel ? sql`g.cancelled_at` : sql`g.created_at`} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day
      FROM loyalty.partner_gifts g JOIN loyalty.partner_contracts c ON c.id = g.contract_id WHERE g.id = ${giftId}`)
  ).rows[0];
  if (!row?.day) return null;
  return {
    companyId: row.company_id,
    sourceType: cancel ? "loyalty_partner_gift_cancel" : "loyalty_partner_gift",
    sourceId: giftId,
    journalNo: cancel ? `${row.document_no}-H` : row.document_no,
    date: row.day,
    description: cancel ? `Hủy đối tác tặng điểm ${row.document_no}` : `Đối tác tặng điểm ${row.document_no}`,
    lines: receivableLines(Math.round(Number(row.amount)), Math.round(Number(row.point_value_amount)), Math.round(Number(row.tax_amount)), row.partner_id, cancel ? -1 : 1),
  };
}

// Xác nhận bảng đối soát tháng (QUYTAC_NGHIEPVU_547, 549): bù trừ Nợ 331 / Có 131 bằng số nhỏ hơn giữa phải thu và phải trả của bảng.
export function settlementDraft(input: { companyId: string; partnerId: string; id: string; documentNo: string; date: string; offset: number }): DraftJournal | null {
  if (input.offset < 1) return null;
  return {
    companyId: input.companyId,
    sourceType: "loyalty_partner_settlement",
    sourceId: input.id,
    journalNo: input.documentNo,
    date: input.date,
    description: `Bù trừ đối soát đối tác liên minh ${input.documentNo}`,
    lines: affiliateLines([
      { role: "loyalty_partner_payable", amount: input.offset, partnerId: input.partnerId },
      { role: "loyalty_partner_receivable", amount: -input.offset, partnerId: input.partnerId },
    ]),
  };
}
