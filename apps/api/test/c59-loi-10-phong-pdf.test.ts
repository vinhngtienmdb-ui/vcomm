// LOI_10 (sửa trong CONG_VIEC_59): dịch vụ in tem, in đề xuất từng đăng ký lại bảng phông pdfmake chỉ có Roboto,
// làm mất phông Liberation Serif của văn bản hành chính khi được nạp sau common/pdf. Thứ tự nhập dưới đây tái hiện đúng trường hợp đó.
import { describe, expect, it } from "vitest";
import { renderDocumentPdf, type FormattedDocument } from "../src/office/document-format";
import "../src/inventory/labels.service";
import "../src/proposals/proposal-pdf.service";

const document: FormattedDocument = {
  parentOrgName: null,
  companyName: "Công ty Cổ phần VComm Bán lẻ Miền Nam",
  placeName: "Thành phố Hồ Chí Minh",
  fontScheme: 14,
  margins: { top: 20, bottom: 20, left: 30, right: 15 },
  numberText: "05",
  symbolSuffix: "VCR",
  issuedOn: "2026-11-12",
  year: 2026,
  isOfficialLetter: true,
  typeName: "Công văn",
  summary: "Thông báo lịch giao hàng dịp Tết Nguyên đán",
  urgency: "normal",
  recipientLine: "Các nhà cung cấp",
  body: [{ kind: "paragraph", text: "Công ty thông báo lịch nhận hàng tại kho trung tâm.", bold: false, italic: false }],
  externalRecipients: ["Như trên"],
  archiveLine: "Lưu: VT",
  signerAuthorityLine: null,
  signerTitle: "Giám đốc",
  signerName: "Lê Văn Phúc",
  drafterLine: null,
};

describe("LOI_10: xuất PDF công văn đi sau khi nạp dịch vụ in tem, in đề xuất", () => {
  it("vẫn dựng được PDF theo thể thức bằng phông Liberation Serif", async () => {
    const pdf = await renderDocumentPdf(document);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("LiberationSerif");
  });
});
