// Xác thực hai lớp bằng ứng dụng xác thực (TOTP) và 10 mã dự phòng dùng một lần (CHUC_NANG_09; QUYTAC_NGHIEPVU_09).
// Mã OTP qua SMS, email có khi gắn nhà cung cấp gửi tin (lát L6).
import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { MfaBackupCodesResponse, MfaEnrollResponse } from "contracts";
import { sql } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { ClientInfo } from "./auth.service";

const maximumWrongCodes = 5;
const backupCodeCount = 10;
const backupAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Khóa mã hóa bí mật TOTP lấy từ biến môi trường; môi trường thật dùng khóa AWS KMS (tài liệu 22).
function encryptionKey(): Buffer {
  const value = process.env.MFA_SECRET_KEY;
  if (!value || value.length < 32) throw new Error("MFA_SECRET_KEY phải có ít nhất 32 ký tự.");
  return createHash("sha256").update(value).digest();
}

function encrypt(plain: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}

function decrypt(data: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

const totpFor = (secretBase32: string, label: string) => new TOTP({ issuer: "VComm", label, secret: Secret.fromBase32(secretBase32), digits: 6, period: 30 });

const newBackupCode = () => {
  const characters = Array.from({ length: 8 }, () => backupAlphabet[randomInt(backupAlphabet.length)]).join("");
  return `${characters.slice(0, 4)}-${characters.slice(4)}`;
};

type Executor = Pick<Database, "execute" | "insert">;

@Injectable()
export class MfaService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
  ) {}

  async isEnrolled(userId: string, executor: Pick<Database, "execute"> = this.database): Promise<boolean> {
    const result = await executor.execute(sql`SELECT 1 FROM core.mfa_factors WHERE user_id = ${userId} AND factor_type = 'totp' AND confirmed_at IS NOT NULL`);
    return result.rows.length > 0;
  }

  // API_07: tạo bí mật mới chưa xác nhận; bí mật cũ chưa xác nhận bị thay.
  async enroll(userId: string): Promise<MfaEnrollResponse> {
    if (await this.isEnrolled(userId)) throw new ApiError("BUSINESS_RULE", "mfaAlreadyEnabled");
    const label = await this.label(userId);
    const secret = new Secret({ size: 20 });
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM core.mfa_factors WHERE user_id = ${userId} AND confirmed_at IS NULL`);
      await transaction.execute(sql`INSERT INTO core.mfa_factors (user_id, factor_type, secret_encrypted) VALUES (${userId}, 'totp', ${encrypt(secret.base32)})`);
    });
    return { otpauthUrl: totpFor(secret.base32, label).toString(), secretForManualEntry: secret.base32 };
  }

  // API_08: xác nhận mã đầu tiên, cấp 10 mã dự phòng (chỉ trả một lần), đánh dấu phiên hiện tại đã xác thực hai lớp.
  async confirm(userId: string, sessionId: string, code: string, client: ClientInfo): Promise<MfaBackupCodesResponse> {
    const factor = await this.factor(userId, false);
    if (!factor || !(await this.codeMatches(userId, sessionId, factor.secret, code, client))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "mfaInvalidCode" } });
    return this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE core.mfa_factors SET confirmed_at = now() WHERE id = ${factor.id}`);
      await transaction.execute(sql`UPDATE core.sessions SET mfa_verified = true WHERE id = ${sessionId}`);
      const codes = await this.replaceBackupCodes(transaction, userId);
      await this.audit(transaction, userId, "mfa.enable", client);
      return { backupCodes: codes };
    });
  }

  // API_06: mã TOTP hoặc mã dự phòng; sai quá 5 lần trong phiên thì thu hồi phiên.
  async verify(userId: string, sessionId: string, input: { code?: string | undefined; backupCode?: string | undefined }, client: ClientInfo): Promise<void> {
    const factor = await this.factor(userId, true);
    if (!factor) throw new ApiError("BUSINESS_RULE", "mfaNotEnabled");
    const ok = input.code ? await this.codeMatches(userId, sessionId, factor.secret, input.code, client) : await this.useBackupCode(userId, sessionId, input.backupCode!, client);
    if (!ok) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [input.code ? "code" : "backupCode"]: "mfaInvalidCode" } });
    await this.database.execute(sql`UPDATE core.sessions SET mfa_verified = true WHERE id = ${sessionId}`);
    await this.audit(this.database, userId, "mfa.verify", client);
  }

  // Tắt: không được khi đang bắt buộc (QUYTAC_NGHIEPVU_09, TIEUCHI_NGHIEMTHU_17).
  async disable(userId: string, sessionId: string, code: string, client: ClientInfo): Promise<void> {
    const required = (await this.database.execute<{ mfa_required: boolean }>(sql`SELECT mfa_required FROM core.users WHERE id = ${userId}`)).rows[0]?.mfa_required;
    if (required) throw new ApiError("BUSINESS_RULE", "mfaMandatory");
    const factor = await this.factor(userId, true);
    if (!factor) throw new ApiError("BUSINESS_RULE", "mfaNotEnabled");
    if (!(await this.codeMatches(userId, sessionId, factor.secret, code, client))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "mfaInvalidCode" } });
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM core.mfa_factors WHERE user_id = ${userId}`);
      await transaction.execute(sql`DELETE FROM core.mfa_backup_codes WHERE user_id = ${userId}`);
      await this.audit(transaction, userId, "mfa.disable", client);
    });
  }

  async regenerateBackupCodes(userId: string, sessionId: string, code: string, client: ClientInfo): Promise<MfaBackupCodesResponse> {
    const factor = await this.factor(userId, true);
    if (!factor) throw new ApiError("BUSINESS_RULE", "mfaNotEnabled");
    if (!(await this.codeMatches(userId, sessionId, factor.secret, code, client))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "mfaInvalidCode" } });
    return this.database.transaction(async (transaction) => {
      const codes = await this.replaceBackupCodes(transaction, userId);
      await this.audit(transaction, userId, "mfa.backup_codes.regenerate", client);
      return { backupCodes: codes };
    });
  }

  private async replaceBackupCodes(transaction: Executor, userId: string): Promise<string[]> {
    const codes = Array.from({ length: backupCodeCount }, newBackupCode);
    await transaction.execute(sql`DELETE FROM core.mfa_backup_codes WHERE user_id = ${userId}`);
    for (const code of codes) {
      await transaction.execute(sql`INSERT INTO core.mfa_backup_codes (user_id, code_hash) VALUES (${userId}, ${await argon2.hash(code, { type: argon2.argon2id })})`);
    }
    return codes;
  }

  // Mã dự phòng dùng một lần (TIEUCHI_NGHIEMTHU_16): đánh dấu đã dùng có điều kiện để không dùng được hai lần.
  private async useBackupCode(userId: string, sessionId: string, code: string, client: ClientInfo): Promise<boolean> {
    await this.requireAttemptsLeft(userId, sessionId);
    const normalized = code.trim().toUpperCase().replace(/\s/g, "");
    const rows = await this.database.execute<{ id: string; code_hash: string }>(sql`SELECT id, code_hash FROM core.mfa_backup_codes WHERE user_id = ${userId} AND used_at IS NULL`);
    for (const row of rows.rows) {
      if (await argon2.verify(row.code_hash, normalized)) {
        const used = await this.database.execute(sql`UPDATE core.mfa_backup_codes SET used_at = now() WHERE id = ${row.id} AND used_at IS NULL RETURNING id`);
        if (used.rows.length > 0) return true;
      }
    }
    await this.recordFailure(userId, sessionId, client);
    return false;
  }

  private async codeMatches(userId: string, sessionId: string, secret: string, code: string, client: ClientInfo): Promise<boolean> {
    await this.requireAttemptsLeft(userId, sessionId);
    // Chấp nhận lệch một bước 30 giây do đồng hồ điện thoại.
    if (totpFor(secret, "").validate({ token: code, window: 1 }) !== null) return true;
    await this.recordFailure(userId, sessionId, client);
    return false;
  }

  private async requireAttemptsLeft(userId: string, sessionId: string): Promise<void> {
    const result = await this.database.execute<{ failures: number }>(sql`
      SELECT count(*)::int AS failures FROM core.login_attempts WHERE user_id = ${userId} AND failure_reason = ${`mfa_failed:${sessionId}`}`);
    if ((result.rows[0]?.failures ?? 0) >= maximumWrongCodes) {
      await this.database.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE id = ${sessionId} AND revoked_at IS NULL`);
      throw new ApiError("UNAUTHENTICATED", "mfaTooManyAttempts");
    }
  }

  private async recordFailure(userId: string, sessionId: string, client: ClientInfo): Promise<void> {
    await this.database.execute(sql`
      INSERT INTO core.login_attempts (provider, identifier, user_id, success, failure_reason, ip, user_agent)
      VALUES ('mfa', ${`mfa:${userId}`}, ${userId}, false, ${`mfa_failed:${sessionId}`}, ${client.ip}, ${client.userAgent})`);
  }

  private async factor(userId: string, confirmed: boolean): Promise<{ id: string; secret: string } | null> {
    const result = await this.database.execute<{ id: string; secret_encrypted: Buffer }>(sql`
      SELECT id, secret_encrypted FROM core.mfa_factors WHERE user_id = ${userId} AND factor_type = 'totp'
        AND ${confirmed ? sql`confirmed_at IS NOT NULL` : sql`confirmed_at IS NULL`}
      ORDER BY created_at DESC LIMIT 1`);
    const row = result.rows[0];
    return row ? { id: row.id, secret: decrypt(row.secret_encrypted) } : null;
  }

  private async label(userId: string): Promise<string> {
    const row = (await this.database.execute<{ email: string | null; phone: string | null; username: string | null }>(sql`SELECT email::text AS email, phone, username::text AS username FROM core.users WHERE id = ${userId}`)).rows[0];
    return row?.email ?? row?.phone ?? row?.username ?? userId;
  }

  private async audit(executor: Pick<Database, "insert">, userId: string, action: string, client: ClientInfo): Promise<void> {
    await this.auditService.record({ actorUserId: userId, appCode: "platform", action, entityType: "user", entityId: userId, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId }, executor);
  }
}
