"use client";

// Bộ lọc chung của báo cáo quản trị (CONG_VIEC_50; QUYTAC_NGHIEPVU_336, 343): công ty trong phạm vi quyền của nhóm báo cáo, khoảng ngày.
import { analyticsMaximumDays, type AnalyticsReportKind, type AnalyticsScopeResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";

export interface ReportSelection {
  scope: AnalyticsScopeResponse;
  // Chuỗi truy vấn chung đã chọn: companyIds, from, to.
  query: URLSearchParams;
}

const dayCount = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

// Lỗi khoảng ngày hiện tại ô đến ngày; null khi hợp lệ.
export function periodError(from: string, to: string): "analyticsPeriodReversed" | "analyticsPeriodTooLong" | "required" | null {
  if (!from || !to) return "required";
  if (from > to) return "analyticsPeriodReversed";
  return dayCount(from, to) > analyticsMaximumDays ? "analyticsPeriodTooLong" : null;
}

export function ReportFilters({
  kind,
  withPeriod,
  extra,
  children,
}: {
  kind: AnalyticsReportKind | null;
  withPeriod: boolean;
  extra?: ReactNode;
  children: (selection: ReportSelection) => ReactNode;
}) {
  const t = useTranslations("analytics");
  const errors = useTranslations("errors");
  const { state, reload } = useApi<AnalyticsScopeResponse>("/analytics/scope");
  const [companyId, setCompanyId] = useState("");
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const [applied, setApplied] = useState<{ from: string; to: string } | null>(null);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(scope) => {
        const allowed = kind ? scope.reports[kind] : scope.companies.map((company) => company.id);
        const companies = scope.companies.filter((company) => allowed.includes(company.id));
        if (companies.length === 0) return <MessageView text={t("noCompany")} />;
        const monthStart = `${scope.today.slice(0, 8)}01`;
        const current = draft ?? { from: monthStart, to: scope.today };
        const period = applied ?? { from: monthStart, to: scope.today };
        const error = withPeriod ? periodError(current.from, current.to) : null;
        const query = new URLSearchParams(companyId ? { companyIds: companyId } : {});
        if (withPeriod) {
          query.set("from", period.from);
          query.set("to", period.to);
        }
        return (
          <>
            <div className="the">
              <form
                className="bo-loc"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!error) setApplied(current);
                }}
              >
                <label className="an-nhan" htmlFor="loc-cong-ty">
                  {t("company")}
                </label>
                <select id="loc-cong-ty" className="o-nhap" value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
                  {companies.length > 1 && <option value="">{t("allCompanies", { count: companies.length })}</option>}
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.code} · {company.name}
                    </option>
                  ))}
                </select>
                {withPeriod && (
                  <>
                    <label className="an-nhan" htmlFor="tu-ngay">
                      {t("from")}
                    </label>
                    <input id="tu-ngay" type="date" className="o-nhap" value={current.from} onChange={(event) => setDraft({ ...current, from: event.target.value })} />
                    <label className="an-nhan" htmlFor="den-ngay">
                      {t("to")}
                    </label>
                    <input
                      id="den-ngay"
                      type="date"
                      className={`o-nhap${error ? " loi" : ""}`}
                      value={current.to}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "loi-ngay" : undefined}
                      onChange={(event) => setDraft({ ...current, to: event.target.value })}
                    />
                  </>
                )}
                {extra}
                {withPeriod && (
                  <button type="submit" className="nut chinh" disabled={Boolean(error)}>
                    {t("view")}
                  </button>
                )}
              </form>
              {error && (
                <span id="loi-ngay" className="loi-o">
                  {errors(error)}
                </span>
              )}
            </div>
            {children({ scope, query })}
          </>
        );
      }}
    </Loaded>
  );
}
