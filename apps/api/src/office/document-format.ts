// Dựng công văn đi theo thể thức Nghị định 30/2020/NĐ-CP Phụ lục I (QUYTAC_NGHIEPVU_366): PDF bằng pdfmake, Word bằng docx.
import type { DocumentParagraph, DocumentUrgency } from "contracts";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from "docx";

// Đổi milimét sang twip (1/1440 inch), làm tròn: A4 là 11906 x 16838.
const convertMillimetersToTwip = (millimeters: number) => Math.round((millimeters * 1440) / 25.4);
import { renderPdf } from "../common/pdf";

export interface FormattedDocument {
  parentOrgName: string | null;
  companyName: string;
  placeName: string;
  fontScheme: 13 | 14;
  margins: { top: number; bottom: number; left: number; right: number };
  // Số và ngày; chưa cấp số thì để trống (dự thảo).
  numberText: string | null;
  symbolSuffix: string;
  issuedOn: string | null;
  year: number;
  isOfficialLetter: boolean;
  typeName: string;
  summary: string;
  urgency: DocumentUrgency;
  recipientLine: string | null;
  body: DocumentParagraph[];
  externalRecipients: string[];
  archiveLine: string;
  signerAuthorityLine: string | null;
  signerTitle: string;
  signerName: string;
  drafterLine: string | null;
}

const urgencyText: Record<DocumentUrgency, string | null> = { normal: null, urgent: "KHẨN", very_urgent: "THƯỢNG KHẨN", flash: "HỎA TỐC" };

// Ngày dưới 10 và tháng 1, 2 ghi thêm số 0 phía trước (Phụ lục I).
// Công văn có dòng "Kính gửi:" trước tên nơi nhận (Nghị định 30, Phụ lục I); người soạn đã gõ sẵn thì giữ nguyên.
export const recipientText = (line: string) => (/^kính gửi/i.test(line.trim()) ? line.trim() : `Kính gửi: ${line.trim()}`);

export function dateLine(place: string, issuedOn: string | null, year: number): string {
  if (!issuedOn) return `${place}, ngày     tháng     năm ${year}`;
  const [y, m, d] = issuedOn.split("-").map(Number) as [number, number, number];
  const day = d < 10 ? `0${d}` : String(d);
  const month = m <= 2 ? `0${m}` : String(m);
  return `${place}, ngày ${day} tháng ${month} năm ${y}`;
}

export function numberLine(document: FormattedDocument): string {
  return `Số: ${document.numberText ?? "       "}/${document.symbolSuffix}`;
}

// Cỡ chữ theo phương án: quốc hiệu nhỏ hơn nội dung 1 cỡ; trích yếu công văn nhỏ hơn 1 cỡ; nơi nhận 12 và 11; ký hiệu người soạn 11.
function sizes(scheme: 13 | 14) {
  return { body: scheme, nationalTitle: scheme - 1, smallCaption: scheme - 1, recipientsLabel: 12, recipientsList: 11, drafter: 11 };
}

const millimeter = 72 / 25.4;

export async function renderDocumentPdf(document: FormattedDocument): Promise<Buffer> {
  const size = sizes(document.fontScheme);
  const pageWidth = 210 * millimeter - (document.margins.left + document.margins.right) * millimeter;
  const shortLine = (width: number) => ({ canvas: [{ type: "line", x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 0.6 }], alignment: "center", margin: [0, 1, 0, 4] });
  const leftWidth = pageWidth * 0.4;
  const rightWidth = pageWidth * 0.6;
  const left: unknown[] = [];
  if (document.parentOrgName) left.push({ text: document.parentOrgName.toUpperCase(), fontSize: size.nationalTitle, alignment: "center" });
  left.push({ text: document.companyName.toUpperCase(), bold: true, fontSize: size.nationalTitle, alignment: "center" });
  left.push({
    columns: [
      { width: "*", text: "" },
      { width: 60, ...shortLine(60) },
      { width: "*", text: "" },
    ],
  });
  left.push({ text: numberLine(document), fontSize: 13, alignment: "center" });
  if (document.isOfficialLetter) left.push({ text: `V/v ${document.summary}`, fontSize: size.smallCaption, alignment: "center", margin: [0, 2, 0, 0] });
  const urgency = urgencyText[document.urgency];
  if (urgency) left.push({ text: urgency, bold: true, fontSize: size.body, alignment: "center", margin: [0, 4, 0, 0] });
  const right: unknown[] = [
    { text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, fontSize: size.nationalTitle, alignment: "center" },
    { text: "Độc lập - Tự do - Hạnh phúc", bold: true, fontSize: size.body, alignment: "center" },
    {
      columns: [
        { width: "*", text: "" },
        { width: 150, ...shortLine(150) },
        { width: "*", text: "" },
      ],
    },
    // Địa danh, ngày tháng trên một dòng (Phụ lục I).
    { text: dateLine(document.placeName, document.issuedOn, document.year), italics: true, fontSize: size.body, alignment: "center", noWrap: true, margin: [0, 4, 0, 0] },
  ];
  const content: unknown[] = [
    {
      columns: [
        { width: leftWidth, stack: left },
        { width: rightWidth, stack: right },
      ],
      columnGap: 0,
    },
  ];
  if (!document.numberText) content.push({ text: "DỰ THẢO", bold: true, fontSize: size.body, alignment: "center", margin: [0, 10, 0, 0] });
  if (!document.isOfficialLetter) {
    content.push({ text: document.typeName.toUpperCase(), bold: true, fontSize: size.body, alignment: "center", margin: [0, 18, 0, 0] });
    content.push({ text: document.summary, bold: true, fontSize: size.body, alignment: "center" });
    content.push({
      columns: [
        { width: "*", text: "" },
        { width: 80, ...shortLine(80) },
        { width: "*", text: "" },
      ],
    });
  }
  if (document.recipientLine) content.push({ text: recipientText(document.recipientLine), fontSize: size.body, alignment: "center", margin: [0, 14, 0, 6] });
  else content.push({ text: "", margin: [0, 8, 0, 0] });
  for (const paragraph of document.body) {
    content.push({
      text: paragraph.kind === "bullet" ? `- ${paragraph.text}` : paragraph.text,
      bold: paragraph.bold,
      italics: paragraph.italic,
      fontSize: size.body,
      alignment: "justify",
      leadingIndent: 1 * 10 * millimeter,
      lineHeight: 1.15,
      margin: [0, 0, 0, 6],
    });
  }
  const recipients = [...document.externalRecipients.map((item) => `- ${item.replace(/[;.]+$/, "")};`), `- ${document.archiveLine}.`];
  content.push({
    columns: [
      {
        width: pageWidth * 0.45,
        stack: [{ text: "Nơi nhận:", bold: true, italics: true, fontSize: size.recipientsLabel }, ...recipients.map((line) => ({ text: line, fontSize: size.recipientsList }))],
      },
      {
        width: pageWidth * 0.55,
        stack: [
          ...(document.signerAuthorityLine ? [{ text: document.signerAuthorityLine.toUpperCase(), bold: true, fontSize: size.body, alignment: "center" }] : []),
          { text: document.signerTitle.toUpperCase(), bold: true, fontSize: size.body, alignment: "center" },
          { text: " ", fontSize: size.body, margin: [0, 50, 0, 0] },
          { text: document.signerName, bold: true, fontSize: size.body, alignment: "center" },
        ],
      },
    ],
    margin: [0, 14, 0, 0],
  });
  if (document.drafterLine) content.push({ text: document.drafterLine, fontSize: size.drafter, margin: [0, 16, 0, 0] });
  return renderPdf({
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [document.margins.left * millimeter, document.margins.top * millimeter, document.margins.right * millimeter, document.margins.bottom * millimeter],
    defaultStyle: { font: "LiberationSerif", fontSize: size.body },
    info: { title: document.summary },
    content,
  });
}

// Word: phông Times New Roman, cỡ tính bằng nửa điểm.
export async function renderDocumentWord(document: FormattedDocument): Promise<Buffer> {
  const size = sizes(document.fontScheme);
  const run = (text: string, options: { size: number; bold?: boolean; italics?: boolean }) =>
    new TextRun({ text, font: "Times New Roman", size: options.size * 2, bold: options.bold ?? false, italics: options.italics ?? false });
  const centered = (text: string, options: { size: number; bold?: boolean; italics?: boolean }, spacingBefore = 0) =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: spacingBefore * 20, after: 0 }, children: [run(text, options)] });
  // Dòng kẻ ngắn dưới tên công ty, tiêu ngữ, trích yếu: đoạn trống có viền dưới, thu hẹp bằng thụt lề hai bên.
  const rule = (indentMillimeters: number) =>
    new Paragraph({
      indent: { left: convertMillimetersToTwip(indentMillimeters), right: convertMillimetersToTwip(indentMillimeters) },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000", space: 1 } },
      spacing: { after: 80 },
      children: [],
    });
  const noBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };
  const contentWidth = 210 - document.margins.left - document.margins.right;
  const cell = (widthMillimeters: number, children: Paragraph[]) => new TableCell({ width: { size: convertMillimetersToTwip(widthMillimeters), type: WidthType.DXA }, borders: noBorders, children });
  const twoColumns = (leftWidth: number, left: Paragraph[], right: Paragraph[]) =>
    new Table({
      layout: TableLayoutType.FIXED,
      width: { size: convertMillimetersToTwip(contentWidth), type: WidthType.DXA },
      columnWidths: [convertMillimetersToTwip(leftWidth), convertMillimetersToTwip(contentWidth - leftWidth)],
      borders: { ...noBorders, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
      rows: [new TableRow({ children: [cell(leftWidth, left), cell(contentWidth - leftWidth, right)] })],
    });
  const headerLeftWidth = contentWidth * 0.4;
  const left: Paragraph[] = [];
  if (document.parentOrgName) left.push(centered(document.parentOrgName.toUpperCase(), { size: size.nationalTitle }));
  left.push(centered(document.companyName.toUpperCase(), { size: size.nationalTitle, bold: true }));
  left.push(rule(headerLeftWidth / 2 - 12));
  left.push(centered(numberLine(document), { size: 13 }));
  if (document.isOfficialLetter) left.push(centered(`V/v ${document.summary}`, { size: size.smallCaption }, 2));
  const urgency = urgencyText[document.urgency];
  if (urgency) left.push(centered(urgency, { size: size.body, bold: true }, 4));
  const right: Paragraph[] = [
    centered("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { size: size.nationalTitle, bold: true }),
    centered("Độc lập - Tự do - Hạnh phúc", { size: size.body, bold: true }),
    rule((contentWidth - headerLeftWidth) / 2 - 27),
    centered(dateLine(document.placeName, document.issuedOn, document.year), { size: size.body, italics: true }, 4),
  ];
  const children: (Paragraph | Table)[] = [twoColumns(headerLeftWidth, left, right)];
  if (!document.numberText) children.push(centered("DỰ THẢO", { size: size.body, bold: true }, 10));
  if (!document.isOfficialLetter) {
    children.push(centered(document.typeName.toUpperCase(), { size: size.body, bold: true }, 18));
    children.push(centered(document.summary, { size: size.body, bold: true }));
    children.push(rule(contentWidth / 2 - 15));
  }
  if (document.recipientLine) children.push(centered(recipientText(document.recipientLine), { size: size.body }, 14));
  for (const paragraph of document.body) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: convertMillimetersToTwip(10) },
        spacing: { before: 0, after: 120, line: 276 },
        children: [run(paragraph.kind === "bullet" ? `- ${paragraph.text}` : paragraph.text, { size: size.body, bold: paragraph.bold, italics: paragraph.italic })],
      }),
    );
  }
  const recipients = [...document.externalRecipients.map((item) => `- ${item.replace(/[;.]+$/, "")};`), `- ${document.archiveLine}.`];
  const footerLeftWidth = contentWidth * 0.45;
  const signer: Paragraph[] = [];
  if (document.signerAuthorityLine) signer.push(centered(document.signerAuthorityLine.toUpperCase(), { size: size.body, bold: true }));
  signer.push(centered(document.signerTitle.toUpperCase(), { size: size.body, bold: true }));
  signer.push(new Paragraph({ spacing: { before: 1400 }, children: [] }));
  signer.push(centered(document.signerName, { size: size.body, bold: true }));
  children.push(new Paragraph({ spacing: { before: 280 }, children: [] }));
  children.push(
    twoColumns(
      footerLeftWidth,
      [
        new Paragraph({ children: [run("Nơi nhận:", { size: size.recipientsLabel, bold: true, italics: true })] }),
        ...recipients.map((line) => new Paragraph({ children: [run(line, { size: size.recipientsList })] })),
      ],
      signer,
    ),
  );
  if (document.drafterLine) children.push(new Paragraph({ spacing: { before: 320 }, children: [run(document.drafterLine, { size: size.drafter })] }));
  const file = new Document({
    title: document.summary,
    styles: { default: { document: { run: { font: "Times New Roman", size: size.body * 2 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) },
            margin: {
              top: convertMillimetersToTwip(document.margins.top),
              bottom: convertMillimetersToTwip(document.margins.bottom),
              left: convertMillimetersToTwip(document.margins.left),
              right: convertMillimetersToTwip(document.margins.right),
            },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(file);
}
