"use client";

import { useLocale, useTranslations } from "next-intl";

// CHUC_NANG_22: đổi ngôn ngữ, lưu cookie NEXT_LOCALE trong 1 năm.
export function LanguageSelect() {
  const locale = useLocale();
  const t = useTranslations("login");
  return (
    <>
      <label htmlFor="ngon-ngu" className="an-nhan">
        {t("language")}
      </label>
      <select
        id="ngon-ngu"
        className="o-nhap"
        style={{ width: "auto" }}
        value={locale}
        onChange={(event) => {
          document.cookie = `NEXT_LOCALE=${event.target.value}; path=/; max-age=31536000; samesite=lax`;
          window.location.reload();
        }}
      >
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
    </>
  );
}
