// Khung nhiều cổng thanh toán (CONG_VIEC_25, CONG_VIEC_32; QUYTAC_NGHIEPVU_163, 220). Thông tin kết nối chỉ ở biến môi trường.
// Mỗi cổng (CONG_VIEC_33 đến 39) thêm lớp kết nối của mình vào danh sách trên dòng riêng, không chạy prettier trên tệp này.
import type { PaymentGatewayCode, PaymentMethodCode } from "contracts";
import { VnpayGateway } from "./gateways/vnpay-gateway";
import { ZalopayGateway } from "./gateways/zalopay-gateway";
import type { PaymentGatewayAdapter } from "./payment-gateway";

export const paymentGateways: PaymentGatewayAdapter[] = [
  new VnpayGateway(),
  new ZalopayGateway(),
];

export function gatewayAdapter(code: string): PaymentGatewayAdapter | null {
  return paymentGateways.find((gateway) => gateway.code === code) ?? null;
}

export function gatewayConfigured(code: PaymentGatewayCode | string): boolean {
  if (code === "cod") return true;
  return gatewayAdapter(code)?.configured() ?? false;
}

// Thanh toán trực tuyến: đơn chờ thanh toán, giữ hàng có hạn (QUYTAC_NGHIEPVU_165).
export const isOnlineMethod = (method: PaymentMethodCode) => method !== "cod";
