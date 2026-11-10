"use client";

// MAN_HINH_52 Sổ sách (CHUC_NANG_73; QUYTAC_NGHIEPVU_97, 98; API_89): bảng cân đối số phát sinh, sổ cái, khóa sổ.
import type { AccountLedgerResponse, AccountResponse, LedgerPeriodsResponse, TrialBalanceResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { ConfirmDialog } from "ui/components/Dialogs";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded } from "ui/components/StatusViews";
import { apiFetch } from "ui/lib/api";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "trial" | "ledger" | "periods";
const amount = (value: string) => (value === "0" ? "" : formatNumber(value));

export default function BooksPage() {
  const t = useTranslations("ledger");
  const [tab, setTab] = useState<Tab>("trial");
  const today = vietnamToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("booksTitle")}</h1>
        <HistoryLink entityType="ledger_period" />
      </div>
      <div className="cac-the" role="tablist">
        {(["trial", "ledger", "periods"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab !== "periods" && (
        <div className="bo-loc">
          <label htmlFor="tu-ngay-so">{t("from")}</label>
          <input id="tu-ngay-so" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
          <label htmlFor="den-ngay-so">{t("to")}</label>
          <input id="den-ngay-so" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      )}
      {tab === "trial" && <TrialBalance from={from} to={to} />}
      {tab === "ledger" && <AccountLedger from={from} to={to} />}
      {tab === "periods" && <Periods />}
    </>
  );
}

function TrialBalance({ from, to }: { from: string; to: string }) {
  const t = useTranslations("ledger");
  const { state, reload } = useApi<TrialBalanceResponse>(from && to ? `/finance/ledger/trial-balance?from=${from}&to=${to}` : null);
  const headings = [t("code"), t("accountName"), t("openingDebit"), t("openingCredit"), t("debit"), t("credit"), t("closingDebit"), t("closingCredit")];
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
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
              {[...data.rows, { accountId: "", code: "", name: t("total"), depth: 0, ...data.totals }].map((row) => (
                <tr key={row.accountId || "tong"}>
                  <td data-nhan={headings[0]}>
                    <span style={{ paddingLeft: `calc(var(--khoang-3) * ${row.depth})`, fontWeight: row.depth === 0 ? 700 : undefined }}>{row.code}</span>
                  </td>
                  <td data-nhan={headings[1]}>
                    <span style={{ fontWeight: row.accountId ? undefined : 700 }}>{row.name}</span>
                  </td>
                  {[row.openingDebit, row.openingCredit, row.debit, row.credit, row.closingDebit, row.closingCredit].map((value, index) => (
                    <td key={headings[index + 2]} data-nhan={headings[index + 2]}>
                      <span style={{ whiteSpace: "nowrap" }}>{amount(value)}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Loaded>
  );
}

function AccountLedger({ from, to }: { from: string; to: string }) {
  const t = useTranslations("ledger");
  const accounts = useApi<AccountResponse[]>("/finance/accounts");
  const [accountId, setAccountId] = useState("");
  const { state, reload } = useApi<AccountLedgerResponse>(accountId && from && to ? `/finance/ledger/accounts/${accountId}?from=${from}&to=${to}` : null);
  const headings = [t("journalDate"), t("journalNo"), t("description"), t("counterAccount"), t("debit"), t("credit"), t("runningBalance")];
  const signed = (value: string) => (Number(value) < 0 ? `${formatNumber(String(-Number(value)))} ${t("creditSide")}` : `${formatNumber(value)} ${t("debitSide")}`);
  return (
    <>
      <select aria-label={t("account")} className="o-nhap" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
        <option value="">{t("chooseAccount")}</option>
        {(accounts.state.kind === "ready" ? accounts.state.data : []).map((account) => (
          <option key={account.id} value={account.id}>
            {account.code} · {account.name}
          </option>
        ))}
      </select>
      {accountId && (
        <Loaded state={state} onRetry={() => void reload()}>
          {(data) => (
            <>
              <p>
                {t("openingBalance")}: <strong>{signed(data.openingBalance)}</strong>
              </p>
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
                    {data.entries.map((entry, index) => (
                      <tr key={`${entry.journalId}-${index}`}>
                        <td data-nhan={headings[0]}>
                          <span>{formatDate(entry.journalDate)}</span>
                        </td>
                        <td data-nhan={headings[1]}>
                          <Link href={`/journals/${entry.journalId}`}>{entry.journalNo || "—"}</Link>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>
                            {entry.description}
                            {entry.partnerName && <span className="chu-thich"> · {entry.partnerName}</span>}
                          </span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{entry.counterAccounts.join(", ")}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span style={{ whiteSpace: "nowrap" }}>{amount(entry.debit)}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span style={{ whiteSpace: "nowrap" }}>{amount(entry.credit)}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <span style={{ whiteSpace: "nowrap" }}>{signed(entry.balance)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                {t("periodTotals", { debit: formatNumber(data.totalDebit), credit: formatNumber(data.totalCredit) })} · {t("closingBalance")}: <strong>{signed(data.closingBalance)}</strong>
              </p>
            </>
          )}
        </Loaded>
      )}
    </>
  );
}

function Periods() {
  const t = useTranslations("ledger");
  const { notify } = useAdmin();
  const { state, reload } = useApi<LedgerPeriodsResponse>("/finance/ledger/periods");
  const [confirm, setConfirm] = useState<"close" | "reopen" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthText = (month: string | null) => (month ? `${month.slice(5)}/${month.slice(0, 4)}` : "—");
  async function act(data: LedgerPeriodsResponse, action: "close" | "reopen") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/finance/ledger/periods/${action}`, { method: "POST", body: action === "close" ? JSON.stringify({ month: data.nextMonth }) : undefined });
      notify(action === "close" ? t("closed") : t("reopened"));
      setConfirm(null);
      await reload();
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(data) => (
        <section className="the" style={{ display: "grid", gap: "var(--khoang-3)" }}>
          <span>
            {t("lockedThrough")}: <strong>{data.lockedThrough ? formatDate(data.lockedThrough) : t("notLocked")}</strong>
          </span>
          <span>
            {t("nextMonth")}: <strong>{monthText(data.nextMonth)}</strong>
          </span>
          <p className="chu-thich">{t("closeHint")}</p>
          <div className="nhom-nut">
            {data.canClose && (
              <button type="button" className="nut chinh" onClick={() => setConfirm("close")}>
                {t("closeMonth", { month: monthText(data.nextMonth) })}
              </button>
            )}
            {data.canReopen && (
              <button type="button" className="nut phu" onClick={() => setConfirm("reopen")}>
                {t("reopenMonth", { month: monthText(data.lastClosedMonth) })}
              </button>
            )}
          </div>
          {confirm && (
            <ConfirmDialog
              title={confirm === "close" ? t("closeMonth", { month: monthText(data.nextMonth) }) : t("reopenMonth", { month: monthText(data.lastClosedMonth) })}
              text={confirm === "close" ? t("closeConfirm") : t("reopenConfirm")}
              confirmLabel={confirm === "close" ? t("closeAction") : t("reopenAction")}
              busy={busy}
              error={error}
              onConfirm={() => void act(data, confirm)}
              onClose={() => setConfirm(null)}
            />
          )}
        </section>
      )}
    </Loaded>
  );
}
