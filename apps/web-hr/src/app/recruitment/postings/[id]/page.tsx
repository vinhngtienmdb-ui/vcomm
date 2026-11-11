"use client";

// MAN_HINH_169 Tin tuyển dụng (CHUC_NANG_190, 191; API_201, API_202): đầu trang, đếm theo giai đoạn, hồ sơ ứng tuyển; sửa, đăng, đóng, mở lại; thêm ứng viên, thêm từ kho.
import type { ApplicationStage, CandidateListResponse, JobPostingResponse, RecruitmentOptionsResponse } from "contracts";
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
import { formatDate, formatDateTime, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { CandidateForm, CandidateLink, PostingForm, postingStatusClass, salaryRange, StageBadge, Table } from "@/components/RecruitmentParts";

const filters = ["all", "new", "screening", "interview", "offer", "hired", "ended"] as const;

export default function JobPostingPage() {
  const t = useTranslations("recruitment");
  const candidateText = useTranslations("candidates");
  const router = useRouter();
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<JobPostingResponse>(`/hr/job-postings/${id}`);
  const options = useApi<RecruitmentOptionsResponse>("/hr/recruitment-options");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [drawer, setDrawer] = useState<"edit" | "candidate" | "pool" | "reopen" | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (path: string, done: string) => {
    setBusy(true);
    try {
      await apiFetch(`/hr/job-postings/${id}/${path}`, { method: "POST" });
      notify(done);
      await reload();
      await options.reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(posting) => {
        const total = Object.values(posting.stageCounts).reduce((sum, value) => sum + value, 0);
        const shown = posting.applications.filter((item) => (filter === "all" ? true : filter === "ended" ? item.outcome !== null : item.outcome === null && item.stage === filter));
        const salary =
          posting.salaryDisplay === "negotiable"
            ? t("negotiable")
            : posting.salaryDisplay === "custom_range"
              ? salaryRange(posting.salaryMin, posting.salaryMax)
              : salaryRange(posting.requestSalaryMin, posting.requestSalaryMax);
        return (
          <>
            <p>
              <Link href={`/recruitment/${posting.requestId}`}>‹ {posting.requestNo ?? t("title")}</Link>
            </p>
            <div className="tieu-de">
              <h1>
                {posting.title} <span className={`nhan ${postingStatusClass[posting.status]}`}>{t(`postingStatus_${posting.status}`)}</span>{" "}
                {posting.isPublic && <span className="nhan thong-tin">{t("public")}</span>}
              </h1>
              {posting.canEdit && (
                <button type="button" className="nut phu" onClick={() => setDrawer("edit")}>
                  {t("editPosting")}
                </button>
              )}
              {posting.canPublish && (
                <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act("publish", t("published"))}>
                  {t("publish")}
                </button>
              )}
              {posting.status === "open" && posting.isPublic && (
                <a className="nut phu" href={`/hr/careers/${posting.id}`} target="_blank" rel="noreferrer">
                  {t("viewPublic")}
                </a>
              )}
              {posting.canClose && (
                <button type="button" className="nut nguy-hiem" disabled={busy} onClick={() => void act("close", t("postingClosed"))}>
                  {t("closePosting")}
                </button>
              )}
              {posting.canReopen && (
                <button type="button" className="nut phu" onClick={() => setDrawer("reopen")}>
                  {t("reopen")}
                </button>
              )}
              <HistoryLink entityType="job_posting" entityId={posting.id} />
            </div>
            <div className="the">
              <dl className="thong-tin-dong">
                <dt>{t("request")}</dt>
                <dd>
                  <Link href={`/recruitment/${posting.requestId}`}>{posting.requestNo ?? "—"}</Link> · {t("headcountValue", { headcount: posting.requestHeadcount, hired: posting.requestHiredCount })}
                </dd>
                <dt>{t("deadline")}</dt>
                <dd>{formatDate(posting.deadline)}</dd>
                <dt>{t("location")}</dt>
                <dd>
                  {posting.location} · {t(`workType_${posting.workType}`)}
                </dd>
                <dt>{t("salaryDisplay")}</dt>
                <dd>{salary}</dd>
                <dt>{t("contactEmail")}</dt>
                <dd>{posting.contactEmail}</dd>
              </dl>
            </div>
            <div className="bo-loc" role="group" aria-label={t("stageFilter")}>
              {filters.map((value) => (
                <button key={value} type="button" className={`nut ${filter === value ? "chinh" : "phu"}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                  {value === "all" ? t("allStages") : value === "ended" ? t("ended") : candidateText(`stage_${value as ApplicationStage}`)}{" "}
                  <span className="huy-hieu">{value === "all" ? total : posting.stageCounts[value]}</span>
                </button>
              ))}
            </div>
            <div className="tieu-de">
              <h2>{t("applications")}</h2>
              {posting.status === "open" && (
                <>
                  <button type="button" className="nut chinh" onClick={() => setDrawer("candidate")}>
                    {candidateText("create")}
                  </button>
                  <button type="button" className="nut phu" onClick={() => setDrawer("pool")}>
                    {candidateText("addFromPool")}
                  </button>
                </>
              )}
            </div>
            {shown.length === 0 ? (
              <MessageView text={t("noApplications")} />
            ) : (
              <Table
                headings={[candidateText("fullName"), candidateText("source"), candidateText("appliedAt"), candidateText("experienceYears"), candidateText("stage"), ""]}
                rows={shown.map((item) => ({
                  key: item.id,
                  cells: [
                    <CandidateLink key="ten" id={item.candidateId} name={item.candidateName} />,
                    candidateText(`source_${item.source}`),
                    formatDateTime(item.createdAt),
                    item.experienceYears === null ? "—" : candidateText("years", { count: item.experienceYears }),
                    <StageBadge key="gd" application={item} />,
                    item.possibleDuplicate ? (
                      <span key="trung" className="nhan canh-bao">
                        {candidateText("possibleDuplicate")}
                      </span>
                    ) : (
                      ""
                    ),
                  ],
                }))}
              />
            )}
            {drawer === "edit" && options.state.kind === "ready" && (
              <PostingForm
                options={options.state.data}
                requestId={posting.requestId}
                current={posting}
                onClose={() => setDrawer(null)}
                onSaved={() => {
                  setDrawer(null);
                  void reload();
                }}
              />
            )}
            {drawer === "candidate" && options.state.kind === "ready" && (
              <CandidateForm options={options.state.data} postingId={posting.id} onClose={() => setDrawer(null)} onSaved={(candidateId) => router.push(`/candidates/${candidateId}`)} />
            )}
            {drawer === "pool" && (
              <PoolDrawer
                postingId={posting.id}
                onClose={() => setDrawer(null)}
                onDone={() => {
                  setDrawer(null);
                  void reload();
                }}
              />
            )}
            {drawer === "reopen" && (
              <ReopenDrawer
                postingId={posting.id}
                onClose={() => setDrawer(null)}
                onDone={() => {
                  setDrawer(null);
                  void reload();
                }}
              />
            )}
          </>
        );
      }}
    </Loaded>
  );
}

function PoolDrawer({ postingId, onClose, onDone }: { postingId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("candidates");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const pool = useApi<CandidateListResponse>("/hr/candidates?tab=pool&pageSize=100");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [candidateId, setCandidateId] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/candidates/${candidateId}/applications`, { method: "POST", body: JSON.stringify({ postingId }) });
      notify(t("applicationAdded"));
      onDone();
    });
  };
  return (
    <Drawer title={t("addFromPool")} onClose={onClose}>
      <Loaded state={pool.state} onRetry={() => void pool.reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("poolEmpty")} />
          ) : (
            <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
              <FormError text={formError} />
              <Field id="kho-ung-vien" label={t("poolCandidate")} error={fields.postingId}>
                <select id="kho-ung-vien" className={inputClass("postingId")} value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
                  <option value="">{t("notSelected")}</option>
                  {result.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName} · {t("poolUntil", { date: formatDate(item.poolUntil) })}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="nhom-nut">
                <button type="button" className="nut phu" onClick={onClose}>
                  {common("cancel")}
                </button>
                <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !candidateId}>
                  {t("addToPosting")}
                </button>
              </div>
            </form>
          )
        }
      </Loaded>
    </Drawer>
  );
}

function ReopenDrawer({ postingId, onClose, onDone }: { postingId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("recruitment");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [deadline, setDeadline] = useState(vietnamToday());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/job-postings/${postingId}/reopen`, { method: "POST", body: JSON.stringify({ deadline }) });
      notify(t("published"));
      onDone();
    });
  };
  return (
    <Drawer title={t("reopen")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="han-moi" label={t("deadline")} error={fields.deadline}>
          <input id="han-moi" type="date" className={inputClass("deadline")} value={deadline} onChange={(event) => setDeadline(event.target.value)} />
        </Field>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("reopen")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
