"use client";

// MAN_HINH_274 Quên mật khẩu cổng cửa hàng (CONG_VIEC_72; QUYTAC_NGHIEPVU_570; API_324).
// Số điện thoại, mã ứng dụng xác thực (6 số) hoặc mã dự phòng, mật khẩu mới; đặt xong mọi phiên cổng bị đăng xuất.
// Mất cả mật khẩu và ứng dụng xác thực: nhờ người mời đặt lại xác thực.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";

export default function PortalForgotPasswordPage() {
  const t = useTranslations("merchantPortal");
  const [phone, setPhone] = useState("");
  const [proof, setProof] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  // 6 chữ số là mã ứng dụng xác thực; dạng XXXX-XXXX là mã dự phòng.
  const isCode = /^\d{6}$/.test(proof.trim());
  return (
    <main className="trang-ngoai">
      <div className="the-ngoai">
        <div className="logo-lon">{t("brand")}</div>
        <h1 style={{ fontSize: 18, margin: 0 }}>{t("forgotTitle")}</h1>
        {done ? (
          <>
            <div className="khoi-canh-bao thong-tin">{t("forgotDone")}</div>
            <Link className="nut chinh" href="/dang-nhap" style={{ justifyContent: "center" }}>
              {t("backToLogin")}
            </Link>
          </>
        ) : (
          <form
            style={{ display: "grid", gap: "var(--khoang-3)" }}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const body = isCode ? { phone, code: proof.trim(), password } : { phone, backupCode: proof.trim().toUpperCase(), password };
                await apiFetch("/merchant-portal/password-reset", { method: "POST", body: JSON.stringify(body) });
                setDone(true);
              });
            }}
          >
            <Field id="so-dien-thoai" label={t("phone")} error={fields.phone}>
              <input id="so-dien-thoai" className={inputClass("phone")} inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field id="ma-xac-thuc" label={t("forgotCode")} error={fields.code ?? fields.backupCode}>
              <input
                id="ma-xac-thuc"
                className={inputClass(isCode ? "code" : "backupCode")}
                autoComplete="one-time-code"
                maxLength={9}
                value={proof}
                onChange={(event) => setProof(event.target.value)}
              />
            </Field>
            <Field id="mat-khau-moi" label={t("newPassword")} error={fields.password} hint={t("passwordRule")}>
              <input id="mat-khau-moi" type="password" className={inputClass("password")} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <FormError text={formError} />
            <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !phone.trim() || proof.trim().length < 6 || !password}>
              {t("forgotSubmit")}
            </button>
            <span className="chu-thich">{t("forgotNote")}</span>
            <span className="chu-thich">{t("lostAuthenticator")}</span>
            <Link className="nut chu" href="/dang-nhap" style={{ justifySelf: "start", paddingInline: 0 }}>
              {t("backToLogin")}
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
