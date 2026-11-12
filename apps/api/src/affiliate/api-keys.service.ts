// Khóa API của cửa hàng liên kết (CONG_VIEC_67; CHUC_NANG_234; QUYTAC_NGHIEPVU_495; API_295).
// Khóa ghi ở bảng chung core.api_keys qua ApiKeysService (Nền tảng); phần riêng của cửa hàng (điểm bán, số tin SMS mỗi ngày) ở schema affiliate.
import { Inject, Injectable } from "@nestjs/common";
import type { AffiliateApiKeyItem, AffiliateApiKeySecret, AffiliatePortalConnection, affiliateApiKeyCreateSchema, affiliateApiKeyUpdateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { ApiKeysService } from "../open-api/api-keys.service";
import { displayIp } from "../open-api/ip-allow-list";
import type { Actor } from "../permissions/roles.service";
import { merchantRow } from "./merchants.service";
import { requireOwner, type PortalMember } from "./portal.service";

type Executor = Pick<Database, "execute">;

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  outlets: { id: string; name: string }[];
  rate_limit_per_minute: number;
  sms_daily_limit: number;
  expires_on: string | null;
  allowed_ips: string[];
  status: "active" | "revoked";
  revoked_reason: string | null;
  last_used_at: Date | null;
  calls_today: number;
  sms_today: number;
  created_at: Date;
  version: number;
};

// Đầu ngày hôm nay theo giờ Việt Nam.
const startOfVietnamDay = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;

const selectKeys = sql`
  SELECT k.id, k.name, k.key_prefix, k.rate_limit_per_minute, ak.sms_daily_limit, k.expires_on::text AS expires_on, k.allowed_ips::text[] AS allowed_ips, k.status,
    k.revoked_reason, k.last_used_at, k.created_at, k.version,
    coalesce((SELECT json_agg(json_build_object('id', o.id, 'name', o.name) ORDER BY o.name) FROM affiliate.api_key_outlets ko JOIN affiliate.outlets o ON o.id = ko.outlet_id
      WHERE ko.api_key_id = k.id), '[]'::json) AS outlets,
    (SELECT count(*)::int FROM core.api_call_logs l WHERE l.api_key_id = k.id AND l.called_at >= ${startOfVietnamDay}) AS calls_today,
    (SELECT count(*)::int FROM affiliate.sms_charges c WHERE c.api_key_id = k.id AND c.sent_at >= ${startOfVietnamDay}) AS sms_today
  FROM affiliate.api_keys ak JOIN core.api_keys k ON k.id = ak.api_key_id`;

@Injectable()
export class AffiliateApiKeysService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly apiKeys: ApiKeysService,
  ) {}

  private actorOf(actor: BuyerAdminActor): Actor {
    return { userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client };
  }

  private itemOf(row: KeyRow): AffiliateApiKeyItem {
    const expired = row.status === "active" && row.expires_on !== null && row.expires_on < vietnamDate(this.clock.now());
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      outlets: row.outlets,
      rateLimitPerMinute: row.rate_limit_per_minute,
      smsDailyLimit: row.sms_daily_limit,
      expiresOn: row.expires_on,
      allowedIps: row.allowed_ips.map(displayIp),
      status: row.status === "revoked" ? "revoked" : expired ? "expired" : "active",
      revokedReason: row.revoked_reason,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      callsToday: row.calls_today,
      smsToday: row.sms_today,
      createdAt: new Date(row.created_at).toISOString(),
      version: row.version,
    };
  }

  private async keysOf(executor: Executor, merchantId: string): Promise<AffiliateApiKeyItem[]> {
    const rows = await executor.execute<KeyRow>(sql`${selectKeys} WHERE ak.merchant_id = ${merchantId} ORDER BY k.status, k.created_at DESC`);
    return rows.rows.map((row) => this.itemOf(row));
  }

  // Khóa thuộc cửa hàng của công ty vận hành sàn; trả cửa hàng của khóa.
  private async keyOf(executor: Executor, actor: BuyerAdminActor, keyId: string): Promise<{ merchantId: string; row: KeyRow }> {
    const row = (
      await executor.execute<KeyRow & { merchant_id: string }>(sql`
      ${selectKeys} JOIN affiliate.merchants m ON m.id = ak.merchant_id WHERE k.id = ${keyId} AND m.company_id = ${actor.operatorCompanyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return { merchantId: row.merchant_id, row };
  }

  async list(actor: BuyerAdminActor, merchantId: string): Promise<AffiliateApiKeyItem[]> {
    await merchantRow(this.database, merchantId, actor.operatorCompanyId);
    return this.keysOf(this.database, merchantId);
  }

  // Điểm bán phải thuộc cửa hàng, đang hoạt động (QUYTAC_NGHIEPVU_495 mục 2).
  private async checkOutlets(executor: Executor, merchantId: string, outletIds: string[], fields: Record<string, ErrorMessageKey>): Promise<string[]> {
    const unique = [...new Set(outletIds)];
    const found = (
      await executor.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM affiliate.outlets WHERE merchant_id = ${merchantId} AND status = 'active' AND id = ANY(${pgArray(unique)}::uuid[])`)
    ).rows[0]!.total;
    if (found !== unique.length) fields.outletIds = "affiliateApiKeyOutletInvalid";
    return unique;
  }

  private async saveOutlets(executor: Executor, keyId: string, outletIds: string[]): Promise<void> {
    await executor.execute(sql`DELETE FROM affiliate.api_key_outlets WHERE api_key_id = ${keyId}`);
    await executor.execute(sql`INSERT INTO affiliate.api_key_outlets (api_key_id, outlet_id) SELECT ${keyId}, unnest(${pgArray(outletIds)}::uuid[])`);
  }

  async create(actor: BuyerAdminActor, merchantId: string, input: z.output<typeof affiliateApiKeyCreateSchema>): Promise<AffiliateApiKeySecret> {
    const merchant = await merchantRow(this.database, merchantId, actor.operatorCompanyId);
    if (merchant.status === "terminated") throw new ApiError("BUSINESS_RULE", "affiliateApiKeyMerchantTerminated");
    const fields: Record<string, ErrorMessageKey> = {};
    const outletIds = await this.checkOutlets(this.database, merchantId, input.outletIds, fields);
    const ips = this.apiKeys.checkAccess(input, fields, null);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    try {
      const issued = await this.database.transaction(async (transaction) => {
        const key = await this.apiKeys.issueLoyaltyKey(transaction, this.actorOf(actor), {
          partnerId: merchant.partner_id,
          merchantId,
          name: input.name,
          rateLimitPerMinute: input.rateLimitPerMinute,
          expiresOn: input.expiresOn,
          ips,
        });
        await transaction.execute(sql`INSERT INTO affiliate.api_keys (api_key_id, merchant_id, sms_daily_limit) VALUES (${key.id}, ${merchantId}, ${input.smsDailyLimit})`);
        await this.saveOutlets(transaction, key.id, outletIds);
        return key;
      });
      return { key: this.itemOf((await this.keyOf(this.database, actor, issued.id)).row), secret: issued.secret };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "apiKeyNameTaken" } });
      throw error;
    }
  }

  async update(actor: BuyerAdminActor, keyId: string, input: z.output<typeof affiliateApiKeyUpdateSchema>): Promise<AffiliateApiKeyItem> {
    const current = await this.keyOf(this.database, actor, keyId);
    if (current.row.status === "revoked") throw new ApiError("BUSINESS_RULE", "apiKeyRevoked");
    const fields: Record<string, ErrorMessageKey> = {};
    const outletIds = await this.checkOutlets(this.database, current.merchantId, input.outletIds, fields);
    const ips = this.apiKeys.checkAccess(input, fields, current.row.expires_on);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    try {
      await this.database.transaction(async (transaction) => {
        await this.apiKeys.updateLoyaltyKey(
          transaction,
          this.actorOf(actor),
          keyId,
          { name: input.name, rateLimitPerMinute: input.rateLimitPerMinute, expiresOn: input.expiresOn, ips, version: input.version },
          {
            before: {
              name: current.row.name,
              rateLimitPerMinute: current.row.rate_limit_per_minute,
              expiresOn: current.row.expires_on,
              allowedIps: current.row.allowed_ips.map(displayIp),
              outletIds: current.row.outlets.map((outlet) => outlet.id),
              smsDailyLimit: current.row.sms_daily_limit,
            },
            after: { outletIds, smsDailyLimit: input.smsDailyLimit },
          },
        );
        await transaction.execute(sql`UPDATE affiliate.api_keys SET sms_daily_limit = ${input.smsDailyLimit} WHERE api_key_id = ${keyId}`);
        await this.saveOutlets(transaction, keyId, outletIds);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "apiKeyNameTaken" } });
      throw error;
    }
    return this.itemOf((await this.keyOf(this.database, actor, keyId)).row);
  }

  async rotate(actor: BuyerAdminActor, keyId: string, version: number): Promise<AffiliateApiKeySecret> {
    await this.keyOf(this.database, actor, keyId);
    const rotated = await this.apiKeys.rotate(this.actorOf(actor), keyId, { version });
    return { key: this.itemOf((await this.keyOf(this.database, actor, keyId)).row), secret: rotated.secret };
  }

  async revoke(actor: BuyerAdminActor, keyId: string, reason: string, version: number): Promise<AffiliateApiKeyItem> {
    await this.keyOf(this.database, actor, keyId);
    await this.apiKeys.revoke(this.actorOf(actor), keyId, { reason, version });
    return this.itemOf((await this.keyOf(this.database, actor, keyId)).row);
  }

  // Cổng cửa hàng (MAN_HINH_232): chủ cửa hàng xem khóa, số lần gọi, giao dịch qua phần mềm hôm nay và tuần này (tuần từ thứ Hai).
  async portalConnection(member: PortalMember): Promise<AffiliatePortalConnection> {
    requireOwner(member);
    const weekStart = sql`(date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const counts = (
      await this.database.execute<{
        calls_today: number;
        calls_week: number;
        transactions_today: number;
        transactions_week: number;
        sms_today: number;
        sms_week: number;
        sms_fee_week: string;
        week_start: string;
      }>(sql`
      SELECT
        (SELECT count(*)::int FROM core.api_call_logs l JOIN affiliate.api_keys ak ON ak.api_key_id = l.api_key_id WHERE ak.merchant_id = ${member.merchantId} AND l.called_at >= ${startOfVietnamDay}) AS calls_today,
        (SELECT count(*)::int FROM core.api_call_logs l JOIN affiliate.api_keys ak ON ak.api_key_id = l.api_key_id WHERE ak.merchant_id = ${member.merchantId} AND l.called_at >= ${weekStart}) AS calls_week,
        (SELECT count(*)::int FROM affiliate.transactions WHERE merchant_id = ${member.merchantId} AND source = 'open_api' AND created_at >= ${startOfVietnamDay}) AS transactions_today,
        (SELECT count(*)::int FROM affiliate.transactions WHERE merchant_id = ${member.merchantId} AND source = 'open_api' AND created_at >= ${weekStart}) AS transactions_week,
        (SELECT count(*)::int FROM affiliate.sms_charges WHERE merchant_id = ${member.merchantId} AND sent_at >= ${startOfVietnamDay}) AS sms_today,
        (SELECT count(*)::int FROM affiliate.sms_charges WHERE merchant_id = ${member.merchantId} AND sent_at >= ${weekStart}) AS sms_week,
        (SELECT coalesce(sum(unit_price), 0)::text FROM affiliate.sms_charges WHERE merchant_id = ${member.merchantId} AND sent_at >= ${weekStart}) AS sms_fee_week,
        (date_trunc('week', now() AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date::text AS week_start`)
    ).rows[0]!;
    return {
      keys: await this.keysOf(this.database, member.merchantId),
      callsToday: counts.calls_today,
      callsWeek: counts.calls_week,
      transactionsToday: counts.transactions_today,
      transactionsWeek: counts.transactions_week,
      smsToday: counts.sms_today,
      smsWeek: counts.sms_week,
      smsFeeWeek: trimDecimal(counts.sms_fee_week),
      weekStart: counts.week_start,
    };
  }
}
