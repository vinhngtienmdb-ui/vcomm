"use client";

// MAN_HINH_39 Đề nghị mua (CHUC_NANG_50; API_74): danh sách lọc trạng thái; lập đề nghị.
import { purchaseDocumentStatuses, type PageResponse, type RequisitionListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PurchaseStatus } from "@/components/PurchaseStatus";
import { RequisitionDrawer } from "@/components/RequisitionDrawer";

export default function RequisitionsPage() {
  const t = useTranslations("requisitions");
  const purchasing = useTranslations("purchasing");
  const common = useTranslations("common");
  const router = useRouter();
  const { can } = useAdmin();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status === "open") parameters.set("openOnly", "true");
  else if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<RequisitionListItem>>(`/purchasing/requisitions?${parameters}`);
  const headings = [t("documentNo"), t("reason"), t("warehouse"), t("neededBy"), t("estimatedTotal"), t("createdBy"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="requisition" />
        {can("purchasing.requisition.create") && (
          <button type="button" className="nut chinh" onClick={() => setAdding(true)}>
            {t("add")}
          </button>
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
          <option value="open">{t("openOnly")}</option>
          {purchaseDocumentStatuses
            .filter((item) => item !== "received")
            .map((item) => (
              <option key={item} value={item}>
                {purchasing(`status_${item}`)}
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
                        <Link href={`/requisitions/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.reason}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.warehouseName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{formatDate(item.neededBy)}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{formatMoney(item.estimatedTotal, "VND")}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>
                          {item.createdByName}
                          <span className="chu-thich"> · {formatDateTime(item.createdAt)}</span>
                        </span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <PurchaseStatus status={item.status} />
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
      {adding && <RequisitionDrawer requisition={null} onClose={() => setAdding(false)} onSaved={(saved) => router.push(`/requisitions/${saved.id}`)} />}
    </>
  );
}
