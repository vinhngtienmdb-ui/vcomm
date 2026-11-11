"use client";

// Bảng chỉ tiêu báo cáo hợp nhất (MAN_HINH_62, 63): cộng gộp, loại trừ, hợp nhất, cột so sánh.
import type { ConsolidatedStatementResponse } from "contracts";
import { useTranslations } from "next-intl";
import { formatDate, formatNumber } from "ui/lib/format";

const amount = (value: string) => (value === "0" ? "" : Number(value) < 0 ? `(${formatNumber(String(-Number(value)))})` : formatNumber(value));

export function ConsolidatedStatementTable({ report }: { report: ConsolidatedStatementResponse }) {
  const t = useTranslations("consolidation");
  const statements = useTranslations("statements");
  const column = (index: number) => {
    const item = report.columns[index]!;
    return `${statements(`column_${item.label}` as "column_endOfPeriod")} (${item.from ? `${formatDate(item.from)} – ` : ""}${formatDate(item.to)})`;
  };
  const headings = [statements("code"), statements("item"), t("combined"), t("eliminations"), `${t("consolidated")} · ${column(0)}`, `${t("combined")} · ${column(1)}`];
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.lines.map((line) => {
            const weight = line.level === 0 ? 700 : undefined;
            return (
              <tr key={line.code}>
                <td data-nhan={headings[0]}>
                  <span style={{ fontWeight: weight }}>{line.code}</span>
                </td>
                <td data-nhan={headings[1]}>
                  <span style={{ paddingLeft: `calc(var(--khoang-3) * ${line.level})`, fontWeight: weight }}>{line.name}</span>
                </td>
                {[line.combined, line.eliminations, line.consolidated, line.previous].map((value, index) => (
                  <td key={index} data-nhan={headings[index + 2]}>
                    <span style={{ whiteSpace: "nowrap", fontWeight: weight }}>{amount(value)}</span>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
