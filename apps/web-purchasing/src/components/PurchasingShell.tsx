"use client";

// Khung mini app Mua hàng: menu MAN_HINH_38 đến MAN_HINH_41 (CONG_VIEC_07), MAN_HINH_204 đến 208 (CONG_VIEC_58); mục thêm dần theo từng lát.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const purchasingMenu = [
  { href: "/orders", key: "orders", permission: "purchasing.order.view" },
  // CONG_VIEC_45: MAN_HINH_110, MAN_HINH_112.
  { href: "/import-declarations", key: "importDeclarations", permission: "purchasing.import.view" },
  { href: "/landed-costs", key: "landedCosts", permission: "purchasing.import.view" },
  { href: "/requisitions", key: "requisitions", permission: "purchasing.requisition.create" },
  { href: "/supplier-prices", key: "supplierPrices", permission: "purchasing.access" },
  // CONG_VIEC_58: ngân sách mua (MAN_HINH_204 đến 208).
  { href: "/budget-plans", key: "budgetPlans", permission: "purchasing.budget.view" },
  { href: "/open-to-buy", key: "openToBuy", permission: "purchasing.budget.view" },
  { href: "/budget-adjustments", key: "budgetAdjustments", permission: "purchasing.budget.view" },
] as const;

export function PurchasingShell({ children }: { children: ReactNode }) {
  const t = useTranslations("purchasingMenu");
  return (
    <AppShell title={t("title")} menu={purchasingMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
