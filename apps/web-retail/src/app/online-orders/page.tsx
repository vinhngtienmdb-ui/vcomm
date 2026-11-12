"use client";

// MAN_HINH_188 Đơn trực tuyến tại trạm (CONG_VIEC_57; CHUC_NANG_202; API_223): lọc trạm, trạng thái, cách nhận, thanh toán, sắp hết hạn giữ, tìm số đơn, số điện thoại.
import type { RetailStoreResponse, StationOrderListResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { stationStatusTone } from "@/components/StationOrderSummary";

export default function OnlineOrdersPage() {
  const t = useTranslations("retailStationOrders");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState("open");
  const [mode, setMode] = useState("");
  const [payment, setPayment] = useState("");
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const stores = useApi<RetailStoreResponse[]>("/retail/stores");
  const query = new URLSearchParams({
    page: String(page),
    status,
    ...(storeId ? { storeId } : {}),
    ...(mode ? { mode } : {}),
    ...(payment ? { payment } : {}),
    ...(expiringSoon ? { expiringSoon: "true" } : {}),
    ...(search ? { search } : {}),
  });
  const { state, reload } = useApi<StationOrderListResponse>(`/retail/station-orders?${query}`);
  const stations = stores.state.kind === "ready" ? stores.state.data.filter((store) => store.station.pickupEnabled || store.station.deliveryEnabled) : [];
  const headings = [t("number"), t("createdAt"), t("customer"), t("mode"), t("dueAmount"), t("status"), t("holdUntil")];
  const reset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => (setter(value), setPage(1));
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {can("retail.o2o") && (
          <Link className="nut chinh" href="/online-orders/handover">
            {t("handover")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <select className="o-nhap" aria-label={t("store")} value={storeId} onChange={(event) => reset(setStoreId)(event.target.value)}>
          <option value="">{t("allStores")}</option>
          {stations.map((store) => (
            <option key={store.id} value={store.id}>
              {store.station.displayName ?? store.branch.name}
            </option>
          ))}
        </select>
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => reset(setStatus)(event.target.value)}>
          {["open", "awaiting_shipment", "ready_for_pickup", "shipping", "delivered", "completed", "cancelled"].map((value) => (
            <option key={value} value={value}>
              {t(`status_${value}`)}
            </option>
          ))}
        </select>
        <select className="o-nhap" aria-label={t("mode")} value={mode} onChange={(event) => reset(setMode)(event.target.value)}>
          <option value="">{t("allModes")}</option>
          <option value="station_pickup">{t("mode_station_pickup")}</option>
          <option value="station_delivery">{t("mode_station_delivery")}</option>
        </select>
        <select className="o-nhap" aria-label={t("payment")} value={payment} onChange={(event) => reset(setPayment)(event.target.value)}>
          <option value="">{t("allPayments")}</option>
          <option value="prepaid">{t("payment_prepaid")}</option>
          <option value="on_receipt">{t("payment_on_receipt")}</option>
        </select>
        <label>
          <input type="checkbox" checked={expiringSoon} onChange={(event) => reset(setExpiringSoon)(event.target.checked)} /> {t("expiringSoon")}
        </label>
        <input className="o-nhap" type="search" aria-label={common("search")} placeholder={t("searchPlaceholder")} value={search} onChange={(event) => reset(setSearch)(event.target.value)} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) =>
          data.items.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <>
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
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={headings[0]}>
                          <Link href={`/online-orders/${item.id}`}>{item.documentNo}</Link>
                          <div className="chu-thich">{item.store.name}</div>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{formatDateTime(item.createdAt)}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{item.buyerName}</span>
                          <div className="chu-thich">{item.buyerPhone}</div>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{t(`mode_${item.fulfillmentMode}`)}</span>
                          {item.courierName && <div className="chu-thich">{t("courier", { name: item.courierName })}</div>}
                        </td>
                        <td data-nhan={headings[4]} className="so-tien">
                          <span>{Number(item.dueAmount) > 0 ? formatMoney(item.dueAmount, data.currency) : t("prepaid")}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span className={`nhan ${item.expiringSoon ? "loi" : (stationStatusTone[item.status] ?? "trung-tinh")}`}>{t(`status_${item.status}`)}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <span>{item.holdUntil ? formatDateTime(item.holdUntil) : "—"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="phan-trang">
                <span>{common("total", { count: data.total })}</span>
                <div className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
                  </button>
                </div>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  );
}
