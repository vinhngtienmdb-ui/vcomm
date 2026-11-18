// Ghép thiết bị, đăng nhập trên thiết bị bằng mã OTP lần đầu rồi mã PIN (CONG_VIEC_74; CHUC_NANG_254; QUYTAC_NGHIEPVU_606, 607; API_335).
import { Inject, Injectable } from "@nestjs/common";
import type { IposDeviceInfo, IposLoginResult, IposMe, IposPairResult } from "contracts";
import { sql } from "drizzle-orm";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { AuthService, type ClientInfo } from "../auth/auth.service";
import { AuthenticationSettingsService } from "../auth/authentication-settings.service";
import { PhoneOtpService } from "../auth/phone-otp.service";
import { SmartOtpService } from "../auth/smart-otp.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { deviceByKey, deviceInfo, hashSecret, memberForDevice, memberOf, sessionHours, type IposDevice, type IposMemberRow, type IposPosActor } from "./ipos-device-context";

const maxPinFailures = 5;
const pinLockMinutes = 15;

// QUYTAC_NGHIEPVU_607: không nhận 6 số giống nhau hoặc dãy tăng, giảm liên tiếp.
export function weakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const digits = [...pin].map(Number);
  const steps = digits.slice(1).map((digit, index) => (digit - digits[index]! + 10) % 10);
  return steps.every((step) => step === 1) || steps.every((step) => step === 9);
}

@Injectable()
export class IposDeviceAuthService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly auth: AuthService,
    private readonly phoneOtp: PhoneOtpService,
    private readonly smartOtp: SmartOtpService,
    private readonly authenticationSettings: AuthenticationSettingsService,
    private readonly audit: AuditService,
  ) {}

  // CONG_VIEC_72 (QUYTAC_NGHIEPVU_560, 561): đã kích hoạt Smart OTP thì chỉ nhận Smart OTP; chưa kích hoạt thì nhận mã SMS
  // trong thời hạn chuyển đổi của cổng cửa hàng liên kết, hết hạn thì phải kích hoạt Smart OTP trên ứng dụng VComm.
  private async smsAllowed(userId: string): Promise<boolean> {
    if ((await this.smartOtp.state(this.database, userId)).active) return false;
    return this.authenticationSettings.portalTransitionOpen();
  }

  // Ghép thiết bị bằng mã 8 ký tự còn hạn, dùng một lần; ghép mới thì thiết bị cũ của quầy hết hiệu lực (QUYTAC_NGHIEPVU_606).
  async pair(input: { code: string; model?: string | null | undefined; appVersion?: string | null | undefined }, client: ClientInfo): Promise<IposPairResult> {
    const now = this.clock.now();
    const deviceKey = randomBytes(32).toString("base64url");
    const deviceId = await this.database.transaction(async (transaction) => {
      const code = (
        await transaction.execute<{ id: string; register_id: string; created_by: string; merchant_id: string; register_status: string }>(sql`
          SELECT c.id, c.register_id, c.created_by, r.merchant_id, r.status AS register_status
          FROM ipos.pairing_codes c JOIN ipos.registers r ON r.id = c.register_id
          WHERE c.code_hash = ${hashSecret(input.code)} AND c.used_at IS NULL AND c.expires_at > ${now}
          FOR UPDATE OF c`)
      ).rows[0];
      if (!code || code.register_status !== "active") throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { code: "iposPairingCodeInvalid" } });
      await transaction.execute(sql`UPDATE ipos.pairing_codes SET used_at = ${now} WHERE id = ${code.id}`);
      await transaction.execute(sql`UPDATE ipos.devices SET revoked_at = ${now}, revoked_by = ${code.created_by} WHERE register_id = ${code.register_id} AND revoked_at IS NULL`);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO ipos.devices (merchant_id, register_id, key_hash, model, app_version, paired_by, paired_at, last_seen_at)
        VALUES (${code.merchant_id}, ${code.register_id}, ${hashSecret(deviceKey)}, ${input.model ?? null}, ${input.appVersion ?? null}, ${code.created_by}, ${now}, ${now})
        RETURNING id`);
      const id = inserted.rows[0]!.id;
      await this.audit.record(
        { actorUserId: code.created_by, appCode: "affiliate", action: "ipos_device.pair", entityType: "ipos_device", entityId: id, afterData: { registerId: code.register_id, model: input.model ?? null }, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
      return id;
    });
    const device = await deviceByKey(this.database, deviceKey, now);
    if (device.deviceId !== deviceId) throw new ApiError("INTERNAL", "internal");
    return { deviceKey, device: await deviceInfo(this.database, device, now) };
  }

  async device(deviceKey: string): Promise<IposDeviceInfo> {
    const now = this.clock.now();
    return deviceInfo(this.database, await deviceByKey(this.database, deviceKey, now), now);
  }

  // Gửi mã SMS đăng nhập lần đầu: chỉ gửi khi số là thành viên dùng được quầy của thiết bị, chưa kích hoạt Smart OTP, còn thời hạn chuyển đổi;
  // luôn trả thành công để không lộ số nào là thành viên hay đã kích hoạt Smart OTP (QUYTAC_NGHIEPVU_560).
  async sendLoginOtp(deviceKey: string, phone: string): Promise<void> {
    const device = await deviceByKey(this.database, deviceKey, this.clock.now());
    const user = await this.phoneOtp.activeUserByPhone(phone);
    const member = user ? await memberForDevice(this.database, device, { userId: user.id }) : null;
    // Vẫn ghi mã và tính giới hạn khi không gửi để bên ngoài không phân biệt được.
    await this.phoneOtp.send(phone, "ipos_login", Boolean(user && member && (await this.smsAllowed(user.id))));
  }

  private allowSelling(device: IposDevice): void {
    // Thuê bao đã hủy hoặc chưa có thì không đăng nhập máy bán; tạm khóa vẫn đăng nhập để xem, in lại (QUYTAC_NGHIEPVU_596).
    if (!device.subscriptionStatus) throw new ApiError("FORBIDDEN", "iposNoSubscription");
  }

  private async startSession(device: IposDevice, member: IposMemberRow, client: ClientInfo, provider: "phone_otp" | "ipos_smart_otp" | "ipos_pin"): Promise<IposLoginResult> {
    const tokens = await this.database.transaction(async (transaction) => {
      const issued = await this.auth.issueTrustedSession(transaction, member.userId, client, "ipos_app", provider);
      await transaction.execute(sql`INSERT INTO ipos.device_sessions (family_id, device_id, member_id) VALUES (${issued.familyId}, ${device.deviceId}, ${member.memberId})`);
      return issued;
    });
    const hasPin = (await this.database.execute(sql`SELECT 1 FROM ipos.member_pins WHERE member_id = ${member.memberId} AND device_id = ${device.deviceId}`)).rows.length > 0;
    return {
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, accessExpiresAt: tokens.accessExpiresAt.toISOString(), refreshExpiresAt: tokens.refreshExpiresAt.toISOString() },
      member: { ...memberOf(member), hasPin },
    };
  }

  // Đăng nhập lần đầu trên thiết bị: mã Smart OTP trên ứng dụng VComm (ưu tiên) hoặc mã SMS dự phòng (QUYTAC_NGHIEPVU_607; CONG_VIEC_72).
  async loginWithOtp(deviceKey: string, phone: string, code: string, method: "smart_otp" | "sms", client: ClientInfo): Promise<IposLoginResult> {
    const device = await deviceByKey(this.database, deviceKey, this.clock.now());
    this.allowSelling(device);
    const user = await this.phoneOtp.activeUserByPhone(phone);
    const member = user ? await memberForDevice(this.database, device, { userId: user.id }) : null;
    if (method === "smart_otp") {
      if (!user || !member || !(await this.smartOtp.state(this.database, user.id)).active) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
      // Dùng chung bộ đếm sai và khóa 15 phút của Smart OTP.
      await this.smartOtp.verify(user.id, code, null);
      return this.startSession(device, member, client, "ipos_smart_otp");
    }
    if (!user || !member || !(await this.phoneOtp.consume(phone, code, "ipos_login"))) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
    if (!(await this.smsAllowed(user.id))) {
      throw new ApiError("BUSINESS_RULE", (await this.smartOtp.state(this.database, user.id)).active ? "iposUseSmartOtp" : "iposSmartOtpRequired");
    }
    return this.startSession(device, member, client, "phone_otp");
  }

  // Đặt hoặc đổi mã PIN của người đang đăng nhập trên thiết bị này (QUYTAC_NGHIEPVU_607).
  async setPin(actor: IposPosActor, pin: string, client: ClientInfo): Promise<void> {
    if (weakPin(pin)) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { pin: "iposPinWeak" } });
    const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        INSERT INTO ipos.member_pins (member_id, device_id, pin_hash, last_login_at) VALUES (${actor.memberId}, ${actor.device.deviceId}, ${pinHash}, ${this.clock.now()})
        ON CONFLICT (member_id, device_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash, failed_count = 0, locked_until = NULL, updated_at = now()`);
      await this.audit.record(
        { actorUserId: actor.userId, appCode: "affiliate", action: "ipos_pin.set", entityType: "ipos_device", entityId: actor.device.deviceId, afterData: { memberId: actor.memberId }, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
    });
  }

  // Đăng nhập bằng PIN trên thiết bị đã đặt PIN; sai 5 lần liên tiếp khóa 15 phút (QUYTAC_NGHIEPVU_607).
  async loginWithPin(deviceKey: string, memberId: string, pin: string, client: ClientInfo): Promise<IposLoginResult> {
    const now = this.clock.now();
    const device = await deviceByKey(this.database, deviceKey, now);
    this.allowSelling(device);
    const member = await memberForDevice(this.database, device, { memberId });
    const row = member
      ? (
          await this.database.execute<{ pin_hash: string; failed_count: number; locked_until: Date | null }>(sql`
            SELECT pin_hash, failed_count, locked_until FROM ipos.member_pins WHERE member_id = ${memberId} AND device_id = ${device.deviceId}`)
        ).rows[0]
      : undefined;
    if (!member || !row) throw new ApiError("UNAUTHENTICATED", "iposPinWrong");
    if (row.locked_until && new Date(row.locked_until) > now) {
      throw new ApiError("RATE_LIMITED", "iposPinLocked", { retryAfterSeconds: Math.ceil((new Date(row.locked_until).getTime() - now.getTime()) / 1000) });
    }
    if (!(await argon2.verify(row.pin_hash, pin))) {
      const failures = row.failed_count + 1;
      const locked = failures >= maxPinFailures;
      await this.database.execute(sql`
        UPDATE ipos.member_pins SET failed_count = ${locked ? 0 : failures}, locked_until = ${locked ? new Date(now.getTime() + pinLockMinutes * 60_000) : null}, updated_at = now()
        WHERE member_id = ${memberId} AND device_id = ${device.deviceId}`);
      if (locked) throw new ApiError("RATE_LIMITED", "iposPinLocked", { retryAfterSeconds: pinLockMinutes * 60 });
      throw new ApiError("UNAUTHENTICATED", "iposPinWrong");
    }
    await this.database.execute(sql`
      UPDATE ipos.member_pins SET failed_count = 0, locked_until = NULL, last_login_at = ${now}, updated_at = now() WHERE member_id = ${memberId} AND device_id = ${device.deviceId}`);
    return this.startSession(device, member, client, "ipos_pin");
  }

  async me(actor: IposPosActor): Promise<IposMe> {
    const now = this.clock.now();
    const hasPin = (await this.database.execute(sql`SELECT 1 FROM ipos.member_pins WHERE member_id = ${actor.memberId} AND device_id = ${actor.device.deviceId}`)).rows.length > 0;
    return {
      member: { ...memberOf(actor), hasPin },
      device: await deviceInfo(this.database, actor.device, now),
      sessionExpiresAt: new Date(actor.sessionStartedAt.getTime() + sessionHours * 3_600_000).toISOString(),
    };
  }

  // Khóa màn hình hoặc đổi người: thu hồi chuỗi phiên hiện tại; người tiếp theo đăng nhập bằng PIN.
  async lock(actor: IposPosActor, sessionId: string, client: ClientInfo): Promise<void> {
    await this.auth.logout(sessionId, actor.userId, client);
  }
}
