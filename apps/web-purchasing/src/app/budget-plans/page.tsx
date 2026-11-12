"use client";

// MAN_HINH_204 Danh sách kế hoạch ngân sách mua (CHUC_NANG_207; API_235).
import { budgetDocumentStatuses, type BudgetPlanListItem, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { BudgetStatus, monthLabel, numericCell } from "@/components/BudgetStatus";

export default function BudgetPlansPage() {
  const t = useTranslations("budgets");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const thisYear = new Date().getFullYear();
  const [status, setStatus] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  if (year) parameters.set("year", year);
  const { state, reload } = useApi<PageResponse<BudgetPlanListItem>>(`/purchasing/budget-plans?${parameters}`);
  const headings = [t("documentNo"), t("period"), t("total"), t("used"), t("remaining"), t("createdBy"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="budget_plan" />
        {can("purchasing.budget.manage") && (
          <Link className="nut chinh" href="/budget-plans/new">
            {t("add")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-nam">
          {t("period")}
        </label>
        <select
          id="loc-nam"
          className="o-nhap"
          style={{ width: "auto" }}
          value={year}
          onChange={(event) => {
            setYear(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("period")}: ${common("all")}`}</option>
          {[thisYear + 1, thisYear, thisYear - 1].map((item) => (
            <option key={item} value={item}>
              {t("year", { year: item })}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {budgetDocumentStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status || year ? common("noResult") : t("none")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {headings.map((heading, index) => (
                        <th key={index} scope="col">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={headings[0]}>
                          <Link href={`/budget-plans/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>
                            {monthLabel(item.fromMonth)} – {monthLabel(item.toMonth)}
                          </span>
                        </td>
                        <td data-nhan={headings[2]} style={numericCell}>
                          <span>{formatMoney(item.totalAmount, item.currency)}</span>
                        </td>
                        <td data-nhan={headings[3]} style={numericCell}>
                          <span>{item.usedAmount === null ? common("none") : formatMoney(item.usedAmount, item.currency)}</span>
                        </td>
                        <td data-nhan={headings[4]} style={numericCell}>
                          <span>{item.usedAmount === null ? common("none") : formatMoney(String(Number(item.totalAmount) - Number(item.usedAmount)), item.currency)}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span>{item.createdByName}</span>
                        </td>
                        <td data-nhan={headings[6]}>
                          <BudgetStatus status={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <span className="chu-thich">{t("unit", { currency: result.data[0]!.currency })}</span>
            </>
          )
        }
      </Loaded>
    </>
  );
}
