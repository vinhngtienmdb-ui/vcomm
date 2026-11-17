// Mã thanh toán động trên ứng dụng VComm (CONG_VIEC_73; QUYTAC_NGHIEPVU_574, 592; API_327).
// 18 chữ số = mã thanh toán của thiết bị (12 số ngẫu nhiên, máy chủ chỉ lưu băm) + mã Smart OTP 6 số hiện tại.
// Ứng dụng tự sinh mã không cần mạng; cửa hàng quét thay cho việc khách đọc mã Smart OTP.
import { Inject, Injectable } from "@nestjs/common";
import { payCodePrefixLength, payCodeSchema, type PayCodePrefixResponse } from "contracts";
import { createHmac, randomInt } from "node:crypto";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock } from "../common/clock";
import { deviceHashOf } from "../common/device-hash";
import { purposeKey } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { SmartOtpService } from "../auth/smart-otp.service";

type Executor = Pick<Database, "execute">;

// Quét sai 10 lần trong 60 phút thì khóa quét mã của thu ngân, khóa API 1 giờ; mở đường dẫn QR sai 20 lần thì khóa người mua (QUYTAC_NGHIEPVU_592).
export const scanFailureLimit = 10;
export const claimFailureLimit = 20;
const failureWindowMinutes = 60;

export const payCodePrefixHash = (prefix: string) => createHmac("sha256", purposeKey("instore-pay-code")).update(prefix, "utf8").digest("hex");

// Ai quét mã: thu ngân (người dùng) hoặc khóa API; công ty để ghi thông báo khóa Smart OTP.
export interface PayCodeScanner {
  subject: string;
  companyId: string | null;
}

@Injectable()
export class PayCodeService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly smartOtp: SmartOtpService,
  ) {}

  // Cấp mã thanh toán mới cho thiết bị đang giữ Smart OTP; mã cũ hết hiệu lực. Bản web không giữ Smart OTP nên không có mã.
  async issuePrefix(userId: string, deviceId: string | null): Promise<PayCodePrefixResponse> {
    const device = (
      await this.database.execute<{ platform: string; device_hash: string | null; activated_at: Date }>(
        sql`SELECT platform, device_hash, activated_at FROM core.smart_otp_devices WHERE user_id = ${userId}`,
      )
    ).rows[0];
    if (!device) throw new ApiError("BUSINESS_RULE", "smartOtpNotActive");
    if (device.platform === "web") throw new ApiError("BUSINESS_RULE", "smartOtpWebNotAllowed");
    // Smart OTP kích hoạt trước CONG_VIEC_72 chưa có băm thiết bị: chấp nhận (ứng dụng chỉ xin khi đang giữ khóa).
    const deviceHash = deviceHashOf(deviceId);
    if (device.device_hash && device.device_hash !== deviceHash) throw new ApiError("BUSINESS_RULE", "instorePayCodeOtherDevice");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const prefix = Array.from({ length: payCodePrefixLength }, () => randomInt(0, 10)).join("");
      const updated = await this.database.execute(sql`
        UPDATE core.smart_otp_devices SET pay_code_prefix_hash = ${payCodePrefixHash(prefix)}, pay_code_issued_for = activated_at
        WHERE user_id = ${userId} AND NOT EXISTS (SELECT 1 FROM core.smart_otp_devices other WHERE other.pay_code_prefix_hash = ${payCodePrefixHash(prefix)})
        RETURNING user_id`);
      if (updated.rows.length) return { prefix, activatedAt: new Date(device.activated_at).toISOString() };
    }
    throw new ApiError("INTERNAL", "internal");
  }

  // Khóa quét mã hoặc mở QR khi số lần sai trong 60 phút đạt giới hạn; trả thời điểm hết khóa.
  async lockedUntil(executor: Executor, subject: string, limit: number): Promise<Date | null> {
    const row = (
      await executor.execute<{ count: string; oldest: Date | null }>(sql`
        SELECT count(*)::text AS count, min(failed_at) AS oldest FROM (
          SELECT failed_at FROM instore.attempt_failures
          WHERE subject = ${subject} AND failed_at > ${this.clock.now()}::timestamptz - make_interval(mins => ${failureWindowMinutes})
          ORDER BY failed_at DESC LIMIT ${limit}) recent`)
    ).rows[0];
    if (!row || Number(row.count) < limit || !row.oldest) return null;
    return new Date(new Date(row.oldest).getTime() + failureWindowMinutes * 60_000);
  }

  async recordFailure(subject: string): Promise<void> {
    await this.database.execute(sql`INSERT INTO instore.attempt_failures (subject, failed_at) VALUES (${subject}, ${this.clock.now()})`);
  }

  // Đọc mã khách đưa, trả người mua. Sai mã tính vào giới hạn của người quét; sai Smart OTP còn tính vào bộ đếm sai của khách (CONG_VIEC_72).
  async resolve(rawCode: string, scanner: PayCodeScanner): Promise<string> {
    const scanSubject = `scan:${scanner.subject}`;
    const locked = await this.lockedUntil(this.database, scanSubject, scanFailureLimit);
    if (locked) throw new ApiError("BUSINESS_RULE", "instoreScanLocked", { retryAfterSeconds: Math.ceil((locked.getTime() - this.clock.now().getTime()) / 1000) });
    const parsed = payCodeSchema.safeParse(rawCode);
    if (!parsed.success) {
      await this.recordFailure(scanSubject);
      throw new ApiError("BUSINESS_RULE", "instorePayCodeInvalid");
    }
    const prefix = parsed.data.slice(0, payCodePrefixLength);
    const userId = (
      await this.database.execute<{ user_id: string }>(sql`
        SELECT d.user_id FROM core.smart_otp_devices d JOIN core.users u ON u.id = d.user_id AND u.status = 'active'
        WHERE d.pay_code_prefix_hash = ${payCodePrefixHash(prefix)} AND d.pay_code_issued_for = d.activated_at`)
    ).rows[0]?.user_id;
    if (!userId) {
      await this.recordFailure(scanSubject);
      throw new ApiError("BUSINESS_RULE", "instorePayCodeInvalid");
    }
    try {
      await this.smartOtp.verify(userId, parsed.data.slice(payCodePrefixLength), scanner.companyId);
    } catch (error) {
      if (error instanceof ApiError && error.message === "retailSmartOtpLocked") throw new ApiError("BUSINESS_RULE", "instorePayCodeLocked");
      if (error instanceof ApiError && (error.message === "retailSmartOtpInvalid" || error.message === "retailSmartOtpInactive")) {
        await this.recordFailure(scanSubject);
        throw new ApiError("BUSINESS_RULE", "instorePayCodeInvalid");
      }
      throw error;
    }
    return userId;
  }
}
