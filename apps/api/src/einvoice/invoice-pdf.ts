// Bản thể hiện PDF của hóa đơn do bộ giả lập tạo (CONG_VIEC_16). Nhà cung cấp thật trả PDF của họ.
import { renderPdf } from "../common/pdf";
import type { ProviderInvoice } from "./providers/provider";

const date = (value: string) => value.split("-").reverse().join("/");
const number = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
export const vatRateLabel = (rate: string) => (rate === "exempt" ? "KCT" : rate === "not_declared" ? "KKKNT" : `${rate}%`);
const titles: Record<string, string> = { "1": "HÓA ĐƠN GIÁ TRỊ GIA TĂNG", "2": "HÓA ĐƠN BÁN HÀNG" };

export async function invoicePdf(invoice: ProviderInvoice, issued: { invoiceNo: string; taxAuthorityCode: string | null }, simulated: boolean): Promise<Buffer> {
  const buyerName = invoice.buyer.anonymous ? (invoice.buyer.name ?? "Người mua không cung cấp tên, địa chỉ, mã số thuế") : (invoice.buyer.name ?? "");
  return renderPdf({
    pageSize: "A4",
    pageMargins: [36, 36, 36, 48],
    defaultStyle: { font: "Roboto", fontSize: 9 },
    content: [
      simulated ? { text: "BẢN GIẢ LẬP – KHÔNG CÓ GIÁ TRỊ PHÁP LÝ", bold: true, color: "#b00020", alignment: "center", margin: [0, 0, 0, 6] } : "",
      { text: titles[invoice.templateCode] ?? "HÓA ĐƠN", bold: true, fontSize: 14, alignment: "center" },
      invoice.kind === "adjustment" && invoice.original
        ? {
            text: `Điều chỉnh cho hóa đơn Mẫu số ${invoice.original.templateCode} ký hiệu ${invoice.original.series} số ${invoice.original.invoiceNo} ngày ${date(invoice.original.invoiceDate)}`,
            alignment: "center",
            italics: true,
          }
        : "",
      invoice.kind === "replacement" && invoice.original
        ? {
            text: `Thay thế cho hóa đơn Mẫu số ${invoice.original.templateCode} ký hiệu ${invoice.original.series} số ${invoice.original.invoiceNo} ngày ${date(invoice.original.invoiceDate)}`,
            alignment: "center",
            italics: true,
          }
        : "",
      { text: `Ngày ${date(invoice.invoiceDate)}`, alignment: "center", margin: [0, 2, 0, 6] },
      {
        columns: [
          { text: `Ký hiệu mẫu số: ${invoice.templateCode}\nKý hiệu: ${invoice.series}\nSố: ${issued.invoiceNo}` },
          { text: issued.taxAuthorityCode ? `Mã của cơ quan thuế:\n${issued.taxAuthorityCode}` : "", alignment: "right" },
        ],
      },
      { text: `Đơn vị bán hàng: ${invoice.seller.name ?? ""}`, bold: true, margin: [0, 8, 0, 0] },
      { text: `Mã số thuế: ${invoice.seller.taxCode ?? ""}` },
      { text: `Địa chỉ: ${invoice.seller.address ?? ""}` },
      { text: `Người mua hàng: ${buyerName}`, bold: true, margin: [0, 8, 0, 0] },
      { text: `Mã số thuế: ${invoice.buyer.taxCode ?? ""}` },
      { text: `Địa chỉ: ${invoice.buyer.address ?? ""}`, margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          widths: [20, "*", 40, 50, 60, 36, 70, 60],
          body: [
            ["STT", "Tên hàng hóa, dịch vụ", "Đơn vị tính", "Số lượng", "Đơn giá", "Thuế suất", "Thành tiền chưa thuế", "Tiền thuế"].map((text) => ({ text, bold: true, alignment: "center" })),
            ...invoice.lines.map((line) => [
              { text: String(line.lineNo), alignment: "center" },
              line.isPromotion ? `${line.itemName} (hàng khuyến mại)` : line.itemName,
              line.unitName ?? "",
              { text: number(line.quantity), alignment: "right" },
              { text: number(line.unitPrice), alignment: "right" },
              { text: vatRateLabel(line.vatRate), alignment: "center" },
              { text: number(line.netAmount), alignment: "right" },
              { text: number(line.taxAmount), alignment: "right" },
            ]),
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
      },
      {
        table: {
          widths: ["*", 100],
          body: [
            ["Cộng tiền hàng chưa thuế", { text: number(invoice.netAmount), alignment: "right" }],
            ["Tiền thuế giá trị gia tăng", { text: number(invoice.taxAmount), alignment: "right" }],
            [
              { text: "Tổng tiền thanh toán", bold: true },
              { text: number(invoice.totalAmount), alignment: "right", bold: true },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 6, 0, 0],
      },
      { text: `Số tiền viết bằng chữ: ${invoice.amountInWords}`, italics: true, margin: [0, 4, 0, 0] },
      { text: `Tiền tệ: ${invoice.currency}`, italics: true },
    ],
  });
}
