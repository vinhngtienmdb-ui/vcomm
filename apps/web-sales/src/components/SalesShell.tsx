"use client";

// Khung mini app Bán hàng: menu MAN_HINH_42, 43 (CONG_VIEC_08); mục thêm dần theo module.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const salesMenu = [{ href: "/orders", key: "orders", permission: "sales.order.view" }] as const;

export function SalesShell({ children }: { children: ReactNode }) {
  const t = useTranslations("salesMenu");
  return (
    <AppShell title={t("title")} menu={salesMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
