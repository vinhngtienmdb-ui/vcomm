// Lớp kết nối SePay theo khung nhiều cổng (CONG_VIEC_34; QUYTAC_NGHIEPVU_230 đến 234): người mua chuyển khoản theo hướng dẫn,
// SePay gửi webhook biến động số dư (https://developer.sepay.vn/en/sepay-webhooks/tich-hop-webhook), xác thực bằng khóa API.
import { accountDigits, authorized, parseWebhook } from "../../../bank/bank-webhook";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface SepayConfiguration {
  webhookApiKey: string;
  // Tên viết tắt ngân hàng theo danh sách https://qr.sepay.vn/banks.json, dùng tạo ảnh mã QR.
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export function sepayConfiguration(): SepayConfiguration | null {
  const values = {
    webhookApiKey: process.env.SEPAY_WEBHOOK_API_KEY?.trim(),
    bankCode: process.env.SEPAY_BANK_CODE?.trim(),
    bankName: process.env.SEPAY_BANK_NAME?.trim(),
    accountNumber: process.env.SEPAY_ACCOUNT_NUMBER?.trim(),
    accountName: process.env.SEPAY_ACCOUNT_NAME?.trim(),
  };
  if (Object.values(values).some((value) => !value)) return null;
  return values as SepayConfiguration;
}

// Số tham chiếu của lần thanh toán: chữ và số, kết thúc bằng T và hai chữ số (payments.service.ts).
const referencePattern = /^[A-Z0-9]{2,}T\d{2}$/;

// Tìm số tham chiếu (QUYTAC_NGHIEPVU_231): ưu tiên mã thanh toán SePay tách sẵn, sau đó từ đầu tiên đúng dạng trong nội dung chuyển khoản.
export function referenceFromTransfer(code: unknown, content: string): string {
  const candidates = [typeof code === "string" ? code : "", ...content.split(/[^A-Za-z0-9]+/)].map((item) => item.trim().toUpperCase());
  return candidates.find((item) => referencePattern.test(item)) ?? "";
}

export class SepayGateway implements PaymentGatewayAdapter {
  readonly code = "sepay" as const;

  configured(): boolean {
    return sepayConfiguration() !== null;
  }

  // Hướng dẫn chuyển khoản (QUYTAC_NGHIEPVU_230): nội dung là số tham chiếu, ảnh mã QR VietQR do SePay tạo.
  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = sepayConfiguration()!;
    const qrImageUrl = new URL("https://qr.sepay.vn/img");
    qrImageUrl.search = new URLSearchParams({ acc: configuration.accountNumber, bank: configuration.bankCode, amount: String(input.amount), des: input.reference }).toString();
    return {
      kind: "transfer",
      transfer: {
        bankName: configuration.bankName,
        accountNumber: configuration.accountNumber,
        accountName: configuration.accountName,
        amount: String(input.amount),
        content: input.reference,
        qrData: null,
        qrImageUrl: qrImageUrl.toString(),
      },
    };
  }

  // Sai khóa, dữ liệu sai hoặc khác số tài khoản nhận tiền: trả null. Giao dịch tiền ra hoặc không có số tham chiếu: số tham chiếu rỗng để khung trả "không tìm thấy" (QUYTAC_NGHIEPVU_232).
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = sepayConfiguration();
    if (!configuration || request.method !== "POST") return null;
    const header = request.headers.authorization;
    if (!authorized(Array.isArray(header) ? header[0] : header, configuration.webhookApiKey)) return null;
    const transaction = parseWebhook(request.body);
    if (!transaction) return null;
    if (transaction.accountNumber && accountDigits(transaction.accountNumber) !== accountDigits(configuration.accountNumber)) return null;
    const reference = transaction.direction === "in" ? referenceFromTransfer((request.body as { code?: unknown }).code, transaction.content) : "";
    return {
      reference,
      amount: Number(transaction.amount),
      success: true,
      responseCode: transaction.direction,
      transactionNo: transaction.referenceCode ?? transaction.externalId,
      bankCode: null,
    };
  }

  // SePay chỉ coi là nhận được khi HTTP 200 kèm {"success": true}; trả khác thì SePay gửi lại (QUYTAC_NGHIEPVU_233).
  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    if (outcome === "invalid_signature") return { status: 401, body: { success: false } };
    if (outcome === "error") return { status: 500, body: { success: false } };
    return { status: 200, body: { success: true } };
  }
}
