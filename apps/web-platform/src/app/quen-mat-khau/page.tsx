"use client";

// MAN_HINH_04 Quên mật khẩu, đặt lại mật khẩu (CHUC_NANG_06; API_12, API_13).
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { LanguageSelect } from "ui/components/LanguageSelect";
import { LoadingView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";

function Forgot() {
  const t = useTranslations("forgot");
  const activation = useTranslations("activation");
  const token = useSearchParams().get("token");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [done, setDone] = useState<"sent" | "reset" | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (token) {
      setMismatch(password !== confirm);
      if (password !== confirm) return;
      void run(async () => {
        await apiFetch("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
        setDone("reset");
      });
    } else {
      void run(async () => {
        await apiFetch("/auth/password/forgot", { method: "POST", body: JSON.stringify({ identifier }) });
        setDone("sent");
      });
    }
  }

  return (
    <form className="the-ngoai" onSubmit={submit} noValidate>
      <div className="logo-lon">VComm</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h1 style={{ fontSize: 20 }}>{token ? t("resetTitle") : t("title")}</h1>
        <LanguageSelect />
      </div>
      {done ? (
        <div className="khoi-canh-bao thong-tin" role="status">
          {t(done === "sent" ? "sent" : "done")}
        </div>
      ) : token ? (
        <>
          <Field id="mat-khau-moi" label={activation("password")} error={fields.password} hint={activation("hint")}>
            <input id="mat-khau-moi" type="password" autoComplete="new-password" className={inputClass("password")} value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <Field id="nhap-lai" label={activation("confirm")} error={mismatch ? activation("mismatch") : undefined}>
            <input id="nhap-lai" type="password" autoComplete="new-password" className={`o-nhap${mismatch ? " loi" : ""}`} value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </Field>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>{t("hint")}</p>
          <Field id="dinh-danh" label={t("identifier")} error={fields.identifier}>
            <input id="dinh-danh" className={inputClass("identifier")} autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
          </Field>
        </>
      )}
      <FormError text={formError} />
      {!done && (
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} style={{ justifyContent: "center" }}>
          {token ? t("reset") : t("send")}
        </button>
      )}
      <a href="/dang-nhap">{t("back")}</a>
    </form>
  );
}

export default function ForgotPage() {
  return (
    <main className="trang-ngoai">
      <Suspense fallback={<LoadingView />}>
        <Forgot />
      </Suspense>
    </main>
  );
}
