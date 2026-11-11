// Kiểm tra đăng nhập cho mọi API, trừ API gắn @Public(); kiểm tra CSRF cho thao tác ghi (tài liệu 22 mục 3).
import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq, isNull } from "drizzle-orm";
import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "../common/api-error";
import { RateLimiter } from "../common/rate-limiter";
import { DATABASE, type Database } from "../database/database.module";
import { sessions, users } from "../database/schema";
import { verifyAccessToken } from "./tokens";

export const accessCookieName = "vc_access";
export const refreshCookieName = "vc_refresh";
export const csrfCookieName = "vc_csrf";

const publicKey = "isPublic";
export const Public = () => SetMetadata(publicKey, true);
// API công khai tự giới hạn số lần gọi sai (webhook ngân hàng chỉ đếm lần sai khóa; CONG_VIEC_18).
const ownRateLimitKey = "ownRateLimit";
export const OwnRateLimit = () => SetMetadata(ownRateLimitKey, true);
// CONG_VIEC_54: API công khai không giới hạn số yêu cầu theo IP (THAY_DOI_23, chấp nhận rủi ro ở tài liệu 22 mục 8).
const noRateLimitKey = "noRateLimit";
export const NoRateLimit = () => SetMetadata(noRateLimitKey, true);

// Nhiều API công khai dùng chung một bộ đếm số lần gọi (các đường dẫn đăng nhập trên web và ứng dụng; CONG_VIEC_23).
const rateLimitGroupKey = "rateLimitGroup";
export const RateLimitGroup = (group: string) => SetMetadata(rateLimitGroupKey, group);

// Đường dẫn dùng được khi phiên chưa nhập mã xác thực hai lớp (luồng 2 bước 3 tài liệu 09).
const mfaPendingKey = "allowMfaPending";
export const AllowMfaPending = () => SetMetadata(mfaPendingKey, true);

export interface AuthContext {
  userId: string;
  sessionId: string;
  mfaVerified: boolean;
}

export type AuthenticatedRequest = Request & { auth: AuthContext };

export function csrfMatches(request: Request): boolean {
  const cookie = request.cookies?.[csrfCookieName] as string | undefined;
  const header = request.header("x-csrf-token");
  if (!cookie || !header || cookie.length !== header.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly database: Database,
    private readonly rateLimiter: RateLimiter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (this.reflector.getAllAndOverride<boolean>(publicKey, [context.getHandler(), context.getClass()])) {
      // API không cần đăng nhập: giới hạn số yêu cầu theo địa chỉ IP (tài liệu 22 mục 3).
      if (this.reflector.getAllAndOverride<boolean>(ownRateLimitKey, [context.getHandler(), context.getClass()])) return true;
      if (this.reflector.getAllAndOverride<boolean>(noRateLimitKey, [context.getHandler(), context.getClass()])) return true;
      const group = this.reflector.getAllAndOverride<string | undefined>(rateLimitGroupKey, [context.getHandler(), context.getClass()]);
      const route = group ?? `${request.method} ${(request.route as { path?: string } | undefined)?.path ?? request.path}`;
      const retryAfterSeconds = await this.rateLimiter.hit(route, request.ip ?? "khong-ro");
      if (retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds });
      return true;
    }

    const bearer = request.header("authorization")?.replace(/^Bearer\s+/i, "");
    const cookieToken = request.cookies?.[accessCookieName] as string | undefined;
    const token = bearer || cookieToken;
    const payload = token ? verifyAccessToken(token) : null;
    if (!payload) throw new ApiError("UNAUTHENTICATED", "unauthenticated");

    // Cookie phiên trên web phải kèm CSRF token khi ghi; ứng dụng di động dùng header Authorization.
    if (!bearer && request.method !== "GET" && request.method !== "HEAD" && !csrfMatches(request)) {
      throw new ApiError("FORBIDDEN", "csrf");
    }

    const rows = await this.database
      .select({ userStatus: users.status, mfaVerified: sessions.mfaVerified })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, payload.sessionId), eq(sessions.userId, payload.userId), isNull(sessions.revokedAt)))
      .limit(1);
    const row = rows[0];
    if (row?.userStatus !== "active") throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    if (!row.mfaVerified && !this.reflector.getAllAndOverride<boolean>(mfaPendingKey, [context.getHandler(), context.getClass()])) {
      throw new ApiError("MFA_REQUIRED", "mfaRequired");
    }

    request.auth = { userId: payload.userId, sessionId: payload.sessionId, mfaVerified: row.mfaVerified };
    return true;
  }
}
