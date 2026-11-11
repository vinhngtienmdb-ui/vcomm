"use client";

// MAN_HINH_102 Rút tiền hoa hồng (CONG_VIEC_26; CHUC_NANG_137; API_136; QUYTAC_NGHIEPVU_204 đến 206): duyệt (chốt thuế), từ chối, ghi đã chi; bảng kê thuế theo tháng.
import { withdrawalStatuses, type PageResponse, type WithdrawalItem, type WithdrawalStatus, type WithdrawalTaxReport } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { FormError } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatDateTime, formatNumber } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const vietnamToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

function WithdrawalCard({ item, onChanged }: { item: WithdrawalItem; onChanged: () => Promise<void> }) {
  const t = useTranslations("withdrawals");
  const { notify } = useAdmin();
  const [reason, setReason] = useState("");
  const [bankTransactionNo, setBankTransactionNo] = useState("");
  const [paidOn, setPaidOn] = useState(vietnamToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(path: string, body: object, saved: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/marketplace/withdrawals/${item.id}/${path}`, { method: "POST", body: JSON.stringify({ ...body, version: item.version }) });
      notify(t(saved));
      await onChanged();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  const prefix = `rt-${item.id}`;
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--khoang-2)", flexWrap: "wrap", alignItems: "center" }}>
        <strong>{`${item.userName} · ${item.userPhone}`}</strong>
        <strong>{formatNumber(item.amount, 0)}</strong>
      </div>
      <span className="chu-thich">{`${t("createdAt")} ${formatDateTime(item.createdAt)}${item.decidedAt ? ` · ${t("decidedAt")} ${formatDateTime(item.decidedAt)}` : ""}`}</span>
      <span>
        {t("bankAccount")}: <strong>{`${item.bankAccount.bankName} · ${item.bankAccount.accountNumber} · ${item.bankAccount.accountHolder}`}</strong>
      </span>
      <span>
        {item.status === "pending" ? t("projectedTax") : t("tax")}: <strong>{formatNumber(item.taxAmount, 0)}</strong> · {item.status === "pending" ? t("projectedFee") : t("fee")}:{" "}
        <strong>{formatNumber(item.feeAmount, 0)}</strong> · {t("netAmount")}: <strong>{formatNumber(item.netAmount, 0)}</strong>
      </span>
      {item.walletBlocked ? (
        <div className="khoi-canh-bao canh-bao" role="status">
          {t("walletBlocked")}
        </div>
      ) : null}
      {item.status === "rejected" ? <span className="chu-thich">{`${t("rejectReason")}: ${item.rejectReason}`}</span> : null}
      {item.status === "paid" ? <span className="chu-thich">{`${t("bankTransactionNo")} ${item.bankTransactionNo} · ${t("paidOn")} ${formatDate(item.paidOn ?? "")}`}</span> : null}
      <FormError text={error} />
      {item.status === "pending" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
          <button type="button" className="nut chinh" disabled={busy} onClick={() => void act("approve", {}, "approvedSaved")}>
            {t("approve")}
          </button>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <label htmlFor={`${prefix}-ly-do`}>{t("rejectReason")}</label>
            <input id={`${prefix}-ly-do`} className="o-nhap" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </span>
          <button type="button" className="nut phu" disabled={busy || !reason.trim()} onClick={() => void act("reject", { reason: reason.trim() }, "rejectedSaved")}>
            {t("reject")}
          </button>
        </div>
      ) : null}
      {item.status === "approved" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-2)", alignItems: "end" }}>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <label htmlFor={`${prefix}-ma`}>{t("bankTransactionNo")}</label>
            <input id={`${prefix}-ma`} className="o-nhap" maxLength={100} value={bankTransactionNo} onChange={(event) => setBankTransactionNo(event.target.value)} />
          </span>
          <span style={{ display: "grid", gap: "var(--khoang-1)" }}>
            <label htmlFor={`${prefix}-ngay`}>{t("paidOn")}</label>
            <input id={`${prefix}-ngay`} type="date" className="o-nhap" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
          </span>
          <button
            type="button"
            className="nut chinh"
            disabled={busy || !bankTransactionNo.trim() || !paidOn}
            onClick={() => void act("pay", { bankTransactionNo: bankTransactionNo.trim(), paidOn }, "paidSaved")}
          >
            {t("pay")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function TaxReport() {
  const t = useTranslations("withdrawals");
  const [month, setMonth] = useState(vietnamToday().slice(0, 7));
  const { state, reload } = useApi<WithdrawalTaxReport>(`/marketplace/withdrawals/tax-report?month=${month}`);
  return (
    <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <h2>{t("taxReport")}</h2>
      <span style={{ display: "grid", gap: "var(--khoang-1)", maxWidth: "12rem" }}>
        <label htmlFor="bang-ke-thang">{t("month")}</label>
        <input id="bang-ke-thang" type="month" className="o-nhap" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
      </span>
      <Loaded state={state} onRetry={() => void reload()}>
        {(report) =>
          report.rows.length === 0 ? (
            <MessageView text={t("noTax")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    <th>{t("person")}</th>
                    <th>{t("paidOn")}</th>
                    <th>{t("bankTransactionNo")}</th>
                    <th>{t("amount")}</th>
                    <th>{t("tax")}</th>
                    <th>{t("fee")}</th>
                    <th>{t("netAmount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={`${row.bankTransactionNo}-${row.userPhone}`}>
                      <td data-nhan={t("person")}>{`${row.userName} · ${row.userPhone}`}</td>
                      <td data-nhan={t("paidOn")}>{formatDate(row.paidOn)}</td>
                      <td data-nhan={t("bankTransactionNo")}>{row.bankTransactionNo}</td>
                      <td data-nhan={t("amount")}>{formatNumber(row.amount, 0)}</td>
                      <td data-nhan={t("tax")}>{formatNumber(row.taxAmount, 0)}</td>
                      <td data-nhan={t("fee")}>{formatNumber(row.feeAmount, 0)}</td>
                      <td data-nhan={t("netAmount")}>{formatNumber(row.netAmount, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ padding: "var(--khoang-3) var(--khoang-4)" }}>
                <strong>{t("totals", { amount: formatNumber(report.totalAmount, 0), tax: formatNumber(report.totalTax, 0) })}</strong>
              </p>
            </div>
          )
        }
      </Loaded>
    </div>
  );
}

export default function WithdrawalsPage() {
  const t = useTranslations("withdrawals");
  const common = useTranslations("common");
  const [status, setStatus] = useState<WithdrawalStatus>("pending");
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<PageResponse<WithdrawalItem>>(`/marketplace/withdrawals?${new URLSearchParams({ status, page: String(page), pageSize: "20" })}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="nhom-nut" role="tablist">
        {withdrawalStatuses.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={status === item}
            className={`nut ${status === item ? "chinh" : "phu"}`}
            onClick={() => {
              setStatus(item);
              setPage(1);
            }}
          >
            {t(`status_${item}`)}
          </button>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
              {result.data.map((item) => (
                <WithdrawalCard key={`${item.id}-${item.version}`} item={item} onChanged={reload} />
              ))}
              <div className="phan-trang">
                <span>{common("total", { count: result.total })}</span>
                <span className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    ‹ {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * result.pageSize >= result.total} onClick={() => setPage(page + 1)}>
                    {common("next")} ›
                  </button>
                </span>
              </div>
            </div>
          )
        }
      </Loaded>
      <TaxReport />
    </>
  );
}
