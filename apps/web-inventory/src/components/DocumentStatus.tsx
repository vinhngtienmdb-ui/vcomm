"use client";

// Nhãn trạng thái phiếu kho.
import type { StockDocumentStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<StockDocumentStatus, string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  posted: "thanh-cong",
  in_transit: "thong-tin",
  received: "thanh-cong",
  rejected: "loi",
  withdrawn: "trung-tinh",
};

export function DocumentStatusBadge({ status }: { status: StockDocumentStatus }) {
  const t = useTranslations("documents");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
