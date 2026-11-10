"use client";

// Nhãn trạng thái hóa đơn điện tử (MAN_HINH_54).
import type { EinvoiceStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<EinvoiceStatus, string> = {
  pending: "thong-tin",
  retrying: "canh-bao",
  awaiting_code: "thong-tin",
  issued: "thanh-cong",
  failed: "loi",
  rejected: "loi",
  setup_error: "loi",
};

export function EinvoiceStatusBadge({ status, overdue }: { status: EinvoiceStatus; overdue?: boolean }) {
  const t = useTranslations("einvoices");
  return (
    <span className="nhom-nut">
      <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>
      {overdue && <span className="nhan loi">{t("overdue")}</span>}
    </span>
  );
}
