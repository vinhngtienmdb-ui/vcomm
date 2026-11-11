"use client";

// Lập hồ sơ nhân sự từ ứng viên nhận việc (CONG_VIEC_54; QUYTAC_NGHIEPVU_387; API_203): MAN_HINH_115 điền sẵn, lưu qua đề nghị nhận việc.
import type { EmployeeDraftResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { EmployeeForm } from "@/components/EmployeeForm";

export default function HireCandidatePage() {
  const t = useTranslations("offers");
  const { id } = useParams<{ id: string }>();
  const offerId = useSearchParams().get("offerId") ?? "";
  const { state, reload } = useApi<EmployeeDraftResponse>(offerId ? `/hr/job-offers/${offerId}/employee-draft` : null);
  return (
    <>
      <p>
        <Link href={`/candidates/${id}`}>‹ {t("backToCandidate")}</Link>
      </p>
      <div className="tieu-de">
        <h1>{t("hireTitle")}</h1>
      </div>
      <div className="khoi-canh-bao thong-tin">{t("hireHint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(draft) => (
          <EmployeeForm
            employee={null}
            submitPath={`/hr/job-offers/${offerId}/hire`}
            prefill={{
              fullName: draft.fullName,
              phone: draft.phone ?? "",
              personalEmail: draft.personalEmail ?? "",
              educationLevel: draft.educationLevel ?? "",
              departmentId: draft.departmentId,
              branchId: draft.branchId,
              jobTitle: draft.jobTitle,
              hireDate: draft.hireDate,
            }}
          />
        )}
      </Loaded>
    </>
  );
}
