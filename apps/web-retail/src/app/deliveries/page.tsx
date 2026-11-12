"use client";

// MAN_HINH_190 Đơn tôi đang giao (CONG_VIEC_57; QUYTAC_NGHIEPVU_427; API_225), tối ưu điện thoại: mở ca giữ tiền thu, nhận đi giao,
// giao thành công (mã nhận hàng do khách đọc hoặc mã QR, thu tiền), không giao được (lý do).
import type { DeliveryFailureReason, MyDeliveriesResponse, RetailShiftResponse, StationHandoverRequest, StationOrderDetail } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { CollectPayment, type CollectedPayments } from "@/components/CollectPayment";

const reasons: DeliveryFailureReason[] = ["absent", "refused", "wrong_address", "other"];

function OutCard({ order, shift, onDone }: { order: StationOrderDetail; shift: RetailShiftResponse | null; onDone: (text: string) => void }) {
  const t = useTranslations("retailStationOrders");
  const due = Number(order.dueAmount);
  const [code, setCode] = useState("");
  const [collected, setCollected] = useState<CollectedPayments>({ payments: due > 0 ? [{ method: "cash", amount: order.dueAmount, bankReference: null }] : [], ready: true });
  const [failing, setFailing] = useState(false);
  const [reason, setReason] = useState<DeliveryFailureReason>("absent");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send(path: string, body: object, done: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<StationOrderDetail>(`/retail/station-orders/${order.id}/${path}`, { method: "POST", body: JSON.stringify(body) });
      onDone(done);
    } catch (failure) {
      const details = failureOf(failure);
      setError([details.message, ...Object.values(details.fields)].join(" "));
    } finally {
      setBusy(false);
    }
  }
  const typed = /VCOMM-NHAN:.+:([0-9]{6})$/.exec(code.trim())?.[1] ?? code.trim();
  const body: StationHandoverRequest = { code: typed, version: order.version, shiftId: due > 0 ? (shift?.id ?? null) : null, payments: due > 0 ? collected.payments : [] };
  return (
    <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="tieu-de">
        <h3 style={{ flex: 1 }}>
          {order.documentNo} · {order.recipientName}
        </h3>
        <span className="nhan canh-bao">{due > 0 ? t("collect", { amount: formatMoney(order.dueAmount, order.currency) }) : t("prepaid")}</span>
      </div>
      <span>{order.address}</span>
      <span className="chu-thich">
        <a href={`tel:${order.recipientPhone}`}>{order.recipientPhone}</a> · {t("attempt", { count: order.deliveryAttempts + 1 })}
        {order.holdUntil ? ` · ${t("holdUntil")} ${formatDateTime(order.holdUntil)}` : ""}
      </span>
      <input className="o-nhap o-quet" inputMode="numeric" aria-label={t("codeLabel")} placeholder={t("codePlaceholder")} value={code} onChange={(event) => setCode(event.target.value)} />
      {due > 0 && shift && <CollectPayment due={due} shift={shift} reference={order.documentNo} onChange={setCollected} />}
      <FormError text={error} />
      <div className="nhom-nut">
        <button
          type="button"
          className={`nut chinh${busy ? " dang-xu-ly" : ""}`}
          disabled={busy || !/^[0-9]{6}$/.test(typed) || (due > 0 && !collected.ready)}
          onClick={() => void send("deliver", body, t("deliverDone", { number: order.documentNo }))}
        >
          {t("deliverSuccess")}
        </button>
        <button type="button" className="nut phu" onClick={() => setFailing(!failing)}>
          {t("deliverFailed")}
        </button>
      </div>
      {failing && (
        <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
          {reasons.map((value) => (
            <label key={value}>
              <input type="radio" name={`ly-do-${order.id}`} checked={reason === value} onChange={() => setReason(value)} /> {t(`reason_${value}`)}
            </label>
          ))}
          <textarea className="o-nhap" rows={2} maxLength={500} aria-label={t("note")} placeholder={t("note")} value={note} onChange={(event) => setNote(event.target.value)} />
          <p className="chu-thich">{t("failedHint")}</p>
          <button
            type="button"
            className={`nut nguy-hiem${busy ? " dang-xu-ly" : ""}`}
            disabled={busy || (reason === "other" && !note.trim())}
            onClick={() => void send("attempts", { reason, note, version: order.version }, t("failedDone", { number: order.documentNo }))}
          >
            {t("failedConfirm")}
          </button>
        </div>
      )}
    </section>
  );
}

export default function DeliveriesPage() {
  const t = useTranslations("retailStationOrders");
  const { notify } = useAdmin();
  const { state, reload } = useApi<MyDeliveriesResponse>("/retail/station-orders/my-deliveries");
  const [register, setRegister] = useState("");
  const [openingCash, setOpeningCash] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const done = (text: string) => {
    notify(text);
    void reload();
  };
  async function openShift() {
    setError(null);
    try {
      await apiFetch<RetailShiftResponse>("/retail/shifts", { method: "POST", body: JSON.stringify({ registerId: register, openingCash }) });
      done(t("shiftOpened"));
    } catch (failure) {
      const details = failureOf(failure);
      setError([details.message, ...Object.values(details.fields)].join(" "));
    }
  }
  async function take(order: StationOrderDetail, shiftId: string | null) {
    setError(null);
    try {
      await apiFetch<StationOrderDetail>(`/retail/station-orders/${order.id}/dispatch`, { method: "POST", body: JSON.stringify({ shiftId, version: order.version }) });
      done(t("dispatchDone", { number: order.documentNo }));
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }
  return (
    <div style={{ display: "grid", gap: "var(--khoang-4)", maxWidth: 640 }}>
      <h1>{t("deliveriesTitle")}</h1>
      <FormError text={error} />
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => (
          <>
            <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              {data.currentShift ? (
                <span>
                  {t("shiftOpen", { register: data.currentShift.register.code, store: data.currentShift.store.name, time: formatDateTime(data.currentShift.openedAt) })} ·{" "}
                  <Link href={`/shifts/${data.currentShift.id}`}>{t("closeShift")}</Link>
                </span>
              ) : (
                <>
                  <span className="chu-thich">{t("shiftHint")}</span>
                  <div className="bo-loc">
                    <select className="o-nhap" aria-label={t("register")} value={register} onChange={(event) => setRegister(event.target.value)}>
                      <option value="">{t("chooseRegister")}</option>
                      {data.registers
                        .filter((item) => !item.busy)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.storeName} · {item.code} – {item.name}
                          </option>
                        ))}
                    </select>
                    <input className="o-nhap" inputMode="decimal" aria-label={t("openingCash")} value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
                    <button type="button" className="nut phu" disabled={!register} onClick={() => void openShift()}>
                      {t("openShift")}
                    </button>
                  </div>
                </>
              )}
            </section>
            <h2>{t("mineTitle", { count: data.mine.length })}</h2>
            {data.mine.length === 0 && <MessageView text={t("mineNone")} />}
            {data.mine.map((order) => (
              <OutCard key={`${order.id}-${order.version}`} order={order} shift={data.currentShift} onDone={done} />
            ))}
            <h2>{t("availableTitle", { count: data.available.length })}</h2>
            {data.available.length === 0 && <MessageView text={t("availableNone")} />}
            {data.available.map((order) => (
              <section key={order.id} className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <div className="tieu-de">
                  <strong style={{ flex: 1 }}>
                    {order.documentNo} · {order.recipientName}
                  </strong>
                  <button type="button" className="nut phu" onClick={() => void take(order, Number(order.dueAmount) > 0 ? (data.currentShift?.id ?? null) : null)}>
                    {t("dispatch")}
                  </button>
                </div>
                <span className="chu-thich">
                  {order.address} · {Number(order.dueAmount) > 0 ? t("collect", { amount: formatMoney(order.dueAmount, order.currency) }) : t("prepaid")}
                  {order.courierName ? ` · ${t("courier", { name: order.courierName })}` : ""}
                </span>
              </section>
            ))}
          </>
        )}
      </Loaded>
    </div>
  );
}
