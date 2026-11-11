// Lớp kết nối VNPAY theo khung nhiều cổng (CONG_VIEC_25, CONG_VIEC_32).
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";
import { paymentUrl, verifiedResult } from "../vnpay";

export interface VnpayConfiguration {
  paymentUrl: string;
  tmnCode: string;
  hashSecret: string;
  // Địa chỉ công khai của API, VNPAY chuyển người mua về sau khi trả tiền.
  returnUrl: string;
}

// VNPAY_PAYMENT_URL mặc định là môi trường thử nghiệm của VNPAY.
export function vnpayConfiguration(): VnpayConfiguration | null {
  const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
  const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
  const returnUrl = process.env.VNPAY_RETURN_URL?.trim();
  if (!tmnCode || !hashSecret || !returnUrl) return null;
  return { paymentUrl: process.env.VNPAY_PAYMENT_URL?.trim() || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html", tmnCode, hashSecret, returnUrl };
}

const replies: Record<NotificationOutcome, { RspCode: string; Message: string }> = {
  success: { RspCode: "00", Message: "Confirm Success" },
  // VNPAY không gửi trạng thái đang xử lý; giữ cho đủ kiểu.
  pending: { RspCode: "00", Message: "Confirm Success" },
  not_found: { RspCode: "01", Message: "Order not found" },
  already_confirmed: { RspCode: "02", Message: "Order already confirmed" },
  invalid_amount: { RspCode: "04", Message: "Invalid amount" },
  invalid_signature: { RspCode: "97", Message: "Invalid signature" },
  error: { RspCode: "99", Message: "Unknown error" },
};

export class VnpayGateway implements PaymentGatewayAdapter {
  readonly code = "vnpay" as const;

  configured(): boolean {
    return vnpayConfiguration() !== null;
  }

  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const configuration = vnpayConfiguration()!;
    return {
      kind: "redirect",
      url: paymentUrl(configuration, {
        reference: input.reference,
        amount: input.amount,
        method: input.method,
        orderInfo: `Thanh toan don ${input.documentNo}`,
        ipAddress: input.ipAddress,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      }),
    };
  }

  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = vnpayConfiguration();
    return configuration ? verifiedResult(configuration, request.query) : null;
  }

  verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    return this.verify(request);
  }

  // VNPAY luôn nhận HTTP 200 kèm mã trả lời.
  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return { status: 200, body: replies[outcome] };
  }
}
