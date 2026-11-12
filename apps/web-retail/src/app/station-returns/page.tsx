"use client";

// MAN_HINH_194 Nhận hàng trả tại trạm (CONG_VIEC_57; CHUC_NANG_203; API_226; QUYTAC_NGHIEPVU_430): yêu cầu trả hàng đã duyệt của đơn thuộc trạm, "Đã nhận hàng trả".
import type { RetailStoreResponse, StationReturnItem, StationReturnListResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function StationReturnsPage() {
  const t = useTranslations("retailStationReturns");
  const reasons = useTranslations("returnRequests");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<"approved" | "received">("approved");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stores = useApi<RetailStoreResponse[]>("/retail/stores");
  const query = new URLSearchParams({ page: String(page), status, ...(storeId ? { storeId } : {}), ...(search ? { search } : {}) });
  const { state, reload } = useApi<StationReturnListResponse>(`/retail/station-returns?${query}`);
  const stations = stores.state.kind === "ready" ? stores.state.data.filter((store) => store.station.pickupEnabled || store.station.deliveryEnabled) : [];
  const headings = [t("order"), t("customer"), t("goods"), status === "approved" ? t("approvedAt") : t("receivedAt"), ""];

  async function receive(item: StationReturnItem) {
    if (!window.confirm(t("confirm", { order: item.documentNo }))) return;
    setBusy(item.id);
    setError(null);
    try {
      const result = await apiFetch<StationReturnItem>(`/retail/station-returns/${item.id}/receive`, { method: "POST", body: JSON.stringify({ version: item.version }) });
      notify(t("done", { document: result.stockDocument?.documentNo ?? "" }));
      await reload();
    } catch (failure) {
      const details = failureOf(failure);
      setError([details.message, ...Object.values(details.fields)].join(" "));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <select className="o-nhap" aria-label={t("store")} value={storeId} onChange={(event) => (setStoreId(event.target.value), setPage(1))}>
          <option value="">{t("allStores")}</option>
          {stations.map((store) => (
            <option key={store.id} value={store.id}>
              {store.station.displayName ?? store.branch.name}
            </option>
          ))}
        </select>
        <select className="o-nhap" aria-label={t("status")} value={status} onChange={(event) => (setStatus(event.target.value as "approved" | "received"), setPage(1))}>
          <option value="approved">{t("status_approved")}</option>
          <option value="received">{t("status_received")}</option>
        </select>
        <input className="o-nhap" type="search" aria-label={common("search")} placeholder={t("searchPlaceholder")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
      </div>
      <FormError text={error} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) =>
          data.items.length === 0 ? (
            <MessageView text={t(status === "approved" ? "none" : "noneReceived")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {headings.map((heading, index) => (
                        <th key={index} scope="col">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={headings[0]}>
                          <Link href={`/online-orders/${item.orderId}`}>{item.documentNo}</Link>
                          <div className="chu-thich">{item.store.name}</div>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{item.buyerName}</span>
                          <div className="chu-thich">{item.buyerPhone}</div>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{item.lines.map((line) => `${line.productName}${line.variantLabel ? ` (${line.variantLabel})` : ""} × ${line.quantity}`).join(", ")}</span>
                          <div className="chu-thich">{`${reasons(`reason_${item.reason}`)}: ${item.description}`}</div>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{formatDateTime((status === "approved" ? item.decidedAt : item.closedAt) ?? "")}</span>
                          {item.receivedByName && <div className="chu-thich">{t("receivedBy", { name: item.receivedByName, document: item.stockDocument?.documentNo ?? "" })}</div>}
                        </td>
                        <td data-nhan={headings[4]}>
                          {item.canReceive && (
                            <button type="button" className={`nut chinh${busy === item.id ? " dang-xu-ly" : ""}`} disabled={busy !== null} onClick={() => void receive(item)}>
                              {t("receive")}
                            </button>
                          )}
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
      <p className="khoi thong-tin">{t("hint")}</p>
    </>
  );
}
