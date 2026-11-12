// Phiếu thu, phiếu chi nợ nội bộ điểm gắn bảng đối soát điểm nội bộ (CONG_VIEC_60; QUYTAC_NGHIEPVU_473).
// Tách riêng để dịch vụ phiếu thu chi gọi khi ghi sổ mà không nhập vòng với dịch vụ bảng đối soát.
import type { LoyaltySettlementPaymentKind } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

export const isLoyaltySettlementPaymentKind = (kind: string): kind is LoyaltySettlementPaymentKind => kind === "loyalty_intercompany_receipt" || kind === "loyalty_intercompany_payment";

export interface SettlementPaymentState {
  status: string;
  operatorCompanyId: string;
  companyId: string;
  // Bên trả (số thuần dương: công ty con) và bên nhận; số phải thanh toán.
  payerCompanyId: string;
  payeeCompanyId: string;
  outstanding: number;
  paid: number;
  received: number;
}

// Trạng thái thanh toán của bảng (khóa dòng bảng khi `lock`); `excludePaymentId` bỏ phiếu đang kiểm khỏi số đã ghi.
export async function settlementPaymentState(executor: Executor, settlementId: string, lock = false, excludePaymentId: string | null = null): Promise<SettlementPaymentState | null> {
  if (lock) await executor.execute(sql`SELECT 1 FROM loyalty.settlements WHERE id = ${settlementId} FOR UPDATE`);
  const row = (
    await executor.execute<{ status: string; operator_company_id: string; company_id: string; net_closing: string; paid: string; received: string }>(sql`
    SELECT s.status, s.operator_company_id, s.company_id, s.net_closing::text,
      coalesce((SELECT sum(p.amount) FROM finance.payments p WHERE p.loyalty_settlement_id = s.id AND p.kind = 'loyalty_intercompany_payment' AND p.status = 'posted'
        AND p.id IS DISTINCT FROM ${excludePaymentId}::uuid), 0)::text AS paid,
      coalesce((SELECT sum(p.amount) FROM finance.payments p WHERE p.loyalty_settlement_id = s.id AND p.kind = 'loyalty_intercompany_receipt' AND p.status = 'posted'
        AND p.id IS DISTINCT FROM ${excludePaymentId}::uuid), 0)::text AS received
    FROM loyalty.settlements s WHERE s.id = ${settlementId}`)
  ).rows[0];
  if (!row) return null;
  const net = Number(row.net_closing);
  return {
    status: row.status,
    operatorCompanyId: row.operator_company_id,
    companyId: row.company_id,
    payerCompanyId: net > 0 ? row.company_id : row.operator_company_id,
    payeeCompanyId: net > 0 ? row.operator_company_id : row.company_id,
    outstanding: Math.abs(net),
    paid: Number(row.paid),
    received: Number(row.received),
  };
}

// Kiểm khi lập và khi ghi sổ: bảng Đã xác nhận hoặc Đã thanh toán một phần; bên trả lập phiếu chi, bên nhận lập phiếu thu; không vượt số còn lại của bên đó.
export async function assertSettlementPayment(
  executor: Executor,
  input: { settlementId: string; companyId: string; kind: LoyaltySettlementPaymentKind; amount: number; paymentId: string | null; lock: boolean },
): Promise<SettlementPaymentState> {
  const state = await settlementPaymentState(executor, input.settlementId, input.lock, input.paymentId);
  if (!state) throw new ApiError("NOT_FOUND", "notFound");
  if (!["confirmed", "partially_paid"].includes(state.status)) throw new ApiError("BUSINESS_RULE", "loyaltySettlementNotPayable");
  const expected = input.companyId === state.payerCompanyId ? "loyalty_intercompany_payment" : input.companyId === state.payeeCompanyId ? "loyalty_intercompany_receipt" : null;
  if (expected !== input.kind) throw new ApiError("BUSINESS_RULE", "loyaltySettlementNotPayable");
  const done = input.kind === "loyalty_intercompany_payment" ? state.paid : state.received;
  if (input.amount > state.outstanding - done + 0.00005) throw new ApiError("BUSINESS_RULE", "loyaltySettlementPaymentExceeded");
  return state;
}

// Sau khi phiếu ghi sổ: cập nhật số đã trả, đã nhận; hai bên ghi đủ thì Đã tất toán, một phần thì Đã thanh toán một phần.
export async function refreshSettlementPaid(executor: Executor, paymentId: string): Promise<void> {
  const payment = (await executor.execute<{ loyalty_settlement_id: string | null }>(sql`SELECT loyalty_settlement_id FROM finance.payments WHERE id = ${paymentId}`)).rows[0];
  if (!payment?.loyalty_settlement_id) return;
  const state = (await settlementPaymentState(executor, payment.loyalty_settlement_id, true))!;
  const settled = state.paid >= state.outstanding - 0.00005 && state.received >= state.outstanding - 0.00005;
  const status = settled ? "settled" : state.paid > 0 || state.received > 0 ? "partially_paid" : state.status;
  await executor.execute(sql`
    UPDATE loyalty.settlements SET paid_amount = ${state.paid}, received_amount = ${state.received},
      status = CASE WHEN status IN ('confirmed', 'partially_paid') THEN ${status} ELSE status END, updated_at = now(), version = version + 1
    WHERE id = ${payment.loyalty_settlement_id}`);
  await executor.execute(sql`
    INSERT INTO loyalty.settlement_events (settlement_id, kind, company_id, note)
    SELECT ${payment.loyalty_settlement_id}, 'paid', p.company_id, p.document_no || ' · ' || p.amount::text FROM finance.payments p WHERE p.id = ${paymentId}`);
}
