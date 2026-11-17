"use client";

// MAN_HINH_245 Thống kê sử dụng trợ lý AI (CHUC_NANG_229; API_279). Chỉ số lượt, token, chi phí, đánh giá; không có nội dung hội thoại.
import { aiFeatures, aiFeedbackReasons, type AiFeature, type AiUsageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useAdmin } from "@/components/AdminShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload } from "ui/lib/api";
import { formatDate, formatMoney, formatNumber, vietnamToday } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

// 12 tháng gần nhất theo giờ Việt Nam.
function recentMonths(): string[] {
  const [year, month] = vietnamToday().split("-").map(Number) as [number, number];
  return Array.from({ length: 12 }, (_value, index) => {
    const total = year * 12 + (month - 1) - index;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
  });
}

export default function AiUsagePage() {
  const t = useTranslations("aiUsage");
  const assistant = useTranslations("aiAssistant");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const months = recentMonths();
  const [month, setMonth] = useState(months[0]!);
  const [feature, setFeature] = useState<AiFeature | "">("");
  const [exporting, setExporting] = useState(false);
  const query = `month=${month}${feature ? `&feature=${feature}` : ""}`;
  const { state, reload } = useApi<AiUsageResponse>(`/ai/usage?${query}`);
  const usd = (value: string) => `${formatNumber(value, 2)} USD`;
  const monthLabel = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;

  async function exportFile() {
    setExporting(true);
    try {
      await apiDownload(`/ai/usage?${query}&format=xlsx`, `thong-ke-tro-ly-ai-${month}.xlsx`);
    } catch (error) {
      notify(failureOf(error).message, "loi");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div className="tieu-de">
        <h1 style={{ flex: 1 }}>{t("title")}</h1>
        <button type="button" className={`nut phu${exporting ? " dang-xu-ly" : ""}`} disabled={exporting} onClick={() => void exportFile()}>
          {t("export")}
        </button>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="thang">
          {t("month")}
        </label>
        <select id="thang" className="o-nhap" style={{ width: "auto" }} value={month} onChange={(event) => setMonth(event.target.value)}>
          {months.map((value) => (
            <option key={value} value={value}>
              {`${t("month")} ${monthLabel(value)}`}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="tinh-nang">
          {t("feature")}
        </label>
        <select id="tinh-nang" className="o-nhap" style={{ width: "auto" }} value={feature} onChange={(event) => setFeature(event.target.value as AiFeature | "")}>
          <option value="">{t("allFeatures")}</option>
          {aiFeatures.map((item) => (
            <option key={item} value={item}>
              {t(`feature_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="khoi-canh-bao thong-tin" role="note">
        {t("privacy")}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) => {
          if (data.totals.turns === 0) return <MessageView text={t("empty", { month: monthLabel(data.month) })} />;
          const budget = Number(data.budgetUsd);
          const percent = budget > 0 ? Math.min(100, (Number(data.totals.costUsd) / budget) * 100) : 0;
          const maxDay = Math.max(...data.byDay.map((row) => Number(row.costUsd)), 0.000001);
          const rated = data.feedback.up + data.feedback.down;
          const headings = [t("user"), t("turns"), t("inputTokens"), t("outputTokens"), t("cost"), t("feedback")];
          return (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--khoang-3)" }}>
                <section className="the">
                  <span className="chu-thich">{t("costVsBudget")}</span>
                  <strong style={{ fontSize: 22, lineHeight: "28px" }}>
                    {usd(data.totals.costUsd)} / {budget > 0 ? usd(data.budgetUsd) : common("none")}
                  </strong>
                  {budget > 0 && (
                    <div role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 999, background: "var(--mau-vien)" }}>
                      <div style={{ width: `${percent}%`, height: "100%", borderRadius: 999, background: percent >= 100 ? "var(--mau-loi)" : "var(--mau-chinh)" }} />
                    </div>
                  )}
                  {data.usdToVnd && (
                    <span className="chu-thich">
                      {t("vnd", { amount: formatMoney(String(Math.round(Number(data.totals.costUsd) * Number(data.usdToVnd.rate))), "VND"), date: formatDate(data.usdToVnd.date) })}
                    </span>
                  )}
                </section>
                <section className="the">
                  <span className="chu-thich">{t("turns")}</span>
                  <strong style={{ fontSize: 22, lineHeight: "28px" }}>{formatNumber(data.totals.turns)}</strong>
                  <span className="chu-thich">
                    {data.byFeature.map((row) => `${t(`feature_${row.feature}`)} ${formatNumber(row.turns)}`).join(" · ")} · {t("errors", { count: data.totals.errors })} ·{" "}
                    {t("refusals", { count: data.totals.refusals })}
                  </span>
                </section>
                <section className="the">
                  <span className="chu-thich">{t("users")}</span>
                  <strong style={{ fontSize: 22, lineHeight: "28px" }}>{formatNumber(data.totals.users)}</strong>
                </section>
                <section className="the">
                  <span className="chu-thich">{t("feedback")}</span>
                  <strong style={{ fontSize: 22, lineHeight: "28px" }}>{rated > 0 ? t("correctPercent", { percent: formatNumber((data.feedback.up / rated) * 100, 0) }) : common("none")}</strong>
                  <span className="chu-thich">
                    {t("upDown", { up: data.feedback.up, down: data.feedback.down })}
                    {data.feedback.down > 0 &&
                      ` (${aiFeedbackReasons
                        .filter((reason) => data.feedback.byReason[reason] > 0)
                        .map((reason) => `${assistant(`reason_${reason}`)} ${data.feedback.byReason[reason]}`)
                        .join(", ")})`}
                  </span>
                </section>
              </div>
              <section className="the">
                <h2 style={{ margin: 0 }}>{t("byDay")}</h2>
                <div role="img" aria-label={t("byDayLabel", { month: monthLabel(data.month) })} style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
                  {data.byDay.map((row) => (
                    <div
                      key={row.day}
                      title={`${formatDate(row.day)}: ${usd(row.costUsd)} · ${row.turns} ${t("turns").toLowerCase()}`}
                      style={{ flex: 1, minWidth: 4, height: `${Math.max(2, (Number(row.costUsd) / maxDay) * 100)}%`, background: "var(--mau-chinh)", borderRadius: "3px 3px 0 0" }}
                    />
                  ))}
                </div>
                <span className="chu-thich">
                  {formatDate(data.byDay[0]!.day)} → {formatDate(data.byDay.at(-1)!.day)}
                </span>
              </section>
              <section className="the">
                <h2 style={{ margin: 0 }}>{t("byUser")}</h2>
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
                      {data.byUser.map((row) => (
                        <tr key={row.userId}>
                          <td data-nhan={headings[0]}>
                            <span>{row.fullName}</span>
                          </td>
                          <td data-nhan={headings[1]} className="so-tien">
                            <span>{formatNumber(row.turns)}</span>
                          </td>
                          <td data-nhan={headings[2]} className="so-tien">
                            <span>{formatNumber(row.inputTokens)}</span>
                          </td>
                          <td data-nhan={headings[3]} className="so-tien">
                            <span>{formatNumber(row.outputTokens)}</span>
                          </td>
                          <td data-nhan={headings[4]} className="so-tien">
                            <span>{formatNumber(row.costUsd, 2)}</span>
                          </td>
                          <td data-nhan={headings[5]}>
                            <span>{row.up + row.down > 0 ? `${row.up} / ${row.down}` : common("none")}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          );
        }}
      </Loaded>
    </>
  );
}
