"use client";

// CONG_VIEC_09 (MAN_HINH_41 sửa): nhãn nội bộ, chứng từ đối ứng; đơn chờ xác nhận nội bộ thì chọn kho nhận để xác nhận hoặc từ chối kèm lý do (API_81).
import type { PurchaseOrderResponse, PurchasingOptionsResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

export function CounterpartPanel({ order, reload }: { order: PurchaseOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("orders");
  const sales = useTranslations("salesOrders");
  if (!order.isInternal) return null;
  return (
    <section className="the">
      <div>
        <span className="nhan thong-tin">{t("internal")}</span>{" "}
        {order.counterpart &&
          t(order.isCounterpart ? "counterpartFromSales" : "counterpartSales", {
            company: order.counterpart.companyName,
            number: order.counterpart.documentNo ?? t("noNumberYet"),
            status: sales(`status_${order.counterpart.status}` as "status_draft"),
          })}
      </div>
      {order.counterpartRejectedReason && <div className="khoi-canh-bao loi">{t("counterpartRejected", { reason: order.counterpartRejectedReason })}</div>}
      {order.canConfirmCounterpart && <Decision order={order} reload={reload} />}
    </section>
  );
}

function Decision({ order, reload }: { order: PurchaseOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("orders");
  const { notify } = useAdmin();
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const warehouses = options.state.kind === "ready" ? options.state.data.warehouses : [];

  function decide(path: "counterpart-confirm" | "counterpart-reject", body: Record<string, unknown>) {
    void run(async () => {
      await apiFetch(`/purchasing/orders/${order.id}/${path}`, { method: "POST", body: JSON.stringify({ ...body, version: order.version }) });
      notify(t("saved"));
      await reload();
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="chu-thich">{t("counterpartPendingHint")}</div>
      <Field id="kho-nhan-noi-bo" label={`${t("warehouse")} *`} error={fields.warehouseId}>
        <select id="kho-nhan-noi-bo" className={inputClass("warehouseId")} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">—</option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} · {warehouse.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="nhom-nut">
        <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !warehouseId} onClick={() => decide("counterpart-confirm", { warehouseId })}>
          {t("confirmCounterpart")}
        </button>
      </div>
      <Field id="ly-do-tu-choi" label={t("rejectReason")} error={fields.reason}>
        <input id="ly-do-tu-choi" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <div className="nhom-nut">
        <button type="button" className="nut phu" disabled={submitting || !reason.trim()} onClick={() => decide("counterpart-reject", { reason })}>
          {t("rejectCounterpart")}
        </button>
      </div>
      <FormError text={formError} />
    </div>
  );
}
