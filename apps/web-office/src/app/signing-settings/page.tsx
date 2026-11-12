"use client";

// MAN_HINH_217 Cài đặt ký số (CHUC_NANG_210; API_241; QUYTAC_NGHIEPVU_454, 456, 461): nhà cung cấp, chữ ký số công ty, chứng thư gốc tin cậy.
import type { SigningSettingsResponse, TrustedRootItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { CertificateDrawer } from "@/components/SigningParts";

export default function SigningSettingsPage() {
  const t = useTranslations("officeSigning");
  const { state, reload } = useApi<SigningSettingsResponse>("/office/signing-settings");
  const [tab, setTab] = useState<"provider" | "seal" | "roots">("provider");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("settingsTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {(["provider", "seal", "roots"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`settingsTab_${item}`)}
          </button>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settings) => (
          <>
            {tab === "provider" && <ProviderForm settings={settings} onSaved={() => void reload()} key={settings.version ?? 0} />}
            {tab === "seal" && <SealPanel settings={settings} onSaved={() => void reload()} />}
            {tab === "roots" && <TrustedRoots canManage={settings.canManageRoots} />}
          </>
        )}
      </Loaded>
    </>
  );
}

function ProviderForm({ settings, onSaved }: { settings: SigningSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("officeSigning");
  const { notify } = useAdmin();
  const [environment, setEnvironment] = useState<"test" | "production">(settings.environment ?? "test");
  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const disabled = !settings.canManage;
  return (
    <div className="the">
      {!settings.simulatorAllowed && <div className="khoi-canh-bao canh-bao">{t("simulatorProductionBlocked")}</div>}
      <div className="khoi-canh-bao canh-bao">{t("simulatorNotLegal")}</div>
      <Field id="nha-cung-cap" label={t("provider")}>
        <select id="nha-cung-cap" className="o-nhap" value="simulator" disabled={disabled} onChange={() => undefined}>
          <option value="simulator">{t("provider_simulator")}</option>
        </select>
      </Field>
      <Field id="moi-truong" label={t("environment")} error={fields.environment}>
        <select id="moi-truong" className={inputClass("environment")} value={environment} disabled={disabled} onChange={(event) => setEnvironment(event.target.value as "test" | "production")}>
          <option value="test">{t("environment_test")}</option>
          <option value="production">{t("environment_production")}</option>
        </select>
      </Field>
      <Field id="ma-ket-noi" label={t("connectionId")} hint={settings.hasCredentials ? t("credentialsSaved") : undefined}>
        <input id="ma-ket-noi" className="o-nhap" autoComplete="off" value={appId} disabled={disabled} onChange={(event) => setAppId(event.target.value)} />
      </Field>
      <Field id="khoa-ket-noi" label={t("connectionSecret")} hint={settings.hasCredentials ? t("credentialsSaved") : undefined}>
        <input id="khoa-ket-noi" type="password" className="o-nhap" autoComplete="new-password" value={secret} disabled={disabled} onChange={(event) => setSecret(event.target.value)} />
      </Field>
      <FormError text={formError} />
      {!disabled && (
        <div className="nhom-nut">
          {settings.configured && (
            <button
              type="button"
              className={`nut phu${testing ? " dang-xu-ly" : ""}`}
              disabled={testing}
              onClick={() => {
                setTesting(true);
                apiFetch("/office/signing-settings/test", { method: "POST" })
                  .then(() => notify(t("connectionOk")))
                  .catch((error) => notify(failureOf(error).message, "loi"))
                  .finally(() => setTesting(false));
              }}
            >
              {t("testConnection")}
            </button>
          )}
          <button
            type="button"
            className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
            disabled={submitting}
            onClick={() =>
              void run(async () => {
                const credentials = appId || secret ? { appId, secret } : null;
                await apiFetch("/office/signing-settings", {
                  method: "PUT",
                  body: JSON.stringify({ provider: "simulator", environment, credentials, ...(settings.version ? { version: settings.version } : {}) }),
                });
                notify(t("settingsSaved"));
                onSaved();
              })
            }
          >
            {t("save")}
          </button>
        </div>
      )}
    </div>
  );
}

function SealPanel({ settings, onSaved }: { settings: SigningSettingsResponse; onSaved: () => void }) {
  const t = useTranslations("officeSigning");
  const [open, setOpen] = useState(false);
  if (!settings.configured) return <MessageView text={t("providerNotConfigured")} />;
  return (
    <div className="the">
      <p className="chu-thich">{t("sealHint", { taxCode: settings.companyTaxCode ?? "—" })}</p>
      {settings.seal ? (
        <dl className="thong-tin-dong">
          <dt>{t("certificate")}</dt>
          <dd>{settings.seal.subjectName}</dd>
          <dt>{t("identityCodeOrganization")}</dt>
          <dd>{settings.seal.identityCode}</dd>
          <dt>{t("validity")}</dt>
          <dd>
            {formatDate(settings.seal.validFrom.slice(0, 10))} – {formatDate(settings.seal.validTo.slice(0, 10))}
          </dd>
        </dl>
      ) : (
        <div className="khoi-canh-bao canh-bao">{t("sealMissing")}</div>
      )}
      {settings.canManage && (
        <div className="nhom-nut">
          <button type="button" className="nut chinh" onClick={() => setOpen(true)}>
            {settings.seal ? t("sealChange") : t("sealDeclare")}
          </button>
        </div>
      )}
      {open && (
        <CertificateDrawer
          title={t("settingsTab_seal")}
          identityLabel={t("identityCodeOrganization")}
          listPath="/office/signing-settings/seal-certificates"
          selectPath="/office/signing-settings/seal"
          initialCode={settings.seal?.identityCode ?? settings.companyTaxCode ?? ""}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      )}
    </div>
  );
}

function TrustedRoots({ canManage }: { canManage: boolean }) {
  const t = useTranslations("officeSigning");
  const { notify } = useAdmin();
  const { state, reload } = useApi<TrustedRootItem[]>("/office/trusted-roots");
  const [file, setFile] = useState<File | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const headings = [t("certificate"), t("fingerprint"), t("validity"), t("statusLabel"), ""];
  const setStatus = (id: string, status: "active" | "inactive") =>
    void apiFetch(`/office/trusted-roots/${id}`, { method: "PATCH", body: JSON.stringify({ status }) })
      .then(() => reload())
      .catch((error) => notify(failureOf(error).message, "loi"));
  return (
    <div className="the">
      <p className="chu-thich">{t("rootsHint")}</p>
      {canManage && (
        <>
          <Field id="tep-goc" label={t("rootFile")} error={fields.file}>
            <input id="tep-goc" type="file" accept=".pem,.cer,.crt,.der" className={inputClass("file")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </Field>
          <FormError text={formError} />
          <div className="nhom-nut">
            <button
              type="button"
              className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
              disabled={!file || submitting}
              onClick={() =>
                void run(async () => {
                  const form = new FormData();
                  form.append("file", file!);
                  await apiUpload("/office/trusted-roots", form);
                  notify(t("rootAdded"));
                  await reload();
                })
              }
            >
              {t("rootAdd")}
            </button>
          </div>
        </>
      )}
      <Loaded state={state} onRetry={() => void reload()}>
        {(roots) =>
          roots.length === 0 ? (
            <MessageView text={t("noRoots")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roots.map((root) => (
                    <tr key={root.id}>
                      <td data-nhan={headings[0]}>
                        <span>{root.subjectName}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{root.fingerprint.slice(0, 16)}…</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          {formatDate(root.validFrom.slice(0, 10))} – {formatDate(root.validTo.slice(0, 10))}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span className={`nhan ${root.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`rootStatus_${root.status}`)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {canManage && (
                            <button type="button" className="nut phu" onClick={() => setStatus(root.id, root.status === "active" ? "inactive" : "active")}>
                              {root.status === "active" ? t("rootDeactivate") : t("rootActivate")}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </div>
  );
}
