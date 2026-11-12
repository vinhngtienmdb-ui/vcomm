"use client";

// MAN_HINH_209: khối ngân sách mua trong đơn mua (QUYTAC_NGHIEPVU_451, 452). Chỉ cảnh báo, không chặn lưu.
import type { BudgetCheckCell, BudgetCheckResponse } from "contracts";
import { useTranslations } from "next-intl";
import { formatMoney } from "ui/lib/format";
import { monthLabel, numericCell } from "./BudgetStatus";

const tone = { within: "thanh-cong", over: "loi", missing: "canh-bao" } as const;

export function BudgetPanel({ check, snapshot, currency }: { check: BudgetCheckResponse | null; snapshot?: BudgetCheckCell[] | null; currency: string }) {
  const t = useTranslations("orderBudget");
  if (!check?.applies && !snapshot?.length) return null;
  const cells = check?.cells ?? [];
  const flagged = cells.filter((cell) => cell.status !== "within").length;
  return (
    <section className="the" aria-labelledby="ngan-sach-don">
      <h2 id="ngan-sach-don" style={{ margin: 0 }}>
        {t("title")}
      </h2>
      {check?.applies &&
        (flagged > 0 ? (
          <div className="khoi-canh-bao canh-bao" role="status">
            {t("overWarning", { count: flagged })}
          </div>
        ) : (
          cells.length > 0 && (
            <div className="khoi-canh-bao thong-tin" role="status">
              {t("within")}
            </div>
          )
        ))}
      {cells.length > 0 && <CellTable cells={cells} currency={check?.currency ?? currency} />}
      {snapshot && snapshot.length > 0 && (
        <>
          <strong>{t("snapshotTitle")}</strong>
          <CellTable cells={snapshot} currency={check?.currency ?? currency} />
        </>
      )}
      <span className="chu-thich">{t("hint")}</span>
    </section>
  );
}

function CellTable({ cells, currency }: { cells: BudgetCheckCell[]; currency: string }) {
  const t = useTranslations("orderBudget");
  const headings = [t("category"), t("warehouse"), t("month"), t("budget"), t("used"), t("order"), t("remainingAfter"), ""];
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {headings.map((heading, index) => (
              <th key={index} scope="col" style={index > 2 && index < 7 ? numericCell : undefined}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => (
            <tr key={`${cell.categoryId}|${cell.warehouseId}|${cell.month}`}>
              <td data-nhan={headings[0]}>
                <span>
                  {cell.categoryCode} · {cell.categoryName}
                </span>
              </td>
              <td data-nhan={headings[1]}>
                <span>{cell.warehouseName}</span>
              </td>
              <td data-nhan={headings[2]}>
                <span>{monthLabel(cell.month)}</span>
              </td>
              <td data-nhan={headings[3]} style={numericCell}>
                <span>{cell.budget === null ? "—" : formatMoney(cell.budget, currency)}</span>
              </td>
              <td data-nhan={headings[4]} style={numericCell}>
                <span>{formatMoney(cell.used, currency)}</span>
              </td>
              <td data-nhan={headings[5]} style={numericCell}>
                <span>{formatMoney(cell.order, currency)}</span>
              </td>
              <td data-nhan={headings[6]} style={numericCell}>
                {cell.remainingAfter !== null && Number(cell.remainingAfter) < 0 ? (
                  <strong style={{ color: "var(--mau-loi)" }}>{formatMoney(cell.remainingAfter, currency)}</strong>
                ) : (
                  <span>{cell.remainingAfter === null ? "—" : formatMoney(cell.remainingAfter, currency)}</span>
                )}
              </td>
              <td data-nhan={headings[7]}>
                <span className={`nhan ${tone[cell.status]}`}>{t(`status_${cell.status}`)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
