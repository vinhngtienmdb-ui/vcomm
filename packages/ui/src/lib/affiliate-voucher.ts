// Nhãn voucher liên kết dùng chung cổng cửa hàng (web-affiliate) và web quản trị (web-crm) (CONG_VIEC_55).
import type { AffiliateVoucherDisplayStatus, AffiliateVoucherItem } from "contracts";
import type { useTranslations } from "next-intl";
import { formatNumber } from "./format";

export const voucherStatusClass: Record<AffiliateVoucherDisplayStatus, string> = {
  draft: "trung-tinh",
  pending: "thong-tin",
  scheduled: "thong-tin",
  active: "thanh-cong",
  paused: "canh-bao",
  ended: "trung-tinh",
  rejected: "loi",
  withdrawn: "trung-tinh",
};

export function discountText(t: ReturnType<typeof useTranslations>, voucher: Pick<AffiliateVoucherItem, "discountKind" | "discountValue" | "maxDiscount" | "minBill">): string {
  const main =
    voucher.discountKind === "amount"
      ? t("discountAmount", { amount: formatNumber(voucher.discountValue, 0) })
      : t("discountPercent", { percent: formatNumber(voucher.discountValue, 2), max: formatNumber(voucher.maxDiscount, 0) });
  return Number(voucher.minBill) > 0 ? `${main}, ${t("minBill", { amount: formatNumber(voucher.minBill, 0) })}` : main;
}
