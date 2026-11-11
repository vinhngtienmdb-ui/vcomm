"use client";

// Nhãn trạng thái chương trình khuyến mãi.
import type { PromotionStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<PromotionStatus, string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  active: "thanh-cong",
  rejected: "loi",
  withdrawn: "trung-tinh",
  stopped: "trung-tinh",
};

export function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  const t = useTranslations("promotions");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
