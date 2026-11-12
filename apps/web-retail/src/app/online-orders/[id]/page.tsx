"use client";

// MAN_HINH_188 chi tiết đơn trực tuyến tại trạm (CONG_VIEC_57; API_223): khách, dòng hàng, thanh toán, hạn giữ, lịch sử; in phiếu soạn hàng, Đã soạn xong, hủy đơn.
import type { StationOrderDetail } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { formatDateTime } from "ui/lib/format";
import { StationSlip } from "@/components/StationSlip";
import { OrderSummary, stationStatusTone } from "@/components/StationOrderSummary";

export default function OnlineOrderDetailPage() {
  const t = useTranslations("retailStationOrders");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<StationOrderDetail>(`/retail/station-orders/${id}`);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [courier, setCourier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(path: string, body: object, done: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<StationOrderDetail>(`/retail/station-orders/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      notify(done);
      setCancelling(false);
      await reload();
    } catch (failure) {
      const details = failureOf(failure);
      setError([details.message, ...Object.values(details.fields)].join(" "));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(order) => (
        <>
          <div className="tieu-de">
            <h1>{order.documentNo}</h1>
            <span className={`nhan ${order.expiringSoon ? "loi" : (stationStatusTone[order.status] ?? "trung-tinh")}`}>{t(`status_${order.status}`)}</span>
            <button type="button" className="nut phu" onClick={() => window.print()}>
              {t("printPicking")}
            </button>
            {order.canPrepare && (
              <button type="button" className={`nut chinh${busy ? " dang-xu-ly" : ""}`} disabled={busy} onClick={() => void act("ready", { version: order.version }, t("readyDone"))}>
                {t("ready")}
              </button>
            )}
            {order.canHandOver && (
              <Link className="nut chinh" href={`/online-orders/handover?store=${order.store.id}`}>
                {t("handover")}
              </Link>
            )}
            {order.canCancel && (
              <button type="button" className="nut nguy-hiem" onClick={() => setCancelling(true)}>
                {t("cancel")}
              </button>
            )}
            <Link href="/online-orders">{t("back")}</Link>
          </div>
          {order.status === "ready_for_pickup" && <p className="khoi thong-tin">{t(order.fulfillmentMode === "station_delivery" ? "readyDeliveryHint" : "readyHint")}</p>}
          {order.canAssign && (
            <div className="bo-loc">
              <select className="o-nhap" aria-label={t("assignTo")} value={courier} onChange={(event) => setCourier(event.target.value)}>
                <option value="">{t("assignTo")}</option>
                {order.couriers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`nut phu${busy ? " dang-xu-ly" : ""}`}
                disabled={busy || !courier}
                onClick={() => void act("assign", { courierUserId: courier, version: order.version }, t("assignDone"))}
              >
                {t("assign")}
              </button>
            </div>
          )}
          {cancelling && (
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <label htmlFor="ly-do-huy">{t("cancelReason")}</label>
              <textarea id="ly-do-huy" className="o-nhap" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              <div className="nhom-nut">
                <button
                  type="button"
                  className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`}
                  disabled={busy || !reason.trim()}
                  onClick={() => void act("cancel", { reason, version: order.version }, t("cancelDone"))}
                >
                  {t("cancelConfirm")}
                </button>
                <button type="button" className="nut phu" onClick={() => setCancelling(false)}>
                  {t("close")}
                </button>
              </div>
            </div>
          )}
          <FormError text={error} />
          <OrderSummary order={order} />
          <div className="the">
            <h2>{t("history")}</h2>
            <ul>
              {order.events.map((event, index) => (
                <li key={index}>
                  {formatDateTime(event.at)} · {t(`event_${event.status}`)}
                  {event.note ? ` · ${event.note}` : ""}
                </li>
              ))}
            </ul>
          </div>
          <StationSlip order={order} kind="picking" currency={order.currency} />
        </>
      )}
    </Loaded>
  );
}
