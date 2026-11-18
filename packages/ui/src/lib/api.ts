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
// Header thêm (ví dụ cửa hàng đang chọn của cổng cửa hàng liên kết).
export async function apiDownload(path: string, fileName: string, open = false, headers?: HeadersInit): Promise<void> {
  const response = await send(path, headers ? { headers } : {});
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

// Gọi API trả dòng sự kiện (text/event-stream, CONG_VIEC_63 API_275): lỗi trước khi bắt đầu dòng ném ApiFailure như apiFetch.
export async function apiStream(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const init: RequestInit = { method: "POST", body: JSON.stringify(body), headers: { accept: "text/event-stream" }, ...(signal ? { signal } : {}) };
  let response = await send(path, init);
  if (response.status === 401) {
    const refreshed = await send("/auth/refresh", { method: "POST" });
    if (refreshed.ok) response = await send(path, init);
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorBody | null;
    throw new ApiFailure(response.status, payload?.error ?? null);
  }
  return response;
}

// Đọc từng sự kiện `event: <loại>` / `data: <JSON>` của dòng trả lời.
export async function readEvents(response: Response, onEvent: (type: string, data: Record<string, unknown>) => void): Promise<void> {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let end = buffer.indexOf("\n\n");
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const type = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      if (type && data) onEvent(type, JSON.parse(data) as Record<string, unknown>);
      end = buffer.indexOf("\n\n");
    }
  }
}
