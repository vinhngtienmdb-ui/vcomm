// Gọi API bằng header Authorization; token lưu trong bộ nhớ an toàn của máy (bản web: sessionStorage) (QUYTAC_NGHIEPVU_147).
// Người mua không thuộc công ty nào nên không gửi header X-Company-Id.
import type { AppTokens } from "contracts";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { translator } from "./i18n";

const t = translator("vcommApp");

export const apiBase = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
// Địa chỉ ứng dụng dùng để tạo đường dẫn giới thiệu (QUYTAC_NGHIEPVU_142).
export const appBase = process.env.EXPO_PUBLIC_APP_URL ?? "http://localhost:8083";
const tokenKey = "vcomm.tokens";

export async function read(key: string): Promise<string | null> {
  if (Platform.OS === "web") return globalThis.sessionStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}
export async function write(key: string, value: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (value === null) globalThis.sessionStorage?.removeItem(key);
    else globalThis.sessionStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

// CONG_VIEC_60 (QUYTAC_NGHIEPVU_474): mã cài đặt ứng dụng 128 bit ngẫu nhiên sinh lần mở đầu, lưu trong bộ nhớ an toàn (bản web: localStorage),
// gửi qua tiêu đề X-Device-Id để chống gian lận điểm; máy chủ chỉ lưu mã băm.
const deviceKey = "vcomm.device";
let deviceId: string | null = null;
function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values);
  else for (let index = 0; index < bytes; index += 1) values[index] = Math.floor(Math.random() * 256);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}
async function installationId(): Promise<string> {
  if (deviceId) return deviceId;
  const stored = Platform.OS === "web" ? (globalThis.localStorage?.getItem(deviceKey) ?? null) : await SecureStore.getItemAsync(deviceKey);
  deviceId = stored ?? randomHex(16);
  if (!stored) {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(deviceKey, deviceId);
    else await SecureStore.setItemAsync(deviceKey, deviceId);
  }
  return deviceId;
}

let tokens: AppTokens | null = null;

export async function loadStoredSession(): Promise<boolean> {
  const stored = await read(tokenKey);
  tokens = stored ? (JSON.parse(stored) as AppTokens) : null;
  return tokens !== null;
}
export async function storeTokens(value: AppTokens | null): Promise<void> {
  tokens = value;
  await write(tokenKey, value ? JSON.stringify(value) : null);
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

// Hết phiên: xóa token và đưa người dùng về màn hình đăng nhập.
async function signOut(): Promise<void> {
  await storeTokens(null);
  signedOutHandler();
}

// Kết quả làm mới: "ok"; "expired" khi máy chủ từ chối token (401) thì đăng xuất;
// "temporary" khi mất mạng, bị giới hạn số lần gọi (429) hoặc máy chủ lỗi (5xx) thì giữ token để thử lại sau.
type RefreshOutcome = "ok" | "expired" | "temporary";
// Token làm mới đổi mới mỗi lần dùng: các yêu cầu cùng lúc chờ chung một lần làm mới.
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
  const headers: Record<string, string> = { "accept-language": "vi", "x-device-id": await installationId(), ...(init.headers as Record<string, string> | undefined) };
  if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
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
  // Đăng nhập, đăng ký, quên mật khẩu trả 401 khi sai thông tin, không phải do phiên hết hạn: không làm mới token.
  const publicPath = /^\/(buyer\/(login|register|password-reset)|auth\/app\/)/.test(path);
  if (response.status === 401 && tokens && !publicPath) {
    if (!retried) {
      const outcome = await refresh();
      if (outcome === "ok") return api<T>(path, init, true);
      if (outcome === "temporary") throw new ApiFailure(503, t("temporaryError"), null, {});
    } else {
      // Token vừa làm mới vẫn bị từ chối: phiên đã bị thu hồi.
      await signOut();
    }
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null;
    throw new ApiFailure(response.status, payload?.error?.message ?? t("serverError", { status: response.status }), payload?.error?.code ?? null, payload?.error?.fields ?? {});
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

// Đường dẫn ảnh, tệp do API trả về dạng /api/v1/... đổi thành địa chỉ đầy đủ.
export const assetUrl = (path: string | null) => (path ? `${apiBase.replace(/\/api\/v1\/?$/, "")}${path}` : null);

// Header đăng nhập cho ảnh cần quyền (ảnh bài đăng cộng đồng, CONG_VIEC_49).
export const authorizationHeader = (): Record<string, string> => (tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {});
