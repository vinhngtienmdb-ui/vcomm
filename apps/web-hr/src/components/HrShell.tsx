"use client";

// Khung mini app Nhân sự: menu MAN_HINH_114, 117, 119 (CONG_VIEC_46), MAN_HINH_121, 120 (CONG_VIEC_47). "Hồ sơ của tôi" mở cho mọi nhân viên (quyền platform.access).
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const hrMenu = [
  { href: "/employees", key: "employees", permission: "hr.employee.view" },
  { href: "/contracts", key: "contracts", permission: "hr.employee.view" },
  { href: "/attendance", key: "attendance", permission: "hr.attendance.view" },
  { href: "/work-schedules", key: "attendanceSetup", permission: "hr.attendance.view" },
  { href: "/leave", key: "leave", permission: "hr.attendance.view" },
  { href: "/my-attendance", key: "myAttendance", permission: "platform.access" },
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
