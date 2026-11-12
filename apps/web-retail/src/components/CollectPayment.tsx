"use client";

// Thu tiền khi giao đơn trực tuyến (CONG_VIEC_57; QUYTAC_NGHIEPVU_426 theo QUYTAC_NGHIEPVU_373): chuyển khoản VietQR (xác nhận đã nhận), tiền mặt, tiền thừa.
import type { RetailShiftResponse, StationHandoverRequest } from "contracts";
import { useTranslations } from "next-intl";
import qrcode from "qrcode-generator";
import { useState } from "react";
import { Field } from "ui/components/Form";
import { formatMoney } from "ui/lib/format";
import { vietQrContent, vietQrPayload } from "@/lib/vietqr";

function qrDataUrl(text: string): string {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  return code.createDataURL(4, 8);
}

export type CollectedPayments = { payments: StationHandoverRequest["payments"]; ready: boolean };

export function CollectPayment({ due, shift, reference, onChange }: { due: number; shift: RetailShiftResponse; reference: string; onChange: (value: CollectedPayments) => void }) {
  const t = useTranslations("retailCounter");
  const bank = shift.store.bankTransfer;
  const [transferOn, setTransferOn] = useState(false);
  const [transfer, setTransfer] = useState(String(due));
  const [received, setReceived] = useState(false);
  const [bankReference, setBankReference] = useState("");
  const [cash, setCash] = useState(String(due));
  const money = (amount: number) => formatMoney(String(amount), shift.currency);
  const content = vietQrContent(reference);

  function report(next: { transferOn: boolean; transfer: string; received: boolean; bankReference: string; cash: string }) {
    const transferAmount = next.transferOn ? Number(next.transfer) || 0 : 0;
    const cashAmount = Number(next.cash) || 0;
    const payments: StationHandoverRequest["payments"] = [];
    if (transferAmount > 0) payments.push({ method: "bank_transfer", amount: String(transferAmount), bankReference: next.bankReference });
    if (cashAmount > 0) payments.push({ method: "cash", amount: String(cashAmount) });
    onChange({ payments, ready: transferAmount + cashAmount >= due && transferAmount <= due && (!next.transferOn || (next.received && transferAmount > 0)) });
  }
  const state = { transferOn, transfer, received, bankReference, cash };
  const update = (patch: Partial<typeof state>) => {
    const next = { ...state, ...patch };
    if (patch.transferOn !== undefined) setTransferOn(next.transferOn);
    if (patch.transfer !== undefined) setTransfer(next.transfer);
    if (patch.received !== undefined) setReceived(next.received);
    if (patch.bankReference !== undefined) setBankReference(next.bankReference);
    if (patch.cash !== undefined) setCash(next.cash);
    report(next);
  };
  const transferAmount = transferOn ? Number(transfer) || 0 : 0;
  const tendered = transferAmount + (Number(cash) || 0);
  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      {bank && (
        <label>
          <input
            type="checkbox"
            checked={transferOn}
            onChange={(event) => update({ transferOn: event.target.checked, received: false, transfer: String(due), cash: event.target.checked ? "0" : String(due) })}
          />{" "}
          {t("transfer")}
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
              <input
                id="tien-chuyen-khoan"
                className="o-nhap"
                inputMode="decimal"
                value={transfer}
                onChange={(event) => update({ transfer: event.target.value, received: false, cash: String(Math.max(0, due - (Number(event.target.value) || 0))) })}
              />
            </Field>
            <Field id="ma-giao-dich" label={t("transferReference")}>
              <input id="ma-giao-dich" className="o-nhap" maxLength={50} value={bankReference} onChange={(event) => update({ bankReference: event.target.value })} />
            </Field>
            <label>
              <input type="checkbox" checked={received} onChange={(event) => update({ received: event.target.checked })} /> {t("transferReceived", { amount: money(transferAmount) })}
            </label>
          </div>
        </div>
      )}
      <Field id="tien-khach-dua" label={t("cash")}>
        <input id="tien-khach-dua" className="o-nhap" inputMode="decimal" value={cash} onChange={(event) => update({ cash: event.target.value })} onFocus={(event) => event.target.select()} />
      </Field>
      <div className="dong-tien">
        <span>{t("tendered")}</span>
        <span>{money(tendered)}</span>
      </div>
      <div className="dong-tien">
        <span className="tong-lon">{tendered >= due ? t("change") : t("remaining")}</span>
        <span className="tong-lon">{money(Math.abs(tendered - due))}</span>
      </div>
      {transferAmount > due && <span className="loi-o">{t("transferOverTotal")}</span>}
    </div>
  );
}
