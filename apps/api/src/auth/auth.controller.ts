import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from "@nestjs/common";
import { activationSchema, forgotPasswordSchema, loginRequestSchema, mfaCodeSchema, mfaVerifySchema, resetPasswordSchema, type ActivationInfoResponse, type LoginResponse, type MfaBackupCodesResponse, type MfaEnrollResponse } from "contracts";
import type { Request, Response } from "express";
import { ApiError, localeOf } from "../common/api-error";
import { accessCookieName, AllowMfaPending, csrfCookieName, csrfMatches, Public, refreshCookieName, type AuthenticatedRequest } from "./auth.guard";
import { ActivationService } from "./activation.service";
import { MfaService } from "./mfa.service";
import { PasswordService } from "./password.service";
import { AuthService, type ClientInfo, type IssuedSession } from "./auth.service";
import { newRandomToken } from "./tokens";

const secureCookies = () => process.env.NODE_ENV === "production";

export function clientInfo(request: Request): ClientInfo {
  return { ip: request.ip ?? null, userAgent: request.header("user-agent") ?? null, requestId: request.header("x-request-id") ?? null, locale: localeOf(request) };
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
  constructor(
    private readonly auth: AuthService,
    private readonly activation: ActivationService,
    private readonly mfa: MfaService,
    private readonly passwords: PasswordService,
  ) {}

  // API_06
  @AllowMfaPending()
  @Post("mfa/verify")
  @HttpCode(204)
  async verifyMfa(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.mfa.verify(request.auth.userId, request.auth.sessionId, mfaVerifySchema.parse(body), clientInfo(request));
  }

  // API_07 (chỉ ứng dụng xác thực TOTP ở lát L5)
  @AllowMfaPending()
  @Post("mfa/enroll")
  async enrollMfa(@Req() request: AuthenticatedRequest): Promise<MfaEnrollResponse> {
    return this.mfa.enroll(request.auth.userId);
  }

  // API_08
  @AllowMfaPending()
  @Post("mfa/enroll/confirm")
  async confirmMfa(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<MfaBackupCodesResponse> {
    return this.mfa.confirm(request.auth.userId, request.auth.sessionId, mfaCodeSchema.parse(body).code, clientInfo(request));
  }

  // API_12
  @Public()
  @Post("password/forgot")
  @HttpCode(204)
  async forgot(@Body() body: unknown): Promise<void> {
    await this.passwords.forgot(forgotPasswordSchema.parse(body).identifier);
  }

  // API_13
  @Public()
  @Post("password/reset")
  @HttpCode(204)
  async reset(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const input = resetPasswordSchema.parse(body);
    await this.passwords.reset(input.token, input.password, clientInfo(request));
  }

  // API_11: xem thông tin trước khi kích hoạt (MAN_HINH_03).
  @Public()
  @Get("activation/:token")
  async activationInfo(@Param("token") token: string): Promise<ActivationInfoResponse> {
    return this.activation.info(token);
  }

  // API_11
  @Public()
  @Post("activation")
  @HttpCode(204)
  async activate(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const input = activationSchema.parse(body);
    await this.activation.activate(input.token, input.password, clientInfo(request));
  }

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
  @AllowMfaPending()
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.auth.sessionId, request.auth.userId, clientInfo(request));
    clearSessionCookies(response);
  }
}
