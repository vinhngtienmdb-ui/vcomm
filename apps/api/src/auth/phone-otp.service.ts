// Đăng nhập bằng số điện thoại (CHUC_NANG_08; QUYTAC_NGHIEPVU_32; API_02, API_03).
// Mã 6 chữ số hiệu lực 5 phút; tối đa 5 lần nhập sai mỗi mã; tối đa 5 lần gửi mỗi giờ cho một số.
// Số chưa gắn tài khoản vẫn trả "Đã gửi mã" nhưng không gửi (QUYTAC_NGHIEPVU_05).
import { Inject, Injectable, Logger } from "@nestjs/common";
import { type LoginResponse, normalizePhone } from "contracts";
import { sql } from "drizzle-orm";
import { createHash, randomInt } from "node:crypto";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { users } from "../database/schema";
import { MessagingService } from "../integrations/messaging.service";
import { AuthService, type ClientInfo, type IssuedSession } from "./auth.service";

const lifetimeMinutes = 5;
const maximumWrongCodes = 5;
const maximumSendsPerHour = 5;
const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

@Injectable()
export class PhoneOtpService {
  private readonly logger = new Logger("PhoneOtp");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly messaging: MessagingService,
    private readonly auth: AuthService,
  ) {}

  async send(rawPhone: string): Promise<void> {
    const phone = normalizePhone(rawPhone);
    const now = this.clock.now();
    const recent = await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM core.otp_codes WHERE phone = ${phone} AND created_at > ${new Date(now.getTime() - 3_600_000)}`);
    if ((recent.rows[0]?.total ?? 0) >= maximumSendsPerHour) throw new ApiError("RATE_LIMITED", "otpTooMany");
    const user = await this.activeUserByPhone(phone);
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    // Ghi cả khi số chưa gắn tài khoản để giới hạn số lần gửi không lộ số nào có tài khoản.
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE core.otp_codes SET consumed_at = ${now} WHERE phone = ${phone} AND consumed_at IS NULL`);
      await transaction.execute(sql`
        INSERT INTO core.otp_codes (phone, code_hash, expires_at, created_at) VALUES (${phone}, ${hashCode(code)}, ${new Date(now.getTime() + lifetimeMinutes * 60_000)}, ${now})`);
    });
    if (!user) return;
    const sent = await this.messaging.sendLoginOtp(phone, code, user.id);
    // Máy phát triển chưa cài eSMS: in mã ra log để thử đăng nhập. Không bao giờ in trên môi trường thật.
    if (!sent && process.env.NODE_ENV !== "production") this.logger.warn(`Mã OTP thử cho ${phone}: ${code}`);
  }

  async verify(rawPhone: string, code: string, client: ClientInfo): Promise<{ response: LoginResponse; session: IssuedSession }> {
    const phone = normalizePhone(rawPhone);
    const now = this.clock.now();
    const latest = (
      await this.database.execute<{ id: string; code_hash: string; wrong_attempts: number }>(sql`
      SELECT id, code_hash, wrong_attempts FROM core.otp_codes
      WHERE phone = ${phone} AND consumed_at IS NULL AND expires_at > ${now} ORDER BY created_at DESC LIMIT 1`)
    ).rows[0];
    const user = await this.activeUserByPhone(phone);
    if (!latest || latest.code_hash !== hashCode(code) || !user) {
      if (latest) {
        // Sai 5 lần thì mã hết hiệu lực.
        await this.database.execute(sql`
          UPDATE core.otp_codes SET wrong_attempts = wrong_attempts + 1, consumed_at = CASE WHEN wrong_attempts + 1 >= ${maximumWrongCodes} THEN ${now}::timestamptz ELSE NULL END WHERE id = ${latest.id}`);
      }
      await this.auth.recordAttempt(phone, user?.id ?? null, false, "wrong_otp", client, now, "phone_otp");
      throw new ApiError("UNAUTHENTICATED", "otpInvalid");
    }
    // Chỉ một lần xác minh đồng thời được dùng mã.
    const consumed = await this.database.execute(sql`UPDATE core.otp_codes SET consumed_at = ${now} WHERE id = ${latest.id} AND consumed_at IS NULL RETURNING id`);
    if (consumed.rows.length === 0) throw new ApiError("UNAUTHENTICATED", "otpInvalid");
    // Số điện thoại chuyển sang người khác thì danh tính đi theo người đang giữ số.
    await this.database.execute(sql`
      INSERT INTO core.user_identities (user_id, provider, provider_subject) VALUES (${user.id}, 'phone_otp', ${phone})
      ON CONFLICT (provider, provider_subject) DO UPDATE SET user_id = EXCLUDED.user_id`);
    return this.auth.completeLogin(user, "phone_otp", phone, client);
  }

  private async activeUserByPhone(phone: string): Promise<typeof users.$inferSelect | null> {
    const rows = await this.database
      .select()
      .from(users)
      .where(sql`${users.phone} = ${phone} AND ${users.status} = 'active'`)
      .limit(1);
    return rows[0] ?? null;
  }
}
