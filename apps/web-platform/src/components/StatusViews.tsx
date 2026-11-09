"use client";

// Trạng thái chung của màn hình: đang tải, lỗi, không có quyền, không tìm thấy, rỗng (tài liệu 15).
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Loadable } from "@/lib/use-api";

export function LoadingView() {
  return (
    <div className="the" aria-busy="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="xuong" />
      ))}
    </div>
  );
}

export function MessageView({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const t = useTranslations("common");
  return (
    <div className="trang-thai-trong">
      <div className="hinh" />
      <p style={{ margin: 0 }}>{text}</p>
      {onRetry && (
        <button type="button" className="nut phu" onClick={onRetry}>
          {t("retry")}
        </button>
      )}
    </div>
  );
}

// Hiện trạng thái tải; dữ liệu sẵn sàng thì vẽ nội dung.
export function Loaded<T>({ state, onRetry, children }: { state: Loadable<T>; onRetry: () => void; children: (data: T) => ReactNode }) {
  const t = useTranslations("common");
  if (state.kind === "loading") return <LoadingView />;
  if (state.kind === "forbidden") return <MessageView text={t("forbidden")} />;
  if (state.kind === "notFound") return <MessageView text={t("notFound")} />;
  if (state.kind === "error") return <MessageView text={t("loadError")} onRetry={onRetry} />;
  return <>{children(state.data)}</>;
}
