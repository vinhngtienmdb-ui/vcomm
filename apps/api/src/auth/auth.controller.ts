import { Body, Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import { loginRequestSchema, type LoginResponse } from "contracts";
import type { Request, Response } from "express";
import { ApiError } from "../common/api-error";
import { accessCookieName, csrfCookieName, csrfMatches, Public, refreshCookieName, type AuthenticatedRequest } from "./auth.guard";
import { AuthService, type ClientInfo, type IssuedSession } from "./auth.service";
import { newRandomToken } from "./tokens";

const secureCookies = () => process.env.NODE_ENV === "production";

export function clientInfo(request: Request): ClientInfo {
  return { ip: request.ip ?? null, userAgent: request.header("user-agent") ?? null, requestId: request.header("x-request-id") ?? null };
}

function setSessionCookies(response: Response, session: IssuedSession): void {
  const base = { httpOnly: true, secure: secureCookies(), sameSite: "lax" as const };
  response.cookie(accessCookieName, session.accessToken, { ...base, path: "/", expires: session.accessExpiresAt });
  response.cookie(refreshCookieName, session.refreshToken, { ...base, path: "/api/v1/auth", expires: session.refreshExpiresAt });
  // Cookie CSRF đọc được bằng JavaScript để gửi lại qua header X-CSRF-Token.
  response.cookie(csrfCookieName, newRandomToken(), { httpOnly: false, secure: secureCookies(), sameSite: "lax", path: "/", expires: session.refreshExpiresAt });
}

function clearSessionCookies(response: Response): void {
  response.clearCookie(accessCookieName, { path: "/" });
  response.clearCookie(refreshCookieName, { path: "/api/v1/auth" });
  response.clearCookie(csrfCookieName, { path: "/" });
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // API_01
  @Public()
  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<LoginResponse> {
    const input = loginRequestSchema.parse(body);
    const { response: result, session } = await this.auth.login(input, clientInfo(request));
    setSessionCookies(response, session);
    return result;
  }

  // API_09
  @Public()
  @Post("refresh")
  @HttpCode(204)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const refreshToken = request.cookies?.[refreshCookieName] as string | undefined;
    if (!refreshToken) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    if (!csrfMatches(request)) throw new ApiError("FORBIDDEN", "csrf");
    setSessionCookies(response, await this.auth.refresh(refreshToken, clientInfo(request)));
  }

  // API_10
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.auth.sessionId, request.auth.userId, clientInfo(request));
    clearSessionCookies(response);
  }
}
