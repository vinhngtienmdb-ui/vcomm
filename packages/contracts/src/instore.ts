// Mua hàng tại cửa hàng, thanh toán trong ứng dụng VComm (CONG_VIEC_73; QUYTAC_NGHIEPVU_574 đến 579; API_327).
import { z } from "zod";

// Mã thanh toán động: 12 chữ số mã thiết bị + 6 chữ số Smart OTP (QUYTAC_NGHIEPVU_574). Cho phép dấu cách khi nhập tay.
export const payCodeLength = 18;
export const payCodePrefixLength = 12;
export const payCodeSchema = z
  .string()
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[0-9]{18}$/, "payCodeFormat"));

// refunded: đơn thu hộ đã hoàn tất rồi bị hủy kèm hoàn tiền (lát L7).
export const instoreCheckoutStatuses = ["awaiting_buyer", "awaiting_payment", "paid_unposted", "completed", "expired", "cancelled", "declined", "refunded"] as const;
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

// ---------------------------------------------------------------------------
// Bảng chuyển tiền thu hộ ngày (API_333; MAN_HINH_281, 282). Lát L5.
// ---------------------------------------------------------------------------

export const instorePayoutListQuerySchema = z
  .object({
    recipientKind: z.enum(["merchant", "retail_company"]).optional(),
    status: z.enum(["pending", "transferred"]).optional(),
    merchantId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// G: thu hộ, H: phí sàn, I: thuế phí sàn, K: phí cổng, L: ghi ngược, M: số mang sang (≤ 0), N: khoản trừ khác.
export interface InstorePayoutItem {
  id: string;
  documentNo: string;
  recipientKind: "merchant" | "retail_company";
  recipientName: string;
  recipientCode: string | null;
  businessDate: string;
  collectedAmount: string;
  platformFee: string;
  platformFeeTax: string;
  gatewayFee: string;
  reversalAmount: string;
  carriedAmount: string;
  deductionAmount: string;
  amount: string;
  feeTaxRate: string;
  status: "pending" | "transferred";
  // Chờ chuyển quá 2 ngày làm việc.
  overdue: boolean;
  transferredOn: string | null;
  bankTransactionNo: string | null;
  paymentNo: string | null;
  receiptNo: string | null;
  // Người nhận là công ty tập đoàn mà cửa hàng chưa cài quỹ ngân hàng: phiếu thu đang nháp, chờ kế toán công ty đó chọn quỹ ngân hàng và ghi sổ.
  receiptDraft: boolean;
  createdAt: string;
  version: number;
}
export interface InstorePayoutDetail extends InstorePayoutItem {
  lines: {
    checkoutId: string;
    checkoutNo: string;
    // Số hóa đơn bán lẻ hoặc giao dịch LK…
    documentNo: string | null;
    paidAt: string;
    placeName: string;
    billAmount: string;
    collectedAmount: string;
    platformFee: string;
    gatewayFee: string;
  }[];
  deductions: { id: string; kind: string; businessDate: string; amount: string; note: string | null }[];
  // Công ty vận hành sàn, người có quyền finance.instore.manage, bảng chờ chuyển.
  canTransfer: boolean;
  // Công ty nhận (công ty tập đoàn), người có quyền finance.instore.manage, phiếu thu đang nháp.
  canPostReceipt: boolean;
}
export interface InstorePayoutListResponse {
  data: InstorePayoutItem[];
  page: number;
  pageSize: number;
  total: number;
  overdueCount: number;
}

// Ghi đã chuyển: ngày chuyển, số giao dịch ngân hàng, quỹ chi của công ty vận hành sàn.
export const instoreTransferredSchema = z
  .object({
    transferredOn: z.iso.date(),
    bankTransactionNo: z.string().trim().min(1).max(100),
    fundId: z.uuid(),
    version: z.number().int().min(1),
  })
  .strict();
export type InstoreTransferredRequest = z.input<typeof instoreTransferredSchema>;

// Ghi sổ phiếu thu nháp của bảng chuyển tiền ở công ty nhận: quỹ ngân hàng nhận tiền.
export const instorePostReceiptSchema = z.object({ fundId: z.uuid(), version: z.number().int().min(1) }).strict();
export type InstorePostReceiptRequest = z.input<typeof instorePostReceiptSchema>;

// Thuế suất phí sàn, phí thu hộ (mặc định 10 %).
export const instoreSettingsSchema = z
  .object({
    feeTaxRate: z
      .string()
      .trim()
      // Mức hóa đơn điện tử ghi được (lát L6).
      .regex(/^(0|5|8|10)$/, "invalidValue"),
    version: z.number().int().min(0),
  })
  .strict();
export interface InstoreSettingsResponse {
  feeTaxRate: string;
  version: number;
  canManage: boolean;
}

// ---------------------------------------------------------------------------
// Hóa đơn điện tử lập thay cửa hàng liên kết theo ủy nhiệm (lát L6; QUYTAC_NGHIEPVU_588, 589; API_334; MAN_HINH_279).
// ---------------------------------------------------------------------------

export const einvoiceMandateTaxMethods = ["deduction", "direct"] as const;
export type EinvoiceMandateTaxMethod = (typeof einvoiceMandateTaxMethods)[number];
export const einvoiceBacklogReasons = ["mandate_missing", "mandate_inactive", "series_missing", "einvoice_off"] as const;
export type EinvoiceBacklogReason = (typeof einvoiceBacklogReasons)[number];
const mandateVatRates = ["0", "5", "8", "10", "exempt", "not_declared"] as const;

// Khấu trừ: hóa đơn giá trị gia tăng, cần thuế suất mặc định; trực tiếp hoặc hộ kinh doanh: hóa đơn bán hàng.
export const einvoiceMandateSchema = z
  .object({
    sellerName: z.string().trim().min(1).max(300),
    taxCode: z
      .string()
      .trim()
      .regex(/^[0-9]{10}(-[0-9]{3})?$/, "invalidValue"),
    address: z.string().trim().min(1).max(300),
    taxMethod: z.enum(einvoiceMandateTaxMethods),
    defaultVatRate: z.enum(mandateVatRates).nullable(),
    mandateNo: z.string().trim().min(1).max(100),
    effectiveFrom: z.iso.date(),
    expiresOn: z.iso.date().nullable(),
    // Ký hiệu theo năm: C hoặc K, 2 số cuối của năm, T, 2 chữ cái in hoa.
    series: z
      .array(z.object({ year: z.number().int().min(2000).max(2099), series: z.string().trim().regex(/^[CK][0-9]{2}T[A-Z]{2}$/, "invalidValue") }).strict())
      .max(20),
    version: z.number().int().min(0),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.taxMethod === "deduction" && !value.defaultVatRate) context.addIssue({ code: "custom", path: ["defaultVatRate"], message: "required" });
    if (value.expiresOn && value.expiresOn < value.effectiveFrom) context.addIssue({ code: "custom", path: ["expiresOn"], message: "invalidValue" });
    value.series.forEach((item, index) => {
      if (item.series.slice(1, 3) !== String(item.year % 100).padStart(2, "0")) context.addIssue({ code: "custom", path: ["series", index, "series"], message: "einvoiceSeriesYear" });
      if (value.series.findIndex((other) => other.year === item.year) !== index) context.addIssue({ code: "custom", path: ["series", index, "year"], message: "invalidValue" });
    });
  });
export type EinvoiceMandateRequest = z.input<typeof einvoiceMandateSchema>;

export interface EinvoiceBacklogItem {
  transactionId: string;
  documentNo: string;
  transactionDate: string;
  amount: string;
  reason: EinvoiceBacklogReason;
  createdAt: string;
}

export interface EinvoiceMandateResponse {
  merchantId: string;
  // null: chưa khai dữ liệu ủy nhiệm.
  mandate: {
    sellerName: string;
    taxCode: string;
    address: string;
    taxMethod: EinvoiceMandateTaxMethod;
    defaultVatRate: string | null;
    mandateNo: string;
    effectiveFrom: string;
    expiresOn: string | null;
    file: { name: string; size: number } | null;
  } | null;
  series: { year: number; series: string }[];
  // Nhà cung cấp hóa đơn của công ty vận hành sàn: MISA chưa hỗ trợ lập theo ủy nhiệm (hóa đơn ở "Lỗi cài đặt").
  provider: string | null;
  providerSupportsMandate: boolean;
  einvoiceEnabled: boolean;
  backlog: EinvoiceBacklogItem[];
  canManage: boolean;
  version: number;
}

// ---------------------------------------------------------------------------
// Open API đơn chờ thanh toán (lát L7; QUYTAC_NGHIEPVU_590; API_330) và webhook (QUYTAC_NGHIEPVU_591; API_331).
// ---------------------------------------------------------------------------

export const partnerCheckoutCodePattern = /^[A-Za-z0-9._-]{1,64}$/;
const lineVatRates = ["0", "5", "8", "10", "exempt", "not_declared"] as const;
const lineMoney = z
  .string()
  .trim()
  .regex(/^[0-9]{1,13}(\.[0-9]{1,4})?$/, "invalidValue");
export const openInstoreCheckoutLineSchema = z
  .object({
    name: z.string().trim().min(1).max(300),
    unit: z.string().trim().min(1).max(50).nullable().default(null),
    quantity: lineMoney.refine((value) => Number(value) > 0, "invalidValue"),
    unitPrice: lineMoney,
    amount: lineMoney,
    gift: z.boolean().default(false),
    vatRate: z.enum(lineVatRates).nullable().default(null),
  })
  .strict();
export const openInstoreCheckoutCreateSchema = z
  .object({
    partnerCheckoutCode: z.string().trim().regex(partnerCheckoutCodePattern, "invalidValue"),
    outletId: z.uuid(),
    billAmount: moneyText.refine((value) => Number(value) > 0, "invalidValue"),
    lines: z.array(openInstoreCheckoutLineSchema).max(200).default([]),
    // Trống: theo cài đặt thu hộ của cửa hàng.
    collectInApp: z.boolean().optional(),
    payCode: z.string().trim().max(40).optional(),
  })
  .strict();
export type OpenInstoreCheckoutCreateRequest = z.input<typeof openInstoreCheckoutCreateSchema>;
export const openInstorePayCodeSchema = z.object({ payCode: z.string().trim().min(1).max(40) }).strict();
export const openInstoreReasonSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const openInstoreListQuerySchema = z
  .object({
    status: z.enum(instoreCheckoutStatuses).optional(),
    outletId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export interface OpenInstoreCheckout {
  checkoutNo: string;
  partnerCheckoutCode: string | null;
  status: InstoreCheckoutStatus;
  outletId: string;
  billAmount: string;
  lines: InstoreCheckoutLine[];
  collectInApp: boolean;
  // Đường dẫn QR khách quét (luồng 2), chỉ trả lúc tạo.
  qrUrl: string | null;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  transactionNo: string | null;
  points: number;
  pointsAmount: string;
  voucherAmount: string;
  collectedAmount: string;
  platformFee: string;
  platformFeeTax: string;
  gatewayFee: string;
  cancelReason: string | null;
  refund: { status: "none" | "pending" | "completed"; amount: string | null; refundedOn: string | null };
  einvoice: { status: string; series: string | null; invoiceNo: string | null; invoiceDate: string } | null;
}

export const affiliateWebhookSchema = z
  .object({
    url: z
      .string()
      .trim()
      .max(500)
      .regex(/^https:\/\/[^\s/$.?#][^\s]*$/, "webhookUrlHttps")
      .nullable(),
    version: z.number().int().min(0),
  })
  .strict();
export type AffiliateWebhookRequest = z.input<typeof affiliateWebhookSchema>;
export const webhookEventTypes = [
  "checkout.completed",
  "checkout.expired",
  "checkout.cancelled",
  "checkout.declined",
  "transaction.cancelled",
  "refund.completed",
  "webhook.test",
] as const;
export type WebhookEventType = (typeof webhookEventTypes)[number];
export interface AffiliateWebhookDelivery {
  id: string;
  eventId: string;
  eventType: WebhookEventType;
  status: "pending" | "succeeded" | "failed";
  attemptCount: number;
  nextAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}
export interface AffiliateWebhookSecret {
  // Khóa ký chỉ hiện một lần.
  secret: string;
  secretAt: string;
}
