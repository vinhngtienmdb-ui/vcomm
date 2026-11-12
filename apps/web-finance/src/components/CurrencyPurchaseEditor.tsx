"use client";

// MAN_HINH_184 Phiếu mua ngoại tệ (CONG_VIEC_56; QUYTAC_NGHIEPVU_408; API_214): quỹ chi tiền tệ công ty, quỹ nhận ngoại tệ, số ngoại tệ, tỷ giá ngân hàng bán, số tiền chi.
import type { PaymentOptionsResponse, PaymentResponse, SaveCurrencyPurchaseRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatMoney, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export function CurrencyPurchaseEditor({ payment, onSaved, onCancel }: { payment: PaymentResponse | null; onSaved: (saved: PaymentResponse) => void; onCancel: () => void }) {
  const t = useTranslations("payments");
  const options = useApi<PaymentOptionsResponse>("/finance/payments/options");
  const choices = options.state.kind === "ready" ? options.state.data : { funds: [], currency: "VND" };
  const baseFunds = choices.funds.filter((fund) => fund.fundCurrency === null);
  const foreignFunds = choices.funds.filter((fund) => fund.fundCurrency !== null);
  const [fundId, setFundId] = useState(payment?.fund.id ?? "");
  const [counterFundId, setCounterFundId] = useState(payment?.foreign?.counterFund?.id ?? "");
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate ?? vietnamToday());
  const [foreignAmount, setForeignAmount] = useState(payment?.foreign?.amount ?? "");
  const [exchangeRate, setExchangeRate] = useState(payment?.foreign?.exchangeRate ?? "");
  const [amount, setAmount] = useState(payment?.amount ?? "");
  const [note, setNote] = useState(payment?.note ?? "");
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  useEffect(() => {
    if (!fundId && baseFunds.length > 0) setFundId(baseFunds[0]!.id);
    if (!counterFundId && foreignFunds.length > 0) setCounterFundId(foreignFunds[0]!.id);
  }, [baseFunds, foreignFunds, fundId, counterFundId]);

  const target = foreignFunds.find((fund) => fund.id === counterFundId);
  const computed = Number(foreignAmount) > 0 && Number(exchangeRate) > 0 ? String(Math.round(Number(foreignAmount) * Number(exchangeRate))) : "";

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveCurrencyPurchaseRequest = {
        fundId,
        counterFundId,
        paymentDate,
        foreignAmount,
        exchangeRate,
        ...(amount ? { amount } : {}),
        note,
        ...(payment ? { version: payment.version } : {}),
      };
      onSaved(
        await apiFetch<PaymentResponse>(payment ? `/finance/currency-purchases/${payment.id}` : "/finance/currency-purchases", { method: payment ? "PATCH" : "POST", body: JSON.stringify(body) }),
      );
    });
  }

  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="ngay-mua" label={`${t("paymentDate")} *`} error={fields.paymentDate}>
          <input id="ngay-mua" type="date" className={inputClass("paymentDate")} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </Field>
        <Field id="quy-chi" label={`${t("sourceFund")} *`} error={fields.fundId}>
          <select id="quy-chi" className={inputClass("fundId")} value={fundId} onChange={(event) => setFundId(event.target.value)}>
            {baseFunds.length === 0 && <option value="">{t("noFund")}</option>}
            {baseFunds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.code} · {fund.name} ({formatMoney(fund.balance, choices.currency)})
              </option>
            ))}
          </select>
        </Field>
        <Field id="quy-nhan" label={`${t("counterFund")} *`} error={fields.counterFundId}>
          <select id="quy-nhan" className={inputClass("counterFundId")} value={counterFundId} onChange={(event) => setCounterFundId(event.target.value)}>
            {foreignFunds.length === 0 && <option value="">{t("noFund")}</option>}
            {foreignFunds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.code} · {fund.name} ({formatMoney(fund.foreignBalance ?? "0", fund.fundCurrency!)})
              </option>
            ))}
          </select>
        </Field>
        <Field id="so-ngoai-te" label={`${t("foreignAmount")}${target ? ` (${target.fundCurrency})` : ""} *`} error={fields.foreignAmount}>
          <input id="so-ngoai-te" className={inputClass("foreignAmount")} inputMode="decimal" value={foreignAmount} onChange={(event) => setForeignAmount(event.target.value)} />
        </Field>
        <Field id="ty-gia-mua" label={`${t("bankSellRate")} *`} error={fields.exchangeRate}>
          <input id="ty-gia-mua" className={inputClass("exchangeRate")} inputMode="decimal" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} />
        </Field>
        <Field id="so-tien-chi" label={t("paidAmount")} hint={t("paidAmountHint")} error={fields.amount}>
          <input id="so-tien-chi" className={inputClass("amount")} inputMode="decimal" placeholder={computed} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
      </div>
      <Field id="noi-dung-mua" label={t("note")} error={fields.note}>
        <input id="noi-dung-mua" className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
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
