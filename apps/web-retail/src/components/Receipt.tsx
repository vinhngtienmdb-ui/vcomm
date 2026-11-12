"use client";

// MAN_HINH_167 Mẫu in hóa đơn bán lẻ khổ 80 mm (CHUC_NANG_187): chỉ hiện khi in (lớp chi-in), in bằng hộp thoại in của trình duyệt.
import type { RetailSaleResponse } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatDateTime, formatMoney } from "ui/lib/format";

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(4, 0);
}

// Bản in đặt thẳng dưới body để khi in ẩn được toàn bộ trang mà không để lại trang trắng.
export function Receipt({ sale, visible = false }: { sale: RetailSaleResponse; visible?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (visible) return <ReceiptContent sale={sale} className="hoa-don-in" />;
  return mounted ? createPortal(<ReceiptContent sale={sale} className="hoa-don-in chi-in" />, document.body) : null;
}

function ReceiptContent({ sale, className }: { sale: RetailSaleResponse; className: string }) {
  const t = useTranslations("retailReceipt");
  const methods = useTranslations("retailSales");
  const money = (amount: string) => formatMoney(amount, sale.currency);
  const discounts = Number(sale.promotionAmount) + Number(sale.manualDiscount);
  return (
    <div className={className} aria-label={t("title")}>
      <div className="giua dam">{sale.company.legalName}</div>
      <div className="giua">{[sale.company.taxCode && `${t("taxCode")} ${sale.company.taxCode}`, sale.company.address].filter(Boolean).join(" · ")}</div>
      <div className="giua">{[sale.store.name, sale.store.phone].filter(Boolean).join(" · ")}</div>
      {sale.store.address && <div className="giua">{sale.store.address}</div>}
      <hr />
      <div className="giua dam">{t("title")}</div>
      <div className="dong-tien">
        <span>{t("number", { number: sale.documentNo })}</span>
        <span>{formatDateTime(sale.soldAt)}</span>
      </div>
      <div className="dong-tien">
        <span>{t("register", { code: sale.register.code })}</span>
        <span>{t("cashier", { name: sale.cashierName })}</span>
      </div>
      <hr />
      {sale.lines.map((line, index) => (
        <div key={index}>
          <div className="dam">
            {line.productName}
            {line.isGift ? ` (${t("gift")})` : ""}
          </div>
          <div className="dong-tien">
            <span>
              {line.quantity} {line.unitName}
              {line.isGift ? "" : ` × ${formatMoney(line.listPrice, sale.currency)}`}
              {!line.isGift && line.promotionName ? ` (${t("promotion")})` : ""}
              {Number(line.discountPercent) > 0 ? ` (${t("discount", { percent: line.discountPercent })})` : ""}
            </span>
            <span>{money(line.total)}</span>
          </div>
        </div>
      ))}
      <hr />
      <div className="dong-tien">
        <span>{t("goodsAmount")}</span>
        <span>{money(sale.goodsAmount)}</span>
      </div>
      {discounts > 0 && (
        <div className="dong-tien">
          <span>{t("discounts")}</span>
          <span>−{money(String(discounts))}</span>
        </div>
      )}
      <div className="dong-tien dam">
        <span>{t("total")}</span>
        <span>{money(sale.totalAmount)}</span>
      </div>
      <div className="dong-tien">
        <span>{t("tax")}</span>
        <span>{money(sale.taxAmount)}</span>
      </div>
      {sale.payments.map((payment, index) => (
        <div key={index} className="dong-tien">
          <span>
            {methods(`method_${payment.method}`)}
            {payment.points ? ` (${t("pointsCount", { points: Number(payment.points).toLocaleString("vi-VN") })})` : ""}
          </span>
          <span>{money(payment.amount)}</span>
        </div>
      ))}
      {Number(sale.changeAmount) > 0 && (
        <div className="dong-tien">
          <span>{t("change")}</span>
          <span>{money(sale.changeAmount)}</span>
        </div>
      )}
      {sale.loyalty ? (
        <>
          <hr />
          <div>{t("loyaltyCustomer", { name: sale.loyalty.maskedName, phone: sale.loyalty.maskedPhone })}</div>
          <div>{t("loyaltyPoints", { used: sale.loyalty.pointsUsed.toLocaleString("vi-VN"), earned: sale.loyalty.pointsEarned.toLocaleString("vi-VN") })}</div>
          <div>{t("loyaltyBalance", { points: sale.loyalty.balanceAfter.toLocaleString("vi-VN") })}</div>
        </>
      ) : (
        <>
          <hr />
          <div className="giua">{t("inviteApp")}</div>
        </>
      )}
      {(sale.buyer.name || sale.buyer.taxCode) && (
        <>
          <hr />
          {sale.buyer.name && <div>{t("buyer", { name: sale.buyer.name })}</div>}
          {sale.buyer.taxCode && <div>{t("buyerTaxCode", { taxCode: sale.buyer.taxCode })}</div>}
        </>
      )}
      {sale.einvoice && (
        <>
          <hr />
          <div className="giua dam">{t("einvoiceTitle")}</div>
          <div>{t("einvoiceNumber", { template: sale.einvoice.templateCode, series: sale.einvoice.series ?? "", number: sale.einvoice.invoiceNo ?? "" })}</div>
          {sale.einvoice.lookupCode && <div>{t("einvoiceLookup", { code: sale.einvoice.lookupCode })}</div>}
          {sale.einvoice.taxAuthorityCode && <div style={{ wordBreak: "break-all" }}>{t("einvoiceTaxAuthorityCode", { code: sale.einvoice.taxAuthorityCode })}</div>}
        </>
      )}
      <hr />
      <img className="qr" src={qrDataUrl(sale.documentNo)} alt={sale.documentNo} />
      {sale.store.returnDays > 0 && <div className="giua">{t("returnPolicy", { days: sale.store.returnDays })}</div>}
      {sale.store.receiptFooter && <div className="giua">{sale.store.receiptFooter}</div>}
      <div className="giua">{t("footer")}</div>
    </div>
  );
}
