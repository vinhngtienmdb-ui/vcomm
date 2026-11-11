"use client";

// Thành phần dùng chung của màn hình chấm công (CONG_VIEC_47): bảng, thẻ, ô công, tháng.
import type { AttendanceDayCell } from "contracts";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function Table({ headings, rows, footer }: { headings: string[]; rows: { key: string; cells: ReactNode[] }[]; footer?: ReactNode }) {
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={index} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={index} data-nhan={headings[index] ?? ""}>
                  <span>{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer && <div className="phan-trang">{footer}</div>}
    </div>
  );
}

export function Tabs({ labels, selected, onSelect }: { labels: string[]; selected: number; onSelect: (index: number) => void }) {
  return (
    <div className="cac-the" role="tablist">
      {labels.map((label, index) => (
        <button key={label} type="button" role="tab" aria-selected={index === selected} className={index === selected ? "chon" : ""} onClick={() => onSelect(index)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// Ký hiệu và màu của một ô công (bản mẫu MAN_HINH_121).
export function dayTone(day: AttendanceDayCell): "thanh-cong" | "canh-bao" | "loi" | "thong-tin" | "trung-tinh" {
  if (day.status === "absent" || day.status === "missing_punch") return "loi";
  if (day.status === "rest" || day.status === "holiday" || day.status === "scheduled") return "trung-tinh";
  if (day.lateMinutes > 0 || day.earlyMinutes > 0) return "canh-bao";
  return Number(day.plannedUnits) < 1 ? "thong-tin" : "thanh-cong";
}

export function daySymbol(day: AttendanceDayCell): string {
  if (day.status === "absent") return "V";
  if (day.status === "missing_punch") return "!";
  if (day.status === "holiday") return "L";
  if (day.status === "rest") return "–";
  if (day.status === "scheduled") return day.shiftCode ?? "·";
  return Number(day.workedUnits).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function DayLegend() {
  const t = useTranslations("attendance");
  const items: [string, string, string][] = [
    ["1", "thanh-cong", t("legendFull")],
    ["0,94", "canh-bao", t("legendLate")],
    ["0,5", "thong-tin", t("legendHalf")],
    ["L", "trung-tinh", t("legendHoliday")],
    ["–", "trung-tinh", t("legendRest")],
    ["V", "loi", t("legendAbsent")],
    ["!", "loi", t("legendMissing")],
  ];
  return (
    <span>
      {t("legend")}:{" "}
      {items.map(([symbol, tone, label]) => (
        <span key={label}>
          <span className={`nhan ${tone}`}>{symbol}</span> {label}{" "}
        </span>
      ))}
    </span>
  );
}

export const currentMonth = (today: string) => today.slice(0, 7);
export const weekdayLabel = (date: string, labels: string[]) => labels[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7]!;
export const mondayOf = (date: string) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
};
export const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const hours = (minutes: number) => (minutes / 60).toLocaleString("vi-VN", { maximumFractionDigits: 2 });
export const vietnamClock = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(iso)) : "—";
