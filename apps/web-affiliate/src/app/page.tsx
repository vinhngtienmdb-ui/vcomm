"use client";

// Trang đầu cổng cửa hàng: chủ cửa hàng vào Cửa hàng của tôi; thu ngân vào quầy (thêm ở lát L1).
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePortal } from "@/components/PortalShell";

export default function PortalHome() {
  const t = useTranslations("merchantPortal");
  const { membership } = usePortal();
  return (
    <>
      <h1>{membership.merchantName}</h1>
      <p>{t("welcome", { role: t(`role_${membership.role}`) })}</p>
      {membership.role === "owner" && (
        <p>
          <Link href="/store">{t("menu_store")}</Link>
        </p>
      )}
    </>
  );
}
