// Open API đơn chờ thanh toán cho phần mềm cửa hàng liên kết (CONG_VIEC_73 lát L7; QUYTAC_NGHIEPVU_590; API_330).
// Khóa API cửa hàng liên kết có phạm vi `instore.checkout`; đơn đi qua cùng service với cổng cửa hàng (L4) và hủy giao dịch như chủ cửa hàng (L7).
import { Inject, Injectable } from "@nestjs/common";
import type { InstoreCheckoutLine, OpenInstoreCheckout, PageResponse, openInstoreCheckoutCreateSchema, openInstoreListQuerySchema } from "contracts";
import { partnerCheckoutCodePattern } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { AffiliateTransactionsService } from "../affiliate/transactions.service";
import { ApiError } from "../common/api-error";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import type { OpenApiCaller } from "../open-api/api-key.guard";
import { InstoreCheckoutsService, type CheckoutRow } from "./checkouts.service";
import { openCheckoutView } from "./open-checkout-view";

type Executor = Pick<Database, "execute">;
export interface OpenInstoreContext {
  ip: string | null;
  requestId: string | null;
}

type KeyMerchant = {
  merchant_id: string;
  company_id: string;
  status: string;
  in_contract: boolean;
  transaction_cap: string;
  collection_enabled: boolean;
  outlet_ids: string[];
};

const appWebBase = () => (process.env.VCOMM_WEB_URL?.trim() || "http://localhost:8083").replace(/\/+$/, "");

@Injectable()
export class OpenInstoreCheckoutsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly instore: InstoreCheckoutsService,
    private readonly transactions: AffiliateTransactionsService,
  ) {}

  private async keyMerchant(caller: OpenApiCaller): Promise<KeyMerchant> {
    const row = (
      await this.database.execute<KeyMerchant>(sql`
      SELECT m.id AS merchant_id, m.company_id, m.status, m.transaction_cap::text, m.collection_enabled,
        (m.starts_on <= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AND (m.ends_on IS NULL OR m.ends_on >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)) AS in_contract,
        ARRAY(SELECT outlet_id::text FROM affiliate.api_key_outlets WHERE api_key_id = ak.api_key_id) AS outlet_ids
      FROM affiliate.api_keys ak JOIN affiliate.merchants m ON m.id = ak.merchant_id
      WHERE ak.api_key_id = ${caller.keyId} AND m.company_id = ${caller.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("SCOPE_NOT_GRANTED", "scopeNotGranted");
    return row;
  }

  // Đơn của cửa hàng theo mã đơn của phần mềm hoặc số TT….
  private async byCode(executor: Executor, merchantId: string, code: string, lock = false): Promise<CheckoutRow> {
    const id = (
      await executor.execute<{ id: string }>(sql`
      SELECT id FROM instore.checkouts WHERE merchant_id = ${merchantId} AND kind = 'affiliate'
        AND ${/^TT[0-9]{8}$/.test(code) ? sql`document_no = ${code}` : sql`partner_checkout_code = ${code}`}`)
    ).rows[0]?.id;
    const row = id ? await this.instore.find(executor, id, lock) : undefined;
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Tạo đơn (QUYTAC_NGHIEPVU_590): mã đơn của phần mềm duy nhất theo cửa hàng; đã có thì trả đơn cũ. Có mã thanh toán thì gắn khách ngay (luồng 1),
  // không có thì trả đường dẫn QR (luồng 2). Thu hộ theo cài đặt của cửa hàng nếu không gửi.
  async create(caller: OpenApiCaller, input: z.infer<typeof openInstoreCheckoutCreateSchema>): Promise<{ created: boolean; checkout: OpenInstoreCheckout }> {
    const merchant = await this.keyMerchant(caller);
    if (merchant.status !== "active" || !merchant.in_contract) throw new ApiError("BUSINESS_RULE", "affiliateMerchantInactive");
    if (!merchant.outlet_ids.includes(input.outletId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { outletId: "affiliateApiKeyOutletInvalid" } });
    const outlet = (await this.database.execute<{ status: string }>(sql`SELECT status FROM affiliate.outlets WHERE id = ${input.outletId}`)).rows[0];
    if (outlet?.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { outletId: "affiliateApiKeyOutletInvalid" } });
    if (Number(input.billAmount) > Number(merchant.transaction_cap)) throw new ApiError("BUSINESS_RULE", "affiliateBillOverCap");
    const collectInApp = input.collectInApp ?? merchant.collection_enabled;
    if (collectInApp && !merchant.collection_enabled) throw new ApiError("BUSINESS_RULE", "instoreCollectionDisabled");
    const operator = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator AND status = 'active'`)).rows[0];
    if (!operator) throw new ApiError("BUSINESS_RULE", "instoreNoGateway");
    let result: { created: boolean; row: CheckoutRow; qrToken: string | null };
    try {
      result = await this.database.transaction(async (transaction) => {
        const made = await this.instore.create(transaction, {
          operatorCompanyId: operator.id,
          place: { kind: "affiliate", merchantId: merchant.merchant_id, outletId: input.outletId },
          creator: { source: "open_api", apiKeyId: caller.keyId },
          idempotencyKey: input.partnerCheckoutCode,
          partnerCheckoutCode: input.partnerCheckoutCode,
          billAmount: input.billAmount,
          lines: input.lines as InstoreCheckoutLine[],
          collectInApp,
        });
        return { created: made.created, row: made.checkout, qrToken: made.qrToken };
      });
    } catch (error) {
      // Mã đơn đã dùng bởi khóa khác của cùng cửa hàng.
      if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "instorePartnerCodeTaken");
      throw error;
    }
    if (input.payCode && result.created) {
      try {
        const attached = await this.instore.attachPayCode(result.row.id, input.payCode, { subject: `apikey:${caller.keyId}`, companyId: merchant.company_id });
        return { created: true, checkout: await openCheckoutView(this.database, attached) };
      } catch (error) {
        await this.instore.cancel(result.row.id, null, "Mã thanh toán không gắn được").catch(() => undefined);
        throw error;
      }
    }
    return {
      created: result.created,
      checkout: await openCheckoutView(this.database, result.row, result.created && result.qrToken ? `${appWebBase()}/tt/${result.qrToken}` : null),
    };
  }

  // Gắn mã thanh toán sau khi tạo (luồng 1); quét sai tối đa 10 lần mỗi giờ mỗi khóa (QUYTAC_NGHIEPVU_592).
  async payCode(caller: OpenApiCaller, code: string, payCode: string): Promise<OpenInstoreCheckout> {
    const merchant = await this.keyMerchant(caller);
    const row = await this.byCode(this.database, merchant.merchant_id, code);
    return openCheckoutView(this.database, await this.instore.attachPayCode(row.id, payCode, { subject: `apikey:${caller.keyId}`, companyId: merchant.company_id }));
  }

  async detail(caller: OpenApiCaller, code: string): Promise<OpenInstoreCheckout> {
    const merchant = await this.keyMerchant(caller);
    return openCheckoutView(this.database, await this.byCode(this.database, merchant.merchant_id, code));
  }

  async list(caller: OpenApiCaller, query: z.infer<typeof openInstoreListQuerySchema>): Promise<PageResponse<OpenInstoreCheckout>> {
    const merchant = await this.keyMerchant(caller);
    const day = sql`(c.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const status = sql`CASE WHEN c.status IN ('awaiting_buyer', 'awaiting_payment') AND c.expires_at <= now() THEN 'expired' ELSE c.status END`;
    const where = sql`c.merchant_id = ${merchant.merchant_id} AND c.kind = 'affiliate'
      ${query.status ? sql`AND ${status} = ${query.status}` : sql``}
      ${query.outletId ? sql`AND c.outlet_id = ${query.outletId}` : sql``}
      ${query.from ? sql`AND ${day} >= ${query.from}::date` : sql``}
      ${query.to ? sql`AND ${day} <= ${query.to}::date` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM instore.checkouts c WHERE ${where}`)).rows[0]!.total;
    const ids = await this.database.execute<{ id: string }>(sql`
      SELECT c.id FROM instore.checkouts c WHERE ${where} ORDER BY c.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const data: OpenInstoreCheckout[] = [];
    for (const { id } of ids.rows) data.push(await openCheckoutView(this.database, (await this.instore.find(this.database, id))!));
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  // Hủy đơn chưa thanh toán: hoàn điểm, trả voucher (QUYTAC_NGHIEPVU_590).
  async cancel(caller: OpenApiCaller, code: string, reason: string): Promise<OpenInstoreCheckout> {
    const merchant = await this.keyMerchant(caller);
    const row = await this.byCode(this.database, merchant.merchant_id, code);
    if (row.status === "completed" || row.status === "refunded") throw new ApiError("BUSINESS_RULE", "instoreCheckoutPaidUseRefund");
    return openCheckoutView(this.database, await this.instore.cancel(row.id, null, reason));
  }

  // Hủy đơn đã thanh toán và hoàn tiền: hủy toàn bộ giao dịch LK… như chủ cửa hàng (tuần đối soát điểm chưa chốt); gọi lại khi đã hủy thì trả kết quả cũ.
  async refund(caller: OpenApiCaller, code: string, reason: string, context: OpenInstoreContext): Promise<OpenInstoreCheckout> {
    const merchant = await this.keyMerchant(caller);
    const row = await this.byCode(this.database, merchant.merchant_id, code);
    if (row.status === "refunded") return openCheckoutView(this.database, row);
    if (row.status !== "completed" || !row.affiliate_transaction_id) throw new ApiError("BUSINESS_RULE", "instoreCheckoutNotPaid");
    const transaction = (await this.database.execute<{ status: string }>(sql`SELECT status FROM affiliate.transactions WHERE id = ${row.affiliate_transaction_id}`)).rows[0];
    if (transaction?.status !== "cancelled")
      await this.transactions.cancelFor(
        {
          merchantId: merchant.merchant_id,
          companyId: merchant.company_id,
          cashierUserId: null,
          apiKey: { id: caller.keyId, name: caller.keyName, prefix: caller.keyPrefix, partnerTransactionCode: null },
          client: { ip: context.ip, userAgent: null, requestId: context.requestId },
        },
        row.affiliate_transaction_id,
        reason,
      );
    return openCheckoutView(this.database, (await this.instore.find(this.database, row.id))!);
  }
}

export const checkoutCode = (value: string): string => {
  if (!partnerCheckoutCodePattern.test(value)) throw new ApiError("NOT_FOUND", "notFound");
  return value;
};
