"use client";

// MAN_HINH_236 Chi tiết đơn dropship (CONG_VIEC_62 CHUC_NANG_223; API_267, API_268): dòng hàng, người nhận, lịch sử trạng thái giao;
// báo đang giao, đã giao, giao thất bại, hủy; số hóa đơn nhà cung cấp. Trả hàng làm ở lát L3.
import type { DropshipOrderResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DropshipStatusBadge } from "@/components/DropshipStatusBadge";

type Action = "shipping" | "delivered" | "failed" | "cancel" | "invoice";

export default function DropshipOrderPage() {
  const t = useTranslations("dropshipOrders");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<DropshipOrderResponse>(`/purchasing/dropship-orders/${id}`);
  return (
    <>
      <div>
        <Link href="/dropship-orders">‹ {t("back")}</Link>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(order) => <Detail key={order.version} order={order} reload={reload} />}
      </Loaded>
    </>
  );
}

function Detail({ order, reload }: { order: DropshipOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("dropshipOrders");
  const { notify } = useAdmin();
  const [action, setAction] = useState<Action | null>(null);
  const open = order.status === "awaiting" || order.status === "shipping";

  const headings = [t("product"), t("unit"), t("quantity"), t("unitPrice"), t("vatRate"), t("amount")];
  return (
    <>
      <div className="tieu-de">
        <h1>
          {t("detailTitle", { documentNo: order.documentNo })} <DropshipStatusBadge status={order.status} />
        </h1>
        <HistoryLink entityType="purchase_order" entityId={order.id} />
        {order.canManage && (
          <span className="nhom-nut">
            {open && (
              <button type="button" className="nut nguy-hiem" onClick={() => setAction("cancel")}>
                {t("cancel")}
              </button>
            )}
            {open && (
              <button type="button" className="nut phu" onClick={() => setAction("failed")}>
                {t("failed")}
              </button>
            )}
            {open && (
              <button type="button" className="nut phu" onClick={() => setAction("shipping")}>
                {t("shipping")}
              </button>
            )}
            {open && (
              <button type="button" className="nut chinh" onClick={() => setAction("delivered")}>
                {t("delivered")}
              </button>
            )}
            {order.status === "delivered" && (
              <button type="button" className="nut chinh" onClick={() => setAction("invoice")}>
                {t("supplierInvoice")}
              </button>
            )}
          </span>
        )}
      </div>
      {order.overdue && (
        <div className="khoi-canh-bao canh-bao" role="status">
          {t("overdueHint")}
        </div>
      )}
      {(order.status === "failed" || order.status === "cancelled") && (
        <div className="khoi-canh-bao canh-bao" role="status">
          {t("endedHint", { reason: order.reason ?? "" })}
        </div>
      )}
      <div className="hai-cot">
        <section className="the">
          <h2 style={{ margin: 0 }}>{t("information")}</h2>
          <dl className="thong-tin-dong">
            <dt>{t("salesOrder")}</dt>
            <dd>
              <a href={`/sales/orders/${order.salesOrderId}`}>{order.salesOrderNo ?? "—"}</a>
            </dd>
            <dt>{t("supplier")}</dt>
            <dd>{order.supplierName}</dd>
            <dt>{t("warehouse")}</dt>
            <dd>{order.warehouseName}</dd>
            <dt>{t("orderDate")}</dt>
            <dd>{formatDate(order.orderDate)}</dd>
            <dt>{t("carrier")}</dt>
            <dd>{[order.carrierName, order.trackingCode].filter(Boolean).join(" · ") || "—"}</dd>
            <dt>{t("deliveredOn")}</dt>
            <dd>{order.deliveredOn ? formatDate(order.deliveredOn) : "—"}</dd>
            <dt>{t("supplierInvoice")}</dt>
            <dd>{order.supplierInvoiceNo ? `${order.supplierInvoiceNo} · ${formatDate(order.supplierInvoiceDate)}` : "—"}</dd>
            <dt>{t("documents")}</dt>
            <dd>
              {order.receipt || order.issue ? (
                <span className="nhom-nut">
                  {order.receipt && <a href={`/inventory/documents/${order.receipt.id}`}>{order.receipt.documentNo}</a>}
                  {order.issue && <a href={`/inventory/documents/${order.issue.id}`}>{order.issue.documentNo}</a>}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </dl>
        </section>
        <section className="the">
          <h2 style={{ margin: 0 }}>{t("recipient")}</h2>
          <dl className="thong-tin-dong">
            <dt>{t("recipientName")}</dt>
            <dd>{order.recipientName ?? "—"}</dd>
            <dt>{t("recipientPhone")}</dt>
            <dd>{order.recipientPhone ?? "—"}</dd>
            <dt>{t("recipientAddress")}</dt>
            <dd>{order.deliveryAddress ?? "—"}</dd>
          </dl>
        </section>
      </div>
      <h2>{t("lines")}</h2>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th key={index} scope="col" style={index >= 2 ? { textAlign: "right" } : undefined}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.variantId}>
                <td data-nhan={headings[0]}>
                  <span>
                    {[line.sku, line.productName, ...line.optionValues].join(" · ")}
                    {line.supplierSku && <span className="chu-thich"> · {line.supplierSku}</span>}
                  </span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{line.unitName}</span>
                </td>
                <td data-nhan={headings[2]} style={{ textAlign: "right" }}>
                  <span>{formatNumber(line.quantity)}</span>
                </td>
                <td data-nhan={headings[3]} style={{ textAlign: "right" }}>
                  <span>{formatMoney(line.unitPrice, order.currency)}</span>
                </td>
                <td data-nhan={headings[4]} style={{ textAlign: "right" }}>
                  <span>{line.vatRate}%</span>
                </td>
                <td data-nhan={headings[5]} style={{ textAlign: "right" }}>
                  <span>{formatMoney(line.amount, order.currency)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td data-nhan="" colSpan={5}>
                <strong>{t("totalWithTax")}</strong>
              </td>
              <td data-nhan={t("totalWithTax")} style={{ textAlign: "right" }}>
                <strong>{formatMoney(String(Number(order.totalAmount) + Number(order.taxAmount)), order.currency)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <h2>{t("events")}</h2>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th scope="col">{t("eventTime")}</th>
              <th scope="col">{t("status")}</th>
              <th scope="col">{t("eventActor")}</th>
              <th scope="col">{t("eventNote")}</th>
            </tr>
          </thead>
          <tbody>
            {order.events.map((event, index) => (
              <tr key={index}>
                <td data-nhan={t("eventTime")}>
                  <span>{formatDateTime(event.createdAt)}</span>
                </td>
                <td data-nhan={t("status")}>
                  <DropshipStatusBadge status={event.status} />
                </td>
                <td data-nhan={t("eventActor")}>
                  <span>{event.actorName || "—"}</span>
                </td>
                <td data-nhan={t("eventNote")}>
                  <span>{event.note ?? "—"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {action && (
        <ActionDrawer
          order={order}
          action={action}
          onClose={() => setAction(null)}
          onDone={() => {
            setAction(null);
            notify(t("saved"));
            void reload();
          }}
        />
      )}
    </>
  );
}

function ActionDrawer({ order, action, onClose, onDone }: { order: DropshipOrderResponse; action: Action; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("dropshipOrders");
  const common = useTranslations("common");
  const [carrierName, setCarrierName] = useState(order.carrierName ?? "");
  const [trackingCode, setTrackingCode] = useState(order.trackingCode ?? "");
  const [deliveredOn, setDeliveredOn] = useState(vietnamToday());
  const [reason, setReason] = useState("");
  const [invoiceNo, setInvoiceNo] = useState(order.supplierInvoiceNo ?? "");
  const [invoiceDate, setInvoiceDate] = useState(order.supplierInvoiceDate ?? vietnamToday());
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const titles: Record<Action, string> = { shipping: t("shipping"), delivered: t("delivered"), failed: t("failed"), cancel: t("cancel"), invoice: t("supplierInvoice") };

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const version = order.version;
      if (action === "shipping")
        await apiFetch(`/purchasing/dropship-orders/${order.id}/shipping`, { method: "POST", body: JSON.stringify({ carrierName: carrierName || null, trackingCode: trackingCode || null, version }) });
      else if (action === "delivered") await apiFetch(`/purchasing/dropship-orders/${order.id}/delivered`, { method: "POST", body: JSON.stringify({ deliveredOn, version }) });
      else if (action === "invoice") await apiFetch(`/purchasing/dropship-orders/${order.id}/supplier-invoice`, { method: "PATCH", body: JSON.stringify({ invoiceNo, invoiceDate, version }) });
      else await apiFetch(`/purchasing/dropship-orders/${order.id}/${action}`, { method: "POST", body: JSON.stringify({ reason, version }) });
      onDone();
    });
  }

  return (
    <Drawer title={titles[action]} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        {action === "shipping" && (
          <>
            <Field id="don-vi-van-chuyen" label={t("carrierName")} error={fields.carrierName}>
              <input id="don-vi-van-chuyen" className={inputClass("carrierName")} maxLength={100} value={carrierName} onChange={(event) => setCarrierName(event.target.value)} />
            </Field>
            <Field id="ma-van-don" label={t("trackingCode")} error={fields.trackingCode}>
              <input id="ma-van-don" className={inputClass("trackingCode")} maxLength={100} value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} />
            </Field>
          </>
        )}
        {action === "delivered" && (
          <>
            <Field id="ngay-giao" label={`${t("deliveredOn")} *`} error={fields.deliveredOn}>
              <input id="ngay-giao" type="date" className={inputClass("deliveredOn")} value={deliveredOn} onChange={(event) => setDeliveredOn(event.target.value)} />
            </Field>
            <div className="chu-thich">{t("deliveredHint")}</div>
          </>
        )}
        {(action === "failed" || action === "cancel") && (
          <>
            <Field id="ly-do-dropship" label={`${t("reason")} *`} error={fields.reason}>
              <textarea id="ly-do-dropship" className={inputClass("reason")} maxLength={500} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
            <div className="chu-thich">{t("endHint")}</div>
          </>
        )}
        {action === "invoice" && (
          <>
            <Field id="so-hoa-don-ncc" label={`${t("invoiceNo")} *`} error={fields.invoiceNo}>
              <input id="so-hoa-don-ncc" className={inputClass("invoiceNo")} maxLength={50} value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} />
            </Field>
            <Field id="ngay-hoa-don-ncc" label={`${t("invoiceDate")} *`} error={fields.invoiceDate}>
              <input id="ngay-hoa-don-ncc" type="date" className={inputClass("invoiceDate")} value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            </Field>
          </>
        )}
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className={`nut ${action === "cancel" ? "nguy-hiem" : "chinh"}`} disabled={submitting}>
            {action === "delivered" ? t("confirmDelivered") : common("save")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
