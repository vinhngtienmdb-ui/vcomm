// Dựng nội dung hóa đơn để in (QUYTAC_NGHIEPVU_620 khoản 1, 3): tên cửa hàng, điểm bán, số hóa đơn, ngày giờ, thu ngân, dòng hàng, giảm giá, tổng,
// thuế theo suất, phương thức, tiền khách đưa, tiền thừa, lời chào. Khổ 80 mm 48 cột chữ, 58 mm 32 cột. In lại ghi "In lại lần n".
// Kết quả là danh sách dòng không phụ thuộc máy in; lớp in chuyển sang lệnh ESC/POS hoặc lệnh của dịch vụ in Sunmi.
import type { IposSale } from "contracts";
import { t } from "./i18n";

export type ReceiptLine =
  | { kind: "text"; text: string; align: "left" | "center" | "right"; bold?: boolean; large?: boolean }
  | { kind: "columns"; left: string; right: string; bold?: boolean }
  | { kind: "rule" }
  | { kind: "feed" };

export const columnsOf = (paperWidth: 58 | 80) => (paperWidth === 80 ? 48 : 32);

// Bỏ dấu tiếng Việt cho máy in không có bảng mã windows1258 (tùy chọn "In không dấu").
export function withoutDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

const money = (value: string | number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(value));
const quantity = (value: string) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(Number(value));
const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// Cắt dòng theo số cột, ưu tiên ngắt ở khoảng trắng.
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let rest = text.trim();
  while (rest.length > width) {
    const cut = rest.lastIndexOf(" ", width);
    const at = cut > width / 2 ? cut : width;
    lines.push(rest.slice(0, at).trimEnd());
    rest = rest.slice(at).trimStart();
  }
  if (rest) lines.push(rest);
  return lines;
}

// Hai cột trái, phải trên cùng một dòng; trái dài thì xuống dòng.
export function columnsText(left: string, right: string, width: number): string[] {
  if (left.length + right.length + 1 <= width) return [left + " ".repeat(width - left.length - right.length) + right];
  const lines = wrap(left, width);
  const last = lines[lines.length - 1]!;
  if (last.length + right.length + 1 <= width) lines[lines.length - 1] = last + " ".repeat(width - last.length - right.length) + right;
  else lines.push(" ".repeat(Math.max(0, width - right.length)) + right);
  return lines;
}

export function buildReceipt(sale: IposSale, options: { reprintNumber: number | null }): ReceiptLine[] {
  const lines: ReceiptLine[] = [
    { kind: "text", text: sale.merchantName, align: "center", bold: true, large: true },
    { kind: "text", text: sale.outletName, align: "center" },
    { kind: "text", text: sale.outletAddress, align: "center" },
    { kind: "feed" },
    { kind: "text", text: t("receiptTitle"), align: "center", bold: true },
    { kind: "text", text: sale.documentNo, align: "center" },
  ];
  if (options.reprintNumber) lines.push({ kind: "text", text: t("receiptReprint", { count: options.reprintNumber }), align: "center", bold: true });
  lines.push(
    { kind: "columns", left: t("receiptTime"), right: dateTime(sale.soldAt) },
    { kind: "columns", left: t("receiptCashier"), right: `${sale.memberName} · ${sale.registerName}` },
    { kind: "rule" },
  );
  for (const line of sale.lines) {
    lines.push({ kind: "text", text: line.name, align: "left" });
    lines.push({ kind: "columns", left: `  ${quantity(line.quantity)} ${line.unit} x ${money(line.unitPrice)}`, right: money(line.gross) });
    if (Number(line.discount) > 0) lines.push({ kind: "columns", left: `  ${t("receiptLineDiscount")}`, right: `-${money(line.discount)}` });
  }
  lines.push({ kind: "rule" }, { kind: "columns", left: t("receiptSubtotal"), right: money(sale.subtotal) });
  if (Number(sale.lineDiscount) + Number(sale.invoiceDiscount) > 0) {
    lines.push({ kind: "columns", left: t("receiptDiscount"), right: `-${money(Number(sale.lineDiscount) + Number(sale.invoiceDiscount))}` });
  }
  lines.push({ kind: "columns", left: t("receiptTotal"), right: money(sale.total), bold: true });
  for (const tax of sale.taxes) {
    if (tax.vatRate === "exempt") continue;
    lines.push({ kind: "columns", left: t("receiptTax", { rate: tax.vatRate }), right: money(tax.tax) });
  }
  lines.push({ kind: "rule" });
  for (const payment of sale.payments) {
    lines.push({ kind: "columns", left: t(`payment_${payment.method}`), right: money(payment.amount) });
    if (payment.method === "cash" && payment.tendered !== null) lines.push({ kind: "columns", left: t("receiptTendered"), right: money(payment.tendered) });
    if (payment.vietqrReference) lines.push({ kind: "columns", left: `  ${t("receiptTransferContent")}`, right: payment.vietqrReference });
    if (payment.linkNumber && (payment.method === "points" || payment.method === "voucher" || payment.method === "vcomm_app")) lines.push({ kind: "columns", left: `  ${t("receiptLink")}`, right: payment.linkNumber });
  }
  if (Number(sale.change) > 0) lines.push({ kind: "columns", left: t("receiptChange"), right: money(sale.change) });
  // Khách VComm: tên đã che, điểm dùng, điểm tích (QUYTAC_NGHIEPVU_620 khoản 1).
  if (sale.buyerName) {
    lines.push({ kind: "rule" }, { kind: "columns", left: t("receiptBuyer"), right: sale.buyerName });
    if (sale.redeemedPoints > 0) lines.push({ kind: "columns", left: t("receiptPointsUsed"), right: String(sale.redeemedPoints) });
    lines.push({ kind: "columns", left: t("receiptPointsEarned"), right: String(sale.earnedPoints) });
  }
  if (sale.receiptFooter) lines.push({ kind: "feed" }, { kind: "text", text: sale.receiptFooter, align: "center" });
  lines.push({ kind: "feed" });
  return lines;
}

// Dạng chữ thuần theo số cột: dùng cho xem trước trên bản web và kiểm thử mẫu in.
export function receiptText(lines: ReceiptLine[], width: number): string[] {
  const output: string[] = [];
  for (const line of lines) {
    if (line.kind === "rule") output.push("-".repeat(width));
    else if (line.kind === "feed") output.push("");
    else if (line.kind === "columns") output.push(...columnsText(line.left, line.right, width));
    else
      for (const part of wrap(line.text, width)) {
        const pad = width - part.length;
        output.push(line.align === "center" ? " ".repeat(Math.floor(pad / 2)) + part : line.align === "right" ? " ".repeat(pad) + part : part);
      }
  }
  return output;
}
