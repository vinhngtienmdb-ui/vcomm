"use client";

// Khung mini app Quản trị hệ thống: menu MAN_HINH_09 đến MAN_HINH_20 (tài liệu 14) trên khung dùng chung.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export { useAdmin } from "ui/components/AppShell";

export const adminMenu = [
  { href: "/platform/companies", key: "companies", permission: "platform.company.manage" },
  { href: "/platform/branches", key: "branches", permission: "platform.branch.manage" },
  { href: "/platform/departments", key: "departments", permission: "platform.department.manage" },
  { href: "/platform/users", key: "users", permission: "platform.user.view" },
  { href: "/platform/roles", key: "roles", permission: "platform.role.manage" },
  { href: "/platform/proposal-templates", key: "proposalTemplates", permission: "platform.proposal_template.manage" },
  { href: "/platform/approval-policies", key: "approvalPolicies", permission: "platform.approval_policy.manage" },
  { href: "/platform/number-sequences", key: "numberSequences", permission: "platform.number_sequence.manage" },
  { href: "/platform/exchange-rates", key: "exchangeRates", permission: "platform.access" },
  { href: "/platform/audit-log", key: "auditLog", permission: "platform.audit.view" },
  { href: "/platform/integrations", key: "integrations", permission: "platform.integration.manage" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("menu");
  return (
    <AppShell title={t("title")} menu={adminMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
