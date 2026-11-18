// Gọi API iPOS: khóa thiết bị gửi qua tiêu đề `x-ipos-device`, token phiên qua Authorization (không cookie, không CSRF; tài liệu 17 mục 2zb).
// Khóa thiết bị, token lưu trong bộ nhớ an toàn của máy, không ghi log (QUYTAC_NGHIEPVU_606, 628).
import { iposDeviceHeader, type AppTokens } from "contracts";
import { messages } from "i18n";
import { t } from "./i18n";
import { readValue, writeValue } from "./storage";

export const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const deviceKeyName = "ipos.device";
const tokenKeyName = "ipos.token";

let deviceKey: string | null = null;
let tokens: AppTokens | null = null;

export async function loadStored(): Promise<{ device: boolean; session: boolean }> {
  deviceKey = await readValue(deviceKeyName);
  const stored = await readValue(tokenKeyName);
  tokens = stored ? (JSON.parse(stored) as AppTokens) : null;
  return { device: deviceKey !== null, session: tokens !== null };
}
export async function storeDeviceKey(value: string | null): Promise<void> {
  deviceKey = value;
  await writeValue(deviceKeyName, value);
}
export async function storeTokens(value: AppTokens | null): Promise<void> {
  tokens = value;
  await writeValue(tokenKeyName, value ? JSON.stringify(value) : null);
}

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string>,
  ) {
    super(message);
  }
}

// Phiên hết hạn (12 giờ, bị khóa, bị thu hồi) thì về màn hình đăng nhập; thiết bị bị thu hồi thì về màn hình ghép.
let signedOutHandler: (reason: "session" | "device") => void = () => undefined;
export const setSignedOutHandler = (handler: (reason: "session" | "device") => void) => {
  signedOutHandler = handler;
};

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  if (!tokens) return false;
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${apiBase}/auth/app/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: tokens?.refreshToken }) });
      if (!response.ok) return false;
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

export async function api<T>(path: string, init: Omit<RequestInit, "body"> & { body?: FormData | Blob | URLSearchParams; json?: unknown; withSession?: boolean } = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { "accept-language": "vi", ...(init.headers as Record<string, string> | undefined) };
  if (deviceKey) headers[iposDeviceHeader] = deviceKey;
  const withSession = init.withSession ?? true;
  if (withSession && tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, { ...init, headers, body });
  } catch {
    // Bắt buộc có mạng (QUYTAC_NGHIEPVU_612).
    throw new ApiFailure(0, t("offline"), {});
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
    if (response.status === 401 && payload?.error?.message === messages.vi.errors.iposDeviceUnknown) {
      await storeDeviceKey(null);
      await storeTokens(null);
      signedOutHandler("device");
    } else if (response.status === 401 && withSession && tokens) {
      if (!retried && (await refresh())) return api<T>(path, init, true);
      await storeTokens(null);
      signedOutHandler("session");
    }
    throw new ApiFailure(response.status, payload?.error?.message ?? t("serverError", { status: response.status }), payload?.error?.fields ?? {});
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const failureText = (failure: unknown) => (failure instanceof ApiFailure ? failure.message : t("unknownError"));
