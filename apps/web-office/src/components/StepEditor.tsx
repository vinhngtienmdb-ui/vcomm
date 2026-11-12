"use client";

// Ngăn kéo sửa một bước của mẫu quy trình (QUYTAC_NGHIEPVU_360): người thực hiện, số ngày, kết quả, quy tắc chuyển, trường hợp còn lại.
import { workflowEnd, workflowOperators, type OfficePerson, type WorkflowDefinition, type WorkflowDesignOptions, type WorkflowStep, type WorkflowTransition } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field } from "ui/components/Form";
import { PersonPicker } from "./PersonPicker";

type Targets = string[];

function TargetPicker({ id, steps, value, onChange }: { id: string; steps: WorkflowStep[]; value: Targets; onChange: (targets: Targets) => void }) {
  const t = useTranslations("officeWorkflows");
  const options = [...steps.map((step) => ({ key: step.key, label: step.name })), { key: workflowEnd, label: t("end") }];
  return (
    <div className="nhom-nut" role="group" aria-label={t("targets")} id={id}>
      {options.map((option) => (
        <label key={option.key} className="nhan trung-tinh" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={value.includes(option.key)} onChange={(event) => onChange(event.target.checked ? [...value, option.key] : value.filter((item) => item !== option.key))} />{" "}
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function StepEditor({
  step,
  definition,
  options,
  people,
  onSave,
  onClose,
}: {
  step: WorkflowStep;
  definition: WorkflowDefinition;
  options: WorkflowDesignOptions;
  people: OfficePerson[];
  onSave: (step: WorkflowStep, person: OfficePerson | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("officeWorkflows");
  const common = useTranslations("common");
  const [draft, setDraft] = useState<WorkflowStep>(structuredClone(step));
  const [outcomesText, setOutcomesText] = useState(step.outcomes.join(", "));
  const [person, setPerson] = useState<OfficePerson[]>(step.assignee.type === "user" ? people.filter((item) => step.assignee.type === "user" && item.id === step.assignee.userId) : []);
  const others = definition.steps.map((item) => (item.key === step.key ? draft : item));
  const outcomes = outcomesText
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
  const userFields = definition.fields.filter((field) => field.type === "user");
  const setTransition = (index: number, change: Partial<WorkflowTransition>) =>
    setDraft({ ...draft, transitions: draft.transitions.map((item, position) => (position === index ? { ...item, ...change } : item)) });
  const save = () => {
    const assignee = draft.assignee.type === "user" ? { type: "user" as const, userId: person[0]?.id ?? "" } : draft.assignee;
    onSave({ ...draft, assignee, outcomes: outcomes.length > 0 ? outcomes : [t("defaultOutcome")] }, person[0] ?? null);
  };
  return (
    <Drawer title={t("stepTitle", { name: draft.name || draft.key })} onClose={onClose}>
      <Field id="step-name" label={t("stepName")}>
        <input id="step-name" className="o-nhap" value={draft.name} maxLength={100} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </Field>
      <Field id="step-instructions" label={t("instructions")}>
        <textarea id="step-instructions" className="o-nhap" rows={2} value={draft.instructions ?? ""} onChange={(event) => setDraft({ ...draft, instructions: event.target.value || null })} />
      </Field>
      <Field id="step-kind" label={t("stepKind")} hint={t("joinHint")}>
        <select id="step-kind" className="o-nhap" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as WorkflowStep["kind"] })}>
          <option value="task">{t("kind_task")}</option>
          <option value="join">{t("kind_join")}</option>
        </select>
      </Field>
      <Field id="step-days" label={t("days")}>
        <input id="step-days" type="number" min={1} max={365} className="o-nhap" value={draft.days} onChange={(event) => setDraft({ ...draft, days: Number(event.target.value) || 1 })} />
      </Field>
      <Field id="step-assignee" label={t("assignee")}>
        <select
          id="step-assignee"
          className="o-nhap"
          value={draft.assignee.type}
          onChange={(event) => {
            const type = event.target.value as WorkflowStep["assignee"]["type"];
            const assignee: WorkflowStep["assignee"] =
              type === "role" ? { type, roleId: options.roles[0]?.id ?? "" } : type === "field" ? { type, fieldKey: userFields[0]?.key ?? "" } : type === "user" ? { type, userId: "" } : { type };
            setDraft({ ...draft, assignee });
          }}
        >
          {(["initiator_manager", "initiator", "user", "role", "field"] as const).map((type) => (
            <option key={type} value={type}>
              {t(`assignee_${type}`)}
            </option>
          ))}
        </select>
      </Field>
      {draft.assignee.type === "user" && (
        <Field id="step-user" label={t("assignee_user")}>
          <PersonPicker id="step-user" value={person} onChange={setPerson} multiple={false} />
        </Field>
      )}
      {draft.assignee.type === "role" && (
        <Field id="step-role" label={t("assignee_role")} hint={t("roleHint")}>
          <select id="step-role" className="o-nhap" value={draft.assignee.roleId} onChange={(event) => setDraft({ ...draft, assignee: { type: "role", roleId: event.target.value } })}>
            {options.roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {draft.assignee.type === "field" && (
        <Field id="step-field" label={t("assignee_field")}>
          <select id="step-field" className="o-nhap" value={draft.assignee.fieldKey} onChange={(event) => setDraft({ ...draft, assignee: { type: "field", fieldKey: event.target.value } })}>
            {userFields.length === 0 && <option value="">{t("noUserField")}</option>}
            {userFields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field id="step-outcomes" label={t("outcomes")} hint={t("outcomesHint")}>
        <input id="step-outcomes" className="o-nhap" value={outcomesText} onChange={(event) => setOutcomesText(event.target.value)} />
      </Field>
      <h3>{t("transitions")}</h3>
      <span className="chu-thich">{t("transitionsHint")}</span>
      {draft.transitions.map((transition, index) => (
        <div key={index} className="the">
          <strong>{t("ruleNumber", { number: index + 1 })}</strong>
          <Field id={`rule-${index}-outcome`} label={t("whenOutcome")}>
            <select id={`rule-${index}-outcome`} className="o-nhap" value={transition.outcome ?? ""} onChange={(event) => setTransition(index, { outcome: event.target.value || null })}>
              <option value="">{t("anyOutcome")}</option>
              {outcomes.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`rule-${index}-field`} label={t("andCondition")}>
            <select
              id={`rule-${index}-field`}
              className="o-nhap"
              value={transition.condition?.fieldKey ?? ""}
              onChange={(event) => setTransition(index, { condition: event.target.value ? { fieldKey: event.target.value, operator: "eq", value: "" } : null })}
            >
              <option value="">{t("noCondition")}</option>
              {definition.fields
                .filter((field) => field.type !== "user")
                .map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label}
                  </option>
                ))}
            </select>
          </Field>
          {transition.condition && (
            <div className="hai-cot">
              <Field id={`rule-${index}-operator`} label={t("operator")}>
                <select
                  id={`rule-${index}-operator`}
                  className="o-nhap"
                  value={transition.condition.operator}
                  onChange={(event) => setTransition(index, { condition: { ...transition.condition!, operator: event.target.value as (typeof workflowOperators)[number] } })}
                >
                  {workflowOperators.map((operator) => (
                    <option key={operator} value={operator}>
                      {t(`operator_${operator}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={`rule-${index}-value`} label={t("value")}>
                <input
                  id={`rule-${index}-value`}
                  className="o-nhap"
                  value={transition.condition.value}
                  onChange={(event) => setTransition(index, { condition: { ...transition.condition!, value: event.target.value } })}
                />
              </Field>
            </div>
          )}
          <Field id={`rule-${index}-targets`} label={t("goTo")}>
            <TargetPicker id={`rule-${index}-targets`} steps={others} value={transition.targets} onChange={(targets) => setTransition(index, { targets })} />
          </Field>
          <button type="button" className="nut chu" onClick={() => setDraft({ ...draft, transitions: draft.transitions.filter((_, position) => position !== index) })}>
            {t("removeRule")}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="nut phu"
        disabled={draft.transitions.length >= 10}
        onClick={() => setDraft({ ...draft, transitions: [...draft.transitions, { outcome: null, condition: null, targets: [workflowEnd] }] })}
      >
        {t("addRule")}
      </button>
      <Field id="step-otherwise" label={t("otherwise")}>
        <TargetPicker id="step-otherwise" steps={others} value={draft.otherwise ?? []} onChange={(targets) => setDraft({ ...draft, otherwise: targets.length > 0 ? targets : null })} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="button" className="nut chinh" disabled={!draft.name.trim() || (draft.assignee.type === "user" && person.length === 0)} onClick={save}>
          {t("applyStep")}
        </button>
      </div>
    </Drawer>
  );
}
