"use client";

// MAN_HINH_06 Hồ sơ cá nhân (CHUC_NANG_10, CHUC_NANG_22; API_15 đến API_18, API_07, API_08). Liên kết Google, Microsoft, Zalo có ở lát L6.
import type { IdentityResponse, MeResponse, MfaBackupCodesResponse, SessionResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ConfirmDialog } from "@/components/Dialogs";
import { Field, FormError, useSubmit } from "@/components/Form";
import { BackupCodes, MfaEnroll } from "@/components/MfaEnroll";
import { Loaded, MessageView } from "@/components/StatusViews";
import { TopBar } from "@/components/TopBar";
import { apiFetch } from "@/lib/api";
import { failureOf, useApi } from "@/lib/use-api";

type Tab = "info" | "login" | "mfa" | "sessions";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { state, reload } = useApi<MeResponse>("/me");
  const [tab, setTab] = useState<Tab>("info");
  const [notice, setNotice] = useState<string | null>(null);
  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: t("tabInfo") },
    { key: "login", label: t("tabLogin") },
    { key: "mfa", label: t("tabMfa") },
    { key: "sessions", label: t("tabSessions") },
  ];
  const done = (text: string) => {
    setNotice(text);
    void reload();
  };

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(me) => (
        <>
          <TopBar me={me} onCompanyChange={() => void reload()} />
          <main className="noi-dung" style={{ maxWidth: 960, margin: "0 auto", width: "100%" }}>
            <div className="tieu-de">
              <h1>{t("title")}</h1>
            </div>
            {notice && (
              <div className="khoi-canh-bao thong-tin" role="status">
                {notice}
              </div>
            )}
            <div className="cac-the" role="tablist">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.key}
                  className={tab === item.key ? "chon" : ""}
                  onClick={() => {
                    setTab(item.key);
                    setNotice(null);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="the">
              {tab === "info" && <InfoTab me={me} onSaved={done} />}
              {tab === "login" && <LoginTab onSaved={done} />}
              {tab === "mfa" && <MfaTab me={me} onChanged={done} />}
              {tab === "sessions" && <SessionsTab onChanged={done} />}
            </div>
          </main>
        </>
      )}
    </Loaded>
  );
}

function InfoTab({ me, onSaved }: { me: MeResponse; onSaved: (text: string) => void }) {
  const t = useTranslations("profile");
  const common = useTranslations("common");
  const [fullName, setFullName] = useState(me.user.fullName);
  const [locale, setLocale] = useState(me.user.locale);
  const [defaultCompanyId, setDefaultCompanyId] = useState(me.companies.find((company) => company.isDefault)?.id ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/me", { method: "PATCH", body: JSON.stringify({ fullName, locale, ...(defaultCompanyId ? { defaultCompanyId } : {}), version: me.user.version }) });
      // Đổi ngôn ngữ thì giao diện đổi ngay (CHUC_NANG_22).
      if (locale !== me.user.locale) {
        document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000; samesite=lax`;
        window.location.reload();
        return;
      }
      onSaved(t("saved"));
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)", maxWidth: 480 }}>
      <Field id="ho-ten" label={t("fullName")} error={fields.fullName}>
        <input id="ho-ten" className={inputClass("fullName")} value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </Field>
      <dl className="thong-tin-dong">
        <dt>{t("email")}</dt>
        <dd>{me.user.email ?? common("none")}</dd>
        <dt>{t("phone")}</dt>
        <dd>{me.user.phone ?? common("none")}</dd>
        <dt>{t("username")}</dt>
        <dd>{me.user.username ?? common("none")}</dd>
      </dl>
      <Field id="ngon-ngu-ho-so" label={t("language")}>
        <select id="ngon-ngu-ho-so" className="o-nhap" value={locale} onChange={(event) => setLocale(event.target.value as "vi" | "en")}>
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </Field>
      {me.companies.length > 1 && (
        <Field id="cong-ty-mac-dinh" label={t("defaultCompany")} error={fields.defaultCompanyId}>
          <select id="cong-ty-mac-dinh" className="o-nhap" value={defaultCompanyId} onChange={(event) => setDefaultCompanyId(event.target.value)}>
            {me.companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.shortName}
              </option>
            ))}
          </select>
        </Field>
      )}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {common("save")}
        </button>
      </div>
    </form>
  );
}

function LoginTab({ onSaved }: { onSaved: (text: string) => void }) {
  const t = useTranslations("profile");
  const activation = useTranslations("activation");
  const identities = useApi<IdentityResponse[]>("/me/identities");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/me/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword("");
      setNewPassword("");
      onSaved(t("passwordChanged"));
    });
  }

  return (
    <>
      <h2>{t("changePassword")}</h2>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)", maxWidth: 480 }}>
        <Field id="mat-khau-hien-tai" label={t("currentPassword")} error={fields.currentPassword}>
          <input id="mat-khau-hien-tai" type="password" autoComplete="current-password" className={inputClass("currentPassword")} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </Field>
        <Field id="mat-khau-moi" label={t("newPassword")} error={fields.newPassword} hint={activation("hint")}>
          <input id="mat-khau-moi" type="password" autoComplete="new-password" className={inputClass("newPassword")} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !currentPassword || !newPassword}>
            {t("changePassword")}
          </button>
        </div>
      </form>
      <h2>{t("identities")}</h2>
      <Loaded state={identities.state} onRetry={() => void identities.reload()}>
        {(list) => (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {list.map((identity) => (
              <li key={identity.id}>
                {t(`provider_${identity.provider}`)}: {identity.subject}
              </li>
            ))}
          </ul>
        )}
      </Loaded>
      <span className="chu-thich">{t("linkLater")}</span>
    </>
  );
}

function MfaTab({ me, onChanged }: { me: MeResponse; onChanged: (text: string) => void }) {
  const t = useTranslations("profile");
  const common = useTranslations("common");
  const [mode, setMode] = useState<"idle" | "enroll" | "disable" | "regenerate">("idle");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  if (codes) return <BackupCodes codes={codes} onContinue={() => { setCodes(null); setMode("idle"); onChanged(t("saved")); }} />;
  if (mode === "enroll") return <MfaEnroll onEnrolled={setCodes} />;

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (mode === "disable") {
        await apiFetch("/me/mfa/disable", { method: "POST", body: JSON.stringify({ code }) });
        setMode("idle");
        onChanged(t("mfaDisabled"));
      } else {
        const result = await apiFetch<MfaBackupCodesResponse>("/me/mfa/backup-codes", { method: "POST", body: JSON.stringify({ code }) });
        setCodes(result.backupCodes);
      }
      setCode("");
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-4)", maxWidth: 520 }}>
      <p style={{ margin: 0 }}>
        <span className={`nhan ${me.user.mfaEnabled ? "thanh-cong" : "trung-tinh"}`}>{me.user.mfaEnabled ? t("mfaOn") : t("mfaOff")}</span>
      </p>
      {me.user.mfaRequired && <div className="khoi-canh-bao thong-tin">{t("mfaMandatory")}</div>}
      <div className="nhom-nut">
        {!me.user.mfaEnabled && (
          <button type="button" className="nut chinh" onClick={() => setMode("enroll")}>
            {t("enable")}
          </button>
        )}
        {me.user.mfaEnabled && (
          <>
            <button type="button" className="nut phu" onClick={() => setMode("regenerate")}>
              {t("regenerate")}
            </button>
            <button type="button" className="nut nguy-hiem" disabled={me.user.mfaRequired} title={me.user.mfaRequired ? t("mfaMandatory") : undefined} onClick={() => setMode("disable")}>
              {t("disable")}
            </button>
          </>
        )}
      </div>
      {(mode === "disable" || mode === "regenerate") && (
        <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <Field id="ma-hien-tai" label={t("codeToConfirm")} error={fields.code}>
            <input id="ma-hien-tai" className={inputClass("code")} inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
          </Field>
          <FormError text={formError} />
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setMode("idle")}>
              {common("cancel")}
            </button>
            <button type="submit" className={`nut ${mode === "disable" ? "nguy-hiem" : "chinh"}${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || code.length !== 6}>
              {mode === "disable" ? t("disable") : t("regenerate")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SessionsTab({ onChanged }: { onChanged: (text: string) => void }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { state, reload } = useApi<SessionResponse[]>("/me/sessions");
  const [revoking, setRevoking] = useState<SessionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    try {
      await apiFetch(`/me/sessions/${revoking.id}`, { method: "DELETE" });
      if (revoking.current) {
        router.replace("/dang-nhap");
        return;
      }
      setRevoking(null);
      onChanged(t("revoked"));
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(sessions) =>
        sessions.length === 0 ? (
          <MessageView text={t("tabSessions")} />
        ) : (
          <div className="khung-bang">
            <table>
              <thead>
                <tr>
                  {[t("device"), t("ip"), t("signedInAt"), ""].map((heading, index) => (
                    <th key={index} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td data-nhan={t("device")}>
                      <span>
                        {describeDevice(session.userAgent)} {session.current && <span className="nhan thanh-cong">{t("thisDevice")}</span>}
                      </span>
                    </td>
                    <td data-nhan={t("ip")}>
                      <span>{session.ip ?? "—"}</span>
                    </td>
                    <td data-nhan={t("signedInAt")}>
                      <span>{new Date(session.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" })}</span>
                    </td>
                    <td data-nhan="">
                      <button
                        type="button"
                        className="nut phu"
                        onClick={() => {
                          setError(null);
                          setRevoking(session);
                        }}
                      >
                        {t("revoke")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {revoking && (
              <ConfirmDialog title={t("revokeTitle")} text={t("revokeConfirm")} confirmLabel={t("revoke")} busy={busy} error={error} onConfirm={() => void revoke()} onClose={() => setRevoking(null)} />
            )}
          </div>
        )
      }
    </Loaded>
  );
}

// Tên thiết bị gọn từ chuỗi User-Agent.
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "—";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent) ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : "Trình duyệt";
  const system = /iPhone|iPad/.test(userAgent) ? "iOS" : /Android/.test(userAgent) ? "Android" : /Windows/.test(userAgent) ? "Windows" : /Mac OS X/.test(userAgent) ? "macOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return system ? `${browser} · ${system}` : browser;
}
