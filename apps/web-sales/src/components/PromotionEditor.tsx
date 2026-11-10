"use client";

// MAN_HINH_45 (CONG_VIEC_12): soạn chương trình khuyến mãi theo loại; điều kiện kênh, nhóm khách; ngân sách, số suất (API_83).
import { promotionKinds, type PromotionKind, type PromotionOptionsResponse, type PromotionResponse, type SavePromotionRequest, type StockItemOption } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { ItemPicker, itemLabel } from "@/components/ItemPicker";

type Picked = { variantId: string; label: string };
const pickedOf = (item: StockItemOption): Picked => ({ variantId: item.variantId, label: itemLabel(item) });

export function PromotionEditor({ promotion, onSaved, onCancel }: { promotion: PromotionResponse | null; onSaved: (saved: PromotionResponse) => void; onCancel: () => void }) {
  const t = useTranslations("promotions");
  const options = useApi<PromotionOptionsResponse>("/sales/promotions/options");
  const choices = options.state.kind === "ready" ? options.state.data : { channels: [], customerGroups: [], currency: "VND" };
  const [name, setName] = useState(promotion?.name ?? "");
  const [kind, setKind] = useState<PromotionKind>(promotion?.kind ?? "product_discount");
  const [validFrom, setValidFrom] = useState(promotion?.validFrom ?? vietnamToday());
  const [validTo, setValidTo] = useState(promotion?.validTo ?? vietnamToday());
  const [channelIds, setChannelIds] = useState<string[]>(promotion?.channels.map((channel) => channel.id) ?? []);
  const [groupIds, setGroupIds] = useState<string[]>(promotion?.customerGroups.map((group) => group.id) ?? []);
  const [items, setItems] = useState<(Picked & { discountPercent: string })[]>(
    promotion?.items.map((item) => ({ variantId: item.variantId, label: `${item.sku} · ${item.productName}`, discountPercent: item.discountPercent })) ?? [],
  );
  const [minOrderAmount, setMinOrderAmount] = useState(promotion?.minOrderAmount ?? "");
  const [orderDiscountPercent, setOrderDiscountPercent] = useState(promotion?.orderDiscountPercent ?? "");
  const [maxOrderDiscount, setMaxOrderDiscount] = useState(promotion?.maxOrderDiscount ?? "");
  const [buy, setBuy] = useState<Picked | null>(promotion?.buy ? { variantId: promotion.buy.variantId, label: `${promotion.buy.sku} · ${promotion.buy.productName}` } : null);
  const [buyQuantity, setBuyQuantity] = useState(promotion?.buy?.quantity ?? "");
  const [gift, setGift] = useState<Picked | null>(promotion?.gift ? { variantId: promotion.gift.variantId, label: `${promotion.gift.sku} · ${promotion.gift.productName}` } : null);
  const [giftQuantity, setGiftQuantity] = useState(promotion?.gift?.quantity ?? "");
  const [budgetAmount, setBudgetAmount] = useState(promotion?.budgetAmount ?? "");
  const [maxGiftSets, setMaxGiftSets] = useState(promotion?.maxGiftSets ? String(promotion.maxGiftSets) : "");
  const [note, setNote] = useState(promotion?.note ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const toggle = (list: string[], value: string, setter: (next: string[]) => void) => setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePromotionRequest = {
        name,
        kind,
        validFrom,
        validTo,
        channelIds,
        customerGroupIds: groupIds,
        items: kind === "product_discount" ? items.map((item) => ({ variantId: item.variantId, discountPercent: item.discountPercent })) : [],
        minOrderAmount,
        orderDiscountPercent,
        maxOrderDiscount,
        buyVariantId: buy?.variantId ?? null,
        buyQuantity,
        giftVariantId: gift?.variantId ?? null,
        giftQuantity,
        budgetAmount: kind === "buy_get" ? "" : budgetAmount,
        maxGiftSets: kind === "buy_get" && maxGiftSets ? Number(maxGiftSets) : null,
        note,
        ...(promotion ? { version: promotion.version } : {}),
      };
      const saved = await apiFetch<PromotionResponse>(promotion ? `/sales/promotions/${promotion.id}` : "/sales/promotions", {
        method: promotion ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      onSaved(saved);
    });
  }

  const text = (id: string, label: string, value: string, setter: (value: string) => void, field: string, numeric = true) => (
    <Field id={id} label={label} error={fields[field]}>
      <input id={id} className={inputClass(field)} inputMode={numeric ? "decimal" : undefined} value={value} onChange={(event) => setter(event.target.value)} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      {text("ten-khuyen-mai", `${t("name")} *`, name, setName, "name", false)}
      <Field id="loai-khuyen-mai" label={`${t("kind")} *`} error={fields.kind}>
        <select id="loai-khuyen-mai" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as PromotionKind)}>
          {promotionKinds.map((item) => (
            <option key={item} value={item}>
              {t(`kind_${item}`)}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="tu-ngay" label={`${t("validFrom")} *`} error={fields.validFrom}>
          <input id="tu-ngay" type="date" className={inputClass("validFrom")} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
        </Field>
        <Field id="den-ngay" label={`${t("validTo")} *`} error={fields.validTo}>
          <input id="den-ngay" type="date" className={inputClass("validTo")} value={validTo} onChange={(event) => setValidTo(event.target.value)} />
        </Field>
      </div>
      <Field id="kenh-ap-dung" label={t("channels")} hint={t("channelsHint")} error={fields.channelIds}>
        <span id="kenh-ap-dung" className="nhom-nut">
          {choices.channels.map((channel) => (
            <label key={channel.id}>
              <input type="checkbox" checked={channelIds.includes(channel.id)} onChange={() => toggle(channelIds, channel.id, setChannelIds)} /> {channel.name}
            </label>
          ))}
        </span>
      </Field>
      <Field id="nhom-khach-ap-dung" label={t("customerGroups")} hint={t("customerGroupsHint")} error={fields.customerGroupIds}>
        <span id="nhom-khach-ap-dung" className="nhom-nut">
          {choices.customerGroups.map((group) => (
            <label key={group.id}>
              <input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => toggle(groupIds, group.id, setGroupIds)} /> {group.name}
            </label>
          ))}
        </span>
      </Field>

      {kind === "product_discount" && (
        <section style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <strong>{t("items")}</strong>
          {fields.items && <span className="loi-o">{fields.items}</span>}
          {items.map((item, index) => (
            <div key={item.variantId} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--khoang-3)" }}>
              <span>
                {item.label}
                {fields[`items.${index}.variantId`] && <span className="loi-o"> {fields[`items.${index}.variantId`]}</span>}
              </span>
              <span className="nhom-nut">
                <Field id={`phan-tram-${index}`} label={t("discountPercent")} error={fields[`items.${index}.discountPercent`]}>
                  <input
                    id={`phan-tram-${index}`}
                    className={inputClass(`items.${index}.discountPercent`)}
                    inputMode="decimal"
                    value={item.discountPercent}
                    onChange={(event) => setItems(items.map((entry, position) => (position === index ? { ...entry, discountPercent: event.target.value } : entry)))}
                  />
                </Field>
                <button type="button" className="nut chu" onClick={() => setItems(items.filter((_, position) => position !== index))}>
                  {t("removeItem")}
                </button>
              </span>
            </div>
          ))}
          <Field id="them-mat-hang-km" label={t("addItem")}>
            <ItemPicker
              id="them-mat-hang-km"
              onPick={(picked) => {
                if (!items.some((item) => item.variantId === picked.variantId)) setItems([...items, { ...pickedOf(picked), discountPercent: "" }]);
              }}
            />
          </Field>
        </section>
      )}

      {kind === "order_discount" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--khoang-3)" }}>
          {text("nguong-don", `${t("minOrderAmount")} *`, minOrderAmount, setMinOrderAmount, "minOrderAmount")}
          {text("phan-tram-don", `${t("orderDiscountPercent")} *`, orderDiscountPercent, setOrderDiscountPercent, "orderDiscountPercent")}
          {text("tran-giam", t("maxOrderDiscount"), maxOrderDiscount, setMaxOrderDiscount, "maxOrderDiscount")}
        </div>
      )}

      {kind === "buy_get" && (
        <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <Field id="hang-mua" label={`${t("buyItem")} *`} hint={buy?.label} error={fields.buyVariantId}>
            <ItemPicker id="hang-mua" onPick={(picked) => setBuy(pickedOf(picked))} invalid={Boolean(fields.buyVariantId)} />
          </Field>
          {text("so-luong-mua", `${t("buyQuantity")} *`, buyQuantity, setBuyQuantity, "buyQuantity")}
          <Field id="hang-tang" label={`${t("giftItem")} *`} hint={gift?.label} error={fields.giftVariantId}>
            <ItemPicker id="hang-tang" onPick={(picked) => setGift(pickedOf(picked))} invalid={Boolean(fields.giftVariantId)} />
          </Field>
          {text("so-luong-tang", `${t("giftQuantity")} *`, giftQuantity, setGiftQuantity, "giftQuantity")}
          {text("so-suat", t("maxGiftSets"), maxGiftSets, setMaxGiftSets, "maxGiftSets")}
        </div>
      )}

      {kind !== "buy_get" && text("ngan-sach", t("budgetAmount", { currency: choices.currency }), budgetAmount, setBudgetAmount, "budgetAmount")}
      <Field id="ghi-chu-km" label={t("note")} error={fields.note}>
        <textarea id="ghi-chu-km" className={inputClass("note")} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <FormError text={formError} />
      <div className="nhom-nut">
        <button type="submit" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting}>
          {t("save")}
        </button>
        <button type="button" className="nut phu" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
