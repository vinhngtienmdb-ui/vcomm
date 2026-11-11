"use client";

// Thành phần dùng chung của MAN_HINH_126 đến 128, 130 (CONG_VIEC_48): nhãn trạng thái, cảnh báo, định dạng tiền.
import type { PayrollStatus, PayrollWarningCode } from "contracts";
import { useTranslations } from "next-intl";
import { formatMoney } from "ui/lib/format";

// Lương tính bằng đồng Việt Nam.
export const vnd = (value: string) => formatMoney(value, "VND");
export const monthLabel = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`;

const statusTone: Record<PayrollStatus, string> = {
  draft: "trung-tinh",
  pending: "thong-tin",
  rejected: "loi",
  withdrawn: "trung-tinh",
  approved: "thanh-cong",
  paid: "thanh-cong",
  cancelled: "trung-tinh",
};
const blocking: PayrollWarningCode[] = ["timesheetMissing", "branchRegionMissing", "negativeNet"];
const informational: PayrollWarningCode[] = ["flatWithholding", "probationNoInsurance"];

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  const t = useTranslations("payroll");
  return <span className={`nhan ${statusTone[status]}`}>{t(`payrollStatus_${status}`)}</span>;
}

export function WarningBadges({ warnings }: { warnings: PayrollWarningCode[] }) {
  const t = useTranslations("payroll");
  if (warnings.length === 0) return <>—</>;
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "var(--khoang-1)" }}>
      {warnings.map((warning) => (
        <span key={warning} className={`nhan ${blocking.includes(warning) ? "loi" : informational.includes(warning) ? "thong-tin" : "canh-bao"}`}>
          {t(`warning_${warning}`)}
        </span>
      ))}
    </span>
  );
}
