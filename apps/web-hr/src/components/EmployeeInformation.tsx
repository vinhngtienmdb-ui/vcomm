"use client";

// Thông tin hồ sơ dùng ở MAN_HINH_116 và MAN_HINH_119; số giấy tờ dạng che, hiện qua API (QUYTAC_NGHIEPVU_295).
import type { EmployeeResponse } from "contracts";
import { useTranslations } from "next-intl";
import { formatDate } from "ui/lib/format";
import { RevealValue } from "./RevealValue";

export function EmployeeInformation({ employee, revealPath, allowReveal }: { employee: EmployeeResponse; revealPath: string; allowReveal: boolean }) {
  const t = useTranslations("hr");
  const foreign = employee.nationality !== "VN";
  const reveal = (field: "identityNumber" | "taxCode" | "socialInsuranceNumber" | "bankAccountNumber" | "workPermitNumber") => (
    <RevealValue masked={employee[field]} field={field} path={revealPath} allowed={allowReveal} />
  );
  const rows: [string, React.ReactNode][] = [
    [t("gender"), t(`gender_${employee.gender}`)],
    [t("birthDate"), formatDate(employee.birthDate)],
    [t("nationality"), foreign ? employee.nationality : t("nationality_VN")],
    [foreign ? t("passportNumber") : t("identityNumber"), reveal("identityNumber")],
    [t("residence"), employee.residence],
    [t("phone"), employee.phone ?? "—"],
    [t("personalEmail"), employee.personalEmail ?? "—"],
    [t("contactAddress"), employee.contactAddress ?? "—"],
    [t("emergencyContactShort"), employee.emergencyContact ?? "—"],
    [t("maritalStatus"), employee.maritalStatus ? t(`marital_${employee.maritalStatus}`) : "—"],
    [t("educationLevel"), [employee.educationLevel ? t(`education_${employee.educationLevel}`) : null, employee.major].filter(Boolean).join(" · ") || "—"],
    [
      t("bankAccountNumber"),
      employee.bankAccountNumber ? (
        <>
          {employee.bankName ? `${employee.bankName} · ` : ""}
          {reveal("bankAccountNumber")}
        </>
      ) : (
        "—"
      ),
    ],
    [t("bankAccountHolder"), employee.bankAccountHolder ?? "—"],
    [t("taxCode"), reveal("taxCode")],
    [t("socialInsuranceNumber"), reveal("socialInsuranceNumber")],
    ...(foreign
      ? ([
          [t("workPermitNumber"), reveal("workPermitNumber")],
          [t("workPermitExpiry"), formatDate(employee.workPermitExpiry)],
        ] as [string, React.ReactNode][])
      : []),
  ];
  return (
    <div className="the">
      <dl className="thong-tin-dong">
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
