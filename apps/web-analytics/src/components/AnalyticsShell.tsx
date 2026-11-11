"use client";

// Khung mini app Báo cáo quản trị: menu MAN_HINH_140 đến 144 (CONG_VIEC_50), mục báo cáo theo quyền từng nhóm.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const analyticsMenu = [
  { href: "/", key: "overview", permission: "analytics.access" },
  { href: "/sales", key: "sales", permission: "analytics.sales.view" },
  { href: "/inventory", key: "inventory", permission: "analytics.inventory.view" },
  { href: "/debts", key: "debts", permission: "analytics.debt.view" },
  { href: "/commissions", key: "commissions", permission: "analytics.commission.view" },
] as const;

export function AnalyticsShell({ children }: { children: ReactNode }) {
  const t = useTranslations("analyticsMenu");
  return (
    <AppShell title={t("title")} menu={analyticsMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
