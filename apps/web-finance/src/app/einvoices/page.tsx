"use client";

// MAN_HINH_54 Hóa đơn điện tử (CHUC_NANG_77, 79; API_91): danh sách lọc trạng thái, quá hạn, khoảng ngày, người mua.
import { einvoiceStatuses, type EinvoiceListItem, type EinvoiceStatus, type PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Loaded, LoadingView, MessageView } from "ui/components/StatusViews";
import { formatDate, formatNumber } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { EinvoiceStatusBadge } from "@/components/EinvoiceStatusBadge";

export default function EinvoicesPage() {
  return (
    <Suspense fallback={<LoadingView />}>
      <EinvoiceList />
    </Suspense>
  );
}

function EinvoiceList() {
  const t = useTranslations("einvoices");
  const common = useTranslations("common");
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<EinvoiceStatus | "">("");
  const [overdue, setOverdue] = useState(searchParams.get("overdue") === "true");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({
    page: String(page),
    ...(status ? { status } : {}),
    ...(overdue ? { overdue: "true" } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  });
  const { state, reload } = useApi<PageResponse<EinvoiceListItem>>(`/finance/einvoices?${query.toString()}`);
  const filter =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  const headings = [t("invoiceDate"), t("number"), t("buyer"), t("sourceDocument"), t("totalAmount"), t("kind"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="loc-trang-thai-hd">
          {t("status")}
        </label>
        <select id="loc-trang-thai-hd" className="o-nhap" style={{ width: "auto" }} value={status} onChange={(event) => filter(setStatus)(event.target.value as EinvoiceStatus | "")}>
          <option value="">{t("allStatuses")}</option>
          {einvoiceStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
        <label htmlFor="loc-tu-ngay-hd">{t("from")}</label>
        <input id="loc-tu-ngay-hd" type="date" className="o-nhap" style={{ width: "auto" }} value={from} onChange={(event) => filter(setFrom)(event.target.value)} />
        <label htmlFor="loc-den-ngay-hd">{t("to")}</label>
        <input id="loc-den-ngay-hd" type="date" className="o-nhap" style={{ width: "auto" }} value={to} onChange={(event) => filter(setTo)(event.target.value)} />
        <label className="an-nhan" htmlFor="loc-tim-hd">
          {t("search")}
        </label>
        <input id="loc-tim-hd" className="o-nhap" style={{ width: "auto" }} placeholder={t("searchHint")} value={search} onChange={(event) => filter(setSearch)(event.target.value)} />
        <label>
          <input type="checkbox" checked={overdue} onChange={(event) => filter(setOverdue)(event.target.checked)} /> {t("onlyOverdue")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={t("none")} />
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
                        <span>{formatDate(item.invoiceDate)}</span>
                      </td>
                      <td data-nhan={headings[1]}>
                        <Link href={`/einvoices/${item.id}`}>{item.invoiceNo ? `${item.series} · ${item.invoiceNo}` : t("noNumber")}</Link>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{item.buyerName || t("anonymousBuyer")}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.sourceDocumentNo ?? "—"}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {formatNumber(item.totalAmount)} {item.currency}
                        </span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{t(`kind_${item.kind}`)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <EinvoiceStatusBadge status={item.status} overdue={item.overdue} />
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
