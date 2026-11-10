"use client";

// Nhãn trạng thái phiếu giao khách (MAN_HINH_64, 65).
import type { CustomerAssignmentStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<CustomerAssignmentStatus, string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  applied: "thanh-cong",
  rejected: "nguy-hiem",
  withdrawn: "trung-tinh",
};

export function AssignmentStatusBadge({ status }: { status: CustomerAssignmentStatus }) {
  const t = useTranslations("customerAssignments");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
