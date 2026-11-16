"use client";

// Nhãn trạng thái giao của đơn mua dropship (CONG_VIEC_62; QUYTAC_NGHIEPVU_500).
import type { DropshipStatus } from "contracts";
import { useTranslations } from "next-intl";

export const dropshipStatuses: DropshipStatus[] = ["awaiting", "shipping", "delivered", "failed", "cancelled"];
const tones: Record<DropshipStatus, string> = { awaiting: "canh-bao", shipping: "thong-tin", delivered: "thanh-cong", failed: "loi", cancelled: "trung-tinh" };

export function DropshipStatusBadge({ status }: { status: DropshipStatus }) {
  const t = useTranslations("dropshipOrders");
  return <span className={`nhan ${tones[status]}`}>{t(`status_${status}`)}</span>;
}
