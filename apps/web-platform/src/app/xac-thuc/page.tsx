"use client";

// MAN_HINH_02 Xác thực hai lớp (CHUC_NANG_09; API_06, API_07, API_08). Chưa đăng ký thì đăng ký ngay (luồng 2 tài liệu 09).
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Field, FormError, useSubmit } from "@/components/Form";
import { LanguageSelect } from "@/components/LanguageSelect";
import { BackupCodes, MfaEnroll } from "@/components/MfaEnroll";
import { LoadingView } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";

function Verification() {
  const t = useTranslations("mfa");
  const router = useRouter();
  const enrolling = useSearchParams().get("dang-ky") === "1";
  const [useBackup, setUseBackup] = useState(false);
  const [value, setValue] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/auth/mfa/verify", { method: "POST", body: JSON.stringify(useBackup ? { backupCode: value } : { code: value }) });
      router.replace("/");
    });
  }

  async function signOut() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/dang-nhap");
  }

  const field = useBackup ? "backupCode" : "code";
  return (
    <div className="the-ngoai">
      <div className="logo-lon">VComm</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 style={{ fontSize: 20 }}>{enrolling ? t("enrollTitle") : t("title")}</h1>
        <LanguageSelect />
      </div>
      {backupCodes ? (
        <BackupCodes codes={backupCodes} onContinue={() => router.replace("/")} />
      ) : enrolling ? (
        <MfaEnroll onEnrolled={setBackupCodes} />
      ) : (
        <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
          <p style={{ margin: 0 }}>{t("verifyHint")}</p>
          <Field id="ma" label={useBackup ? t("backupCode") : t("code")} error={fields[field]}>
            <input
              id="ma"
              className={inputClass(field)}
              inputMode={useBackup ? "text" : "numeric"}
              autoComplete="one-time-code"
              maxLength={useBackup ? 9 : 6}
              value={value}
              onChange={(event) => setValue(useBackup ? event.target.value.toUpperCase() : event.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <FormError text={formError} />
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !value} style={{ justifyContent: "center" }}>
            {t("submit")}
          </button>
          <button
            type="button"
            className="nut chu"
            style={{ justifySelf: "start" }}
            onClick={() => {
              setUseBackup(!useBackup);
              setValue("");
            }}
          >
            {useBackup ? t("useCode") : t("useBackup")}
          </button>
        </form>
      )}
      <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => void signOut()}>
        {t("logout")}
      </button>
    </div>
  );
}

export default function MfaPage() {
  return (
    <main className="trang-ngoai">
      <Suspense fallback={<LoadingView />}>
        <Verification />
      </Suspense>
    </main>
  );
}
