import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res } from "@nestjs/common";
import {
  activationSchema,
  appRefreshSchema,
  forgotPasswordSchema,
  loginRequestSchema,
  type AppLoginResponse,
  type AppTokens,
  mfaCodeSchema,
  mfaVerifySchema,
  otpSendSchema,
  otpVerifySchema,
  resetPasswordSchema,
  type ActivationInfoResponse,
  type AuthMethodsResponse,
  type LoginResponse,
  type MfaBackupCodesResponse,
  type MfaEnrollResponse,
} from "contracts";
import type { Request, Response } from "express";
import { ApiError, localeOf } from "../common/api-error";
import { accessCookieName, AllowMfaPending, csrfCookieName, csrfMatches, Public, RateLimitGroup, refreshCookieName, type AuthenticatedRequest } from "./auth.guard";
import { ActivationService } from "./activation.service";
import { MfaService } from "./mfa.service";
import { PasswordService } from "./password.service";
import { AuthService, type ClientInfo, type IssuedSession } from "./auth.service";

const appTokens = (session: IssuedSession): AppTokens => ({
  accessToken: session.accessToken,
  refreshToken: session.refreshToken,
  accessExpiresAt: session.accessExpiresAt.toISOString(),
  refreshExpiresAt: session.refreshExpiresAt.toISOString(),
});
import { newRandomToken } from "./tokens";
import { MessagingService } from "../integrations/messaging.service";
import { webOrigin } from "../common/outbound-messages";
import { oauthProviders, OauthService, oauthStateCookieName } from "./oauth.service";
import type { OauthProvider } from "./oauth-providers";
import { PhoneOtpService } from "./phone-otp.service";
import { PermissionService } from "../permissions/permission.service";
import { verifyAccessToken } from "./tokens";

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
    private readonly phoneOtp: PhoneOtpService,
    private readonly oauth: OauthService,
    private readonly messaging: MessagingService,
    private readonly permissionService: PermissionService,
  ) {}

  // API_54: cách đăng nhập đã cài đặt, để MAN_HINH_01 chỉ hiện nút dùng được.
  @Public()
  @Get("methods")
  async methods(): Promise<AuthMethodsResponse> {
    return {
      password: true,
      phone: await this.messaging.smsConfigured(),
      google: await this.oauth.configured("google"),
      microsoft: await this.oauth.configured("microsoft"),
      zalo: await this.oauth.configured("zalo"),
    };
  }

  // API_02: luôn trả 204 kể cả số chưa gắn tài khoản (QUYTAC_NGHIEPVU_05).
  @Public()
  @Post("otp/send")
  @HttpCode(204)
  async sendOtp(@Body() body: unknown): Promise<void> {
    await this.phoneOtp.send(otpSendSchema.parse(body).phone);
  }

  // API_03
  @Public()
  @RateLimitGroup("otp-verify")
  @Post("otp/verify")
  @HttpCode(200)
  async verifyOtp(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<LoginResponse> {
    const input = otpVerifySchema.parse(body);
    const { response: result, session } = await this.phoneOtp.verify(input.phone, input.code, clientInfo(request));
    setSessionCookies(response, session);
    return result;
  }

  // API_04: chuyển hướng tới nhà cung cấp. Lỗi thì quay về trang đăng nhập, hồ sơ hoặc kích hoạt kèm mã lỗi.
  @Public()
  @Get("oauth/:provider/start")
  async oauthStart(
    @Param("provider") provider: string,
    @Query("mode") mode: string | undefined,
    @Query("token") token: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const chosen = mode === "link" || mode === "activate" ? mode : "login";
    try {
      const started = await this.oauth.start(oauthProvider(provider), chosen, request.cookies?.[accessCookieName] as string | undefined, token);
      response.cookie(oauthStateCookieName, started.stateCookie, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/api/v1/auth/oauth", maxAge: 600_000 });
      response.redirect(302, started.url);
    } catch (error) {
      response.redirect(302, errorRedirect(chosen, error, token));
    }
  }

  // API_05: nhà cung cấp chuyển về đây; đăng nhập xong về trang chủ (hoặc nhập mã xác thực hai lớp),
  // liên kết xong về hồ sơ, kích hoạt xong về trang đăng nhập kèm thông báo (MAN_HINH_03).
  @Public()
  @Get("oauth/:provider/callback")
  async oauthCallback(
    @Param("provider") provider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const stateCookie = request.cookies?.[oauthStateCookieName] as string | undefined;
    response.clearCookie(oauthStateCookieName, { path: "/api/v1/auth/oauth" });
    const pending = this.oauth.pending(stateCookie);
    try {
      const outcome = await this.oauth.callback(oauthProvider(provider), { code, state, stateCookie }, clientInfo(request));
      if (outcome.kind === "linked") return response.redirect(302, `${webOrigin()}/ho-so?lienKet=${outcome.provider}`);
      if (outcome.kind === "activated") return response.redirect(302, `${webOrigin()}/dang-nhap?kichHoat=${outcome.provider}`);
      setSessionCookies(response, outcome.session);
      response.redirect(302, `${webOrigin()}${outcome.mfaRequired ? "/xac-thuc" : "/"}`);
    } catch (error) {
      response.redirect(302, errorRedirect(pending.mode, error, pending.activationToken ?? undefined));
    }
  }

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
  @RateLimitGroup("login")
  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<LoginResponse> {
    const input = loginRequestSchema.parse(body);
    const { response: result, session } = await this.auth.login(input, clientInfo(request));
    setSessionCookies(response, session);
    return result;
  }

  // API_112: ứng dụng nhân viên kinh doanh đăng nhập bằng mật khẩu, nhận token trong thân phản hồi (QUYTAC_NGHIEPVU_136).
  // Xác thực hai lớp, đăng xuất dùng API hiện có với header Authorization.
  @Public()
  @RateLimitGroup("login")
  @Post("app/login")
  @HttpCode(200)
  async appLogin(@Body() body: unknown, @Req() request: Request): Promise<AppLoginResponse> {
    const { response, session } = await this.auth.login(loginRequestSchema.parse(body), clientInfo(request), "sales_app");
    return { ...response, tokens: appTokens(session) };
  }

  // API_137: ứng dụng kho đăng nhập như API_112 nhưng phiên warehouse_app; chỉ tài khoản có quyền kho ở ít nhất một công ty (QUYTAC_NGHIEPVU_280).
  @Public()
  @RateLimitGroup("login")
  @Post("warehouse-app/login")
  @HttpCode(200)
  async warehouseAppLogin(@Body() body: unknown, @Req() request: Request): Promise<AppLoginResponse> {
    const client = clientInfo(request);
    const { response, session } = await this.auth.login(loginRequestSchema.parse(body), client, "warehouse_app");
    const payload = verifyAccessToken(session.accessToken)!;
    const companies = await this.permissionService.memberships(payload.userId);
    let allowed = false;
    for (const company of companies) {
      if ((await this.permissionService.permissionsInCompany(payload.userId, company.id)).includes("inventory.access")) {
        allowed = true;
        break;
      }
    }
    if (!allowed) {
      await this.auth.logout(payload.sessionId, payload.userId, client);
      throw new ApiError("FORBIDDEN", "warehouseAppNoAccess");
    }
    return { ...response, tokens: appTokens(session) };
  }

  @Public()
  @Post("app/refresh")
  @HttpCode(200)
  async appRefresh(@Body() body: unknown, @Req() request: Request): Promise<AppTokens> {
    return appTokens(await this.auth.refresh(appRefreshSchema.parse(body).refreshToken, clientInfo(request), true));
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

function oauthProvider(value: string): OauthProvider {
  if (!(oauthProviders as string[]).includes(value)) throw new ApiError("NOT_FOUND", "notFound");
  return value as OauthProvider;
}

// Mã lỗi đưa qua tham số "loi" để giao diện hiện thông báo theo ngôn ngữ đang chọn.
function errorRedirect(mode: "login" | "link" | "activate", error: unknown, activationToken?: string): string {
  const key = encodeURIComponent(error instanceof ApiError ? error.messageKey : "oauthFailed");
  if (mode === "link") return `${webOrigin()}/ho-so?loi=${key}`;
  if (mode === "activate" && activationToken) return `${webOrigin()}/kich-hoat?token=${encodeURIComponent(activationToken)}&loi=${key}`;
  return `${webOrigin()}/dang-nhap?loi=${key}`;
}
