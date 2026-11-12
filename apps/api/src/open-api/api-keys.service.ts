// Quản lý khóa API đối tác (CHUC_NANG_217; QUYTAC_NGHIEPVU_480 đến 483, 493; API_255 đến API_258).
import { Inject, Injectable } from "@nestjs/common";
import type {
  ApiKeyDetail,
  ApiKeyItem,
  ApiKeyKind,
  ApiKeyOptions,
  ApiKeyScope,
  ApiKeySecretResponse,
  ApiKeyStatus,
  apiKeyListQuerySchema,
  createApiKeySchema,
  revokeApiKeySchema,
  rotateApiKeySchema,
  updateApiKeySchema,
} from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import type { Actor } from "../permissions/roles.service";
import { generateApiKey } from "./api-key-secret";
import { displayIp, parseIpEntry } from "./ip-allow-list";

type Executor = Pick<Database, "execute">;
type KeySettings = Pick<z.output<typeof createApiKeySchema>, "name" | "scopes" | "channelId" | "warehouseIds" | "rateLimitPerMinute" | "expiresOn" | "allowedIps">;

type KeyRow = {
  id: string;
  kind: ApiKeyKind;
  name: string;
  key_prefix: string;
  partner_id: string | null;
  partner_code: string | null;
  partner_name: string | null;
  scopes: ApiKeyScope[];
  channel_id: string;
  channel_name: string;
  rate_limit_per_minute: number;
  expires_on: string | null;
  status: "active" | "revoked";
  last_used_at: Date | null;
  created_at: Date;
  version: number;
};

const selectKeys = sql`
  SELECT k.id, k.kind, k.name, k.key_prefix, k.partner_id, p.code AS partner_code, p.name AS partner_name, k.scopes, k.channel_id, ch.name AS channel_name,
    k.rate_limit_per_minute, k.expires_on::text AS expires_on, k.status, k.last_used_at, k.created_at, k.version
  FROM core.api_keys k
  JOIN catalog.sales_channels ch ON ch.id = k.channel_id
  LEFT JOIN crm.partners p ON p.id = k.partner_id`;

const clientFields = (actor: Actor) => ({ ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId });

// Phạm vi cần kho: xem tồn, xuất đơn (QUYTAC_NGHIEPVU_482).
const scopesNeedingWarehouses: ApiKeyScope[] = ["catalog.read", "sales_order.write"];

@Injectable()
export class ApiKeysService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  private today(): string {
    return vietnamDate(this.clock.now());
  }

  private statusOf(row: Pick<KeyRow, "status" | "expires_on">): ApiKeyStatus {
    if (row.status === "revoked") return "revoked";
    return row.expires_on !== null && row.expires_on < this.today() ? "expired" : "active";
  }

  private toItem(row: KeyRow): ApiKeyItem {
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      keyPrefix: row.key_prefix,
      partnerId: row.partner_id,
      partnerCode: row.partner_code,
      partnerName: row.partner_name,
      scopes: row.scopes,
      channelId: row.channel_id,
      channelName: row.channel_name,
      rateLimitPerMinute: row.rate_limit_per_minute,
      expiresOn: row.expires_on,
      status: this.statusOf(row),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      version: row.version,
    };
  }

  async list(actor: Actor, query: z.output<typeof apiKeyListQuerySchema>): Promise<ApiKeyItem[]> {
    const conditions: SQL[] = [sql`k.company_id = ${actor.companyId}`];
    if (query.kind) conditions.push(sql`k.kind = ${query.kind}`);
    if (query.status === "revoked") conditions.push(sql`k.status = 'revoked'`);
    if (query.status === "active") conditions.push(sql`k.status = 'active' AND (k.expires_on IS NULL OR k.expires_on >= ${this.today()}::date)`);
    if (query.status === "expired") conditions.push(sql`k.status = 'active' AND k.expires_on < ${this.today()}::date`);
    if (query.q) {
      const text = query.q.toLowerCase();
      conditions.push(sql`(strpos(lower(k.name), ${text}) > 0 OR strpos(lower(coalesce(p.name, '')), ${text}) > 0 OR strpos(lower(coalesce(p.code, '')), ${text}) > 0
        OR strpos(lower(k.key_prefix), ${text.replace(/^vck_/, "")}) = 1)`);
    }
    const rows = await this.database.execute<KeyRow>(sql`${selectKeys} WHERE ${sql.join(conditions, sql` AND `)} ORDER BY k.status, k.created_at DESC`);
    return rows.rows.map((row) => this.toItem(row));
  }

  async detail(actor: Actor, id: string): Promise<ApiKeyDetail> {
    const row = (
      await this.database.execute<
        KeyRow & {
          allowed_ips: string[];
          customer_group_name: string | null;
          created_by_name: string | null;
          revoked_reason: string | null;
          revoked_at: Date | null;
        }
      >(sql`
      SELECT listed.*, k.allowed_ips::text[] AS allowed_ips, g.name AS customer_group_name, u.full_name AS created_by_name, k.revoked_reason, k.revoked_at
      FROM (${selectKeys} WHERE k.id = ${id} AND k.company_id = ${actor.companyId}) listed
      JOIN core.api_keys k ON k.id = listed.id
      LEFT JOIN crm.partner_profiles pp ON pp.company_id = k.company_id AND pp.partner_id = k.partner_id
      LEFT JOIN catalog.customer_groups g ON g.id = pp.customer_group_id
      LEFT JOIN core.users u ON u.id = k.created_by`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const warehouses = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT w.id, w.code, w.name FROM core.api_key_warehouses kw JOIN inventory.warehouses w ON w.id = kw.warehouse_id WHERE kw.api_key_id = ${id} ORDER BY w.code`);
    const stats = (
      await this.database.execute<{ calls: number; errors: number; limited: number; peak: number; last_ip: string | null }>(sql`
      WITH recent AS (SELECT status_code, called_at, ip FROM core.api_call_logs WHERE api_key_id = ${id} AND called_at >= now() - interval '24 hours')
      SELECT (SELECT count(*)::int FROM recent) AS calls,
        (SELECT count(*)::int FROM recent WHERE status_code >= 400) AS errors,
        (SELECT count(*)::int FROM recent WHERE status_code = 429) AS limited,
        coalesce((SELECT max(c)::int FROM (SELECT count(*) AS c FROM recent GROUP BY date_trunc('minute', called_at)) m), 0) AS peak,
        (SELECT host(ip) FROM core.api_call_logs WHERE api_key_id = ${id} ORDER BY called_at DESC LIMIT 1) AS last_ip`)
    ).rows[0]!;
    const history = await this.database.execute<{ occurred_at: Date; actor_name: string | null; action: string; after_data: unknown }>(sql`
      SELECT e.occurred_at, u.full_name AS actor_name, e.action, e.after_data
      FROM core.audit_events e LEFT JOIN core.users u ON u.id = e.actor_user_id
      WHERE e.entity_type = 'api_key' AND e.entity_id = ${id} AND e.company_id = ${actor.companyId}
      ORDER BY e.occurred_at DESC LIMIT 50`);
    return {
      ...this.toItem(row),
      warehouses: warehouses.rows,
      allowedIps: row.allowed_ips.map(displayIp),
      partnerCustomerGroupName: row.customer_group_name,
      createdByName: row.created_by_name,
      revokedReason: row.revoked_reason,
      revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
      stats: { calls24h: stats.calls, errors24h: stats.errors, rateLimited24h: stats.limited, peakPerMinute24h: stats.peak, lastIp: stats.last_ip },
      history: history.rows.map((entry) => ({ occurredAt: new Date(entry.occurred_at).toISOString(), actorName: entry.actor_name, action: entry.action, afterData: entry.after_data })),
    };
  }

  // Đối tác (khách hàng đang giao dịch), kênh, kho để chọn khi cấp khóa.
  async options(actor: Actor, partnerSearch: string | undefined): Promise<ApiKeyOptions> {
    const text = partnerSearch?.toLowerCase() ?? "";
    const partners = await this.database.execute<{ id: string; code: string; name: string; customer_group_name: string | null }>(sql`
      SELECT p.id, p.code, p.name, g.name AS customer_group_name
      FROM crm.partner_profiles pp JOIN crm.partners p ON p.id = pp.partner_id LEFT JOIN catalog.customer_groups g ON g.id = pp.customer_group_id
      WHERE pp.company_id = ${actor.companyId} AND pp.is_customer AND pp.status = 'active' AND p.status = 'active'
        AND (${text} = '' OR strpos(lower(p.name), ${text}) > 0 OR strpos(lower(p.code), ${text}) > 0)
      ORDER BY p.name LIMIT 50`);
    const channels = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM catalog.sales_channels WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    const warehouses = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM inventory.warehouses WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    return {
      partners: partners.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, customerGroupName: row.customer_group_name })),
      channels: channels.rows,
      warehouses: warehouses.rows,
    };
  }

  async create(actor: Actor, input: z.output<typeof createApiKeySchema>): Promise<ApiKeySecretResponse> {
    const fields: Record<string, ErrorMessageKey> = {};
    if (input.kind === "partner") {
      if (!input.partnerId || !(await this.partnerUsable(this.database, actor.companyId, input.partnerId))) fields.partnerId = "apiKeyPartnerInvalid";
    } else if (input.partnerId) fields.partnerId = "invalidValue";
    const settings = await this.checkSettings(actor, input, fields, null);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const generated = generateApiKey();
    try {
      const id: string = await this.database.transaction(async (transaction): Promise<string> => {
        const inserted = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO core.api_keys (company_id, kind, partner_id, name, key_prefix, key_hash, scopes, channel_id, rate_limit_per_minute, expires_on, allowed_ips, created_by, updated_by)
          VALUES (${actor.companyId}, ${input.kind}, ${input.kind === "partner" ? input.partnerId : null}, ${input.name}, ${generated.prefix}, ${generated.hash},
            ${pgArray(input.scopes)}::text[], ${input.channelId}, ${input.rateLimitPerMinute}, ${input.expiresOn}::date, ${pgArray(settings.ips)}::inet[], ${actor.userId}, ${actor.userId})
          RETURNING id`)
        ).rows[0]!.id;
        await this.saveWarehouses(transaction, inserted, settings.warehouseIds);
        await this.audit.record(
          {
            actorUserId: actor.userId,
            companyId: actor.companyId,
            appCode: "platform",
            action: "api_key.create",
            entityType: "api_key",
            entityId: inserted,
            afterData: { ...this.auditSettings(input, settings), kind: input.kind, partnerId: input.partnerId, keyPrefix: generated.prefix },
            ...clientFields(actor),
          },
          transaction,
        );
        return inserted;
      });
      return { key: await this.detail(actor, id), secret: generated.secret };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "apiKeyNameTaken" } });
      throw error;
    }
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateApiKeySchema>): Promise<ApiKeyDetail> {
    const current = await this.current(actor, id);
    const fields: Record<string, ErrorMessageKey> = {};
    const settings = await this.checkSettings(actor, input, fields, current.expires_on);
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    try {
      await this.database.transaction(async (transaction) => {
        const updated = await transaction.execute(sql`
          UPDATE core.api_keys SET name = ${input.name}, scopes = ${pgArray(input.scopes)}::text[], channel_id = ${input.channelId}, rate_limit_per_minute = ${input.rateLimitPerMinute},
            expires_on = ${input.expiresOn}::date, allowed_ips = ${pgArray(settings.ips)}::inet[], updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'active' AND version = ${input.version}`);
        if (updated.rowCount !== 1) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`DELETE FROM core.api_key_warehouses WHERE api_key_id = ${id}`);
        await this.saveWarehouses(transaction, id, settings.warehouseIds);
        await this.audit.record(
          {
            actorUserId: actor.userId,
            companyId: actor.companyId,
            appCode: "platform",
            action: "api_key.update",
            entityType: "api_key",
            entityId: id,
            beforeData: current.audit,
            afterData: this.auditSettings(input, settings),
            ...clientFields(actor),
          },
          transaction,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "apiKeyNameTaken" } });
      throw error;
    }
    return this.detail(actor, id);
  }

  // Cấp lại: chuỗi cũ hết dùng được ngay, giữ cấu hình và nhật ký (QUYTAC_NGHIEPVU_483).
  async rotate(actor: Actor, id: string, input: z.output<typeof rotateApiKeySchema>): Promise<ApiKeySecretResponse> {
    const current = await this.current(actor, id);
    const generated = generateApiKey();
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.api_keys SET key_prefix = ${generated.prefix}, key_hash = ${generated.hash}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'active' AND version = ${input.version}`);
      if (updated.rowCount !== 1) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "platform",
          action: "api_key.rotate",
          entityType: "api_key",
          entityId: id,
          beforeData: { keyPrefix: current.key_prefix },
          afterData: { keyPrefix: generated.prefix },
          ...clientFields(actor),
        },
        transaction,
      );
    });
    return { key: await this.detail(actor, id), secret: generated.secret };
  }

  async revoke(actor: Actor, id: string, input: z.output<typeof revokeApiKeySchema>): Promise<ApiKeyDetail> {
    await this.current(actor, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.api_keys SET status = 'revoked', revoked_reason = ${input.reason}, revoked_by = ${actor.userId}, revoked_at = now(), updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'active' AND version = ${input.version}`);
      if (updated.rowCount !== 1) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "platform",
          action: "api_key.revoke",
          entityType: "api_key",
          entityId: id,
          afterData: { reason: input.reason },
          ...clientFields(actor),
        },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Khóa còn dùng của công ty; khóa đã thu hồi không sửa (QUYTAC_NGHIEPVU_483).
  private async current(actor: Actor, id: string): Promise<{ key_prefix: string; expires_on: string | null; audit: Record<string, unknown> }> {
    const row = (
      await this.database.execute<{
        key_prefix: string;
        status: string;
        name: string;
        scopes: string[];
        channel_id: string;
        rate_limit_per_minute: number;
        expires_on: string | null;
        allowed_ips: string[];
        warehouse_ids: string[];
      }>(sql`
      SELECT k.key_prefix, k.status, k.name, k.scopes, k.channel_id, k.rate_limit_per_minute, k.expires_on::text AS expires_on, k.allowed_ips::text[] AS allowed_ips,
        ARRAY(SELECT warehouse_id::text FROM core.api_key_warehouses WHERE api_key_id = k.id ORDER BY warehouse_id) AS warehouse_ids
      FROM core.api_keys k WHERE k.id = ${id} AND k.company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status === "revoked") throw new ApiError("BUSINESS_RULE", "apiKeyRevoked");
    return {
      key_prefix: row.key_prefix,
      expires_on: row.expires_on,
      audit: {
        name: row.name,
        scopes: row.scopes,
        channelId: row.channel_id,
        rateLimitPerMinute: row.rate_limit_per_minute,
        expiresOn: row.expires_on,
        allowedIps: row.allowed_ips.map(displayIp),
        warehouseIds: row.warehouse_ids,
      },
    };
  }

  private auditSettings(input: KeySettings, settings: { warehouseIds: string[]; ips: string[] }): Record<string, unknown> {
    return {
      name: input.name,
      scopes: input.scopes,
      channelId: input.channelId,
      rateLimitPerMinute: input.rateLimitPerMinute,
      expiresOn: input.expiresOn,
      allowedIps: settings.ips,
      warehouseIds: settings.warehouseIds,
    };
  }

  // Kiểm cấu hình chung của cấp và sửa (QUYTAC_NGHIEPVU_482); lỗi ghi vào `fields`.
  private async checkSettings(actor: Actor, input: KeySettings, fields: Record<string, ErrorMessageKey>, currentExpiresOn: string | null): Promise<{ warehouseIds: string[]; ips: string[] }> {
    const channel = await this.database.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE id = ${input.channelId} AND company_id = ${actor.companyId} AND status = 'active'`);
    if (channel.rows.length === 0) fields.channelId = "apiKeyChannelInvalid";
    const warehouseIds = [...new Set(input.warehouseIds)].sort();
    if (warehouseIds.length > 0) {
      const found = (
        await this.database.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM inventory.warehouses WHERE company_id = ${actor.companyId} AND status = 'active' AND id = ANY(${pgArray(warehouseIds)}::uuid[])`)
      ).rows[0]!.total;
      if (found !== warehouseIds.length) fields.warehouseIds = "apiKeyWarehouseInvalid";
    } else if (input.scopes.some((scope) => scopesNeedingWarehouses.includes(scope))) fields.warehouseIds = "apiKeyWarehouseRequired";
    // Hạn dùng mới phải từ ngày mai; giữ nguyên hạn cũ khi sửa thì không kiểm.
    if (input.expiresOn !== null && input.expiresOn !== currentExpiresOn && input.expiresOn <= this.today()) fields.expiresOn = "apiKeyExpiryInvalid";
    const ips: string[] = [];
    for (const entry of input.allowedIps) {
      const parsed = parseIpEntry(entry);
      if (!parsed) {
        fields.allowedIps = "apiKeyIpInvalid";
        break;
      }
      const maximum = parsed.family === "ipv4" ? 32 : 128;
      const text = parsed.prefix === maximum ? parsed.address : `${parsed.address}/${parsed.prefix}`;
      if (!ips.includes(text)) ips.push(text);
    }
    return { warehouseIds, ips };
  }

  private async partnerUsable(executor: Executor, companyId: string, partnerId: string): Promise<boolean> {
    const rows = await executor.execute(sql`
      SELECT 1 FROM crm.partner_profiles pp JOIN crm.partners p ON p.id = pp.partner_id
      WHERE pp.company_id = ${companyId} AND pp.partner_id = ${partnerId} AND pp.is_customer AND pp.status = 'active' AND p.status = 'active'`);
    return rows.rows.length > 0;
  }

  private async saveWarehouses(executor: Executor, id: string, warehouseIds: string[]): Promise<void> {
    if (warehouseIds.length === 0) return;
    await executor.execute(sql`INSERT INTO core.api_key_warehouses (api_key_id, warehouse_id) SELECT ${id}, unnest(${pgArray(warehouseIds)}::uuid[])`);
  }
}
