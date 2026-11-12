// CONG_VIEC_55: cửa hàng liên kết (MODULE_12). Tệp riêng để không sửa cùng chỗ với công việc khác.
// Tiền, phần trăm là chuỗi số thập phân; điểm là số nguyên.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Số điện thoại Việt Nam dạng E.164 (cùng quy tắc `normalizePhone` của index.ts; không nhập từ index để tránh vòng phụ thuộc).
export const vietnamPhone = z
  .string()
  .trim()
  .transform((value) => {
    const digits = value.replace(/[\s.()-]/g, "");
    if (/^0\d{9}$/.test(digits)) return `+84${digits.slice(1)}`;
    if (/^84\d{9}$/.test(digits)) return `+${digits}`;
    return digits;
  })
  .pipe(z.string().regex(/^\+84\d{9}$/, "invalidPhone"));
const decimal = (maximumIntegerDigits: number) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim().replace(",", "."))
    .pipe(z.string().regex(new RegExp(`^\\d{1,${maximumIntegerDigits}}(\\.\\d{1,4})?$`), "invalidValue"));
const percent = (minimum: number, maximum: number) => decimal(2).refine((value) => Number(value) >= minimum && Number(value) <= maximum, "invalidValue");
const money = decimal(14).refine((value) => Number(value) > 0, "invalidValue");
// Phí mỗi tin OTP SMS (đồng, 0 đến 10.000; THAY_DOI_31).
const smsFee = decimal(5).refine((value) => Number(value) <= 10000, "invalidValue");
const reason = z.string().trim().min(1).max(500);
const fullName = z.string().trim().min(1).max(100);

export const affiliateMerchantStatuses = ["draft", "active", "suspended", "terminated"] as const;
export type AffiliateMerchantStatus = (typeof affiliateMerchantStatuses)[number];
export type AffiliateMemberRole = "owner" | "cashier";
export type AffiliateMemberStatus = "invited" | "active" | "locked";

// QUYTAC_NGHIEPVU_392: hợp đồng cửa hàng liên kết.
const merchantTerms = {
  contractNo: z.string().trim().min(1).max(50),
  startsOn: isoDate,
  endsOn: isoDate.nullable(),
  earnPercent: percent(0.1, 20),
  feePercent: percent(0, 20),
  creditLimit: money,
  transactionCap: money,
  paymentTermDays: z.number().int().min(1).max(30),
  autoConfirmDays: z.number().int().min(1).max(7),
  smsFee: smsFee.default("0"),
};
const endsAfterStart = (value: { startsOn: string; endsOn: string | null }) => value.endsOn === null || value.endsOn >= value.startsOn;
export const affiliateMerchantCreateSchema = z
  .object({ partnerId: z.string().uuid(), ...merchantTerms })
  .strict()
  .refine(endsAfterStart, { message: "invalidValue", path: ["endsOn"] });
export const affiliateMerchantUpdateSchema = z
  .object({ ...merchantTerms, version: z.number().int().min(1) })
  .strict()
  .refine(endsAfterStart, { message: "invalidValue", path: ["endsOn"] });
export const affiliateMerchantStatusSchema = z.object({ reason: reason.nullable().optional(), version: z.number().int().min(1) }).strict();
export const affiliateMerchantListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(affiliateMerchantStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const affiliateOutletSchema = z.object({ name: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(300) }).strict();
export const affiliateOutletUpdateSchema = z.object({ name: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(300), status: z.enum(["active", "inactive"]) }).strict();
export const affiliateOwnerInviteSchema = z.object({ fullName, phone: vietnamPhone }).strict();
// Chủ cửa hàng mời thu ngân và gán điểm bán (QUYTAC_NGHIEPVU_393).
export const affiliateCashierInviteSchema = z.object({ fullName, phone: vietnamPhone, outletIds: z.array(z.string().uuid()).min(1).max(50) }).strict();
export const affiliateMemberOutletsSchema = z.object({ outletIds: z.array(z.string().uuid()).min(1).max(50), version: z.number().int().min(1) }).strict();
export const affiliateMemberVersionSchema = z.object({ version: z.number().int().min(1) }).strict();
// Kích hoạt lời mời trên cổng cửa hàng bằng số điện thoại và mã OTP (hệ thống chỉ gửi được tin theo mẫu mã OTP đã đăng ký).
export const affiliateActivationOtpSchema = z.object({ phone: vietnamPhone }).strict();
export const affiliateActivationSchema = z
  .object({
    phone: vietnamPhone,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
  })
  .strict();

export interface AffiliateOutlet {
  id: string;
  name: string;
  address: string;
  status: "active" | "inactive";
}
export interface AffiliateMember {
  id: string;
  fullName: string;
  phone: string;
  role: AffiliateMemberRole;
  status: AffiliateMemberStatus;
  outletIds: string[];
  invitationExpiresAt: string | null;
  version: number;
}
export interface AffiliateMerchantTerms {
  contractNo: string;
  startsOn: string;
  endsOn: string | null;
  earnPercent: string;
  feePercent: string;
  creditLimit: string;
  transactionCap: string;
  paymentTermDays: number;
  autoConfirmDays: number;
  smsFee: string;
}
export interface AffiliateMerchantListItem {
  id: string;
  code: string;
  partnerId: string;
  partnerCode: string;
  name: string;
  taxCode: string | null;
  earnPercent: string;
  creditLimit: string;
  outletCount: number;
  status: AffiliateMerchantStatus;
}
export interface AffiliateMerchantDetail extends AffiliateMerchantTerms {
  id: string;
  code: string;
  partnerId: string;
  partnerCode: string;
  name: string;
  taxCode: string | null;
  status: AffiliateMerchantStatus;
  statusReason: string | null;
  outlets: AffiliateOutlet[];
  members: AffiliateMember[];
  canManage: boolean;
  version: number;
}
// API_207: cổng cửa hàng – thông tin của người đang đăng nhập.
export interface MerchantPortalMe {
  userId: string;
  fullName: string;
  memberships: {
    memberId: string;
    merchantId: string;
    merchantCode: string;
    merchantName: string;
    merchantStatus: AffiliateMerchantStatus;
    role: AffiliateMemberRole;
    outlets: AffiliateOutlet[];
  }[];
}
export interface MerchantPortalStore extends AffiliateMerchantTerms {
  merchantId: string;
  code: string;
  name: string;
  status: AffiliateMerchantStatus;
  outlets: AffiliateOutlet[];
  members: AffiliateMember[];
}

// ---------------------------------------------------------------------------
// Lát L1: giao dịch tại quầy (QUYTAC_NGHIEPVU_394 đến 400; API_208, API_209).
// ---------------------------------------------------------------------------
export const affiliateTransactionMethods = ["merchant_qr", "buyer_qr", "phone"] as const;
// Cách `otp` chỉ có qua Open API (CONG_VIEC_67).
export const affiliateAllTransactionMethods = [...affiliateTransactionMethods, "otp"] as const;
export type AffiliateTransactionMethod = (typeof affiliateAllTransactionMethods)[number];
export type AffiliateTransactionSource = "portal" | "open_api";
export type AffiliateTransactionStatus = "pending" | "completed" | "declined" | "expired" | "cancelled";
export type AffiliateSkipReason = "test_buyer" | "locked" | "inactive" | "no_phase" | "zero" | "credit_limit" | "overdue";

export const affiliateTransactionCreateSchema = z
  .object({
    outletId: z.string().uuid(),
    billAmount: money,
    method: z.enum(affiliateTransactionMethods),
    phone: vietnamPhone.optional(),
    memberCode: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => value.method !== "phone" || value.phone, { message: "required", path: ["phone"] })
  .refine((value) => value.method !== "buyer_qr" || value.memberCode, { message: "required", path: ["memberCode"] });
export const affiliateTransactionCancelSchema = z.object({ reason }).strict();
export const affiliateTransactionListQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  outletId: z.string().uuid().optional(),
  status: z.enum(["pending", "completed", "declined", "expired", "cancelled"]).optional(),
  search: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export interface AffiliateTransactionItem {
  id: string;
  documentNo: string;
  method: AffiliateTransactionMethod;
  status: AffiliateTransactionStatus;
  outletId: string;
  outletName: string;
  // Giao dịch qua Open API (CONG_VIEC_67) không có thu ngân: trống.
  cashierName: string | null;
  source: AffiliateTransactionSource;
  // Mã giao dịch của phần mềm cửa hàng (chỉ giao dịch qua Open API).
  partnerTransactionCode: string | null;
  // Tên khách đã che (QUYTAC_NGHIEPVU_397); trống khi chưa có khách.
  buyerName: string | null;
  billAmount: string;
  voucherDiscount: string;
  redeemedPoints: number;
  redeemedAmount: string;
  paidAmount: string | null;
  earnedPoints: number;
  earnedAmount: string;
  skipReason: AffiliateSkipReason | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  cancelReason: string | null;
  canCancel: boolean;
}
export interface AffiliateTransactionCreated {
  transaction: AffiliateTransactionItem;
  // Cách 1: chuỗi mã QR hiện trên màn hình quầy (chỉ trả một lần).
  qrCode: string | null;
}

// Người mua trên ứng dụng VComm.
export const buyerAffiliateScanSchema = z.object({ code: z.string().trim().min(1).max(500) }).strict();
export const buyerAffiliateConfirmSchema = z
  .object({ points: z.number().int().min(0).max(1_000_000_000), code: z.string().trim().max(500).optional(), voucherCodeId: z.string().uuid().nullable().optional() })
  .strict();
export const buyerAffiliateDeclineSchema = z.object({ code: z.string().trim().max(500).optional() }).strict();
export const buyerMemberCodeSchema = z.object({ points: z.number().int().min(0).max(1_000_000_000), voucherCodeId: z.string().uuid().nullable().optional() }).strict();

export interface BuyerAffiliateRequest {
  transactionId: string;
  documentNo: string;
  merchantName: string;
  outletName: string;
  billAmount: string;
  expiresAt: string;
  balance: number;
  minPoints: number;
  maxPoints: number;
  pointValue: string | null;
  redeemable: boolean;
  blockedReason: "no_phase" | "locked" | "inactive" | "insufficient" | null;
  earnPercent: string;
  // Voucher của khách dùng được cho giao dịch này, kèm tiền giảm tính theo tiền hóa đơn (lát L2).
  vouchers: (BuyerVoucherCode & { discount: string })[];
}
export interface BuyerAffiliateTransaction {
  id: string;
  documentNo: string;
  merchantName: string;
  outletName: string;
  status: AffiliateTransactionStatus;
  billAmount: string;
  voucherDiscount: string;
  redeemedPoints: number;
  redeemedAmount: string;
  paidAmount: string | null;
  earnedPoints: number;
  skipReason: AffiliateSkipReason | null;
  createdAt: string;
}
export interface BuyerMemberCode {
  code: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Lát L2: voucher liên kết (QUYTAC_NGHIEPVU_401, 402; API_210, API_211).
// ---------------------------------------------------------------------------
export type AffiliateVoucherIssuer = "merchant_points" | "merchant_free" | "company";
export type AffiliateVoucherStatus = "draft" | "pending" | "approved" | "paused" | "rejected" | "withdrawn";
// Trạng thái hiển thị: đã duyệt chia theo thời gian nhận.
export type AffiliateVoucherDisplayStatus = "draft" | "pending" | "scheduled" | "active" | "paused" | "ended" | "rejected" | "withdrawn";

const count = (minimum: number, maximum: number) => z.number().int().min(minimum).max(maximum);
const voucherFields = {
  titleVi: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().min(1).max(120),
  discountKind: z.enum(["amount", "percent"]),
  discountValue: money,
  maxDiscount: money.nullable().optional(),
  minBill: decimal(14),
  totalQuantity: count(1, 1_000_000),
  perBuyerLimit: count(1, 100),
  claimFrom: isoDate,
  claimTo: isoDate,
  validDays: count(1, 90),
};
type VoucherShape = { discountKind: "amount" | "percent"; discountValue: string; maxDiscount?: string | null | undefined; claimFrom: string; claimTo: string };
const voucherRules = <T extends z.ZodType<VoucherShape>>(schema: T) =>
  schema
    .refine((value) => value.claimTo >= value.claimFrom, { message: "invalidValue", path: ["claimTo"] })
    .refine((value) => value.discountKind === "amount" || Number(value.discountValue) <= 100, { message: "invalidValue", path: ["discountValue"] })
    .refine((value) => value.discountKind === "amount" || Boolean(value.maxDiscount), { message: "required", path: ["maxDiscount"] });
// Chủ cửa hàng tạo voucher cửa hàng: đổi bằng điểm (có giá điểm) hoặc tặng miễn phí.
export const merchantVoucherSchema = voucherRules(
  z
    .object({ issuer: z.enum(["merchant_points", "merchant_free"]), pointsPrice: count(1, 1_000_000).nullable().optional(), ...voucherFields })
    .strict()
    .refine((value) => (value.issuer === "merchant_points") === Boolean(value.pointsPrice), { message: "required", path: ["pointsPrice"] }),
);
export const merchantVoucherUpdateSchema = voucherRules(
  z
    .object({ issuer: z.enum(["merchant_points", "merchant_free"]), pointsPrice: count(1, 1_000_000).nullable().optional(), ...voucherFields, version: count(1, 1_000_000_000) })
    .strict()
    .refine((value) => (value.issuer === "merchant_points") === Boolean(value.pointsPrice), { message: "required", path: ["pointsPrice"] }),
);
// Công ty tạo voucher dùng tại mọi cửa hàng (merchantIds rỗng) hoặc các cửa hàng được chọn.
export const companyVoucherSchema = voucherRules(z.object({ ...voucherFields, merchantIds: z.array(z.string().uuid()).max(500).default([]) }).strict());
export const companyVoucherUpdateSchema = voucherRules(z.object({ ...voucherFields, merchantIds: z.array(z.string().uuid()).max(500).default([]), version: count(1, 1_000_000_000) }).strict());
export const affiliateVoucherVersionSchema = z.object({ version: count(1, 1_000_000_000) }).strict();
// Đã duyệt: chỉ giảm tổng số lượng (không dưới số đã nhận).
export const affiliateVoucherQuantitySchema = z.object({ totalQuantity: count(1, 1_000_000), version: count(1, 1_000_000_000) }).strict();
export const affiliateVoucherListQuerySchema = z.object({
  issuer: z.enum(["merchant_points", "merchant_free", "company"]).optional(),
  merchantId: z.string().uuid().optional(),
  status: z.enum(["draft", "pending", "scheduled", "active", "paused", "ended", "rejected", "withdrawn"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface AffiliateVoucherItem {
  id: string;
  code: string;
  issuer: AffiliateVoucherIssuer;
  merchantId: string | null;
  merchantName: string | null;
  titleVi: string;
  titleEn: string;
  discountKind: "amount" | "percent";
  discountValue: string;
  maxDiscount: string;
  minBill: string;
  totalQuantity: number;
  perBuyerLimit: number;
  pointsPrice: number | null;
  claimFrom: string;
  claimTo: string;
  validDays: number;
  status: AffiliateVoucherStatus;
  displayStatus: AffiliateVoucherDisplayStatus;
  claimedCount: number;
  usedCount: number;
  merchantIds: string[];
  approvalRequestId: string | null;
  createdByName: string;
  version: number;
}

// Người mua.
export const buyerVoucherClaimSchema = z.object({}).strict();
export interface BuyerVoucherOffer {
  id: string;
  code: string;
  issuer: AffiliateVoucherIssuer;
  merchantName: string | null;
  titleVi: string;
  titleEn: string;
  discountKind: "amount" | "percent";
  discountValue: string;
  maxDiscount: string;
  minBill: string;
  pointsPrice: number | null;
  validDays: number;
  claimTo: string;
  remaining: number;
  claimedByMe: number;
  perBuyerLimit: number;
}
export interface BuyerVoucherCode {
  id: string;
  voucherId: string;
  voucherCode: string;
  issuer: AffiliateVoucherIssuer;
  merchantName: string | null;
  titleVi: string;
  titleEn: string;
  discountKind: "amount" | "percent";
  discountValue: string;
  maxDiscount: string;
  minBill: string;
  pointsPaid: number;
  claimedAt: string;
  expiresAt: string;
  status: "unused" | "used" | "expired";
}

// ---------------------------------------------------------------------------
// Lát L3: đối soát tuần (QUYTAC_NGHIEPVU_403; API_212).
// ---------------------------------------------------------------------------
export const affiliateSettlementStatuses = ["awaiting_confirmation", "confirmed", "disputed", "paid"] as const;
export type AffiliateSettlementStatus = (typeof affiliateSettlementStatuses)[number];
export const affiliateSettlementListQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  status: z.enum(affiliateSettlementStatuses).optional(),
  overdue: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const affiliateSettlementConfirmSchema = z.object({ version: z.number().int().min(1) }).strict();
export const affiliateSettlementDisputeSchema = z.object({ reason: z.string().trim().min(1).max(1000), version: z.number().int().min(1) }).strict();
// Trả lời khiếu nại và chốt lại; điều chỉnh tiền dương: tăng số cửa hàng phải trả, âm: giảm.
export const affiliateSettlementResolveSchema = z
  .object({
    note: z.string().trim().min(1).max(1000),
    adjustmentAmount: z
      .union([z.string(), z.number()])
      .transform((value) => String(value).trim().replace(",", "."))
      .pipe(z.string().regex(/^-?\d{1,14}(\.\d{1,4})?$/, "invalidValue")),
    adjustmentReason: z.string().trim().min(1).max(500).nullable().optional(),
    version: z.number().int().min(1),
  })
  .strict()
  .refine((value) => Number(value.adjustmentAmount) === 0 || Boolean(value.adjustmentReason), { message: "required", path: ["adjustmentReason"] });

export interface AffiliateSettlementItem {
  id: string;
  documentNo: string;
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  weekStart: string;
  weekEnd: string;
  transactionCount: number;
  earnedAmount: string;
  redeemedAmount: string;
  companyVoucherAmount: string;
  shortfallAmount: string;
  feePercent: string;
  feeAmount: string;
  // Phí tin nhắn OTP SMS (F, THAY_DOI_31) và số tin.
  smsCount: number;
  smsFeeAmount: string;
  feeTaxRate: string;
  feeTaxAmount: string;
  adjustmentAmount: string;
  netAmount: string;
  status: AffiliateSettlementStatus;
  confirmDueAt: string;
  confirmedAt: string | null;
  autoConfirmed: boolean;
  dueDate: string | null;
  // Công nợ còn lại của bảng (phải thu khi số còn lại dương, phải trả khi âm); quá hạn khi còn phải thu sau hạn thanh toán.
  openAmount: string | null;
  overdue: boolean;
  version: number;
}
export interface AffiliateSettlementTransaction {
  id: string;
  documentNo: string;
  completedAt: string;
  outletName: string;
  status: AffiliateTransactionStatus;
  billAmount: string;
  voucherDiscount: string;
  voucherPayable: string;
  voucherIssuer: AffiliateVoucherIssuer | null;
  redeemedAmount: string;
  earnedAmount: string;
  shortfallAmount: string;
}
export interface AffiliateSettlementDetail extends AffiliateSettlementItem {
  disputeReason: string | null;
  disputedAt: string | null;
  disputedByName: string | null;
  resolutionNote: string | null;
  adjustmentReason: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  confirmedByName: string | null;
  paidAt: string | null;
  transactions: AffiliateSettlementTransaction[];
}

// ---------------------------------------------------------------------------
// Lát L4: báo cáo, cảnh báo (QUYTAC_NGHIEPVU_405; API_213).
// ---------------------------------------------------------------------------
export const affiliateReportQuerySchema = z
  .object({
    from: isoDate,
    to: isoDate,
    outletId: z.string().uuid().optional(),
    merchantId: z.string().uuid().optional(),
    groupBy: z.enum(["day", "week", "month"]).default("day"),
  })
  .refine((value) => value.to >= value.from, { message: "invalidValue", path: ["to"] })
  .refine((value) => Date.parse(value.to) - Date.parse(value.from) <= 366 * 86_400_000, { message: "invalidValue", path: ["from"] });

// Chỉ tiêu của giao dịch hoàn tất (giờ Việt Nam); khách mới: lần đầu giao dịch hoàn tất tại cửa hàng nằm trong kỳ.
export interface AffiliateReportMetrics {
  transactions: number;
  billAmount: string;
  customers: number;
  newCustomers: number;
  earnedPoints: number;
  earnedAmount: string;
  redeemedPoints: number;
  redeemedAmount: string;
  vouchersUsed: number;
  cancelled: number;
}
export interface AffiliateExposure {
  amount: string;
  creditLimit: string;
  remaining: string;
  percent: string;
}
export interface MerchantPortalReport {
  totals: AffiliateReportMetrics;
  rows: (AffiliateReportMetrics & { period: string })[];
  exposure: AffiliateExposure;
}
export interface AffiliateCompanyReport {
  totals: AffiliateReportMetrics & { feeAmount: string };
  rows: (AffiliateReportMetrics & { merchantId: string; merchantCode: string; merchantName: string; feeAmount: string; exposure: AffiliateExposure })[];
}

export const affiliateAlertKinds = ["same_buyer_burst", "near_cap", "cancel_rate", "phone_declines", "credit_usage"] as const;
export type AffiliateAlertKind = (typeof affiliateAlertKinds)[number];
export const affiliateAlertQuerySchema = z.object({ kind: z.enum(affiliateAlertKinds).optional(), merchantId: z.string().uuid().optional() });
// Cảnh báo tính trong 7 ngày gần nhất; chỉ cảnh báo, không tự chặn.
export interface AffiliateAlert {
  kind: AffiliateAlertKind;
  merchantId: string;
  merchantName: string;
  day: string | null;
  count: number | null;
  total: number | null;
  percent: string | null;
  buyerPhone: string | null;
  cashierName: string | null;
  amount: string | null;
  limit: string | null;
}

// Web quản trị (MAN_HINH_180 thẻ Giao dịch): giao dịch mọi cửa hàng; số điện thoại khách đã che (người dùng duyệt khi xem trước lát L4).
export const affiliateCompanyTransactionQuerySchema = z.object({
  merchantId: z.string().uuid().optional(),
  method: z.enum(affiliateAllTransactionMethods).optional(),
  status: z.enum(["pending", "completed", "declined", "expired", "cancelled"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().trim().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export interface AffiliateCompanyTransaction extends AffiliateTransactionItem {
  merchantId: string;
  merchantName: string;
  buyerPhone: string | null;
}

// ---------------------------------------------------------------------------
// CONG_VIEC_67: tích, đổi điểm qua Open API (QUYTAC_NGHIEPVU_495; API_295 đến API_300).
// ---------------------------------------------------------------------------
const ipEntry = z
  .string()
  .trim()
  .min(2)
  .max(49)
  .regex(/^[0-9A-Fa-f:.]+(\/\d{1,3})?$/);
const affiliateApiKeySettings = {
  name: z.string().trim().min(1).max(100),
  outletIds: z.array(z.string().uuid()).min(1).max(50),
  rateLimitPerMinute: z.number().int().min(1).max(600).default(60),
  smsDailyLimit: z.number().int().min(0).max(5000).default(200),
  expiresOn: isoDate.nullable().default(null),
  allowedIps: z.array(ipEntry).max(20).default([]),
};
export const affiliateApiKeyCreateSchema = z.object(affiliateApiKeySettings).strict();
export type AffiliateApiKeyCreateRequest = z.input<typeof affiliateApiKeyCreateSchema>;
export const affiliateApiKeyUpdateSchema = z.object({ ...affiliateApiKeySettings, version: z.number().int().positive() }).strict();
export type AffiliateApiKeyUpdateRequest = z.input<typeof affiliateApiKeyUpdateSchema>;

export interface AffiliateApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  outlets: { id: string; name: string }[];
  rateLimitPerMinute: number;
  smsDailyLimit: number;
  expiresOn: string | null;
  allowedIps: string[];
  status: "active" | "expired" | "revoked";
  revokedReason: string | null;
  lastUsedAt: string | null;
  callsToday: number;
  smsToday: number;
  createdAt: string;
  version: number;
}
export interface AffiliateApiKeySecret {
  key: AffiliateApiKeyItem;
  secret: string;
}
// Cổng cửa hàng, chủ cửa hàng (MAN_HINH_232): chỉ xem.
export interface AffiliatePortalConnection {
  keys: AffiliateApiKeyItem[];
  callsToday: number;
  callsWeek: number;
  transactionsToday: number;
  transactionsWeek: number;
  smsToday: number;
  smsWeek: number;
  smsFeeWeek: string;
  weekStart: string;
}

// Phần mềm cửa hàng (khóa API, gốc /api/v1/open/affiliate).
export const openAffiliateMethods = ["member_code", "phone", "otp"] as const;
export type OpenAffiliateMethod = (typeof openAffiliateMethods)[number];
export const openTransactionCodePattern = /^[A-Za-z0-9._-]{1,50}$/;
export const openAffiliateQuoteSchema = z
  .object({
    outletId: z.string().uuid(),
    billAmount: money,
    memberCode: z.string().trim().min(1).max(500).optional(),
    phone: vietnamPhone.optional(),
  })
  .strict()
  .refine((value) => Boolean(value.memberCode) !== Boolean(value.phone), { message: "required", path: ["memberCode"] });
export interface OpenAffiliateQuote {
  buyerName: string | null;
  redeemable: boolean;
  blockedReason: "no_phase" | "locked" | "inactive" | "insufficient" | null;
  minPoints: number;
  maxPoints: number;
  pointValue: string | null;
  estimatedEarnPoints: number;
  vouchers: { id: string; title: string; discount: string; expiresAt: string }[];
  smartOtpActive: boolean;
}
export const openAffiliateTransactionSchema = z
  .object({
    partnerTransactionCode: z.string().regex(openTransactionCodePattern),
    outletId: z.string().uuid(),
    billAmount: money,
    method: z.enum(openAffiliateMethods),
    memberCode: z.string().trim().min(1).max(500).optional(),
    phone: vietnamPhone.optional(),
    // Cách `otp`: mã Smart OTP hoặc mã SMS khách đọc, số điểm muốn dùng, voucher lấy từ kết quả tra điểm.
    otp: z
      .string()
      .regex(/^\d{6}$/, "invalidValue")
      .optional(),
    points: z.number().int().min(0).max(1_000_000_000).default(0),
    voucherCodeId: z.string().uuid().nullable().default(null),
  })
  .strict()
  .refine((value) => value.method === "member_code" || value.phone, { message: "required", path: ["phone"] })
  .refine((value) => value.method !== "otp" || value.otp, { message: "required", path: ["otp"] })
  .refine((value) => value.method !== "member_code" || value.memberCode, { message: "required", path: ["memberCode"] });
export const openAffiliateListQuerySchema = z
  .object({
    status: z.enum(["pending", "completed", "declined", "expired", "cancelled"]).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export const openAffiliateOtpSchema = z.object({ outletId: z.string().uuid(), phone: vietnamPhone }).strict();
export const openAffiliateCancelSchema = z.object({ reason }).strict();
export interface OpenAffiliateOutlet {
  id: string;
  name: string;
  address: string;
  active: boolean;
}
export interface OpenAffiliateTransaction {
  partnerTransactionCode: string | null;
  documentNo: string;
  method: AffiliateTransactionMethod;
  source: AffiliateTransactionSource;
  status: AffiliateTransactionStatus;
  outletId: string;
  outletName: string;
  buyerName: string | null;
  billAmount: string;
  voucherDiscount: string;
  redeemedPoints: number;
  redeemedAmount: string;
  paidAmount: string | null;
  earnedPoints: number;
  skipReason: AffiliateSkipReason | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  cancelReason: string | null;
}
