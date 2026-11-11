"use client";

// MAN_HINH_163 Hóa đơn bán lẻ (CHUC_NANG_187; API_196): lọc ngày, tìm số hóa đơn, người mua.
import type { RetailSaleListResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";

export default function SalesPage() {
  const t = useTranslations("retailSales");
  const common = useTranslations("common");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), ...(search ? { search } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) });
  const { state, reload } = useApi<RetailSaleListResponse>(`/retail/sales?${query}`);
  const headings = [t("number"), t("soldAt"), t("store"), t("register"), t("cashier"), t("buyer"), t("total"), t("methods")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
      </div>
      <div className="bo-loc">
        <input className="o-nhap" type="search" aria-label={common("search")} placeholder={t("searchPlaceholder")} value={search} onChange={(event) => (setSearch(event.target.value), setPage(1))} />
        <input className="o-nhap" type="date" aria-label={t("from")} value={from} onChange={(event) => (setFrom(event.target.value), setPage(1))} />
        <input className="o-nhap" type="date" aria-label={t("to")} value={to} onChange={(event) => (setTo(event.target.value), setPage(1))} />
      </div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(data) =>
          data.items.length === 0 ? (
            <MessageView text={t("none")} />
          ) : (
            <>
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
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td data-nhan={headings[0]}>
                          <Link href={`/sales/${item.id}`}>{item.documentNo}</Link>
                        </td>
                        <td data-nhan={headings[1]}>
                          <span>{formatDateTime(item.soldAt)}</span>
                        </td>
                        <td data-nhan={headings[2]}>
                          <span>{item.storeName}</span>
                        </td>
                        <td data-nhan={headings[3]}>
                          <span>{item.registerCode}</span>
                        </td>
                        <td data-nhan={headings[4]}>
                          <span>{item.cashierName}</span>
                        </td>
                        <td data-nhan={headings[5]}>
                          <span>{item.buyerName ?? t("walkIn")}</span>
                        </td>
                        <td data-nhan={headings[6]} className="so-tien">
                          <span>{formatMoney(item.totalAmount, item.currency)}</span>
                        </td>
                        <td data-nhan={headings[7]}>
                          <span>{item.methods.map((method) => t(`method_${method}`)).join(", ")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="phan-trang">
                <span>{common("total", { count: data.total })}</span>
                <div className="nhom-nut">
                  <button type="button" className="nut phu" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    {common("previous")}
                  </button>
                  <button type="button" className="nut phu" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}>
                    {common("next")}
                  </button>
                </div>
              </div>
            </>
          )
        }
      </Loaded>
    </>
  );
}
