"use client";

// MAN_HINH_115 Biểu mẫu hồ sơ (CHUC_NANG_162; QUYTAC_NGHIEPVU_292 đến 295; API_144). Trường mã hóa khi sửa: để trống là giữ giá trị đã lưu.
import type { EducationLevel, EmployeeGender, EmployeeOptionsResponse, EmployeeResponse, MaritalStatus, SaveEmployeeRequest } from "contracts";
import { educationLevels, maritalStatuses } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" } as const;

export function EmployeeForm({ employee }: { employee: EmployeeResponse | null }) {
  const options = useApi<EmployeeOptionsResponse>("/hr/employee-options");
  return (
    <Loaded state={options.state} onRetry={() => void options.reload()}>
      {(loaded) => <EmployeeFormBody employee={employee} options={loaded} />}
    </Loaded>
  );
}

function EmployeeFormBody({ employee, options }: { employee: EmployeeResponse | null; options: EmployeeOptionsResponse }) {
  const t = useTranslations("hr");
  const router = useRouter();
  const { notify } = useAdmin();
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const [values, setValues] = useState<Record<string, string>>({
    code: employee?.code ?? "",
    fullName: employee?.fullName ?? "",
    gender: employee?.gender ?? "female",
    birthDate: employee?.birthDate ?? "",
    nationality: employee?.nationality ?? "VN",
    identityNumber: "",
    residence: employee?.residence ?? "",
    phone: employee?.phone ?? "",
    personalEmail: employee?.personalEmail ?? "",
    contactAddress: employee?.contactAddress ?? "",
    maritalStatus: employee?.maritalStatus ?? "",
    educationLevel: employee?.educationLevel ?? "",
    major: employee?.major ?? "",
    taxCode: "",
    socialInsuranceNumber: "",
    bankName: employee?.bankName ?? "",
    bankAccountNumber: "",
    bankAccountHolder: employee?.bankAccountHolder ?? "",
    workPermitNumber: "",
    workPermitExpiry: employee?.workPermitExpiry ?? "",
    emergencyContact: employee?.emergencyContact ?? "",
    hireDate: "",
    departmentId: options.departments[0]?.id ?? "",
    branchId: options.branches[0]?.id ?? "",
    jobTitle: "",
    userId: employee?.userId ?? "",
  });
  const set = (key: string) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const foreign = values.nationality !== "VN";
  const protectedValue = (key: string) => (employee && !values[key] ? undefined : values[key] || null);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveEmployeeRequest = {
        code: employee ? undefined : values.code || null,
        fullName: values.fullName ?? "",
        gender: values.gender as EmployeeGender,
        birthDate: values.birthDate ?? "",
        nationality: values.nationality,
        identityNumber: protectedValue("identityNumber"),
        residence: values.residence ?? "",
        phone: values.phone,
        personalEmail: values.personalEmail,
        contactAddress: values.contactAddress,
        maritalStatus: (values.maritalStatus || null) as MaritalStatus | null,
        educationLevel: (values.educationLevel || null) as EducationLevel | null,
        major: values.major,
        taxCode: protectedValue("taxCode"),
        socialInsuranceNumber: protectedValue("socialInsuranceNumber"),
        bankName: values.bankName,
        bankAccountNumber: protectedValue("bankAccountNumber"),
        bankAccountHolder: values.bankAccountHolder,
        workPermitNumber: foreign ? protectedValue("workPermitNumber") : null,
        workPermitExpiry: foreign && values.workPermitExpiry ? values.workPermitExpiry : null,
        emergencyContact: values.emergencyContact,
        userId: values.userId || null,
        ...(employee
          ? { version: employee.version }
          : { hireDate: values.hireDate, departmentId: values.departmentId || undefined, branchId: values.branchId || undefined, jobTitle: values.jobTitle || undefined }),
      };
      const saved = await apiFetch<EmployeeResponse>(employee ? `/hr/employees/${employee.id}` : "/hr/employees", { method: employee ? "PATCH" : "POST", body: JSON.stringify(body) });
      notify(t("saved"));
      router.push(`/employees/${saved.id}`);
    });
  }

  const text = (key: string, label: string, options: { type?: string; required?: boolean; hint?: string; masked?: string | null } = {}) => (
    <Field id={`ho-so-${key}`} label={`${label}${options.required ? " *" : ""}`} error={fields[key]} hint={options.masked ? `${options.masked} · ${t("protectedHint")}` : options.hint}>
      <input
        id={`ho-so-${key}`}
        className={inputClass(key)}
        type={options.type ?? "text"}
        autoComplete="off"
        value={values[key]}
        aria-invalid={Boolean(fields[key])}
        onChange={(event) => set(key)(event.target.value)}
      />
    </Field>
  );
  const select = (key: string, label: string, choices: { value: string; label: string }[], required = false) => (
    <Field id={`ho-so-${key}`} label={`${label}${required ? " *" : ""}`} error={fields[key]}>
      <select id={`ho-so-${key}`} className={inputClass(key)} value={values[key]} onChange={(event) => set(key)(event.target.value)}>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </Field>
  );
  const group = (title: string, children: ReactNode, note?: string) => (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{title}</h2>
      <div style={grid}>{children}</div>
      {note && <span className="chu-thich">{note}</span>}
    </div>
  );

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <div className="khoi-canh-bao thong-tin">{t("encryptionNotice")}</div>
      {group(
        t("group_personal"),
        <>
          {!employee && text("code", t("code"), { hint: t("codeHint") })}
          {text("fullName", t("fullName"), { required: true })}
          {select("gender", t("gender"), [
            { value: "female", label: t("gender_female") },
            { value: "male", label: t("gender_male") },
          ])}
          {text("birthDate", t("birthDate"), { type: "date", required: true })}
          <Field id="ho-so-quoc-tich" label={`${t("nationality")} *`} error={fields.nationality}>
            <select id="ho-so-quoc-tich" className={inputClass("nationality")} value={foreign ? "other" : "VN"} onChange={(event) => set("nationality")(event.target.value === "VN" ? "VN" : "")}>
              <option value="VN">{t("nationality_VN")}</option>
              <option value="other">{t("nationality_other")}</option>
            </select>
          </Field>
          {foreign && text("nationality", t("nationalityCode"), { required: true })}
          {select("maritalStatus", t("maritalStatus"), [{ value: "", label: t("notChosen") }, ...maritalStatuses.map((value) => ({ value, label: t(`marital_${value}`) }))])}
        </>,
      )}
      {group(
        t("group_identity"),
        <>
          {text("identityNumber", foreign ? t("passportNumber") : t("identityNumber"), { required: !employee, masked: employee?.identityNumber ?? null })}
          {text("residence", t("residence"), { required: true })}
        </>,
      )}
      {group(
        t("group_contact"),
        <>
          {text("phone", t("phone"), { type: "tel" })}
          {text("personalEmail", t("personalEmail"), { type: "email" })}
          {text("contactAddress", t("contactAddress"))}
          {text("emergencyContact", t("emergencyContact"))}
        </>,
      )}
      {group(
        t("group_education"),
        <>
          {select("educationLevel", t("educationLevel"), [{ value: "", label: t("notChosen") }, ...educationLevels.map((value) => ({ value, label: t(`education_${value}`) }))])}
          {text("major", t("major"))}
        </>,
      )}
      {!employee &&
        group(
          t("group_work"),
          <>
            {select(
              "departmentId",
              t("department"),
              options.departments.map((item) => ({ value: item.id, label: item.name })),
              true,
            )}
            {select(
              "branchId",
              t("branch"),
              options.branches.map((item) => ({ value: item.id, label: item.name })),
              true,
            )}
            {text("jobTitle", t("jobTitle"), { required: true })}
            {text("hireDate", t("hireDate"), { type: "date", required: true })}
          </>,
          t("hireHint"),
        )}
      {group(
        t("group_finance"),
        <>
          {text("bankName", t("bankName"))}
          {text("bankAccountNumber", t("bankAccountNumber"), { masked: employee?.bankAccountNumber ?? null })}
          {text("bankAccountHolder", t("bankAccountHolder"))}
          {text("taxCode", t("taxCode"), { masked: employee?.taxCode ?? null })}
          {text("socialInsuranceNumber", t("socialInsuranceNumber"), { masked: employee?.socialInsuranceNumber ?? null })}
        </>,
      )}
      {foreign &&
        group(
          t("group_foreign"),
          <>
            {text("workPermitNumber", t("workPermitNumber"), { masked: employee?.workPermitNumber ?? null })}
            {text("workPermitExpiry", t("workPermitExpiry"), { type: "date" })}
          </>,
        )}
      {group(
        t("group_account"),
        select("userId", t("account"), [
          { value: "", label: t("noAccount") },
          ...(employee?.userId ? [{ value: employee.userId, label: employee.userEmail ?? employee.fullName }] : []),
          ...options.users.map((user) => ({ value: user.id, label: [user.fullName, user.email].filter(Boolean).join(" · ") })),
        ]),
        t("accountHint"),
      )}
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="button" className="nut phu" onClick={() => router.back()}>
          {t("cancel")}
        </button>
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
      </div>
    </form>
  );
}
