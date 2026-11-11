"use client";

// MAN_HINH_140 Tổng quan báo cáo quản trị (CHUC_NANG_175; API_170, API_175): thẻ chỉ tiêu theo quyền từng nhóm báo cáo, doanh số theo công ty.
import type { AnalyticsOverviewResponse } from "contracts";
import { useTranslations } from "next-intl";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { MetricCard, MetricGrid } from "@/components/MetricCard";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportTable } from "@/components/ReportTable";

export default function OverviewPage() {
  const t = useTranslations("analytics");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("overviewTitle")}</h1>
      </div>
      <ReportFilters kind={null} withPeriod>
        {({ scope, query }) => (
          <>
            <span className="chu-thich">{t("currencyNote", { currency: scope.group.currency })}</span>
            <Overview query={query.toString()} />
          </>
        )}
      </ReportFilters>
    </>
  );
}

function Overview({ query }: { query: string }) {
  const t = useTranslations("analytics");
  const { state, reload } = useApi<AnalyticsOverviewResponse>(`/analytics/overview?${query}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(overview) => {
        const money = (value: string) => formatMoney(value, overview.currency);
        const { sales, inventory, debt, commission } = overview;
        const cards = [
          sales && (
            <MetricCard
              key="sales"
              href="/sales"
              title={t("revenue")}
              value={money(sales.totals.revenue)}
              detail={t("grossProfitDetail", {
                amount: money(sales.totals.grossProfit),
                margin: Number(sales.totals.revenue) === 0 ? "—" : `${formatNumber((Number(sales.totals.grossProfit) / Number(sales.totals.revenue)) * 100, 2)}%`,
              })}
            />
          ),
          inventory && (
            <MetricCard
              key="inventory"
              href="/inventory"
              title={t("closingValue")}
              value={money(inventory.closingValue)}
              detail={t("turnoverDetail", {
                turnover: inventory.turnover === null ? "—" : formatNumber(inventory.turnover, 2),
                days: inventory.daysOfInventory === null ? "—" : formatNumber(inventory.daysOfInventory, 1),
              })}
            />
          ),
          debt && (
            <MetricCard key="receivable" href="/debts" title={t("side_receivable")} value={money(debt.receivable.balance)} detail={t("overdueAmount", { amount: money(debt.receivable.overdue) })} />
          ),
          debt && <MetricCard key="payable" href="/debts" title={t("side_payable")} value={money(debt.payable.balance)} detail={t("overdueAmount", { amount: money(debt.payable.overdue) })} />,
          commission && (
            <MetricCard
              key="commission"
              href="/commissions"
              title={t("creditedInPeriod")}
              value={money(commission.credited)}
              detail={t("walletDetail", { amount: commission.walletBalance === null ? "—" : money(commission.walletBalance) })}
            />
          ),
        ].filter(Boolean);
        if (cards.length === 0) return <MessageView text={t("noCompany")} />;
        return (
          <>
            <MetricGrid>{cards}</MetricGrid>
            {sales && sales.rows.length > 0 && (
              <>
                <h2>{t("salesByCompany")}</h2>
                <ReportTable
                  columns={[{ title: t("sales_company") }, { title: t("revenue"), numeric: true }, { title: t("grossProfit"), numeric: true }, { title: t("internalRevenue"), numeric: true }]}
                  rows={sales.rows.map((row) => ({
                    key: `${row.key}-${row.currency}`,
                    cells: [
                      row.inTotal ? row.label : t("notInTotal", { label: row.label, currency: row.currency }),
                      formatMoney(row.revenue, row.currency),
                      formatMoney(row.grossProfit, row.currency),
                      formatMoney(row.internalRevenue, row.currency),
                    ],
                  }))}
                />
              </>
            )}
          </>
        );
      }}
    </Loaded>
  );
}
