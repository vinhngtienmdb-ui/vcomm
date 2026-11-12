"use client";

// Nhãn trạng thái kế hoạch ngân sách, phiếu điều chỉnh (CONG_VIEC_58).
import type { BudgetDocumentStatus } from "contracts";
import { useTranslations } from "next-intl";

const tone: Record<BudgetDocumentStatus, string> = {
  draft: "trung-tinh",
  pending: "canh-bao",
  approved: "thanh-cong",
  rejected: "loi",
  withdrawn: "trung-tinh",
  cancelled: "trung-tinh",
};

export function BudgetStatus({ status }: { status: BudgetDocumentStatus }) {
  const t = useTranslations("budgets");
  return <span className={`nhan ${tone[status]}`}>{t(`status_${status}`)}</span>;
}

export const numericCell = { textAlign: "right", whiteSpace: "nowrap" } as const;

// "2026-10" → "10/2026".
export const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

// Các tháng từ tháng đầu đến tháng cuối (dạng "YYYY-MM").
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  while (months.length < 12 && `${year}-${String(month).padStart(2, "0")}` <= to) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
