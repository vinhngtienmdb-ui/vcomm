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
  // Số hóa đơn bán lẻ (quầy tập đoàn) hoặc số giao dịch LK… (cửa hàng liên kết) khi hoàn tất.
  saleDocumentNo: string | null;
  // Voucher khách dùng được ở cửa hàng liên kết (lát L4); quầy tập đoàn không có voucher.
  vouchers: InstoreCheckoutVoucher[];
  voucherCodeId: string | null;
}

// Voucher dùng được cho đơn: tiền giảm và số điểm tối đa sau khi trừ voucher (QUYTAC_NGHIEPVU_578, 399).
export interface InstoreCheckoutVoucher {
  codeId: string;
  titleVi: string;
  titleEn: string;
  discount: string;
  maxPoints: number;
  expiresAt: string;
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
    voucherCodeId: z.uuid().nullable().default(null),
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

// ---------------------------------------------------------------------------
// Cổng cửa hàng liên kết (API_329; MAN_HINH_174) và cài đặt thu hộ, biểu phí cổng (API_332; MAN_HINH_279, 280). Lát L4.
// ---------------------------------------------------------------------------

const moneyText = z
  .string()
  .trim()
  .regex(/^[0-9]{1,14}(\.[0-9]{1,4})?$/, "invalidValue");
const percentText = z
  .string()
  .trim()
  .regex(/^[0-9]{1,2}(\.[0-9]{1,2})?$/, "invalidValue")
  .refine((value) => Number(value) <= 10, "invalidValue");

// Thu ngân tạo đơn chờ: khách trả qua ứng dụng (cửa hàng đã bật thu hộ) hoặc trả tại quầy (chỉ tích, dùng điểm, voucher).
// Có mã thanh toán của khách (luồng 1) thì gắn khách ngay; không có thì trả mã QR (luồng 2).
export const createMerchantCheckoutSchema = z
  .object({
    clientKey: z.uuid(),
    outletId: z.uuid(),
    billAmount: moneyText.refine((value) => Number(value) > 0, "invalidValue"),
    collectInApp: z.boolean(),
    payCode: z.string().trim().max(40).optional(),
  })
  .strict();
export type CreateMerchantCheckoutRequest = z.input<typeof createMerchantCheckoutSchema>;
export const merchantCheckoutPayCodeSchema = z.object({ code: z.string().trim().min(1).max(40) }).strict();
export const merchantCheckoutCancelSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export interface MerchantCheckoutResponse {
  id: string;
  documentNo: string;
  status: InstoreCheckoutStatus;
  outletId: string;
  outletName: string;
  billAmount: string;
  collectInApp: boolean;
  expiresAt: string;
  // Đường dẫn thanh toán in trong mã QR (luồng 2); chỉ trả khi vừa tạo.
  qrUrl: string | null;
  buyer: { maskedName: string; tierName: string | null } | null;
  points: number;
  pointsAmount: string;
  voucherAmount: string;
  // Tiền khách trả qua ứng dụng (thu hộ) hoặc tiền còn thu tại quầy, chốt khi khách bấm thanh toán, xác nhận.
  amountDue: string | null;
  transactionId: string | null;
  transactionNo: string | null;
  // Thu hộ: tiền đã thu, phí thu hộ kèm thuế, phí cổng, tiền VComm chuyển cho cửa hàng (QUYTAC_NGHIEPVU_584).
  collectedAmount: string;
  collectionFee: string;
  collectionFeeTax: string;
  gatewayFee: string;
  payoutAmount: string;
  feePercent: string | null;
  canCancel: boolean;
}

// Cài đặt thu hộ của cửa hàng liên kết (MAN_HINH_279). Bật lần đầu phải xác nhận đã đọc cảnh báo pháp lý.
export const affiliateCollectionSchema = z
  .object({
    enabled: z.boolean(),
    feePercent: percentText,
    payoutBankAccountId: z.uuid().nullable(),
    acknowledged: z.boolean().default(false),
    version: z.number().int().min(1),
  })
  .strict();
export type AffiliateCollectionRequest = z.input<typeof affiliateCollectionSchema>;
export interface AffiliateCollectionResponse {
  merchantId: string;
  enabled: boolean;
  feePercent: string;
  payoutBankAccountId: string | null;
  acknowledgedAt: string | null;
  // Tài khoản ngân hàng của đối tác (CONG_VIEC_06) để chọn tài khoản nhận tiền.
  bankAccounts: { id: string; bankName: string; accountNo: string; accountHolder: string }[];
  canManage: boolean;
  version: number;
}

// Biểu phí cổng tại cửa hàng (MAN_HINH_280): mỗi phương thức một dòng hiện hành; sửa là thêm mức mới áp dụng từ ngày.
export interface InstoreGatewayFeeRow {
  method: string;
  gatewayCode: string;
  percent: string | null;
  fixedAmount: string | null;
  effectiveFrom: string | null;
  // Mức đã hẹn áp dụng sau hôm nay.
  scheduled: { percent: string; fixedAmount: string; effectiveFrom: string } | null;
}
export interface InstoreGatewayFeesResponse {
  rows: InstoreGatewayFeeRow[];
  canManage: boolean;
}
export const instoreGatewayFeesSchema = z
  .object({
    rates: z
      .array(
        z
          .object({
            method: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/),
            percent: percentText,
            fixedAmount: moneyText.refine((value) => Number(value) <= 100000, "invalidValue"),
            effectiveFrom: z.iso.date(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export type InstoreGatewayFeesRequest = z.input<typeof instoreGatewayFeesSchema>;
