"use client";

// MAN_HINH_31, 32 (CONG_VIEC_08): lập phiếu xuất giao hàng theo đơn bán đã xác nhận; giao nhiều lần; lô gợi ý hết hạn trước, serial, vị trí (CHUC_NANG_56; API_79).
import type { LocationResponse, LotSuggestion, SaveSalesIssueRequest, StockDocumentResponse, WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type OpenOrder = { id: string; documentNo: string; customerName: string | null; warehouseName: string };
type OrderLine = {
  orderLineId: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitName: string;
  orderedQuantity: string;
  remainingQuantity: string;
  tracksLots: boolean;
  tracksSerials: boolean;
};
type OrderDetail = { id: string; documentNo: string; warehouseId: string; companyId: string; lines: OrderLine[] };
type Entry = { quantity: string; lotId: string; locationId: string; serials: string };

export default function NewSalesIssuePage() {
  const t = useTranslations("documents");
  const orders = useApi<OpenOrder[]>("/inventory/sales-orders");
  const [orderId, setOrderId] = useState("");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("new_sales_issue")}</h1>
      </div>
      <Loaded state={orders.state} onRetry={() => void orders.reload()}>
        {(list) =>
          list.length === 0 ? (
            <MessageView text={t("noOpenSalesOrders")} />
          ) : (
            <>
              <Field id="don-ban" label={t("salesOrder")}>
                <select id="don-ban" className="o-nhap" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">{t("chooseSalesOrder")}</option>
                  {list.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.documentNo} · {order.customerName ?? "—"} · {order.warehouseName}
                    </option>
                  ))}
                </select>
              </Field>
              {orderId && <IssueForm key={orderId} orderId={orderId} />}
            </>
          )
        }
      </Loaded>
    </>
  );
}

function LotSelect({
  id,
  warehouseId,
  companyId,
  variantId,
  value,
  onChange,
}: {
  id: string;
  warehouseId: string;
  companyId: string;
  variantId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("documents");
  const [lots, setLots] = useState<LotSuggestion[]>([]);
  useEffect(() => {
    void apiFetch<LotSuggestion[]>(`/inventory/documents/lot-suggestions?${new URLSearchParams({ warehouseId, companyId, variantId })}`)
      .then((found) => {
        setLots(found);
        if (!value && found[0]) onChange(found[0].lotId);
      })
      .catch(() => setLots([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseId, companyId, variantId]);
  return (
    <select id={id} className="o-nhap" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t("chooseLot")}</option>
      {lots.map((lot) => (
        <option key={`${lot.lotId}:${lot.locationId ?? ""}`} value={lot.lotId}>
          {lot.lotNo}
          {lot.expiresOn ? ` · ${formatDate(lot.expiresOn)}` : ""}
        </option>
      ))}
    </select>
  );
}

function IssueForm({ orderId }: { orderId: string }) {
  const t = useTranslations("documents");
  const router = useRouter();
  const order = useApi<OrderDetail>(`/inventory/sales-orders/${orderId}`);
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const detail = order.state.kind === "ready" ? order.state.data : null;
  const warehouse = warehouses.state.kind === "ready" && detail ? warehouses.state.data.find((item) => item.id === detail.warehouseId) : undefined;
  const locations = useApi<LocationResponse[]>(warehouse?.usesLocations ? `/inventory/warehouses/${warehouse.id}/locations` : null);
  const [documentDate, setDocumentDate] = useState(vietnamToday());
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const entry = (lineId: string): Entry => entries[lineId] ?? { quantity: "", lotId: "", locationId: "", serials: "" };
  const change = (lineId: string, value: Partial<Entry>) =>
    setEntries((current) => ({ ...current, [lineId]: { ...(current[lineId] ?? { quantity: "", lotId: "", locationId: "", serials: "" }), ...value } }));

  return (
    <Loaded state={order.state} onRetry={() => void order.reload()}>
      {(data) => {
        const chosen = data.lines.filter((line) => Number(entry(line.orderLineId).quantity) > 0);
        const save = () =>
          void run(async () => {
            const body: SaveSalesIssueRequest = {
              orderId,
              documentDate,
              lines: chosen.map((line) => {
                const value = entry(line.orderLineId);
                return {
                  orderLineId: line.orderLineId,
                  quantity: value.quantity,
                  lotId: line.tracksLots ? value.lotId || null : null,
                  locationId: value.locationId || null,
                  serials: line.tracksSerials ? value.serials.split(/[\s,;]+/).filter(Boolean) : [],
                };
              }),
            };
            const saved = await apiFetch<StockDocumentResponse>("/inventory/sales-issues", { method: "POST", body: JSON.stringify(body) });
            router.push(`/documents/${saved.id}`);
          });
        return (
          <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
            <Field id="ngay-phieu" label={t("date")} error={fields.documentDate}>
              <input id="ngay-phieu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </Field>
            <div className="chu-thich">{t("issueHint")}</div>
            {data.lines.map((line) => {
              const index = chosen.indexOf(line);
              const at = (field: string) => (index >= 0 ? fields[`lines.${index}.${field}`] : undefined);
              const value = entry(line.orderLineId);
              return (
                <fieldset key={line.orderLineId} className="the" style={{ margin: 0 }}>
                  <legend className="an-nhan">{line.sku}</legend>
                  <strong>
                    {line.sku} · {line.productName}
                    {line.optionValues.length > 0 && ` (${line.optionValues.join(", ")})`}
                  </strong>
                  <span className="chu-thich">{t("orderedRemaining", { ordered: formatNumber(line.orderedQuantity), remaining: formatNumber(line.remainingQuantity), unit: line.unitName })}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--khoang-3)" }}>
                    <Field id={`so-luong-${line.orderLineId}`} label={t("issuedQuantity", { unit: line.unitName })} error={at("quantity")}>
                      <input
                        id={`so-luong-${line.orderLineId}`}
                        className="o-nhap"
                        inputMode="decimal"
                        value={value.quantity}
                        onChange={(event) => change(line.orderLineId, { quantity: event.target.value })}
                      />
                    </Field>
                    {line.tracksLots && (
                      <Field id={`lo-${line.orderLineId}`} label={t("lot")} error={at("lotId")}>
                        <LotSelect
                          id={`lo-${line.orderLineId}`}
                          warehouseId={data.warehouseId}
                          companyId={data.companyId}
                          variantId={line.variantId}
                          value={value.lotId}
                          onChange={(lotId) => change(line.orderLineId, { lotId })}
                        />
                      </Field>
                    )}
                    {warehouse?.usesLocations && (
                      <Field id={`vi-tri-${line.orderLineId}`} label={t("location")} error={at("locationId")}>
                        <select id={`vi-tri-${line.orderLineId}`} className="o-nhap" value={value.locationId} onChange={(event) => change(line.orderLineId, { locationId: event.target.value })}>
                          <option value="">—</option>
                          {(locations.state.kind === "ready" ? locations.state.data : [])
                            .filter((location) => location.status === "active")
                            .map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.code}
                              </option>
                            ))}
                        </select>
                      </Field>
                    )}
                  </div>
                  {line.tracksSerials && (
                    <Field id={`serial-${line.orderLineId}`} label={t("serials")} hint={t("serialsHint")} error={at("serials")}>
                      <textarea id={`serial-${line.orderLineId}`} className="o-nhap" rows={3} value={value.serials} onChange={(event) => change(line.orderLineId, { serials: event.target.value })} />
                    </Field>
                  )}
                </fieldset>
              );
            })}
            <FormError text={formError} />
            <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || chosen.length === 0} style={{ justifySelf: "start" }} onClick={save}>
              {t("saveDraft")}
            </button>
          </div>
        );
      }}
    </Loaded>
  );
}
