"use client";

// MAN_HINH_185 Phiếu nộp thuế hải quan, MAN_HINH_187 Phiếu nhận hoàn thuế hải quan (CONG_VIEC_56; QUYTAC_NGHIEPVU_415 đến 417; API_218):
// chọn tờ khai, nhập số nộp từng loại thuế (gợi ý số còn phải nộp), tiền chậm nộp hệ thống tính theo tham số (sửa được), bù trừ số nộp thừa; phiếu hoàn chọn số nộp thừa.
import { type CustomsDeclarationTaxes, type CustomsTaxParameterResponse, type CustomsTaxType, type PaymentOptionsResponse, type PaymentResponse, type SaveCustomsTaxPaymentRequest } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Field, FormError, useSubmit } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatMoney, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

type Kind = "customs_tax_payment" | "customs_tax_refund";
const keyOf = (declarationId: string, taxType: CustomsTaxType) => `${declarationId}:${taxType}`;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export function CustomsTaxPaymentEditor({
  payment,
  kind,
  initialDeclarationId,
  onSaved,
  onCancel,
}: {
  payment: PaymentResponse | null;
  kind: Kind;
  initialDeclarationId: string | null;
  onSaved: (saved: PaymentResponse) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("payments");
  const options = useApi<PaymentOptionsResponse>("/finance/payments/options");
  const all = useApi<CustomsDeclarationTaxes[]>("/finance/customs-taxes");
  const parameters = useApi<CustomsTaxParameterResponse[]>("/finance/customs-tax-parameters");
  const choices = options.state.kind === "ready" ? options.state.data : { funds: [], currency: "VND" };
  const funds = choices.funds.filter((fund) => fund.fundCurrency === null);
  const money = (value: string) => formatMoney(value, choices.currency);
  const declarations = all.state.kind === "ready" ? all.state.data : [];
  const [fundId, setFundId] = useState(payment?.fund.id ?? "");
  const [paymentDate, setPaymentDate] = useState(payment?.paymentDate ?? vietnamToday());
  const [referenceNo, setReferenceNo] = useState(payment?.referenceNo ?? "");
  const [note, setNote] = useState(payment?.note ?? "");
  const lines = payment?.customsLines ?? [];
  const [chosen, setChosen] = useState<string[]>(() => [
    ...new Set([...lines.filter((line) => line.lineKind === "payment").map((line) => line.declarationId), ...(initialDeclarationId ? [initialDeclarationId] : [])]),
  ]);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.filter((line) => line.lineKind === "payment" || line.lineKind === "refund").map((line) => [keyOf(line.declarationId, line.taxType), line.amount])),
  );
  const [lateAmounts, setLateAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.filter((line) => line.lineKind === "late_payment" && line.edited).map((line) => [keyOf(line.declarationId, line.taxType), line.amount])),
  );
  const [offsets, setOffsets] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.filter((line) => line.lineKind === "offset").map((line) => [keyOf(line.declarationId, line.taxType), line.amount])),
  );
  const { submitting, fields, formError, run, inputClass } = useSubmit();

  useEffect(() => {
    if (!fundId && funds.length > 0) setFundId(funds[0]!.id);
  }, [funds, fundId]);

  // Phiếu mới: số nộp gợi ý bằng số còn phải nộp của tờ khai vừa chọn.
  useEffect(() => {
    if (payment || kind !== "customs_tax_payment") return;
    setAmounts((current) => {
      const next = { ...current };
      for (const declaration of declarations.filter((item) => chosen.includes(item.declarationId))) {
        for (const tax of declaration.taxes) {
          const key = keyOf(declaration.declarationId, tax.taxType);
          const open = Number(tax.remaining) - Number(tax.pending);
          if (next[key] === undefined && open > 0) next[key] = String(open);
        }
      }
      return next;
    });
  }, [declarations, chosen, payment, kind]);

  const rate = useMemo(() => {
    const list = parameters.state.kind === "ready" ? parameters.state.data : [];
    return Number(list.find((item) => item.effectiveFrom <= paymentDate)?.lateRate ?? 0);
  }, [parameters.state, paymentDate]);
  const lateOf = (declaration: CustomsDeclarationTaxes, amount: string) => {
    const days = Math.max(0, daysBetween(declaration.dueDate, paymentDate));
    return { days, value: Math.round(Number(amount || 0) * rate * days) };
  };
  const overpaid = declarations.flatMap((declaration) =>
    declaration.taxes.filter((tax) => Number(tax.remaining) - Number(tax.pending) < 0).map((tax) => ({ declaration, tax, available: -(Number(tax.remaining) - Number(tax.pending)) })),
  );
  const payRows = declarations
    .filter((declaration) => chosen.includes(declaration.declarationId))
    .flatMap((declaration) => declaration.taxes.filter((tax) => Number(tax.payable) !== 0 || amounts[keyOf(declaration.declarationId, tax.taxType)]).map((tax) => ({ declaration, tax })));
  const totalPay = payRows.reduce((total, row) => total + Number(amounts[keyOf(row.declaration.declarationId, row.tax.taxType)] || 0), 0);
  const totalLate = payRows.reduce((total, row) => {
    const key = keyOf(row.declaration.declarationId, row.tax.taxType);
    return total + (lateAmounts[key] !== undefined && lateAmounts[key] !== "" ? Number(lateAmounts[key]) : lateOf(row.declaration, amounts[key] ?? "0").value);
  }, 0);
  const totalOffset = Object.values(offsets).reduce((total, value) => total + Number(value || 0), 0);
  const totalRefund = overpaid.reduce((total, row) => total + Number(amounts[keyOf(row.declaration.declarationId, row.tax.taxType)] || 0), 0);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const body: SaveCustomsTaxPaymentRequest = {
        kind,
        fundId,
        paymentDate,
        referenceNo,
        note,
        lines:
          kind === "customs_tax_refund"
            ? overpaid
                .filter((row) => Number(amounts[keyOf(row.declaration.declarationId, row.tax.taxType)]) > 0)
                .map((row) => ({
                  lineKind: "refund" as const,
                  declarationId: row.declaration.declarationId,
                  taxType: row.tax.taxType,
                  amount: amounts[keyOf(row.declaration.declarationId, row.tax.taxType)]!,
                }))
            : [
                ...payRows
                  .filter((row) => Number(amounts[keyOf(row.declaration.declarationId, row.tax.taxType)]) > 0)
                  .map((row) => {
                    const key = keyOf(row.declaration.declarationId, row.tax.taxType);
                    return { lineKind: "payment" as const, declarationId: row.declaration.declarationId, taxType: row.tax.taxType, amount: amounts[key]!, lateAmount: lateAmounts[key] || null };
                  }),
                ...overpaid
                  .filter((row) => Number(offsets[keyOf(row.declaration.declarationId, row.tax.taxType)]) > 0)
                  .map((row) => ({
                    lineKind: "offset" as const,
                    declarationId: row.declaration.declarationId,
                    taxType: row.tax.taxType,
                    amount: offsets[keyOf(row.declaration.declarationId, row.tax.taxType)]!,
                  })),
              ],
        ...(payment ? { version: payment.version } : {}),
      };
      onSaved(
        await apiFetch<PaymentResponse>(payment ? `/finance/customs-tax-payments/${payment.id}` : "/finance/customs-tax-payments", { method: payment ? "PATCH" : "POST", body: JSON.stringify(body) }),
      );
    });
  }

  const payHeadings = [t("declaration"), t("taxType"), t("payable"), t("paid"), t("remaining"), t("payAmount"), t("taxDueDate"), t("overdueDaysShort"), t("lateAmount")];
  const overHeadings = [t("declaration"), t("taxType"), t("overpaidAmount"), kind === "customs_tax_refund" ? t("refundAmount") : t("offsetAmount")];
  const lineErrors = Object.entries(fields).filter(([key]) => key.startsWith("lines"));
  return (
    <form onSubmit={submit} className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
        <Field id="ngay-nop-thue" label={`${t("paymentDate")} *`} error={fields.paymentDate}>
          <input id="ngay-nop-thue" type="date" className={inputClass("paymentDate")} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </Field>
        <Field id="quy-nop-thue" label={`${t("fund")} *`} error={fields.fundId}>
          <select id="quy-nop-thue" className={inputClass("fundId")} value={fundId} onChange={(event) => setFundId(event.target.value)}>
            {funds.length === 0 && <option value="">{t("noFund")}</option>}
            {funds.map((fund) => (
              <option key={fund.id} value={fund.id}>
                {fund.code} · {fund.name} ({money(fund.balance)})
              </option>
            ))}
          </select>
        </Field>
        <Field id="so-chung-tu-ngan-sach" label={kind === "customs_tax_refund" ? t("refundReferenceNo") : t("referenceNo")} error={fields.referenceNo}>
          <input id="so-chung-tu-ngan-sach" className={inputClass("referenceNo")} value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} />
        </Field>
        {kind === "customs_tax_payment" && (
          <Field id="them-to-khai" label={t("addDeclaration")}>
            <select
              id="them-to-khai"
              className="o-nhap"
              value=""
              onChange={(event) => {
                if (event.target.value) setChosen([...chosen, event.target.value]);
              }}
            >
              <option value="">{t("chooseDeclaration")}</option>
              {declarations
                .filter((declaration) => !chosen.includes(declaration.declarationId) && declaration.taxes.some((tax) => Number(tax.remaining) - Number(tax.pending) > 0))
                .map((declaration) => (
                  <option key={declaration.declarationId} value={declaration.declarationId}>
                    {declaration.declarationNo} · {money(String(declaration.taxes.reduce((total, tax) => total + Math.max(0, Number(tax.remaining) - Number(tax.pending)), 0)))}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </div>
      {kind === "customs_tax_payment" && payRows.length > 0 && (
        <div className="khung-bang">
          <table>
            <thead>
              <tr>
                {payHeadings.map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payRows.map(({ declaration, tax }) => {
                const key = keyOf(declaration.declarationId, tax.taxType);
                const late = lateOf(declaration, amounts[key] ?? "0");
                const edited = lateAmounts[key] !== undefined && lateAmounts[key] !== "" && Number(lateAmounts[key]) !== late.value;
                return (
                  <tr key={key}>
                    <td data-nhan={payHeadings[0]}>
                      <span>
                        {declaration.declarationNo}
                        {declaration.customsOffice && <span className="chu-thich"> · {declaration.customsOffice}</span>}
                      </span>
                    </td>
                    <td data-nhan={payHeadings[1]}>
                      <span>{t(`taxType_${tax.taxType}`)}</span>
                    </td>
                    <td data-nhan={payHeadings[2]}>
                      <span>{money(tax.payable)}</span>
                    </td>
                    <td data-nhan={payHeadings[3]}>
                      <span>{money(tax.paid)}</span>
                    </td>
                    <td data-nhan={payHeadings[4]}>
                      <span>{money(tax.remaining)}</span>
                    </td>
                    <td data-nhan={payHeadings[5]}>
                      <input
                        aria-label={`${t("payAmount")} ${declaration.declarationNo} ${t(`taxType_${tax.taxType}`)}`}
                        className="o-nhap"
                        inputMode="decimal"
                        value={amounts[key] ?? ""}
                        onChange={(event) => setAmounts({ ...amounts, [key]: event.target.value })}
                      />
                    </td>
                    <td data-nhan={payHeadings[6]}>
                      <span>{formatDate(declaration.dueDate)}</span>
                    </td>
                    <td data-nhan={payHeadings[7]}>
                      <span>{late.days}</span>
                    </td>
                    <td data-nhan={payHeadings[8]}>
                      <input
                        aria-label={`${t("lateAmount")} ${declaration.declarationNo} ${t(`taxType_${tax.taxType}`)}`}
                        className="o-nhap"
                        inputMode="decimal"
                        placeholder={String(late.value)}
                        value={lateAmounts[key] ?? ""}
                        onChange={(event) => setLateAmounts({ ...lateAmounts, [key]: event.target.value })}
                      />
                      {edited && <span className="nhan canh-bao">{t("edited")}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(kind === "customs_tax_refund" || overpaid.length > 0) && (
        <>
          <strong>{kind === "customs_tax_refund" ? t("customsRefundTitle") : t("offsets")}</strong>
          {overpaid.length === 0 ? (
            <span className="chu-thich">{t("noOverpaid")}</span>
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {overHeadings.map((heading) => (
                      <th key={heading} scope="col">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overpaid.map(({ declaration, tax, available }) => {
                    const key = keyOf(declaration.declarationId, tax.taxType);
                    const values = kind === "customs_tax_refund" ? amounts : offsets;
                    const setter = kind === "customs_tax_refund" ? setAmounts : setOffsets;
                    return (
                      <tr key={key}>
                        <td data-nhan={overHeadings[0]}>
                          <span>{declaration.declarationNo}</span>
                        </td>
                        <td data-nhan={overHeadings[1]}>
                          <span>{t(`taxType_${tax.taxType}`)}</span>
                        </td>
                        <td data-nhan={overHeadings[2]}>
                          <span>{money(String(available))}</span>
                        </td>
                        <td data-nhan={overHeadings[3]}>
                          <input
                            aria-label={`${overHeadings[3]} ${declaration.declarationNo} ${t(`taxType_${tax.taxType}`)}`}
                            className="o-nhap"
                            inputMode="decimal"
                            value={values[key] ?? ""}
                            onChange={(event) => setter({ ...values, [key]: event.target.value })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {lineErrors.map(([key, message]) => (
        <span key={key} className="loi-o">
          {message}
        </span>
      ))}
      <dl className="thong-tin-dong">
        {kind === "customs_tax_payment" ? (
          <>
            <dt>{t("totalPay")}</dt>
            <dd>{money(String(totalPay))}</dd>
            <dt>{t("totalLate")}</dt>
            <dd>{money(String(totalLate))}</dd>
            <dt>{t("totalOffset")}</dt>
            <dd>−{money(String(totalOffset))}</dd>
            <dt>{t("totalAmount")}</dt>
            <dd>
              <strong>{money(String(totalPay + totalLate - totalOffset))}</strong>
            </dd>
          </>
        ) : (
          <>
            <dt>{t("totalAmount")}</dt>
            <dd>
              <strong>{money(String(totalRefund))}</strong>
            </dd>
          </>
        )}
      </dl>
      {kind === "customs_tax_payment" && <div className="khoi-canh-bao canh-bao">{t("lateRiskHint")}</div>}
      <Field id="noi-dung-nop-thue" label={t("note")} error={fields.note}>
        <input id="noi-dung-nop-thue" className={inputClass("note")} value={note} onChange={(event) => setNote(event.target.value)} />
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
