"use client";

// MAN_HINH_56 Hoa hồng (CHUC_NANG_82, 83; API_94): thẻ bảng hoa hồng tháng, thẻ phát sinh lọc khoảng ngày.
import type { CommissionEventItem, CommissionTargetsResponse, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CommissionStatements } from "@/components/CommissionStatements";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber, vietnamToday } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function CommissionsPage() {
  const t = useTranslations("commissions");
  const [tab, setTab] = useState<"statements" | "events">("statements");
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="cac-the" role="tablist">
        {(["statements", "events"] as const).map((key) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "chon" : ""} onClick={() => setTab(key)}>
            {t(`tab_${key}`)}
          </button>
        ))}
      </div>
      {tab === "statements" ? <CommissionStatements /> : <CommissionEvents />}
    </>
  );
}

function CommissionEvents() {
  const t = useTranslations("commissions");
  const common = useTranslations("common");
  const [userId, setUserId] = useState("");
  const staff = useApi<CommissionTargetsResponse>(`/finance/commission-targets?month=${vietnamToday().slice(0, 7)}`);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), ...(userId ? { userId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const { state, reload } = useApi<PageResponse<CommissionEventItem>>(`/finance/commissions/events?${query.toString()}`);
  const headings = [t("eventDate"), t("staff"), t("source"), t("order"), t("item"), t("baseAmount"), t("percent"), t("amount"), t("statement")];
  return (
    <>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="hh-nhan-vien">
          {t("staff")}
        </label>
        <select id="hh-nhan-vien" className="o-nhap" style={{ width: "auto" }} value={userId} onChange={(event) => (setUserId(event.target.value), setPage(1))}>
          <option value="">{t("allStaff")}</option>
          {(staff.state.kind === "ready" ? staff.state.data.staff : []).map((item) => (
            <option key={item.userId} value={item.userId}>
              {item.fullName}
            </option>
          ))}
        </select>
        <label htmlFor="hh-tu-ngay">{t("from")}</label>
        <input id="hh-tu-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => (setFrom(event.target.value), setPage(1))} />
        <label htmlFor="hh-den-ngay">{t("to")}</label>
        <input id="hh-den-ngay" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => (setTo(event.target.value), setPage(1))} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("noEvents")} />
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
                  {result.data.map((item) => (
                    <tr key={item.id}>
                      <td data-nhan={headings[0]}>
                        <span>{formatDate(item.eventDate)}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.userName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>
                          {t(`source_${item.sourceType}`)}
                          {item.sourceNo && <span className="chu-thich"> · {item.sourceNo}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.orderNo ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.itemName}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.baseAmount)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{formatNumber(item.percent)}%</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span style={{ whiteSpace: "nowrap" }}>{formatNumber(item.amount)}</span>
                      </td>
                      <td data-nhan={headings[8]}>
                        <span>{item.statementNo ?? t("notInStatement")}</span>
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
          )
        }
      </Loaded>
    </>
  );
}
