"use client";

// CONG_VIEC_09 (MAN_HINH_43 sửa): nhãn nội bộ, chứng từ đối ứng; đơn chờ xác nhận nội bộ thì chọn kho xuất để xác nhận hoặc từ chối kèm lý do (API_80).
import type { SalesOptionsResponse, SalesOrderResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { useApi } from "ui/lib/use-api";

export function CounterpartPanel({ order, reload }: { order: SalesOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("salesOrders");
  const purchasing = useTranslations("purchasing");
  if (!order.isInternal) return null;
  return (
    <section className="the">
      <div>
        <span className="nhan thong-tin">{t("internal")}</span>{" "}
        {order.counterpart &&
          t(order.isCounterpart ? "counterpartFromPurchase" : "counterpartPurchase", {
            company: order.counterpart.companyName,
            number: order.counterpart.documentNo ?? t("noNumberYet"),
            status: purchasing(`status_${order.counterpart.status}` as "status_draft"),
          })}
      </div>
      {order.counterpartRejectedReason && <div className="khoi-canh-bao loi">{t("counterpartRejected", { reason: order.counterpartRejectedReason })}</div>}
      {order.canConfirmCounterpart && <Decision order={order} reload={reload} />}
    </section>
  );
}

function Decision({ order, reload }: { order: SalesOrderResponse; reload: () => Promise<void> }) {
  const t = useTranslations("salesOrders");
  const { notify } = useAdmin();
  const options = useApi<SalesOptionsResponse>("/sales/options");
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const warehouses = options.state.kind === "ready" ? options.state.data.warehouses : [];

  function decide(path: "counterpart-confirm" | "counterpart-reject", body: Record<string, unknown>) {
    void run(async () => {
      await apiFetch(`/sales/orders/${order.id}/${path}`, { method: "POST", body: JSON.stringify({ ...body, version: order.version }) });
      notify(t("saved"));
      await reload();
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div className="chu-thich">{t("counterpartPendingHint")}</div>
      <Field id="kho-xuat-noi-bo" label={`${t("warehouse")} *`} error={fields.warehouseId}>
        <select id="kho-xuat-noi-bo" className={inputClass("warehouseId")} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
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
      {/* Lỗi không gắn ô trên khối này (thiếu hàng, thiếu liên kết, hồ sơ đối tác): hiện kèm số dòng. */}
      <FormError
        text={
          Object.entries(fields)
            .filter(([key]) => key !== "warehouseId" && key !== "reason")
            .map(([key, text]) => {
              const line = /^lines\.(\d+)\./.exec(key);
              return line ? `${t("lineLabel", { number: Number(line[1]) + 1 })}: ${text}` : text;
            })
            .join(" ") || null
        }
      />
    </div>
  );
}
