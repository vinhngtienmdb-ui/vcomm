"use client";

// MAN_HINH_01 Đăng nhập (CHUC_NANG_06; Google, Microsoft, Zalo, số điện thoại ở lát L6).
import type { LoginResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { LanguageSelect } from "@/components/LanguageSelect";
import { apiFetch, ApiFailure, forgetCompany } from "@/lib/api";

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await apiFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) });
      forgetCompany();
      router.replace("/");
    } catch (error) {
      const failure = error instanceof ApiFailure ? error.body : null;
      if (failure?.fields) setFieldErrors(failure.fields);
      else setFormError(failure?.message ?? (error as Error).message);
      setSubmitting(false);
    }
  }

  const notYet = t("notAvailableYet");
  return (
    <main className="trang-ngoai">
      <form className="the-ngoai" onSubmit={submit} noValidate>
        <div className="logo-lon">VComm</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontSize: 20 }}>{t("title")}</h1>
          <LanguageSelect />
        </div>
        <div className="cac-the" role="tablist">
          <button type="button" role="tab" aria-selected="true" className="chon">
            {t("tabPassword")}
          </button>
          <button type="button" role="tab" aria-selected="false" disabled title={notYet}>
            {t("tabPhone")}
          </button>
        </div>
        <div className="truong">
          <label htmlFor="identifier">{t("identifier")}</label>
          <input id="identifier" className={`o-nhap${fieldErrors.identifier ? " loi" : ""}`} autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} aria-describedby={fieldErrors.identifier ? "identifier-loi" : undefined} />
          {fieldErrors.identifier && <span id="identifier-loi" className="loi-o">{fieldErrors.identifier}</span>}
        </div>
        <div className="truong">
          <label htmlFor="password">{t("password")}</label>
          <input id="password" type="password" className={`o-nhap${fieldErrors.password || formError ? " loi" : ""}`} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby={fieldErrors.password || formError ? "password-loi" : undefined} />
          {(fieldErrors.password || formError) && (
            <span id="password-loi" className="loi-o" role="alert">
              {fieldErrors.password ?? formError}
            </span>
          )}
        </div>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifyContent: "center" }}>
          {t("submit")}
        </button>
        <span className="chu-thich" title={notYet}>
          {t("forgot")}
        </span>
        <div className="phan-cach">{t("or")}</div>
        {(["google", "microsoft", "zalo"] as const).map((provider) => (
          <button key={provider} type="button" className="nut phu" disabled title={notYet} style={{ justifyContent: "center" }}>
            {t(provider)}
          </button>
        ))}
      </form>
    </main>
  );
}
