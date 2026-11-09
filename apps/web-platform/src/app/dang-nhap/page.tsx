"use client";

// MAN_HINH_01 Đăng nhập (CHUC_NANG_06, 07, 08, 24): mật khẩu, mã OTP qua số điện thoại, Google, Microsoft, Zalo.
import type { AuthMethodsResponse, LoginResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useState } from "react";
import { LanguageSelect } from "ui/components/LanguageSelect";
import { apiFetch, ApiFailure, forgetCompany } from "ui/lib/api";

const providers = ["google", "microsoft", "zalo"] as const;
// Chờ giữa hai lần gửi mã (MAN_HINH_01); máy chủ còn giới hạn 5 lần mỗi giờ.
const resendSeconds = 60;

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const t = useTranslations("login");
  const errors = useTranslations("errors");
  const router = useRouter();
  const search = useSearchParams();
  const [tab, setTab] = useState<"password" | "phone">("password");
  const [methods, setMethods] = useState<AuthMethodsResponse | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const returned = search.get("loi");
  const activatedVia = search.get("kichHoat");
  const [formError, setFormError] = useState<string | null>(returned && errors.has(returned as "notFound") ? errors(returned as "notFound") : null);

  useEffect(() => {
    apiFetch<AuthMethodsResponse>("/auth/methods")
      .then(setMethods)
      .catch(() => setMethods({ password: true, phone: false, google: false, microsoft: false, zalo: false }));
  }, []);

  async function attempt(action: () => Promise<void>) {
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await action();
    } catch (error) {
      const failure = error instanceof ApiFailure ? error.body : null;
      if (failure?.fields) setFieldErrors(failure.fields);
      else setFormError(failure?.message ?? (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Cần xác thực hai lớp: nhập mã, hoặc đăng ký ngay nếu chưa có (luồng 2 tài liệu 09).
  function signedIn(result: LoginResponse) {
    forgetCompany();
    router.replace(result.mfaRequired ? (result.mfaEnrolled ? "/xac-thuc" : "/xac-thuc?dang-ky=1") : "/");
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    void attempt(async () => signedIn(await apiFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password }) })));
  }

  async function sendCode() {
    await apiFetch("/auth/otp/send", { method: "POST", body: JSON.stringify({ phone }) });
    setCodeSent(true);
    setResendIn(resendSeconds);
  }

  function submitPhone(event: FormEvent) {
    event.preventDefault();
    void attempt(async () => {
      if (!codeSent) {
        await sendCode();
        return;
      }
      signedIn(await apiFetch<LoginResponse>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ phone, code }) }));
    });
  }

  const enabledProviders = providers.filter((provider) => methods?.[provider]);
  const errorText = (key: string) => fieldErrors[key] ?? formError;
  return (
    <main className="trang-ngoai">
      <div className="the-ngoai">
        <div className="logo-lon">VComm</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h1 style={{ fontSize: 20 }}>{t("title")}</h1>
          <LanguageSelect />
        </div>
        {activatedVia && (
          <div className="khoi-canh-bao thong-tin" role="status">
            {t("activatedVia", { provider: activatedVia === "microsoft" ? "Microsoft" : "Google" })}
          </div>
        )}
        {methods?.phone && (
          <div className="cac-the" role="tablist">
            {(["password", "phone"] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? "chon" : ""}
                onClick={() => {
                  setTab(key);
                  setFormError(null);
                  setFieldErrors({});
                }}
              >
                {t(key === "password" ? "tabPassword" : "tabPhone")}
              </button>
            ))}
          </div>
        )}
        {tab === "password" ? (
          <form onSubmit={submitPassword} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
            <div className="truong">
              <label htmlFor="identifier">{t("identifier")}</label>
              <input
                id="identifier"
                className={`o-nhap${fieldErrors.identifier ? " loi" : ""}`}
                autoComplete="username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                aria-describedby={fieldErrors.identifier ? "identifier-loi" : undefined}
              />
              {fieldErrors.identifier && (
                <span id="identifier-loi" className="loi-o">
                  {fieldErrors.identifier}
                </span>
              )}
            </div>
            <div className="truong">
              <label htmlFor="password">{t("password")}</label>
              <input
                id="password"
                type="password"
                className={`o-nhap${fieldErrors.password || formError ? " loi" : ""}`}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={fieldErrors.password || formError ? "password-loi" : undefined}
              />
              {errorText("password") && (
                <span id="password-loi" className="loi-o" role="alert">
                  {errorText("password")}
                </span>
              )}
            </div>
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifyContent: "center" }}>
              {t("submit")}
            </button>
            <a href="/quen-mat-khau">{t("forgot")}</a>
          </form>
        ) : (
          <form onSubmit={submitPhone} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
            <div className="truong">
              <label htmlFor="phone">{t("phone")}</label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                className={`o-nhap${fieldErrors.phone ? " loi" : ""}`}
                value={phone}
                disabled={codeSent}
                onChange={(event) => setPhone(event.target.value)}
              />
              {fieldErrors.phone && <span className="loi-o">{fieldErrors.phone}</span>}
            </div>
            {codeSent && (
              <div className="truong">
                <label htmlFor="otp">{t("otp")}</label>
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className={`o-nhap${formError ? " loi" : ""}`}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                />
                <span className="chu-thich">{t("otpSent")}</span>
              </div>
            )}
            {formError && (
              <span className="loi-o" role="alert">
                {formError}
              </span>
            )}
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !phone || (codeSent && code.length !== 6)} style={{ justifyContent: "center" }}>
              {codeSent ? t("submit") : t("sendCode")}
            </button>
            {codeSent && (
              <div className="nhom-nut" style={{ justifyContent: "space-between" }}>
                <button type="button" className="nut chu" disabled={submitting || resendIn > 0} onClick={() => void attempt(sendCode)}>
                  {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
                </button>
                <button
                  type="button"
                  className="nut chu"
                  onClick={() => {
                    setCodeSent(false);
                    setCode("");
                  }}
                >
                  {t("changePhone")}
                </button>
              </div>
            )}
          </form>
        )}
        {enabledProviders.length > 0 && <div className="phan-cach">{t("or")}</div>}
        {enabledProviders.map((provider) => (
          <a key={provider} className="nut phu" href={`/api/v1/auth/oauth/${provider}/start?mode=login`} style={{ justifyContent: "center" }}>
            {t(provider)}
          </a>
        ))}
      </div>
    </main>
  );
}
