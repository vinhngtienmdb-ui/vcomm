"use client";

// Tải dữ liệu một lần và tải lại khi cần; phân biệt chưa đăng nhập, không có quyền, không tìm thấy, lỗi.
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiFailure } from "./api";

export type Loadable<T> = { kind: "loading" } | { kind: "forbidden" } | { kind: "notFound" } | { kind: "error" } | { kind: "ready"; data: T };

export function useApi<T>(path: string | null): { state: Loadable<T>; reload: () => Promise<void> } {
  const [state, setState] = useState<Loadable<T>>({ kind: "loading" });
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setState({ kind: "ready", data: await apiFetch<T>(path) });
    } catch (error) {
      const status = error instanceof ApiFailure ? error.status : 0;
      // Đường dẫn tuyệt đối: trang đăng nhập thuộc mini app Nền tảng, mini app khác có tiền tố đường dẫn riêng.
      if (status === 401) window.location.replace(error instanceof ApiFailure && error.body?.code === "MFA_REQUIRED" ? "/xac-thuc" : "/dang-nhap");
      else setState({ kind: status === 403 ? "forbidden" : status === 404 ? "notFound" : "error" });
    }
  }, [path]);
  useEffect(() => {
    setState({ kind: "loading" });
    void reload();
  }, [reload]);
  return { state, reload };
}

// Lỗi trả về khi gửi biểu mẫu: thông báo chung và lỗi theo trường.
export function failureOf(error: unknown): { message: string; fields: Record<string, string> } {
  const body = error instanceof ApiFailure ? error.body : null;
  return { message: body?.message ?? (error as Error).message, fields: body?.fields ?? {} };
}
