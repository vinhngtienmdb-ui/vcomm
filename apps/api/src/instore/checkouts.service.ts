// Đơn chờ thanh toán tại cửa hàng (CONG_VIEC_73; QUYTAC_NGHIEPVU_575 đến 577; API_327).
// Dùng chung cho quầy cửa hàng tập đoàn, cổng cửa hàng liên kết, Open API và iPOS (CONG_VIEC_74 gọi thẳng service này trong backend):
// controller của từng nơi kiểm quyền rồi gọi service; quy tắc nghiệp vụ, khóa yêu cầu, hạn đơn nằm ở đây.
// Lát L1: tạo, gắn khách bằng mã động (luồng 1) hoặc mã QR (luồng 2), khách xem, từ chối, hủy, hết hạn.
// Lát L2: khách chọn điểm, phương thức rồi thanh toán qua cổng; cổng báo thành công thì ghi chứng từ qua phần xử lý của từng loại cửa hàng
// (quầy tập đoàn: hóa đơn bán lẻ); ghi không được thì "Đã thu, lỗi ghi sổ". Voucher, cửa hàng liên kết làm ở lát L4.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  BuyerInstoreCheckout,
  InstoreCheckoutKind,
  InstoreCheckoutLine,
  InstoreCheckoutLoyalty,
  InstoreCheckoutSource,
  InstoreCheckoutStatus,
  PayInstoreCheckoutResponse,
  payInstoreCheckoutSchema,
  PaymentMethodCode,
} from "contracts";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { AuthenticationSettingsService } from "../auth/authentication-settings.service";
import type { ClientInfo } from "../auth/auth.service";
import { SmartOtpService } from "../auth/smart-otp.service";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import type { GatewayNotification } from "../marketplace/payments/payment-gateway";
import { gatewayAdapter, gatewayConfigured, isOnlineMethod } from "../marketplace/payments/payment-gateway-registry";
import { claimFailureLimit, PayCodeService, type PayCodeScanner } from "./pay-code.service";

type Executor = Pick<Database, "execute">;
export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type PayInput = z.output<typeof payInstoreCheckoutSchema>;

// Mỗi đơn chờ mở thanh toán qua cổng tối đa 10 lần (như đơn VComm).
const paymentAttemptLimit = 10;

// Phần xử lý riêng của từng loại cửa hàng (quầy tập đoàn: lát L2; cửa hàng liên kết: lát L4), đăng ký khi khởi động.
export interface CheckoutKindHandler {
  // Giới hạn điểm khách dùng được cho đơn (QUYTAC_NGHIEPVU_578).
  loyalty(executor: Executor, row: CheckoutRow, userId: string): Promise<InstoreCheckoutLoyalty | null>;
  // Trừ điểm khi khách bấm thanh toán; trả số điểm, tiền điểm và mã chứng từ dành trước.
  redeem(transaction: DatabaseTransaction, row: CheckoutRow, userId: string, points: number): Promise<{ points: number; amount: number; reservedSaleId: string }>;
  // Đơn đóng khi chưa hoàn tất: hoàn điểm đã trừ, nhả hàng đang giữ.
  release(transaction: DatabaseTransaction, row: CheckoutRow): Promise<void>;
  // Ghi chứng từ khi đã thu đủ (appAmount: phần thu qua cổng); trả mã chứng từ.
  complete(transaction: DatabaseTransaction, row: CheckoutRow, appAmount: number): Promise<string>;
}

// Đơn chờ hết hạn sau 10 phút kể từ khi tạo (QUYTAC_NGHIEPVU_575).
export const checkoutLifetimeMinutes = 10;
const openStatuses = ["awaiting_buyer", "awaiting_payment"] as const;

export const qrTokenHash = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

// Nơi bán và người tạo của đơn; kiểm quyền do nơi gọi làm trước.
export type CheckoutPlace =
  | { kind: "retail"; companyId: string; storeId: string; registerId: string; shiftId: string }
  | { kind: "affiliate"; merchantId: string; outletId: string };
export type CheckoutCreator = { source: Exclude<InstoreCheckoutSource, "open_api">; userId: string } | { source: "open_api"; apiKeyId: string };

export interface CreateCheckoutInput {
  operatorCompanyId: string;
  place: CheckoutPlace;
  creator: CheckoutCreator;
  idempotencyKey: string;
  billAmount: string;
  lines: InstoreCheckoutLine[];
  collectInApp: boolean;
  partnerCheckoutCode?: string | null;
  // Dữ liệu ghi chứng từ khi thu tiền xong (quầy tập đoàn: giỏ, người mua lấy hóa đơn).
  saleInput?: unknown;
}

export type CheckoutRow = {
  id: string;
  document_no: string;
  kind: InstoreCheckoutKind;
  source: InstoreCheckoutSource;
  operator_company_id: string;
  company_id: string | null;
  store_id: string | null;
  register_id: string | null;
  merchant_id: string | null;
  outlet_id: string | null;
  created_by_user_id: string | null;
  bill_amount: string;
  lines: InstoreCheckoutLine[];
  collect_in_app: boolean;
  buyer_user_id: string | null;
  points: number;
  points_amount: string;
  voucher_amount: string;
  amount_due: string | null;
  status: InstoreCheckoutStatus;
  expires_at: string;
  shift_id: string | null;
  sale_input: Record<string, unknown> | null;
  reserved_sale_id: string | null;
  buyer_attached_via: "pay_code" | "qr" | null;
  buyer_invoice_info: { name: string; taxCode: string | null; address: string | null } | null;
  paid_amount: string;
  retail_sale_id: string | null;
  posting_error: string | null;
};

export interface CreatedCheckout {
  checkout: CheckoutRow;
  // Mã QR thanh toán chỉ trả một lần khi tạo; máy chủ lưu băm.
  qrToken: string;
  created: boolean;
}

const columns = sql`c.id, c.document_no, c.kind, c.source, c.operator_company_id, c.company_id, c.store_id, c.register_id, c.merchant_id, c.outlet_id,
  c.created_by_user_id, c.bill_amount::text, c.lines, c.collect_in_app, c.buyer_user_id, c.points, c.points_amount::text, c.voucher_amount::text,
  c.amount_due::text, c.status, c.expires_at, c.shift_id, c.sale_input, c.reserved_sale_id, c.buyer_attached_via, c.buyer_invoice_info, c.paid_amount::text,
  c.retail_sale_id, c.posting_error`;

@Injectable()
export class InstoreCheckoutsService {
  private readonly logger = new Logger("InstoreCheckouts");
  private readonly handlers = new Map<InstoreCheckoutKind, CheckoutKindHandler>();
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly payCodes: PayCodeService,
    private readonly smartOtp: SmartOtpService,
    private readonly authenticationSettings: AuthenticationSettingsService,
  ) {}

  registerHandler(kind: InstoreCheckoutKind, handler: CheckoutKindHandler): void {
    this.handlers.set(kind, handler);
  }

  private handler(kind: InstoreCheckoutKind): CheckoutKindHandler {
    const handler = this.handlers.get(kind);
    if (!handler) throw new ApiError("BUSINESS_RULE", "instoreAppPaymentDisabled");
    return handler;
  }

  async find(executor: Executor, id: string, lock = false): Promise<CheckoutRow | undefined> {
    return this.row(executor, id, lock);
  }

  private async row(executor: Executor, id: string, lock = false): Promise<CheckoutRow | undefined> {
    return (await executor.execute<CheckoutRow>(sql`SELECT ${columns} FROM instore.checkouts c WHERE c.id = ${id} ${lock ? sql`FOR UPDATE` : sql``}`)).rows[0];
  }

  private expired(row: CheckoutRow): boolean {
    return new Date(row.expires_at).getTime() <= this.clock.now().getTime();
  }

  // Tạo đơn chờ trong giao dịch của nơi gọi (giữ hàng ở quầy tập đoàn làm cùng giao dịch, lát L2).
  // Gửi lại cùng khóa yêu cầu trả đơn đã tạo, không tạo mới; khi đó không trả lại mã QR.
  async create(transaction: DatabaseTransaction, input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const creatorId = "apiKeyId" in input.creator ? input.creator.apiKeyId : input.creator.userId;
    // Hai yêu cầu tạo cùng lúc (bấm hai lần, hai máy cùng quầy) xếp hàng theo khóa yêu cầu và theo quầy,
    // để yêu cầu sau thấy đơn của yêu cầu trước thay vì vấp chỉ mục duy nhất thành lỗi hệ thống.
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`instore.checkout:${creatorId}:${input.idempotencyKey}`}))`);
    if (input.place.kind === "retail") await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`instore.register:${input.place.registerId}`}))`);
    const existing = (
      await transaction.execute<{ id: string }>(
        sql`SELECT id FROM instore.checkouts WHERE coalesce(created_by_user_id, api_key_id) = ${creatorId} AND idempotency_key = ${input.idempotencyKey}`,
      )
    ).rows[0];
    if (existing) return { checkout: (await this.row(transaction, existing.id))!, qrToken: "", created: false };
    const place = input.place;
    // Mỗi quầy tập đoàn một đơn chờ: đơn cũ đã quá hạn (việc nền chưa chạy) thì đóng luôn; còn hạn thì báo quầy đang có đơn chờ.
    if (place.kind === "retail") {
      const open = (
        await transaction.execute<CheckoutRow>(sql`
          SELECT ${columns} FROM instore.checkouts c WHERE c.register_id = ${place.registerId} AND c.status IN ('awaiting_buyer', 'awaiting_payment', 'paid_unposted') FOR UPDATE`)
      ).rows[0];
      if (open && (open.status === "paid_unposted" || !this.expired(open))) throw new ApiError("BUSINESS_RULE", "instoreRegisterBusy");
      if (open) await this.close(transaction, open, "expired");
    }
    const token = randomBytes(24).toString("base64url");
    const userId = "userId" in input.creator ? input.creator.userId : null;
    const apiKeyId = "apiKeyId" in input.creator ? input.creator.apiKeyId : null;
    const expiresAt = new Date(this.clock.now().getTime() + checkoutLifetimeMinutes * 60_000);
    const inserted = await transaction.execute<{ id: string }>(sql`
      INSERT INTO instore.checkouts (operator_company_id, kind, source, company_id, store_id, register_id, shift_id, merchant_id, outlet_id,
        created_by_user_id, api_key_id, partner_checkout_code, idempotency_key, bill_amount, lines, collect_in_app, qr_token_hash, expires_at, sale_input)
      VALUES (${input.operatorCompanyId}, ${place.kind}, ${input.creator.source},
        ${place.kind === "retail" ? place.companyId : null}, ${place.kind === "retail" ? place.storeId : null},
        ${place.kind === "retail" ? place.registerId : null}, ${place.kind === "retail" ? place.shiftId : null},
        ${place.kind === "affiliate" ? place.merchantId : null}, ${place.kind === "affiliate" ? place.outletId : null},
        ${userId}, ${apiKeyId}, ${input.partnerCheckoutCode ?? null}, ${input.idempotencyKey}, ${input.billAmount}, ${JSON.stringify(input.lines)}::jsonb,
        ${input.collectInApp}, ${qrTokenHash(token)}, ${expiresAt}, ${input.saleInput === undefined ? null : JSON.stringify(input.saleInput)}::jsonb)
      RETURNING id`);
    return { checkout: (await this.row(transaction, inserted.rows[0]!.id))!, qrToken: token, created: true };
  }

  // Luồng 1: thu ngân, phần mềm cửa hàng quét mã thanh toán động của khách (QUYTAC_NGHIEPVU_576). Kiểm quyền với đơn do nơi gọi làm trước.
  async attachPayCode(checkoutId: string, code: string, scanner: PayCodeScanner): Promise<CheckoutRow> {
    const current = await this.row(this.database, checkoutId);
    if (!current) throw new ApiError("NOT_FOUND", "notFound");
    this.assertOpenWithoutBuyer(current);
    // Kiểm mã ngoài giao dịch của đơn: lần sai được ghi kể cả khi gắn không thành.
    const buyerId = await this.payCodes.resolve(code, scanner);
    return this.attach(checkoutId, buyerId, "pay_code");
  }

  private assertOpenWithoutBuyer(row: CheckoutRow): void {
    if (row.status !== "awaiting_buyer" || this.expired(row)) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
    if (row.buyer_user_id) throw new ApiError("BUSINESS_RULE", "instoreCheckoutHasBuyer");
  }

  private async attach(checkoutId: string, buyerId: string, via: "pay_code" | "qr"): Promise<CheckoutRow> {
    return this.database.transaction(async (transaction) => {
      const row = (await this.row(transaction, checkoutId, true))!;
      if (row.buyer_user_id === buyerId) return row;
      this.assertOpenWithoutBuyer(row);
      await transaction.execute(sql`
        UPDATE instore.checkouts SET buyer_user_id = ${buyerId}, buyer_attached_via = ${via}, buyer_attached_at = ${this.clock.now()},
          updated_at = now(), version = version + 1
        WHERE id = ${checkoutId}`);
      const place = await this.placeOf(transaction, checkoutId);
      await notify(transaction, [
        {
          userId: buyerId,
          companyId: null,
          kind: "instore.checkout_waiting",
          title: `Đơn ${row.document_no} tại ${place.storeName} đang chờ bạn thanh toán`,
          link: `/thanh-toan-cua-hang/${checkoutId}`,
          payload: { checkoutId },
        },
      ]);
      return (await this.row(transaction, checkoutId))!;
    });
  }

  // Luồng 2: khách mở mã QR thanh toán của cửa hàng; khách đầu tiên được gắn vào đơn (QUYTAC_NGHIEPVU_577).
  async claim(userId: string, token: string): Promise<BuyerInstoreCheckout> {
    await this.requireBuyer(userId);
    const subject = `claim:${userId}`;
    const locked = await this.payCodes.lockedUntil(this.database, subject, claimFailureLimit);
    if (locked) throw new ApiError("BUSINESS_RULE", "instoreClaimLocked", { retryAfterSeconds: Math.ceil((locked.getTime() - this.clock.now().getTime()) / 1000) });
    const found = (await this.database.execute<CheckoutRow>(sql`SELECT ${columns} FROM instore.checkouts c WHERE c.qr_token_hash = ${qrTokenHash(token)}`)).rows[0];
    if (!found || (found.buyer_user_id !== userId && (found.status !== "awaiting_buyer" || this.expired(found)))) {
      await this.payCodes.recordFailure(subject);
      throw new ApiError("BUSINESS_RULE", "instoreCheckoutNotFound");
    }
    if (found.buyer_user_id && found.buyer_user_id !== userId) throw new ApiError("BUSINESS_RULE", "instoreCheckoutTaken");
    const row = await this.attach(found.id, userId, "qr");
    return this.view(this.database, row);
  }

  // Đơn đang chờ khách (luồng 1): ứng dụng hỏi mỗi 2 giây khi đang mở Mã thanh toán.
  async pending(userId: string): Promise<BuyerInstoreCheckout[]> {
    const rows = (
      await this.database.execute<CheckoutRow>(sql`
        SELECT ${columns} FROM instore.checkouts c
        WHERE c.buyer_user_id = ${userId} AND c.status IN ('awaiting_buyer', 'awaiting_payment') AND c.expires_at > ${this.clock.now()}
        ORDER BY c.buyer_attached_at DESC LIMIT 5`)
    ).rows;
    return Promise.all(rows.map((row) => this.view(this.database, row)));
  }

  async getForBuyer(userId: string, id: string): Promise<BuyerInstoreCheckout> {
    const row = await this.row(this.database, id);
    if (!row || row.buyer_user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
    return this.view(this.database, row);
  }

  // Khách từ chối đơn chưa thanh toán.
  async decline(userId: string, id: string): Promise<BuyerInstoreCheckout> {
    const row = await this.database.transaction(async (transaction) => {
      const current = await this.row(transaction, id, true);
      if (!current || current.buyer_user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
      if (current.status !== "awaiting_buyer" || this.expired(current)) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
      await this.close(transaction, current, "declined");
      return (await this.row(transaction, id))!;
    });
    return this.view(this.database, row);
  }

  // Khách chọn điểm, phương thức rồi thanh toán (QUYTAC_NGHIEPVU_578, 579; API_327). Điểm trừ ngay khi bấm thanh toán lần đầu;
  // các lần mở lại cổng (thanh toán thất bại) giữ nguyên số điểm, số tiền. Còn phải trả 0 thì ghi chứng từ ngay, không qua cổng.
  async pay(userId: string, id: string, input: PayInput, client: ClientInfo): Promise<PayInstoreCheckoutResponse> {
    const current = await this.row(this.database, id);
    if (!current || current.buyer_user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
    if (!["awaiting_buyer", "awaiting_payment"].includes(current.status) || this.expired(current)) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
    // Đơn mở từ mã QR: dùng điểm cần mã Smart OTP (kiểm trong giao dịch riêng để lần sai được ghi). Đơn quét mã thanh toán đã xác thực khi quét.
    if (current.status === "awaiting_buyer" && input.points > 0 && (await this.smartOtpRequired(current, userId))) {
      if (!input.smartOtp) throw new ApiError("BUSINESS_RULE", "instoreSmartOtpRequired");
      await this.smartOtp.verify(userId, input.smartOtp, current.company_id);
    }
    let paymentUrl: string | null = null;
    await this.database.transaction(async (transaction) => {
      const row = (await this.row(transaction, id, true))!;
      if (!["awaiting_buyer", "awaiting_payment"].includes(row.status) || this.expired(row)) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
      let amountDue = row.amount_due === null ? null : Number(row.amount_due);
      if (row.status === "awaiting_buyer") {
        const redeemed = input.points > 0 ? await this.handler(row.kind).redeem(transaction, row, userId, input.points) : null;
        amountDue = Math.max(Number(row.bill_amount) - Number(row.voucher_amount) - (redeemed?.amount ?? 0), 0);
        await transaction.execute(sql`
          UPDATE instore.checkouts SET status = 'awaiting_payment', points = ${redeemed?.points ?? 0}, points_amount = ${redeemed?.amount ?? 0},
            reserved_sale_id = ${redeemed?.reservedSaleId ?? null}, amount_due = ${amountDue}, buyer_invoice_info = ${input.invoiceInfo ? JSON.stringify(input.invoiceInfo) : null}::jsonb,
            updated_at = now(), version = version + 1
          WHERE id = ${id}`);
      }
      if (!amountDue || amountDue <= 0) {
        await this.completeWithin(transaction, id, 0);
        return;
      }
      paymentUrl = await this.startGateway(transaction, (await this.row(transaction, id))!, input.method, userId, client);
    });
    return { checkout: await this.getForBuyer(userId, id), paymentUrl };
  }

  // Dùng điểm trong đơn mở từ mã QR cần mã Smart OTP; khách chưa kích hoạt trong thời hạn chuyển đổi dùng như cách 1 hiện nay (QUYTAC_NGHIEPVU_578).
  private async smartOtpRequired(row: CheckoutRow, userId: string): Promise<boolean> {
    if (row.buyer_attached_via !== "qr") return false;
    if ((await this.smartOtp.state(this.database, userId)).active) return true;
    return !(await this.authenticationSettings.buyerTransitionOpen());
  }

  // Phương thức đang bật, cổng đã có thông tin kết nối (trừ thu khi nhận hàng, thu tại trạm).
  private async enabledMethods(executor: Executor): Promise<{ code: string; gatewayCode: string }[]> {
    const rows = (
      await executor.execute<{ code: string; gateway_code: string }>(sql`SELECT code, gateway_code FROM marketplace.payment_methods WHERE is_enabled ORDER BY sort_order`)
    ).rows;
    return rows.filter((row) => isOnlineMethod(row.code as PaymentMethodCode) && gatewayConfigured(row.gateway_code)).map((row) => ({ code: row.code, gatewayCode: row.gateway_code }));
  }

  // Mở trang cổng: số tham chiếu mới mỗi lần; tiền về tài khoản cổng của công ty vận hành sàn (QUYTAC_NGHIEPVU_579).
  private async startGateway(transaction: Executor, row: CheckoutRow, method: string | null, userId: string, client: ClientInfo): Promise<string | null> {
    if (!method) throw new ApiError("BUSINESS_RULE", "instoreAmountDueRequired");
    const chosen = (await this.enabledMethods(transaction)).find((item) => item.code === method);
    const gateway = chosen ? gatewayAdapter(chosen.gatewayCode) : null;
    if (!chosen || !gateway) throw new ApiError("BUSINESS_RULE", "instoreMethodUnavailable");
    const attempts = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM marketplace.payments WHERE checkout_id = ${row.id}`)).rows[0]!.count;
    if (attempts >= paymentAttemptLimit) throw new ApiError("BUSINESS_RULE", "instorePaymentAttemptLimit");
    const reference = `${row.document_no}T${String(attempts + 1).padStart(2, "0")}`;
    const gatewayReference = gateway.gatewayReference?.() ?? null;
    const gatewayOrderCode = gateway.createOrderCode?.() ?? null;
    const amount = Math.round(Number(row.amount_due));
    await transaction.execute(sql`
      INSERT INTO marketplace.payments (checkout_id, gateway_code, method, reference, gateway_reference, gateway_order_code, amount, created_by)
      VALUES (${row.id}, ${chosen.gatewayCode}, ${chosen.code}, ${reference}, ${gatewayReference}, ${gatewayOrderCode}, ${amount}, ${userId})`);
    const buyer = (
      await transaction.execute<{ full_name: string; phone: string | null; email: string | null }>(sql`SELECT full_name, phone, email::text FROM core.users WHERE id = ${userId}`)
    ).rows[0]!;
    const instruction = await gateway.start({
      reference,
      gatewayReference,
      amount,
      method: chosen.code as PaymentMethodCode,
      documentNo: row.document_no,
      ipAddress: client.ip ?? "127.0.0.1",
      createdAt: this.clock.now(),
      expiresAt: new Date(row.expires_at),
      gatewayOrderCode,
      buyer: { name: buyer.full_name, phone: buyer.phone, email: buyer.email },
    });
    return instruction.kind === "redirect" ? instruction.url : null;
  }

  // Kết quả cổng của lần thanh toán đơn chờ (gọi từ sổ thanh toán, trong giao dịch ghi nhận kết quả; QUYTAC_NGHIEPVU_579, 580).
  // Thành công: ghi chứng từ; ghi không được thì giữ tiền, chuyển "Đã thu, lỗi ghi sổ". Đơn đã đóng: lập việc chờ hoàn tiền.
  async recordPayment(transaction: DatabaseTransaction, paymentId: string, checkoutId: string, result: GatewayNotification): Promise<void> {
    await transaction.execute(sql`
      UPDATE marketplace.payments SET status = ${result.success ? "succeeded" : "failed"}, response_code = ${result.responseCode}, gateway_transaction_no = ${result.transactionNo},
        bank_code = ${result.bankCode}, completed_at = now() WHERE id = ${paymentId}`);
    if (!result.success) return;
    const row = (await this.row(transaction, checkoutId, true))!;
    await transaction.execute(sql`
      UPDATE instore.checkouts SET paid_amount = paid_amount + ${result.amount}, paid_at = coalesce(paid_at, now()), updated_at = now() WHERE id = ${checkoutId}`);
    if (row.status !== "awaiting_payment" || Number(row.paid_amount) > 0) {
      // Tiền về sau khi đơn đã đóng, hoặc đơn đã thu từ lần thanh toán khác.
      await transaction.execute(sql`
        INSERT INTO marketplace.refunds (checkout_id, payment_id, reason, amount)
        VALUES (${checkoutId}, ${paymentId}, ${row.status === "awaiting_payment" || row.status === "completed" || row.status === "paid_unposted" ? "duplicate_payment" : "paid_after_cancel"}, ${result.amount})`);
      if (row.buyer_user_id)
        await notify(transaction, [
          {
            userId: row.buyer_user_id,
            companyId: null,
            kind: "instore.refund_pending",
            title: `Đơn ${row.document_no} đã đóng khi tiền về. VComm sẽ hoàn ${Math.round(result.amount).toLocaleString("vi-VN")} đ vào tài khoản ngân hàng của bạn.`,
            payload: { checkoutId },
          },
        ]);
      return;
    }
    await this.completeWithin(transaction, checkoutId, result.amount);
  }

  // Ghi chứng từ trong điểm lưu tạm của giao dịch: lỗi ghi sổ không làm mất ghi nhận tiền (QUYTAC_NGHIEPVU_580).
  private async completeWithin(transaction: DatabaseTransaction, checkoutId: string, appAmount: number): Promise<void> {
    const row = (await this.row(transaction, checkoutId, true))!;
    await transaction.execute(sql`SAVEPOINT instore_complete`);
    try {
      const documentId = await this.handler(row.kind).complete(transaction, row, appAmount);
      await transaction.execute(sql`RELEASE SAVEPOINT instore_complete`);
      await transaction.execute(sql`
        UPDATE instore.checkouts SET status = 'completed', completed_at = now(), posting_error = NULL,
          retail_sale_id = CASE WHEN kind = 'retail' THEN ${documentId}::uuid ELSE retail_sale_id END, updated_at = now(), version = version + 1
        WHERE id = ${checkoutId}`);
      if (row.buyer_user_id)
        await notify(transaction, [
          { userId: row.buyer_user_id, companyId: null, kind: "instore.checkout_completed", title: `Đã thanh toán đơn ${row.document_no}`, payload: { checkoutId } },
        ]);
    } catch (error) {
      await transaction.execute(sql`ROLLBACK TO SAVEPOINT instore_complete`);
      const message = error instanceof ApiError ? error.message : (error as Error).message;
      this.logger.error(`Ghi chứng từ đơn ${row.document_no} không được: ${message}`);
      await transaction.execute(sql`
        UPDATE instore.checkouts SET status = 'paid_unposted', posting_error = ${message.slice(0, 500)}, updated_at = now(), version = version + 1 WHERE id = ${checkoutId}`);
      if (row.created_by_user_id)
        await notify(transaction, [
          {
            userId: row.created_by_user_id,
            companyId: row.company_id,
            kind: "instore.checkout_unposted",
            title: `Đơn ${row.document_no} đã thu tiền nhưng chưa ghi được hóa đơn. Báo Cửa hàng trưởng ghi lại hoặc hủy và hoàn tiền.`,
            payload: { checkoutId },
          },
        ]);
    }
  }

  // Cửa hàng trưởng ghi lại đơn "Đã thu, lỗi ghi sổ" (kiểm quyền do nơi gọi làm trước).
  async retryPosting(id: string): Promise<CheckoutRow> {
    return this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, id, true);
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "paid_unposted") throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
      await this.completeWithin(transaction, id, Number(row.paid_amount));
      return (await this.row(transaction, id))!;
    });
  }

  // Hủy đơn (kiểm quyền do nơi gọi làm trước): đơn chưa thanh toán; đơn "Đã thu, lỗi ghi sổ" thì hủy và lập việc chờ hoàn tiền.
  async cancel(id: string, actorUserId: string | null, reason: string): Promise<CheckoutRow> {
    return this.database.transaction(async (transaction) => {
      const current = await this.row(transaction, id, true);
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      if (current.status === "paid_unposted") {
        await transaction.execute(sql`
          INSERT INTO marketplace.refunds (checkout_id, payment_id, reason, amount)
          SELECT ${id}, p.id, 'instore_cancelled', p.amount FROM marketplace.payments p WHERE p.checkout_id = ${id} AND p.status = 'succeeded' ORDER BY p.completed_at LIMIT 1`);
      } else if (!openStatuses.includes(current.status as (typeof openStatuses)[number])) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
      await this.close(transaction, current, "cancelled", { actorUserId, reason });
      return (await this.row(transaction, id))!;
    });
  }

  // Ca còn đơn chờ chưa xong thì chưa đóng được; đơn quá hạn chưa thanh toán thì đóng luôn (QUYTAC_NGHIEPVU_575).
  async settleShift(transaction: DatabaseTransaction, shiftId: string): Promise<void> {
    const rows = (
      await transaction.execute<CheckoutRow>(sql`
        SELECT ${columns} FROM instore.checkouts c WHERE c.shift_id = ${shiftId} AND c.status IN ('awaiting_buyer', 'awaiting_payment', 'paid_unposted') FOR UPDATE`)
    ).rows;
    for (const row of rows) {
      if (row.status === "paid_unposted" || !this.expired(row) || Number(row.paid_amount) > 0) throw new ApiError("BUSINESS_RULE", "instoreOpenCheckouts");
      await this.close(transaction, row, "expired");
    }
  }

  // Việc nền mỗi phút: đơn quá hạn chuyển Hết hạn (hoàn điểm, nhả hàng). Đơn đã mở cổng mà tiền về sau hạn thì lập việc chờ hoàn tiền.
  async expireDue(): Promise<number> {
    const due = (
      await this.database.execute<{ id: string }>(
        sql`SELECT id FROM instore.checkouts WHERE status IN ('awaiting_buyer', 'awaiting_payment') AND expires_at <= ${this.clock.now()} ORDER BY expires_at LIMIT 200`,
      )
    ).rows;
    let count = 0;
    for (const { id } of due) {
      const closed = await this.database.transaction(async (transaction) => {
        const current = await this.row(transaction, id, true);
        if (!current || !openStatuses.includes(current.status as (typeof openStatuses)[number]) || !this.expired(current)) return false;
        await this.close(transaction, current, "expired");
        return true;
      });
      if (closed) count += 1;
    }
    return count;
  }

  // Đóng đơn chưa hoàn tất: hoàn điểm đã trừ, nhả hàng đang giữ (phần xử lý của loại cửa hàng).
  private async close(
    transaction: DatabaseTransaction,
    row: CheckoutRow,
    status: "declined" | "cancelled" | "expired",
    cancellation: { actorUserId: string | null; reason: string } | null = null,
  ): Promise<void> {
    await this.handlers.get(row.kind)?.release(transaction, row);
    await transaction.execute(sql`
      UPDATE instore.checkouts SET status = ${status}, cancel_reason = ${cancellation?.reason ?? null}, cancelled_by_user_id = ${cancellation?.actorUserId ?? null},
        updated_at = now(), version = version + 1
      WHERE id = ${row.id}`);
  }

  private async requireBuyer(userId: string): Promise<void> {
    const found = await this.database.execute(sql`
      SELECT 1 FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.id = ${userId} AND u.status = 'active'`);
    if (!found.rows.length) throw new ApiError("FORBIDDEN", "forbidden");
  }

  // Tên cửa hàng, nơi bán hiển thị cho khách: cửa hàng tập đoàn là tên chi nhánh và quầy; cửa hàng liên kết là tên đối tác và điểm bán.
  private async placeOf(executor: Executor, checkoutId: string): Promise<{ storeName: string; placeName: string }> {
    const row = (
      await executor.execute<{ store_name: string; place_name: string }>(sql`
        SELECT coalesce(b.name, p.short_name, p.name) AS store_name, coalesce(r.name, o.name) AS place_name
        FROM instore.checkouts c
        LEFT JOIN retail.stores s ON s.id = c.store_id
        LEFT JOIN core.branches b ON b.id = s.branch_id
        LEFT JOIN retail.registers r ON r.id = c.register_id
        LEFT JOIN affiliate.merchants m ON m.id = c.merchant_id
        LEFT JOIN crm.partners p ON p.id = m.partner_id
        LEFT JOIN affiliate.outlets o ON o.id = c.outlet_id
        WHERE c.id = ${checkoutId}`)
    ).rows[0];
    return { storeName: row?.store_name ?? "", placeName: row?.place_name ?? "" };
  }

  async view(executor: Executor, row: CheckoutRow): Promise<BuyerInstoreCheckout> {
    const place = await this.placeOf(executor, row.id);
    // Đơn còn mở nhưng đã quá hạn (việc nền chưa chạy) hiện là Hết hạn.
    const status: InstoreCheckoutStatus = openStatuses.includes(row.status as (typeof openStatuses)[number]) && this.expired(row) ? "expired" : row.status;
    return {
      id: row.id,
      documentNo: row.document_no,
      kind: row.kind,
      status,
      storeName: place.storeName,
      placeName: place.placeName,
      billAmount: row.bill_amount,
      lines: row.lines,
      collectInApp: row.collect_in_app,
      expiresAt: new Date(row.expires_at).toISOString(),
      points: row.points,
      pointsAmount: row.points_amount,
      voucherAmount: row.voucher_amount,
      amountDue: row.amount_due,
      loyalty: status === "awaiting_buyer" && row.buyer_user_id ? await this.handlers.get(row.kind)?.loyalty(executor, row, row.buyer_user_id) ?? null : null,
      paymentMethods: status === "awaiting_buyer" || status === "awaiting_payment" ? await this.enabledMethods(executor) : [],
      smartOtpRequired: status === "awaiting_buyer" && row.buyer_user_id ? await this.smartOtpRequired(row, row.buyer_user_id) : false,
      saleDocumentNo: row.retail_sale_id
        ? ((await executor.execute<{ document_no: string }>(sql`SELECT document_no FROM retail.sales WHERE id = ${row.retail_sale_id}`)).rows[0]?.document_no ?? null)
        : null,
    };
  }
}
