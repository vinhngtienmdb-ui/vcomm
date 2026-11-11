// CONG_VIEC_55: cửa hàng liên kết (MODULE_12). Tệp riêng để không sửa cùng chỗ với công việc khác.
// Tiền, phần trăm là chuỗi số thập phân; điểm là số nguyên.
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Số điện thoại Việt Nam dạng E.164 (cùng quy tắc `normalizePhone` của index.ts; không nhập từ index để tránh vòng phụ thuộc).
const vietnamPhone = z
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
