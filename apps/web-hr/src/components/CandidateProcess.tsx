"use client";

// Các thẻ lát L1 của MAN_HINH_170 (CONG_VIEC_54; API_202, API_203): phỏng vấn, đề nghị nhận việc, email đã gửi, đồng ý kho, yêu cầu xóa.
import type { ApplicationItem, CandidateProcessResponse, CandidateResponse, InterviewItem, JobOfferResponse, RecruitmentOptionsResponse, SaveInterviewRequest, SaveJobOfferRequest } from "contracts";
import { interviewModes, recruitmentContractKinds } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { MessageView } from "ui/components/StatusViews";
import { apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatDateTime, vietnamToday } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";
import { money, salaryRange, Table } from "@/components/RecruitmentParts";

const offerStatusClass: Record<string, string> = {
  draft: "trung-tinh",
  pending: "thong-tin",
  approved: "thanh-cong",
  rejected: "loi",
  withdrawn: "trung-tinh",
  sent: "thong-tin",
  accepted: "thanh-cong",
  declined: "loi",
  expired: "trung-tinh",
  cancelled: "trung-tinh",
};
// Giờ địa phương của trình duyệt cho ô datetime-local, gửi kèm múi giờ +07:00 (giờ Việt Nam).
const toLocalInput = (value: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(" ", "T");

function useAction(onDone: () => void) {
  const { notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const run = async (path: string, done: string, body?: unknown) => {
    setBusy(true);
    try {
      await apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      notify(done);
      onDone();
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function InterviewsTab({ candidate, process, onChanged }: { candidate: CandidateResponse; process: CandidateProcessResponse; onChanged: () => void }) {
  const t = useTranslations("interviews");
  const [editing, setEditing] = useState<{ application: ApplicationItem; interview: InterviewItem | null } | null>(null);
  const [cancelling, setCancelling] = useState<InterviewItem | null>(null);
  const { busy, run } = useAction(onChanged);
  const open = candidate.applications.filter((item) => !item.outcome && item.stage !== "hired" && !candidate.erasedAt);
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("title")}</h2>
        {open.map((application) => (
          <button key={application.id} type="button" className="nut chinh" onClick={() => setEditing({ application, interview: null })}>
            {open.length > 1 ? t("createFor", { posting: application.postingTitle }) : t("create")}
          </button>
        ))}
      </div>
      {process.interviews.length === 0 ? (
        <MessageView text={t("none")} />
      ) : (
        process.interviews.map((interview) => (
          <div key={interview.id} style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <div className="tieu-de">
              <h3>
                {interview.name} · {interview.postingTitle}{" "}
                <span className={`nhan ${interview.status === "completed" ? "thanh-cong" : interview.status === "cancelled" ? "trung-tinh" : "thong-tin"}`}>{t(`status_${interview.status}`)}</span>
              </h3>
              {interview.status === "scheduled" && (
                <>
                  <button type="button" className="nut phu" onClick={() => setEditing({ application: candidate.applications.find((item) => item.id === interview.applicationId)!, interview })}>
                    {t("edit")}
                  </button>
                  <button type="button" className="nut phu" disabled={busy || interview.evaluations.length === 0} onClick={() => void run(`/hr/interviews/${interview.id}/complete`, t("completed"))}>
                    {t("complete")}
                  </button>
                  <button type="button" className="nut nguy-hiem" onClick={() => setCancelling(interview)}>
                    {t("cancel")}
                  </button>
                </>
              )}
            </div>
            <span>
              {formatDateTime(interview.startsAt)} · {t("minutes", { count: interview.durationMinutes })} · {interview.mode === "onsite" ? interview.location : interview.meetingUrl}
            </span>
            <span className="chu-thich">{t("interviewersList", { names: interview.interviewers.map((person) => person.fullName).join(", ") })}</span>
            {interview.evaluations.length > 0 && (
              <Table
                headings={[t("interviewer"), t("score"), t("recommendation"), t("comment")]}
                rows={interview.evaluations.map((item) => ({
                  key: item.interviewerId,
                  cells: [item.interviewerName, `${item.score}/5`, t(`recommendation_${item.recommendation}`), item.comment ?? "—"],
                }))}
              />
            )}
          </div>
        ))
      )}
      {editing && (
        <InterviewForm
          application={editing.application}
          interview={editing.interview}
          members={process.members}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {cancelling && (
        <EmailOptionDrawer
          title={t("cancelTitle")}
          path={`/hr/interviews/${cancelling.id}/cancel`}
          confirm={t("cancel")}
          done={t("cancelled")}
          emailLabel={t("sendCancellation")}
          onClose={() => setCancelling(null)}
          onDone={() => {
            setCancelling(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function InterviewForm({
  application,
  interview,
  members,
  onClose,
  onDone,
}: {
  application: ApplicationItem;
  interview: InterviewItem | null;
  members: CandidateProcessResponse["members"];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("interviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState({
    name: interview?.name ?? t("defaultName"),
    startsAt: interview ? toLocalInput(interview.startsAt) : `${vietnamToday()}T09:00`,
    durationMinutes: String(interview?.durationMinutes ?? 60),
    mode: interview?.mode ?? "onsite",
    location: interview?.location ?? "",
    meetingUrl: interview?.meetingUrl ?? "",
    message: "",
  });
  const [interviewerIds, setInterviewerIds] = useState<string[]>(interview?.interviewers.map((person) => person.id) ?? []);
  const [sendEmail, setSendEmail] = useState(true);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const body: SaveInterviewRequest = {
        name: values.name,
        startsAt: `${values.startsAt}:00+07:00`,
        durationMinutes: Number(values.durationMinutes),
        mode: values.mode as SaveInterviewRequest["mode"],
        location: values.mode === "onsite" ? values.location : null,
        meetingUrl: values.mode === "online" ? values.meetingUrl : null,
        interviewerIds,
        sendEmail,
        message: values.message,
      };
      await apiFetch(interview ? `/hr/interviews/${interview.id}` : `/hr/applications/${application.id}/interviews`, { method: interview ? "PATCH" : "POST", body: JSON.stringify(body) });
      notify(interview ? t("updated") : t("created"));
      onDone();
    });
  };
  return (
    <Drawer title={interview ? t("editTitle") : t("createTitle", { posting: application.postingTitle })} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="pv-ten" label={t("name")} error={fields.name}>
          <input id="pv-ten" className={inputClass("name")} value={values.name} onChange={set("name")} maxLength={100} />
        </Field>
        <Field id="pv-luc" label={t("startsAt")} error={fields.startsAt} hint={t("timezoneHint")}>
          <input id="pv-luc" type="datetime-local" className={inputClass("startsAt")} value={values.startsAt} onChange={set("startsAt")} />
        </Field>
        <Field id="pv-phut" label={t("duration")} error={fields.durationMinutes}>
          <input id="pv-phut" type="number" min={15} max={480} className={inputClass("durationMinutes")} value={values.durationMinutes} onChange={set("durationMinutes")} />
        </Field>
        <Field id="pv-hinh-thuc" label={t("mode")} error={fields.mode}>
          <select id="pv-hinh-thuc" className={inputClass("mode")} value={values.mode} onChange={set("mode")}>
            {interviewModes.map((mode) => (
              <option key={mode} value={mode}>
                {t(`mode_${mode}`)}
              </option>
            ))}
          </select>
        </Field>
        {values.mode === "onsite" ? (
          <Field id="pv-dia-diem" label={t("location")} error={fields.location}>
            <input id="pv-dia-diem" className={inputClass("location")} value={values.location} onChange={set("location")} maxLength={300} />
          </Field>
        ) : (
          <Field id="pv-lien-ket" label={t("meetingUrl")} error={fields.meetingUrl}>
            <input id="pv-lien-ket" type="url" className={inputClass("meetingUrl")} value={values.meetingUrl} onChange={set("meetingUrl")} maxLength={500} placeholder="https://" />
          </Field>
        )}
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{t("interviewers")}</legend>
          <div style={{ display: "grid", gap: "var(--khoang-1)", maxHeight: 200, overflow: "auto" }}>
            {members.map((member) => (
              <label key={member.id}>
                <input
                  type="checkbox"
                  checked={interviewerIds.includes(member.id)}
                  disabled={!interviewerIds.includes(member.id) && interviewerIds.length >= 5}
                  onChange={(event) => setInterviewerIds(event.target.checked ? [...interviewerIds, member.id] : interviewerIds.filter((id) => id !== member.id))}
                />{" "}
                {member.fullName}
                {member.email ? ` · ${member.email}` : ""}
              </label>
            ))}
          </div>
          {fields.interviewerIds && <span className="loi-o">{fields.interviewerIds}</span>}
        </fieldset>
        <div className="truong">
          <label>
            <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} /> {interview ? t("sendUpdate") : t("sendInvitation")}
          </label>
        </div>
        {sendEmail && (
          <Field id="pv-loi-nhan" label={t("message")} error={fields.message}>
            <textarea id="pv-loi-nhan" rows={2} className={inputClass("message")} value={values.message} onChange={set("message")} maxLength={2000} />
          </Field>
        )}
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

// Ngăn kéo xác nhận có ô "gửi email" và lời nhắn thêm (hủy phỏng vấn, gửi thư đề nghị).
function EmailOptionDrawer({
  title,
  path,
  confirm,
  done,
  emailLabel,
  hint,
  reason,
  onClose,
  onDone,
}: {
  title: string;
  path: string;
  confirm: string;
  done: string;
  emailLabel?: string;
  hint?: string;
  reason?: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("interviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [sendEmail, setSendEmail] = useState(true);
  const [message, setMessage] = useState("");
  const [reasonText, setReasonText] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(path, { method: "POST", body: JSON.stringify(reason ? { reason: reasonText } : { sendEmail: emailLabel ? sendEmail : false, message }) });
      notify(done);
      onDone();
    });
  };
  return (
    <Drawer title={title} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        {reason && (
          <Field id="ly-do-xac-nhan" label={t("reason")} error={fields.reason}>
            <textarea id="ly-do-xac-nhan" rows={2} className={inputClass("reason")} value={reasonText} onChange={(event) => setReasonText(event.target.value)} maxLength={500} />
          </Field>
        )}
        {emailLabel && (
          <div className="truong">
            <label>
              <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} /> {emailLabel}
            </label>
          </div>
        )}
        {emailLabel && sendEmail && (
          <Field id="loi-nhan-them" label={t("message")} error={fields.message}>
            <textarea id="loi-nhan-them" rows={2} className={inputClass("message")} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} />
          </Field>
        )}
        {hint && <div className="khoi-canh-bao thong-tin">{hint}</div>}
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {confirm}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function OffersTab({
  candidate,
  process,
  options,
  onChanged,
}: {
  candidate: CandidateResponse;
  process: CandidateProcessResponse;
  options: RecruitmentOptionsResponse | null;
  onChanged: () => void;
}) {
  const t = useTranslations("offers");
  const [editing, setEditing] = useState<{ application: ApplicationItem; offer: JobOfferResponse | null } | null>(null);
  const [drawer, setDrawer] = useState<{ kind: "send" | "cancel" | "response"; offer: JobOfferResponse } | null>(null);
  const { busy, run } = useAction(onChanged);
  const openOffer = (applicationId: string) => process.offers.some((offer) => offer.applicationId === applicationId && !["declined", "expired", "cancelled"].includes(offer.status));
  const eligible = candidate.applications.filter((item) => !item.outcome && item.stage !== "hired" && !openOffer(item.id) && !candidate.erasedAt);
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("title")}</h2>
        {options &&
          eligible.map((application) => (
            <button key={application.id} type="button" className="nut chinh" onClick={() => setEditing({ application, offer: null })}>
              {eligible.length > 1 ? t("createFor", { posting: application.postingTitle }) : t("create")}
            </button>
          ))}
      </div>
      {process.offers.length === 0 ? (
        <MessageView text={t("none")} />
      ) : (
        process.offers.map((offer) => (
          <div key={offer.id} style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <div className="tieu-de">
              <h3>
                {offer.documentNo ?? t("noNumber")} · {offer.jobTitle} <span className={`nhan ${offerStatusClass[offer.status]}`}>{t(`status_${offer.status}`)}</span>
              </h3>
              {offer.canEdit && options && (
                <button type="button" className="nut phu" onClick={() => setEditing({ application: candidate.applications.find((item) => item.id === offer.applicationId)!, offer })}>
                  {t("edit")}
                </button>
              )}
              {offer.canSubmit && (
                <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void run(`/hr/job-offers/${offer.id}/submit`, t("submitted"))}>
                  {t("submit")}
                </button>
              )}
              {offer.canWithdraw && (
                <button type="button" className="nut phu" disabled={busy} onClick={() => void run(`/hr/job-offers/${offer.id}/withdraw`, t("withdrawn"))}>
                  {t("withdraw")}
                </button>
              )}
              {offer.canSend && (
                <button type="button" className="nut chinh" onClick={() => setDrawer({ kind: "send", offer })}>
                  {offer.status === "sent" ? t("resend") : t("send")}
                </button>
              )}
              {offer.canRecordResponse && (
                <button type="button" className="nut phu" onClick={() => setDrawer({ kind: "response", offer })}>
                  {t("recordResponse")}
                </button>
              )}
              {offer.canHire && (
                <Link className="nut chinh" href={`/candidates/${candidate.id}/hire?offerId=${offer.id}`}>
                  {t("hire")}
                </Link>
              )}
              {offer.employeeId && (
                <Link className="nut phu" href={`/employees/${offer.employeeId}`}>
                  {t("viewEmployee")}
                </Link>
              )}
              {offer.canCancel && (
                <button type="button" className="nut nguy-hiem" onClick={() => setDrawer({ kind: "cancel", offer })}>
                  {t("cancel")}
                </button>
              )}
            </div>
            {offer.outsideRangeReason && (
              <div className="khoi-canh-bao canh-bao">{t("outsideRange", { range: salaryRange(offer.requestSalaryMin, offer.requestSalaryMax), reason: offer.outsideRangeReason })}</div>
            )}
            <dl className="thong-tin-dong">
              <dt>{t("position")}</dt>
              <dd>
                {offer.departmentName} · {offer.branchName}
              </dd>
              <dt>{t("salary")}</dt>
              <dd>{money(offer.salary)}</dd>
              <dt>{t("startDate")}</dt>
              <dd>{formatDate(offer.startDate)}</dd>
              <dt>{t("responseDeadline")}</dt>
              <dd>{formatDate(offer.responseDeadline)}</dd>
              {offer.approvalRequestId && (
                <>
                  <dt>{t("approval")}</dt>
                  <dd>
                    <a href={`/hop-duyet/${offer.approvalRequestId}`}>{t("approvalLink")}</a>
                  </dd>
                </>
              )}
              {offer.sentAt && (
                <>
                  <dt>{t("sentAt")}</dt>
                  <dd>{formatDateTime(offer.sentAt)}</dd>
                </>
              )}
              {offer.respondedAt && (
                <>
                  <dt>{t("respondedAt")}</dt>
                  <dd>
                    {formatDateTime(offer.respondedAt)} · {t(`channel_${offer.responseChannel ?? "manual"}`)}
                    {offer.responseNote ? ` · ${offer.responseNote}` : ""}
                  </dd>
                </>
              )}
              {offer.cancelReason && (
                <>
                  <dt>{t("cancelReason")}</dt>
                  <dd>{offer.cancelReason}</dd>
                </>
              )}
            </dl>
          </div>
        ))
      )}
      {editing && options && (
        <OfferForm
          application={editing.application}
          offer={editing.offer}
          options={options}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
      {drawer?.kind === "send" && (
        <EmailOptionDrawer
          title={t("sendTitle")}
          path={`/hr/job-offers/${drawer.offer.id}/send`}
          confirm={t("send")}
          done={t("sent")}
          emailLabel={t("sendEmail")}
          hint={t("sendHint")}
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            onChanged();
          }}
        />
      )}
      {drawer?.kind === "cancel" && (
        <EmailOptionDrawer
          title={t("cancelTitle")}
          path={`/hr/job-offers/${drawer.offer.id}/cancel`}
          confirm={t("cancel")}
          done={t("cancelled")}
          reason
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            onChanged();
          }}
        />
      )}
      {drawer?.kind === "response" && (
        <ResponseDrawer
          offer={drawer.offer}
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function OfferForm({
  application,
  offer,
  options,
  onClose,
  onDone,
}: {
  application: ApplicationItem;
  offer: JobOfferResponse | null;
  options: RecruitmentOptionsResponse;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("offers");
  const recruitment = useTranslations("recruitment");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState<SaveJobOfferRequest>({
    applicationId: application.id,
    jobTitle: offer?.jobTitle ?? application.postingTitle,
    departmentId: offer?.departmentId ?? options.departments[0]?.id ?? "",
    branchId: offer?.branchId ?? options.branches[0]?.id ?? "",
    contractKind: offer?.contractKind ?? "probation_then_official",
    salary: offer?.salary ?? "",
    startDate: offer?.startDate ?? "",
    responseDeadline: offer?.responseDeadline ?? "",
    note: offer?.note ?? "",
    outsideRangeReason: offer?.outsideRangeReason ?? "",
    ...(offer ? { version: offer.version } : {}),
  });
  const set = (key: keyof SaveJobOfferRequest) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(offer ? `/hr/job-offers/${offer.id}` : "/hr/job-offers", { method: offer ? "PATCH" : "POST", body: JSON.stringify(values) });
      notify(t("saved"));
      onDone();
    });
  };
  return (
    <Drawer title={offer ? t("editTitle") : t("createTitle")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="dn-chuc-danh" label={recruitment("jobTitle")} error={fields.jobTitle}>
          <input id="dn-chuc-danh" className={inputClass("jobTitle")} value={values.jobTitle} onChange={set("jobTitle")} maxLength={100} />
        </Field>
        <Field id="dn-phong-ban" label={recruitment("department")} error={fields.departmentId}>
          <select id="dn-phong-ban" className={inputClass("departmentId")} value={values.departmentId} onChange={set("departmentId")}>
            {options.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dn-chi-nhanh" label={recruitment("branch")} error={fields.branchId}>
          <select id="dn-chi-nhanh" className={inputClass("branchId")} value={values.branchId} onChange={set("branchId")}>
            {options.branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dn-hop-dong" label={recruitment("contractKind")} error={fields.contractKind}>
          <select id="dn-hop-dong" className={inputClass("contractKind")} value={values.contractKind} onChange={set("contractKind")}>
            {recruitmentContractKinds.map((kind) => (
              <option key={kind} value={kind}>
                {recruitment(`contractKind_${kind}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="dn-luong" label={t("salaryInput")} error={fields.salary}>
          <input id="dn-luong" inputMode="numeric" className={inputClass("salary")} value={String(values.salary)} onChange={set("salary")} />
        </Field>
        <Field id="dn-ly-do" label={t("outsideRangeReason")} error={fields.outsideRangeReason} hint={t("outsideRangeHint")}>
          <input id="dn-ly-do" className={inputClass("outsideRangeReason")} value={values.outsideRangeReason ?? ""} onChange={set("outsideRangeReason")} maxLength={500} />
        </Field>
        <Field id="dn-bat-dau" label={t("startDate")} error={fields.startDate}>
          <input id="dn-bat-dau" type="date" className={inputClass("startDate")} value={values.startDate} onChange={set("startDate")} />
        </Field>
        <Field id="dn-han" label={t("responseDeadline")} error={fields.responseDeadline}>
          <input id="dn-han" type="date" className={inputClass("responseDeadline")} value={values.responseDeadline} onChange={set("responseDeadline")} />
        </Field>
        <Field id="dn-ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="dn-ghi-chu" rows={2} className={inputClass("note")} value={values.note ?? ""} onChange={set("note")} maxLength={2000} />
        </Field>
        <div className="khoi-canh-bao thong-tin">{t("approvalHint")}</div>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {recruitment("saveDraft")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function ResponseDrawer({ offer, onClose, onDone }: { offer: JobOfferResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("offers");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [accepted, setAccepted] = useState("true");
  const [respondedOn, setRespondedOn] = useState(vietnamToday());
  const [note, setNote] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/job-offers/${offer.id}/response`, { method: "POST", body: JSON.stringify({ accepted: accepted === "true", respondedOn, note }) });
      notify(t("responseRecorded"));
      onDone();
    });
  };
  return (
    <Drawer title={t("recordResponse")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="tl-ket-qua" label={t("answer")}>
          <select id="tl-ket-qua" className="o-nhap" value={accepted} onChange={(event) => setAccepted(event.target.value)}>
            <option value="true">{t("answer_accepted")}</option>
            <option value="false">{t("answer_declined")}</option>
          </select>
        </Field>
        <Field id="tl-ngay" label={t("respondedOn")} error={fields.respondedOn}>
          <input id="tl-ngay" type="date" className={inputClass("respondedOn")} value={respondedOn} onChange={(event) => setRespondedOn(event.target.value)} />
        </Field>
        <Field id="tl-ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="tl-ghi-chu" rows={2} className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
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

export function EmailsTab({ process }: { process: CandidateProcessResponse }) {
  const t = useTranslations("interviews");
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("emailsTitle")}</h2>
      {process.emails.length === 0 ? (
        <MessageView text={t("noEmails")} />
      ) : (
        <Table
          headings={[t("sentAt"), t("emailKind"), t("subject"), t("recipient"), t("sentBy")]}
          rows={process.emails.map((email) => ({ key: email.id, cells: [formatDateTime(email.sentAt), t(`emailKind_${email.kind}`), email.subject, email.recipient ?? "—", email.sentByName] }))}
        />
      )}
    </div>
  );
}

// Đồng ý kho, yêu cầu xóa (QUYTAC_NGHIEPVU_388).
export function RetentionActions({ candidate, onChanged }: { candidate: CandidateResponse; onChanged: () => void }) {
  const t = useTranslations("candidates");
  const [drawer, setDrawer] = useState<"pool" | "erase" | null>(null);
  const { busy, run } = useAction(onChanged);
  if (candidate.erasedAt) return null;
  return (
    <div className="nhom-nut">
      <button type="button" className="nut phu" onClick={() => setDrawer("pool")}>
        {t("recordPoolConsent")}
      </button>
      {candidate.poolUntil && (
        <button type="button" className="nut phu" disabled={busy} onClick={() => void run(`/hr/candidates/${candidate.id}/pool-consents/withdraw`, t("poolWithdrawn"))}>
          {t("withdrawPoolConsent")}
        </button>
      )}
      <button type="button" className="nut nguy-hiem" onClick={() => setDrawer("erase")}>
        {t("requestErasure")}
      </button>
      {drawer === "pool" && (
        <PoolConsentDrawer
          candidateId={candidate.id}
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            onChanged();
          }}
        />
      )}
      {drawer === "erase" && (
        <ErasureDrawer
          candidateId={candidate.id}
          onClose={() => setDrawer(null)}
          onDone={() => {
            setDrawer(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function PoolConsentDrawer({ candidateId, onClose, onDone }: { candidateId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("candidates");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [consentDate, setConsentDate] = useState(vietnamToday());
  const [file, setFile] = useState<File | undefined>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const form = new FormData();
      form.set("consentDate", consentDate);
      if (file) form.set("file", file);
      await apiUpload(`/hr/candidates/${candidateId}/pool-consents`, form);
      notify(t("poolRecorded"));
      onDone();
    });
  };
  return (
    <Drawer title={t("recordPoolConsent")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="kho-tep" label={t("poolEvidence")} error={fields.file}>
          <input id="kho-tep" type="file" className={inputClass("file")} accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0])} />
        </Field>
        <Field id="kho-ngay" label={t("consentDate")} error={fields.consentDate}>
          <input id="kho-ngay" type="date" className={inputClass("consentDate")} value={consentDate} onChange={(event) => setConsentDate(event.target.value)} />
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

function ErasureDrawer({ candidateId, onClose, onDone }: { candidateId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("candidates");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState({ receivedOn: vietnamToday(), channel: "email", note: "" });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/candidates/${candidateId}/erasure`, { method: "POST", body: JSON.stringify(values) });
      notify(t("erased"));
      onDone();
    });
  };
  return (
    <Drawer title={t("requestErasure")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="xoa-ngay" label={t("receivedOn")} error={fields.receivedOn}>
          <input id="xoa-ngay" type="date" className={inputClass("receivedOn")} value={values.receivedOn} onChange={(event) => setValues({ ...values, receivedOn: event.target.value })} />
        </Field>
        <Field id="xoa-kenh" label={t("channel")} error={fields.channel}>
          <select id="xoa-kenh" className={inputClass("channel")} value={values.channel} onChange={(event) => setValues({ ...values, channel: event.target.value })}>
            {(["email", "phone", "in_person", "other"] as const).map((channel) => (
              <option key={channel} value={channel}>
                {t(`requestChannel_${channel}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="xoa-ghi-chu" label={t("outcomeNote")} error={fields.note}>
          <textarea id="xoa-ghi-chu" rows={2} className={inputClass("note")} value={values.note} onChange={(event) => setValues({ ...values, note: event.target.value })} maxLength={500} />
        </Field>
        <div className="khoi-canh-bao loi">{t("erasureWarning")}</div>
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("eraseNow")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
