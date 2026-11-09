"use client";

// Đăng ký ứng dụng xác thực: mã QR, mã nhập tay, xác nhận mã, hiện 10 mã dự phòng (MAN_HINH_02, MAN_HINH_06).
import type { MfaBackupCodesResponse, MfaEnrollResponse } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { type FormEvent, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { failureOf } from "@/lib/use-api";
import { Field, FormError, useSubmit } from "./Form";
import { LoadingView } from "./StatusViews";

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(5, 8);
}

export function BackupCodes({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const t = useTranslations("mfa");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`VComm – ${t("backupTitle")}\n\n${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ma_du_phong_vcomm.txt";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <h2 style={{ fontSize: 18 }}>{t("backupTitle")}</h2>
      <div className="khoi-canh-bao canh-bao">{t("backupHint")}</div>
      <ol style={{ margin: 0, paddingLeft: 24, columns: 2, fontFamily: "ui-monospace, monospace", fontSize: 15, lineHeight: "28px" }}>
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={download}>
          {t("download")}
        </button>
        <button type="button" className="nut chinh" onClick={onContinue}>
          {t("continue")}
        </button>
      </div>
    </>
  );
}

export function MfaEnroll({ onEnrolled }: { onEnrolled: (codes: string[]) => void }) {
  const t = useTranslations("mfa");
  const [enrollment, setEnrollment] = useState<MfaEnrollResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  useEffect(() => {
    apiFetch<MfaEnrollResponse>("/auth/mfa/enroll", { method: "POST" })
      .then(setEnrollment)
      .catch((error) => setLoadError(failureOf(error).message));
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const result = await apiFetch<MfaBackupCodesResponse>("/auth/mfa/enroll/confirm", { method: "POST", body: JSON.stringify({ code }) });
      onEnrolled(result.backupCodes);
    });
  }

  if (loadError) return <FormError text={loadError} />;
  if (!enrollment) return <LoadingView />;
  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <p style={{ margin: 0 }}>{t("enrollHint")}</p>
      <img src={qrDataUrl(enrollment.otpauthUrl)} alt={t("enrollTitle")} width={200} height={200} style={{ justifySelf: "center", imageRendering: "pixelated" }} />
      <span className="chu-thich">{t("manual")}</span>
      <code style={{ wordBreak: "break-all", fontSize: 15, letterSpacing: 1 }}>{enrollment.secretForManualEntry.replace(/(.{4})/g, "$1 ").trim()}</code>
      <Field id="ma-xac-nhan" label={t("code")} error={fields.code}>
        <input id="ma-xac-nhan" className={inputClass("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
      </Field>
      <FormError text={formError} />
      <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || code.length !== 6} style={{ justifyContent: "center" }}>
        {t("submit")}
      </button>
    </form>
  );
}
