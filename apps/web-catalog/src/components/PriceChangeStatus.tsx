"use client";

// Nhãn trạng thái phiếu điều chỉnh giá.
import type { PriceChangeStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<PriceChangeStatus, string> = { draft: "trung-tinh", pending: "canh-bao", approved: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" };

export function PriceChangeStatusBadge({ status }: { status: PriceChangeStatus }) {
  const t = useTranslations("priceChanges");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
