"use client";

// MAN_HINH_158 Soạn công văn đi theo thể thức Nghị định 30 (CHUC_NANG_184; API_189): soạn trực tiếp hoặc tải dự thảo; dùng cho tạo mới và sửa.
import { documentUrgencies, signerAuthorities, type DocumentOptions, type DocumentParagraph, type OfficePerson, type OutgoingResponse, type SaveOutgoingInput } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch, apiUpload } from "ui/lib/api";
import { PersonPicker } from "@/components/PersonPicker";

// Mỗi dòng là một đoạn; dòng bắt đầu bằng "- " là gạch đầu dòng.
const bodyToText = (body: DocumentParagraph[]) => body.map((item) => (item.kind === "bullet" ? `- ${item.text}` : item.text)).join("\n");
const textToBody = (text: string): DocumentParagraph[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") ? { kind: "bullet", text: line.slice(2).trim(), bold: false, italic: false } : { kind: "paragraph", text: line, bold: false, italic: false }));

type Recipient = { kind: "user" | "department" | "company"; id: string; name: string };

export function OutgoingEditor({ options, outgoing, replyToIncomingId }: { options: DocumentOptions; outgoing: OutgoingResponse | null; replyToIncomingId?: string | null }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const registers = options.registers.filter((item) => item.direction === "outgoing" && (item.status === "active" || item.id === outgoing?.registerId));
  const types = options.documentTypes.filter((item) => item.status === "active" || item.id === outgoing?.documentTypeId);
  const [registerId, setRegisterId] = useState(outgoing?.registerId ?? registers.find((item) => item.isDefault)?.id ?? registers[0]?.id ?? "");
  const [documentTypeId, setDocumentTypeId] = useState(outgoing?.documentTypeId ?? types.find((item) => item.isOfficialLetter)?.id ?? types[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(outgoing?.departmentId ?? "");
  const [summary, setSummary] = useState(outgoing?.summary ?? "");
  const [urgency, setUrgency] = useState(outgoing?.urgency ?? "normal");
  const [composeMode, setComposeMode] = useState<"compose" | "upload">(outgoing?.composeMode ?? "compose");
  const [recipientLine, setRecipientLine] = useState(outgoing?.recipientLine ?? "");
  const [bodyText, setBodyText] = useState(outgoing ? bodyToText(outgoing.body) : "");
  const [signer, setSigner] = useState<OfficePerson[]>(outgoing ? [outgoing.signer] : []);
  const [signerAuthority, setSignerAuthority] = useState<(typeof signerAuthorities)[number]>(outgoing?.signerAuthority ?? "");
  const [signerAuthorityOf, setSignerAuthorityOf] = useState(outgoing?.signerAuthorityOf ?? "");
  const [signerTitle, setSignerTitle] = useState(outgoing?.signerTitle ?? "");
  const [externalText, setExternalText] = useState(outgoing?.externalRecipients.join("\n") ?? "");
  const [internal, setInternal] = useState<Recipient[]>(outgoing?.internalRecipients ?? []);
  const [copies, setCopies] = useState(String(outgoing?.copies ?? 1));
  const [drafterCode, setDrafterCode] = useState(outgoing?.drafterCode ?? "");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const isOfficialLetter = types.find((item) => item.id === documentTypeId)?.isOfficialLetter ?? false;
  const addInternal = (recipient: Recipient) => setInternal((current) => [...current.filter((item) => !(item.kind === recipient.kind && item.id === recipient.id)), recipient]);
  const save = (thenSubmit: boolean) =>
    run(async () => {
      const input: SaveOutgoingInput = {
        registerId,
        documentTypeId,
        departmentId: departmentId || null,
        summary,
        urgency,
        composeMode,
        recipientLine: isOfficialLetter ? recipientLine.trim() || null : null,
        body: composeMode === "compose" ? textToBody(bodyText) : [],
        signerUserId: signer[0]?.id ?? "",
        signerAuthority,
        signerAuthorityOf: signerAuthority ? signerAuthorityOf.trim() || null : null,
        signerTitle,
        externalRecipients: externalText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        internalRecipients: internal.map(({ kind, id }) => ({ kind, id })),
        copies: Number(copies) || 1,
        drafterCode: drafterCode.trim() || null,
        replyToIncomingId: outgoing ? undefined : (replyToIncomingId ?? null),
        ...(outgoing ? { version: outgoing.version } : {}),
      };
      let saved = await apiFetch<OutgoingResponse>(outgoing ? `/office/outgoing/${outgoing.id}` : "/office/outgoing", { method: outgoing ? "PATCH" : "POST", body: JSON.stringify(input) });
      if (draftFile) {
        const form = new FormData();
        form.append("file", draftFile);
        await apiUpload(`/office/outgoing/${saved.id}/files`, form);
        saved = await apiFetch<OutgoingResponse>(`/office/outgoing/${saved.id}`);
      }
      if (thenSubmit) {
        await apiFetch(`/office/outgoing/${saved.id}/submit`, { method: "POST", body: JSON.stringify({ version: saved.version }) });
        notify(t("outgoingSubmitted"));
      } else notify(common("saved"));
      router.push(`/outgoing/${saved.id}`);
    });
  return (
    <>
      <FormError text={formError} />
      <div className="the">
        <h2>{t("sectionGeneral")}</h2>
        <div className="hai-cot">
          <Field id="outgoing-register" label={t("registerName")} error={fields.registerId}>
            <select id="outgoing-register" className={inputClass("registerId")} value={registerId} onChange={(event) => setRegisterId(event.target.value)}>
              {registers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="outgoing-type" label={t("documentType")} error={fields.documentTypeId}>
            <select id="outgoing-type" className={inputClass("documentTypeId")} value={documentTypeId} onChange={(event) => setDocumentTypeId(event.target.value)}>
              {types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.abbreviation ? ` (${item.abbreviation})` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field id="outgoing-department" label={t("draftingDepartment")} error={fields.departmentId}>
            <select id="outgoing-department" className={inputClass("departmentId")} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">{t("noDepartment")}</option>
              {options.departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </Field>
          <Field id="outgoing-urgency" label={t("urgency")}>
            <select id="outgoing-urgency" className="o-nhap" value={urgency} onChange={(event) => setUrgency(event.target.value as typeof urgency)}>
              {documentUrgencies.map((item) => (
                <option key={item} value={item}>
                  {t(`urgency_${item}`)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="outgoing-summary" label={isOfficialLetter ? t("summaryOfficialLetter") : t("summaryTitle")} error={fields.summary}>
          <textarea id="outgoing-summary" className={inputClass("summary")} rows={2} maxLength={500} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </Field>
      </div>
      <div className="the">
        <h2>{t("sectionContent")}</h2>
        <div className="cac-the" role="tablist">
          {(["compose", "upload"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={composeMode === item} className={composeMode === item ? "chon" : ""} onClick={() => setComposeMode(item)}>
              {t(`composeMode_${item}`)}
            </button>
          ))}
        </div>
        {isOfficialLetter && (
          <Field id="outgoing-recipient-line" label={t("recipientLine")} error={fields.recipientLine}>
            <input
              id="outgoing-recipient-line"
              className={inputClass("recipientLine")}
              maxLength={500}
              placeholder={t("recipientLinePlaceholder")}
              value={recipientLine}
              onChange={(event) => setRecipientLine(event.target.value)}
            />
          </Field>
        )}
        {composeMode === "compose" ? (
          <Field id="outgoing-body" label={t("body")} error={fields.body}>
            <textarea id="outgoing-body" className={inputClass("body")} rows={12} value={bodyText} onChange={(event) => setBodyText(event.target.value)} />
            <span className="chu-thich">{t("bodyHint")}</span>
          </Field>
        ) : (
          <>
            {outgoing && outgoing.draftFiles.length > 0 && <p className="chu-thich">{t("draftFilesCount", { count: outgoing.draftFiles.length })}</p>}
            <Field id="outgoing-draft-file" label={t("draftFile")} error={fields.file}>
              <input id="outgoing-draft-file" type="file" className={inputClass("file")} accept=".pdf,.doc,.docx" onChange={(event) => setDraftFile(event.target.files?.[0] ?? null)} />
            </Field>
          </>
        )}
      </div>
      <div className="the">
        <h2>{t("sectionSigner")}</h2>
        <Field id="outgoing-signer" label={t("signer")} error={fields.signerUserId}>
          <PersonPicker id="outgoing-signer" value={signer} onChange={setSigner} multiple={false} invalid={Boolean(fields.signerUserId)} />
        </Field>
        <div className="hai-cot">
          <Field id="outgoing-authority" label={t("signerAuthority")}>
            <select id="outgoing-authority" className="o-nhap" value={signerAuthority} onChange={(event) => setSignerAuthority(event.target.value as (typeof signerAuthorities)[number])}>
              {signerAuthorities.map((item) => (
                <option key={item} value={item}>
                  {item || t("authorityNone")}
                </option>
              ))}
            </select>
          </Field>
          {signerAuthority && (
            <Field id="outgoing-authority-of" label={t("signerAuthorityOf")} error={fields.signerAuthorityOf}>
              <input
                id="outgoing-authority-of"
                className={inputClass("signerAuthorityOf")}
                maxLength={100}
                placeholder={t("signerAuthorityOfPlaceholder")}
                value={signerAuthorityOf}
                onChange={(event) => setSignerAuthorityOf(event.target.value)}
              />
            </Field>
          )}
          <Field id="outgoing-signer-title" label={t("signerTitle")} error={fields.signerTitle}>
            <input
              id="outgoing-signer-title"
              className={inputClass("signerTitle")}
              maxLength={100}
              placeholder={t("signerTitlePlaceholder")}
              value={signerTitle}
              onChange={(event) => setSignerTitle(event.target.value)}
            />
          </Field>
        </div>
      </div>
      <div className="the">
        <h2>{t("sectionRecipients")}</h2>
        <Field id="outgoing-external" label={t("externalRecipients")} error={fields.externalRecipients}>
          <textarea
            id="outgoing-external"
            className={inputClass("externalRecipients")}
            rows={3}
            placeholder={t("externalRecipientsHint")}
            value={externalText}
            onChange={(event) => setExternalText(event.target.value)}
          />
        </Field>
        <Field id="outgoing-internal-user" label={t("internalRecipients")} error={fields.internalRecipients}>
          {internal.length > 0 && (
            <div className="nhom-nut" style={{ marginBottom: "var(--khoang-2)" }}>
              {internal.map((item) => (
                <span key={`${item.kind}-${item.id}`} className="nhan thong-tin" style={{ whiteSpace: "normal" }}>
                  {t(`recipientKind_${item.kind}`)}: {item.name}{" "}
                  <button type="button" className="nut chu" aria-label={t("removeRecipient", { name: item.name })} onClick={() => setInternal(internal.filter((other) => other !== item))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="hai-cot">
            <select
              className="o-nhap"
              aria-label={t("addDepartment")}
              value=""
              onChange={(event) => {
                const department = options.departments.find((item) => item.id === event.target.value);
                if (department) addInternal({ kind: "department", id: department.id, name: department.name });
              }}
            >
              <option value="">{t("addDepartment")}</option>
              {options.departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="o-nhap"
              aria-label={t("addCompany")}
              value=""
              onChange={(event) => {
                const company = options.companies.find((item) => item.id === event.target.value);
                if (company) addInternal({ kind: "company", id: company.id, name: company.name });
              }}
            >
              <option value="">{t("addCompany")}</option>
              {options.companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <PersonPicker id="outgoing-internal-user" value={[]} onChange={(people) => people[0] && addInternal({ kind: "user", id: people[0].id, name: people[0].fullName })} multiple={false} />
        </Field>
        <div className="hai-cot">
          <Field id="outgoing-copies" label={t("copies")} error={fields.copies}>
            <input id="outgoing-copies" type="number" min={1} max={999} className={inputClass("copies")} value={copies} onChange={(event) => setCopies(event.target.value)} />
          </Field>
          <Field id="outgoing-drafter" label={t("drafterCode")} error={fields.drafterCode}>
            <input
              id="outgoing-drafter"
              className={inputClass("drafterCode")}
              maxLength={20}
              placeholder={t("drafterCodePlaceholder")}
              value={drafterCode}
              onChange={(event) => setDrafterCode(event.target.value)}
            />
          </Field>
        </div>
      </div>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={() => router.back()}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save(false)}>
          {t("saveDraft")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void save(true)}>
          {t("saveAndSubmit")}
        </button>
      </div>
    </>
  );
}
