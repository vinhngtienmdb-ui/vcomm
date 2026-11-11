"use client";

// MAN_HINH_131 Thiết lập lương (CHUC_NANG_168; QUYTAC_NGHIEPVU_312 đến 314; API_156, API_157): tham số pháp luật theo ngày hiệu lực, thiết lập công ty, vùng chi nhánh, nhóm chi phí phòng ban, loại phụ cấp.
import type {
  AllowanceTaxMode,
  AllowanceTypeItem,
  PayrollCostGroup,
  PayrollParametersItem,
  PayrollSettingsResponse,
  SaveAllowanceTypeRequest,
  SavePayrollCompanySettingsRequest,
  SavePayrollParametersRequest,
} from "contracts";
import { allowanceTaxModes, payrollCostGroups } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/EmployeeTabs";

const tabs = ["parameters", "company", "structure", "allowances"] as const;
const vnd = (value: string) => formatMoney(value, "VND");
// Tỷ lệ lưu dạng phần (0,08), hiện và nhập dạng phần trăm (8).
const percent = (value: string) => String(Number((Number(value) * 100).toFixed(4)));
const percentText = (value: string) => Number((Number(value) * 100).toFixed(4)).toLocaleString("vi-VN");
const fraction = (value: string) => (value.trim() === "" ? value : String(Number((Number(value.replace(",", ".")) / 100).toFixed(6))));
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" } as const;

export default function PayrollSettingsPage() {
  const t = useTranslations("payroll");
  const { state, reload } = useApi<PayrollSettingsResponse>("/hr/payroll-settings");
  const [tab, setTab] = useState<(typeof tabs)[number]>("parameters");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("settingsTitle")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {tabs.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? "chon" : ""} onClick={() => setTab(value)}>
            {t(`settingsTab_${value}`)}
          </button>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settings) => (
          <>
            {tab === "parameters" && <ParametersTab settings={settings} onChanged={() => void reload()} />}
            {tab === "company" && <CompanyTab settings={settings} onChanged={() => void reload()} />}
            {tab === "structure" && <StructureTab settings={settings} onChanged={() => void reload()} />}
            {tab === "allowances" && <AllowanceTypesTab />}
          </>
        )}
      </Loaded>
    </>
  );
}

function ParametersTab({ settings, onChanged }: { settings: PayrollSettingsResponse; onChanged: () => void }) {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const [selectedId, setSelectedId] = useState(settings.parameters.find((item) => item.current)?.id ?? settings.parameters[0]?.id ?? null);
  const [editing, setEditing] = useState<PayrollParametersItem | "new" | null>(null);
  const [removing, setRemoving] = useState<PayrollParametersItem | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = settings.parameters.find((item) => item.id === selectedId) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("parametersTitle")}</h2>
        {settings.canEditParameters && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addParameters")}
          </button>
        )}
      </div>
      {!settings.canEditParameters && <div className="khoi-canh-bao thong-tin">{t("parametersReadOnly")}</div>}
      <Table
        headings={[t("effectiveFrom"), t("baseSalary"), t("regionMinimums"), t("deductions"), t("taxBracketCount"), t("status"), ""]}
        rows={settings.parameters.map((item) => ({
          key: item.id,
          cells: [
            <button key="chon" type="button" className="nut phu" onClick={() => setSelectedId(item.id)} aria-pressed={item.id === selectedId}>
              {formatDate(item.effectiveFrom)}
            </button>,
            vnd(item.baseSalary),
            item.regionMinimums.map((value) => Number(value).toLocaleString("vi-VN")).join(" / "),
            `${Number(item.personalDeduction).toLocaleString("vi-VN")} / ${Number(item.dependentDeduction).toLocaleString("vi-VN")}`,
            t("bracketCount", { count: item.taxBrackets.length }),
            <>
              {item.current && <span className="nhan thanh-cong">{t("currentSet")}</span>} {item.effectiveFrom > today && <span className="nhan canh-bao">{t("futureSet")}</span>}{" "}
              {item.used && <span className="nhan trung-tinh">{t("usedSet")}</span>}
            </>,
            settings.canEditParameters && !item.used ? (
              <span key="nut" className="nhom-nut">
                <button type="button" className="nut phu" onClick={() => setEditing(item)}>
                  {t("edit")}
                </button>
                <button type="button" className="nut nguy-hiem" onClick={() => setRemoving(item)}>
                  {t("delete")}
                </button>
              </span>
            ) : (
              ""
            ),
          ],
        }))}
      />
      {selected && <ParameterDetail item={selected} />}
      {editing && (
        <ParametersDrawer
          item={editing === "new" ? null : editing}
          template={editing === "new" ? (settings.parameters[0] ?? null) : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            onChanged();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={t("deleteParametersTitle")}
          text={t("deleteParametersText", { date: formatDate(removing.effectiveFrom) })}
          confirmLabel={t("delete")}
          busy={busy}
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            setBusy(true);
            apiFetch(`/hr/payroll-parameters/${removing.id}`, { method: "DELETE" })
              .then(() => {
                setRemoving(null);
                onChanged();
              })
              .catch((error: unknown) => notify(failureOf(error).message, "loi"))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </div>
  );
}

function ParameterDetail({ item }: { item: PayrollParametersItem }) {
  const t = useTranslations("payroll");
  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h3>{t("parameterDetail", { date: formatDate(item.effectiveFrom) })}</h3>
      <dl className="thong-tin-dong">
        <dt>{t("employeeRates")}</dt>
        <dd>
          {t("rateSocial")} {percentText(item.employeeSocialRate)}% · {t("rateHealth")} {percentText(item.employeeHealthRate)}% · {t("rateUnemployment")} {percentText(item.employeeUnemploymentRate)}%
        </dd>
        <dt>{t("employerRates")}</dt>
        <dd>
          {t("rateRetirement")} {percentText(item.employerRetirementRate)}% · {t("rateSickness")} {percentText(item.employerSicknessRate)}% · {t("rateHealth")} {percentText(item.employerHealthRate)}%
          · {t("rateUnemployment")} {percentText(item.employerUnemploymentRate)}%
        </dd>
        <dt>{t("caps")}</dt>
        <dd>
          {t("capText", {
            social: Number(item.socialCapMultiplier),
            reference: Number(item.insuranceReference ?? item.baseSalary).toLocaleString("vi-VN"),
            health: Number(item.healthCapMultiplier),
            unemployment: Number(item.unemploymentCapMultiplier),
          })}
        </dd>
        <dt>{t("flatWithholding")}</dt>
        <dd>{percentText(item.flatWithholdingRate)}%</dd>
        <dt>{t("unpaidDaysShort")}</dt>
        <dd>{t("unpaidDaysText", { days: item.unpaidDaysThreshold })}</dd>
      </dl>
      <h3>{t("taxBrackets")}</h3>
      <Table
        headings={[t("bracket"), t("upperBound"), t("taxRate")]}
        rows={item.taxBrackets.map((bracket, index) => ({
          key: String(index),
          cells: [String(index + 1), bracket.upperBound === null ? t("noUpperBound") : Number(bracket.upperBound).toLocaleString("vi-VN"), `${percentText(bracket.rate)}%`],
        }))}
      />
    </div>
  );
}

function ParametersDrawer({ item, template, onClose, onSaved }: { item: PayrollParametersItem | null; template: PayrollParametersItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("payroll");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const source = item ?? template;
  const [values, setValues] = useState<Record<string, string>>(() => ({
    effectiveFrom: item?.effectiveFrom.slice(0, 7) ?? "",
    baseSalary: source?.baseSalary ?? "",
    insuranceReference: source?.insuranceReference ?? "",
    region1: source?.regionMinimums[0] ?? "",
    region2: source?.regionMinimums[1] ?? "",
    region3: source?.regionMinimums[2] ?? "",
    region4: source?.regionMinimums[3] ?? "",
    employeeSocialRate: source ? percent(source.employeeSocialRate) : "",
    employeeHealthRate: source ? percent(source.employeeHealthRate) : "",
    employeeUnemploymentRate: source ? percent(source.employeeUnemploymentRate) : "",
    employerRetirementRate: source ? percent(source.employerRetirementRate) : "",
    employerSicknessRate: source ? percent(source.employerSicknessRate) : "",
    employerHealthRate: source ? percent(source.employerHealthRate) : "",
    employerUnemploymentRate: source ? percent(source.employerUnemploymentRate) : "",
    socialCapMultiplier: source?.socialCapMultiplier ?? "20",
    healthCapMultiplier: source?.healthCapMultiplier ?? "20",
    unemploymentCapMultiplier: source?.unemploymentCapMultiplier ?? "20",
    personalDeduction: source?.personalDeduction ?? "",
    dependentDeduction: source?.dependentDeduction ?? "",
    flatWithholdingRate: source ? percent(source.flatWithholdingRate) : "",
    unpaidDaysThreshold: String(source?.unpaidDaysThreshold ?? 14),
  }));
  const [brackets, setBrackets] = useState(source?.taxBrackets.map((bracket) => ({ upperBound: bracket.upperBound ?? "", rate: percent(bracket.rate) })) ?? [{ upperBound: "", rate: "" }]);
  const set = (key: string) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const input = (key: string, label: string, field = key, kind: "decimal" | "month" = "decimal") => (
    <Field id={`ts-${key}`} label={label} error={fields[field]}>
      <input
        id={`ts-${key}`}
        type={kind === "month" ? "month" : "text"}
        inputMode={kind === "decimal" ? "decimal" : undefined}
        className={inputClass(field)}
        value={values[key]}
        onChange={(event) => set(key)(event.target.value)}
      />
    </Field>
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePayrollParametersRequest = {
        effectiveFrom: values.effectiveFrom ? `${values.effectiveFrom}-01` : "",
        baseSalary: values.baseSalary!,
        insuranceReference: values.insuranceReference || null,
        regionMinimums: [values.region1!, values.region2!, values.region3!, values.region4!],
        employeeSocialRate: fraction(values.employeeSocialRate!),
        employeeHealthRate: fraction(values.employeeHealthRate!),
        employeeUnemploymentRate: fraction(values.employeeUnemploymentRate!),
        employerRetirementRate: fraction(values.employerRetirementRate!),
        employerSicknessRate: fraction(values.employerSicknessRate!),
        employerHealthRate: fraction(values.employerHealthRate!),
        employerUnemploymentRate: fraction(values.employerUnemploymentRate!),
        socialCapMultiplier: values.socialCapMultiplier!,
        healthCapMultiplier: values.healthCapMultiplier!,
        unemploymentCapMultiplier: values.unemploymentCapMultiplier!,
        personalDeduction: values.personalDeduction!,
        dependentDeduction: values.dependentDeduction!,
        flatWithholdingRate: fraction(values.flatWithholdingRate!),
        unpaidDaysThreshold: Number(values.unpaidDaysThreshold),
        taxBrackets: brackets.map((bracket, index) => ({ upperBound: index === brackets.length - 1 ? null : bracket.upperBound, rate: fraction(bracket.rate) })),
        ...(item ? { version: item.version } : {}),
      };
      await apiFetch(item ? `/hr/payroll-parameters/${item.id}` : "/hr/payroll-parameters", { method: item ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  }
  return (
    <Drawer title={item ? t("editParameters") : t("addParameters")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        {!item && template && <div className="khoi-canh-bao thong-tin">{t("copiedFrom", { date: formatDate(template.effectiveFrom) })}</div>}
        {input("effectiveFrom", `${t("effectiveFromMonth")} *`, "effectiveFrom", "month")}
        {input("baseSalary", `${t("baseSalary")} *`)}
        {input("insuranceReference", t("insuranceReference"))}
        {input("region1", `${t("region", { region: "I" })} *`, "regionMinimums.0")}
        {input("region2", `${t("region", { region: "II" })} *`, "regionMinimums.1")}
        {input("region3", `${t("region", { region: "III" })} *`, "regionMinimums.2")}
        {input("region4", `${t("region", { region: "IV" })} *`, "regionMinimums.3")}
        <h3>{t("employeeRates")}</h3>
        {input("employeeSocialRate", `${t("rateSocial")} (%) *`)}
        {input("employeeHealthRate", `${t("rateHealth")} (%) *`)}
        {input("employeeUnemploymentRate", `${t("rateUnemployment")} (%) *`)}
        <h3>{t("employerRates")}</h3>
        {input("employerRetirementRate", `${t("rateRetirement")} (%) *`)}
        {input("employerSicknessRate", `${t("rateSickness")} (%) *`)}
        {input("employerHealthRate", `${t("rateHealth")} (%) *`)}
        {input("employerUnemploymentRate", `${t("rateUnemployment")} (%) *`)}
        <h3>{t("caps")}</h3>
        {input("socialCapMultiplier", `${t("socialCap")} *`)}
        {input("healthCapMultiplier", `${t("healthCap")} *`)}
        {input("unemploymentCapMultiplier", `${t("unemploymentCap")} *`)}
        <h3>{t("taxSection")}</h3>
        {input("personalDeduction", `${t("personalDeduction")} *`)}
        {input("dependentDeduction", `${t("dependentDeduction")} *`)}
        {input("flatWithholdingRate", `${t("flatWithholding")} (%) *`)}
        {input("unpaidDaysThreshold", `${t("unpaidDaysThreshold")} *`)}
        <div className="truong">
          <span>{t("taxBrackets")}</span>
          {brackets.map((bracket, index) => (
            <div key={index} className="nhom-nut" style={{ alignItems: "flex-start" }}>
              <input
                className={`o-nhap${fields[`taxBrackets.${index}.upperBound`] ? " loi" : ""}`}
                aria-label={t("upperBound")}
                placeholder={index === brackets.length - 1 ? t("noUpperBound") : t("upperBound")}
                disabled={index === brackets.length - 1}
                inputMode="decimal"
                value={index === brackets.length - 1 ? "" : bracket.upperBound}
                onChange={(event) => setBrackets(brackets.map((current, position) => (position === index ? { ...current, upperBound: event.target.value } : current)))}
              />
              <input
                className={`o-nhap${fields[`taxBrackets.${index}.rate`] ? " loi" : ""}`}
                aria-label={t("taxRate")}
                placeholder={`${t("taxRate")} (%)`}
                inputMode="decimal"
                value={bracket.rate}
                onChange={(event) => setBrackets(brackets.map((current, position) => (position === index ? { ...current, rate: event.target.value } : current)))}
              />
              {brackets.length > 1 && (
                <button type="button" className="nut phu" onClick={() => setBrackets(brackets.filter((_, position) => position !== index))}>
                  {t("delete")}
                </button>
              )}
            </div>
          ))}
          <div>
            <button type="button" className="nut phu" onClick={() => setBrackets([...brackets.slice(0, -1), { upperBound: "", rate: "" }, ...brackets.slice(-1)])}>
              {t("addBracket")}
            </button>
          </div>
          {Object.keys(fields).some((key) => key.startsWith("taxBrackets")) && <span className="loi-o">{t("bracketError")}</span>}
        </div>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

function CompanyTab({ settings, onChanged }: { settings: PayrollSettingsResponse; onChanged: () => void }) {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const company = settings.company;
  const [unionFeeEnabled, setUnionFeeEnabled] = useState(company.unionFeeEnabled);
  const [values, setValues] = useState({
    unionFeeRate: percent(company.unionFeeRate),
    accidentRate: percent(company.accidentRate),
    withholdingThreshold: company.withholdingThreshold,
    fallbackStandardDays: String(company.fallbackStandardDays),
    overtimeWeekdayRate: percent(company.overtimeWeekdayRate),
    overtimeWeeklyRestRate: percent(company.overtimeWeeklyRestRate),
    overtimeHolidayRate: percent(company.overtimeHolidayRate),
    nightRate: percent(company.nightRate),
    nightOvertimeRate: percent(company.nightOvertimeRate),
  });
  const input = (key: keyof typeof values, label: string, hint?: string) => (
    <Field id={`ct-${key}`} label={label} error={fields[key]} hint={hint}>
      <input
        id={`ct-${key}`}
        inputMode="decimal"
        className={inputClass(key)}
        disabled={!settings.canEditCompany}
        value={values[key]}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
      />
    </Field>
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePayrollCompanySettingsRequest = {
        unionFeeEnabled,
        unionFeeRate: fraction(values.unionFeeRate),
        accidentRate: fraction(values.accidentRate),
        withholdingThreshold: values.withholdingThreshold,
        fallbackStandardDays: Number(values.fallbackStandardDays),
        overtimeWeekdayRate: fraction(values.overtimeWeekdayRate),
        overtimeWeeklyRestRate: fraction(values.overtimeWeeklyRestRate),
        overtimeHolidayRate: fraction(values.overtimeHolidayRate),
        nightRate: fraction(values.nightRate),
        nightOvertimeRate: fraction(values.nightOvertimeRate),
        ...(company.version ? { version: company.version } : {}),
      };
      await apiFetch("/hr/payroll-settings/company", { method: "PUT", body: JSON.stringify(body) });
      notify(t("saved"));
      onChanged();
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("companyTitle")}</h2>
      <div style={grid}>
        <label>
          <input type="checkbox" checked={unionFeeEnabled} disabled={!settings.canEditCompany} onChange={(event) => setUnionFeeEnabled(event.target.checked)} /> {t("unionFeeEnabled")}
        </label>
        {input("unionFeeRate", `${t("unionFeeRate")} (%)`)}
        {input("accidentRate", `${t("accidentRate")} (%)`, t("accidentHint"))}
        {input("withholdingThreshold", t("withholdingThreshold"))}
        {input("fallbackStandardDays", t("fallbackStandardDays"), t("fallbackHint"))}
        {input("overtimeWeekdayRate", `${t("overtimeWeekday")} (%)`)}
        {input("overtimeWeeklyRestRate", `${t("overtimeWeeklyRest")} (%)`)}
        {input("overtimeHolidayRate", `${t("overtimeHoliday")} (%)`)}
        {input("nightRate", `${t("nightRate")} (%)`)}
        {input("nightOvertimeRate", `${t("nightOvertimeRate")} (%)`)}
      </div>
      <FormError text={formError} />
      {settings.canEditCompany && (
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      )}
    </form>
  );
}

function StructureTab({ settings, onChanged }: { settings: PayrollSettingsResponse; onChanged: () => void }) {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const { submitting, formError, run } = useSubmit();
  const [regions, setRegions] = useState(Object.fromEntries(settings.branches.map((branch) => [branch.branchId, branch.region === null ? "" : String(branch.region)])));
  const [groups, setGroups] = useState<Record<string, PayrollCostGroup>>(Object.fromEntries(settings.departments.map((department) => [department.departmentId, department.costGroup])));
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch("/hr/payroll-settings/branches", {
        method: "PUT",
        body: JSON.stringify({ items: Object.entries(regions).map(([branchId, region]) => ({ branchId, region: region === "" ? null : Number(region) })) }),
      });
      await apiFetch("/hr/payroll-settings/departments", {
        method: "PUT",
        body: JSON.stringify({ items: Object.entries(groups).map(([departmentId, costGroup]) => ({ departmentId, costGroup })) }),
      });
      notify(t("saved"));
      onChanged();
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ ...grid, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <h2>{t("branchRegions")}</h2>
          <Table
            headings={[t("branch"), t("regionLabel")]}
            rows={settings.branches.map((branch) => ({
              key: branch.branchId,
              cells: [
                `${branch.code} · ${branch.name}`,
                <select
                  key="vung"
                  className="o-nhap"
                  aria-label={`${t("regionLabel")} ${branch.code}`}
                  disabled={!settings.canEditCompany}
                  value={regions[branch.branchId]}
                  onChange={(event) => setRegions((current) => ({ ...current, [branch.branchId]: event.target.value }))}
                >
                  <option value="">{t("regionNotChosen")}</option>
                  {[1, 2, 3, 4].map((region) => (
                    <option key={region} value={region}>
                      {t("regionOption", { region })}
                    </option>
                  ))}
                </select>,
              ],
            }))}
          />
          <span className="chu-thich">{t("regionHint")}</span>
        </div>
        <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <h2>{t("departmentGroups")}</h2>
          <Table
            headings={[t("department"), t("costGroup")]}
            rows={settings.departments.map((department) => ({
              key: department.departmentId,
              cells: [
                department.name,
                <select
                  key="nhom"
                  className="o-nhap"
                  aria-label={`${t("costGroup")} ${department.name}`}
                  disabled={!settings.canEditCompany}
                  value={groups[department.departmentId]}
                  onChange={(event) => setGroups((current) => ({ ...current, [department.departmentId]: event.target.value as PayrollCostGroup }))}
                >
                  {payrollCostGroups.map((group) => (
                    <option key={group} value={group}>
                      {t(`costGroup_${group}`)}
                    </option>
                  ))}
                </select>,
              ],
            }))}
          />
          <span className="chu-thich">{t("costGroupHint")}</span>
        </div>
      </div>
      <FormError text={formError} />
      {settings.canEditCompany && (
        <div className="nhom-nut">
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      )}
    </form>
  );
}

function AllowanceTypesTab() {
  const t = useTranslations("payroll");
  const { can, notify } = useAdmin();
  const { state, reload } = useApi<AllowanceTypeItem[]>("/hr/allowance-types");
  const [editing, setEditing] = useState<AllowanceTypeItem | "new" | null>(null);
  const canEdit = can("hr.payroll.setup");
  const taxText = (item: AllowanceTypeItem) => (item.taxMode === "exempt_up_to" ? t("taxMode_exempt_up_to_value", { limit: vnd(item.exemptLimit ?? "0") }) : t(`taxMode_${item.taxMode}`));
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h2>{t("allowanceTypes")}</h2>
        {canEdit && (
          <button type="button" className="nut chinh" onClick={() => setEditing("new")}>
            {t("addAllowanceType")}
          </button>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(types) =>
          types.length === 0 ? (
            <span className="chu-thich">{t("noAllowanceTypes")}</span>
          ) : (
            <Table
              headings={[t("allowanceName"), t("taxModeLabel"), t("prorated"), t("overtimeBase"), t("status"), ""]}
              rows={types.map((item) => ({
                key: item.id,
                cells: [
                  item.name,
                  taxText(item),
                  item.prorated ? t("yes") : t("no"),
                  item.overtimeBase ? t("yes") : t("no"),
                  <span key="tt" className={`nhan ${item.status === "active" ? "thanh-cong" : "trung-tinh"}`}>
                    {t(`typeStatus_${item.status}`)}
                  </span>,
                  canEdit ? (
                    <button key="sua" type="button" className="nut phu" onClick={() => setEditing(item)}>
                      {t("edit")}
                    </button>
                  ) : (
                    ""
                  ),
                ],
              }))}
            />
          )
        }
      </Loaded>
      {editing && (
        <AllowanceTypeDrawer
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </div>
  );
}

function AllowanceTypeDrawer({ item, onClose, onSaved }: { item: AllowanceTypeItem | null; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("payroll");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [name, setName] = useState(item?.name ?? "");
  const [taxMode, setTaxMode] = useState<AllowanceTaxMode>(item?.taxMode ?? "taxable");
  const [exemptLimit, setExemptLimit] = useState(item?.exemptLimit ?? "");
  const [prorated, setProrated] = useState(item?.prorated ?? true);
  const [overtimeBase, setOvertimeBase] = useState(item?.overtimeBase ?? false);
  const [active, setActive] = useState((item?.status ?? "active") === "active");
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveAllowanceTypeRequest = {
        name,
        taxMode,
        exemptLimit: taxMode === "exempt_up_to" ? exemptLimit || null : null,
        prorated,
        overtimeBase,
        status: active ? "active" : "inactive",
        ...(item ? { version: item.version } : {}),
      };
      await apiFetch(item ? `/hr/allowance-types/${item.id}` : "/hr/allowance-types", { method: item ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    });
  }
  return (
    <Drawer title={item ? t("editAllowanceType") : t("addAllowanceType")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="pc-ten" label={`${t("allowanceName")} *`} error={fields.name}>
          <input id="pc-ten" className={inputClass("name")} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field id="pc-thue" label={t("taxModeLabel")} error={fields.taxMode}>
          <select id="pc-thue" className={inputClass("taxMode")} value={taxMode} onChange={(event) => setTaxMode(event.target.value as AllowanceTaxMode)}>
            {allowanceTaxModes.map((value) => (
              <option key={value} value={value}>
                {t(`taxMode_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {taxMode === "exempt_up_to" && (
          <Field id="pc-muc" label={`${t("exemptLimit")} *`} error={fields.exemptLimit}>
            <input id="pc-muc" inputMode="decimal" className={inputClass("exemptLimit")} value={exemptLimit} onChange={(event) => setExemptLimit(event.target.value)} />
          </Field>
        )}
        <label>
          <input type="checkbox" checked={prorated} onChange={(event) => setProrated(event.target.checked)} /> {t("prorated")}
        </label>
        <label>
          <input type="checkbox" checked={overtimeBase} onChange={(event) => setOvertimeBase(event.target.checked)} /> {t("overtimeBase")}
        </label>
        <label>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> {t("typeStatus_active")}
        </label>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("save")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
