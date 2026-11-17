// Mua hàng tại cửa hàng, thanh toán trong ứng dụng VComm (CONG_VIEC_73; QUYTAC_NGHIEPVU_574 đến 579; API_327).
import { z } from "zod";

// Mã thanh toán động: 12 chữ số mã thiết bị + 6 chữ số Smart OTP (QUYTAC_NGHIEPVU_574). Cho phép dấu cách khi nhập tay.
export const payCodeLength = 18;
export const payCodePrefixLength = 12;
export const payCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{18}$/, "payCodeFormat"));

export const instoreCheckoutStatuses = ["awaiting_buyer", "awaiting_payment", "paid_unposted", "completed", "expired", "cancelled", "declined"] as const;
export type InstoreCheckoutStatus = (typeof instoreCheckoutStatuses)[number];
export type InstoreCheckoutKind = "retail" | "affiliate";
export type InstoreCheckoutSource = "retail_counter" | "merchant_portal" | "open_api" | "ipos";

// Ứng dụng xin mã thanh toán của thiết bị sau khi kích hoạt, chuyển Smart OTP hoặc khi mất mã đã lưu.
export interface PayCodePrefixResponse {
  prefix: string;
  // Thời điểm kích hoạt Smart OTP mà mã gắn với: khác thời điểm ứng dụng đang giữ thì xin lại.
  activatedAt: string;
}

// Khách mở đơn từ mã QR thanh toán của cửa hàng (luồng 2).
export const claimInstoreCheckoutSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16,64}$/),
});

export interface InstoreCheckoutLine {
  name: string;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  amount: string;
  gift: boolean;
}

// Đơn chờ thanh toán khách xem trên ứng dụng (MAN_HINH_277).
export interface BuyerInstoreCheckout {
  id: string;
  documentNo: string;
  kind: InstoreCheckoutKind;
  status: InstoreCheckoutStatus;
  storeName: string;
  placeName: string;
  billAmount: string;
  lines: InstoreCheckoutLine[];
  collectInApp: boolean;
  expiresAt: string;
  points: number;
  pointsAmount: string;
  voucherAmount: string;
  amountDue: string | null;
  // Giới hạn điểm khách dùng được cho đơn (QUYTAC_NGHIEPVU_578); null khi đơn không dùng điểm được.
  loyalty: InstoreCheckoutLoyalty | null;
  // Phương thức thanh toán đang bật (MAN_HINH_277).
  paymentMethods: { code: string; gatewayCode: string }[];
  // Dùng điểm cần nhập mã Smart OTP (đơn mở từ mã QR); đơn quét mã thanh toán đã xác thực khi quét.
  smartOtpRequired: boolean;
  saleDocumentNo: string | null;
}

export interface InstoreCheckoutLoyalty {
  balance: number;
  minPoints: number;
  maxPoints: number;
  pointValue: string | null;
  blockedReason: string | null;
  redeemLockedUntil: string | null;
}

// Khách chọn điểm, phương thức rồi thanh toán (API_327). Còn phải trả 0 thì hoàn tất ngay.
export const payInstoreCheckoutSchema = z
  .object({
    points: z.number().int().min(0).max(1_000_000_000).default(0),
    method: z
      .string()
      .regex(/^[a-z][a-z0-9_]{1,39}$/)
      .nullable()
      .default(null),
    smartOtp: z
      .string()
      .regex(/^[0-9]{6}$/)
      .optional(),
    invoiceInfo: z
      .object({
        name: z.string().trim().min(1).max(200),
        taxCode: z
          .string()
          .trim()
          .regex(/^[0-9]{10}(-[0-9]{3})?$/)
          .nullable()
          .default(null),
        address: z.string().trim().max(400).nullable().default(null),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();
export type PayInstoreCheckoutRequest = z.input<typeof payInstoreCheckoutSchema>;
export interface PayInstoreCheckoutResponse {
  checkout: BuyerInstoreCheckout;
  paymentUrl: string | null;
}
