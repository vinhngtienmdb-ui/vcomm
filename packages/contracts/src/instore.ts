// Mua hàng tại cửa hàng, thanh toán trong ứng dụng VComm (CONG_VIEC_73; QUYTAC_NGHIEPVU_574 đến 579; API_327).
import { z } from "zod";

// Mã thanh toán động: 12 chữ số mã thiết bị + 6 chữ số Smart OTP (QUYTAC_NGHIEPVU_574). Cho phép dấu cách khi nhập tay.
export const payCodeLength = 18;
export const payCodePrefixLength = 12;
export const payCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{18}$/, "payCodeFormat"));

export const instoreCheckoutStatuses = ["awaiting_buyer", "awaiting_payment", "completed", "expired", "cancelled", "declined"] as const;
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
}
