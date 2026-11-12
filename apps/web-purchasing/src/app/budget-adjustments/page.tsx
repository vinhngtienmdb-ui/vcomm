"use client";

// MAN_HINH_207 Danh sách phiếu điều chỉnh ngân sách (CHUC_NANG_208; API_237).
import { budgetDocumentStatuses, type BudgetAdjustmentListItem, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { useApi } from "ui/lib/use-api";
import { AdjustmentTable } from "@/components/AdjustmentTable";

export default function BudgetAdjustmentsPage() {
  const t = useTranslations("budgetAdjustments");
  const budgets = useTranslations("budgets");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<BudgetAdjustmentListItem>>(`/purchasing/budget-adjustments?${parameters}`);
  const headings = [t("documentNo"), t("plan"), t("reason"), t("totalIncrease"), t("totalDecrease"), t("createdBy"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="budget_adjustment" />
        {can("purchasing.budget.manage") && (
          <Link className="nut chinh" href="/budget-adjustments/new">
            {t("add")}
          </Link>
        )}
      </div>
      <div className="bo-loc">
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
              {budgets(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status ? common("noResult") : t("none")} />
          ) : (
            <AdjustmentTable
              items={result.data}
              headings={headings}
              footer={
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
              }
            />
          )
        }
      </Loaded>
    </>
  );
}
