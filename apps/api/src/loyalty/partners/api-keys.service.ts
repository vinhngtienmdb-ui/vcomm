// Khóa API tặng điểm của đối tác liên minh (CONG_VIEC_65; CHUC_NANG_236; QUYTAC_NGHIEPVU_545; API_303).
// Khóa ghi ở bảng chung core.api_keys qua ApiKeysService (Nền tảng): loại Đối tác, đối tác của hợp đồng, phạm vi đúng `loyalty.partner`, không kênh, không kho.
import { Inject, Injectable } from "@nestjs/common";
import type { PartnerApiKeyItem, PartnerApiKeySecret, partnerApiKeyCreateSchema, partnerApiKeyUpdateSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../../common/clock";
import { isUniqueViolation } from "../../common/database-errors";
import { DATABASE, type Database } from "../../database/database.module";
import type { BuyerAdminActor } from "../../marketplace/buyer-admin.service";
import { ApiKeysService } from "../../open-api/api-keys.service";
import { displayIp } from "../../open-api/ip-allow-list";
import type { Actor } from "../../permissions/roles.service";
import { contractRow } from "./contracts.service";

type Executor = Pick<Database, "execute">;

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  rate_limit_per_minute: number;
  expires_on: string | null;
  allowed_ips: string[];
  status: "active" | "revoked";
  revoked_reason: string | null;
  last_used_at: Date | null;
  calls_today: number;
  created_at: Date;
  version: number;
};

const startOfVietnamDay = sql`(date_trunc('day', now() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;

// Khóa của hợp đồng: cùng công ty, cùng đối tác, phạm vi đúng `loyalty.partner`.
const selectKeys = sql`
  SELECT k.id, k.name, k.key_prefix, k.rate_limit_per_minute, k.expires_on::text AS expires_on, k.allowed_ips::text[] AS allowed_ips, k.status, k.revoked_reason,
    k.last_used_at, k.created_at, k.version, c.id AS contract_id,
    (SELECT count(*)::int FROM core.api_call_logs l WHERE l.api_key_id = k.id AND l.called_at >= ${startOfVietnamDay}) AS calls_today
  FROM core.api_keys k JOIN loyalty.partner_contracts c ON c.company_id = k.company_id AND c.partner_id = k.partner_id
  WHERE k.scopes = ARRAY['loyalty.partner']::text[]`;

@Injectable()
export class PartnerApiKeysService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly apiKeys: ApiKeysService,
  ) {}

  private actorOf(actor: BuyerAdminActor): Actor {
    return { userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client };
  }

  private itemOf(row: KeyRow): PartnerApiKeyItem {
    const expired = row.status === "active" && row.expires_on !== null && row.expires_on < vietnamDate(this.clock.now());
    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.key_prefix,
      rateLimitPerMinute: row.rate_limit_per_minute,
      expiresOn: row.expires_on,
      allowedIps: row.allowed_ips.map(displayIp),
      status: row.status === "revoked" ? "revoked" : expired ? "expired" : "active",
      revokedReason: row.revoked_reason,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      callsToday: row.calls_today,
      createdAt: new Date(row.created_at).toISOString(),
      version: row.version,
    };
  }

  // Khóa thuộc hợp đồng của công ty vận hành sàn.
  private async keyOf(executor: Executor, actor: BuyerAdminActor, keyId: string): Promise<{ contractId: string; row: KeyRow }> {
    const row = (await executor.execute<KeyRow & { contract_id: string }>(sql`${selectKeys} AND k.id = ${keyId} AND c.company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return { contractId: row.contract_id, row };
  }

  async list(actor: BuyerAdminActor, contractId: string): Promise<PartnerApiKeyItem[]> {
    await contractRow(this.database, contractId, actor.operatorCompanyId);
    const rows = await this.database.execute<KeyRow>(sql`${selectKeys} AND c.id = ${contractId} ORDER BY k.status, k.created_at DESC`);
    return rows.rows.map((row) => this.itemOf(row));
  }

  async create(actor: BuyerAdminActor, contractId: string, input: z.output<typeof partnerApiKeyCreateSchema>): Promise<PartnerApiKeySecret> {
    const contract = await contractRow(this.database, contractId, actor.operatorCompanyId);
    if (contract.status === "terminated") throw new ApiError("BUSINESS_RULE", "partnerApiKeyContractTerminated");
    const fields: Record<string, ErrorMessageKey> = {};
    const ips = this.apiKeys.checkAccess(input, fields, null);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    try {
      const issued = await this.database.transaction((transaction) =>
        this.apiKeys.issueLoyaltyKey(transaction, this.actorOf(actor), {
          partnerId: contract.partner_id,
          contractId,
          scope: "loyalty.partner",
          name: input.name,
          rateLimitPerMinute: input.rateLimitPerMinute,
          expiresOn: input.expiresOn,
          ips,
        }),
      );
      return { key: this.itemOf((await this.keyOf(this.database, actor, issued.id)).row), secret: issued.secret };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "apiKeyNameTaken" } });
      throw error;
    }
  }

  async update(actor: BuyerAdminActor, keyId: string, input: z.output<typeof partnerApiKeyUpdateSchema>): Promise<PartnerApiKeyItem> {
    const current = await this.keyOf(this.database, actor, keyId);
    if (current.row.status === "revoked") throw new ApiError("BUSINESS_RULE", "apiKeyRevoked");
    const fields: Record<string, ErrorMessageKey> = {};
    const ips = this.apiKeys.checkAccess(input, fields, current.row.expires_on);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    try {
      await this.database.transaction((transaction) =>
        this.apiKeys.updateLoyaltyKey(
          transaction,
          this.actorOf(actor),
          keyId,
          { name: input.name, rateLimitPerMinute: input.rateLimitPerMinute, expiresOn: input.expiresOn, ips, version: input.version },
          {
            before: { name: current.row.name, rateLimitPerMinute: current.row.rate_limit_per_minute, expiresOn: current.row.expires_on, allowedIps: current.row.allowed_ips.map(displayIp) },
            after: { contractId: current.contractId },
          },
          "crm",
        ),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "apiKeyNameTaken" } });
      throw error;
    }
    return this.itemOf((await this.keyOf(this.database, actor, keyId)).row);
  }

  async rotate(actor: BuyerAdminActor, keyId: string, version: number): Promise<PartnerApiKeySecret> {
    await this.keyOf(this.database, actor, keyId);
    const rotated = await this.apiKeys.rotate(this.actorOf(actor), keyId, { version });
    return { key: this.itemOf((await this.keyOf(this.database, actor, keyId)).row), secret: rotated.secret };
  }

  async revoke(actor: BuyerAdminActor, keyId: string, reason: string, version: number): Promise<PartnerApiKeyItem> {
    await this.keyOf(this.database, actor, keyId);
    await this.apiKeys.revoke(this.actorOf(actor), keyId, { reason, version });
    return this.itemOf((await this.keyOf(this.database, actor, keyId)).row);
  }
}
