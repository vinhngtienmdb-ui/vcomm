"use client";

// Biểu mẫu voucher cửa hàng (MAN_HINH_175; CONG_VIEC_55; QUYTAC_NGHIEPVU_401): loại (đổi bằng điểm, tặng miễn phí), mức giảm, điều kiện, số lượng, thời gian nhận, hạn dùng.
import type { AffiliateVoucherItem } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { vietnamToday } from "ui/lib/format";
import { portalFetch } from "@/lib/portal-api";

const digits = (value: string) => value.replace(/[^\d]/g, "");

export function VoucherForm({ voucher, onClose, onSaved }: { voucher: AffiliateVoucherItem | null; onClose: () => void; onSaved: (saved: AffiliateVoucherItem, submitted: boolean) => void }) {
  const t = useTranslations("affiliateVoucher");
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const today = vietnamToday();
  const [form, setForm] = useState({
    issuer: voucher?.issuer === "merchant_points" ? "merchant_points" : "merchant_free",
    titleVi: voucher?.titleVi ?? "",
    titleEn: voucher?.titleEn ?? "",
    discountKind: voucher?.discountKind ?? "amount",
    discountValue: voucher?.discountValue ?? "",
    maxDiscount: voucher?.discountKind === "percent" ? voucher.maxDiscount : "",
    minBill: voucher?.minBill ?? "0",
    totalQuantity: String(voucher?.totalQuantity ?? 100),
    perBuyerLimit: String(voucher?.perBuyerLimit ?? 1),
    pointsPrice: voucher?.pointsPrice ? String(voucher.pointsPrice) : "",
    claimFrom: voucher?.claimFrom ?? today,
    claimTo: voucher?.claimTo ?? today,
    validDays: String(voucher?.validDays ?? 30),
  });
  const set = (key: keyof typeof form, value: string) => setForm({ ...form, [key]: value });
  const input = (key: keyof typeof form, type = "text", hint?: string) => (
    <Field id={`v-${key}`} label={t(`field_${key}`)} error={fields[key]} {...(hint ? { hint } : {})}>
      <input id={`v-${key}`} type={type} className={inputClass(key)} value={form[key]} onChange={(event) => set(key, event.target.value)} />
    </Field>
  );
  const body = () => ({
    issuer: form.issuer,
    titleVi: form.titleVi,
    titleEn: form.titleEn,
    discountKind: form.discountKind,
    discountValue: digits(form.discountValue),
    maxDiscount: form.discountKind === "percent" ? digits(form.maxDiscount) || null : null,
    minBill: digits(form.minBill) || "0",
    totalQuantity: Number(form.totalQuantity),
    perBuyerLimit: Number(form.perBuyerLimit),
    pointsPrice: form.issuer === "merchant_points" ? Number(form.pointsPrice) || null : null,
    claimFrom: form.claimFrom,
    claimTo: form.claimTo,
    validDays: Number(form.validDays),
    ...(voucher ? { version: voucher.version } : {}),
  });
  const save = (submit: boolean) =>
    void run(async () => {
      let saved = await portalFetch<AffiliateVoucherItem>(voucher ? `/merchant-portal/vouchers/${voucher.id}` : "/merchant-portal/vouchers", {
        method: voucher ? "PUT" : "POST",
        body: JSON.stringify(body()),
      });
      if (submit) saved = await portalFetch<AffiliateVoucherItem>(`/merchant-portal/vouchers/${saved.id}/submit`, { method: "POST", body: JSON.stringify({ version: saved.version }) });
      onSaved(saved, submit);
    });
  return (
    <Drawer title={voucher ? t("editTitle", { code: voucher.code }) : t("createTitle")} onClose={onClose}>
      <form style={{ display: "grid", gap: "var(--khoang-3)" }} onSubmit={(event) => (event.preventDefault(), save(false))}>
        <Field id="v-issuer" label={t("field_issuer")}>
          <select id="v-issuer" className="o-nhap" value={form.issuer} onChange={(event) => set("issuer", event.target.value)}>
            <option value="merchant_points">{t("issuer_merchant_points")}</option>
            <option value="merchant_free">{t("issuer_merchant_free")}</option>
          </select>
        </Field>
        {input("titleVi")}
        {input("titleEn")}
        <Field id="v-discountKind" label={t("field_discountKind")}>
          <select id="v-discountKind" className="o-nhap" value={form.discountKind} onChange={(event) => set("discountKind", event.target.value)}>
            <option value="amount">{t("kind_amount")}</option>
            <option value="percent">{t("kind_percent")}</option>
          </select>
        </Field>
        {input("discountValue", "text", form.discountKind === "percent" ? t("percentHint") : undefined)}
        {form.discountKind === "percent" && input("maxDiscount")}
        {input("minBill")}
        {form.issuer === "merchant_points" && input("pointsPrice", "number", t("pointsPriceHint"))}
        {input("totalQuantity", "number")}
        {input("perBuyerLimit", "number")}
        {input("claimFrom", "date")}
        {input("claimTo", "date")}
        {input("validDays", "number", t("validDaysHint"))}
        <div className="khoi-canh-bao thong-tin">{t("approvalHint")}</div>
        <FormError text={formError} />
        <div className="nhom-nut">
          <button type="button" className="nut phu" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className="nut phu" disabled={submitting}>
            {t("saveDraft")}
          </button>
          <button type="button" className={`nut chinh${submitting ? " dang-xu-ly" : ""}`} disabled={submitting} onClick={() => save(true)}>
            {t("saveSubmit")}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
