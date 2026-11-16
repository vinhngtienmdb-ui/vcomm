"use client";

// Điều khoản hợp đồng cửa hàng liên kết dùng chung cho MAN_HINH_178 thêm mới và chi tiết (CONG_VIEC_55; QUYTAC_NGHIEPVU_392).
import type { AffiliateMerchantStatus } from "contracts";
import { useTranslations } from "next-intl";
import { Field } from "ui/components/Form";
import { vietnamToday } from "ui/lib/format";

export const merchantStatusClass: Record<AffiliateMerchantStatus, string> = { draft: "trung-tinh", active: "thanh-cong", suspended: "canh-bao", terminated: "loi" };

export const defaultTerms = () => ({
  contractNo: "",
  startsOn: vietnamToday(),
  endsOn: "",
  earnPercent: "2",
  feePercent: "0",
  creditLimit: "",
  transactionCap: "",
  paymentTermDays: "7",
  autoConfirmDays: "3",
  smsFee: "0",
});
export type TermsForm = ReturnType<typeof defaultTerms>;
export const termsBody = (form: TermsForm) => ({
  contractNo: form.contractNo,
  startsOn: form.startsOn,
  endsOn: form.endsOn || null,
  earnPercent: form.earnPercent,
  feePercent: form.feePercent,
  creditLimit: form.creditLimit.replace(/[.\s]/g, ""),
  transactionCap: form.transactionCap.replace(/[.\s]/g, ""),
  paymentTermDays: Number(form.paymentTermDays),
  autoConfirmDays: Number(form.autoConfirmDays),
  smsFee: form.smsFee.replace(/[.\s]/g, "") || "0",
});

export function TermsFields({
  form,
  setForm,
  fields,
  inputClass,
  disabled,
}: {
  form: TermsForm;
  setForm: (form: TermsForm) => void;
  fields: Record<string, string>;
  inputClass: (key: string) => string;
  disabled?: boolean;
}) {
  const t = useTranslations("affiliate");
  const input = (key: keyof TermsForm, type = "text", hint?: string) => (
    <Field id={`dk-${key}`} label={t(`term_${key}`)} error={fields[key]} {...(hint ? { hint } : {})}>
      <input id={`dk-${key}`} type={type} className={inputClass(key)} value={form[key]} disabled={disabled} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
    </Field>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)", alignItems: "start" }}>
      {input("contractNo")}
      {input("startsOn", "date")}
      {input("endsOn", "date", t("endsOnHint"))}
      {input("earnPercent", "text", t("earnPercentHint"))}
      {input("feePercent", "text", t("feePercentHint"))}
      {input("creditLimit")}
      {input("transactionCap")}
      {input("paymentTermDays", "number")}
      {input("autoConfirmDays", "number")}
      {input("smsFee", "text", t("smsFeeHint"))}
    </div>
  );
}
