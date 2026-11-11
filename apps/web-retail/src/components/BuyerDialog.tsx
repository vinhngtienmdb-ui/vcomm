"use client";

// Người mua lấy hóa đơn (MAN_HINH_161; QUYTAC_NGHIEPVU_372): tên, mã số thuế, địa chỉ, số định danh cá nhân; máy chủ kiểm lại khi thanh toán.
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field } from "ui/components/Form";

export interface Buyer {
  name: string;
  taxCode: string;
  address: string;
  identityNo: string;
}

export function BuyerDialog({ buyer, onApply, onClose }: { buyer: Buyer; onApply: (buyer: Buyer) => void; onClose: () => void }) {
  const t = useTranslations("retailCounter");
  const common = useTranslations("common");
  const [value, setValue] = useState(buyer);
  const field = (key: keyof Buyer, label: string, maxLength: number, inputMode?: "numeric") => (
    <Field id={`nguoi-mua-${key}`} label={label}>
      <input
        id={`nguoi-mua-${key}`}
        className="o-nhap"
        maxLength={maxLength}
        inputMode={inputMode}
        autoFocus={key === "name"}
        value={value[key]}
        onChange={(event) => setValue({ ...value, [key]: event.target.value })}
      />
    </Field>
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    onApply({ name: value.name.trim(), taxCode: value.taxCode.trim(), address: value.address.trim(), identityNo: value.identityNo.trim() });
  }
  return (
    <div className="man-che giua" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <form className="hop-thoai" role="dialog" aria-modal="true" aria-label={t("invoiceBuyer")} onSubmit={submit}>
        <h2>{t("invoiceBuyer")}</h2>
        {field("name", t("buyerName"), 200)}
        {field("taxCode", t("buyerTaxCode"), 14)}
        {field("address", t("buyerAddress"), 400)}
        {field("identityNo", t("buyerIdentityNo"), 12, "numeric")}
        <span className="chu-thich">{t("buyerHint")}</span>
        <div className="nhom-nut" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="nut chu" onClick={() => onApply({ name: "", taxCode: "", address: "", identityNo: "" })}>
            {t("clearBuyer")}
          </button>
          <button type="button" className="nut phu" onClick={onClose}>
            {common("cancel")}
          </button>
          <button type="submit" className="nut chinh">
            {t("apply")}
          </button>
        </div>
      </form>
    </div>
  );
}
