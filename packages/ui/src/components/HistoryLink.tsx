"use client";

// Nút "Lịch sử" ở MAN_HINH_09 đến MAN_HINH_17: mở MAN_HINH_18 lọc theo loại đối tượng hoặc một đối tượng.
import { useTranslations } from "next-intl";
import { useAdmin } from "./AppShell";

export function HistoryLink({ entityType, entityId }: { entityType?: string; entityId?: string }) {
  const t = useTranslations("audit");
  const { can } = useAdmin();
  if (!can("platform.audit.view")) return null;
  const parameters = new URLSearchParams();
  if (entityType) parameters.set("entityType", entityType);
  if (entityId) parameters.set("entityId", entityId);
  return (
    // Thẻ a thường: nhật ký thao tác nằm ở mini app Nền tảng, có thể khác ứng dụng web đang mở.
    <a className="nut phu" href={`/platform/audit-log?${parameters}`}>
      {t("history")}
    </a>
  );
}
