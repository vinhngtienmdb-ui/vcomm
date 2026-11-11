"use client";

// MAN_HINH_143 Công nợ theo tuổi nợ (CHUC_NANG_177; API_173; QUYTAC_NGHIEPVU_341).
import { analyticsDebtGroupings, type AnalyticsDebtFigures, type AnalyticsDebtGrouping, type AnalyticsDebtResponse, type DebtSide } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ExportButton } from "@/components/ExportButton";
import { MetricCard, MetricGrid } from "@/components/MetricCard";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportTable } from "@/components/ReportTable";

export default function DebtReportPage() {
  const t = useTranslations("analytics");
  const [side, setSide] = useState<DebtSide>("receivable");
  const [groupBy, setGroupBy] = useState<AnalyticsDebtGrouping>("company");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("debtTitle")}</h1>
      </div>
      <ReportFilters
        kind="debt"
        withPeriod={false}
        extra={
          <div className="cac-the" role="tablist" aria-label={t("debtSide")}>
            {(["receivable", "payable"] as const).map((key) => (
              <button key={key} type="button" role="tab" aria-selected={side === key} className={side === key ? "chon" : ""} onClick={() => setSide(key)}>
                {t(`side_${key}`)}
              </button>
            ))}
          </div>
        }
      >
        {({ query }) => {
          query.set("side", side);
          query.set("groupBy", groupBy);
          return (
            <>
              <div className="cac-the" role="tablist" aria-label={t("groupBy")}>
                {analyticsDebtGroupings.map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={groupBy === key} className={groupBy === key ? "chon" : ""} onClick={() => setGroupBy(key)}>
                    {t(`debt_${key}`)}
                  </button>
                ))}
              </div>
              <DebtTable query={query.toString()} />
            </>
          );
        }}
      </ReportFilters>
    </>
  );
}

function DebtTable({ query }: { query: string }) {
  const t = useTranslations("analytics");
  const { state, reload } = useApi<AnalyticsDebtResponse>(`/analytics/debts?${query}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(report) => {
        const figures = (row: AnalyticsDebtFigures, currency: string) =>
          [row.balance, row.notDue, row.overdue1To30, row.overdue31To60, row.overdue61To90, row.overdueOver90, row.advance, row.internalBalance].map((value) => formatMoney(value, currency));
        return (
          <>
            <span className="chu-thich">{t("debtNote", { date: formatDate(report.today) })}</span>
            <MetricGrid>
              {(["receivable", "payable"] as const).map((key) => (
                <MetricCard
                  key={key}
                  title={t(`side_${key}`)}
                  value={formatMoney(report.summary[key].balance, report.currency)}
                  detail={t("overdueAmount", { amount: formatMoney(report.summary[key].overdue, report.currency) })}
                />
              ))}
            </MetricGrid>
            <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
              <ExportButton path={`/analytics/debts?${query}&format=xlsx`} fileName={`bao-cao-cong-no-${report.side === "receivable" ? "phai-thu" : "phai-tra"}-${report.today}.xlsx`} />
            </div>
            {report.rows.some((row) => !row.inTotal) && <div className="khoi-canh-bao thong-tin">{t("otherCurrencyNote", { currency: report.currency })}</div>}
            {report.rows.length === 0 ? (
              <MessageView text={t("debtEmpty")} />
            ) : (
              <ReportTable
                columns={[
                  { title: t(`debt_${report.groupBy}`) },
                  ...["balance", "notDue", "overdue1To30", "overdue31To60", "overdue61To90", "overdueOver90", "advance", "internalBalance"].map((key) => ({ title: t(key), numeric: true })),
                ]}
                rows={report.rows.map((row) => ({
                  key: `${row.key}-${row.currency}`,
                  cells: [row.inTotal ? row.label : t("notInTotal", { label: row.label, currency: row.currency }), ...figures(row, row.currency)],
                }))}
                footer={[
                  { key: "cong", cells: [t("sumOfCompanies"), ...figures(report.totals, report.currency)] },
                  { key: "loai-tru", cells: [t("totalExcludingInternal"), formatMoney(report.totals.balanceExcludingInternal, report.currency), "", "", "", "", "", "", ""] },
                ]}
                note={report.totalRows ? t("truncated", { shown: report.rows.length, total: report.totalRows }) : null}
              />
            )}
          </>
        );
      }}
    </Loaded>
  );
}
