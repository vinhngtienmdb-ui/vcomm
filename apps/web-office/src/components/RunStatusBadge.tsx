"use client";

// Nhãn trạng thái phiên quy trình.
import type { WorkflowRunStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<WorkflowRunStatus, string> = { running: "thong-tin", blocked: "loi", completed: "thanh-cong", cancelled: "trung-tinh" };

export function RunStatusBadge({ status }: { status: WorkflowRunStatus }) {
  const t = useTranslations("officeWorkflows");
  return <span className={`nhan ${tone[status]}`}>{t(`runStatus_${status}`)}</span>;
}
