// Cấu trúc chữ ký CMS tách rời cho PDF theo PAdES (CONG_VIEC_59; QUYTAC_NGHIEPVU_457, 461).
// Ký hai bước: hệ thống tính mã băm thuộc tính ký, gửi nhà cung cấp ký số từ xa; nhận giá trị chữ ký về thì ghép thành CMS.
// Chỉ dùng RSA với SHA-256 (chứng thư đọc được bằng node-forge).
import { createHash } from "node:crypto";
import forge from "node-forge";

const { asn1, pki } = forge;
const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  sha256: "2.16.840.1.101.3.4.2.1",
  rsaEncryption: "1.2.840.113549.1.1.1",
  sha256WithRsa: "1.2.840.113549.1.1.11",
};

type Asn1 = forge.asn1.Asn1;
const sequence = (value: Asn1[]): Asn1 => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, value);
const set = (value: Asn1[]): Asn1 => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, value);
const oid = (value: string): Asn1 => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(value).getBytes());
const octets = (value: Buffer): Asn1 => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, value.toString("binary"));
const integer = (value: number): Asn1 => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(value).getBytes());
const nullValue = (): Asn1 => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "");
const toDer = (value: Asn1): Buffer => Buffer.from(asn1.toDer(value).getBytes(), "binary");
const sha256 = (value: Buffer): Buffer => createHash("sha256").update(value).digest();
// Lấy phần tử thứ index của nút ASN.1 có cấu trúc; thiếu thì cấu trúc sai.
function child(node: Asn1 | undefined, index: number): Asn1 {
  const value = node && Array.isArray(node.value) ? node.value[index] : undefined;
  if (!value) throw new Error("Cấu trúc chữ ký không đúng.");
  return value;
}
// Kiểu khai báo của node-forge chưa có tùy chọn parseAllBytes (cần để bỏ qua phần đệm 00 sau CMS).
const fromDer = asn1.fromDer as unknown as (bytes: forge.util.ByteStringBuffer, options: { strict: boolean; parseAllBytes: boolean }) => Asn1;

export function certificateToDer(certificate: forge.pki.Certificate): Buffer {
  return toDer(pki.certificateToAsn1(certificate));
}

// Thuộc tính ký: loại nội dung, mã băm nội dung, chứng thư người ký (ESS signing-certificate-v2, bắt buộc với PAdES).
// Thứ tự trong SET theo DER: sắp xếp theo mã hóa nhị phân để hai bước cho cùng kết quả.
function signedAttributes(contentDigest: Buffer, signerCertificate: forge.pki.Certificate): Asn1[] {
  const attribute = (type: string, value: Asn1): Asn1 => sequence([oid(type), set([value])]);
  const certificateHash = sha256(certificateToDer(signerCertificate));
  const attributes = [
    attribute(OID.contentType, oid(OID.data)),
    attribute(OID.messageDigest, octets(contentDigest)),
    attribute(OID.signingCertificateV2, sequence([sequence([sequence([octets(certificateHash)])])])),
  ];
  return attributes
    .map((item) => ({ item, der: toDer(item) }))
    .sort((left, right) => Buffer.compare(left.der, right.der))
    .map(({ item }) => item);
}

// Mã băm gửi nhà cung cấp: SHA-256 của SET thuộc tính ký (RFC 5652 mục 5.4).
export function signedAttributesDigest(content: Buffer, signerCertificate: forge.pki.Certificate): Buffer {
  return sha256(toDer(set(signedAttributes(sha256(content), signerCertificate))));
}

// Tên bên cấp lấy nguyên khối ASN.1 trong chứng thư: dựng lại từ trường đã đọc sẽ mã hóa UTF-8 hai lần với tên có dấu.
function originalIssuer(certificate: forge.pki.Certificate): Asn1 {
  const tbs = child(pki.certificateToAsn1(certificate), 0);
  const hasVersion = child(tbs, 0).tagClass === asn1.Class.CONTEXT_SPECIFIC;
  return child(tbs, hasVersion ? 3 : 2);
}

// Ghép CMS SignedData tách rời từ giá trị chữ ký RSA (PKCS#1 v1.5) nhà cung cấp trả về.
export function assembleSignedData(content: Buffer, certificateChain: forge.pki.Certificate[], signatureValue: Buffer): Buffer {
  const signer = certificateChain[0];
  if (!signer) throw new Error("Thiếu chứng thư người ký.");
  const algorithm = (value: string): Asn1 => sequence([oid(value), nullValue()]);
  const signedAttributesTagged = asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, signedAttributes(sha256(content), signer));
  const issuerAndSerial = sequence([originalIssuer(signer), asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, forge.util.hexToBytes(signer.serialNumber))]);
  const signerInfo = sequence([integer(1), issuerAndSerial, algorithm(OID.sha256), signedAttributesTagged, algorithm(OID.rsaEncryption), octets(signatureValue)]);
  const signedData = sequence([
    integer(1),
    set([algorithm(OID.sha256)]),
    sequence([oid(OID.data)]),
    asn1.create(
      asn1.Class.CONTEXT_SPECIFIC,
      0,
      true,
      certificateChain.map((certificate) => pki.certificateToAsn1(certificate)),
    ),
    set([signerInfo]),
  ]);
  return toDer(sequence([oid(OID.signedData), asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData])]));
}

export interface ParsedSignedData {
  certificates: forge.pki.Certificate[];
  signer: forge.pki.Certificate | null;
  contentDigestMatches: boolean;
  signatureValid: boolean;
  signingTime: Date | null;
}

// Đọc CMS trong /Contents và kiểm tra: mã băm nội dung khớp phần tài liệu được ký, chữ ký đúng với khóa công khai của chứng thư người ký.
export function parseSignedData(cms: Buffer, content: Buffer): ParsedSignedData {
  const root = fromDer(forge.util.createBuffer(cms.toString("binary")), { strict: false, parseAllBytes: false });
  const signedData = child(child(root, 1), 0).value as Asn1[];
  const certificates: forge.pki.Certificate[] = [];
  let signerInfo: Asn1[] | null = null;
  for (const part of signedData.slice(3)) {
    if (part.tagClass === asn1.Class.CONTEXT_SPECIFIC && part.type === 0) {
      for (const certificate of part.value as Asn1[]) certificates.push(pki.certificateFromAsn1(certificate));
    } else if (part.tagClass === asn1.Class.UNIVERSAL && part.type === asn1.Type.SET) {
      signerInfo = ((part.value as Asn1[])[0]?.value as Asn1[]) ?? null;
    }
  }
  const empty: ParsedSignedData = { certificates, signer: null, contentDigestMatches: false, signatureValid: false, signingTime: null };
  if (!signerInfo) return empty;
  const info: Asn1 = sequence(signerInfo);
  const serial = forge.util.bytesToHex(child(child(info, 1), 1).value as string).replace(/^0+/, "");
  const signer = certificates.find((certificate) => certificate.serialNumber.replace(/^0+/, "") === serial) ?? null;
  const attributesTagged = signerInfo.find((part) => part.tagClass === asn1.Class.CONTEXT_SPECIFIC && part.type === 0);
  const signatureValue = child(info, signerInfo.length - 1).value as string;
  if (!signer || !attributesTagged) return { ...empty, signer };
  let contentDigest: string | null = null;
  let signingTime: Date | null = null;
  for (const attribute of attributesTagged.value as Asn1[]) {
    const name = asn1.derToOid(child(attribute, 0).value as string);
    const first = child(child(attribute, 1), 0);
    if (name === OID.messageDigest) contentDigest = first.value as string;
    if (name === OID.signingTime) signingTime = first.type === asn1.Type.UTCTIME ? asn1.utcTimeToDate(first.value as string) : asn1.generalizedTimeToDate(first.value as string);
  }
  const contentDigestMatches = contentDigest !== null && Buffer.from(contentDigest, "binary").equals(sha256(content));
  // Mã hóa lại thuộc tính ký với thẻ SET thay cho thẻ [0] trước khi kiểm chữ ký.
  const attributesDer = toDer(set(attributesTagged.value as Asn1[]));
  let signatureValid = false;
  try {
    const messageDigest = forge.md.sha256.create();
    messageDigest.update(attributesDer.toString("binary"));
    signatureValid = (signer.publicKey as forge.pki.rsa.PublicKey).verify(messageDigest.digest().getBytes(), signatureValue);
  } catch {
    signatureValid = false;
  }
  return { certificates, signer, contentDigestMatches, signatureValid, signingTime };
}
