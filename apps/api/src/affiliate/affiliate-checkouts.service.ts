// CONG_VIEC_73 lát L4: đơn chờ thanh toán tại cửa hàng liên kết (QUYTAC_NGHIEPVU_573, 575 đến 578, 581, 584; API_329, API_332).
// Bộ xử lý loại "affiliate" dùng chung cho cổng cửa hàng, Open API, iPOS: điểm, voucher theo CONG_VIEC_55; giao dịch LK… lập khi khách bấm thanh toán, xác nhận
// và hoàn tất khi tiền về (thu hộ) hoặc ngay khi khách xác nhận (thu tại quầy). Phần mềm cửa hàng (iPOS) đăng ký móc để ghi chứng từ của mình cùng giao dịch.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  affiliateCollectionSchema,
  AffiliateCollectionResponse,
  AffiliateTransactionSource,
  createMerchantCheckoutSchema,
  InstoreCheckoutLoyalty,
  InstoreCheckoutVoucher,
  InstoreGatewayFeesResponse,
  instoreGatewayFeesSchema,
  MerchantCheckoutResponse,
  PaymentMethodCode,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { redeemLockedUntil } from "../auth/account-security";
import { maskName } from "../auth/smart-otp.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { InstoreCheckoutsService, type CheckoutKindHandler, type CheckoutRow, type DatabaseTransaction, type RedeemResult } from "../instore/checkouts.service";
import { LoyaltyLedgerService } from "../loyalty/ledger.service";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { gatewayConfigured, isOnlineMethod } from "../marketplace/payments/payment-gateway-registry";
import { vietnamToday } from "../marketplace/shop.service";
import type { Actor } from "../permissions/roles.service";
import { type PortalMember } from "./portal.service";
import { feeTaxRate } from "./settlements.service";
import { AffiliateTransactionsService } from "./transactions.service";
import { usableCodes } from "./vouchers.service";

type Executor = Pick<Database, "execute">;

// Mỗi thu ngân cửa hàng liên kết (cổng hoặc iPOS) giữ tối đa ba đơn chờ cùng lúc (QUYTAC_NGHIEPVU_575).
const cashierOpenLimit = 3;
const openStatuses = ["awaiting_buyer", "awaiting_payment"];
const appWebBase = () => (process.env.VCOMM_WEB_URL?.trim() || "http://localhost:8083").replace(/\/+$/, "");
const sourceOf = (source: CheckoutRow["source"]): AffiliateTransactionSource => (source === "open_api" ? "open_api" : source === "ipos" ? "ipos" : "portal");

type MerchantRow = {
  id: string;
  company_id: string;
  partner_id: string;
  status: string;
  in_contract: boolean;
  transaction_cap: string;
  collection_enabled: boolean;
  collection_fee_percent: string;
  payout_bank_account_id: string | null;
  collection_acknowledged_at: Date | null;
  version: number;
};

@Injectable()
export class AffiliateCheckoutsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly instore: InstoreCheckoutsService,
    private readonly transactions: AffiliateTransactionsService,
    private readonly loyalty: LoyaltyLedgerService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    const handler: CheckoutKindHandler = {
      loyalty: (executor, row, userId) => this.loyaltyFor(executor, row, userId),
      vouchers: (executor, row, userId) => this.vouchersFor(executor, row, userId),
      redeem: (transaction, row, userId, input) => this.redeem(transaction, row, userId, input),
      release: async (transaction, row) => {
        if (row.affiliate_transaction_id) await this.transactions.releaseForCheckout(transaction, row.affiliate_transaction_id);
      },
      platformFeePercent: async (executor, row) => Number((await this.merchant(executor, row.merchant_id!)).collection_fee_percent),
      complete: (transaction, row, appAmount) => this.complete(transaction, row, appAmount),
    };
    this.instore.registerHandler("affiliate", handler);
  }

  private async merchant(executor: Executor, merchantId: string, lock = false): Promise<MerchantRow> {
    const row = (
      await executor.execute<MerchantRow>(sql`
        SELECT m.id, m.company_id, m.partner_id, m.status, m.transaction_cap::text, m.collection_enabled, m.collection_fee_percent::text, m.payout_bank_account_id,
          m.collection_acknowledged_at, m.version,
          (m.starts_on <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (m.ends_on IS NULL OR m.ends_on >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)) AS in_contract
        FROM affiliate.merchants m WHERE m.id = ${merchantId} ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // ---------------------------------------------------------------------------
  // Bộ xử lý loại "affiliate".
  // ---------------------------------------------------------------------------

  // Giới hạn điểm theo QUYTAC_NGHIEPVU_399 trên tiền hóa đơn (chưa chọn voucher); voucher làm giảm mức tối đa (xem danh sách voucher).
  private async loyaltyFor(executor: Executor, row: CheckoutRow, userId: string): Promise<InstoreCheckoutLoyalty> {
    const quote = await this.loyalty.quoteRedemption(executor, {
      userId,
      sourceType: "affiliate_transaction",
      day: await vietnamToday(executor),
      goodsAmount: Number(row.bill_amount),
    });
    return {
      balance: quote.balance,
      minPoints: quote.minPoints,
      maxPoints: quote.maxPoints,
      pointValue: quote.pointValue === null ? null : String(quote.pointValue),
      blockedReason: quote.blockedReason,
      redeemLockedUntil: await redeemLockedUntil(executor, userId),
    };
  }

  private async vouchersFor(executor: Executor, row: CheckoutRow, userId: string): Promise<InstoreCheckoutVoucher[]> {
    const day = await vietnamToday(executor);
    const codes = await usableCodes(executor, userId, row.merchant_id!, Number(row.bill_amount));
    const result: InstoreCheckoutVoucher[] = [];
    for (const code of codes) {
      const quote = await this.loyalty.quoteRedemption(executor, {
        userId,
        sourceType: "affiliate_transaction",
        day,
        goodsAmount: Number(row.bill_amount) - Number(code.discount),
      });
      result.push({ codeId: code.id, titleVi: code.titleVi, titleEn: code.titleEn, discount: code.discount, maxPoints: quote.maxPoints, expiresAt: code.expiresAt });
    }
    return result;
  }

  // Khách bấm thanh toán, xác nhận: lập giao dịch LK… chờ, dùng voucher, điểm ngay (QUYTAC_NGHIEPVU_578).
  private async redeem(transaction: DatabaseTransaction, row: CheckoutRow, userId: string, input: { points: number; voucherCodeId: string | null }): Promise<RedeemResult> {
    const reserved = await this.transactions.reserveForCheckout(transaction, {
      checkoutId: row.id,
      merchantId: row.merchant_id!,
      outletId: row.outlet_id!,
      source: sourceOf(row.source),
      cashierUserId: row.created_by_user_id,
      apiKeyId: row.api_key_id,
      method: row.buyer_attached_via === "pay_code" ? "buyer_qr" : "merchant_qr",
      buyerId: userId,
      billAmount: row.bill_amount,
      expiresAt: new Date(row.expires_at).toISOString(),
      points: input.points,
      voucherCodeId: input.voucherCodeId,
    });
    return { points: reserved.points, amount: reserved.amount, voucherAmount: reserved.voucherDiscount, reservedSaleId: null, affiliateTransactionId: reserved.id };
  }

  // Hoàn tất (QUYTAC_NGHIEPVU_581): tích điểm, ghi LK… kèm tiền thu hộ, phí; móc của phần mềm cửa hàng ghi chứng từ của nó trong cùng giao dịch.
  private async complete(transaction: DatabaseTransaction, row: CheckoutRow, appAmount: number): Promise<string> {
    const id = row.affiliate_transaction_id;
    if (!id) throw new ApiError("BUSINESS_RULE", "instoreCheckoutClosed");
    const collected = appAmount > 0 ? { amount: appAmount, platformFee: Number(row.platform_fee), gatewayFee: Number(row.gateway_fee) } : { amount: 0, platformFee: 0, gatewayFee: 0 };
    const documentNo = await this.transactions.finishForCheckout(transaction, id, collected);
    const hook = this.instore.completionHook(row.source);
    if (hook) {
      const dueAtCounter = row.collect_in_app ? 0 : Math.max(Number(row.bill_amount) - Number(row.voucher_amount) - Number(row.points_amount), 0);
      const invoiceId = await hook(transaction, row, {
        affiliateTransactionId: id,
        documentNo,
        points: row.points,
        pointsAmount: row.points_amount,
        voucherAmount: row.voucher_amount,
        appAmount: String(appAmount),
        dueAtCounter: String(dueAtCounter),
      });
      if (invoiceId) await transaction.execute(sql`UPDATE instore.checkouts SET ipos_invoice_id = ${invoiceId} WHERE id = ${row.id}`);
    }
    return id;
  }

  // ---------------------------------------------------------------------------
  // Cổng cửa hàng (API_329; MAN_HINH_174).
  // ---------------------------------------------------------------------------

  // Tạo đơn chờ: thu hộ chỉ khi cửa hàng đã bật; tiền hóa đơn không vượt hạn mức một giao dịch; mỗi thu ngân tối đa ba đơn chờ.
  // Có mã thanh toán của khách thì gắn khách ngay (luồng 1); gắn không được thì đóng đơn vừa tạo.
  async create(member: PortalMember, input: z.infer<typeof createMerchantCheckoutSchema>): Promise<MerchantCheckoutResponse> {
    if (member.role === "cashier" && !member.outletIds.includes(input.outletId)) throw new ApiError("FORBIDDEN", "forbidden");
    const merchant = await this.merchant(this.database, member.merchantId);
    if (merchant.status !== "active" || !merchant.in_contract) throw new ApiError("BUSINESS_RULE", "affiliateMerchantInactive");
    const outlet = (await this.database.execute<{ status: string }>(sql`SELECT status FROM affiliate.outlets WHERE id = ${input.outletId} AND merchant_id = ${member.merchantId}`))
      .rows[0];
    if (!outlet || outlet.status !== "active") throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { outletId: "invalidValue" } });
    if (Number(input.billAmount) > Number(merchant.transaction_cap)) throw new ApiError("BUSINESS_RULE", "affiliateBillOverCap");
    if (input.collectInApp && !merchant.collection_enabled) throw new ApiError("BUSINESS_RULE", "instoreCollectionDisabled");
    const operator = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator AND status = 'active'`)).rows[0];
    if (!operator) throw new ApiError("BUSINESS_RULE", "instoreNoGateway");
    const { created, row, qrToken } = await this.database.transaction(async (transaction) => {
      // Xếp hàng theo thu ngân để đếm đơn chờ đúng khi gửi cùng lúc.
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`instore.cashier:${member.userId}`}))`);
      const open = (
        await transaction.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM instore.checkouts
          WHERE created_by_user_id = ${member.userId} AND kind = 'affiliate' AND status IN ('awaiting_buyer', 'awaiting_payment') AND expires_at > now()
            AND idempotency_key <> ${input.clientKey}`)
      ).rows[0]!.count;
      if (open >= cashierOpenLimit) throw new ApiError("BUSINESS_RULE", "instoreCashierCheckoutLimit");
      const result = await this.instore.create(transaction, {
        operatorCompanyId: operator.id,
        place: { kind: "affiliate", merchantId: member.merchantId, outletId: input.outletId },
        creator: { source: "merchant_portal", userId: member.userId },
        idempotencyKey: input.clientKey,
        billAmount: input.billAmount,
        lines: [],
        collectInApp: input.collectInApp,
      });
      return { created: result.created, row: result.checkout, qrToken: result.qrToken };
    });
    if (input.payCode && created) {
      try {
        const attached = await this.instore.attachPayCode(row.id, input.payCode, { subject: `user:${member.userId}`, companyId: member.companyId });
        return this.response(attached, null, member);
      } catch (error) {
        await this.instore.cancel(row.id, member.userId, "Mã thanh toán không gắn được").catch(() => undefined);
        throw error;
      }
    }
    return this.response(row, created ? qrToken : null, member);
  }

  // Thu ngân xem đơn của mình; chủ cửa hàng xem mọi đơn của cửa hàng.
  private async accessible(member: PortalMember, id: string): Promise<CheckoutRow> {
    const row = await this.instore.find(this.database, id);
    if (!row || row.kind !== "affiliate" || row.merchant_id !== member.merchantId) throw new ApiError("NOT_FOUND", "notFound");
    if (member.role === "owner" || row.created_by_user_id === member.userId) return row;
    throw new ApiError("NOT_FOUND", "notFound");
  }

  async get(member: PortalMember, id: string): Promise<MerchantCheckoutResponse> {
    return this.response(await this.accessible(member, id), null, member);
  }

  async payCode(member: PortalMember, id: string, code: string): Promise<MerchantCheckoutResponse> {
    await this.accessible(member, id);
    return this.response(await this.instore.attachPayCode(id, code, { subject: `user:${member.userId}`, companyId: member.companyId }), null, member);
  }

  // Hủy đơn chưa thanh toán (hoàn điểm, trả voucher). Đơn đã hoàn tất: chủ cửa hàng hủy giao dịch LK… như hiện nay (thu tại quầy);
  // đơn thu hộ đã thu tiền thì hủy và hoàn tiền làm ở lát L7.
  async cancel(member: PortalMember, id: string, reason: string): Promise<MerchantCheckoutResponse> {
    await this.accessible(member, id);
    return this.response(await this.instore.cancel(id, member.userId, reason), null, member);
  }

  async response(row: CheckoutRow, qrToken: string | null, member: PortalMember | null): Promise<MerchantCheckoutResponse> {
    const extra = (
      await this.database.execute<{ outlet_name: string; buyer_name: string | null; transaction_no: string | null; settlement_id: string | null }>(sql`
        SELECT o.name AS outlet_name, u.full_name AS buyer_name, t.document_no AS transaction_no, t.settlement_id
        FROM affiliate.outlets o LEFT JOIN core.users u ON u.id = ${row.buyer_user_id} LEFT JOIN affiliate.transactions t ON t.id = ${row.affiliate_transaction_id}
        WHERE o.id = ${row.outlet_id}`)
    ).rows[0]!;
    const expired = openStatuses.includes(row.status) && new Date(row.expires_at).getTime() <= Date.now();
    const status = expired ? "expired" : row.status;
    const collected = status === "completed" && row.collect_in_app ? Number(row.paid_amount) : 0;
    const fee = collected > 0 ? Number(row.platform_fee) : 0;
    const tax = Math.round((fee * feeTaxRate) / 100);
    const gateway = collected > 0 ? Number(row.gateway_fee) : 0;
    return {
      id: row.id,
      documentNo: row.document_no,
      status,
      outletId: row.outlet_id!,
      outletName: extra.outlet_name,
      billAmount: row.bill_amount,
      collectInApp: row.collect_in_app,
      expiresAt: new Date(row.expires_at).toISOString(),
      qrUrl: qrToken ? `${appWebBase()}/tt/${qrToken}` : null,
      buyer: extra.buyer_name ? { maskedName: maskName(extra.buyer_name), tierName: null } : null,
      points: row.points,
      pointsAmount: row.points_amount,
      voucherAmount: row.voucher_amount,
      amountDue: row.amount_due,
      transactionId: status === "completed" ? row.affiliate_transaction_id : null,
      transactionNo: status === "completed" ? extra.transaction_no : null,
      collectedAmount: String(collected),
      collectionFee: String(fee),
      collectionFeeTax: String(tax),
      gatewayFee: String(gateway),
      payoutAmount: String(Math.max(collected - fee - tax - gateway, 0)),
      feePercent: row.platform_fee_percent,
      canCancel: openStatuses.includes(status) && member !== null,
    };
  }

  // ---------------------------------------------------------------------------
  // Cài đặt thu hộ (API_332; MAN_HINH_279).
  // ---------------------------------------------------------------------------

  async collection(actor: BuyerAdminActor, merchantId: string, canManage: boolean): Promise<AffiliateCollectionResponse> {
    const merchant = await this.merchant(this.database, merchantId);
    if (merchant.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
    const accounts = await this.database.execute<{ id: string; bank_name: string; account_no: string; account_holder: string }>(sql`
      SELECT id, bank_name, account_no, account_holder FROM crm.partner_bank_accounts WHERE partner_id = ${merchant.partner_id} ORDER BY is_default DESC, sort_order, bank_name`);
    return {
      merchantId,
      enabled: merchant.collection_enabled,
      feePercent: String(Number(merchant.collection_fee_percent)),
      payoutBankAccountId: merchant.payout_bank_account_id,
      acknowledgedAt: merchant.collection_acknowledged_at ? new Date(merchant.collection_acknowledged_at).toISOString() : null,
      bankAccounts: accounts.rows.map((row) => ({ id: row.id, bankName: row.bank_name, accountNo: row.account_no, accountHolder: row.account_holder })),
      canManage,
      version: merchant.version,
    };
  }

  // Bật thu hộ cần tài khoản nhận tiền của chính đối tác; bật lần đầu phải xác nhận đã đọc cảnh báo pháp lý (QUYTAC_NGHIEPVU_573). Ghi nhật ký thao tác.
  async updateCollection(actor: BuyerAdminActor, merchantId: string, input: z.infer<typeof affiliateCollectionSchema>): Promise<AffiliateCollectionResponse> {
    await this.database.transaction(async (transaction) => {
      const merchant = await this.merchant(transaction, merchantId, true);
      if (merchant.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
      if (merchant.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (merchant.status === "terminated") throw new ApiError("BUSINESS_RULE", "affiliateMerchantTerminated");
      if (input.payoutBankAccountId) {
        const owned = await transaction.execute(sql`SELECT 1 FROM crm.partner_bank_accounts WHERE id = ${input.payoutBankAccountId} AND partner_id = ${merchant.partner_id}`);
        if (!owned.rows.length) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { payoutBankAccountId: "invalidValue" } });
      }
      if (input.enabled && !input.payoutBankAccountId) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { payoutBankAccountId: "affiliateCollectionAccountRequired" } });
      const firstEnable = input.enabled && !merchant.collection_acknowledged_at;
      if (firstEnable && !input.acknowledged) throw new ApiError("BUSINESS_RULE", "affiliateCollectionAcknowledge");
      await transaction.execute(sql`
        UPDATE affiliate.merchants SET collection_enabled = ${input.enabled}, collection_fee_percent = ${input.feePercent}, payout_bank_account_id = ${input.payoutBankAccountId},
          collection_acknowledged_at = CASE WHEN ${firstEnable} THEN now() ELSE collection_acknowledged_at END,
          collection_acknowledged_by = CASE WHEN ${firstEnable} THEN ${actor.userId}::uuid ELSE collection_acknowledged_by END,
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${merchantId}`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "affiliate_merchant.collection",
          entityType: "affiliate_merchant",
          entityId: merchantId,
          beforeData: {
            enabled: merchant.collection_enabled,
            feePercent: merchant.collection_fee_percent,
            payoutBankAccountId: merchant.payout_bank_account_id,
          },
          afterData: { enabled: input.enabled, feePercent: input.feePercent, payoutBankAccountId: input.payoutBankAccountId, acknowledged: firstEnable },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.collection(actor, merchantId, true);
  }

  // ---------------------------------------------------------------------------
  // Biểu phí cổng tại cửa hàng (API_332; MAN_HINH_280): công ty vận hành sàn cài cho từng phương thức trực tuyến đang bật.
  // ---------------------------------------------------------------------------

  async gatewayFees(actor: Actor, canManage: boolean): Promise<InstoreGatewayFeesResponse> {
    await this.requireOperator(actor.companyId);
    const methods = (
      await this.database.execute<{ code: string; gateway_code: string }>(sql`SELECT code, gateway_code FROM marketplace.payment_methods WHERE is_enabled ORDER BY sort_order`)
    ).rows.filter((row) => isOnlineMethod(row.code as PaymentMethodCode) && gatewayConfigured(row.gateway_code));
    const rates = (
      await this.database.execute<{ method: string; percent: string; fixed_amount: string; effective_from: string; future: boolean }>(sql`
        SELECT method, percent::text, fixed_amount::text, effective_from::text, effective_from > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS future
        FROM instore.gateway_fee_rates WHERE company_id = ${actor.companyId} ORDER BY method, effective_from DESC`)
    ).rows;
    return {
      canManage,
      rows: methods.map((method) => {
        const current = rates.find((rate) => rate.method === method.code && !rate.future);
        const scheduled = rates.filter((rate) => rate.method === method.code && rate.future).pop();
        return {
          method: method.code,
          gatewayCode: method.gateway_code,
          percent: current ? String(Number(current.percent)) : null,
          fixedAmount: current ? String(Number(current.fixed_amount)) : null,
          effectiveFrom: current?.effective_from ?? null,
          scheduled: scheduled ? { percent: String(Number(scheduled.percent)), fixedAmount: String(Number(scheduled.fixed_amount)), effectiveFrom: scheduled.effective_from } : null,
        };
      }),
    };
  }

  // Sửa biểu phí là thêm mức áp dụng từ ngày (không sửa lùi ngày đã qua); cùng ngày thì thay mức đã hẹn. Ghi nhật ký thao tác.
  async saveGatewayFees(actor: Actor, input: z.infer<typeof instoreGatewayFeesSchema>): Promise<InstoreGatewayFeesResponse> {
    await this.requireOperator(actor.companyId);
    const today = await vietnamToday(this.database);
    await this.database.transaction(async (transaction) => {
      for (const rate of input.rates) {
        if (rate.effectiveFrom < today) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { effectiveFrom: "instoreFeeDatePast" } });
        await transaction.execute(sql`
          INSERT INTO instore.gateway_fee_rates (company_id, method, percent, fixed_amount, effective_from, created_by)
          VALUES (${actor.companyId}, ${rate.method}, ${rate.percent}, ${rate.fixedAmount}, ${rate.effectiveFrom}, ${actor.userId})
          ON CONFLICT (company_id, method, effective_from) DO UPDATE SET percent = EXCLUDED.percent, fixed_amount = EXCLUDED.fixed_amount, created_by = EXCLUDED.created_by, created_at = now()`);
      }
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "finance",
          action: "instore.gateway_fees.save",
          entityType: "instore_gateway_fee",
          entityId: actor.companyId,
          afterData: input,
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.gatewayFees(actor, true);
  }

  private async requireOperator(companyId: string): Promise<void> {
    const operator = (await this.database.execute(sql`SELECT 1 FROM core.companies WHERE id = ${companyId} AND is_marketplace_operator`)).rows[0];
    if (!operator) throw new ApiError("BUSINESS_RULE", "instoreOperatorOnly");
  }
}
