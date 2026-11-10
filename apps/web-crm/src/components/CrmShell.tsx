"use client";

// Khung mini app Khách hàng và Đối tác: menu MAN_HINH_36 (CONG_VIEC_06); mục thêm dần theo module.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const crmMenu = [{ href: "/partners", key: "partners", permission: "crm.partner.view" }] as const;

export function CrmShell({ children }: { children: ReactNode }) {
  const t = useTranslations("crmMenu");
  return (
    <AppShell
      title={t("title")}
      menu={crmMenu.map((item) => ({
        href: item.href,
        label: t(item.key),
        permission: item.permission,
      }))}
    >
      {children}
    </AppShell>
  );
}
