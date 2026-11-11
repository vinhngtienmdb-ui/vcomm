"use client";

// MAN_HINH_115 Thêm hồ sơ nhân sự (CHUC_NANG_162).
import { useTranslations } from "next-intl";
import { EmployeeForm } from "@/components/EmployeeForm";

export default function NewEmployeePage() {
  const t = useTranslations("hr");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("createTitle")}</h1>
      </div>
      <EmployeeForm employee={null} />
    </>
  );
}
