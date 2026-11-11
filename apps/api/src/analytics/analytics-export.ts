// Xuất Excel báo cáo quản trị (QUYTAC_NGHIEPVU_343): cùng bộ lọc, đúng số trên màn hình; dùng write-excel-file đã có trong dự án.
import { analyticsExportRows } from "contracts";
import writeXlsxFile from "write-excel-file/node";
import { ApiError } from "../common/api-error";

export type ExportCell = string | number | null;
export interface ExportTable {
  title: string;
  // Dòng mô tả dưới tiêu đề: công ty, khoảng ngày, đơn vị tiền.
  notes: string[];
  columns: { title: string; numeric?: boolean }[];
  rows: ExportCell[][];
  totals?: ExportCell[][];
}

const date = (value: string) => value.split("-").reverse().join("/");
export const periodNote = (from: string, to: string) => `Từ ngày ${date(from)} đến ngày ${date(to)}`;

export async function reportXlsx(tables: ExportTable[]): Promise<Buffer> {
  if (tables.reduce((count, table) => count + table.rows.length, 0) > analyticsExportRows) throw new ApiError("BUSINESS_RULE", "analyticsExportTooLarge");
  const bold = { fontWeight: "bold" as const };
  const cell = (value: ExportCell, numeric: boolean | undefined, extra: object = {}) =>
    numeric && value !== null && value !== "" ? { value: Number(value), type: Number, format: "#,##0.####", ...extra } : { value: value === null ? "" : String(value), ...extra };
  const sheets = tables.map((table) => ({
    sheet: table.title.slice(0, 31),
    data: [
      [{ value: table.title, ...bold }],
      ...table.notes.map((note) => [{ value: note }]),
      [],
      table.columns.map((column) => ({ value: column.title, ...bold })),
      ...table.rows.map((row) => row.map((value, index) => cell(value, table.columns[index]?.numeric))),
      ...(table.totals ?? []).map((row) => row.map((value, index) => cell(value, table.columns[index]?.numeric, bold))),
    ],
  }));
  return (await writeXlsxFile(sheets).toBuffer()) as Buffer;
}

export const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
