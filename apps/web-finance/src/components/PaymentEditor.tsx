"use client";

// MAN_HINH_49 Soạn phiếu thu, phiếu chi (CHUC_NANG_67; QUYTAC_NGHIEPVU_88): loại, đối tác, quỹ, số tiền; chọn chứng từ còn nợ và số trừ (mặc định cũ nhất trước); hoàn tiền không vượt trả trước.
import {
  paymentKindIsReceipt,
  paymentKinds,
  paymentKindSettles,
  paymentKindSide,
  type OpenDebtsResponse,
  type PaymentKind,
  type PaymentOptionsResponse,
  type PaymentResponse,
  type SavePaymentRequest,
} from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PartnerPicker } from "@/components/PartnerPicker";

type Partner = { id: string; label: string };
const round = (value: number) => Math.round(value * 10000) / 10000;

// Chia số tiền vào các chứng từ theo thứ tự cũ nhất trước.
function oldestFirst(open: OpenDebtsResponse["items"], amount: string): Record<string, string> {
  let remaining = Number(amount) || 0;
  const result: Record<string, string> = {};
  for (const item of open) {
    const value = round(Math.min(remaining, Number(item.openAmount)));
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
  const [allocations, setAllocations] = useState<Record<string, string>>(Object.fromEntries((payment?.lines ?? []).map((line) => [line.id, line.allocated])));
  const side = paymentKindSide[kind];
  const settles = paymentKindSettles(kind);
  const open = useApi<OpenDebtsResponse>(partner ? `/finance/debts/open?side=${side}&partnerId=${partner.id}` : null);
  const openData = open.state.kind === "ready" ? open.state.data : null;
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  useEffect(() => {
    if (!fundId && choices.funds.length > 0) setFundId(choices.funds[0]!.id);
  }, [choices.funds, fundId]);

  const allocated = round(Object.values(allocations).reduce((total, value) => total + (Number(value) || 0), 0));
  const remainder = round((Number(amount) || 0) - allocated);

  function changeKind(next: PaymentKind) {
    if (paymentKindSide[next] !== side) setPartner(null);
    setAllocations({});
    setKind(next);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SavePaymentRequest = {
        kind,
        partnerId: partner?.id ?? "",
        fundId,
        paymentDate,
        amount,
        note,
        lines: settles
          ? Object.entries(allocations)
              .filter(([, value]) => Number(value) > 0)
              .map(([debitItemId, value]) => ({ debitItemId, amount: value }))
          : [],
        ...(payment ? { version: payment.version } : {}),
      };
      onSaved(await apiFetch<PaymentResponse>(payment ? `/finance/payments/${payment.id}` : "/finance/payments", { method: payment ? "PATCH" : "POST", body: JSON.stringify(body) }));
    });
  }

  const openItems = openData?.items ?? [];
  // Phiếu đang sửa: chứng từ đã chọn có thể không còn trong danh sách còn nợ (đã trừ bởi phiếu khác) nhưng vẫn hiện để bỏ chọn.
  const selectedOnly = (payment?.lines ?? []).filter((line) => !openItems.some((item) => item.id === line.id));
  const headings = [t("documentNo"), t("documentDate"), t("dueDate"), t("openAmount"), t("allocate")];
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
        <Field id="quy-phieu" label={`${t("fund")} *`} error={fields.fundId}>
          <select id="quy-phieu" className={inputClass("fundId")} value={fundId} onChange={(event) => setFundId(event.target.value)}>
            {choices.funds.length === 0 && <option value="">{t("noFund")}</option>}
            {payment && !choices.funds.some((fund) => fund.id === payment.fund.id) && (
              <option value={payment.fund.id}>
                {payment.fund.code} · {payment.fund.name} ({t("fundInactive")})
              </option>
            )}
            {choices.funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.code} · {fund.name} ({money(fund.balance)})
              </option>
            ))}
          </select>
        </Field>
        <Field id="ngay-phieu" label={`${t("paymentDate")} *`} error={fields.paymentDate}>
          <input id="ngay-phieu" type="date" className={inputClass("paymentDate")} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </Field>
        <Field id="so-tien-phieu" label={`${t("amount")} *`} error={fields.amount}>
          <input id="so-tien-phieu" className={inputClass("amount")} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </Field>
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
                  <button type="button" className="nut phu" onClick={() => setAllocations(oldestFirst(openItems, amount))}>
                    {t("allocateOldest")}
                  </button>
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
                          <td data-nhan={headings[3]}>
                            <span style={{ whiteSpace: "nowrap" }}>{money(item.openAmount)}</span>
                          </td>
                          <td data-nhan={headings[4]}>
                            <input
                              aria-label={`${t("allocate")} ${item.documentNo}`}
                              className="o-nhap"
                              inputMode="decimal"
                              value={allocations[item.id] ?? ""}
                              onChange={(event) => setAllocations({ ...allocations, [item.id]: event.target.value })}
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
                <span>
                  {t("allocatedTotal")}: <strong>{money(String(allocated))}</strong> · {allocated === 0 ? t("autoOldest") : `${t("remainderAdvance")}: ${money(String(Math.max(remainder, 0)))}`}
                </span>
              </>
            ))}
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
