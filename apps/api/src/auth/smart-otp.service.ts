// Smart OTP (CONG_VIEC_53 lát L6; QUYTAC_NGHIEPVU_379; API_199). CONG_VIEC_72 (THAY_DOI_37): chuyển sang phần xác thực, bảng ở schema core. Khách kích hoạt một lần trong ứng dụng VComm bằng mã SMS;
// máy chủ tạo khóa TOTP, lưu mã hóa, trả một lần cho ứng dụng lưu trong bộ nhớ an toàn của máy. Mỗi tài khoản một thiết bị.
// Mã 6 số, bước 30 giây, chấp nhận lệch một bước, mỗi bước dùng một lần; sai 5 lần liên tiếp thì khóa 15 phút.
import { Inject, Injectable } from "@nestjs/common";
import {
  normalizePhone,
  type activateSmartOtpSchema,
  type SmartOtpActivationResponse,
  type SmartOtpPlatform,
  type SmartOtpStatusResponse,
  type transferSmartOtpSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { Secret, TOTP } from "otpauth";
import type { z } from "zod";
import { PhoneOtpService } from "../auth/phone-otp.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { decryptSecret, encryptSecret } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { deviceHashOf } from "../common/device-hash";
import { AuthenticationSettingsService, transitionEndsOn } from "./authentication-settings.service";

type Executor = Pick<Database, "execute">;
export const smartOtpPeriodSeconds = 30;
export const smartOtpMaximumFailures = 5;
export const smartOtpLockMinutes = 15;

const totpOf = (secretBase32: string) => new TOTP({ issuer: "VComm", label: "Smart OTP", secret: Secret.fromBase32(secretBase32), digits: 6, period: smartOtpPeriodSeconds });

// Số điện thoại che giữa: 090****321.
export function maskPhone(phone: string): string {
  const local = phone.startsWith("+84") ? `0${phone.slice(3)}` : phone;
  return local.length <= 6 ? local : `${local.slice(0, 3)}${"*".repeat(local.length - 6)}${local.slice(-3)}`;
}

// Tên che một phần: giữ 2 ký tự đầu mỗi từ, giữ nguyên từ cuối (Trần Văn Minh → Tr** Vă* Minh).
export function maskName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.map((word, index) => (index === words.length - 1 ? word : [...word].map((character, position) => (position < 2 ? character : "*")).join(""))).join(" ");
}

// Nền tảng suy từ tên máy ứng dụng gửi (CONG_VIEC_53); lát L2 nhận nền tảng trực tiếp từ ứng dụng.
const platformOf = (deviceName: string): SmartOtpPlatform => (deviceName === "iPhone" ? "ios" : deviceName === "Trình duyệt" ? "web" : "android");

type DeviceRow = {
  device_name: string;
  platform: SmartOtpPlatform;
  device_hash: string | null;
  secret_encrypted: Buffer;
  activated_at: Date;
  last_used_step: string;
  failed_count: number;
  locked_until: Date | null;
};

type Installed = { secret: string };

@Injectable()
export class SmartOtpService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly phoneOtp: PhoneOtpService,
    private readonly audit: AuditService,
    private readonly settings: AuthenticationSettingsService,
  ) {}

  // Chỉ người mua VComm đang hoạt động có số điện thoại.
  private async buyer(userId: string): Promise<{ phone: string }> {
    const row = (
      await this.database.execute<{ phone: string | null }>(sql`
      SELECT u.phone FROM core.users u JOIN marketplace.buyer_accounts b ON b.user_id = u.id WHERE u.id = ${userId} AND u.status = 'active'`)
    ).rows[0];
    if (!row?.phone) throw new ApiError("FORBIDDEN", "forbidden");
    return { phone: row.phone };
  }

  private device(executor: Executor, userId: string, lock = false): Promise<DeviceRow | undefined> {
    return executor
      .execute<DeviceRow>(
        sql`SELECT device_name, platform, device_hash, secret_encrypted, activated_at, last_used_step::text, failed_count, locked_until FROM core.smart_otp_devices WHERE user_id = ${userId} ${lock ? sql`FOR UPDATE` : sql``}`,
      )
      .then((result) => result.rows[0]);
  }

  private lockedUntil(row: DeviceRow | undefined): string | null {
    if (!row?.locked_until) return null;
    const until = new Date(row.locked_until);
    return until.getTime() > this.clock.now().getTime() ? until.toISOString() : null;
  }

  // Trạng thái Smart OTP của người dùng (dùng cả ở quầy, API_198).
  async state(executor: Executor, userId: string): Promise<{ active: boolean; lockedUntil: string | null }> {
    const row = await this.device(executor, userId);
    return { active: Boolean(row), lockedUntil: this.lockedUntil(row) };
  }

  async status(userId: string, deviceId: string | null = null): Promise<SmartOtpStatusResponse> {
    const { phone } = await this.buyer(userId);
    const row = await this.device(this.database, userId);
    const settings = await this.settings.current();
    const security = (
      await this.database.execute<{ redeem_locked_until: Date | null }>(sql`SELECT redeem_locked_until FROM core.account_security WHERE user_id = ${userId}`)
    ).rows[0];
    const redeemLockedUntil = security?.redeem_locked_until && new Date(security.redeem_locked_until).getTime() > this.clock.now().getTime() ? new Date(security.redeem_locked_until).toISOString() : null;
    const deviceHash = deviceHashOf(deviceId);
    return {
      active: Boolean(row),
      deviceName: row?.device_name ?? null,
      activatedAt: row ? new Date(row.activated_at).toISOString() : null,
      lockedUntil: this.lockedUntil(row),
      maskedPhone: maskPhone(phone),
      platform: row?.platform ?? null,
      // Smart OTP kích hoạt trước CONG_VIEC_72 chưa có băm thiết bị: ứng dụng tự so khóa đang giữ (như CONG_VIEC_53).
      onThisDevice: row ? (row.device_hash && deviceHash ? row.device_hash === deviceHash : null) : null,
      redeemLockedUntil,
      transitionEndsOn: transitionEndsOn(settings.transitionStartsOn, settings.buyerTransitionDays),
    };
  }

  // Gửi mã SMS xác nhận kích hoạt về số điện thoại của tài khoản.
  async sendCode(userId: string): Promise<void> {
    const { phone } = await this.buyer(userId);
    await this.phoneOtp.send(phone, "smart_otp");
  }

  // Bản web không giữ được khóa an toàn: chỉ kích hoạt trên ứng dụng điện thoại (QUYTAC_NGHIEPVU_562).
  private platformAllowed(platform: SmartOtpPlatform): void {
    if (platform === "web") throw new ApiError("BUSINESS_RULE", "smartOtpWebNotAllowed");
  }

  // Ghi khóa mới cho máy đang dùng; máy cũ (nếu có) hết hiệu lực vì khóa bị thay. Dùng chung cho kích hoạt, đăng ký, chuyển máy.
  async install(
    transaction: Pick<Database, "execute" | "insert">,
    userId: string,
    device: { deviceName: string; platform: SmartOtpPlatform; deviceId: string | null },
    action: "smart_otp.activate" | "smart_otp.transfer",
  ): Promise<Installed> {
    const secret = new Secret({ size: 20 }).base32;
    const now = this.clock.now();
    await transaction.execute(sql`
      INSERT INTO core.smart_otp_devices (user_id, device_name, platform, device_hash, secret_encrypted, activated_at)
      VALUES (${userId}, ${device.deviceName}, ${device.platform}, ${deviceHashOf(device.deviceId)}, ${encryptSecret(secret)}, ${now})
      ON CONFLICT (user_id) DO UPDATE SET device_name = EXCLUDED.device_name, platform = EXCLUDED.platform, device_hash = EXCLUDED.device_hash,
        secret_encrypted = EXCLUDED.secret_encrypted, activated_at = EXCLUDED.activated_at, last_used_step = 0, failed_count = 0, locked_until = NULL,
        version = core.smart_otp_devices.version + 1`);
    // Ghi lần kích hoạt đầu tiên của tài khoản: kích hoạt lại bằng SMS sau này tính là khôi phục (QUYTAC_NGHIEPVU_562).
    await transaction.execute(sql`
      INSERT INTO core.account_security (user_id, smart_otp_first_activated_at) VALUES (${userId}, ${now})
      ON CONFLICT (user_id) DO UPDATE SET smart_otp_first_activated_at = coalesce(core.account_security.smart_otp_first_activated_at, EXCLUDED.smart_otp_first_activated_at), updated_at = now()`);
    await this.audit.record(
      {
        actorUserId: userId,
        companyId: null,
        appCode: "crm",
        action,
        entityType: "smart_otp",
        entityId: userId,
        afterData: { deviceName: device.deviceName, platform: device.platform },
      },
      transaction,
    );
    return { secret };
  }

  async activationResponse(userId: string, installed: Installed, deviceId: string | null): Promise<SmartOtpActivationResponse> {
    return { ...(await this.status(userId, deviceId)), secret: installed.secret, digits: 6, period: smartOtpPeriodSeconds };
  }

  // Kích hoạt bằng mã SMS trên máy đang dùng.
  async activate(userId: string, input: z.output<typeof activateSmartOtpSchema>, deviceId: string | null = null): Promise<SmartOtpActivationResponse> {
    const platform = input.platform ?? platformOf(input.deviceName);
    this.platformAllowed(platform);
    const { phone } = await this.buyer(userId);
    if (!(await this.phoneOtp.consume(normalizePhone(phone), input.code, "smart_otp"))) throw new ApiError("BUSINESS_RULE", "otpInvalid");
    const installed = await this.database.transaction((transaction) => this.install(transaction, userId, { deviceName: input.deviceName, platform, deviceId }, "smart_otp.activate"));
    return this.activationResponse(userId, installed, deviceId);
  }

  // API_319: chuyển Smart OTP sang máy đang dùng bằng mã đang hiện trên máy cũ; không SMS, không khóa dùng điểm (QUYTAC_NGHIEPVU_562).
  // Mã kiểm như giao dịch: mỗi bước dùng một lần, dùng chung bộ đếm sai và khóa 15 phút.
  async transfer(userId: string, input: z.output<typeof transferSmartOtpSchema>, deviceId: string | null): Promise<SmartOtpActivationResponse> {
    this.platformAllowed(input.platform);
    await this.buyer(userId);
    try {
      await this.verify(userId, input.code, null);
    } catch (error) {
      if (error instanceof ApiError && error.message === "retailSmartOtpInactive") throw new ApiError("BUSINESS_RULE", "smartOtpNotActive");
      if (error instanceof ApiError && error.message === "retailSmartOtpLocked") throw new ApiError("BUSINESS_RULE", "smartOtpLocked");
      if (error instanceof ApiError && error.message === "retailSmartOtpInvalid") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "smartOtpCodeInvalid" } });
      throw error;
    }
    const installed = await this.database.transaction((transaction) =>
      this.install(transaction, userId, { deviceName: input.deviceName, platform: input.platform, deviceId }, "smart_otp.transfer"),
    );
    return this.activationResponse(userId, installed, deviceId);
  }

  // Khách tự hủy, hoặc ứng dụng báo sai mã khóa 5 lần liên tiếp (QUYTAC_NGHIEPVU_563).
  async revoke(userId: string, reason: "buyer" | "pin_lockout" = "buyer"): Promise<SmartOtpStatusResponse> {
    await this.buyer(userId);
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute(sql`DELETE FROM core.smart_otp_devices WHERE user_id = ${userId} RETURNING user_id`);
      if (removed.rows.length > 0)
        await this.audit.record(
          { actorUserId: userId, companyId: null, appCode: "crm", action: "smart_otp.revoke", entityType: "smart_otp", entityId: userId, afterData: { reason } },
          transaction,
        );
    });
    return this.status(userId);
  }

  // Kiểm mã tại quầy trong giao dịch riêng (lần sai được ghi kể cả khi bán không thành): mã đúng thì đánh dấu bước đã dùng.
  async verify(userId: string, code: string, companyId: string | null): Promise<void> {
    const failure = await this.database.transaction(async (transaction): Promise<"retailSmartOtpInactive" | "retailSmartOtpLocked" | "retailSmartOtpInvalid" | null> => {
      const row = await this.device(transaction, userId, true);
      if (!row) return "retailSmartOtpInactive";
      if (this.lockedUntil(row)) return "retailSmartOtpLocked";
      const now = this.clock.now().getTime();
      const delta = totpOf(decryptSecret(row.secret_encrypted)).validate({ token: code, window: 1, timestamp: now });
      const step = delta === null ? null : Math.floor(now / 1000 / smartOtpPeriodSeconds) + delta;
      if (step !== null && step > Number(row.last_used_step)) {
        await transaction.execute(sql`UPDATE core.smart_otp_devices SET last_used_step = ${step}, failed_count = 0 WHERE user_id = ${userId}`);
        return null;
      }
      const failures = row.failed_count + 1;
      if (failures >= smartOtpMaximumFailures) {
        const until = new Date(now + smartOtpLockMinutes * 60_000);
        await transaction.execute(sql`UPDATE core.smart_otp_devices SET failed_count = 0, locked_until = ${until} WHERE user_id = ${userId}`);
        await notify(transaction, [
          {
            userId,
            companyId,
            kind: "loyalty.smart_otp_locked",
            title: "Smart OTP tạm khóa 15 phút do nhập sai mã nhiều lần",
            payload: { lockedUntil: until.toISOString() },
          },
        ]);
        return "retailSmartOtpLocked";
      }
      await transaction.execute(sql`UPDATE core.smart_otp_devices SET failed_count = ${failures} WHERE user_id = ${userId}`);
      return "retailSmartOtpInvalid";
    });
    if (failure) throw new ApiError("BUSINESS_RULE", failure);
  }
}
