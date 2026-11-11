"use client";

// MAN_HINH_141 Báo cáo bán hàng (CHUC_NANG_176; API_171; QUYTAC_NGHIEPVU_337, 338, 339).
import { analyticsSalesGroupings, type AnalyticsSalesFigures, type AnalyticsSalesGrouping, type AnalyticsSalesResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ExportButton } from "@/components/ExportButton";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportTable } from "@/components/ReportTable";

const margin = (row: AnalyticsSalesFigures) => (Number(row.revenue) === 0 ? "—" : `${formatNumber((Number(row.grossProfit) / Number(row.revenue)) * 100, 2)}%`);

export default function SalesReportPage() {
  const t = useTranslations("analytics");
  const [groupBy, setGroupBy] = useState<AnalyticsSalesGrouping>("company");
  const [channelId, setChannelId] = useState("");
  const [marketplaceOnly, setMarketplaceOnly] = useState(false);
  const [channels, setChannels] = useState<{ id: string; label: string }[]>([]);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("salesTitle")}</h1>
      </div>
      <ReportFilters
        kind="sales"
        withPeriod
        extra={
          <>
            <label className="an-nhan" htmlFor="loc-kenh">
              {t("channel")}
            </label>
            <select id="loc-kenh" className="o-nhap" value={channelId} onChange={(event) => setChannelId(event.target.value)}>
              <option value="">{t("allChannels")}</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.label}
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={marketplaceOnly} onChange={(event) => setMarketplaceOnly(event.target.checked)} /> {t("marketplaceOnly")}
            </label>
          </>
        }
      >
        {({ query }) => {
          query.set("groupBy", groupBy);
          if (channelId) query.set("channelId", channelId);
          if (marketplaceOnly) query.set("marketplaceOnly", "true");
          return (
            <>
              <span className="chu-thich">{t("salesNote")}</span>
              <div className="cac-the" role="tablist" aria-label={t("groupBy")}>
                {analyticsSalesGroupings.map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={groupBy === key} className={groupBy === key ? "chon" : ""} onClick={() => setGroupBy(key)}>
                    {t(`sales_${key}`)}
                  </button>
                ))}
              </div>
              <SalesTable query={query.toString()} onChannels={setChannels} />
            </>
          );
        }}
      </ReportFilters>
    </>
  );
}

function SalesTable({ query, onChannels }: { query: string; onChannels: (channels: { id: string; label: string }[]) => void }) {
  const t = useTranslations("analytics");
  const { state, reload } = useApi<AnalyticsSalesResponse>(`/analytics/sales?${query}`);
  useEffect(() => {
    if (state.kind === "ready") onChannels(state.data.channels);
  }, [state, onChannels]);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(report) => {
        const money = (value: string, currency: string) => formatMoney(value, currency);
        const figures = (row: AnalyticsSalesFigures, currency: string) => [
          formatNumber(row.quantity),
          money(row.revenue, currency),
          money(row.cost, currency),
          money(row.grossProfit, currency),
          margin(row),
          money(row.internalRevenue, currency),
        ];
        return (
          <>
            <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
              <ExportButton path={`/analytics/sales?${query}&format=xlsx`} fileName={`bao-cao-ban-hang-${report.from}-${report.to}.xlsx`} />
            </div>
            {report.rows.some((row) => !row.inTotal) && <div className="khoi-canh-bao thong-tin">{t("otherCurrencyNote", { currency: report.currency })}</div>}
            {report.rows.length === 0 ? (
              <MessageView text={t("empty")} />
            ) : (
              <ReportTable
                columns={[{ title: t(`sales_${report.groupBy}`) }, ...["quantity", "revenue", "cost", "grossProfit", "margin", "internalRevenue"].map((key) => ({ title: t(key), numeric: true }))]}
                rows={report.rows.map((row) => ({
                  key: `${row.key}-${row.currency}`,
                  cells: [row.inTotal ? row.label : t("notInTotal", { label: row.label, currency: row.currency }), ...figures(row, row.currency)],
                }))}
                footer={[
                  { key: "cong", cells: [t("sumOfCompanies"), ...figures(report.totals, report.currency)] },
                  { key: "loai-tru", cells: [t("totalExcludingInternal"), "", money(report.totals.revenueExcludingInternal, report.currency), "", "", "", ""] },
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
