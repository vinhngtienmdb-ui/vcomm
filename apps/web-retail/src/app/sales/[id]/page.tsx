"use client";

// MAN_HINH_163 chi tiết hóa đơn bán lẻ: dòng hàng, khuyến mãi, thanh toán, người mua, đơn bán, phiếu xuất; xem trước bản in khổ 80 mm, in lại.
import type { RetailSaleResponse } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loaded } from "ui/components/StatusViews";
import { formatDateTime, formatMoney } from "ui/lib/format";
import { useApi } from "ui/lib/use-api";
import { Receipt } from "@/components/Receipt";

export default function SaleDetailPage() {
  const t = useTranslations("retailSales");
  const counter = useTranslations("retailCounter");
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useApi<RetailSaleResponse>(`/retail/sales/${id}`);
  return (
    <Loaded state={state} onRetry={() => void reload()}>
      {(sale) => {
        const money = (amount: string) => formatMoney(amount, sale.currency);
        return (
          <>
            <div className="tieu-de">
              <h1>{sale.documentNo}</h1>
              <button type="button" className="nut phu" onClick={() => window.print()}>
                {t("print")}
              </button>
              <Link href="/sales">{t("back")}</Link>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)", alignItems: "flex-start" }}>
              <div style={{ display: "grid", gap: "var(--khoang-4)", flex: "1 1 480px", minWidth: 0 }}>
                <div className="the">
                  <dl className="thong-tin-dong">
                    <dt>{t("soldAt")}</dt>
                    <dd>{formatDateTime(sale.soldAt)}</dd>
                    <dt>{t("store")}</dt>
                    <dd>
                      {sale.store.name} · {sale.register.code}
                    </dd>
                    <dt>{t("cashier")}</dt>
                    <dd>{sale.cashierName}</dd>
                    <dt>{t("buyer")}</dt>
                    <dd>{[sale.buyer.name ?? t("walkIn"), sale.buyer.taxCode, sale.buyer.address].filter(Boolean).join(" · ")}</dd>
                    <dt>{t("salesOrder")}</dt>
                    <dd>{sale.salesOrder.documentNo}</dd>
                    <dt>{t("stockDocument")}</dt>
                    <dd>{sale.stockDocument.documentNo}</dd>
                  </dl>
                </div>
                <div className="khung-bang">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">{counter("item")}</th>
                        <th scope="col">{counter("quantity")}</th>
                        <th scope="col">{counter("listPrice")}</th>
                        <th scope="col">{counter("discount")}</th>
                        <th scope="col">{counter("lineTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.lines.map((line, index) => (
                        <tr key={index}>
                          <td data-nhan={counter("item")}>
                            <span>
                              {line.productName} {line.isGift && <span className="nhan thanh-cong">{counter("gift")}</span>}
                              {line.promotionName && (
                                <span className="chu-thich" style={{ display: "block" }}>
                                  {line.promotionName}
                                </span>
                              )}
                            </span>
                          </td>
                          <td data-nhan={counter("quantity")}>
                            <span>
                              {line.quantity} {line.unitName}
                            </span>
                          </td>
                          <td data-nhan={counter("listPrice")} className="so-tien">
                            <span>{money(line.listPrice)}</span>
                          </td>
                          <td data-nhan={counter("discount")}>
                            <span>{Number(line.discountPercent) > 0 ? `${line.discountPercent}%` : "—"}</span>
                          </td>
                          <td data-nhan={counter("lineTotal")} className="so-tien">
                            <span>{money(line.total)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="the" style={{ display: "grid", gap: "var(--khoang-2)" }}>
                  <div className="dong-tien">
                    <span>{counter("goodsAmount")}</span>
                    <span>{money(sale.goodsAmount)}</span>
                  </div>
                  <div className="dong-tien">
                    <span>{counter("promotion")}</span>
                    <span>−{money(sale.promotionAmount)}</span>
                  </div>
                  <div className="dong-tien">
                    <span>{counter("manualDiscount")}</span>
                    <span>−{money(sale.manualDiscount)}</span>
                  </div>
                  <div className="dong-tien">
                    <strong>{counter("payable")}</strong>
                    <strong>{money(sale.totalAmount)}</strong>
                  </div>
                  {sale.payments.map((payment, index) => (
                    <div key={index} className="dong-tien">
                      <span>
                        {t(`method_${payment.method}`)}
                        {payment.bankReference ? ` · ${payment.bankReference}` : ""}
                      </span>
                      <span>{money(payment.amount)}</span>
                    </div>
                  ))}
                  <div className="dong-tien">
                    <span>{counter("change")}</span>
                    <span>{money(sale.changeAmount)}</span>
                  </div>
                </div>
              </div>
              <div className="the">
                <Receipt sale={sale} visible />
              </div>
            </div>
            <Receipt sale={sale} />
          </>
        );
      }}
    </Loaded>
  );
}
