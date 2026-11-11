"use client";

// Soạn đơn mua (CHUC_NANG_51): nhà cung cấp, kho nhận, ngày, dòng hàng; giá gợi ý theo bảng giá mua; lấy dòng từ đề nghị mua đã duyệt.
import {
  vatRates,
  type CurrencyResponse,
  type PurchaseOrderResponse,
  type PurchasingOptionsResponse,
  type RequisitionResponse,
  type SavePurchaseOrderRequest,
  type StockItemOption,
  type SupplierPriceLookupResponse,
  type VatRate,
} from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatMoney, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ItemPicker, itemLabel } from "@/components/ItemPicker";

type Line = {
  id?: string;
  item: { variantId: string; sku: string; productName: string; optionValues: string[]; units: StockItemOption["units"] };
  unitId: string;
  quantity: string;
  unitPrice: string;
  vatRate: VatRate;
  requisitionLineId: string | null;
  // Đã nhận theo đơn vị cơ sở: dòng đã nhận thì không bỏ, không đổi mặt hàng.
  received: number;
};

const toLines = (order: PurchaseOrderResponse): Line[] =>
  order.lines.map((line) => ({
    id: line.id,
    item: { ...line, units: [{ unitId: line.unitId, unitName: line.unitName, factor: line.factor }] },
    unitId: line.unitId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    vatRate: line.vatRate,
    requisitionLineId: line.requisitionLineId,
    received: Number(line.receivedBaseQuantity),
  }));

// Dòng còn đặt được của đề nghị, quy về đơn vị của dòng đề nghị.
const fromRequisition = (requisition: RequisitionResponse): Line[] =>
  requisition.lines
    .filter((line) => Number(line.baseQuantity) > Number(line.orderedBaseQuantity))
    .map((line) => {
      const factor = Number(line.baseQuantity) / Number(line.quantity);
      return {
        item: { ...line, units: [{ unitId: line.unitId, unitName: line.unitName, factor: String(factor) }] },
        unitId: line.unitId,
        quantity: String(Number(((Number(line.baseQuantity) - Number(line.orderedBaseQuantity)) / factor).toFixed(4))),
        unitPrice: line.estimatedUnitPrice,
        vatRate: "10" as VatRate,
        requisitionLineId: line.id,
        received: 0,
      };
    });

export function OrderEditor({
  order,
  requisition,
  onSaved,
  onCancel,
}: {
  order: PurchaseOrderResponse | null;
  requisition: RequisitionResponse | null;
  onSaved: (saved: PurchaseOrderResponse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("orders");
  const common = useTranslations("common");
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const choices = options.state.kind === "ready" ? options.state.data : { suppliers: [], warehouses: [], currency: "VND" };
  const firstSupplier = requisition?.lines.find((line) => line.suggestedSupplierId)?.suggestedSupplierId ?? "";
  const [supplierId, setSupplierId] = useState(order?.supplierId ?? firstSupplier);
  const [warehouseId, setWarehouseId] = useState(order?.warehouseId ?? requisition?.warehouseId ?? "");
  const [orderDate, setOrderDate] = useState(order?.orderDate ?? vietnamToday());
  const [expectedDate, setExpectedDate] = useState(order?.expectedDate ?? requisition?.neededBy ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  // Đơn nhập khẩu (CONG_VIEC_45; QUYTAC_NGHIEPVU_285): chọn ngoại tệ, thuế suất dòng là "Không kê khai", không gợi ý giá khi khác tiền tệ công ty.
  const [isImport, setIsImport] = useState(order?.isImport ?? false);
  const [currency, setCurrency] = useState(order?.currency ?? "");
  const currencies = useApi<CurrencyResponse[]>("/currencies");
  const orderCurrency = isImport && currency ? currency : choices.currency;
  const foreign = orderCurrency !== choices.currency;
  // Tiền tệ công ty viết dấu chấm phân cách hàng nghìn; ngoại tệ dùng dấu chấm thập phân.
  const plainPrice = (value: string) => (foreign ? value.replace(/,/g, "") : value.replace(/\./g, ""));
  const [lines, setLines] = useState<Line[]>(order ? toLines(order) : requisition ? fromRequisition(requisition) : []);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const setLine = (index: number, change: Partial<Line>) => setLines((current) => current.map((line, position) => (position === index ? { ...line, ...change } : line)));
  // Nhà cung cấp nội bộ (CONG_VIEC_09): giá, thuế suất theo bảng giá Nội bộ bên bán, không sửa tay.
  const [internalSupplier, setInternalSupplier] = useState(false);

  // Giá gợi ý: dòng chưa có giá lấy theo bảng giá mua khi đổi nhà cung cấp, đơn vị, số lượng.
  async function suggest(index: number, line: Line) {
    if (!supplierId || !line.quantity || foreign) return;
    const parameters = new URLSearchParams({ supplierId, variantId: line.item.variantId, unitId: line.unitId, quantity: line.quantity, date: orderDate });
    const found = await apiFetch<SupplierPriceLookupResponse>(`/purchasing/supplier-prices/lookup?${parameters}`).catch(() => null);
    setInternalSupplier(Boolean(found?.internal));
    if (found?.internal) setLine(index, { unitPrice: found.unitPrice ? String(Number(found.unitPrice)) : "", vatRate: found.internal.vatRate });
    else if (found?.unitPrice) setLine(index, { unitPrice: found.unitPrice });
  }
  useEffect(() => {
    if (order) return;
    lines.forEach((line, index) => void suggest(index, line));
    // Chỉ gợi ý lại khi đổi nhà cung cấp hoặc ngày đơn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId, orderDate]);

  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(plainPrice(line.unitPrice) || 0), 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePurchaseOrderRequest = {
        supplierId,
        warehouseId: warehouseId || choices.warehouses[0]?.id || "",
        orderDate,
        expectedDate: expectedDate || null,
        note,
        isImport,
        currency: isImport ? orderCurrency : null,
        lines: lines.map((line) => ({
          ...(line.id ? { id: line.id } : {}),
          variantId: line.item.variantId,
          unitId: line.unitId,
          quantity: line.quantity,
          unitPrice: plainPrice(line.unitPrice),
          vatRate: isImport ? "not_declared" : line.vatRate,
          requisitionLineId: line.requisitionLineId,
        })),
        ...(order ? { version: order.version } : {}),
      };
      onSaved(await apiFetch<PurchaseOrderResponse>(order ? `/purchasing/orders/${order.id}` : "/purchasing/orders", { method: order ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
      {order?.status === "approved" && <div className="khoi-canh-bao thong-tin">{t("reapproveHint")}</div>}
      <section className="the">
        <Field id="nha-cung-cap" label={`${t("supplier")} *`} error={fields.supplierId}>
          <select id="nha-cung-cap" className={inputClass("supplierId")} value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{t("choose")}</option>
            {choices.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.code} · {supplier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="kho-nhan" label={`${t("warehouse")} *`} error={fields.warehouseId}>
          <select
            id="kho-nhan"
            className={inputClass("warehouseId")}
            value={warehouseId || choices.warehouses[0]?.id || ""}
            disabled={order?.status === "approved"}
            onChange={(event) => setWarehouseId(event.target.value)}
          >
            {choices.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ngay-don" label={`${t("orderDate")} *`} error={fields.orderDate}>
          <input id="ngay-don" className={inputClass("orderDate")} type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
        </Field>
        <Field id="ngay-giao" label={t("expectedDate")} error={fields.expectedDate}>
          <input id="ngay-giao" className={inputClass("expectedDate")} type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
        </Field>
        <label className="nhom-nut" style={{ alignItems: "center" }}>
          <input type="checkbox" checked={isImport} disabled={order?.currencyLocked} onChange={(event) => setIsImport(event.target.checked)} />
          {t("isImport")}
        </label>
        {isImport && (
          <Field id="tien-te" label={t("currency")} error={fields.currency ?? fields.isImport} hint={t("currencyHint")}>
            <select id="tien-te" className={inputClass("currency")} value={orderCurrency} disabled={order?.currencyLocked} onChange={(event) => setCurrency(event.target.value)}>
              {(currencies.state.kind === "ready" ? currencies.state.data : [{ code: choices.currency, nameVi: choices.currency, nameEn: choices.currency, minorUnits: 0 }]).map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} · {option.nameVi}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="ghi-chu" label={t("note")} error={fields.note}>
          <textarea id="ghi-chu" className={inputClass("note")} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </section>
      <h2 style={{ margin: 0 }}>{t("lines")}</h2>
      {internalSupplier && <div className="khoi-canh-bao thong-tin">{t("internalPriceHint")}</div>}
      {fields.lines && <div className="khoi-canh-bao loi">{fields.lines}</div>}
      {lines.map((line, index) => (
        <fieldset key={line.id ?? `moi-${index}`} className="the" style={{ margin: 0 }}>
          <legend className="an-nhan">{itemLabel(line.item)}</legend>
          <span className="nhom-nut" style={{ justifyContent: "space-between" }}>
            <strong>{itemLabel(line.item)}</strong>
            {line.requisitionLineId && <span className="nhan thong-tin">{t("fromRequisition")}</span>}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--khoang-3)" }}>
            <Field id={`don-vi-${index}`} label={t("unit")} error={fields[`lines.${index}.unitId`] ?? fields[`lines.${index}.variantId`]}>
              <select
                id={`don-vi-${index}`}
                className={inputClass(`lines.${index}.unitId`)}
                value={line.unitId}
                disabled={line.received > 0}
                onChange={(event) => setLine(index, { unitId: event.target.value })}
              >
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
                onChange={(event) => setLine(index, { quantity: event.target.value })}
                onBlur={() => void suggest(index, line)}
              />
            </Field>
            <Field id={`don-gia-${index}`} label={`${t("unitPrice")} *`} error={fields[`lines.${index}.unitPrice`]}>
              <input
                id={`don-gia-${index}`}
                className={inputClass(`lines.${index}.unitPrice`)}
                inputMode={foreign ? "decimal" : "numeric"}
                value={line.unitPrice}
                readOnly={internalSupplier}
                onChange={(event) => setLine(index, { unitPrice: event.target.value })}
              />
            </Field>
            <Field id={`thue-${index}`} label={t("vatRate")}>
              <select
                id={`thue-${index}`}
                className="o-nhap"
                value={isImport ? "not_declared" : line.vatRate}
                disabled={internalSupplier || isImport}
                onChange={(event) => setLine(index, { vatRate: event.target.value as VatRate })}
              >
                {vatRates.map((rate) => (
                  <option key={rate} value={rate}>
                    {t(`vat_${rate}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {line.received === 0 && (
            <button type="button" className="nut chu" style={{ justifySelf: "start" }} onClick={() => setLines(lines.filter((_, position) => position !== index))}>
              {t("removeLine")}
            </button>
          )}
        </fieldset>
      ))}
      <Field id="them-mat-hang" label={t("addItem")}>
        <ItemPicker
          id="them-mat-hang"
          onPick={(item) => {
            const line: Line = {
              item,
              unitId: item.matchedUnitId ?? item.units[item.units.length - 1]?.unitId ?? item.baseUnitId,
              quantity: "1",
              unitPrice: "",
              vatRate: "10",
              requisitionLineId: null,
              received: 0,
            };
            setLines([...lines, line]);
            void suggest(lines.length, line);
          }}
        />
      </Field>
      <strong>
        {t("total")}: {formatMoney(String(total), orderCurrency)}
      </strong>
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
