"use client";

// MAN_HINH_47 Công nợ (CHUC_NANG_66; API_85): phải thu, phải trả theo đối tác kèm tuổi nợ; tìm, chỉ đối tác quá hạn.
import { type DebtSide, type DebtSummaryResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function DebtsPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <Debts />
    </Suspense>
  );
}

function Debts() {
  const t = useTranslations("debts");
  const [side, setSide] = useState<DebtSide>(useSearchParams().get("side") === "payable" ? "payable" : "receivable");
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const query = new URLSearchParams({ side, ...(search.trim() ? { search: search.trim() } : {}), ...(overdueOnly ? { overdueOnly: "true" } : {}) });
  const { state, reload } = useApi<DebtSummaryResponse>(`/finance/debts?${query.toString()}`);
  const headings = [t("partner"), t("balance"), t("advance"), t("notDue"), t("overdue1To30"), t("overdue31To60"), t("overdue61To90"), t("overdueOver90")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="debt_item" />
      </div>
      <div className="cac-the" role="tablist">
        {(["receivable", "payable"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={side === key} className={side === key ? "chon" : ""} onClick={() => setSide(key)}>
            {t(`side_${key}`)}
          </button>
        ))}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-doi-tac">
          {t("search")}
        </label>
        <input id="tim-doi-tac" className="o-nhap" style={{ width: "auto" }} placeholder={t("search")} value={search} onChange={(event) => setSearch(event.target.value)} />
        <label>
          <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} /> {t("overdueOnly")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => {
          const money = (value: string) => formatMoney(value, data.currency);
          const cells = (row: { balance: string; advance: string; notDue: string; overdue1To30: string; overdue31To60: string; overdue61To90: string; overdueOver90: string }) =>
            [row.balance, row.advance, row.notDue, row.overdue1To30, row.overdue31To60, row.overdue61To90, row.overdueOver90].map((value, index) => (
              <td key={headings[index + 1]} data-nhan={headings[index + 1]}>
                <span style={{ whiteSpace: "nowrap", ...(index >= 3 && Number(value) > 0 ? { color: "var(--mau-loi)" } : {}) }}>{money(value)}</span>
              </td>
            ));
          return data.partners.length === 0 ? (
            <MessageView text={t("none")} />
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
                  {data.partners.map((row) => (
                    <tr key={row.partnerId}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/debts/${row.partnerId}?side=${side}`}>
                          {row.partnerCode} · {row.partnerName}
                        </Link>
                      </td>
                      {cells(row)}
                    </tr>
                  ))}
                  <tr>
                    <td data-nhan={headings[0]}>
                      <strong>{t("total")}</strong>
                    </td>
                    {cells(data.totals)}
                  </tr>
                </tbody>
              </table>
            </div>
          );
        }}
      </Loaded>
    </>
  );
}
