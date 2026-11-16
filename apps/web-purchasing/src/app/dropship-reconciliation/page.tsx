"use client";

// MAN_HINH_237 Đối soát nhà cung cấp dropship (CONG_VIEC_62 CHUC_NANG_223; QUYTAC_NGHIEPVU_504; API_270): theo kỳ, theo nhà cung cấp; chi tiết từng đơn; xuất Excel.
import type { DropshipOptionsResponse, DropshipReconciliationResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "ui/components/AppShell";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { apiDownload } from "ui/lib/api";
import { formatDate, formatMoney } from "ui/lib/format";
import { failureOf, useApi } from "ui/lib/use-api";

const firstOfMonth = () => `${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7)}-01`;
const lastOfMonth = () => {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

export default function DropshipReconciliationPage() {
  const t = useTranslations("dropshipReconciliation");
  const common = useTranslations("common");
  const { notify } = useAdmin();
  const options = useApi<DropshipOptionsResponse>("/purchasing/dropship-options");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(lastOfMonth());
  const [supplierId, setSupplierId] = useState("");
  const parameters = new URLSearchParams({ from, to });
  if (supplierId) parameters.set("supplierId", supplierId);
  const { state, reload } = useApi<DropshipReconciliationResponse>(`/purchasing/dropship-reconciliation?${parameters}`);
  const suppliers = options.state.kind === "ready" ? options.state.data.suppliers : [];

  const headings = [t("supplier"), t("deliveredCount"), t("receivedAmount"), t("returnedAmount"), t("missingInvoiceCount"), t("payableBalance")];
  const orderHeadings = [t("documentNo"), t("salesOrder"), t("deliveredOn"), t("receivedAmount"), t("returnedAmount"), t("supplierInvoiceNo")];
  return (
    <>
      <div className="tieu-de">
        <h1>{t("title")}</h1>
        <button
          type="button"
          className="nut phu"
          onClick={() =>
            void apiDownload(`/purchasing/dropship-reconciliation?${parameters}&format=xlsx`, `doi-soat-dropship-${from}-${to}.xlsx`).catch((error) => notify(failureOf(error).message, "loi"))
          }
        >
          {t("export")}
        </button>
      </div>
      <div className="bo-loc">
        <div className="truong">
          <label htmlFor="doi-soat-tu">{t("from")}</label>
          <input id="doi-soat-tu" type="date" className="o-nhap" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="truong">
          <label htmlFor="doi-soat-den">{t("to")}</label>
          <input id="doi-soat-den" type="date" className="o-nhap" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="truong">
          <label htmlFor="doi-soat-ncc">{t("supplier")}</label>
          <select id="doi-soat-ncc" className="o-nhap" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">{common("all")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="chu-thich">{t("hint")}</div>
      <Loaded state={state} onRetry={() => void reload()}>
        {(report) =>
          report.rows.length === 0 ? (
            <MessageView text={t("empty")} />
          ) : (
            <>
              <div className="khung-bang">
                <table>
                  <thead>
                    <tr>
                      {headings.map((heading, index) => (
                        <th key={index} scope="col" style={index > 0 ? { textAlign: "right" } : undefined}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((row) => (
                      <tr key={row.supplierId}>
                        <td data-nhan={headings[0]}>
                          <button type="button" className="nut chu" onClick={() => setSupplierId(row.supplierId)}>
                            {row.supplierName}
                          </button>
                        </td>
                        <td data-nhan={headings[1]} style={{ textAlign: "right" }}>
                          <span>{row.deliveredCount}</span>
                        </td>
                        <td data-nhan={headings[2]} style={{ textAlign: "right" }}>
                          <span>{formatMoney(row.receivedAmount, report.currency)}</span>
                        </td>
                        <td data-nhan={headings[3]} style={{ textAlign: "right" }}>
                          <span>{formatMoney(row.returnedAmount, report.currency)}</span>
                        </td>
                        <td data-nhan={headings[4]} style={{ textAlign: "right" }}>
                          <span className={row.missingInvoiceCount > 0 ? "nhan canh-bao" : undefined}>{row.missingInvoiceCount}</span>
                        </td>
                        <td data-nhan={headings[5]} style={{ textAlign: "right" }}>
                          <span>{formatMoney(row.payableBalance, report.currency)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td data-nhan="">
                        <strong>{t("total")}</strong>
                      </td>
                      <td data-nhan={headings[1]} style={{ textAlign: "right" }}>
                        <strong>{report.totals.deliveredCount}</strong>
                      </td>
                      <td data-nhan={headings[2]} style={{ textAlign: "right" }}>
                        <strong>{formatMoney(report.totals.receivedAmount, report.currency)}</strong>
                      </td>
                      <td data-nhan={headings[3]} style={{ textAlign: "right" }}>
                        <strong>{formatMoney(report.totals.returnedAmount, report.currency)}</strong>
                      </td>
                      <td data-nhan={headings[4]} style={{ textAlign: "right" }}>
                        <strong>{report.totals.missingInvoiceCount}</strong>
                      </td>
                      <td data-nhan={headings[5]} style={{ textAlign: "right" }}>
                        <strong>{formatMoney(report.totals.payableBalance, report.currency)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {report.orders.length > 0 && (
                <>
                  <h2>{t("orders")}</h2>
                  <div className="khung-bang">
                    <table>
                      <thead>
                        <tr>
                          {orderHeadings.map((heading, index) => (
                            <th key={index} scope="col" style={index === 3 || index === 4 ? { textAlign: "right" } : undefined}>
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.orders.map((order) => (
                          <tr key={order.id}>
                            <td data-nhan={orderHeadings[0]}>
                              <Link href={`/dropship-orders/${order.id}`}>{order.documentNo}</Link>
                            </td>
                            <td data-nhan={orderHeadings[1]}>
                              <span>{order.salesOrderNo ?? "—"}</span>
                            </td>
                            <td data-nhan={orderHeadings[2]}>
                              <span>{formatDate(order.deliveredOn)}</span>
                            </td>
                            <td data-nhan={orderHeadings[3]} style={{ textAlign: "right" }}>
                              <span>{formatMoney(order.receivedAmount, report.currency)}</span>
                            </td>
                            <td data-nhan={orderHeadings[4]} style={{ textAlign: "right" }}>
                              <span>{formatMoney(order.returnedAmount, report.currency)}</span>
                            </td>
                            <td data-nhan={orderHeadings[5]}>
                              <span>{order.supplierInvoiceNo ?? <span className="nhan canh-bao">{t("noInvoice")}</span>}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )
        }
      </Loaded>
    </>
  );
}
