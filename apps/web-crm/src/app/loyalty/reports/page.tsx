"use client";

// MAN_HINH_222 Báo cáo liên minh và gian lận (CONG_VIEC_60; CHUC_NANG_216; API_253; QUYTAC_NGHIEPVU_478): hai thẻ, chọn năm, tháng; xuất Excel cả năm.
// Thẻ liên minh cần quyền xem bảng đối soát điểm nội bộ (theo công ty đang chọn); thẻ gian lận cần quyền xem điểm thưởng.
import type { LoyaltyAllianceReport, LoyaltyFraudReport } from "contracts";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded } from "ui/components/StatusViews";
import { apiDownload } from "ui/lib/api";
import { formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

type Tab = "alliance" | "fraud";
const amount = (value: string | number | null) => (value === null ? "—" : formatNumber(value));
const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

function ExportButton({ path, fileName }: { path: string; fileName: string }) {
  const t = useTranslations("loyaltyReports");
  const { notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`nut phu${busy ? " dang-xu-ly" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(path, fileName);
          notify(t("exported", { fileName }));
        } catch (error) {
          notify(failureOf(error).message, "loi");
        } finally {
          setBusy(false);
        }
      }}
    >
      {t("export")}
    </button>
  );
}

// Chọn tháng trong các tháng có số liệu; mặc định tháng mới nhất.
function MonthSelect({ months, value, onChange }: { months: string[]; value: string; onChange: (month: string) => void }) {
  const t = useTranslations("loyaltyReports");
  return (
    <>
      <label className="an-nhan" htmlFor="bc-thang">
        {t("month")}
      </label>
      <select id="bc-thang" className="o-nhap" style={{ width: "auto" }} value={value} onChange={(event) => onChange(event.target.value)}>
        {months.map((month) => (
          <option key={month} value={month}>
            {t("monthOption", { month: monthLabel(month) })}
          </option>
        ))}
      </select>
    </>
  );
}

function Alliance({ year, yearSelect }: { year: number; yearSelect: ReactNode }) {
  const t = useTranslations("loyaltyReports");
  const status = useTranslations("loyaltySettlements");
  const { state, reload } = useApi<LoyaltyAllianceReport>(`/loyalty/reports/alliance?year=${year}`);
  const [month, setMonth] = useState<string | null>(null);
  return (
    <Loaded state={state} onRetry={reload}>
      {(report) => {
        const months = [...new Set(report.rows.map((row) => row.month))];
        const current = month && months.includes(month) ? month : (months[0] ?? "");
        const rows = report.rows.filter((row) => row.month === current);
        const headings = [
          t("company"),
          t("earnedPoints"),
          t("lotValue"),
          t("costAmount"),
          t("redeemedPoints"),
          t("redeemedAmount"),
          t("receivable"),
          t("payable"),
          t("offset"),
          t("paid"),
          t("remaining"),
          t("settlement"),
        ];
        return (
          <>
            <div className="bo-loc">
              {yearSelect}
              {months.length > 0 ? <MonthSelect months={months} value={current} onChange={setMonth} /> : null}
              <ExportButton path={`/loyalty/reports/alliance?year=${year}&format=xlsx`} fileName={`bao-cao-lien-minh-diem-${year}.xlsx`} />
            </div>
            {rows.length === 0 ? (
              <div className="the chu-thich">{t("empty")}</div>
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {headings.map((heading, index) => (
                        <th key={heading} className={index > 0 && index < 11 ? "so" : undefined}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.companyId}>
                        <td data-nhan={headings[0]}>
                          {row.companyName}
                          {row.isOperator ? <div className="chu-thich">{t("operator")}</div> : null}
                        </td>
                        <td data-nhan={headings[1]} className="so">
                          {formatNumber(row.earnedPoints)}
                        </td>
                        <td data-nhan={headings[2]} className="so">
                          {amount(row.lotValue)}
                        </td>
                        <td data-nhan={headings[3]} className="so">
                          {amount(row.costAmount)}
                        </td>
                        <td data-nhan={headings[4]} className="so">
                          {formatNumber(row.redeemedPoints)}
                        </td>
                        <td data-nhan={headings[5]} className="so">
                          {amount(row.redeemedAmount)}
                        </td>
                        <td data-nhan={headings[6]} className="so">
                          {amount(row.receivable)}
                        </td>
                        <td data-nhan={headings[7]} className="so">
                          {amount(row.payable)}
                        </td>
                        <td data-nhan={headings[8]} className="so">
                          {amount(row.offset)}
                        </td>
                        <td data-nhan={headings[9]} className="so">
                          {amount(row.paid)}
                        </td>
                        <td data-nhan={headings[10]} className="so">
                          {amount(row.remaining)}
                        </td>
                        <td data-nhan={headings[11]}>
                          {row.settlementId ? (
                            <>
                              <a href={`/finance/loyalty-settlements/${row.settlementId}`}>{row.settlementNo}</a>
                              <div className="chu-thich">{status(`status_${row.settlementStatus}`)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="chu-thich">{report.isOperator ? t("allianceNote") : t("allianceNoteCompany")}</p>
          </>
        );
      }}
    </Loaded>
  );
}

function Fraud({ year, yearSelect }: { year: number; yearSelect: ReactNode }) {
  const t = useTranslations("loyaltyReports");
  const fraud = useTranslations("loyaltyFraud");
  const { state, reload } = useApi<LoyaltyFraudReport>(`/loyalty/reports/fraud?year=${year}`);
  const [month, setMonth] = useState<string | null>(null);
  return (
    <Loaded state={state} onRetry={reload}>
      {(report) => {
        const months = [...new Set([...report.rules.map((row) => row.month), ...report.top.map((row) => row.month)])].sort().reverse();
        const current = month && months.includes(month) ? month : (months[0] ?? "");
        const rules = report.rules.filter((row) => row.month === current);
        const top = report.top.filter((row) => row.month === current);
        const headings = [
          t("rule"),
          t("cases"),
          fraud("action_alert"),
          fraud("action_block"),
          fraud("action_block_and_lock"),
          fraud("status_violation"),
          fraud("status_no_violation"),
          t("blockedTransactions"),
          t("skippedEarns"),
          t("skippedPoints"),
          t("lockedWallets"),
        ];
        return (
          <>
            <div className="bo-loc">
              {yearSelect}
              {months.length > 0 ? <MonthSelect months={months} value={current} onChange={setMonth} /> : null}
              <ExportButton path={`/loyalty/reports/fraud?year=${year}&format=xlsx`} fileName={`bao-cao-gian-lan-diem-${year}.xlsx`} />
            </div>
            {rules.length === 0 ? (
              <div className="the chu-thich">{t("empty")}</div>
            ) : (
              <>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        {headings.map((heading, index) => (
                          <th key={heading} className={index > 0 ? "so" : undefined}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((row) => (
                        <tr key={row.ruleCode}>
                          <td data-nhan={headings[0]}>{fraud(`rule_${row.ruleCode}`)}</td>
                          {[row.cases, row.alert, row.block, row.blockAndLock, row.violation, row.noViolation, row.blockedTransactions, row.skippedEarns, row.skippedPoints, row.lockedWallets].map(
                            (value, index) => (
                              <td key={headings[index + 1]} data-nhan={headings[index + 1]} className="so">
                                {formatNumber(value)}
                              </td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="the">
                  <h2>{t("topTitle")}</h2>
                  {(["user", "device", "staff"] as const).map((kind) => {
                    const items = top.filter((row) => row.kind === kind);
                    return (
                      <div key={kind} style={{ display: "grid", gap: "var(--khoang-1)" }}>
                        <strong>{t(`top_${kind}`)}</strong>
                        {items.length === 0 ? (
                          <div className="chu-thich">—</div>
                        ) : (
                          <ol>
                            {items.map((row) => (
                              <li key={`${row.kind}-${row.label}`}>{t("topItem", { label: row.label, count: row.cases })}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        );
      }}
    </Loaded>
  );
}

export default function LoyaltyReportsPage() {
  const t = useTranslations("loyaltyReports");
  const thisYear = Number(vietnamToday().slice(0, 4));
  const [tab, setTab] = useState<Tab>("alliance");
  const [year, setYear] = useState(thisYear);
  const yearSelect = (
    <>
      <label className="an-nhan" htmlFor="bc-nam">
        {t("year")}
      </label>
      <select id="bc-nam" className="o-nhap" style={{ width: "auto" }} value={year} onChange={(event) => setYear(Number(event.target.value))}>
        {[thisYear, thisYear - 1, thisYear - 2].map((value) => (
          <option key={value} value={value}>
            {t("yearOption", { year: value })}
          </option>
        ))}
      </select>
    </>
  );
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="nhom-nut" role="tablist">
        {(["alliance", "fraud"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={`nut ${tab === item ? "chinh" : "phu"}`} onClick={() => setTab(item)}>
            {t(`tab_${item}`)}
          </button>
        ))}
      </div>
      {tab === "alliance" ? <Alliance key={`a-${year}`} year={year} yearSelect={yearSelect} /> : <Fraud key={`f-${year}`} year={year} yearSelect={yearSelect} />}
    </>
  );
}
