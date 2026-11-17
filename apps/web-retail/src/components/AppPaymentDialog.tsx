"use client";

// MAN_HINH_278 Thanh toán qua ứng dụng VComm tại quầy (CONG_VIEC_73 lát L2; QUYTAC_NGHIEPVU_575 đến 580; API_328).
// Mở hộp thoại thì tạo đơn chờ từ giỏ (giữ hàng). Cách 1: quét mã thanh toán của khách (máy quét nhập 18 số rồi Enter). Cách 2: khách quét mã QR.
// Hỏi máy chủ mỗi 2 giây; cổng báo thành công thì hiện hóa đơn bán lẻ để in. Đóng hộp thoại khi đơn chưa thanh toán thì hủy đơn chờ.
import type { CreateRetailCheckoutRequest, RetailCheckoutResponse, RetailQuoteResponse, RetailSaleResponse, RetailShiftResponse } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Field, FormError } from "ui/components/Form";
import { apiFetch } from "ui/lib/api";
import { formatMoney } from "ui/lib/format";
import { failureOf } from "ui/lib/use-api";
import type { Buyer } from "./BuyerDialog";
import type { CartItem } from "./Counter";

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(4, 8);
}

const open = (status: RetailCheckoutResponse["status"]) => status === "awaiting_buyer" || status === "awaiting_payment";

export function AppPaymentDialog({
  shift,
  cart,
  buyer,
  quote,
  onPaid,
  onClose,
}: {
  shift: RetailShiftResponse;
  cart: CartItem[];
  buyer: Buyer;
  quote: RetailQuoteResponse;
  onPaid: (sale: RetailSaleResponse) => void;
  onClose: () => void;
}) {
  const t = useTranslations("retailCounter");
  const [attempt, setAttempt] = useState(0);
  const [checkout, setCheckout] = useState<RetailCheckoutResponse | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const scanRef = useRef<HTMLInputElement>(null);
  // Mỗi lần tạo mã gọi máy chủ đúng một lần (React chạy hiệu ứng hai lần ở chế độ phát triển; gọi hai lần thì lần sau không có mã QR).
  const requests = useRef(new Map<number, Promise<RetailCheckoutResponse>>());
  const money = (amount: number | string) => formatMoney(String(amount), shift.currency);
  const fail = (failure: unknown) => {
    const details = failureOf(failure);
    setError([details.message, ...Object.values(details.fields)].join(" "));
  };

  // Mỗi lần "Tạo mã mới" là một đơn chờ mới (khóa yêu cầu mới).
  useEffect(() => {
    let active = true;
    let pending = requests.current.get(attempt);
    if (!pending) {
      const body: CreateRetailCheckoutRequest = {
        shiftId: shift.id,
        clientKey: crypto.randomUUID(),
        lines: cart.map(({ variantId, unitId, quantity, discountPercent, serials }) => ({ variantId, unitId, quantity, discountPercent, serials })),
        buyer: { name: buyer.name, taxCode: buyer.taxCode, address: buyer.address, identityNo: buyer.identityNo },
        expectedTotal: quote.totalAmount,
      };
      pending = apiFetch<RetailCheckoutResponse>("/retail/checkouts", { method: "POST", body: JSON.stringify(body) });
      requests.current.set(attempt, pending);
    }
    setError(null);
    pending
      .then((created) => {
        if (!active) return;
        setCheckout(created);
        setQrUrl(created.qrUrl);
        scanRef.current?.focus();
      })
      .catch((failure) => active && fail(failure));
    return () => {
      active = false;
    };
    // Tạo lại khi bấm "Tạo mã mới".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const finish = useCallback(
    async (current: RetailCheckoutResponse) => {
      if (current.status === "completed" && current.saleId) onPaid(await apiFetch<RetailSaleResponse>(`/retail/sales/${current.saleId}`));
    },
    [onPaid],
  );

  // Hỏi trạng thái mỗi 2 giây khi đơn còn mở.
  useEffect(() => {
    if (!checkout || !open(checkout.status)) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      apiFetch<RetailCheckoutResponse>(`/retail/checkouts/${checkout.id}`)
        .then((current) => {
          setCheckout(current);
          void finish(current);
        })
        .catch(() => undefined);
    }, 2000);
    return () => clearInterval(timer);
  }, [checkout, finish]);

  async function scan(event: FormEvent) {
    event.preventDefault();
    if (!checkout || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setCheckout(await apiFetch<RetailCheckoutResponse>(`/retail/checkouts/${checkout.id}/pay-code`, { method: "POST", body: JSON.stringify({ code }) }));
    } catch (failure) {
      fail(failure);
    } finally {
      setCode("");
      setBusy(false);
      scanRef.current?.focus();
    }
  }

  async function cancel(thenClose: boolean) {
    if (checkout && open(checkout.status)) {
      try {
        setCheckout(await apiFetch<RetailCheckoutResponse>(`/retail/checkouts/${checkout.id}/cancel`, { method: "POST", body: JSON.stringify({ reason: t("appCancelReason") }) }));
      } catch (failure) {
        if (!thenClose) fail(failure);
      }
    }
    if (thenClose) onClose();
  }

  const secondsLeft = checkout ? Math.max(0, Math.floor((new Date(checkout.expiresAt).getTime() - now) / 1000)) : 0;
  const status = checkout?.status;
  return (
    <div className="man-che giua" onKeyDown={(event) => event.key === "Escape" && void cancel(true)}>
      <div className="hop-thoai rong" role="dialog" aria-modal="true" aria-label={t("appTitle", { amount: money(quote.totalAmount) })}>
        <h2>{t("appTitle", { amount: money(quote.totalAmount) })}</h2>
        {checkout && (
          <p className="chu-thich">
            {t("appCheckoutNo", { documentNo: checkout.documentNo })}
            {open(checkout.status) ? ` · ${t("appExpiresIn", { minutes: Math.floor(secondsLeft / 60), seconds: String(secondsLeft % 60).padStart(2, "0") })}` : ""}
          </p>
        )}
        {checkout && status === "awaiting_buyer" && !checkout.buyer && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--khoang-5)", alignItems: "flex-start" }}>
            <form onSubmit={scan} style={{ display: "grid", gap: "var(--khoang-3)", flex: "1 1 260px" }}>
              <strong>{t("appScanTitle")}</strong>
              <Field id="ma-thanh-toan" label={t("appScanLabel")} hint={t("appScanHint")}>
                <input
                  id="ma-thanh-toan"
                  ref={scanRef}
                  className="o-nhap o-quet"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              </Field>
              <button type="submit" className={`nut phu${busy ? " dang-xu-ly" : ""}`} disabled={busy || !code.trim()}>
                {t("appScanSubmit")}
              </button>
            </form>
            {qrUrl && (
              <div style={{ display: "grid", gap: "var(--khoang-2)", justifyItems: "start" }}>
                <strong>{t("appQrTitle")}</strong>
                <img src={qrDataUrl(qrUrl)} alt={t("appQrLabel", { documentNo: checkout.documentNo })} width={200} height={200} style={{ imageRendering: "pixelated" }} />
              </div>
            )}
          </div>
        )}
        {checkout?.buyer && open(checkout.status) && (
          <div className="khoi thong-tin" role="status">
            {status === "awaiting_buyer"
              ? t("appWaitingBuyer", { name: checkout.buyer.maskedName })
              : t("appWaitingPayment", { name: checkout.buyer.maskedName, amount: money(checkout.amountDue ?? "0"), points: checkout.points.toLocaleString("vi-VN") })}
          </div>
        )}
        {status === "completed" && <div className="khoi thanh-cong">{t("appCompleted")}</div>}
        {status === "paid_unposted" && <div className="khoi loi">{t("appUnposted", { reason: checkout?.postingError ?? "" })}</div>}
        {(status === "expired" || status === "declined" || status === "cancelled") && (
          <div className="khoi canh-bao">{status === "declined" ? t("appDeclined") : status === "expired" ? t("appExpired") : t("appCancelled")}</div>
        )}
        <FormError text={error} />
        <div className="dong" style={{ gap: "var(--khoang-3)" }}>
          {checkout && open(checkout.status) && !checkout.buyer && (
            <button type="button" className="nut nguy-hiem" onClick={() => void cancel(false)}>
              {t("appCancel")}
            </button>
          )}
          {(!checkout || !open(checkout.status)) && status !== "completed" && status !== "paid_unposted" && (
            <button type="button" className="nut phu" onClick={() => setAttempt((value) => value + 1)}>
              {t("appNewCode")}
            </button>
          )}
          <button type="button" className="nut phu" onClick={() => void cancel(true)} disabled={checkout?.status === "awaiting_payment"}>
            {t("appClose")} <span className="phim">Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
}
