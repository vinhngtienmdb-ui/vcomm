"use client";

import type { BudgetAdjustmentListItem } from "contracts";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney } from "ui/lib/format";
import { BudgetStatus, numericCell } from "./BudgetStatus";

// Bảng phiếu điều chỉnh dùng chung cho MAN_HINH_207 và danh sách phiếu trong MAN_HINH_205.
export function AdjustmentTable({ items, headings, footer }: { items: BudgetAdjustmentListItem[]; headings: string[]; footer?: ReactNode }) {
  const t = useTranslations("budgetAdjustments");
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={index} scope="col" style={index === 3 || index === 4 ? numericCell : undefined}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-nhan={headings[0]}>
                <Link href={`/budget-adjustments/${item.id}`}>{item.documentNo ?? t("draftNo")}</Link>
              </td>
              <td data-nhan={headings[1]}>
                <span>{item.planDocumentNo ?? "—"}</span>
              </td>
              <td data-nhan={headings[2]}>
                <span>{item.reason}</span>
              </td>
              <td data-nhan={headings[3]} style={numericCell}>
                <span>{formatMoney(item.totalIncrease, item.currency)}</span>
              </td>
              <td data-nhan={headings[4]} style={numericCell}>
                <span>{formatMoney(item.totalDecrease, item.currency)}</span>
              </td>
              <td data-nhan={headings[5]}>
                <span>{item.createdByName}</span>
              </td>
              <td data-nhan={headings[6]}>
                <BudgetStatus status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
}
