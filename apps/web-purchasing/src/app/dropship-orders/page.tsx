"use client";

// MAN_HINH_235 Đơn dropship (CONG_VIEC_62 CHUC_NANG_223; API_267): đơn mua tự lập từ đơn bán kho Dropship, trạng thái giao, quá hạn, thiếu số hóa đơn nhà cung cấp.
import type { DropshipOptionsResponse, DropshipOrderListItem, DropshipStatus, PageResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDate, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { DropshipStatusBadge, dropshipStatuses } from "@/components/DropshipStatusBadge";

export default function DropshipOrdersPage() {
  const t = useTranslations("dropshipOrders");
  const common = useTranslations("common");
  const options = useApi<DropshipOptionsResponse>("/purchasing/dropship-options");
  const [status, setStatus] = useState<DropshipStatus | "">("");
  const [supplierId, setSupplierId] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [missingInvoiceOnly, setMissingInvoiceOnly] = useState(false);
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

  const parameters = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (status) parameters.set("status", status);
  if (supplierId) parameters.set("supplierId", supplierId);
  if (search) parameters.set("search", search);
  if (overdueOnly) parameters.set("overdueOnly", "true");
  if (missingInvoiceOnly) parameters.set("missingInvoiceOnly", "true");
  const { state, reload } = useApi<PageResponse<DropshipOrderListItem>>(`/purchasing/dropship-orders?${parameters}`);
  const suppliers = options.state.kind === "ready" ? options.state.data.suppliers : [];
  const filtered = Boolean(status || supplierId || search || overdueOnly || missingInvoiceOnly);

  const headings = [t("documentNo"), t("salesOrder"), t("supplier"), t("recipient"), t("lineCount"), t("totalAmount"), t("status"), t("orderDate")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <div className="bo-loc">
        <label className="an-nhan" htmlFor="tim-don-dropship">
          {common("search")}
        </label>
        <input
          id="tim-don-dropship"
          className="o-nhap"
          type="search"
          placeholder={t("searchHint")}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          style={{ maxWidth: 320 }}
        />
        <label className="an-nhan" htmlFor="loc-ncc-don-dropship">
          {t("supplier")}
        </label>
        <select
          id="loc-ncc-don-dropship"
          className="o-nhap"
          style={{ width: "auto" }}
          value={supplierId}
          onChange={(event) => {
            setSupplierId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{`${t("supplier")}: ${common("all")}`}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        <label className="an-nhan" htmlFor="loc-trang-thai-don-dropship">
          {t("status")}
        </label>
        <select
          id="loc-trang-thai-don-dropship"
          className="o-nhap"
          style={{ width: "auto" }}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as DropshipStatus | "");
            setPage(1);
          }}
        >
          <option value="">{`${t("status")}: ${common("all")}`}</option>
          {dropshipStatuses.map((item) => (
            <option key={item} value={item}>
              {t(`status_${item}`)}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(event) => {
              setOverdueOnly(event.target.checked);
              setPage(1);
            }}
          />{" "}
          {t("overdueOnly")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={missingInvoiceOnly}
            onChange={(event) => {
              setMissingInvoiceOnly(event.target.checked);
              setPage(1);
            }}
          />{" "}
          {t("missingInvoiceOnly")}
        </label>
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(result) =>
          result.data.length === 0 ? (
            <MessageView text={filtered ? common("noResults") : t("empty")} />
          ) : (
            <div className="khung-bang">
              <table>
                <thead>
                  <tr>
                    {headings.map((heading, index) => (
                      <th key={index} scope="col" style={index === 4 || index === 5 ? { textAlign: "right" } : undefined}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((order) => (
                    <tr key={order.id}>
                      <td data-nhan={headings[0]}>
                        <Link href={`/dropship-orders/${order.id}`}>{order.documentNo}</Link>
                      </td>
                      <td data-nhan={headings[1]}>
                        <a href={`/sales/orders/${order.salesOrderId}`}>{order.salesOrderNo ?? "—"}</a>
                      </td>
                      <td data-nhan={headings[2]}>
                        <span>{order.supplierName}</span>
                      </td>
                      <td data-nhan={headings[3]}>
                        <span>
                          {order.recipientName ?? "—"}
                          {order.deliveryAddress && <span className="chu-thich"> · {order.deliveryAddress}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[4]} style={{ textAlign: "right" }}>
                        <span>{order.lineCount}</span>
                      </td>
                      <td data-nhan={headings[5]} style={{ textAlign: "right" }}>
                        <span>{formatMoney(order.totalAmount, order.currency)}</span>
                      </td>
                      <td data-nhan={headings[6]}>
                        <span className="nhom-nut">
                          <DropshipStatusBadge status={order.status} />
                          {order.overdue && <span className="nhan loi">{t("overdue")}</span>}
                          {order.status === "delivered" && !order.supplierInvoiceNo && <span className="nhan canh-bao">{t("noInvoice")}</span>}
                        </span>
                      </td>
                      <td data-nhan={headings[7]}>
                        <span>{formatDate(order.orderDate)}</span>
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
