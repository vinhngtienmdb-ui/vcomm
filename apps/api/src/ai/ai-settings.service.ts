// Cài đặt trợ lý AI của công ty (CHUC_NANG_226; QUYTAC_NGHIEPVU_511; API_278).
import { Inject, Injectable } from "@nestjs/common";
import { aiPermissions, type AiSettingsResponse, type updateAiSettingsSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AiAccessService, type AiSettingsRow } from "./ai-access.service";

const money = (value: number) => value.toFixed(2);

@Injectable()
export class AiSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly access: AiAccessService,
    private readonly permissionService: PermissionService,
    private readonly audit: AuditService,
  ) {}

  private async response(actor: Actor, row: AiSettingsRow): Promise<AiSettingsResponse> {
    const config = this.access.config;
    const granted = await this.permissionService.permissionsInCompany(actor.userId, actor.companyId);
    const rate = (
      await this.database.execute<{ rate: string; rate_date: string }>(sql`
        SELECT rate::text AS rate, rate_date::text AS rate_date FROM core.exchange_rates
        WHERE from_currency = 'USD' AND to_currency = 'VND' AND rate_type = 'sell' ORDER BY rate_date DESC, created_at DESC LIMIT 1`)
    ).rows[0];
    const acknowledged = (
      await this.database.execute<{ users: number }>(sql`
        SELECT count(DISTINCT n.user_id)::int AS users FROM ai.notice_acknowledgements n
        WHERE n.notice_version = ${config.noticeVersion}
          AND EXISTS (SELECT 1 FROM core.user_role_assignments a WHERE a.user_id = n.user_id AND a.company_id = ${actor.companyId})`)
    ).rows[0]!;
    return {
      chatEnabled: row.chat_enabled,
      productContentEnabled: row.product_content_enabled,
      monthlyBudgetUsd: money(Number(row.monthly_budget_usd)),
      dailyTurnsPerUser: row.daily_turns_per_user,
      version: row.version,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      canManage: granted.includes(aiPermissions.settings),
      provider: config.provider,
      model: config.provider ? config.model : null,
      configured: config.provider !== null,
      prices: { input: String(config.prices.input), output: String(config.prices.output), cacheRead: String(config.prices.cacheRead), cacheWrite: String(config.prices.cacheWrite) },
      month: this.access.month().start.slice(0, 7),
      spentThisMonthUsd: money(await this.access.spentThisMonth(actor.companyId)),
      usdToVnd: rate ? { rate: rate.rate, date: rate.rate_date } : null,
      notice: { version: config.noticeVersion, acknowledgedUsers: acknowledged.users },
    };
  }

  async get(actor: Actor): Promise<AiSettingsResponse> {
    return this.response(actor, await this.access.settings(actor.companyId));
  }

  async update(actor: Actor, input: z.output<typeof updateAiSettingsSchema>): Promise<AiSettingsResponse> {
    const row = await this.database.transaction(async (transaction) => {
      const before = await this.access.settings(actor.companyId, transaction);
      if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // version 0: công ty chưa có dòng cài đặt; hai người lưu cùng lúc thì người sau gặp xung đột.
      const saved =
        input.version === 0
          ? await transaction.execute<{ company_id: string }>(sql`
              INSERT INTO ai.settings (company_id, chat_enabled, product_content_enabled, monthly_budget_usd, daily_turns_per_user, updated_by)
              VALUES (${actor.companyId}, ${input.chatEnabled}, ${input.productContentEnabled}, ${input.monthlyBudgetUsd}::numeric, ${input.dailyTurnsPerUser}, ${actor.userId})
              ON CONFLICT (company_id) DO NOTHING RETURNING company_id`)
          : await transaction.execute<{ company_id: string }>(sql`
              UPDATE ai.settings SET chat_enabled = ${input.chatEnabled}, product_content_enabled = ${input.productContentEnabled},
                monthly_budget_usd = ${input.monthlyBudgetUsd}::numeric, daily_turns_per_user = ${input.dailyTurnsPerUser},
                updated_by = ${actor.userId}, updated_at = now(), version = version + 1
              WHERE company_id = ${actor.companyId} AND version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const after = await this.access.settings(actor.companyId, transaction);
      const view = (value: AiSettingsRow) => ({
        chatEnabled: value.chat_enabled,
        productContentEnabled: value.product_content_enabled,
        monthlyBudgetUsd: money(Number(value.monthly_budget_usd)),
        dailyTurnsPerUser: value.daily_turns_per_user,
      });
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "platform",
          action: "ai.settings.update",
          entityType: "ai_settings",
          entityId: actor.companyId,
          beforeData: view(before),
          afterData: view(after),
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
      return after;
    });
    return this.response(actor, row);
  }
}
