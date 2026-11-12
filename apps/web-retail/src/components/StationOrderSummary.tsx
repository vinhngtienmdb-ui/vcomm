"use client";

// Phần dùng chung của đơn trực tuyến tại trạm (CONG_VIEC_57; MAN_HINH_188, 189): màu trạng thái, thông tin đơn, dòng hàng, tiền.
import type { StationOrderDetail } from "contracts";
import { useTranslations } from "next-intl";
import { formatDateTime, formatMoney, formatNumber } from "ui/lib/format";

export const stationStatusTone: Record<string, string> = {
  awaiting_shipment: "canh-bao",
  ready_for_pickup: "thong-tin",
  shipping: "thong-tin",
  delivered: "thanh-cong",
  completed: "thanh-cong",
  cancelled: "trung-tinh",
};

export function OrderSummary({ order }: { order: StationOrderDetail }) {
  const t = useTranslations("retailStationOrders");
  const money = (amount: string) => formatMoney(amount, order.currency);
  return (
    <>
      <div className="the">
        <dl className="thong-tin-dong">
          <dt>{t("customer")}</dt>
          <dd>{`${order.recipientName} · ${order.recipientPhone}`}</dd>
          <dt>{t("mode")}</dt>
          <dd>
            {t(`mode_${order.fulfillmentMode}`)} · {order.store.name}
          </dd>
          {order.fulfillmentMode === "station_delivery" && (
            <>
              <dt>{t("address")}</dt>
              <dd>{order.address}</dd>
            </>
          )}
          <dt>{t("payment")}</dt>
          <dd>{Number(order.dueAmount) > 0 ? t("payOnReceipt", { amount: money(order.dueAmount) }) : t("prepaid")}</dd>
          {order.holdUntil && (
            <>
              <dt>{t("holdUntil")}</dt>
              <dd>{formatDateTime(order.holdUntil)}</dd>
            </>
          )}
          {order.stockDocument && (
            <>
              <dt>{t("stockDocument")}</dt>
              <dd>{order.stockDocument.documentNo}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th scope="col">{t("item")}</th>
              <th scope="col">{t("quantity")}</th>
              <th scope="col">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={`${line.variantId}-${line.isGift}`}>
                <td data-nhan={t("item")}>
                  <span>
                    {line.productName}
                    {line.variantLabel ? ` · ${line.variantLabel}` : ""}
                  </span>
                  {line.isGift && <span className="nhan thanh-cong">{t("gift")}</span>}
                </td>
                <td data-nhan={t("quantity")} className="so-tien">
                  <span>{formatNumber(line.quantity)}</span>
                </td>
                <td data-nhan={t("amount")} className="so-tien">
                  <span>{money(line.total)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="the">
        <div className="dong-tien">
          <span>{t("goodsAmount")}</span>
          <span>{money(order.goodsAmount)}</span>
        </div>
        <div className="dong-tien">
          <span>{t("shippingFee")}</span>
          <span>{money(order.shippingFee)}</span>
        </div>
        <div className="dong-tien dam">
          <span>{t("total")}</span>
          <span>{money(order.total)}</span>
        </div>
      </div>
    </>
  );
}
