"use client";

// Nhãn trạng thái, ưu tiên, quá hạn của công việc (tài liệu 15: Nhan).
import type { OfficeTaskPriority, OfficeTaskStatus } from "contracts";
import { useTranslations } from "next-intl";

const statusTone: Record<OfficeTaskStatus, string> = { new: "thong-tin", in_progress: "thong-tin", pending_confirmation: "canh-bao", completed: "thanh-cong", cancelled: "trung-tinh" };

export function TaskStatusBadge({ status, overdue }: { status: OfficeTaskStatus; overdue: boolean }) {
  const t = useTranslations("officeTasks");
  return (
    <>
      <span className={`nhan ${statusTone[status]}`}>{t(`status_${status}`)}</span>
      {overdue && <span className="nhan loi"> {t("overdue")}</span>}
    </>
  );
}

export function PriorityText({ priority }: { priority: OfficeTaskPriority }) {
  const t = useTranslations("officeTasks");
  if (priority === "urgent") return <span className="nhan loi">{t("priority_urgent")}</span>;
  if (priority === "high") return <span className="nhan canh-bao">{t("priority_high")}</span>;
  return <>{t(`priority_${priority}`)}</>;
}
