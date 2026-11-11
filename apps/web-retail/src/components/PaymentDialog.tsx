"use client";

// Hộp thoại thanh toán (MAN_HINH_161; QUYTAC_NGHIEPVU_373). Lát L2: tiền mặt, gợi ý mệnh giá, tiền thừa; khóa yêu cầu tạo một lần cho mỗi lần mở hộp thoại để gửi lại không ghi trùng.
import type { CreateRetailSaleRequest, RetailQuoteResponse, RetailSaleResponse, RetailShiftResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Field, FormError } from "ui/components/Form";
import { apiFetch, ApiFailure } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";
import { formatMoney } from "ui/lib/format";
import type { Buyer } from "./BuyerDialog";
import type { CartItem } from "./Counter";

// Gợi ý tiền khách đưa: đúng số, làm tròn lên các mệnh giá thường dùng.
function suggestions(amount: number): number[] {
  const steps = [10000, 50000, 100000, 200000, 500000];
  return [...new Set([amount, ...steps.map((step) => Math.ceil(amount / step) * step)])].filter((value) => value >= amount).slice(0, 5);
}

export function PaymentDialog({
  shift,
  cart,
  buyer,
  quote,
  onQuoteChanged,
  onPaid,
  onClose,
}: {
  shift: RetailShiftResponse;
  cart: CartItem[];
  buyer: Buyer;
  quote: RetailQuoteResponse;
  onQuoteChanged: () => void;
  onPaid: (sale: RetailSaleResponse) => void;
  onClose: () => void;
}) {
  const t = useTranslations("retailCounter");
  const [clientKey] = useState(() => crypto.randomUUID());
  const [cash, setCash] = useState(quote.totalAmount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (amount: number | string) => formatMoney(String(amount), shift.currency);
  const payable = Number(quote.totalAmount);
  const tendered = Number(cash) || 0;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: CreateRetailSaleRequest = {
        shiftId: shift.id,
        clientKey,
        lines: cart.map(({ variantId, unitId, quantity, discountPercent, serials }) => ({ variantId, unitId, quantity, discountPercent, serials })),
        buyer: { name: buyer.name, taxCode: buyer.taxCode, address: buyer.address, identityNo: buyer.identityNo },
        payments: [{ method: "cash", amount: cash }],
        expectedTotal: quote.totalAmount,
      };
      onPaid(await apiFetch<RetailSaleResponse>("/retail/sales", { method: "POST", body: JSON.stringify(body) }));
    } catch (failure) {
      // Lỗi nghiệp vụ (tổng đổi, thiếu hàng…) thì tính lại giỏ để thu ngân thấy số mới.
      if (failure instanceof ApiFailure && failure.status === 409) onQuoteChanged();
      const details = failureOf(failure);
      setError([details.message, ...Object.values(details.fields)].join(" "));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="man-che giua" onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <form className="hop-thoai rong" role="dialog" aria-modal="true" aria-label={t("paymentTitle", { amount: money(payable) })} onSubmit={submit}>
        <h2>{t("paymentTitle", { amount: money(payable) })}</h2>
        <Field id="tien-khach-dua" label={t("cash")}>
          <input
            id="tien-khach-dua"
            className="o-nhap o-quet"
            inputMode="decimal"
            autoFocus
            value={cash}
            onChange={(event) => setCash(event.target.value)}
            onFocus={(event) => event.target.select()}
          />
        </Field>
        <div className="nhom-nut" aria-label={t("cash")}>
          {suggestions(payable).map((value) => (
            <button key={value} type="button" className="nut phu" onClick={() => setCash(String(value))}>
              {money(value)}
            </button>
          ))}
        </div>
        <div className="dong-tien">
          <span>{t("tendered")}</span>
          <span>{money(tendered)}</span>
        </div>
        {tendered >= payable ? (
          <div className="dong-tien">
            <span className="tong-lon">{t("change")}</span>
            <span className="tong-lon">{money(tendered - payable)}</span>
          </div>
        ) : (
          <div className="dong-tien">
            <span className="tong-lon">{t("remaining")}</span>
            <span className="tong-lon">{money(payable - tendered)}</span>
          </div>
        )}
        <FormError text={error} />
        <button type="submit" className={`nut chinh lon${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || tendered < payable}>
          {t("confirmPay")} <span className="phim">Enter</span>
        </button>
      </form>
    </div>
  );
}
