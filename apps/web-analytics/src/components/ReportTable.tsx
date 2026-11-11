"use client";

// Bảng số liệu của báo cáo quản trị: cột đầu là nhóm, các cột số canh phải; dòng tổng ở chân bảng; ghi chú khi bảng bị cắt (QUYTAC_NGHIEPVU_343).
import type { ReactNode } from "react";

export interface ReportColumn {
  title: string;
  numeric?: boolean;
}

const numericCell = { textAlign: "right", whiteSpace: "nowrap" } as const;

export function ReportTable({
  columns,
  rows,
  footer,
  note,
}: {
  columns: ReportColumn[];
  rows: { key: string; cells: ReactNode[] }[];
  footer?: { key: string; cells: ReactNode[] }[];
  note?: string | null;
}) {
  const cell = (value: ReactNode, index: number, strong: boolean) => (
    <td key={columns[index]!.title} data-nhan={columns[index]!.title} style={columns[index]!.numeric ? numericCell : { minWidth: 220 }}>
      {strong ? <strong>{value}</strong> : value}
    </td>
  );
  return (
    <div className="khung-bang">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.title} scope="col" style={column.numeric ? numericCell : undefined}>
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>{row.cells.map((value, index) => cell(value, index, false))}</tr>
          ))}
        </tbody>
        {footer && footer.length > 0 && (
          <tfoot>
            {footer.map((row) => (
              <tr key={row.key}>{row.cells.map((value, index) => cell(value, index, true))}</tr>
            ))}
          </tfoot>
        )}
      </table>
      {note && <div className="phan-trang">{note}</div>}
    </div>
  );
}
