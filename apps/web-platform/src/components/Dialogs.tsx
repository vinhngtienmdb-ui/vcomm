"use client";

// NganKeo và HopThoaiXacNhan (tài liệu 15): đóng bằng Esc hoặc bấm ra ngoài; ô đầu tiên nhận tiêu điểm.
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useRef } from "react";

function Overlay({ centered, onClose, children }: { centered?: boolean; onClose: () => void; children: ReactNode }) {
  const reference = useRef<HTMLDivElement>(null);
  useEffect(() => {
    reference.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div ref={reference} className={`man-che${centered ? " giua" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      {children}
    </div>
  );
}

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Overlay onClose={onClose}>
      <aside className="ngan-keo" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </aside>
    </Overlay>
  );
}

export function ConfirmDialog({ title, text, confirmLabel, busy, error, onConfirm, onClose }: { title: string; text: string; confirmLabel: string; busy: boolean; error?: string | null; onConfirm: () => void; onClose: () => void }) {
  const t = useTranslations("common");
  return (
    <Overlay centered onClose={onClose}>
      <div className="hop-thoai" role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <p style={{ margin: 0 }}>{text}</p>
        {error && (
          <div className="khoi-canh-bao loi" role="alert">
            {error}
          </div>
        )}
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
