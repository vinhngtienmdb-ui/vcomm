// Đăng nhập, liên kết Google, Microsoft, Zalo (CHUC_NANG_07, CHUC_NANG_24; API_04, API_05).
// Trạng thái (state, code_verifier, chế độ, người liên kết) giữ trong cookie HttpOnly đã ký, hết hạn 10 phút.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { users } from "../database/schema";
import { IntegrationSettingsService, oauthCallbackUrl } from "../integrations/integration-settings.service";
import { ActivationService } from "./activation.service";
import { AuthService, type ClientInfo, type IssuedSession } from "./auth.service";
import { OAUTH_CLIENT, type OauthAppSettings, type OauthClient, type OauthProvider } from "./oauth-providers";
import { signPayload, verifyAccessToken, verifyPayload } from "./tokens";

export const oauthStateCookieName = "vc_oauth";
export const oauthProviders: OauthProvider[] = ["google", "microsoft", "zalo"];

interface OauthState {
  provider: OauthProvider;
  mode: "login" | "link" | "activate";
  state: string;
  activationToken: string | null;
  verifier: string;
  userId: string | null;
  // CONG_VIEC_55: đăng nhập, liên kết từ cổng cửa hàng liên kết thì quay về `/merchant`.
  app?: "merchant";
  expiresAt: number;
}

export type OauthOutcome = { kind: "login"; session: IssuedSession; mfaRequired: boolean } | { kind: "linked"; provider: OauthProvider } | { kind: "activated"; provider: OauthProvider };

@Injectable()
export class OauthService {
  private readonly logger = new Logger("Oauth");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(OAUTH_CLIENT) private readonly client: OauthClient,
    private readonly settings: IntegrationSettingsService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly activation: ActivationService,
  ) {}

  // Nhà cung cấp đã có đủ mã ứng dụng thì hiện nút trên MAN_HINH_01 (API_54).
  async configured(provider: OauthProvider): Promise<boolean> {
    return (await this.appSettings(provider)) !== null;
  }

  // API_04: trả đường dẫn nhà cung cấp và cookie trạng thái. Chế độ liên kết cần phiên đã đăng nhập.
  async start(
    provider: OauthProvider,
    mode: "login" | "link" | "activate",
    accessToken: string | undefined,
    activationToken?: string,
    portalApp?: "merchant",
  ): Promise<{ url: string; stateCookie: string }> {
    const app = await this.appSettings(provider);
    if (!app) throw new ApiError("BUSINESS_RULE", "oauthNotConfigured");
    if (mode === "activate") {
      if (provider === "zalo" || !activationToken) throw new ApiError("BUSINESS_RULE", "activationInvalid");
      await this.activation.info(activationToken);
    }
    let userId: string | null = null;
    if (mode === "link") {
      userId = await this.activeSessionUser(accessToken);
      if (!userId) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    }
    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
    const stateCookie = signPayload({
      provider,
      mode,
      state,
      verifier,
      userId,
      activationToken: mode === "activate" ? (activationToken ?? null) : null,
      ...(portalApp && mode !== "activate" ? { app: portalApp } : {}),
      expiresAt: Math.floor(Date.now() / 1000) + 600,
    } satisfies OauthState);
    return { url: this.client.authorizationUrl(provider, app, { redirectUri: oauthCallbackUrl(provider), state, codeChallenge }), stateCookie };
  }

  // Chế độ của lần đăng nhập đang dở, để biết lỗi thì quay về trang nào.
  pending(stateCookie: string | undefined): { mode: OauthState["mode"]; activationToken: string | null; app: "merchant" | null } {
    const saved = stateCookie ? verifyPayload<OauthState>(stateCookie) : null;
    return { mode: saved?.mode ?? "login", activationToken: saved?.activationToken ?? null, app: saved?.app ?? null };
  }

  // API_05: đổi mã lấy danh tính rồi đăng nhập hoặc liên kết.
  async callback(provider: OauthProvider, input: { code: string | undefined; state: string | undefined; stateCookie: string | undefined }, client: ClientInfo): Promise<OauthOutcome> {
    const saved = input.stateCookie ? verifyPayload<OauthState>(input.stateCookie) : null;
    if (!saved || saved.provider !== provider || !input.state || saved.state !== input.state || !input.code) throw new ApiError("UNAUTHENTICATED", "oauthFailed");
    const app = await this.appSettings(provider);
    if (!app) throw new ApiError("BUSINESS_RULE", "oauthNotConfigured");
    let profile;
    try {
      profile = await this.client.exchange(provider, app, { code: input.code, redirectUri: oauthCallbackUrl(provider), codeVerifier: saved.verifier });
    } catch (error) {
      this.logger.warn(`${provider}: ${(error as Error).message}`);
      throw new ApiError("UNAUTHENTICATED", "oauthFailed");
    }
    const linked = (
      await this.database.execute<{ user_id: string }>(sql`
      SELECT user_id FROM core.user_identities WHERE provider = ${provider} AND provider_subject = ${profile.subject}`)
    ).rows[0]?.user_id;

    if (saved.mode === "activate") {
      await this.activation.activateWithIdentity(
        saved.activationToken ?? "",
        { provider: provider as "google" | "microsoft", subject: profile.subject, email: profile.email, emailVerified: profile.emailVerified },
        client,
      );
      return { kind: "activated", provider };
    }

    if (saved.mode === "link") {
      if (linked && linked !== saved.userId) throw new ApiError("BUSINESS_RULE", provider === "zalo" ? "zaloLinkedElsewhere" : "identityLinkedElsewhere");
      if (!linked) {
        await this.database.transaction(async (transaction) => {
          await transaction.execute(sql`INSERT INTO core.user_identities (user_id, provider, provider_subject) VALUES (${saved.userId}, ${provider}, ${profile.subject})`);
          await this.audit.record(
            {
              actorUserId: saved.userId,
              appCode: "platform",
              action: "identity.link",
              entityType: "core.users",
              entityId: saved.userId,
              afterData: { provider },
              ip: client.ip,
              userAgent: client.userAgent,
              requestId: client.requestId,
            },
            transaction,
          );
        });
      }
      return { kind: "linked", provider };
    }

    let userId = linked ?? null;
    // CHUC_NANG_07: lần đầu gắn vào tài khoản đang hoạt động có cùng email đã xác minh. Zalo phải liên kết từ hồ sơ trước.
    if (!userId && provider !== "zalo" && profile.email && profile.emailVerified) {
      userId = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.users WHERE lower(email) = ${profile.email} AND status = 'active'`)).rows[0]?.id ?? null;
      if (!userId) {
        await this.auth.recordAttempt(profile.email, null, false, "email_not_invited", client, client.now ?? new Date(), provider);
        throw new ApiError("FORBIDDEN", "emailNotInvited");
      }
      await this.database.execute(sql`INSERT INTO core.user_identities (user_id, provider, provider_subject) VALUES (${userId}, ${provider}, ${profile.subject})`);
    }
    if (!userId) throw new ApiError("UNAUTHENTICATED", provider === "google" ? "emailNotInvited" : provider === "zalo" ? "zaloNotLinked" : "providerNotLinked");
    const user = (
      await this.database
        .select()
        .from(users)
        .where(sql`${users.id} = ${userId}`)
        .limit(1)
    )[0];
    if (!user || user.status !== "active") throw new ApiError("UNAUTHENTICATED", "invalidCredentials");
    const result = await this.auth.completeLogin(user, provider, profile.email ?? profile.subject, client);
    return { kind: "login", session: result.session, mfaRequired: result.response.mfaRequired };
  }

  private async appSettings(provider: OauthProvider): Promise<OauthAppSettings | null> {
    const keys = provider === "zalo" ? (["zalo.app_id", "zalo.app_secret"] as const) : ([`${provider}.client_id`, `${provider}.client_secret`] as const);
    const values = await this.settings.getMany([...keys, "microsoft.tenant"]);
    const clientId = values[keys[0]];
    const clientSecret = values[keys[1]];
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret, tenant: values["microsoft.tenant"] || "organizations" };
  }

  private async activeSessionUser(accessToken: string | undefined): Promise<string | null> {
    const payload = accessToken ? verifyAccessToken(accessToken) : null;
    if (!payload) return null;
    const row = (
      await this.database.execute<{ user_id: string }>(sql`
      SELECT s.user_id FROM core.sessions s JOIN core.users u ON u.id = s.user_id
      WHERE s.id = ${payload.sessionId} AND s.user_id = ${payload.userId} AND s.revoked_at IS NULL AND s.mfa_verified AND u.status = 'active'`)
    ).rows[0];
    return row?.user_id ?? null;
  }
}
