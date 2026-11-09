"use client";

// MAN_HINH_27 Phiếu điều chỉnh giá, danh sách (CHUC_NANG_37; API_62).
import { priceChangeStatuses, type PageResponse, type PriceChangeListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatDateTime } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { PriceChangeStatusBadge } from "@/components/PriceChangeStatus";

export default function PriceChangesPage() {
  const t = useTranslations("priceChanges");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page) });
  if (status) parameters.set("status", status);
  const { state, reload } = useApi<PageResponse<PriceChangeListItem>>(`/catalog/price-changes?${parameters}`);
  const headings = [t("changeNo"), t("priceList"), t("effectiveFrom"), t("lineCount"), t("status"), t("requestedBy"), t("createdAt")];

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="price_change" />
        {can("catalog.price.manage") && (
          <Link className="nut chinh" href="/price-changes/new">
            {t("add")}
          </Link>
        )}
      </div>
      <div className="chu-thich">{t("hint")}</div>
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
          {priceChangeStatuses.map((item) => (
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
                        <Link href={`/price-changes/${item.id}`}>{item.changeNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{item.priceListName}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatDate(item.effectiveFrom)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.lineCount}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <PriceChangeStatusBadge status={item.status} />
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{item.requestedByName}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{formatDateTime(item.createdAt)}</span>
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
