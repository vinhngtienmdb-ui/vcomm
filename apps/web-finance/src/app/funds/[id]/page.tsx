"use client";

// MAN_HINH_46 Chi tiết quỹ (CHUC_NANG_65; API_84): thông tin, sửa, sổ quỹ theo khoảng ngày.
import type { FundLedgerResponse, FundResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded } from "ui/components/StatusViews";
import { formatDate, formatMoney, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { FundEditor } from "@/components/FundEditor";

export default function FundPage() {
  const t = useTranslations("funds");
  const payments = useTranslations("payments");
  const { notify } = useAdmin();
  const { id } = useParams<{ id: string }>();
  const today = vietnamToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [editing, setEditing] = useState(false);
  const fund = useApi<FundResponse>(`/finance/funds/${id}`);
  const ledger = useApi<FundLedgerResponse>(from && to ? `/finance/funds/${id}/ledger?from=${from}&to=${to}` : null);
  const headings = [t("date"), t("documentNo"), t("partner"), t("receipt"), t("payment"), t("runningBalance")];
  return (
    <>
      <Link href="/funds">‹ {t("back")}</Link>
      <Loaded state={fund.state} onRetry={() => void fund.reload()}>
        {(data) => (
          <>
            <div className="tieu-de">
              <h1>
                {data.code} · {data.name}
              </h1>
              <span className={`nhan ${data.status === "active" ? "thanh-cong" : "trung-tinh"}`}>{t(`status_${data.status}`)}</span>
              {data.canManage && !editing && (
                <button type="button" className="nut phu" onClick={() => setEditing(true)}>
                  {t("edit")}
                </button>
              )}
            </div>
            {editing ? (
              <FundEditor
                fund={data}
                onSaved={() => {
                  setEditing(false);
                  notify(t("saved"));
                  void fund.reload();
                  void ledger.reload();
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <section className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                <div className="thong-tin-dong">
                  <span>{t(`kind_${data.kind}`)}</span>
                  {data.kind === "bank" && <span>{[data.bankName, data.accountNo, data.accountHolder].filter(Boolean).join(" · ")}</span>}
                  <span>
                    {t("openingBalance")}: {formatMoney(data.openingBalance, data.currency)}
                  </span>
                </div>
                <strong>
                  {t("balance")}: {formatMoney(data.balance, data.currency)}
                </strong>
              </section>
            )}
          </>
        )}
      </Loaded>
      <h2>{t("ledger")}</h2>
      <div className="bo-loc">
        <label htmlFor="tu-ngay-quy">{t("from")}</label>
        <input id="tu-ngay-quy" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => setFrom(event.target.value)} />
        <label htmlFor="den-ngay-quy">{t("to")}</label>
        <input id="den-ngay-quy" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <Loaded state={ledger.state} onRetry={() => void ledger.reload()}>
        {(data) => {
          const money = (value: string) => formatMoney(value, data.fund.currency);
          return (
            <>
              <p>
                {t("openingOfPeriod")}: <strong>{money(data.openingBalance)}</strong>
              </p>
              {data.entries.length === 0 ? (
                <p className="chu-thich">{t("noEntries")}</p>
              ) : (
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
                      {data.entries.map((entry) => (
                        <tr key={entry.paymentId}>
                          <td data-nhan={headings[0]}>
                            <span>{formatDate(entry.date)}</span>
                          </td>
                          <td data-nhan={headings[1]}>
                            <Link href={`/payments/${entry.paymentId}`}>{entry.documentNo}</Link>
                          </td>
                          <td data-nhan={headings[2]}>
                            <span>{entry.partnerName ?? payments("withoutPartner")}</span>
                          </td>
                          <td data-nhan={headings[3]}>
                            <span>{entry.receipt === "0" ? "—" : money(entry.receipt)}</span>
                          </td>
                          <td data-nhan={headings[4]}>
                            <span>{entry.payment === "0" ? "—" : money(entry.payment)}</span>
                          </td>
                          <td data-nhan={headings[5]}>
                            <span>{money(entry.balance)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p>
                {t("closingOfPeriod")}: <strong>{money(data.closingBalance)}</strong>
              </p>
            </>
          );
        }}
      </Loaded>
    </>
  );
}
