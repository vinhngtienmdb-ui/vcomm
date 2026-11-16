// Dùng chung cho MAN_HINH_262, 263 đối soát đối tác liên minh (CONG_VIEC_65; QUYTAC_NGHIEPVU_548, 549).
import type { PartnerSettlementStatus } from "contracts";
import { formatNumber } from "ui/lib/format";

export const settlementStatusClass: Record<PartnerSettlementStatus, string> = {
  unreconciled: "canh-bao",
  mismatched: "loi",
  matched: "thong-tin",
  confirmed: "trung-tinh",
  paid: "thanh-cong",
};

// "10/2026" từ "2026-10".
export const periodLabel = (period: string) => `${period.slice(5, 7)}/${period.slice(0, 4)}`;

export function netLabel(t: (key: string, values?: Record<string, string>) => string, net: string): string {
  const value = Number(net);
  if (value === 0) return "0";
  return value > 0 ? t("netPartnerPays", { amount: formatNumber(net, 0) }) : t("netCompanyPays", { amount: formatNumber(String(-value), 0) });
}
