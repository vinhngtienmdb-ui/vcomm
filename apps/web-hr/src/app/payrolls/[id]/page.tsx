"use client";

// MAN_HINH_127 Chi tiết bảng lương, MAN_HINH_128 ngăn chi tiết dòng lương (CHUC_NANG_169; QUYTAC_NGHIEPVU_316 đến 322; API_159, API_160).
import type { EmployeeOptionsResponse, PayrollAdjustmentCategory, PayrollAdjustmentItem, PayrollLineDetail, PayrollResponse, SavePayrollAdjustmentRequest } from "contracts";
import { payrollAdjustmentCategories } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "@/components/EmployeeTabs";
import { monthLabel, PayrollStatusBadge, vnd, WarningBadges } from "@/components/PayrollParts";

const additionCategories: PayrollAdjustmentCategory[] = ["bonus", "arrears", "commission", "other"];
const deductionCategories: PayrollAdjustmentCategory[] = ["advance", "compensation", "union_dues", "other"];

export default function PayrollDetailPage() {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const [departmentId, setDepartmentId] = useState("");
  const [warningsOnly, setWarningsOnly] = useState(false);
  const query = new URLSearchParams({ ...(departmentId ? { departmentId } : {}), ...(warningsOnly ? { warningsOnly: "true" } : {}) }).toString();
  const { state, reload } = useApi<PayrollResponse>(`/hr/payrolls/${id}${query ? `?${query}` : ""}`);
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  const [lineId, setLineId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const act = (path: string, done: string) => {
    setBusy(true);
    apiFetch(`/hr/payrolls/${id}/${path}`, { method: "POST" })
      .then(() => {
        notify(done);
        void reload();
      })
      .catch((error: unknown) => notify(failureOf(error).message, "loi"))
      .finally(() => setBusy(false));
  };
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(payroll) => (
        <>
          <div className="tieu-de">
            <h1>
              {t("payrollTitle", { month: monthLabel(payroll.month) })} <PayrollStatusBadge status={payroll.status} />
            </h1>
            <div className="nhom-nut" style={{ margin: 0 }}>
              <button
                type="button"
                className="nut phu"
                onClick={() => void apiDownload(`/hr/payrolls/${id}/export`, `bang-luong-${payroll.month.slice(0, 7)}.xlsx`).catch((error: unknown) => notify(failureOf(error).message, "loi"))}
              >
                {t("exportExcel")}
              </button>
              {payroll.canEdit && (
                <button type="button" className={`nut phu${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => act("recalculate", t("recalculated"))}>
                  {t("recalculate")}
                </button>
              )}
              {payroll.canCancel && (
                <button type="button" className="nut nguy-hiem" onClick={() => setCancelling(true)}>
                  {t("cancelPayroll")}
                </button>
              )}
              {payroll.canSubmit && (
                <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => act("submit", t("submitted"))}>
                  {payroll.status === "draft" ? t("submit") : t("resubmit")}
                </button>
              )}
              {payroll.canWithdraw && (
                <button type="button" className="nut phu" disabled={busy} onClick={() => act("withdraw", t("withdrawn"))}>
                  {t("withdraw")}
                </button>
              )}
              <HistoryLink entityType="payroll" entityId={payroll.id} />
            </div>
          </div>
          {payroll.canEdit && !payroll.timesheetClosed && <div className="khoi-canh-bao canh-bao">{t("timesheetOpenWarning", { month: monthLabel(payroll.month) })}</div>}
          {payroll.blockingCount > 0 && <div className="khoi-canh-bao loi">{t("blockingWarning", { count: payroll.blockingCount })}</div>}
          {payroll.status === "cancelled" && <div className="khoi-canh-bao trung-tinh">{t("cancelledText", { reason: payroll.cancelReason ?? "" })}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--khoang-3)" }}>
            <div className="the">
              <dl className="thong-tin-dong">
                <dt>{t("documentNo")}</dt>
                <dd>{payroll.documentNo ?? t("numberOnSubmit")}</dd>
                <dt>{t("parametersUsed")}</dt>
                <dd>{t("parametersUsedText", { date: payroll.parameterEffectiveFrom.split("-").reverse().join("/"), base: vnd(payroll.baseSalary) })}</dd>
                <dt>{t("standardDays")}</dt>
                <dd>{payroll.standardDays ? Number(payroll.standardDays).toLocaleString("vi-VN") : "—"}</dd>
                <dt>{t("lastCalculated")}</dt>
                <dd>
                  {formatDateTime(payroll.calculatedAt)} · {payroll.calculatedByName}
                </dd>
              </dl>
            </div>
            <div className="the">
              <dl className="thong-tin-dong">
                <dt>{t("grossIncome")}</dt>
                <dd>{vnd(payroll.grossIncome)}</dd>
                <dt>{t("insurance")}</dt>
                <dd>{vnd(payroll.employeeInsurance)}</dd>
                <dt>{t("tax")}</dt>
                <dd>{vnd(payroll.personalIncomeTax)}</dd>
                <dt>{t("deductionsLabel")}</dt>
                <dd>{vnd(payroll.deductions)}</dd>
                <dt>{t("netPay")}</dt>
                <dd>
                  <strong>{vnd(payroll.netPay)}</strong>
                </dd>
                <dt>{t("companyPays")}</dt>
                <dd>{vnd(String(Number(payroll.employerInsurance) + Number(payroll.unionFee)))}</dd>
                <dt>{t("employerCost")}</dt>
                <dd>
                  <strong>{vnd(payroll.employerCost)}</strong>
                </dd>
              </dl>
            </div>
          </div>
          <div className="bo-loc">
            <label className="an-nhan" htmlFor="bl-phong-ban">
              {t("department")}
            </label>
            <select id="bl-phong-ban" className="o-nhap" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">{t("allDepartments")}</option>
              {options.state.kind === "ready" &&
                options.state.data.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
            <label>
              <input type="checkbox" checked={warningsOnly} onChange={(event) => setWarningsOnly(event.target.checked)} /> {t("warningsOnly", { count: payroll.warningCount })}
            </label>
          </div>
          <Table
            headings={[
              t("employeeCode"),
              t("employeeName"),
              t("department"),
              t("workDays"),
              t("timePay"),
              t("allowancePay"),
              t("overtimePay"),
              t("additions"),
              t("grossIncome"),
              t("insurance"),
              t("tax"),
              t("deductionsLabel"),
              t("netPay"),
              t("warnings"),
            ]}
            rows={payroll.lines.map((line) => ({
              key: line.id,
              cells: [
                line.employeeCode,
                <button key="ten" type="button" className="nut phu" style={{ padding: "0 var(--khoang-2)" }} onClick={() => setLineId(line.id)}>
                  {line.employeeName}
                </button>,
                line.departmentName ?? "—",
                `${Number(line.paidDays).toLocaleString("vi-VN")}/${Number(line.standardDays).toLocaleString("vi-VN")}`,
                vnd(line.timePay),
                vnd(line.allowancePay),
                vnd(String(Number(line.overtimePay) + Number(line.nightPremium))),
                vnd(line.additions),
                vnd(line.grossIncome),
                vnd(line.employeeInsurance),
                vnd(line.personalIncomeTax),
                vnd(line.deductions),
                <strong key="tl">{vnd(line.netPay)}</strong>,
                <WarningBadges key="cb" warnings={line.warnings} />,
              ],
            }))}
          />
          <span className="chu-thich">{t("linesHint")}</span>
          {lineId && (
            <LineDrawer
              payrollId={payroll.id}
              lineId={lineId}
              onClose={() => setLineId(null)}
              onChanged={(updated) => {
                // Tính lại tạo dòng mới: giữ ngăn mở theo nhân viên.
                const current = payroll.lines.find((line) => line.id === lineId);
                const next = updated.lines.find((line) => line.employeeId === current?.employeeId);
                setLineId(next?.id ?? null);
                void reload();
              }}
            />
          )}
          {cancelling && <CancelDialog payrollId={payroll.id} onClose={() => setCancelling(false)} onDone={() => void reload()} />}
        </>
      )}
    </Loaded>
  );
}

function LineDrawer({ payrollId, lineId, onClose, onChanged }: { payrollId: string; lineId: string; onClose: () => void; onChanged: (updated: PayrollResponse) => void }) {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const { state, reload } = useApi<PayrollLineDetail>(`/hr/payrolls/${payrollId}/lines/${lineId}`);
  const [editing, setEditing] = useState<PayrollAdjustmentItem | "new" | null>(null);
  const [removing, setRemoving] = useState<PayrollAdjustmentItem | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Drawer title={t("lineTitle")} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(line) => {
          const explanation = line.explanation as {
            hourlyRate?: string;
            allowances?: { name: string; type: string | null; paid: string; exempt: string }[];
            overtime?: { group: string; hours: string; rate: string; pay: string }[];
            taxBrackets?: { from: string; to: string; rate: string; tax: string }[];
          };
          return (
            <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
              <h3>
                {line.employeeCode} · {line.employeeName}
              </h3>
              <WarningBadges warnings={line.warnings} />
              <h3>{t("incomeSection")}</h3>
              <dl className="thong-tin-dong">
                <dt>{t("monthlySalary")}</dt>
                <dd>{vnd(line.monthlySalary)}</dd>
                <dt>{t("workDays")}</dt>
                <dd>{t("workDaysText", { paid: Number(line.paidDays).toLocaleString("vi-VN"), standard: Number(line.standardDays).toLocaleString("vi-VN") })}</dd>
                <dt>{t("timePay")}</dt>
                <dd>{vnd(line.timePay)}</dd>
                {(explanation.allowances ?? []).map((allowance, index) => (
                  <div key={index} style={{ display: "contents" }}>
                    <dt>{allowance.name}</dt>
                    <dd>
                      {vnd(allowance.paid)}
                      {allowance.type === null ? ` · ${t("noAllowanceType")}` : Number(allowance.exempt) > 0 ? ` · ${t("exemptAmount", { amount: vnd(allowance.exempt) })}` : ""}
                    </dd>
                  </div>
                ))}
                <dt>{t("hourlyRate")}</dt>
                <dd>{vnd(String(Math.round(Number(explanation.hourlyRate ?? "0"))))}</dd>
                {(explanation.overtime ?? []).map((item) => (
                  <div key={item.group} style={{ display: "contents" }}>
                    <dt>{t(`overtime_${item.group}`)}</dt>
                    <dd>{t("overtimeText", { hours: Number(item.hours).toLocaleString("vi-VN"), rate: Number(item.rate) * 100, pay: vnd(item.pay) })}</dd>
                  </div>
                ))}
                {Number(line.nightPremium) > 0 && (
                  <>
                    <dt>{t("nightPremium")}</dt>
                    <dd>{vnd(line.nightPremium)}</dd>
                  </>
                )}
                {Number(line.settledLeavePay) > 0 && (
                  <>
                    <dt>{t("settledLeavePay")}</dt>
                    <dd>{vnd(line.settledLeavePay)}</dd>
                  </>
                )}
                <dt>{t("grossIncome")}</dt>
                <dd>
                  <strong>{vnd(line.grossIncome)}</strong>
                </dd>
              </dl>
              <h3>{t("insuranceSection")}</h3>
              <dl className="thong-tin-dong">
                <dt>{t("insuranceBases")}</dt>
                <dd>{t("basesText", { social: vnd(line.socialBase), health: vnd(line.healthBase), unemployment: vnd(line.unemploymentBase) })}</dd>
                <dt>{t("employeeRates")}</dt>
                <dd>{t("threeAmounts", { social: vnd(line.employeeSocial), health: vnd(line.employeeHealth), unemployment: vnd(line.employeeUnemployment) })}</dd>
                <dt>{t("employerRates")}</dt>
                <dd>
                  {t("threeAmounts", { social: vnd(line.employerSocial), health: vnd(line.employerHealth), unemployment: vnd(line.employerUnemployment) })} · {t("unionFee")} {vnd(line.unionFee)}
                </dd>
              </dl>
              <h3>{line.taxMethod === "flat" ? t("taxFlat") : t("taxProgressive")}</h3>
              <dl className="thong-tin-dong">
                <dt>{t("taxableIncome")}</dt>
                <dd>{vnd(line.taxableIncome)}</dd>
                {line.taxMethod === "progressive" && (
                  <>
                    <dt>{t("familyDeduction")}</dt>
                    <dd>{vnd(line.familyDeduction)}</dd>
                    <dt>{t("assessableIncome")}</dt>
                    <dd>{vnd(line.assessableIncome)}</dd>
                  </>
                )}
                {(explanation.taxBrackets ?? []).map((bracket, index) => (
                  <div key={index} style={{ display: "contents" }}>
                    <dt>{t("bracketLine", { index: index + 1, rate: Number(bracket.rate) * 100 })}</dt>
                    <dd>{vnd(bracket.tax)}</dd>
                  </div>
                ))}
                <dt>{t("tax")}</dt>
                <dd>{vnd(line.personalIncomeTax)}</dd>
              </dl>
              <div className="tieu-de">
                <h3>{t("adjustments")}</h3>
                {line.canEdit && (
                  <button type="button" className="nut phu" onClick={() => setEditing("new")}>
                    {t("addAdjustment")}
                  </button>
                )}
              </div>
              {line.adjustments.length === 0 ? (
                <span className="chu-thich">{t("noAdjustments")}</span>
              ) : (
                <Table
                  headings={[t("adjustmentCategory"), t("description"), t("amount"), ""]}
                  rows={line.adjustments.map((adjustment) => ({
                    key: adjustment.id,
                    cells: [
                      `${t(`kind_${adjustment.kind}`)} · ${t(`category_${adjustment.category}`)}${adjustment.taxable ? ` · ${t("taxableShort")}` : ""}`,
                      adjustment.description,
                      vnd(adjustment.amount),
                      line.canEdit ? (
                        <span key="nut" className="nhom-nut">
                          <button type="button" className="nut phu" onClick={() => setEditing(adjustment)}>
                            {t("edit")}
                          </button>
                          <button type="button" className="nut nguy-hiem" onClick={() => setRemoving(adjustment)}>
                            {t("delete")}
                          </button>
                        </span>
                      ) : (
                        ""
                      ),
                    ],
                  }))}
                />
              )}
              <dl className="thong-tin-dong">
                <dt>{t("netPay")}</dt>
                <dd>
                  <strong>{vnd(line.netPay)}</strong>
                </dd>
              </dl>
              {editing && (
                <AdjustmentForm
                  payrollId={payrollId}
                  employeeId={line.employeeId}
                  adjustment={editing === "new" ? null : editing}
                  onClose={() => setEditing(null)}
                  onSaved={(updated) => {
                    setEditing(null);
                    notify(t("saved"));
                    onChanged(updated);
                  }}
                />
              )}
              {removing && (
                <ConfirmDialog
                  title={t("deleteAdjustmentTitle")}
                  text={t("deleteAdjustmentText", { description: removing.description })}
                  confirmLabel={t("delete")}
                  busy={busy}
                  onClose={() => setRemoving(null)}
                  onConfirm={() => {
                    setBusy(true);
                    apiFetch<PayrollResponse>(`/hr/payrolls/${payrollId}/adjustments/${removing.id}`, { method: "DELETE" })
                      .then((updated) => {
                        setRemoving(null);
                        onChanged(updated);
                      })
                      .catch((error: unknown) => notify(failureOf(error).message, "loi"))
                      .finally(() => setBusy(false));
                  }}
                />
              )}
            </div>
          );
        }}
      </Loaded>
    </Drawer>
  );
}

function AdjustmentForm({
  payrollId,
  employeeId,
  adjustment,
  onClose,
  onSaved,
}: {
  payrollId: string;
  employeeId: string;
  adjustment: PayrollAdjustmentItem | null;
  onClose: () => void;
  onSaved: (updated: PayrollResponse) => void;
}) {
  const t = useTranslations("payroll");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [kind, setKind] = useState<"addition" | "deduction">(adjustment?.kind ?? "addition");
  const [category, setCategory] = useState<PayrollAdjustmentCategory>(adjustment?.category ?? "bonus");
  const [taxable, setTaxable] = useState(adjustment?.taxable ?? true);
  const [description, setDescription] = useState(adjustment?.description ?? "");
  const [amount, setAmount] = useState(adjustment?.amount ?? "");
  const categories = kind === "addition" ? additionCategories : deductionCategories;
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePayrollAdjustmentRequest = {
        employeeId,
        kind,
        category,
        taxable: kind === "addition" && taxable,
        description,
        amount,
        ...(adjustment ? { version: adjustment.version } : {}),
      };
      const path = adjustment ? `/hr/payrolls/${payrollId}/adjustments/${adjustment.id}` : `/hr/payrolls/${payrollId}/adjustments`;
      onSaved(await apiFetch<PayrollResponse>(path, { method: adjustment ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <Field id="kh-loai" label={t("adjustmentKind")} error={fields.kind}>
        <select
          id="kh-loai"
          className={inputClass("kind")}
          value={kind}
          onChange={(event) => {
            const next = event.target.value as "addition" | "deduction";
            setKind(next);
            setCategory(next === "addition" ? "bonus" : "advance");
          }}
        >
          <option value="addition">{t("kind_addition")}</option>
          <option value="deduction">{t("kind_deduction")}</option>
        </select>
      </Field>
      <Field id="kh-nhom" label={t("adjustmentCategory")} error={fields.category}>
        <select id="kh-nhom" className={inputClass("category")} value={category} onChange={(event) => setCategory(event.target.value as PayrollAdjustmentCategory)}>
          {payrollAdjustmentCategories
            .filter((value) => categories.includes(value))
            .map((value) => (
              <option key={value} value={value}>
                {t(`category_${value}`)}
              </option>
            ))}
        </select>
      </Field>
      {kind === "addition" && (
        <label>
          <input type="checkbox" checked={taxable} onChange={(event) => setTaxable(event.target.checked)} /> {t("taxableAddition")}
        </label>
      )}
      <Field id="kh-noi-dung" label={`${t("description")} *`} error={fields.description}>
        <input id="kh-noi-dung" className={inputClass("description")} value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Field id="kh-tien" label={`${t("amount")} *`} error={fields.amount}>
        <input id="kh-tien" inputMode="decimal" className={inputClass("amount")} value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
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
  );
}

function CancelDialog({ payrollId, onClose, onDone }: { payrollId: string; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("payroll");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [reason, setReason] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/hr/payrolls/${payrollId}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
      onClose();
      onDone();
    });
  }
  return (
    <Drawer title={t("cancelPayroll")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="huy-ly-do" label={`${t("cancelReason")} *`} error={fields.reason}>
          <textarea id="huy-ly-do" className={inputClass("reason")} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className={`nut nguy-hiem${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
            {t("cancelPayroll")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
