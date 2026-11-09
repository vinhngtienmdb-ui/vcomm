// CHUC_NANG_06 đăng nhập bằng mật khẩu; phiên đăng nhập (tài liệu 17: API_01, API_09, API_10).
import { Inject, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import type { LoginRequest, LoginResponse } from "contracts";
import { normalizePhone } from "contracts";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { MfaService } from "./mfa.service";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { loginAttempts, sessions, userIdentities, users } from "../database/schema";
import { accessTokenLifetimeSeconds, hashToken, newRandomToken, refreshTokenLifetimeDays, signAccessToken } from "./tokens";

// QUYTAC_NGHIEPVU_07: sai 5 lần liên tiếp thì khóa 15 phút.
export const maximumConsecutiveFailures = 5;
export const lockMinutes = 15;

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  now?: Date;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  async login(request: LoginRequest, client: ClientInfo): Promise<{ response: LoginResponse; session: IssuedSession }> {
    const now = client.now ?? new Date();
    const typed = request.identifier.trim().toLowerCase();
    // Số điện thoại nhập dạng 0912… được đổi sang dạng lưu +84912… (tài liệu 16).
    const identifier = /^[+0-9][0-9 .-]{7,}$/.test(typed) ? normalizePhone(typed) : typed;
    const found = await this.database
      .select({ user: users, passwordHash: userIdentities.passwordHash })
      .from(userIdentities)
      .innerJoin(users, eq(users.id, userIdentities.userId))
      .where(and(eq(userIdentities.provider, "password"), sql`lower(${userIdentities.providerSubject}) = ${identifier}`))
      .limit(1);
    const match = found[0];

    if (match?.user.loginLockedUntil && match.user.loginLockedUntil > now) {
      await this.recordAttempt(identifier, match.user.id, false, "locked", client, now);
      const retryAfterSeconds = Math.ceil((match.user.loginLockedUntil.getTime() - now.getTime()) / 1000);
      throw new ApiError("ACCOUNT_LOCKED", "accountLocked", { retryAfterSeconds });
    }

    const passwordMatches = match?.passwordHash ? await argon2.verify(match.passwordHash, request.password) : false;
    if (!match || !passwordMatches || match.user.status !== "active") {
      // Cùng một thông báo cho sai tên, sai mật khẩu, tài khoản không hoạt động (TIEUCHI_NGHIEMTHU_11, luồng 2).
      const reason = !match ? "unknown_identifier" : !passwordMatches ? "wrong_password" : `status_${match.user.status}`;
      await this.recordAttempt(identifier, match?.user.id ?? null, false, reason, client, now);
      if (match && !passwordMatches) await this.lockIfTooManyFailures(match.user.id, match.user.loginLockedUntil, now);
      throw new ApiError("UNAUTHENTICATED", "invalidCredentials");
    }

    const user = match.user;
    const mfaEnrolled = await this.mfa.isEnrolled(user.id);
    const needsMfa = user.mfaRequired || mfaEnrolled;
    const session = await this.database.transaction(async (transaction) => {
      await transaction.update(users).set({ lastLoginAt: now, loginLockedUntil: null }).where(eq(users.id, user.id));
      await transaction
        .update(userIdentities)
        .set({ lastUsedAt: now })
        .where(and(eq(userIdentities.userId, user.id), eq(userIdentities.provider, "password")));
      // Bắt buộc xác thực hai lớp hoặc đã tự bật thì phiên chờ nhập mã (QUYTAC_NGHIEPVU_09).
      const issued = await this.issueSession(transaction, user.id, randomUUID(), client, now, !needsMfa);
      await this.audit.record(
        { actorUserId: user.id, appCode: "platform", action: "login", entityType: "core.users", entityId: user.id, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
      return issued;
    });
    await this.recordAttempt(identifier, user.id, true, null, client, now);
    return {
      response: { mfaRequired: needsMfa, mfaEnrolled, user: { id: user.id, fullName: user.fullName, locale: user.locale === "en" ? "en" : "vi" } },
      session,
    };
  }

  // Đổi token làm mới mỗi lần dùng; dùng lại token cũ thì thu hồi cả chuỗi phiên (tài liệu 22 mục 3).
  async refresh(refreshToken: string, client: ClientInfo): Promise<IssuedSession> {
    const now = client.now ?? new Date();
    const found = await this.database.select().from(sessions).where(eq(sessions.refreshTokenHash, hashToken(refreshToken))).limit(1);
    const current = found[0];
    if (!current) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    if (current.revokedAt) {
      await this.database.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.familyId, current.familyId), isNull(sessions.revokedAt)));
      throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    }
    if (current.expiresAt <= now) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    const active = await this.database.select({ status: users.status }).from(users).where(eq(users.id, current.userId));
    if (active[0]?.status !== "active") throw new ApiError("UNAUTHENTICATED", "unauthenticated");

    return this.database.transaction(async (transaction) => {
      await transaction.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, current.id));
      return this.issueSession(transaction, current.userId, current.familyId, client, now, current.mfaVerified);
    });
  }

  async logout(sessionId: string, userId: string, client: ClientInfo): Promise<void> {
    const now = client.now ?? new Date();
    await this.database.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
    await this.audit.record({ actorUserId: userId, appCode: "platform", action: "logout", entityType: "core.sessions", entityId: sessionId, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId });
  }

  private async issueSession(
    executor: Pick<Database, "insert">,
    userId: string,
    familyId: string,
    client: ClientInfo,
    now: Date,
    mfaVerified = false,
  ): Promise<IssuedSession> {
    const refreshToken = newRandomToken();
    const refreshExpiresAt = new Date(now.getTime() + refreshTokenLifetimeDays.web * 86_400_000);
    const inserted = await executor
      .insert(sessions)
      .values({
        userId,
        refreshTokenHash: hashToken(refreshToken),
        familyId,
        clientType: "web",
        ip: client.ip,
        userAgent: client.userAgent,
        mfaVerified,
        expiresAt: refreshExpiresAt,
      })
      .returning({ id: sessions.id });
    const accessExpiresAt = new Date(now.getTime() + accessTokenLifetimeSeconds * 1000);
    const accessToken = signAccessToken({ sessionId: inserted[0]!.id, userId, expiresAt: Math.floor(accessExpiresAt.getTime() / 1000) });
    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
  }

  private async recordAttempt(identifier: string, userId: string | null, success: boolean, failureReason: string | null, client: ClientInfo, now: Date): Promise<void> {
    await this.database.insert(loginAttempts).values({
      attemptedAt: now,
      provider: "password",
      identifier,
      userId,
      success,
      failureReason,
      ip: client.ip,
      userAgent: client.userAgent,
    });
  }

  // Đếm lần sai liên tiếp kể từ lần thành công gần nhất hoặc lần khóa trước.
  private async lockIfTooManyFailures(userId: string, previousLockUntil: Date | null, now: Date): Promise<void> {
    const lastSuccess = await this.database
      .select({ at: sql<Date | null>`max(${loginAttempts.attemptedAt})` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.userId, userId), eq(loginAttempts.success, true), eq(loginAttempts.provider, "password")));
    const candidates = [lastSuccess[0]?.at ? new Date(lastSuccess[0].at) : new Date(0), previousLockUntil ?? new Date(0)];
    const since = new Date(Math.max(...candidates.map((value) => value.getTime())));
    const failures = await this.database
      .select({ total: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.userId, userId), eq(loginAttempts.success, false), eq(loginAttempts.provider, "password"), gt(loginAttempts.attemptedAt, since)));
    if ((failures[0]?.total ?? 0) >= maximumConsecutiveFailures) {
      await this.database.update(users).set({ loginLockedUntil: new Date(now.getTime() + lockMinutes * 60_000) }).where(eq(users.id, userId));
    }
  }
}
