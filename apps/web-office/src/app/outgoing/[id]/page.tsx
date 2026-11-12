"use client";

// MAN_HINH_158 Chi tiết công văn đi (CHUC_NANG_184; API_189): xem trước theo thể thức, trình, rút, quyết định, cấp số, phát hành, hủy; tải PDF, Word.
import type { OutgoingResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload, selectedCompanyId } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { OutgoingStatusBadge, UrgencyBadge } from "@/components/DocumentBadges";
import { FileList } from "@/components/FileList";
import { personLabel } from "@/components/PersonPicker";

export default function OutgoingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<OutgoingResponse>(`/office/outgoing/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(outgoing) => <OutgoingDetail outgoing={outgoing} onChanged={() => void reload()} key={outgoing.version} />}
    </Loaded>
  );
}

// Bản xem trước PDF tải qua fetch (gửi kèm cookie phiên, công ty đang chọn) rồi hiện trong khung.
function PdfPreview({ outgoingId, version }: { outgoingId: string; version: number }) {
  const t = useTranslations("officeDocuments");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let objectUrl: string | null = null;
    const headers: Record<string, string> = {};
    const companyId = selectedCompanyId();
    if (companyId) headers["x-company-id"] = companyId;
    fetch(`/api/v1/office/outgoing/${outgoingId}/render?format=pdf`, { credentials: "same-origin", headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        objectUrl = URL.createObjectURL(await response.blob());
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [outgoingId, version]);
  if (failed) return <p className="chu-thich">{t("previewFailed")}</p>;
  if (!url) return <p className="chu-thich">{t("previewLoading")}</p>;
  return <iframe title={t("preview")} src={url} style={{ width: "100%", height: "70vh", border: "1px solid var(--mau-vien)", borderRadius: "var(--bo-vua)" }} />;
}

function OutgoingDetail({ outgoing, onChanged }: { outgoing: OutgoingResponse; onChanged: () => void }) {
  const t = useTranslations("officeDocuments");
  const { notify } = useAdmin();
  const [dialog, setDialog] = useState<"decide" | "cancel" | "issue" | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = new Set(outgoing.allowedActions);
  const post = async (action: "submit" | "withdraw" | "number", message: string) => {
    setBusy(true);
    try {
      await apiFetch(`/office/outgoing/${outgoing.id}/${action}`, { method: "POST", body: JSON.stringify({ version: outgoing.version }) });
      notify(message);
      onChanged();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  const done = (message: string) => {
    notify(message);
    setDialog(null);
    onChanged();
  };
  const download = (format: "pdf" | "docx") =>
    void apiDownload(`/office/outgoing/${outgoing.id}/render?format=${format}`, `${outgoing.symbol ?? "du-thao"}.${format}`.replaceAll("/", "-")).catch((error) =>
      notify(failureOf(error).message, "loi"),
    );
  const title = outgoing.symbol ?? t("noNumber");
  return (
    <>
      <p className="chu-thich">
        <Link href="/outgoing">{t("outgoingTitle")}</Link>
      </p>
      <div className="tieu-de">
        <h1>
          {title} <OutgoingStatusBadge status={outgoing.status} />
        </h1>
        <div className="nhom-nut">
          {allowed.has("submit") && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void post("submit", t("outgoingSubmitted"))}>
              {t("outgoingAction_submit")}
            </button>
          )}
          {allowed.has("decide") && (
            <button type="button" className="nut chinh" onClick={() => setDialog("decide")}>
              {t("outgoingAction_decide")}
            </button>
          )}
          {allowed.has("number") && (
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void post("number", t("numbered"))}>
              {t("outgoingAction_number")}
            </button>
          )}
          {allowed.has("issue") && (
            <button type="button" className="nut chinh" onClick={() => setDialog("issue")}>
              {t("outgoingAction_issue")}
            </button>
          )}
          {allowed.has("edit") && (
            <Link className="nut phu" href={`/outgoing/${outgoing.id}/edit`}>
              {t("outgoingAction_edit")}
            </Link>
          )}
          {allowed.has("withdraw") && (
            <button type="button" className="nut phu" disabled={busy} onClick={() => void post("withdraw", t("withdrawn"))}>
              {t("outgoingAction_withdraw")}
            </button>
          )}
          {outgoing.composeMode === "compose" && (
            <>
              <button type="button" className="nut phu" onClick={() => download("pdf")}>
                {t("downloadPdf")}
              </button>
              <button type="button" className="nut phu" onClick={() => download("docx")}>
                {t("downloadWord")}
              </button>
            </>
          )}
          {allowed.has("cancel") && (
            <button type="button" className="nut nguy-hiem" onClick={() => setDialog("cancel")}>
              {t("outgoingAction_cancel")}
            </button>
          )}
        </div>
      </div>
      {outgoing.status === "rejected" && outgoing.decisionNote && <div className="khoi-canh-bao loi">{t("rejectedNote", { note: outgoing.decisionNote })}</div>}
      {outgoing.status === "cancelled" && outgoing.cancelReason && <div className="khoi-canh-bao canh-bao">{t("cancelledReason", { reason: outgoing.cancelReason })}</div>}
      {outgoing.status === "awaiting_number" && outgoing.expectedSymbol && <div className="khoi-canh-bao thong-tin">{t("expectedSymbol", { symbol: outgoing.expectedSymbol })}</div>}
      {outgoing.status === "pending" && (
        <div className="khoi-canh-bao thong-tin">
          {outgoing.approvalMode === "policy" ? t("pendingPolicy") : t("pendingSigner", { name: outgoing.signer.fullName })}
          {outgoing.approvalMode === "policy" && outgoing.approvalRequestId && (
            <>
              {" "}
              <a href={`/hop-duyet/${outgoing.approvalRequestId}`}>{t("openApproval")}</a>
            </>
          )}
        </div>
      )}
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("registerName")}</dt>
          <dd>{outgoing.registerName}</dd>
          <dt>{t("documentType")}</dt>
          <dd>{outgoing.documentTypeName}</dd>
          <dt>{t("summary")}</dt>
          <dd>{outgoing.summary}</dd>
          <dt>{t("draftingDepartment")}</dt>
          <dd>{outgoing.departmentName ?? "—"}</dd>
          <dt>{t("urgency")}</dt>
          <dd>
            <UrgencyBadge urgency={outgoing.urgency} />
          </dd>
          <dt>{t("signer")}</dt>
          <dd>
            {personLabel(outgoing.signer)} · {[[outgoing.signerAuthority, outgoing.signerAuthorityOf].filter(Boolean).join(" "), outgoing.signerTitle].filter(Boolean).join(", ")}
          </dd>
          <dt>{t("issuedOn")}</dt>
          <dd>{formatDate(outgoing.issuedOn)}</dd>
          <dt>{t("recipients")}</dt>
          <dd>{[...outgoing.externalRecipients, ...outgoing.internalRecipients.map((item) => item.name)].join("; ") || "—"}</dd>
          <dt>{t("copies")}</dt>
          <dd>{outgoing.copies}</dd>
          <dt>{t("createdBy")}</dt>
          <dd>{personLabel(outgoing.createdBy)}</dd>
          {outgoing.replyTo && (
            <>
              <dt>{t("replyTo")}</dt>
              <dd>
                <Link href={`/incoming/${outgoing.replyTo.id}`}>{[outgoing.replyTo.incomingNo, outgoing.replyTo.symbol].filter(Boolean).join(" · ") || t("openIncoming")}</Link>
              </dd>
            </>
          )}
        </dl>
      </div>
      {(outgoing.draftFiles.length > 0 || outgoing.signedFiles.length > 0) && (
        <div className="the">
          {outgoing.signedFiles.length > 0 && (
            <>
              <h2>{t("signedFiles")}</h2>
              <FileList files={outgoing.signedFiles} basePath={`/office/outgoing/${outgoing.id}/files`} />
            </>
          )}
          {outgoing.draftFiles.length > 0 && (
            <>
              <h2>{t("draftFiles")}</h2>
              <FileList files={outgoing.draftFiles} basePath={`/office/outgoing/${outgoing.id}/files`} />
            </>
          )}
        </div>
      )}
      {outgoing.composeMode === "compose" && (
        <div className="the">
          <h2>{t("preview")}</h2>
          <PdfPreview outgoingId={outgoing.id} version={outgoing.version} />
        </div>
      )}
      {dialog === "decide" && <DecideDrawer outgoing={outgoing} onClose={() => setDialog(null)} onDone={(decision) => done(t(`decided_${decision}`))} />}
      {dialog === "cancel" && <CancelDrawer outgoing={outgoing} onClose={() => setDialog(null)} onDone={() => done(t("outgoingCancelled"))} />}
      {dialog === "issue" && <IssueDrawer outgoing={outgoing} onClose={() => setDialog(null)} onDone={() => done(t("issued"))} />}
    </>
  );
}

function DecideDrawer({ outgoing, onClose, onDone }: { outgoing: OutgoingResponse; onClose: () => void; onDone: (decision: "approved" | "rejected") => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [note, setNote] = useState("");
  const decide = (decision: "approved" | "rejected") =>
    run(async () => {
      await apiFetch(`/office/outgoing/${outgoing.id}/decide`, { method: "POST", body: JSON.stringify({ decision, note: note.trim() || null, version: outgoing.version }) });
      onDone(decision);
    });
  return (
    <Drawer title={t("outgoingAction_decide")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="decide-note" label={t("decisionNote")} error={fields.note}>
        <textarea id="decide-note" className={inputClass("note")} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className="nut nguy-hiem" disabled={submitting || !note.trim()} onClick={() => void decide("rejected")}>
          {t("reject")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => void decide("approved")}>
          {t("approve")}
        </button>
      </div>
    </Drawer>
  );
}

function CancelDrawer({ outgoing, onClose, onDone }: { outgoing: OutgoingResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  const save = () =>
    run(async () => {
      await apiFetch(`/office/outgoing/${outgoing.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), version: outgoing.version }) });
      onDone();
    });
  return (
    <Drawer title={t("outgoingAction_cancel")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="cancel-reason" label={t("reason")} error={fields.reason}>
        <textarea id="cancel-reason" className={inputClass("reason")} rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !reason.trim()} onClick={() => void save()}>
          {t("outgoingAction_cancel")}
        </button>
      </div>
    </Drawer>
  );
}

function IssueDrawer({ outgoing, onClose, onDone }: { outgoing: OutgoingResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeDocuments");
  const common = useTranslations("common");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [file, setFile] = useState<File | null>(null);
  const save = () =>
    run(async () => {
      const form = new FormData();
      if (file) form.append("file", file);
      form.append("version", String(outgoing.version));
      await apiUpload(`/office/outgoing/${outgoing.id}/issue`, form);
      onDone();
    });
  return (
    <Drawer title={t("outgoingAction_issue")} onClose={onClose}>
      <FormError text={formError} />
      <p className="chu-thich">{t("issueHint")}</p>
      <Field id="issue-file" label={t("signedFile")} error={fields.file}>
        <input id="issue-file" type="file" className={inputClass("file")} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !file} onClick={() => void save()}>
          {t("outgoingAction_issue")}
        </button>
      </div>
    </Drawer>
  );
}
