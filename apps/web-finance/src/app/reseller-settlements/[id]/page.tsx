"use client";

// MAN_HINH_241 Chi tiết bảng đối soát người bán dropship (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_509; API_312, API_313): A đến E, số còn lại, từng chứng từ;
// xác nhận lập đơn phí giao (công nợ, bút toán, hóa đơn điện tử theo luồng đơn bán dịch vụ), số âm lập phiếu chi hoàn tiền nháp.
import type { FundResponse, ResellerSettlementResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Field, FormError } from "ui/components/Form";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

export default function ResellerSettlementPage() {
  const t = useTranslations("resellerSettlements");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<ResellerSettlementResponse>(`/finance/reseller-settlements/${id}`);
  return (
    <>
      <div>
        <Link href="/reseller-settlements">‹ {t("back")}</Link>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(settlement) => <Settlement key={settlement.version} settlement={settlement} onChanged={() => void reload()} />}
      </Loaded>
    </>
  );
}

function Settlement({ settlement, onChanged }: { settlement: ResellerSettlementResponse; onChanged: () => void }) {
  const t = useTranslations("resellerSettlements");
  const { notify } = useAdmin();
  const negative = Number(settlement.remainingAmount) < 0;
  const funds = useApi<FundResponse[]>(settlement.canConfirm && negative ? "/finance/funds" : null);
  const [fundId, setFundId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundError, setFundError] = useState<string | undefined>(undefined);
  const money = (value: string) => formatMoney(value, settlement.currency);

  async function confirm() {
    setBusy(true);
    setError(null);
    setFundError(undefined);
    try {
      await apiFetch(`/finance/reseller-settlements/${settlement.id}/confirm`, { method: "POST", body: JSON.stringify({ version: settlement.version, fundId: fundId || null }) });
      notify(t("confirmed"));
      onChanged();
    } catch (failure) {
      const result = failureOf(failure);
      setError(result.message);
      setFundError(result.fields?.fundId);
    } finally {
      setBusy(false);
    }
  }

  const rows: [string, string][] = [
    [t("lineIssue", { count: settlement.counts.issue }), settlement.issueAmount],
    [t("lineReturn", { count: settlement.counts.return }), settlement.returnAmount],
    [t("lineCollection", { count: settlement.counts.collection }), settlement.collectionAmount],
    [t("lineFee", { count: settlement.counts.shipping_fee }), settlement.feeAmount],
    [t("lineFeeTax", { rate: settlement.feeTaxRate }), settlement.feeTaxAmount],
  ];
  const lineHeadings = [t("kind"), t("document"), t("date"), t("order"), t("amount")];
  return (
    <>
      <div className="tieu-de">
        <h1>
          {t("detailTitle", { documentNo: settlement.documentNo })} <span className={`nhan ${settlement.status === "confirmed" ? "thanh-cong" : "canh-bao"}`}>{t(`status_${settlement.status}`)}</span>
        </h1>
      </div>
      <section className="the">
        <dl className="thong-tin-dong">
          <dt>{t("reseller")}</dt>
          <dd>{settlement.resellerName}</dd>
          <dt>{t("week")}</dt>
          <dd>
            {formatDate(settlement.weekStart)} – {formatDate(settlement.weekEnd)}
          </dd>
          {settlement.confirmedAt && (
            <>
              <dt>{t("confirmedBy")}</dt>
              <dd>
                {settlement.confirmedByName} · {formatDateTime(settlement.confirmedAt)}
              </dd>
            </>
          )}
          {settlement.feeOrder && (
            <>
              <dt>{t("feeOrder")}</dt>
              <dd>
                <a href={`/sales/orders/${settlement.feeOrder.id}`}>{settlement.feeOrder.documentNo}</a>
              </dd>
            </>
          )}
          {settlement.refundPayment && (
            <>
              <dt>{t("refundPayment")}</dt>
              <dd>
                <Link href={`/payments/${settlement.refundPayment.id}`}>{settlement.refundPayment.documentNo ?? t("refundDraft")}</Link> · {money(settlement.refundPayment.amount)}
              </dd>
            </>
          )}
        </dl>
      </section>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th scope="col">{t("item")}</th>
              <th scope="col" style={{ textAlign: "right" }}>
                {t("amount")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, amount]) => (
              <tr key={label}>
                <td data-nhan={t("item")}>
                  <span>{label}</span>
                </td>
                <td data-nhan={t("amount")} style={{ textAlign: "right" }}>
                  <span>{money(amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td data-nhan="">
                <strong>{negative ? t("remainingCompanyPays") : t("remainingResellerPays")}</strong>
              </td>
              <td data-nhan={t("amount")} style={{ textAlign: "right" }}>
                <strong style={negative ? { color: "var(--mau-loi)" } : undefined}>{money(settlement.remainingAmount)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="chu-thich">{t("confirmHint")}</div>
      {settlement.canConfirm && (
        <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          {negative && (
            <Field id="quy-hoan-tien" label={`${t("fund")} *`} hint={t("fundHint", { amount: money(String(-Number(settlement.remainingAmount))) })} error={fundError}>
              <select id="quy-hoan-tien" className={`o-nhap${fundError ? " loi" : ""}`} value={fundId} onChange={(event) => setFundId(event.target.value)}>
                <option value="">{t("chooseFund")}</option>
                {(funds.state.kind === "ready" ? funds.state.data : [])
                  .filter((fund) => fund.status === "active")
                  .map((fund) => (
                    <option key={fund.id} value={fund.id}>
                      {fund.code} · {fund.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <FormError text={error} />
          <div className="nhom-nut">
            <button type="button" className="nut chinh" disabled={busy} onClick={() => void confirm()}>
              {t("confirm")}
            </button>
          </div>
        </section>
      )}
      <h2>{t("lines")}</h2>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              {lineHeadings.map((heading, index) => (
                <th key={index} scope="col" style={index === 4 ? { textAlign: "right" } : undefined}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settlement.lines.map((line, index) => (
              <tr key={index}>
                <td data-nhan={lineHeadings[0]}>
                  <span>{t(`kind_${line.kind}`)}</span>
                </td>
                <td data-nhan={lineHeadings[1]}>
                  <span>{line.documentNo}</span>
                </td>
                <td data-nhan={lineHeadings[2]}>
                  <span>{formatDate(line.documentDate)}</span>
                </td>
                <td data-nhan={lineHeadings[3]}>
                  <a href={`/sales/orders/${line.orderId}`}>{line.orderCode}</a>
                </td>
                <td data-nhan={lineHeadings[4]} style={{ textAlign: "right" }}>
                  <span>{money(line.amount)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
