"use client";

// Khung trang tuyển dụng công khai MAN_HINH_171 (CONG_VIEC_54): không đăng nhập, không có menu mini app.
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSelect } from "ui/components/LanguageSelect";
import { formatNumber } from "ui/lib/format";

export const salaryText = (item: { negotiable: boolean; salaryMin: string | null; salaryMax: string | null }, negotiable: string, unit: string) =>
  item.negotiable || !item.salaryMin || !item.salaryMax ? negotiable : `${formatNumber(item.salaryMin, 0)} – ${formatNumber(item.salaryMax, 0)} ${unit}`;

export function CareersFrame({ children }: { children: ReactNode }) {
  const t = useTranslations("careers");
  return (
    <>
      <header className="thanh-tren">
        <Link className="logo" href="/careers">
          VComm
        </Link>
        <strong>{t("brand")}</strong>
        <span className="gian" />
        <LanguageSelect />
      </header>
      <main className="noi-dung" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
        {children}
      </main>
    </>
  );
}
