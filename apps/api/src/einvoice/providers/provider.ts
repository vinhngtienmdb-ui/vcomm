// Lớp kết nối nhà cung cấp hóa đơn điện tử (CONG_VIEC_16; QUYTAC_NGHIEPVU_105). Mỗi nhà cung cấp cài một bộ chuyển đổi theo giao diện này.
import type { EinvoiceSimulation } from "contracts";

export interface ProviderConfig {
  companyId: string;
  environment: "test" | "production";
  withTaxCode: boolean;
  appId: string | null;
  taxCode: string | null;
  username: string | null;
  password: string | null;
  simulation: EinvoiceSimulation;
}

export interface ProviderInvoiceLine {
  lineNo: number;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  quantity: number;
  unitPrice: number;
  vatRate: "0" | "5" | "8" | "10" | "exempt" | "not_declared";
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  isPromotion: boolean;
}

export interface ProviderInvoice {
  referenceId: string;
  kind: "original" | "adjustment" | "replacement";
  invoiceDate: string;
  templateCode: string;
  series: string;
  currency: string;
  seller: { name: string | null; taxCode: string | null; address: string | null };
  buyer: { name: string | null; taxCode: string | null; address: string | null; anonymous: boolean };
  lines: ProviderInvoiceLine[];
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountInWords: string;
  original: { templateCode: string; series: string; invoiceNo: string; invoiceDate: string } | null;
  note: string | null;
}

// Kết quả một lần gọi: phát hành xong, chờ cơ quan thuế cấp mã, bị từ chối, lỗi tạm thời (gửi lại), lỗi dữ liệu hoặc xác thực (dừng), không rõ (tra lại), không tìm thấy.
export type ProviderOutcome = "issued" | "awaiting_code" | "rejected" | "temporary_error" | "data_error" | "unknown" | "not_found";
export interface ProviderResult {
  outcome: ProviderOutcome;
  invoiceNo?: string;
  taxAuthorityCode?: string | null;
  transactionId?: string | null;
  errorCode?: string | null;
  message?: string | null;
}

export interface EinvoiceProviderAdapter {
  testConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string | null }>;
  publish(config: ProviderConfig, invoice: ProviderInvoice): Promise<ProviderResult>;
  status(config: ProviderConfig, invoice: ProviderInvoice): Promise<ProviderResult>;
  download(
    config: ProviderConfig,
    invoice: ProviderInvoice,
    issued: { invoiceNo: string; taxAuthorityCode: string | null; transactionId: string | null },
  ): Promise<{ pdf: Buffer | null; xml: Buffer | null }>;
}
