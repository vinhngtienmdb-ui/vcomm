// Voucher liên kết (CONG_VIEC_55; CHUC_NANG_195; QUYTAC_NGHIEPVU_401, 402; API_210, API_211).
// Ba loại phát hành: cửa hàng đổi bằng điểm, cửa hàng tặng miễn phí, công ty vận hành sàn. Mọi voucher qua luồng duyệt chứng từ của công ty vận hành sàn.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  AffiliateVoucherDisplayStatus,
  AffiliateVoucherIssuer,
  AffiliateVoucherItem,
  AffiliateVoucherStatus,
  BuyerVoucherCode,
  BuyerVoucherOffer,
  PageResponse,
  affiliateVoucherListQuerySchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import type { ClientInfo } from "../auth/auth.service";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import { spendPointsWithin } from "../loyalty/ledger.service";
import { vietnamToday } from "../marketplace/shop.service";

type Executor = Pick<Database, "execute">;
const voucherType = "affiliate.voucher";
const iso = (value: Date | string) => new Date(value).toISOString();

// Người thao tác: chủ cửa hàng (merchantId) hoặc người có affiliate.manage của công ty (merchantId trống).
export interface VoucherActor {
  userId: string;
  companyId: string;
  merchantId: string | null;
  client: ClientInfo;
}

export interface VoucherInput {
  issuer: AffiliateVoucherIssuer;
  titleVi: string;
  titleEn: string;
  discountKind: "amount" | "percent";
  discountValue: string;
  maxDiscount?: string | null | undefined;
  minBill: string;
  totalQuantity: number;
  perBuyerLimit: number;
  pointsPrice?: number | null | undefined;
  claimFrom: string;
  claimTo: string;
  validDays: number;
  merchantIds?: string[];
}

type VoucherRow = {
  id: string;
  code: string;
  issuer: AffiliateVoucherIssuer;
  merchant_id: string | null;
  merchant_name: string | null;
  title_vi: string;
  title_en: string;
  discount_kind: "amount" | "percent";
  discount_value: string;
  max_discount: string;
  min_bill: string;
  total_quantity: number;
  per_buyer_limit: number;
  points_price: number | null;
  claim_from: string;
  claim_to: string;
  valid_days: number;
  status: AffiliateVoucherStatus;
  claimed_count: number;
  used_count: number;
  merchant_ids: string[] | null;
  approval_request_id: string | null;
  created_by_name: string;
  version: number;
};

const voucherSelect = sql`
  SELECT v.id, v.code, v.issuer, v.merchant_id, p.name AS merchant_name, v.title_vi, v.title_en, v.discount_kind, v.discount_value::text, v.max_discount::text,
    v.min_bill::text, v.total_quantity, v.per_buyer_limit, v.points_price, v.claim_from::text, v.claim_to::text, v.valid_days, v.status, v.claimed_count, v.used_count,
    (SELECT array_agg(vm.merchant_id) FROM affiliate.voucher_merchants vm WHERE vm.voucher_id = v.id) AS merchant_ids, v.approval_request_id,
    u.full_name AS created_by_name, v.version
  FROM affiliate.vouchers v LEFT JOIN affiliate.merchants m ON m.id = v.merchant_id LEFT JOIN crm.partners p ON p.id = m.partner_id JOIN core.users u ON u.id = v.created_by`;

export function displayStatus(status: AffiliateVoucherStatus, claimFrom: string, claimTo: string, today: string): AffiliateVoucherDisplayStatus {
  if (status !== "approved") return status;
  return today < claimFrom ? "scheduled" : today > claimTo ? "ended" : "active";
}

function itemOf(row: VoucherRow, today: string): AffiliateVoucherItem {
  return {
    id: row.id,
    code: row.code,
    issuer: row.issuer,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    titleVi: row.title_vi,
    titleEn: row.title_en,
    discountKind: row.discount_kind,
    discountValue: trimDecimal(row.discount_value),
    maxDiscount: trimDecimal(row.max_discount),
    minBill: trimDecimal(row.min_bill),
    totalQuantity: row.total_quantity,
    perBuyerLimit: row.per_buyer_limit,
    pointsPrice: row.points_price,
    claimFrom: row.claim_from,
    claimTo: row.claim_to,
    validDays: row.valid_days,
    status: row.status,
    displayStatus: displayStatus(row.status, row.claim_from, row.claim_to, today),
    claimedCount: row.claimed_count,
    usedCount: row.used_count,
    merchantIds: row.merchant_ids ?? [],
    approvalRequestId: row.approval_request_id,
    createdByName: row.created_by_name,
    version: row.version,
  };
}

// Tiền giảm (QUYTAC_NGHIEPVU_402): số tiền hoặc phần trăm tiền hóa đơn, tối đa mức giảm tối đa, không vượt tiền hóa đơn; làm tròn xuống đến đồng.
export function voucherDiscount(voucher: { discount_kind: string; discount_value: string; max_discount: string }, bill: number): number {
  const raw = voucher.discount_kind === "amount" ? Number(voucher.discount_value) : Math.floor((bill * Number(voucher.discount_value)) / 100);
  return Math.max(Math.min(raw, Number(voucher.max_discount), bill), 0);
}

type CodeRow = {
  id: string;
  voucher_id: string;
  voucher_code: string;
  issuer: AffiliateVoucherIssuer;
  merchant_id: string | null;
  merchant_name: string | null;
  title_vi: string;
  title_en: string;
  discount_kind: "amount" | "percent";
  discount_value: string;
  max_discount: string;
  min_bill: string;
  points_paid: number;
  point_value: string | null;
  claimed_at: Date;
  expires_at: Date;
  status: "unused" | "used" | "expired";
};
const codeSelect = sql`
  SELECT c.id, c.voucher_id, v.code AS voucher_code, v.issuer, v.merchant_id, p.name AS merchant_name, v.title_vi, v.title_en, v.discount_kind, v.discount_value::text,
    v.max_discount::text, v.min_bill::text, c.points_paid, c.point_value::text, c.claimed_at, c.expires_at,
    CASE WHEN c.status = 'unused' AND c.expires_at <= now() THEN 'expired' ELSE c.status END AS status
  FROM affiliate.voucher_codes c JOIN affiliate.vouchers v ON v.id = c.voucher_id LEFT JOIN affiliate.merchants m ON m.id = v.merchant_id LEFT JOIN crm.partners p ON p.id = m.partner_id`;
const codeOf = (row: CodeRow): BuyerVoucherCode => ({
  id: row.id,
  voucherId: row.voucher_id,
  voucherCode: row.voucher_code,
  issuer: row.issuer,
  merchantName: row.merchant_name,
  titleVi: row.title_vi,
  titleEn: row.title_en,
  discountKind: row.discount_kind,
  discountValue: trimDecimal(row.discount_value),
  maxDiscount: trimDecimal(row.max_discount),
  minBill: trimDecimal(row.min_bill),
  pointsPaid: row.points_paid,
  claimedAt: iso(row.claimed_at),
  expiresAt: iso(row.expires_at),
  status: row.status,
});
// Voucher dùng được tại cửa hàng: voucher của chính cửa hàng; voucher công ty không giới hạn hoặc có chọn cửa hàng này.
const usableAt = (merchantId: string) => sql`(v.merchant_id = ${merchantId}
  OR (v.issuer = 'company' AND (NOT EXISTS (SELECT 1 FROM affiliate.voucher_merchants vm WHERE vm.voucher_id = v.id)
    OR EXISTS (SELECT 1 FROM affiliate.voucher_merchants vm WHERE vm.voucher_id = v.id AND vm.merchant_id = ${merchantId}))))`;

// Voucher của khách dùng được cho một giao dịch, kèm tiền giảm theo tiền hóa đơn.
export async function usableCodes(executor: Executor, buyerId: string, merchantId: string, bill: number): Promise<(BuyerVoucherCode & { discount: string })[]> {
  const rows = await executor.execute<CodeRow>(sql`
    ${codeSelect} WHERE c.buyer_user_id = ${buyerId} AND c.status = 'unused' AND c.expires_at > now() AND v.min_bill <= ${bill} AND ${usableAt(merchantId)}
    ORDER BY c.expires_at`);
  return rows.rows.map((row) => ({ ...codeOf(row), discount: String(voucherDiscount(row, bill)) }));
}

// Dùng voucher trong giao dịch hoàn tất (QUYTAC_NGHIEPVU_402): khóa mã, kiểm điều kiện, đánh dấu đã dùng.
// Trả tiền giảm và tiền công ty phải trả cửa hàng (đổi bằng điểm: giá điểm × giá trị lúc nhận; công ty: tiền giảm; cửa hàng miễn phí: 0).
export async function useVoucherWithin(
  executor: Executor,
  input: { codeId: string; buyerId: string; merchantId: string; bill: number; transactionId: string },
): Promise<{ discount: number; payable: number }> {
  const row = (
    await executor.execute<CodeRow & { voucher_id: string }>(sql`
      ${codeSelect} WHERE c.id = ${input.codeId} AND c.buyer_user_id = ${input.buyerId} AND c.status = 'unused' AND c.expires_at > now()
        AND v.min_bill <= ${input.bill} AND ${usableAt(input.merchantId)}
      FOR UPDATE OF c`)
  ).rows[0];
  if (!row) throw new ApiError("BUSINESS_RULE", "affiliateVoucherNotUsable");
  const discount = voucherDiscount(row, input.bill);
  const payable = row.issuer === "merchant_points" ? Math.round(row.points_paid * Number(row.point_value)) : row.issuer === "company" ? discount : 0;
  await executor.execute(sql`UPDATE affiliate.voucher_codes SET status = 'used', transaction_id = ${input.transactionId} WHERE id = ${input.codeId}`);
  await executor.execute(sql`UPDATE affiliate.vouchers SET used_count = used_count + 1 WHERE id = ${row.voucher_id}`);
  return { discount, payable };
}

// Hủy giao dịch: trả voucher cho khách nếu còn hạn (QUYTAC_NGHIEPVU_400).
export async function releaseVoucherWithin(executor: Executor, codeId: string): Promise<void> {
  const released = await executor.execute<{ voucher_id: string }>(sql`
    UPDATE affiliate.voucher_codes SET status = CASE WHEN expires_at > now() THEN 'unused' ELSE 'expired' END, transaction_id = NULL
    WHERE id = ${codeId} AND status = 'used' RETURNING voucher_id`);
  for (const row of released.rows) await executor.execute(sql`UPDATE affiliate.vouchers SET used_count = used_count - 1 WHERE id = ${row.voucher_id}`);
}

@Injectable()
export class AffiliateVouchersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly approvals: ApprovalRequestsService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  // Kết quả duyệt (sự kiện core.approval.completed): đã duyệt thì voucher được phát theo thời gian nhận.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== voucherType) return;
      const status = String(event.payload.status);
      const next = status === "approved" ? "approved" : status === "rejected" || status === "withdrawn" ? status : null;
      if (!next) return;
      await this.database.execute(sql`
        UPDATE affiliate.vouchers SET status = ${next}, updated_at = now(), version = version + 1 WHERE id = ${String(event.payload.documentId)} AND status = 'pending'`);
    });
  }

  private record(actor: VoucherActor, action: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.companyId,
        appCode: actor.merchantId ? "affiliate" : "crm",
        action,
        entityType: "affiliate_voucher",
        entityId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  // Phạm vi: chủ cửa hàng chỉ voucher của cửa hàng mình; công ty thấy mọi voucher của công ty vận hành sàn.
  private scope(actor: VoucherActor) {
    return actor.merchantId ? sql`v.company_id = ${actor.companyId} AND v.merchant_id = ${actor.merchantId}` : sql`v.company_id = ${actor.companyId}`;
  }

  private async row(executor: Executor, actor: VoucherActor, id: string, lock = false): Promise<VoucherRow> {
    const row = (await executor.execute<VoucherRow>(sql`${voucherSelect} WHERE v.id = ${id} AND ${this.scope(actor)} ${lock ? sql`FOR UPDATE OF v` : sql``}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async voucher(actor: VoucherActor, id: string): Promise<AffiliateVoucherItem> {
    return itemOf(await this.row(this.database, actor, id), await vietnamToday(this.database));
  }

  async list(actor: VoucherActor, query: z.infer<typeof affiliateVoucherListQuerySchema>): Promise<PageResponse<AffiliateVoucherItem>> {
    const today = await vietnamToday(this.database);
    const display = sql`CASE WHEN v.status <> 'approved' THEN v.status WHEN ${today}::date < v.claim_from THEN 'scheduled' WHEN ${today}::date > v.claim_to THEN 'ended' ELSE 'active' END`;
    const where = sql`${this.scope(actor)}
      ${query.issuer ? sql`AND v.issuer = ${query.issuer}` : sql``}
      ${query.merchantId ? sql`AND v.merchant_id = ${query.merchantId}` : sql``}
      ${query.status ? sql`AND ${display} = ${query.status}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM affiliate.vouchers v WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<VoucherRow>(sql`${voucherSelect} WHERE ${where} ORDER BY v.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => itemOf(row, today)), page: query.page, pageSize: query.pageSize, total };
  }

  private async checkMerchants(executor: Executor, actor: VoucherActor, merchantIds: string[]): Promise<string[]> {
    const unique = [...new Set(merchantIds)];
    if (unique.length === 0) return [];
    const found = await executor.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM affiliate.merchants WHERE company_id = ${actor.companyId} AND id = ANY(${pgArray(unique)}::uuid[])`);
    if (found.rows[0]!.total !== unique.length) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { merchantIds: "invalidValue" } });
    return unique;
  }

  private async saveMerchants(executor: Executor, voucherId: string, merchantIds: string[]): Promise<void> {
    await executor.execute(sql`DELETE FROM affiliate.voucher_merchants WHERE voucher_id = ${voucherId}`);
    if (merchantIds.length > 0) {
      await executor.execute(sql`INSERT INTO affiliate.voucher_merchants (voucher_id, merchant_id) SELECT ${voucherId}::uuid, unnest(${pgArray(merchantIds)}::uuid[])`);
    }
  }

  private values(input: VoucherInput) {
    const maxDiscount = input.discountKind === "amount" ? input.discountValue : input.maxDiscount!;
    return { maxDiscount, pointsPrice: input.issuer === "merchant_points" ? input.pointsPrice! : null };
  }

  async create(actor: VoucherActor, input: VoucherInput): Promise<AffiliateVoucherItem> {
    const id = await this.database.transaction(async (transaction) => {
      const merchantIds = actor.merchantId ? [] : await this.checkMerchants(transaction, actor, input.merchantIds ?? []);
      const { maxDiscount, pointsPrice } = this.values(input);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO affiliate.vouchers (company_id, issuer, merchant_id, title_vi, title_en, discount_kind, discount_value, max_discount, min_bill, total_quantity,
          per_buyer_limit, points_price, claim_from, claim_to, valid_days, created_by, updated_by)
        VALUES (${actor.companyId}, ${input.issuer}, ${actor.merchantId}, ${input.titleVi}, ${input.titleEn}, ${input.discountKind}, ${input.discountValue}, ${maxDiscount},
          ${input.minBill}, ${input.totalQuantity}, ${input.perBuyerLimit}, ${pointsPrice}, ${input.claimFrom}, ${input.claimTo}, ${input.validDays}, ${actor.userId}, ${actor.userId})
        RETURNING id`);
      const voucherId = inserted.rows[0]!.id;
      await this.saveMerchants(transaction, voucherId, merchantIds);
      await this.record(actor, "affiliate_voucher.create", voucherId, input, transaction);
      return voucherId;
    });
    return this.voucher(actor, id);
  }

  // Sửa khi nháp, bị từ chối, đã rút (QUYTAC_NGHIEPVU_401).
  async update(actor: VoucherActor, id: string, input: VoucherInput & { version: number }): Promise<AffiliateVoucherItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, actor, id, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "affiliateVoucherNotEditable");
      const merchantIds = actor.merchantId ? [] : await this.checkMerchants(transaction, actor, input.merchantIds ?? []);
      const { maxDiscount, pointsPrice } = this.values(input);
      await transaction.execute(sql`
        UPDATE affiliate.vouchers SET issuer = ${input.issuer}, title_vi = ${input.titleVi}, title_en = ${input.titleEn}, discount_kind = ${input.discountKind},
          discount_value = ${input.discountValue}, max_discount = ${maxDiscount}, min_bill = ${input.minBill}, total_quantity = ${input.totalQuantity},
          per_buyer_limit = ${input.perBuyerLimit}, points_price = ${pointsPrice}, claim_from = ${input.claimFrom}, claim_to = ${input.claimTo}, valid_days = ${input.validDays},
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.saveMerchants(transaction, id, merchantIds);
      await this.record(actor, "affiliate_voucher.update", id, input, transaction);
    });
    return this.voucher(actor, id);
  }

  // Gửi duyệt: giá trị = tổng số lượng × mức giảm tối đa; công ty chưa có chính sách duyệt thì không gửi được; người lập không tự duyệt.
  async submit(actor: VoucherActor, id: string, version: number): Promise<AffiliateVoucherItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "affiliateVoucherNotEditable");
      const today = await vietnamToday(transaction);
      if (row.claim_to < today) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { claimTo: "invalidValue" } });
      const requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
        documentTypeCode: voucherType,
        documentId: id,
        documentNo: row.code,
        amount: String(Math.round(row.total_quantity * Number(row.max_discount))),
        currency: "VND",
        documentDate: today,
      });
      await transaction.execute(sql`
        UPDATE affiliate.vouchers SET status = 'pending', approval_request_id = ${requestId}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.record(actor, "affiliate_voucher.submit", id, { requestId }, transaction);
    });
    return this.voucher(actor, id);
  }

  async withdraw(actor: VoucherActor, id: string, version: number): Promise<AffiliateVoucherItem> {
    const row = await this.row(this.database, actor, id);
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (row.status !== "pending" || !row.approval_request_id) throw new ApiError("BUSINESS_RULE", "affiliateVoucherNotPending");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE affiliate.vouchers SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.record(actor, "affiliate_voucher.withdraw", id, null, transaction);
    });
    return this.voucher(actor, id);
  }

  // Đã duyệt: tạm dừng, tiếp tục phát; giảm tổng số lượng (không dưới số đã nhận).
  async setPaused(actor: VoucherActor, id: string, paused: boolean, version: number): Promise<AffiliateVoucherItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== (paused ? "approved" : "paused")) throw new ApiError("BUSINESS_RULE", "affiliateVoucherStatusInvalid");
      await transaction.execute(sql`UPDATE affiliate.vouchers SET status = ${paused ? "paused" : "approved"}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.record(actor, paused ? "affiliate_voucher.pause" : "affiliate_voucher.resume", id, null, transaction);
    });
    return this.voucher(actor, id);
  }

  async reduceQuantity(actor: VoucherActor, id: string, totalQuantity: number, version: number): Promise<AffiliateVoucherItem> {
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, actor, id, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "approved" && row.status !== "paused") throw new ApiError("BUSINESS_RULE", "affiliateVoucherStatusInvalid");
      if (totalQuantity > row.total_quantity || totalQuantity < row.claimed_count) {
        throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { totalQuantity: "affiliateVoucherQuantityInvalid" } });
      }
      await transaction.execute(sql`UPDATE affiliate.vouchers SET total_quantity = ${totalQuantity}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.record(actor, "affiliate_voucher.quantity", id, { totalQuantity }, transaction);
    });
    return this.voucher(actor, id);
  }

  // ---------------------------------------------------------------------------
  // Người mua (API_211).
  // ---------------------------------------------------------------------------

  // Đang phát: đã duyệt, trong thời gian nhận, còn số lượng; voucher cửa hàng chỉ khi cửa hàng đang hoạt động.
  private claimable = (today: string) => sql`v.status = 'approved' AND v.claim_from <= ${today}::date AND v.claim_to >= ${today}::date AND v.claimed_count < v.total_quantity
    AND (v.merchant_id IS NULL OR EXISTS (SELECT 1 FROM affiliate.merchants mm WHERE mm.id = v.merchant_id AND mm.status = 'active'))`;

  async offers(buyerId: string): Promise<BuyerVoucherOffer[]> {
    const today = await vietnamToday(this.database);
    const result = await this.database.execute<VoucherRow & { claimed_by_me: number }>(sql`
      SELECT v.id, v.code, v.issuer, p.name AS merchant_name, v.title_vi, v.title_en, v.discount_kind, v.discount_value::text, v.max_discount::text, v.min_bill::text,
        v.points_price, v.valid_days, v.claim_to::text, v.total_quantity, v.claimed_count, v.per_buyer_limit,
        (SELECT count(*)::int FROM affiliate.voucher_codes c WHERE c.voucher_id = v.id AND c.buyer_user_id = ${buyerId}) AS claimed_by_me
      FROM affiliate.vouchers v LEFT JOIN affiliate.merchants m ON m.id = v.merchant_id LEFT JOIN crm.partners p ON p.id = m.partner_id
      WHERE ${this.claimable(today)} ORDER BY v.claim_to, v.created_at DESC LIMIT 100`);
    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      issuer: row.issuer,
      merchantName: row.merchant_name,
      titleVi: row.title_vi,
      titleEn: row.title_en,
      discountKind: row.discount_kind,
      discountValue: trimDecimal(row.discount_value),
      maxDiscount: trimDecimal(row.max_discount),
      minBill: trimDecimal(row.min_bill),
      pointsPrice: row.points_price,
      validDays: row.valid_days,
      claimTo: row.claim_to,
      remaining: row.total_quantity - row.claimed_count,
      claimedByMe: row.claimed_by_me,
      perBuyerLimit: row.per_buyer_limit,
    }));
  }

  // Nhận voucher (QUYTAC_NGHIEPVU_402): còn số lượng, chưa đủ số mỗi khách; đổi bằng điểm thì trừ điểm ngay.
  async claim(buyerId: string, voucherId: string): Promise<BuyerVoucherCode> {
    const codeId = await this.database.transaction(async (transaction) => {
      const today = await vietnamToday(transaction);
      const voucher = (
        await transaction.execute<{ issuer: AffiliateVoucherIssuer; points_price: number | null; valid_days: number; per_buyer_limit: number; company_id: string }>(sql`
          SELECT v.issuer, v.points_price, v.valid_days, v.per_buyer_limit, v.company_id FROM affiliate.vouchers v
          WHERE v.id = ${voucherId} AND ${this.claimable(today)} FOR UPDATE OF v`)
      ).rows[0];
      if (!voucher) throw new ApiError("BUSINESS_RULE", "affiliateVoucherUnavailable");
      const buyer = (await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${buyerId}`)).rows[0];
      if (!buyer) throw new ApiError("FORBIDDEN", "forbidden");
      const mine = (await transaction.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM affiliate.voucher_codes WHERE voucher_id = ${voucherId} AND buyer_user_id = ${buyerId}`))
        .rows[0]!.total;
      if (mine >= voucher.per_buyer_limit) throw new ApiError("BUSINESS_RULE", "affiliateVoucherUnavailable");
      const id = (
        await transaction.execute<{ id: string }>(sql`
          INSERT INTO affiliate.voucher_codes (voucher_id, buyer_user_id, expires_at) VALUES (${voucherId}, ${buyerId}, now() + make_interval(days => ${voucher.valid_days})) RETURNING id`)
      ).rows[0]!.id;
      if (voucher.issuer === "merchant_points") {
        const spent = await spendPointsWithin(transaction, {
          userId: buyerId,
          companyId: voucher.company_id,
          sourceType: "affiliate_voucher",
          sourceId: id,
          day: today,
          points: voucher.points_price!,
        });
        await transaction.execute(sql`UPDATE affiliate.voucher_codes SET points_paid = ${voucher.points_price}, point_value = ${spent.pointValue} WHERE id = ${id}`);
      }
      await transaction.execute(sql`UPDATE affiliate.vouchers SET claimed_count = claimed_count + 1 WHERE id = ${voucherId}`);
      return id;
    });
    return (await this.myCodes(buyerId, codeId))[0]!;
  }

  async myCodes(buyerId: string, codeId: string | null = null): Promise<BuyerVoucherCode[]> {
    const rows = await this.database.execute<CodeRow>(sql`
      ${codeSelect} WHERE c.buyer_user_id = ${buyerId} ${codeId ? sql`AND c.id = ${codeId}` : sql``} ORDER BY (c.status = 'unused' AND c.expires_at > now()) DESC, c.expires_at LIMIT 100`);
    return rows.rows.map(codeOf);
  }

  // Việc nền hằng ngày: chuyển voucher quá hạn sang hết hạn; nhắc một lần trước 3 ngày (QUYTAC_NGHIEPVU_402, đặc tả mục 18).
  async expireAndRemind(): Promise<void> {
    await this.database.execute(sql`UPDATE affiliate.voucher_codes SET status = 'expired' WHERE status = 'unused' AND expires_at <= now()`);
    const due = await this.database.execute<{ id: string; buyer_user_id: string; title_vi: string; company_id: string }>(sql`
      SELECT c.id, c.buyer_user_id, v.title_vi, v.company_id FROM affiliate.voucher_codes c JOIN affiliate.vouchers v ON v.id = c.voucher_id
      WHERE c.status = 'unused' AND c.expiry_notified_at IS NULL AND c.expires_at <= now() + interval '3 days' LIMIT 1000`);
    for (const row of due.rows) {
      await this.database.transaction(async (transaction) => {
        await notify(transaction, [
          { userId: row.buyer_user_id, companyId: row.company_id, kind: "affiliate.voucher_expiring", title: `Voucher "${row.title_vi}" sắp hết hạn`, payload: { voucherCodeId: row.id } },
        ]);
        await transaction.execute(sql`UPDATE affiliate.voucher_codes SET expiry_notified_at = now() WHERE id = ${row.id}`);
      });
    }
  }
}
