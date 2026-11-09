"use client";

// Khung mini app Kho: menu MAN_HINH_28 đến MAN_HINH_35 (CONG_VIEC_05) trên khung dùng chung; mục thêm dần theo từng lát.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const inventoryMenu = [
  { href: "/stock", key: "stock", permission: "inventory.stock.view" },
  { href: "/documents", key: "documents", permission: "inventory.stock.view" },
  { href: "/stocktakes", key: "stocktakes", permission: "inventory.stocktake.manage" },
  { href: "/reservations", key: "reservations", permission: "inventory.access" },
  { href: "/warehouses", key: "warehouses", permission: "inventory.access" },
] as const;

export function InventoryShell({ children }: { children: ReactNode }) {
  const t = useTranslations("inventoryMenu");
  return (
    <AppShell title={t("title")} menu={inventoryMenu.map((item) => ({ href: item.href, label: t(item.key), permission: item.permission }))}>
      {children}
    </AppShell>
  );
}
