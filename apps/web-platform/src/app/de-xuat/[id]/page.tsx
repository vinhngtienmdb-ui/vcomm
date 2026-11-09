"use client";

// MAN_HINH_21 Đề xuất: lập mới theo mẫu (?mau=), sửa nháp, xem; gửi duyệt, rút, xóa nháp, tệp đính kèm, PDF (CHUC_NANG_28, 29; API_51 đến API_53).
import type { ProposalField, ProposalResponse, ProposalTemplateResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { ConfirmDialog } from "@/components/Dialogs";
import { Field, FormError, useSubmit } from "@/components/Form";
import { Attachments, ProposalFieldsForm, ProposalFieldsView, type ProposalValues, proposalStatusTone, valuesForApi } from "@/components/ProposalContent";
import { Loaded, LoadingView, MessageView } from "@/components/StatusViews";
import { UserShell } from "@/components/UserShell";
import { apiDownload, apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { failureOf, useApi } from "@/lib/use-api";

export default function ProposalPage() {
  return (
    <UserShell maxWidth={900}>
      {() => (
        <Suspense fallback={<LoadingView />}>
          <ProposalRoute />
        </Suspense>
      )}
    </UserShell>
  );
}

function ProposalRoute() {
  const { id } = useParams<{ id: string }>();
  const templateId = useSearchParams().get("mau");
  if (id === "moi") return <NewProposal templateId={templateId} />;
  return <ExistingProposal id={id} />;
}

function NewProposal({ templateId }: { templateId: string | null }) {
  const t = useTranslations("proposals");
  const { state, reload } = useApi<ProposalTemplateResponse[]>("/proposal-templates");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(templates) => {
        const template = templates.find((item) => item.id === templateId);
        if (!template) return <MessageView text={t("noTemplate")} />;
        return (
          <>
            <div className="tieu-de">
              <h1>{t("newTitle", { template: template.name })}</h1>
            </div>
            {!template.hasPolicy && (
              <div className="khoi-canh-bao canh-bao" role="status">
                {t("noPolicy")}
              </div>
            )}
            <ProposalEditor templateId={template.id} fields={template.fields} currency={template.currency} initialTitle={template.name} initialValues={{}} canSubmit={template.hasPolicy} />
          </>
        );
      }}
    </Loaded>
  );
}

// Giá trị từ API dùng dấu chấm thập phân; ô nhập tiếng Việt dùng dấu phẩy thập phân, dấu chấm hàng nghìn.
function toInput(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") return "";
  const [whole = "", fraction] = String(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction ? `${grouped},${fraction}` : grouped;
}

function inputValues(fields: ProposalField[], values: Record<string, unknown>): ProposalValues {
  const result: ProposalValues = {};
  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined || value === null) continue;
    if (field.type === "lines") {
      result[field.key] = ((value as Record<string, unknown>[]) ?? []).map((line) =>
        Object.fromEntries((field.columns ?? []).map((column) => [column.key, column.type === "text" ? String(line[column.key] ?? "") : toInput(line[column.key])])),
      );
    } else result[field.key] = field.type === "money" || field.type === "number" ? toInput(value) : String(value);
  }
  return result;
}

function ProposalEditor({
  proposal,
  templateId,
  fields,
  currency,
  initialTitle,
  initialValues,
  canSubmit,
  onSaved,
}: {
  proposal?: ProposalResponse;
  templateId: string;
  fields: ProposalField[];
  currency: string;
  initialTitle: string;
  initialValues: ProposalValues;
  canSubmit: boolean;
  onSaved?: (text: string) => void;
}) {
  const t = useTranslations("proposals");
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [values, setValues] = useState<ProposalValues>(initialValues);
  const [confirming, setConfirming] = useState(false);
  const { submitting, fields: errors, formError, run, inputClass } = useSubmit();

  async function save(): Promise<ProposalResponse> {
    const body = JSON.stringify({ templateId, title, values: valuesForApi(fields, values), ...(proposal ? { version: proposal.version } : {}) });
    return proposal ? apiFetch<ProposalResponse>(`/proposals/${proposal.id}`, { method: "PATCH", body }) : apiFetch<ProposalResponse>("/proposals", { method: "POST", body });
  }

  function saveDraft(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const saved = await save();
      if (proposal) onSaved?.(t("saved"));
      else router.replace(`/de-xuat/${saved.id}?luu=1`);
    });
  }

  function submit() {
    setConfirming(false);
    void run(async () => {
      const saved = await save();
      await apiFetch(`/proposals/${saved.id}/submit`, { method: "POST" });
      if (proposal) onSaved?.(t("submitted"));
      else router.replace(`/de-xuat/${saved.id}?gui=1`);
    });
  }

  return (
    <form className="the" onSubmit={saveDraft} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <Field id="tieu-de-de-xuat" label={`${t("titleField")} *`} error={errors.title}>
        <input id="tieu-de-de-xuat" className={inputClass("title")} maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <ProposalFieldsForm fields={fields} values={values} errors={errors} currency={currency} onChange={setValues} />
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("saveDraft")}
        </button>
        <button type="button" className="nut chinh" disabled={submitting || !canSubmit} onClick={() => setConfirming(true)}>
          {t("submit")}
        </button>
      </div>
      {confirming && <ConfirmDialog title={t("submitTitle")} text={t("submitText")} confirmLabel={t("submit")} busy={submitting} onConfirm={submit} onClose={() => setConfirming(false)} />}
    </form>
  );
}

function ExistingProposal({ id }: { id: string }) {
  const t = useTranslations("proposals");
  const router = useRouter();
  const search = useSearchParams();
  const { state, reload } = useApi<ProposalResponse>(`/proposals/${id}`);
  const [notice, setNotice] = useState<{ text: string; kind: "thong-tin" | "loi" } | null>(
    search.get("luu") ? { text: t("saved"), kind: "thong-tin" } : search.get("gui") ? { text: t("submitted"), kind: "thong-tin" } : null,
  );
  const [action, setAction] = useState<"withdraw" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const notify = (text: string, kind: "thanh-cong" | "loi" = "thanh-cong") => setNotice({ text, kind: kind === "loi" ? "loi" : "thong-tin" });

  async function confirmAction() {
    setBusy(true);
    setActionError(null);
    try {
      if (action === "delete") {
        await apiFetch(`/proposals/${id}`, { method: "DELETE" });
        router.replace("/de-xuat");
        return;
      }
      await apiFetch(`/proposals/${id}/withdraw`, { method: "POST" });
      setAction(null);
      notify(t("withdrawn"));
      await reload();
    } catch (failure) {
      setActionError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(proposal) => (
        <>
          <div className="tieu-de">
            <h1>
              {proposal.proposalNo ?? proposal.template.name} <span className={`nhan ${proposalStatusTone[proposal.status]}`}>{t(`status_${proposal.status}`)}</span>
            </h1>
            {proposal.approvalRequestId && (
              <Link className="nut phu" href={`/hop-duyet/${proposal.approvalRequestId}`}>
                {t("approval")}
              </Link>
            )}
            <button
              type="button"
              className="nut phu"
              onClick={() => void apiDownload(`/proposals/${proposal.id}/pdf`, `${proposal.proposalNo ?? "de-xuat"}.pdf`, true).catch((failure) => notify(failureOf(failure).message, "loi"))}
            >
              {t("pdf")}
            </button>
            {proposal.canWithdraw && (
              <button type="button" className="nut phu" onClick={() => setAction("withdraw")}>
                {t("withdraw")}
              </button>
            )}
            {proposal.canEdit && (
              <button type="button" className="nut nguy-hiem" onClick={() => setAction("delete")}>
                {t("delete")}
              </button>
            )}
          </div>
          {notice && (
            <div className={`khoi-canh-bao ${notice.kind}`} role={notice.kind === "loi" ? "alert" : "status"}>
              {notice.text}
            </div>
          )}
          <div className="chu-thich">
            {t("requestedBy")}: {proposal.requestedByName} · {t("createdAt")}: {formatDateTime(proposal.createdAt)} · {proposal.template.name}
          </div>
          {proposal.canEdit ? (
            <ProposalEditor
              key={proposal.version}
              proposal={proposal}
              templateId={proposal.templateId}
              fields={proposal.template.fields}
              currency={proposal.currency}
              initialTitle={proposal.title}
              initialValues={inputValues(proposal.template.fields, proposal.values)}
              canSubmit
              onSaved={(text) => {
                notify(text);
                void reload();
              }}
            />
          ) : (
            <div className="the">
              <h2 style={{ margin: 0 }}>{proposal.title}</h2>
              <ProposalFieldsView proposal={proposal} />
            </div>
          )}
          <div className="the">
            <Attachments proposal={proposal} onChanged={() => void reload()} notify={notify} />
          </div>
          {action && (
            <ConfirmDialog
              title={t(action)}
              text={t(action === "delete" ? "deleteText" : "withdrawText")}
              confirmLabel={t(action)}
              busy={busy}
              error={actionError}
              onConfirm={() => void confirmAction()}
              onClose={() => setAction(null)}
            />
          )}
        </>
      )}
    </Loaded>
  );
}
