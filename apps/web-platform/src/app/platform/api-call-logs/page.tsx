"use client";

// MAN_HINH_226 Nhật ký gọi API (CHUC_NANG_218; API_259). Chỉ xem.
import { useTranslations } from "next-intl";
import { ApiCallLogTable } from "@/components/ApiCallLogTable";

export default function ApiCallLogsPage() {
  const t = useTranslations("apiCallLogs");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <ApiCallLogTable />
    </>
  );
}
