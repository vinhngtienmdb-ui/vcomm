"use client";

// MAN_HINH_29 Tồn kho (CHUC_NANG_39; API_64): tồn thực, đang giữ, khả dụng, đang chuyển đến, giá vốn; chi tiết lô, serial, vị trí, hàng giữ.
import type { PageResponse, StockDetailResponse, StockRow, WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { useAdmin } from "ui/components/AppShell";
import { apiDownload } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";

export default function StockPage() {
  const t = useTranslations("stock");
  const common = useTranslations("common");
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const [warehouseId, setWarehouseId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StockRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({ page: String(page) });
  if (warehouseId) parameters.set("warehouseId", warehouseId);
  if (search) parameters.set("search", search);
  if (all) parameters.set("onlyInStock", "false");
  const { state, reload } = useApi<PageResponse<StockRow>>(`/inventory/stock?${parameters}`);
  const headings = [t("warehouse"), t("owner"), t("sku"), t("product"), t("onHand"), t("reserved"), t("available"), t("incoming"), t("averageCost"), t("value")];

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-kho">
          {t("warehouse")}
        </label>
        <select id="loc-kho" className="o-nhap" style={{ width: "auto" }} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">{`${t("warehouse")}: ${common("all")}`}</option>
          {warehouses.state.kind === "ready" &&
            warehouses.state.data.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
        </select>
        <label className="an-nhan" htmlFor="tim-ton">
          {common("search")}
        </label>
        <input id="tim-ton" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} style={{ maxWidth: 360 }} />
        <label style={{ display: "inline-flex", gap: "var(--khoang-2)", alignItems: "center" }}>
          <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} /> {t("includeZero")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search ? common("noResult") : t("none")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((row) => (
                    <tr key={`${row.warehouseId}:${row.companyId}:${row.variantId}`}>
                      <td data-nhan={headings[0]}>
                        <span>{row.warehouseName}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{row.companyName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <button type="button" className="nut chu" onClick={() => setSelected(row)}>
                          {row.sku}
                        </button>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {row.productName}
                          {row.optionValues.length > 0 && <span className="chu-thich"> · {row.optionValues.join(" / ")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {formatNumber(row.onHand)} {row.baseUnitName}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatNumber(row.reserved)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>
                          {formatNumber(row.available)}
                          {row.belowMinimum && <span className="nhan canh-bao">{t("belowMinimum")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span>{formatNumber(row.incoming)}</span>
                      </td>
                      <td data-nhan={headings[8]}>
                        <span>{row.averageCost === null ? "—" : formatMoney(row.averageCost, "VND")}</span>
                      </td>
                      <td data-nhan={headings[9]}>
                        <span>{row.value === null ? "—" : formatMoney(row.value, "VND")}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      {selected && <StockDetail row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function StockDetail({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const t = useTranslations("stock");
  const { notify } = useAdmin();
  const { state, reload } = useApi<StockDetailResponse>(`/inventory/stock/${row.variantId}/details?warehouseId=${row.warehouseId}&companyId=${row.companyId}`);
  const card = new URLSearchParams({ warehouseId: row.warehouseId, companyId: row.companyId, variantId: row.variantId });
  return (
    <Drawer title={`${row.sku} · ${row.warehouseName}`} onClose={onClose}>
      <Loaded state={state} onRetry={() => void reload()}>
        {(detail) => (
          <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
            <span className="nhom-nut">
              <Link className="nut phu" href={`/stock-card?${card}`}>
                {t("openCard")}
              </Link>
              <button
                type="button"
                className="nut phu"
                onClick={() =>
                  void apiDownload(`/inventory/labels/products?companyId=${row.companyId}&variantIds=${row.variantId}&copies=1`, "tem-san-pham.pdf", true).catch((error) =>
                    notify(failureOf(error).message, "loi"),
                  )
                }
              >
                {t("printLabel")}
              </button>
            </span>
            <section>
              <h2>{t("balances")}</h2>
              {detail.balances.length === 0 ? (
                <p className="chu-thich">{t("none")}</p>
              ) : (
                <ul>
                  {detail.balances.map((balance, index) => (
                    <li key={index}>
                      {[balance.lotNo && `${t("lot")} ${balance.lotNo}`, balance.expiresOn && `${t("expiresOn")} ${formatDate(balance.expiresOn)}`, balance.locationCode].filter(Boolean).join(" · ") ||
                        t("noLot")}
                      : <strong>{formatNumber(balance.quantity)}</strong> {row.baseUnitName}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {detail.serials.length > 0 && (
              <section>
                <h2>{t("serials", { count: detail.serials.length })}</h2>
                <p>{detail.serials.map((serial) => serial.serialNo + (serial.locationCode ? ` (${serial.locationCode})` : "")).join(", ")}</p>
              </section>
            )}
            <section>
              <h2>{t("reservations")}</h2>
              {detail.reservations.length === 0 ? (
                <p className="chu-thich">{t("noReservations")}</p>
              ) : (
                <ul>
                  {detail.reservations.map((reservation) => (
                    <li key={reservation.id}>
                      {reservation.sourceNo ?? reservation.sourceType}: {formatNumber(reservation.quantity)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Loaded>
    </Drawer>
  );
}
