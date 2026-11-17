// Tham số chuyển đổi sang Smart OTP và thống kê (CONG_VIEC_72; QUYTAC_NGHIEPVU_561, 572; API_323).
// Một dòng trong core.authentication_settings; thời hạn tính cả ngày bắt đầu: ngày cuối = ngày bắt đầu + số ngày − 1, hết ngày giờ Việt Nam.
import { Inject, Injectable } from "@nestjs/common";
import { type AuthenticationSettingsResponse, type OtpStatisticPurpose, otpStatisticPurposes, type updateAuthenticationSettingsSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { portalSetUpSql } from "../affiliate/portal-set-up";
import { DATABASE, type Database } from "../database/database.module";
import type { ClientInfo } from "./auth.service";

type Executor = Pick<Database, "execute">;

export interface AuthenticationSettings {
  transitionStartsOn: string;
  buyerTransitionDays: number;
  portalTransitionDays: number;
  recoveryRedeemLockHours: number;
  supportHotline: string | null;
  version: number;
}

export interface SettingsActor {
  userId: string;
  operatorCompanyId: string;
  client: ClientInfo;
}

// Ngày theo giờ Việt Nam dạng YYYY-MM-DD.
export function vietnamDate(moment: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(moment);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Ngày cuối của thời hạn chuyển đổi.
export const transitionEndsOn = (startsOn: string, days: number) => addDays(startsOn, days - 1);

@Injectable()
export class AuthenticationSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  async current(executor: Executor = this.database): Promise<AuthenticationSettings> {
    const row = (
      await executor.execute<{
        transition_starts_on: string;
        buyer_transition_days: number;
        portal_transition_days: number;
        recovery_redeem_lock_hours: number;
        support_hotline: string | null;
        version: number;
      }>(sql`
        SELECT transition_starts_on::text, buyer_transition_days, portal_transition_days, recovery_redeem_lock_hours, support_hotline, version
        FROM core.authentication_settings WHERE id = 1`)
    ).rows[0]!;
    return {
      transitionStartsOn: row.transition_starts_on,
      buyerTransitionDays: row.buyer_transition_days,
      portalTransitionDays: row.portal_transition_days,
      recoveryRedeemLockHours: row.recovery_redeem_lock_hours,
      supportHotline: row.support_hotline,
      version: row.version,
    };
  }

  // Còn trong thời hạn chuyển đổi của người mua: khách chưa kích hoạt Smart OTP còn được dùng SMS dự phòng (QUYTAC_NGHIEPVU_560, 561).
  async buyerTransitionOpen(executor: Executor = this.database): Promise<boolean> {
    const settings = await this.current(executor);
    return vietnamDate(this.clock.now()) <= transitionEndsOn(settings.transitionStartsOn, settings.buyerTransitionDays);
  }

  // Còn trong thời hạn chuyển đổi của cổng cửa hàng liên kết: tài khoản chưa thiết lập còn đăng nhập bằng mã SMS (QUYTAC_NGHIEPVU_570).
  async portalTransitionOpen(executor: Executor = this.database): Promise<boolean> {
    const settings = await this.current(executor);
    return vietnamDate(this.clock.now()) <= transitionEndsOn(settings.transitionStartsOn, settings.portalTransitionDays);
  }

  async view(canManage: boolean): Promise<AuthenticationSettingsResponse> {
    const settings = await this.current();
    const since = new Date(this.clock.now().getTime() - 30 * 86_400_000);
    const buyers = (
      await this.database.execute<{ active_buyers: number; smart_otp_active: number; smart_otp_on_web: number }>(sql`
        SELECT count(*)::int AS active_buyers,
          count(d.user_id)::int AS smart_otp_active,
          count(d.user_id) FILTER (WHERE d.platform = 'web')::int AS smart_otp_on_web
        FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id AND u.status = 'active'
        LEFT JOIN core.smart_otp_devices d ON d.user_id = b.user_id`)
    ).rows[0]!;
    // Thành viên cổng đang hoạt động; đã thiết lập = có mật khẩu và ứng dụng xác thực đã xác nhận (sau lần đặt lại xác thực nếu có).
    const portal = (
      await this.database.execute<{ members: number; set_up: number }>(sql`
        SELECT count(DISTINCT m.user_id)::int AS members,
          count(DISTINCT m.user_id) FILTER (WHERE ${portalSetUpSql(sql`m.user_id`)})::int AS set_up
        FROM affiliate.members m JOIN core.users u ON u.id = m.user_id AND u.status = 'active'
        WHERE m.status = 'active'`)
    ).rows[0]!;
    // Chỉ tính tin đã giao cho nhà cung cấp (thành công), không tính tin bỏ qua vì chưa cài eSMS.
    const sms = await this.database.execute<{ otp_purpose: string; total: number }>(sql`
      SELECT otp_purpose, count(*)::int AS total FROM core.message_deliveries
      WHERE otp_purpose IS NOT NULL AND status = 'sent' AND created_at >= ${since} GROUP BY otp_purpose`);
    const counted = new Map(sms.rows.map((row) => [row.otp_purpose, row.total]));
    return {
      ...settings,
      buyerTransitionEndsOn: transitionEndsOn(settings.transitionStartsOn, settings.buyerTransitionDays),
      portalTransitionEndsOn: transitionEndsOn(settings.transitionStartsOn, settings.portalTransitionDays),
      canManage,
      statistics: {
        activeBuyers: buyers.active_buyers,
        smartOtpActive: buyers.smart_otp_active,
        smartOtpOnWeb: buyers.smart_otp_on_web,
        portalMembers: portal.members,
        portalMembersSetUp: portal.set_up,
        smsLast30Days: otpStatisticPurposes.map((purpose: OtpStatisticPurpose) => ({ purpose, count: counted.get(purpose) ?? 0 })),
      },
    };
  }

  async update(actor: SettingsActor, input: z.output<typeof updateAuthenticationSettingsSchema>): Promise<AuthenticationSettingsResponse> {
    if (input.transitionStartsOn > vietnamDate(this.clock.now())) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { transitionStartsOn: "transitionStartFuture" } });
    await this.database.transaction(async (transaction) => {
      const before = await this.current(transaction);
      const saved = await transaction.execute(sql`
        UPDATE core.authentication_settings SET transition_starts_on = ${input.transitionStartsOn}::date, buyer_transition_days = ${input.buyerTransitionDays},
          portal_transition_days = ${input.portalTransitionDays}, recovery_redeem_lock_hours = ${input.recoveryRedeemLockHours}, support_hotline = ${input.supportHotline},
          version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = 1 AND version = ${input.version} RETURNING version`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const { version: _beforeVersion, ...beforeData } = before;
      const { version: _inputVersion, ...afterData } = input;
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "marketplace",
          action: "authentication_settings.update",
          entityType: "core.authentication_settings",
          entityId: null,
          beforeData,
          afterData,
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.view(true);
  }
}
