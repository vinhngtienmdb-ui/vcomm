// Gọi API bằng header Authorization; token lưu trong bộ nhớ an toàn của máy (bản web: sessionStorage) (QUYTAC_NGHIEPVU_136).
import type { AppTokens } from "contracts";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { translator } from "./i18n";

const t = translator("salesApp");

export const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const tokenKey = "vcomm.tokens";
const companyKey = "vcomm.company";

async function read(key: string): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.sessionStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
async function write(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value === null) globalThis.sessionStorage?.removeItem(key);
    else globalThis.sessionStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

let tokens: AppTokens | null = null;
let companyId: string | null = null;

export async function loadStoredSession(): Promise<boolean> {
  const stored = await read(tokenKey);
  tokens = stored ? (JSON.parse(stored) as AppTokens) : null;
  companyId = await read(companyKey);
  return tokens !== null;
}
export async function storeTokens(value: AppTokens | null): Promise<void> {
  tokens = value;
  await write(tokenKey, value ? JSON.stringify(value) : null);
}
export async function storeCompany(value: string | null): Promise<void> {
  companyId = value;
  await write(companyKey, value);
}
export const currentCompany = () => companyId;

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

// Token làm mới đổi mới mỗi lần dùng: các yêu cầu cùng lúc chờ chung một lần làm mới.
let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${apiBase}/auth/app/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
      });
      if (!response.ok) {
        await storeTokens(null);
        return false;
      }
      await storeTokens((await response.json()) as AppTokens);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export let onSignedOut: () => void = () => undefined;
export const setSignedOutHandler = (handler: () => void) => {
  onSignedOut = handler;
};

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
    throw new ApiFailure(0, t("offline"), null, {});
  }
  if (response.status === 401 && !retried && tokens && (await refresh())) return api<T>(path, init, true);
  if (response.status === 401 && tokens && retried) {
    await storeTokens(null);
    onSignedOut();
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
    throw new ApiFailure(response.status, payload?.error?.message ?? t("serverError", { status: response.status }), payload?.error?.code ?? null, payload?.error?.fields ?? {});
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
