"use client";

// Khung mini app Khách hàng và Đối tác: menu MAN_HINH_36 (CONG_VIEC_06), MAN_HINH_64 (CONG_VIEC_21), MAN_HINH_79 (CONG_VIEC_23), MAN_HINH_81, MAN_HINH_82 (CONG_VIEC_27), MAN_HINH_86 đến MAN_HINH_89 (CONG_VIEC_24), MAN_HINH_98 (CONG_VIEC_25), MAN_HINH_102 (CONG_VIEC_26), MAN_HINH_146 đến MAN_HINH_150 (CONG_VIEC_51), MAN_HINH_220, MAN_HINH_221 (CONG_VIEC_60), MAN_HINH_137, MAN_HINH_138 (CONG_VIEC_49), MAN_HINH_178 (CONG_VIEC_55); mục thêm dần theo module.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const crmMenu = [
  { href: "/partners", key: "partners", permission: "crm.partner.view" },
  { href: "/buyers", key: "buyers", permission: "marketplace.buyer.view" },
  { href: "/sales-team", key: "salesTeam", permission: "marketplace.buyer.view" },
  { href: "/sales-proposals", key: "salesProposals", permission: "marketplace.buyer.view" },
  { href: "/store-settings", key: "storeSettings", permission: "marketplace.order.view" },
  { href: "/listings", key: "listings", permission: "marketplace.order.view" },
  { href: "/orders", key: "orders", permission: "marketplace.order.view" },
  { href: "/return-requests", key: "returnRequests", permission: "marketplace.order.view" },
  { href: "/refunds", key: "refunds", permission: "marketplace.payment.manage" },
  { href: "/withdrawals", key: "withdrawals", permission: "marketplace.payment.manage" },
  { href: "/loyalty/program", key: "loyaltyProgram", permission: "loyalty.view" },
  { href: "/loyalty/accounts", key: "loyaltyAccounts", permission: "loyalty.view" },
  { href: "/loyalty/adjustments", key: "loyaltyAdjustments", permission: "loyalty.view" },
  { href: "/loyalty/alerts", key: "loyaltyAlerts", permission: "loyalty.view" },
  { href: "/loyalty/liability", key: "loyaltyLiability", permission: "loyalty.view" },
  { href: "/loyalty/fraud-rules", key: "loyaltyFraudRules", permission: "loyalty.view" },
  { href: "/loyalty/fraud-cases", key: "loyaltyFraudCases", permission: "loyalty.view" },
  { href: "/collaborators", key: "collaborators", permission: "marketplace.buyer.view" },
  { href: "/group-buys", key: "groupBuys", permission: "marketplace.order.view" },
  { href: "/community", key: "community", permission: "marketplace.community.manage" },
  { href: "/affiliate/merchants", key: "affiliateMerchants", permission: "affiliate.view" },
  { href: "/affiliate/vouchers", key: "affiliateVouchers", permission: "affiliate.view" },
  { href: "/affiliate/settlements", key: "affiliateSettlements", permission: "affiliate.view" },
] as const;

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
