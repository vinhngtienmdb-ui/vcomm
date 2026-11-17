// Đơn chờ thanh toán tại cửa hàng (CONG_VIEC_73; QUYTAC_NGHIEPVU_575 đến 577; API_327).
// Dùng chung cho quầy cửa hàng tập đoàn, cổng cửa hàng liên kết, Open API và iPOS (CONG_VIEC_74 gọi thẳng service này trong backend):
// controller của từng nơi kiểm quyền rồi gọi service; quy tắc nghiệp vụ, khóa yêu cầu, hạn đơn nằm ở đây.
// Lát L1: tạo, gắn khách bằng mã động (luồng 1) hoặc mã QR (luồng 2), khách xem, từ chối, hủy, hết hạn.
// Chọn điểm, voucher, thanh toán qua cổng và ghi chứng từ làm ở lát L2, L4.
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerInstoreCheckout, InstoreCheckoutKind, InstoreCheckoutLine, InstoreCheckoutSource, InstoreCheckoutStatus } from "contracts";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { claimFailureLimit, PayCodeService, type PayCodeScanner } from "./pay-code.service";

type Executor = Pick<Database, "execute">;

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
};

export interface CreatedCheckout {
  checkout: CheckoutRow;
  // Mã QR thanh toán chỉ trả một lần khi tạo; máy chủ lưu băm.
  qrToken: string;
  created: boolean;
}

const columns = sql`c.id, c.document_no, c.kind, c.source, c.operator_company_id, c.company_id, c.store_id, c.register_id, c.merchant_id, c.outlet_id,
  c.created_by_user_id, c.bill_amount::text, c.lines, c.collect_in_app, c.buyer_user_id, c.points, c.points_amount::text, c.voucher_amount::text,
  c.amount_due::text, c.status, c.expires_at`;

@Injectable()
export class InstoreCheckoutsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly payCodes: PayCodeService,
  ) {}

  private async row(executor: Executor, id: string, lock = false): Promise<CheckoutRow | undefined> {
    return (await executor.execute<CheckoutRow>(sql`SELECT ${columns} FROM instore.checkouts c WHERE c.id = ${id} ${lock ? sql`FOR UPDATE` : sql``}`)).rows[0];
  }

  private expired(row: CheckoutRow): boolean {
    return new Date(row.expires_at).getTime() <= this.clock.now().getTime();
  }

  // Tạo đơn chờ trong giao dịch của nơi gọi (giữ hàng ở quầy tập đoàn làm cùng giao dịch, lát L2).
  // Gửi lại cùng khóa yêu cầu trả đơn đã tạo, không tạo mới; khi đó không trả lại mã QR.
  async create(transaction: Executor, input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const creatorId = "apiKeyId" in input.creator ? input.creator.apiKeyId : input.creator.userId;
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
          SELECT ${columns} FROM instore.checkouts c WHERE c.register_id = ${place.registerId} AND c.status IN ('awaiting_buyer', 'awaiting_payment') FOR UPDATE`)
      ).rows[0];
      if (open && !this.expired(open)) throw new ApiError("BUSINESS_RULE", "instoreRegisterBusy");
      if (open) await this.close(transaction, open, "expired");
    }
    const token = randomBytes(24).toString("base64url");
    const userId = "userId" in input.creator ? input.creator.userId : null;
    const apiKeyId = "apiKeyId" in input.creator ? input.creator.apiKeyId : null;
    const expiresAt = new Date(this.clock.now().getTime() + checkoutLifetimeMinutes * 60_000);
    const inserted = await transaction.execute<{ id: string }>(sql`
      INSERT INTO instore.checkouts (operator_company_id, kind, source, company_id, store_id, register_id, shift_id, merchant_id, outlet_id,
        created_by_user_id, api_key_id, partner_checkout_code, idempotency_key, bill_amount, lines, collect_in_app, qr_token_hash, expires_at)
      VALUES (${input.operatorCompanyId}, ${place.kind}, ${input.creator.source},
        ${place.kind === "retail" ? place.companyId : null}, ${place.kind === "retail" ? place.storeId : null},
        ${place.kind === "retail" ? place.registerId : null}, ${place.kind === "retail" ? place.shiftId : null},
        ${place.kind === "affiliate" ? place.merchantId : null}, ${place.kind === "affiliate" ? place.outletId : null},
        ${userId}, ${apiKeyId}, ${input.partnerCheckoutCode ?? null}, ${input.idempotencyKey}, ${input.billAmount}, ${JSON.stringify(input.lines)}::jsonb,
        ${input.collectInApp}, ${qrTokenHash(token)}, ${expiresAt})
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

  // Thu ngân, chủ cửa hàng, khóa API hủy đơn chưa thanh toán (kiểm quyền do nơi gọi làm trước).
  async cancel(id: string, actorUserId: string | null, reason: string): Promise<CheckoutRow> {
    return this.database.transaction(async (transaction) => {
      const current = await this.row(transaction, id, true);
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      if (!openStatuses.includes(current.status as (typeof openStatuses)[number])) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
      await this.close(transaction, current, "cancelled", { actorUserId, reason });
      return (await this.row(transaction, id))!;
    });
  }

  // Việc nền mỗi phút: đơn quá hạn chuyển Hết hạn.
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

  // Đóng đơn chưa hoàn tất. Lát L2 bổ sung: hoàn điểm, trả voucher, nhả giữ hàng.
  private async close(
    transaction: Executor,
    row: CheckoutRow,
    status: "declined" | "cancelled" | "expired",
    cancellation: { actorUserId: string | null; reason: string } | null = null,
  ): Promise<void> {
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
    };
  }
}
