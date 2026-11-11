"use client";

// MAN_HINH_112 Chi phí nhập khẩu (CHUC_NANG_161; API_142): danh sách lọc trạng thái, tìm theo số chứng từ, hóa đơn, tờ khai, nhà cung cấp dịch vụ.
import { importDeclarationStatuses, type LandedCostListItem, type PageResponse, type PurchasingOptionsResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DeclarationStatus } from "@/components/DeclarationStatus";

export default function LandedCostsPage() {
  const t = useTranslations("landedCosts");
  const declarations = useTranslations("importDeclarations");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);
  const options = useApi<PurchasingOptionsResponse>("/purchasing/options");
  const companyCurrency = options.state.kind === "ready" ? options.state.data.currency : "VND";
  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  if (search) parameters.set("search", search);
  const { state, reload } = useApi<PageResponse<LandedCostListItem>>(`/purchasing/landed-costs?${parameters}`);
  const headings = [t("documentNo"), t("documentDate"), t("declaration"), t("supplier"), t("invoiceNo"), t("netAmount"), t("vatAmount"), t("status")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="landed_cost" />
        {can("purchasing.import.manage") && (
          <Link className="nut chinh" href="/landed-costs/new">
            {t("add")}
          </Link>
        )}
      </div>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("intro")}
      </p>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-chi-phi">
          {common("search")}
        </label>
        <input id="tim-chi-phi" className="o-nhap" type="search" placeholder={t("searchHint")} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} style={{ maxWidth: 320 }} />
        <label className="an-nhan" htmlFor="loc-trang-thai-chi-phi">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai-chi-phi"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {importDeclarationStatuses.map((item) => (
            <option key={item} value={item}>
              {declarations(`status_${item}`)}
            </option>
          ))}
        </select>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={status || search ? common("noResult") : t("none")} />
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
                        <Link href={`/landed-costs/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{formatDate(item.documentDate)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <Link href={`/import-declarations/${item.declarationId}`}>{item.declarationNo}</Link>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>{item.supplierName}</span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.invoiceNo}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{formatMoney(item.netAmount, companyCurrency)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span>{formatMoney(item.vatAmount, companyCurrency)}</span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <DeclarationStatus status={item.status} />
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
