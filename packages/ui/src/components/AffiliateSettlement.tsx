"use client";

// Bảng đối soát tuần của cửa hàng liên kết (CONG_VIEC_55; QUYTAC_NGHIEPVU_403): dùng chung cổng cửa hàng (MAN_HINH_176) và web quản trị (MAN_HINH_180).
// Chỉ hiển thị số liệu backend trả về; không tính lại tiền.
import type { AffiliateSettlementDetail, AffiliateSettlementItem, AffiliateSettlementStatus } from "contracts";
import { useTranslations } from "next-intl";
import { formatDate, formatDateTime, formatNumber } from "../lib/format";

export const settlementStatusClass: Record<AffiliateSettlementStatus, string> = {
  awaiting_confirmation: "thong-tin",
  disputed: "canh-bao",
  confirmed: "trung-tinh",
  paid: "thanh-cong",
};

const money = (value: string) => formatNumber(value, 0);

// Số còn lại theo chiều: dương cửa hàng trả, âm công ty trả.
export function SettlementNet({ settlement }: { settlement: Pick<AffiliateSettlementItem, "netAmount"> }) {
  const t = useTranslations("affiliateSettlement");
  const net = Number(settlement.netAmount);
  if (net === 0) return <>0</>;
  return <>{net > 0 ? t("merchantPays", { amount: money(settlement.netAmount) }) : t("companyPays", { amount: money(String(-net)) })}</>;
}

export function SettlementStatus({ settlement }: { settlement: Pick<AffiliateSettlementItem, "status" | "overdue" | "openAmount"> }) {
  const t = useTranslations("affiliateSettlement");
  if (settlement.overdue) return <span className="nhan loi">{t("overdue")}</span>;
  return <span className={`nhan ${settlementStatusClass[settlement.status]}`}>{t(`status_${settlement.status}`)}</span>;
}

// Hạn: tự xác nhận (chờ xác nhận) hoặc hạn thanh toán (đã xác nhận).
export function SettlementDue({ settlement }: { settlement: AffiliateSettlementItem }) {
  const t = useTranslations("affiliateSettlement");
  if (settlement.status === "awaiting_confirmation") return <>{t("autoConfirmOn", { date: formatDateTime(settlement.confirmDueAt) })}</>;
  if (settlement.status === "confirmed" && settlement.dueDate) return <>{t("payBy", { date: formatDate(settlement.dueDate) })}</>;
  return <>—</>;
}

export function SettlementBreakdown({ settlement }: { settlement: AffiliateSettlementDetail }) {
  const t = useTranslations("affiliateSettlement");
  const line = (label: string, value: string, sign: "+" | "−" | "" = "") => (
    <div className="dong-tien">
      <span>{label}</span>
      <span style={{ whiteSpace: "nowrap" }}>
        {sign === "−" && Number(value) !== 0 ? "− " : ""}
        {money(value)}
      </span>
    </div>
  );
  const adjustment = Number(settlement.adjustmentAmount);
  return (
    <div style={{ display: "grid", gap: "var(--khoang-3)" }}>
      <p className="chu-thich" style={{ margin: 0 }}>
        {t("weekOf", { from: formatDate(settlement.weekStart), to: formatDate(settlement.weekEnd) })} · {t("transactionCount", { count: settlement.transactionCount })}
      </p>
      <div style={{ display: "grid", gap: "var(--khoang-1)" }}>
        {line(t("lineA"), settlement.earnedAmount)}
        {Number(settlement.shortfallAmount) > 0 && line(t("lineShortfall"), settlement.shortfallAmount)}
        {line(t("lineB"), settlement.redeemedAmount, "−")}
        {line(t("lineC"), settlement.companyVoucherAmount, "−")}
        {line(t("lineD", { percent: formatNumber(settlement.feePercent, 2) }), settlement.feeAmount)}
        {settlement.smsCount > 0 && line(t("lineF", { count: settlement.smsCount }), settlement.smsFeeAmount)}
        {line(t("lineE", { percent: formatNumber(settlement.feeTaxRate, 2) }), settlement.feeTaxAmount)}
        {adjustment !== 0 && line(t("lineAdjustment"), String(Math.abs(adjustment)), adjustment < 0 ? "−" : "")}
        <div className="dong-tien" style={{ fontWeight: 800, borderTop: "1px solid var(--mau-vien)", paddingTop: "var(--khoang-1)" }}>
          <span>{t(adjustment !== 0 ? "lineNetAdjusted" : "lineNet")}</span>
          <span>
            <SettlementNet settlement={settlement} />
          </span>
        </div>
      </div>
      {settlement.openAmount !== null && (
        <p style={{ margin: 0 }}>
          {t("debt", { amount: money(settlement.openAmount), date: settlement.dueDate ? formatDate(settlement.dueDate) : "—" })}
          {settlement.overdue ? ` · ${t("overdue")}` : ""}
        </p>
      )}
      {settlement.confirmedAt && (
        <p className="chu-thich" style={{ margin: 0 }}>
          {settlement.autoConfirmed
            ? t("autoConfirmedAt", { date: formatDateTime(settlement.confirmedAt) })
            : t("confirmedAt", { date: formatDateTime(settlement.confirmedAt), name: settlement.confirmedByName ?? settlement.resolvedByName ?? "—" })}
        </p>
      )}
      {settlement.disputeReason && (
        <div className="khoi-canh-bao canh-bao">
          <strong>{t("disputeBy", { name: settlement.disputedByName ?? "—", date: settlement.disputedAt ? formatDateTime(settlement.disputedAt) : "" })}</strong>
          <div>{settlement.disputeReason}</div>
          {settlement.resolutionNote && (
            <div style={{ marginTop: "var(--khoang-2)" }}>
              <strong>{t("resolutionBy", { name: settlement.resolvedByName ?? "—" })}</strong> {settlement.resolutionNote}
              {settlement.adjustmentReason ? ` (${settlement.adjustmentReason})` : ""}
            </div>
          )}
        </div>
      )}
      <div className="khung-bang">
        <table>
          <thead>
            <tr>
              <th>{t("column_document")}</th>
              <th>{t("column_time")}</th>
              <th>{t("column_outlet")}</th>
              <th className="so">{t("column_bill")}</th>
              <th className="so">{t("column_earned")}</th>
              <th className="so">{t("column_redeemed")}</th>
              <th className="so">{t("column_voucher")}</th>
            </tr>
          </thead>
          <tbody>
            {settlement.transactions.map((item) => (
              <tr key={item.id}>
                <td data-nhan={t("column_document")}>
                  {item.documentNo}
                  {item.status === "cancelled" ? ` (${t("cancelled")})` : ""}
                </td>
                <td data-nhan={t("column_time")}>{formatDateTime(item.completedAt)}</td>
                <td data-nhan={t("column_outlet")}>{item.outletName}</td>
                <td data-nhan={t("column_bill")} className="so">
                  {money(item.billAmount)}
                </td>
                <td data-nhan={t("column_earned")} className="so">
                  {money(item.status === "cancelled" ? item.shortfallAmount : item.earnedAmount)}
                </td>
                <td data-nhan={t("column_redeemed")} className="so">
                  {item.status === "cancelled" ? "0" : money(item.redeemedAmount)}
                </td>
                <td data-nhan={t("column_voucher")} className="so">
                  {item.status === "cancelled" || Number(item.voucherPayable) === 0 ? "0" : money(item.voucherPayable)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
