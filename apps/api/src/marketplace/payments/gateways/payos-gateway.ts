// Lớp kết nối PayOS theo khung nhiều cổng (CONG_VIEC_35; CHUC_NANG_149; QUYTAC_NGHIEPVU_235 đến 239), theo tài liệu công khai payos.vn/docs.
// PayOS không có môi trường thử nghiệm riêng: phải thử bằng kênh thanh toán thật với số tiền nhỏ trước khi phát hành.
import { Logger } from "@nestjs/common";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";

export interface PayosConfiguration {
  apiUrl: string;
  clientId: string;
  apiKey: string;
  checksumKey: string;
  // Địa chỉ công khai của API + /api/v1/public/payments/payos/return; PayOS chuyển người mua về khi trả xong hoặc hủy.
  returnUrl: string;
  // PayOS chỉ trả mã BIN ngân hàng; tên ngân hàng hiện cho người mua lấy từ biến môi trường, trống thì hiện mã BIN.
  bankName: string | null;
}

export function payosConfiguration(): PayosConfiguration | null {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim();
  const apiKey = process.env.PAYOS_API_KEY?.trim();
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim();
  const returnUrl = process.env.PAYOS_RETURN_URL?.trim();
  if (!clientId || !apiKey || !checksumKey || !returnUrl) return null;
  return {
    apiUrl: (process.env.PAYOS_API_URL?.trim() || "https://api-merchant.payos.vn").replace(/\/+$/, ""),
    clientId,
    apiKey,
    checksumKey,
    returnUrl,
    bankName: process.env.PAYOS_BANK_NAME?.trim() || null,
  };
}

const sign = (text: string, checksumKey: string) => createHmac("sha256", checksumKey).update(text, "utf8").digest("hex");

// Chữ ký dữ liệu webhook (QUYTAC_NGHIEPVU_236): khóa xếp theo chữ cái, null thành chuỗi rỗng, mảng thành JSON (phần tử xếp khóa), ghép key=value bằng &.
export function payosDataSignature(data: Record<string, unknown>, checksumKey: string): string {
  const sortObject = (value: unknown): unknown =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, (value as Record<string, unknown>)[key]]),
        )
      : value;
  const text = Object.keys(data)
    .filter((key) => data[key] !== undefined)
    .sort()
    .map((key) => {
      let value = data[key];
      if (Array.isArray(value)) value = JSON.stringify(value.map(sortObject));
      if (value === null || value === undefined || value === "null" || value === "undefined") value = "";
      return `${key}=${String(value)}`;
    })
    .join("&");
  return sign(text, checksumKey);
}

// Chữ ký yêu cầu tạo link thanh toán: năm trường cố định theo thứ tự chữ cái.
export function payosRequestSignature(input: { amount: number; cancelUrl: string; description: string; orderCode: number; returnUrl: string }, checksumKey: string): string {
  return sign(`amount=${input.amount}&cancelUrl=${input.cancelUrl}&description=${input.description}&orderCode=${input.orderCode}&returnUrl=${input.returnUrl}`, checksumKey);
}

const sameSignature = (expected: string, received: unknown) => {
  if (typeof received !== "string" || !/^[0-9a-fA-F]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
};

interface PayosCreateResponse {
  code?: string;
  desc?: string;
  data?: { bin?: string; accountNumber?: string; accountName?: string; amount?: number; description?: string; orderCode?: number; qrCode?: string; checkoutUrl?: string } | null;
}

// PayOS gửi lại khi chưa nhận mã 2xx: chỉ trả lỗi khi sai chữ ký hoặc VComm lỗi (QUYTAC_NGHIEPVU_237).
// Bản thử khi đăng ký webhook trên trang PayOS có mã đơn không tồn tại, trả 200 để đăng ký được.
const replies: Record<NotificationOutcome, { status: number; body: { success: boolean; message: string } }> = {
  success: { status: 200, body: { success: true, message: "Confirm Success" } },
  not_found: { status: 200, body: { success: true, message: "Order not found" } },
  already_confirmed: { status: 200, body: { success: true, message: "Order already confirmed" } },
  invalid_amount: { status: 200, body: { success: true, message: "Invalid amount" } },
  invalid_signature: { status: 400, body: { success: false, message: "Invalid signature" } },
  error: { status: 500, body: { success: false, message: "Unknown error" } },
};

export class PayosGateway implements PaymentGatewayAdapter {
  readonly code = "payos" as const;
  private readonly logger = new Logger("PayosGateway");

  configured(): boolean {
    return payosConfiguration() !== null;
  }

  // PayOS chỉ nhận mã đơn số nguyên dương (tối đa 2^53 - 1): mili giây hiện tại nhân 1000 cộng số ngẫu nhiên; chỉ mục duy nhất chặn trùng (QUYTAC_NGHIEPVU_235).
  createOrderCode(): string {
    return String(Date.now() * 1000 + randomInt(1000));
  }

  // Tạo link thanh toán, hiện thông tin chuyển khoản và chuỗi VietQR do PayOS cấp (QUYTAC_NGHIEPVU_238).
  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = payosConfiguration()!;
    const orderCode = Number(input.gatewayOrderCode);
    // Tài khoản ngân hàng không liên kết qua PayOS chỉ nhận mô tả tối đa 9 ký tự.
    const description = input.reference.slice(-9);
    const fields = { amount: input.amount, cancelUrl: configuration.returnUrl, description, orderCode, returnUrl: configuration.returnUrl };
    const response = await fetch(`${configuration.apiUrl}/v2/payment-requests`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-client-id": configuration.clientId, "x-api-key": configuration.apiKey },
      body: JSON.stringify({ ...fields, expiredAt: Math.floor(input.expiresAt.getTime() / 1000), signature: payosRequestSignature(fields, configuration.checksumKey) }),
      signal: AbortSignal.timeout(15_000),
    });
    const result = (await response.json().catch(() => ({}))) as PayosCreateResponse;
    const data = result.data;
    if (!response.ok || result.code !== "00" || !data?.accountNumber || data.amount !== input.amount || data.orderCode !== orderCode) {
      this.logger.error(`Tạo link PayOS ${input.reference} lỗi: HTTP ${response.status}, mã ${result.code ?? "-"} ${result.desc ?? ""}`);
      throw new Error("PayOS không tạo được link thanh toán");
    }
    return {
      kind: "transfer",
      transfer: {
        bankName: configuration.bankName ?? data.bin ?? "",
        accountNumber: data.accountNumber,
        accountName: data.accountName ?? "",
        amount: String(input.amount),
        content: data.description ?? description,
        qrData: data.qrCode ?? null,
        qrImageUrl: null,
      },
    };
  }

  // Kết quả PayOS gửi về: kiểm chữ ký trên data bằng khóa checksum, so sánh an toàn thời gian (QUYTAC_NGHIEPVU_236).
  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = payosConfiguration();
    const body = request.body as { code?: unknown; success?: unknown; data?: unknown; signature?: unknown } | null;
    if (!configuration || request.method !== "POST" || !body || typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) return null;
    const data = body.data as Record<string, unknown>;
    if (!sameSignature(payosDataSignature(data, configuration.checksumKey), body.signature)) return null;
    if (!Number.isSafeInteger(data.orderCode) || typeof data.amount !== "number") return null;
    const responseCode = typeof data.code === "string" ? data.code : String(body.code ?? "");
    return {
      reference: null,
      gatewayOrderCode: String(data.orderCode),
      amount: data.amount,
      success: body.code === "00" && data.code === "00",
      responseCode,
      transactionNo: typeof data.reference === "string" && data.reference ? data.reference.slice(0, 100) : null,
      bankCode: typeof data.counterAccountBankId === "string" && data.counterAccountBankId ? data.counterAccountBankId.slice(0, 40) : null,
    };
  }

  // Trang trả về của PayOS không có chữ ký: chỉ dùng mã đơn để tìm lần thanh toán; trạng thái đã thu lấy từ cơ sở dữ liệu (QUYTAC_NGHIEPVU_239).
  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const orderCode = request.query.orderCode;
    if (typeof orderCode !== "string" || !/^\d{1,16}$/.test(orderCode)) return null;
    const cancelled = request.query.cancel === "true" || request.query.status === "CANCELLED";
    return { reference: null, gatewayOrderCode: orderCode, amount: 0, success: !cancelled, responseCode: String(request.query.code ?? ""), transactionNo: null, bankCode: null };
  }

  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return replies[outcome];
  }
}
