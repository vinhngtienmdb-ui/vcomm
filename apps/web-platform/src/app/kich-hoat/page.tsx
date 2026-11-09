"use client";

// MAN_HINH_03 Kích hoạt tài khoản (CHUC_NANG_04; API_11). Liên kết Google, Microsoft có ở lát L6.
import type { ActivationInfoResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { useSubmit } from "@/components/Form";
import { LanguageSelect } from "@/components/LanguageSelect";
import { LoadingView } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";

// Ước lượng độ mạnh: độ dài và số loại ký tự.
function strength(password: string): "weak" | "medium" | "strong" {
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((pattern) => pattern.test(password)).length;
  if (password.length >= 12 && kinds >= 3) return "strong";
  if (password.length >= 10 && kinds >= 2) return "medium";
  return "weak";
}

function Activation() {
  const t = useTranslations("activation");
  const login = useTranslations("login");
  const token = useSearchParams().get("token") ?? "";
  const [info, setInfo] = useState<ActivationInfoResponse | "invalid" | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  useEffect(() => {
    if (!token) {
      setInfo("invalid");
      return;
    }
    apiFetch<ActivationInfoResponse>(`/auth/activation/${encodeURIComponent(token)}`)
      .then(setInfo)
      .catch(() => setInfo("invalid"));
  }, [token]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setMismatch(password !== confirm);
    if (password !== confirm) return;
    void run(async () => {
      await apiFetch("/auth/activation", { method: "POST", body: JSON.stringify({ token, password }) });
      setDone(true);
    });
  }

  if (info === null) return <LoadingView />;
  const level = strength(password);
  return (
    <form className="the-ngoai" onSubmit={submit} noValidate>
      <div className="logo-lon">VComm</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 style={{ fontSize: 20 }}>{t("title")}</h1>
        <LanguageSelect />
      </div>
      {info === "invalid" || (formError && !done) ? (
        <div className="khoi-canh-bao canh-bao" role="alert">
          {info === "invalid" ? t("invalid") : formError}
        </div>
      ) : null}
      {done ? (
        <>
          <div className="khoi-canh-bao thong-tin" role="status">
            {t("done")}
          </div>
          <a className="nut chinh" href="/dang-nhap" style={{ justifyContent: "center" }}>
            {t("toLogin")}
          </a>
        </>
      ) : (
        info !== "invalid" && (
          <>
            <p style={{ margin: 0 }}>
              <strong>{t("greeting", { name: info.fullName })}</strong>
              {info.companyName && <> · {t("company", { company: info.companyName })}</>}
            </p>
            <span className="chu-thich">{t("identifier", { identifier: info.loginIdentifier })}</span>
            <div className="truong">
              <label htmlFor="mat-khau-moi">{t("password")}</label>
              <input id="mat-khau-moi" type="password" autoComplete="new-password" className={inputClass("password")} value={password} onChange={(event) => setPassword(event.target.value)} aria-describedby="mat-khau-goi-y" />
              {fields.password ? (
                <span className="loi-o" role="alert">
                  {fields.password}
                </span>
              ) : (
                <span id="mat-khau-goi-y" className="chu-thich">
                  {t("hint")} {password && t("strength", { level: t(level) })}
                </span>
              )}
            </div>
            <div className="truong">
              <label htmlFor="nhap-lai">{t("confirm")}</label>
              <input id="nhap-lai" type="password" autoComplete="new-password" className={`o-nhap${mismatch ? " loi" : ""}`} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
              {mismatch && <span className="loi-o">{t("mismatch")}</span>}
            </div>
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifyContent: "center" }}>
              {t("submit")}
            </button>
            <div className="phan-cach">{login("or")}</div>
            {(["google", "microsoft"] as const).map((provider) => (
              <button key={provider} type="button" className="nut phu" disabled title={login("notAvailableYet")} style={{ justifyContent: "center" }}>
                {login(provider)}
              </button>
            ))}
          </>
        )
      )}
    </form>
  );
}

export default function ActivationPage() {
  return (
    <main className="trang-ngoai">
      <Suspense fallback={<LoadingView />}>
        <Activation />
      </Suspense>
    </main>
  );
}
