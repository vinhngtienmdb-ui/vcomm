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
      : affiliateLines([
          { role: "loyalty_partner_receivable", amount: amount + tax, partnerId },
          { role: "loyalty_liability", amount: -value },
          ...(amount > value
            ? [
                { role: "loyalty_partner_revenue" as const, amount: -(amount - value) },
                { role: "loyalty_partner_tax" as const, amount: -tax },
              ]
            : [{ role: "loyalty_expense" as const, amount: value - amount }]),
        ]);
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
