// Quên, đặt lại, đổi mật khẩu (CHUC_NANG_06, CHUC_NANG_10; QUYTAC_NGHIEPVU_07; TIEUCHI_NGHIEMTHU_12).
import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { normalizePhone } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { OUTBOUND_MESSAGES, webOrigin, type OutboundMessages } from "../common/outbound-messages";
import { DATABASE, type Database } from "../database/database.module";
import { minimumPasswordLength } from "./activation.service";
import type { ClientInfo } from "./auth.service";
import { hashToken, newRandomToken } from "./tokens";

const resetMinutes = 60;

type Executor = Pick<Database, "execute">;

// Đặt mật khẩu cho mọi định danh đăng nhập của tài khoản (email, tên đăng nhập, số điện thoại).
export async function setPassword(executor: Executor, userId: string, password: string): Promise<void> {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = (await executor.execute<{ email: string | null; username: string | null; phone: string | null }>(sql`
    SELECT email::text AS email, username::text AS username, phone FROM core.users WHERE id = ${userId}`)).rows[0]!;
  for (const subject of [user.email, user.username, user.phone]) {
    if (!subject) continue;
    await executor.execute(sql`
      INSERT INTO core.user_identities (user_id, provider, provider_subject, password_hash, password_changed_at)
      VALUES (${userId}, 'password', ${subject.toLowerCase()}, ${passwordHash}, now())
      ON CONFLICT (provider, provider_subject) DO UPDATE SET password_hash = EXCLUDED.password_hash, password_changed_at = now()
      WHERE core.user_identities.user_id = EXCLUDED.user_id`);
  }
}

const requirePasswordLength = (password: string, field: string) => {
  if (password.length < minimumPasswordLength) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [field]: "passwordTooShort" } });
};

@Injectable()
export class PasswordService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OUTBOUND_MESSAGES) private readonly messages: OutboundMessages,
    private readonly auditService: AuditService,
  ) {}

  // API_12: luôn trả thành công để không lộ tài khoản có tồn tại hay không.
  async forgot(identifier: string): Promise<void> {
    const typed = identifier.trim().toLowerCase();
    const value = /^[+0-9][0-9 .-]{7,}$/.test(typed) ? normalizePhone(typed) : typed;
    const user = (await this.database.execute<{ id: string; email: string | null; phone: string | null; full_name: string }>(sql`
      SELECT id, email::text AS email, phone, full_name FROM core.users
      WHERE status = 'active' AND (lower(email::text) = ${value} OR phone = ${value} OR lower(username::text) = ${value}) LIMIT 1`)).rows[0];
    if (!user || (!user.email && !user.phone)) return;
    const now = this.clock.now();
    const token = newRandomToken();
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE core.user_tokens SET expires_at = LEAST(expires_at, ${now.toISOString()}::timestamptz)
        WHERE user_id = ${user.id} AND purpose = 'password_reset' AND used_at IS NULL`);
      await transaction.execute(sql`
        INSERT INTO core.user_tokens (user_id, purpose, token_hash, expires_at)
        VALUES (${user.id}, 'password_reset', ${hashToken(token)}, ${new Date(now.getTime() + resetMinutes * 60_000).toISOString()}::timestamptz)`);
    });
    const link = `${webOrigin()}/quen-mat-khau?token=${encodeURIComponent(token)}`;
    await this.messages.send({
      channel: user.email ? "email" : "sms",
      to: (user.email ?? user.phone)!,
      subject: "Đặt lại mật khẩu VComm",
      body: `Chào ${user.full_name}, mở đường dẫn sau trong ${resetMinutes} phút để đặt mật khẩu mới: ${link}. Nếu bạn không yêu cầu, hãy bỏ qua.`,
    });
  }

  // API_13: đường dẫn dùng một lần, hết hạn sau 1 giờ; đặt xong thu hồi mọi phiên và bỏ khóa đăng nhập.
  async reset(token: string, password: string, client: ClientInfo): Promise<void> {
    const now = this.clock.now().toISOString();
    const row = (await this.database.execute<{ id: string; user_id: string }>(sql`
      SELECT t.id, t.user_id FROM core.user_tokens t JOIN core.users u ON u.id = t.user_id
      WHERE t.token_hash = ${hashToken(token)} AND t.purpose = 'password_reset' AND t.used_at IS NULL
        AND t.expires_at > ${now}::timestamptz AND u.status = 'active'`)).rows[0];
    if (!row) throw new ApiError("BUSINESS_RULE", "resetInvalid");
    requirePasswordLength(password, "password");
    await this.database.transaction(async (transaction) => {
      const used = await transaction.execute(sql`UPDATE core.user_tokens SET used_at = ${now}::timestamptz WHERE id = ${row.id} AND used_at IS NULL RETURNING id`);
      if (used.rows.length === 0) throw new ApiError("BUSINESS_RULE", "resetInvalid");
      await setPassword(transaction, row.user_id, password);
      await transaction.execute(sql`UPDATE core.users SET login_locked_until = NULL, updated_at = now() WHERE id = ${row.user_id}`);
      await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${row.user_id} AND revoked_at IS NULL`);
      await this.auditService.record(
        { actorUserId: row.user_id, appCode: "platform", action: "password.reset", entityType: "user", entityId: row.user_id, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
    });
  }

  // API_16: cần mật khẩu hiện tại; đổi xong thu hồi các phiên khác, giữ phiên đang dùng.
  async change(userId: string, sessionId: string, currentPassword: string, newPassword: string, client: ClientInfo): Promise<void> {
    const hashes = await this.database.execute<{ password_hash: string }>(sql`SELECT password_hash FROM core.user_identities WHERE user_id = ${userId} AND provider = 'password' LIMIT 1`);
    const current = hashes.rows[0]?.password_hash;
    if (!current || !(await argon2.verify(current, currentPassword))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currentPassword: "currentPasswordWrong" } });
    requirePasswordLength(newPassword, "newPassword");
    await this.database.transaction(async (transaction) => {
      await setPassword(transaction, userId, newPassword);
      await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${userId} AND id <> ${sessionId} AND revoked_at IS NULL`);
      await this.auditService.record(
        { actorUserId: userId, appCode: "platform", action: "password.change", entityType: "user", entityId: userId, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
    });
  }
}
