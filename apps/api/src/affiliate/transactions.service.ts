// Giao dịch tích, dùng điểm tại quầy cửa hàng liên kết (CONG_VIEC_55; CHUC_NANG_194; QUYTAC_NGHIEPVU_394 đến 400; API_208, API_209).
// Ba cách định danh khách: mã QR của cửa hàng (khách quét, xác nhận), mã thành viên của khách (thu ngân quét), số điện thoại (khách xác nhận trên ứng dụng).
// Điểm ghi vào sổ cái của CONG_VIEC_51 (nguồn `affiliate_transaction`) trong cùng giao dịch cơ sở dữ liệu; nghĩa vụ điểm ở công ty vận hành sàn.
import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliateCompanyTransaction,
  affiliateCompanyTransactionQuerySchema,
  AffiliateSkipReason,
  AffiliateTransactionCreated,
  AffiliateTransactionItem,
  AffiliateTransactionMethod,
  AffiliateTransactionSource,
  AffiliateTransactionStatus,
  BuyerAffiliateRequest,
  BuyerAffiliateTransaction,
  BuyerMemberCode,
  PageResponse,
  affiliateTransactionCreateSchema,
  affiliateTransactionListQuerySchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { purposeKey } from "../common/secret-box";
import { isUniqueViolation, violatedConstraint } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import { LedgerService } from "../accounting/ledger.service";
import { LoyaltyLedgerService } from "../loyalty/ledger.service";
import { vietnamToday } from "../marketplace/shop.service";
import { requireOwner, type PortalMember } from "./portal.service";
import { transactionCancelDraft, transactionDraft } from "./postings";
import { merchantOverdue } from "./settlements.service";
import { releaseVoucherWithin, usableCodes, useVoucherWithin } from "./vouchers.service";

type Executor = Pick<Database, "execute">;

// Bên lập giao dịch tại quầy: thành viên cổng cửa hàng (thu ngân, chủ) hoặc phần mềm cửa hàng qua Open API (CONG_VIEC_67).
export interface CounterActor {
  merchantId: string;
  companyId: string;
  cashierUserId: string | null;
  apiKey: { id: string; name: string; prefix: string; partnerTransactionCode: string | null } | null;
  client: { ip: string | null; userAgent: string | null; requestId: string | null };
}

export const counterOfMember = (member: PortalMember): CounterActor => ({
  merchantId: member.merchantId,
  companyId: member.companyId,
  cashierUserId: member.userId,
  apiKey: null,
  client: member.client,
});

const merchantQrMinutes = 3;
const phoneMinutes = 5;
const memberCodeSeconds = 60;
const declinedPerHourLimit = 10;
const qrPrefix = "VCLK1.";
const memberPrefix = "VCTV1";

const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);

// Tên che (QUYTAC_NGHIEPVU_397): "Nguyễn Thị Hồng" → "Ng*** H***".
export function maskName(fullName: string | null): string | null {
  if (!fullName) return null;
  const words = fullName.trim().split(/\s+/);
  const first = words[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1]! : "";
  return [`${[...first].slice(0, 2).join("")}***`, last ? `${[...last][0]}***` : null].filter(Boolean).join(" ");
}

// Mã thành viên ký HMAC (QUYTAC_NGHIEPVU_396): mã người mua, số điểm cho phép, thời điểm, chuỗi ngẫu nhiên; không chứa tên, số điện thoại.
const memberKey = () => purposeKey("affiliate-member-code");
const sign = (body: string) => createHmac("sha256", memberKey()).update(body, "utf8").digest("base64url");

export function issueMemberCode(userId: string, points: number, voucherCodeId: string | null, now: Date): BuyerMemberCode {
  const issued = Math.floor(now.getTime() / 1000);
  const body = [memberPrefix, userId, points, voucherCodeId ?? "0", issued, randomBytes(8).toString("hex")].join(".");
  return { code: `${body}.${sign(body)}`, expiresAt: new Date((issued + memberCodeSeconds) * 1000).toISOString() };
}

export function readMemberCode(code: string, now: Date): { userId: string; points: number; voucherCodeId: string | null; expiresAt: Date } {
  const parts = code.trim().split(".");
  if (parts.length !== 7 || parts[0] !== memberPrefix) throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
  const body = parts.slice(0, 6).join(".");
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(parts[6]!);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
  const issued = Number(parts[4]);
  const points = Number(parts[2]);
  const nowSeconds = now.getTime() / 1000;
  if (!Number.isInteger(issued) || !Number.isInteger(points) || points < 0 || nowSeconds > issued + memberCodeSeconds || issued > nowSeconds + 5) {
    throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
  }
  const voucherCodeId = parts[3] === "0" ? null : parts[3]!;
  return { userId: parts[1]!, points, voucherCodeId, expiresAt: new Date((issued + memberCodeSeconds) * 1000) };
}

type TransactionRow = {
  id: string;
  document_no: string;
  method: AffiliateTransactionMethod;
  source: AffiliateTransactionSource;
  partner_transaction_code: string | null;
  status: AffiliateTransactionStatus;
  outlet_id: string;
  outlet_name: string;
  cashier_name: string | null;
  buyer_name: string | null;
  bill_amount: string;
  voucher_discount: string;
  redeemed_points: number;
  redeemed_amount: string;
  paid_amount: string | null;
  earned_points: number;
  earned_amount: string;
  skip_reason: AffiliateSkipReason | null;
  created_at: Date;
  completed_at: Date | null;
  expires_at: Date | null;
  cancel_reason: string | null;
  settlement_id: string | null;
};

const transactionColumns = sql`
  t.id, t.document_no, t.method, t.source, t.partner_transaction_code,
  CASE WHEN t.status = 'pending' AND t.expires_at < now() THEN 'expired' ELSE t.status END AS status,
  t.outlet_id, o.name AS outlet_name, c.full_name AS cashier_name, b.full_name AS buyer_name, t.bill_amount::text, t.voucher_discount::text, t.redeemed_points,
  t.redeemed_amount::text, t.paid_amount::text, t.earned_points, t.earned_amount::text, t.skip_reason, t.created_at, t.completed_at, t.expires_at, t.cancel_reason, t.settlement_id`;
const transactionFrom = sql`
  affiliate.transactions t JOIN affiliate.outlets o ON o.id = t.outlet_id LEFT JOIN core.users c ON c.id = t.cashier_user_id LEFT JOIN core.users b ON b.id = t.buyer_user_id`;

function itemOf(row: TransactionRow, member: PortalMember | null): AffiliateTransactionItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    method: row.method,
    status: row.status,
    outletId: row.outlet_id,
    outletName: row.outlet_name,
    cashierName: row.cashier_name,
    source: row.source,
    partnerTransactionCode: row.partner_transaction_code,
    buyerName: maskName(row.buyer_name),
    billAmount: trimDecimal(row.bill_amount),
    voucherDiscount: trimDecimal(row.voucher_discount),
    redeemedPoints: row.redeemed_points,
    redeemedAmount: trimDecimal(row.redeemed_amount),
    paidAmount: row.paid_amount === null ? null : trimDecimal(row.paid_amount),
    earnedPoints: row.earned_points,
    earnedAmount: trimDecimal(row.earned_amount),
    skipReason: row.skip_reason,
    createdAt: iso(row.created_at)!,
    completedAt: iso(row.completed_at),
    expiresAt: row.status === "pending" ? iso(row.expires_at) : null,
    cancelReason: row.cancel_reason,
    canCancel: member?.role === "owner" && row.status === "completed" && row.settlement_id === null,
  };
}

type MerchantTerms = { id: string; company_id: string; name: string; status: string; in_contract: boolean; earn_percent: string; credit_limit: string; transaction_cap: string };

async function merchantTerms(executor: Executor, merchantId: string, lock = false): Promise<MerchantTerms> {
  return (
    await executor.execute<MerchantTerms>(sql`
      SELECT m.id, m.company_id, p.name, m.status, m.earn_percent::text, m.credit_limit::text, m.transaction_cap::text,
        (m.starts_on <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (m.ends_on IS NULL OR m.ends_on >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)) AS in_contract
      FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id WHERE m.id = ${merchantId} ${lock ? sql`FOR UPDATE OF m` : sql``}`)
  ).rows[0]!;
}

// Dư nợ của cửa hàng (QUYTAC_NGHIEPVU_398): phải thu còn mở của bảng đối soát (bảng chưa xác nhận: số còn lại; đã xác nhận: công nợ phải thu còn mở)
// + (tiền điểm tích − tiền công ty phải trả) của giao dịch chưa chốt, không âm.
export async function merchantExposure(executor: Executor, merchantId: string): Promise<number> {
  const row = (
    await executor.execute<{ total: string }>(sql`
      SELECT (
        coalesce((SELECT sum(CASE WHEN status = 'completed' THEN earned_amount - redeemed_amount - voucher_payable ELSE shortfall_amount END)
          FROM affiliate.transactions WHERE merchant_id = ${merchantId} AND settlement_id IS NULL AND status IN ('completed', 'cancelled')), 0)
        + coalesce((SELECT sum(net_amount) FROM affiliate.settlements WHERE merchant_id = ${merchantId} AND status IN ('awaiting_confirmation', 'disputed')), 0)
        + coalesce((SELECT sum(d.open_amount) FROM affiliate.settlements s JOIN finance.debt_items d ON d.id = s.debt_item_id
          WHERE s.merchant_id = ${merchantId} AND s.status = 'confirmed' AND d.side = 'receivable'), 0)
      )::text AS total`)
  ).rows[0]!;
  return Math.max(Number(row.total), 0);
}

@Injectable()
export class AffiliateTransactionsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly ledger: LoyaltyLedgerService,
    private readonly audit: AuditService,
    private readonly accounting: LedgerService,
  ) {}

  private async row(executor: Executor, id: string, scope: ReturnType<typeof sql>): Promise<TransactionRow> {
    const row = (await executor.execute<TransactionRow>(sql`SELECT ${transactionColumns} FROM ${transactionFrom} WHERE t.id = ${id} AND ${scope}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Phạm vi thành viên: chủ thấy mọi điểm bán; thu ngân chỉ điểm bán được gán.
  private scopeOf(member: PortalMember) {
    return member.role === "owner" ? sql`t.merchant_id = ${member.merchantId}` : sql`t.merchant_id = ${member.merchantId} AND t.outlet_id = ANY(${pgArray(member.outletIds)}::uuid[])`;
  }

  async transaction(member: PortalMember, id: string): Promise<AffiliateTransactionItem> {
    return itemOf(await this.row(this.database, id, this.scopeOf(member)), member);
  }

  // Web quản trị (MAN_HINH_180 thẻ Giao dịch): mọi cửa hàng của công ty vận hành sàn; số điện thoại khách đã che.
  async companyList(companyId: string, query: z.infer<typeof affiliateCompanyTransactionQuerySchema>): Promise<PageResponse<AffiliateCompanyTransaction>> {
    const day = sql`(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const status = sql`CASE WHEN t.status = 'pending' AND t.expires_at < now() THEN 'expired' ELSE t.status END`;
    const where = sql`t.merchant_id IN (SELECT id FROM affiliate.merchants WHERE company_id = ${companyId})
      ${query.merchantId ? sql`AND t.merchant_id = ${query.merchantId}` : sql``}
      ${query.method ? sql`AND t.method = ${query.method}` : sql``}
      ${query.from ? sql`AND ${day} >= ${query.from}::date` : sql``}
      ${query.to ? sql`AND ${day} <= ${query.to}::date` : sql``}
      ${query.status ? sql`AND ${status} = ${query.status}` : sql``}
      ${query.search ? sql`AND t.document_no ILIKE ${`%${query.search}%`}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${transactionFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<TransactionRow & { merchant_id: string; merchant_name: string; buyer_phone: string | null }>(sql`
      SELECT ${transactionColumns}, t.merchant_id, p.name AS merchant_name, b.phone AS buyer_phone
      FROM ${transactionFrom} JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id
      WHERE ${where} ORDER BY t.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        ...itemOf(row, null),
        merchantId: row.merchant_id,
        merchantName: row.merchant_name,
        buyerPhone: row.buyer_phone ? `0${row.buyer_phone.slice(3, 6)} *** ${row.buyer_phone.slice(-3)}` : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async list(member: PortalMember, query: z.infer<typeof affiliateTransactionListQuerySchema>): Promise<PageResponse<AffiliateTransactionItem>> {
    const day = sql`(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const status = sql`CASE WHEN t.status = 'pending' AND t.expires_at < now() THEN 'expired' ELSE t.status END`;
    const where = sql`${this.scopeOf(member)}
      ${query.from ? sql`AND ${day} >= ${query.from}::date` : sql``}
      ${query.to ? sql`AND ${day} <= ${query.to}::date` : sql``}
      ${query.outletId ? sql`AND t.outlet_id = ${query.outletId}` : sql``}
      ${query.status ? sql`AND ${status} = ${query.status}` : sql``}
      ${query.search ? sql`AND t.document_no ILIKE ${`%${query.search}%`}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${transactionFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<TransactionRow>(sql`
      SELECT ${transactionColumns} FROM ${transactionFrom} WHERE ${where} ORDER BY t.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => itemOf(row, member)), page: query.page, pageSize: query.pageSize, total };
  }

  // API_208: lập giao dịch (QUYTAC_NGHIEPVU_394 đến 397).
  async create(member: PortalMember, input: z.infer<typeof affiliateTransactionCreateSchema>): Promise<AffiliateTransactionCreated> {
    if (member.role === "cashier" && !member.outletIds.includes(input.outletId)) throw new ApiError("FORBIDDEN", "forbidden");
    const created = await this.createFor(counterOfMember(member), input);
    return { transaction: await this.transaction(member, created.id), qrCode: created.qrCode };
  }

  // Lập giao dịch cho thu ngân hoặc phần mềm cửa hàng; điểm bán đã kiểm thuộc phạm vi của bên lập.
  async createFor(
    counter: CounterActor,
    input: { outletId: string; billAmount: string; method: AffiliateTransactionMethod; phone?: string | undefined; memberCode?: string | undefined },
  ): Promise<{ id: string; qrCode: string | null }> {
    const merchant = await merchantTerms(this.database, counter.merchantId);
    if (merchant.status !== "active" || !merchant.in_contract) throw new ApiError("BUSINESS_RULE", "affiliateMerchantInactive");
    const outlet = (await this.database.execute<{ status: string }>(sql`SELECT status FROM affiliate.outlets WHERE id = ${input.outletId} AND merchant_id = ${counter.merchantId}`)).rows[0];
    if (!outlet || outlet.status !== "active") throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { outletId: "invalidValue" } });
    if (Number(input.billAmount) > Number(merchant.transaction_cap)) throw new ApiError("BUSINESS_RULE", "affiliateBillOverCap");
    const base = { merchantId: counter.merchantId, outletId: input.outletId, counter, bill: input.billAmount, earnPercent: merchant.earn_percent };

    if (input.method === "merchant_qr") {
      const token = randomBytes(24).toString("base64url");
      const id = await this.insert(this.database, { ...base, method: "merchant_qr", buyer: null, tokenHash: hash(token), minutes: merchantQrMinutes });
      return { id, qrCode: `${qrPrefix}${token}` };
    }

    if (input.method === "phone") {
      // Giới hạn yêu cầu bị từ chối, hết hạn mỗi giờ theo thu ngân; qua Open API theo khóa (CONG_VIEC_67).
      const declined = (
        await this.database.execute<{ total: number }>(sql`
          SELECT count(*)::int AS total FROM affiliate.transactions
          WHERE ${counter.apiKey ? sql`api_key_id = ${counter.apiKey.id}` : sql`cashier_user_id = ${counter.cashierUserId}`} AND method = 'phone' AND created_at > now() - interval '1 hour'
            AND (status = 'declined' OR (status IN ('pending', 'expired') AND expires_at < now()))`)
      ).rows[0]!.total;
      if (declined >= declinedPerHourLimit) throw new ApiError("RATE_LIMITED", "affiliatePhoneLimited");
      const buyer = (
        await this.database.execute<{ id: string }>(sql`
          SELECT u.id FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.phone = ${input.phone!} AND u.status = 'active'`)
      ).rows[0];
      if (!buyer) throw new ApiError("BUSINESS_RULE", "affiliatePhoneNoAccount");
      // Yêu cầu chờ đã quá hạn của số này chuyển hết hạn trước khi lập yêu cầu mới.
      await this.database.execute(sql`
        UPDATE affiliate.transactions SET status = 'expired' WHERE buyer_user_id = ${buyer.id} AND method = 'phone' AND status = 'pending' AND expires_at < now()`);
      const id = await this.insert(this.database, { ...base, method: "phone", buyer: buyer.id, tokenHash: null, minutes: phoneMinutes }).catch((error: unknown) => {
        if (isUniqueViolation(error) && violatedConstraint(error) === "transactions_pending_phone_idx") throw new ApiError("BUSINESS_RULE", "affiliatePhonePending");
        throw error;
      });
      await notify(this.database, [
        {
          userId: buyer.id,
          companyId: merchant.company_id,
          kind: "affiliate.confirm_request",
          title: `${merchant.name} đề nghị bạn xác nhận giao dịch ${Number(input.billAmount).toLocaleString("vi-VN")} đ`,
          payload: { transactionId: id },
        },
      ]);
      return { id, qrCode: null };
    }

    // Cách 2: mã thành viên hợp lệ, chưa dùng; hoàn tất ngay với số điểm nhỏ hơn giữa số khách cho phép và số tối đa dùng được.
    const code = readMemberCode(input.memberCode!, new Date());
    const id = await this.database.transaction(async (transaction) => {
      const buyer = (
        await transaction.execute<{ id: string }>(sql`
          SELECT u.id FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.id = ${code.userId} AND u.status = 'active'`)
      ).rows[0];
      if (!buyer) throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
      const created = await this.insert(transaction, { ...base, method: "buyer_qr", buyer: buyer.id, tokenHash: null, minutes: 0 });
      const used = await transaction.execute(sql`
        INSERT INTO affiliate.used_member_codes (code_hash, transaction_id, expires_at) VALUES (${hash(input.memberCode!)}, ${created}, ${code.expiresAt})
        ON CONFLICT (code_hash) DO NOTHING RETURNING code_hash`);
      if (used.rows.length === 0) throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
      await this.complete(transaction, created, buyer.id, { points: code.points, voucherCodeId: code.voucherCodeId, capToMax: true });
      return created;
    });
    return { id, qrCode: null };
  }

  private async insert(
    executor: Executor,
    input: {
      merchantId: string;
      outletId: string;
      counter: CounterActor;
      bill: string;
      earnPercent: string;
      method: AffiliateTransactionMethod;
      buyer: string | null;
      tokenHash: string | null;
      minutes: number;
    },
  ): Promise<string> {
    return (
      await executor.execute<{ id: string }>(sql`
        INSERT INTO affiliate.transactions (merchant_id, outlet_id, cashier_user_id, buyer_user_id, method, token_hash, expires_at, bill_amount, earn_percent,
          source, api_key_id, partner_transaction_code)
        VALUES (${input.merchantId}, ${input.outletId}, ${input.counter.cashierUserId}, ${input.buyer}, ${input.method}, ${input.tokenHash},
          ${input.minutes > 0 ? sql`now() + make_interval(mins => ${input.minutes})` : sql`NULL`}, ${input.bill}, ${input.earnPercent},
          ${input.counter.apiKey ? "open_api" : "portal"}, ${input.counter.apiKey?.id ?? null}, ${input.counter.apiKey?.partnerTransactionCode ?? null})
        RETURNING id`)
    ).rows[0]!.id;
  }

  // Hoàn tất (QUYTAC_NGHIEPVU_394, 398, 399): dùng điểm trên tiền sau voucher; tích trên tiền khách trả theo tỷ lệ của cửa hàng;
  // vượt hạn mức nợ hoặc có bảng đối soát quá hạn thanh toán thì không tích (vẫn dùng điểm). Chi tiêu tại cửa hàng liên kết không cộng vào xét hạng.
  // capToMax: số điểm khách cho phép là mức trần (mã thành viên, hoặc có voucher làm giảm tiền tính giới hạn); không đủ mức tối thiểu thì không dùng điểm.
  private async complete(executor: Executor, id: string, buyerId: string, input: { points: number; voucherCodeId: string | null; capToMax: boolean }): Promise<void> {
    const row = (
      await executor.execute<{ merchant_id: string; status: string; expired: boolean; bill_amount: string; voucher_discount: string; earn_percent: string }>(sql`
        SELECT merchant_id, status, (expires_at IS NOT NULL AND expires_at < now()) AS expired, bill_amount::text, voucher_discount::text, earn_percent::text
        FROM affiliate.transactions WHERE id = ${id} FOR UPDATE`)
    ).rows[0]!;
    if (row.status !== "pending" || row.expired) throw new ApiError("BUSINESS_RULE", "affiliateTransactionExpired");
    const merchant = await merchantTerms(executor, row.merchant_id, true);
    if (merchant.status !== "active" || !merchant.in_contract) throw new ApiError("BUSINESS_RULE", "affiliateMerchantInactive");
    const day = await vietnamToday(executor);
    const bill = Number(row.bill_amount);
    const voucher = input.voucherCodeId
      ? await useVoucherWithin(executor, { codeId: input.voucherCodeId, buyerId, merchantId: row.merchant_id, bill, transactionId: id })
      : { discount: 0, payable: 0 };
    const afterVoucher = bill - voucher.discount;
    let points = input.points;
    if (input.capToMax || input.voucherCodeId) {
      const quote = await this.ledger.quoteRedemption(executor, { userId: buyerId, sourceType: "affiliate_transaction", day, goodsAmount: afterVoucher });
      points = quote.redeemable && points >= quote.minPoints ? Math.min(points, quote.maxPoints) : 0;
    }
    const redeemed = await this.ledger.redeemWithin(executor, {
      userId: buyerId,
      companyId: merchant.company_id,
      sourceType: "affiliate_transaction",
      sourceId: id,
      day,
      goodsAmount: afterVoucher,
      points,
    });
    const paid = afterVoucher - redeemed.amount;
    const snapshot = (
      await executor.execute<{ multiplier: string; point_value: string | null }>(sql`
        SELECT d.multiplier::text, ph.point_value::text FROM loyalty.document_points d LEFT JOIN loyalty.program_phases ph ON ph.id = d.phase_id
        WHERE d.source_type = 'affiliate_transaction' AND d.source_id = ${id}`)
    ).rows[0]!;
    const estimate = Math.round((paid * Number(row.earn_percent) * Number(snapshot.multiplier)) / 100);
    // Giao dịch này cũng làm giảm dư nợ bằng tiền công ty phải trả (điểm khách dùng, voucher).
    const overdue = await merchantOverdue(executor, row.merchant_id);
    const overLimit = (await merchantExposure(executor, row.merchant_id)) - redeemed.amount - voucher.payable + estimate > Number(merchant.credit_limit);
    const earned = await this.ledger.earnWithin(executor, {
      sourceType: "affiliate_transaction",
      sourceId: id,
      userId: buyerId,
      companyId: merchant.company_id,
      day,
      goodsAmount: afterVoucher,
      earnPercent: overdue || overLimit ? 0 : Number(row.earn_percent),
      countSpend: false,
    });
    const skipReason: AffiliateSkipReason | null = overdue ? "overdue" : overLimit ? "credit_limit" : earned.skipReason;
    const pointValue = snapshot.point_value === null ? null : Number(snapshot.point_value);
    await executor.execute(sql`
      UPDATE affiliate.transactions SET status = 'completed', buyer_user_id = ${buyerId}, redeemed_points = ${redeemed.points}, redeemed_amount = ${redeemed.amount},
        paid_amount = ${paid}, earned_points = ${earned.points}, earned_amount = ${pointValue === null ? 0 : Math.round(earned.points * pointValue)}, skip_reason = ${skipReason},
        point_value = ${pointValue}, voucher_code_id = ${input.voucherCodeId}, voucher_discount = ${voucher.discount}, voucher_payable = ${voucher.payable}, completed_at = now()
      WHERE id = ${id}`);
    await this.accounting.record(executor, await transactionDraft(executor, id));
  }

  // Hủy (QUYTAC_NGHIEPVU_400): chủ cửa hàng, tuần chưa chốt; hoàn điểm đã dùng, trừ lại điểm đã tích (thiếu thì cửa hàng vẫn trả phần thiếu).
  async cancel(member: PortalMember, id: string, reason: string): Promise<AffiliateTransactionItem> {
    requireOwner(member);
    await this.cancelFor(counterOfMember(member), id, reason);
    return this.transaction(member, id);
  }

  // Hủy bởi chủ cửa hàng hoặc phần mềm cửa hàng qua Open API (bổ sung QUYTAC_NGHIEPVU_400, CONG_VIEC_67).
  async cancelFor(counter: CounterActor, id: string, reason: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: string; settlement_id: string | null; merchant_id: string; buyer_user_id: string; document_no: string; voucher_code_id: string | null }>(sql`
          SELECT status, settlement_id, merchant_id, buyer_user_id, document_no, voucher_code_id FROM affiliate.transactions WHERE id = ${id} AND merchant_id = ${counter.merchantId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "completed") throw new ApiError("BUSINESS_RULE", "affiliateTransactionNotCancellable");
      if (row.settlement_id) throw new ApiError("BUSINESS_RULE", "affiliateWeekSettled");
      if (row.voucher_code_id) await releaseVoucherWithin(transaction, row.voucher_code_id);
      const result = await this.ledger.cancelWithin(transaction, { sourceType: "affiliate_transaction", sourceId: id, companyId: counter.companyId, day: await vietnamToday(transaction) });
      await transaction.execute(sql`
        UPDATE affiliate.transactions SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by = ${counter.cashierUserId}, cancelled_api_key_id = ${counter.apiKey?.id ?? null},
          cancelled_at = now(), shortfall_amount = ${result.shortfallAmount}
        WHERE id = ${id}`);
      await this.accounting.record(transaction, await transactionCancelDraft(transaction, id));
      await notify(transaction, [
        {
          userId: row.buyer_user_id,
          companyId: counter.companyId,
          kind: "affiliate.cancelled",
          title: `Giao dịch ${row.document_no} tại cửa hàng liên kết đã bị hủy`,
          payload: { transactionId: id, refundedPoints: result.refundedPoints, reversedPoints: result.reversedPoints },
        },
      ]);
      await this.audit.record(
        {
          actorUserId: counter.cashierUserId,
          companyId: counter.companyId,
          appCode: "affiliate",
          action: "affiliate_transaction.cancel",
          entityType: "affiliate_transaction",
          entityId: id,
          // Hủy qua Open API: tác nhân là khóa (QUYTAC_NGHIEPVU_493).
          afterData: { reason, ...result, ...(counter.apiKey ? { apiKeyId: counter.apiKey.id, keyName: counter.apiKey.name, keyPrefix: counter.apiKey.prefix } : {}) },
          ip: counter.client.ip,
          userAgent: counter.client.userAgent,
          requestId: counter.client.requestId,
        },
        transaction,
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Người mua (API_209).
  // ---------------------------------------------------------------------------

  private async requestOf(executor: Executor, id: string, buyerId: string): Promise<BuyerAffiliateRequest> {
    const row = (
      await executor.execute<{
        id: string;
        document_no: string;
        merchant_name: string;
        outlet_name: string;
        bill_amount: string;
        voucher_discount: string;
        expires_at: Date;
        earn_percent: string;
        merchant_id: string;
      }>(sql`
        SELECT t.id, t.document_no, p.name AS merchant_name, o.name AS outlet_name, t.bill_amount::text, t.voucher_discount::text, t.expires_at, t.earn_percent::text, t.merchant_id
        FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id JOIN affiliate.outlets o ON o.id = t.outlet_id
        WHERE t.id = ${id}`)
    ).rows[0]!;
    const quote = await this.ledger.quoteRedemption(executor, {
      userId: buyerId,
      sourceType: "affiliate_transaction",
      day: await vietnamToday(executor),
      goodsAmount: Number(row.bill_amount) - Number(row.voucher_discount),
    });
    return {
      transactionId: row.id,
      documentNo: row.document_no,
      merchantName: row.merchant_name,
      outletName: row.outlet_name,
      billAmount: trimDecimal(row.bill_amount),
      expiresAt: iso(row.expires_at)!,
      balance: quote.balance,
      minPoints: quote.minPoints,
      maxPoints: quote.maxPoints,
      pointValue: quote.pointValue === null ? null : String(quote.pointValue),
      redeemable: quote.redeemable,
      blockedReason: quote.blockedReason,
      earnPercent: trimDecimal(row.earn_percent),
      vouchers: await usableCodes(executor, buyerId, row.merchant_id, Number(row.bill_amount)),
    };
  }

  // Giao dịch chờ khách xác nhận: cách 1 tìm theo mã QR (chưa có khách), cách 3 theo người mua.
  private async pendingFor(executor: Executor, buyerId: string, transactionId: string | null, code: string | undefined, lock: boolean): Promise<string> {
    const token = code?.startsWith(qrPrefix) ? code.slice(qrPrefix.length) : null;
    const row = (
      await executor.execute<{ id: string }>(sql`
        SELECT id FROM affiliate.transactions
        WHERE status = 'pending' AND expires_at > now()
          AND ${token ? sql`token_hash = ${hash(token)} AND buyer_user_id IS NULL` : sql`id = ${transactionId} AND method = 'phone' AND buyer_user_id = ${buyerId}`}
          ${token && transactionId ? sql`AND id = ${transactionId}` : sql``}
        ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("BUSINESS_RULE", code ? "affiliateCodeInvalid" : "affiliateTransactionExpired");
    return row.id;
  }

  async scan(buyerId: string, code: string): Promise<BuyerAffiliateRequest> {
    if (!code.startsWith(qrPrefix)) throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
    return this.requestOf(this.database, await this.pendingFor(this.database, buyerId, null, code, false), buyerId);
  }

  async pending(buyerId: string): Promise<BuyerAffiliateRequest[]> {
    const rows = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM affiliate.transactions WHERE buyer_user_id = ${buyerId} AND method = 'phone' AND status = 'pending' AND expires_at > now() ORDER BY created_at DESC`);
    const result = [];
    for (const row of rows.rows) result.push(await this.requestOf(this.database, row.id, buyerId));
    return result;
  }

  async confirm(buyerId: string, transactionId: string, points: number, code: string | undefined, voucherCodeId: string | null): Promise<BuyerAffiliateTransaction> {
    await this.database.transaction(async (transaction) => {
      const id = await this.pendingFor(transaction, buyerId, transactionId, code, true);
      await this.complete(transaction, id, buyerId, { points, voucherCodeId, capToMax: false });
    });
    return (await this.history(buyerId, transactionId))[0]!;
  }

  async decline(buyerId: string, transactionId: string, code: string | undefined): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const id = await this.pendingFor(transaction, buyerId, transactionId, code, true);
      await transaction.execute(sql`UPDATE affiliate.transactions SET status = 'declined', buyer_user_id = coalesce(buyer_user_id, ${buyerId}) WHERE id = ${id}`);
    });
  }

  async memberCode(buyerId: string, points: number, voucherCodeId: string | null): Promise<BuyerMemberCode> {
    const buyer = (await this.database.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${buyerId}`)).rows[0];
    if (!buyer) throw new ApiError("FORBIDDEN", "forbidden");
    return issueMemberCode(buyerId, points, voucherCodeId, new Date());
  }

  async history(buyerId: string, transactionId: string | null = null): Promise<BuyerAffiliateTransaction[]> {
    const rows = await this.database.execute<{
      id: string;
      document_no: string;
      merchant_name: string;
      outlet_name: string;
      status: AffiliateTransactionStatus;
      bill_amount: string;
      voucher_discount: string;
      redeemed_points: number;
      redeemed_amount: string;
      paid_amount: string | null;
      earned_points: number;
      skip_reason: AffiliateSkipReason | null;
      created_at: Date;
    }>(sql`
      SELECT t.id, t.document_no, p.name AS merchant_name, o.name AS outlet_name, t.status, t.bill_amount::text, t.voucher_discount::text, t.redeemed_points,
        t.redeemed_amount::text, t.paid_amount::text, t.earned_points, t.skip_reason, t.created_at
      FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id JOIN affiliate.outlets o ON o.id = t.outlet_id
      WHERE t.buyer_user_id = ${buyerId} AND t.status IN ('completed', 'cancelled') ${transactionId ? sql`AND t.id = ${transactionId}` : sql``}
      ORDER BY t.created_at DESC LIMIT 50`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      merchantName: row.merchant_name,
      outletName: row.outlet_name,
      status: row.status,
      billAmount: trimDecimal(row.bill_amount),
      voucherDiscount: trimDecimal(row.voucher_discount),
      redeemedPoints: row.redeemed_points,
      redeemedAmount: trimDecimal(row.redeemed_amount),
      paidAmount: row.paid_amount === null ? null : trimDecimal(row.paid_amount),
      earnedPoints: row.earned_points,
      skipReason: row.skip_reason,
      createdAt: iso(row.created_at)!,
    }));
  }
}
