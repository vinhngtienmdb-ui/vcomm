"use client";

// MAN_HINH_173 Phiếu đánh giá (CHUC_NANG_192; API_205; QUYTAC_NGHIEPVU_389): mục tiêu, tự đánh giá, người chấm, kết quả; nhân sự mở lại, điều chỉnh; nhân viên xác nhận đã xem.
import type { ReviewResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/RecruitmentParts";
import { PhaseBadge } from "@/components/ReviewParts";

const scores = [1, 2, 3, 4, 5];

export default function ReviewSheetPage() {
  const t = useTranslations("reviews");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<ReviewResponse>(`/hr/reviews/${id}`);
  const [drawer, setDrawer] = useState<"adjust" | "acknowledge" | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (path: string, done: string) => {
    setBusy(true);
    try {
      await apiFetch(path, { method: "POST" });
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
      {(review) => (
        <>
          <p>
            <Link href={review.role.manager ? `/reviews/${review.cycleId}` : "/my-reviews"}>‹ {review.role.manager ? review.cycleName : t("myTitle")}</Link>
          </p>
          <div className="tieu-de">
            <h1>
              {review.employeeCode} · {review.employeeName} <PhaseBadge phase={review.phase} />
            </h1>
            {review.canReopen && (
              <button type="button" className="nut phu" disabled={busy} onClick={() => void act(`/hr/reviews/${id}/reopen`, t("reopened"))}>
                {t("reopen")}
              </button>
            )}
            {review.canAdjust && (
              <button type="button" className="nut phu" onClick={() => setDrawer("adjust")}>
                {t("adjust")}
              </button>
            )}
            {review.canAcknowledge && (
              <button type="button" className="nut chinh" onClick={() => setDrawer("acknowledge")}>
                {t("acknowledge")}
              </button>
            )}
            {review.role.manager && <HistoryLink entityType="review" entityId={review.id} />}
          </div>
          <div className="the">
            <dl className="thong-tin-dong">
              <dt>{t("cycle")}</dt>
              <dd>
                {review.cycleName} ({formatDate(review.periodFrom)} – {formatDate(review.periodTo)})
              </dd>
              <dt>{t("department")}</dt>
              <dd>{review.departmentName ?? "—"}</dd>
              <dt>{t("reviewer")}</dt>
              <dd>{review.reviewerName ?? t("unassignedOption")}</dd>
              <dt>{t("deadlines")}</dt>
              <dd>{t("deadlinesValue", { goal: formatDate(review.goalDeadline), self: formatDate(review.selfDeadline), manager: formatDate(review.managerDeadline) })}</dd>
              <dt>{t("weights")}</dt>
              <dd>{t("weightsValue", { goal: review.goalWeight, competency: review.competencyWeight })}</dd>
            </dl>
          </div>
          {review.goalWeight > 0 && <GoalsSection review={review} busy={busy} act={act} onSaved={() => void reload()} />}
          {review.canSelfAssess || review.canScore ? (
            <ScoresForm key={`${review.phase}-${review.canScore}`} review={review} kind={review.canScore ? "manager" : "self"} onSaved={() => void reload()} />
          ) : (
            <ScoresView review={review} />
          )}
          <ResultView review={review} />
          {drawer === "adjust" && (
            <AdjustDrawer
              review={review}
              onClose={() => setDrawer(null)}
              onDone={() => {
                setDrawer(null);
                void reload();
              }}
            />
          )}
          {drawer === "acknowledge" && (
            <AcknowledgeDrawer
              reviewId={review.id}
              onClose={() => setDrawer(null)}
              onDone={() => {
                setDrawer(null);
                void reload();
              }}
            />
          )}
        </>
      )}
    </Loaded>
  );
}

function GoalsSection({ review, busy, act, onSaved }: { review: ReviewResponse; busy: boolean; act: (path: string, done: string) => Promise<void>; onSaved: () => void }) {
  const t = useTranslations("reviews");
  const [editing, setEditing] = useState(false);
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("goalsHeading")}</h2>
        {review.goalsConfirmedAt ? (
          <span className="nhan thanh-cong">{t("goalsConfirmedAt", { time: formatDateTime(review.goalsConfirmedAt) })}</span>
        ) : (
          <span className="nhan canh-bao">{t("goalsPending")}</span>
        )}
        {review.canEditGoals && !editing && (
          <button type="button" className="nut phu" onClick={() => setEditing(true)}>
            {t("editGoals")}
          </button>
        )}
        {review.canConfirmGoals && !editing && (
          <button type="button" className="nut chinh" disabled={busy || review.goals.length === 0} onClick={() => void act(`/hr/reviews/${review.id}/goals/confirm`, t("goalsConfirmed"))}>
            {t("confirmGoals")}
          </button>
        )}
        {review.canUnconfirmGoals && (
          <button type="button" className="nut phu" disabled={busy} onClick={() => void act(`/hr/reviews/${review.id}/goals/reopen`, t("goalsReopened"))}>
            {t("unconfirmGoals")}
          </button>
        )}
      </div>
      {editing ? (
        <GoalsForm
          review={review}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
        />
      ) : review.goals.length === 0 ? (
        <span className="chu-thich">{t("noGoals")}</span>
      ) : (
        <Table headings={[t("goalName"), t("goalTarget"), t("weight")]} rows={review.goals.map((goal) => ({ key: goal.id, cells: [goal.name, goal.target ?? "—", `${goal.weight}%`] }))} />
      )}
    </section>
  );
}

function GoalsForm({ review, onCancel, onSaved }: { review: ReviewResponse; onCancel: () => void; onSaved: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [goals, setGoals] = useState(
    review.goals.length ? review.goals.map((goal) => ({ name: goal.name, target: goal.target ?? "", weight: String(goal.weight) })) : [{ name: "", target: "", weight: "100" }],
  );
  const total = goals.reduce((sum, goal) => sum + (Number(goal.weight) || 0), 0);
  const update = (index: number, key: "name" | "target" | "weight", value: string) => setGoals(goals.map((goal, position) => (position === index ? { ...goal, [key]: value } : goal)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/reviews/${review.id}/goals`, { method: "PUT", body: JSON.stringify({ goals: goals.map((goal) => ({ ...goal, weight: Number(goal.weight) })) }) });
      notify(common("saved"));
      onSaved();
    });
  };
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
      <FormError text={formError} />
      {goals.map((goal, index) => (
        <div key={index} className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <Field id={`mt-ten-${index}`} label={t("goalNumber", { number: index + 1 })} error={fields[`goals.${index}.name`]}>
            <input id={`mt-ten-${index}`} className={inputClass(`goals.${index}.name`)} value={goal.name} onChange={(event) => update(index, "name", event.target.value)} maxLength={200} />
          </Field>
          <Field id={`mt-chi-tieu-${index}`} label={t("goalTarget")}>
            <input id={`mt-chi-tieu-${index}`} className="o-nhap" value={goal.target} onChange={(event) => update(index, "target", event.target.value)} maxLength={1000} />
          </Field>
          <Field id={`mt-trong-so-${index}`} label={t("weight")} error={fields[`goals.${index}.weight`]}>
            <input
              id={`mt-trong-so-${index}`}
              type="number"
              min={1}
              max={100}
              className={inputClass(`goals.${index}.weight`)}
              value={goal.weight}
              onChange={(event) => update(index, "weight", event.target.value)}
            />
          </Field>
          {goals.length > 1 && (
            <button type="button" className="nut phu" onClick={() => setGoals(goals.filter((_, position) => position !== index))}>
              {t("removeGoal")}
            </button>
          )}
        </div>
      ))}
      <button type="button" className="nut phu" disabled={goals.length >= 20} onClick={() => setGoals([...goals, { name: "", target: "", weight: "0" }])}>
        {t("addGoal")}
      </button>
      <span className={total === 100 ? "chu-thich" : "loi-o"}>{t("totalWeight", { total })}</span>
      {fields.goals && <span className="loi-o">{fields.goals}</span>}
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onCancel}>
          {common("cancel")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {common("save")}
        </button>
      </div>
    </form>
  );
}

function ScoreSelect({ id, value, onChange, label }: { id: string; value: number | null; onChange: (value: number | null) => void; label: string }) {
  return (
    <select id={id} aria-label={label} className="o-nhap" value={value ?? ""} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}>
      <option value="">—</option>
      {scores.map((score) => (
        <option key={score} value={score}>
          {score}
        </option>
      ))}
    </select>
  );
}

function ScoresForm({ review, kind, onSaved }: { review: ReviewResponse; kind: "self" | "manager"; onSaved: () => void }) {
  const t = useTranslations("reviews");
  const { notify } = useAdmin();
  const { submitting, formError, run } = useSubmit();
  const pick = (item: { selfScore: number | null; managerScore: number | null }) => (kind === "self" ? item.selfScore : item.managerScore);
  const [goals, setGoals] = useState<Record<string, number | null>>(Object.fromEntries(review.goals.map((goal) => [goal.id, pick(goal)])));
  const [criteria, setCriteria] = useState<Record<string, number | null>>(Object.fromEntries(review.criteria.map((item) => [item.id, pick(item)])));
  const [comment, setComment] = useState((kind === "self" ? review.selfComment : review.managerComment) ?? "");
  const save = (submit: boolean) =>
    void run(async () => {
      const body = {
        goals: Object.entries(goals).map(([id, score]) => ({ id, score })),
        criteria: Object.entries(criteria).map(([id, score]) => ({ id, score })),
        comment,
        submit,
      };
      await apiFetch(`/hr/reviews/${review.id}/${kind === "self" ? "self-assessment" : "manager-assessment"}`, { method: "PUT", body: JSON.stringify(body) });
      notify(submit ? t("submitted") : t("draftSaved"));
      onSaved();
    });
  const showSelf = kind === "manager";
  const headings = [t("item"), t("weight"), ...(showSelf ? [t("selfScore")] : []), kind === "self" ? t("selfScore") : t("managerScore")];
  const row = (
    prefix: string,
    item: { id: string; name: string; weight: number; selfScore: number | null },
    values: Record<string, number | null>,
    set: (next: Record<string, number | null>) => void,
  ) => ({
    key: item.id,
    cells: [
      item.name,
      `${item.weight}%`,
      ...(showSelf ? [item.selfScore ?? "—"] : []),
      <ScoreSelect key="diem" id={`${prefix}-${item.id}`} label={item.name} value={values[item.id] ?? null} onChange={(score) => set({ ...values, [item.id]: score })} />,
    ],
  });
  const event = (submit: boolean) => (formEvent: FormEvent) => {
    formEvent.preventDefault();
    save(submit);
  };
  return (
    <form className="the" onSubmit={event(true)} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
      <h2>{kind === "self" ? t("selfHeading") : t("managerHeading")}</h2>
      <span className="chu-thich">{t("scaleHint")}</span>
      <FormError text={formError} />
      {review.goalWeight > 0 && review.goals.length > 0 && (
        <>
          <h3>{t("goalsHeading")}</h3>
          <Table headings={headings} rows={review.goals.map((goal) => row("diem-mt", goal, goals, setGoals))} />
        </>
      )}
      {review.competencyWeight > 0 && (
        <>
          <h3>{t("criteriaHeading")}</h3>
          <Table headings={headings} rows={review.criteria.map((item) => row("diem-tc", item, criteria, setCriteria))} />
        </>
      )}
      {showSelf && review.selfComment && (
        <div className="khoi-canh-bao thong-tin">
          {t("selfComment")}: {review.selfComment}
        </div>
      )}
      <Field id="nhan-xet" label={kind === "self" ? t("selfComment") : t("managerComment")}>
        <textarea id="nhan-xet" rows={3} className="o-nhap" value={comment} onChange={(changeEvent) => setComment(changeEvent.target.value)} maxLength={4000} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" disabled={submitting} onClick={() => save(false)}>
          {t("saveDraft")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("submit")}
        </button>
      </div>
    </form>
  );
}

function ScoresView({ review }: { review: ReviewResponse }) {
  const t = useTranslations("reviews");
  const showManager = review.goals.some((goal) => goal.managerScore !== null) || review.criteria.some((item) => item.managerScore !== null);
  const headings = [t("item"), t("weight"), t("selfScore"), ...(showManager ? [t("managerScore")] : [])];
  const row = (item: { id: string; name: string; weight: number; selfScore: number | null; managerScore: number | null }) => ({
    key: item.id,
    cells: [item.name, `${item.weight}%`, item.selfScore ?? "—", ...(showManager ? [item.managerScore ?? "—"] : [])],
  });
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("assessmentHeading")}</h2>
      {review.goalWeight > 0 && review.goals.length > 0 && (
        <>
          <h3>{t("goalsHeading")}</h3>
          <Table headings={headings} rows={review.goals.map(row)} />
        </>
      )}
      {review.competencyWeight > 0 && (
        <>
          <h3>{t("criteriaHeading")}</h3>
          <Table headings={headings} rows={review.criteria.map(row)} />
        </>
      )}
      {review.selfComment && (
        <p>
          <strong>{t("selfComment")}:</strong> {review.selfComment}
        </p>
      )}
      {review.managerComment && (
        <p>
          <strong>{t("managerComment")}:</strong> {review.managerComment}
        </p>
      )}
    </section>
  );
}

function ResultView({ review }: { review: ReviewResponse }) {
  const t = useTranslations("reviews");
  if (review.totalScore === null && review.finalScore === null) {
    // Nhân viên thấy kết quả sau khi công bố; trước đó chỉ báo đã chấm xong.
    const waiting = review.role.employee && !review.role.manager && !review.role.reviewer && review.managerSubmittedAt !== null;
    return waiting ? <div className="khoi-canh-bao thong-tin">{t("resultHidden")}</div> : null;
  }
  return (
    <section className="the">
      <h2>{t("resultHeading")}</h2>
      <dl className="thong-tin-dong">
        {review.goalWeight > 0 && (
          <>
            <dt>{t("goalScore")}</dt>
            <dd>{review.goalScore ?? "—"}</dd>
          </>
        )}
        {review.competencyWeight > 0 && (
          <>
            <dt>{t("competencyScore")}</dt>
            <dd>{review.competencyScore ?? "—"}</dd>
          </>
        )}
        <dt>{t("totalScore")}</dt>
        <dd>{review.totalScore ?? "—"}</dd>
        {review.adjustedScore && (
          <>
            <dt>{t("adjustedScore")}</dt>
            <dd>
              {review.adjustedScore} — {review.adjustmentReason}
            </dd>
          </>
        )}
        <dt>{t("grade")}</dt>
        <dd>
          <strong>{review.grade ?? "—"}</strong> {review.finalScore && `(${review.finalScore})`}
        </dd>
        {review.acknowledgedAt && (
          <>
            <dt>{t("acknowledgedAt")}</dt>
            <dd>
              {formatDateTime(review.acknowledgedAt)}
              {review.employeeComment && ` — ${review.employeeComment}`}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

function AdjustDrawer({ review, onClose, onDone }: { review: ReviewResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [score, setScore] = useState(review.adjustedScore ?? review.totalScore ?? "");
  const [reason, setReason] = useState(review.adjustmentReason ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/reviews/${review.id}/adjust`, { method: "POST", body: JSON.stringify({ score, reason }) });
      notify(t("adjusted"));
      onDone();
    });
  };
  return (
    <Drawer title={t("adjust")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <span className="chu-thich">{t("adjustHint", { score: review.totalScore ?? "—" })}</span>
        <Field id="dc-diem" label={t("adjustedScore")} error={fields.score}>
          <input id="dc-diem" className={inputClass("score")} inputMode="decimal" value={score} onChange={(event) => setScore(event.target.value)} />
        </Field>
        <Field id="dc-ly-do" label={t("reason")} error={fields.reason}>
          <textarea id="dc-ly-do" rows={3} className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} />
        </Field>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {common("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function AcknowledgeDrawer({ reviewId, onClose, onDone }: { reviewId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, formError, run } = useSubmit();
  const [comment, setComment] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/reviews/${reviewId}/acknowledge`, { method: "POST", body: JSON.stringify({ comment }) });
      notify(t("acknowledged"));
      onDone();
    });
  };
  return (
    <Drawer title={t("acknowledge")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="xn-nhan-xet" label={t("employeeComment")}>
          <textarea id="xn-nhan-xet" rows={3} className="o-nhap" value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} />
        </Field>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("acknowledge")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
