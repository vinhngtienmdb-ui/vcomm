"use client";

// Ô đối chiếu quỹ ngân hàng (CHUC_NANG_87; API_101): số dư sổ, số dư ngân hàng, chênh lệch, giao dịch và phiếu chưa ghép.
import type { BankReconciliationResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export function BankReconciliationPanel({ fundId, from, to }: { fundId: string; from: string; to: string }) {
  const t = useTranslations("bankTransactions");
  const payments = useTranslations("payments");
  const [open, setOpen] = useState(false);
  const { state, reload } = useApi<BankReconciliationResponse>(`/finance/bank-reconciliation?${new URLSearchParams({ fundId, from, to }).toString()}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(result) => (
        <section className="the" style={{ display: "grid", gap: "var(--khoang-3)", marginBottom: "var(--khoang-4)" }} aria-label={t("reconciliation")}>
          <h2 style={{ margin: 0 }}>{t("reconciliationTitle", { from: formatDate(result.from), to: formatDate(result.to) })}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--khoang-3)" }}>
            <Figure label={t("bookBalance")} value={formatMoney(result.bookBalance, result.currency)} />
            <Figure
              label={t("bankBalance")}
              value={result.bankBalance === null ? t("noBankBalance") : formatMoney(result.bankBalance, result.currency)}
              hint={result.bankBalanceAt ? t("bankBalanceAt", { time: formatDateTime(result.bankBalanceAt) }) : undefined}
            />
            <Figure
              label={t("difference")}
              value={result.difference === null ? "—" : formatMoney(result.difference, result.currency)}
              tone={result.difference !== null && Number(result.difference) !== 0 ? "loi" : undefined}
            />
            <Figure label={t("unmatchedIn")} value={`${result.unmatchedIn.count} · ${formatMoney(result.unmatchedIn.amount, result.currency)}`} />
            <Figure label={t("unmatchedOut")} value={`${result.unmatchedOut.count} · ${formatMoney(result.unmatchedOut.amount, result.currency)}`} />
            <Figure label={t("unmatchedPayments")} value={String(result.unmatchedPaymentCount)} hint={t("ignoredCount", { count: result.ignoredCount })} />
          </div>
          {result.unmatchedPaymentCount > 0 && (
            <div>
              <button type="button" className="nut phu" aria-expanded={open} onClick={() => setOpen(!open)}>
                {open ? t("hidePayments") : t("showPayments")}
              </button>
              {open && (
                <ul style={{ margin: "var(--khoang-2) 0 0", paddingLeft: "var(--khoang-4)" }}>
                  {result.unmatchedPayments.map((payment) => (
                    <li key={payment.id}>
                      <Link href={`/payments/${payment.id}`}>{payment.documentNo}</Link> · {formatDate(payment.paymentDate)} · {payments(`kind_${payment.kind}`)} · {payment.partnerName} ·{" "}
                      {formatMoney(payment.amount, result.currency)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </Loaded>
  );
}

function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string | undefined; tone?: string | undefined }) {
  return (
    <div>
      <div className="chu-thich">{label}</div>
      <strong className={tone ? `nhan ${tone}` : undefined} style={{ whiteSpace: "nowrap" }}>
        {value}
      </strong>
      {hint && <div className="chu-thich">{hint}</div>}
    </div>
  );
}
