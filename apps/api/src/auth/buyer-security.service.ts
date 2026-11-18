// Bảo mật đăng nhập của người mua trên web-crm (CONG_VIEC_72; QUYTAC_NGHIEPVU_567; API_322).
// Chăm sóc khách hàng hủy Smart OTP khi khách mất máy và số điện thoại: xóa Smart OTP, thu hồi mọi phiên, gỡ mọi thiết bị tin cậy,
// cho đặt lại mật khẩu bằng SMS một lần trong 24 giờ; lý do bắt buộc, ghi nhật ký, thông báo khách.
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerSecurityResponse, revokeBuyerSmartOtpSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { MessagingService } from "../integrations/messaging.service";
import { AuthenticationSettingsService, transitionEndsOn } from "./authentication-settings.service";
import type { ClientInfo } from "./auth.service";

export interface SecurityActor {
  userId: string;
  operatorCompanyId: string;
  client: ClientInfo;
}

const smsResetHours = 24;

@Injectable()
export class BuyerSecurityService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly settings: AuthenticationSettingsService,
    private readonly messaging: MessagingService,
  ) {}

  private async requireBuyer(userId: string): Promise<void> {
    const found = await this.database.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId}`);
    if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  async view(userId: string, canRevoke: boolean): Promise<BuyerSecurityResponse> {
    await this.requireBuyer(userId);
    const row = (
      await this.database.execute<{
        device_name: string | null;
        platform: "ios" | "android" | "web" | null;
        activated_at: Date | null;
        locked_until: Date | null;
        version: number | null;
        redeem_locked_until: Date | null;
        recovered_at: Date | null;
        trusted: number;
        last_seen_at: Date | null;
      }>(sql`
        SELECT d.device_name, d.platform, d.activated_at, CASE WHEN d.locked_until > now() THEN d.locked_until END AS locked_until, d.version,
          CASE WHEN s.redeem_locked_until > now() THEN s.redeem_locked_until END AS redeem_locked_until, s.smart_otp_recovered_at AS recovered_at,
          (SELECT count(*)::int FROM core.trusted_devices t WHERE t.user_id = u.id AND t.removed_at IS NULL AND t.last_seen_at >= now() - interval '360 days') AS trusted,
          (SELECT max(t.last_seen_at) FROM core.trusted_devices t WHERE t.user_id = u.id AND t.removed_at IS NULL) AS last_seen_at
        FROM core.users u LEFT JOIN core.smart_otp_devices d ON d.user_id = u.id LEFT JOIN core.account_security s ON s.user_id = u.id
        WHERE u.id = ${userId}`)
    ).rows[0]!;
    const settings = await this.settings.current();
    const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
    return {
      smartOtp: {
        active: row.activated_at !== null,
        deviceName: row.device_name,
        platform: row.platform,
        activatedAt: iso(row.activated_at),
        lockedUntil: iso(row.locked_until),
        version: row.version,
      },
      redeemLockedUntil: iso(row.redeem_locked_until),
      recoveredAt: iso(row.recovered_at),
      trustedDevices: row.trusted,
      lastSeenAt: iso(row.last_seen_at),
      buyerTransitionEndsOn: transitionEndsOn(settings.transitionStartsOn, settings.buyerTransitionDays),
      canRevoke,
    };
  }

  async revoke(actor: SecurityActor, userId: string, input: z.output<typeof revokeBuyerSmartOtpSchema>): Promise<BuyerSecurityResponse> {
    await this.requireBuyer(userId);
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute<{ device_name: string }>(sql`
        DELETE FROM core.smart_otp_devices WHERE user_id = ${userId} AND version = ${input.version} RETURNING device_name`);
      if (removed.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`);
      await transaction.execute(sql`UPDATE core.trusted_devices SET removed_at = now() WHERE user_id = ${userId} AND removed_at IS NULL`);
      await transaction.execute(sql`
        INSERT INTO core.account_security (user_id, sms_password_reset_until) VALUES (${userId}, now() + make_interval(hours => ${smsResetHours}))
        ON CONFLICT (user_id) DO UPDATE SET sms_password_reset_until = EXCLUDED.sms_password_reset_until, updated_at = now()`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "marketplace",
          action: "smart_otp.revoke",
          entityType: "smart_otp",
          entityId: userId,
          beforeData: { deviceName: removed.rows[0]!.device_name },
          afterData: { reason: "customer_care", note: input.reason },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
      const settings = await this.settings.current(transaction);
      await notify(transaction, [
        {
          userId,
          companyId: null,
          kind: "auth.smart_otp_revoked",
          title: `Smart OTP của bạn đã được bộ phận chăm sóc khách hàng hủy theo yêu cầu.${settings.supportHotline ? ` Không phải bạn yêu cầu? Gọi ${settings.supportHotline}.` : ""}`,
          payload: {},
        },
      ]);
    });
    const settings = await this.settings.current();
    await this.messaging.sendZns(userId, "smart_otp_revoked", { hotline: settings.supportHotline ?? "" });
    return this.view(userId, true);
  }
}
