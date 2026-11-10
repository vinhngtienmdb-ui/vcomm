"use client";

// Nhãn trạng thái đơn bán.
import type { SalesOrderStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<SalesOrderStatus, string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  confirmed: "thong-tin",
  rejected: "loi",
  withdrawn: "trung-tinh",
  delivered: "thanh-cong",
  cancelled: "trung-tinh",
  closed: "trung-tinh",
};

export function SalesStatus({ status }: { status: SalesOrderStatus }) {
  const t = useTranslations("salesOrders");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
