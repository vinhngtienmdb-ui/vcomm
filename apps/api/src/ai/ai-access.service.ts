// Điều kiện dùng trợ lý, hạn mức, nhật ký lượt (CHUC_NANG_226; QUYTAC_NGHIEPVU_510, 512, 513, 515; API_273).
import { Inject, Injectable } from "@nestjs/common";
import { aiFeatures, aiPermissions, type AiFeature, type AiFeatureStatus, type AiMeResponse, type AiUnavailableReason, type ErrorCode } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { usersWithPermission } from "../hr/attendance-access";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AI_CONFIG, costOf, type AiConfig, type AiUsage } from "./ai-config";

type Executor = Pick<Database, "execute">;

export type AiSettingsRow = {
  chat_enabled: boolean;
  product_content_enabled: boolean;
  monthly_budget_usd: string;
  daily_turns_per_user: number;
  quota_notified_month: string | null;
  updated_at: Date | string | null;
  version: number;
};

export const defaultSettings: AiSettingsRow = {
  chat_enabled: false,
  product_content_enabled: false,
  monthly_budget_usd: "0.00",
  daily_turns_per_user: 30,
  quota_notified_month: null,
  updated_at: null,
  version: 0,
};

export const featurePermission: Record<AiFeature, string> = { chat: aiPermissions.chat, product_content: aiPermissions.productContent };

const reasonErrors: Record<Exclude<AiUnavailableReason, "no_permission">, [ErrorCode, ErrorMessageKey]> = {
  not_configured: ["AI_NOT_CONFIGURED", "aiNotConfigured"],
  disabled: ["AI_FEATURE_DISABLED", "aiFeatureDisabled"],
  no_budget: ["AI_FEATURE_DISABLED", "aiFeatureDisabled"],
  quota_exceeded: ["AI_QUOTA_EXCEEDED", "aiQuotaExceeded"],
  daily_limit: ["AI_DAILY_LIMIT", "aiDailyLimit"],
  notice_required: ["AI_NOTICE_REQUIRED", "aiNoticeRequired"],
};

export interface UsageRecord {
  feature: AiFeature;
  conversationId?: string | null;
  productId?: string | null;
  model: string;
  usage: AiUsage;
  toolCalls: number;
  status: "ok" | "refusal" | "error" | "max_tokens";
  durationMs: number;
}

// Khóa một lượt mỗi người: dòng quá 3 phút coi như lượt đã dừng bất thường (QUYTAC_NGHIEPVU_519).
export const turnLockSeconds = 180;

// Mốc thời gian theo giờ Việt Nam (UTC+7, không đổi giờ theo mùa).
const vietnamStart = (day: string) => `${day}T00:00:00+07:00`;
function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}
function nextMonth(monthStart: string): string {
  const [year, month] = monthStart.split("-").map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

@Injectable()
export class AiAccessService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AI_CONFIG) readonly config: AiConfig,
    private readonly permissionService: PermissionService,
  ) {}

  today(): string {
    return vietnamDate(this.clock.now());
  }

  // Tháng hạn mức hiện tại: ngày đầu tháng và ngày đầu tháng sau.
  month(): { start: string; next: string } {
    const start = `${this.today().slice(0, 7)}-01`;
    return { start, next: nextMonth(start) };
  }

  async settings(companyId: string, executor: Executor = this.database): Promise<AiSettingsRow> {
    const row = (
      await executor.execute<AiSettingsRow>(sql`
        SELECT chat_enabled, product_content_enabled, monthly_budget_usd::text AS monthly_budget_usd, daily_turns_per_user,
          quota_notified_month::text AS quota_notified_month, updated_at, version
        FROM ai.settings WHERE company_id = ${companyId}`)
    ).rows[0];
    return row ?? defaultSettings;
  }

  async spentThisMonth(companyId: string, executor: Executor = this.database): Promise<number> {
    const { start, next } = this.month();
    const row = (
      await executor.execute<{ spent: string }>(sql`
        SELECT COALESCE(SUM(cost_usd), 0)::text AS spent FROM ai.usage_events
        WHERE company_id = ${companyId} AND created_at >= ${vietnamStart(start)}::timestamptz AND created_at < ${vietnamStart(next)}::timestamptz`)
    ).rows[0]!;
    return Number(row.spent);
  }

  async turnsToday(userId: string, companyId: string): Promise<number> {
    const day = this.today();
    const row = (
      await this.database.execute<{ turns: number }>(sql`
        SELECT count(*)::int AS turns FROM ai.usage_events
        WHERE user_id = ${userId} AND company_id = ${companyId} AND created_at >= ${vietnamStart(day)}::timestamptz AND created_at < ${vietnamStart(nextDay(day))}::timestamptz`)
    ).rows[0]!;
    return row.turns;
  }

  async acknowledged(userId: string): Promise<boolean> {
    const rows = await this.database.execute(sql`SELECT 1 FROM ai.notice_acknowledgements WHERE user_id = ${userId} AND notice_version = ${this.config.noticeVersion}`);
    return rows.rows.length > 0;
  }

  async acknowledge(userId: string, noticeVersion: number): Promise<void> {
    if (noticeVersion !== this.config.noticeVersion) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { noticeVersion: "invalidValue" } });
    await this.database.execute(sql`INSERT INTO ai.notice_acknowledgements (user_id, notice_version) VALUES (${userId}, ${noticeVersion}) ON CONFLICT DO NOTHING`);
  }

  // Trạng thái từng tính năng của người dùng ở công ty đang chọn (QUYTAC_NGHIEPVU_510, 513).
  async status(userId: string, companyId: string | null): Promise<AiMeResponse> {
    const granted = companyId ? await this.permissionService.permissionsInCompany(userId, companyId) : [];
    const settings = companyId ? await this.settings(companyId) : defaultSettings;
    const acknowledged = await this.acknowledged(userId);
    const spent = companyId ? await this.spentThisMonth(companyId) : 0;
    const turns = companyId ? await this.turnsToday(userId, companyId) : 0;
    const budget = Number(settings.monthly_budget_usd);
    const features = aiFeatures.map((feature): AiFeatureStatus => {
      const enabled = feature === "chat" ? settings.chat_enabled : settings.product_content_enabled;
      let reason: AiUnavailableReason | null = null;
      let reopensAt: string | null = null;
      if (!companyId || !granted.includes(featurePermission[feature])) reason = "no_permission";
      else if (!this.config.provider) reason = "not_configured";
      else if (!enabled) reason = "disabled";
      else if (budget <= 0) reason = "no_budget";
      else if (spent >= budget) {
        reason = "quota_exceeded";
        reopensAt = vietnamStart(this.month().next);
      } else if (turns >= settings.daily_turns_per_user) {
        reason = "daily_limit";
        reopensAt = vietnamStart(nextDay(this.today()));
      } else if (!acknowledged) reason = "notice_required";
      return { feature, permitted: reason !== "no_permission", available: reason === null, reason, reopensAt };
    });
    return {
      features,
      dailyTurns: settings.daily_turns_per_user,
      remainingTurnsToday: Math.max(0, settings.daily_turns_per_user - turns),
      notice: { version: this.config.noticeVersion, acknowledged, provider: this.config.provider },
    };
  }

  // Kiểm trước mỗi lượt; không đủ điều kiện thì báo lỗi theo lý do đầu tiên (API_275, API_277).
  async begin(actor: Actor, feature: AiFeature): Promise<AiFeatureStatus> {
    const status = (await this.status(actor.userId, actor.companyId)).features.find((item) => item.feature === feature)!;
    if (status.reason === "no_permission") throw new ApiError("FORBIDDEN", "forbidden");
    if (status.reason) {
      const [code, key] = reasonErrors[status.reason];
      throw new ApiError(code, key);
    }
    return status;
  }

  // Một lượt đang chạy mỗi người cho mọi tính năng (hỏi đáp, soạn nội dung); dùng được khi chạy nhiều tiến trình API.
  async lockTurn(userId: string): Promise<void> {
    const now = this.clock.now().toISOString();
    const locked = await this.database.execute(sql`
      INSERT INTO ai.active_turns (user_id, started_at) VALUES (${userId}, ${now}::timestamptz)
      ON CONFLICT (user_id) DO UPDATE SET started_at = EXCLUDED.started_at
      WHERE ai.active_turns.started_at < ${now}::timestamptz - make_interval(secs => ${turnLockSeconds})
      RETURNING user_id`);
    if (locked.rows.length === 0) throw new ApiError("AI_BUSY", "aiBusy");
  }

  async unlockTurn(userId: string): Promise<void> {
    await this.database.execute(sql`DELETE FROM ai.active_turns WHERE user_id = ${userId}`);
  }

  // Ghi nhật ký lượt; lần đầu trong tháng tổng chi phí đạt hạn mức thì báo người có quyền cài đặt (QUYTAC_NGHIEPVU_513).
  async record(actor: Actor, entry: UsageRecord): Promise<{ usageEventId: string; costUsd: number }> {
    const cost = costOf(entry.usage, this.config.prices);
    return this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO ai.usage_events (company_id, user_id, feature, conversation_id, product_id, provider, model, input_tokens, cache_read_tokens, cache_write_tokens,
          output_tokens, tool_calls, cost_usd, status, duration_ms, created_at)
        VALUES (${actor.companyId}, ${actor.userId}, ${entry.feature}, ${entry.conversationId ?? null}, ${entry.productId ?? null}, ${this.config.provider ?? "none"}, ${entry.model},
          ${entry.usage.inputTokens}, ${entry.usage.cacheReadTokens}, ${entry.usage.cacheWriteTokens}, ${entry.usage.outputTokens}, ${entry.toolCalls}, ${cost.toFixed(6)},
          ${entry.status}, ${Math.max(0, Math.round(entry.durationMs))}, ${this.clock.now().toISOString()}::timestamptz)
        RETURNING id::text AS id`);
      const settings = await this.settings(actor.companyId, transaction);
      const budget = Number(settings.monthly_budget_usd);
      const { start } = this.month();
      if (budget > 0 && settings.quota_notified_month !== start && (await this.spentThisMonth(actor.companyId, transaction)) >= budget) {
        // Cập nhật có điều kiện để hai lượt cùng lúc chỉ gửi một thông báo.
        const marked = await transaction.execute(sql`
          UPDATE ai.settings SET quota_notified_month = ${start}::date
          WHERE company_id = ${actor.companyId} AND quota_notified_month IS DISTINCT FROM ${start}::date RETURNING company_id`);
        if (marked.rows.length > 0) {
          const recipients = await usersWithPermission(transaction, actor.companyId, aiPermissions.settings, this.today());
          await notify(
            transaction,
            recipients.map((userId) => ({
              userId,
              companyId: actor.companyId,
              kind: "ai.quota_exceeded",
              title: `Trợ lý AI đã dùng hết hạn mức ${settings.monthly_budget_usd} USD tháng ${start.slice(5, 7)}/${start.slice(0, 4)}; mở lại ngày 1 tháng sau hoặc khi tăng hạn mức`,
              link: "/platform/ai-settings",
              payload: { month: start, budgetUsd: settings.monthly_budget_usd },
            })),
          );
        }
      }
      return { usageEventId: inserted.rows[0]!.id, costUsd: cost };
    });
  }
}
