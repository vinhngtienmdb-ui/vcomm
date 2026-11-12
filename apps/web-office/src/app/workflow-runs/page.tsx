"use client";

// MAN_HINH_156 Phiên quy trình, danh sách và khởi tạo (CHUC_NANG_183; API_187; QUYTAC_NGHIEPVU_362).
import type { OfficePerson, PageResponse, WorkflowRunListItem, WorkflowRunResponse, WorkflowStartOption } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PersonPicker } from "@/components/PersonPicker";
import { RunStatusBadge } from "@/components/RunStatusBadge";

const scopes = ["mine", "involved", "company"] as const;

export default function WorkflowRunsPage() {
  const t = useTranslations("officeWorkflows");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [scope, setScope] = useState<(typeof scopes)[number]>("mine");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);
  const { state, reload } = useApi<PageResponse<WorkflowRunListItem>>(`/office/workflow-runs?scope=${scope}&status=${status}&page=${page}`);
  const headings = [t("runNo"), t("templateName"), t("runTitle"), t("openSteps"), t("startedAt"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("runsTitle")}</h1>
        <button type="button" className="nut chinh" onClick={() => setStarting(true)}>
          {t("startRun")}
        </button>
      </div>
      <div className="cac-the" role="tablist">
        {scopes
          .filter((item) => item !== "company" || can("office.task.view_all") || can("office.workflow.manage"))
          .map((item) => (
            <button key={item} type="button" role="tab" aria-selected={scope === item} className={scope === item ? "chon" : ""} onClick={() => (setScope(item), setPage(1))}>
              {t(`scope_${item}`)}
            </button>
          ))}
      </div>
      <div className="bo-loc">
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => (setStatus(event.target.value), setPage(1))}>
          {["all", "running", "blocked", "completed", "cancelled"].map((item) => (
            <option key={item} value={item}>
              {t(`runFilter_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noRuns")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((run) => (
                    <tr key={run.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/workflow-runs/${run.id}`}>{run.runNo}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{run.templateName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{run.title}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{run.openSteps.join(", ") || "—"}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatDateTime(run.createdAt)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>
                          <RunStatusBadge status={run.status} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      {starting && <StartDrawer onClose={() => setStarting(false)} />}
    </>
  );
}

function StartDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("officeWorkflows");
  const common = useTranslations("common");
  const router = useRouter();
  const { notify } = useAdmin();
  const { state } = useApi<WorkflowStartOption[]>("/office/workflow-start-options");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean | null>>({});
  const [people, setPeople] = useState<Record<string, OfficePerson[]>>({});
  return (
    <Drawer title={t("startRun")} onClose={onClose}>
      <Loaded state={state} onRetry={() => undefined}>
        {(options) => {
          const option = options.find((item) => item.templateId === templateId) ?? null;
          return options.length === 0 ? (
            <MessageView text={t("noStartOptions")} />
          ) : (
            <>
              <FormError text={formError} />
              <Field id="run-template" label={t("templateName")}>
                <select id="run-template" className="o-nhap" value={templateId} onChange={(event) => (setTemplateId(event.target.value), setValues({}), setPeople({}))}>
                  <option value="">{t("chooseTemplate")}</option>
                  {options.map((item) => (
                    <option key={item.templateId} value={item.templateId}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              {option?.description && <p className="chu-thich">{option.description}</p>}
              <Field id="run-title" label={t("runTitle")} error={fields.title}>
                <input id="run-title" className={inputClass("title")} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              {option?.fields.map((field) => {
                const id = `run-field-${field.key}`;
                const error = fields[`values.${field.key}`];
                const label = `${field.label}${field.required ? " *" : ""}`;
                const value = values[field.key];
                const set = (next: string | boolean | null) => setValues({ ...values, [field.key]: next });
                return (
                  <Field key={field.key} id={id} label={label} error={error}>
                    {field.type === "boolean" ? (
                      <input id={id} type="checkbox" checked={value === true} onChange={(event) => set(event.target.checked)} />
                    ) : field.type === "select" ? (
                      <select id={id} className={inputClass(`values.${field.key}`)} value={typeof value === "string" ? value : ""} onChange={(event) => set(event.target.value || null)}>
                        <option value="">—</option>
                        {(field.options ?? []).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "user" ? (
                      <PersonPicker
                        id={id}
                        multiple={false}
                        value={people[field.key] ?? []}
                        invalid={Boolean(error)}
                        onChange={(chosen) => (setPeople({ ...people, [field.key]: chosen }), set(chosen[0]?.id ?? null))}
                      />
                    ) : (
                      <input
                        id={id}
                        className={inputClass(`values.${field.key}`)}
                        type={field.type === "date" ? "date" : "text"}
                        inputMode={field.type === "number" ? "decimal" : undefined}
                        value={typeof value === "string" ? value : ""}
                        onChange={(event) => set(event.target.value)}
                      />
                    )}
                  </Field>
                );
              })}
              <div className="nhom-nut">
                <button type="button" className="nut phu" onClick={onClose}>
                  {common("cancel")}
                </button>
                <button
                  type="button"
                  className={`nut chinh${submitting ? " dang-xu-ly" : ""}`}
                  disabled={submitting || !option}
                  onClick={() =>
                    void run(async () => {
                      const started = await apiFetch<WorkflowRunResponse>("/office/workflow-runs", { method: "POST", body: JSON.stringify({ templateId, title, values }) });
                      notify(t("started", { runNo: started.runNo }));
                      router.push(`/workflow-runs/${started.id}`);
                    })
                  }
                >
                  {t("start")}
                </button>
              </div>
            </>
          );
        }}
      </Loaded>
    </Drawer>
  );
}
