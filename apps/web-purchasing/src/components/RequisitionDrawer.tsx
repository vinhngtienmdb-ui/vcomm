"use client";

// Lập, sửa đề nghị mua (CHUC_NANG_50): kho nhận, ngày cần, lý do, dòng hàng, nhà cung cấp đề xuất.
import type { PurchasingOptionsResponse, RequisitionResponse, SaveRequisitionRequest, StockItemOption } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ItemPicker, itemLabel } from "@/components/ItemPicker";

type Line = {
  item: { variantId: string; sku: string; productName: string; optionValues: string[]; units: StockItemOption["units"] };
  unitId: string;
  quantity: string;
  estimatedUnitPrice: string;
  suggestedSupplierId: string;
  note: string;
};

export function RequisitionDrawer({ requisition, onClose, onSaved }: { requisition: RequisitionResponse | null; onClose: () => void; onSaved: (saved: RequisitionResponse) => void }) {
  const t = useTranslations("requisitions");
  const common = useTranslations("common");
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const choices = options.state.kind === "ready" ? options.state.data : { suppliers: [], warehouses: [], currency: "VND" };
  const [warehouseId, setWarehouseId] = useState(requisition?.warehouseId ?? "");
  const [neededBy, setNeededBy] = useState(requisition?.neededBy ?? vietnamToday());
  const [reason, setReason] = useState(requisition?.reason ?? "");
  const [lines, setLines] = useState<Line[]>(
    requisition?.lines.map((line) => ({
      item: { ...line, units: [{ unitId: line.unitId, unitName: line.unitName, factor: "" }] },
      unitId: line.unitId,
      quantity: line.quantity,
      estimatedUnitPrice: line.estimatedUnitPrice,
      suggestedSupplierId: line.suggestedSupplierId ?? "",
      note: line.note ?? "",
    })) ?? [],
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const setLine = (index: number, change: Partial<Line>) => setLines(lines.map((line, position) => (position === index ? { ...line, ...change } : line)));

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveRequisitionRequest = {
        warehouseId: warehouseId || choices.warehouses[0]?.id || "",
        neededBy,
        reason,
        lines: lines.map((line) => ({
          variantId: line.item.variantId,
          unitId: line.unitId,
          quantity: line.quantity,
          estimatedUnitPrice: line.estimatedUnitPrice.replace(/\./g, "") || null,
          suggestedSupplierId: line.suggestedSupplierId || null,
          note: line.note,
        })),
        ...(requisition ? { version: requisition.version } : {}),
      };
      onSaved(
        await apiFetch<RequisitionResponse>(requisition ? `/purchasing/requisitions/${requisition.id}` : "/purchasing/requisitions", {
          method: requisition ? "PATCH" : "POST",
          body: JSON.stringify(body),
        }),
      );
    });
  }

  return (
    <Drawer title={requisition ? t("edit") : t("add")} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--khoang-4)" }}>
        <Field id="kho-nhan" label={`${t("warehouse")} *`} error={fields.warehouseId}>
          <select id="kho-nhan" className={inputClass("warehouseId")} value={warehouseId || choices.warehouses[0]?.id || ""} onChange={(event) => setWarehouseId(event.target.value)}>
            {choices.warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code} · {warehouse.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="ngay-can" label={`${t("neededBy")} *`} error={fields.neededBy}>
          <input id="ngay-can" className={inputClass("neededBy")} type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} />
        </Field>
        <Field id="ly-do" label={`${t("reason")} *`} error={fields.reason}>
          <input id="ly-do" className={inputClass("reason")} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <h3 style={{ margin: 0 }}>{t("lines")}</h3>
        {lines.map((line, index) => (
          <fieldset key={index} className="the" style={{ margin: 0 }}>
            <legend className="an-nhan">{itemLabel(line.item)}</legend>
            <strong>{itemLabel(line.item)}</strong>
            <Field id={`don-vi-${index}`} label={t("unit")} error={fields[`lines.${index}.unitId`]}>
              <select id={`don-vi-${index}`} className={inputClass(`lines.${index}.unitId`)} value={line.unitId} onChange={(event) => setLine(index, { unitId: event.target.value })}>
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
              />
            </Field>
            <Field id={`gia-uoc-tinh-${index}`} label={t("estimatedUnitPrice")} error={fields[`lines.${index}.estimatedUnitPrice`]}>
              <input
                id={`gia-uoc-tinh-${index}`}
                className={inputClass(`lines.${index}.estimatedUnitPrice`)}
                inputMode="numeric"
                value={line.estimatedUnitPrice}
                onChange={(event) => setLine(index, { estimatedUnitPrice: event.target.value })}
              />
            </Field>
            <Field id={`nha-cung-cap-${index}`} label={t("suggestedSupplier")} error={fields[`lines.${index}.suggestedSupplierId`]}>
              <select
                id={`nha-cung-cap-${index}`}
                className={inputClass(`lines.${index}.suggestedSupplierId`)}
                value={line.suggestedSupplierId}
                onChange={(event) => setLine(index, { suggestedSupplierId: event.target.value })}
              >
                <option value="">{common("none")}</option>
                {choices.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <button type="button" className="nut chu" onClick={() => setLines(lines.filter((_, position) => position !== index))}>
              {t("removeLine")}
            </button>
          </fieldset>
        ))}
        <Field id="them-mat-hang" label={t("addItem")} error={fields.lines}>
          <ItemPicker
            id="them-mat-hang"
            onPick={(item) =>
              setLines([
                ...lines,
                { item, unitId: item.matchedUnitId ?? item.units[item.units.length - 1]?.unitId ?? item.baseUnitId, quantity: "", estimatedUnitPrice: "", suggestedSupplierId: "", note: "" },
              ])
            }
          />
        </Field>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="submit" className="nut chinh" disabled={submitting}>
            {common("save")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
