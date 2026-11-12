// Bút toán tự sinh của cửa hàng liên kết ở công ty vận hành sàn (CONG_VIEC_55; QUYTAC_NGHIEPVU_404). Đối tác của dòng phải thu, phải trả là cửa hàng.
// Tích: Nợ phải thu cửa hàng / Có nghĩa vụ điểm. Dùng điểm: Nợ nghĩa vụ theo giá trị lúc tích / Có phải trả cửa hàng, chênh lệch vào chi phí điểm.
// Voucher đổi bằng điểm: nhận Nợ nghĩa vụ / Có doanh thu chưa thực hiện; dùng Nợ doanh thu chưa thực hiện / Có phải trả; hết hạn Nợ doanh thu chưa thực hiện / Có chi phí.
// Voucher công ty: Nợ chi phí / Có phải trả. Hủy giao dịch ghi ngược phần trả lại được.
import { sql } from "drizzle-orm";
import type { DraftJournal, DraftLine, PostingRole } from "../accounting/postings";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;
type Side = { role: PostingRole; amount: number; partnerId?: string | null }[];

// amount dương: Nợ; âm: Có. Làm tròn đến đồng.
export function affiliateLines(side: Side): DraftLine[] {
  return side
    .map((item) => ({ ...item, amount: Math.round(item.amount) }))
    .filter((item) => item.amount !== 0)
    .map((item) => ({ role: item.role, partnerId: item.partnerId ?? null, debit: item.amount > 0 ? item.amount : 0, credit: item.amount < 0 ? -item.amount : 0 }));
}

// Giá trị lúc tích của điểm trong các bút toán điểm của một chứng từ, theo loại.
async function pointValues(executor: Executor, sourceType: "affiliate_transaction" | "affiliate_voucher", sourceId: string): Promise<Record<string, number>> {
  const rows = await executor.execute<{ kind: string; value: string }>(sql`
    SELECT e.kind, coalesce(sum(abs(el.points) * el.point_value), 0)::text AS value
    FROM loyalty.entries e JOIN loyalty.entry_lots el ON el.entry_id = e.id
    WHERE e.source_type = ${sourceType} AND e.source_id = ${sourceId} GROUP BY e.kind`);
  return Object.fromEntries(rows.rows.map((row) => [row.kind, Math.round(Number(row.value))]));
}

type TransactionPostingRow = {
  company_id: string;
  partner_id: string;
  document_no: string;
  completed_on: string;
  cancelled_on: string | null;
  earned_amount: string;
  redeemed_amount: string;
  voucher_payable: string;
  voucher_issuer: string | null;
  voucher_returned: boolean;
};

async function transactionRow(executor: Executor, id: string): Promise<TransactionPostingRow | undefined> {
  return (
    await executor.execute<TransactionPostingRow>(sql`
      SELECT m.company_id, m.partner_id, t.document_no, (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS completed_on,
        (t.cancelled_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS cancelled_on, t.earned_amount::text, t.redeemed_amount::text, t.voucher_payable::text,
        v.issuer AS voucher_issuer, coalesce(c.status = 'unused', false) AS voucher_returned
      FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id
      LEFT JOIN affiliate.voucher_codes c ON c.id = t.voucher_code_id
      LEFT JOIN affiliate.vouchers v ON v.id = c.voucher_id
      WHERE t.id = ${id}`)
  ).rows[0];
}

// Giao dịch hoàn tất.
export async function transactionDraft(executor: Executor, id: string): Promise<DraftJournal | null> {
  const row = await transactionRow(executor, id);
  if (!row) return null;
  const values = await pointValues(executor, "affiliate_transaction", id);
  const partnerId = row.partner_id;
  const earned = Number(row.earned_amount);
  const redeemed = Number(row.redeemed_amount);
  const payable = Number(row.voucher_payable);
  const redeemValue = values.redeem ?? 0;
  const side: Side = [
    { role: "affiliate_receivable", amount: earned, partnerId },
    { role: "loyalty_liability", amount: -(values.earn ?? earned) + redeemValue },
    { role: "loyalty_expense", amount: redeemed - redeemValue + (values.earn ?? earned) - earned },
    { role: "affiliate_payable", amount: -(redeemed + payable), partnerId },
  ];
  if (payable > 0) side.push({ role: row.voucher_issuer === "merchant_points" ? "affiliate_voucher_deferred" : "loyalty_expense", amount: payable });
  return {
    companyId: row.company_id,
    sourceType: "affiliate_transaction",
    sourceId: id,
    journalNo: row.document_no,
    date: row.completed_on,
    description: `Giao dịch cửa hàng liên kết ${row.document_no}`,
    lines: affiliateLines(side),
  };
}

// Hủy giao dịch: hoàn điểm đã dùng (theo giá trị lúc tích của lô), trừ lại điểm đã tích (phần thiếu cửa hàng vẫn trả), trả voucher.
// Voucher đổi bằng điểm trả lại cho khách: về doanh thu chưa thực hiện; không trả lại được (hết hạn) hoặc voucher công ty: giảm chi phí.
export async function transactionCancelDraft(executor: Executor, id: string): Promise<DraftJournal | null> {
  const row = await transactionRow(executor, id);
  if (!row?.cancelled_on) return null;
  const values = await pointValues(executor, "affiliate_transaction", id);
  const partnerId = row.partner_id;
  const redeemed = Number(row.redeemed_amount);
  const payable = Number(row.voucher_payable);
  const refundValue = values.redeem_refund ?? 0;
  const reversedValue = values.earn_reversal ?? 0;
  const side: Side = [
    { role: "affiliate_payable", amount: redeemed + payable, partnerId },
    { role: "loyalty_liability", amount: -refundValue + reversedValue },
    { role: "loyalty_expense", amount: refundValue - redeemed },
    { role: "affiliate_receivable", amount: -reversedValue, partnerId },
  ];
  if (payable > 0) side.push({ role: row.voucher_issuer === "merchant_points" && row.voucher_returned ? "affiliate_voucher_deferred" : "loyalty_expense", amount: -payable });
  return {
    companyId: row.company_id,
    sourceType: "affiliate_transaction_cancel",
    sourceId: id,
    journalNo: `${row.document_no}-H`,
    date: row.cancelled_on,
    description: `Hủy giao dịch cửa hàng liên kết ${row.document_no}`,
    lines: affiliateLines(side),
  };
}

type CodePostingRow = { company_id: string; code: string; points_paid: number; amount: string; claimed_on: string; today: string };

async function codeRow(executor: Executor, codeId: string): Promise<CodePostingRow | undefined> {
  return (
    await executor.execute<CodePostingRow>(sql`
      SELECT v.company_id, v.code, c.points_paid, round(c.points_paid * coalesce(c.point_value, 0))::text AS amount,
        (c.claimed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS claimed_on, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today
      FROM affiliate.voucher_codes c JOIN affiliate.vouchers v ON v.id = c.voucher_id WHERE c.id = ${codeId}`)
  ).rows[0];
}

// Khách đổi điểm lấy voucher của cửa hàng.
export async function voucherClaimDraft(executor: Executor, codeId: string): Promise<DraftJournal | null> {
  const row = await codeRow(executor, codeId);
  if (!row || row.points_paid === 0) return null;
  const value = (await pointValues(executor, "affiliate_voucher", codeId)).redeem ?? 0;
  const amount = Number(row.amount);
  return {
    companyId: row.company_id,
    sourceType: "affiliate_voucher",
    sourceId: codeId,
    journalNo: `${row.code}-${codeId.slice(0, 8).toUpperCase()}`,
    date: row.claimed_on,
    description: `Đổi điểm lấy voucher ${row.code}`,
    lines: affiliateLines([
      { role: "loyalty_liability", amount: value },
      { role: "loyalty_expense", amount: amount - value },
      { role: "affiliate_voucher_deferred", amount: -amount },
    ]),
  };
}

// Voucher đổi bằng điểm hết hạn chưa dùng: không hoàn điểm, doanh thu chưa thực hiện chuyển giảm chi phí (đặc tả mục 18).
export async function voucherExpireDraft(executor: Executor, codeId: string): Promise<DraftJournal | null> {
  const row = await codeRow(executor, codeId);
  if (!row || row.points_paid === 0) return null;
  const amount = Number(row.amount);
  return {
    companyId: row.company_id,
    sourceType: "affiliate_voucher_expire",
    sourceId: codeId,
    journalNo: `${row.code}-${codeId.slice(0, 8).toUpperCase()}-HH`,
    date: row.today,
    description: `Voucher ${row.code} hết hạn chưa dùng`,
    lines: affiliateLines([
      { role: "affiliate_voucher_deferred", amount },
      { role: "loyalty_expense", amount: -amount },
    ]),
  };
}
