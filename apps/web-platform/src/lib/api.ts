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

// Tải tệp lên (multipart): trình duyệt tự đặt content-type kèm ranh giới.
export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { "x-csrf-token": cookieValue("vc_csrf") ?? "", "accept-language": document.documentElement.lang || "vi" };
  const companyId = selectedCompanyId();
  if (companyId) headers["x-company-id"] = companyId;
  const response = await fetch(`/api/v1${path}`, { method: "POST", body: form, credentials: "same-origin", headers });
  const payload = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) throw new ApiFailure(response.status, payload?.error ?? null);
  return payload as T;
}

// Tải tệp về qua fetch để gửi kèm cookie phiên và công ty đang chọn; mở trong thẻ mới khi xem (PDF).
export async function apiDownload(path: string, fileName: string, open = false): Promise<void> {
  const response = await send(path, {});
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiFailure(response.status, body?.error ?? null);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  if (open) link.target = "_blank";
  else link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
