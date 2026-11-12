// Ký số PDF hai bước theo PAdES (CONG_VIEC_59; QUYTAC_NGHIEPVU_457).
// Bước chuẩn bị: thêm ô chữ ký có hình hiển thị và chỗ chứa chữ ký bằng một lần cập nhật tăng dần (giữ nguyên byte của bản trước nên chữ ký cũ vẫn hợp lệ),
// tính mã băm cần gửi nhà cung cấp. Bước hoàn tất: chèn CMS ghép từ giá trị chữ ký nhà cung cấp trả về.
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { Signer, SUBFILTER_ETSI_CADES_DETACHED } from "@signpdf/utils";
import forge from "node-forge";
import { EncryptedPDFError, PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream, PDFString, type PDFObject, type PDFPage } from "pdf-lib";
import { renderPdf } from "../../common/pdf";
import { assembleSignedData, signedAttributesDigest } from "./cms";

export type SignatureCorner = "bottom_right" | "bottom_left" | "top_right" | "top_left";
export interface SignaturePlacement {
  // "first", "last" hoặc số trang tính từ 1; số lớn hơn số trang thì lấy trang cuối.
  page: "first" | "last" | number;
  corner: SignatureCorner;
  // Thứ tự của ô trong cùng trang, cùng góc (0 là ô đầu tiên); ô sau xếp lên trên (xuống dưới với góc trên).
  slot: number;
}

export class PdfSigningError extends Error {
  constructor(
    readonly reason: "encrypted" | "unreadable" | "too_many_signatures",
    message: string,
  ) {
    super(message);
  }
}

const BOX_WIDTH = 220;
const BOX_HEIGHT = 64;
const PAGE_MARGIN = 36;
const BOX_GAP = 6;
// Chỗ chứa CMS (số byte); đủ cho chuỗi 4 chứng thư RSA 4096 bit.
const SIGNATURE_LENGTH = 16384;

function boxRectangle(page: PDFPage, placement: SignaturePlacement): [number, number, number, number] {
  const { width, height } = page.getSize();
  const step = (BOX_HEIGHT + BOX_GAP) * placement.slot;
  const left = placement.corner.endsWith("left") ? PAGE_MARGIN : width - PAGE_MARGIN - BOX_WIDTH;
  const bottom = placement.corner.startsWith("bottom") ? PAGE_MARGIN + step : height - PAGE_MARGIN - BOX_HEIGHT - step;
  return [left, bottom, left + BOX_WIDTH, bottom + BOX_HEIGHT];
}

// Hình hiển thị dựng bằng pdfmake (phông Roboto có tiếng Việt) rồi nhúng làm form XObject; không cần thêm thư viện phông.
async function renderAppearance(lines: string[]): Promise<Buffer> {
  return renderPdf({
    pageSize: { width: BOX_WIDTH, height: BOX_HEIGHT },
    pageMargins: [8, 6, 8, 4],
    background: () => ({ canvas: [{ type: "rect", x: 1, y: 1, w: BOX_WIDTH - 2, h: BOX_HEIGHT - 2, lineWidth: 1.2, lineColor: "#c0392b" }] }),
    content: lines.map((text, index) => ({ text, fontSize: 8, bold: index === 0, color: "#c0392b", lineHeight: 1.15 })),
    defaultStyle: { font: "Roboto" },
  });
}

function serialize(object: PDFObject): Buffer {
  const bytes = new Uint8Array(object.sizeInBytes());
  object.copyBytesInto(bytes, 0);
  return Buffer.from(bytes);
}

function signatureFieldCount(document: PDFDocument): number {
  const acroForm = document.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields = acroForm?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  if (!fields) return 0;
  let count = 0;
  for (let index = 0; index < fields.size(); index += 1) {
    const field = fields.lookupMaybe(index, PDFDict);
    if (field?.get(PDFName.of("FT"))?.toString() === "/Sig") count += 1;
  }
  return count;
}

// Ghi phần cập nhật tăng dần: các đối tượng mới hoặc đã đổi, bảng tham chiếu chéo (dạng bảng hoặc dạng luồng theo bản trước), phần cuối có /Prev.
function appendIncrementalUpdate(original: Buffer, document: PDFDocument, changed: Array<[PDFRef, PDFObject]>): Buffer {
  const startMatch = /startxref\s+(\d+)\s*%%EOF\s*$/.exec(original.subarray(Math.max(0, original.length - 1024)).toString("latin1"));
  if (!startMatch) throw new PdfSigningError("unreadable", "Không đọc được phần cuối tệp PDF.");
  const previousOffset = Number(startMatch[1]);
  const previousIsTable = original.subarray(previousOffset, previousOffset + 4).toString("latin1") === "xref";
  const parts: Buffer[] = [original, Buffer.from("\n")];
  let position = original.length + 1;
  const offsets = new Map<number, number>();
  const write = (chunk: Buffer) => {
    parts.push(chunk);
    position += chunk.length;
  };
  for (const [reference, object] of changed) {
    offsets.set(reference.objectNumber, position);
    write(Buffer.concat([Buffer.from(`${reference.objectNumber} ${reference.generationNumber} obj\n`), serialize(object), Buffer.from("\nendobj\n")]));
  }
  const trailer = document.context.trailerInfo;
  if (!trailer.Root) throw new PdfSigningError("unreadable", "Tệp PDF thiếu danh mục gốc.");
  const trailerEntries = [`/Root ${trailer.Root.toString()}`, trailer.Info ? `/Info ${trailer.Info.toString()}` : "", trailer.ID ? `/ID ${trailer.ID.toString()}` : "", `/Prev ${previousOffset}`]
    .filter(Boolean)
    .join(" ");
  const groups = (numbers: number[]): number[][] => {
    const result: number[][] = [];
    for (const number of [...numbers].sort((left, right) => left - right)) {
      const last = result[result.length - 1];
      if (last && last[last.length - 1] === number - 1) last.push(number);
      else result.push([number]);
    }
    return result;
  };
  const xrefOffset = position;
  if (previousIsTable) {
    const size = document.context.largestObjectNumber + 1;
    const lines = ["xref"];
    for (const group of groups([...offsets.keys()])) {
      lines.push(`${group[0]} ${group.length}`);
      for (const number of group) lines.push(`${String(offsets.get(number)).padStart(10, "0")} 00000 n\r`);
    }
    write(Buffer.from(`${lines.join("\n")}\ntrailer\n<< /Size ${size} ${trailerEntries} >>\nstartxref\n${xrefOffset}\n%%EOF\n`));
  } else {
    // Bản trước dùng luồng tham chiếu chéo: phần cập nhật cũng dùng luồng (không nén), mỗi dòng 1 + 4 + 2 byte.
    const streamNumber = document.context.largestObjectNumber + 1;
    offsets.set(streamNumber, xrefOffset);
    const numbers = [...offsets.keys()];
    const index = groups(numbers).flatMap((group) => [group[0], group.length]);
    const rows = groups(numbers).flatMap((group) =>
      group.map((number) => {
        const row = Buffer.alloc(7);
        row.writeUInt8(1, 0);
        row.writeUInt32BE(offsets.get(number) ?? 0, 1);
        return row;
      }),
    );
    const data = Buffer.concat(rows);
    write(
      Buffer.concat([
        Buffer.from(`${streamNumber} 0 obj\n<< /Type /XRef /Size ${streamNumber + 1} /W [1 4 2] /Index [${index.join(" ")}] ${trailerEntries} /Length ${data.length} >>\nstream\n`),
        data,
        Buffer.from(`\nendstream\nendobj\nstartxref\n${xrefOffset}\n%%EOF\n`),
      ]),
    );
  }
  return Buffer.concat(parts);
}

export interface PrepareSignatureInput {
  pdf: Buffer;
  placement: SignaturePlacement;
  // Các dòng của hình hiển thị (dòng đầu in đậm), ví dụ "Ký bởi: …", "Thời gian ký: …".
  appearanceLines: string[];
  signerName: string;
  reason: string;
  signingTime: Date;
  // Chuỗi chứng thư PEM, chứng thư người ký đứng đầu.
  certificateChainPem: string[];
}
export interface PreparedSignature {
  preparedPdf: Buffer;
  // SHA-256 của thuộc tính ký: giá trị gửi nhà cung cấp ký số từ xa.
  digest: Buffer;
}

// Lỗi tệp mã hóa của pdf-lib: lớp lỗi biên dịch kiểu cũ nên instanceof không luôn đúng, nhận thêm theo thông báo.
export function isEncryptedPdfError(error: unknown): boolean {
  return error instanceof EncryptedPDFError || (error instanceof Error && /is encrypted/i.test(error.message));
}

export async function prepareSignature(input: PrepareSignatureInput): Promise<PreparedSignature> {
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(input.pdf, { updateMetadata: false });
  } catch (error) {
    if (isEncryptedPdfError(error)) throw new PdfSigningError("encrypted", "Tệp PDF đặt mật khẩu, không ký được.");
    throw new PdfSigningError("unreadable", "Không đọc được tệp PDF.");
  }
  const fieldNumber = signatureFieldCount(document) + 1;
  if (fieldNumber > 50) throw new PdfSigningError("too_many_signatures", "Tệp đã có quá nhiều chữ ký.");
  // Ảnh chụp các đối tượng không phải luồng trước khi sửa, để biết đối tượng nào đổi.
  const before = new Map<string, Buffer>();
  for (const [reference, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFStream)) before.set(reference.tag, serialize(object));
  }
  const originalLargest = document.context.largestObjectNumber;

  const pages = document.getPages();
  const pageIndex = input.placement.page === "first" ? 0 : input.placement.page === "last" ? pages.length - 1 : Math.min(Math.max(input.placement.page, 1), pages.length) - 1;
  const page = pages[pageIndex];
  if (!page) throw new PdfSigningError("unreadable", "Tệp PDF không có trang nào.");
  const rectangle = boxRectangle(page, input.placement);
  const [appearance] = await document.embedPdf(await renderAppearance(input.appearanceLines));
  if (!appearance) throw new Error("Không dựng được hình chữ ký.");
  await document.flush();
  pdflibAddPlaceholder({
    pdfDoc: document,
    pdfPage: page,
    reason: input.reason,
    contactInfo: "",
    name: input.signerName,
    location: "",
    signingTime: input.signingTime,
    signatureLength: SIGNATURE_LENGTH,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    widgetRect: rectangle,
    appName: "VComm",
  });
  // Ô vừa thêm là chú thích cuối của trang: đặt tên trường không trùng, gắn hình hiển thị.
  const annotations = page.node.lookup(PDFName.of("Annots"), PDFArray);
  const widget = annotations.lookup(annotations.size() - 1, PDFDict);
  widget.set(PDFName.of("T"), PDFString.of(`ChuKy${fieldNumber}`));
  const appearanceStream = document.context.stream(`q 1 0 0 1 0 0 cm /Hinh Do Q`, {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, BOX_WIDTH, BOX_HEIGHT],
    Resources: { XObject: { Hinh: appearance.ref } },
  });
  widget.set(PDFName.of("AP"), document.context.obj({ N: document.context.register(appearanceStream) }));

  const changed: Array<[PDFRef, PDFObject]> = [];
  for (const [reference, object] of document.context.enumerateIndirectObjects()) {
    const isNew = reference.objectNumber > originalLargest;
    const previous = before.get(reference.tag);
    if (isNew || (previous && !(object instanceof PDFStream) && !previous.equals(serialize(object)))) changed.push([reference, object]);
  }
  // Đối tượng trang (mảng chú thích), danh mục (AcroForm) đã đổi nên được ghi lại cùng các đối tượng mới.
  const preparedPdf = appendIncrementalUpdate(input.pdf, document, changed);
  const signerPem = input.certificateChainPem[0];
  if (!signerPem) throw new Error("Thiếu chứng thư người ký.");
  const signerCertificate = forge.pki.certificateFromPem(signerPem);
  const capture = new (class extends Signer {
    digest: Buffer = Buffer.alloc(0);
    override async sign(content: Buffer): Promise<Buffer> {
      this.digest = signedAttributesDigest(content, signerCertificate);
      return Buffer.alloc(1);
    }
  })();
  await new SignPdf().sign(preparedPdf, capture);
  return { preparedPdf, digest: capture.digest };
}

// Chèn chữ ký: CMS ghép từ giá trị chữ ký RSA của nhà cung cấp và chuỗi chứng thư.
export async function completeSignature(preparedPdf: Buffer, certificateChainPem: string[], signatureValue: Buffer): Promise<Buffer> {
  const chain = certificateChainPem.map((pem) => forge.pki.certificateFromPem(pem));
  const assemble = new (class extends Signer {
    override async sign(content: Buffer): Promise<Buffer> {
      return assembleSignedData(content, chain, signatureValue);
    }
  })();
  return new SignPdf().sign(preparedPdf, assemble);
}
