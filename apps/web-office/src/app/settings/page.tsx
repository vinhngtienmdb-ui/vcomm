"use client";

// MAN_HINH_160 Cài đặt công văn (CHUC_NANG_184; API_190): thể thức, sổ công văn, loại văn bản và chữ viết tắt.
import type { DocumentSettings, DocumentTypeItem, RegisterItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

const tabs = ["format", "registers", "types"] as const;

export default function DocumentSettingsPage() {
  const t = useTranslations("officeDocuments");
  const [tab, setTab] = useState<(typeof tabs)[number]>("format");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("settingsTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {tabs.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
            {t(`settingsTab_${item}`)}
          </button>
        ))}
      </div>
      {tab === "format" && <FormatSettings />}
      {tab === "registers" && <Registers />}
      {tab === "types" && <DocumentTypes />}
    </>
  );
}

function FormatSettings() {
  const { state, reload } = useApi<DocumentSettings>("/office/document-settings");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(settings) => <FormatForm settings={settings} key={settings.version} onSaved={() => void reload()} />}
    </Loaded>
  );
}

function FormatForm({ settings, onSaved }: { settings: DocumentSettings; onSaved: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [form, setForm] = useState({ ...settings, parentOrgName: settings.parentOrgName ?? "" });
  const text = (key: "parentOrgName" | "companyDisplayName" | "companyAbbreviation" | "placeName", maxLength: number) => (
    <Field id={`settings-${key}`} label={t(`settings_${key}`)} error={fields[key]}>
      <input id={`settings-${key}`} className={inputClass(key)} maxLength={maxLength} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
    </Field>
  );
  const margin = (key: "marginTop" | "marginBottom" | "marginLeft" | "marginRight", minimum: number, maximum: number) => (
    <Field id={`settings-${key}`} label={t(`settings_${key}`, { minimum, maximum })} error={fields[key]}>
      <input
        id={`settings-${key}`}
        type="number"
        min={minimum}
        max={maximum}
        className={inputClass(key)}
        value={form[key]}
        onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
      />
    </Field>
  );
  const save = () =>
    run(async () => {
      await apiFetch("/office/document-settings", { method: "PUT", body: JSON.stringify({ ...form, parentOrgName: form.parentOrgName.trim() || null }) });
      notify(common("saved"));
      onSaved();
    });
  return (
    <div className="the">
      <FormError text={formError} />
      <p className="chu-thich">{t("formatHint")}</p>
      {text("parentOrgName", 200)}
      <div className="hai-cot">
        {text("companyDisplayName", 200)}
        {text("companyAbbreviation", 20)}
        {text("placeName", 100)}
        <Field id="settings-font" label={t("settings_fontScheme")}>
          <select id="settings-font" className="o-nhap" value={form.fontScheme} onChange={(event) => setForm({ ...form, fontScheme: Number(event.target.value) as 13 | 14 })}>
            <option value={13}>{t("fontScheme", { size: 13 })}</option>
            <option value={14}>{t("fontScheme", { size: 14 })}</option>
          </select>
        </Field>
        {margin("marginTop", 20, 25)}
        {margin("marginBottom", 20, 25)}
        {margin("marginLeft", 30, 35)}
        {margin("marginRight", 15, 20)}
      </div>
      <div className="nhom-nut">
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save()}>
          {common("save")}
        </button>
      </div>
    </div>
  );
}

function Registers() {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state, reload } = useApi<RegisterItem[]>("/office/registers");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"incoming" | "outgoing">("incoming");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const create = () =>
    run(async () => {
      await apiFetch("/office/registers", { method: "POST", body: JSON.stringify({ name, direction }) });
      setName("");
      notify(common("saved"));
      void reload();
    });
  const update = async (register: RegisterItem, change: { name?: string; status?: "active" | "inactive" }) => {
    try {
      await apiFetch(`/office/registers/${register.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: change.name ?? register.name, status: change.status ?? register.status, version: register.version }),
      });
      setEditing(null);
      notify(common("saved"));
      void reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  };
  const headings = [t("registerName"), t("direction"), t("nextNumber"), t("status"), ""];
  return (
    <>
      <div className="the">
        <FormError text={formError} />
        <div className="hai-cot">
          <Field id="register-name" label={t("newRegister")} error={fields.name}>
            <input id="register-name" className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="register-direction" label={t("direction")}>
            <select id="register-direction" className="o-nhap" value={direction} onChange={(event) => setDirection(event.target.value as "incoming" | "outgoing")}>
              <option value="incoming">{t("direction_incoming")}</option>
              <option value="outgoing">{t("direction_outgoing")}</option>
            </select>
          </Field>
        </div>
        <div className="nhom-nut">
          <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !name.trim()} onClick={() => void create()}>
            {t("addRegister")}
          </button>
        </div>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(registers) => (
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
                {registers.map((register) => (
                  <tr key={register.id}>
                    <td data-nhan={headings[0]}>
                      {editing?.id === register.id ? (
                        <span className="nhom-nut">
                          <label className="an-nhan" htmlFor={`rename-${register.id}`}>
                            {t("registerName")}
                          </label>
                          <input id={`rename-${register.id}`} className="o-nhap" maxLength={100} value={editing.name} onChange={(event) => setEditing({ id: register.id, name: event.target.value })} />
                          <button type="button" className="nut chinh" disabled={!editing.name.trim()} onClick={() => void update(register, { name: editing.name })}>
                            {common("save")}
                          </button>
                        </span>
                      ) : (
                        <span>
                          {register.name} {register.isDefault && <span className="nhan thong-tin">{t("defaultRegister")}</span>}
                        </span>
                      )}
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>{t(`direction_${register.direction}`)}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span>{register.nextNumberThisYear}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span className={`nhan ${register.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`registerStatus_${register.status}`)}</span>
                    </td>
                    <td data-nhan={headings[4]}>
                      <span className="nhom-nut">
                        <button type="button" className="nut chu" onClick={() => setEditing({ id: register.id, name: register.name })}>
                          {t("rename")}
                        </button>
                        {!register.isDefault && (
                          <button type="button" className="nut chu" onClick={() => void update(register, { status: register.status === "active" ? "inactive" : "active" })}>
                            {register.status === "active" ? t("deactivate") : t("activate")}
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </>
  );
}

function DocumentTypes() {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { state, reload } = useApi<DocumentTypeItem[]>("/office/document-types");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const create = () =>
    run(async () => {
      await apiFetch("/office/document-types", { method: "POST", body: JSON.stringify({ name, abbreviation }) });
      setName("");
      setAbbreviation("");
      notify(common("saved"));
      void reload();
    });
  const toggle = async (item: DocumentTypeItem) => {
    try {
      await apiFetch(`/office/document-types/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: item.status === "active" ? "inactive" : "active" }) });
      void reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  };
  const headings = [t("documentType"), t("abbreviation"), t("origin"), t("status"), ""];
  return (
    <>
      <div className="the">
        <FormError text={formError} />
        <p className="chu-thich">{t("typesHint")}</p>
        <div className="hai-cot">
          <Field id="type-name" label={t("newTypeName")} error={fields.name}>
            <input id="type-name" className={inputClass("name")} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="type-abbreviation" label={t("abbreviation")} error={fields.abbreviation}>
            <input id="type-abbreviation" className={inputClass("abbreviation")} maxLength={10} value={abbreviation} onChange={(event) => setAbbreviation(event.target.value.toUpperCase())} />
          </Field>
        </div>
        <div className="nhom-nut">
          <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !name.trim() || !abbreviation.trim()} onClick={() => void create()}>
            {t("addType")}
          </button>
        </div>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(types) => (
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
                {types.map((item) => (
                  <tr key={item.id}>
                    <td data-nhan={headings[0]}>
                      <span>{item.name}</span>
                    </td>
                    <td data-nhan={headings[1]}>
                      <span>{item.abbreviation ?? t("officialLetterNoAbbreviation")}</span>
                    </td>
                    <td data-nhan={headings[2]}>
                      <span>{item.isCustom ? t("customType") : t("decreeType")}</span>
                    </td>
                    <td data-nhan={headings[3]}>
                      <span className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`registerStatus_${item.status}`)}</span>
                    </td>
                    <td data-nhan={headings[4]}>
                      <span>
                        <button type="button" className="nut chu" onClick={() => void toggle(item)}>
                          {item.status === "active" ? t("deactivate") : t("activate")}
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Loaded>
    </>
  );
}
