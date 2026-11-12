// Bộ giả lập ký số từ xa cho môi trường thử (CONG_VIEC_59; QUYTAC_NGHIEPVU_454). Không có giá trị pháp lý.
// Tổ chức chứng thực giả lập và khóa của từng mã định danh lưu ở thư mục SIGNING_SIMULATOR_DIRECTORY (mặc định .storage/ky-so-gia-lap) để chứng thư không đổi sau khi khởi động lại.
// Tình huống kiểm thử theo mã định danh: tận cùng 000 thì người ký từ chối; 999 thì không bao giờ xác nhận; 111 thì chứng thư đã hết hạn.
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import forge from "node-forge";
import type { ProviderCertificate, SignatureRequest, SignatureResult, SigningProvider, SigningProviderConfig } from "./signing-provider";

const UID = "0.9.2342.19200300.100.1.1";
const IDENTITY_PATTERN = /^[0-9A-Za-z_-]{6,40}$/;
// Tên tổ chức chứng thực giả lập; dùng chung cho chủ thể chứng thư gốc và bên cấp của chứng thư người ký
// (lấy lại chủ thể từ chứng thư đã đọc từ tệp sẽ mã hóa UTF-8 hai lần).
const AUTHORITY_SUBJECT = (): forge.pki.CertificateField[] => [{ shortName: "CN", value: "VComm CA giả lập", valueTagClass: forge.asn1.Type.UTF8 } as unknown as forge.pki.CertificateField];

export class SigningProviderError extends Error {
  constructor(
    readonly reason: "invalid_identity" | "not_found" | "not_allowed",
    message: string,
  ) {
    super(message);
  }
}

interface KeyMaterial {
  key: forge.pki.rsa.PrivateKey;
  certificatePem: string;
}

export class SimulatorSigningProvider implements SigningProvider {
  private readonly transactions = new Map<string, { identityCode: string; digest: Buffer; readyAt: number }>();

  constructor(
    private readonly directory = process.env.SIGNING_SIMULATOR_DIRECTORY ?? join(process.cwd(), ".storage", "ky-so-gia-lap"),
    private readonly confirmDelayMilliseconds = 2000,
    private readonly holderNames: Record<string, string> = {},
  ) {}

  private ensureAllowed(config: SigningProviderConfig): void {
    if (process.env.NODE_ENV === "production" || config.environment === "production") throw new SigningProviderError("not_allowed", "Bộ giả lập chỉ dùng ở môi trường thử.");
  }

  private load(name: string): KeyMaterial | null {
    const keyPath = join(this.directory, `${name}.key.pem`);
    if (!existsSync(keyPath)) return null;
    return { key: forge.pki.privateKeyFromPem(readFileSync(keyPath, "utf8")) as forge.pki.rsa.PrivateKey, certificatePem: readFileSync(join(this.directory, `${name}.cert.pem`), "utf8") };
  }

  private issue(name: string, subject: forge.pki.CertificateField[], issuer: KeyMaterial | null, validFrom: Date, validTo: Date): KeyMaterial {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
    const certificate = forge.pki.createCertificate();
    certificate.publicKey = forge.pki.publicKeyFromPem(publicKey);
    certificate.serialNumber = `01${randomBytes(15).toString("hex")}`;
    certificate.validity.notBefore = validFrom;
    certificate.validity.notAfter = validTo;
    certificate.setSubject(subject);
    certificate.setIssuer(issuer ? AUTHORITY_SUBJECT() : subject);
    certificate.setExtensions(
      issuer
        ? [{ name: "keyUsage", digitalSignature: true, nonRepudiation: true }]
        : [
            { name: "basicConstraints", cA: true },
            { name: "keyUsage", keyCertSign: true, cRLSign: true },
          ],
    );
    const key = forge.pki.privateKeyFromPem(privateKey) as forge.pki.rsa.PrivateKey;
    certificate.sign(issuer ? issuer.key : key, forge.md.sha256.create());
    const material = { key, certificatePem: forge.pki.certificateToPem(certificate) };
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(join(this.directory, `${name}.key.pem`), privateKey, { mode: 0o600 });
    writeFileSync(join(this.directory, `${name}.cert.pem`), material.certificatePem);
    return material;
  }

  // Chứng thư gốc của tổ chức chứng thực giả lập (dùng làm chứng thư gốc tin cậy trong kiểm thử).
  authority(): KeyMaterial {
    const now = new Date();
    return this.load("ca") ?? this.issue("ca", AUTHORITY_SUBJECT(), null, new Date(now.getTime() - 86_400_000), new Date(now.getTime() + 10 * 365 * 86_400_000));
  }

  private holder(identityCode: string): KeyMaterial {
    if (!IDENTITY_PATTERN.test(identityCode)) throw new SigningProviderError("invalid_identity", "Mã định danh không đúng định dạng.");
    const existing = this.load(`nguoi-ky-${identityCode}`);
    if (existing) return existing;
    const organization = /^\d{10}(\d{3})?$/.test(identityCode);
    const name = this.holderNames[identityCode] ?? `${organization ? "TỔ CHỨC" : "NGƯỜI KÝ"} GIẢ LẬP ${identityCode}`;
    const now = Date.now();
    const expired = identityCode.endsWith("111");
    return this.issue(
      `nguoi-ky-${identityCode}`,
      [
        { shortName: "CN", value: name, valueTagClass: forge.asn1.Type.UTF8 } as unknown as forge.pki.CertificateField,
        { type: UID, value: `${organization ? "MST" : "CCCD"}:${identityCode}`, valueTagClass: forge.asn1.Type.UTF8 } as unknown as forge.pki.CertificateField,
      ],
      this.authority(),
      new Date(now - (expired ? 800 : 30) * 86_400_000),
      new Date(now + (expired ? -30 : 730) * 86_400_000),
    );
  }

  async checkConnection(config: SigningProviderConfig): Promise<void> {
    this.ensureAllowed(config);
    this.authority();
  }

  async listCertificates(config: SigningProviderConfig, identityCode: string): Promise<ProviderCertificate[]> {
    this.ensureAllowed(config);
    const holder = this.holder(identityCode);
    const certificate = forge.pki.certificateFromPem(holder.certificatePem);
    return [{ certificateChainPem: [holder.certificatePem, this.authority().certificatePem], serialNumber: certificate.serialNumber }];
  }

  async requestSignature(config: SigningProviderConfig, request: SignatureRequest): Promise<{ transactionId: string }> {
    this.ensureAllowed(config);
    const certificate = forge.pki.certificateFromPem(this.holder(request.identityCode).certificatePem);
    if (certificate.serialNumber !== request.serialNumber) throw new SigningProviderError("not_found", "Không tìm thấy chứng thư.");
    const transactionId = randomUUID();
    this.transactions.set(transactionId, { identityCode: request.identityCode, digest: request.digest, readyAt: Date.now() + this.confirmDelayMilliseconds });
    return { transactionId };
  }

  async getSignatureResult(config: SigningProviderConfig, transactionId: string): Promise<SignatureResult> {
    this.ensureAllowed(config);
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return { status: "failed", message: "Không tìm thấy giao dịch ký." };
    if (transaction.identityCode.endsWith("999") || Date.now() < transaction.readyAt) return { status: "pending" };
    this.transactions.delete(transactionId);
    if (transaction.identityCode.endsWith("000")) return { status: "rejected", message: "Người ký từ chối trên ứng dụng." };
    // Ký RSA PKCS#1 v1.5 trên mã băm đã tính sẵn.
    const digest = { algorithm: "sha256", digest: () => forge.util.createBuffer(transaction.digest.toString("binary")) } as unknown as forge.md.MessageDigest;
    return { status: "signed", signatureValue: Buffer.from(this.holder(transaction.identityCode).key.sign(digest), "binary") };
  }
}
