"use client";

// MAN_HINH_273 Thiết lập bảo mật cổng cửa hàng (CONG_VIEC_72; QUYTAC_NGHIEPVU_570; API_07, API_08, API_324).
// Bước 1 mật khẩu (khi chưa có hoặc vừa bị đặt lại xác thực), bước 2 ứng dụng xác thực (mã QR, khóa nhập tay, mã xác nhận),
// bước 3 lưu 10 mã dự phòng. Tài khoản có sẵn trong thời hạn chuyển đổi có nút "Để sau".
import type { MerchantPortalSecurity, MfaBackupCodesResponse, MfaEnrollResponse } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { useCallback, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { LoadingView, MessageView } from "ui/components/StatusViews";
import { apiFetch, ApiFailure } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";
import { loginPath } from "@/lib/portal-api";

type Step = "password" | "authenticator" | "backup";

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(5, 8);
}

function Steps({ current }: { current: Step }) {
  const t = useTranslations("merchantPortal");
  const order: Step[] = ["password", "authenticator", "backup"];
  return (
    <ol style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", listStyle: "none", margin: 0, padding: 0 }}>
      {order.map((step) => {
        const index = order.indexOf(step);
        const kind = index < order.indexOf(current) ? "thanh-cong" : step === current ? "canh-bao" : "trung-tinh";
        return (
          <li key={step} className={`nhan ${kind}`} aria-current={step === current ? "step" : undefined}>
            {t(`step_${step}`)}
          </li>
        );
      })}
    </ol>
  );
}

function PasswordStep({ onDone }: { onDone: (next: MerchantPortalSecurity) => void }) {
  const t = useTranslations("merchantPortal");
  const [password, setPassword] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  return (
    <form
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => onDone(await apiFetch<MerchantPortalSecurity>("/merchant-portal/security/password", { method: "POST", body: JSON.stringify({ password }) })));
      }}
    >
      <Field id="mat-khau-moi" label={t("newPassword")} error={fields.password} hint={t("passwordRule")}>
        <input id="mat-khau-moi" type="password" className={inputClass("password")} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !password}>
        {t("continue")}
      </button>
    </form>
  );
}

function AuthenticatorStep({ onDone }: { onDone: (codes: string[]) => void }) {
  const t = useTranslations("merchantPortal");
  const [enrollment, setEnrollment] = useState<MfaEnrollResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  useEffect(() => {
    apiFetch<MfaEnrollResponse>("/auth/mfa/enroll", { method: "POST" })
      .then(setEnrollment)
      .catch((error) => setLoadError(failureOf(error).message));
  }, []);
  if (loadError) return <FormError text={loadError} />;
  if (!enrollment) return <LoadingView />;
  return (
    <form
      style={{ display: "grid", gap: "var(--khoang-3)" }}
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => onDone((await apiFetch<MfaBackupCodesResponse>("/auth/mfa/enroll/confirm", { method: "POST", body: JSON.stringify({ code }) })).backupCodes));
      }}
    >
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("authenticatorHint")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-3)", alignItems: "center" }}>
        <img src={qrDataUrl(enrollment.otpauthUrl)} alt={t("step_authenticator")} width={180} height={180} style={{ imageRendering: "pixelated" }} />
        <span className="chu-thich" style={{ flex: "1 1 160px" }}>
          {t("manualKey")}{" "}
          <code style={{ wordBreak: "break-all", letterSpacing: 1 }}>{enrollment.secretForManualEntry.replace(/(.{4})/g, "$1 ").trim()}</code>
        </span>
      </div>
      <Field id="ma-xac-nhan" label={t("authenticatorCode")} error={fields.code}>
        <input id="ma-xac-nhan" className={inputClass("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
      </Field>
      <FormError text={formError} />
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || code.length !== 6}>
        {t("continue")}
      </button>
    </form>
  );
}

function BackupStep({ codes }: { codes: string[] }) {
  const t = useTranslations("merchantPortal");
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([`VComm – ${t("step_backup")}\n\n${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ma_du_phong_cong_cua_hang.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="khoi-canh-bao canh-bao">{t("backupHint")}</div>
      <ol style={{ margin: 0, paddingLeft: "var(--khoang-5)", columns: 2, fontFamily: "ui-monospace, monospace", lineHeight: "28px" }}>
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      {copied && <div className="khoi-canh-bao thong-tin">{t("copied")}</div>}
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={() => void navigator.clipboard?.writeText(codes.join("\n")).then(() => setCopied(true))}>
          {t("copy")}
        </button>
        <button type="button" className="nut phu" onClick={download}>
          {t("downloadCodes")}
        </button>
        <button type="button" className="nut chinh" onClick={() => window.location.replace("/merchant")}>
          {t("enterPortal")}
        </button>
      </div>
    </>
  );
}

export default function PortalSecurityPage() {
  const t = useTranslations("merchantPortal");
  const errors = useTranslations("errors");
  const [security, setSecurity] = useState<MerchantPortalSecurity | null>(null);
  const [failed, setFailed] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const load = useCallback(async () => {
    try {
      const loaded = await apiFetch<MerchantPortalSecurity>("/merchant-portal/security");
      if (loaded.status === "set_up") return window.location.replace("/merchant");
      if (loaded.status === "mfa_pending") return window.location.replace(`${loginPath}?buoc=ma`);
      setSecurity(loaded);
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 401) window.location.replace(loginPath);
      else setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const logout = () =>
    void apiFetch("/auth/logout", { method: "POST" })
      .catch(() => undefined)
      .then(() => window.location.replace(loginPath));

  if (failed) return <MessageView text={errors("internal")} />;
  if (!security) return <LoadingView />;
  const step: Step = codes ? "backup" : security.needsPassword ? "password" : "authenticator";
  return (
    <main className="trang-ngoai">
      <div className="the-ngoai" style={{ width: "min(480px, 100%)" }}>
        <div className="logo-lon">{t("brand")}</div>
        <h1 style={{ fontSize: 18, margin: 0 }}>{security.status === "blocked" ? t("blockedTitle") : t("setupTitle")}</h1>
        {security.status === "blocked" ? (
          <>
            <div className="khoi-canh-bao loi">{errors("merchantPortalSecurityBlocked")}</div>
            <button type="button" className="nut phu" onClick={logout}>
              {t("backToLogin")}
            </button>
          </>
        ) : (
          <>
            <Steps current={step} />
            {security.status === "optional" ? (
              <div className="khoi-canh-bao thong-tin">{t("setupDeadline", { date: formatDate(nextDay(security.transitionEndsOn)), days: security.daysLeft })}</div>
            ) : (
              <p className="chu-thich" style={{ margin: 0 }}>
                {t("setupRequired")}
              </p>
            )}
            {step === "password" && <PasswordStep onDone={setSecurity} />}
            {step === "authenticator" && <AuthenticatorStep onDone={setCodes} />}
            {step === "backup" && codes && <BackupStep codes={codes} />}
            {step !== "backup" && (
              <div className="nhom-nut">
                {security.status === "optional" ? (
                  <button type="button" className="nut chu" onClick={() => window.location.replace("/merchant")}>
                    {t("later")}
                  </button>
                ) : (
                  <button type="button" className="nut chu" onClick={logout}>
                    {t("backToLogin")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// Ngày đầu tiên cổng không còn đăng nhập bằng mã SMS (sau ngày cuối thời hạn).
function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
