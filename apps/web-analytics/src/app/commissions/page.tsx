"use client";

// MAN_HINH_144 Hoa hồng và ví (CHUC_NANG_177; API_174; QUYTAC_NGHIEPVU_342).
import { analyticsCommissionGroupings, type AnalyticsCommissionGrouping, type AnalyticsCommissionResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ExportButton } from "@/components/ExportButton";
import { MetricCard, MetricGrid } from "@/components/MetricCard";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportTable } from "@/components/ReportTable";

export default function CommissionReportPage() {
  const t = useTranslations("analytics");
  const [groupBy, setGroupBy] = useState<AnalyticsCommissionGrouping>("share");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("commissionTitle")}</h1>
      </div>
      <ReportFilters kind="commission" withPeriod>
        {({ query }) => {
          query.set("groupBy", groupBy);
          return (
            <>
              <span className="chu-thich">{t("commissionNote")}</span>
              <CommissionView
                query={query.toString()}
                tabs={
                  <div className="cac-the" role="tablist" aria-label={t("groupBy")}>
                    {analyticsCommissionGroupings.map((key) => (
                      <button key={key} type="button" role="tab" aria-selected={groupBy === key} className={groupBy === key ? "chon" : ""} onClick={() => setGroupBy(key)}>
                        {t(`commission_${key}`)}
                      </button>
                    ))}
                  </div>
                }
              />
            </>
          );
        }}
      </ReportFilters>
    </>
  );
}

function CommissionView({ query, tabs }: { query: string; tabs: React.ReactNode }) {
  const t = useTranslations("analytics");
  const { state, reload } = useApi<AnalyticsCommissionResponse>(`/analytics/commissions?${query}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(report) => {
        const money = (value: string) => formatMoney(value, report.currency);
        const { summary } = report;
        return (
          <>
            <MetricGrid>
              <MetricCard title={t("creditedInPeriod")} value={money(summary.credited)} detail={t("commissionLines", { count: summary.creditedLines })} />
              <MetricCard title={t("pendingCommission")} value={money(summary.pending)} detail={t("pendingCommissionDetail")} />
              <MetricCard
                title={t("paidInPeriod")}
                value={money(summary.paid.amount)}
                detail={t("paidDetail", { tax: money(summary.paid.taxAmount), fee: money(summary.paid.feeAmount), net: money(summary.paid.netAmount) })}
              />
              <MetricCard
                title={t("walletBalance")}
                value={summary.walletBalance === null ? "—" : money(summary.walletBalance)}
                detail={t("pendingWithdrawals", { count: summary.pendingWithdrawals.count, amount: money(summary.pendingWithdrawals.amount) })}
              />
            </MetricGrid>
            <div className="nhom-nut" style={{ justifyContent: "space-between", alignItems: "end" }}>
              {tabs}
              <ExportButton path={`/analytics/commissions?${query}&format=xlsx`} fileName={`bao-cao-hoa-hong-${report.from}-${report.to}.xlsx`} />
            </div>
            {report.rows.length === 0 ? (
              <MessageView text={t("commissionEmpty")} />
            ) : (
              <ReportTable
                columns={[{ title: t(`commission_${report.groupBy}`) }, { title: t("commissionLineCount"), numeric: true }, { title: t("creditedAmount"), numeric: true }]}
                rows={report.rows.map((row) => ({ key: row.key, cells: [row.label, formatNumber(row.lines), money(row.amount)] }))}
                footer={[{ key: "tong", cells: [t("total"), formatNumber(summary.creditedLines), money(summary.credited)] }]}
                note={report.totalRows ? t("truncated", { shown: report.rows.length, total: report.totalRows }) : null}
              />
            )}
            <h2>{t("paidWithdrawals")}</h2>
            {report.withdrawals.length === 0 ? (
              <MessageView text={t("noPaidWithdrawals")} />
            ) : (
              <ReportTable
                columns={[{ title: t("beneficiary") }, { title: t("paidOn") }, ...["withdrawalAmount", "taxAmount", "feeAmount", "netAmount"].map((key) => ({ title: t(key), numeric: true }))]}
                rows={report.withdrawals.map((row) => ({
                  key: row.id,
                  cells: [row.userName, formatDate(row.paidOn), money(row.amount), money(row.taxAmount), money(row.feeAmount), money(row.netAmount)],
                }))}
                footer={[{ key: "tong", cells: [t("total"), "", money(summary.paid.amount), money(summary.paid.taxAmount), money(summary.paid.feeAmount), money(summary.paid.netAmount)] }]}
              />
            )}
          </>
        );
      }}
    </Loaded>
  );
}
