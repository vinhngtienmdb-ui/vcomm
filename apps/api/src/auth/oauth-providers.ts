// Gọi Google, Microsoft (OpenID Connect) và Zalo (OAuth v4) có PKCE. Không thêm thư viện: token nhận trực tiếp
// từ nhà cung cấp qua HTTPS ở kênh máy chủ – máy chủ nên không cần kiểm chữ ký id_token (OpenID Connect Core 3.1.3.7).
import { Injectable } from "@nestjs/common";

export type OauthProvider = "google" | "microsoft" | "zalo";
export const OAUTH_CLIENT = Symbol("OAUTH_CLIENT");

export interface OauthAppSettings {
  clientId: string;
  clientSecret: string;
  tenant: string;
}

export interface OauthProfile {
  subject: string;
  email: string | null;
  // Email đã được nhà cung cấp xác minh, dùng được để tự gắn vào tài khoản cùng email (CHUC_NANG_07).
  emailVerified: boolean;
  name: string | null;
}

export interface OauthClient {
  authorizationUrl(provider: OauthProvider, app: OauthAppSettings, input: { redirectUri: string; state: string; codeChallenge: string }): string;
  exchange(provider: OauthProvider, app: OauthAppSettings, input: { code: string; redirectUri: string; codeVerifier: string }): Promise<OauthProfile>;
}

const decodeJwtPayload = (token: string): Record<string, unknown> => JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as Record<string, unknown>;

// Microsoft: tenant cụ thể (mã GUID hoặc tên miền) là tenant của công ty, email do quản trị công ty cấp nên tin được;
// "organizations", "common" cho mọi tenant thì không tự gắn theo email, phải liên kết từ hồ sơ trước.
const isSpecificTenant = (tenant: string) => !["organizations", "common", "consumers"].includes(tenant);
const isTenantId = (tenant: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant);
// Tenant là mã GUID: so với tid; tenant là tên miền: email phải thuộc tên miền đó.
export const tenantVerified = (tenant: string, tid: unknown, email: string | null) =>
  isSpecificTenant(tenant) && (isTenantId(tenant) ? tid === tenant.toLowerCase() : Boolean(email?.endsWith(`@${tenant.toLowerCase()}`)));

@Injectable()
export class HttpOauthClient implements OauthClient {
  authorizationUrl(provider: OauthProvider, app: OauthAppSettings, input: { redirectUri: string; state: string; codeChallenge: string }): string {
    if (provider === "zalo") {
      const query = new URLSearchParams({ app_id: app.clientId, redirect_uri: input.redirectUri, code_challenge: input.codeChallenge, state: input.state });
      return `https://oauth.zaloapp.com/v4/permission?${query}`;
    }
    const query = new URLSearchParams({
      client_id: app.clientId,
      redirect_uri: input.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: input.state,
      code_challenge: input.codeChallenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
    return provider === "google" ? `https://accounts.google.com/o/oauth2/v2/auth?${query}` : `https://login.microsoftonline.com/${encodeURIComponent(app.tenant)}/oauth2/v2.0/authorize?${query}`;
  }

  async exchange(provider: OauthProvider, app: OauthAppSettings, input: { code: string; redirectUri: string; codeVerifier: string }): Promise<OauthProfile> {
    if (provider === "zalo") return this.zalo(app, input);
    const tokenUrl = provider === "google" ? "https://oauth2.googleapis.com/token" : `https://login.microsoftonline.com/${encodeURIComponent(app.tenant)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: app.clientId,
      client_secret: app.clientSecret,
      code_verifier: input.codeVerifier,
    });
    const response = await fetch(tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
    const json = (await response.json()) as { id_token?: string; error?: string };
    if (!response.ok || !json.id_token) throw new Error(json.error ?? `Nhà cung cấp trả mã ${response.status}`);
    const claims = decodeJwtPayload(json.id_token);
    if (claims.aud !== app.clientId) throw new Error("id_token không dành cho ứng dụng này");
    if (provider === "google") {
      return {
        subject: String(claims.sub),
        email: typeof claims.email === "string" ? claims.email.toLowerCase() : null,
        emailVerified: claims.email_verified === true,
        name: typeof claims.name === "string" ? claims.name : null,
      };
    }
    const email = typeof claims.email === "string" ? claims.email : typeof claims.preferred_username === "string" ? claims.preferred_username : null;
    // Microsoft: định danh ổn định là tid + oid.
    return {
      subject: `${String(claims.tid)}:${String(claims.oid ?? claims.sub)}`,
      email: email?.toLowerCase() ?? null,
      emailVerified: tenantVerified(app.tenant, claims.tid, email?.toLowerCase() ?? null),
      name: typeof claims.name === "string" ? claims.name : null,
    };
  }

  private async zalo(app: OauthAppSettings, input: { code: string; codeVerifier: string }): Promise<OauthProfile> {
    const body = new URLSearchParams({ code: input.code, app_id: app.clientId, grant_type: "authorization_code", code_verifier: input.codeVerifier });
    const token = await fetch("https://oauth.zaloapp.com/v4/access_token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", secret_key: app.clientSecret },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const tokenJson = (await token.json()) as { access_token?: string; error_description?: string; error?: number };
    if (!tokenJson.access_token) throw new Error(tokenJson.error_description ?? "Zalo không cấp access_token");
    const profile = await fetch("https://graph.zalo.me/v2.0/me?fields=id,name", { headers: { access_token: tokenJson.access_token }, signal: AbortSignal.timeout(15_000) });
    const profileJson = (await profile.json()) as { id?: string; name?: string; message?: string };
    if (!profileJson.id) throw new Error(profileJson.message ?? "Zalo không trả mã định danh");
    return { subject: profileJson.id, email: null, emailVerified: false, name: profileJson.name ?? null };
  }
}
