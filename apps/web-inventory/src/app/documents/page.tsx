"use client";

// MAN_HINH_31 Danh sách phiếu kho (CHUC_NANG_40, 41; API_65): lọc loại, trạng thái, kho; lập phiếu mới.
import { stockDocumentStatuses, stockDocumentTypes, type PageResponse, type StockDocumentListItem, type WarehouseResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { HistoryLink } from "ui/components/HistoryLink";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DocumentStatusBadge } from "@/components/DocumentStatus";

export default function DocumentsPage() {
  const t = useTranslations("documents");
  const common = useTranslations("common");
  const { can } = useAdmin();
  const warehouses = useApi<WarehouseResponse[]>("/inventory/warehouses");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [page, setPage] = useState(1);
  const parameters = new URLSearchParams({ page: String(page) });
  if (type) parameters.set("type", type);
  if (status) parameters.set("status", status);
  if (warehouseId) parameters.set("warehouseId", warehouseId);
  const { state, reload } = useApi<PageResponse<StockDocumentListItem>>(`/inventory/documents?${parameters}`);
  const headings = [t("documentNo"), t("type"), t("date"), t("warehouse"), t("owner"), t("reason"), t("status"), t("value"), t("createdBy")];
  const filter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <HistoryLink entityType="stock_document" />
        {can("inventory.document.manage") &&
          (["receipt_other", "issue_other", "adjustment", "transfer"] as const).map((item, index) => (
            <Link key={item} className={`nut ${index === 0 ? "chinh" : "phu"}`} href={`/documents/new?type=${item}`}>
              {t(`new_${item}`)}
            </Link>
          ))}
      </div>
      <div className="bo-loc">
        {(
          [
            ["loc-loai", t("type"), type, filter(setType), stockDocumentTypes.map((item) => [item, t(`type_${item}`)])],
            ["loc-trang-thai", t("status"), status, filter(setStatus), stockDocumentStatuses.map((item) => [item, t(`status_${item}`)])],
            ["loc-kho", t("warehouse"), warehouseId, filter(setWarehouseId), warehouses.state.kind === "ready" ? warehouses.state.data.map((item) => [item.id, `${item.code} · ${item.name}`]) : []],
          ] as const
        ).map(([id, label, value, onChange, options]) => (
          <span key={id}>
            <label className="an-nhan" htmlFor={id}>
              {label}
            </label>
            <select id={id} className="o-nhap" style={{ width: "auto" }} value={value} onChange={(event) => onChange(event.target.value)}>
              <option value="">{`${label}: ${common("all")}`}</option>
              {options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>
                  {optionLabel}
                </option>
              ))}
            </select>
          </span>
        ))}
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={type || status || warehouseId ? common("noResult") : t("none")} />
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
                        <Link href={`/documents/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <span>{t(`type_${item.type}`)}</span>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{formatDate(item.documentDate)}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {item.warehouseName}
                          {item.destinationWarehouseName && ` → ${item.destinationWarehouseName}`}
                        </span>
                      </td>
                      <td data-nhan={headings[4]}>
                        <span>{item.companyName}</span>
                      </td>
                      <td data-nhan={headings[5]}>
                        <span>{item.reason}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <DocumentStatusBadge status={item.status} type={item.type} />
                      </td>
                      <td data-nhan={headings[7]}>
                        <span>{item.totalValue === null ? "—" : formatMoney(item.totalValue, "VND")}</span>
                      </td>
                      <td data-nhan={headings[8]}>
                        <span>{item.createdByName}</span>
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
