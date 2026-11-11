"use client";

// MAN_HINH_156 Chi tiết phiên quy trình (API_187; QUYTAC_NGHIEPVU_362): biểu mẫu khởi tạo, sơ đồ tô trạng thái, các lượt bước, chỉ định người thực hiện, hủy phiên.
import type { OfficePerson, WorkflowRunResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PersonPicker } from "@/components/PersonPicker";
import { RunStatusBadge } from "@/components/RunStatusBadge";
import { WorkflowDiagram, type StepState } from "@/components/WorkflowDiagram";

export default function WorkflowRunPage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<WorkflowRunResponse>(`/office/workflow-runs/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(run) => <RunDetail key={run.version} run={run} onChanged={() => void reload()} />}
    </Loaded>
  );
}

const stepTone = { open: "thong-tin", waiting: "canh-bao", blocked: "loi", done: "thanh-cong", cancelled: "trung-tinh" } as const;

function RunDetail({ run, onChanged }: { run: WorkflowRunResponse; onChanged: () => void }) {
  const t = useTranslations("officeWorkflows");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Trạng thái bước trên sơ đồ: lượt mới nhất của mỗi bước.
  const states: Record<string, StepState> = {};
  for (const step of run.steps) if (step.status !== "cancelled") states[step.stepKey] = step.status;
  const valueText = (key: string, type: string) => {
    const value = run.values[key];
    if (value === null || value === undefined || value === "") return "—";
    if (type === "boolean") return value ? t("yes") : t("no");
    if (type === "user") return run.valueLabels[key] ?? "—";
    if (type === "date" && typeof value === "string") return formatDate(value);
    if (type === "number" && typeof value === "string") return formatNumber(value);
    return String(value);
  };
  return (
    <>
      <div className="tieu-de">
        <h1>
          {run.runNo} · {run.title} <RunStatusBadge status={run.status} />
        </h1>
        <div className="nhom-nut">
          {run.canCancel && (
            <button type="button" className="nut nguy-hiem" onClick={() => setCancelling(true)}>
              {t("cancelRun")}
            </button>
          )}
        </div>
      </div>
      {run.status === "blocked" && <div className="khoi-canh-bao loi">{t("blockedHint")}</div>}
      {run.cancelReason && <div className="khoi-canh-bao canh-bao">{t("cancelReasonShown", { reason: run.cancelReason })}</div>}
      <div className="hai-cot">
        <div className="the">
          <h2>{t("startForm")}</h2>
          <dl className="thong-tin-dong">
            <dt>{t("initiator")}</dt>
            <dd>
              {run.initiator.fullName} · {formatDateTime(run.createdAt)}
            </dd>
            <dt>{t("templateName")}</dt>
            <dd>
              {run.templateName} · {t("versionLabel", { number: run.versionNo })}
            </dd>
            {run.definition.fields.map((field) => (
              <div key={field.key} style={{ display: "contents" }}>
                <dt>{field.label}</dt>
                <dd>{valueText(field.key, field.type)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="the">
          <h2>{t("steps")}</h2>
          <ol className="dong-thoi-gian">
            {run.steps.map((step, index) => (
              <li key={step.id} className={step.status === "done" ? "xong" : "cho"}>
                <span className="cham">{index + 1}</span>
                <div>
                  <strong>{step.stepName}</strong> <span className={`nhan ${stepTone[step.status]}`}>{t(`stepStatus_${step.status}`)}</span>
                  {step.outcome && <span className="nhan thanh-cong"> {step.outcome}</span>}
                  <div className="chu-thich">
                    {step.owner?.fullName ?? (step.status === "open" ? t("waitingClaim") : "")} {step.completedAt ? `· ${formatDateTime(step.completedAt)}` : ""}
                    {step.blockedReason && ` · ${t(`blocked_${step.blockedReason}`)}`}
                  </div>
                  {step.taskId && <Link href={`/tasks/${step.taskId}`}>{t("openTask")}</Link>}
                  {step.status === "blocked" && step.blockedReason === "noAssignee" && run.canAssign && (
                    <button type="button" className="nut phu" onClick={() => setAssigning(step.id)}>
                      {t("assign")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="the">
        <h2>{t("diagram")}</h2>
        <WorkflowDiagram definition={run.definition} states={states} />
        <span className="chu-thich">{t("diagramLegend")}</span>
      </div>
      {assigning && <AssignDrawer run={run} stepInstanceId={assigning} onClose={() => setAssigning(null)} onDone={() => (setAssigning(null), onChanged())} />}
      {cancelling && <CancelDrawer run={run} onClose={() => setCancelling(false)} onDone={() => (setCancelling(false), onChanged())} />}
    </>
  );
}

function AssignDrawer({ run, stepInstanceId, onClose, onDone }: { run: WorkflowRunResponse; stepInstanceId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeWorkflows");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, formError, fields, run: submit } = useSubmit();
  const [person, setPerson] = useState<OfficePerson[]>([]);
  return (
    <Drawer title={t("assign")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="assign-person" label={t("assignee")} error={fields.userId}>
        <PersonPicker id="assign-person" value={person} onChange={setPerson} multiple={false} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button
          type="button"
          className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || person.length === 0}
          onClick={() =>
            void submit(async () => {
              await apiFetch(`/office/workflow-runs/${run.id}/assign`, { method: "POST", body: JSON.stringify({ stepInstanceId, userId: person[0]!.id, version: run.version }) });
              notify(t("assigned"));
              onDone();
            })
          }
        >
          {t("assign")}
        </button>
      </div>
    </Drawer>
  );
}

function CancelDrawer({ run, onClose, onDone }: { run: WorkflowRunResponse; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("officeWorkflows");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, formError, run: submit } = useSubmit();
  const [reason, setReason] = useState("");
  return (
    <Drawer title={t("cancelRun")} onClose={onClose}>
      <FormError text={formError} />
      <Field id="cancel-reason" label={t("reason")}>
        <textarea id="cancel-reason" className="o-nhap" rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="khoi-canh-bao canh-bao">{t("cancelHint")}</div>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button
          type="button"
          className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`}
          disabled={submitting || !reason.trim()}
          onClick={() =>
            void submit(async () => {
              await apiFetch(`/office/workflow-runs/${run.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason.trim(), version: run.version }) });
              notify(t("cancelled"));
              onDone();
            })
          }
        >
          {t("cancelRun")}
        </button>
      </div>
    </Drawer>
  );
}
