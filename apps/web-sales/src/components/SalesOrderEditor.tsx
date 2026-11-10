"use client";

// Soạn đơn bán (CHUC_NANG_54): khách hoặc người mua không lấy hóa đơn, kênh, kho xuất; giá dòng tự lấy theo bảng giá, chiết khấu tay.
import type { SalesOptionsResponse, SalesOrderResponse, SalesPriceResponse, SaveSalesOrderRequest, StockItemOption } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatMoney, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ItemPicker, itemLabel } from "@/components/ItemPicker";

type Line = {
  item: { variantId: string; sku: string; productName: string; optionValues: string[]; units: StockItemOption["units"] };
  unitId: string;
  quantity: string;
  discountPercent: string;
  price: SalesPriceResponse | null;
};

export function SalesOrderEditor({ order, onSaved, onCancel }: { order: SalesOrderResponse | null; onSaved: (saved: SalesOrderResponse) => void; onCancel: () => void }) {
  const t = useTranslations("salesOrders");
  const common = useTranslations("common");
  const options = useApi<SalesOptionsResponse>("/sales/options");
  const choices = options.state.kind === "ready" ? options.state.data : { customers: [], channels: [], warehouses: [], currency: "VND" };
  const [customerId, setCustomerId] = useState(order?.customerId ?? "");
  const [buyerName, setBuyerName] = useState(order?.buyerName ?? "");
  const [channelId, setChannelId] = useState(order?.channelId ?? "");
  const [warehouseId, setWarehouseId] = useState(order?.warehouseId ?? "");
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? vietnamToday());
  const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  const [lines, setLines] = useState<Line[]>(
    // Dòng hàng tặng do khuyến mãi tự tạo lại khi lưu, không sửa tay (QUYTAC_NGHIEPVU_81).
    order?.lines
      .filter((line) => !line.isGift)
      .map((line) => ({
        item: { ...line, units: [{ unitId: line.unitId, unitName: line.unitName, factor: "" }] },
        unitId: line.unitId,
        quantity: line.quantity,
        discountPercent: line.discountPercent,
        price: { price: line.listPrice, priceListCode: line.priceListCode, includesVat: line.priceIncludesVat, vatRate: line.vatRate },
      })) ?? [],
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const channel = channelId || choices.channels[0]?.id || "";
  const warehouse = warehouseId || choices.warehouses[0]?.id || "";

  async function priceOf(line: Line): Promise<SalesPriceResponse | null> {
    if (!channel) return null;
    const parameters = new URLSearchParams({ variantId: line.item.variantId, unitId: line.unitId, channelId: channel, date: orderDate, ...(customerId ? { customerId } : {}) });
    return apiFetch<SalesPriceResponse>(`/sales/price?${parameters}`).catch(() => null);
  }
  // Giá đổi theo kênh, khách (nhóm khách), ngày đơn.
  useEffect(() => {
    void Promise.all(lines.map((line) => priceOf(line))).then((prices) => setLines((current) => current.map((line, index) => ({ ...line, price: prices[index] ?? null }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, customerId, orderDate]);

  const setLine = async (index: number, change: Partial<Line>) => {
    const next = { ...lines[index]!, ...change };
    if (change.unitId) next.price = await priceOf(next);
    setLines((current) => current.map((line, position) => (position === index ? next : line)));
  };
  const lineTotal = (line: Line) => {
    if (!line.price?.price) return 0;
    const amount = Number(line.quantity || 0) * Number(line.price.price) * (1 - Number(line.discountPercent || 0) / 100);
    const rate = ["0", "5", "8", "10"].includes(line.price.vatRate) ? Number(line.price.vatRate) / 100 : 0;
    return line.price.includesVat ? amount : amount * (1 + rate);
  };
  const total = lines.reduce((sum, line) => sum + lineTotal(line), 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveSalesOrderRequest = {
        customerId: customerId || null,
        buyerName: customerId ? "" : buyerName,
        channelId: channel,
        warehouseId: warehouse,
        orderDate,
        deliveryAddress,
        note,
        lines: lines.map((line) => ({ variantId: line.item.variantId, unitId: line.unitId, quantity: line.quantity, discountPercent: line.discountPercent || "0" })),
        ...(order ? { version: order.version } : {}),
      };
      onSaved(await apiFetch<SalesOrderResponse>(order ? `/sales/orders/${order.id}` : "/sales/orders", { method: order ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      <section className="the">
        <Field id="khach-hang" label={t("customer")} hint={t("customerHint")} error={fields.customerId}>
          <select id="khach-hang" className={inputClass("customerId")} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">{t("walkIn")}</option>
            {choices.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.code} · {customer.name}
              </option>
            ))}
          </select>
        </Field>
        {!customerId && (
          <Field id="ten-nguoi-mua" label={t("buyerName")} error={fields.buyerName}>
            <input id="ten-nguoi-mua" className={inputClass("buyerName")} value={buyerName} onChange={(event) => setBuyerName(event.target.value)} />
          </Field>
        )}
        <Field id="kenh-ban" label={`${t("channel")} *`} error={fields.channelId}>
          <select id="kenh-ban" className={inputClass("channelId")} value={channel} onChange={(event) => setChannelId(event.target.value)}>
            {choices.channels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="kho-xuat" label={`${t("warehouse")} *`} error={fields.warehouseId}>
          <select id="kho-xuat" className={inputClass("warehouseId")} value={warehouse} onChange={(event) => setWarehouseId(event.target.value)}>
            {choices.warehouses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ngay-don" label={`${t("orderDate")} *`} error={fields.orderDate}>
          <input id="ngay-don" className={inputClass("orderDate")} type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
        </Field>
        <Field id="dia-chi-giao" label={t("deliveryAddress")} error={fields.deliveryAddress}>
          <input id="dia-chi-giao" className={inputClass("deliveryAddress")} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} />
        </Field>
        <Field id="ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu" className={inputClass("note")} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </section>
      <h2 style={{ margin: 0 }}>{t("lines")}</h2>
      {lines.map((line, index) => (
        <fieldset key={index} className="the" style={{ margin: 0 }}>
          <legend className="an-nhan">{itemLabel(line.item)}</legend>
          <strong>{itemLabel(line.item)}</strong>
          {fields[`lines.${index}.variantId`] && <span className="loi-o">{fields[`lines.${index}.variantId`]}</span>}
          <span className="chu-thich">
            {line.price?.price
              ? t("priceFrom", { price: formatMoney(line.price.price, choices.currency), list: line.price.priceListCode ?? "", vat: line.price.includesVat ? t("includesVat") : t("excludesVat") })
              : t("noPrice")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--khoang-3)" }}>
            <Field id={`don-vi-${index}`} label={t("unit")} error={fields[`lines.${index}.unitId`]}>
              <select id={`don-vi-${index}`} className={inputClass(`lines.${index}.unitId`)} value={line.unitId} onChange={(event) => void setLine(index, { unitId: event.target.value })}>
                {line.item.units.map((unit) => (
                  <option key={unit.unitId} value={unit.unitId}>
                    {unit.unitName}
                    {unit.factor && unit.factor !== "1" ? ` (${unit.factor})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={`so-luong-${index}`} label={`${t("quantity")} *`} error={fields[`lines.${index}.quantity`]}>
              <input
                id={`so-luong-${index}`}
                className={inputClass(`lines.${index}.quantity`)}
                inputMode="decimal"
                value={line.quantity}
                onChange={(event) => void setLine(index, { quantity: event.target.value })}
              />
            </Field>
            <Field id={`chiet-khau-${index}`} label={t("discountPercent")} error={fields[`lines.${index}.discountPercent`]}>
              <input
                id={`chiet-khau-${index}`}
                className={inputClass(`lines.${index}.discountPercent`)}
                inputMode="decimal"
                value={line.discountPercent}
                onChange={(event) => void setLine(index, { discountPercent: event.target.value })}
              />
            </Field>
            <Field id={`thanh-tien-${index}`} label={t("lineTotal")}>
              <span id={`thanh-tien-${index}`}>{formatMoney(String(lineTotal(line)), choices.currency)}</span>
            </Field>
          </div>
          <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => setLines(lines.filter((_, position) => position !== index))}>
            {t("removeLine")}
          </button>
        </fieldset>
      ))}
      <Field id="them-mat-hang" label={t("addItem")}>
        <ItemPicker
          id="them-mat-hang"
          onPick={(item) => {
            const line: Line = { item, unitId: item.matchedUnitId ?? item.baseUnitId, quantity: "1", discountPercent: "0", price: null };
            setLines((current) => [...current, line]);
            void priceOf(line).then((price) => setLines((current) => current.map((candidate) => (candidate === line ? { ...line, price } : candidate))));
          }}
        />
      </Field>
      <strong>
        {t("totalEstimate")}: {formatMoney(String(total), choices.currency)}
      </strong>
      <div className="chu-thich">{t("promotionHint")}</div>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className="nut chinh" disabled={submitting}>
          {common("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {common("cancel")}
        </button>
      </div>
    </form>
  );
}
