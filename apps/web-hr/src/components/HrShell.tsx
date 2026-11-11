"use client";

// Khung mini app Nhân sự: menu MAN_HINH_114, 117, 119 (CONG_VIEC_46), MAN_HINH_121, 120, 123, 124, 125, 122 (CONG_VIEC_47). "Hồ sơ của tôi" mở cho mọi nhân viên (quyền platform.access).
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const hrMenu = [
  { href: "/employees", key: "employees", permission: "hr.employee.view" },
  { href: "/contracts", key: "contracts", permission: "hr.employee.view" },
  { href: "/attendance", key: "attendance", permission: "hr.attendance.view" },
  { href: "/work-schedules", key: "attendanceSetup", permission: "hr.attendance.view" },
  { href: "/leave", key: "leave", permission: "hr.attendance.view" },
  { href: "/overtime", key: "overtime", permission: "hr.attendance.view" },
  { href: "/timesheets", key: "timesheets", permission: "hr.attendance.view" },
  { href: "/my-attendance", key: "myAttendance", permission: "platform.access" },
  // CONG_VIEC_48: MAN_HINH_126, MAN_HINH_131.
  { href: "/payrolls", key: "payrolls", permission: "hr.payroll.view" },
  { href: "/payroll-settings", key: "payrollSettings", permission: "hr.payroll.setup" },
  { href: "/recruitment", key: "recruitment", permission: "hr.recruitment.request" },
  { href: "/candidates", key: "candidates", permission: "hr.recruitment.manage" },
  { href: "/interviews", key: "interviews", permission: "platform.access" },
  { href: "/reviews", key: "reviews", permission: "hr.review.manage" },
  { href: "/my-reviews", key: "myReviews", permission: "platform.access" },
  { href: "/me", key: "me", permission: "platform.access" },
] as const;

export function HrShell({ children }: { children: ReactNode }) {
  const t = useTranslations("hrMenu");
  // Trang tuyển dụng công khai (CONG_VIEC_54, MAN_HINH_171) không đăng nhập: không dùng khung mini app.
  if (usePathname().startsWith("/careers")) return <>{children}</>;
  return (
    <AppShell title={t("title")} menu={hrMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
