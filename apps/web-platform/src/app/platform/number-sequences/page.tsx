"use client";

// MAN_HINH_16 Dãy số chứng từ (CHUC_NANG_20; API_43).
import { numberSequenceResetPeriods, type NumberSequenceResponse } from "contracts";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

export default function NumberSequencesPage() {
  const t = useTranslations("sequences");
  const common = useTranslations("common");
  const locale = useLocale();
  const { notify } = useAdmin();
  const { state, reload } = useApi<NumberSequenceResponse[]>("/number-sequences");
  const [editing, setEditing] = useState<NumberSequenceResponse | null>(null);
  const headings = [t("documentType"), t("prefix"), t("resetPeriod"), t("padding"), t("nextNumber"), ""];

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="number_sequence" />
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(sequences) =>
          sequences.length === 0 ? (
            <MessageView text={common("empty")} />
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
                  {sequences.map((sequence) => (
                    <tr key={sequence.documentTypeCode}>
                      <td data-nhan={headings[0]}>
                        <span>{locale === "en" ? sequence.documentTypeNameEn : sequence.documentTypeNameVi}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{sequence.prefix ?? common("none")}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{sequence.resetPeriod ? t(`reset_${sequence.resetPeriod}`) : common("none")}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{sequence.padding ?? common("none")}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{sequence.nextNumber ? <code>{sequence.nextNumber}</code> : <span className="nhan trung-tinh">{t("notConfigured")}</span>}</span>
                      </td>
                      <td>
                        <button type="button" className="nut phu" onClick={() => setEditing(sequence)}>
                          {sequence.configured ? t("edit") : t("configure")}
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
        <SequenceDrawer
          sequence={editing}
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

function SequenceDrawer({ sequence, onClose, onSaved }: { sequence: NumberSequenceResponse; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("sequences");
  const common = useTranslations("common");
  const locale = useLocale();
  const [prefix, setPrefix] = useState(sequence.prefix ?? "");
  const [resetPeriod, setResetPeriod] = useState<string>(sequence.resetPeriod ?? "year");
  const [padding, setPadding] = useState(String(sequence.padding ?? 6));
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/number-sequences/${sequence.documentTypeCode}`, {
        method: "PATCH",
        body: JSON.stringify({ prefix, resetPeriod, padding: Number(padding) }),
      });
      onSaved();
    });
  }

  return (
    <Drawer
      title={t("editTitle", {
        name: locale === "en" ? sequence.documentTypeNameEn : sequence.documentTypeNameVi,
      })}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="tien-to" label={t("prefix")} hint={t("prefixHint")} error={fields.prefix}>
          <input id="tien-to" className={inputClass("prefix")} value={prefix} maxLength={10} onChange={(event) => setPrefix(event.target.value.toUpperCase())} />
        </Field>
        <Field id="dat-lai" label={t("resetPeriod")} error={fields.resetPeriod}>
          <select id="dat-lai" className={inputClass("resetPeriod")} value={resetPeriod} onChange={(event) => setResetPeriod(event.target.value)}>
            {numberSequenceResetPeriods.map((period) => (
              <option key={period} value={period}>
                {t(`reset_${period}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="so-chu-so" label={t("padding")} error={fields.padding}>
          <input id="so-chu-so" type="number" min={3} max={10} className={inputClass("padding")} value={padding} onChange={(event) => setPadding(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !prefix.trim()}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
