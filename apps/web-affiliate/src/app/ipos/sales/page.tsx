"use client";

// MAN_HINH_299 Hóa đơn và trả hàng (chủ cửa hàng; CONG_VIEC_74; API_350): danh sách hóa đơn (lọc ngày, điểm bán, phương thức, số), phiếu trả; chi tiết.
import type { IposPaymentMethod, IposPortalAccess, IposPortalReturnRow, IposPortalSaleRow, IposReturn, IposSale } from "contracts";
import { iposPaymentMethods } from "contracts";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Drawer } from "ui/components/Dialogs";
import { Field } from "ui/components/Form";
import { Loaded, MessageView } from "ui/components/StatusViews";
import { formatDateTime, formatNumber } from "ui/lib/format";
import { daysAgo, IposPeriod, periodQuery, vietnamToday, type IposPeriodValue } from "@/components/IposPeriod";
import { portalFetch, usePortalApi } from "@/lib/portal-api";

function SaleDrawer({ sale, onClose }: { sale: IposSale; onClose: () => void }) {
  const t = useTranslations("iposPortal");
  return (
    <Drawer title={`${t("invoice")} ${sale.documentNo}`} onClose={onClose}>
      <p className="chu-thich">
        {formatDateTime(sale.soldAt)} · {sale.outletName} · {sale.registerName} · {sale.memberName}
        {sale.status === "cancelled" ? ` · ${t("sale_cancelled")}` : ""}
      </p>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("item")}</th>
              <th className="so">{t("quantity")}</th>
              <th className="so">{t("unitPrice")}</th>
              <th className="so">{t("discountShort")}</th>
              <th className="so">{t("amountShort")}</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line) => (
              <tr key={line.lineNo}>
                <td data-nhan={t("item")}>{line.name}</td>
                <td data-nhan={t("quantity")} className="so">
                  {formatNumber(line.quantity)} {line.unit}
                </td>
                <td data-nhan={t("unitPrice")} className="so">
                  {formatNumber(line.unitPrice)}
                </td>
                <td data-nhan={t("discountShort")} className="so">
                  {formatNumber(Number(line.discount) + Number(line.allocatedDiscount))}
                </td>
                <td data-nhan={t("amountShort")} className="so">
                  {formatNumber(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <strong>
          {t("total")}: {formatNumber(sale.total)}
        </strong>
      </p>
      {sale.payments.map((payment) => (
        <p key={payment.method} className="chu-thich" style={{ margin: 0 }}>
          {t(`method_${payment.method}`)}: {formatNumber(payment.amount)}
          {payment.vietqrReference ? ` · ${payment.vietqrReference}` : ""}
          {payment.linkNumber ? ` · ${payment.linkNumber}` : ""}
        </p>
      ))}
      {sale.buyerName && <p className="chu-thich">{t("buyerLine", { name: sale.buyerName, earned: sale.earnedPoints, redeemed: sale.redeemedPoints })}</p>}
      {sale.discountApprovedByName && <p className="chu-thich">{t("discountApprovedBy", { name: sale.discountApprovedByName })}</p>}
    </Drawer>
  );
}

function ReturnDrawer({ item, onClose }: { item: IposReturn; onClose: () => void }) {
  const t = useTranslations("iposPortal");
  return (
    <Drawer title={`${t("returnSlip")} ${item.documentNo}`} onClose={onClose}>
      <p className="chu-thich">
        {formatDateTime(item.createdAt)} · {t("invoice")} {item.saleDocumentNo} · {item.memberName}
        {item.approvedByName ? ` · ${t("approvedBy", { name: item.approvedByName })}` : ""}
      </p>
      {item.lines.map((line, index) => (
        <p key={index} style={{ margin: 0 }}>
          {line.name} · {formatNumber(line.quantity)} {line.unit} · {formatNumber(line.amount)}
        </p>
      ))}
      <p>
        <strong>{t("returnAmountLine", { amount: formatNumber(item.amount), cash: formatNumber(item.refundCash) })}</strong>
      </p>
      <p className="chu-thich">{t("reasonLine", { reason: item.reason })}</p>
    </Drawer>
  );
}

export default function IposSalesPage() {
  const t = useTranslations("iposPortal");
  const access = usePortalApi<IposPortalAccess>("/merchant-portal/ipos/access");
  const [tab, setTab] = useState<"sales" | "returns">("sales");
  const [period, setPeriod] = useState<IposPeriodValue>({ from: daysAgo(6), to: vietnamToday(), outletId: "" });
  const [method, setMethod] = useState<IposPaymentMethod | "">("");
  const [search, setSearch] = useState("");
  const sales = usePortalApi<IposPortalSaleRow[]>(tab === "sales" ? `/merchant-portal/ipos/sales?${periodQuery(period, { ...(method ? { method } : {}), ...(search.trim() ? { search: search.trim() } : {}) })}` : null);
  const returns = usePortalApi<IposPortalReturnRow[]>(tab === "returns" ? `/merchant-portal/ipos/returns?${periodQuery(period)}` : null);
  const [sale, setSale] = useState<IposSale | null>(null);
  const [returned, setReturned] = useState<IposReturn | null>(null);
  return (
    <Loaded state={access.state} onRetry={() => void access.reload()}>
      {(info) =>
        !info.enabled ? (
          <MessageView text={t("notSubscribed")} />
        ) : (
          <>
            <div className="tieu-de">
              <h1>{t("salesTitle")}</h1>
            </div>
            <div className="cac-the" role="tablist">
              {(["sales", "returns"] as const).map((item) => (
                <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? "chon" : ""} onClick={() => setTab(item)}>
                  {t(item === "sales" ? "tabInvoices" : "tabReturns")}
                </button>
              ))}
            </div>
            <IposPeriod value={period} outlets={info.outlets} onChange={setPeriod}>
              {tab === "sales" && (
                <>
                  <Field id="hd-pt" label={t("method")}>
                    <select id="hd-pt" className="o-nhap" value={method} onChange={(event) => setMethod(event.target.value as IposPaymentMethod | "")}>
                      <option value="">{t("allMethods")}</option>
                      {iposPaymentMethods.map((item) => (
                        <option key={item} value={item}>
                          {t(`method_${item}`)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="hd-so" label={t("documentNumber")}>
                    <input id="hd-so" className="o-nhap" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </Field>
                </>
              )}
            </IposPeriod>
            {tab === "sales" ? (
              <Loaded state={sales.state} onRetry={() => void sales.reload()}>
                {(rows) =>
                  rows.length === 0 ? (
                    <MessageView text={t("noSales")} />
                  ) : (
                    <div className="khung-bang">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("documentNumber")}</th>
                            <th>{t("time")}</th>
                            <th>{t("outlet")}</th>
                            <th>{t("cashier")}</th>
                            <th>{t("method")}</th>
                            <th className="so">{t("total")}</th>
                            <th className="so">{t("returnedShort")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id}>
                              <td data-nhan={t("documentNumber")}>
                                <button type="button" className="nut chu" onClick={() => void portalFetch<IposSale>(`/merchant-portal/ipos/sales/${row.id}`).then(setSale)}>
                                  {row.documentNo}
                                </button>
                                {row.status === "cancelled" && <span className="nhan trung-tinh"> {t("sale_cancelled")}</span>}
                              </td>
                              <td data-nhan={t("time")}>{formatDateTime(row.soldAt)}</td>
                              <td data-nhan={t("outlet")}>
                                {row.outletName} · {row.registerName}
                              </td>
                              <td data-nhan={t("cashier")}>{row.memberName}</td>
                              <td data-nhan={t("method")}>{row.methods.map((item) => t(`method_${item}`)).join(", ")}</td>
                              <td data-nhan={t("total")} className="so">
                                {formatNumber(row.total)}
                              </td>
                              <td data-nhan={t("returnedShort")} className="so">
                                {Number(row.returnedAmount) > 0 ? formatNumber(row.returnedAmount) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </Loaded>
            ) : (
              <Loaded state={returns.state} onRetry={() => void returns.reload()}>
                {(rows) =>
                  rows.length === 0 ? (
                    <MessageView text={t("noReturns")} />
                  ) : (
                    <div className="khung-bang">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("documentNumber")}</th>
                            <th>{t("time")}</th>
                            <th>{t("invoice")}</th>
                            <th>{t("returnKind")}</th>
                            <th>{t("cashier")}</th>
                            <th className="so">{t("amountShort")}</th>
                            <th className="so">{t("refundCash")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id}>
                              <td data-nhan={t("documentNumber")}>
                                <button type="button" className="nut chu" onClick={() => void portalFetch<IposReturn>(`/merchant-portal/ipos/returns/${row.id}`).then(setReturned)}>
                                  {row.documentNo}
                                </button>
                              </td>
                              <td data-nhan={t("time")}>{formatDateTime(row.createdAt)}</td>
                              <td data-nhan={t("invoice")}>{row.saleDocumentNo}</td>
                              <td data-nhan={t("returnKind")}>{t(`returnKind_${row.kind}`)}</td>
                              <td data-nhan={t("cashier")}>{row.memberName}</td>
                              <td data-nhan={t("amountShort")} className="so">
                                {formatNumber(row.amount)}
                              </td>
                              <td data-nhan={t("refundCash")} className="so">
                                {formatNumber(row.refundCash)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </Loaded>
            )}
            {sale && <SaleDrawer sale={sale} onClose={() => setSale(null)} />}
            {returned && <ReturnDrawer item={returned} onClose={() => setReturned(null)} />}
          </>
        )
      }
    </Loaded>
  );
}
