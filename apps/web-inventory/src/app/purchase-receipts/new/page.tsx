"use client";

// MAN_HINH_31, 32 (CONG_VIEC_07): lập phiếu nhập mua theo đơn mua đã duyệt; số còn nhận được đã tính dung sai; lô, hạn dùng, serial, vị trí (CHUC_NANG_52; API_76).
import type { LocationResponse, SavePurchaseReceiptRequest, StockDocumentResponse, WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type OpenOrder = { id: string; documentNo: string; supplierName: string; warehouseId: string; warehouseName: string; companyName: string };
type OrderLine = {
  orderLineId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitName: string;
  factor: string;
  orderedQuantity: string;
  receivableQuantity: string;
  tracksLots: boolean;
  tracksSerials: boolean;
  requiresQualityCheck: boolean;
};
type OrderDetail = { id: string; documentNo: string; warehouseId: string; lines: OrderLine[] };
type Entry = { quantity: string; lotNo: string; expiresOn: string; manufacturedOn: string; locationId: string; serials: string };

export default function NewPurchaseReceiptPage() {
  const t = useTranslations("documents");
  const orders = useApi<OpenOrder[]>("/inventory/purchase-orders");
  const [orderId, setOrderId] = useState("");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("new_purchase_receipt")}</h1>
      </div>
      <Loaded state={orders.state} onRetry={() => void orders.reload()}>
        {(list) =>
          list.length === 0 ? (
            <MessageView text={t("noOpenOrders")} />
          ) : (
            <>
              <Field id="don-mua" label={t("purchaseOrder")}>
                <select id="don-mua" className="o-nhap" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
                  <option value="">{t("chooseOrder")}</option>
                  {list.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.documentNo} · {order.supplierName} · {order.warehouseName}
                    </option>
                  ))}
                </select>
              </Field>
              {orderId && <ReceiptForm key={orderId} orderId={orderId} />}
            </>
          )
        }
      </Loaded>
    </>
  );
}

function ReceiptForm({ orderId }: { orderId: string }) {
  const t = useTranslations("documents");
  const router = useRouter();
  const order = useApi<OrderDetail>(`/inventory/purchase-orders/${orderId}`);
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const warehouseId = order.state.kind === "ready" ? order.state.data.warehouseId : null;
  const warehouse = warehouses.state.kind === "ready" ? warehouses.state.data.find((item) => item.id === warehouseId) : undefined;
  const locations = useApi<LocationResponse[]>(warehouse?.usesLocations ? `/inventory/warehouses/${warehouse.id}/locations` : null);
  const [documentDate, setDocumentDate] = useState(vietnamToday());
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const entry = (lineId: string): Entry => entries[lineId] ?? { quantity: "", lotNo: "", expiresOn: "", manufacturedOn: "", locationId: "", serials: "" };
  const change = (lineId: string, value: Partial<Entry>) => setEntries({ ...entries, [lineId]: { ...entry(lineId), ...value } });

  return (
    <Loaded state={order.state} onRetry={() => void order.reload()}>
      {(detail) => {
        const chosen = detail.lines.filter((line) => Number(entry(line.orderLineId).quantity) > 0);
        const save = () =>
          void run(async () => {
            const body: SavePurchaseReceiptRequest = {
              orderId,
              documentDate,
              lines: chosen.map((line) => {
                const value = entry(line.orderLineId);
                return {
                  orderLineId: line.orderLineId,
                  quantity: value.quantity,
                  lotNo: line.tracksLots ? value.lotNo || null : null,
                  expiresOn: line.tracksLots ? value.expiresOn || null : null,
                  manufacturedOn: line.tracksLots ? value.manufacturedOn || null : null,
                  locationId: value.locationId || null,
                  serials: line.tracksSerials ? value.serials.split(/[\s,;]+/).filter(Boolean) : [],
                };
              }),
            };
            const saved = await apiFetch<StockDocumentResponse>("/inventory/purchase-receipts", { method: "POST", body: JSON.stringify(body) });
            router.push(`/documents/${saved.id}`);
          });
        return (
          <div style={{ display: "grid", gap: "var(--khoang-4)" }}>
            <Field id="ngay-phieu" label={t("date")} error={fields.documentDate}>
              <input id="ngay-phieu" type="date" className={inputClass("documentDate")} value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </Field>
            <div className="chu-thich">{t("purchaseReceiveHint")}</div>
            {detail.lines.map((line) => {
              const index = chosen.indexOf(line);
              const at = (field: string) => fields[`lines.${index}.${field}`];
              const value = entry(line.orderLineId);
              return (
                <fieldset key={line.orderLineId} className="the" style={{ margin: 0 }}>
                  <legend className="an-nhan">{line.sku}</legend>
                  <span className="nhom-nut" style={{ justifyContent: "space-between" }}>
                    <strong>
                      {line.sku} · {line.productName}
                      {line.optionValues.length > 0 && ` (${line.optionValues.join(", ")})`}
                    </strong>
                    {line.requiresQualityCheck && <span className="nhan canh-bao">{t("needsQualityCheck")}</span>}
                  </span>
                  <span className="chu-thich">{t("orderedReceivable", { ordered: formatNumber(line.orderedQuantity), receivable: formatNumber(line.receivableQuantity), unit: line.unitName })}</span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--khoang-3)" }}>
                    <Field id={`so-luong-${line.orderLineId}`} label={t("purchaseReceivedQuantity", { unit: line.unitName })} error={index >= 0 ? at("quantity") : undefined}>
                      <input
                        id={`so-luong-${line.orderLineId}`}
                        className="o-nhap"
                        inputMode="decimal"
                        value={value.quantity}
                        onChange={(event) => change(line.orderLineId, { quantity: event.target.value })}
                      />
                    </Field>
                    {line.tracksLots && (
                      <>
                        <Field id={`lo-${line.orderLineId}`} label={t("lotNo")} error={index >= 0 ? at("lotNo") : undefined}>
                          <input id={`lo-${line.orderLineId}`} className="o-nhap" value={value.lotNo} onChange={(event) => change(line.orderLineId, { lotNo: event.target.value })} />
                        </Field>
                        <Field id={`han-${line.orderLineId}`} label={t("expiresOn")} error={index >= 0 ? at("expiresOn") : undefined}>
                          <input
                            id={`han-${line.orderLineId}`}
                            type="date"
                            className="o-nhap"
                            value={value.expiresOn}
                            onChange={(event) => change(line.orderLineId, { expiresOn: event.target.value })}
                          />
                        </Field>
                      </>
                    )}
                    {warehouse?.usesLocations && (
                      <Field id={`vi-tri-${line.orderLineId}`} label={t("location")} error={index >= 0 ? at("locationId") : undefined}>
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
                    <Field id={`serial-${line.orderLineId}`} label={t("serials")} hint={t("serialsHint")} error={index >= 0 ? at("serials") : undefined}>
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
