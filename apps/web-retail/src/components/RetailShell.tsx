"use client";

// Khung mini app Bán lẻ (CONG_VIEC_53): menu MAN_HINH_161, 163, 164, 165, 166; mục thêm dần theo lát.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "ui/components/AppShell";

export const retailMenu = [
  { href: "/counter", key: "counter", permission: "retail.sale" },
  { href: "/sales", key: "sales", permission: "retail.access" },
  { href: "/returns", key: "returns", permission: "retail.return" },
  // CONG_VIEC_57: đơn trực tuyến tại trạm, nhận hàng trả (MAN_HINH_188, 189, 193, 194).
  { href: "/online-orders", key: "onlineOrders", permission: "retail.o2o" },
  { href: "/online-orders/handover", key: "handover", permission: "retail.o2o" },
  { href: "/deliveries", key: "deliveries", permission: "retail.o2o.deliver" },
  { href: "/station-returns", key: "stationReturns", permission: "retail.o2o" },
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
