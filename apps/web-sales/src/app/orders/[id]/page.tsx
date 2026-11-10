"use client";

// MAN_HINH_43 Chi tiết đơn bán (CHUC_NANG_54; API_77): dòng hàng, ngoại lệ cần duyệt, đã giao, đã trả, phiếu kho; sửa, gửi, rút, hủy, đóng.
import type { SalesOrderResponse } from "contracts";
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
import { formatDate, formatMoney, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";
import { itemLabel } from "@/components/ItemPicker";
import { CounterpartPanel } from "@/components/CounterpartPanel";
import { SalesOrderEditor } from "@/components/SalesOrderEditor";
import { SalesStatus } from "@/components/SalesStatus";

export default function SalesOrderPage() {
  const t = useTranslations("salesOrders");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<SalesOrderResponse>(`/sales/orders/${id}`);
  return (
    <>
      <div>
        <Link href="/orders">‹ {t("back")}</Link>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(order) => <Detail key={order.version} order={order} reload={reload} />}
      </Loaded>
    </>
  );
}

function Detail({ order, reload }: { order: SalesOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("salesOrders");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      await apiFetch(`/sales/orders/${order.id}/${path}`, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      notify(t("saved"));
      await reload();
    } catch (error) {
      // Lỗi theo dòng (ví dụ thiếu hàng khi gửi) ghi kèm số dòng vì màn chi tiết không có ô nhập.
      const failure = failureOf(error);
      const lineErrors = Object.entries(failure.fields).flatMap(([key, text]) => {
        const match = /^lines\.(\d+)\./.exec(key);
        const line = match ? order.lines[Number(match[1])] : undefined;
        return line ? [`${t("line", { number: line.lineNo })} (${line.sku}): ${text}`] : [];
      });
      notify(lineErrors.length > 0 ? lineErrors.join(" ") : failure.message, "loi");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <>
        <div className="tieu-de">
          <h1>
            {t("edit")}: {order.documentNo ?? t("draftNo")}
          </h1>
        </div>
        <SalesOrderEditor
          order={order}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            notify(t("saved"));
            void reload();
          }}
        />
      </>
    );
  }

  const headings = [t("item"), t("quantity"), t("listPrice"), t("discountPercent"), t("vatRate"), t("lineTotal"), t("delivered")];
  return (
    <>
      <div className="tieu-de">
        <h1>{order.documentNo ?? t("draftNo")}</h1>
        <SalesStatus status={order.status} />
        <HistoryLink entityId={order.id} />
        {order.canEdit && (
          <button type="button" className="nut phu" onClick={() => setEditing(true)}>
            {t("edit")}
          </button>
        )}
        {order.canWithdraw && (
          <button type="button" className="nut phu" disabled={busy} onClick={() => void act("withdraw")}>
            {t("withdraw")}
          </button>
        )}
        {order.canCancel && (
          <button type="button" className="nut phu" disabled={busy} onClick={() => void act("cancel", { version: order.version })}>
            {t("cancel")}
          </button>
        )}
        {order.canClose && (
          <button type="button" className="nut phu" onClick={() => setClosing(true)}>
            {t("close")}
          </button>
        )}
        {order.canSubmit && (
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("submit")}>
            {t("submit")}
          </button>
        )}
      </div>
      <CounterpartPanel order={order} reload={reload} />
      {order.exceptions.length > 0 && (
        <div className="khoi-canh-bao canh-bao">
          <strong>{t("exceptions")}</strong>
          <ul style={{ margin: 0 }}>
            {order.exceptions.map((exception, index) => (
              <li key={index}>
                {t(`exception_${exception.kind}`)}
                {exception.lineNo !== null && ` (${t("line", { number: exception.lineNo })})`}
                {exception.detail && `: ${exception.detail}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      <section className="the">
        <div>
          <strong>{order.customerName ?? order.buyerName ?? t("walkIn")}</strong>
        </div>
        <div className="chu-thich">
          {t("channel")}: {order.channelName} · {t("warehouse")}: {order.warehouseName} · {t("orderDate")}: {formatDate(order.orderDate)} · {t("createdBy")}: {order.createdByName}
        </div>
        {order.deliveryAddress && <div>{order.deliveryAddress}</div>}
        {order.note && <div>{order.note}</div>}
        {order.closedReason && (
          <div className="khoi-canh-bao thong-tin">
            {t("closedReason")}: {order.closedReason}
          </div>
        )}
        <strong>
          {t("net")}: {formatMoney(order.netAmount, order.currency)} · {t("tax")}: {formatMoney(order.taxAmount, order.currency)} · {t("total")}: {formatMoney(order.totalAmount, order.currency)}
        </strong>
      </section>
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
            {order.lines.map((line) => (
              <tr key={line.id}>
                <td data-nhan={headings[0]}>
                  <span>{itemLabel(line)}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>
                    {formatNumber(line.quantity)} {line.unitName}
                  </span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>
                    {formatMoney(line.listPrice, order.currency)}
                    <span className="chu-thich"> · {line.priceIncludesVat ? t("includesVat") : t("excludesVat")}</span>
                  </span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{formatNumber(line.discountPercent)}%</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>{t(`vat_${line.vatRate}`)}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <span>{formatMoney(line.totalAmount, order.currency)}</span>
                </td>
                <td data-nhan={headings[6]}>
                  <span>
                    {formatNumber(line.deliveredBaseQuantity)} / {formatNumber(line.baseQuantity)}
                    {Number(line.returnedBaseQuantity) > 0 && <span className="chu-thich"> · {t("returned", { count: formatNumber(line.returnedBaseQuantity) })}</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chu-thich">{t("baseUnitHint")}</div>
      <section className="the">
        <h2 style={{ margin: 0 }}>{t("documents")}</h2>
        {order.documents.length === 0 ? (
          <span className="chu-thich">{t("noDocuments")}</span>
        ) : (
          order.documents.map((document) => (
            <div key={document.id}>
              {/* Thẻ a thường: phiếu kho nằm ở mini app Kho. */}
              <a href={`/inventory/documents/${document.id}`}>{document.documentNo ?? t("draftNo")}</a> · {t(`documentType_${document.type}`)} · {formatDate(document.documentDate)}
            </div>
          ))
        )}
      </section>
      {closing && <CloseDrawer order={order} onClose={() => setClosing(false)} onClosed={() => void reload()} />}
    </>
  );
}

function CloseDrawer({ order, onClose, onClosed }: { order: SalesOrderResponse; onClose: () => void; onClosed: () => void }) {
  const t = useTranslations("salesOrders");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/sales/orders/${order.id}/close`, { method: "POST", body: JSON.stringify({ reason, version: order.version }) });
      notify(t("saved"));
      onClose();
      onClosed();
    });
  }
  return (
    <Drawer title={t("close")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <div className="chu-thich">{t("closeHint")}</div>
        <Field id="ly-do-dong" label={`${t("closedReason")} *`} error={fields.reason}>
          <textarea id="ly-do-dong" className={inputClass("reason")} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting}>
            {t("close")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
