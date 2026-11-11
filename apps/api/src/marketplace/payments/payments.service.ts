// Thanh toán trực tuyến đơn VComm (CONG_VIEC_25; CHUC_NANG_121; QUYTAC_NGHIEPVU_165, 166; API_131, API_132): mở trang cổng, nhận kết quả, tự hủy đơn quá hạn.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { BuyerPaymentStart, PaymentMethodCode } from "contracts";
import { sql } from "drizzle-orm";
import type { ClientInfo } from "../../auth/auth.service";
import { LedgerService } from "../../accounting/ledger.service";
import { marketplacePaymentDraft } from "../../accounting/postings";
import { ApiError } from "../../common/api-error";
import { RateLimiter } from "../../common/rate-limiter";
import { DATABASE, type Database } from "../../database/database.module";
import type { Actor } from "../../permissions/roles.service";
import { SalesOrdersService } from "../../sales/sales-orders.service";
import { MarketplaceOrdersService, refundRemainingPaid } from "../marketplace-orders.service";
import type { GatewayNotification, GatewayRequest, InquiryOutcome, NotificationOutcome } from "./payment-gateway";
import { gatewayAdapter, isOnlineMethod } from "./payment-gateway-registry";

// Mỗi đơn mở trang thanh toán tối đa 10 lần.
const attemptLimit = 10;
const systemClient: ClientInfo = { ip: null, userAgent: "payment-expiry", requestId: null };

// Cổng có mã riêng thì tìm theo mã cổng, không thì theo số tham chiếu chung.
const matchesReference = (reference: string) => sql`(gateway_reference = ${reference} OR (gateway_reference IS NULL AND reference = ${reference}))`;
// Tên gửi cổng: bỏ dấu tiếng Việt, chỉ giữ chữ, số, dấu cách (BIDV không nhận ký tự có dấu, ký tự đặc biệt).
const plainText = (value: string, maximumLength: number) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);

export type ReturnOutcome = { orderId: string | null; state: "succeeded" | "failed" | "pending" | "invalid" };

@Injectable()
export class MarketplacePaymentsService {
  private readonly logger = new Logger("MarketplacePayments");
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly orders: MarketplaceOrdersService,
    private readonly salesOrders: SalesOrdersService,
    private readonly ledger: LedgerService,
    private readonly rateLimiter: RateLimiter,
  ) {}

  // Người mua mở thanh toán (QUYTAC_NGHIEPVU_165): đơn của mình, đang chờ thanh toán, còn hạn; mỗi lần một số tham chiếu mới; cổng theo danh mục phương thức.
  async start(userId: string, client: ClientInfo, orderId: string): Promise<BuyerPaymentStart> {
    return this.database.transaction(async (transaction) => {
      const order = (
        await transaction.execute<{
          status: string;
          payment_method: PaymentMethodCode;
          gateway_code: string;
          payment_deadline: Date | null;
          total: string;
          document_no: string;
          expired: boolean;
        }>(sql`
        SELECT m.status, m.payment_method, pm.gateway_code, m.payment_deadline, (m.goods_amount + m.shipping_fee)::text AS total, so.document_no, m.payment_deadline <= now() AS expired
        FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN marketplace.payment_methods pm ON pm.code = m.payment_method
        WHERE m.id = ${orderId} AND m.buyer_user_id = ${userId} FOR UPDATE OF m`)
      ).rows[0];
      if (!order) throw new ApiError("NOT_FOUND", "notFound");
      if (order.status !== "awaiting_payment" || order.expired || !isOnlineMethod(order.payment_method)) throw new ApiError("BUSINESS_RULE", "orderNotAwaitingPayment");
      const gateway = gatewayAdapter(order.gateway_code);
      if (!gateway?.configured()) throw new ApiError("BUSINESS_RULE", "paymentGatewayNotConfigured");
      const attempts = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM marketplace.payments WHERE order_id = ${orderId}`)).rows[0]!.count;
      if (attempts >= attemptLimit) throw new ApiError("BUSINESS_RULE", "paymentAttemptLimit");
      // Số tham chiếu gửi cổng: số đơn chỉ giữ chữ và số, thêm số thứ tự lần thanh toán.
      const reference = `${order.document_no.replace(/[^A-Za-z0-9]/g, "")}T${String(attempts + 1).padStart(2, "0")}`;
      // Cổng cần mã ngắn hơn (BIDV) tự đặt mã riêng, kết quả gửi về tìm theo mã đó (CONG_VIEC_37).
      const gatewayReference = gateway.gatewayReference?.() ?? null;
      const amount = Math.round(Number(order.total));
      await transaction.execute(sql`
        INSERT INTO marketplace.payments (order_id, gateway_code, method, reference, gateway_reference, amount, created_by)
        VALUES (${orderId}, ${order.gateway_code}, ${order.payment_method}, ${reference}, ${gatewayReference}, ${amount}, ${userId})`);
      const deadline = new Date(order.payment_deadline!);
      const instruction = await gateway.start({
        reference,
        gatewayReference,
        amount,
        method: order.payment_method,
        documentNo: order.document_no,
        ipAddress: client.ip ?? "127.0.0.1",
        createdAt: new Date(),
        expiresAt: deadline,
      });
      return {
        paymentUrl: instruction.kind === "redirect" ? instruction.url : null,
        transfer: instruction.kind === "transfer" ? instruction.transfer : null,
        deadline: deadline.toISOString(),
      };
    });
  }

  // Kết quả cổng gửi về (QUYTAC_NGHIEPVU_166, 220): chỉ nhận khi đúng chữ ký, đúng số tiền; mỗi lần thanh toán ghi nhận một lần.
  async notify(gatewayCode: string, request: GatewayRequest, ip: string): Promise<{ status: number; body: unknown }> {
    const gateway = gatewayAdapter(gatewayCode);
    if (!gateway) throw new ApiError("NOT_FOUND", "notFound");
    if (!gateway.configured()) return gateway.reply("error");
    const result = await gateway.verify(request).catch(() => null);
    if (!result) {
      // Sai chữ ký: đếm theo địa chỉ IP, vượt giới hạn thì từ chối không ghi lại (rà soát CONG_VIEC_25).
      const retryAfterSeconds = await this.rateLimiter.hit(`payment-notify-invalid-${gateway.code}`, ip);
      if (retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds });
      await this.log(gateway.code, null, request, "invalid_signature");
      return gateway.reply("invalid_signature");
    }
    // Lỗi khi ghi nhận (kỳ kế toán đã khóa, cơ sở dữ liệu lỗi): trả lỗi để cổng gửi lại, ghi lại để tra soát.
    const outcome = await this.database
      .transaction(async (transaction): Promise<NotificationOutcome> => {
        const payment = (
          await transaction.execute<{ id: string; order_id: string; amount: string; status: string }>(sql`
          SELECT id, order_id, amount::text, status FROM marketplace.payments WHERE gateway_code = ${gateway.code} AND ${matchesReference(result.reference)} FOR UPDATE`)
        ).rows[0];
        if (!payment) return "not_found";
        if (Math.round(Number(payment.amount)) !== Math.round(result.amount)) return "invalid_amount";
        if (payment.status !== "pending") return "already_confirmed";
        await this.complete(transaction, payment.id, payment.order_id, result, gateway.code);
        return "success";
      })
      .catch((error: unknown): NotificationOutcome => {
        this.logger.error(`Kết quả cổng ${gateway.code} ${result.reference}: ${(error as Error).message}`);
        return "error";
      });
    await this.log(gateway.code, result.reference, request, outcome);
    return gateway.reply(outcome);
  }

  // Cổng vấn tin số tiền cần thu (CONG_VIEC_37; QUYTAC_NGHIEPVU_246): chỉ lần thanh toán đang chờ của đơn đang chờ thanh toán, còn hạn; không ghi nhận tiền.
  async inquire(gatewayCode: string, request: GatewayRequest, ip: string): Promise<{ status: number; body: unknown }> {
    const gateway = gatewayAdapter(gatewayCode);
    if (!gateway?.inquire || !gateway.inquiryReply) throw new ApiError("NOT_FOUND", "notFound");
    if (!gateway.configured()) return gateway.inquiryReply({ outcome: "error", reference: null });
    const verified = await gateway.inquire(request).catch(() => null);
    if (!verified) {
      const retryAfterSeconds = await this.rateLimiter.hit(`payment-notify-invalid-${gateway.code}`, ip);
      if (retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds });
      await this.log(gateway.code, null, request, "inquiry_invalid_signature");
      return gateway.inquiryReply({ outcome: "invalid_signature", reference: null });
    }
    const result = await this.database
      .execute<{ amount: string; status: string; order_status: string; open: boolean; document_no: string; buyer_name: string | null }>(
        sql`
        SELECT p.amount::text, p.status, m.status AS order_status, m.payment_deadline > now() AS open, so.document_no, so.buyer_name
        FROM marketplace.payments p JOIN marketplace.orders m ON m.id = p.order_id JOIN sales.orders so ON so.id = m.sales_order_id
        WHERE p.gateway_code = ${gateway.code} AND ${matchesReference(verified.reference)}`,
      )
      .then(({ rows: [payment] }): InquiryOutcome => {
        if (!payment) return { outcome: "not_found", reference: verified.reference };
        if (payment.status !== "pending" || payment.order_status !== "awaiting_payment" || !payment.open) return { outcome: "no_bill", reference: verified.reference };
        return {
          outcome: "found",
          reference: verified.reference,
          amount: Math.round(Number(payment.amount)),
          documentNo: payment.document_no,
          customerName: plainText(payment.buyer_name ?? "", 100) || "VCOMM",
        };
      })
      .catch((error: unknown): InquiryOutcome => {
        this.logger.error(`Vấn tin cổng ${gateway.code} ${verified.reference}: ${(error as Error).message}`);
        return { outcome: "error", reference: verified.reference };
      });
    await this.log(gateway.code, verified.reference, request, `inquiry_${result.outcome}`);
    return gateway.inquiryReply(result);
  }

  private async complete(transaction: Pick<Database, "execute">, paymentId: string, orderId: string, result: GatewayNotification, gatewayCode: string): Promise<void> {
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
    const note = result.transactionNo ? `${gatewayCode.toUpperCase()} ${result.transactionNo}` : null;
    if (order.status === "awaiting_payment") {
      await this.orders.event(transaction, orderId, "paid", note, null);
      return;
    }
    // Tiền về sau khi đơn đã hủy, hoặc đơn đã thu từ lần thanh toán khác: lập việc chờ hoàn tiền của lần này.
    await transaction.execute(sql`
      INSERT INTO marketplace.refunds (order_id, payment_id, reason, amount)
      VALUES (${orderId}, ${paymentId}, ${order.status === "cancelled" ? "paid_after_cancel" : "duplicate_payment"}, ${result.amount})`);
    await this.orders.event(transaction, orderId, "refund_pending", note, null);
  }

  // Trang cổng chuyển người mua về: chỉ hiển thị, không ghi nhận tiền (QUYTAC_NGHIEPVU_166).
  async returnOutcome(gatewayCode: string, request: GatewayRequest, ip: string): Promise<ReturnOutcome> {
    if ((await this.rateLimiter.hit("payment-return", ip)) !== null) return { orderId: null, state: "invalid" };
    const gateway = gatewayAdapter(gatewayCode);
    const result = gateway?.configured() && gateway.verifyReturn ? await gateway.verifyReturn(request).catch(() => null) : null;
    if (!result) return { orderId: null, state: "invalid" };
    const payment = (
      await this.database.execute<{ order_id: string; status: string }>(sql`
      SELECT order_id, status FROM marketplace.payments WHERE gateway_code = ${gatewayCode} AND ${matchesReference(result.reference)}`)
    ).rows[0];
    if (!payment) return { orderId: null, state: "invalid" };
    if (payment.status === "succeeded") return { orderId: payment.order_id, state: "succeeded" };
    if (payment.status === "failed" || !result.success) return { orderId: payment.order_id, state: "failed" };
    return { orderId: payment.order_id, state: "pending" };
  }

  // Chỉ lưu tham số dạng chuỗi hoặc số của truy vấn và nội dung (tối đa 40 tham số, mỗi giá trị 255 ký tự), không lưu tiêu đề.
  private async log(gatewayCode: string, reference: string | null, request: GatewayRequest, resultCode: string): Promise<void> {
    const flatten = (value: unknown) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value as Record<string, unknown>).filter(([key, item]) => key.length <= 40 && (typeof item === "string" || typeof item === "number"))
        : [];
    const payload = Object.fromEntries([...flatten(request.query), ...flatten(request.body)].slice(0, 40).map(([key, item]) => [key, String(item).slice(0, 255)]));
    await this.database.execute(sql`
      INSERT INTO marketplace.payment_notifications (gateway_code, reference, payload, result_code)
      VALUES (${gatewayCode}, ${reference?.slice(0, 100) ?? null}, ${JSON.stringify(payload)}::jsonb, ${resultCode})`);
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
