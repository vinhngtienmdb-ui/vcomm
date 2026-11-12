// Ký số tài liệu (CONG_VIEC_59, MODULE_13): hợp đồng dữ liệu API_241 đến API_245.
import { z } from "zod";
import type { OfficePerson } from "./office";

// Ngày dạng YYYY-MM-DD có thật trên lịch (2026-02-30 bị từ chối ở đây, không để cơ sở dữ liệu báo lỗi).
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const version = z.number().int().min(1);
// Mã định danh tại nhà cung cấp ký số: chữ, số, gạch ngang, gạch dưới.
export const signingIdentityCodePattern = /^[0-9A-Za-z_-]{6,40}$/;
const identityCode = z.string().trim().regex(signingIdentityCodePattern);

export const signatureCorners = ["bottom_right", "bottom_left", "top_right", "top_left"] as const;
export type SignatureCorner = (typeof signatureCorners)[number];
// Trang đặt ô chữ ký: trang đầu, trang cuối hoặc số trang.
export const signaturePageSchema = z.string().regex(/^(first|last|[1-9][0-9]{0,3})$/);
export const signingRequestMaximumSigners = 10;
export const signingRequestMaximumDays = 60;
export const signingRequestDefaultDays = 14;
export const signingProviders = ["simulator"] as const;
export type SigningProvider = (typeof signingProviders)[number];

const placement = { signOrder: z.number().int().min(1).max(10), page: signaturePageSchema, corner: z.enum(signatureCorners) };

// Người ký (QUYTAC_NGHIEPVU_458): người dùng trong tập đoàn, chữ ký số công ty, đối tác bên ngoài.
export const signingSignerInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.uuid(), ...placement }).strict(),
  z.object({ kind: z.literal("company"), ...placement }).strict(),
  z
    .object({
      kind: z.literal("partner"),
      partnerId: z.uuid().nullish(),
      partnerKind: z.enum(["organization", "individual"]),
      name: z.string().trim().min(1).max(200),
      email: z.email().max(200),
      // Mã số thuế (tổ chức, 10 hoặc 13 chữ số) hoặc số định danh cá nhân (12 chữ số).
      identity: z
        .string()
        .trim()
        .regex(/^(\d{10}(-?\d{3})?|\d{12})$/),
      identityCode,
      ...placement,
    })
    .strict()
    .refine((value) => (value.partnerKind === "individual" ? /^\d{12}$/.test(value.identity) : /^\d{10}(-?\d{3})?$/.test(value.identity)), {
      path: ["identity"],
      message: "signingPartnerIdentityInvalid",
    }),
]);
export type SigningSignerInput = z.infer<typeof signingSignerInputSchema>;

export const saveSigningRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    note: z.string().trim().max(2000).nullish(),
    dueOn: isoDate,
    signers: z.array(signingSignerInputSchema).min(1).max(signingRequestMaximumSigners),
    version: version.optional(),
  })
  .strict();
export type SaveSigningRequestInput = z.infer<typeof saveSigningRequestSchema>;

export const signingRequestTabs = ["to_sign", "sent", "signed"] as const;
export type SigningRequestTab = (typeof signingRequestTabs)[number];
export const signingRequestStatuses = ["draft", "signing", "completed", "rejected", "cancelled", "expired"] as const;
export type SigningRequestStatus = (typeof signingRequestStatuses)[number];
export type SigningSignerStatus = "waiting" | "current" | "signed" | "rejected";
export type SigningAttemptStatus = "pending" | "signed" | "rejected" | "failed" | "timeout";

export const signingRequestListQuerySchema = z
  .object({
    tab: z.enum(signingRequestTabs).default("to_sign"),
    status: z.enum(signingRequestStatuses).optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
  })
  .strict();

export interface SigningRequestListItem {
  id: string;
  requestNo: string;
  title: string;
  sourceType: SigningSourceType;
  sourceId: string | null;
  status: SigningRequestStatus;
  dueOn: string;
  createdBy: OfficePerson;
  currentSigners: string[];
  // Thẻ Chờ tôi ký: bước chữ ký công ty mà người xem được đóng.
  companySealTurn: boolean;
  signedAt: string | null;
}

export interface SigningSignerItem {
  id: string;
  position: number;
  signOrder: number;
  kind: "user" | "company" | "partner";
  user: OfficePerson | null;
  partner: { name: string; email: string; identity: string; identityCode: string; kind: "organization" | "individual"; partnerId: string | null } | null;
  page: string;
  corner: SignatureCorner;
  status: SigningSignerStatus;
  signedAt: string | null;
  signedBy: OfficePerson | null;
  signerSubject: string | null;
  rejectReason: string | null;
  linkSentAt: string | null;
  // Lần ký gần nhất của người ký: đang chờ xác nhận trên ứng dụng, thất bại kèm lý do.
  lastAttempt: { status: SigningAttemptStatus; message: string | null; startedAt: string; expiresAt: string } | null;
}

export interface SigningEventItem {
  id: string;
  actor: OfficePerson | null;
  actorLabel: string | null;
  kind: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface SigningRequestResponse extends SigningRequestListItem {
  note: string | null;
  companyId: string;
  companyName: string;
  originalFile: { fileName: string; sizeBytes: number } | null;
  currentFile: { fileName: string; sizeBytes: number; signatureCount: number } | null;
  signers: SigningSignerItem[];
  events: SigningEventItem[];
  endReason: string | null;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
  copiedFromId: string | null;
  version: number;
  allowed: ("edit" | "send" | "sign" | "reject" | "remind" | "resend" | "cancel" | "copy")[];
  // Người ký đang đến lượt mà người xem ký được (người dùng hoặc bước chữ ký công ty).
  mySignerId: string | null;
}

export const signingReasonSchema = z.object({ reason: z.string().trim().min(1).max(1000), version }).strict();
export const signingVersionSchema = z.object({ version }).strict();
export const signingSignActionSchema = z.object({ signerId: z.uuid(), version }).strict();
export const signingResendSchema = z.object({ signerId: z.uuid(), version }).strict();

// API_241: nhà cung cấp, chữ ký số công ty (QUYTAC_NGHIEPVU_454, 456).
export const signingSettingsSchema = z
  .object({
    provider: z.enum(signingProviders),
    environment: z.enum(["test", "production"]),
    // Thông tin kết nối: để trống thì giữ thông tin đã lưu.
    credentials: z.record(z.string().max(100), z.string().max(2000)).nullish(),
    version: version.optional(),
  })
  .strict();
export type SigningSettingsInput = z.infer<typeof signingSettingsSchema>;

export interface SigningCertificateOption {
  serialNumber: string;
  subjectName: string;
  identities: string[];
  issuerName: string | null;
  validFrom: string;
  validTo: string;
  usable: boolean;
}

export interface SigningSeal {
  identityCode: string;
  subjectName: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
}

export interface SigningSettingsResponse {
  configured: boolean;
  provider: SigningProvider | null;
  environment: "test" | "production" | null;
  hasCredentials: boolean;
  seal: SigningSeal | null;
  companyTaxCode: string | null;
  simulatorAllowed: boolean;
  version: number | null;
  canManage: boolean;
  canManageRoots: boolean;
}

export const signingCertificateQuerySchema = z.object({ identityCode }).strict();
export const selectSigningCertificateSchema = z.object({ identityCode, serialNumber: z.string().trim().min(1).max(100) }).strict();

export interface MySigningIdentity {
  configured: boolean;
  provider: SigningProvider | null;
  identity: (SigningSeal & { identities: string[]; usable: boolean }) | null;
}

export interface TrustedRootItem {
  id: string;
  subjectName: string;
  fingerprint: string;
  validFrom: string;
  validTo: string;
  status: "active" | "inactive";
  createdAt: string;
}
export const trustedRootStatusSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();

// API_245 (QUYTAC_NGHIEPVU_461).
export interface SignatureCheckItem {
  index: number;
  signerName: string | null;
  signerIdentities: string[];
  issuerName: string | null;
  signingTime: string | null;
  integrity: boolean;
  validAtSigningTime: boolean;
  trusted: boolean;
  coversWholeFile: boolean;
  conclusion: "valid" | "untrusted" | "invalid" | "unsupported";
}
export interface SignatureVerificationResponse {
  fileName: string;
  signatures: SignatureCheckItem[];
  revocationChecked: false;
}

// API_244: trang ký của đối tác (QUYTAC_NGHIEPVU_460).
export interface PublicSigningView {
  companyName: string;
  title: string;
  note: string | null;
  dueOn: string;
  partnerName: string;
  partnerIdentity: string;
  identityCode: string;
  state: "ready" | "awaiting_confirmation" | "signed" | "rejected";
  attemptExpiresAt: string | null;
  lastFailure: string | null;
}
export const publicSigningRejectSchema = z.object({ reason: z.string().trim().min(1).max(1000) }).strict();

// ---------- CONG_VIEC_59 lát L3 (CHUC_NANG_213; API_248): ký số công văn đi, hợp đồng lao động ----------

export const signingSourceTypes = ["document", "contract", "contract_appendix", "outgoing", "hr_contract", "hr_contract_appendix"] as const;
export type SigningSourceType = (typeof signingSourceTypes)[number];

// Công văn đi: văn thư lập phiên ký từ bản đã cấp số (công văn soạn bằng tệp thì tải bản PDF đã cấp số).
export const outgoingDigitalSigningSchema = z
  .object({
    dueOn: isoDate,
    note: z.string().trim().max(2000).nullish(),
    version: z.number().int().min(1),
  })
  .strict();
export type OutgoingDigitalSigningInput = z.infer<typeof outgoingDigitalSigningSchema>;

// Hợp đồng lao động, phụ lục: người ký phía công ty, người lao động (trong hệ thống hoặc qua đường dẫn).
export const hrDigitalSigningSchema = z
  .object({
    companySignerUserId: z.uuid(),
    dueOn: isoDate,
    note: z.string().trim().max(2000).nullish(),
    employeeEmail: z.email().max(254).nullish(),
  })
  .strict();
export type HrDigitalSigningInput = z.infer<typeof hrDigitalSigningSchema>;

export interface DigitalSigningProgress {
  id: string;
  requestNo: string;
  status: SigningRequestStatus;
  endReason: string | null;
}

export interface HrDigitalSigningInfo {
  // Người lao động ký trong hệ thống khi có tài khoản và tài khoản ký số còn hiệu lực, ngược lại ký qua đường dẫn gửi thư điện tử.
  employeeSignsAs: "user" | "partner";
  employeeName: string;
  employeeEmail: string | null;
  identityLast4: string | null;
  signing: DigitalSigningProgress | null;
  canStart: boolean;
}
