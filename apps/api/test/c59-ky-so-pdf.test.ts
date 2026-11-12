// CONG_VIEC_59: ký số PDF hai bước qua bộ giả lập, kiểm tra chữ ký (TIEUCHI_NGHIEMTHU_423, 424, 425, 428; KICHBAN_KIEMTHU_598, 599, 600, 603). Không cần cơ sở dữ liệu.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderPdf } from "../src/common/pdf";
import { completeSignature, PdfSigningError, prepareSignature, type SignaturePlacement } from "../src/office/signing/pdf-signing";
import { verifyPdfSignatures } from "../src/office/signing/pdf-verification";
import type { SigningProviderConfig } from "../src/office/signing/providers/signing-provider";
import { SimulatorSigningProvider } from "../src/office/signing/providers/simulator-provider";

const config: SigningProviderConfig = { companyId: "00000000-0000-0000-0000-000000000000", environment: "test", credentials: {} };
let directory: string;
let provider: SimulatorSigningProvider;
let rootPem: string;
let original: Buffer;

// Một lần ký trọn vẹn: chọn chứng thư, chuẩn bị, gửi mã băm, nhận chữ ký, chèn.
async function signOnce(pdf: Buffer, identityCode: string, placement: SignaturePlacement, lines: string[]): Promise<Buffer> {
  const certificate = (await provider.listCertificates(config, identityCode))[0];
  if (!certificate) throw new Error("Không có chứng thư.");
  const prepared = await prepareSignature({
    pdf,
    placement,
    appearanceLines: lines,
    signerName: lines[0] ?? "",
    reason: "Ký số trên VComm",
    signingTime: new Date(),
    certificateChainPem: certificate.certificateChainPem,
  });
  const { transactionId } = await provider.requestSignature(config, { identityCode, serialNumber: certificate.serialNumber, digest: prepared.digest, documentTitle: "Hợp đồng" });
  const result = await provider.getSignatureResult(config, transactionId);
  if (result.status !== "signed") throw new Error(`Không ký được: ${result.status}`);
  return completeSignature(prepared.preparedPdf, certificate.certificateChainPem, result.signatureValue);
}

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "ky-so-gia-lap-"));
  provider = new SimulatorSigningProvider(directory, 0, { "079090001234": "Nguyễn Văn An" });
  rootPem = provider.authority().certificatePem;
  original = await renderPdf({ content: [{ text: "HỢP ĐỒNG MUA BÁN HÀNG HÓA", bold: true }, "Trang 1", { text: "Trang 2", pageBreak: "before" }] });
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));

describe("CONG_VIEC_59 ký số PDF", () => {
  it("ký một chữ ký: hợp lệ với gốc tin cậy, chưa xác định tin cậy khi thiếu gốc, có ô chữ ký trên trang cuối", async () => {
    const signed = await signOnce(original, "079090001234", { page: "last", corner: "bottom_right", slot: 0 }, ["Ký bởi: Nguyễn Văn An", "Thời gian ký: 12/11/2026 14:20"]);
    expect(signed.subarray(0, original.length).equals(original)).toBe(true);
    const check = verifyPdfSignatures(signed, [rootPem])[0];
    expect(check).toMatchObject({ integrity: true, validAtSigningTime: true, trusted: true, coversWholeFile: true, conclusion: "valid" });
    expect(check?.signer?.commonName).toBe("Nguyễn Văn An");
    expect(check?.signer?.identities).toEqual(["CCCD:079090001234"]);
    expect(verifyPdfSignatures(signed, [])[0]?.conclusion).toBe("untrusted");
    const document = await PDFDocument.load(signed);
    const lastPage = document.getPages()[1];
    expect(lastPage?.node.Annots()?.size()).toBe(1);
  });

  it("ký nối tiếp ba chữ ký: mọi chữ ký trước vẫn toàn vẹn, chỉ chữ ký cuối bao trùm toàn bộ tệp", async () => {
    let pdf = await signOnce(original, "079090001234", { page: "last", corner: "bottom_left", slot: 0 }, ["Ký bởi: Nguyễn Văn An"]);
    pdf = await signOnce(pdf, "079090005678", { page: "last", corner: "bottom_right", slot: 0 }, ["Ký bởi: Trần Văn Lâm"]);
    pdf = await signOnce(pdf, "0312345678", { page: "last", corner: "bottom_right", slot: 1 }, ["Ký bởi: CÔNG TY CỔ PHẦN VCOMM BÁN LẺ MIỀN NAM", "Ký thay mặt: VComm Bán lẻ Miền Nam"]);
    const checks = verifyPdfSignatures(pdf, [rootPem]);
    expect(checks.map((check) => check.conclusion)).toEqual(["valid", "valid", "valid"]);
    expect(checks.map((check) => check.coversWholeFile)).toEqual([false, false, true]);
    expect(checks[2]?.signer?.identities).toEqual(["MST:0312345678"]);
    const document = await PDFDocument.load(pdf);
    expect(
      document
        .getForm()
        .getFields()
        .map((field) => field.getName()),
    ).toEqual(["ChuKy1", "ChuKy2", "ChuKy3"]);
  });

  it("tệp bị sửa sau khi ký thì không hợp lệ", async () => {
    const signed = await signOnce(original, "079090001234", { page: "first", corner: "top_right", slot: 0 }, ["Ký bởi: Nguyễn Văn An"]);
    const tampered = Buffer.from(signed);
    const position = tampered.indexOf("Trang 1");
    if (position >= 0) tampered[position] = "X".charCodeAt(0);
    else tampered[200] = (tampered[200] ?? 0) ^ 1;
    expect(verifyPdfSignatures(tampered, [rootPem])[0]).toMatchObject({ integrity: false, conclusion: "invalid" });
  });

  it("tệp dùng luồng tham chiếu chéo (PDF 1.5) ký được và còn đọc được", async () => {
    const source = await PDFDocument.load(original);
    const compressed = Buffer.from(await source.save({ useObjectStreams: true }));
    const signed = await signOnce(compressed, "079090001234", { page: 1, corner: "bottom_right", slot: 0 }, ["Ký bởi: Nguyễn Văn An"]);
    expect(verifyPdfSignatures(signed, [rootPem])[0]?.conclusion).toBe("valid");
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(2);
  });

  it("chứng thư hết hạn tại thời điểm ký thì không hợp lệ", async () => {
    const signed = await signOnce(original, "079090000111", { page: "last", corner: "bottom_right", slot: 0 }, ["Ký bởi: hết hạn"]);
    expect(verifyPdfSignatures(signed, [rootPem])[0]).toMatchObject({ integrity: true, validAtSigningTime: false, conclusion: "invalid" });
  });

  it("bộ giả lập: từ chối, chờ mãi, bị chặn ở môi trường chính thức; tệp không phải PDF báo lỗi", async () => {
    const rejectCertificate = (await provider.listCertificates(config, "079090000000"))[0];
    const rejected = await provider.requestSignature(config, { identityCode: "079090000000", serialNumber: rejectCertificate?.serialNumber ?? "", digest: Buffer.alloc(32), documentTitle: "x" });
    expect((await provider.getSignatureResult(config, rejected.transactionId)).status).toBe("rejected");
    const waitCertificate = (await provider.listCertificates(config, "079090000999"))[0];
    const waiting = await provider.requestSignature(config, { identityCode: "079090000999", serialNumber: waitCertificate?.serialNumber ?? "", digest: Buffer.alloc(32), documentTitle: "x" });
    expect((await provider.getSignatureResult(config, waiting.transactionId)).status).toBe("pending");
    await expect(provider.checkConnection({ ...config, environment: "production" })).rejects.toThrow("môi trường thử");
    await expect(provider.listCertificates(config, "../../etc")).rejects.toThrow("định dạng");
    await expect(
      prepareSignature({
        pdf: Buffer.from("không phải PDF"),
        placement: { page: "last", corner: "bottom_right", slot: 0 },
        appearanceLines: ["x"],
        signerName: "x",
        reason: "x",
        signingTime: new Date(),
        certificateChainPem: [rootPem],
      }),
    ).rejects.toBeInstanceOf(PdfSigningError);
  });

  it("chứng thư giữ nguyên sau khi tạo lại bộ giả lập (lưu ở thư mục)", async () => {
    const [first] = await provider.listCertificates(config, "079090001234");
    const [again] = await new SimulatorSigningProvider(directory, 0).listCertificates(config, "079090001234");
    expect(again?.serialNumber).toBe(first?.serialNumber);
  });
});
