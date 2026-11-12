"use client";

// Phiếu soạn hàng, phiếu giao hàng của đơn trực tuyến tại trạm, khổ 80 mm (CONG_VIEC_57; MAN_HINH_188, 189): chỉ hiện khi in (lớp chi-in).
import type { StationOrderDetail } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime, formatMoney, formatNumber } from "ui/lib/format";

export function StationSlip({ order, kind, currency }: { order: StationOrderDetail; kind: "picking" | "handover"; currency: string }) {
  const t = useTranslations("retailStationOrders");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const money = (amount: string) => formatMoney(amount, currency);
  return createPortal(
    <div className="hoa-don-in chi-in" aria-label={t(`slip_${kind}`)}>
      <div className="giua dam">{order.store.name}</div>
      <div className="giua dam">{t(`slip_${kind}`)}</div>
      <div className="dong-tien">
        <span>{order.documentNo}</span>
        <span>{formatDateTime(kind === "picking" ? order.createdAt : new Date().toISOString())}</span>
      </div>
      <div>{`${order.recipientName} · ${order.recipientPhone}`}</div>
      <div>{t(`mode_${order.fulfillmentMode}`)}</div>
      {order.fulfillmentMode === "station_delivery" && <div>{order.address}</div>}
      <hr />
      {order.lines.map((line) => (
        <div key={`${line.variantId}-${line.isGift}`} className="dong-tien">
          <span>
            {line.productName}
            {line.variantLabel ? ` (${line.variantLabel})` : ""}
            {line.isGift ? ` · ${t("gift")}` : ""}
          </span>
          <span>× {formatNumber(line.quantity)}</span>
        </div>
      ))}
      <hr />
      <div className="dong-tien dam">
        <span>{t("total")}</span>
        <span>{money(order.total)}</span>
      </div>
      {kind === "handover" ? (
        order.collections.map((line, index) => (
          <div key={index} className="dong-tien">
            <span>{t(`method_${line.method}`)}</span>
            <span>{money(line.amount)}</span>
          </div>
        ))
      ) : (
        <div className="dong-tien">
          <span>{t("dueAmount")}</span>
          <span>{money(order.dueAmount)}</span>
        </div>
      )}
      {kind === "handover" && order.collections.some((line) => Number(line.changeAmount) > 0) && (
        <div className="dong-tien">
          <span>{t("change")}</span>
          <span>{money(String(order.collections.reduce((sum, line) => sum + Number(line.changeAmount), 0)))}</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
