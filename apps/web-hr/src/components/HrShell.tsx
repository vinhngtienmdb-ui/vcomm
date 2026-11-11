"use client";

// Khung mini app Nhân sự: menu MAN_HINH_114, 117, 119 (CONG_VIEC_46). "Hồ sơ của tôi" mở cho mọi nhân viên (quyền platform.access).
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const hrMenu = [
  { href: "/employees", key: "employees", permission: "hr.employee.view" },
  { href: "/contracts", key: "contracts", permission: "hr.employee.view" },
  { href: "/recruitment", key: "recruitment", permission: "hr.recruitment.request" },
  { href: "/candidates", key: "candidates", permission: "hr.recruitment.manage" },
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
