// Lớp kết nối cổng ZaloPay theo khung nhiều cổng (CONG_VIEC_32, CONG_VIEC_42; CHUC_NANG_156): ví ZaloPay, thẻ ATM và tài khoản ngân hàng, thẻ quốc tế.
// Phần ký, kiểm chữ ký, gọi ZaloPay dùng chung ở zalopay-client.ts.
import type { PaymentMethodCode } from "contracts";
import { ApiError } from "../../../common/api-error";
import type { GatewayNotification, GatewayRequest, NotificationOutcome, PaymentGatewayAdapter, PaymentInstruction, PaymentStartInput } from "../payment-gateway";
import { createZalopayOrder, verifiedZalopayCallback, verifiedZalopayRedirect, zalopayConfiguration, zalopayReplies } from "./zalopay-client";

// Phương thức người mua đã chọn mở thẳng trang tương ứng của ZaloPay (embed_data.preferred_payment_method).
const preferredMethods: Partial<Record<PaymentMethodCode, string[]>> = {
  zalopay_wallet: ["zalopay_wallet"],
  zalopay_atm: ["domestic_card", "account"],
  zalopay_card: ["international_card"],
};

export class ZalopayGateway implements PaymentGatewayAdapter {
  readonly code = "zalopay" as const;

  configured(): boolean {
    return zalopayConfiguration() !== null;
  }

  // ZaloPay từ chối hoặc không trả lời: báo phương thức tạm không dùng được, giao dịch mở thanh toán quay lui (không tính lần thanh toán).
  async start(input: PaymentStartInput): Promise<PaymentInstruction> {
    const orderUrl = await createZalopayOrder(zalopayConfiguration()!, this.code, input, preferredMethods[input.method] ?? []);
    if (!orderUrl) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    return { kind: "redirect", url: orderUrl };
  }

  async verify(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = zalopayConfiguration();
    return configuration ? verifiedZalopayCallback(configuration, request.method, request.body) : null;
  }

  async verifyReturn(request: GatewayRequest): Promise<GatewayNotification | null> {
    const configuration = zalopayConfiguration();
    return configuration ? verifiedZalopayRedirect(configuration, request.query) : null;
  }

  reply(outcome: NotificationOutcome): { status: number; body: unknown } {
    return { status: 200, body: zalopayReplies[outcome] };
  }
}
