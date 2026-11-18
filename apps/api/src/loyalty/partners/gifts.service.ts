// Đối tác liên minh tặng điểm VComm cho khách qua Open API (CONG_VIEC_65; CHUC_NANG_238; QUYTAC_NGHIEPVU_540, 545 đến 547; API_304 phần tặng, API_308).
// Chống tạo trùng bằng mã giao dịch đối tác (chỉ mục duy nhất theo hợp đồng): gửi lại cùng mã trả giao dịch đã có, không so nội dung.
import { Inject, Injectable } from "@nestjs/common";
import type { OpenPartnerGift, PageResponse, PartnerGiftItem, openPartnerGiftListQuerySchema, openPartnerGiftSchema, partnerGiftListQuerySchema } from "contracts";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { LedgerService } from "../../accounting/ledger.service";
import { trimDecimal } from "../../catalog/catalog-context";
import { ApiError } from "../../common/api-error";
import { isUniqueViolation } from "../../common/database-errors";
import { notify } from "../../common/notifications";
import { DATABASE, type Database } from "../../database/database.module";
import type { BuyerAdminActor } from "../../marketplace/buyer-admin.service";
import { vietnamToday } from "../../marketplace/shop.service";
import type { OpenApiCaller } from "../../open-api/api-key.guard";
import { creditLot, reverseLot } from "../ledger.service";
import { phaseOn } from "../program.service";
import { maskName } from "../../auth/smart-otp.service";
import { lockAccount } from "../tiers";
import { rateOn } from "./contracts.service";
import { alertExposure, assertCapacity, lockCapacity, type ExposureContract } from "./exposure";
import { giftDraft, marginTax } from "./postings";

type Executor = Pick<Database, "execute">;
const cancelWindowHours = 24;

type GiftRow = {
  id: string;
  document_no: string;
  contract_id: string;
  contract_code: string;
  company_id: string;
  partner_name: string;
  partner_transaction_code: string;
  user_id: string;
  full_name: string;
  points: number;
  unit_price: string;
  amount: string;
  tax_amount: string;
  point_value_amount: string;
  message: string | null;
  lot_id: string;
  status: "completed" | "cancelled";
  cancel_reason: string | null;
  cancelled_at: Date | null;
  settlement_id: string | null;
  created_at: Date;
};

const giftColumns = sql`g.id, g.document_no, g.contract_id, c.code AS contract_code, c.company_id, p.name AS partner_name, g.partner_transaction_code, g.user_id, u.full_name,
  g.points, g.unit_price::text, g.amount::text, g.tax_amount::text, g.point_value_amount::text, g.message, g.lot_id, g.status, g.cancel_reason, g.cancelled_at, g.settlement_id, g.created_at`;
const giftFrom = sql`loyalty.partner_gifts g JOIN loyalty.partner_contracts c ON c.id = g.contract_id JOIN crm.partners p ON p.id = c.partner_id JOIN core.users u ON u.id = g.user_id`;

const openOf = (row: GiftRow): OpenPartnerGift => ({
  partnerTransactionCode: row.partner_transaction_code,
  documentNo: row.document_no,
  status: row.status,
  points: row.points,
  amount: trimDecimal(row.amount),
  taxAmount: trimDecimal(row.tax_amount),
  customerMasked: maskName(row.full_name),
  message: row.message,
  createdAt: new Date(row.created_at).toISOString(),
  cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
});

const itemOf = (row: GiftRow): PartnerGiftItem => ({
  ...openOf(row),
  id: row.id,
  contractId: row.contract_id,
  contractCode: row.contract_code,
  partnerName: row.partner_name,
  unitPrice: trimDecimal(row.unit_price),
  pointValueAmount: trimDecimal(row.point_value_amount),
  cancelReason: row.cancel_reason,
});

const listWhere = (query: z.infer<typeof openPartnerGiftListQuerySchema>) => sql`
  ${query.status ? sql`AND g.status = ${query.status}` : sql``}
  ${query.from ? sql`AND (g.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${query.from}::date` : sql``}
  ${query.to ? sql`AND (g.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${query.to}::date` : sql``}`;

@Injectable()
export class PartnerGiftsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly ledger: LedgerService,
  ) {}

  // Hợp đồng của khóa: đối tác của khóa là đối tác của hợp đồng, cùng công ty (QUYTAC_NGHIEPVU_545).
  private async contractOf(executor: Executor, caller: OpenApiCaller, lock = false) {
    const row = (
      await executor.execute<ExposureContract & { gift_enabled: boolean; status: string; effective_from: string; effective_to: string | null; program_name: string }>(sql`
        SELECT c.id, c.code, c.company_id, c.partner_id, c.payment_mode, c.credit_limit::text, c.gift_enabled, c.status, c.effective_from::text, c.effective_to::text, c.program_name
        FROM loyalty.partner_contracts c WHERE c.company_id = ${caller.companyId} AND c.partner_id = ${caller.partnerId} ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("FORBIDDEN", "forbidden");
    return row;
  }

  private async byCode(executor: Executor, contractId: string, code: string): Promise<GiftRow | undefined> {
    return (await executor.execute<GiftRow>(sql`SELECT ${giftColumns} FROM ${giftFrom} WHERE g.contract_id = ${contractId} AND g.partner_transaction_code = ${code}`)).rows[0];
  }

  // Tặng điểm: hoàn tất ngay, cộng một lô theo giai đoạn chương trình hôm nay, hạch toán, thông báo khách.
  async create(caller: OpenApiCaller, input: z.infer<typeof openPartnerGiftSchema>): Promise<{ created: boolean; gift: OpenPartnerGift }> {
    const contract = await this.contractOf(this.database, caller);
    const existing = await this.byCode(this.database, contract.id, input.partnerTransactionCode);
    if (existing) return { created: false, gift: openOf(existing) };
    const today = await vietnamToday(this.database);
    const open = contract.status === "active" && contract.effective_from <= today && (contract.effective_to === null || contract.effective_to >= today);
    if (!open) throw new ApiError("BUSINESS_RULE", "partnerNotActive");
    if (!contract.gift_enabled) throw new ApiError("BUSINESS_RULE", "partnerDirectionDisabled");
    const rate = await rateOn(this.database, contract.id, "gift", today);
    if (!rate) throw new ApiError("BUSINESS_RULE", "partnerNoRate");
    const phase = await phaseOn(this.database, today);
    if (!phase) throw new ApiError("BUSINESS_RULE", "loyaltyNoPhase");
    const buyer = (
      await this.database.execute<{ id: string; locked: boolean | null }>(sql`
        SELECT u.id, a.locked FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id LEFT JOIN loyalty.accounts a ON a.user_id = u.id
        WHERE u.phone = ${input.phone} AND u.status = 'active'`)
    ).rows[0];
    if (!buyer) throw new ApiError("BUSINESS_RULE", "partnerGiftNoAccount");
    if (buyer.locked) throw new ApiError("BUSINESS_RULE", "loyaltyLocked");
    const amount = input.points * Number(rate.unit_price);
    const value = input.points * phase.pointValue;
    const tax = marginTax(
      amount,
      value,
      Number((await this.database.execute<{ tax: string }>(sql`SELECT tax_percent::text AS tax FROM loyalty.partner_contracts WHERE id = ${contract.id}`)).rows[0]!.tax),
    );
    const giftId = randomUUID();
    try {
      await this.database.transaction(async (transaction) => {
        await lockCapacity(transaction, contract.id);
        await this.assertLimits(transaction, contract.id, buyer.id, input.points);
        await assertCapacity(transaction, contract, today, Math.round(amount) + tax);
        await lockAccount(transaction, buyer.id);
        await creditLot(transaction, {
          userId: buyer.id,
          kind: "earn",
          sourceType: "partner_gift",
          sourceId: giftId,
          companyId: contract.company_id,
          points: input.points,
          pointValue: phase.pointValue,
          day: today,
          validityMonths: phase.validityMonths,
        });
        const lotId = (await transaction.execute<{ id: string }>(sql`SELECT id FROM loyalty.lots WHERE source_type = 'partner_gift' AND source_id = ${giftId}`)).rows[0]!.id;
        await transaction.execute(sql`
          INSERT INTO loyalty.partner_gifts (id, document_no, contract_id, api_key_id, partner_transaction_code, user_id, rate_id, points, unit_price, amount, tax_amount, point_value_amount,
            message, lot_id)
          VALUES (${giftId}, ${await this.nextDocumentNo(transaction)}, ${contract.id}, ${caller.keyId}, ${input.partnerTransactionCode}, ${buyer.id}, ${rate.id}, ${input.points},
            ${rate.unit_price}::numeric, ${amount.toFixed(4)}::numeric, ${tax}, ${value.toFixed(4)}::numeric, ${input.message ?? null}, ${lotId})`);
        await this.ledger.record(transaction, await giftDraft(transaction, giftId, false));
        await notify(transaction, [
          {
            userId: buyer.id,
            companyId: contract.company_id,
            kind: "loyalty.partner_gift",
            title: `${contract.program_name} tặng bạn ${input.points.toLocaleString("vi-VN")} điểm VComm${input.message ? `: ${input.message}` : ""}`,
            payload: { giftId },
          },
        ]);
        await alertExposure(transaction, contract, today);
      });
    } catch (error) {
      // Hai yêu cầu cùng mã cùng lúc: yêu cầu sau trả giao dịch của yêu cầu trước.
      if (isUniqueViolation(error)) {
        const again = await this.byCode(this.database, contract.id, input.partnerTransactionCode);
        if (again) return { created: false, gift: openOf(again) };
      }
      throw error;
    }
    return { created: true, gift: openOf((await this.byCode(this.database, contract.id, input.partnerTransactionCode))!) };
  }

  private async nextDocumentNo(executor: Executor): Promise<string> {
    return (
      await executor.execute<{ value: string }>(sql`
        SELECT 'DT-' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY') || '-' || lpad(nextval('loyalty.partner_gift_no_seq')::text, 6, '0') AS value`)
    ).rows[0]!.value;
  }

  // Giới hạn tặng (QUYTAC_NGHIEPVU_540): tối đa mỗi lần, mỗi khách mỗi tháng, đối tác mỗi tháng (giờ Việt Nam; giao dịch chưa hủy).
  private async assertLimits(executor: Executor, contractId: string, userId: string, points: number): Promise<void> {
    const limit = (
      await executor.execute<{ max_points: number | null; customer_monthly_points: number | null; partner_monthly_points: number | null }>(sql`
        SELECT max_points, customer_monthly_points, partner_monthly_points FROM loyalty.partner_limits WHERE contract_id = ${contractId} AND direction = 'gift'`)
    ).rows[0];
    if (!limit) return;
    const used = (
      await executor.execute<{ customer: number; partner: number }>(sql`
        SELECT coalesce(sum(points) FILTER (WHERE user_id = ${userId}), 0)::int AS customer, coalesce(sum(points), 0)::int AS partner FROM loyalty.partner_gifts
        WHERE contract_id = ${contractId} AND status = 'completed'
          AND date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`)
    ).rows[0]!;
    if (
      (limit.max_points !== null && points > limit.max_points) ||
      (limit.customer_monthly_points !== null && used.customer + points > limit.customer_monthly_points) ||
      (limit.partner_monthly_points !== null && used.partner + points > limit.partner_monthly_points)
    )
      throw new ApiError("BUSINESS_RULE", "partnerLimitExceeded");
  }

  async get(caller: OpenApiCaller, code: string): Promise<OpenPartnerGift> {
    const contract = await this.contractOf(this.database, caller);
    const row = await this.byCode(this.database, contract.id, code);
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return openOf(row);
  }

  async openList(caller: OpenApiCaller, query: z.infer<typeof openPartnerGiftListQuerySchema>): Promise<PageResponse<OpenPartnerGift>> {
    const contract = await this.contractOf(this.database, caller);
    const where = sql`g.contract_id = ${contract.id} ${listWhere(query)}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${giftFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<GiftRow>(sql`
      SELECT ${giftColumns} FROM ${giftFrom} WHERE ${where} ORDER BY g.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(openOf), page: query.page, pageSize: query.pageSize, total };
  }

  // Hủy trong 24 giờ khi lô tặng còn đủ (khách chưa dùng) và chưa vào bảng đối soát (QUYTAC_NGHIEPVU_545): trừ lại lô, ghi ngược bút toán.
  async cancel(caller: OpenApiCaller, code: string, reason: string): Promise<OpenPartnerGift> {
    const contract = await this.contractOf(this.database, caller);
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<GiftRow>(sql`SELECT ${giftColumns} FROM ${giftFrom} WHERE g.contract_id = ${contract.id} AND g.partner_transaction_code = ${code} FOR UPDATE OF g`))
        .rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status === "cancelled") return;
      const lot = (await transaction.execute<{ remaining: number }>(sql`SELECT remaining FROM loyalty.lots WHERE id = ${row.lot_id}`)).rows[0]!;
      const fresh = (await transaction.execute<{ fresh: boolean }>(sql`SELECT ${row.created_at} > now() - make_interval(hours => ${cancelWindowHours}) AS fresh`)).rows[0]!.fresh;
      if (!fresh || lot.remaining < row.points || row.settlement_id !== null) throw new ApiError("BUSINESS_RULE", "partnerGiftNotCancellable");
      await reverseLot(transaction, { lotId: row.lot_id, userId: row.user_id, sourceType: "partner_gift", sourceId: row.id, companyId: row.company_id });
      await transaction.execute(sql`UPDATE loyalty.partner_gifts SET status = 'cancelled', cancel_reason = ${reason}, cancelled_at = now() WHERE id = ${row.id}`);
      await this.ledger.record(transaction, await giftDraft(transaction, row.id, true));
      await notify(transaction, [
        {
          userId: row.user_id,
          companyId: row.company_id,
          kind: "loyalty.partner_gift",
          title: `${contract.program_name} đã hủy tặng ${row.points.toLocaleString("vi-VN")} điểm VComm`,
          payload: { giftId: row.id },
        },
      ]);
    });
    return this.get(caller, code);
  }

  async list(actor: BuyerAdminActor, query: z.infer<typeof partnerGiftListQuerySchema>): Promise<PageResponse<PartnerGiftItem>> {
    const where = sql`c.company_id = ${actor.operatorCompanyId} ${query.contractId ? sql`AND g.contract_id = ${query.contractId}` : sql``} ${listWhere(query)}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${giftFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<GiftRow>(sql`
      SELECT ${giftColumns} FROM ${giftFrom} WHERE ${where} ORDER BY g.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(itemOf), page: query.page, pageSize: query.pageSize, total };
  }
}
