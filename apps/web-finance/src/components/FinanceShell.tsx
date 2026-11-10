"use client";

// Khung mini app Tài chính – Kế toán: menu MAN_HINH_46 đến 49 (CONG_VIEC_13); mục thêm dần theo module.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const financeMenu = [
  { href: "/debts", key: "debts", permission: "finance.debt.view" },
  { href: "/payments", key: "payments", permission: "finance.debt.view" },
  { href: "/funds", key: "funds", permission: "finance.debt.view" },
] as const;

export function FinanceShell({ children }: { children: ReactNode }) {
  const t = useTranslations("financeMenu");
  return (
    <AppShell title={t("title")} menu={financeMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
