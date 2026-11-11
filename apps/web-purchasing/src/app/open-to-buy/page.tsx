"use client";

// MAN_HINH_206 Số còn được mua (CHUC_NANG_209; API_239; QUYTAC_NGHIEPVU_447, 450): theo tháng, quý, năm; nhấn kỳ tháng xem các đơn đã tính.
import type { BudgetOptionsResponse, CellOrderItem, OpenToBuyResponse, OpenToBuyRow, PurchaseDocumentStatus } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { monthLabel, numericCell } from "@/components/BudgetStatus";
import { PurchaseStatus } from "@/components/PurchaseStatus";

type Period = "month" | "quarter" | "year";

export default function OpenToBuyPage() {
  const t = useTranslations("openToBuy");
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [period, setPeriod] = useState<Period>("month");
  const [categoryId, setCategoryId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [cell, setCell] = useState<{ row: OpenToBuyRow; currency: string } | null>(null);
  const options = useApi<BudgetOptionsResponse>("/purchasing/budget-options");
  const parameters = new URLSearchParams({ year, period });
  if (categoryId) parameters.set("categoryId", categoryId);
  if (warehouseId) parameters.set("warehouseId", warehouseId);
  const { state, reload } = useApi<OpenToBuyResponse>(`/purchasing/open-to-buy?${parameters}`);
  const periodLabel = (row: OpenToBuyRow) =>
    period === "month" ? monthLabel(row.period) : period === "quarter" ? t("quarter", { quarter: row.period.slice(6), year: row.period.slice(0, 4) }) : row.period;
  const headings = [t("category"), t("warehouse"), t("period"), t("budget"), t("adjusted"), t("used"), t("remaining"), t("usedRate")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="the">
        <div className="bo-loc">
          <label className="an-nhan" htmlFor="loc-nam">
            {t("year")}
          </label>
          <select id="loc-nam" className="o-nhap" value={year} onChange={(event) => setYear(event.target.value)}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((item) => (
              <option key={item} value={item}>{`${t("year")} ${item}`}</option>
            ))}
          </select>
          <label className="an-nhan" htmlFor="loc-nganh">
            {t("category")}
          </label>
          <select id="loc-nganh" className="o-nhap" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">{t("allCategories")}</option>
            {options.state.kind === "ready" &&
              options.state.data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} · {category.name}
                </option>
              ))}
          </select>
          <label className="an-nhan" htmlFor="loc-kho">
            {t("warehouse")}
          </label>
          <select id="loc-kho" className="o-nhap" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">{t("allWarehouses")}</option>
            {options.state.kind === "ready" &&
              options.state.data.warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
          </select>
        </div>
        <span className="chu-thich">{t("hint")}</span>
      </div>
      <div className="cac-the" role="tablist" aria-label={t("period")}>
        {(["month", "quarter", "year"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={item === period} className={item === period ? "chon" : ""} onClick={() => setPeriod(item)}>
            {t(item === "month" ? "periodMonth" : item === "quarter" ? "periodQuarter" : "periodYear")}
          </button>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.rows.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col" style={index > 2 ? numericCell : undefined}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => {
                    const available = Number(row.budget) + Number(row.adjusted);
                    const negative = Number(row.remaining) < 0;
                    return (
                      <tr key={`${row.categoryId}|${row.warehouseId}|${row.period}`}>
                        <td data-nhan={headings[0]}>
                          <span>
                            {row.categoryCode} · {row.categoryName}
                          </span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{row.warehouseName}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          {row.month ? (
                            <button
                              type="button"
                              className="nut chu"
                              aria-label={t("viewOrders", { category: row.categoryName, warehouse: row.warehouseName, month: monthLabel(row.month) })}
                              onClick={() => setCell({ row, currency: result.currency })}
                            >
                              {periodLabel(row)}
                            </button>
                          ) : (
                            <span>{periodLabel(row)}</span>
                          )}
                        </td>
                        <td data-nhan={headings[3]} style={numericCell}>
                          {row.hasBudget ? <span>{formatMoney(row.budget, result.currency)}</span> : <span className="nhan canh-bao">{t("noBudget")}</span>}
                        </td>
                        <td data-nhan={headings[4]} style={numericCell}>
                          <span>{formatMoney(row.adjusted, result.currency)}</span>
                        </td>
                        <td data-nhan={headings[5]} style={numericCell}>
                          <span>{formatMoney(row.used, result.currency)}</span>
                        </td>
                        <td data-nhan={headings[6]} style={numericCell}>
                          {negative ? <strong style={{ color: "var(--mau-loi)" }}>{formatMoney(row.remaining, result.currency)}</strong> : <span>{formatMoney(row.remaining, result.currency)}</span>}
                        </td>
                        <td data-nhan={headings[7]} style={numericCell}>
                          <span>{available > 0 ? `${formatNumber(Math.round((Number(row.used) / available) * 100), 0)}%` : "—"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td data-nhan={headings[0]}>
                      <strong>{t("total")}</strong>
                    </td>
                    <td />
                    <td />
                    <td data-nhan={headings[3]} style={numericCell}>
                      <strong>{formatMoney(result.total.budget, result.currency)}</strong>
                    </td>
                    <td data-nhan={headings[4]} style={numericCell}>
                      <strong>{formatMoney(result.total.adjusted, result.currency)}</strong>
                    </td>
                    <td data-nhan={headings[5]} style={numericCell}>
                      <strong>{formatMoney(result.total.used, result.currency)}</strong>
                    </td>
                    <td data-nhan={headings[6]} style={numericCell}>
                      <strong>{formatMoney(result.total.remaining, result.currency)}</strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )
        }
      </Loaded>
      {cell && <CellOrders cell={cell.row} currency={cell.currency} onClose={() => setCell(null)} />}
    </>
  );
}

function CellOrders({ cell, currency, onClose }: { cell: OpenToBuyRow; currency: string; onClose: () => void }) {
  const t = useTranslations("openToBuy");
  const { state, reload } = useApi<CellOrderItem[]>(`/purchasing/open-to-buy/orders?${new URLSearchParams({ categoryId: cell.categoryId, warehouseId: cell.warehouseId, month: cell.month! })}`);
  // Ngăn kéo hẹp: gộp số đơn, nhà cung cấp, ngày, trạng thái vào một cột.
  const headings = [t("orderNo"), t("used")];
  return (
    <Drawer title={t("ordersTitle", { category: cell.categoryName, warehouse: cell.warehouseName, month: monthLabel(cell.month!) })} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(orders) =>
          orders.length === 0 ? (
            <MessageView text={t("noOrders")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col" style={index === 1 ? numericCell : undefined}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td data-nhan={headings[0]}>
                        <span>
                          <Link href={`/orders/${order.id}`}>{order.documentNo ?? "—"}</Link> <PurchaseStatus status={order.status as PurchaseDocumentStatus} />
                          <br />
                          <span className="chu-thich">
                            {order.supplierName} · {formatDate(order.orderDate)}
                          </span>
                        </span>
                      </td>
                      <td data-nhan={headings[1]} style={numericCell}>
                        <span>{formatMoney(order.amount, currency)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Loaded>
    </Drawer>
  );
}
