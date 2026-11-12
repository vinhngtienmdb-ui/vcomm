"use client";

// Gọi API cổng cửa hàng: dùng `apiFetch` chung, thêm cửa hàng đang chọn (header `x-merchant-id`);
// chưa đăng nhập thì về trang đăng nhập của cổng (khác trang đăng nhập nhân viên của mini app Nền tảng).
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiFailure } from "ui/lib/api";
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
