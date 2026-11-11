// Smart OTP dùng điểm tại quầy (CONG_VIEC_53 lát L6; QUYTAC_NGHIEPVU_379; API_199). Khách kích hoạt một lần trong ứng dụng VComm bằng mã SMS;
// máy chủ tạo khóa TOTP, lưu mã hóa, trả một lần cho ứng dụng lưu trong bộ nhớ an toàn của máy. Mỗi tài khoản một thiết bị.
// Mã 6 số, bước 30 giây, chấp nhận lệch một bước, mỗi bước dùng một lần; sai 5 lần liên tiếp thì khóa 15 phút.
import { Inject, Injectable } from "@nestjs/common";
import { normalizePhone, type activateSmartOtpSchema, type SmartOtpActivationResponse, type SmartOtpStatusResponse } from "contracts";
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

type DeviceRow = { device_name: string; secret_encrypted: Buffer; activated_at: Date; last_used_step: string; failed_count: number; locked_until: Date | null };

@Injectable()
export class SmartOtpService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly phoneOtp: PhoneOtpService,
    private readonly audit: AuditService,
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
        sql`SELECT device_name, secret_encrypted, activated_at, last_used_step::text, failed_count, locked_until FROM loyalty.smart_otp_devices WHERE user_id = ${userId} ${lock ? sql`FOR UPDATE` : sql``}`,
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

  async status(userId: string): Promise<SmartOtpStatusResponse> {
    const { phone } = await this.buyer(userId);
    const row = await this.device(this.database, userId);
    return {
      active: Boolean(row),
      deviceName: row?.device_name ?? null,
      activatedAt: row ? new Date(row.activated_at).toISOString() : null,
      lockedUntil: this.lockedUntil(row),
      maskedPhone: maskPhone(phone),
    };
  }

  // Gửi mã SMS xác nhận kích hoạt về số điện thoại của tài khoản.
  async sendCode(userId: string): Promise<void> {
    const { phone } = await this.buyer(userId);
    await this.phoneOtp.send(phone, "smart_otp");
  }

  // Kích hoạt trên máy đang dùng: máy cũ (nếu có) hết hiệu lực vì khóa bị thay.
  async activate(userId: string, input: z.output<typeof activateSmartOtpSchema>): Promise<SmartOtpActivationResponse> {
    const { phone } = await this.buyer(userId);
    if (!(await this.phoneOtp.consume(normalizePhone(phone), input.code, "smart_otp"))) throw new ApiError("BUSINESS_RULE", "otpInvalid");
    const secret = new Secret({ size: 20 }).base32;
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        INSERT INTO loyalty.smart_otp_devices (user_id, device_name, secret_encrypted, activated_at)
        VALUES (${userId}, ${input.deviceName}, ${encryptSecret(secret)}, ${this.clock.now()})
        ON CONFLICT (user_id) DO UPDATE SET device_name = EXCLUDED.device_name, secret_encrypted = EXCLUDED.secret_encrypted, activated_at = EXCLUDED.activated_at,
          last_used_step = 0, failed_count = 0, locked_until = NULL, version = loyalty.smart_otp_devices.version + 1`);
      await this.audit.record(
        { actorUserId: userId, companyId: null, appCode: "crm", action: "smart_otp.activate", entityType: "smart_otp", entityId: userId, afterData: { deviceName: input.deviceName } },
        transaction,
      );
    });
    return { ...(await this.status(userId)), secret, digits: 6, period: smartOtpPeriodSeconds };
  }

  async revoke(userId: string): Promise<SmartOtpStatusResponse> {
    await this.buyer(userId);
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute(sql`DELETE FROM loyalty.smart_otp_devices WHERE user_id = ${userId} RETURNING user_id`);
      if (removed.rows.length > 0)
        await this.audit.record({ actorUserId: userId, companyId: null, appCode: "crm", action: "smart_otp.revoke", entityType: "smart_otp", entityId: userId }, transaction);
    });
    return this.status(userId);
  }

  // Kiểm mã tại quầy trong giao dịch riêng (lần sai được ghi kể cả khi bán không thành): mã đúng thì đánh dấu bước đã dùng.
  async verify(userId: string, code: string, companyId: string): Promise<void> {
    const failure = await this.database.transaction(async (transaction): Promise<"retailSmartOtpInactive" | "retailSmartOtpLocked" | "retailSmartOtpInvalid" | null> => {
      const row = await this.device(transaction, userId, true);
      if (!row) return "retailSmartOtpInactive";
      if (this.lockedUntil(row)) return "retailSmartOtpLocked";
      const now = this.clock.now().getTime();
      const delta = totpOf(decryptSecret(row.secret_encrypted)).validate({ token: code, window: 1, timestamp: now });
      const step = delta === null ? null : Math.floor(now / 1000 / smartOtpPeriodSeconds) + delta;
      if (step !== null && step > Number(row.last_used_step)) {
        await transaction.execute(sql`UPDATE loyalty.smart_otp_devices SET last_used_step = ${step}, failed_count = 0 WHERE user_id = ${userId}`);
        return null;
      }
      const failures = row.failed_count + 1;
      if (failures >= smartOtpMaximumFailures) {
        const until = new Date(now + smartOtpLockMinutes * 60_000);
        await transaction.execute(sql`UPDATE loyalty.smart_otp_devices SET failed_count = 0, locked_until = ${until} WHERE user_id = ${userId}`);
        await notify(transaction, [
          {
            userId,
            companyId,
            kind: "loyalty.smart_otp_locked",
            title: "Dùng điểm tại quầy tạm khóa 15 phút do nhập sai mã Smart OTP nhiều lần",
            payload: { lockedUntil: until.toISOString() },
          },
        ]);
        return "retailSmartOtpLocked";
      }
      await transaction.execute(sql`UPDATE loyalty.smart_otp_devices SET failed_count = ${failures} WHERE user_id = ${userId}`);
      return "retailSmartOtpInvalid";
    });
    if (failure) throw new ApiError("BUSINESS_RULE", failure);
  }
}
