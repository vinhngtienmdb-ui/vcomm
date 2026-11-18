"use client";

// Gọi API cổng cửa hàng: dùng `apiFetch` chung, thêm cửa hàng đang chọn (header `x-merchant-id`);
// chưa đăng nhập thì về trang đăng nhập của cổng (khác trang đăng nhập nhân viên của mini app Nền tảng).
import { useCallback, useEffect, useRef, useState } from "react";
import { apiDownload, apiFetch, ApiFailure } from "ui/lib/api";
import type { Loadable } from "ui/lib/use-api";

const merchantStorageKey = "vc_merchant";
export const loginPath = "/merchant/dang-nhap";

export function selectedMerchantId(): string | null {
  try {
    return localStorage.getItem(merchantStorageKey);
  } catch {
    return null;
  }
}

export function rememberMerchant(merchantId: string): void {
  try {
    localStorage.setItem(merchantStorageKey, merchantId);
  } catch {
    // Trình duyệt chặn bộ nhớ cục bộ: mỗi lần mở chọn lại cửa hàng.
  }
}

export function portalFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const merchantId = selectedMerchantId();
  if (merchantId) headers.set("x-merchant-id", merchantId);
  return apiFetch<T>(path, { ...init, headers });
}

// Tải hoặc mở tệp (PDF hóa đơn) kèm cửa hàng đang chọn.
export function portalDownload(path: string, fileName: string, open = false): Promise<void> {
  const merchantId = selectedMerchantId();
  return apiDownload(path, fileName, open, merchantId ? { "x-merchant-id": merchantId } : undefined);
}

export function usePortalApi<T>(path: string | null): { state: Loadable<T>; reload: () => Promise<void> } {
  const [state, setState] = useState<Loadable<T>>({ kind: "loading" });
  const latest = useRef(0);
  const reload = useCallback(async () => {
    if (!path) return;
    const call = ++latest.current;
    try {
      const data = await portalFetch<T>(path);
      if (call === latest.current) setState({ kind: "ready", data });
    } catch (error) {
      if (call !== latest.current) return;
      const status = error instanceof ApiFailure ? error.status : 0;
      if (status === 401) window.location.replace(loginPath);
      else setState({ kind: status === 403 ? "forbidden" : status === 404 ? "notFound" : "error" });
    }
  }, [path]);
  useEffect(() => {
    setState({ kind: "loading" });
    void reload();
  }, [reload]);
  return { state, reload };
}

// Tải tệp lên, tải tệp về trên cổng (nhập Excel iPOS): gửi kèm cửa hàng đang chọn, mã chống giả mạo yêu cầu.
function csrfToken(): string {
  return document.cookie.match(/(?:^|;\s*)vc_csrf=([^;]*)/)?.[1] ?? "";
}

export async function portalUpload<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = { "x-csrf-token": csrfToken(), "accept-language": document.documentElement.lang || "vi" };
  const merchantId = selectedMerchantId();
  if (merchantId) headers["x-merchant-id"] = merchantId;
  const response = await fetch(`/api/v1${path}`, { method: "POST", body: form, credentials: "same-origin", headers });
  const payload = (await response.json().catch(() => null)) as (T & { error?: ConstructorParameters<typeof ApiFailure>[1] }) | null;
  if (!response.ok) throw new ApiFailure(response.status, payload?.error ?? null);
  return payload as T;
}

