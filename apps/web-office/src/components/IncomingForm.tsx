"use client";

// Biểu mẫu vào sổ công văn đến (MAN_HINH_157), dùng ở danh sách và chi tiết.
import { documentUrgencies, incomingChannels, type DocumentOptions, type IncomingResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";

// Biểu mẫu vào sổ (có tệp bản quét) hoặc sửa thông tin vào sổ khi chưa trình.
export function IncomingForm({ options, incoming, onClose, onSaved }: { options: DocumentOptions; incoming: IncomingResponse | null; onClose: () => void; onSaved?: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const registers = options.registers.filter((item) => item.direction === "incoming" && item.status === "active");
  const [registerId, setRegisterId] = useState(registers.find((item) => item.isDefault)?.id ?? registers[0]?.id ?? "");
  const [receivedOn, setReceivedOn] = useState(incoming?.receivedOn ?? vietnamToday());
  const [sender, setSender] = useState(incoming?.sender ?? "");
  const [symbol, setSymbol] = useState(incoming?.symbol ?? "");
  const [documentDate, setDocumentDate] = useState(incoming?.documentDate ?? "");
  const [documentTypeName, setDocumentTypeName] = useState(incoming?.documentTypeName ?? "Công văn");
  const [summary, setSummary] = useState(incoming?.summary ?? "");
  const [urgency, setUrgency] = useState(incoming?.urgency ?? "normal");
  const [dueOn, setDueOn] = useState(incoming?.dueOn ?? "");
  const [channel, setChannel] = useState<(typeof incomingChannels)[number]>(incoming?.channel ?? "paper");
  const [files, setFiles] = useState<File[]>([]);
  const data = { receivedOn, sender, symbol: symbol || null, documentDate: documentDate || null, documentTypeName, summary, urgency, dueOn: dueOn || null, channel };
  const save = () =>
    run(async () => {
      if (incoming) {
        await apiFetch(`/office/incoming/${incoming.id}`, { method: "PATCH", body: JSON.stringify({ ...data, version: incoming.version }) });
        notify(common("saved"));
        onSaved?.();
        return;
      }
      const form = new FormData();
      form.append("data", JSON.stringify({ ...data, registerId }));
      for (const file of files) form.append("files", file);
      const created = await apiUpload<IncomingResponse>("/office/incoming", form);
      notify(t("registered", { number: created.incomingNo ?? "" }));
      router.push(`/incoming/${created.id}`);
    });
  return (
    <Drawer title={incoming ? t("editIncoming") : t("register")} onClose={onClose}>
      <FormError text={formError} />
      {!incoming && (
        <Field id="incoming-register" label={t("registerName")} error={fields.registerId}>
          <select id="incoming-register" className={inputClass("registerId")} value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
            {registers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="hai-cot">
        <Field id="incoming-received" label={t("receivedOn")} error={fields.receivedOn}>
          <input id="incoming-received" type="date" className={inputClass("receivedOn")} value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
        </Field>
        <Field id="incoming-channel" label={t("channel")}>
          <select id="incoming-channel" className="o-nhap" value={channel} onChange={(event) => setChannel(event.target.value as (typeof incomingChannels)[number])}>
            {incomingChannels.map((item) => (
              <option key={item} value={item}>
                {t(`channel_${item}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="incoming-sender" label={t("sender")} error={fields.sender}>
        <input id="incoming-sender" className={inputClass("sender")} maxLength={300} value={sender} onChange={(event) => setSender(event.target.value)} />
      </Field>
      <div className="hai-cot">
        <Field id="incoming-symbol" label={t("symbol")} error={fields.symbol}>
          <input id="incoming-symbol" className={inputClass("symbol")} maxLength={50} value={symbol} onChange={(event) => setSymbol(event.target.value)} />
        </Field>
        <Field id="incoming-date" label={t("documentDate")} error={fields.documentDate}>
          <input id="incoming-date" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
        </Field>
      </div>
      <Field id="incoming-type" label={t("documentType")} error={fields.documentTypeName}>
        <select id="incoming-type" className={inputClass("documentTypeName")} value={documentTypeName} onChange={(event) => setDocumentTypeName(event.target.value)}>
          {options.documentTypes
            .filter((item) => item.status === "active")
            .map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
        </select>
      </Field>
      <Field id="incoming-summary" label={t("summary")} error={fields.summary}>
        <textarea id="incoming-summary" className={inputClass("summary")} rows={2} maxLength={500} value={summary} onChange={(event) => setSummary(event.target.value)} />
      </Field>
      <div className="hai-cot">
        <Field id="incoming-urgency" label={t("urgency")}>
          <select id="incoming-urgency" className="o-nhap" value={urgency} onChange={(event) => setUrgency(event.target.value as typeof urgency)}>
            {documentUrgencies.map((item) => (
              <option key={item} value={item}>
                {t(`urgency_${item}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="incoming-due" label={t("dueOnOptional")} error={fields.dueOn}>
          <input id="incoming-due" type="date" className={inputClass("dueOn")} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </Field>
      </div>
      {!incoming && (
        <Field id="incoming-files" label={t("scanFiles")} error={fields.file}>
          <input id="incoming-files" type="file" className={inputClass("file")} multiple accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFiles([...(event.target.files ?? [])])} />
        </Field>
      )}
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save()}>
          {incoming ? common("save") : t("register")}
        </button>
      </div>
    </Drawer>
  );
}
