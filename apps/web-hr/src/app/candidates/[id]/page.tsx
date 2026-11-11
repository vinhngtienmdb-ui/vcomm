"use client";

// MAN_HINH_170 chi tiết ứng viên (CHUC_NANG_191; API_202): thông tin, tệp, hồ sơ ứng tuyển (chuyển giai đoạn, loại, rút), đồng ý và lưu giữ.
import type { ApplicationItem, CandidateProcessResponse, CandidateResponse, RecruitmentOptionsResponse } from "contracts";
import { applicationOutcomeReasons } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { EmailsTab, InterviewsTab, OffersTab, RetentionActions } from "@/components/CandidateProcess";
import { CandidateLink, money, StageBadge, Table } from "@/components/RecruitmentParts";

const tabs = ["info", "applications", "interviews", "offers", "emails", "consents"] as const;
const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} MB`;

export default function CandidatePage() {
  const t = useTranslations("candidates");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload: reloadCandidate } = useApi<CandidateResponse>(`/hr/candidates/${id}`);
  const process = useApi<CandidateProcessResponse>(`/hr/candidates/${id}/process`);
  const options = useApi<RecruitmentOptionsResponse>("/hr/recruitment-options");
  const reload = async () => {
    await Promise.all([reloadCandidate(), process.reload()]);
  };
  const [tab, setTab] = useState<(typeof tabs)[number]>("info");
  const [ending, setEnding] = useState<{ application: ApplicationItem; outcome: "rejected" | "withdrawn" } | null>(null);
  const download = async (fileId: string, fileName: string) => {
    try {
      await apiDownload(`/hr/candidate-files/${fileId}`, fileName);
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  };
  const move = async (application: ApplicationItem, stage: string) => {
    try {
      await apiFetch(`/hr/applications/${application.id}/stage`, { method: "POST", body: JSON.stringify({ stage }) });
      notify(t("stageMoved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    }
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(candidate) => {
        const latest = candidate.applications[0];
        return (
          <>
            <p>
              <Link href="/candidates">‹ {t("title")}</Link>
            </p>
            <div className="tieu-de">
              <h1>
                {candidate.erasedAt ? t("erasedName") : candidate.fullName} {latest && <StageBadge application={latest} />}{" "}
                {candidate.possibleDuplicate && <span className="nhan canh-bao">{t("possibleDuplicate")}</span>}
              </h1>
              <HistoryLink entityType="candidate" entityId={candidate.id} />
            </div>
            {candidate.erasedAt && <div className="khoi-canh-bao loi">{t("erasedNotice", { date: formatDateTime(candidate.erasedAt) })}</div>}
            {candidate.duplicates.length > 0 && (
              <div className="khoi-canh-bao canh-bao">
                {t("duplicatesOf")}{" "}
                {candidate.duplicates.map((other, index) => (
                  <span key={other.id}>
                    {index > 0 && ", "}
                    <CandidateLink id={other.id} name={`${other.fullName} (${other.reference})`} />
                  </span>
                ))}
              </div>
            )}
            <div className="cac-the" role="tablist">
              {tabs.map((value) => (
                <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => setTab(value)}>
                  {t(`detailTab_${value}`)}
                </button>
              ))}
            </div>
            {tab === "info" && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                <dl className="thong-tin-dong">
                  <dt>{t("reference")}</dt>
                  <dd>{candidate.reference}</dd>
                  <dt>{t("email")}</dt>
                  <dd>{candidate.email ?? "—"}</dd>
                  <dt>{t("phone")}</dt>
                  <dd>{candidate.phone ?? "—"}</dd>
                  <dt>{t("province")}</dt>
                  <dd>{candidate.province ?? "—"}</dd>
                  <dt>{t("educationLevel")}</dt>
                  <dd>{candidate.educationLevel ? t(`education_${candidate.educationLevel}`) : "—"}</dd>
                  <dt>{t("experienceYears")}</dt>
                  <dd>{candidate.experienceYears === null ? "—" : t("years", { count: candidate.experienceYears })}</dd>
                  <dt>{t("expectedSalary")}</dt>
                  <dd>{money(candidate.expectedSalary)}</dd>
                  <dt>{t("source")}</dt>
                  <dd>
                    {t(`source_${candidate.source}`)}
                    {candidate.sourceNote ? ` · ${candidate.sourceNote}` : ""}
                  </dd>
                  <dt>{t("coverLetter")}</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>{candidate.coverLetter ?? "—"}</dd>
                </dl>
                <h2>{t("files")}</h2>
                {candidate.files.length === 0 ? (
                  <MessageView text={t("noFiles")} />
                ) : (
                  <Table
                    headings={[t("fileKind"), t("fileName"), t("fileSize"), t("uploadedAt"), ""]}
                    rows={candidate.files.map((file) => ({
                      key: file.id,
                      cells: [
                        t(`fileKind_${file.kind}`),
                        file.fileName,
                        formatSize(file.sizeBytes),
                        formatDateTime(file.uploadedAt),
                        file.available ? (
                          <button key="tai" type="button" className="nut phu" onClick={() => void download(file.id, file.fileName)}>
                            {t("download")}
                          </button>
                        ) : (
                          t("fileErased")
                        ),
                      ],
                    }))}
                  />
                )}
              </div>
            )}
            {tab === "applications" && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                {candidate.applications.map((application) => (
                  <div key={application.id} style={{ display: "grid", gap: "var(--khoang-2)" }}>
                    <div className="tieu-de">
                      <h2>
                        <Link href={`/recruitment/postings/${application.postingId}`}>{application.postingTitle}</Link> <StageBadge application={application} />
                      </h2>
                      {!application.outcome && ["new", "screening", "interview"].includes(application.stage) && (
                        <>
                          <label className="an-nhan" htmlFor={`gd-${application.id}`}>
                            {t("moveStage")}
                          </label>
                          <select id={`gd-${application.id}`} className="o-nhap" style={{ width: "auto" }} value={application.stage} onChange={(event) => void move(application, event.target.value)}>
                            {(["new", "screening", "interview"] as const).map((stage) => (
                              <option key={stage} value={stage}>
                                {t(`stage_${stage}`)}
                              </option>
                            ))}
                          </select>
                        </>
                      )}
                      {!application.outcome && application.stage !== "hired" && (
                        <>
                          <button type="button" className="nut nguy-hiem" onClick={() => setEnding({ application, outcome: "rejected" })}>
                            {t("reject")}
                          </button>
                          <button type="button" className="nut phu" onClick={() => setEnding({ application, outcome: "withdrawn" })}>
                            {t("withdraw")}
                          </button>
                        </>
                      )}
                    </div>
                    <span className="chu-thich">
                      {t("appliedOn", { date: formatDateTime(application.createdAt) })}
                      {application.endedAt ? ` · ${t("endedOn", { date: formatDateTime(application.endedAt) })}` : ""}
                      {application.outcomeReason ? ` · ${t(`reason_${application.outcomeReason}`)}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {(tab === "interviews" || tab === "offers" || tab === "emails") && (
              <Loaded state={process.state} onRetry={() => void process.reload()}>
                {(loaded) =>
                  tab === "interviews" ? (
                    <InterviewsTab candidate={candidate} process={loaded} onChanged={() => void reload()} />
                  ) : tab === "offers" ? (
                    <OffersTab candidate={candidate} process={loaded} options={options.state.kind === "ready" ? options.state.data : null} onChanged={() => void reload()} />
                  ) : (
                    <EmailsTab process={loaded} />
                  )
                }
              </Loaded>
            )}
            {tab === "consents" && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
                <RetentionActions candidate={candidate} onChanged={() => void reload()} />
                <dl className="thong-tin-dong">
                  <dt>{t("poolStatus")}</dt>
                  <dd>{candidate.poolUntil ? t("poolUntil", { date: formatDate(candidate.poolUntil) }) : t("noPool")}</dd>
                  <dt>{t("eraseDue")}</dt>
                  <dd>{candidate.eraseDue ? formatDate(candidate.eraseDue) : t("eraseDueNone")}</dd>
                </dl>
                <Table
                  headings={[t("consentPurpose"), t("consentChannel"), t("consentDate"), t("consentEvidenceColumn")]}
                  rows={candidate.consents.map((consent) => ({
                    key: consent.id,
                    cells: [
                      `${t(`purpose_${consent.purpose}`)}${consent.postingTitle ? ` · ${consent.postingTitle}` : ""}${consent.withdrawnAt ? ` (${t("withdrawnOn", { date: formatDateTime(consent.withdrawnAt) })})` : ""}`,
                      t(`channel_${consent.channel}`),
                      formatDateTime(consent.consentedAt),
                      consent.termsText ? (
                        <details key="dk">
                          <summary>{t("termsVersion", { version: consent.termsVersion ?? "—", ip: consent.ip ?? "—" })}</summary>
                          <p style={{ whiteSpace: "pre-wrap" }}>{consent.termsText}</p>
                        </details>
                      ) : consent.evidenceFileId ? (
                        t("evidenceFile")
                      ) : (
                        "—"
                      ),
                    ],
                  }))}
                />
              </div>
            )}
            {ending && (
              <EndDrawer
                application={ending.application}
                outcome={ending.outcome}
                onClose={() => setEnding(null)}
                onDone={() => {
                  setEnding(null);
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

// Loại (lý do bắt buộc) hoặc ghi ứng viên rút (QUYTAC_NGHIEPVU_383).
function EndDrawer({ application, outcome, onClose, onDone }: { application: ApplicationItem; outcome: "rejected" | "withdrawn"; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("candidates");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState<string>(outcome === "rejected" ? "not_qualified" : "");
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [message, setMessage] = useState("");
  const canEmail = outcome === "rejected" && (reason === "not_qualified" || reason === "failed_interview");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/applications/${application.id}/end`, { method: "POST", body: JSON.stringify({ outcome, reason: reason || null, note, sendEmail: canEmail && sendEmail, message }) });
      notify(t("ended"));
      onDone();
    });
  };
  return (
    <Drawer title={outcome === "rejected" ? t("reject") : t("withdraw")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="ket-thuc-ly-do" label={t("outcomeReason")} error={fields.reason}>
          <select id="ket-thuc-ly-do" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)}>
            {outcome === "withdrawn" && <option value="">{t("notSelected")}</option>}
            {applicationOutcomeReasons
              .filter((value) => value !== "posting_closed")
              .map((value) => (
                <option key={value} value={value}>
                  {t(`reason_${value}`)}
                </option>
              ))}
          </select>
        </Field>
        <Field id="ket-thuc-ghi-chu" label={t("outcomeNote")} error={fields.note}>
          <textarea id="ket-thuc-ghi-chu" rows={2} className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
        </Field>
        {canEmail && (
          <div className="truong">
            <label>
              <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} /> {t("sendRejection")}
            </label>
          </div>
        )}
        {canEmail && sendEmail && (
          <Field id="ket-thuc-loi-nhan" label={t("message")} error={fields.message}>
            <textarea id="ket-thuc-loi-nhan" rows={2} className={inputClass("message")} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} />
          </Field>
        )}
        <div className="khoi-canh-bao thong-tin">{t("endHint")}</div>
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
