"use client";

// MAN_HINH_211 Lập phiên ký (CHUC_NANG_211; QUYTAC_NGHIEPVU_458): tệp PDF, tiêu đề, hạn ký, người ký theo thứ tự, vị trí ô chữ ký.
import type { OfficePerson, SaveSigningRequestInput, SignatureCorner, SigningRequestResponse, SigningSignerInput } from "contracts";
import { signatureCorners, signingRequestDefaultDays, signingRequestMaximumSigners } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { PersonPicker } from "@/components/PersonPicker";

type Row =
  | { key: number; kind: "user"; person: OfficePerson | null; signOrder: number; page: string; corner: SignatureCorner }
  | { key: number; kind: "company"; signOrder: number; page: string; corner: SignatureCorner }
  | {
      key: number;
      kind: "partner";
      partnerKind: "organization" | "individual";
      name: string;
      email: string;
      identity: string;
      identityCode: string;
      signOrder: number;
      page: string;
      corner: SignatureCorner;
    };

// Bỏ trường vị trí trên từng loại người ký (Omit trên kiểu hợp nhất làm mất trường riêng của từng loại).
type RowBody = Row extends infer Item ? (Item extends Row ? Omit<Item, "key" | "signOrder" | "page" | "corner"> : never) : never;

const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function rowsFrom(request: SigningRequestResponse | null): Row[] {
  if (!request) return [];
  return request.signers.map((signer, index): Row => {
    const placement = { key: index, signOrder: signer.signOrder, page: signer.page, corner: signer.corner };
    if (signer.kind === "user") return { kind: "user", person: signer.user, ...placement };
    if (signer.kind === "company") return { kind: "company", ...placement };
    const partner = signer.partner!;
    return { kind: "partner", partnerKind: partner.kind, name: partner.name, email: partner.email, identity: partner.identity, identityCode: partner.identityCode, ...placement };
  });
}

export function SigningEditor({ request }: { request: SigningRequestResponse | null }) {
  const t = useTranslations("officeSigning");
  const { notify } = useAdmin();
  const router = useRouter();
  const [title, setTitle] = useState(request?.title ?? "");
  const [note, setNote] = useState(request?.note ?? "");
  const [dueOn, setDueOn] = useState(request?.dueOn ?? addDays(vietnamToday(), signingRequestDefaultDays));
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>(rowsFrom(request));
  const [nextKey, setNextKey] = useState(100);
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  const nextOrder = () => Math.min(10, (rows[rows.length - 1]?.signOrder ?? 0) + 1);
  const add = (row: RowBody) => {
    if (rows.length >= signingRequestMaximumSigners) return;
    setRows([...rows, { ...row, key: nextKey, signOrder: nextOrder(), page: "last", corner: "bottom_right" } as Row]);
    setNextKey(nextKey + 1);
  };
  const update = (key: number, change: Partial<Row>) => setRows(rows.map((row) => (row.key === key ? ({ ...row, ...change } as Row) : row)));

  const payload = (): SaveSigningRequestInput => ({
    title,
    note: note.trim() || null,
    dueOn,
    signers: rows.map((row): SigningSignerInput => {
      const placement = { signOrder: row.signOrder, page: row.page, corner: row.corner };
      if (row.kind === "user") return { kind: "user", userId: row.person?.id ?? "", ...placement };
      if (row.kind === "company") return { kind: "company", ...placement };
      return { kind: "partner", partnerKind: row.partnerKind, name: row.name, email: row.email, identity: row.identity, identityCode: row.identityCode, ...placement };
    }),
    ...(request ? { version: request.version } : {}),
  });

  const save = (thenSend: boolean) =>
    run(async () => {
      const form = new FormData();
      form.append("data", JSON.stringify(payload()));
      if (file) form.append("file", file);
      let saved = await apiUpload<SigningRequestResponse>(request ? `/office/signing-requests/${request.id}` : "/office/signing-requests", form);
      if (thenSend) saved = await apiFetch<SigningRequestResponse>(`/office/signing-requests/${saved.id}/send`, { method: "POST", body: JSON.stringify({ version: saved.version }) });
      notify(thenSend ? t("sent") : t("draftSaved"));
      router.push(`/signing/${saved.id}`);
    });

  const placementFields = (row: Row) => (
    <>
      <Field id={`thu-tu-${row.key}`} label={t("signOrder")}>
        <input id={`thu-tu-${row.key}`} className="o-nhap" type="number" min={1} max={10} value={row.signOrder} onChange={(event) => update(row.key, { signOrder: Number(event.target.value) })} />
      </Field>
      <Field id={`trang-${row.key}`} label={t("page")}>
        <select
          id={`trang-${row.key}`}
          className="o-nhap"
          value={row.page === "first" || row.page === "last" ? row.page : "number"}
          onChange={(event) => update(row.key, { page: event.target.value === "number" ? "1" : event.target.value })}
        >
          <option value="last">{t("page_last")}</option>
          <option value="first">{t("page_first")}</option>
          <option value="number">{t("page_number")}</option>
        </select>
      </Field>
      {row.page !== "first" && row.page !== "last" && (
        <Field id={`so-trang-${row.key}`} label={t("pageNumber")}>
          <input
            id={`so-trang-${row.key}`}
            className="o-nhap"
            type="number"
            min={1}
            value={row.page}
            onChange={(event) => update(row.key, { page: String(Math.max(1, Number(event.target.value) || 1)) })}
          />
        </Field>
      )}
      <Field id={`goc-${row.key}`} label={t("corner")}>
        <select id={`goc-${row.key}`} className="o-nhap" value={row.corner} onChange={(event) => update(row.key, { corner: event.target.value as SignatureCorner })}>
          {signatureCorners.map((corner) => (
            <option key={corner} value={corner}>
              {t(`corner_${corner}`)}
            </option>
          ))}
        </select>
      </Field>
    </>
  );

  return (
    <>
      <div className="tieu-de">
        <h1>{request ? t("editTitle", { no: request.requestNo }) : t("create")}</h1>
        <div className="nhom-nut">
          <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save(false)}>
            {t("saveDraft")}
          </button>
          <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || rows.length === 0} onClick={() => void save(true)}>
            {t("send")}
          </button>
        </div>
      </div>
      <FormError text={formError} />
      <div className="the">
        <h2>{t("document")}</h2>
        <Field id="tep-ky" label={request ? t("replaceFile") : t("pdfFile")} error={fields.file} hint={request?.originalFile ? request.originalFile.fileName : t("pdfHint")}>
          <input id="tep-ky" type="file" accept=".pdf,application/pdf" className={inputClass("file")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </Field>
        <Field id="tieu-de-ky" label={t("titleLabel")} error={fields.title}>
          <input id="tieu-de-ky" className={inputClass("title")} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field id="ghi-chu-ky" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu-ky" className={inputClass("note")} rows={2} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        <Field id="han-ky" label={t("dueOn")} error={fields.dueOn} hint={t("dueHint")}>
          <input id="han-ky" type="date" className={inputClass("dueOn")} value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
        </Field>
      </div>
      <div className="the">
        <div className="tieu-de">
          <h2>{t("signers")}</h2>
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => add({ kind: "user", person: null })}>
              {t("addUser")}
            </button>
            <button type="button" className="nut phu" disabled={rows.some((row) => row.kind === "company")} onClick={() => add({ kind: "company" })}>
              {t("addCompany")}
            </button>
            <button type="button" className="nut phu" onClick={() => add({ kind: "partner", partnerKind: "organization", name: "", email: "", identity: "", identityCode: "" })}>
              {t("addPartner")}
            </button>
          </div>
        </div>
        {fields.signers && <div className="khoi-canh-bao loi">{fields.signers}</div>}
        {rows.length === 0 && <p className="chu-thich">{t("noSigners")}</p>}
        <span className="chu-thich">{t("orderHint")}</span>
        {rows.map((row, index) => (
          <div key={row.key} className="the" style={{ marginTop: "var(--khoang-3)" }}>
            <div className="tieu-de">
              <h3>
                {index + 1}. {t(`kind_${row.kind}`)}
              </h3>
              <button type="button" className="nut phu" onClick={() => setRows(rows.filter((item) => item.key !== row.key))}>
                {t("remove")}
              </button>
            </div>
            {row.kind === "user" && (
              <Field id={`nguoi-ky-${row.key}`} label={t("person")}>
                <PersonPicker id={`nguoi-ky-${row.key}`} value={row.person ? [row.person] : []} multiple={false} onChange={(people) => update(row.key, { person: people[0] ?? null })} />
              </Field>
            )}
            {row.kind === "partner" && (
              <>
                <div className="khoi-canh-bao thong-tin">{t("partnerHint")}</div>
                <Field id={`loai-doi-tac-${row.key}`} label={t("partnerKind")}>
                  <select
                    id={`loai-doi-tac-${row.key}`}
                    className="o-nhap"
                    value={row.partnerKind}
                    onChange={(event) => update(row.key, { partnerKind: event.target.value as "organization" | "individual" })}
                  >
                    <option value="organization">{t("partnerKind_organization")}</option>
                    <option value="individual">{t("partnerKind_individual")}</option>
                  </select>
                </Field>
                <Field id={`ten-doi-tac-${row.key}`} label={t("partnerName")}>
                  <input id={`ten-doi-tac-${row.key}`} className="o-nhap" maxLength={200} value={row.name} onChange={(event) => update(row.key, { name: event.target.value })} />
                </Field>
                <Field id={`email-doi-tac-${row.key}`} label={t("partnerEmail")}>
                  <input id={`email-doi-tac-${row.key}`} type="email" className="o-nhap" value={row.email} onChange={(event) => update(row.key, { email: event.target.value })} />
                </Field>
                <Field id={`ma-doi-tac-${row.key}`} label={row.partnerKind === "organization" ? t("partnerTaxCode") : t("partnerPersonalId")}>
                  <input id={`ma-doi-tac-${row.key}`} className="o-nhap" inputMode="numeric" value={row.identity} onChange={(event) => update(row.key, { identity: event.target.value })} />
                </Field>
                <Field id={`dinh-danh-doi-tac-${row.key}`} label={t("partnerIdentityCode")} hint={t("identityCodeHint")}>
                  <input id={`dinh-danh-doi-tac-${row.key}`} className="o-nhap" value={row.identityCode} onChange={(event) => update(row.key, { identityCode: event.target.value })} />
                </Field>
              </>
            )}
            <div className="hai-cot">{placementFields(row)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
