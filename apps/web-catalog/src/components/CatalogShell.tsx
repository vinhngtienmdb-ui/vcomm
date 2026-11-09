"use client";

// Khung mini app Sản phẩm: menu MAN_HINH_22 đến MAN_HINH_27 (CONG_VIEC_04) trên khung dùng chung.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const catalogMenu = [
  { href: "/products", key: "products", permission: "catalog.product.view" },
  { href: "/categories", key: "categories", permission: "catalog.access" },
  { href: "/price-lists", key: "priceLists", permission: "catalog.price.view" },
  { href: "/price-changes", key: "priceChanges", permission: "catalog.price.view" },
  { href: "/channels", key: "channels", permission: "catalog.price.manage" },
] as const;

export function CatalogShell({ children }: { children: ReactNode }) {
  const t = useTranslations("catalogMenu");
  return (
    <AppShell title={t("title")} menu={catalogMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
