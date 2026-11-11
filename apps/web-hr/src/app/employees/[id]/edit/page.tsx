"use client";

// MAN_HINH_115 Sửa hồ sơ nhân sự (CHUC_NANG_162).
import type { EmployeeResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { EmployeeForm } from "@/components/EmployeeForm";

export default function EditEmployeePage() {
  const t = useTranslations("hr");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<EmployeeResponse>(`/hr/employees/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(employee) => (
        <>
          <div className="tieu-de">
            <h1>{t("editTitle", { code: employee.code })}</h1>
          </div>
          <EmployeeForm employee={employee} />
        </>
      )}
    </Loaded>
  );
}
