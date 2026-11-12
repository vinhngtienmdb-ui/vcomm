"use client";

// MAN_HINH_88 Đơn VComm (CHUC_NANG_116, 117; API_127): danh sách lọc trạng thái, tìm số đơn hoặc số điện thoại.
// MAN_HINH_195 (CONG_VIEC_57): lọc cách nhận, trạm; cột cách nhận.
import { fulfillmentModes, marketplaceOrderStatuses, type MarketplaceOrderListItem, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { orderTone } from "../../components/OrderStatus";

export default function MarketplaceOrdersPage() {
  const t = useTranslations("marketplaceOrders");
  const common = useTranslations("common");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [stationId, setStationId] = useState("");
  const stations = useApi<{ id: string; name: string }[]>("/marketplace/order-stations");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) parameters.set("search", search);
  if (status) parameters.set("status", status);
  if (mode) parameters.set("fulfillmentMode", mode);
  if (stationId) parameters.set("stationId", stationId);
  const { state, reload } = useApi<PageResponse<MarketplaceOrderListItem>>(`/marketplace/orders?${parameters}`);
  const headings = [t("number"), t("buyer"), t("recipient"), t("fulfillment"), t("total"), t("status"), t("createdAt")];
  const stationOptions = stations.state.kind === "ready" ? stations.state.data : [];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="dvc-tim">
          {common("search")}
        </label>
        <input id="dvc-tim" className="o-nhap" type="search" placeholder={t("search")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <label className="an-nhan" htmlFor="dvc-trang-thai">
          {t("status")}
        </label>
        <select
          id="dvc-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {marketplaceOrderStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="dvc-cach-nhan">
          {t("fulfillment")}
        </label>
        <select
          id="dvc-cach-nhan"
          className="o-nhap"
          style={{ width: "auto" }}
          value={mode}
          onChange={(event) => {
            setMode(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("fulfillment")}: ${common("all")}`}</option>
          {fulfillmentModes.map((item) => (
            <option key={item} value={item}>
              {t(`fulfillment_${item}`)}
            </option>
          ))}
        </select>
        {stationOptions.length > 0 && (
          <>
            <label className="an-nhan" htmlFor="dvc-tram">
              {t("station")}
            </label>
            <select
              id="dvc-tram"
              className="o-nhap"
              style={{ width: "auto" }}
              value={stationId}
              onChange={(event) => {
                setStationId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{`${t("station")}: ${common("all")}`}</option>
              {stationOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={search || status || mode || stationId ? common("noResult") : t("none")} />
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/orders/${item.id}`}>{item.documentNo}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>
                          {item.buyerName}
                          <span className="chu-thich"> · {item.buyerPhone}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.recipientName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {t(`fulfillment_${item.fulfillmentMode}`)}
                          {item.stationName ? <span className="chu-thich"> · {item.stationName}</span> : null}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatNumber(item.total, 0)}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
                          <span className={`nhan ${orderTone[item.status]}`} style={{ justifySelf: "start" }}>
                            {t(`status_${item.status}`)}
                          </span>
                          {item.carrierStatus ? <span className="chu-thich">{t("carrierStatus", { status: item.carrierStatus })}</span> : null}
                        </span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{formatDateTime(item.createdAt)}</span>
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
    </>
  );
}
