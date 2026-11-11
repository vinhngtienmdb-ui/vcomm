"use client";

// Nhãn trạng thái bút toán (MAN_HINH_51).
import type { JournalStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<JournalStatus, string> = { draft: "trung-tinh", pending: "canh-bao", posted: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" };

export function JournalStatusBadge({ status }: { status: JournalStatus }) {
  const t = useTranslations("ledger");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}
