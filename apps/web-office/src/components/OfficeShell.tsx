"use client";

// Khung mini app Văn phòng số: menu MAN_HINH_153 đến 160 (CONG_VIEC_52); mục thêm dần theo lát.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const officeMenu = [
  { href: "/tasks", key: "tasks", permission: "office.access" },
  { href: "/workflow-runs", key: "workflowRuns", permission: "office.access" },
  { href: "/workflow-templates", key: "workflowTemplates", permission: "office.workflow.manage" },
] as const;

export function OfficeShell({ children }: { children: ReactNode }) {
  const t = useTranslations("officeMenu");
  return (
    <AppShell title={t("title")} menu={officeMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
