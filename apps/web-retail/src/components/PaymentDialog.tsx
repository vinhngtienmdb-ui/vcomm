"use client";

// Hộp thoại thanh toán (MAN_HINH_161; QUYTAC_NGHIEPVU_373): chuyển khoản qua mã VietQR (thu ngân xác nhận đã nhận), tiền mặt có gợi ý mệnh giá, tiền thừa;
// điểm của khách VComm kèm mã Smart OTP (lát L6; QUYTAC_NGHIEPVU_379); khóa yêu cầu tạo một lần cho mỗi lần mở hộp thoại để gửi lại không ghi trùng.
import type { CreateRetailSaleRequest, RetailCustomerResponse, RetailQuoteResponse, RetailSaleResponse, RetailShiftResponse } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { type FormEvent, useState } from "react";
import { Field, FormError } from "ui/components/Form";
import { apiFetch, ApiFailure } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";
import { formatMoney } from "ui/lib/format";
import { vietQrContent, vietQrPayload } from "@/lib/vietqr";
import type { Buyer } from "./BuyerDialog";
import type { CartItem } from "./Counter";

// Gợi ý tiền khách đưa: đúng số, làm tròn lên các mệnh giá thường dùng.
function suggestions(amount: number): number[] {
  const steps = [10000, 50000, 100000, 200000, 500000];
  return [...new Set([amount, ...steps.map((step) => Math.ceil(amount / step) * step)])].filter((value) => value >= amount).slice(0, 5);
}

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(4, 8);
}

export function PaymentDialog({
  shift,
  cart,
  buyer,
  customer,
  quote,
  onQuoteChanged,
  onPaid,
  onClose,
}: {
  shift: RetailShiftResponse;
  cart: CartItem[];
  buyer: Buyer;
  customer: RetailCustomerResponse | null;
  quote: RetailQuoteResponse;
  onQuoteChanged: () => void;
  onPaid: (sale: RetailSaleResponse) => void;
  onClose: () => void;
}) {
  const t = useTranslations("retailCounter");
  const [clientKey] = useState(() => crypto.randomUUID());
  const payable = Number(quote.totalAmount);
  const bank = shift.store.bankTransfer;
  const [transferOn, setTransferOn] = useState(false);
  const [transfer, setTransfer] = useState(quote.totalAmount);
  const [received, setReceived] = useState(false);
  const [reference, setReference] = useState("");
  const [cash, setCash] = useState(quote.totalAmount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const money = (amount: number | string) => formatMoney(String(amount), shift.currency);
  // Điểm: chỉ khi khách dùng được điểm (đủ điều kiện, Smart OTP đã kích hoạt, không tạm khóa).
  const canRedeem = Boolean(customer && customer.redeemBlockedReason === null && customer.maxPoints > 0 && customer.pointValue);
  const [pointsOn, setPointsOn] = useState(false);
  const [points, setPoints] = useState("");
  const [smartOtp, setSmartOtp] = useState("");
  const pointsUsed = pointsOn ? Math.trunc(Number(points) || 0) : 0;
  const pointsAmount = pointsOn && customer?.pointValue ? Math.floor(pointsUsed * Number(customer.pointValue)) : 0;
  const pointsValid = !pointsOn || (pointsUsed >= (customer?.minPoints ?? 0) && pointsUsed <= (customer?.maxPoints ?? 0) && /^[0-9]{6}$/.test(smartOtp));
  const transferAmount = transferOn ? Number(transfer) || 0 : 0;
  const cashAmount = Number(cash) || 0;
  const remaining = Math.max(0, payable - transferAmount - pointsAmount);
  const tendered = transferAmount + cashAmount + pointsAmount;
  const content = vietQrContent(`${shift.register.code} ${clientKey.slice(0, 8)}`);
  const ready = tendered >= payable && transferAmount + pointsAmount <= payable && pointsValid && (!transferOn || (received && transferAmount > 0));

  function togglePoints(on: boolean) {
    setPointsOn(on);
    const suggested = on && customer ? Math.min(customer.maxPoints, Math.floor(payable / Number(customer.pointValue))) : 0;
    setPoints(on ? String(suggested) : "");
    setSmartOtp("");
    setCash(String(Math.max(0, payable - transferAmount - (on && customer ? Math.floor(suggested * Number(customer.pointValue)) : 0))));
  }
  function changePoints(value: string) {
    setPoints(value);
    const used = Math.trunc(Number(value) || 0);
    setCash(String(Math.max(0, payable - transferAmount - (customer ? Math.floor(used * Number(customer.pointValue)) : 0))));
  }
  function toggleTransfer(on: boolean) {
    setTransferOn(on);
    setReceived(false);
    setTransfer(String(Math.max(0, payable - pointsAmount)));
    setCash(on ? "0" : String(Math.max(0, payable - pointsAmount)));
  }
  function changeTransfer(value: string) {
    setTransfer(value);
    setReceived(false);
    setCash(String(Math.max(0, payable - pointsAmount - (Number(value) || 0))));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      const payments: CreateRetailSaleRequest["payments"] = [];
      if (transferAmount > 0) payments.push({ method: "bank_transfer", amount: String(transferAmount), bankReference: reference });
      if (cashAmount > 0) payments.push({ method: "cash", amount: String(cashAmount) });
      const body: CreateRetailSaleRequest = {
        shiftId: shift.id,
        clientKey,
        lines: cart.map(({ variantId, unitId, quantity, discountPercent, serials }) => ({ variantId, unitId, quantity, discountPercent, serials })),
        buyer: { name: buyer.name, taxCode: buyer.taxCode, address: buyer.address, identityNo: buyer.identityNo },
        ...(customer?.userId ? { customer: { userId: customer.userId, points: pointsUsed, ...(pointsUsed > 0 ? { smartOtp } : {}) } } : {}),
        payments,
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
        {canRedeem && customer && (
          <label>
            <input type="checkbox" checked={pointsOn} onChange={(event) => togglePoints(event.target.checked)} /> {t("usePoints", { points: customer.balance.toLocaleString("vi-VN") })}
          </label>
        )}
        {canRedeem && customer && pointsOn && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)", alignItems: "flex-start" }}>
            <Field
              id="diem-dung"
              label={t("pointsToUse")}
              hint={t("pointsRange", { amount: money(pointsAmount), min: customer.minPoints.toLocaleString("vi-VN"), max: customer.maxPoints.toLocaleString("vi-VN") })}
            >
              <input id="diem-dung" className="o-nhap" inputMode="numeric" value={points} onChange={(event) => changePoints(event.target.value)} />
            </Field>
            <Field id="ma-smart-otp" label={t("smartOtp")} hint={t("smartOtpHint")}>
              <input
                id="ma-smart-otp"
                className="o-nhap"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={smartOtp}
                onChange={(event) => setSmartOtp(event.target.value.replace(/[^0-9]/g, ""))}
                style={{ letterSpacing: "6px", fontWeight: 800, maxWidth: "12rem" }}
              />
            </Field>
          </div>
        )}
        {bank && (
          <label>
            <input type="checkbox" checked={transferOn} onChange={(event) => toggleTransfer(event.target.checked)} /> {t("transfer")}
          </label>
        )}
        {bank && transferOn && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-4)", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: "var(--khoang-2)", justifyItems: "start" }}>
              <img
                src={qrDataUrl(vietQrPayload({ bankBin: bank.bankBin, accountNo: bank.accountNo, amount: transferAmount, content }))}
                alt={t("qrLabel")}
                width={180}
                height={180}
                style={{ imageRendering: "pixelated" }}
              />
              <span className="chu-thich">
                {bank.accountNo} · {bank.accountName}
                <br />
                {t("transferContent", { content })}
              </span>
            </div>
            <div style={{ display: "grid", gap: "var(--khoang-3)", flex: "1 1 240px" }}>
              <Field id="tien-chuyen-khoan" label={t("transferAmount")}>
                <input id="tien-chuyen-khoan" className="o-nhap" inputMode="decimal" value={transfer} onChange={(event) => changeTransfer(event.target.value)} />
              </Field>
              <Field id="ma-giao-dich" label={t("transferReference")}>
                <input id="ma-giao-dich" className="o-nhap" maxLength={50} value={reference} onChange={(event) => setReference(event.target.value)} />
              </Field>
              <label>
                <input type="checkbox" checked={received} onChange={(event) => setReceived(event.target.checked)} /> {t("transferReceived", { amount: money(transferAmount) })}
              </label>
            </div>
          </div>
        )}
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
        {remaining > 0 && (
          <div className="nhom-nut" aria-label={t("cash")}>
            {suggestions(remaining).map((value) => (
              <button key={value} type="button" className="nut phu" onClick={() => setCash(String(value))}>
                {money(value)}
              </button>
            ))}
          </div>
        )}
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
        {transferAmount > payable && <span className="loi-o">{t("transferOverTotal")}</span>}
        <FormError text={error} />
        <button type="submit" className={`nut chinh lon${submitting ? " dang-xu-ly" : ""}`} disabled={submitting || !ready}>
          {t("confirmPay")} <span className="phim">Enter</span>
        </button>
      </form>
    </div>
  );
}
