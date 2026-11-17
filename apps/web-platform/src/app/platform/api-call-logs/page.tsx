"use client";

// MAN_HINH_226 Nhật ký gọi API (CHUC_NANG_218; API_259). Chỉ xem.
// Mở từ liên kết "Nhật ký gọi" của một khóa (CONG_VIEC_69): ?apiKeyId=<mã khóa> đặt sẵn ô lọc "Khóa".
import { apiCallLogQuerySchema } from "contracts";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingView } from "ui/components/StatusViews";
import { ApiCallLogTable } from "@/components/ApiCallLogTable";

export default function ApiCallLogsPage() {
  const t = useTranslations("apiCallLogs");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <Suspense fallback={<LoadingView />}>
        <FilteredTable />
      </Suspense>
    </>
  );
}

function FilteredTable() {
  const requested = apiCallLogQuerySchema.shape.apiKeyId.safeParse(useSearchParams().get("apiKeyId") ?? undefined);
  return <ApiCallLogTable initialApiKeyId={requested.success ? requested.data : undefined} />;
}
