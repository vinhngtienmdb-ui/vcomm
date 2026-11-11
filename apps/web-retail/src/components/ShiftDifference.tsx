"use client";

// Nhãn lệch tiền của ca: thiếu (lỗi), thừa (cảnh báo), khớp (thành công); kèm chữ, không chỉ dựa vào màu.
import { useTranslations } from "next-intl";
import { formatMoney } from "ui/lib/format";

export function ShiftDifference({ difference, currency }: { difference: string | null; currency: string }) {
  const t = useTranslations("retailShifts");
  if (difference === null) return <span>—</span>;
  const value = Number(difference);
  if (value === 0) return <span className="nhan thanh-cong">{t("balanced")}</span>;
  const amount = formatMoney(String(Math.abs(value)), currency);
  return value < 0 ? <span className="nhan loi">{t("shortage", { amount })}</span> : <span className="nhan canh-bao">{t("surplus", { amount })}</span>;
}
