"use client";

// MAN_HINH_88 Chi tiết đơn VComm (CHUC_NANG_116, 117; API_127; QUYTAC_NGHIEPVU_159, 160): người mua, địa chỉ, dòng hàng, vận đơn, lịch sử; giao cho đơn vị vận chuyển, tra lại vận đơn, hủy.
// Thanh toán, các lần thanh toán, ghi tay đã thu tiền thu hộ (CONG_VIEC_25; API_133; QUYTAC_NGHIEPVU_167); xác nhận đã nhận chuyển khoản (CONG_VIEC_36; QUYTAC_NGHIEPVU_242).
// Hoa hồng của đơn theo người hưởng (CONG_VIEC_26; QUYTAC_NGHIEPVU_201, 202).
import type { MarketplaceOrderDetail } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { orderTone } from "../../../components/OrderStatus";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function Actions({ order, onSaved }: { order: MarketplaceOrderDetail; onSaved: (value: MarketplaceOrderDetail) => void }) {
  const t = useTranslations("marketplaceOrders");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [carrier, setCarrier] = useState(order.carriers.find((item) => item.isEnabled)?.code ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(path: string, body: unknown, message: string) {
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiFetch<MarketplaceOrderDetail>(`/marketplace/orders/${order.id}/${path}`, { method: "POST", body: JSON.stringify(body) }));
      notify(message);
      setCancelling(false);
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const enabled = order.carriers.filter((item) => item.isEnabled);
  if (!order.canShip && !order.canCancel && !order.canRefreshShipment) return null;
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <h2>{t("actions")}</h2>
      <FormError text={error} />
      {order.canShip &&
        (enabled.length === 0 ? (
          <div className="khoi-canh-bao canh-bao">{t("noCarrier")}</div>
        ) : (
          <div style={{ display: "flex", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor="dvc-don-vi">{t("carrier")}</label>
            <select id="dvc-don-vi" className="o-nhap" style={{ width: "auto" }} value={carrier} onChange={(event) => setCarrier(event.target.value)}>
              {enabled.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="nut chinh"
              disabled={busy || !carrier}
              onClick={() => window.confirm(t("shipConfirm")) && void act("ship", { carrierCode: carrier, version: order.version }, t("shipped"))}
            >
              {t("ship")}
            </button>
          </div>
        ))}
      {order.canRefreshShipment && (
        <div className="nhom-nut">
          <button type="button" className="nut phu" disabled={busy} onClick={() => void act("refresh-shipment", {}, t("refreshed"))}>
            {t("refreshShipment")}
          </button>
        </div>
      )}
      {order.canCancel &&
        (cancelling ? (
          <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
            <label htmlFor="dvc-ly-do">{t("cancelReason")}</label>
            <textarea id="dvc-ly-do" className="o-nhap" rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
            <span className="nhom-nut">
              <button type="button" className="nut chinh" disabled={busy || !reason.trim()} onClick={() => void act("cancel", { reason, version: order.version }, t("cancelled"))}>
                {t("cancel")}
              </button>
              <button type="button" className="nut phu" onClick={() => setCancelling(false)}>
                {common("close")}
              </button>
            </span>
          </div>
        ) : (
          <div className="nhom-nut">
            <button type="button" className="nut phu" onClick={() => setCancelling(true)}>
              {t("cancel")}
            </button>
          </div>
        ))}
    </div>
  );
}

function ConfirmTransfer({ order, onSaved }: { order: MarketplaceOrderDetail; onSaved: (value: MarketplaceOrderDetail) => void }) {
  const t = useTranslations("marketplaceOrders");
  const method = useTranslations("paymentMethods");
  const { notify } = useAdmin();
  const pending = order.payments.filter((payment) => payment.status === "pending" && payment.method.startsWith("bank_transfer_"));
  const [reference, setReference] = useState(pending.at(-1)?.reference ?? "");
  const [bankTransactionNo, setBankTransactionNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!window.confirm(t("confirmTransferAsk"))) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiFetch<MarketplaceOrderDetail>(`/marketplace/orders/${order.id}/transfer-received`, { method: "POST", body: JSON.stringify({ reference, bankTransactionNo }) }));
      notify(t("transferConfirmed"));
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <h2>{t("confirmTransferTitle")}</h2>
      <div className="chu-thich">{t("confirmTransferHint")}</div>
      <FormError text={error} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="dvc-lan-thanh-toan">{t("transferAttempt")}</label>
          <select id="dvc-lan-thanh-toan" className="o-nhap" style={{ width: "auto" }} value={reference} onChange={(event) => setReference(event.target.value)}>
            {pending.map((payment) => (
              <option key={payment.reference} value={payment.reference}>
                {`${payment.reference} · ${method(payment.method)} · ${formatNumber(payment.amount, 0)}`}
              </option>
            ))}
          </select>
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="dvc-ma-giao-dich">{t("bankTransactionNo")}</label>
          <input id="dvc-ma-giao-dich" className="o-nhap" maxLength={100} value={bankTransactionNo} onChange={(event) => setBankTransactionNo(event.target.value)} />
        </span>
        <button type="button" className="nut chinh" disabled={busy || !reference || !bankTransactionNo.trim()} onClick={() => void save()}>
          {t("confirmTransfer")}
        </button>
      </div>
    </div>
  );
}

function RecordCod({ order, onSaved }: { order: MarketplaceOrderDetail; onSaved: (value: MarketplaceOrderDetail) => void }) {
  const t = useTranslations("marketplaceOrders");
  const { notify } = useAdmin();
  const [collectedOn, setCollectedOn] = useState(new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await apiFetch<MarketplaceOrderDetail>(`/marketplace/orders/${order.id}/cod-collected`, { method: "POST", body: JSON.stringify({ collectedOn, reference, version: order.version }) }));
      notify(t("codRecorded"));
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <h2>{t("recordCodTitle")}</h2>
      <div className="chu-thich">{t("recordCodHint")}</div>
      <FormError text={error} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="dvc-ngay-thu">{t("collectedOn")}</label>
          <input id="dvc-ngay-thu" type="date" className="o-nhap" value={collectedOn} onChange={(event) => setCollectedOn(event.target.value)} />
        </span>
        <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
          <label htmlFor="dvc-phien">{t("codReference")}</label>
          <input id="dvc-phien" className="o-nhap" maxLength={100} value={reference} onChange={(event) => setReference(event.target.value)} />
        </span>
        <button type="button" className="nut chinh" disabled={busy || !reference.trim() || !collectedOn} onClick={() => void save()}>
          {t("recordCod")}
        </button>
      </div>
    </div>
  );
}

export default function MarketplaceOrderPage() {
  const t = useTranslations("marketplaceOrders");
  const method = useTranslations("paymentMethods");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<MarketplaceOrderDetail>(`/marketplace/orders/${id}`);
  const [saved, setSaved] = useState<MarketplaceOrderDetail | null>(null);
  const lineHeadings = [t("product"), t("quantity"), t("unitPrice"), t("promotion"), t("lineTotal")];
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(loaded) => {
        const order = saved && saved.version >= loaded.version ? saved : loaded;
        return (
          <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
            <div className="chu-thich">
              <Link href="/orders">‹ {t("back")}</Link>
            </div>
            <div className="tieu-de" style={{ display: "flex", gap: "var(--khoang-3)", alignItems: "center", flexWrap: "wrap" }}>
              <h1>{order.documentNo}</h1>
              <span className={`nhan ${orderTone[order.status]}`}>{t(`status_${order.status}`)}</span>
            </div>
            <div className="the">
              <dl className="thong-tin-dong">
                <Row label={t("buyer")}>
                  <Link href={`/buyers/${order.buyerId}`}>{order.buyerName}</Link> · {order.buyerPhone}
                </Row>
                <Row label={t("recipient")}>{`${order.recipientName} · ${order.recipientPhone}`}</Row>
                <Row label={t("address")}>{order.address}</Row>
                <Row label={t("payment")}>{`${method(order.paymentMethod)} · ${t(`paymentStatus_${order.paymentStatus}`)}`}</Row>
                <Row label={t("goodsAmount")}>{formatNumber(order.goodsAmount, 0)}</Row>
                <Row label={t("shippingFee")}>{formatNumber(order.shippingFee, 0)}</Row>
                <Row label={t(order.paymentMethod === "cod" ? "codAmount" : "orderTotal")}>{formatNumber(order.total, 0)}</Row>
                <Row label={t("paidAmount")}>{formatNumber(order.paidAmount, 0)}</Row>
                {Number(order.refundedAmount) > 0 && <Row label={t("refundedAmount")}>{formatNumber(order.refundedAmount, 0)}</Row>}
                {order.paymentDeadline && <Row label={t("paymentDeadline")}>{formatDateTime(order.paymentDeadline)}</Row>}
                <Row label={t("createdAt")}>{formatDateTime(order.createdAt)}</Row>
                {order.deliveredAt && <Row label={t("deliveredAt")}>{formatDateTime(order.deliveredAt)}</Row>}
                {order.completedAt && <Row label={t("completedAt")}>{`${formatDateTime(order.completedAt)} · ${formatNumber(order.completedAmount ?? "0", 0)}`}</Row>}
                {order.cancelReason && <Row label={t("cancelReason")}>{order.cancelReason}</Row>}
              </dl>
            </div>
            <Actions order={order} onSaved={setSaved} />
            {order.canRecordCod && <RecordCod order={order} onSaved={setSaved} />}
            {order.canConfirmTransfer && <ConfirmTransfer order={order} onSaved={setSaved} />}
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {lineHeadings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line, index) => (
                    <tr key={`${line.variantId}-${index}`}>
                      <td data-nhan={lineHeadings[0]}>
                        <span>
                          {line.productName}
                          {line.variantLabel ? <span className="chu-thich"> · {line.variantLabel}</span> : null}
                          {line.isGift ? <span className="chu-thich"> · {t("gift")}</span> : null}
                        </span>
                      </td>
                      <td data-nhan={lineHeadings[1]}>
                        <span>{formatNumber(line.quantity)}</span>
                      </td>
                      <td data-nhan={lineHeadings[2]}>
                        <span>{formatNumber(line.unitPrice, 0)}</span>
                      </td>
                      <td data-nhan={lineHeadings[3]}>
                        <span>{Number(line.promotionDiscount) > 0 ? formatNumber(line.promotionDiscount, 0) : "—"}</span>
                      </td>
                      <td data-nhan={lineHeadings[4]}>
                        <span>{formatNumber(line.total, 0)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {order.shipments.length > 0 && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <h2>{t("shipments")}</h2>
                {order.shipments.map((shipment) => (
                  <div key={`${shipment.trackingCode}-${shipment.createdAt}`} style={{ display: "grid", gap: "var(--khoang-1)" }}>
                    <strong>{`${shipment.carrierName} · ${shipment.trackingCode ?? t("shipmentRequesting")}`}</strong>
                    <span className="chu-thich">
                      {t("shipmentLine", { status: shipment.carrierStatus, fee: shipment.fee ? formatNumber(shipment.fee, 0) : "—", time: formatDateTime(shipment.syncedAt) })}
                      {shipment.isActive ? "" : ` · ${t("shipmentCancelled")}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {order.commissions.length > 0 && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <h2>{t("commissionsTitle")}</h2>
                {order.commissions.map((item, index) => (
                  <div key={`${item.share}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: "var(--khoang-2)", flexWrap: "wrap" }}>
                    <span>
                      <strong>{t(`share_${item.share}`)}</strong> · {item.beneficiaryName} · {item.beneficiaryPhone}
                    </span>
                    <span>{`${formatNumber(item.amount, 0)} · ${t(item.credited ? "commissionCredited" : "commissionEstimated")}`}</span>
                  </div>
                ))}
              </div>
            )}
            {order.payments.length > 0 && (
              <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <h2>{t("paymentAttempts")}</h2>
                {order.payments.map((payment) => (
                  <div key={payment.reference} style={{ display: "grid", gap: "var(--khoang-1)" }}>
                    <strong>{`${payment.reference} · ${method(payment.method)} · ${formatNumber(payment.amount, 0)}`}</strong>
                    <span className="chu-thich">
                      {`${t(`paymentAttemptStatus_${payment.status}`)} · ${formatDateTime(payment.completedAt ?? payment.createdAt)}`}
                      {payment.transactionNo ? ` · ${t("paymentTransaction")} ${payment.transactionNo}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
              <h2>{t("history")}</h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "var(--khoang-2)" }}>
                {order.events.map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    <span>{t(`status_${event.status}`)}</span>
                    <span className="chu-thich">{event.note ? ` · ${event.note}` : ""}</span>
                    <div className="chu-thich">{formatDateTime(event.at)}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}
