"use client";

// Khung mini app Nhân sự: menu MAN_HINH_114, 117, 119 (CONG_VIEC_46). "Hồ sơ của tôi" mở cho mọi nhân viên (quyền platform.access).
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const hrMenu = [
  { href: "/employees", key: "employees", permission: "hr.employee.view" },
  { href: "/contracts", key: "contracts", permission: "hr.employee.view" },
  // CONG_VIEC_48: MAN_HINH_131.
  { href: "/payroll-settings", key: "payrollSettings", permission: "hr.payroll.setup" },
  { href: "/me", key: "me", permission: "platform.access" },
] as const;

export function HrShell({ children }: { children: ReactNode }) {
  const t = useTranslations("hrMenu");
  return (
    <AppShell title={t("title")} menu={hrMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
