// CONG_VIEC_72 (THAY_DOI_37): ưu tiên Smart OTP thay SMS – tham số chuyển đổi, thống kê (API_323; QUYTAC_NGHIEPVU_561, 572).
import { z } from "zod";

export const otpStatisticPurposes = ["register", "smart_otp", "login", "password_reset", "affiliate_redeem"] as const;
export type OtpStatisticPurpose = (typeof otpStatisticPurposes)[number];

export interface AuthenticationSettingsResponse {
  transitionStartsOn: string;
  buyerTransitionDays: number;
  portalTransitionDays: number;
  // Ngày cuối = ngày bắt đầu + số ngày − 1, hết 23:59:59 giờ Việt Nam.
  buyerTransitionEndsOn: string;
  portalTransitionEndsOn: string;
  recoveryRedeemLockHours: number;
  supportHotline: string | null;
  version: number;
  canManage: boolean;
  statistics: {
    activeBuyers: number;
    smartOtpActive: number;
    smartOtpOnWeb: number;
    portalMembers: number;
    portalMembersSetUp: number;
    smsLast30Days: { purpose: OtpStatisticPurpose; count: number }[];
  };
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const updateAuthenticationSettingsSchema = z.object({
  transitionStartsOn: isoDate,
  buyerTransitionDays: z.number().int().min(1).max(180),
  portalTransitionDays: z.number().int().min(1).max(180),
  recoveryRedeemLockHours: z.number().int().min(0).max(168),
  supportHotline: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s.]/g, ""))
    .pipe(z.string().regex(/^(\d{8,15})?$/))
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  version: z.number().int().min(1),
});
export type UpdateAuthenticationSettingsInput = z.input<typeof updateAuthenticationSettingsSchema>;

// API_322: khối "Bảo mật đăng nhập" của người mua trên web-crm; hủy Smart OTP (CONG_VIEC_72; QUYTAC_NGHIEPVU_567).
export interface BuyerSecurityResponse {
  smartOtp: { active: boolean; deviceName: string | null; platform: "ios" | "android" | "web" | null; activatedAt: string | null; lockedUntil: string | null; version: number | null };
  redeemLockedUntil: string | null;
  recoveredAt: string | null;
  trustedDevices: number;
  lastSeenAt: string | null;
  buyerTransitionEndsOn: string;
  canRevoke: boolean;
}

export const revokeBuyerSmartOtpSchema = z
  .object({
    reason: z.string().trim().min(10).max(500),
    version: z.number().int().min(0),
  })
  .strict();

// API_326: chính sách xác thực công khai cho ứng dụng VComm (CONG_VIEC_72): ẩn đăng nhập bằng mã SMS sau thời hạn chuyển đổi.
export interface BuyerAuthenticationPolicy {
  transitionEndsOn: string;
  smsFallbackOpen: boolean;
}
