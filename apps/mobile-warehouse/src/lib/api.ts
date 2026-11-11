// Gọi API bằng header Authorization (không cookie, không CSRF); công ty đang chọn gửi qua X-Company-Id (tài liệu 17 mục 1).
// Token lưu trong bộ nhớ an toàn của máy, không ghi log (QUYTAC_NGHIEPVU_280; tài liệu 22 mục 3).
import type { AppTokens } from "contracts";
import { t } from "./i18n";
import { readValue, writeValue } from "./storage";

export const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const tokenKey = "kho.token";

let tokens: AppTokens | null = null;
let companyId: string | null = null;

export const setCompanyHeader = (value: string | null) => {
  companyId = value;
};

export async function loadStoredSession(): Promise<boolean> {
  const stored = await readValue(tokenKey);
  tokens = stored ? (JSON.parse(stored) as AppTokens) : null;
  return tokens !== null;
}
export async function storeTokens(value: AppTokens | null): Promise<void> {
  tokens = value;
  await writeValue(tokenKey, value ? JSON.stringify(value) : null);
}

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null,
    readonly fields: Record<string, string>,
  ) {
    super(message);
  }
}

let signedOutHandler: () => void = () => undefined;
export const setSignedOutHandler = (handler: () => void) => {
  signedOutHandler = handler;
};

async function signOut(): Promise<void> {
  await storeTokens(null);
  signedOutHandler();
}

// "temporary": mất mạng, máy chủ bận thì giữ token để thử lại; "expired": máy chủ từ chối token thì đăng xuất.
type RefreshOutcome = "ok" | "expired" | "temporary";
let refreshing: Promise<RefreshOutcome> | null = null;
async function refresh(): Promise<RefreshOutcome> {
  if (!tokens) return "expired";
  refreshing ??= (async (): Promise<RefreshOutcome> => {
    try {
      const response = await fetch(`${apiBase}/auth/app/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
      });
      if (response.status === 401) {
        await signOut();
        return "expired";
      }
      if (!response.ok) return "temporary";
      await storeTokens((await response.json()) as AppTokens);
      return "ok";
    } catch {
      return "temporary";
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { "accept-language": "vi", ...(init.headers as Record<string, string> | undefined) };
  if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
  if (companyId) headers["x-company-id"] = companyId;
  let body = init.body;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers, body });
  } catch {
    // Bắt buộc có mạng: báo lỗi, dữ liệu trên màn hình giữ nguyên để gửi lại (QUYTAC_NGHIEPVU_281).
    throw new ApiFailure(0, t("offline"), null, {});
  }
  const publicPath = path.startsWith("/auth/warehouse-app/") || path.startsWith("/auth/app/");
  if (response.status === 401 && tokens && !publicPath) {
    if (!retried) {
      const outcome = await refresh();
      if (outcome === "ok") return api<T>(path, init, true);
      if (outcome === "temporary") throw new ApiFailure(503, t("temporaryError"), null, {});
    } else {
      await signOut();
    }
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
    throw new ApiFailure(response.status, payload?.error?.message ?? t("serverError", { status: response.status }), payload?.error?.code ?? null, payload?.error?.fields ?? {});
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

// Lỗi bất kỳ thành câu thông báo.
export const failureText = (failure: unknown) => (failure instanceof ApiFailure ? failure.message : t("unknownError"));
