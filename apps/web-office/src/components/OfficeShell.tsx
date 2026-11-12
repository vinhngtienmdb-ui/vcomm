"use client";

// Khung mini app Văn phòng số: menu MAN_HINH_153 đến 160 (CONG_VIEC_52), MAN_HINH_210, 214, 217 (CONG_VIEC_59); mục thêm dần theo lát.
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const officeMenu = [
  { href: "/tasks", key: "tasks", permission: "office.access" },
  { href: "/workflow-runs", key: "workflowRuns", permission: "office.access" },
  { href: "/incoming", key: "incoming", permission: "office.access" },
  { href: "/outgoing", key: "outgoing", permission: "office.access" },
  { href: "/bulletin", key: "bulletin", permission: "office.access" },
  { href: "/signing", key: "signing", permission: "office.access" },
  { href: "/signature-check", key: "signatureCheck", permission: "office.signing.use" },
  { href: "/workflow-templates", key: "workflowTemplates", permission: "office.workflow.manage" },
  { href: "/settings", key: "documentSettings", permission: "office.document.clerk" },
  { href: "/signing-settings", key: "signingSettings", permission: "office.signing.manage" },
] as const;

export function OfficeShell({ children }: { children: ReactNode }) {
  const t = useTranslations("officeMenu");
  // Trang ký của đối tác (MAN_HINH_213) không đăng nhập: không dùng khung mini app.
  if (usePathname().startsWith("/sign/")) return <>{children}</>;
  return (
    <AppShell title={t("title")} menu={officeMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
