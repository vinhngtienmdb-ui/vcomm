"use client";

// Thành phần dùng chung của đánh giá hiệu suất (CONG_VIEC_54; MAN_HINH_172, 173): biểu mẫu mẫu đánh giá, kỳ đánh giá, nhãn.
import type { ReviewCycleOptionsResponse, ReviewCycleResponse, ReviewPhase, ReviewTemplateResponse, SaveReviewCycleRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

export const cycleStatusClass: Record<string, string> = { draft: "trung-tinh", open: "thong-tin", closed: "canh-bao", published: "thanh-cong" };
const phaseClass: Record<ReviewPhase, string> = { goals: "canh-bao", self: "thong-tin", manager: "thong-tin", submitted: "thanh-cong", excluded: "trung-tinh" };
export function PhaseBadge({ phase }: { phase: ReviewPhase }) {
  const t = useTranslations("reviews");
  return <span className={`nhan ${phaseClass[phase]}`}>{t(`phase_${phase}`)}</span>;
}

export function TemplateForm({ template, onClose, onSaved }: { template: ReviewTemplateResponse | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [name, setName] = useState(template?.name ?? "");
  const [criteria, setCriteria] = useState(
    template?.criteria.map((item) => ({ name: item.name, description: item.description ?? "", weight: String(item.weight) })) ?? [{ name: "", description: "", weight: "100" }],
  );
  const total = criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const update = (index: number, key: "name" | "description" | "weight", value: string) => setCriteria(criteria.map((item, position) => (position === index ? { ...item, [key]: value } : item)));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const body = { name, criteria: criteria.map((item) => ({ ...item, weight: Number(item.weight) })), ...(template ? { version: template.version } : {}) };
      await apiFetch(template ? `/hr/review-templates/${template.id}` : "/hr/review-templates", { method: template ? "PATCH" : "POST", body: JSON.stringify(body) });
      notify(common("saved"));
      onSaved();
    });
  };
  return (
    <Drawer title={template ? t("editTemplate") : t("createTemplate")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
        <FormError text={formError} />
        <Field id="mau-ten" label={t("templateName")} error={fields.name}>
          <input id="mau-ten" className={inputClass("name")} value={name} onChange={(event) => setName(event.target.value)} maxLength={150} />
        </Field>
        {criteria.map((item, index) => (
          <div key={index} className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <Field id={`tc-ten-${index}`} label={t("criterionName", { number: index + 1 })} error={fields[`criteria.${index}.name`]}>
              <input id={`tc-ten-${index}`} className={inputClass(`criteria.${index}.name`)} value={item.name} onChange={(event) => update(index, "name", event.target.value)} maxLength={150} />
            </Field>
            <Field id={`tc-mo-ta-${index}`} label={t("criterionDescription")}>
              <input id={`tc-mo-ta-${index}`} className="o-nhap" value={item.description} onChange={(event) => update(index, "description", event.target.value)} maxLength={1000} />
            </Field>
            <Field id={`tc-trong-so-${index}`} label={t("weight")} error={fields[`criteria.${index}.weight`]}>
              <input
                id={`tc-trong-so-${index}`}
                type="number"
                min={1}
                max={100}
                className={inputClass(`criteria.${index}.weight`)}
                value={item.weight}
                onChange={(event) => update(index, "weight", event.target.value)}
              />
            </Field>
            {criteria.length > 1 && (
              <button type="button" className="nut phu" onClick={() => setCriteria(criteria.filter((_, position) => position !== index))}>
                {t("removeCriterion")}
              </button>
            )}
          </div>
        ))}
        <button type="button" className="nut phu" onClick={() => setCriteria([...criteria, { name: "", description: "", weight: "0" }])} disabled={criteria.length >= 30}>
          {t("addCriterion")}
        </button>
        <span className={total === 100 ? "chu-thich" : "loi-o"}>{t("totalWeight", { total })}</span>
        {fields.criteria && <span className="loi-o">{fields.criteria}</span>}
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

export function CycleForm({ cycle, onClose, onSaved }: { cycle: ReviewCycleResponse | null; onClose: () => void; onSaved: (id: string) => void }) {
  const t = useTranslations("reviews");
  const options = useApi<ReviewCycleOptionsResponse>("/hr/review-cycle-options");
  return (
    <Drawer title={cycle ? t("editCycle") : t("createCycle")} onClose={onClose}>
      <Loaded state={options.state} onRetry={() => void options.reload()}>
        {(loaded) => <CycleFormBody cycle={cycle} options={loaded} onClose={onClose} onSaved={onSaved} />}
      </Loaded>
    </Drawer>
  );
}

function CycleFormBody({ cycle, options, onClose, onSaved }: { cycle: ReviewCycleResponse | null; options: ReviewCycleOptionsResponse; onClose: () => void; onSaved: (id: string) => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const year = new Date().getFullYear();
  const [values, setValues] = useState({
    name: cycle?.name ?? t("defaultCycleName", { year }),
    periodFrom: cycle?.periodFrom ?? `${year}-01-01`,
    periodTo: cycle?.periodTo ?? `${year}-12-31`,
    templateId: cycle?.templateId ?? options.templates[0]?.id ?? "",
    goalWeight: String(cycle?.goalWeight ?? 60),
    competencyWeight: String(cycle?.competencyWeight ?? 40),
    thresholdA: cycle?.thresholdA ?? "4.50",
    thresholdB: cycle?.thresholdB ?? "3.50",
    thresholdC: cycle?.thresholdC ?? "2.50",
    goalDeadline: cycle?.goalDeadline ?? "",
    selfDeadline: cycle?.selfDeadline ?? "",
    managerDeadline: cycle?.managerDeadline ?? "",
  });
  const [allDepartments, setAllDepartments] = useState(cycle?.allDepartments ?? true);
  const [departmentIds, setDepartmentIds] = useState<string[]>(cycle?.departmentIds ?? []);
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues({ ...values, [key]: event.target.value });
  const text = (key: keyof typeof values, type = "text") => (
    <Field id={`ky-${key}`} label={t(`field_${key}`)} error={fields[key]}>
      <input id={`ky-${key}`} type={type} className={inputClass(key)} value={values[key]} onChange={set(key)} />
    </Field>
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const body: SaveReviewCycleRequest = {
        ...values,
        goalWeight: Number(values.goalWeight),
        competencyWeight: Number(values.competencyWeight),
        allDepartments,
        departmentIds,
        ...(cycle ? { version: cycle.version } : {}),
      };
      const saved = await apiFetch<ReviewCycleResponse>(cycle ? `/hr/review-cycles/${cycle.id}` : "/hr/review-cycles", { method: cycle ? "PATCH" : "POST", body: JSON.stringify(body) });
      notify(common("saved"));
      onSaved(saved.id);
    });
  };
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }} noValidate>
      <FormError text={formError} />
      {text("name")}
      {text("periodFrom", "date")}
      {text("periodTo", "date")}
      <Field id="ky-mau" label={t("template")} error={fields.templateId}>
        <select id="ky-mau" className={inputClass("templateId")} value={values.templateId} onChange={set("templateId")}>
          {options.templates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      {text("goalWeight", "number")}
      {text("competencyWeight", "number")}
      {text("thresholdA")}
      {text("thresholdB")}
      {text("thresholdC")}
      {text("goalDeadline", "date")}
      {text("selfDeadline", "date")}
      {text("managerDeadline", "date")}
      <div className="truong">
        <label>
          <input type="checkbox" checked={allDepartments} onChange={(event) => setAllDepartments(event.target.checked)} /> {t("allDepartments")}
        </label>
      </div>
      {!allDepartments && (
        <fieldset className="truong" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{t("departments")}</legend>
          {options.departments.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={departmentIds.includes(item.id)}
                onChange={(event) => setDepartmentIds(event.target.checked ? [...departmentIds, item.id] : departmentIds.filter((id) => id !== item.id))}
              />{" "}
              {item.name}
            </label>
          ))}
          {fields.departmentIds && <span className="loi-o">{fields.departmentIds}</span>}
        </fieldset>
      )}
      <div className="khoi-canh-bao thong-tin">{t("openHint")}</div>
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={onClose}>
          {common("cancel")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("saveDraft")}
        </button>
      </div>
    </form>
  );
}
