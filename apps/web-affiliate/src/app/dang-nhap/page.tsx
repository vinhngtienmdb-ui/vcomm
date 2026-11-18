"use client";

// Đăng nhập cổng cửa hàng (CONG_VIEC_55; CONG_VIEC_72 QUYTAC_NGHIEPVU_570; API_01, API_02, API_03, API_06, API_207, API_324).
// Đăng nhập: số điện thoại, mật khẩu, rồi mã ứng dụng xác thực hoặc mã dự phòng (MAN_HINH_273); Zalo xong cũng nhập mã.
// Trong thời hạn chuyển đổi còn liên kết "Đăng nhập bằng mã SMS" cho tài khoản chưa thiết lập bảo mật.
// Kích hoạt lời mời (hoặc kích hoạt lại sau khi bị đặt lại xác thực) bằng số điện thoại và mã SMS một lần, sau đó thiết lập bảo mật.
import type { AuthMethodsResponse, LoginResponse, MerchantPortalAuthenticationPolicy, MerchantPortalSecurity } from "contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { formatDate } from "ui/lib/format";
import { apiFetch, forgetCompany } from "ui/lib/api";

type Mode = "login" | "activate";

export default function PortalLoginPage() {
  const t = useTranslations("merchantPortal");
  const errors = useTranslations("errors");
  const [mode, setMode] = useState<Mode>("login");
  const [stage, setStage] = useState<"form" | "code">("form");
  const [sms, setSms] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [zalo, setZalo] = useState(false);
  const [policy, setPolicy] = useState<MerchantPortalAuthenticationPolicy | null>(null);
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<AuthMethodsResponse>("/auth/methods")
      .then((methods) => setZalo(methods.zalo))
      .catch(() => setZalo(false));
    apiFetch<MerchantPortalAuthenticationPolicy>("/merchant-portal/authentication-policy")
      .then(setPolicy)
      .catch(() => setPolicy(null));
    const search = new URLSearchParams(window.location.search);
    const key = search.get("loi");
    if (key) setReturned(errors.has(key as "notFound") ? errors(key as "notFound") : errors("oauthFailed"));
    // Zalo đăng nhập xong mà tài khoản đã có ứng dụng xác thực: nhập mã ngay tại đây.
    if (search.get("buoc") === "ma") setStage("code");
  }, [errors]);

  const reset = () => {
    setCodeSent(false);
    setCode("");
    setPassword("");
  };
  const switchMode = (next: Mode) => {
    setMode(next);
    setSms(false);
    setStage("form");
    reset();
  };

  // Có phiên đầy đủ: theo trạng thái bảo mật vào cổng, sang thiết lập, hoặc báo nhờ đặt lại xác thực.
  async function afterSignIn(result?: LoginResponse) {
    forgetCompany();
    if (result?.mfaRequired && result.mfaEnrolled) {
      setStage("code");
      setCode("");
      return;
    }
    const security = await apiFetch<MerchantPortalSecurity>("/merchant-portal/security");
    if (security.status === "set_up") return window.location.replace("/merchant");
    if (security.status === "mfa_pending") return setStage("code");
    if (security.status === "blocked") {
      await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
      setReturned(errors("merchantPortalSecurityBlocked"));
      setStage("form");
      reset();
      return;
    }
    window.location.replace("/merchant/bao-mat");
  }

  if (stage === "code")
    return (
      <main className="trang-ngoai">
        <div className="the-ngoai">
          <div className="logo-lon">{t("brand")}</div>
          <h1 style={{ fontSize: 18, margin: 0 }}>{t("codeTitle")}</h1>
          <p className="chu-thich">{t("codeHint")}</p>
          <form
            style={{ display: "grid", gap: "var(--khoang-3)" }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await apiFetch("/auth/mfa/verify", { method: "POST", body: JSON.stringify(backup ? { backupCode: code } : { code }) });
                await afterSignIn();
              });
            }}
          >
            <Field id="ma-xac-thuc" label={backup ? t("backupCode") : t("authenticatorCode")} error={backup ? fields.backupCode : fields.code}>
              <input
                id="ma-xac-thuc"
                className={inputClass(backup ? "backupCode" : "code")}
                inputMode={backup ? "text" : "numeric"}
                autoComplete="one-time-code"
                maxLength={backup ? 9 : 6}
                value={code}
                onChange={(event) => setCode(backup ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <FormError text={formError} />
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || (backup ? code.trim().length < 8 : code.length !== 6)}>
              {t("verify")}
            </button>
            <button type="button" className="nut chu" onClick={() => (setBackup(!backup), setCode(""))}>
              {backup ? t("useAuthenticator") : t("useBackupCode")}
            </button>
          </form>
          <p className="chu-thich" style={{ margin: 0 }}>
            {t("lostAuthenticator")}
          </p>
          <button
            type="button"
            className="nut phu"
            onClick={() =>
              void apiFetch("/auth/logout", { method: "POST" })
                .catch(() => undefined)
                .then(() => switchMode("login"))
            }
          >
            {t("backToLogin")}
          </button>
        </div>
      </main>
    );

  const usesSms = mode === "activate" || sms;
  return (
    <main className="trang-ngoai">
      <div className="the-ngoai">
        <div className="logo-lon">{t("brand")}</div>
        <div className="cac-the" role="tablist">
          {(["login", "activate"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} className={mode === item ? "chon" : ""} onClick={() => switchMode(item)}>
              {t(`loginMode_${item}`)}
            </button>
          ))}
        </div>
        <p className="chu-thich">{mode === "activate" ? t("loginHint_activate") : sms ? t("smsLoginHint", { date: formatDate(policy?.transitionEndsOn ?? "") }) : t("loginHint_login")}</p>
        <form
          style={{ display: "grid", gap: "var(--khoang-3)" }}
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (!usesSms) {
                const result = await apiFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier: phone, password }) });
                await afterSignIn(result);
                return;
              }
              if (!codeSent) {
                await apiFetch(mode === "login" ? "/auth/otp/send" : "/merchant-portal/activation/otp", {
                  method: "POST",
                  body: JSON.stringify(mode === "login" ? { phone, app: "merchant" } : { phone }),
                });
                setCodeSent(true);
                return;
              }
              const result = await apiFetch<LoginResponse>(mode === "login" ? "/auth/otp/verify" : "/merchant-portal/activation", {
                method: "POST",
                body: JSON.stringify(mode === "login" ? { phone, code, app: "merchant" } : { phone, code }),
              });
              // Kích hoạt khi chưa thiết lập: phiên chỉ dùng cho các bước thiết lập (MAN_HINH_273).
              if (mode === "activate" && result.mfaRequired && !result.mfaEnrolled) {
                forgetCompany();
                window.location.replace("/merchant/bao-mat");
                return;
              }
              await afterSignIn(result);
            });
          }}
        >
          <Field id="so-dien-thoai" label={t("phone")} error={fields.phone ?? fields.identifier}>
            <input id="so-dien-thoai" className={inputClass("phone")} inputMode="tel" autoComplete="tel" value={phone} disabled={codeSent} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          {!usesSms && (
            <Field id="mat-khau" label={t("password")} error={fields.password}>
              <input id="mat-khau" type="password" className={inputClass("password")} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
          )}
          {usesSms && codeSent && (
            <Field id="ma-otp" label={t("otp")} error={fields.code} hint={t("otpHint")}>
              <input
                id="ma-otp"
                className={inputClass("code")}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              />
            </Field>
          )}
          <FormError text={formError ?? returned} />
          <button
            type="submit"
            className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
            disabled={submitting || !phone.trim() || (!usesSms && !password) || (usesSms && codeSent && code.length !== 6)}
          >
            {!usesSms ? t("signIn") : codeSent ? t(mode === "login" ? "signIn" : "activate") : t("sendCode")}
          </button>
          {usesSms && codeSent && (
            <button type="button" className="nut chu" onClick={() => (setCodeSent(false), setCode(""))}>
              {t("changePhone")}
            </button>
          )}
        </form>
        {mode === "login" && (
          <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
            {!sms && (
              <Link className="nut chu" style={{ justifySelf: "start", paddingInline: 0 }} href="/quen-mat-khau">
                {t("forgotPassword")}
              </Link>
            )}
            {(sms || policy?.smsLoginOpen) && (
              <button type="button" className="nut chu" style={{ justifySelf: "start", paddingInline: 0 }} onClick={() => (setSms(!sms), reset())}>
                {sms ? t("passwordLogin") : t("smsLogin")}
              </button>
            )}
          </div>
        )}
        {zalo && mode === "login" && (
          <>
            <p className="chu-thich" style={{ textAlign: "center", margin: 0 }}>
              {t("or")}
            </p>
            <a className="nut phu" href="/api/v1/auth/oauth/zalo/start?mode=login&app=merchant" style={{ justifyContent: "center" }}>
              {t("zaloLogin")}
            </a>
            <p className="chu-thich" style={{ margin: 0 }}>
              {t("zaloHint")}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
