"use client";

// MAN_HINH_189 Giao cho khách tại trạm (CONG_VIEC_57; CHUC_NANG_202; QUYTAC_NGHIEPVU_425, 426; API_224): quét hoặc nhập mã nhận hàng, xem đơn,
// thu tiền trong ca đang mở của người giao (đơn chưa trả trước), giao cho khách, in phiếu giao hàng.
import type { RetailCounterContext, RetailStoreResponse, StationHandoverRequest, StationOrderDetail } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { failureOf, useApi } from "ui/lib/use-api";
import { formatMoney } from "ui/lib/format";
import { CollectPayment, type CollectedPayments } from "@/components/CollectPayment";
import { OrderSummary } from "@/components/StationOrderSummary";
import { StationSlip } from "@/components/StationSlip";

function Handover() {
  const t = useTranslations("retailStationOrders");
  const { notify } = useAdmin();
  const params = useSearchParams();
  const stores = useApi<RetailStoreResponse[]>("/retail/stores");
  const counter = useApi<RetailCounterContext>("/retail/counter");
  const stations = stores.state.kind === "ready" ? stores.state.data.filter((store) => store.station.pickupEnabled) : [];
  const [storeId, setStoreId] = useState(params.get("store") ?? "");
  const [text, setText] = useState("");
  const [order, setOrder] = useState<StationOrderDetail | null>(null);
  const [code, setCode] = useState("");
  const [collected, setCollected] = useState<CollectedPayments>({ payments: [], ready: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<StationOrderDetail | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shift = counter.state.kind === "ready" ? counter.state.data.currentShift : null;

  useEffect(() => {
    if (!storeId && stations.length > 0) setStoreId(shift && stations.some((store) => store.id === shift.store.id) ? shift.store.id : stations[0]!.id);
  }, [stations, shift, storeId]);

  async function find(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    setOrder(null);
    try {
      const found = await apiFetch<StationOrderDetail>(`/retail/station-orders/by-code?${new URLSearchParams({ storeId, code: text.trim() })}`);
      const typed = /VCOMM-NHAN:.+:([0-9]{6})$/.exec(text.trim())?.[1] ?? text.trim();
      setOrder(found);
      setCode(typed);
      const due = Number(found.dueAmount);
      setCollected({ payments: due > 0 ? [{ method: "cash", amount: String(due), bankReference: null }] : [], ready: true });
    } catch (failure) {
      setError(failureOf(failure).message);
    }
  }

  async function handOver() {
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      const due = Number(order.dueAmount);
      const body: StationHandoverRequest = { code, version: order.version, shiftId: due > 0 ? (shift?.id ?? null) : null, payments: due > 0 ? collected.payments : [] };
      const result = await apiFetch<StationOrderDetail>(`/retail/station-orders/${order.id}/handover`, { method: "POST", body: JSON.stringify(body) });
      setDone(result);
      setOrder(null);
      setText("");
      notify(t("handoverDone", { number: result.documentNo }));
      input.current?.focus();
    } catch (failure) {
      const details = failureOf(failure);
      setError([details.message, ...Object.values(details.fields)].join(" "));
    } finally {
      setBusy(false);
    }
  }

  const due = order ? Number(order.dueAmount) : 0;
  const shiftHere = shift && shift.store.id === order?.store.id;
  return (
    <>
      <div className="tieu-de">
        <h1>{t("handoverTitle")}</h1>
        <Link href="/online-orders">{t("back")}</Link>
      </div>
      <form className="bo-loc" onSubmit={find}>
        <select className="o-nhap" aria-label={t("store")} value={storeId} onChange={(event) => setStoreId(event.target.value)}>
          {stations.map((store) => (
            <option key={store.id} value={store.id}>
              {store.station.displayName ?? store.branch.name}
            </option>
          ))}
        </select>
        <input ref={input} className="o-nhap o-quet" autoFocus aria-label={t("codeLabel")} placeholder={t("codePlaceholder")} value={text} onChange={(event) => setText(event.target.value)} />
        <button type="submit" className="nut phu" disabled={!storeId || !text.trim()}>
          {t("find")}
        </button>
      </form>
      <FormError text={error} />
      {done && (
        <div className="khoi thong-tin" style={{ display: "flex", gap: "var(--khoang-3)", alignItems: "center", flexWrap: "wrap" }}>
          <span>{t("handoverDone", { number: done.documentNo })}</span>
          <button type="button" className="nut phu" onClick={() => window.print()}>
            {t("printHandover")}
          </button>
          <StationSlip order={done} kind="handover" currency={done.currency} />
        </div>
      )}
      {order && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)", alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: "var(--khoang-4)", flex: "1 1 480px", minWidth: 0 }}>
            <div className="tieu-de">
              <h2>{order.documentNo}</h2>
              <span className="nhan thanh-cong">{t("codeMatched")}</span>
            </div>
            <OrderSummary order={order} />
          </div>
          <div className="the" style={{ display: "grid", gap: "var(--khoang-3)", flex: "1 1 320px" }}>
            {due > 0 ? (
              shiftHere && shift ? (
                <>
                  <h3>{t("collect", { amount: formatMoney(order.dueAmount, order.currency) })}</h3>
                  <CollectPayment due={due} shift={shift} reference={order.documentNo} onChange={setCollected} />
                </>
              ) : (
                <p className="khoi canh-bao">
                  {t("needShift")} <Link href="/counter">{t("openShift")}</Link>
                </p>
              )
            ) : (
              <p className="khoi thong-tin">{t("prepaidHandover")}</p>
            )}
            <button type="button" className={`nut chinh lon${busy ? " dang-xu-ly" : ""}`} disabled={busy || (due > 0 && (!shiftHere || !collected.ready))} onClick={() => void handOver()}>
              {t("handoverConfirm")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function HandoverPage() {
  return (
    <Suspense>
      <Handover />
    </Suspense>
  );
}
