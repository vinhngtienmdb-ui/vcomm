// Bảo mật đăng nhập cổng cửa hàng liên kết (CONG_VIEC_72; QUYTAC_NGHIEPVU_570; CHUC_NANG_246; API_324, API_325).
// Mọi tài khoản cổng đăng nhập bằng mật khẩu và ứng dụng xác thực (dùng lại xác thực hai lớp của nhân viên, MfaService).
// Tài khoản chưa thiết lập: trong thời hạn chuyển đổi vẫn vào cổng (nút "Để sau"); hết hạn thì nhờ người mời đặt lại xác thực.
// Đặt lại xác thực xóa ứng dụng xác thực, mã dự phòng, thu hồi phiên web; lần vào tới kích hoạt lại bằng mã SMS một lần.
import { Inject, Injectable } from "@nestjs/common";
import type { MerchantPortalAuthenticationPolicy, MerchantPortalSecurity, MerchantPortalSecurityStatus } from "contracts";
import { normalizePhone } from "contracts";
import { sql } from "drizzle-orm";
import { minimumPasswordLength } from "../auth/activation.service";
import { AuthService, type ClientInfo } from "../auth/auth.service";
import { addDays, AuthenticationSettingsService, transitionEndsOn, vietnamDate } from "../auth/authentication-settings.service";
import { MfaService } from "../auth/mfa.service";
import { setPassword } from "../auth/password.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
export { portalSetUpSql } from "./portal-set-up";

type Executor = Pick<Database, "execute">;

export interface PortalResetActor {
  userId: string;
  companyId: string;
  client: ClientInfo;
}

@Injectable()
export class MerchantPortalSecurityService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly settings: AuthenticationSettingsService,
    private readonly mfa: MfaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async policy(): Promise<MerchantPortalAuthenticationPolicy> {
    const settings = await this.settings.current();
    return { transitionEndsOn: transitionEndsOn(settings.transitionStartsOn, settings.portalTransitionDays), smsLoginOpen: await this.settings.portalTransitionOpen() };
  }

  // Trạng thái bảo mật của người đang đăng nhập. sessionPending: phiên chưa qua bước hai (chờ mã hoặc chờ thiết lập).
  async state(userId: string, sessionPending: boolean, executor: Executor = this.database): Promise<MerchantPortalSecurity> {
    const row = (
      await executor.execute<{ has_password: boolean; password_changed_at: Date | null; totp_at: Date | null; reset_at: Date | null }>(sql`
        SELECT EXISTS (SELECT 1 FROM core.user_identities WHERE user_id = ${userId} AND provider = 'password') AS has_password,
          (SELECT max(password_changed_at) FROM core.user_identities WHERE user_id = ${userId} AND provider = 'password') AS password_changed_at,
          (SELECT max(confirmed_at) FROM core.mfa_factors WHERE user_id = ${userId} AND factor_type = 'totp' AND confirmed_at IS NOT NULL) AS totp_at,
          (SELECT max(authentication_reset_at) FROM affiliate.members WHERE user_id = ${userId} AND status = 'active') AS reset_at`)
    ).rows[0]!;
    const resetAt = row.reset_at ? new Date(row.reset_at).getTime() : null;
    const after = (value: Date | null) => resetAt === null || (value !== null && new Date(value).getTime() > resetAt);
    const needsPassword = !row.has_password || !after(row.password_changed_at);
    const needsAuthenticator = !row.totp_at || !after(row.totp_at);
    const settings = await this.settings.current(executor);
    const endsOn = transitionEndsOn(settings.transitionStartsOn, settings.portalTransitionDays);
    const today = vietnamDate(this.clock.now());
    const open = today <= endsOn;
    let status: MerchantPortalSecurityStatus;
    if (!needsPassword && !needsAuthenticator) status = sessionPending ? "mfa_pending" : "set_up";
    else if (sessionPending) status = row.totp_at && !needsAuthenticator ? "mfa_pending" : "required";
    else if (resetAt !== null || !open) status = "blocked";
    else status = "optional";
    const daysLeft = open ? Math.round((Date.parse(addDays(endsOn, 1)) - Date.parse(today)) / 86_400_000) : 0;
    return { status, needsPassword, needsAuthenticator, transitionEndsOn: endsOn, daysLeft };
  }

  // Mọi API cổng (trừ các bước thiết lập) chỉ cho tài khoản đã thiết lập, hoặc chưa thiết lập mà còn thời hạn.
  async assertAccess(userId: string): Promise<void> {
    const { status } = await this.state(userId, false);
    if (status === "set_up" || status === "optional") return;
    throw new ApiError("BUSINESS_RULE", status === "blocked" ? "merchantPortalSecurityBlocked" : "merchantPortalSecurityRequired");
  }

  // API_02, API_03 gọi từ cổng: hết thời hạn cổng thì không gửi, không nhận mã SMS đăng nhập.
  async assertSmsLogin(): Promise<void> {
    if (!(await this.settings.portalTransitionOpen())) throw new ApiError("BUSINESS_RULE", "merchantPortalSmsDisabled");
  }

  // API_324: đặt mật khẩu trong bước thiết lập (chưa có mật khẩu, hoặc vừa bị đặt lại xác thực).
  async setPassword(userId: string, sessionPending: boolean, password: string, client: ClientInfo): Promise<MerchantPortalSecurity> {
    if (password.length < minimumPasswordLength) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { password: "passwordTooShort" } });
    const current = await this.state(userId, sessionPending);
    if (!(current.status === "required" || current.status === "optional") || !current.needsPassword) throw new ApiError("BUSINESS_RULE", "merchantPortalPasswordNotNeeded");
    await this.database.transaction(async (transaction) => {
      await setPassword(transaction, userId, password);
      await this.audit.record(
        { actorUserId: userId, appCode: "affiliate", action: "merchant_portal.password_set", entityType: "user", entityId: userId, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
    });
    return this.state(userId, sessionPending);
  }

  // API_324 quên mật khẩu cổng: số điện thoại, mã ứng dụng xác thực hoặc mã dự phòng, mật khẩu mới; thu hồi mọi phiên web.
  // Số không có tài khoản cổng đã thiết lập trả cùng lỗi như mã sai.
  async resetPassword(rawPhone: string, proof: { code?: string | undefined; backupCode?: string | undefined }, password: string, client: ClientInfo): Promise<void> {
    if (password.length < minimumPasswordLength) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { password: "passwordTooShort" } });
    const field = proof.code ? "code" : "backupCode";
    const invalid = () => new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "mfaInvalidCode" } });
    const phone = normalizePhone(rawPhone);
    const user = (
      await this.database.execute<{ id: string }>(sql`
        SELECT u.id FROM core.users u WHERE u.phone = ${phone} AND u.status = 'active'
          AND EXISTS (SELECT 1 FROM affiliate.members m WHERE m.user_id = u.id AND m.status = 'active') LIMIT 1`)
    ).rows[0];
    if (!user || !(await this.mfa.verifyWithoutSession(user.id, proof, client))) throw invalid();
    if ((await this.state(user.id, false)).needsAuthenticator) throw invalid();
    await this.database.transaction(async (transaction) => {
      await setPassword(transaction, user.id, password);
      await transaction.execute(sql`UPDATE core.users SET login_locked_until = NULL WHERE id = ${user.id}`);
      await this.auth.revokeSessions(transaction, user.id, "web");
      await this.audit.record(
        {
          actorUserId: user.id,
          appCode: "affiliate",
          action: "password.reset",
          entityType: "user",
          entityId: user.id,
          afterData: { channel: "merchant_portal", method: field === "code" ? "authenticator" : "backup_code" },
          ip: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        },
        transaction,
      );
    });
  }

  // API_325: đặt lại xác thực một thành viên. scope: chủ cửa hàng chỉ đặt cho thu ngân của cửa hàng mình;
  // người có affiliate.manage đặt cho mọi thành viên của cửa hàng thuộc công ty vận hành.
  async resetAuthentication(actor: PortalResetActor, memberId: string, version: number, scope: { merchantId: string; cashierOnly: boolean }): Promise<string> {
    return this.database.transaction(async (transaction) => {
      const member = (
        await transaction.execute<{ merchant_id: string; company_id: string; role: string; status: string; user_id: string | null; version: number; mfa_required: boolean | null }>(sql`
          SELECT mb.merchant_id, m.company_id, mb.role, mb.status, mb.user_id, mb.version, u.mfa_required
          FROM affiliate.members mb JOIN affiliate.merchants m ON m.id = mb.merchant_id LEFT JOIN core.users u ON u.id = mb.user_id
          WHERE mb.id = ${memberId} AND mb.merchant_id = ${scope.merchantId} AND m.company_id = ${actor.companyId} FOR UPDATE OF mb`)
      ).rows[0];
      if (!member) throw new ApiError("NOT_FOUND", "notFound");
      if (scope.cashierOnly && member.role !== "cashier") throw new ApiError("FORBIDDEN", "forbidden");
      if (member.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (member.status !== "active" || !member.user_id) throw new ApiError("BUSINESS_RULE", "affiliateMemberStatusInvalid");
      // Tài khoản nhân viên bắt buộc xác thực hai lớp: không để cổng cửa hàng xóa ứng dụng xác thực của nhân viên.
      if (member.mfa_required) throw new ApiError("BUSINESS_RULE", "merchantPortalResetStaff");
      await this.mfa.removeAll(transaction, member.user_id);
      await this.auth.revokeSessions(transaction, member.user_id, "web");
      await transaction.execute(sql`UPDATE affiliate.members SET authentication_reset_at = now(), updated_at = now(), version = version + 1 WHERE id = ${memberId}`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "affiliate",
          action: "merchant_portal.authentication_reset",
          entityType: "affiliate_member",
          entityId: memberId,
          afterData: { merchantId: member.merchant_id, role: member.role, by: scope.cashierOnly ? "owner" : "company" },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
      return member.merchant_id;
    });
  }
}
