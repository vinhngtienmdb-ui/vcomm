// Kiểm tra chữ ký số trong PDF (CONG_VIEC_59; QUYTAC_NGHIEPVU_461). Chưa kiểm tra thu hồi chứng thư (OCSP, CRL).
import forge from "node-forge";
import { certificateToDer, parseSignedData } from "./cms";

// unsupported: thuật toán băm hoặc khóa của chữ ký chưa hỗ trợ kiểm tra (ví dụ ECDSA), không kết luận đúng sai.
export type SignatureConclusion = "valid" | "untrusted" | "invalid" | "unsupported";
export interface CertificateSummary {
  commonName: string | null;
  // Mã định danh trong chủ thể (thuộc tính UID, ví dụ "MST:0312345678", "CCCD:079090001234").
  identities: string[];
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
}
export interface SignatureCheck {
  index: number;
  signer: CertificateSummary | null;
  issuerName: string | null;
  signingTime: Date | null;
  integrity: boolean;
  validAtSigningTime: boolean;
  trusted: boolean;
  coversWholeFile: boolean;
  conclusion: SignatureConclusion;
}

const UID = "0.9.2342.19200300.100.1.1";
const maximumSignatures = 50;

function attributeText(attribute: { value: unknown; valueTagClass?: number }): string {
  const value = String(attribute.value);
  return attribute.valueTagClass === forge.asn1.Type.UTF8 ? forge.util.decodeUtf8(value) : value;
}

export function summarizeCertificate(certificate: forge.pki.Certificate): CertificateSummary {
  const commonName = certificate.subject.getField("CN") as { value: unknown; valueTagClass?: number } | null;
  const identities = certificate.subject.attributes.filter((attribute) => attribute.type === UID).map((attribute) => attributeText(attribute as { value: unknown; valueTagClass?: number }));
  return {
    commonName: commonName ? attributeText(commonName) : null,
    identities,
    serialNumber: certificate.serialNumber,
    validFrom: certificate.validity.notBefore,
    validTo: certificate.validity.notAfter,
  };
}

// Ngày giờ PDF: D:YYYYMMDDHHmmSS kèm Z hoặc +HH'mm'.
function parsePdfDate(text: string): Date | null {
  const match = /^D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(Z|[+-]\d{2}'?\d{2}'?)?/.exec(text);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, zone] = match;
  const offset = !zone || zone === "Z" ? "Z" : `${zone.slice(0, 3)}:${zone.replace(/'/g, "").slice(3, 5)}`;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validAt(certificate: forge.pki.Certificate, time: Date): boolean {
  return certificate.validity.notBefore <= time && time <= certificate.validity.notAfter;
}

// Chứng thư dùng làm cấp trên phải là chứng thư của tổ chức chứng thực: basicConstraints cA, keyUsage có keyCertSign (khi khai),
// và giới hạn độ dài chuỗi (pathLenConstraint) cho phép số chứng thư trung gian bên dưới. Chứng thư người dùng cuối không cấp được chứng thư khác.
function canIssue(candidate: forge.pki.Certificate, intermediatesBelow: number): boolean {
  const constraints = candidate.getExtension("basicConstraints") as { cA?: boolean; pathLenConstraint?: number } | null;
  if (!constraints?.cA) return false;
  if (typeof constraints.pathLenConstraint === "number" && intermediatesBelow > constraints.pathLenConstraint) return false;
  const usage = candidate.getExtension("keyUsage") as { keyCertSign?: boolean } | null;
  return !usage || usage.keyCertSign === true;
}

// Dựng chuỗi từ chứng thư người ký: mỗi bước tìm chứng thư cấp trong chứng thư kèm chữ ký và danh sách gốc tin cậy, kiểm chữ ký của chứng thư cấp.
function buildChain(signer: forge.pki.Certificate, pool: forge.pki.Certificate[]): forge.pki.Certificate[] {
  const chain = [signer];
  let current = signer;
  for (let depth = 0; depth < 8; depth += 1) {
    if (current.isIssuer(current)) break;
    const intermediatesBelow = chain.length - 1;
    const issuer = pool.find((candidate) => {
      try {
        return canIssue(candidate, intermediatesBelow) && candidate.issued(current) && candidate.verify(current);
      } catch {
        return false;
      }
    });
    if (!issuer) break;
    chain.push(issuer);
    current = issuer;
  }
  return chain;
}

export function verifyPdfSignatures(pdf: Buffer, trustedRootsPem: string[], now: Date = new Date()): SignatureCheck[] {
  const trustedRoots = trustedRootsPem.map((pem) => forge.pki.certificateFromPem(pem));
  const trustedDer = trustedRoots.map((certificate) => certificateToDer(certificate));
  const text = pdf.toString("latin1");
  const results: SignatureCheck[] = [];
  const pattern = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g;
  // Chống làm nghẽn: tối đa 50 chữ ký (như khi ký), bỏ qua khoảng byte trùng lặp.
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) && results.length < maximumSignatures) {
    const key = match.slice(1, 5).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    const [start = -1, firstLength = 0, secondStart = 0, secondLength = 0] = match.slice(1, 5).map(Number);
    const index = results.length + 1;
    const invalid = (signingTime: Date | null): SignatureCheck => ({
      index,
      signer: null,
      issuerName: null,
      signingTime,
      integrity: false,
      validAtSigningTime: false,
      trusted: false,
      coversWholeFile: false,
      conclusion: "invalid",
    });
    const dictionaryStart = text.lastIndexOf(" obj", match.index);
    const dictionaryEnd = text.indexOf("endobj", match.index);
    const dateMatch = /\/M\s*\((D:[^)]+)\)/.exec(text.slice(dictionaryStart, dictionaryEnd));
    const signingTime = dateMatch?.[1] ? parsePdfDate(dateMatch[1]) : null;
    if (start !== 0 || secondStart <= firstLength || secondStart + secondLength > pdf.length) {
      results.push(invalid(signingTime));
      continue;
    }
    const contentsHex = text.slice(firstLength + 1, secondStart - 1).replace(/(00)+$/, "");
    const content = Buffer.concat([pdf.subarray(0, firstLength), pdf.subarray(secondStart, secondStart + secondLength)]);
    let parsed;
    try {
      parsed = parseSignedData(Buffer.from(contentsHex.length % 2 ? `${contentsHex}0` : contentsHex, "hex"), content);
    } catch {
      results.push(invalid(signingTime));
      continue;
    }
    if (parsed.unsupported) {
      results.push({ ...invalid(signingTime), signer: parsed.signer ? summarizeCertificate(parsed.signer) : null, conclusion: "unsupported" });
      continue;
    }
    const time = signingTime ?? parsed.signingTime ?? now;
    const integrity = parsed.contentDigestMatches && parsed.signatureValid;
    const chain = parsed.signer ? buildChain(parsed.signer, [...parsed.certificates, ...trustedRoots]) : [];
    const root = chain[chain.length - 1];
    const trusted = !!root && root.isIssuer(root) && trustedDer.some((der) => der.equals(certificateToDer(root)));
    const validAtSigningTime = chain.length > 0 && chain.every((certificate) => validAt(certificate, time));
    // Phần sau chữ ký chỉ còn khoảng trắng thì coi là bao trùm toàn bộ tệp.
    const coversWholeFile = /^\s*$/.test(text.slice(secondStart + secondLength));
    const issuer = parsed.signer?.issuer.getField("CN") as { value: unknown; valueTagClass?: number } | null | undefined;
    results.push({
      index,
      signer: parsed.signer ? summarizeCertificate(parsed.signer) : null,
      issuerName: issuer ? attributeText(issuer) : null,
      signingTime,
      integrity,
      validAtSigningTime,
      trusted,
      coversWholeFile,
      conclusion: integrity && validAtSigningTime ? (trusted ? "valid" : "untrusted") : "invalid",
    });
  }
  return results;
}
