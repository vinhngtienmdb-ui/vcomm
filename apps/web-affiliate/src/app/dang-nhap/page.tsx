"use client";

// Đăng nhập cổng cửa hàng bằng số điện thoại và mã OTP; kích hoạt lời mời (CONG_VIEC_55; QUYTAC_NGHIEPVU_393; API_02, API_03, API_207).
// Hệ thống chỉ gửi được tin theo mẫu mã OTP đã đăng ký nên lời mời kích hoạt bằng số điện thoại và mã OTP, không có đường dẫn.
// Đăng nhập bằng Zalo sau khi liên kết từ Cửa hàng của tôi (THAY_DOI_01; CONG_VIEC_55 lát L4).
import type { AuthMethodsResponse, LoginResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, forgetCompany } from "ui/lib/api";

type Mode = "login" | "activate";

export default function PortalLoginPage() {
  const t = useTranslations("merchantPortal");
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const errors = useTranslations("errors");
  const [zalo, setZalo] = useState(false);
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<AuthMethodsResponse>("/auth/methods")
      .then((methods) => setZalo(methods.zalo))
      .catch(() => setZalo(false));
    const key = new URLSearchParams(window.location.search).get("loi");
    if (key) setReturned(errors.has(key as "notFound") ? errors(key as "notFound") : errors("oauthFailed"));
  }, [errors]);
  const switchMode = (next: Mode) => {
    setMode(next);
    setCodeSent(false);
    setCode("");
  };
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
        <p className="chu-thich">{t(`loginHint_${mode}`)}</p>
        <form
          style={{ display: "grid", gap: "var(--khoang-3)" }}
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              if (!codeSent) {
                await apiFetch(mode === "login" ? "/auth/otp/send" : "/merchant-portal/activation/otp", { method: "POST", body: JSON.stringify({ phone }) });
                setCodeSent(true);
                return;
              }
              const result = await apiFetch<LoginResponse>(mode === "login" ? "/auth/otp/verify" : "/merchant-portal/activation", { method: "POST", body: JSON.stringify({ phone, code }) });
              forgetCompany();
              // Phiên cần xác thực hai lớp thì hoàn tất ở trang của mini app Nền tảng.
              window.location.replace(result.mfaRequired ? "/xac-thuc" : "/merchant");
            });
          }}
        >
          <Field id="so-dien-thoai" label={t("phone")} error={fields.phone}>
            <input id="so-dien-thoai" className={inputClass("phone")} inputMode="tel" autoComplete="tel" value={phone} disabled={codeSent} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          {codeSent && (
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
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !phone.trim() || (codeSent && code.length !== 6)}>
            {codeSent ? t(mode === "login" ? "signIn" : "activate") : t("sendCode")}
          </button>
          {codeSent && (
            <button type="button" className="nut chu" onClick={() => (setCodeSent(false), setCode(""))}>
              {t("changePhone")}
            </button>
          )}
        </form>
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
