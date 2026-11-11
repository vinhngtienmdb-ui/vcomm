"use client";

// MAN_HINH_142 Tồn kho và luân chuyển (CHUC_NANG_176; API_172; QUYTAC_NGHIEPVU_340).
import { analyticsInventoryGroupings, type AnalyticsInventoryGrouping, type AnalyticsInventoryResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ExportButton } from "@/components/ExportButton";
import { ReportFilters } from "@/components/ReportFilters";
import { ReportTable } from "@/components/ReportTable";

export default function InventoryReportPage() {
  const t = useTranslations("analytics");
  const [groupBy, setGroupBy] = useState<AnalyticsInventoryGrouping>("warehouse");
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: string; label: string }[]>([]);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("inventoryTitle")}</h1>
      </div>
      <ReportFilters
        kind="inventory"
        withPeriod
        extra={
          <>
            <label className="an-nhan" htmlFor="loc-kho">
              {t("warehouse")}
            </label>
            <select id="loc-kho" className="o-nhap" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
              <option value="">{t("allWarehouses")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.label}
                </option>
              ))}
            </select>
          </>
        }
      >
        {({ query }) => {
          query.set("groupBy", groupBy);
          if (warehouseId) query.set("warehouseId", warehouseId);
          return (
            <>
              <span className="chu-thich">{t("inventoryNote")}</span>
              <div className="cac-the" role="tablist" aria-label={t("groupBy")}>
                {analyticsInventoryGroupings.map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={groupBy === key} className={groupBy === key ? "chon" : ""} onClick={() => setGroupBy(key)}>
                    {t(`inventory_${key}`)}
                  </button>
                ))}
              </div>
              <InventoryTable query={query.toString()} onWarehouses={setWarehouses} />
            </>
          );
        }}
      </ReportFilters>
    </>
  );
}

function InventoryTable({ query, onWarehouses }: { query: string; onWarehouses: (warehouses: { id: string; label: string }[]) => void }) {
  const t = useTranslations("analytics");
  const { state, reload } = useApi<AnalyticsInventoryResponse>(`/analytics/inventory?${query}`);
  useEffect(() => {
    if (state.kind === "ready") onWarehouses(state.data.warehouses);
  }, [state, onWarehouses]);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(report) => {
        const ratio = (value: string | null) => (value === null ? "—" : formatNumber(value, 2));
        const columns = ["openingQuantity", "openingValue", "inQuantity", "inValue", "outQuantity", "outValue", "closingQuantity", "closingValue", "costOfSales", "turnover", "daysOfInventory"];
        return (
          <>
            <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
              <ExportButton path={`/analytics/inventory?${query}&format=xlsx`} fileName={`bao-cao-ton-kho-${report.from}-${report.to}.xlsx`} />
            </div>
            {report.rows.some((row) => !row.inTotal) && <div className="khoi-canh-bao thong-tin">{t("otherCurrencyNote", { currency: report.currency })}</div>}
            {report.rows.length === 0 ? (
              <MessageView text={t("empty")} />
            ) : (
              <ReportTable
                columns={[{ title: t(`inventory_${report.groupBy}`) }, ...columns.map((key) => ({ title: t(key), numeric: true }))]}
                rows={report.rows.map((row) => {
                  const money = (value: string) => formatMoney(value, row.currency);
                  return {
                    key: `${row.key}-${row.currency}`,
                    cells: [
                      row.inTotal ? row.label : t("notInTotal", { label: row.label, currency: row.currency }),
                      formatNumber(row.openingQuantity),
                      money(row.openingValue),
                      formatNumber(row.inQuantity),
                      money(row.inValue),
                      formatNumber(row.outQuantity),
                      money(row.outValue),
                      formatNumber(row.closingQuantity),
                      money(row.closingValue),
                      money(row.costOfSales),
                      ratio(row.turnover),
                      ratio(row.daysOfInventory),
                    ],
                  };
                })}
                footer={[
                  {
                    key: "tong",
                    cells: [
                      t("total"),
                      "",
                      formatMoney(report.totals.openingValue, report.currency),
                      "",
                      formatMoney(report.totals.inValue, report.currency),
                      "",
                      formatMoney(report.totals.outValue, report.currency),
                      "",
                      formatMoney(report.totals.closingValue, report.currency),
                      formatMoney(report.totals.costOfSales, report.currency),
                      ratio(report.totals.turnover),
                      ratio(report.totals.daysOfInventory),
                    ],
                  },
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
