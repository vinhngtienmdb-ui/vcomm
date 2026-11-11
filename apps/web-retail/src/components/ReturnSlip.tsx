"use client";

// Phiếu trả hàng in khổ 80 mm (MAN_HINH_167, cùng khuôn hóa đơn bán lẻ): đặt dưới body để in không để lại trang trắng.
import type { RetailReturnResponse } from "contracts";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime, formatMoney } from "ui/lib/format";

export function ReturnSlip({ slip }: { slip: RetailReturnResponse }) {
  const t = useTranslations("retailReturns");
  const receipt = useTranslations("retailReceipt");
  const methods = useTranslations("retailSales");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const money = (amount: string) => formatMoney(amount, slip.currency);
  return createPortal(
    <div className="hoa-don-in chi-in" aria-label={t("slipTitle")}>
      <div className="giua dam">{slip.company.legalName}</div>
      <div className="giua">{[slip.company.taxCode && `${receipt("taxCode")} ${slip.company.taxCode}`, slip.company.address].filter(Boolean).join(" · ")}</div>
      <div className="giua">{[slip.store.name, slip.store.phone].filter(Boolean).join(" · ")}</div>
      <hr />
      <div className="giua dam">{t("slipTitle")}</div>
      <div className="dong-tien">
        <span>{receipt("number", { number: slip.documentNo })}</span>
        <span>{formatDateTime(slip.returnedAt)}</span>
      </div>
      <div>{t("slipSale", { number: slip.sale.documentNo })}</div>
      <div className="dong-tien">
        <span>{receipt("register", { code: slip.registerCode })}</span>
        <span>{receipt("cashier", { name: slip.cashierName })}</span>
      </div>
      <hr />
      {slip.lines.map((line, index) => (
        <div key={index} className="dong-tien">
          <span>
            {line.productName} · {line.quantity} {line.unitName}
          </span>
          <span>{money(line.amount)}</span>
        </div>
      ))}
      <hr />
      <div className="dong-tien dam">
        <span>{t("total")}</span>
        <span>{money(slip.goodsAmount)}</span>
      </div>
      {slip.refunds.map((refund, index) => (
        <div key={index} className="dong-tien">
          <span>{methods(`method_${refund.method}`)}</span>
          <span>{money(refund.amount)}</span>
        </div>
      ))}
      <div>
        {t("reason")}: {slip.reason}
      </div>
    </div>,
    document.body,
  );
}
