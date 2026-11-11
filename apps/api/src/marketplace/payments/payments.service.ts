// Thanh toán trực tuyến đơn VComm (CONG_VIEC_25; CHUC_NANG_121; QUYTAC_NGHIEPVU_165, 166; API_131, API_132): mở trang cổng, nhận kết quả, tự hủy đơn quá hạn.
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerPaymentStart, PaymentMethodCode } from "contracts";
import { sql } from "drizzle-orm";
import type { ClientInfo } from "../../auth/auth.service";
import { LedgerService } from "../../accounting/ledger.service";
import { marketplacePaymentDraft } from "../../accounting/postings";
import { ApiError } from "../../common/api-error";
import { DATABASE, type Database } from "../../database/database.module";
import type { Actor } from "../../permissions/roles.service";
import { SalesOrdersService } from "../../sales/sales-orders.service";
import { MarketplaceOrdersService, refundRemainingPaid } from "../marketplace-orders.service";
import { gatewayOf, isOnlineMethod, vnpayConfiguration } from "./payment-gateway-registry";
import { paymentUrl, verifiedResult, type VnpayResult } from "./vnpay";

// Mỗi đơn mở trang thanh toán tối đa 10 lần.
const attemptLimit = 10;
const systemClient: ClientInfo = { ip: null, userAgent: "payment-expiry", requestId: null };

export type IpnReply = { RspCode: string; Message: string };
export type ReturnOutcome = { orderId: string | null; state: "succeeded" | "failed" | "pending" | "invalid" };

@Injectable()
export class MarketplacePaymentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly orders: MarketplaceOrdersService,
    private readonly salesOrders: SalesOrdersService,
    private readonly ledger: LedgerService,
  ) {}

  // Người mua mở trang thanh toán (QUYTAC_NGHIEPVU_165): đơn của mình, đang chờ thanh toán, còn hạn; mỗi lần một số tham chiếu mới.
  async start(userId: string, client: ClientInfo, orderId: string): Promise<BuyerPaymentStart> {
    const configuration = vnpayConfiguration();
    if (!configuration) throw new ApiError("BUSINESS_RULE", "paymentGatewayNotConfigured");
    return this.database.transaction(async (transaction) => {
      const order = (
        await transaction.execute<{ status: string; payment_method: PaymentMethodCode; payment_deadline: Date | null; total: string; document_no: string; expired: boolean }>(sql`
        SELECT m.status, m.payment_method, m.payment_deadline, (m.goods_amount + m.shipping_fee)::text AS total, so.document_no, m.payment_deadline <= now() AS expired
        FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = ${orderId} AND m.buyer_user_id = ${userId} FOR UPDATE OF m`)
      ).rows[0];
      if (!order) throw new ApiError("NOT_FOUND", "notFound");
      if (order.status !== "awaiting_payment" || order.expired || !isOnlineMethod(order.payment_method)) throw new ApiError("BUSINESS_RULE", "orderNotAwaitingPayment");
      const attempts = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = ${orderId}`)).rows[0]!.count;
      if (attempts >= attemptLimit) throw new ApiError("BUSINESS_RULE", "paymentAttemptLimit");
      // Số tham chiếu gửi cổng: số đơn chỉ giữ chữ và số, thêm số thứ tự lần thanh toán.
      const reference = `${order.document_no.replace(/[^A-Za-z0-9]/g, "")}T${String(attempts + 1).padStart(2, "0")}`;
      const amount = Math.round(Number(order.total));
      await transaction.execute(sql`
        INSERT INTO marketplace.payments (order_id, gateway_code, method, reference, amount, created_by)
        VALUES (${orderId}, ${gatewayOf(order.payment_method)}, ${order.payment_method}, ${reference}, ${amount}, ${userId})`);
      const deadline = new Date(order.payment_deadline!);
      return {
        paymentUrl: paymentUrl(configuration, {
          reference,
          amount,
          method: order.payment_method,
          orderInfo: `Thanh toan don ${order.document_no}`,
          ipAddress: client.ip ?? "127.0.0.1",
          createdAt: new Date(),
          expiresAt: deadline,
        }),
        deadline: deadline.toISOString(),
      };
    });
  }

  // IPN của VNPAY (QUYTAC_NGHIEPVU_166): chỉ nhận khi đúng chữ ký, đúng số tiền; mỗi lần thanh toán ghi nhận một lần.
  async vnpayIpn(query: Record<string, unknown>): Promise<IpnReply> {
    const configuration = vnpayConfiguration();
    if (!configuration) return { RspCode: "99", Message: "Unknown error" };
    const result = verifiedResult(configuration, query);
    if (!result) {
      await this.log(typeof query.vnp_TxnRef === "string" ? query.vnp_TxnRef : null, query, "97");
      return { RspCode: "97", Message: "Invalid signature" };
    }
    const reply = await this.database.transaction(async (transaction) => {
      const payment = (
        await transaction.execute<{ id: string; order_id: string; amount: string; status: string }>(sql`
        SELECT id, order_id, amount::text, status FROM marketplace.payments WHERE reference = ${result.reference} FOR UPDATE`)
      ).rows[0];
      if (!payment) return { RspCode: "01", Message: "Order not found" };
      if (Math.round(Number(payment.amount)) !== Math.round(result.amount)) return { RspCode: "04", Message: "Invalid amount" };
      if (payment.status !== "pending") return { RspCode: "02", Message: "Order already confirmed" };
      await this.complete(transaction, payment.id, payment.order_id, result);
      return { RspCode: "00", Message: "Confirm Success" };
    });
    await this.log(result.reference, query, reply.RspCode);
    return reply;
  }

  private async complete(transaction: Pick<Database, "execute">, paymentId: string, orderId: string, result: VnpayResult): Promise<void> {
    await transaction.execute(sql`
      UPDATE marketplace.payments SET status = ${result.success ? "succeeded" : "failed"}, response_code = ${result.responseCode}, gateway_transaction_no = ${result.transactionNo},
        bank_code = ${result.bankCode}, completed_at = now() WHERE id = ${paymentId}`);
    if (!result.success) return;
    // Bút toán tiền thu (QUYTAC_NGHIEPVU_169); công ty chưa khởi tạo kế toán thì lập khi khởi tạo.
    await this.ledger.record(transaction, await marketplacePaymentDraft(transaction, paymentId));
    const order = (await transaction.execute<{ status: string; buyer_user_id: string }>(sql`SELECT status, buyer_user_id FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)).rows[0]!;
    await transaction.execute(sql`
      UPDATE marketplace.orders SET paid_amount = paid_amount + ${result.amount}, paid_at = coalesce(paid_at, now()), version = version + 1,
        status = CASE WHEN status = 'awaiting_payment' THEN 'awaiting_shipment' ELSE status END
      WHERE id = ${orderId}`);
    if (order.status === "awaiting_payment") {
      await this.orders.event(transaction, orderId, "paid", result.transactionNo ? `VNPAY ${result.transactionNo}` : null, null);
      return;
    }
    // Tiền về sau khi đơn đã hủy, hoặc đơn đã thu từ lần thanh toán khác: lập việc chờ hoàn tiền của lần này.
    await transaction.execute(sql`
      INSERT INTO marketplace.refunds (order_id, payment_id, reason, amount)
      VALUES (${orderId}, ${paymentId}, ${order.status === "cancelled" ? "paid_after_cancel" : "duplicate_payment"}, ${result.amount})`);
    await this.orders.event(transaction, orderId, "refund_pending", result.transactionNo ? `VNPAY ${result.transactionNo}` : null, null);
  }

  // Trang VNPAY chuyển người mua về: chỉ hiển thị, không ghi nhận tiền (QUYTAC_NGHIEPVU_166).
  async vnpayReturn(query: Record<string, unknown>): Promise<ReturnOutcome> {
    const configuration = vnpayConfiguration();
    const result = configuration ? verifiedResult(configuration, query) : null;
    if (!result) return { orderId: null, state: "invalid" };
    const payment = (await this.database.execute<{ order_id: string; status: string }>(sql`SELECT order_id, status FROM marketplace.payments WHERE reference = ${result.reference}`)).rows[0];
    if (!payment) return { orderId: null, state: "invalid" };
    if (payment.status === "succeeded") return { orderId: payment.order_id, state: "succeeded" };
    if (payment.status === "failed" || !result.success) return { orderId: payment.order_id, state: "failed" };
    return { orderId: payment.order_id, state: "pending" };
  }

  private async log(reference: string | null, payload: Record<string, unknown>, resultCode: string): Promise<void> {
    await this.database.execute(sql`
      INSERT INTO marketplace.payment_notifications (gateway_code, reference, payload, result_code) VALUES ('vnpay', ${reference}, ${JSON.stringify(payload)}::jsonb, ${resultCode})`);
  }

  // Việc nền mỗi phút (QUYTAC_NGHIEPVU_165): đơn quá hạn chưa thu tiền thì hủy, nhả hàng.
  async expireDue(): Promise<number> {
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM marketplace.orders WHERE status = 'awaiting_payment' AND payment_deadline <= now() ORDER BY payment_deadline LIMIT 500`);
    let expired = 0;
    for (const order of due.rows) {
      await this.database.transaction(async (transaction) => {
        const locked = (
          await transaction.execute<{ sales_order_id: string; company_id: string; buyer_user_id: string }>(sql`
          SELECT sales_order_id, company_id, buyer_user_id FROM marketplace.orders WHERE id = ${order.id} AND status = 'awaiting_payment' AND payment_deadline <= now() FOR UPDATE`)
        ).rows[0];
        if (!locked) return;
        const system: Actor = { userId: locked.buyer_user_id, companyId: locked.company_id, client: systemClient };
        await this.salesOrders.cancelMarketplaceWithin(transaction, system, locked.sales_order_id);
        await transaction.execute(sql`
          UPDATE marketplace.orders SET status = 'cancelled', cancel_reason = 'Quá hạn thanh toán', cancelled_by_kind = 'system', version = version + 1 WHERE id = ${order.id}`);
        await this.orders.event(transaction, order.id, "cancelled", "Quá hạn thanh toán", null);
        // Phòng trường hợp đã ghi nhận tiền mà đơn chưa chuyển trạng thái.
        await refundRemainingPaid(transaction, order.id, "paid_after_cancel");
        expired += 1;
      });
    }
    return expired;
  }
}
