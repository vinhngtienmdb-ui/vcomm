"use client";

// MAN_HINH_275 Xác thực người mua (CONG_VIEC_72; API_323).
import { useTranslations } from "next-intl";
import { AuthenticationCard } from "@/components/AuthenticationCard";

export default function BuyerAuthenticationPage() {
  const t = useTranslations("storeSettings");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("authenticationPageTitle")}</h1>
      </div>
      <AuthenticationCard />
    </>
  );
}
