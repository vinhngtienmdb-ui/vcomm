"use client";

// MAN_HINH_129 thẻ "Lương, thuế" của MAN_HINH_116 (CHUC_NANG_168; QUYTAC_NGHIEPVU_315; API_158): lương đóng bảo hiểm theo tháng, miễn đóng, cách tính thuế, cam kết 08/CK-TNCN.
import type { PayrollProfileResponse, PayrollTaxMethod, SaveInsuranceSalaryRequest, SavePayrollProfileRequest } from "contracts";
import { payrollTaxMethods } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog, Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload, apiFetch, apiUpload } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { Table } from "./EmployeeTabs";

// Lương tính bằng đồng Việt Nam (Bộ luật Lao động Điều 95).
const vnd = (value: string) => formatMoney(value, "VND");
const monthText = (value: string) => value.slice(0, 7).split("-").reverse().join("/");

export function PayrollProfileTab({ employeeId }: { employeeId: string }) {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const { state, reload } = useApi<PayrollProfileResponse>(`/hr/employees/${employeeId}/payroll-profile`);
  const [declaring, setDeclaring] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(profile) => (
        <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
          {profile.insuranceSalaries.length === 0 && <div className="khoi-canh-bao canh-bao">{t("missingInsuranceWarning")}</div>}
          <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
            <div className="tieu-de">
              <h2>{t("insuranceSalary")}</h2>
              <button type="button" className="nut phu" onClick={() => setDeclaring(true)}>
                {t("declareInsurance")}
              </button>
            </div>
            {profile.insuranceSalaries.length === 0 ? (
              <span className="chu-thich">{t("noInsuranceSalary")}</span>
            ) : (
              <Table
                headings={[t("fromMonth"), t("insuranceAmount"), t("note"), t("declaredBy"), ""]}
                rows={profile.insuranceSalaries.map((row) => ({
                  key: row.id,
                  cells: [
                    monthText(row.effectiveMonth),
                    <>
                      {vnd(row.amount)} {row.belowRegionalMinimum && <span className="nhan canh-bao">{t("belowMinimum")}</span>}
                    </>,
                    row.note ?? "—",
                    `${row.createdByName} · ${formatDate(row.createdAt.slice(0, 10))}`,
                    <button key="xoa" type="button" className="nut nguy-hiem" onClick={() => setRemoving(row.id)}>
                      {t("delete")}
                    </button>,
                  ],
                }))}
              />
            )}
            <span className="chu-thich">{t("insuranceHint")}</span>
          </div>
          <ProfileForm profile={profile} employeeId={employeeId} onSaved={() => void reload()} onCommit={() => setCommitting(true)} />
          {declaring && (
            <InsuranceDrawer
              employeeId={employeeId}
              onClose={() => setDeclaring(false)}
              onSaved={() => {
                setDeclaring(false);
                notify(t("saved"));
                void reload();
              }}
            />
          )}
          {committing && (
            <CommitmentDrawer
              employeeId={employeeId}
              onClose={() => setCommitting(false)}
              onSaved={() => {
                setCommitting(false);
                notify(t("saved"));
                void reload();
              }}
            />
          )}
          {removing && (
            <ConfirmDialog
              title={t("deleteInsuranceTitle")}
              text={t("deleteInsuranceText")}
              confirmLabel={t("delete")}
              busy={busy}
              onClose={() => setRemoving(null)}
              onConfirm={() => {
                setBusy(true);
                apiFetch(`/hr/employees/${employeeId}/insurance-salaries/${removing}`, { method: "DELETE" })
                  .then(() => {
                    setRemoving(null);
                    void reload();
                  })
                  .catch((error: unknown) => notify(failureOf(error).message, "loi"))
                  .finally(() => setBusy(false));
              }}
            />
          )}
        </div>
      )}
    </Loaded>
  );
}

function ProfileForm({ profile, employeeId, onSaved, onCommit }: { profile: PayrollProfileResponse; employeeId: string; onSaved: () => void; onCommit: () => void }) {
  const t = useTranslations("payroll");
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [socialExempt, setSocialExempt] = useState(profile.socialExempt);
  const [healthExempt, setHealthExempt] = useState(profile.healthExempt);
  const [unemploymentExempt, setUnemploymentExempt] = useState(profile.unemploymentExempt);
  const [reason, setReason] = useState(profile.exemptionReason ?? "");
  const [taxMethod, setTaxMethod] = useState<PayrollTaxMethod>(profile.taxMethod);
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePayrollProfileRequest = {
        socialExempt,
        healthExempt,
        unemploymentExempt,
        exemptionReason: reason,
        taxMethod,
        ...(profile.version ? { version: profile.version } : {}),
      };
      await apiFetch(`/hr/employees/${employeeId}/payroll-profile`, { method: "PUT", body: JSON.stringify(body) });
      notify(t("saved"));
      onSaved();
    });
  }
  const check = (label: string, value: boolean, setter: (value: boolean) => void) => (
    <label>
      <input type="checkbox" checked={value} onChange={(event) => setter(event.target.checked)} /> {label}
    </label>
  );
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" }}>
        <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <h2>{t("exemptions")}</h2>
          {check(t("socialExempt"), socialExempt, setSocialExempt)}
          {check(t("healthExempt"), healthExempt, setHealthExempt)}
          {check(t("unemploymentExempt"), unemploymentExempt, setUnemploymentExempt)}
          <Field id="luong-ly-do" label={t("exemptionReason")} error={fields.exemptionReason} hint={t("exemptionHint")}>
            <input id="luong-ly-do" className={inputClass("exemptionReason")} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        </div>
        <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <h2>{t("personalIncomeTax")}</h2>
          <Field id="luong-cach-thue" label={t("taxMethod")} error={fields.taxMethod}>
            <select id="luong-cach-thue" className={inputClass("taxMethod")} value={taxMethod} onChange={(event) => setTaxMethod(event.target.value as PayrollTaxMethod)}>
              {payrollTaxMethods.map((value) => (
                <option key={value} value={value}>
                  {t(`taxMethod_${value}`)}
                </option>
              ))}
            </select>
          </Field>
          <div className="truong">
            <span>{t("taxCommitment")}</span>
            {profile.taxCommitments.length === 0 ? (
              <span>{t("noCommitment")}</span>
            ) : (
              profile.taxCommitments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="nut phu"
                  style={{ justifySelf: "start" }}
                  onClick={() => void apiDownload(`/hr/employees/${employeeId}/tax-commitments/${item.id}`, item.fileName).catch((error: unknown) => notify(failureOf(error).message, "loi"))}
                >
                  {t("commitmentYear", { year: item.year })} · {item.fileName}
                </button>
              ))
            )}
            <button type="button" className="nut phu" style={{ justifySelf: "start" }} onClick={onCommit}>
              {t("addCommitment")}
            </button>
          </div>
          <span className="chu-thich">{t("commitmentHint")}</span>
          {!profile.hasTaxCode && <span className="nhan canh-bao">{t("missingTaxCode")}</span>}
        </div>
      </div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
      </div>
    </form>
  );
}

function InsuranceDrawer({ employeeId, onClose, onSaved }: { employeeId: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("payroll");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [month, setMonth] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveInsuranceSalaryRequest = { effectiveMonth: month ? `${month}-01` : "", amount, note };
      await apiFetch(`/hr/employees/${employeeId}/insurance-salaries`, { method: "POST", body: JSON.stringify(body) });
      onSaved();
    });
  }
  return (
    <Drawer title={t("declareInsurance")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="bh-thang" label={`${t("fromMonth")} *`} error={fields.effectiveMonth}>
          <input id="bh-thang" type="month" className={inputClass("effectiveMonth")} value={month} onChange={(event) => setMonth(event.target.value)} />
        </Field>
        <Field id="bh-muc" label={`${t("insuranceAmount")} *`} error={fields.amount} hint={t("insuranceAmountHint")}>
          <input id="bh-muc" inputMode="decimal" className={inputClass("amount")} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
        <Field id="bh-ghi-chu" label={t("note")} error={fields.note}>
          <input id="bh-ghi-chu" className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
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
    </Drawer>
  );
}

function CommitmentDrawer({ employeeId, onClose, onSaved }: { employeeId: string; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("payroll");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const form = new FormData();
      form.append("year", year);
      if (file) form.append("file", file);
      await apiUpload(`/hr/employees/${employeeId}/tax-commitments`, form);
      onSaved();
    });
  }
  return (
    <Drawer title={t("addCommitment")} onClose={onClose}>
      <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-3)" }}>
        <Field id="ck-nam" label={`${t("commitmentYearLabel")} *`} error={fields.year}>
          <input id="ck-nam" type="number" className={inputClass("year")} value={year} onChange={(event) => setYear(event.target.value)} />
        </Field>
        <Field id="ck-tep" label={`${t("commitmentFile")} *`} error={fields.file}>
          <input id="ck-tep" type="file" accept=".pdf,.jpg,.jpeg,.png" className={inputClass("file")} onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
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
    </Drawer>
  );
}
