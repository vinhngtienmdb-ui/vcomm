"use client";

// MAN_HINH_64 Danh sách phiếu giao khách (CHUC_NANG_97; API_110): lọc trạng thái; lập phiếu khi là trưởng phòng hoặc có quyền giao khách.
import { customerAssignmentStatuses, type CustomerAssignmentListItem, type CustomerAssignmentOptionsResponse, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { AssignmentStatusBadge } from "@/components/AssignmentStatusBadge";

export default function CustomerAssignmentsPage() {
  const t = useTranslations("customerAssignments");
  const common = useTranslations("common");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<CustomerAssignmentListItem>>(`/crm/customer-assignments?${parameters}`);
  const options = useApi<CustomerAssignmentOptionsResponse>("/crm/customer-assignment-options");
  const headings = [t("documentNo"), t("target"), t("customers"), t("reason"), t("createdBy"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        {options.state.kind === "ready" && (
          <Link className="nut chinh" href="/customer-assignments/new">
            {t("create")}
          </Link>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="gk-trang-thai">
          {t("status")}
        </label>
        <select
          id="gk-trang-thai"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {customerAssignmentStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status ? common("noResult") : t("none")} />
          ) : (
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
                        <Link href={`/customer-assignments/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.targetUserName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.customerCount}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.reason}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>
                          {item.createdByName}
                          <span className="chu-thich"> · {formatDateTime(item.createdAt)}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <AssignmentStatusBadge status={item.status} />
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
