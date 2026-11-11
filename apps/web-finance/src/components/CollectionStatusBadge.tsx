"use client";

// Nhãn trạng thái bảng đối soát thu hộ (MAN_HINH_60, 61).
import type { CollectionStatementStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<CollectionStatementStatus, string> = { draft: "trung-tinh", pending: "thong-tin", posted: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" };

export function CollectionStatusBadge({ status }: { status: CollectionStatementStatus }) {
  const t = useTranslations("collections");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
