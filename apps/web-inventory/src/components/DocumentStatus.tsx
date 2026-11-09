"use client";

// Nhãn trạng thái phiếu kho.
import type { StockDocumentStatus, StockDocumentType } from "contracts";
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

// Phiếu chuyển kho đã duyệt chưa ghi sổ (chờ kho nguồn xuất) nên có nhãn riêng.
export function DocumentStatusBadge({ status, type }: { status: StockDocumentStatus; type: StockDocumentType }) {
  const t = useTranslations("documents");
  const transferApproved = type === "transfer" && status === "posted";
  return <span className={`nhan ${transferApproved ? "canh-bao" : tone[status]}`}>{transferApproved ? t("status_transfer_posted") : t(`status_${status}`)}</span>;
}
