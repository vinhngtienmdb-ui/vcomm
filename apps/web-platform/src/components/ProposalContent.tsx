"use client";

// Nội dung đề xuất theo mẫu (CHUC_NANG_28): nhập khi nháp, xem khi đã gửi; tệp đính kèm (API_52); dùng ở MAN_HINH_21 và MAN_HINH_08.
import type { AttachmentResponse, ProposalField, ProposalResponse, ProposalStatus } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { apiDownload, apiFetch, apiUpload } from "@/lib/api";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { failureOf } from "@/lib/use-api";
import { Field } from "./Form";

export const proposalStatusTone: Record<ProposalStatus, string> = { draft: "trung-tinh", pending: "canh-bao", approved: "thanh-cong", rejected: "loi", withdrawn: "trung-tinh" };

type Line = Record<string, string>;
export type ProposalValues = Record<string, unknown>;

// Ô nhập tiền, số: tiếng Việt có dấu chấm hàng nghìn; gửi lên dạng số thuần.
const toApiNumber = (text: string) => text.replace(/[.\s]/g, "").replace(",", ".");

export function ProposalFieldsForm({
  fields,
  values,
  errors,
  currency,
  onChange,
}: {
  fields: ProposalField[];
  values: ProposalValues;
  errors: Record<string, string>;
  currency: string;
  onChange: (values: ProposalValues) => void;
}) {
  const t = useTranslations("proposals");
  const set = (key: string, value: unknown) => onChange({ ...values, [key]: value });
  return (
    <>
      {fields.map((field) => {
        const id = `truong-${field.key}`;
        const error = errors[`values.${field.key}`];
        const label = `${field.label}${field.required ? " *" : ""}`;
        const value = (values[field.key] as string | undefined) ?? "";
        if (field.type === "lines") {
          const lines = (values[field.key] as Line[] | undefined) ?? [];
          const columns = field.columns ?? [];
          const total = lines.reduce((sum, line) => sum + Number(toApiNumber(line.amount ?? "0") || 0), 0);
          return (
            <fieldset key={field.key} className="the" style={{ margin: 0 }}>
              <legend style={{ fontWeight: 700 }}>{label}</legend>
              {error && <span className="loi-o">{error}</span>}
              {lines.map((line, index) => (
                <div key={index} style={{ display: "grid", gap: "var(--khoang-2)", gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr)) auto`, alignItems: "end" }}>
                  {columns.map((column) => {
                    const cellError = errors[`values.${field.key}.${index}.${column.key}`];
                    return (
                      <Field key={column.key} id={`${id}-${index}-${column.key}`} label={column.label} error={cellError}>
                        <input
                          id={`${id}-${index}-${column.key}`}
                          className={`o-nhap${cellError ? " loi" : ""}`}
                          inputMode={column.type === "text" ? undefined : "decimal"}
                          value={line[column.key] ?? ""}
                          onChange={(event) =>
                            set(
                              field.key,
                              lines.map((item, position) => (position === index ? { ...item, [column.key]: event.target.value } : item)),
                            )
                          }
                        />
                      </Field>
                    );
                  })}
                  <button
                    type="button"
                    className="nut chu"
                    onClick={() =>
                      set(
                        field.key,
                        lines.filter((_, position) => position !== index),
                      )
                    }
                  >
                    {t("removeLine")}
                  </button>
                </div>
              ))}
              <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={() => set(field.key, [...lines, {}])}>
                {t("addLine")}
              </button>
              <span className="chu-thich">
                {t("total")}: {formatMoney(String(total), currency)}
              </span>
            </fieldset>
          );
        }
        return (
          <Field key={field.key} id={id} label={label} error={error}>
            {field.type === "textarea" ? (
              <textarea id={id} className={`o-nhap${error ? " loi" : ""}`} rows={3} value={value} onChange={(event) => set(field.key, event.target.value)} />
            ) : field.type === "select" ? (
              <select id={id} className={`o-nhap${error ? " loi" : ""}`} value={value} onChange={(event) => set(field.key, event.target.value)}>
                <option value="">{t("choose")}</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                className={`o-nhap${error ? " loi" : ""}`}
                type={field.type === "date" ? "date" : "text"}
                inputMode={field.type === "money" || field.type === "number" ? "decimal" : undefined}
                value={value}
                onChange={(event) => set(field.key, event.target.value)}
              />
            )}
          </Field>
        );
      })}
    </>
  );
}

// Chuyển giá trị nhập (có dấu chấm hàng nghìn) về dạng gửi API.
export function valuesForApi(fields: ProposalField[], values: ProposalValues): ProposalValues {
  const result: ProposalValues = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === "lines") {
      result[field.key] = ((value as Line[] | undefined) ?? []).map((line) =>
        Object.fromEntries(Object.entries(line).map(([key, cell]) => [key, (field.columns ?? []).find((column) => column.key === key)?.type === "text" ? cell : toApiNumber(cell)])),
      );
    } else if ((field.type === "money" || field.type === "number") && typeof value === "string") {
      result[field.key] = toApiNumber(value);
    } else if (value !== undefined) {
      result[field.key] = value;
    }
  }
  return result;
}

export function ProposalFieldsView({ proposal }: { proposal: ProposalResponse }) {
  const t = useTranslations("proposals");
  const text = (field: ProposalField, value: unknown) => {
    if (value === undefined || value === null || value === "") return "—";
    if (field.type === "money") return formatMoney(String(value), proposal.currency);
    if (field.type === "number") return formatNumber(String(value));
    if (field.type === "date") return formatDate(String(value));
    return String(value);
  };
  return (
    <>
      <dl className="thong-tin-dong">
        {proposal.template.fields
          .filter((field) => field.type !== "lines")
          .map((field) => (
            <div key={field.key} style={{ display: "contents" }}>
              <dt>{field.label}</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{text(field, proposal.values[field.key])}</dd>
            </div>
          ))}
        <dt>{t("approvalAmount")}</dt>
        <dd>
          <strong>{formatMoney(proposal.amount, proposal.currency)}</strong>
        </dd>
      </dl>
      {proposal.template.fields
        .filter((field) => field.type === "lines")
        .map((field) => {
          const lines = (proposal.values[field.key] as Line[] | undefined) ?? [];
          const columns = field.columns ?? [];
          return (
            <div key={field.key} style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h3 style={{ margin: 0 }}>{field.label}</h3>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index}>
                        {columns.map((column) => (
                          <td key={column.key} data-nhan={column.label}>
                            <span>
                              {column.type === "money" && line[column.key]
                                ? formatMoney(line[column.key]!, proposal.currency)
                                : column.type === "number" && line[column.key]
                                  ? formatNumber(line[column.key]!)
                                  : (line[column.key] ?? "—")}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </>
  );
}

export function Attachments({ proposal, onChanged, notify }: { proposal: ProposalResponse; onChanged: () => void; notify: (text: string, kind?: "thanh-cong" | "loi") => void }) {
  const t = useTranslations("proposals");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiUpload<AttachmentResponse>(`/proposals/${proposal.id}/attachments`, form);
      onChanged();
    } catch (failure) {
      const result = failureOf(failure);
      setError(result.fields.file ?? result.message);
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiFetch(`/attachments/${id}`, { method: "DELETE" });
      onChanged();
    } catch (failure) {
      notify(failureOf(failure).message, "loi");
    }
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <h2 style={{ margin: 0 }}>{t("attachments")}</h2>
      {proposal.attachments.length === 0 && <span className="chu-thich">{t("noAttachments")}</span>}
      {proposal.attachments.map((file) => (
        <div key={file.id} style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "center" }}>
          <button type="button" className="nut chu" onClick={() => void apiDownload(`/attachments/${file.id}`, file.fileName).catch((failure) => notify(failureOf(failure).message, "loi"))}>
            {file.fileName}
          </button>
          <span className="chu-thich">{size(file.sizeBytes)}</span>
          {proposal.canEdit && (
            <button type="button" className="nut chu" onClick={() => void remove(file.id)}>
              {t("removeFile")}
            </button>
          )}
        </div>
      ))}
      {proposal.canEdit && (
        <Field id="tep-dinh-kem" label={t("attach")} hint={t("attachHint")} error={error ?? undefined}>
          <input
            id="tep-dinh-kem"
            type="file"
            className="o-nhap"
            disabled={uploading || proposal.attachments.length >= 10}
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.docx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </Field>
      )}
    </div>
  );
}
