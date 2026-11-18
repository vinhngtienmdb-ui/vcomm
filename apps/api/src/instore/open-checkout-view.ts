// Kết quả đơn chờ trả cho phần mềm cửa hàng (CONG_VIEC_73 lát L7; QUYTAC_NGHIEPVU_590): Open API và nội dung webhook dùng chung.
import type { InstoreCheckoutLine, OpenInstoreCheckout } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import type { Database } from "../database/database.module";
import type { CheckoutRow } from "./checkouts.service";

type Executor = Pick<Database, "execute">;

const money = (value: string | number | null | undefined) => trimDecimal(String(Number(value ?? 0)));
const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

export async function openCheckoutView(executor: Executor, row: CheckoutRow, qrUrl: string | null = null): Promise<OpenInstoreCheckout> {
  const extra = (
    await executor.execute<{
      created_at: Date;
      completed_at: Date | null;
      transaction_no: string | null;
      fee_tax_rate: string;
      refund_status: "pending" | "completed" | null;
      refund_amount: string | null;
      refunded_on: string | null;
      invoice_status: string | null;
      invoice_series: string | null;
      invoice_no: string | null;
      invoice_date: string | null;
    }>(sql`
      SELECT c.created_at, c.completed_at, t.document_no AS transaction_no,
        coalesce((SELECT p.fee_tax_rate FROM instore.payouts p WHERE p.id = c.payout_id), (SELECT s.fee_tax_rate FROM instore.settings s WHERE s.company_id = c.operator_company_id), 10)::text
          AS fee_tax_rate,
        r.status AS refund_status, r.amount::text AS refund_amount, r.refunded_on::text AS refunded_on,
        e.status AS invoice_status, e.series AS invoice_series, e.invoice_no, e.invoice_date::text AS invoice_date
      FROM instore.checkouts c LEFT JOIN affiliate.transactions t ON t.id = c.affiliate_transaction_id
      LEFT JOIN LATERAL (SELECT status, amount, refunded_on FROM marketplace.refunds WHERE checkout_id = c.id ORDER BY created_at DESC LIMIT 1) r ON true
      LEFT JOIN finance.einvoices e ON e.affiliate_transaction_id = c.affiliate_transaction_id AND e.kind = 'original'
      WHERE c.id = ${row.id}`)
  ).rows[0]!;
  const expired = (row.status === "awaiting_buyer" || row.status === "awaiting_payment") && new Date(row.expires_at).getTime() <= Date.now();
  const collected = (row.status === "completed" || row.status === "refunded") && row.collect_in_app ? Number(row.paid_amount) : 0;
  const fee = collected > 0 ? Number(row.platform_fee) : 0;
  return {
    checkoutNo: row.document_no,
    partnerCheckoutCode: row.partner_checkout_code,
    status: expired ? "expired" : row.status,
    outletId: row.outlet_id!,
    billAmount: money(row.bill_amount),
    lines: row.lines as InstoreCheckoutLine[],
    collectInApp: row.collect_in_app,
    qrUrl,
    expiresAt: iso(row.expires_at)!,
    createdAt: iso(extra.created_at)!,
    completedAt: iso(extra.completed_at),
    transactionNo: extra.transaction_no,
    points: row.points,
    pointsAmount: money(row.points_amount),
    voucherAmount: money(row.voucher_amount),
    collectedAmount: money(collected),
    platformFee: money(fee),
    platformFeeTax: money(Math.round((fee * Number(extra.fee_tax_rate)) / 100)),
    gatewayFee: money(collected > 0 ? row.gateway_fee : 0),
    cancelReason: row.cancel_reason,
    refund: extra.refund_status
      ? { status: extra.refund_status, amount: money(extra.refund_amount), refundedOn: extra.refunded_on }
      : { status: "none", amount: null, refundedOn: null },
    einvoice: extra.invoice_status
      ? { status: extra.invoice_status, series: extra.invoice_series, invoiceNo: extra.invoice_no, invoiceDate: extra.invoice_date! }
      : null,
  };
}
