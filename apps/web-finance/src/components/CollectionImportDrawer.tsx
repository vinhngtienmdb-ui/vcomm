"use client";

// Nhập bảng đối soát thu hộ từ tệp Excel mẫu chung (CHUC_NANG_89; QUYTAC_NGHIEPVU_118; API_103, API_105); có bảng thì nhập lại thay các dòng.
import type { CollectionStatementResponse, CollectorItem } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiDownload, apiUpload } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";

export function CollectionImportDrawer({
  collectors,
  statement,
  onClose,
  onImported,
}: {
  collectors: CollectorItem[];
  statement?: CollectionStatementResponse;
  onClose: () => void;
  onImported: (result: CollectionStatementResponse) => void;
}) {
  const t = useTranslations("collections");
  const common = useTranslations("common");
  const active = collectors.filter((item) => item.status === "active" || item.id === statement?.collectorId);
  const [form, setForm] = useState({
    collectorId: statement?.collectorId ?? active[0]?.id ?? "",
    statementNo: statement?.statementNo ?? "",
    statementDate: statement?.statementDate ?? vietnamToday(),
  });
  const [file, setFile] = useState<File | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const rowErrors = Object.entries(fields).filter(([key]) => key.startsWith("rows."));
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body = new FormData();
      body.set("collectorId", form.collectorId);
      body.set("statementNo", form.statementNo);
      body.set("statementDate", form.statementDate);
      if (statement) {
        body.set("statementId", statement.id);
        body.set("version", String(statement.version));
      }
      if (file) body.set("file", file);
      onImported(await apiUpload<CollectionStatementResponse>("/finance/collection-statements", body));
    });
  }
  return (
    <Drawer title={statement ? t("reimportTitle") : t("importTitle")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <p className="chu-thich" style={{ margin: 0 }}>
          {t("importHint")}
        </p>
        <button
          type="button"
          className="nut phu"
          style={{ justifySelf: "start" }}
          onClick={() => void apiDownload("/finance/collection-statements/template", "mau-doi-soat-thu-ho.xlsx").catch((failure) => setDownloadError(failureOf(failure).message))}
        >
          {t("downloadTemplate")}
        </button>
        <FormError text={downloadError} />
        <Field id="ds-don-vi" label={t("collector")} error={fields.collectorId}>
          <select id="ds-don-vi" className={inputClass("collectorId")} value={form.collectorId} onChange={(event) => setForm({ ...form, collectorId: event.target.value })}>
            {active.map((item) => (
              <option key={item.id} value={item.id}>
                {item.partnerName} · {t(`kind_${item.kind}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ds-so-bang" label={t("statementNo")} error={fields.statementNo}>
          <input id="ds-so-bang" className={inputClass("statementNo")} maxLength={100} value={form.statementNo} onChange={(event) => setForm({ ...form, statementNo: event.target.value })} />
        </Field>
        <Field id="ds-ngay" label={t("statementDate")} error={fields.statementDate}>
          <input id="ds-ngay" type="date" className={inputClass("statementDate")} value={form.statementDate} onChange={(event) => setForm({ ...form, statementDate: event.target.value })} />
        </Field>
        <Field id="ds-tep" label={t("file")} error={fields.file}>
          <input id="ds-tep" type="file" accept=".xlsx" className={inputClass("file")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        {rowErrors.length > 0 && (
          <div className="khoi-canh-bao loi" role="alert">
            <p style={{ margin: 0 }}>{t("rowErrors")}</p>
            <ul style={{ margin: 0, paddingLeft: "var(--khoang-4)" }}>
              {rowErrors.slice(0, 20).map(([key, message]) => {
                const [, row, column] = key.split(".");
                return <li key={key}>{t("rowError", { row: row ?? "", column: t(`column_${column ?? ""}` as "column_reference"), message })}</li>;
              })}
            </ul>
          </div>
        )}
        <FormError text={formError} />
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh" disabled={submitting || !file || !form.collectorId}>
            {t("import")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
