"use client";

// MAN_HINH_172 chi tiết kỳ đánh giá (CHUC_NANG_192; API_205): phiếu, người chấm, tiến độ, điểm, xếp loại, phân bố; mở, chốt, công bố; thêm, loại phiếu.
import type { ReviewCycleOptionsResponse, ReviewCycleResponse, ReviewListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/RecruitmentParts";
import { CycleForm, cycleStatusClass, PhaseBadge } from "@/components/ReviewParts";

const mark = (done: boolean) => (done ? "✓" : "—");

export default function ReviewCyclePage() {
  const t = useTranslations("reviews");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<ReviewCycleResponse>(`/hr/review-cycles/${id}`);
  const options = useApi<ReviewCycleOptionsResponse>(`/hr/review-cycles/${id}/options`);
  const [drawer, setDrawer] = useState<{ kind: "edit" } | { kind: "add" } | { kind: "exclude"; review: ReviewListItem } | null>(null);
  const [busy, setBusy] = useState(false);
  const act = async (path: string, done: string, method = "POST", body?: unknown) => {
    setBusy(true);
    try {
      await apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      notify(done);
      await Promise.all([reload(), options.reload()]);
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(cycle) => {
        const unassigned = cycle.reviews.filter((item) => item.phase !== "excluded" && !item.reviewerId).length;
        return (
          <>
            <p>
              <Link href="/reviews">‹ {t("title")}</Link>
            </p>
            <div className="tieu-de">
              <h1>
                {cycle.name} <span className={`nhan ${cycleStatusClass[cycle.status]}`}>{t(`cycleStatus_${cycle.status}`)}</span>
              </h1>
              {cycle.canEdit && (
                <button type="button" className="nut phu" onClick={() => setDrawer({ kind: "edit" })}>
                  {t("edit")}
                </button>
              )}
              {cycle.canOpen && (
                <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act(`/hr/review-cycles/${id}/open`, t("opened"))}>
                  {t("open")}
                </button>
              )}
              {cycle.status === "open" && (
                <>
                  <button type="button" className="nut phu" onClick={() => setDrawer({ kind: "add" })}>
                    {t("addReview")}
                  </button>
                  <button type="button" className="nut phu" disabled={busy || !cycle.canClose} onClick={() => void act(`/hr/review-cycles/${id}/close`, t("closed"))}>
                    {t("close")}
                  </button>
                </>
              )}
              {cycle.canPublish && (
                <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act(`/hr/review-cycles/${id}/publish`, t("published"))}>
                  {t("publish")}
                </button>
              )}
              <HistoryLink entityType="review_cycle" entityId={cycle.id} />
            </div>
            <div className="the">
              <dl className="thong-tin-dong">
                <dt>{t("period")}</dt>
                <dd>
                  {formatDate(cycle.periodFrom)} – {formatDate(cycle.periodTo)}
                </dd>
                <dt>{t("template")}</dt>
                <dd>
                  {cycle.templateName} · {t("weightsValue", { goal: cycle.goalWeight, competency: cycle.competencyWeight })}
                </dd>
                <dt>{t("deadlines")}</dt>
                <dd>{t("deadlinesValue", { goal: formatDate(cycle.goalDeadline), self: formatDate(cycle.selfDeadline), manager: formatDate(cycle.managerDeadline) })}</dd>
                <dt>{t("grades")}</dt>
                <dd>{t("gradesValue", { a: cycle.thresholdA, b: cycle.thresholdB, c: cycle.thresholdC })}</dd>
              </dl>
            </div>
            {cycle.status === "open" && unassigned > 0 && <div className="khoi-canh-bao canh-bao">{t("unassigned", { count: unassigned })}</div>}
            {cycle.status === "open" && !cycle.canClose && cycle.reviewCount > 0 && <span className="chu-thich">{t("closeHint")}</span>}
            {cycle.reviews.length === 0 ? (
              <MessageView text={cycle.status === "draft" ? t("draftHint") : t("noReviews")} />
            ) : (
              <Table
                headings={[t("employee"), t("department"), t("reviewer"), t("goalsStep"), t("selfStep"), t("managerStep"), t("score"), t("grade"), ""]}
                rows={cycle.reviews.map((review) => ({
                  key: review.id,
                  cells: [
                    <Link key="nv" href={`/my-reviews/${review.id}`}>
                      {review.employeeCode} · {review.employeeName}
                    </Link>,
                    review.departmentName ?? "—",
                    cycle.status === "open" && review.phase !== "excluded" && !review.managerSubmitted && options.state.kind === "ready" ? (
                      <select
                        key="nguoi-cham"
                        className="o-nhap"
                        aria-label={t("reviewer")}
                        value={review.reviewerId ?? ""}
                        onChange={(event) => void act(`/hr/reviews/${review.id}/reviewer`, t("reviewerAssigned"), "PUT", { reviewerId: event.target.value || null })}
                      >
                        <option value="">{t("unassignedOption")}</option>
                        {options.state.data.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.fullName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (review.reviewerName ?? "—")
                    ),
                    cycle.goalWeight > 0 ? mark(review.goalsConfirmed) : "—",
                    mark(review.selfSubmitted),
                    review.phase === "excluded" ? <PhaseBadge key="gd" phase={review.phase} /> : mark(review.managerSubmitted),
                    review.finalScore ?? "—",
                    review.grade ?? "—",
                    cycle.status === "open" && review.phase !== "excluded" ? (
                      <button key="loai" type="button" className="nut phu" onClick={() => setDrawer({ kind: "exclude", review })}>
                        {t("exclude")}
                      </button>
                    ) : (
                      (review.excludedReason ?? "")
                    ),
                  ],
                }))}
              />
            )}
            {cycle.status !== "draft" && (
              <p className="chu-thich">{t("distribution", { a: cycle.gradeDistribution.A, b: cycle.gradeDistribution.B, c: cycle.gradeDistribution.C, d: cycle.gradeDistribution.D })}</p>
            )}
            {drawer?.kind === "edit" && (
              <CycleForm
                cycle={cycle}
                onClose={() => setDrawer(null)}
                onSaved={() => {
                  setDrawer(null);
                  void reload();
                }}
              />
            )}
            {drawer?.kind === "add" && options.state.kind === "ready" && (
              <AddReviewDrawer
                cycleId={id}
                options={options.state.data}
                onClose={() => setDrawer(null)}
                onDone={() => {
                  setDrawer(null);
                  void reload();
                  void options.reload();
                }}
              />
            )}
            {drawer?.kind === "exclude" && (
              <ExcludeDrawer
                review={drawer.review}
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

function AddReviewDrawer({ cycleId, options, onClose, onDone }: { cycleId: string; options: ReviewCycleOptionsResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [employeeId, setEmployeeId] = useState(options.employees[0]?.id ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/review-cycles/${cycleId}/reviews`, { method: "POST", body: JSON.stringify({ employeeId }) });
      notify(t("reviewAdded"));
      onDone();
    });
  };
  return (
    <Drawer title={t("addReview")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="them-phieu" label={t("employee")} error={fields.employeeId}>
          <select id="them-phieu" className={inputClass("employeeId")} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            {options.employees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.fullName}
              </option>
            ))}
          </select>
        </Field>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !employeeId}>
            {t("addReview")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function ExcludeDrawer({ review, onClose, onDone }: { review: ReviewListItem; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/reviews/${review.id}/exclude`, { method: "POST", body: JSON.stringify({ reason }) });
      notify(t("excluded"));
      onDone();
    });
  };
  return (
    <Drawer title={t("excludeTitle", { name: review.employeeName })} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="loai-ly-do" label={t("reason")} error={fields.reason}>
          <textarea id="loai-ly-do" rows={2} className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} />
        </Field>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("exclude")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
