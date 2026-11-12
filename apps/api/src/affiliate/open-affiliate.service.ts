// API điểm thưởng cho phần mềm cửa hàng liên kết (CONG_VIEC_67; CHUC_NANG_235; QUYTAC_NGHIEPVU_495; API_296, API_298 đến API_300).
// Khóa API phạm vi `loyalty.member` gắn một cửa hàng và danh sách điểm bán; giao dịch đi qua cùng service với cổng cửa hàng (CONG_VIEC_55).
import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliateSkipReason,
  AffiliateTransactionMethod,
  AffiliateTransactionSource,
  AffiliateTransactionStatus,
  OpenAffiliateOutlet,
  OpenAffiliateQuote,
  OpenAffiliateTransaction,
  PageResponse,
  openAffiliateListQuerySchema,
  openAffiliateOtpSchema,
  openAffiliateQuoteSchema,
  openAffiliateTransactionSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { PhoneOtpService } from "../auth/phone-otp.service";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { isUniqueViolation, violatedConstraint } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { estimateEarnPoints, LoyaltyLedgerService } from "../loyalty/ledger.service";
import { SmartOtpService } from "../loyalty/smart-otp.service";
import { vietnamToday } from "../marketplace/shop.service";
import type { OpenApiCaller } from "../open-api/api-key.guard";
import { AffiliateTransactionsService, maskName, readMemberCode, type CounterActor } from "./transactions.service";
import { usableCodes } from "./vouchers.service";

type Executor = Pick<Database, "execute">;
export interface OpenCallContext {
  ip: string | null;
  requestId: string | null;
}

type KeyMerchant = {
  merchant_id: string;
  company_id: string;
  status: string;
  in_contract: boolean;
  earn_percent: string;
  transaction_cap: string;
  sms_fee: string;
  sms_daily_limit: number;
  outlet_ids: string[];
};

type Row = {
  partner_transaction_code: string | null;
  document_no: string;
  method: AffiliateTransactionMethod;
  source: AffiliateTransactionSource;
  status: AffiliateTransactionStatus;
  outlet_id: string;
  outlet_name: string;
  buyer_name: string | null;
  bill_amount: string;
  voucher_discount: string;
  redeemed_points: number;
  redeemed_amount: string;
  paid_amount: string | null;
  earned_points: number;
  skip_reason: AffiliateSkipReason | null;
  created_at: Date;
  completed_at: Date | null;
  expires_at: Date | null;
  cancel_reason: string | null;
};

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const select = sql`
  SELECT t.id, t.partner_transaction_code, t.document_no, t.method, t.source,
    CASE WHEN t.status = 'pending' AND t.expires_at < now() THEN 'expired' ELSE t.status END AS status,
    t.outlet_id, o.name AS outlet_name, b.full_name AS buyer_name, t.bill_amount::text, t.voucher_discount::text, t.redeemed_points, t.redeemed_amount::text,
    t.paid_amount::text, t.earned_points, t.skip_reason, t.created_at, t.completed_at, t.expires_at, t.cancel_reason
  FROM affiliate.transactions t JOIN affiliate.outlets o ON o.id = t.outlet_id LEFT JOIN core.users b ON b.id = t.buyer_user_id`;

const itemOf = (row: Row): OpenAffiliateTransaction => ({
  partnerTransactionCode: row.partner_transaction_code,
  documentNo: row.document_no,
  method: row.method,
  source: row.source,
  status: row.status,
  outletId: row.outlet_id,
  outletName: row.outlet_name,
  buyerName: maskName(row.buyer_name),
  billAmount: trimDecimal(row.bill_amount),
  voucherDiscount: trimDecimal(row.voucher_discount),
  redeemedPoints: row.redeemed_points,
  redeemedAmount: trimDecimal(row.redeemed_amount),
  paidAmount: row.paid_amount === null ? null : trimDecimal(row.paid_amount),
  earnedPoints: row.earned_points,
  skipReason: row.skip_reason,
  createdAt: iso(row.created_at)!,
  completedAt: iso(row.completed_at),
  expiresAt: row.status === "pending" ? iso(row.expires_at) : null,
  cancelReason: row.cancel_reason,
});

@Injectable()
export class OpenAffiliateService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly transactions: AffiliateTransactionsService,
    private readonly ledger: LoyaltyLedgerService,
    private readonly smartOtp: SmartOtpService,
    private readonly phoneOtp: PhoneOtpService,
  ) {}

  // Cửa hàng, điểm bán của khóa. Khóa `loyalty.member` luôn gắn cửa hàng (cấp ở màn hình Cửa hàng liên kết).
  private async keyMerchant(caller: OpenApiCaller): Promise<KeyMerchant> {
    const row = (
      await this.database.execute<KeyMerchant>(sql`
      SELECT m.id AS merchant_id, m.company_id, m.status, m.earn_percent::text, m.transaction_cap::text, m.sms_fee::text, ak.sms_daily_limit,
        (m.starts_on <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (m.ends_on IS NULL OR m.ends_on >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)) AS in_contract,
        ARRAY(SELECT outlet_id::text FROM affiliate.api_key_outlets WHERE api_key_id = ak.api_key_id) AS outlet_ids
      FROM affiliate.api_keys ak JOIN affiliate.merchants m ON m.id = ak.merchant_id
      WHERE ak.api_key_id = ${caller.keyId} AND m.company_id = ${caller.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("SCOPE_NOT_GRANTED", "scopeNotGranted");
    return row;
  }

  // Giao dịch, tra điểm, gửi mã: cửa hàng đang hoạt động, trong hợp đồng; điểm bán thuộc khóa, đang hoạt động; tiền ≤ trần (QUYTAC_NGHIEPVU_495 mục 4, 5).
  private async usable(caller: OpenApiCaller, outletId: string, billAmount: string): Promise<KeyMerchant> {
    const merchant = await this.keyMerchant(caller);
    if (merchant.status !== "active" || !merchant.in_contract) throw new ApiError("BUSINESS_RULE", "affiliateMerchantInactive");
    const outlet = merchant.outlet_ids.includes(outletId)
      ? (await this.database.execute<{ status: string }>(sql`SELECT status FROM affiliate.outlets WHERE id = ${outletId} AND merchant_id = ${merchant.merchant_id}`)).rows[0]
      : undefined;
    if (!outlet || outlet.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { outletId: "affiliateApiKeyOutletInvalid" } });
    if (Number(billAmount) > Number(merchant.transaction_cap)) throw new ApiError("BUSINESS_RULE", "affiliateBillOverCap");
    return merchant;
  }

  async outlets(caller: OpenApiCaller): Promise<OpenAffiliateOutlet[]> {
    const merchant = await this.keyMerchant(caller);
    const rows = await this.database.execute<{ id: string; name: string; address: string; status: string }>(sql`
      SELECT o.id, o.name, o.address, o.status FROM affiliate.outlets o JOIN affiliate.api_key_outlets ko ON ko.outlet_id = o.id
      WHERE ko.api_key_id = ${caller.keyId} AND o.merchant_id = ${merchant.merchant_id} ORDER BY o.name`);
    return rows.rows.map((row) => ({ id: row.id, name: row.name, address: row.address, active: row.status === "active" }));
  }

  private async buyerByPhone(executor: Executor, phone: string): Promise<{ id: string; full_name: string }> {
    const buyer = (
      await executor.execute<{ id: string; full_name: string }>(sql`
      SELECT u.id, u.full_name FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.phone = ${phone} AND u.status = 'active'`)
    ).rows[0];
    if (!buyer) throw new ApiError("BUSINESS_RULE", "affiliatePhoneNoAccount");
    return buyer;
  }

  // Tra điểm (YCAU_NGHIEPVU_169): điểm dùng được, điểm dự kiến, voucher; không trả số dư, số điện thoại, tên đầy đủ. Không giữ điểm, không lập giao dịch.
  async quote(caller: OpenApiCaller, input: z.output<typeof openAffiliateQuoteSchema>): Promise<OpenAffiliateQuote> {
    const merchant = await this.usable(caller, input.outletId, input.billAmount);
    let buyer: { id: string; full_name: string };
    if (input.memberCode) {
      // Mã thành viên chỉ đọc, không đánh dấu đã dùng; dùng khi lập giao dịch.
      const code = readMemberCode(input.memberCode, new Date());
      const row = (
        await this.database.execute<{ id: string; full_name: string }>(sql`
        SELECT u.id, u.full_name FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.id = ${code.userId} AND u.status = 'active'`)
      ).rows[0];
      if (!row) throw new ApiError("BUSINESS_RULE", "affiliateCodeInvalid");
      buyer = row;
    } else buyer = await this.buyerByPhone(this.database, input.phone!);
    const day = await vietnamToday(this.database);
    const bill = Number(input.billAmount);
    const quote = await this.ledger.quoteRedemption(this.database, { userId: buyer.id, sourceType: "affiliate_transaction", day, goodsAmount: bill });
    const vouchers = await usableCodes(this.database, buyer.id, merchant.merchant_id, bill);
    return {
      buyerName: maskName(buyer.full_name),
      redeemable: quote.redeemable,
      blockedReason: quote.blockedReason,
      minPoints: quote.minPoints,
      maxPoints: quote.maxPoints,
      pointValue: quote.pointValue === null ? null : String(quote.pointValue),
      estimatedEarnPoints: await estimateEarnPoints(this.database, { userId: buyer.id, day, amount: bill, earnPercent: Number(merchant.earn_percent) }),
      vouchers: vouchers.map((voucher) => ({ id: voucher.id, title: voucher.titleVi, discount: voucher.discount, expiresAt: voucher.expiresAt })),
      smartOtpActive: (await this.smartOtp.state(this.database, buyer.id)).active,
    };
  }

  // API_297: gửi mã OTP SMS cho khách chưa kích hoạt Smart OTP; tin gửi được tính phí theo hợp đồng (THAY_DOI_31).
  async sendOtp(caller: OpenApiCaller, input: z.output<typeof openAffiliateOtpSchema>): Promise<void> {
    const merchant = await this.usable(caller, input.outletId, "0");
    const buyer = await this.buyerByPhone(this.database, input.phone);
    if ((await this.smartOtp.state(this.database, buyer.id)).active) throw new ApiError("BUSINESS_RULE", "affiliateSmartOtpActive");
    const sentToday = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM affiliate.sms_charges
      WHERE api_key_id = ${caller.keyId} AND sent_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')`)
    ).rows[0]!.total;
    if (sentToday >= merchant.sms_daily_limit) throw new ApiError("RATE_LIMITED", "affiliateSmsLimit");
    // Giới hạn 5 mã mỗi giờ mỗi số (tính chung mọi mục đích) nằm trong PhoneOtpService.
    if (await this.phoneOtp.send(input.phone, "affiliate_redeem")) {
      await this.database.execute(sql`
        INSERT INTO affiliate.sms_charges (merchant_id, api_key_id, buyer_user_id, unit_price) VALUES (${merchant.merchant_id}, ${caller.keyId}, ${buyer.id}, ${merchant.sms_fee})`);
    }
  }

  // Cách OTP: Smart OTP khi khách đã kích hoạt, ngược lại mã SMS; mã sai không lập giao dịch.
  private async verifyOtp(merchant: KeyMerchant, phone: string, code: string): Promise<string> {
    const buyer = await this.buyerByPhone(this.database, phone);
    if ((await this.smartOtp.state(this.database, buyer.id)).active) {
      try {
        await this.smartOtp.verify(buyer.id, code, merchant.company_id);
      } catch (error) {
        if (error instanceof ApiError && error.message === "retailSmartOtpInvalid") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { otp: "retailSmartOtpInvalid" } });
        throw error;
      }
    } else if (!(await this.phoneOtp.consume(phone, code, "affiliate_redeem"))) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { otp: "affiliateOtpInvalid" } });
    }
    return buyer.id;
  }

  private async byCode(merchantId: string, code: string): Promise<OpenAffiliateTransaction | null> {
    const row = (await this.database.execute<Row>(sql`${select} WHERE t.merchant_id = ${merchantId} AND t.source = 'open_api' AND t.partner_transaction_code = ${code}`)).rows[0];
    return row ? itemOf(row) : null;
  }

  // API_298: tạo giao dịch; mã giao dịch đối tác đã có thì trả giao dịch cũ (200), không so nội dung.
  async create(caller: OpenApiCaller, input: z.output<typeof openAffiliateTransactionSchema>, context: OpenCallContext): Promise<{ created: boolean; transaction: OpenAffiliateTransaction }> {
    const merchant = await this.keyMerchant(caller);
    const existing = await this.byCode(merchant.merchant_id, input.partnerTransactionCode);
    if (existing) return { created: false, transaction: existing };
    await this.usable(caller, input.outletId, input.billAmount);
    const verified = input.method === "otp" ? { buyerId: await this.verifyOtp(merchant, input.phone!, input.otp!), points: input.points, voucherCodeId: input.voucherCodeId } : undefined;
    const counter: CounterActor = {
      merchantId: merchant.merchant_id,
      companyId: merchant.company_id,
      cashierUserId: null,
      apiKey: { id: caller.keyId, name: caller.keyName, prefix: caller.keyPrefix, partnerTransactionCode: input.partnerTransactionCode },
      client: { ip: context.ip, userAgent: null, requestId: context.requestId },
    };
    try {
      await this.transactions.createFor(counter, {
        outletId: input.outletId,
        billAmount: input.billAmount,
        method: input.method === "member_code" ? "buyer_qr" : input.method,
        memberCode: input.memberCode,
        phone: input.phone,
        ...(verified ? { verified } : {}),
      });
    } catch (error) {
      // Hai lần gửi cùng mã cùng lúc: lần sau trả giao dịch của lần trước.
      if (isUniqueViolation(error) && violatedConstraint(error) === "transactions_partner_code_idx") {
        const raced = await this.byCode(merchant.merchant_id, input.partnerTransactionCode);
        if (raced) return { created: false, transaction: raced };
      }
      throw error;
    }
    return { created: true, transaction: (await this.byCode(merchant.merchant_id, input.partnerTransactionCode))! };
  }

  async detail(caller: OpenApiCaller, code: string): Promise<OpenAffiliateTransaction> {
    const merchant = await this.keyMerchant(caller);
    const found = await this.byCode(merchant.merchant_id, code);
    if (!found) throw new ApiError("NOT_FOUND", "notFound");
    return found;
  }

  // API_299: giao dịch cửa hàng tạo qua Open API (mọi khóa của cửa hàng).
  async list(caller: OpenApiCaller, query: z.output<typeof openAffiliateListQuerySchema>): Promise<PageResponse<OpenAffiliateTransaction>> {
    const merchant = await this.keyMerchant(caller);
    const day = sql`(t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const status = sql`CASE WHEN t.status = 'pending' AND t.expires_at < now() THEN 'expired' ELSE t.status END`;
    const where = sql`t.merchant_id = ${merchant.merchant_id} AND t.source = 'open_api'
      ${query.status ? sql`AND ${status} = ${query.status}` : sql``}
      ${query.from ? sql`AND ${day} >= ${query.from}::date` : sql``}
      ${query.to ? sql`AND ${day} <= ${query.to}::date` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM affiliate.transactions t WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<Row>(sql`${select} WHERE ${where} ORDER BY t.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(itemOf), page: query.page, pageSize: query.pageSize, total };
  }

  // API_300: hủy như chủ cửa hàng (bổ sung QUYTAC_NGHIEPVU_400).
  async cancel(caller: OpenApiCaller, code: string, reason: string, context: OpenCallContext): Promise<OpenAffiliateTransaction> {
    const merchant = await this.keyMerchant(caller);
    const id = (
      await this.database.execute<{ id: string }>(sql`
      SELECT id FROM affiliate.transactions WHERE merchant_id = ${merchant.merchant_id} AND source = 'open_api' AND partner_transaction_code = ${code}`)
    ).rows[0]?.id;
    if (!id) throw new ApiError("NOT_FOUND", "notFound");
    await this.transactions.cancelFor(
      {
        merchantId: merchant.merchant_id,
        companyId: merchant.company_id,
        cashierUserId: null,
        apiKey: { id: caller.keyId, name: caller.keyName, prefix: caller.keyPrefix, partnerTransactionCode: null },
        client: { ip: context.ip, userAgent: null, requestId: context.requestId },
      },
      id,
      reason,
    );
    return (await this.byCode(merchant.merchant_id, code))!;
  }
}
