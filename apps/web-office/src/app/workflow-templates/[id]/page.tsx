"use client";

// MAN_HINH_155 Trình thiết kế mẫu quy trình (CHUC_NANG_183; API_186; QUYTAC_NGHIEPVU_360, 361): thông tin, biểu mẫu khởi tạo, bước, sơ đồ, kiểm tra, kích hoạt.
import { workflowFieldTypes, type OfficePerson, type WorkflowDefinition, type WorkflowDesignOptions, type WorkflowField, type WorkflowStep, type WorkflowTemplateResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";
import { StepEditor } from "@/components/StepEditor";
import { WorkflowDiagram } from "@/components/WorkflowDiagram";

export default function WorkflowTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<WorkflowTemplateResponse>(`/office/workflow-templates/${id}`);
  const options = useApi<WorkflowDesignOptions>("/office/workflow-design-options");
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(template) => (
        <Loaded state={options.state} onRetry={() => void options.reload()}>
          {(designOptions) => <Designer key={template.version} template={template} options={designOptions} onChanged={() => void reload()} />}
        </Loaded>
      )}
    </Loaded>
  );
}

// Khóa bước, trường tự sinh từ thứ tự: chữ thường, số, gạch dưới.
const nextKey = (prefix: string, used: string[]) => {
  let index = used.length + 1;
  while (used.includes(`${prefix}_${index}`)) index++;
  return `${prefix}_${index}`;
};

function Designer({ template, options, onChanged }: { template: WorkflowTemplateResponse; options: WorkflowDesignOptions; onChanged: () => void }) {
  const t = useTranslations("officeWorkflows");
  const { notify } = useAdmin();
  const { submitting, formError, run } = useSubmit();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");
  const [definition, setDefinition] = useState<WorkflowDefinition>(structuredClone(template.definition));
  const [people, setPeople] = useState<OfficePerson[]>(template.people);
  const [editing, setEditing] = useState<WorkflowStep | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = (next: WorkflowDefinition) => {
    setDefinition(next);
    setDirty(true);
  };
  const save = () =>
    run(async () => {
      await apiFetch(`/office/workflow-templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ name, description: description || null, definition, version: template.version }) });
      notify(t("saved"));
      onChanged();
    });
  const action = (path: "activate" | "deactivate") =>
    run(async () => {
      await apiFetch(`/office/workflow-templates/${template.id}/${path}`, { method: "POST" });
      notify(t(path === "activate" ? "activated" : "deactivated"));
      onChanged();
    });
  const setField = (index: number, field: Partial<WorkflowField>) => change({ ...definition, fields: definition.fields.map((item, position) => (position === index ? { ...item, ...field } : item)) });
  const stepName = (key: string | null) => (key ? (definition.steps.find((step) => step.key === key)?.name ?? key) : t("wholeTemplate"));
  const assigneeText = (step: WorkflowStep) => {
    const assignee = step.assignee;
    if (assignee.type === "user") return people.find((person) => person.id === assignee.userId)?.fullName ?? t("assignee_user");
    if (assignee.type === "role") return `${t("assignee_role")}: ${options.roles.find((role) => role.id === assignee.roleId)?.name ?? "—"}`;
    if (assignee.type === "field") return `${t("assignee_field")}: ${definition.fields.find((field) => field.key === assignee.fieldKey)?.label ?? assignee.fieldKey}`;
    return t(`assignee_${assignee.type}`);
  };
  const targetText = (targets: string[] | null) => (targets ?? []).map((target) => (target === "end" ? t("end") : stepName(target))).join(" + ");
  return (
    <>
      <div className="tieu-de">
        <h1>
          {template.name} · {t("versionLabel", { number: template.editingVersionNo })} {template.editingIsDraft && template.status !== "draft" && <span className="nhan trung-tinh">{t("draft")}</span>}{" "}
          <span className={`nhan ${template.status === "active" ? "thanh-cong" : template.status === "draft" ? "trung-tinh" : "canh-bao"}`}>{t(`templateStatus_${template.status}`)}</span>
        </h1>
        <div className="nhom-nut">
          <button type="button" className={`nut phu${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !dirty} onClick={() => void save()}>
            {t("saveDraft")}
          </button>
          {(template.editingIsDraft || template.status === "inactive") && (
            <button type="button" className="nut chinh" disabled={submitting || dirty || (template.editingIsDraft && template.issues.length > 0)} onClick={() => void action("activate")}>
              {t("activate")}
            </button>
          )}
          {template.status === "active" && (
            <button type="button" className="nut phu" disabled={submitting} onClick={() => void action("deactivate")}>
              {t("deactivate")}
            </button>
          )}
        </div>
      </div>
      <FormError text={formError} />
      {dirty && <div className="khoi-canh-bao canh-bao">{t("unsaved")}</div>}
      {!dirty && template.issues.length > 0 && (
        <div className="khoi-canh-bao loi" role="alert">
          <strong>{t("issuesTitle")}</strong>
          <ul style={{ margin: 0 }}>
            {template.issues.map((issue, index) => (
              <li key={index}>
                {stepName(issue.stepKey)}: {t(`issue_${issue.code}`)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!dirty && template.issues.length === 0 && template.editingIsDraft && <div className="khoi-canh-bao thong-tin">{t("validDraft")}</div>}
      {template.status === "active" && template.editingIsDraft && <div className="khoi-canh-bao thong-tin">{t("versionHint")}</div>}
      <div className="the">
        <h2>{t("info")}</h2>
        <Field id="template-name" label={t("templateName")}>
          <input id="template-name" className="o-nhap" value={name} maxLength={200} onChange={(event) => (setName(event.target.value), setDirty(true))} />
        </Field>
        <Field id="template-description" label={t("description")}>
          <textarea id="template-description" className="o-nhap" rows={2} value={description} onChange={(event) => (setDescription(event.target.value), setDirty(true))} />
        </Field>
        <Field id="template-starters" label={t("starters")} hint={t("startersHint")}>
          <div className="nhom-nut" id="template-starters">
            {options.departments.map((department) => (
              <label key={department.id} className="nhan trung-tinh" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={definition.starterDepartmentIds.includes(department.id)}
                  onChange={(event) =>
                    change({
                      ...definition,
                      starterDepartmentIds: event.target.checked ? [...definition.starterDepartmentIds, department.id] : definition.starterDepartmentIds.filter((item) => item !== department.id),
                    })
                  }
                />{" "}
                {department.name}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="the">
        <div className="tieu-de">
          <h2>{t("startForm")}</h2>
          <button
            type="button"
            className="nut phu"
            disabled={definition.fields.length >= 30}
            onClick={() =>
              change({
                ...definition,
                fields: [
                  ...definition.fields,
                  {
                    key: nextKey(
                      "truong",
                      definition.fields.map((field) => field.key),
                    ),
                    label: t("newFieldLabel"),
                    type: "text",
                    required: false,
                  },
                ],
              })
            }
          >
            {t("addField")}
          </button>
        </div>
        {definition.fields.length === 0 ? (
          <p className="chu-thich">{t("noFields")}</p>
        ) : (
          definition.fields.map((field, index) => (
            <div key={index} className="hai-cot">
              <Field id={`field-${index}-label`} label={t("fieldLabel")}>
                <input id={`field-${index}-label`} className="o-nhap" value={field.label} onChange={(event) => setField(index, { label: event.target.value })} />
              </Field>
              <Field id={`field-${index}-type`} label={t("fieldType")} hint={t("fieldKey", { key: field.key })}>
                <select id={`field-${index}-type`} className="o-nhap" value={field.type} onChange={(event) => setField(index, { type: event.target.value as WorkflowField["type"] })}>
                  {workflowFieldTypes.map((type) => (
                    <option key={type} value={type}>
                      {t(`fieldType_${type}`)}
                    </option>
                  ))}
                </select>
              </Field>
              {field.type === "select" && (
                <Field id={`field-${index}-options`} label={t("fieldOptions")}>
                  <input
                    id={`field-${index}-options`}
                    className="o-nhap"
                    value={(field.options ?? []).join(", ")}
                    onChange={(event) =>
                      setField(index, {
                        options: event.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                  />
                </Field>
              )}
              <div className="nhom-nut">
                <label>
                  <input type="checkbox" checked={field.required} onChange={(event) => setField(index, { required: event.target.checked })} /> {t("required")}
                </label>
                <button type="button" className="nut chu" onClick={() => change({ ...definition, fields: definition.fields.filter((_, position) => position !== index) })}>
                  {t("removeField")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="the">
        <div className="tieu-de">
          <h2>{t("steps")}</h2>
          <button
            type="button"
            className="nut phu"
            disabled={definition.steps.length >= 30}
            onClick={() => {
              const step: WorkflowStep = {
                key: nextKey(
                  "buoc",
                  definition.steps.map((item) => item.key),
                ),
                name: t("newStepName"),
                kind: "task",
                days: 1,
                assignee: { type: "initiator" },
                outcomes: [t("defaultOutcome")],
                transitions: [],
                otherwise: ["end"],
                instructions: null,
              };
              change({ ...definition, steps: [...definition.steps, step] });
              setEditing(step);
            }}
          >
            {t("addStep")}
          </button>
        </div>
        <ol className="dong-thoi-gian">
          {definition.steps.map((step, index) => (
            <li key={step.key} className="xong">
              <span className="cham">{index + 1}</span>
              <div>
                <strong>{step.name}</strong> {step.key === definition.firstStepKey && <span className="nhan thong-tin">{t("firstStep")}</span>}{" "}
                {step.kind === "join" && <span className="nhan trung-tinh">{t("kind_join")}</span>}
                <div>{t("stepSummary", { assignee: assigneeText(step), days: step.days, outcomes: step.outcomes.join(", ") })}</div>
                <div className="chu-thich">
                  {step.transitions.map((transition, position) => (
                    <div key={position}>
                      {position + 1}. {transition.outcome ?? t("anyOutcome")}
                      {transition.condition &&
                        ` · ${definition.fields.find((field) => field.key === transition.condition!.fieldKey)?.label ?? ""} ${t(`operatorSymbol_${transition.condition.operator}`)} ${transition.condition.value}`}{" "}
                      → {targetText(transition.targets)}
                    </div>
                  ))}
                  <div>
                    {t("otherwiseShort")} → {step.otherwise ? targetText(step.otherwise) : <span className="nhan loi">{t("issue_missingOtherwise")}</span>}
                  </div>
                </div>
                <div className="nhom-nut">
                  <button type="button" className="nut phu" onClick={() => setEditing(step)}>
                    {t("editStep")}
                  </button>
                  {step.key !== definition.firstStepKey && (
                    <button type="button" className="nut chu" onClick={() => change({ ...definition, firstStepKey: step.key })}>
                      {t("makeFirst")}
                    </button>
                  )}
                  {definition.steps.length > 1 && (
                    <button type="button" className="nut chu" onClick={() => change({ ...definition, steps: definition.steps.filter((item) => item.key !== step.key) })}>
                      {t("removeStep")}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="the">
        <h2>{t("diagram")}</h2>
        <WorkflowDiagram definition={definition} />
      </div>
      {editing && (
        <StepEditor
          step={editing}
          definition={definition}
          options={options}
          people={people}
          onClose={() => setEditing(null)}
          onSave={(step, person) => {
            if (person) setPeople([...people.filter((item) => item.id !== person.id), person]);
            change({ ...definition, steps: definition.steps.map((item) => (item.key === step.key ? step : item)) });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
