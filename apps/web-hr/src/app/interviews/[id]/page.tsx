"use client";

// MAN_HINH_170 phần người phỏng vấn: thông tin rút gọn của ứng viên, sơ yếu lý lịch, phiếu đánh giá của mình (CONG_VIEC_54; QUYTAC_NGHIEPVU_384).
import type { MyInterviewResponse } from "contracts";
import { interviewRecommendations } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/RecruitmentParts";

export default function MyInterviewPage() {
  const t = useTranslations("interviews");
  const candidateText = useTranslations("candidates");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<MyInterviewResponse>(`/hr/my-interviews/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(detail) => (
        <>
          <p>
            <Link href="/interviews">‹ {t("mineTitle")}</Link>
          </p>
          <div className="tieu-de">
            <h1>
              {detail.candidate.fullName} · {detail.interview.postingTitle}
            </h1>
          </div>
          <div className="the">
            <dl className="thong-tin-dong">
              <dt>{t("name")}</dt>
              <dd>{detail.interview.name}</dd>
              <dt>{t("startsAt")}</dt>
              <dd>
                {formatDateTime(detail.interview.startsAt)} · {t("minutes", { count: detail.interview.durationMinutes })}
              </dd>
              <dt>{t(detail.interview.mode === "onsite" ? "location" : "meetingUrl")}</dt>
              <dd>{detail.interview.mode === "onsite" ? detail.interview.location : <a href={detail.interview.meetingUrl ?? "#"}>{detail.interview.meetingUrl}</a>}</dd>
              <dt>{candidateText("educationLevel")}</dt>
              <dd>{detail.candidate.educationLevel ? candidateText(`education_${detail.candidate.educationLevel}`) : "—"}</dd>
              <dt>{candidateText("experienceYears")}</dt>
              <dd>{detail.candidate.experienceYears === null ? "—" : candidateText("years", { count: detail.candidate.experienceYears })}</dd>
              <dt>{candidateText("coverLetter")}</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{detail.candidate.coverLetter ?? "—"}</dd>
              <dt>{candidateText("fileKind_resume")}</dt>
              <dd>
                {detail.candidate.resumeFileId ? (
                  <button
                    type="button"
                    className="nut phu"
                    onClick={() =>
                      void apiDownload(`/hr/my-interviews/${id}/files/${detail.candidate.resumeFileId}`, detail.candidate.resumeFileName ?? "cv").catch((error: unknown) =>
                        notify(failureOf(error).message, "loi"),
                      )
                    }
                  >
                    {detail.candidate.resumeFileName}
                  </button>
                ) : (
                  "—"
                )}
              </dd>
            </dl>
          </div>
          {detail.canEvaluate ? <EvaluationForm detail={detail} onSaved={() => void reload()} /> : <div className="khoi-canh-bao thong-tin">{t("evaluationClosed")}</div>}
          <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <h2>{t("evaluations")}</h2>
            {detail.myEvaluation ? (
              <Table
                headings={[t("interviewer"), t("score"), t("recommendation"), t("comment")]}
                rows={detail.interview.evaluations.map((item) => ({
                  key: item.interviewerId,
                  cells: [item.interviewerName, `${item.score}/5`, t(`recommendation_${item.recommendation}`), item.comment ?? "—"],
                }))}
              />
            ) : (
              <span className="chu-thich">{t("othersHidden")}</span>
            )}
          </div>
        </>
      )}
    </Loaded>
  );
}

function EvaluationForm({ detail, onSaved }: { detail: MyInterviewResponse; onSaved: () => void }) {
  const t = useTranslations("interviews");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState({
    score: String(detail.myEvaluation?.score ?? 3),
    recommendation: detail.myEvaluation?.recommendation ?? "consider",
    comment: detail.myEvaluation?.comment ?? "",
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/my-interviews/${detail.interview.id}/evaluation`, { method: "POST", body: JSON.stringify(values) });
      notify(t("evaluationSaved"));
      onSaved();
    });
  };
  return (
    <form className="the" onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
      <h2>{t("yourEvaluation")}</h2>
      <FormError text={formError} />
      <div className="hai-cot">
        <Field id="phieu-diem" label={t("scoreInput")} error={fields.score}>
          <select id="phieu-diem" className={inputClass("score")} value={values.score} onChange={(event) => setValues({ ...values, score: event.target.value })}>
            {[1, 2, 3, 4, 5].map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </Field>
        <Field id="phieu-de-xuat" label={t("recommendation")} error={fields.recommendation}>
          <select
            id="phieu-de-xuat"
            className={inputClass("recommendation")}
            value={values.recommendation}
            onChange={(event) => setValues({ ...values, recommendation: event.target.value as typeof values.recommendation })}
          >
            {interviewRecommendations.map((value) => (
              <option key={value} value={value}>
                {t(`recommendation_${value}`)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field id="phieu-nhan-xet" label={t("comment")} error={fields.comment}>
        <textarea id="phieu-nhan-xet" rows={4} className={inputClass("comment")} value={values.comment} onChange={(event) => setValues({ ...values, comment: event.target.value })} maxLength={4000} />
      </Field>
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {detail.myEvaluation ? t("updateEvaluation") : t("submitEvaluation")}
        </button>
      </div>
    </form>
  );
}
