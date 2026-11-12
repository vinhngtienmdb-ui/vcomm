"use client";

// MAN_HINH_217 Cài đặt ký số (CHUC_NANG_210; API_241; QUYTAC_NGHIEPVU_454, 456, 461): nhà cung cấp, chữ ký số công ty, chứng thư gốc tin cậy.
import type { OfficeContractDirection, OfficeContractOptions, OfficeContractTypeItem, SigningSettingsResponse, TrustedRootItem } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { CertificateDrawer } from "@/components/SigningParts";

export default function SigningSettingsPage() {
  const t = useTranslations("officeSigning");
  const { state, reload } = useApi<SigningSettingsResponse>("/office/signing-settings");
  const [tab, setTab] = useState<"provider" | "seal" | "roots" | "types">("provider");
  // Kho hợp đồng dẫn tới thẳng thẻ Loại hợp đồng bằng ?tab=types.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "types") setTab("types");
  }, []);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("settingsTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {(["provider", "seal", "roots", "types"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`settingsTab_${item}`)}
          </button>
        ))}
      </div>
      {tab === "types" ? (
        <ContractTypes />
      ) : (
        <Loaded state={state} onRetry={() => void reload()}>
          {(settings) => (
            <>
              {tab === "provider" && <ProviderForm settings={settings} onSaved={() => void reload()} key={settings.version ?? 0} />}
              {tab === "seal" && <SealPanel settings={settings} onSaved={() => void reload()} />}
              {tab === "roots" && <TrustedRoots canManage={settings.canManageRoots} />}
            </>
          )}
        </Loaded>
      )}
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

// Thẻ Loại hợp đồng (CHUC_NANG_212; API_247): người có quyền office.contract.manage thêm, sửa, ngừng dùng.
function ContractTypes() {
  const t = useTranslations("officeContracts");
  const { notify } = useAdmin();
  const options = useApi<OfficeContractOptions>("/office/contract-options");
  const { state, reload } = useApi<OfficeContractTypeItem[]>("/office/contract-types");
  const [editing, setEditing] = useState<OfficeContractTypeItem | "new" | null>(null);
  const headings = [t("typeName"), t("typeDirection"), t("statusLabel"), ""];
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(data) => (
        <Loaded state={state} onRetry={() => void reload()}>
          {(types) => (
            <div className="the">
              <p className="chu-thich">{t("typesHint")}</p>
              {types.length === 0 ? (
                <MessageView text={t("typesEmpty")} />
              ) : (
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {headings.map((heading) => (
                          <th key={heading} scope="col">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {types.map((type) => (
                        <tr key={type.id}>
                          <td data-nhan={headings[0]}>
                            <span>{type.name}</span>
                          </td>
                          <td data-nhan={headings[1]}>
                            <span>{t(`direction_${type.direction}`)}</span>
                          </td>
                          <td data-nhan={headings[2]}>
                            <span className={`nhan ${type.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`typeStatus_${type.status}`)}</span>
                          </td>
                          <td data-nhan={headings[3]}>
                            {data.canManage && (
                              <button type="button" className="nut phu" onClick={() => setEditing(type)}>
                                {t("edit")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.canManage && (
                <div className="nhom-nut">
                  <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
                    {t("addType")}
                  </button>
                </div>
              )}
              {editing && (
                <TypeDrawer
                  type={editing === "new" ? null : editing}
                  onClose={() => setEditing(null)}
                  onSaved={() => {
                    notify(t("typeSaved"));
                    setEditing(null);
                    void reload();
                  }}
                />
              )}
            </div>
          )}
        </Loaded>
      )}
    </Loaded>
  );
}

function TypeDrawer({ type, onClose, onSaved }: { type: OfficeContractTypeItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("officeContracts");
  const [name, setName] = useState(type?.name ?? "");
  const [direction, setDirection] = useState<OfficeContractDirection>(type?.direction ?? "none");
  const [status, setStatus] = useState<"active" | "inactive">(type?.status ?? "active");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  return (
    <Drawer title={type ? t("editType") : t("addType")} onClose={onClose}>
      <Field id="ten-loai-hd" label={t("typeName")} error={fields.name}>
        <input id="ten-loai-hd" className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field id="chieu-loai-hd" label={t("typeDirection")} hint={t("typeDirectionHint")}>
        <select id="chieu-loai-hd" className="o-nhap" value={direction} onChange={(event) => setDirection(event.target.value as OfficeContractDirection)}>
          {(["purchase", "sale", "none"] as const).map((item) => (
            <option key={item} value={item}>
              {t(`direction_${item}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field id="trang-thai-loai-hd" label={t("statusLabel")}>
        <select id="trang-thai-loai-hd" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
          <option value="active">{t("typeStatus_active")}</option>
          <option value="inactive">{t("typeStatus_inactive")}</option>
        </select>
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
        <button type="button" className="nut phu" onClick={onClose}>
          {t("close")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting}
          onClick={() =>
            void run(async () => {
              await apiFetch(type ? `/office/contract-types/${type.id}` : "/office/contract-types", { method: type ? "PUT" : "POST", body: JSON.stringify({ name, direction, status }) });
              onSaved();
            })
          }
        >
          {t("save")}
        </button>
      </div>
    </Drawer>
  );
}
