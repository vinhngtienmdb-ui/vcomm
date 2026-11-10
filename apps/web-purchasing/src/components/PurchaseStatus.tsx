"use client";

// Nhãn trạng thái đề nghị mua, đơn mua.
import type { PurchaseDocumentStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<PurchaseDocumentStatus, string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  approved: "thong-tin",
  rejected: "loi",
  withdrawn: "trung-tinh",
  received: "thanh-cong",
  closed: "trung-tinh",
};

export function PurchaseStatus({ status }: { status: PurchaseDocumentStatus }) {
  const t = useTranslations("purchasing");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
