// Trả trước, trả sau của đối tác liên minh (CONG_VIEC_65; QUYTAC_NGHIEPVU_546): áp cho đổi vào và tặng điểm (phát sinh phải thu); đổi ra làm giảm dư nợ.
// Số dư trả trước tính từ phiếu thu của đối tác chưa cấn trừ (công nợ phải thu chiều giảm còn mở, CONG_VIEC_13), không có bảng ký quỹ riêng.
import type { PartnerExposure, PartnerPaymentMode } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../../common/api-error";
import { notify } from "../../common/notifications";
import type { Database } from "../../database/database.module";
import { usersWithPermission } from "../../hr/attendance-access";

type Executor = Pick<Database, "execute">;
export type ExposureContract = { id: string; company_id: string; partner_id: string; payment_mode: PartnerPaymentMode; credit_limit: string | null; code: string };

// Giao dịch đổi vào đang giữ chỗ (chờ OTP còn hạn, đang gửi, chờ đối tác, cần xử lý) tính như đã phát sinh để hai yêu cầu cùng lúc không vượt.
const reservingInbound = sql`(x.status IN ('sending', 'pending_partner', 'needs_review', 'completed') OR (x.status = 'otp_pending' AND x.otp_expires_at > now()))`;

export async function exposureOf(executor: Executor, contract: ExposureContract, today: string): Promise<PartnerExposure & { numbers: { available: number; outstanding: number } }> {
  const row = (
    await executor.execute<{ deposits: string; open_receivable: string; overdue: boolean; gifts: string; inbound: string; outbound: string }>(sql`
      SELECT
        (SELECT coalesce(sum(open_amount), 0) FROM finance.debt_items
          WHERE company_id = ${contract.company_id} AND partner_id = ${contract.partner_id} AND side = 'receivable' AND direction = 'credit' AND open_amount > 0)::text AS deposits,
        (SELECT coalesce(sum(open_amount), 0) FROM finance.debt_items
          WHERE company_id = ${contract.company_id} AND partner_id = ${contract.partner_id} AND side = 'receivable' AND direction = 'debit' AND source_type = 'loyalty_partner_settlement'
            AND open_amount > 0)::text AS open_receivable,
        EXISTS (SELECT 1 FROM finance.debt_items
          WHERE company_id = ${contract.company_id} AND partner_id = ${contract.partner_id} AND side = 'receivable' AND direction = 'debit' AND source_type = 'loyalty_partner_settlement'
            AND open_amount > 0 AND due_date < ${today}::date) AS overdue,
        (SELECT coalesce(sum(amount + tax_amount), 0) FROM loyalty.partner_gifts WHERE contract_id = ${contract.id} AND status = 'completed' AND settlement_id IS NULL)::text AS gifts,
        (SELECT coalesce(sum(x.amount + x.tax_amount), 0) FROM loyalty.partner_exchanges x
          WHERE x.contract_id = ${contract.id} AND x.direction = 'inbound' AND ${reservingInbound} AND x.settlement_id IS NULL)::text AS inbound,
        (SELECT coalesce(sum(x.amount), 0) FROM loyalty.partner_exchanges x
          WHERE x.contract_id = ${contract.id} AND x.direction = 'outbound' AND x.status = 'completed' AND x.settlement_id IS NULL)::text AS outbound`)
  ).rows[0]!;
  const deposits = Number(row.deposits);
  const openReceivable = Number(row.open_receivable);
  const unsettled = Number(row.gifts) + Number(row.inbound) - Number(row.outbound);
  const limit = contract.credit_limit === null ? null : Number(contract.credit_limit);
  const outstanding = Math.max(openReceivable + unsettled, 0);
  const available = contract.payment_mode === "prepaid" ? deposits - openReceivable - unsettled : (limit ?? 0) - outstanding;
  const text = (value: number) => String(Math.round(value * 10000) / 10000);
  return {
    paymentMode: contract.payment_mode,
    deposits: text(deposits),
    openReceivable: text(openReceivable),
    unsettled: text(unsettled),
    available: text(available),
    outstanding: contract.payment_mode === "postpaid" ? text(outstanding) : null,
    creditLimit: contract.credit_limit === null ? null : text(Number(contract.credit_limit)),
    overdue: row.overdue,
    numbers: { available, outstanding },
  };
}

// Chặn giao dịch phát sinh phải thu vượt số dư trả trước, hạn mức, hoặc khi có bảng đối soát quá hạn (trả sau). Bên gọi khóa theo hợp đồng trước.
export async function assertCapacity(executor: Executor, contract: ExposureContract, today: string, amount: number): Promise<void> {
  const exposure = await exposureOf(executor, contract, today);
  if (contract.payment_mode === "prepaid") {
    if (amount > exposure.numbers.available + 0.00005) throw new ApiError("BUSINESS_RULE", "partnerPrepaidInsufficient");
  } else if (exposure.overdue || exposure.numbers.outstanding + amount > Number(contract.credit_limit) + 0.00005) {
    throw new ApiError("BUSINESS_RULE", "partnerCreditExceeded");
  }
}

export async function lockCapacity(executor: Executor, contractId: string): Promise<void> {
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`partner-capacity:${contractId}`}))`);
}

// Cảnh báo một lần mỗi ngày cho người có quyền quản lý: số dư trả trước dưới 20 % lần nộp gần nhất, hoặc dư nợ từ 80 % hạn mức.
export async function alertExposure(executor: Executor, contract: ExposureContract, today: string): Promise<void> {
  const exposure = await exposureOf(executor, contract, today);
  let title: string | null = null;
  if (contract.payment_mode === "prepaid") {
    const lastDeposit = (
      await executor.execute<{ amount: string }>(sql`
        SELECT amount::text FROM finance.debt_items WHERE company_id = ${contract.company_id} AND partner_id = ${contract.partner_id} AND side = 'receivable' AND direction = 'credit'
        ORDER BY created_at DESC LIMIT 1`)
    ).rows[0];
    if (lastDeposit && exposure.numbers.available < Number(lastDeposit.amount) * 0.2) title = `Số dư trả trước của đối tác liên minh ${contract.code} dưới 20 % lần nộp gần nhất`;
  } else if (contract.credit_limit !== null && exposure.numbers.outstanding >= Number(contract.credit_limit) * 0.8) {
    title = `Dư nợ của đối tác liên minh ${contract.code} từ 80 % hạn mức`;
  }
  if (!title) return;
  const claimed = await executor.execute(sql`
    UPDATE loyalty.partner_contracts SET exposure_alerted_on = ${today}::date WHERE id = ${contract.id} AND exposure_alerted_on IS DISTINCT FROM ${today}::date RETURNING id`);
  if (claimed.rows.length === 0) return;
  const recipients = await usersWithPermission(executor, contract.company_id, "loyalty.partner.manage", today);
  await notify(
    executor,
    recipients.map((userId) => ({
      userId,
      companyId: contract.company_id,
      kind: "loyalty.partner_exposure",
      title,
      link: `/crm/loyalty/partners/${contract.id}`,
      payload: { contractId: contract.id },
    })),
  );
}
