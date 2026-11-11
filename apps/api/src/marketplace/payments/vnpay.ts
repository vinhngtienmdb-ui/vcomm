// Kết nối cổng VNPAY theo đặc tả công khai phiên bản 2.1.0 (CONG_VIEC_25; QUYTAC_NGHIEPVU_165, 166): ký HMAC SHA512 các tham số sắp xếp theo tên.
// Chưa thử với môi trường thử nghiệm của VNPAY; phải thử trước khi phát hành.
import type { PaymentMethodCode } from "contracts";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { VnpayConfiguration } from "./gateways/vnpay-gateway";

// Loại thanh toán gửi VNPAY để mở thẳng trang của phương thức người mua đã chọn.
const bankCodes: Partial<Record<PaymentMethodCode, string>> = { vnpay_qr: "VNPAYQR", vnpay_atm: "VNBANK", vnpay_card: "INTCARD" };

// Mã hóa giống ví dụ của VNPAY: encodeURIComponent, khoảng trắng thành dấu cộng.
const encode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");

export function signedQuery(parameters: Record<string, string>, hashSecret: string): { query: string; hash: string } {
  const query = Object.keys(parameters)
    .filter((key) => parameters[key] !== "" && parameters[key] !== undefined)
    .sort()
    .map((key) => `${encode(key)}=${encode(parameters[key]!)}`)
    .join("&");
  return { query, hash: createHmac("sha512", hashSecret).update(query, "utf8").digest("hex") };
}

// Giờ Việt Nam dạng yyyyMMddHHmmss.
export function vnpayTime(value: Date): string {
  const local = new Date(value.getTime() + 7 * 3_600_000).toISOString();
  return local.slice(0, 19).replace(/[-:T]/g, "");
}

export function paymentUrl(
  configuration: VnpayConfiguration,
  input: { reference: string; amount: number; method: PaymentMethodCode; orderInfo: string; ipAddress: string; createdAt: Date; expiresAt: Date },
): string {
  const parameters: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: configuration.tmnCode,
    vnp_Amount: String(Math.round(input.amount) * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.reference,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: configuration.returnUrl,
    vnp_IpAddr: input.ipAddress,
    vnp_CreateDate: vnpayTime(input.createdAt),
    vnp_ExpireDate: vnpayTime(input.expiresAt),
    vnp_BankCode: bankCodes[input.method] ?? "",
  };
  const signed = signedQuery(parameters, configuration.hashSecret);
  return `${configuration.paymentUrl}?${signed.query}&vnp_SecureHash=${signed.hash}`;
}

export interface VnpayResult {
  reference: string;
  // Số tiền đồng (VNPAY gửi nhân 100).
  amount: number;
  success: boolean;
  responseCode: string;
  transactionNo: string | null;
  bankCode: string | null;
}

// Kiểm chữ ký kết quả VNPAY gửi về (IPN, trang trả về); sai chữ ký trả về null.
export function verifiedResult(configuration: VnpayConfiguration, query: Record<string, unknown>): VnpayResult | null {
  const parameters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) if (key.startsWith("vnp_") && typeof value === "string") parameters[key] = value;
  const received = parameters.vnp_SecureHash ?? "";
  delete parameters.vnp_SecureHash;
  delete parameters.vnp_SecureHashType;
  const expected = signedQuery(parameters, configuration.hashSecret).hash;
  const receivedBuffer = Buffer.from(received.toLowerCase(), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  if (parameters.vnp_TmnCode !== configuration.tmnCode || !parameters.vnp_TxnRef || !/^\d+$/.test(parameters.vnp_Amount ?? "")) return null;
  return {
    reference: parameters.vnp_TxnRef,
    amount: Number(parameters.vnp_Amount) / 100,
    success: parameters.vnp_ResponseCode === "00" && parameters.vnp_TransactionStatus === "00",
    responseCode: parameters.vnp_ResponseCode ?? "",
    transactionNo: parameters.vnp_TransactionNo ?? null,
    bankCode: parameters.vnp_BankCode ?? null,
  };
}
