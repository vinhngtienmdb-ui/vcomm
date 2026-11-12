"use client";

// MAN_HINH_41 Chi tiết đơn mua (CHUC_NANG_51; API_75): dòng hàng, đã nhận, đã trả, còn nhận được, phiếu kho liên quan; sửa, gửi, rút, đóng đơn.
import type { PurchaseOrderResponse } from "contracts";
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
import { BudgetPanel } from "@/components/BudgetPanel";
import { OrderEditor } from "@/components/OrderEditor";
import { PurchaseStatus } from "@/components/PurchaseStatus";

export default function OrderPage() {
  const t = useTranslations("orders");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<PurchaseOrderResponse>(`/purchasing/orders/${id}`);
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

function Detail({ order, reload }: { order: PurchaseOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("orders");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function act(path: string) {
    setBusy(true);
    try {
      await apiFetch(`/purchasing/orders/${order.id}/${path}`, { method: "POST" });
      notify(t("saved"));
      await reload();
    } catch (error) {
      notify(failureOf(error).message, "loi");
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
        <OrderEditor
          order={order}
          requisition={null}
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

  const headings = [t("item"), t("unit"), t("quantity"), t("unitPrice"), t("vatRate"), t("amount"), t("received"), t("receivable")];
  return (
    <>
      <div className="tieu-de">
        <h1>{order.documentNo ?? t("draftNo")}</h1>
        <PurchaseStatus status={order.status} />
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
      <section className="the">
        <div className="nhom-nut" style={{ alignItems: "center" }}>
          <strong>{order.supplierName}</strong>
          {order.isImport && <span className="nhan thong-tin">{t("importLabel", { currency: order.currency })}</span>}
        </div>
        <div className="chu-thich">
          {t("warehouse")}: {order.warehouseName} · {t("orderDate")}: {formatDate(order.orderDate)} · {t("expectedDate")}: {formatDate(order.expectedDate)} · {t("createdBy")}: {order.createdByName}
        </div>
        {order.note && <div>{order.note}</div>}
        {order.closedReason && (
          <div className="khoi-canh-bao thong-tin">
            {t("closedReason")}: {order.closedReason}
          </div>
        )}
        <strong>
          {t("total")}: {formatMoney(order.totalAmount, order.currency)} · {t("tax")}: {formatMoney(order.taxAmount, order.currency)}
        </strong>
        {order.currency !== order.companyCurrency && (
          <div className="chu-thich">{order.convertedTotal === null ? t("convertedMissing") : t("convertedTotal", { amount: formatMoney(order.convertedTotal, order.companyCurrency) })}</div>
        )}
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
                  <span>
                    {itemLabel(line)}
                    {line.requisitionLineId && <span className="nhan thong-tin"> {t("fromRequisition")}</span>}
                  </span>
                </td>
                <td data-nhan={headings[1]}>
                  <span>{line.unitName}</span>
                </td>
                <td data-nhan={headings[2]}>
                  <span>{formatNumber(line.quantity)}</span>
                </td>
                <td data-nhan={headings[3]}>
                  <span>{formatMoney(line.unitPrice, order.currency)}</span>
                </td>
                <td data-nhan={headings[4]}>
                  <span>{t(`vat_${line.vatRate}`)}</span>
                </td>
                <td data-nhan={headings[5]}>
                  <span>{formatMoney(line.amount, order.currency)}</span>
                </td>
                <td data-nhan={headings[6]}>
                  <span>
                    {formatNumber(line.receivedBaseQuantity)} / {formatNumber(line.baseQuantity)}
                    {Number(line.returnedBaseQuantity) > 0 && <span className="chu-thich"> · {t("returned", { count: formatNumber(line.returnedBaseQuantity) })}</span>}
                  </span>
                </td>
                <td data-nhan={headings[7]}>
                  <span>{formatNumber(line.receivableBaseQuantity)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="chu-thich">{t("baseUnitHint")}</div>
      <BudgetPanel check={order.budgetCheck} snapshot={order.budgetSnapshot} currency={order.companyCurrency} />
      <section className="the">
        <h2 style={{ margin: 0 }}>{t("receipts")}</h2>
        {order.receipts.length === 0 ? (
          <span className="chu-thich">{t("noReceipts")}</span>
        ) : (
          order.receipts.map((receipt) => (
            <div key={receipt.id}>
              {/* Thẻ a thường: phiếu kho nằm ở mini app Kho. */}
              <a href={`/inventory/documents/${receipt.id}`}>{receipt.documentNo ?? t("draftNo")}</a> · {t(`receiptType_${receipt.type}`)} · {formatDate(receipt.documentDate)} ·{" "}
              {t(`receiptStatus_${receipt.status}`)}
            </div>
          ))
        )}
      </section>
      {closing && <CloseDrawer order={order} onClose={() => setClosing(false)} onClosed={() => void reload()} />}
    </>
  );
}

function CloseDrawer({ order, onClose, onClosed }: { order: PurchaseOrderResponse; onClose: () => void; onClosed: () => void }) {
  const t = useTranslations("orders");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      await apiFetch(`/purchasing/orders/${order.id}/close`, { method: "POST", body: JSON.stringify({ reason, version: order.version }) });
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
