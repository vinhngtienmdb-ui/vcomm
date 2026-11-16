"use client";

// MAN_HINH_238 Giao hàng đơn người bán (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_507; API_310, API_311): đơn dropship của người bán xuất từ kho công ty;
// tạo vận đơn với đơn vị vận chuyển đang bật hoặc nhập tay; tra lại, hủy vận đơn; in phiếu giao danh nghĩa người bán (MAN_HINH_239).
import type { CarrierCode, ResellerShipmentListResponse, ResellerShipmentOrder, ResellerShippingStatus } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload, apiFetch } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const statuses: ResellerShippingStatus[] = ["requesting", "awaiting_pickup", "shipping", "delivered", "returned", "cancelled"];
const manualStatuses = ["awaiting_pickup", "shipping", "delivered", "returned", "cancelled"] as const;
const tones: Record<ResellerShippingStatus, string> = {
  requesting: "canh-bao",
  awaiting_pickup: "canh-bao",
  shipping: "thong-tin",
  delivered: "thanh-cong",
  returned: "loi",
  cancelled: "trung-tinh",
};

function ShippingStatusBadge({ status }: { status: ResellerShippingStatus | null }) {
  const t = useTranslations("resellerShipments");
  if (!status) return <span className="nhan trung-tinh">{t("status_none")}</span>;
  return <span className={`nhan ${tones[status]}`}>{t(`status_${status}`)}</span>;
}

export default function ResellerShipmentsPage() {
  const t = useTranslations("resellerShipments");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [status, setStatus] = useState<ResellerShippingStatus | "none" | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ order: ResellerShipmentOrder; mode: "manual" | "carrier" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  if (search) parameters.set("search", search);
  const { state, reload } = useApi<ResellerShipmentListResponse>(`/sales/reseller-shipments?${parameters}`);

  async function act(order: ResellerShipmentOrder, action: "refresh" | "cancel") {
    setBusy(order.orderId);
    try {
      await apiFetch(`/sales/orders/${order.orderId}/reseller-shipment/carrier/${action}`, {
        method: "POST",
        body: action === "cancel" ? JSON.stringify({ version: order.shipment!.version }) : undefined,
      });
      notify(action === "cancel" ? t("cancelled") : t("refreshed"), "thanh-cong");
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setBusy(null);
      await reload();
    }
  }

  const headings = [t("order"), t("reseller"), t("recipient"), t("codAmount"), t("tracking"), t("fee"), t("status"), ""];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-don-nguoi-ban">
          {common("search")}
        </label>
        <input id="tim-don-nguoi-ban" className="o-nhap" placeholder={t("searchPlaceholder")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
        <label className="an-nhan" htmlFor="loc-trang-thai-giao">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai-giao"
          className="o-nhap"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as ResellerShippingStatus | "none" | "");
            setPage(1);
          }}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="none">{t("status_none")}</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <div className="khung-bang">
              {result.carriers.length === 0 && <div className="chu-thich">{t("noCarrier")}</div>}
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col" style={index === 3 || index === 5 ? { textAlign: "right" } : undefined}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((order) => {
                    const shipment = order.shipment;
                    const canCreate = !shipment && order.orderStatus === "confirmed";
                    const manual = shipment && shipment.carrierCode === null && ["awaiting_pickup", "shipping"].includes(shipment.status);
                    const carrier = shipment && shipment.carrierCode !== null;
                    return (
                      <tr key={order.orderId}>
                        <td data-nhan={headings[0]}>
                          <span>
                            <strong>{order.partnerOrderCode ?? "—"}</strong>
                            <br />
                            <span className="chu-thich">
                              {order.documentNo} · {formatDate(order.orderDate)}
                            </span>
                          </span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{order.resellerName}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>
                            {order.recipientName} · {order.recipientPhone}
                            <br />
                            <span className="chu-thich">{order.deliveryAddress}</span>
                          </span>
                        </td>
                        <td data-nhan={headings[3]} style={{ textAlign: "right" }}>
                          <span>{formatMoney(order.codAmount, order.currency)}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>{shipment ? `${shipment.carrierName}${shipment.trackingCode ? ` · ${shipment.trackingCode}` : ""}` : "—"}</span>
                        </td>
                        <td data-nhan={headings[5]} style={{ textAlign: "right" }}>
                          <span>{shipment?.fee ? formatMoney(shipment.fee, order.currency) : "—"}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <ShippingStatusBadge status={shipment?.status ?? null} />
                        </td>
                        <td data-nhan="">
                          <span className="nhom-nut">
                            <button
                              type="button"
                              className="nut phu"
                              onClick={() =>
                                void apiDownload(`/sales/orders/${order.orderId}/reseller-delivery-note`, `phieu-giao-${order.partnerOrderCode ?? order.documentNo}.pdf`, true).catch((error) =>
                                  notify(failureOf(error).message, "loi"),
                                )
                              }
                            >
                              {t("printNote")}
                            </button>
                            {canCreate && result.carriers.length > 0 && (
                              <button type="button" className="nut chinh" onClick={() => setEditing({ order, mode: "carrier" })}>
                                {t("createShipment")}
                              </button>
                            )}
                            {(canCreate || manual) && (
                              <button type="button" className={`nut ${result.carriers.length > 0 ? "phu" : "chinh"}`} onClick={() => setEditing({ order, mode: "manual" })}>
                                {canCreate ? t("manualShipment") : t("updateShipment")}
                              </button>
                            )}
                            {carrier && !["delivered", "returned", "cancelled"].includes(shipment.status) && (
                              <button type="button" className="nut phu" disabled={busy === order.orderId} onClick={() => void act(order, "refresh")}>
                                {t("refresh")}
                              </button>
                            )}
                            {carrier && shipment.status === "awaiting_pickup" && (
                              <button type="button" className="nut nguy-hiem" disabled={busy === order.orderId} onClick={() => void act(order, "cancel")}>
                                {t("cancelShipment")}
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
              {editing && (
                <ShipmentDrawer
                  order={editing.order}
                  mode={editing.mode}
                  carriers={result.carriers}
                  onClose={() => setEditing(null)}
                  onDone={() => {
                    setEditing(null);
                    notify(t("saved"), "thanh-cong");
                    void reload();
                  }}
                />
              )}
            </div>
          )
        }
      </Loaded>
    </>
  );
}

function ShipmentDrawer({ order, mode, carriers, onClose, onDone }: { order: ResellerShipmentOrder; mode: "manual" | "carrier"; carriers: CarrierCode[]; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("resellerShipments");
  const common = useTranslations("common");
  const shipment = order.shipment;
  const [carrierCode, setCarrierCode] = useState<CarrierCode>(carriers[0] ?? "ghn");
  const [carrierName, setCarrierName] = useState(shipment?.carrierName ?? "");
  const [trackingCode, setTrackingCode] = useState(shipment?.trackingCode ?? "");
  const [fee, setFee] = useState(shipment?.fee ?? "");
  const [status, setStatus] = useState<(typeof manualStatuses)[number]>(shipment && shipment.status !== "requesting" ? shipment.status : "awaiting_pickup");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (mode === "carrier") await apiFetch(`/sales/orders/${order.orderId}/reseller-shipment/carrier`, { method: "POST", body: JSON.stringify({ carrierCode, version: 0 }) });
      else
        await apiFetch(`/sales/orders/${order.orderId}/reseller-shipment`, {
          method: "PATCH",
          body: JSON.stringify({ carrierName, trackingCode, fee: fee.replace(/\D/g, ""), status, version: shipment?.version ?? 0 }),
        });
      onDone();
    });
  }

  return (
    <Drawer title={`${mode === "carrier" ? t("createShipment") : shipment ? t("updateShipment") : t("manualShipment")} · ${order.partnerOrderCode ?? order.documentNo}`} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {mode === "carrier" ? (
          <>
            <Field id="don-vi-van-chuyen-nguoi-ban" label={`${t("carrier")} *`} error={fields.carrierCode}>
              <select id="don-vi-van-chuyen-nguoi-ban" className={inputClass("carrierCode")} value={carrierCode} onChange={(event) => setCarrierCode(event.target.value as CarrierCode)}>
                {carriers.map((code) => (
                  <option key={code} value={code}>
                    {t(`carrier_${code}`)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="chu-thich">{t("carrierHint", { amount: formatMoney(order.codAmount, order.currency) })}</div>
          </>
        ) : (
          <>
            <Field id="ten-don-vi-van-chuyen" label={`${t("carrier")} *`} error={fields.carrierName}>
              <input id="ten-don-vi-van-chuyen" className={inputClass("carrierName")} maxLength={100} value={carrierName} onChange={(event) => setCarrierName(event.target.value)} />
            </Field>
            <Field id="ma-van-don-nguoi-ban" label={`${t("tracking")} *`} error={fields.trackingCode}>
              <input id="ma-van-don-nguoi-ban" className={inputClass("trackingCode")} maxLength={100} value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} />
            </Field>
            <Field id="phi-giao-nguoi-ban" label={`${t("feeVnd")} *`} error={fields.fee}>
              <input id="phi-giao-nguoi-ban" className={inputClass("fee")} inputMode="numeric" maxLength={9} value={fee} onChange={(event) => setFee(event.target.value)} />
            </Field>
            <Field id="trang-thai-giao-nguoi-ban" label={`${t("status")} *`} error={fields.status}>
              <select id="trang-thai-giao-nguoi-ban" className={inputClass("status")} value={status} onChange={(event) => setStatus(event.target.value as (typeof manualStatuses)[number])}>
                {manualStatuses
                  .filter((item) => (shipment ? true : !["returned", "cancelled"].includes(item)))
                  .map((item) => (
                    <option key={item} value={item}>
                      {t(`status_${item}`)}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="chu-thich">{t("manualHint")}</div>
          </>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting}>
            {mode === "carrier" ? t("createShipment") : common("save")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
