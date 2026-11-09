"use client";

// MAN_HINH_20 Mẫu đề xuất (CHUC_NANG_27; API_50).
import type { ProposalField, ProposalTemplateResponse } from "contracts";
import { proposalColumnTypes, proposalFieldTypes } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Drawer } from "@/components/Dialogs";
import { Field, FormError, useSubmit } from "@/components/Form";
import { HistoryLink } from "@/components/HistoryLink";
import { Loaded, MessageView } from "@/components/StatusViews";
import { apiFetch } from "@/lib/api";
import { failureOf, useApi } from "@/lib/use-api";

export default function ProposalTemplatesPage() {
  const t = useTranslations("templates");
  const { notify } = useAdmin();
  const { state, reload } = useApi<ProposalTemplateResponse[]>("/proposal-templates?all=1");
  const [editing, setEditing] = useState<ProposalTemplateResponse | "new" | null>(null);
  const [addingDefaults, setAddingDefaults] = useState(false);

  async function addDefaults() {
    setAddingDefaults(true);
    try {
      await apiFetch("/proposal-templates/defaults", { method: "POST" });
      notify(t("saved"));
      await reload();
    } catch (failure) {
      notify(failureOf(failure).message, "loi");
    } finally {
      setAddingDefaults(false);
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="proposal_template" />
        <button type="button" className={`nut phu${addingDefaults ? " dang-xu-ly" : ""}`} disabled={addingDefaults} onClick={() => void addDefaults()}>
          {t("addDefaults")}
        </button>
        <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
          {t("add")}
        </button>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(templates) =>
          templates.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {[t("code"), t("name"), t("fields"), t("currency"), t("status"), t("policy"), ""].map((heading, index) => (
                      <th key={index} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {templates.map((template) => (
                    <tr key={template.id}>
                      <td data-nhan={t("code")}>
                        <span>{template.code}</span>
                      </td>
                      <td data-nhan={t("name")}>
                        <span>{template.name}</span>
                      </td>
                      <td data-nhan={t("fields")}>
                        <span>{t("fieldCount", { count: template.fields.length })}</span>
                      </td>
                      <td data-nhan={t("currency")}>
                        <span>{template.currency}</span>
                      </td>
                      <td data-nhan={t("status")}>
                        <span className={`nhan ${template.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(template.status)}</span>
                      </td>
                      <td data-nhan={t("policy")}>
                        <span className={`nhan ${template.hasPolicy ? "thanh-cong" : "canh-bao"}`}>{template.hasPolicy ? t("hasPolicy") : t("noPolicy")}</span>
                      </td>
                      <td data-nhan="">
                        <button type="button" className="nut chu" onClick={() => setEditing(template)}>
                          {t("edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
      {editing && (
        <TemplateDrawer
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}

type FieldDraft = { key: string; label: string; type: ProposalField["type"]; required: boolean; options: string; columns: string };

const toDraft = (field: ProposalField): FieldDraft => ({
  key: field.key,
  label: field.label,
  type: field.type,
  required: field.required,
  options: (field.options ?? []).join("\n"),
  columns: (field.columns ?? []).map((column) => `${column.key}|${column.label}|${column.type}`).join("\n"),
});

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

function toField(draft: FieldDraft): ProposalField {
  const field: ProposalField = { key: draft.key.trim(), label: draft.label.trim(), type: draft.type, required: draft.required };
  if (draft.type === "select") field.options = lines(draft.options);
  if (draft.type === "lines")
    field.columns = lines(draft.columns).map((line) => {
      const [key = "", label = "", type = "text"] = line.split("|").map((part) => part.trim());
      return { key, label: label || key, type: (proposalColumnTypes as readonly string[]).includes(type) ? (type as (typeof proposalColumnTypes)[number]) : "text" };
    });
  return field;
}

function TemplateDrawer({ template, onClose, onSaved }: { template: ProposalTemplateResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("templates");
  const common = useTranslations("common");
  const [code, setCode] = useState(template?.code ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [nameEn, setNameEn] = useState(template?.nameEn ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [currency, setCurrency] = useState(template?.currency ?? "VND");
  const [status, setStatus] = useState(template?.status ?? "active");
  const [amountField, setAmountField] = useState(template?.amountField ?? "");
  const [drafts, setDrafts] = useState<FieldDraft[]>(template ? template.fields.map(toDraft) : [{ key: "amount", label: "", type: "money", required: true, options: "", columns: "" }]);
  const { submitting, fields: errors, formError, run, inputClass } = useSubmit();
  const update = (index: number, change: Partial<FieldDraft>) => setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...change } : draft)));
  const moneyFields = drafts.filter((draft) => draft.type === "money" && draft.key.trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body = { name, nameEn: nameEn || undefined, description: description || null, currency, fields: drafts.map(toField), amountField: amountField || null };
      if (template) await apiFetch(`/proposal-templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ ...body, status, version: template.version }) });
      else await apiFetch("/proposal-templates", { method: "POST", body: JSON.stringify({ ...body, code }) });
      onSaved();
    });
  }

  return (
    <Drawer title={template ? `${t("edit")}: ${template.name}` : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {!template?.hasPolicy && template && (
          <div className="khoi-canh-bao canh-bao" role="status">
            {t("noPolicy")}
          </div>
        )}
        <Field id="ma-mau" label={`${t("code")} *`} hint={t("codeHint")} error={errors.code}>
          <input id="ma-mau" className={inputClass("code")} value={code} maxLength={10} disabled={Boolean(template)} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        </Field>
        <Field id="ten-mau" label={`${t("name")} *`} error={errors.name}>
          <input id="ten-mau" className={inputClass("name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="ten-mau-en" label={t("nameEn")} error={errors.nameEn}>
          <input id="ten-mau-en" className={inputClass("nameEn")} value={nameEn} maxLength={100} onChange={(event) => setNameEn(event.target.value)} />
        </Field>
        <Field id="mo-ta-mau" label={t("description")} error={errors.description}>
          <textarea id="mo-ta-mau" className={inputClass("description")} rows={2} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} />
        </Field>
        <Field id="tien-te-mau" label={t("currency")} error={errors.currency}>
          <input id="tien-te-mau" className={inputClass("currency")} value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
        </Field>
        {template && (
          <Field id="trang-thai-mau" label={t("status")}>
            <select id="trang-thai-mau" className="o-nhap" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
              <option value="active">{t("active")}</option>
              <option value="inactive">{t("inactive")}</option>
            </select>
          </Field>
        )}
        <h3 style={{ margin: 0 }}>{t("fields")}</h3>
        {errors.fields && <span className="loi-o">{errors.fields}</span>}
        {drafts.map((draft, index) => (
          <fieldset key={index} className="the" style={{ margin: 0 }}>
            <legend style={{ fontWeight: 700 }}>{t("field", { index: index + 1 })}</legend>
            <Field id={`truong-ma-${index}`} label={t("key")} error={errors[`fields.${index}.key`]}>
              <input
                id={`truong-ma-${index}`}
                className={inputClass(`fields.${index}.key`)}
                value={draft.key}
                maxLength={40}
                onChange={(event) => update(index, { key: event.target.value.toLowerCase() })}
              />
            </Field>
            <Field id={`truong-nhan-${index}`} label={t("label")} error={errors[`fields.${index}.label`]}>
              <input
                id={`truong-nhan-${index}`}
                className={inputClass(`fields.${index}.label`)}
                value={draft.label}
                maxLength={100}
                onChange={(event) => update(index, { label: event.target.value })}
              />
            </Field>
            <Field id={`truong-kieu-${index}`} label={t("type")}>
              <select id={`truong-kieu-${index}`} className="o-nhap" value={draft.type} onChange={(event) => update(index, { type: event.target.value as FieldDraft["type"] })}>
                {proposalFieldTypes.map((type) => (
                  <option key={type} value={type}>
                    {t(`type_${type}`)}
                  </option>
                ))}
              </select>
            </Field>
            {draft.type === "select" && (
              <Field id={`truong-chon-${index}`} label={t("options")} error={errors[`fields.${index}.options`]}>
                <textarea
                  id={`truong-chon-${index}`}
                  className={inputClass(`fields.${index}.options`)}
                  rows={3}
                  value={draft.options}
                  onChange={(event) => update(index, { options: event.target.value })}
                />
              </Field>
            )}
            {draft.type === "lines" && (
              <Field id={`truong-cot-${index}`} label={t("columns")} error={errors[`fields.${index}.columns`]}>
                <textarea
                  id={`truong-cot-${index}`}
                  className={inputClass(`fields.${index}.columns`)}
                  rows={4}
                  placeholder={"name|Tên hàng|text\namount|Thành tiền|money"}
                  value={draft.columns}
                  onChange={(event) => update(index, { columns: event.target.value })}
                />
              </Field>
            )}
            <label style={{ display: "flex", gap: "var(--khoang-2)", alignItems: "center" }}>
              <input type="checkbox" checked={draft.required} onChange={(event) => update(index, { required: event.target.checked })} />
              {t("required")}
            </label>
            {drafts.length > 1 && (
              <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => setDrafts((current) => current.filter((_, position) => position !== index))}>
                {t("removeField")}
              </button>
            )}
          </fieldset>
        ))}
        {drafts.length < 30 && (
          <button
            type="button"
            className="nut phu"
            style={{ justifySelf: "start" }}
            onClick={() => setDrafts((current) => [...current, { key: "", label: "", type: "text", required: false, options: "", columns: "" }])}
          >
            {t("addField")}
          </button>
        )}
        <Field id="gia-tri-duyet" label={t("amountField")} error={errors.amountField}>
          <select id="gia-tri-duyet" className={inputClass("amountField")} value={amountField} onChange={(event) => setAmountField(event.target.value)}>
            <option value="">{t("amountFromLines")}</option>
            {moneyFields.map((draft) => (
              <option key={draft.key} value={draft.key}>
                {draft.label || draft.key}
              </option>
            ))}
          </select>
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
