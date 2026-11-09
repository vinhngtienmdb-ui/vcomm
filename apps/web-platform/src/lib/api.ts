// Gọi API cùng tên miền: cookie phiên HttpOnly, CSRF token, công ty đang chọn, tự làm mới phiên một lần khi hết hạn.
import type { ErrorBody } from "contracts";

export const companyStorageKey = "vc_company";

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody["error"] | null,
  ) {
    super(body?.message ?? `HTTP ${status}`);
  }
}

function cookieValue(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function selectedCompanyId(): string | null {
  try {
    return localStorage.getItem(companyStorageKey);
  } catch {
    return null;
  }
}

export function rememberCompany(companyId: string): void {
  try {
    localStorage.setItem(companyStorageKey, companyId);
  } catch {
    // Trình duyệt chặn bộ nhớ cục bộ: dùng công ty mặc định.
  }
}

// Gọi khi đăng nhập: công ty đã chọn của người dùng trước không áp dụng cho người dùng mới.
export function forgetCompany(): void {
  try {
    localStorage.removeItem(companyStorageKey);
  } catch {
    // Không có bộ nhớ cục bộ thì không có gì để xóa.
  }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("accept-language", document.documentElement.lang || "vi");
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET") headers.set("x-csrf-token", cookieValue("vc_csrf") ?? "");
  const companyId = selectedCompanyId();
  if (companyId) headers.set("x-company-id", companyId);
  return fetch(`/api/v1${path}`, { ...init, headers, credentials: "same-origin" });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);
  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await send("/auth/refresh", { method: "POST" });
    if (refreshed.ok) response = await send(path, init);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiFailure(response.status, body?.error ?? null);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}
