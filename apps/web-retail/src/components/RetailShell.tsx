"use client";

// Khung mini app Bán lẻ (CONG_VIEC_53): menu MAN_HINH_161, 165, 166; mục thêm dần theo lát.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const retailMenu = [
  { href: "/counter", key: "counter", permission: "retail.sale" },
  { href: "/shifts", key: "shifts", permission: "retail.access" },
  { href: "/stores", key: "stores", permission: "retail.setup" },
] as const;

export function RetailShell({ children }: { children: ReactNode }) {
  const t = useTranslations("retailMenu");
  return (
    <AppShell title={t("title")} menu={retailMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
