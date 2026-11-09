"use client";

// ThanhTrenCung (tài liệu 15 mục 6): trang chủ, chọn công ty (CHUC_NANG_11), hộp duyệt, thông báo, đăng xuất.
import type { MeResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, rememberCompany } from "@/lib/api";

export function TopBar({ me, onCompanyChange }: { me: MeResponse; onCompanyChange: () => void }) {
  const t = useTranslations("topBar");
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      router.replace("/dang-nhap");
    }
  }

  return (
    <header className="thanh-tren">
      <a className="logo" href="/">
        VComm
      </a>
      <a href="/">{t("home")}</a>
      <span className="gian" />
      {me.companies.length > 1 ? (
        <>
          <label htmlFor="chon-cong-ty" className="an-nhan">
            {t("company")}
          </label>
          <select
            id="chon-cong-ty"
            value={me.currentCompanyId ?? ""}
            onChange={(event) => {
              rememberCompany(event.target.value);
              onCompanyChange();
            }}
            style={{ background: "rgba(255,255,255,.14)", color: "#fff", border: 0, borderRadius: 999, padding: "4px 12px", font: "inherit", fontSize: 13 }}
          >
            {me.companies.map((company) => (
              <option key={company.id} value={company.id} style={{ color: "#0F172A" }}>
                {company.shortName}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span style={{ fontSize: 13 }}>{me.companies[0]?.shortName}</span>
      )}
      <button type="button" disabled>
        {t("approvals")}
      </button>
      <button type="button" disabled>
        {t("notifications")}
      </button>
      <a href="/ho-so" title={t("profile")} style={{ fontSize: 13 }}>
        {me.user.fullName}
      </a>
      <button type="button" onClick={logout} disabled={loggingOut}>
        {t("logout")}
      </button>
    </header>
  );
}
