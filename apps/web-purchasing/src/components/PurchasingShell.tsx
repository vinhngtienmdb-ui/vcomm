"use client";

// Khung mini app Mua hàng: menu MAN_HINH_38 đến MAN_HINH_41 (CONG_VIEC_07); mục thêm dần theo từng lát.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const purchasingMenu = [
  { href: "/orders", key: "orders", permission: "purchasing.order.view" },
  { href: "/requisitions", key: "requisitions", permission: "purchasing.requisition.create" },
  { href: "/supplier-prices", key: "supplierPrices", permission: "purchasing.access" },
] as const;

export function PurchasingShell({ children }: { children: ReactNode }) {
  const t = useTranslations("purchasingMenu");
  return (
    <AppShell title={t("title")} menu={purchasingMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
