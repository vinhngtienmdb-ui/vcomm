"use client";

// MAN_HINH_140 Tổng quan báo cáo quản trị (CHUC_NANG_175; API_170, API_175).
import { useTranslations } from "next-intl";
import { ReportFilters } from "@/components/ReportFilters";

export default function OverviewPage() {
  const t = useTranslations("analytics");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("overviewTitle")}</h1>
      </div>
      <ReportFilters kind={null} withPeriod>
        {({ scope }) => <span className="chu-thich">{t("currencyNote", { currency: scope.group.currency })}</span>}
      </ReportFilters>
    </>
  );
}
