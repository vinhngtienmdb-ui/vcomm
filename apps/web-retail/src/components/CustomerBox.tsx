"use client";

// Khách VComm tại quầy (lát L6; MAN_HINH_161; API_198; QUYTAC_NGHIEPVU_379): tra theo số điện thoại (F3), hiện tên che, hạng, điểm khả dụng, Smart OTP.
import type { RetailCustomerResponse } from "contracts";
import { useTranslations } from "next-intl";
import { type FormEvent, type RefObject, useState } from "react";
import { apiFetch } from "ui/lib/api";
import { failureOf } from "ui/lib/use-api";
import { formatDateTime } from "ui/lib/format";

export async function lookupCustomer(shiftId: string, phone: string, goodsAmount: string | null): Promise<RetailCustomerResponse> {
  const query = new URLSearchParams({ shiftId, phone, ...(goodsAmount ? { goodsAmount } : {}) });
  return apiFetch<RetailCustomerResponse>(`/retail/customers?${query.toString()}`);
}

export function CustomerBox({
  shiftId,
  goodsAmount,
  customer,
  inputRef,
  onChange,
}: {
  shiftId: string;
  goodsAmount: string | null;
  customer: { phone: string; data: RetailCustomerResponse } | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (customer: { phone: string; data: RetailCustomerResponse } | null) => void;
}) {
  const t = useTranslations("retailCounter");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const points = (value: number) => value.toLocaleString("vi-VN");

  async function find(event: FormEvent) {
    event.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      onChange({ phone: phone.trim(), data: await lookupCustomer(shiftId, phone.trim(), goodsAmount) });
    } catch (failure) {
      setError(failureOf(failure).message);
    } finally {
      setBusy(false);
    }
  }

  if (customer?.data.found) {
    const data = customer.data;
    return (
      <div style={{ display: "grid", gap: "var(--khoang-2)" }}>
        <div className="dong-tien">
          <span>
            <strong>{data.maskedName}</strong> · {data.maskedPhone}
            <br />
            <span className="chu-thich">
              {t("customerInfo", { tier: data.tierName ?? "—", points: points(data.balance) })}
              {data.smartOtpActive ? ` · ${t("smartOtpOn")}` : ""}
            </span>
          </span>
          <button type="button" className="nut chu" onClick={() => onChange(null)}>
            {t("removeCustomer")}
          </button>
        </div>
        {data.expectedPoints > 0 && <div className="khoi-canh-bao thong-tin">{t("expectedPoints", { points: points(data.expectedPoints) })}</div>}
        {data.redeemBlockedReason === "smart_otp_inactive" && <div className="khoi-canh-bao">{t("smartOtpInactive")}</div>}
        {data.redeemBlockedReason === "smart_otp_locked" && data.smartOtpLockedUntil && (
          <div className="khoi-canh-bao loi">{t("smartOtpLocked", { time: formatDateTime(data.smartOtpLockedUntil) })}</div>
        )}
      </div>
    );
  }
  return (
    <form onSubmit={find} style={{ display: "grid", gap: "var(--khoang-2)" }}>
      <label htmlFor="khach-vcomm">
        {t("customerPhone")} <span className="phim">F3</span>
      </label>
      <div className="nhom-nut">
        <input ref={inputRef} id="khach-vcomm" className="o-nhap" inputMode="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} style={{ flex: "1 1 140px" }} />
        <button type="submit" className={`nut phu${busy ? " dang-xu-ly" : ""}`} disabled={busy}>
          {t("findCustomer")}
        </button>
      </div>
      {customer && !customer.data.found && <div className="khoi-canh-bao">{t("customerNotFound", { phone: customer.data.maskedPhone })}</div>}
      {error && <span className="loi-o">{error}</span>}
    </form>
  );
}
