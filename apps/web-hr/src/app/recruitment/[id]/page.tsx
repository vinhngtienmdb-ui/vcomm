"use client";

// MAN_HINH_168 chi tiết nhu cầu tuyển dụng (CHUC_NANG_190; API_200): thông tin, luồng duyệt, tin của nhu cầu; gửi, rút, hủy, đóng, lập tin.
import type { RecruitmentOptionsResponse, RecruitmentRequestResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { PostingForm, postingStatusClass, RequestForm, requestStatusClass, salaryRange, Table } from "@/components/RecruitmentParts";

export default function RecruitmentRequestPage() {
  const t = useTranslations("recruitment");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<RecruitmentRequestResponse>(`/hr/recruitment-requests/${id}`);
  const options = useApi<RecruitmentOptionsResponse>("/hr/recruitment-options");
  const [editing, setEditing] = useState(false);
  const [creatingPosting, setCreatingPosting] = useState(false);
  const [reasonAction, setReasonAction] = useState<"cancel" | "close" | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (path: string, done: string) => {
    setBusy(true);
    try {
      await apiFetch(`/hr/recruitment-requests/${id}/${path}`, { method: "POST" });
      notify(done);
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(item) => (
        <>
          <p>
            <Link href="/recruitment">‹ {t("title")}</Link>
          </p>
          <div className="tieu-de">
            <h1>
              {item.documentNo ?? t("noNumber")} · {item.jobTitle} <span className={`nhan ${requestStatusClass[item.status]}`}>{t(`requestStatus_${item.status}`)}</span>
            </h1>
            {item.canEdit && (
              <button type="button" className="nut phu" onClick={() => setEditing(true)}>
                {t("edit")}
              </button>
            )}
            {item.canSubmit && (
              <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act("submit", t("submitted"))}>
                {t("submit")}
              </button>
            )}
            {item.canWithdraw && (
              <button type="button" className="nut phu" disabled={busy} onClick={() => void act("withdraw", t("withdrawn"))}>
                {t("withdraw")}
              </button>
            )}
            {item.canCancel && (
              <button type="button" className="nut nguy-hiem" onClick={() => setReasonAction("cancel")}>
                {t("cancel")}
              </button>
            )}
            {item.canCreatePosting && (
              <button type="button" className="nut chinh" onClick={() => setCreatingPosting(true)}>
                {t("createPosting")}
              </button>
            )}
            {item.canClose && (
              <button type="button" className="nut nguy-hiem" onClick={() => setReasonAction("close")}>
                {t("close")}
              </button>
            )}
            <HistoryLink entityType="recruitment_request" entityId={item.id} />
          </div>
          {item.cancelReason && <div className="khoi-canh-bao canh-bao">{t("cancelledBecause", { reason: item.cancelReason })}</div>}
          {item.closeReason && <div className="khoi-canh-bao canh-bao">{t("closedBecause", { reason: item.closeReason })}</div>}
          <div className="the">
            <dl className="thong-tin-dong">
              <dt>{t("department")}</dt>
              <dd>
                {item.departmentName} · {item.branchName}
              </dd>
              <dt>{t("headcount")}</dt>
              <dd>{t("headcountValue", { headcount: item.headcount, hired: item.hiredCount })}</dd>
              <dt>{t("contractKind")}</dt>
              <dd>{t(`contractKind_${item.contractKind}`)}</dd>
              <dt>{t("salary")}</dt>
              <dd>{salaryRange(item.salaryMin, item.salaryMax)}</dd>
              <dt>{t("neededBy")}</dt>
              <dd>{formatDate(item.neededBy)}</dd>
              <dt>{t("reason")}</dt>
              <dd>
                {t(`reason_${item.reason}`)}
                {item.description ? ` · ${item.description}` : ""}
              </dd>
              <dt>{t("createdBy")}</dt>
              <dd>{item.createdByName}</dd>
              {item.approvalRequestId && (
                <>
                  <dt>{t("approval")}</dt>
                  <dd>
                    <a href={`/hop-duyet/${item.approvalRequestId}`}>{t("approvalLink")}</a>
                  </dd>
                </>
              )}
            </dl>
          </div>
          {(item.canCreatePosting || item.postings.length > 0) && (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h2>{t("tab_postings")}</h2>
              {item.postings.length === 0 ? (
                <MessageView text={t("noPostings")} />
              ) : (
                <Table
                  headings={[t("postingTitle"), t("deadline"), t("isPublicShort"), t("stageSummary"), t("status")]}
                  rows={item.postings.map((posting) => ({
                    key: posting.id,
                    cells: [
                      <Link key="tin" href={`/recruitment/postings/${posting.id}`}>
                        {posting.title}
                      </Link>,
                      formatDate(posting.deadline),
                      posting.isPublic ? t("yes") : t("no"),
                      `${posting.stageCounts.new} · ${posting.stageCounts.screening} · ${posting.stageCounts.interview} · ${posting.stageCounts.offer}`,
                      <span key="tt" className={`nhan ${postingStatusClass[posting.status]}`}>
                        {t(`postingStatus_${posting.status}`)}
                      </span>,
                    ],
                  }))}
                />
              )}
            </div>
          )}
          {editing && options.state.kind === "ready" && (
            <RequestForm
              options={options.state.data}
              current={item}
              onClose={() => setEditing(false)}
              onSaved={() => {
                setEditing(false);
                void reload();
              }}
            />
          )}
          {creatingPosting && options.state.kind === "ready" && (
            <PostingForm
              options={options.state.data}
              requestId={item.id}
              current={null}
              onClose={() => setCreatingPosting(false)}
              onSaved={(saved) => router.push(`/recruitment/postings/${saved.id}`)}
            />
          )}
          {reasonAction && (
            <ReasonDrawer
              title={reasonAction === "cancel" ? t("cancelTitle") : t("closeTitle")}
              hint={reasonAction === "close" ? t("closeHint") : undefined}
              path={`/hr/recruitment-requests/${item.id}/${reasonAction}`}
              done={reasonAction === "cancel" ? t("cancelled") : t("closed")}
              onClose={() => setReasonAction(null)}
              onDone={() => {
                setReasonAction(null);
                void reload();
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}

function ReasonDrawer({ title, hint, path, done, onClose, onDone }: { title: string; hint?: string | undefined; path: string; done: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("recruitment");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(path, { method: "POST", body: JSON.stringify({ reason }) });
      notify(done);
      onDone();
    });
  };
  return (
    <Drawer title={title} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="ly-do" label={t("reasonText")} error={fields.reason}>
          <textarea id="ly-do" rows={3} className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
        </Field>
        {hint && <div className="khoi-canh-bao canh-bao">{hint}</div>}
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("confirm")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
