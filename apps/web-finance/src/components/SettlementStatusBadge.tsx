"use client";

// Nhãn trạng thái, số thuần của bảng đối soát điểm nội bộ (CONG_VIEC_60; QUYTAC_NGHIEPVU_470, 471).
import type { LoyaltySettlementStatus } from "contracts";
import { useTranslations } from "next-intl";
import { formatNumber } from "ui/lib/format";

const tone: Record<LoyaltySettlementStatus, string> = {
  pending: "trung-tinh",
  operator_confirmed: "thong-tin",
  company_confirmed: "thong-tin",
  disputed: "canh-bao",
  mismatched: "loi",
  confirmed: "thanh-cong",
  partially_paid: "thong-tin",
  settled: "thanh-cong",
  carried_forward: "trung-tinh",
};

export function SettlementStatusBadge({ status }: { status: LoyaltySettlementStatus }) {
  const t = useTranslations("loyaltySettlements");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}

// Số thuần dương: công ty con phải trả công ty vận hành sàn; âm: công ty vận hành sàn phải trả.
export function NetAmount({ amount, operatorName, companyName }: { amount: string; operatorName: string; companyName: string }) {
  const t = useTranslations("loyaltySettlements");
  const value = Number(amount);
  if (Math.abs(value) < 0.5) return <span>0</span>;
  return (
    <span>
      <strong style={{ whiteSpace: "nowrap" }}>{formatNumber(Math.abs(value))}</strong>
      <span className="chu-thich"> · {t("payer", { company: value > 0 ? companyName : operatorName })}</span>
    </span>
  );
}
