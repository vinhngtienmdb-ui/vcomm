// Khung cổng thanh toán chung (CONG_VIEC_25; QUYTAC_NGHIEPVU_163). Thông tin kết nối chỉ ở biến môi trường.
import type { PaymentGatewayCode, PaymentMethodCode } from "contracts";

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

export const gatewayOf = (method: PaymentMethodCode): PaymentGatewayCode => (method === "cod" ? "cod" : "vnpay");

export function gatewayConfigured(code: PaymentGatewayCode): boolean {
  if (code === "cod") return true;
  return vnpayConfiguration() !== null;
}

// Thanh toán trực tuyến: đơn chờ thanh toán, giữ hàng có hạn (QUYTAC_NGHIEPVU_165).
export const isOnlineMethod = (method: PaymentMethodCode) => gatewayOf(method) !== "cod";
