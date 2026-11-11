"use client";

// MAN_HINH_150 Nghĩa vụ điểm (CONG_VIEC_51; CHUC_NANG_181; API_182; QUYTAC_NGHIEPVU_355): phát hành, dùng, hết hạn, điều chỉnh, số dư cuối theo tháng; số dư hiện tại.
import type { LoyaltyLiabilityResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

const signed = (value: number) => (value > 0 ? `+${formatNumber(value, 0)}` : formatNumber(value, 0));

export default function LoyaltyLiabilityPage() {
  const t = useTranslations("loyalty");
  const thisYear = Number(vietnamToday().slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { state, reload } = useApi<LoyaltyLiabilityResponse>(`/loyalty/liability?year=${year}`);
  return (
    <>
      <div className="tieu-de">
        <h1>{t("liabilityTitle")}</h1>
      </div>
      <span style={{ display: "grid", gap: "var(--khoang-1)", maxWidth: "10rem" }}>
        <label htmlFor="nam-nghia-vu">{t("year")}</label>
        <select id="nam-nghia-vu" className="o-nhap" value={year} onChange={(event) => setYear(Number(event.target.value))}>
          {[thisYear, thisYear - 1, thisYear - 2].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </span>
      <Loaded state={state} onRetry={() => void reload()}>
        {(report) => (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--khoang-3)" }}>
              <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
                <span className="chu-thich">{t("currentLiability")}</span>
                <strong style={{ fontSize: "24px" }}>{t("pointsValue", { points: formatNumber(report.currentPoints, 0) })}</strong>
                <span className="chu-thich">{t("currentLiabilityValue", { value: formatNumber(report.currentValue, 0) })}</span>
              </div>
              <div className="the" style={{ display: "grid", gap: "var(--khoang-1)" }}>
                <span className="chu-thich">{t("expiringSoon")}</span>
                <strong style={{ fontSize: "24px" }}>{t("pointsValue", { points: formatNumber(report.expiringPoints, 0) })}</strong>
              </div>
            </div>
            {report.months.length === 0 ? (
              <MessageView text={t("noLiability")} />
            ) : (
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {(["month", "issued", "used", "expired", "adjusted", "closingPoints", "closingValue"] as const).map((key) => (
                        <th key={key}>{t(`liability_${key}`)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.months.map((row) => (
                      <tr key={row.month}>
                        <td data-nhan={t("liability_month")}>{row.month.split("-").reverse().join("/")}</td>
                        <td data-nhan={t("liability_issued")}>{signed(row.issued)}</td>
                        <td data-nhan={t("liability_used")}>{signed(row.used)}</td>
                        <td data-nhan={t("liability_expired")}>{signed(row.expired)}</td>
                        <td data-nhan={t("liability_adjusted")}>{signed(row.adjusted)}</td>
                        <td data-nhan={t("liability_closingPoints")}>{formatNumber(row.closingPoints, 0)}</td>
                        <td data-nhan={t("liability_closingValue")}>{formatNumber(row.closingValue, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="khoi-canh-bao thong-tin">{t("liabilityHint")}</div>
          </>
        )}
      </Loaded>
    </>
  );
}
