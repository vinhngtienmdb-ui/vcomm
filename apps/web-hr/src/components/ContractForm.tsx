"use client";

// MAN_HINH_118 biểu mẫu hợp đồng (CHUC_NANG_163; QUYTAC_NGHIEPVU_297, 298): thử việc hiện mức công việc, lương chính thức; ngoại lệ theo luật cho hợp đồng xác định thời hạn.
import type { ContractAllowance, ContractKind, ContractResponse, EmployeeListResponse, EmployeeOptionsResponse, ProbationLevel, SalaryPaymentMethod, SaveContractRequest } from "contracts";
import { contractKinds, probationLevels, salaryPaymentMethods } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";
import { AllowanceEditor } from "./ContractParts";

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" } as const;

export function ContractForm({
  contract,
  employeeId,
  onSaved,
  onCancel,
}: {
  contract: ContractResponse | null;
  employeeId: string | null;
  onSaved?: (saved: ContractResponse) => void;
  onCancel?: () => void;
}) {
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  const employees = useApi<EmployeeListResponse>("/hr/employees?status=active&pageSize=100");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(loaded) => (
        <Loaded state={employees.state} onRetry={() => void employees.reload()}>
          {(list) => <ContractFormBody contract={contract} employeeId={employeeId} options={loaded} employees={list} onSaved={onSaved} onCancel={onCancel} />}
        </Loaded>
      )}
    </Loaded>
  );
}

function ContractFormBody({
  contract,
  employeeId,
  options,
  employees,
  onSaved,
  onCancel,
}: {
  contract: ContractResponse | null;
  employeeId: string | null;
  options: EmployeeOptionsResponse;
  employees: EmployeeListResponse;
  onSaved?: ((saved: ContractResponse) => void) | undefined;
  onCancel?: (() => void) | undefined;
}) {
  const t = useTranslations("contracts");
  const router = useRouter();
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const chosen = employees.data.find((item) => item.id === (contract?.employeeId ?? employeeId));
  const [employee, setEmployee] = useState(contract?.employeeId ?? employeeId ?? employees.data[0]?.id ?? "");
  const [kind, setKind] = useState<ContractKind>(contract?.kind ?? "fixed_term");
  const [effectiveDate, setEffectiveDate] = useState(contract?.effectiveDate ?? "");
  const [endDate, setEndDate] = useState(contract?.endDate ?? "");
  const [jobTitle, setJobTitle] = useState(contract?.original.jobTitle ?? chosen?.jobTitle ?? "");
  const [departmentId, setDepartmentId] = useState(contract?.original.departmentId ?? chosen?.departmentId ?? options.departments[0]?.id ?? "");
  const [branchId, setBranchId] = useState(contract?.original.branchId ?? chosen?.branchId ?? options.branches[0]?.id ?? "");
  const [salary, setSalary] = useState(contract?.original.salary ?? "");
  const [probationLevel, setProbationLevel] = useState<ProbationLevel>(contract?.probationLevel ?? "college");
  const [officialSalary, setOfficialSalary] = useState(contract?.officialSalary ?? "");
  const [paymentMethod, setPaymentMethod] = useState<SalaryPaymentMethod>(contract?.original.paymentMethod ?? "transfer");
  const [allowances, setAllowances] = useState<ContractAllowance[]>(contract?.original.allowances ?? []);
  const [signerName, setSignerName] = useState(contract?.signerName ?? "");
  const [signerTitle, setSignerTitle] = useState(contract?.signerTitle ?? "");
  const [otherTerms, setOtherTerms] = useState(contract?.otherTerms ?? "");
  const [exception, setException] = useState(Boolean(contract?.legalExceptionReason));
  const [exceptionReason, setExceptionReason] = useState(contract?.legalExceptionReason ?? "");

  function choose(id: string) {
    setEmployee(id);
    const item = employees.data.find((entry) => entry.id === id);
    if (item?.jobTitle) setJobTitle(item.jobTitle);
    if (item?.departmentId) setDepartmentId(item.departmentId);
    if (item?.branchId) setBranchId(item.branchId);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveContractRequest = {
        employeeId: employee,
        kind,
        effectiveDate,
        endDate: kind === "indefinite" ? null : endDate || null,
        jobTitle,
        departmentId,
        branchId,
        salary,
        probationLevel: kind === "probation" ? probationLevel : null,
        officialSalary: kind === "probation" ? officialSalary || null : null,
        paymentMethod,
        allowances,
        signerName,
        signerTitle,
        otherTerms,
        legalExceptionReason: kind === "fixed_term" && exception ? exceptionReason : null,
        ...(contract ? { version: contract.version } : {}),
      };
      const saved = await apiFetch<ContractResponse>(contract ? `/hr/contracts/${contract.id}` : "/hr/contracts", { method: contract ? "PATCH" : "POST", body: JSON.stringify(body) });
      notify(t("saved"));
      if (onSaved) onSaved(saved);
      else router.push(`/contracts/${saved.id}`);
    });
  }
  const input = (id: string, label: string, value: string, setter: (value: string) => void, field: string, type = "text", hint?: string) => (
    <Field id={id} label={label} error={fields[field]} hint={hint}>
      <input id={id} className={inputClass(field)} type={type} inputMode={type === "decimal" ? "decimal" : undefined} value={value} onChange={(event) => setter(event.target.value)} />
    </Field>
  );
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={grid}>
        <Field id="hd-nhan-vien" label={`${t("employee")} *`} error={fields.employeeId}>
          <select id="hd-nhan-vien" className={inputClass("employeeId")} value={employee} disabled={Boolean(contract)} onChange={(event) => choose(event.target.value)}>
            {employees.data.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.fullName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="hd-loai" label={`${t("kind")} *`} error={fields.kind}>
          <select id="hd-loai" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as ContractKind)}>
            {contractKinds.map((value) => (
              <option key={value} value={value}>
                {t(`kind_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {input("hd-hieu-luc", `${t("effectiveDate")} *`, effectiveDate, setEffectiveDate, "effectiveDate", "date")}
        {kind !== "indefinite" && input("hd-ket-thuc", `${t("endDate")} *`, endDate, setEndDate, "endDate", "date")}
        {kind === "probation" && (
          <Field id="hd-muc-tv" label={t("probationLevel")} error={fields.probationLevel}>
            <select id="hd-muc-tv" className={inputClass("probationLevel")} value={probationLevel} onChange={(event) => setProbationLevel(event.target.value as ProbationLevel)}>
              {probationLevels.map((value) => (
                <option key={value} value={value}>
                  {t(`level_${value}`)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {kind === "probation" && input("hd-luong-ct", `${t("officialSalary")} *`, officialSalary, setOfficialSalary, "officialSalary", "decimal")}
        {input("hd-luong", `${t("salary")} *`, salary, setSalary, "salary", "decimal", kind === "probation" ? t("probationHint") : undefined)}
        <Field id="hd-tra-luong" label={t("paymentMethod")} error={fields.paymentMethod}>
          <select id="hd-tra-luong" className={inputClass("paymentMethod")} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as SalaryPaymentMethod)}>
            {salaryPaymentMethods.map((value) => (
              <option key={value} value={value}>
                {t(`payment_${value}`)}
              </option>
            ))}
          </select>
        </Field>
        {input("hd-chuc-danh", `${t("jobTitle")} *`, jobTitle, setJobTitle, "jobTitle")}
        <Field id="hd-phong-ban" label={`${t("department")} *`} error={fields.departmentId}>
          <select id="hd-phong-ban" className={inputClass("departmentId")} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            {options.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="hd-chi-nhanh" label={`${t("branch")} *`} error={fields.branchId}>
          <select id="hd-chi-nhanh" className={inputClass("branchId")} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {options.branches.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {input("hd-nguoi-ky", `${t("signerName")} *`, signerName, setSignerName, "signerName")}
        {input("hd-chuc-danh-ky", `${t("signerTitle")} *`, signerTitle, setSignerTitle, "signerTitle")}
      </div>
      <AllowanceEditor value={allowances} onChange={setAllowances} errors={fields} />
      <Field id="hd-noi-dung-khac" label={t("otherTerms")} error={fields.otherTerms}>
        <textarea id="hd-noi-dung-khac" className={inputClass("otherTerms")} rows={3} value={otherTerms} onChange={(event) => setOtherTerms(event.target.value)} />
      </Field>
      {kind === "fixed_term" && (
        <div className="khoi-canh-bao thong-tin" style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <span>{t("legalExceptionHint")}</span>
          <label>
            <input type="checkbox" checked={exception} onChange={(event) => setException(event.target.checked)} /> {t("legalException")}
          </label>
          {exception && input("hd-ngoai-le", t("legalExceptionReason"), exceptionReason, setExceptionReason, "legalExceptionReason")}
        </div>
      )}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={() => (onCancel ? onCancel() : router.back())}>
          {t("close")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("saveDraft")}
        </button>
      </div>
      <span className="chu-thich">{t("signHint")}</span>
    </form>
  );
}
