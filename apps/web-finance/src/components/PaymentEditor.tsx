"use client";

// MAN_HINH_49 Soạn phiếu thu, phiếu chi (CHUC_NANG_67; QUYTAC_NGHIEPVU_88): loại, đối tác, quỹ, số tiền; chọn chứng từ còn nợ và số trừ (mặc định cũ nhất trước); hoàn tiền không vượt trả trước.
// CONG_VIEC_56 (QUYTAC_NGHIEPVU_409 đến 411): phiếu chi trả nợ ngoại tệ chọn tiền tệ, nhập số ngoại tệ trả từng khoản; quỹ tiền tệ công ty thì nhập tỷ giá ngân hàng bán; xem trước chênh lệch tỷ giá.
import {
  paymentKindIsReceipt,
  paymentKinds,
  paymentKindSettles,
  paymentKindSide,
  type OpenDebtsResponse,
  type PaymentFxPreviewResponse,
  type PaymentKind,
  type PaymentOptionsResponse,
  type PaymentResponse,
  type SavePaymentRequest,
} from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PartnerPicker } from "@/components/PartnerPicker";

type Partner = { id: string; label: string };
const round = (value: number) => Math.round(value * 10000) / 10000;

// Chia số tiền vào các chứng từ theo thứ tự cũ nhất trước.
function oldestFirst(open: OpenDebtsResponse["items"], amount: string): Record<string, string> {
  let remaining = Number(amount) || 0;
  const result: Record<string, string> = {};
  for (const item of open) {
    const value = round(Math.min(remaining, Number(item.foreign ? item.foreign.openAmount : item.openAmount)));
    result[item.id] = value > 0 ? String(value) : "";
    remaining = round(remaining - Math.max(value, 0));
  }
  return result;
}

export function PaymentEditor({
  payment,
  initialKind,
  initialPartner,
  onSaved,
  onCancel,
}: {
  payment: PaymentResponse | null;
  initialKind: PaymentKind;
  initialPartner: Partner | null;
  onSaved: (saved: PaymentResponse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("payments");
  const options = useApi<PaymentOptionsResponse>("/finance/payments/options");
  const choices = options.state.kind === "ready" ? options.state.data : { funds: [], currency: "VND" };
  const money = (value: string) => formatMoney(value, choices.currency);
  const [kind, setKind] = useState<PaymentKind>((payment?.kind as PaymentKind | undefined) ?? initialKind);
  const [partner, setPartner] = useState<Partner | null>(payment?.partner ? { id: payment.partner.id, label: `${payment.partner.code} · ${payment.partner.name}` } : initialPartner);
  const [fundId, setFundId] = useState(payment?.fund.id ?? "");
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate ?? vietnamToday());
  const [amount, setAmount] = useState(payment?.amount ?? "");
  const [note, setNote] = useState(payment?.note ?? "");
  // Tiền tệ phiếu: tiền tệ công ty hoặc ngoại tệ của khoản nợ (chỉ phiếu chi trả nhà cung cấp).
  const [currency, setCurrency] = useState(payment?.foreign?.currency ?? "");
  const [exchangeRate, setExchangeRate] = useState(payment?.foreign?.exchangeRate ?? "");
  const [allocations, setAllocations] = useState<Record<string, string>>(Object.fromEntries((payment?.lines ?? []).map((line) => [line.id, line.allocatedForeign ?? line.allocated])));
  const [preview, setPreview] = useState<PaymentFxPreviewResponse | null>(null);
  const side = paymentKindSide[kind];
  const settles = paymentKindSettles(kind);
  const open = useApi<OpenDebtsResponse>(partner ? `/finance/debts/open?side=${side}&partnerId=${partner.id}` : null);
  const openData = open.state.kind === "ready" ? open.state.data : null;
  const { submitting, fields, formError, run, inputClass } = useSubmit();
  const foreign = kind === "supplier_payment" && currency !== "" && currency !== choices.currency;
  const foreignCurrencies = [...new Set((openData?.items ?? []).flatMap((item) => (item.foreign ? [item.foreign.currency] : [])))];
  // Quỹ ngoại tệ chỉ dùng cho phiếu chi trả nợ cùng tiền tệ (QUYTAC_NGHIEPVU_406).
  const funds = choices.funds.filter((fund) => fund.fundCurrency === null || (foreign && fund.fundCurrency === currency));
  const selectedFund = choices.funds.find((fund) => fund.id === fundId);
  const fromBaseFund = foreign && selectedFund?.fundCurrency === null;

  useEffect(() => {
    if ((!fundId || !funds.some((fund) => fund.id === fundId)) && funds.length > 0) setFundId(funds[0]!.id);
  }, [funds, fundId]);

  const allocated = round(Object.values(allocations).reduce((total, value) => total + (Number(value) || 0), 0));
  const remainder = round((Number(amount) || 0) - allocated);

  function changeKind(next: PaymentKind) {
    if (paymentKindSide[next] !== side) setPartner(null);
    setAllocations({});
    setCurrency("");
    setPreview(null);
    setKind(next);
  }

  function changeCurrency(next: string) {
    setCurrency(next);
    setAllocations({});
    setPreview(null);
  }

  function body(): SavePaymentRequest {
    const chosen = Object.entries(allocations).filter(([, value]) => Number(value) > 0);
    return {
      kind,
      partnerId: partner?.id ?? "",
      fundId,
      paymentDate,
      note,
      ...(foreign
        ? {
            currency,
            exchangeRate: fromBaseFund ? exchangeRate : null,
            amount: fromBaseFund && amount ? amount : undefined,
            lines: chosen.map(([debitItemId, value]) => ({ debitItemId, foreignAmount: value })),
          }
        : { amount, lines: settles ? chosen.map(([debitItemId, value]) => ({ debitItemId, amount: value })) : [] }),
      ...(payment ? { version: payment.version } : {}),
    };
  }

  function showPreview() {
    void run(async () => {
      setPreview(await apiFetch<PaymentFxPreviewResponse>("/finance/payments/fx-preview", { method: "POST", body: JSON.stringify(body()) }));
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      onSaved(await apiFetch<PaymentResponse>(payment ? `/finance/payments/${payment.id}` : "/finance/payments", { method: payment ? "PATCH" : "POST", body: JSON.stringify(body()) }));
    });
  }

  const openItems = (openData?.items ?? []).filter((item) => (foreign ? item.foreign?.currency === currency : !item.foreign));
  const hiddenForeign = !foreign && (openData?.items ?? []).some((item) => item.foreign);
  // Phiếu đang sửa: chứng từ đã chọn có thể không còn trong danh sách còn nợ (đã trừ bởi phiếu khác) nhưng vẫn hiện để bỏ chọn.
  const selectedOnly = (payment?.lines ?? []).filter((line) => !openItems.some((item) => item.id === line.id));
  const headings = foreign
    ? [t("documentNo"), t("documentDate"), t("dueDate"), t("foreignOpen"), t("bookRate"), t("openAmount"), t("foreignAllocate")]
    : [t("documentNo"), t("documentDate"), t("dueDate"), t("openAmount"), t("allocate")];
  const foreignMoney = (value: string) => formatMoney(value, currency);
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="loai-phieu" label={`${t("kind")} *`} error={fields.kind}>
          <select id="loai-phieu" className={inputClass("kind")} value={kind} onChange={(event) => changeKind(event.target.value as PaymentKind)}>
            {paymentKinds.map((item) => (
              <option key={item} value={item}>
                {t(`kind_${item}`)}
              </option>
            ))}
          </select>
        </Field>
        {kind === "supplier_payment" && (
          <Field id="tien-te-phieu" label={t("currency")} error={fields.currency}>
            <select id="tien-te-phieu" className={inputClass("currency")} value={foreign ? currency : ""} onChange={(event) => changeCurrency(event.target.value)}>
              <option value="">{choices.currency}</option>
              {[...new Set([...foreignCurrencies, ...(foreign ? [currency] : [])])].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="quy-phieu" label={`${t("fund")} *`} error={fields.fundId}>
          <select
            id="quy-phieu"
            className={inputClass("fundId")}
            value={fundId}
            onChange={(event) => {
              setFundId(event.target.value);
              setPreview(null);
            }}
          >
            {funds.length === 0 && <option value="">{t("noFund")}</option>}
            {payment && !choices.funds.some((fund) => fund.id === payment.fund.id) && (
              <option value={payment.fund.id}>
                {payment.fund.code} · {payment.fund.name} ({t("fundInactive")})
              </option>
            )}
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.code} · {fund.name} ({fund.fundCurrency ? formatMoney(fund.foreignBalance ?? "0", fund.fundCurrency) : money(fund.balance)})
              </option>
            ))}
          </select>
        </Field>
        <Field id="ngay-phieu" label={`${t("paymentDate")} *`} error={fields.paymentDate}>
          <input id="ngay-phieu" type="date" className={inputClass("paymentDate")} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </Field>
        {foreign ? (
          fromBaseFund && (
            <>
              <Field id="ty-gia-phieu" label={`${t("bankSellRate")} *`} hint={t("bankSellRateHint")} error={fields.exchangeRate}>
                <input id="ty-gia-phieu" className={inputClass("exchangeRate")} inputMode="decimal" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} />
              </Field>
              <Field id="so-tien-phieu" label={t("paidAmount")} hint={t("paidAmountHint")} error={fields.amount}>
                <input id="so-tien-phieu" className={inputClass("amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </Field>
            </>
          )
        ) : (
          <Field id="so-tien-phieu" label={`${t("amount")} *`} error={fields.amount}>
            <input id="so-tien-phieu" className={inputClass("amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
        )}
      </div>
      <Field id="doi-tac-phieu" label={`${side === "receivable" ? t("customer") : t("supplier")} *`} hint={partner?.label} error={fields.partnerId}>
        <PartnerPicker
          id="doi-tac-phieu"
          side={side}
          invalid={Boolean(fields.partnerId)}
          onPick={(picked) => {
            setPartner({ id: picked.id, label: `${picked.code} · ${picked.name}` });
            setAllocations({});
          }}
        />
      </Field>
      {partner && openData && (
        <section style={{ display: "grid", gap: "var(--khoang-2)" }}>
          <span>
            {t("partnerAdvance")}: <strong>{money(openData.advance)}</strong>
          </span>
          {settles &&
            (openItems.length + selectedOnly.length === 0 ? (
              <span className="chu-thich">{t("noOpenDebts")}</span>
            ) : (
              <>
                <div className="nhom-nut">
                  <strong>{t("openDebts")}</strong>
                  {!foreign && (
                    <button type="button" className="nut phu" onClick={() => setAllocations(oldestFirst(openItems, amount))}>
                      {t("allocateOldest")}
                    </button>
                  )}
                </div>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {headings.map((heading) => (
                          <th key={heading} scope="col">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...openItems, ...selectedOnly].map((item) => (
                        <tr key={item.id}>
                          <td data-nhan={headings[0]}>
                            <span>{item.documentNo || t(`source_${item.sourceType}`)}</span>
                          </td>
                          <td data-nhan={headings[1]}>
                            <span>{formatDate(item.documentDate)}</span>
                          </td>
                          <td data-nhan={headings[2]}>
                            <span>
                              {formatDate(item.dueDate)}
                              {item.overdueDays > 0 && <span style={{ color: "var(--mau-loi)" }}> · {t("overdueDays", { days: item.overdueDays })}</span>}
                            </span>
                          </td>
                          {foreign && (
                            <>
                              <td data-nhan={t("foreignOpen")}>
                                <span style={{ whiteSpace: "nowrap" }}>{item.foreign ? foreignMoney(item.foreign.openAmount) : ""}</span>
                              </td>
                              <td data-nhan={t("bookRate")}>
                                <span>{item.foreign?.bookRate}</span>
                              </td>
                            </>
                          )}
                          <td data-nhan={t("openAmount")}>
                            <span style={{ whiteSpace: "nowrap" }}>{money(item.openAmount)}</span>
                          </td>
                          <td data-nhan={headings[headings.length - 1]}>
                            <input
                              aria-label={`${headings[headings.length - 1]} ${item.documentNo}`}
                              className="o-nhap"
                              inputMode="decimal"
                              value={allocations[item.id] ?? ""}
                              onChange={(event) => {
                                setAllocations({ ...allocations, [item.id]: event.target.value });
                                setPreview(null);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {Object.entries(fields)
                  .filter(([key]) => key.startsWith("lines."))
                  .map(([key, message]) => (
                    <span key={key} className="loi-o">
                      {message}
                    </span>
                  ))}
                {foreign ? (
                  <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                    <div className="nhom-nut">
                      <strong>{t("fxPreview")}</strong>
                      <button type="button" className="nut phu" disabled={submitting} onClick={showPreview}>
                        {t("preview")}
                      </button>
                    </div>
                    <span>
                      {t("foreignTotal")}: <strong>{foreignMoney(String(allocated))}</strong>
                    </span>
                    {preview && (
                      <dl className="thong-tin-dong">
                        <dt>{t("fundValue")}</dt>
                        <dd>
                          {money(preview.fundValue)}
                          {preview.fundRate && ` (${t("bookRate")} ${formatNumber(preview.fundRate, 2)})`}
                        </dd>
                        <dt>{t("bookTotal")}</dt>
                        <dd>{money(preview.bookTotal)}</dd>
                        <dt>{t("exchangeDifference")}</dt>
                        <dd>
                          <strong>
                            {Number(preview.exchangeDifference) > 0
                              ? t("exchangeGain", { amount: money(preview.exchangeDifference) })
                              : Number(preview.exchangeDifference) < 0
                                ? t("exchangeLoss", { amount: money(String(-Number(preview.exchangeDifference))) })
                                : t("exchangeNone")}
                          </strong>
                        </dd>
                      </dl>
                    )}
                    <span className="chu-thich">{t("fxPreviewHint")}</span>
                  </div>
                ) : (
                  <span>
                    {t("allocatedTotal")}: <strong>{money(String(allocated))}</strong> · {allocated === 0 ? t("autoOldest") : `${t("remainderAdvance")}: ${money(String(Math.max(remainder, 0)))}`}
                  </span>
                )}
              </>
            ))}
          {hiddenForeign && settles && <div className="khoi-canh-bao canh-bao">{t("foreignOnlyHint")}</div>}
          {!settles && <span className="chu-thich">{paymentKindIsReceipt(kind) ? t("supplierRefundHint") : t("customerRefundHint")}</span>}
        </section>
      )}
      <Field id="noi-dung-phieu" label={t("note")} error={fields.note}>
        <input id="noi-dung-phieu" className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
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
