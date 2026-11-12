// Lớp kết nối nhà cung cấp ký số từ xa (CONG_VIEC_59; QUYTAC_NGHIEPVU_454 đến 457). Mỗi nhà cung cấp cài một bộ chuyển đổi theo giao diện này.

export interface SigningProviderConfig {
  companyId: string;
  environment: "test" | "production";
  // Thông tin kết nối đã giải mã; không ghi log.
  credentials: Record<string, string>;
}

export interface ProviderCertificate {
  // Chuỗi chứng thư PEM, chứng thư người ký đứng đầu.
  certificateChainPem: string[];
  serialNumber: string;
}

export interface SignatureRequest {
  identityCode: string;
  serialNumber: string;
  // SHA-256 của thuộc tính ký (32 byte).
  digest: Buffer;
  // Tiêu đề hiện trên ứng dụng của người ký.
  documentTitle: string;
}

export type SignatureResult = { status: "pending" } | { status: "signed"; signatureValue: Buffer } | { status: "rejected"; message: string } | { status: "failed"; message: string };

export interface SigningProvider {
  checkConnection(config: SigningProviderConfig): Promise<void>;
  listCertificates(config: SigningProviderConfig, identityCode: string): Promise<ProviderCertificate[]>;
  // Gửi yêu cầu ký; nhà cung cấp đẩy yêu cầu xác nhận tới ứng dụng của người ký.
  requestSignature(config: SigningProviderConfig, request: SignatureRequest): Promise<{ transactionId: string }>;
  getSignatureResult(config: SigningProviderConfig, transactionId: string): Promise<SignatureResult>;
}
