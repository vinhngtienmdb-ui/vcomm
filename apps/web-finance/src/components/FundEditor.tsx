"use client";

// Thêm, sửa quỹ (MAN_HINH_46; QUYTAC_NGHIEPVU_85): loại tiền mặt, ngân hàng; số dư đầu khóa khi quỹ đã có phiếu.
import type { FundKind, FundResponse, SaveFundRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";

export function FundEditor({ fund, onSaved, onCancel }: { fund: FundResponse | null; onSaved: (saved: FundResponse) => void; onCancel: () => void }) {
  const t = useTranslations("funds");
  const [code, setCode] = useState(fund?.code ?? "");
  const [name, setName] = useState(fund?.name ?? "");
  const [kind, setKind] = useState<FundKind>(fund?.kind ?? "cash");
  const [bankName, setBankName] = useState(fund?.bankName ?? "");
  const [accountNo, setAccountNo] = useState(fund?.accountNo ?? "");
  const [accountHolder, setAccountHolder] = useState(fund?.accountHolder ?? "");
  const [openingBalance, setOpeningBalance] = useState(fund?.openingBalance ?? "0");
  const [active, setActive] = useState(fund ? fund.status === "active" : true);
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveFundRequest = { code, name, kind, bankName, accountNo, accountHolder, openingBalance, status: active ? "active" : "inactive", ...(fund ? { version: fund.version } : {}) };
      onSaved(await apiFetch<FundResponse>(fund ? `/finance/funds/${fund.id}` : "/finance/funds", { method: fund ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }
  const text = (id: string, label: string, value: string, setter: (value: string) => void, field: string, numeric = false, disabled = false) => (
    <Field id={id} label={label} error={fields[field]}>
      <input id={id} className={inputClass(field)} inputMode={numeric ? "decimal" : undefined} value={value} disabled={disabled} onChange={(event) => setter(event.target.value)} />
    </Field>
  );
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
        {text("ma-quy", `${t("code")} *`, code, setCode, "code")}
        {text("ten-quy", `${t("name")} *`, name, setName, "name")}
        <Field id="loai-quy" label={`${t("kind")} *`} error={fields.kind}>
          <select id="loai-quy" className={inputClass("kind")} value={kind} onChange={(event) => setKind(event.target.value as FundKind)}>
            <option value="cash">{t("kind_cash")}</option>
            <option value="bank">{t("kind_bank")}</option>
          </select>
        </Field>
        {text("so-du-dau", t("openingBalance"), openingBalance, setOpeningBalance, "openingBalance", true, Boolean(fund?.hasPostings))}
      </div>
      {kind === "bank" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
          {text("ten-ngan-hang", `${t("bankName")} *`, bankName, setBankName, "bankName")}
          {text("so-tai-khoan", `${t("accountNo")} *`, accountNo, setAccountNo, "accountNo")}
          {text("chu-tai-khoan", t("accountHolder"), accountHolder, setAccountHolder, "accountHolder")}
        </div>
      )}
      {fund && (
        <label>
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> {t("activeLabel")}
        </label>
      )}
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
