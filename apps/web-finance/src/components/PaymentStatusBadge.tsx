"use client";

// Nhãn trạng thái phiếu thu chi (MAN_HINH_49).
import type { PaymentStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<PaymentStatus, string> = { draft: "trung-tinh", pending: "canh-bao", posted: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" };

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations("payments");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
