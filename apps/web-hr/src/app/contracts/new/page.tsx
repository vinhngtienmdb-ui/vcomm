"use client";

// MAN_HINH_118 Lập hợp đồng lao động (CHUC_NANG_163); mở từ chi tiết hồ sơ thì chọn sẵn nhân viên.
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ContractForm } from "@/components/ContractForm";

function NewContract() {
  const t = useTranslations("contracts");
  const employeeId = useSearchParams().get("employeeId");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("createTitle")}</h1>
      </div>
      <ContractForm contract={null} employeeId={employeeId} />
    </>
  );
}

export default function NewContractPage() {
  return (
    <Suspense>
      <NewContract />
    </Suspense>
  );
}
