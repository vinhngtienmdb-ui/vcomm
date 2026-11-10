// Xuất báo cáo tài chính Excel, PDF (CONG_VIEC_15; CHUC_NANG_75). Dùng write-excel-file, pdfmake đã có trong dự án.
import type { StatementResponse } from "contracts";
import { dirname, join } from "node:path";
import writeXlsxFile from "write-excel-file/node";

// pdfmake 0.3 không kèm khai báo kiểu.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmake = require("pdfmake") as {
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(definition: Record<string, unknown>): { getBuffer(): Promise<Buffer> };
};
const fontDirectory = join(dirname(require.resolve("pdfmake/package.json")), "fonts", "Roboto");
pdfmake.setFonts({
  Roboto: {
    normal: join(fontDirectory, "Roboto-Regular.ttf"),
    bold: join(fontDirectory, "Roboto-Medium.ttf"),
    italics: join(fontDirectory, "Roboto-Italic.ttf"),
    bolditalics: join(fontDirectory, "Roboto-MediumItalic.ttf"),
  },
});
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => path.startsWith(fontDirectory));

const columnTitles: Record<string, string> = { endOfPeriod: "Số cuối kỳ", startOfYear: "Số đầu năm", currentPeriod: "Kỳ này", previousPeriod: "Cùng kỳ năm trước" };
const date = (value: string) => value.split("-").reverse().join("/");
const number = (value: string) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(Number(value));
const columnTitle = (column: StatementResponse["columns"][number]) => `${columnTitles[column.label] ?? column.label} (${column.from ? `${date(column.from)} – ` : ""}${date(column.to)})`;
const period = (report: StatementResponse) =>
  report.columns[0]!.from ? `Từ ngày ${date(report.columns[0]!.from)} đến ngày ${date(report.columns[0]!.to)}` : `Tại ngày ${date(report.columns[0]!.to)}`;

export const statementFileName = (report: StatementResponse, extension: string) => `${report.form}-${report.columns[0]!.to}.${extension}`;

export async function statementXlsx(report: StatementResponse): Promise<Buffer> {
  const bold = { fontWeight: "bold" as const };
  const rows = [
    [{ value: report.company.name, ...bold }],
    [{ value: `${report.name.toUpperCase()} (Mẫu ${report.form})`, ...bold }],
    [{ value: period(report) }],
    [{ value: `Đơn vị tính: ${report.currency}` }],
    [],
    [{ value: "Chỉ tiêu", ...bold }, { value: "Mã số", ...bold }, ...report.columns.map((column) => ({ value: columnTitle(column), ...bold }))],
    ...report.lines.map((line) => [
      { value: line.name, ...(line.level === 0 ? bold : {}) },
      { value: line.code },
      { value: Number(line.current), type: Number, format: "#,##0" },
      { value: Number(line.previous), type: Number, format: "#,##0" },
    ]),
  ];
  return writeXlsxFile(rows as never, { sheet: report.form, columns: [{ width: 70 }, { width: 10 }, { width: 22 }, { width: 22 }] }).toBuffer();
}

export async function statementPdf(report: StatementResponse): Promise<Buffer> {
  const definition = {
    pageSize: "A4",
    pageMargins: [36, 36, 36, 48],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    content: [
      { text: report.company.name, bold: true },
      report.company.taxCode ? { text: `Mã số thuế: ${report.company.taxCode}` } : "",
      report.company.address ? { text: report.company.address } : "",
      { text: `Mẫu số ${report.form}`, alignment: "right", italics: true },
      { text: report.name.toUpperCase(), bold: true, fontSize: 13, alignment: "center", margin: [0, 8, 0, 2] },
      { text: period(report), alignment: "center" },
      { text: `Đơn vị tính: ${report.currency}`, alignment: "right", italics: true, margin: [0, 4, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: ["*", 36, 90, 90],
          body: [
            [{ text: "Chỉ tiêu", bold: true }, { text: "Mã số", bold: true, alignment: "center" }, ...report.columns.map((column) => ({ text: columnTitle(column), bold: true, alignment: "center" }))],
            ...report.lines.map((line) => [
              { text: line.name, bold: line.level === 0 },
              { text: line.code, alignment: "center" },
              { text: number(line.current), alignment: "right" },
              { text: number(line.previous), alignment: "right" },
            ]),
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      },
      {
        columns: ["Người lập biểu", "Kế toán trưởng", "Người đại diện theo pháp luật"].map((title) => ({
          stack: [
            { text: title, bold: true },
            { text: "(Ký, họ tên)", italics: true },
          ],
          alignment: "center",
        })),
        margin: [0, 24, 0, 0],
      },
    ],
  };
  return pdfmake.createPdf(definition).getBuffer();
}
