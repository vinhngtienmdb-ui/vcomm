// Hợp đồng dùng chung giữa backend và giao diện (tài liệu 17).
import { z } from "zod";

export const errorCodes = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "MFA_REQUIRED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT_VERSION",
  "BUSINESS_RULE",
  "ACCOUNT_LOCKED",
  "RATE_LIMITED",
  "INTERNAL",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
    requestId?: string;
    retryAfterSeconds?: number;
  };
}

// API_01
export const loginRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(256),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface LoginResponse {
  // Phiên cần nhập mã xác thực hai lớp trước khi dùng; mfaEnrolled = false thì phải đăng ký ngay (luồng 2 tài liệu 09).
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  user: { id: string; fullName: string; locale: "vi" | "en" };
}
// API_112: đăng nhập, làm mới phiên của ứng dụng di động; token trong thân phản hồi, gửi lại qua header Authorization (CONG_VIEC_22).
export interface AppTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}
export type AppLoginResponse = LoginResponse & { tokens: AppTokens };
export const appRefreshSchema = z.object({ refreshToken: z.string().min(16).max(200) }).strict();

// API_14
export interface MeResponse {
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    username: string | null;
    locale: "vi" | "en";
    mfaRequired: boolean;
    mfaEnabled: boolean;
    version: number;
  };
  companies: { id: string; code: string; shortName: string; isDefault: boolean }[];
  currentCompanyId: string | null;
  permissions: string[];
}

// API_19
export interface HomeResponse {
  apps: { code: string; nameVi: string; nameEn: string; url: string; icon: string; pendingCount: number }[];
  pendingApprovals: { id: string; documentNo: string; documentTypeCode: string; amount: string; currency: string; requestedAt: string }[];
}

// Danh sách có phân trang (tài liệu 17 mục 1).
export interface PageResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// API_35
export interface PermissionGroupResponse {
  appCode: string;
  appNameVi: string;
  appNameEn: string;
  permissions: { code: string; nameVi: string; nameEn: string; isSensitive: boolean; grantableByMe: boolean }[];
}

// API_36
export type RoleKind = "system" | "shared" | "company";

export interface RoleResponse {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  description: string | null;
  kind: RoleKind;
  status: "active" | "inactive";
  version: number;
  permissionCodes: string[];
  memberCount: number;
  hasSensitive: boolean;
  editableByMe: boolean;
}

export const createRoleSchema = z
  .object({
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,49}$/),
    nameVi: z.string().trim().min(1).max(100),
    nameEn: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable().optional(),
    shared: z.boolean().optional(),
  })
  .strict();
export type CreateRoleRequest = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    nameVi: z.string().trim().min(1).max(100).optional(),
    nameEn: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    version: z.number().int().positive(),
  })
  .strict();
export type UpdateRoleRequest = z.infer<typeof updateRoleSchema>;

export const rolePermissionsSchema = z
  .object({
    permissionCodes: z.array(z.string().min(1).max(100)).max(500),
    version: z.number().int().positive(),
  })
  .strict();
export type RolePermissionsRequest = z.infer<typeof rolePermissionsSchema>;

// API_34
export const roleAssignmentSchema = z
  .object({
    roleId: z.uuid(),
    scopeType: z.enum(["group", "company", "branch"]),
    branchId: z.uuid().nullable().optional(),
    validFrom: isoDate,
    validTo: isoDate.nullable().optional(),
  })
  .strict();
export type RoleAssignmentRequest = z.infer<typeof roleAssignmentSchema>;

export interface RoleAssignmentResponse {
  id: string;
  roleId: string;
  roleCode: string;
  roleNameVi: string;
  roleNameEn: string;
  scopeType: "group" | "company" | "branch";
  companyId: string | null;
  companyShortName: string | null;
  branchId: string | null;
  branchName: string | null;
  validFrom: string;
  validTo: string | null;
  active: boolean;
}

// API_24
export const userListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    branchId: z.uuid().optional(),
    roleId: z.uuid().optional(),
    status: z.enum(["invited", "active", "locked", "disabled"]).optional(),
  })
  .strict();
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export interface UserListItem {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: "invited" | "active" | "locked" | "disabled";
  branchName: string | null;
  departmentName: string | null;
  jobTitle: string | null;
  roleNames: string[];
  lastLoginAt: string | null;
}

// API_29 (phần xem)
export interface UserDetailResponse {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  status: "invited" | "active" | "locked" | "disabled";
  mfaRequired: boolean;
  mfaEnabled: boolean;
  version: number;
  isSelf: boolean;
  currentMembership: { defaultBranchId: string | null; departmentId: string | null; jobTitle: string | null };
  companies: { id: string; shortName: string; branchName: string | null; jobTitle: string | null; isDefault: boolean }[];
  roleAssignments: RoleAssignmentResponse[];
  assignableScopes: { group: boolean; company: boolean; branches: { id: string; code: string; name: string }[] };
}

// Mã công ty, chi nhánh, phòng ban: chữ in hoa không dấu, số, gạch ngang, gạch dưới.
const organizationCode = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9_-]{1,29}$/));
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const phoneNumber = z.string().trim().regex(/^\+?[0-9][0-9 .-]{7,19}$/).nullable().optional();

export const versionSchema = z.object({ version: z.number().int().positive() }).strict();

// API_20, API_21
export const accountingRegimes = ["TT99_2025", "TT133"] as const;

const companyFields = {
  parentId: z.uuid(),
  code: organizationCode,
  legalName: z.string().trim().min(1).max(255),
  shortName: z.string().trim().min(1).max(100),
  taxCode: z.string().trim().regex(/^\d{10}(-\d{3})?$/).nullable().optional(),
  address: optionalText(500),
  phone: phoneNumber,
  email: z.email().nullable().optional(),
  baseCurrency: z.string().trim().regex(/^[A-Z]{3}$/),
  accountingRegime: z.enum(accountingRegimes),
  fiscalYearStart: z.number().int().min(1).max(12),
};

export const createCompanySchema = z
  .object({
    ...companyFields,
    baseCurrency: companyFields.baseCurrency.default("VND"),
    accountingRegime: companyFields.accountingRegime.default("TT99_2025"),
    fiscalYearStart: companyFields.fiscalYearStart.default(1),
  })
  .strict();
export type CreateCompanyRequest = z.input<typeof createCompanySchema>;

// Sửa: chỉ đổi trường được gửi lên, không tự điền giá trị mặc định.
export const updateCompanySchema = z
  .object(companyFields)
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export type UpdateCompanyRequest = z.input<typeof updateCompanySchema>;

export interface CompanyResponse {
  id: string;
  parentId: string | null;
  code: string;
  legalName: string;
  shortName: string;
  taxCode: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  baseCurrency: string;
  accountingRegime: (typeof accountingRegimes)[number];
  fiscalYearStart: number;
  status: "active" | "inactive";
  version: number;
  activeBranchCount: number;
}

// API_22
export const branchTypes = ["head_office", "office", "warehouse", "store", "other"] as const;

export const createBranchSchema = z
  .object({
    code: organizationCode,
    name: z.string().trim().min(1).max(200),
    branchType: z.enum(branchTypes),
    provinceCode: z.string().trim().regex(/^\d{2}$/).nullable().optional(),
    address: optionalText(500),
    phone: phoneNumber,
  })
  .strict();
export type CreateBranchRequest = z.input<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export type UpdateBranchRequest = z.input<typeof updateBranchSchema>;

export const branchListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    branchType: z.enum(branchTypes).optional(),
    provinceCode: z.string().regex(/^\d{2}$/).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();
export type BranchListQuery = z.infer<typeof branchListQuerySchema>;

export interface BranchResponse {
  id: string;
  companyId: string;
  code: string;
  name: string;
  branchType: (typeof branchTypes)[number];
  provinceCode: string | null;
  address: string | null;
  phone: string | null;
  status: "active" | "inactive";
  version: number;
}

// API_23
export const createDepartmentSchema = z
  .object({
    parentId: z.uuid().nullable().optional(),
    code: organizationCode,
    name: z.string().trim().min(1).max(200),
    managerUserId: z.uuid().nullable().optional(),
  })
  .strict();
export type CreateDepartmentRequest = z.input<typeof createDepartmentSchema>;

export const updateDepartmentSchema = createDepartmentSchema
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict();
export type UpdateDepartmentRequest = z.input<typeof updateDepartmentSchema>;

export interface DepartmentResponse {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  managerUserId: string | null;
  managerName: string | null;
  status: "active" | "inactive";
  version: number;
  memberCount: number;
}

// Số điện thoại lưu dạng E.164 (tài liệu 16): 0912 345 678 → +84912345678.
export function normalizePhone(value: string): string {
  const digits = value.replace(/[\s.()-]/g, "");
  if (/^0\d{9}$/.test(digits)) return `+84${digits.slice(1)}`;
  if (/^84\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

const phoneE164 = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+\d{8,15}$/));
const username = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.string().regex(/^[a-z0-9][a-z0-9._-]{2,49}$/));
const emailAddress = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.email().max(254));

// API_25
export const inviteUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    email: emailAddress.nullable().optional(),
    phone: phoneE164.nullable().optional(),
    username: username.nullable().optional(),
    defaultBranchId: z.uuid().nullable().optional(),
    departmentId: z.uuid().nullable().optional(),
    jobTitle: z.string().trim().max(100).nullable().optional(),
    roleAssignments: z.array(roleAssignmentSchema).max(20).default([]),
  })
  .strict();
export type InviteUserRequest = z.input<typeof inviteUserSchema>;

export interface InviteUserResponse {
  userId: string;
  status: UserListItem["status"];
  addedToExistingAccount: boolean;
}

// API_29 PATCH
export const updateUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    email: emailAddress.nullable().optional(),
    phone: phoneE164.nullable().optional(),
    username: username.nullable().optional(),
    defaultBranchId: z.uuid().nullable().optional(),
    departmentId: z.uuid().nullable().optional(),
    jobTitle: z.string().trim().max(100).nullable().optional(),
    version: z.number().int().positive(),
  })
  .strict();
export type UpdateUserRequest = z.input<typeof updateUserSchema>;

// API_30
export const lockUserSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

// API_11
export const activationSchema = z.object({ token: z.string().min(20).max(200), password: z.string().max(256) }).strict();

export interface ActivationInfoResponse {
  fullName: string;
  companyName: string | null;
  loginIdentifier: string;
}

// API_27
export interface UserImportResponse {
  invited: number;
  failed: number;
  errors: { row: number; message: string }[];
  errorFileUrl: string | null;
}

// Cột tệp mẫu nhập nhân viên (API_28), đúng thứ tự.
export const userImportColumns = ["Họ tên", "Email", "Số điện thoại", "Tên đăng nhập", "Mã chi nhánh", "Mã phòng ban", "Chức danh", "Mã vai trò"] as const;
export const userImportMaximumRows = 1000;
export const userImportMaximumBytes = 5 * 1024 * 1024;

// API_06
export const mfaVerifySchema = z
  .object({ code: z.string().regex(/^\d{6}$/).optional(), backupCode: z.string().trim().min(8).max(20).optional() })
  .strict()
  .refine((value) => Boolean(value.code) !== Boolean(value.backupCode));

// API_07
export interface MfaEnrollResponse {
  otpauthUrl: string;
  secretForManualEntry: string;
}

// API_08 và các thao tác cần mã hiện tại (tắt, tạo lại mã dự phòng)
export const mfaCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();

export interface MfaBackupCodesResponse {
  backupCodes: string[];
}

// API_12, API_13
export const forgotPasswordSchema = z.object({ identifier: z.string().trim().min(1).max(254) }).strict();
export const resetPasswordSchema = z.object({ token: z.string().min(20).max(200), password: z.string().max(256) }).strict();

// API_15
export const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    locale: z.enum(["vi", "en"]).optional(),
    defaultCompanyId: z.uuid().optional(),
    version: z.number().int().positive(),
  })
  .strict();

// API_16
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().max(256) }).strict();

// API_17
export interface IdentityResponse {
  id: string;
  provider: "password" | "google" | "microsoft" | "zalo" | "phone_otp";
  subject: string;
  lastUsedAt: string | null;
}

// API_18
export interface SessionResponse {
  id: string;
  clientType: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  current: boolean;
}

// Số tiền dạng chuỗi thập phân để không sai số (tài liệu 17 mục 1).
const decimalAmount = z.string().trim().regex(/^\d{1,16}(\.\d{1,4})?$/);

const roleOrUser = z.discriminatedUnion("type", [z.object({ type: z.literal("role"), roleId: z.uuid() }).strict(), z.object({ type: z.literal("user"), userId: z.uuid() }).strict()]);
const approverChoice = z.discriminatedUnion("type", [
  z.object({ type: z.literal("role"), roleId: z.uuid() }).strict(),
  z.object({ type: z.literal("user"), userId: z.uuid() }).strict(),
  z.object({ type: z.literal("department_manager") }).strict(),
]);
export type ApproverChoice = z.infer<typeof approverChoice>;

// API_37
export const createApprovalPolicySchema = z
  .object({
    documentTypeCode: z.string().min(1).max(100),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
    effectiveFrom: isoDate,
    levels: z
      .array(
        z
          .object({
            levelNo: z.number().int().min(1).max(10),
            minAmount: decimalAmount,
            approver: approverChoice,
            substitute: roleOrUser.nullable().optional(),
            dueHours: z.number().int().min(1).max(720),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
export type CreateApprovalPolicyRequest = z.input<typeof createApprovalPolicySchema>;

export interface ApproverView {
  type: "role" | "user" | "department_manager";
  roleId: string | null;
  userId: string | null;
  name: string | null;
}

export interface ApprovalPolicyResponse {
  id: string;
  documentTypeCode: string;
  documentTypeNameVi: string;
  documentTypeNameEn: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  levels: { levelNo: number; minAmount: string; approver: ApproverView; substitute: ApproverView; dueHours: number }[];
}

export interface DocumentTypeResponse {
  code: string;
  appCode: string;
  nameVi: string;
  nameEn: string;
}

// API_38
export const createApprovalRequestSchema = z
  .object({
    documentTypeCode: z.string().min(1).max(100),
    documentId: z.uuid(),
    documentNo: z.string().trim().min(1).max(100),
    amount: decimalAmount,
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
    documentDate: isoDate,
  })
  .strict();
export type CreateApprovalRequestInput = z.infer<typeof createApprovalRequestSchema>;

export type ApprovalStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface ApprovalStepResponse {
  levelNo: number;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedRoleId: string | null;
  assignedRoleName: string | null;
  isSubstitute: boolean;
  startedAt: string | null;
  dueAt: string | null;
  overdue: boolean;
  decision: "approved" | "rejected" | null;
  decidedByName: string | null;
  decidedAt: string | null;
  comment: string | null;
}

export interface ApprovalRequestResponse {
  id: string;
  companyId: string;
  companyShortName: string;
  documentTypeCode: string;
  documentTypeNameVi: string;
  documentTypeNameEn: string;
  appCode: string;
  documentId: string;
  documentNo: string;
  amount: string;
  currency: string;
  documentDate: string;
  exchangeRate: string | null;
  amountInPolicyCurrency: string;
  policyCurrency: string;
  status: ApprovalStatus;
  currentLevelNo: number | null;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  completedAt: string | null;
  steps: ApprovalStepResponse[];
  canDecide: boolean;
  canWithdraw: boolean;
}

// API_39
export const approvalInboxQuerySchema = z
  .object({
    companyId: z.uuid().optional(),
    appCode: z.string().max(50).optional(),
    documentTypeCode: z.string().max(100).optional(),
    overdue: z.enum(["true", "false"]).optional(),
  })
  .strict();

export interface ApprovalInboxItem {
  id: string;
  companyId: string;
  companyShortName: string;
  appCode: string;
  documentTypeCode: string;
  documentTypeNameVi: string;
  documentTypeNameEn: string;
  documentNo: string;
  amount: string;
  currency: string;
  requestedByName: string;
  requestedAt: string;
  currentLevelNo: number;
  dueAt: string | null;
  overdue: boolean;
}

// API_41
export const approvalDecisionSchema = z
  .object({ decision: z.enum(["approved", "rejected"]), comment: z.string().trim().max(1000).nullable().optional() })
  .strict();

// API_31
export interface HandoverResponse {
  pendingApprovalSteps: { id: string; requestId: string; documentNo: string; documentTypeNameVi: string; documentTypeNameEn: string; levelNo: number; requestedById: string }[];
  managedDepartments: { id: string; code: string; name: string }[];
}

// API_32
export const deactivateUserSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
    handover: z
      .array(z.object({ kind: z.enum(["approval_step", "department_manager"]), itemId: z.uuid(), toUserId: z.uuid() }).strict())
      .max(1000)
      .default([]),
  })
  .strict();
export type DeactivateUserRequest = z.input<typeof deactivateUserSchema>;

// API_43
export const numberSequenceResetPeriods = ["year", "month", "never"] as const;
export const updateNumberSequenceSchema = z
  .object({
    prefix: z.string().trim().min(1).max(10),
    resetPeriod: z.enum(numberSequenceResetPeriods),
    padding: z.number().int().min(3).max(10),
  })
  .strict();
export type UpdateNumberSequenceRequest = z.input<typeof updateNumberSequenceSchema>;

export interface NumberSequenceResponse {
  documentTypeCode: string;
  appCode: string;
  documentTypeNameVi: string;
  documentTypeNameEn: string;
  configured: boolean;
  prefix: string | null;
  resetPeriod: (typeof numberSequenceResetPeriods)[number] | null;
  padding: number | null;
  nextNumber: string | null;
}

// API_45, API_46
export const exchangeRateTypes = ["buy", "sell", "transfer", "accounting"] as const;
export const exchangeRateSources = ["manual", "vietcombank"] as const;
const rateValue = z.string().trim().regex(/^\d{1,12}(\.\d{1,8})?$/);
const currencyCode = z.string().trim().regex(/^[A-Z]{3}$/);

export const exchangeRateListQuerySchema = z.object({ date: isoDate.optional() }).strict();

export const createExchangeRateSchema = z
  .object({
    rateDate: isoDate,
    fromCurrency: currencyCode,
    toCurrency: currencyCode,
    rateType: z.enum(exchangeRateTypes),
    source: z.enum(exchangeRateSources).default("manual"),
    rate: rateValue,
  })
  .strict();
export type CreateExchangeRateRequest = z.input<typeof createExchangeRateSchema>;

export const updateExchangeRateSchema = z.object({ rate: rateValue }).strict();

export interface ExchangeRateResponse {
  id: string;
  rateDate: string;
  fromCurrency: string;
  toCurrency: string;
  rateType: (typeof exchangeRateTypes)[number];
  source: string;
  rate: string;
}

export interface ExchangeRateListResponse {
  date: string;
  baseCurrency: string;
  data: ExchangeRateResponse[];
  missingAccounting: string[];
  canManage: boolean;
}

export interface CurrencyResponse {
  code: string;
  nameVi: string;
  nameEn: string;
  minorUnits: number;
}

// API_47
export const auditEventListQuerySchema = z
  .object({
    actorUserId: z.uuid().optional(),
    appCode: z.string().max(50).optional(),
    entityType: z.string().max(100).optional(),
    entityId: z.uuid().optional(),
    action: z.string().max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type AuditEventListQuery = z.input<typeof auditEventListQuerySchema>;

export interface AuditEventItem {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorName: string | null;
  companyShortName: string | null;
  appCode: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
}

export interface AuditEventDetail extends AuditEventItem {
  beforeData: unknown;
  afterData: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

// API_48
export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  link: string | null;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  unreadCount: number;
  data: NotificationItem[];
}

export interface DeactivateUserResponse {
  id: string;
  status: "active" | "locked" | "disabled" | "invited";
  remainingCompanies: number;
}

// API_49: Cài đặt tích hợp (CHUC_NANG_25; QUYTAC_NGHIEPVU_31).
export const integrationSettingKeys = [
  "google.client_id",
  "google.client_secret",
  "microsoft.client_id",
  "microsoft.client_secret",
  "microsoft.tenant",
  "zalo.app_id",
  "zalo.app_secret",
  "esms.api_key",
  "esms.secret_key",
  "esms.brandname",
  "esms.oa_id",
  "esms.sandbox",
  "esms.template.login_otp",
  "esms.template.approval_assigned",
  "esms.template.approval_reminder",
  "esms.template.approval_completed",
] as const;
export type IntegrationSettingKey = (typeof integrationSettingKeys)[number];
export const secretIntegrationKeys: readonly IntegrationSettingKey[] = ["google.client_secret", "microsoft.client_secret", "zalo.app_secret", "esms.api_key", "esms.secret_key"];

export interface IntegrationSettingItem {
  key: IntegrationSettingKey;
  secret: boolean;
  configured: boolean;
  // Giá trị thường; khóa bí mật chỉ trả 4 ký tự cuối.
  value: string | null;
  lastFour: string | null;
  updatedAt: string | null;
}

export interface IntegrationSettingsResponse {
  settings: IntegrationSettingItem[];
  // Đường dẫn chuyển hướng cần khai báo ở Google, Microsoft, Zalo.
  callbackUrls: { google: string; microsoft: string; zalo: string };
}

export const updateIntegrationSettingsSchema = z
  .object({
    // Khóa bí mật để trống thì giữ giá trị cũ; giá trị thường để trống thì xóa.
    values: z.partialRecord(z.enum(integrationSettingKeys), z.string().trim().max(2000)),
    clear: z.array(z.enum(integrationSettingKeys)).max(integrationSettingKeys.length).default([]),
  })
  .strict();
export type UpdateIntegrationSettingsRequest = z.input<typeof updateIntegrationSettingsSchema>;

export interface IntegrationTestResponse {
  ok: boolean;
  message: string;
  officialAccounts: { id: string; name: string }[];
}

export interface MessageDeliveryItem {
  id: string;
  channel: "zns" | "zns_sms" | "sms";
  purpose: string;
  phoneMasked: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  createdAt: string;
}

// API_02, API_03: đăng nhập bằng số điện thoại (CHUC_NANG_08).
export const otpSendSchema = z.object({ phone: phoneE164 }).strict();
// MAN_HINH_19: gửi thử một tin theo mẫu mã OTP đã đăng ký (Zalo trước, SMS sau) tới số do quản trị nhập.
export const integrationTestMessageSchema = z.object({ phone: phoneE164 }).strict();
export const otpVerifySchema = z.object({ phone: phoneE164, code: z.string().regex(/^\d{6}$/) }).strict();

// API_54: cách đăng nhập đang dùng được, để MAN_HINH_01 hiện nút.
export interface AuthMethodsResponse {
  password: boolean;
  phone: boolean;
  google: boolean;
  microsoft: boolean;
  zalo: boolean;
}

// API_50: Mẫu đề xuất (CHUC_NANG_27; QUYTAC_NGHIEPVU_33).
export const proposalFieldTypes = ["text", "textarea", "number", "money", "date", "select", "lines"] as const;
export const proposalColumnTypes = ["text", "number", "money"] as const;
const fieldKey = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
export const proposalFieldSchema = z
  .object({
    key: fieldKey,
    label: z.string().trim().min(1).max(100),
    type: z.enum(proposalFieldTypes),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    // Bảng chi tiết: các cột; cột tiền có khóa "amount" là thành tiền của dòng.
    columns: z.array(z.object({ key: fieldKey, label: z.string().trim().min(1).max(100), type: z.enum(proposalColumnTypes) }).strict()).max(10).optional(),
  })
  .strict();
export type ProposalField = z.output<typeof proposalFieldSchema>;

export const createProposalTemplateSchema = z
  .object({
    code: z.string().trim().regex(/^[A-Z0-9]{1,10}$/),
    name: z.string().trim().min(1).max(100),
    nameEn: z.string().trim().max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).default("VND"),
    fields: z.array(proposalFieldSchema).min(1).max(30),
    // Trường tiền dùng làm giá trị duyệt; để trống thì lấy tổng thành tiền của bảng chi tiết.
    amountField: fieldKey.nullable().optional(),
  })
  .strict();
export type CreateProposalTemplateRequest = z.input<typeof createProposalTemplateSchema>;

export const updateProposalTemplateSchema = createProposalTemplateSchema
  .omit({ code: true })
  .extend({ status: z.enum(["active", "inactive"]), version: z.number().int().positive() })
  .strict();

export interface ProposalTemplateResponse {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  description: string | null;
  documentTypeCode: string;
  currency: string;
  fields: ProposalField[];
  amountField: string | null;
  status: "active" | "inactive";
  version: number;
  hasPolicy: boolean;
}

// API_51: Đề xuất (CHUC_NANG_28; QUYTAC_NGHIEPVU_34, 36).
export const proposalStatuses = ["draft", "pending", "approved", "rejected", "withdrawn"] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];

export const saveProposalSchema = z
  .object({
    templateId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    values: z.record(z.string(), z.unknown()).default({}),
    version: z.number().int().positive().optional(),
  })
  .strict();

export const proposalListQuerySchema = z
  .object({
    scope: z.enum(["mine", "company"]).default("mine"),
    status: z.enum(proposalStatuses).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface ProposalListItem {
  id: string;
  proposalNo: string | null;
  title: string;
  templateName: string;
  amount: string;
  currency: string;
  status: ProposalStatus;
  requestedByName: string;
  createdAt: string;
  submittedAt: string | null;
}

export interface AttachmentResponse {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ProposalResponse extends ProposalListItem {
  templateId: string;
  template: { name: string; fields: ProposalField[]; amountField: string | null };
  values: Record<string, unknown>;
  approvalRequestId: string | null;
  attachments: AttachmentResponse[];
  version: number;
  canEdit: boolean;
  canWithdraw: boolean;
}

// QUYTAC_NGHIEPVU_35
export const attachmentMaximumBytes = 10 * 1024 * 1024;
export const attachmentMaximumCount = 10;
export const attachmentExtensions = ["pdf", "jpg", "jpeg", "png", "xlsx", "docx"] as const;

// CONG_VIEC_04, API_55: ngành hàng, đơn vị tính dùng chung tập đoàn (CHUC_NANG_30; QUYTAC_NGHIEPVU_37).
export const categoryMaximumLevel = 4;
const categoryCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/);
const categoryFields = {
  parentId: z.uuid().nullable().optional(),
  code: categoryCode,
  nameVi: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  tracksLots: z.boolean().default(false),
  tracksSerials: z.boolean().default(false),
  warrantyMonths: z.number().int().min(0).max(120).default(0),
  // CONG_VIEC_07: hàng thuộc ngành cần kiểm tra chất lượng khi nhập mua (QUYTAC_NGHIEPVU_65); khi sửa không gửi thì giữ nguyên.
  requiresQualityCheck: z.boolean().optional(),
};
export const createCategorySchema = z.object(categoryFields).strict();
export type CreateCategoryRequest = z.input<typeof createCategorySchema>;
export const updateCategorySchema = z
  .object({ ...categoryFields, tracksLots: z.boolean(), tracksSerials: z.boolean(), warrantyMonths: z.number().int().min(0).max(120), version: z.number().int().positive() })
  .strict();
export type UpdateCategoryRequest = z.input<typeof updateCategorySchema>;

export interface CategoryResponse {
  id: string;
  parentId: string | null;
  code: string;
  nameVi: string;
  nameEn: string;
  level: number;
  tracksLots: boolean;
  tracksSerials: boolean;
  warrantyMonths: number;
  requiresQualityCheck: boolean;
  status: "active" | "inactive";
  version: number;
  productCount: number;
  childCount: number;
}

const unitFields = {
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,10}$/),
  nameVi: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
};
export const createUnitSchema = z.object(unitFields).strict();
export type CreateUnitRequest = z.input<typeof createUnitSchema>;
export const updateUnitSchema = z.object({ nameVi: unitFields.nameVi, nameEn: unitFields.nameEn, version: z.number().int().positive() }).strict();
export type UpdateUnitRequest = z.input<typeof updateUnitSchema>;

export interface UnitResponse {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string;
  status: "active" | "inactive";
  version: number;
}

// CONG_VIEC_04, API_56, API_57: sản phẩm, biến thể, đơn vị quy đổi, mã vạch, ảnh (CHUC_NANG_31, 32; QUYTAC_NGHIEPVU_38 đến 40).
export const vatRates = ["0", "5", "8", "10", "exempt", "not_declared"] as const;
export type VatRate = (typeof vatRates)[number];
export const productLimits = { options: 3, optionValues: 30, variants: 200, conversionUnits: 5, images: 10, imageBytes: 5 * 1024 * 1024 } as const;
export const productImageExtensions = ["jpg", "jpeg", "png", "webp"] as const;

const decimalText = (fraction: number) =>
  z.union([z.number(), z.string()]).transform((value, context) => {
    const text = String(value).trim().replace(",", ".");
    if (!new RegExp(`^\\d{1,12}(\\.\\d{1,${fraction}})?$`).test(text)) {
      context.addIssue({ code: "custom", message: "invalidValue" });
      return z.NEVER;
    }
    return text;
  });
const optionalDecimal = (fraction: number) => z.union([decimalText(fraction), z.literal(""), z.null()]).optional().transform((value) => (value === "" || value === undefined ? null : value));

const barcodeText = z.string().trim().regex(/^[0-9A-Za-z\-.]{4,40}$/);
const productSku = z.string().trim().toUpperCase().regex(/^[A-Z0-9\-_.]{1,40}$/);

// CONG_VIEC_43 (QUYTAC_NGHIEPVU_275): loại sản phẩm; dịch vụ không theo dõi tồn kho, lô, số serial.
export const productKinds = ["goods", "service"] as const;
export type ProductKind = (typeof productKinds)[number];

export const saveProductSchema = z
  .object({
    categoryId: z.uuid(),
    // Tạo mới bỏ trống thì là Hàng hóa; cập nhật bỏ trống thì giữ loại hiện có (CONG_VIEC_43, lát L4).
    kind: z.enum(productKinds).optional(),
    code: z.union([productSku, z.literal("")]).optional(),
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).nullable().optional(),
    brand: z.string().trim().max(100).nullable().optional(),
    origin: z.string().trim().max(100).nullable().optional(),
    vatRate: z.enum(vatRates),
    tracksLots: z.boolean(),
    tracksSerials: z.boolean(),
    warrantyMonths: z.number().int().min(0).max(120),
    baseUnitId: z.uuid(),
    weightKg: optionalDecimal(4),
    volumeM3: optionalDecimal(6),
    options: z
      .array(z.object({ name: z.string().trim().min(1).max(50), values: z.array(z.string().trim().min(1).max(50)).min(1).max(productLimits.optionValues) }).strict())
      .max(productLimits.options)
      .default([]),
    specifications: z
      .array(z.object({ name: z.string().trim().min(1).max(100), value: z.string().trim().min(1).max(500) }).strict())
      .max(50)
      .default([]),
    units: z
      .array(z.object({ unitId: z.uuid(), factor: decimalText(4) }).strict())
      .max(productLimits.conversionUnits)
      .default([]),
    variants: z
      .array(
        z
          .object({
            id: z.uuid().optional(),
            sku: z.union([productSku, z.literal("")]).optional(),
            optionValues: z.array(z.string().trim().min(1).max(50)).max(productLimits.options).default([]),
            status: z.enum(["active", "inactive"]).default("active"),
            barcodes: z
              .array(z.object({ unitId: z.uuid(), barcode: barcodeText }).strict())
              .max(20)
              .default([]),
          })
          .strict(),
      )
      .min(1)
      .max(productLimits.variants),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveProductRequest = z.input<typeof saveProductSchema>;

export const productListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    categoryId: z.uuid().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  baseUnitName: string;
  variantCount: number;
  status: "active" | "inactive";
  imageId: string | null;
  updatedAt: string;
}

export interface ProductVariantResponse {
  id: string;
  sku: string;
  optionValues: string[];
  status: "active" | "inactive";
  barcodes: { unitId: string; barcode: string }[];
}

export interface ProductImageResponse {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ProductResponse {
  id: string;
  companyId: string;
  categoryId: string;
  categoryName: string;
  code: string;
  name: string;
  description: string | null;
  brand: string | null;
  origin: string | null;
  vatRate: VatRate;
  kind: ProductKind;
  tracksLots: boolean;
  tracksSerials: boolean;
  warrantyMonths: number;
  baseUnitId: string;
  weightKg: string | null;
  volumeM3: string | null;
  options: { name: string; values: string[] }[];
  specifications: { name: string; value: string }[];
  units: { unitId: string; factor: string }[];
  variants: ProductVariantResponse[];
  images: ProductImageResponse[];
  status: "active" | "inactive";
  version: number;
  updatedAt: string;
}

// CONG_VIEC_04, API_58: nhập sản phẩm từ Excel (CHUC_NANG_33): mỗi dòng một biến thể; dòng cùng mã sản phẩm (hoặc cùng tên khi để trống mã) gộp thành một sản phẩm.
export const productImportColumns = [
  "Mã sản phẩm",
  "Tên sản phẩm",
  "Mã ngành hàng",
  "Mã đơn vị cơ sở",
  "Thuế suất",
  "Theo dõi",
  "Bảo hành (tháng)",
  "Thương hiệu",
  "Xuất xứ",
  "Trọng lượng (kg)",
  "Thể tích (m3)",
  "Đơn vị quy đổi",
  "Phân loại 1",
  "Phân loại 2",
  "Phân loại 3",
  "Mã hàng",
  "Mã vạch",
] as const;
export const productImportMaximumRows = 2000;
export const productImportMaximumBytes = 5 * 1024 * 1024;

export interface ProductImportResponse {
  createdProducts: number;
  createdVariants: number;
  failedRows: number;
  errors: { row: number; message: string }[];
  errorFileUrl: string | null;
}

// CONG_VIEC_04, API_59: liên kết biến thể tương ứng giữa công ty, sao chép sản phẩm (CHUC_NANG_34; QUYTAC_NGHIEPVU_41).
export const createVariantLinkSchema = z.object({ variantId: z.uuid(), linkedVariantId: z.uuid(), factor: decimalText(4).default("1") }).strict();
export type CreateVariantLinkRequest = z.input<typeof createVariantLinkSchema>;
export const copyProductSchema = z.object({ targetCompanyId: z.uuid() }).strict();

export interface VariantLinkResponse {
  id: string;
  variantId: string;
  sku: string;
  linkedVariantId: string;
  linkedSku: string;
  linkedProductId: string;
  linkedProductName: string;
  linkedCompanyId: string;
  linkedCompanyName: string;
  factor: string;
}

export interface VariantLinkSuggestion {
  variantId: string;
  sku: string;
  linkedVariantId: string;
  linkedSku: string;
  linkedProductName: string;
  barcode: string;
}

// CONG_VIEC_04, API_60: kênh bán, nhóm khách hàng của công ty (CHUC_NANG_35).
const catalogItemCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{1,20}$/);
export const createCatalogItemSchema = z.object({ code: catalogItemCode, name: z.string().trim().min(1).max(100) }).strict();
export type CreateCatalogItemRequest = z.input<typeof createCatalogItemSchema>;
export const updateCatalogItemSchema = z.object({ name: z.string().trim().min(1).max(100), version: z.number().int().positive() }).strict();
export interface CatalogItemResponse {
  id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  version: number;
}
// Kênh có sẵn; không có sàn ngoài (quyết định người dùng 2026-11-09).
export const defaultSalesChannels = [
  { code: "BAN_SI", name: "Bán sỉ" },
  { code: "BAN_LE", name: "Bán lẻ" },
  { code: "SAN_VCOMM", name: "Sàn VComm" },
  { code: "NOI_BO", name: "Nội bộ" },
] as const;

// CONG_VIEC_04, API_61: bảng giá, giá hiện hành, lịch sử giá (CHUC_NANG_36; QUYTAC_NGHIEPVU_42, 43).
export const createPriceListSchema = z
  .object({
    code: catalogItemCode,
    name: z.string().trim().min(1).max(100),
    channelId: z.uuid().nullable().optional(),
    customerGroupId: z.uuid().nullable().optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).default("VND"),
    includesVat: z.boolean(),
  })
  .strict();
export type CreatePriceListRequest = z.input<typeof createPriceListSchema>;
export const updatePriceListSchema = z.object({ name: z.string().trim().min(1).max(100), includesVat: z.boolean(), version: z.number().int().positive() }).strict();
export interface PriceListResponse {
  id: string;
  code: string;
  name: string;
  channelId: string | null;
  channelName: string | null;
  customerGroupId: string | null;
  customerGroupName: string | null;
  currency: string;
  includesVat: boolean;
  status: "active" | "inactive";
  version: number;
}

export const priceListPricesQuerySchema = z
  .object({ date: isoDate.optional(), search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();
export interface PriceRow {
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitId: string;
  unitName: string;
  price: string;
  effectiveFrom: string;
}
export const priceHistoryQuerySchema = z.object({ variantId: z.uuid(), unitId: z.uuid() }).strict();
export interface PriceHistoryItem {
  price: string;
  effectiveFrom: string;
  priceChangeId: string;
  changeNo: string | null;
  createdAt: string;
}
// Tra giá khi bán (MODULE_05 dùng): chọn bảng giá theo thứ tự ưu tiên QUYTAC_NGHIEPVU_42, giá theo ngày QUYTAC_NGHIEPVU_43.
export const priceLookupQuerySchema = z
  .object({
    variantId: z.uuid(),
    unitId: z.uuid(),
    channelId: z.uuid().optional(),
    customerGroupId: z.uuid().optional(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/).default("VND"),
    date: isoDate.optional(),
  })
  .strict();
export interface PriceLookupResponse {
  priceListId: string;
  priceListCode: string;
  includesVat: boolean;
  price: string;
  effectiveFrom: string;
  fromBaseUnit: boolean;
}

// CONG_VIEC_04, API_62: phiếu điều chỉnh giá qua luồng duyệt (CHUC_NANG_37; QUYTAC_NGHIEPVU_44).
export const priceChangeStatuses = ["draft", "pending", "approved", "rejected", "withdrawn"] as const;
export type PriceChangeStatus = (typeof priceChangeStatuses)[number];
export const savePriceChangeSchema = z
  .object({
    priceListId: z.uuid(),
    effectiveFrom: isoDate,
    note: z.string().trim().max(1000).nullable().optional(),
    lines: z
      .array(z.object({ variantId: z.uuid(), unitId: z.uuid(), price: decimalText(4) }).strict())
      .min(1)
      .max(5000),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePriceChangeRequest = z.input<typeof savePriceChangeSchema>;
export const priceChangeListQuerySchema = z
  .object({ status: z.enum(priceChangeStatuses).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) })
  .strict();
export interface PriceChangeListItem {
  id: string;
  changeNo: string | null;
  priceListId: string;
  priceListName: string;
  effectiveFrom: string;
  lineCount: number;
  status: PriceChangeStatus;
  requestedByName: string;
  createdAt: string;
}
export interface PriceChangeResponse extends PriceChangeListItem {
  note: string | null;
  currency: string;
  approvalRequestId: string | null;
  lines: { variantId: string; sku: string; productName: string; optionValues: string[]; unitId: string; unitName: string; price: string; currentPrice: string | null }[];
  version: number;
  canEdit: boolean;
  canWithdraw: boolean;
}
export const priceChangeImportColumns = ["Mã hàng", "Mã đơn vị", "Giá"] as const;
export type PriceChangeLine = PriceChangeResponse["lines"][number];
// Nhập dòng phiếu từ Excel: trả các dòng đọc được để người dùng xem lại trước khi lưu.
export interface PriceChangeImportResponse {
  lines: PriceChangeLine[];
  errors: { row: number; message: string }[];
}
// Giá người dùng gõ hoặc ô Excel dạng chữ: tiền VND không có phần lẻ nên dấu chấm, khoảng trắng là phân cách hàng nghìn ("120.000" là 120000);
// tiền tệ khác dùng dấu phẩy hoặc dấu chấm làm dấu thập phân.
export function normalizeMoneyText(text: string, currency: string): string {
  const compact = text.trim().replace(/\s/g, "");
  return currency === "VND" ? compact.replace(/\./g, "").replace(",", ".") : compact.replace(",", ".");
}

// CONG_VIEC_05, API_63: kho, vị trí, công ty chủ hàng, cài đặt kho (CHUC_NANG_38; QUYTAC_NGHIEPVU_45, 46).
const warehouseCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{1,20}$/);
export const createWarehouseSchema = z
  .object({
    branchId: z.uuid(),
    code: warehouseCode,
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).nullable().optional(),
    usesLocations: z.boolean(),
    ownerCompanyIds: z.array(z.uuid()).max(50).default([]),
  })
  .strict();
export type CreateWarehouseRequest = z.input<typeof createWarehouseSchema>;
export const updateWarehouseSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    address: z.string().trim().max(500).nullable().optional(),
    usesLocations: z.boolean(),
    ownerCompanyIds: z.array(z.uuid()).max(50),
    version: z.number().int().positive(),
  })
  .strict();
export type UpdateWarehouseRequest = z.input<typeof updateWarehouseSchema>;
export interface WarehouseResponse {
  id: string;
  companyId: string;
  companyName: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
  address: string | null;
  usesLocations: boolean;
  owners: { companyId: string; companyName: string }[];
  locationCount: number;
  status: "active" | "inactive";
  version: number;
  // Người đang xem thao tác được kho (quyền kho ở chi nhánh sở hữu kho); sai thì chỉ xem tồn của công ty mình.
  canOperate: boolean;
  canManage: boolean;
}
const locationCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_.-]{1,30}$/);
export const createLocationSchema = z.object({ code: locationCode, name: z.string().trim().max(100).nullable().optional() }).strict();
export const createLocationsSchema = z.object({ locations: z.array(createLocationSchema).min(1).max(500) }).strict();
export const updateLocationSchema = z.object({ name: z.string().trim().max(100).nullable().optional(), version: z.number().int().positive() }).strict();
export interface LocationResponse {
  id: string;
  warehouseId: string;
  code: string;
  name: string | null;
  status: "active" | "inactive";
  version: number;
}
export const updateInventorySettingsSchema = z.object({ reservationHours: z.number().int().min(1).max(720), version: z.number().int().min(0) }).strict();
export interface InventorySettingsResponse {
  reservationHours: number;
  version: number;
}
// Lựa chọn khi lập kho: chi nhánh của công ty đang chọn, công ty trong tập đoàn làm chủ hàng.
export interface WarehouseOptionsResponse {
  branches: { id: string; name: string }[];
  companies: { id: string; shortName: string }[];
}

// CONG_VIEC_05, API_64, API_65: phiếu kho, tồn kho, thẻ kho (CHUC_NANG_39, 40; QUYTAC_NGHIEPVU_47 đến 51).
export const stockDocumentTypes = ["receipt_other", "issue_other", "adjustment", "transfer", "purchase_receipt", "purchase_return", "sales_issue", "sales_return"] as const;
// Loại phiếu lập tay ở màn hình phiếu kho; phiếu nhập mua, trả hàng nhà cung cấp lập từ đơn mua, phiếu nhập mua (CONG_VIEC_07).
export const manualStockDocumentTypes = ["receipt_other", "issue_other", "adjustment", "transfer"] as const;
export type StockDocumentType = (typeof stockDocumentTypes)[number];
export const stockDocumentStatuses = ["draft", "pending", "quality_check", "posted", "in_transit", "received", "rejected", "withdrawn"] as const;
export type StockDocumentStatus = (typeof stockDocumentStatuses)[number];
// Lý do theo loại phiếu; "Hủy hàng hết hạn" là lý do duy nhất được xuất lô hết hạn (QUYTAC_NGHIEPVU_51).
export const stockReasonCodes = {
  receipt_other: ["opening_balance", "found", "gift", "other"],
  issue_other: ["internal_use", "gift", "damaged", "expired_disposal", "other"],
  adjustment: ["stocktake", "damaged", "found", "other"],
  transfer: ["transfer"],
  purchase_receipt: ["purchase"],
  purchase_return: ["purchase_return"],
  sales_issue: ["sale"],
  sales_return: ["sales_return"],
} as const satisfies Record<StockDocumentType, readonly string[]>;
export type StockReasonCode = (typeof stockReasonCodes)[StockDocumentType][number];
const signedDecimal = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^-?\d{1,12}(\.\d{1,4})?$/.test(text) || Number(text) === 0) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
const optionalMoney = z.union([z.number(), z.string(), z.null()]).optional().transform((value, context) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,16}(\.\d{1,4})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
export const stockDocumentLineSchema = z
  .object({
    variantId: z.uuid(),
    unitId: z.uuid(),
    quantity: signedDecimal,
    unitCost: optionalMoney,
    lotId: z.uuid().nullable().optional(),
    lotNo: z.string().trim().max(50).nullable().optional(),
    manufacturedOn: isoDate.nullable().optional(),
    expiresOn: isoDate.nullable().optional(),
    lotOverrideReason: z.string().trim().max(200).nullable().optional(),
    locationId: z.uuid().nullable().optional(),
    destinationLocationId: z.uuid().nullable().optional(),
    serials: z.array(z.string().trim().min(1).max(100)).max(5000).default([]),
    responsibleUserId: z.uuid().nullable().optional(),
    compensationAmount: optionalMoney,
  })
  .strict();
export type StockDocumentLineInput = z.input<typeof stockDocumentLineSchema>;
export const saveStockDocumentSchema = z
  .object({
    type: z.enum(stockDocumentTypes),
    warehouseId: z.uuid(),
    companyId: z.uuid(),
    destinationWarehouseId: z.uuid().nullable().optional(),
    documentDate: isoDate,
    reasonCode: z.string().trim().min(1),
    reason: z.string().trim().min(1).max(500),
    note: z.string().trim().max(1000).nullable().optional(),
    lines: z.array(stockDocumentLineSchema).min(1).max(1000),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveStockDocumentRequest = z.input<typeof saveStockDocumentSchema>;
export const stockDocumentListQuerySchema = z
  .object({
    type: z.enum(stockDocumentTypes).optional(),
    status: z.enum(stockDocumentStatuses).optional(),
    warehouseId: z.uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface StockDocumentListItem {
  id: string;
  type: StockDocumentType;
  documentNo: string | null;
  documentDate: string;
  warehouseId: string;
  warehouseName: string;
  destinationWarehouseName: string | null;
  companyId: string;
  companyName: string;
  reasonCode: string;
  reason: string;
  status: StockDocumentStatus;
  lineCount: number;
  totalValue: string | null;
  createdByName: string;
  createdAt: string;
  // CONG_VIEC_43: phiếu dịch vụ hệ thống tự lập, không ghi thẻ kho (QUYTAC_NGHIEPVU_275).
  isService: boolean;
}
export interface StockDocumentLineResponse {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  tracksLots: boolean;
  tracksSerials: boolean;
  unitId: string;
  unitName: string;
  quantity: string;
  baseQuantity: string;
  baseUnitName: string;
  unitCost: string | null;
  costValue: string | null;
  lotId: string | null;
  lotNo: string | null;
  manufacturedOn: string | null;
  expiresOn: string | null;
  lotOverrideReason: string | null;
  locationId: string | null;
  locationCode: string | null;
  destinationLocationId: string | null;
  destinationLocationCode: string | null;
  serials: string[];
  receivedBaseQuantity: string | null;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  compensationAmount: string | null;
  // Phiếu nhập mua: dòng đơn mua; trả hàng: dòng phiếu nhập mua gốc.
  sourceLineId: string | null;
  rejectedBaseQuantity: string | null;
  rejectionReason: string | null;
  requiresQualityCheck: boolean;
}
export interface StockDocumentResponse extends StockDocumentListItem {
  destinationWarehouseId: string | null;
  note: string | null;
  approvalRequestId: string | null;
  stocktakeId: string | null;
  lines: StockDocumentLineResponse[];
  discrepancies: {
    lineId: string;
    sku: string;
    shippedQuantity: string;
    receivedQuantity: string;
    difference: string;
    value: string | null;
    note: string | null;
    responsibleUserName: string | null;
    compensationAmount: string | null;
  }[];
  version: number;
  canEdit: boolean;
  canWithdraw: boolean;
  canShip: boolean;
  canReceive: boolean;
  // Phiếu nhập mua, trả hàng: nhà cung cấp, chứng từ gốc (đơn mua hoặc phiếu nhập mua).
  partnerId: string | null;
  partnerName: string | null;
  sourceId: string | null;
  sourceNo: string | null;
  canQualityCheck: boolean;
  canReturn: boolean;
  // CONG_VIEC_09: phiếu nhập mua nội bộ chờ nhận; số xuất, serial xuất theo phiếu xuất gốc bên bán (đơn vị cơ sở bên nhận).
  internalReceipt: { issueDocumentNo: string | null; sellerCompanyName: string; lines: { lineId: string; shippedBaseQuantity: string; shippedSerials: string[] }[] } | null;
  canReceiveInternal: boolean;
}
export const lotSuggestionQuerySchema = z
  .object({ warehouseId: z.uuid(), companyId: z.uuid(), variantId: z.uuid(), locationId: z.uuid().optional(), includeExpired: z.enum(["true", "false"]).optional() })
  .strict();
export interface LotSuggestion {
  lotId: string;
  lotNo: string;
  expiresOn: string | null;
  manufacturedOn: string | null;
  locationId: string | null;
  locationCode: string | null;
  quantity: string;
  expired: boolean;
  suggested: boolean;
}
// Tìm mặt hàng khi lập phiếu: theo mã vạch (máy quét), mã hàng, tên; trả đơn vị khớp mã vạch.
export const stockItemSearchQuerySchema = z.object({ companyId: z.uuid(), search: z.string().trim().min(1).max(100) }).strict();
export interface StockItemOption {
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  tracksLots: boolean;
  tracksSerials: boolean;
  baseUnitId: string;
  units: { unitId: string; unitName: string; factor: string }[];
  matchedUnitId: string | null;
}
export const stockListQuerySchema = z
  .object({
    warehouseId: z.uuid().optional(),
    companyId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    search: z.string().trim().max(100).optional(),
    onlyInStock: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
export interface StockRow {
  warehouseId: string;
  warehouseName: string;
  companyId: string;
  companyName: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  baseUnitName: string;
  onHand: string;
  reserved: string;
  available: string;
  incoming: string;
  averageCost: string | null;
  value: string | null;
  minimum: string | null;
  belowMinimum: boolean;
}
export const stockDetailQuerySchema = z.object({ warehouseId: z.uuid(), companyId: z.uuid() }).strict();
export interface StockDetailResponse {
  balances: { lotId: string | null; lotNo: string | null; expiresOn: string | null; locationId: string | null; locationCode: string | null; quantity: string }[];
  serials: { serialNo: string; locationCode: string | null; unitCost: string | null }[];
  reservations: { id: string; quantity: string; sourceType: string; sourceNo: string | null; expiresAt: string | null }[];
}
export const stockCardQuerySchema = z.object({ warehouseId: z.uuid(), companyId: z.uuid(), variantId: z.uuid(), from: isoDate, to: isoDate }).strict();
export interface StockCardResponse {
  sku: string;
  productName: string;
  baseUnitName: string;
  opening: { quantity: string; value: string | null };
  movements: {
    id: string;
    movedAt: string;
    documentId: string;
    documentNo: string | null;
    documentType: StockDocumentType;
    lotNo: string | null;
    locationCode: string | null;
    quantity: string;
    unitCost: string | null;
    value: string | null;
    balanceAfter: string;
  }[];
  closing: { quantity: string; value: string | null };
}

// CONG_VIEC_05, API_66: chuyển kho hai bước (CHUC_NANG_41; QUYTAC_NGHIEPVU_52). Số thực nhận theo đơn vị cơ sở.
export const receiveTransferSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            lineId: z.uuid(),
            receivedQuantity: z.union([z.number(), z.string()]).transform((value, context) => {
              const text = String(value).trim().replace(",", ".");
              if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) {
                context.addIssue({ code: "custom", message: "invalidValue" });
                return z.NEVER;
              }
              return text;
            }),
            destinationLocationId: z.uuid().nullable().optional(),
            serials: z.array(z.string().trim().min(1).max(100)).max(5000).default([]),
            // Nhận thiếu: người chịu trách nhiệm, tiền bồi thường (để trống: bằng giá trị thiếu).
            responsibleUserId: z.uuid().nullable().optional(),
            compensationAmount: optionalMoney,
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
export type ReceiveTransferRequest = z.input<typeof receiveTransferSchema>;
export interface TransferDestination {
  id: string;
  code: string;
  name: string;
  companyName: string;
  usesLocations: boolean;
}

// CONG_VIEC_05, API_67: kiểm kê (CHUC_NANG_42; QUYTAC_NGHIEPVU_53).
export const stocktakeScopeTypes = ["full", "categories", "locations", "variants"] as const;
export const stocktakeStatuses = ["draft", "counting", "finished", "cancelled"] as const;
export const createStocktakeSchema = z
  .object({
    warehouseId: z.uuid(),
    companyId: z.uuid(),
    scopeType: z.enum(stocktakeScopeTypes),
    scopeIds: z.array(z.uuid()).max(5000).default([]),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
const countQuantity = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
// Số đếm theo đơn vị cơ sở. Dòng mới (hàng có thực tế nhưng sổ sách không có) gửi biến thể, lô, vị trí thay cho mã dòng.
export const saveStocktakeCountsSchema = z
  .object({
    counts: z
      .array(
        z
          .object({
            lineId: z.uuid().optional(),
            variantId: z.uuid().optional(),
            lotId: z.uuid().nullable().optional(),
            locationId: z.uuid().nullable().optional(),
            countedQuantity: countQuantity,
            serials: z.array(z.string().trim().min(1).max(100)).max(5000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(5000),
  })
  .strict();
// API_138: cộng dồn số đếm từ ứng dụng kho (QUYTAC_NGHIEPVU_284). Số cộng có dấu theo đơn vị cơ sở; hàng serial gửi serial thêm, serial bỏ.
const signedCountQuantity = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^-?\d{1,12}(\.\d{1,4})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
export const addStocktakeCountsSchema = z
  .object({
    additions: z
      .array(
        z
          .object({
            variantId: z.uuid(),
            lotId: z.uuid().nullable().default(null),
            locationId: z.uuid().nullable().default(null),
            quantity: signedCountQuantity.default("0"),
            serials: z.array(z.string().trim().min(1).max(100)).max(1000).default([]),
            removedSerials: z.array(z.string().trim().min(1).max(100)).max(1000).default([]),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
export const stocktakeCountEntryQuerySchema = z.object({ mine: z.enum(["true", "false"]).default("false") }).strict();
// API_139: lịch sử đếm của đợt kiểm kê.
export interface StocktakeCountEntry {
  id: string;
  lineId: string;
  variantId: string;
  sku: string;
  productName: string;
  lotNo: string | null;
  locationCode: string | null;
  quantity: string;
  addedSerials: string[];
  removedSerials: string[];
  countedById: string;
  countedByName: string;
  countedAt: string;
}
export const finishStocktakeSchema = z
  .object({
    responsibilities: z
      .array(z.object({ lineId: z.uuid(), responsibleUserId: z.uuid().nullable(), compensationAmount: optionalMoney }).strict())
      .max(5000)
      .default([]),
    version: z.number().int().positive(),
  })
  .strict();
export interface StocktakeListItem {
  id: string;
  stocktakeNo: string | null;
  warehouseId: string;
  warehouseName: string;
  companyId: string;
  companyName: string;
  scopeType: (typeof stocktakeScopeTypes)[number];
  status: (typeof stocktakeStatuses)[number];
  lineCount: number;
  countedCount: number;
  createdByName: string;
  createdAt: string;
}
export interface StocktakeResponse extends StocktakeListItem {
  scopeIds: string[];
  note: string | null;
  adjustmentDocumentId: string | null;
  adjustmentDocumentNo: string | null;
  lines: {
    id: string;
    variantId: string;
    sku: string;
    productName: string;
    optionValues: string[];
    tracksSerials: boolean;
    baseUnitName: string;
    lotId: string | null;
    lotNo: string | null;
    expiresOn: string | null;
    locationId: string | null;
    locationCode: string | null;
    // Đếm mù: null với người không có quyền quản lý kiểm kê tại kho (QUYTAC_NGHIEPVU_283).
    systemQuantity: string | null;
    countedQuantity: string | null;
    countedSerials: string[] | null;
    difference: string | null;
    unitCost: string | null;
    differenceValue: string | null;
    responsibleUserId: string | null;
    compensationAmount: string | null;
  }[];
  version: number;
  canManage: boolean;
  // Có quyền đếm hoặc quản lý kiểm kê tại kho (API_138).
  canCount: boolean;
}
// Lựa chọn khi kiểm kê: ngành hàng (phạm vi kiểm), nhân viên công ty sở hữu kho (người chịu trách nhiệm phần thiếu).
export interface StocktakeOptionsResponse {
  categories: { id: string; code: string; name: string }[];
  users: { id: string; fullName: string }[];
}

// CONG_VIEC_05, API_68 đến API_70: giữ hàng, tồn an toàn, cảnh báo, in tem (CHUC_NANG_43, 44, 45; QUYTAC_NGHIEPVU_54, 55).
const positiveQuantity = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(text) || Number(text) <= 0) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
const nonNegativeQuantity = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
// Giữ hàng thủ công (ví dụ khách hẹn lấy hàng); MODULE_05 giữ hàng cho đơn bán qua dịch vụ trong API.
export const createReservationSchema = z
  .object({ warehouseId: z.uuid(), companyId: z.uuid(), variantId: z.uuid(), quantity: positiveQuantity, note: z.string().trim().min(1).max(200) })
  .strict();
export const extendReservationSchema = z.object({ hours: z.number().int().min(1).max(720), version: z.number().int().positive() }).strict();
export const reservationListQuerySchema = z
  .object({ warehouseId: z.uuid().optional(), status: z.enum(["active", "released", "consumed"]).optional(), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) })
  .strict();
export interface ReservationResponse {
  id: string;
  warehouseId: string;
  warehouseName: string;
  companyId: string;
  companyName: string;
  variantId: string;
  sku: string;
  productName: string;
  quantity: string;
  baseUnitName: string;
  sourceType: string;
  sourceNo: string | null;
  expiresAt: string | null;
  status: "active" | "released" | "consumed";
  createdByName: string | null;
  createdAt: string;
  version: number;
}
export const saveStockLevelSchema = z
  .object({ warehouseId: z.uuid(), companyId: z.uuid(), variantId: z.uuid(), minimum: nonNegativeQuantity, maximum: nonNegativeQuantity })
  .strict()
  .refine((value) => Number(value.maximum) >= Number(value.minimum), { path: ["maximum"], message: "stockLevelMaximumBelowMinimum" });
export const stockLevelQuerySchema = z.object({ warehouseId: z.uuid().optional(), onlyAlerts: z.enum(["true", "false"]).optional() }).strict();
export interface StockLevelRow {
  warehouseId: string;
  warehouseName: string;
  companyId: string;
  companyName: string;
  variantId: string;
  sku: string;
  productName: string;
  baseUnitName: string;
  minimum: string;
  maximum: string;
  available: string;
  incoming: string;
  belowMinimum: boolean;
  suggestedQuantity: string;
}
export const productLabelQuerySchema = z
  .object({ companyId: z.uuid(), variantIds: z.string().min(1), copies: z.coerce.number().int().min(1).max(500).default(1) })
  .strict();
export const locationLabelQuerySchema = z.object({ warehouseId: z.uuid() }).strict();

// CONG_VIEC_06, API_71, API_72: đối tác dùng chung tập đoàn, hồ sơ đối tác của công ty (CHUC_NANG_46 đến 48; QUYTAC_NGHIEPVU_56 đến 60).
export const partnerKinds = ["organization", "household", "individual"] as const;
export type PartnerKind = (typeof partnerKinds)[number];
const blankToNull = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value || null);
export const savePartnerSchema = z
  .object({
    kind: z.enum(partnerKinds),
    name: z.string().trim().min(1).max(300),
    shortName: blankToNull(100),
    taxCode: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((value) => value || null)
      .refine((value) => value === null || /^[0-9]{10}(-[0-9]{3})?$/.test(value), "invalidValue"),
    citizenId: z
      .string()
      .trim()
      .nullable()
      .optional()
      .transform((value) => value || null)
      .refine((value) => value === null || /^[0-9]{12}$/.test(value), "invalidValue"),
    address: blankToNull(500),
    phone: blankToNull(30),
    email: z
      .string()
      .trim()
      .max(200)
      .nullable()
      .optional()
      .transform((value) => value || null)
      .refine((value) => value === null || z.email().safeParse(value).success, "invalidValue"),
    contacts: z
      .array(z.object({ fullName: z.string().trim().min(1).max(200), position: blankToNull(100), phone: blankToNull(30), email: blankToNull(200), isPrimary: z.boolean().default(false) }).strict())
      .max(50)
      .default([]),
    bankAccounts: z
      .array(
        z
          .object({
            bankName: z.string().trim().min(1).max(200),
            accountNo: z.string().trim().regex(/^[0-9A-Za-z-]{4,30}$/),
            accountHolder: z.string().trim().min(1).max(200),
            branch: blankToNull(200),
            isDefault: z.boolean().default(false),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePartnerRequest = z.input<typeof savePartnerSchema>;
export const partnerListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    kind: z.enum(partnerKinds).optional(),
    role: z.enum(["customer", "supplier", "internal"]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface PartnerListItem {
  id: string;
  code: string;
  kind: PartnerKind;
  name: string;
  shortName: string | null;
  taxCode: string | null;
  // Chỉ 3 số cuối (QUYTAC_NGHIEPVU_59).
  citizenIdMasked: string | null;
  phone: string | null;
  internalCompanyId: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  // CONG_VIEC_21: nhân viên phụ trách tại công ty đang chọn.
  ownerUserName: string | null;
  status: "active" | "inactive";
}
export interface PartnerProfileResponse {
  companyId: string;
  isCustomer: boolean;
  isSupplier: boolean;
  paymentTermDays: number;
  // null: không giới hạn, hoặc bị ẩn khi creditLimitHidden (người xem không có quyền quản lý hồ sơ đối tác).
  creditLimit: string | null;
  creditLimitHidden: boolean;
  // Tiền tệ của công ty (core.companies.base_currency).
  currency: string;
  customerGroupId: string | null;
  customerGroupName: string | null;
  ownerUserId: string | null;
  ownerUserName: string | null;
  note: string | null;
  status: "active" | "inactive";
  version: number;
}
export interface PartnerResponse extends PartnerListItem {
  address: string | null;
  email: string | null;
  contacts: { fullName: string; position: string | null; phone: string | null; email: string | null; isPrimary: boolean }[];
  bankAccounts: { bankName: string; accountNo: string; accountHolder: string; branch: string | null; isDefault: boolean }[];
  profile: PartnerProfileResponse | null;
  version: number;
  canManage: boolean;
  canViewIdentity: boolean;
  canManageProfile: boolean;
}
export const partnerLookupQuerySchema = z.object({ taxCode: z.string().trim().optional(), citizenId: z.string().trim().optional() }).strict();
export interface PartnerLookupResponse {
  partner: { id: string; code: string; name: string } | null;
}
export const savePartnerProfileSchema = z
  .object({
    isCustomer: z.boolean(),
    isSupplier: z.boolean(),
    paymentTermDays: z.number().int().min(0).max(365),
    creditLimit: optionalMoney,
    customerGroupId: z.uuid().nullable().optional(),
    ownerUserId: z.uuid().nullable().optional(),
    note: blankToNull(1000),
    status: z.enum(["active", "inactive"]).default("active"),
    version: z.number().int().min(0),
  })
  .strict()
  .refine((value) => value.isCustomer || value.isSupplier, { path: ["isCustomer"], message: "invalidValue" });
export interface PartnerProfileOptionsResponse {
  customerGroups: { id: string; name: string }[];
  users: { id: string; fullName: string }[];
}

// CONG_VIEC_07, API_73 đến API_75: Mua hàng trong nước (CHUC_NANG_49 đến 51; QUYTAC_NGHIEPVU_61 đến 64).
const requiredMoney = z.union([z.number(), z.string()]).transform((value, context) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d{1,16}(\.\d{1,4})?$/.test(text)) {
    context.addIssue({ code: "custom", message: "invalidValue" });
    return z.NEVER;
  }
  return text;
});
export const saveSupplierPriceSchema = z
  .object({
    supplierId: z.uuid(),
    variantId: z.uuid(),
    unitId: z.uuid(),
    minQuantity: z
      .union([z.number(), z.string()])
      .optional()
      .transform((value, context) => {
        const text = value === undefined || String(value).trim() === "" ? "0" : String(value).trim().replace(",", ".");
        if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) {
          context.addIssue({ code: "custom", message: "invalidValue" });
          return z.NEVER;
        }
        return text;
      }),
    unitPrice: requiredMoney,
    supplierSku: blankToNull(50),
    validFrom: isoDate,
    validTo: isoDate.nullable().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((value) => !value.validTo || value.validTo >= value.validFrom, { path: ["validTo"], message: "invalidValue" });
export type SaveSupplierPriceRequest = z.input<typeof saveSupplierPriceSchema>;
export const supplierPriceListQuerySchema = z
  .object({
    supplierId: z.uuid().optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface SupplierPriceResponse {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitId: string;
  unitName: string;
  minQuantity: string;
  unitPrice: string;
  supplierSku: string | null;
  validFrom: string;
  validTo: string | null;
  status: "active" | "inactive";
  version: number;
}
export const supplierPriceLookupQuerySchema = z
  .object({ supplierId: z.uuid(), variantId: z.uuid(), unitId: z.uuid(), quantity: z.string().trim().optional(), date: isoDate.optional() })
  .strict();
export interface SupplierPriceLookupResponse {
  unitPrice: string | null;
  priceId: string | null;
  // CONG_VIEC_09: nhà cung cấp nội bộ thì giá theo bảng giá kênh "Nội bộ" bên bán, không sửa tay; vatRate theo bên bán.
  internal?: { vatRate: VatRate } | undefined;
}
export interface PurchasingOptionsResponse {
  suppliers: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  currency: string;
}
export interface PurchasingSettingsResponse {
  overReceiptTolerancePercent: string;
  version: number;
}
export const updatePurchasingSettingsSchema = z
  .object({
    overReceiptTolerancePercent: z
      .union([z.number(), z.string()])
      .transform((value, context) => {
        const text = String(value).trim().replace(",", ".");
        if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || Number(text) > 100) {
          context.addIssue({ code: "custom", message: "invalidValue" });
          return z.NEVER;
        }
        return text;
      }),
    version: z.number().int().min(0),
  })
  .strict();

export const purchaseDocumentStatuses = ["counterpart_pending", "draft", "pending", "approved", "rejected", "withdrawn", "received", "closed"] as const;
export type PurchaseDocumentStatus = (typeof purchaseDocumentStatuses)[number];
export const saveRequisitionSchema = z
  .object({
    warehouseId: z.uuid(),
    neededBy: isoDate,
    reason: z.string().trim().min(1).max(500),
    lines: z
      .array(
        z
          .object({
            variantId: z.uuid(),
            unitId: z.uuid(),
            quantity: positiveQuantity,
            estimatedUnitPrice: optionalMoney,
            suggestedSupplierId: z.uuid().nullable().optional(),
            note: blankToNull(300),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveRequisitionRequest = z.input<typeof saveRequisitionSchema>;
export const purchaseListQuerySchema = z
  .object({
    status: z.enum(purchaseDocumentStatuses).optional(),
    supplierId: z.uuid().optional(),
    search: z.string().trim().max(100).optional(),
    openOnly: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface RequisitionListItem {
  id: string;
  documentNo: string | null;
  warehouseName: string;
  neededBy: string;
  reason: string;
  status: PurchaseDocumentStatus;
  lineCount: number;
  estimatedTotal: string;
  createdByName: string;
  createdAt: string;
}
export interface RequisitionLineResponse {
  id: string;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitId: string;
  unitName: string;
  quantity: string;
  baseQuantity: string;
  estimatedUnitPrice: string;
  suggestedSupplierId: string | null;
  suggestedSupplierName: string | null;
  note: string | null;
  // Đã đặt trên đơn mua chưa hủy, theo đơn vị cơ sở.
  orderedBaseQuantity: string;
}
export interface RequisitionResponse extends RequisitionListItem {
  warehouseId: string;
  approvalRequestId: string | null;
  lines: RequisitionLineResponse[];
  version: number;
  canEdit: boolean;
  canWithdraw: boolean;
  canOrder: boolean;
}

export const savePurchaseOrderSchema = z
  .object({
    supplierId: z.uuid(),
    warehouseId: z.uuid(),
    orderDate: isoDate,
    expectedDate: isoDate.nullable().optional(),
    note: blankToNull(1000),
    lines: z
      .array(
        z
          .object({
            id: z.uuid().optional(),
            variantId: z.uuid(),
            unitId: z.uuid(),
            quantity: positiveQuantity,
            unitPrice: requiredMoney,
            vatRate: z.enum(vatRates),
            requisitionLineId: z.uuid().nullable().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePurchaseOrderRequest = z.input<typeof savePurchaseOrderSchema>;
export interface PurchaseOrderListItem {
  id: string;
  documentNo: string | null;
  supplierId: string;
  supplierName: string;
  warehouseName: string;
  orderDate: string;
  expectedDate: string | null;
  currency: string;
  totalAmount: string;
  taxAmount: string;
  status: PurchaseDocumentStatus;
  createdByName: string;
}
export interface PurchaseOrderLineResponse {
  id: string;
  lineNo: number;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitId: string;
  unitName: string;
  factor: string;
  quantity: string;
  baseQuantity: string;
  unitPrice: string;
  vatRate: VatRate;
  amount: string;
  requisitionLineId: string | null;
  // Theo đơn vị cơ sở, tính từ phiếu kho.
  receivedBaseQuantity: string;
  returnedBaseQuantity: string;
  // Còn nhận được (đã trừ đã nhận, cộng dung sai) theo đơn vị cơ sở.
  receivableBaseQuantity: string;
}
export interface PurchaseOrderResponse extends PurchaseOrderListItem {
  warehouseId: string | null;
  // CONG_VIEC_09: giao dịch nội bộ. counterpart là chứng từ đối ứng ở công ty bên kia (chỉ tên công ty, số, trạng thái).
  isInternal: boolean;
  isCounterpart: boolean;
  counterpart: { companyName: string; documentNo: string | null; status: string } | null;
  counterpartRejectedReason: string | null;
  canConfirmCounterpart: boolean;
  note: string | null;
  approvalRequestId: string | null;
  closedReason: string | null;
  lines: PurchaseOrderLineResponse[];
  receipts: { id: string; documentNo: string | null; type: "purchase_receipt" | "purchase_return"; status: string; documentDate: string }[];
  version: number;
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canClose: boolean;
}
export const closePurchaseOrderSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().positive() }).strict();
// CONG_VIEC_09, API_80, API_81: xác nhận (chọn kho), từ chối chứng từ đối ứng nội bộ.
export const confirmCounterpartSchema = z.object({ warehouseId: z.uuid(), version: z.number().int().positive() }).strict();
export const rejectCounterpartSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().positive() }).strict();

// CONG_VIEC_07, API_76: phiếu nhập mua theo đơn mua, kết quả kiểm tra chất lượng, phiếu trả hàng nhà cung cấp (CHUC_NANG_52, 53; QUYTAC_NGHIEPVU_64 đến 66).
const serialList = z.array(z.string().trim().min(1).max(100)).max(1000).default([]);
export const savePurchaseReceiptSchema = z
  .object({
    orderId: z.uuid(),
    documentDate: isoDate,
    note: blankToNull(1000),
    lines: z
      .array(
        z
          .object({
            orderLineId: z.uuid(),
            quantity: positiveQuantity,
            lotNo: z.string().trim().max(50).nullable().optional(),
            manufacturedOn: isoDate.nullable().optional(),
            expiresOn: isoDate.nullable().optional(),
            locationId: z.uuid().nullable().optional(),
            serials: serialList,
          })
          .strict(),
      )
      .min(1)
      .max(200),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePurchaseReceiptRequest = z.input<typeof savePurchaseReceiptSchema>;
export const qualityCheckSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            lineId: z.uuid(),
            // Số không đạt theo đơn vị của dòng; hàng serial ghi danh sách serial không đạt.
            rejectedQuantity: z
              .union([z.number(), z.string()])
              .transform((value, context) => {
                const text = String(value).trim().replace(",", ".") || "0";
                if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) {
                  context.addIssue({ code: "custom", message: "invalidValue" });
                  return z.NEVER;
                }
                return text;
              }),
            rejectedSerials: serialList,
            rejectionReason: blankToNull(500),
          })
          .strict(),
      )
      .max(200),
    version: z.number().int().positive(),
  })
  .strict();
export const savePurchaseReturnSchema = z
  .object({
    receiptId: z.uuid(),
    documentDate: isoDate,
    reason: z.string().trim().min(1).max(500),
    note: blankToNull(1000),
    lines: z
      .array(z.object({ receiptLineId: z.uuid(), quantity: positiveQuantity, serials: serialList }).strict())
      .min(1)
      .max(200),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePurchaseReturnRequest = z.input<typeof savePurchaseReturnSchema>;

// CONG_VIEC_08, API_77 đến API_79: Bán hàng (CHUC_NANG_54 đến 57; QUYTAC_NGHIEPVU_67 đến 72).
export const salesOrderStatuses = ["counterpart_pending", "draft", "pending", "confirmed", "rejected", "withdrawn", "delivered", "cancelled", "closed"] as const;
export type SalesOrderStatus = (typeof salesOrderStatuses)[number];
export const salesExceptionKinds = ["discount", "below_cost", "credit_limit"] as const;
export type SalesExceptionKind = (typeof salesExceptionKinds)[number];
const percentText = z
  .union([z.number(), z.string()])
  .optional()
  .transform((value, context) => {
    const text = value === undefined || String(value).trim() === "" ? "0" : String(value).trim().replace(",", ".");
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || Number(text) > 100) {
      context.addIssue({ code: "custom", message: "invalidValue" });
      return z.NEVER;
    }
    return text;
  });
export const saveSalesOrderSchema = z
  .object({
    customerId: z.uuid().nullable().optional(),
    buyerName: blankToNull(200),
    channelId: z.uuid(),
    warehouseId: z.uuid(),
    orderDate: isoDate,
    deliveryAddress: blankToNull(500),
    note: blankToNull(1000),
    lines: z
      .array(z.object({ variantId: z.uuid(), unitId: z.uuid(), quantity: positiveQuantity, discountPercent: percentText }).strict())
      .min(1)
      .max(200),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveSalesOrderRequest = z.input<typeof saveSalesOrderSchema>;
export const salesOrderListQuerySchema = z
  .object({
    status: z.enum(salesOrderStatuses).optional(),
    customerId: z.uuid().optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface SalesOrderListItem {
  id: string;
  documentNo: string | null;
  customerId: string | null;
  customerName: string | null;
  buyerName: string | null;
  channelName: string;
  warehouseName: string;
  orderDate: string;
  currency: string;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  status: SalesOrderStatus;
  createdByName: string;
}
export interface SalesOrderLineResponse {
  id: string;
  lineNo: number;
  variantId: string;
  sku: string;
  productName: string;
  optionValues: string[];
  unitId: string;
  unitName: string;
  quantity: string;
  baseQuantity: string;
  priceListCode: string | null;
  listPrice: string;
  priceIncludesVat: boolean;
  discountPercent: string;
  unitPrice: string;
  vatRate: VatRate;
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  // Theo đơn vị cơ sở, tính từ phiếu kho.
  deliveredBaseQuantity: string;
  returnedBaseQuantity: string;
  // CONG_VIEC_12: khuyến mãi theo sản phẩm (hoặc chương trình tặng của dòng tặng), phần giảm theo đơn chia vào dòng (gồm thuế).
  isGift: boolean;
  promotionName: string | null;
  promotionPercent: string;
  orderPromotionName: string | null;
  orderDiscountAmount: string;
}
export interface SalesOrderResponse extends SalesOrderListItem {
  // CONG_VIEC_12: suất tặng thiếu do kho xuất không đủ hàng tặng lúc lưu đơn.
  giftShortages: { promotionName: string; missingSets: number }[];
  channelId: string;
  warehouseId: string | null;
  // CONG_VIEC_09: giao dịch nội bộ. counterpart là chứng từ đối ứng ở công ty bên kia (chỉ tên công ty, số, trạng thái).
  isInternal: boolean;
  isCounterpart: boolean;
  counterpart: { companyName: string; documentNo: string | null; status: string } | null;
  counterpartRejectedReason: string | null;
  canConfirmCounterpart: boolean;
  deliveryAddress: string | null;
  note: string | null;
  approvalRequestId: string | null;
  exceptions: { kind: SalesExceptionKind; lineNo: number | null; detail: string }[];
  closedReason: string | null;
  lines: SalesOrderLineResponse[];
  documents: { id: string; documentNo: string | null; type: "sales_issue" | "sales_return"; status: string; documentDate: string }[];
  version: number;
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canCancel: boolean;
  canClose: boolean;
}
export interface SalesOptionsResponse {
  customers: { id: string; code: string; name: string; customerGroupId: string | null }[];
  channels: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  currency: string;
  // CONG_VIEC_43 (lát L4): cài đặt "Cho phép lập đơn bán tay có hàng hóa"; tắt thì ô chọn mặt hàng chỉ hiện dịch vụ.
  allowManualGoodsOrders: boolean;
}
export const salesPriceQuerySchema = z
  .object({ variantId: z.uuid(), unitId: z.uuid(), channelId: z.uuid(), customerId: z.uuid().optional(), date: isoDate.optional() })
  .strict();
export interface SalesPriceResponse {
  price: string | null;
  priceListCode: string | null;
  includesVat: boolean;
  vatRate: VatRate;
}
export interface SalesSettingsResponse {
  maxManualDiscountPercent: string;
  // CONG_VIEC_43 (QUYTAC_NGHIEPVU_276): cho phép lập đơn bán tay có hàng hóa (mặc định tắt).
  allowManualGoodsOrders: boolean;
  version: number;
}
// Bỏ trống allowManualGoodsOrders thì giữ giá trị đang lưu.
export const updateSalesSettingsSchema = z
  .object({ maxManualDiscountPercent: percentText, allowManualGoodsOrders: z.boolean().optional(), version: z.number().int().min(0) })
  .strict();
export const closeSalesOrderSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().positive() }).strict();

export const saveSalesIssueSchema = z
  .object({
    orderId: z.uuid(),
    documentDate: isoDate,
    note: blankToNull(1000),
    lines: z
      .array(
        z
          .object({
            orderLineId: z.uuid(),
            quantity: positiveQuantity,
            lotId: z.uuid().nullable().optional(),
            lotOverrideReason: z.string().trim().max(200).nullable().optional(),
            locationId: z.uuid().nullable().optional(),
            serials: serialList,
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();
export type SaveSalesIssueRequest = z.input<typeof saveSalesIssueSchema>;
export const saveSalesReturnSchema = z
  .object({
    issueId: z.uuid(),
    documentDate: isoDate,
    reason: z.string().trim().min(1).max(500),
    note: blankToNull(1000),
    lines: z
      // Số lượng trả theo đơn vị cơ sở của mặt hàng.
      .array(z.object({ issueLineId: z.uuid(), quantity: positiveQuantity, serials: serialList }).strict())
      .min(1)
      .max(200),
  })
  .strict();
export type SaveSalesReturnRequest = z.input<typeof saveSalesReturnSchema>;

// CONG_VIEC_12, API_83: chương trình khuyến mãi (CHUC_NANG_62 đến 64; QUYTAC_NGHIEPVU_79 đến 84).
export const promotionKinds = ["product_discount", "order_discount", "buy_get"] as const;
export type PromotionKind = (typeof promotionKinds)[number];
export const promotionStatuses = ["draft", "pending", "active", "rejected", "withdrawn", "stopped"] as const;
export type PromotionStatus = (typeof promotionStatuses)[number];
const optionalPositive = z
  .union([positiveQuantity, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value === undefined ? null : value));
export const savePromotionSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kind: z.enum(promotionKinds),
    validFrom: isoDate,
    validTo: isoDate,
    channelIds: z.array(z.uuid()).max(50).default([]),
    customerGroupIds: z.array(z.uuid()).max(50).default([]),
    // Giảm theo sản phẩm: mỗi mặt hàng một phần trăm giảm.
    items: z
      .array(z.object({ variantId: z.uuid(), discountPercent: percentText }).strict())
      .max(500)
      .default([]),
    // Giảm theo đơn: ngưỡng gồm thuế, phần trăm, trần (trống: không giới hạn).
    minOrderAmount: optionalDecimal(4),
    orderDiscountPercent: optionalDecimal(2),
    maxOrderDiscount: optionalPositive,
    // Mua X tặng Y: số lượng theo đơn vị cơ sở.
    buyVariantId: z.uuid().nullable().optional(),
    buyQuantity: optionalPositive,
    giftVariantId: z.uuid().nullable().optional(),
    giftQuantity: optionalPositive,
    budgetAmount: optionalPositive,
    maxGiftSets: z.number().int().positive().max(1000000000).nullable().optional(),
    note: blankToNull(1000),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const missing = (path: string) => context.addIssue({ code: "custom", message: "required", path: [path] });
    if (value.validTo < value.validFrom) context.addIssue({ code: "custom", message: "invalidValue", path: ["validTo"] });
    if (value.kind === "product_discount") {
      if (value.items.length === 0) missing("items");
      value.items.forEach((item, index) => {
        if (Number(item.discountPercent) <= 0) context.addIssue({ code: "custom", message: "invalidValue", path: ["items", index, "discountPercent"] });
      });
      if (new Set(value.items.map((item) => item.variantId)).size !== value.items.length) context.addIssue({ code: "custom", message: "invalidValue", path: ["items"] });
    }
    if (value.kind === "order_discount") {
      if (value.minOrderAmount === null) missing("minOrderAmount");
      if (value.orderDiscountPercent === null) missing("orderDiscountPercent");
      else if (Number(value.orderDiscountPercent) <= 0 || Number(value.orderDiscountPercent) > 100)
        context.addIssue({ code: "custom", message: "invalidValue", path: ["orderDiscountPercent"] });
    }
    if (value.kind === "buy_get") {
      if (!value.buyVariantId) missing("buyVariantId");
      if (value.buyQuantity === null) missing("buyQuantity");
      if (!value.giftVariantId) missing("giftVariantId");
      if (value.giftQuantity === null) missing("giftQuantity");
    }
  });
export type SavePromotionRequest = z.input<typeof savePromotionSchema>;
export const promotionListQuerySchema = z.object({ status: z.enum(promotionStatuses).optional() }).strict();
export const stopPromotionSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().positive() }).strict();
export interface PromotionListItem {
  id: string;
  documentNo: string | null;
  name: string;
  kind: PromotionKind;
  validFrom: string;
  validTo: string;
  status: PromotionStatus;
  // Đã dùng: tiền đã giảm (gồm thuế), số suất đã tặng, tính từ đơn bán chờ duyệt, đã xác nhận, đã giao, đã đóng.
  usedAmount: string;
  usedGiftSets: number;
  budgetAmount: string | null;
  maxGiftSets: number | null;
  createdByName: string;
}
export interface PromotionResponse extends PromotionListItem {
  channels: { id: string; name: string }[];
  customerGroups: { id: string; name: string }[];
  items: { variantId: string; sku: string; productName: string; discountPercent: string }[];
  minOrderAmount: string | null;
  orderDiscountPercent: string | null;
  maxOrderDiscount: string | null;
  buy: { variantId: string; sku: string; productName: string; quantity: string; baseUnitName: string } | null;
  gift: { variantId: string; sku: string; productName: string; quantity: string; baseUnitName: string } | null;
  note: string | null;
  approvalRequestId: string | null;
  stoppedReason: string | null;
  currency: string;
  version: number;
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canStop: boolean;
}
export interface PromotionOptionsResponse {
  channels: { id: string; code: string; name: string }[];
  customerGroups: { id: string; code: string; name: string }[];
  currency: string;
}

// CONG_VIEC_09, API_82: nhận hàng nội bộ theo số thực nhận (đơn vị cơ sở bên nhận); biên bản chênh lệch nội bộ (QUYTAC_NGHIEPVU_76, 77).
export const receiveInternalSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            lineId: z.uuid(),
            receivedQuantity: z.union([z.number(), z.string()]).transform((value, context) => {
              const text = String(value).trim().replace(",", ".");
              if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) {
                context.addIssue({ code: "custom", message: "invalidValue" });
                return z.NEVER;
              }
              return text;
            }),
            locationId: z.uuid().nullable().optional(),
            serials: z.array(z.string().trim().min(1).max(100)).max(5000).default([]),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    shortageReason: blankToNull(500),
    version: z.number().int().positive(),
  })
  .strict();
export type ReceiveInternalRequest = z.input<typeof receiveInternalSchema>;
export const internalDiscrepancyStatuses = ["open", "returned", "written_off"] as const;
export type InternalDiscrepancyStatus = (typeof internalDiscrepancyStatuses)[number];
export const internalDiscrepancyListQuerySchema = z.object({ status: z.enum(internalDiscrepancyStatuses).optional() }).strict();
export interface InternalDiscrepancyItem {
  id: string;
  warehouseName: string;
  issueId: string;
  issueDocumentNo: string | null;
  receiptId: string;
  receiptDocumentNo: string | null;
  buyerCompanyName: string;
  sku: string;
  productName: string;
  baseUnitName: string;
  shortageBaseQuantity: string;
  value: string | null;
  currency: string;
  serials: string[];
  reason: string;
  status: InternalDiscrepancyStatus;
  returnDocumentId: string | null;
  resolutionNote: string | null;
  resolvedByName: string | null;
  createdAt: string;
  version: number;
  canResolve: boolean;
}
export const resolveInternalDiscrepancySchema = z
  .object({ action: z.enum(["return", "write_off"]), note: blankToNull(500), version: z.number().int().positive() })
  .strict();

// CONG_VIEC_13: Công nợ phải thu, phải trả (MODULE_06, phần 1; API_84 đến API_86).
export const fundKinds = ["cash", "bank"] as const;
export type FundKind = (typeof fundKinds)[number];
export const saveFundSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(200),
    kind: z.enum(fundKinds),
    bankName: blankToNull(200),
    accountNo: blankToNull(50),
    accountHolder: blankToNull(200),
    openingBalance: decimalText(4).default("0"),
    status: z.enum(["active", "inactive"]).default("active"),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveFundRequest = z.input<typeof saveFundSchema>;
export interface FundResponse {
  id: string;
  code: string;
  name: string;
  kind: FundKind;
  bankName: string | null;
  accountNo: string | null;
  accountHolder: string | null;
  openingBalance: string;
  balance: string;
  status: "active" | "inactive";
  hasPostings: boolean;
  currency: string;
  version: number;
  canManage: boolean;
}
export const fundLedgerQuerySchema = z.object({ from: isoDate, to: isoDate }).strict();
export interface FundLedgerEntry {
  paymentId: string;
  date: string;
  documentNo: string;
  kind: PaymentKind;
  partnerName: string;
  receipt: string;
  payment: string;
  balance: string;
}
export interface FundLedgerResponse {
  fund: FundResponse;
  from: string;
  to: string;
  openingBalance: string;
  entries: FundLedgerEntry[];
  closingBalance: string;
}

export const debtSides = ["receivable", "payable"] as const;
export type DebtSide = (typeof debtSides)[number];
export const debtSourceTypes = ["opening", "sales_issue", "sales_return", "purchase_receipt", "purchase_return", "payment", "internal_write_off", "collection_statement"] as const;
export type DebtSourceType = (typeof debtSourceTypes)[number];
export const debtSummaryQuerySchema = z
  .object({ side: z.enum(debtSides), search: z.string().trim().max(100).optional(), overdueOnly: z.enum(["true", "false"]).optional() })
  .strict();
export interface DebtAgeing {
  notDue: string;
  overdue1To30: string;
  overdue31To60: string;
  overdue61To90: string;
  overdueOver90: string;
}
export interface DebtPartnerSummary extends DebtAgeing {
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  balance: string;
  advance: string;
}
export interface DebtSummaryResponse {
  side: DebtSide;
  currency: string;
  partners: DebtPartnerSummary[];
  totals: DebtAgeing & { balance: string; advance: string };
}
export interface DebtAllocationResponse {
  itemId: string;
  documentNo: string;
  sourceType: DebtSourceType;
  amount: string;
  date: string;
}
export interface DebtItemResponse {
  id: string;
  direction: "debit" | "credit";
  sourceType: DebtSourceType;
  sourceId: string | null;
  paymentKind: PaymentKind | null;
  documentNo: string;
  documentDate: string;
  dueDate: string | null;
  amount: string;
  openAmount: string;
  overdueDays: number;
  note: string | null;
  canDelete: boolean;
  allocations: DebtAllocationResponse[];
}
export interface DebtPartnerResponse {
  partner: { id: string; code: string; name: string };
  side: DebtSide;
  currency: string;
  balance: string;
  advance: string;
  ageing: DebtAgeing;
  items: DebtItemResponse[];
  canManageOpening: boolean;
  canManagePayments: boolean;
}
export const debtPartnerQuerySchema = z.object({ side: z.enum(debtSides) }).strict();
export const saveOpeningDebtSchema = z
  .object({
    partnerId: z.uuid(),
    side: z.enum(debtSides),
    direction: z.enum(["debit", "credit"]),
    documentNo: z.string().trim().min(1).max(50),
    documentDate: isoDate,
    dueDate: isoDate.nullable().optional(),
    amount: positiveQuantity,
    note: blankToNull(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.direction === "debit" && !value.dueDate) context.addIssue({ code: "custom", path: ["dueDate"], message: "required" });
    if (value.dueDate && value.dueDate < value.documentDate) context.addIssue({ code: "custom", path: ["dueDate"], message: "invalidValue" });
  });
export type SaveOpeningDebtRequest = z.input<typeof saveOpeningDebtSchema>;
export const financePartnerQuerySchema = z.object({ side: z.enum(debtSides), search: z.string().trim().max(100).optional() }).strict();
export interface FinancePartnerOption {
  id: string;
  code: string;
  name: string;
}

export const paymentKinds = ["customer_receipt", "supplier_payment", "customer_refund", "supplier_refund"] as const;
export type PaymentKind = (typeof paymentKinds)[number];
export const paymentStatuses = ["draft", "pending", "posted", "rejected", "withdrawn"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];
// Phía công nợ và hướng của từng loại phiếu (QUYTAC_NGHIEPVU_88).
export const paymentKindSide: Record<PaymentKind, DebtSide> = {
  customer_receipt: "receivable",
  customer_refund: "receivable",
  supplier_payment: "payable",
  supplier_refund: "payable",
};
export const paymentKindIsReceipt = (kind: PaymentKind) => kind === "customer_receipt" || kind === "supplier_refund";
export const paymentKindSettles = (kind: PaymentKind) => kind === "customer_receipt" || kind === "supplier_payment";
export const paymentListQuerySchema = z
  .object({ kind: z.enum(paymentKinds).optional(), status: z.enum(paymentStatuses).optional(), partnerId: z.uuid().optional() })
  .strict();
export const savePaymentSchema = z
  .object({
    kind: z.enum(paymentKinds),
    partnerId: z.uuid(),
    fundId: z.uuid(),
    paymentDate: isoDate,
    amount: positiveQuantity,
    note: blankToNull(500),
    lines: z
      .array(z.object({ debitItemId: z.uuid(), amount: positiveQuantity }).strict())
      .max(500)
      .default([]),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePaymentRequest = z.input<typeof savePaymentSchema>;
export interface PaymentListItem {
  id: string;
  documentNo: string | null;
  kind: PaymentKind;
  paymentDate: string;
  partnerName: string;
  fundName: string;
  amount: string;
  status: PaymentStatus;
}
export interface OpenDebtResponse {
  id: string;
  documentNo: string;
  sourceType: DebtSourceType;
  documentDate: string;
  dueDate: string;
  amount: string;
  openAmount: string;
  overdueDays: number;
}
export interface PaymentResponse {
  id: string;
  documentNo: string | null;
  kind: PaymentKind;
  partner: { id: string; code: string; name: string };
  fund: { id: string; code: string; name: string };
  paymentDate: string;
  amount: string;
  currency: string;
  note: string | null;
  status: PaymentStatus;
  approvalRequestId: string | null;
  // Khóa thông báo lỗi (nhóm errors) khi duyệt xong mà không ghi sổ được.
  postError: string | null;
  lines: (OpenDebtResponse & { allocated: string })[];
  unallocated: string;
  createdByName: string;
  postedAt: string | null;
  version: number;
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
}
export const openDebtQuerySchema = z.object({ side: z.enum(debtSides), partnerId: z.uuid(), paymentId: z.uuid().optional() }).strict();
export interface PaymentOptionsResponse {
  funds: { id: string; code: string; name: string; kind: FundKind; balance: string }[];
  currency: string;
}
export interface OpenDebtsResponse {
  items: OpenDebtResponse[];
  advance: string;
}

// CONG_VIEC_14: Kế toán tổng hợp (MODULE_06, phần 2; API_87 đến API_89).
// Chế độ kế toán lấy theo công ty (accountingRegimes, API_20).
export type AccountingRegime = (typeof accountingRegimes)[number];
export interface LedgerSetupResponse {
  initialized: boolean;
  regime: AccountingRegime | null;
  lockedThrough: string | null;
  regimeName: string;
  canSetup: boolean;
}
export interface AccountResponse {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  nature: "debit" | "credit" | "both";
  isSystem: boolean;
  status: "active" | "inactive";
  postable: boolean;
  isLongTerm: boolean;
  hasLines: boolean;
  version: number;
  canEdit: boolean;
}
export const saveAccountSchema = z
  .object({ parentId: z.uuid(), code: z.string().trim().regex(/^[0-9A-Za-z]{3,20}$/), name: z.string().trim().min(1).max(200) })
  .strict();
export type SaveAccountRequest = z.input<typeof saveAccountSchema>;
export const updateAccountSchema = z
  .object({ name: z.string().trim().min(1).max(200), status: z.enum(["active", "inactive"]), isLongTerm: z.boolean().optional(), version: z.number().int().positive() })
  .strict();
export interface PostingRuleResponse {
  role: string;
  description: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  canEdit: boolean;
}
export const updatePostingRuleSchema = z.object({ accountId: z.uuid() }).strict();
export const journalSourceTypes = ["manual", "inventory_document", "payment", "internal_write_off", "closing", "commission", "collection_statement", "marketplace_payment", "marketplace_refund", "marketplace_commission", "marketplace_withdrawal", "payroll", "payroll_payment"] as const;
export type JournalSourceType = (typeof journalSourceTypes)[number];
export const journalStatuses = ["draft", "pending", "posted", "rejected", "withdrawn"] as const;
export type JournalStatus = (typeof journalStatuses)[number];
export const journalListQuerySchema = z
  .object({ sourceType: z.enum(journalSourceTypes).optional(), status: z.enum(journalStatuses).optional(), from: isoDate.optional(), to: isoDate.optional() })
  .strict();
export interface JournalListItem {
  id: string;
  journalNo: string | null;
  journalDate: string;
  sourceType: JournalSourceType;
  description: string;
  totalAmount: string;
  status: JournalStatus;
}
export interface JournalLineResponse {
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  partnerId: string | null;
  partnerName: string | null;
  debit: string;
  credit: string;
  description: string | null;
}
export interface JournalResponse extends JournalListItem {
  sourceId: string | null;
  currency: string;
  lines: JournalLineResponse[];
  approvalRequestId: string | null;
  postError: string | null;
  createdByName: string | null;
  version: number;
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
}
export const saveJournalSchema = z
  .object({
    journalDate: isoDate,
    description: z.string().trim().min(1).max(500),
    lines: z
      .array(
        z
          .object({
            accountId: z.uuid(),
            partnerId: z.uuid().nullable().optional(),
            debit: decimalText(4).default("0"),
            credit: decimalText(4).default("0"),
            description: blankToNull(300),
          })
          .strict(),
      )
      .min(2)
      .max(200),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveJournalRequest = z.input<typeof saveJournalSchema>;
export interface LedgerPeriodsResponse {
  lockedThrough: string | null;
  nextMonth: string | null;
  canClose: boolean;
  canReopen: boolean;
  lastClosedMonth: string | null;
}
export const closePeriodSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).strict();
export const ledgerRangeQuerySchema = z.object({ from: isoDate, to: isoDate }).strict();
export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  depth: number;
  openingDebit: string;
  openingCredit: string;
  debit: string;
  credit: string;
  closingDebit: string;
  closingCredit: string;
}
export interface TrialBalanceResponse {
  from: string;
  to: string;
  currency: string;
  rows: TrialBalanceRow[];
  totals: Omit<TrialBalanceRow, "accountId" | "code" | "name" | "depth">;
}
export interface AccountLedgerEntry {
  journalId: string;
  journalNo: string | null;
  journalDate: string;
  description: string;
  accountCode: string;
  counterAccounts: string[];
  partnerName: string | null;
  debit: string;
  credit: string;
  balance: string;
}
export interface AccountLedgerResponse {
  account: { id: string; code: string; name: string; nature: "debit" | "credit" | "both" };
  from: string;
  to: string;
  currency: string;
  openingBalance: string;
  entries: AccountLedgerEntry[];
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
}

// CONG_VIEC_15: Báo cáo tài chính (API_90).
export const statementKinds = ["balance_sheet", "income_statement"] as const;
export type StatementKind = (typeof statementKinds)[number];
export const statementQuerySchema = z
  .object({ kind: z.enum(statementKinds), from: isoDate.optional(), to: isoDate, form: z.string().trim().max(20).optional(), format: z.enum(["xlsx", "pdf"]).optional() })
  .strict()
  .refine((value) => value.kind !== "income_statement" || Boolean(value.from), { path: ["from"], message: "required" });
export interface StatementLineResponse {
  code: string;
  name: string;
  level: number;
  note: string | null;
  current: string;
  previous: string;
}
export interface StatementResponse {
  kind: StatementKind;
  form: string;
  name: string;
  forms: string[];
  regime: AccountingRegime;
  company: { name: string; taxCode: string | null; address: string | null };
  currency: string;
  columns: { label: "endOfPeriod" | "startOfYear" | "currentPeriod" | "previousPeriod" | string; from: string | null; to: string }[];
  lines: StatementLineResponse[];
}

// CONG_VIEC_16: Hóa đơn điện tử (API_91, API_92; CHUC_NANG_76 đến 79).
export const einvoiceProviders = ["simulator", "misa"] as const;
export type EinvoiceProvider = (typeof einvoiceProviders)[number];
export const einvoiceSimulations = ["normal", "pending_code", "temporary_error", "data_error", "timeout", "rejected"] as const;
export type EinvoiceSimulation = (typeof einvoiceSimulations)[number];
export const einvoiceStatuses = ["pending", "retrying", "awaiting_code", "issued", "failed", "rejected", "setup_error"] as const;
export type EinvoiceStatus = (typeof einvoiceStatuses)[number];
export const einvoiceKinds = ["original", "adjustment", "replacement"] as const;
export type EinvoiceKind = (typeof einvoiceKinds)[number];
export const updateEinvoiceSettingsSchema = z
  .object({
    enabled: z.boolean(),
    startDate: isoDate.nullable(),
    provider: z.enum(einvoiceProviders),
    environment: z.enum(["test", "production"]),
    withTaxCode: z.boolean(),
    templateCode: z.enum(["1", "2"]),
    appId: blankToNull(100),
    taxCode: blankToNull(20),
    username: blankToNull(100),
    // Để trống: giữ mật khẩu cũ.
    password: z.string().max(200).optional(),
    simulation: z.enum(einvoiceSimulations).default("normal"),
    series: z
      .array(z.object({ year: z.number().int().min(2000).max(2099), series: z.string().trim().toUpperCase().regex(/^[CK][0-9]{2}T[A-Z]{2}$/, "invalidValue") }).strict())
      .max(20)
      .default([]),
    version: z.number().int().min(0),
  })
  .strict();
export type UpdateEinvoiceSettingsRequest = z.input<typeof updateEinvoiceSettingsSchema>;
export interface EinvoiceSettingsResponse {
  enabled: boolean;
  startDate: string | null;
  provider: EinvoiceProvider;
  environment: "test" | "production";
  withTaxCode: boolean;
  templateCode: "1" | "2";
  appId: string | null;
  taxCode: string | null;
  username: string | null;
  passwordLastFour: string | null;
  simulation: EinvoiceSimulation;
  series: { year: number; series: string }[];
  simulatorAllowed: boolean;
  canSetup: boolean;
  version: number;
}
export const einvoiceListQuerySchema = z
  .object({
    status: z.enum(einvoiceStatuses).optional(),
    overdue: z.enum(["true", "false"]).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface EinvoiceListItem {
  id: string;
  kind: EinvoiceKind;
  invoiceDate: string;
  series: string | null;
  invoiceNo: string | null;
  buyerName: string;
  totalAmount: string;
  currency: string;
  status: EinvoiceStatus;
  overdue: boolean;
  replaced: boolean;
  sourceDocumentNo: string | null;
}
export interface EinvoiceParty {
  partnerId?: string | null;
  name: string | null;
  taxCode: string | null;
  address: string | null;
  anonymous?: boolean;
}
export interface EinvoiceLineResponse {
  lineNo: number;
  itemCode: string | null;
  itemName: string;
  unitName: string | null;
  quantity: string;
  unitPrice: string;
  vatRate: "0" | "5" | "8" | "10" | "exempt" | "not_declared";
  netAmount: string;
  taxAmount: string;
  totalAmount: string;
  isPromotion: boolean;
}
export interface EinvoiceResponse extends EinvoiceListItem {
  provider: EinvoiceProvider;
  templateCode: string;
  withTaxCode: boolean;
  taxAuthorityCode: string | null;
  referenceId: string;
  seller: EinvoiceParty;
  buyer: EinvoiceParty;
  netAmount: string;
  taxAmount: string;
  note: string | null;
  lastError: string | null;
  dueDate: string;
  issuedAt: string | null;
  sourceDocumentId: string;
  related: { id: string; kind: EinvoiceKind; series: string | null; invoiceNo: string | null; invoiceDate: string; status: EinvoiceStatus; relation: "original" | "replaced_by" | "adjusted_by" }[];
  lines: EinvoiceLineResponse[];
  taxSummary: { vatRate: string; netAmount: string; taxAmount: string }[];
  attempts: { operation: "publish" | "status"; startedAt: string; finishedAt: string | null; outcome: string | null; errorCode: string | null; message: string | null }[];
  hasPdf: boolean;
  hasXml: boolean;
  canManage: boolean;
  version: number;
}
export const einvoiceReturnStatuses = ["open", "adjusted", "buyer_invoice"] as const;
export type EinvoiceReturnStatus = (typeof einvoiceReturnStatuses)[number];
export const einvoiceReturnQuerySchema = z.object({ status: z.enum(einvoiceReturnStatuses).optional() }).strict();
export interface EinvoiceReturnTask {
  id: string;
  status: EinvoiceReturnStatus;
  returnDocumentId: string;
  returnDocumentNo: string | null;
  returnDate: string;
  buyerName: string;
  buyerTaxCode: string | null;
  returnAmount: string;
  currency: string;
  original: { id: string; series: string | null; invoiceNo: string | null; invoiceDate: string; status: EinvoiceStatus };
  adjustmentInvoiceId: string | null;
  buyerInvoice: { series: string | null; invoiceNo: string; invoiceDate: string } | null;
  canResolve: boolean;
  version: number;
}
export const recordBuyerInvoiceSchema = z
  .object({ series: blankToNull(20), invoiceNo: z.string().trim().min(1).max(20), invoiceDate: isoDate, version: z.number().int().min(0) })
  .strict();
export const replaceEinvoiceSchema = z
  .object({
    buyerName: z.string().trim().min(1).max(300),
    buyerTaxCode: z
      .string()
      .trim()
      .regex(/^[0-9]{10}(-[0-9]{3})?$/, "invalidValue")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    buyerAddress: blankToNull(500),
    reason: z.string().trim().min(1).max(500),
    version: z.number().int().min(0),
  })
  .strict();

// CONG_VIEC_18: Đối soát ngân hàng (API_95 đến API_101).
export const bankProviders = ["simulator", "sepay"] as const;
export type BankProvider = (typeof bankProviders)[number];
export const bankTransactionStatuses = ["unmatched", "matched", "ignored"] as const;
export type BankTransactionStatus = (typeof bankTransactionStatuses)[number];
export const bankDirections = ["in", "out"] as const;
export type BankDirection = (typeof bankDirections)[number];
export const bankSuggestionReasons = ["sales_order", "partner_code", "tax_code"] as const;
export type BankSuggestionReason = (typeof bankSuggestionReasons)[number];

export const saveBankConnectionSchema = z
  .object({
    provider: z.enum(bankProviders),
    enabled: z.boolean(),
    rotateSecret: z.boolean().default(false),
    version: z.number().int().min(0).nullable(),
  })
  .strict();
export interface BankConnectionItem {
  fundId: string;
  fundCode: string;
  fundName: string;
  bankName: string | null;
  accountNo: string | null;
  connection: {
    id: string;
    provider: BankProvider;
    enabled: boolean;
    secretHint: string;
    webhookPath: string;
    lastReceivedAt: string | null;
    version: number;
  } | null;
}
export interface BankConnectionsResponse {
  funds: BankConnectionItem[];
  canSetup: boolean;
  simulatorAllowed: boolean;
}
// Khóa chỉ trả về một lần khi tạo hoặc đổi khóa.
export interface SaveBankConnectionResponse {
  item: BankConnectionItem;
  secret: string | null;
}
export const simulateBankTransactionSchema = z
  .object({
    direction: z.enum(bankDirections),
    amount: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/).refine((value) => Number(value) > 0),
    content: z.string().trim().max(500).default(""),
    transactionDate: isoDate.optional(),
  })
  .strict();

export const bankTransactionListQuerySchema = z
  .object({
    fundId: z.uuid().optional(),
    status: z.enum(bankTransactionStatuses).optional(),
    direction: z.enum(bankDirections).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface BankTransactionItem {
  id: string;
  fundId: string;
  fundName: string;
  transactionAt: string;
  transactionDate: string;
  direction: BankDirection;
  amount: string;
  content: string;
  referenceCode: string | null;
  balanceAfter: string | null;
  status: BankTransactionStatus;
  payment: { id: string; documentNo: string | null; kind: PaymentKind; partnerName: string; paymentDate: string } | null;
  autoMatched: boolean;
  // Lần thanh toán đơn VComm bằng chuyển khoản đã ghép (CONG_VIEC_36).
  marketplacePayment: { reference: string; documentNo: string } | null;
  suggestion: { partnerId: string; partnerName: string; reason: BankSuggestionReason } | null;
  receipt: { id: string; documentNo: string | null; status: string } | null;
  ignoreReason: string | null;
  version: number;
}
export interface BankTransactionsResponse extends PageResponse<BankTransactionItem> {
  canManage: boolean;
  currency: string;
}
export const bankVersionSchema = z.object({ version: z.number().int().min(0) }).strict();
export const confirmBankReceiptSchema = z.object({ partnerId: z.uuid(), version: z.number().int().min(0) }).strict();
export const matchBankTransactionSchema = z.object({ paymentId: z.uuid(), version: z.number().int().min(0) }).strict();
export const ignoreBankTransactionSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().min(0) }).strict();
export interface BankPaymentCandidate {
  id: string;
  documentNo: string | null;
  kind: PaymentKind;
  partnerName: string;
  paymentDate: string;
  amount: string;
  note: string | null;
}
export const bankReconciliationQuerySchema = z.object({ fundId: z.uuid(), from: isoDate, to: isoDate }).strict();
export interface BankReconciliationResponse {
  fundId: string;
  from: string;
  to: string;
  bookBalance: string;
  bankBalance: string | null;
  bankBalanceAt: string | null;
  difference: string | null;
  unmatchedIn: { count: number; amount: string };
  unmatchedOut: { count: number; amount: string };
  ignoredCount: number;
  unmatchedPayments: BankPaymentCandidate[];
  unmatchedPaymentCount: number;
  currency: string;
}

// CONG_VIEC_19: Đối soát thu hộ COD, cổng thanh toán (API_102 đến API_105).
export const collectorKinds = ["cod", "gateway"] as const;
export type CollectorKind = (typeof collectorKinds)[number];
export const collectionStatementStatuses = ["draft", "pending", "posted", "rejected", "withdrawn"] as const;
export type CollectionStatementStatus = (typeof collectionStatementStatuses)[number];
export const collectionImportColumns = ["Mã vận đơn hoặc mã giao dịch", "Số đơn bán", "Tiền thu hộ", "Phí", "Ngày thu"] as const;
export const collectionImportMaximumRows = 5000;
export const collectionImportMaximumBytes = 5 * 1024 * 1024;
// Lỗi chặn gửi và cảnh báo của dòng (QUYTAC_NGHIEPVU_119).
export const collectionLineErrors = ["order_not_found", "order_cancelled", "duplicate_reference", "reference_used"] as const;
export type CollectionLineError = (typeof collectionLineErrors)[number];

export const saveCollectorSchema = z
  .object({ partnerId: z.uuid(), kind: z.enum(collectorKinds), status: z.enum(["active", "inactive"]).default("active"), version: z.number().int().min(0).nullable() })
  .strict();
export interface CollectorItem {
  id: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  kind: CollectorKind;
  status: "active" | "inactive";
  version: number;
}
export interface CollectorsResponse {
  collectors: CollectorItem[];
  canSetup: boolean;
  canManage: boolean;
}
// Nhập tệp: multipart gồm collectorId, statementNo, statementDate, file; có statementId thì nhập lại vào bảng đó.
export const importCollectionStatementSchema = z
  .object({
    collectorId: z.uuid(),
    statementNo: z.string().trim().min(1).max(100),
    statementDate: isoDate,
    statementId: z.uuid().optional(),
    version: z.coerce.number().int().min(0).optional(),
  })
  .strict();
export const collectionStatementListQuerySchema = z
  .object({
    collectorId: z.uuid().optional(),
    status: z.enum(collectionStatementStatuses).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface CollectionStatementListItem {
  id: string;
  collectorName: string;
  collectorKind: CollectorKind;
  statementNo: string;
  documentNo: string | null;
  statementDate: string;
  status: CollectionStatementStatus;
  totalCollected: string;
  totalFee: string;
  netAmount: string;
  lineCount: number;
  errorCount: number;
  postError: string | null;
}
export interface CollectionStatementsResponse extends PageResponse<CollectionStatementListItem> {
  canManage: boolean;
  currency: string;
}
export interface CollectionStatementLine {
  id: string;
  lineNo: number;
  reference: string;
  orderNo: string;
  orderId: string | null;
  customerName: string | null;
  collectedAmount: string;
  feeAmount: string;
  collectedDate: string | null;
  orderOpenAmount: string | null;
  error: CollectionLineError | null;
  amountDiffers: boolean;
}
export interface CollectionStatementResponse extends CollectionStatementListItem {
  collectorId: string;
  partnerId: string;
  lines: CollectionStatementLine[];
  warningCount: number;
  canManage: boolean;
  canWithdraw: boolean;
  currency: string;
  version: number;
}

// CONG_VIEC_20: Báo cáo tài chính hợp nhất (API_106 đến API_109).
export const consolidationExclusionReasons = ["other_currency", "ledger_not_initialized"] as const;
export type ConsolidationExclusionReason = (typeof consolidationExclusionReasons)[number];
export interface ConsolidationMember {
  companyId: string;
  code: string;
  name: string;
  regime: AccountingRegime;
  currency: string;
  isRoot: boolean;
  excludedReason: ConsolidationExclusionReason | null;
}
export interface ConsolidationScopeResponse {
  group: { id: string; name: string };
  currency: string;
  members: ConsolidationMember[];
  canManage: boolean;
}
export const consolidationPreviewQuerySchema = z.object({ kind: z.enum(["balance_sheet", "income_statement"]), from: isoDate, to: isoDate }).strict();
export interface ConsolidatedStatementLine {
  code: string;
  name: string;
  level: number;
  note: string | null;
  combined: string;
  eliminations: string;
  consolidated: string;
  previous: string;
}
export interface ConsolidatedStatementResponse {
  kind: StatementKind;
  form: string;
  name: string;
  group: { id: string; name: string };
  currency: string;
  columns: { label: string; from: string | null; to: string }[];
  memberNames: string[];
  lines: ConsolidatedStatementLine[];
}
export const consolidationStatuses = ["draft", "pending", "posted", "rejected", "withdrawn"] as const;
export type ConsolidationStatus = (typeof consolidationStatuses)[number];
export const consolidationEntryKinds = ["intercompany_balance", "internal_sales", "unrealized_profit", "manual"] as const;
export type ConsolidationEntryKind = (typeof consolidationEntryKinds)[number];
export const createConsolidationSchema = z.object({ from: isoDate, to: isoDate }).strict();
export const consolidationVersionSchema = z.object({ version: z.number().int().min(0) }).strict();
export const saveConsolidationProfitSchema = z
  .object({ amount: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/).nullable(), reason: z.string().trim().max(500).nullable(), version: z.number().int().min(0) })
  .strict();
export const consolidationManualEntrySchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    lines: z
      .array(
        z
          .object({
            accountCode: z.string().trim().min(3).max(10),
            companyId: z.uuid().nullable().default(null),
            partnerId: z.uuid().nullable().default(null),
            debit: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/),
            credit: z.string().regex(/^\d{1,16}(\.\d{1,4})?$/),
          })
          .strict(),
      )
      .min(2)
      .max(20),
    version: z.number().int().min(0),
  })
  .strict();
export interface ConsolidationListItem {
  id: string;
  fromDate: string;
  toDate: string;
  documentNo: string | null;
  status: ConsolidationStatus;
  calculatedAt: string | null;
  postError: string | null;
}
export interface ConsolidationsResponse {
  data: ConsolidationListItem[];
  canManage: boolean;
}
export interface ConsolidationEntry {
  entryNo: number;
  kind: ConsolidationEntryKind;
  description: string;
  lines: { companyName: string; accountCode: string; partnerName: string | null; debit: string; credit: string }[];
}
export interface ConsolidationProfitLine {
  id: string;
  buyerName: string;
  sellerName: string;
  itemName: string;
  internalQuantity: string;
  endingQuantity: string;
  unitMargin: string;
  estimatedAmount: string;
  overrideAmount: string | null;
  overrideReason: string | null;
  effectiveAmount: string;
}
export interface ConsolidationWarning {
  receivableCompany: string;
  payableCompany: string;
  receivable: string;
  payable: string;
  difference: string;
}
export interface ConsolidationResponse extends ConsolidationListItem {
  memberNames: string[];
  warnings: ConsolidationWarning[];
  entries: ConsolidationEntry[];
  profitLines: ConsolidationProfitLine[];
  balanceSheet: ConsolidatedStatementResponse;
  incomeStatement: ConsolidatedStatementResponse;
  accountOptions: { code: string; name: string; byPartner: boolean }[];
  memberOptions: { companyId: string; name: string }[];
  partnerOptions: { partnerId: string; name: string }[];
  canManage: boolean;
  canEdit: boolean;
  canWithdraw: boolean;
  currency: string;
  version: number;
}

// API_114: nhân viên để lọc ghé thăm khách (CONG_VIEC_22; CONG_VIEC_43 thay tùy chọn phiếu giao khách đã tắt).
export interface VisitStaffOptionsResponse {
  users: { id: string; fullName: string }[];
}

// API_113: tóm tắt khách cho ứng dụng nhân viên kinh doanh (CONG_VIEC_22; QUYTAC_NGHIEPVU_137). Không có hạn mức công nợ.
export interface PartnerSummaryResponse {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  contacts: { fullName: string; position: string | null; phone: string | null; isPrimary: boolean }[];
  paymentTermDays: number | null;
  currency: string;
  // Phải thu còn lại (đã trừ tiền khách trả trước) và phần quá hạn.
  receivable: string;
  overdue: string;
  recentOrders: { id: string; documentNo: string | null; orderDate: string; status: string; totalAmount: string }[];
}

// API_114: ghé thăm khách (CONG_VIEC_22; QUYTAC_NGHIEPVU_138, 139). Gửi multipart: các trường dưới đây và 0 đến 3 tệp "photos".
export const visitPhotoMaximumBytes = 5 * 1024 * 1024;
export const visitPhotoMaximumCount = 3;
export const createVisitSchema = z
  .object({
    partnerId: z.uuid(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracyMeters: z.coerce.number().min(0).max(10000),
    note: z.string().trim().min(1).max(1000),
  })
  .strict();
export const visitListQuerySchema = z
  .object({
    partnerId: z.uuid().optional(),
    userId: z.uuid().optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export interface VisitItem {
  id: string;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  userId: string;
  userName: string;
  visitedAt: string;
  latitude: string;
  longitude: string;
  accuracyMeters: string;
  note: string;
  photoIds: string[];
}


// CONG_VIEC_23: tài khoản người mua VComm (API_116 đến 119; QUYTAC_NGHIEPVU_141 đến 147).
const vietnamPhone = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+84\d{9}$/));
const otpCode = z.string().trim().regex(/^\d{6}$/);
const referralCode = z.string().trim().max(20);

export const buyerPhoneSchema = z.object({ phone: vietnamPhone }).strict();
export const buyerRegisterSchema = z
  .object({ phone: vietnamPhone, code: otpCode, fullName: z.string().trim().min(1).max(100), password: z.string().max(256), referralCode: referralCode.nullable().optional() })
  .strict();
export const buyerLoginSchema = z.object({ phone: vietnamPhone, password: z.string().min(1).max(256) }).strict();
export const buyerOtpVerifySchema = z.object({ phone: vietnamPhone, code: otpCode }).strict();
export const buyerPasswordResetSchema = z.object({ phone: vietnamPhone, code: otpCode, password: z.string().max(256) }).strict();
export const buyerSetReferrerSchema = z.object({ referralCode: referralCode.min(1) }).strict();
export const buyerChangeReferrerSchema = z.object({ referralCode: referralCode.nullable(), reason: z.string().trim().min(1).max(500), version: z.number().int().min(1) }).strict();
export const buyerSalesFlagSchema = z.object({ departmentId: z.uuid(), version: z.number().int().min(1) }).strict();
export const buyerSalesUnflagSchema = z.object({ version: z.number().int().min(1) }).strict();
export const buyerListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    salesStaff: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// Người giới thiệu, người được giới thiệu chỉ hiện số điện thoại đã che (QUYTAC_NGHIEPVU_146).
export interface BuyerPersonMasked {
  fullName: string;
  maskedPhone: string;
}

export interface BuyerMeResponse {
  id: string;
  fullName: string;
  phone: string;
  referralCode: string;
  registeredAt: string;
  referrer: BuyerPersonMasked | null;
  canSetReferrer: boolean;
  isSalesStaff: boolean;
  // Chức danh, đơn vị trong đội kinh doanh (CONG_VIEC_27).
  salesTitle: SalesTitle | null;
  salesUnitName: string | null;
}

export interface BuyerReferralItem extends BuyerPersonMasked {
  registeredAt: string;
}

export interface BuyerSalesCustomerItem {
  id: string;
  fullName: string;
  phone: string;
  registeredAt: string;
}

export interface BuyerAccountListItem {
  id: string;
  fullName: string;
  phone: string;
  status: string;
  registeredAt: string;
  referrerName: string | null;
  referrerPhone: string | null;
  isSalesStaff: boolean;
  referralCount: number;
}

export interface BuyerReferrerHistoryItem {
  previousReferrerName: string | null;
  newReferrerName: string | null;
  source: "registration" | "self" | "admin";
  reason: string | null;
  changedByName: string;
  changedAt: string;
}

export interface BuyerSalesFlagHistoryItem {
  action: "flag" | "unflag" | "move" | "appoint" | "unappoint";
  departmentName: string | null;
  changedByName: string;
  changedAt: string;
  // Đề xuất đã duyệt dẫn tới thay đổi (CONG_VIEC_27).
  proposalId: string | null;
}

export interface BuyerAccountDetailResponse extends BuyerAccountListItem {
  version: number;
  // Người mua thử đặt được hàng khi chưa mở đặt hàng (CONG_VIEC_24).
  isTestBuyer: boolean;
  // Chức danh, chuỗi cấp trên khi là thành viên đội kinh doanh (CONG_VIEC_27).
  salesTitle: SalesTitle | null;
  salesChain: SalesChainItem[];
  referrerId: string | null;
  salesDepartmentId: string | null;
  salesDepartmentName: string | null;
  referrerHistory: BuyerReferrerHistoryItem[];
  salesFlagHistory: BuyerSalesFlagHistoryItem[];
  referrals: Array<{ id: string; fullName: string; phone: string; registeredAt: string }>;
}

export const marketplaceOperatorSchema = z.object({ companyId: z.uuid() }).strict();

// API_119: công ty vận hành sàn và các lựa chọn của màn hình quản trị người mua.
export interface MarketplaceSettingsResponse {
  operatorCompany: { id: string; shortName: string } | null;
  // Chỉ người có quyền quản trị người mua ở phạm vi tập đoàn đặt được công ty vận hành sàn.
  canSetOperator: boolean;
  companies: Array<{ id: string; shortName: string }>;
  canManage: boolean;
  // Đơn vị kinh doanh của công ty vận hành sàn (CONG_VIEC_27).
  departments: Array<{ id: string; name: string; type: SalesUnitType }>;
}

// CONG_VIEC_27: đội kinh doanh nhiều cấp (API_120 đến 122; QUYTAC_NGHIEPVU_148 đến 153).
export const salesUnitTypes = ["division", "region", "team"] as const;
export type SalesUnitType = (typeof salesUnitTypes)[number];
export const salesTitles = ["director", "regional_director", "team_head", "staff"] as const;
export type SalesTitle = (typeof salesTitles)[number];

export const salesUnitTypeSchema = z.object({ type: z.enum(salesUnitTypes).nullable() }).strict();
export const salesUnitManagerSchema = z.object({ userId: z.uuid().nullable() }).strict();
export const salesMoveSchema = z.object({ departmentId: z.uuid(), version: z.number().int().min(1) }).strict();

export interface SalesTeamUnit {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  type: SalesUnitType | null;
  managerUserId: string | null;
  managerName: string | null;
}

export interface SalesTeamMember {
  userId: string;
  fullName: string;
  phone: string;
  departmentId: string;
  title: SalesTitle;
  customerCount: number;
  version: number;
}

export interface SalesTeamResponse {
  units: SalesTeamUnit[];
  members: SalesTeamMember[];
}

export interface SalesChainItem {
  userId: string;
  fullName: string;
  title: SalesTitle;
}

// API_122: đội của tôi trên ứng dụng (người quản lý xem nhánh của mình).
export interface MySalesTeamMember {
  userId: string;
  fullName: string;
  title: SalesTitle;
  unitName: string;
  customerCount: number;
  // CONG_VIEC_26 (QUYTAC_NGHIEPVU_203): hoa hồng đã cộng ví và đang chờ của cấp dưới.
  creditedCommission: string;
  pendingCommission: string;
}

export interface MySalesTeamResponse {
  title: SalesTitle;
  unitName: string;
  members: MySalesTeamMember[];
}

// API_121: đề xuất thay đổi đội kinh doanh (QUYTAC_NGHIEPVU_153).
export const salesProposalKinds = ["add", "move", "appoint", "remove"] as const;
export type SalesProposalKind = (typeof salesProposalKinds)[number];
export const salesProposalStatuses = ["pending", "approved", "rejected", "withdrawn"] as const;
export type SalesProposalStatus = (typeof salesProposalStatuses)[number];

export const createSalesProposalSchema = z
  .object({
    kind: z.enum(salesProposalKinds),
    targetPhone: z.string().trim().max(20).optional(),
    targetUserId: z.uuid().optional(),
    departmentId: z.uuid().optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const rejectSalesProposalSchema = z.object({ note: z.string().trim().min(1).max(500) }).strict();
export const salesProposalListQuerySchema = z.object({ status: z.enum(salesProposalStatuses).optional() }).strict();

export interface SalesProposalItem {
  id: string;
  kind: SalesProposalKind;
  status: SalesProposalStatus;
  proposerName: string;
  targetUserId: string;
  targetName: string;
  targetPhone: string;
  departmentId: string | null;
  departmentName: string | null;
  reason: string;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
}

// Lựa chọn khi lập đề xuất trên ứng dụng: đơn vị trong nhánh, cấp dưới.
export interface SalesProposalOptionsResponse {
  // Đơn vị người đề xuất đang quản lý: không bổ nhiệm vào đơn vị này.
  managedUnitId: string;
  units: Array<{ id: string; name: string; type: SalesUnitType }>;
  members: Array<{ userId: string; fullName: string; departmentId: string; title: SalesTitle }>;
}

// CONG_VIEC_24: đặt hàng trên VComm (API_123 đến 129; QUYTAC_NGHIEPVU_154 đến 162).
export const carrierCodes = ["ghn", "vnpost", "viettel_post", "jt", "ghtk"] as const;
export type CarrierCode = (typeof carrierCodes)[number];

export interface CarrierItem {
  code: CarrierCode;
  name: string;
  isEnabled: boolean;
  // Đã có thông tin kết nối trong biến môi trường.
  isConfigured: boolean;
}

// CONG_VIEC_25: phương thức thanh toán theo cổng (QUYTAC_NGHIEPVU_163).
// CONG_VIEC_32: mỗi cổng thêm mã của mình trên dòng riêng (CONG_VIEC_33 đến 39), không sắp xếp lại các dòng khác.
export const paymentMethodCodes = [
  "cod",
  "vnpay_qr",
  "vnpay_atm",
  "vnpay_card",
  "momo_wallet",
  "momo_atm",
  "momo_card",
  "sepay_bank_transfer",
  "payos_vietqr",
  "bank_transfer_vietqr",
  "bidv_va_qr",
  "ecopay_wallet",
  "ecopay_atm",
  "gpay_atm",
  "gpay_international",
  "gpay_va",
  "zalopay_wallet",
  "zalopay_atm",
  "zalopay_card",
  "google_pay_card",
  "apple_pay_wallet",
] as const;
export type PaymentMethodCode = (typeof paymentMethodCodes)[number];
export const paymentGatewayCodes = [
  "cod",
  "vnpay",
  "momo",
  "sepay",
  "payos",
  "bank_transfer",
  "bidv",
  "ecopay",
  "gpay",
  "zalopay",
  "google_pay",
  "apple_pay",
] as const;
export type PaymentGatewayCode = (typeof paymentGatewayCodes)[number];

export interface PaymentMethodItem {
  code: PaymentMethodCode;
  gatewayCode: PaymentGatewayCode;
  isEnabled: boolean;
  // Cổng đã có thông tin kết nối trong biến môi trường (thanh toán khi nhận hàng luôn có).
  isConfigured: boolean;
}

// API_123: cài đặt bán hàng VComm (QUYTAC_NGHIEPVU_154).
export interface StoreSettingsResponse {
  companyName: string;
  channelId: string | null;
  warehouseId: string | null;
  shippingFee: string;
  freeShippingThreshold: string | null;
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  minimumWeightGrams: number;
  version: number;
  canManage: boolean;
  channels: Array<{ id: string; name: string }>;
  warehouses: Array<{ id: string; name: string }>;
  carriers: CarrierItem[];
  // API_130: mở đặt hàng cho mọi người mua (QUYTAC_NGHIEPVU_164).
  orderingOpen: boolean;
  paymentMethods: PaymentMethodItem[];
  commissionSettings: CommissionSettings;
}

const packageSize = z.number().int().min(1).max(200);
export const updateStoreSettingsSchema = z
  .object({
    channelId: z.uuid(),
    warehouseId: z.uuid(),
    shippingFee: requiredMoney,
    freeShippingThreshold: optionalMoney,
    packageLengthCm: packageSize,
    packageWidthCm: packageSize,
    packageHeightCm: packageSize,
    minimumWeightGrams: z.number().int().min(1).max(50000),
    // 0: lần lưu đầu tiên.
    version: z.number().int().min(0),
  })
  .strict();
export const updateCarrierSchema = z.object({ isEnabled: z.boolean() }).strict();
export const updatePaymentMethodSchema = z.object({ isEnabled: z.boolean() }).strict();
export const updateOrderingOpenSchema = z.object({ orderingOpen: z.boolean() }).strict();

// Lý do sản phẩm không hiện trên ứng dụng (QUYTAC_NGHIEPVU_155).
export const listingBlockers = ["storeNotReady", "notApproved", "inactive", "lotOrSerial", "noPrice"] as const;
export type ListingBlocker = (typeof listingBlockers)[number];

// CONG_VIEC_26: thiết lập hoa hồng từng sản phẩm (QUYTAC_NGHIEPVU_200).
export const commissionCalculations = ["percent", "fixed"] as const;
export type CommissionCalculation = (typeof commissionCalculations)[number];
export interface ProductCommission {
  calculation: CommissionCalculation;
  referral: string;
  staff: string;
  teamHead: string;
  regionalDirector: string;
  director: string;
  version: number;
}
// Số tiền vừa cột numeric(18,4) với dư địa khi nhân số lượng: tối đa 13 chữ số phần nguyên.
const commissionMoney = requiredMoney.refine((value) => Number(value) < 1e13, "invalidValue");
const commissionValue = commissionMoney;
export const productCommissionSchema = z
  .object({
    calculation: z.enum(commissionCalculations),
    referral: commissionValue,
    staff: commissionValue,
    teamHead: commissionValue,
    regionalDirector: commissionValue,
    director: commissionValue,
    // 0: lần thiết lập đầu tiên.
    version: z.number().int().min(0),
  })
  .strict();

// Cài đặt hoa hồng chung (QUYTAC_NGHIEPVU_204, 205).
// THAY_DOI_17 (QUYTAC_NGHIEPVU_208): phí rút tiền, hai bảng cộng dồn. Bảng theo lần: từ lần rút thứ N trong tháng thu số tiền cố định.
// Bảng theo số tiền: từ mức số tiền, phí cố định cộng phần trăm số tiền (phần phần trăm có mức tối thiểu, tối đa). Bảng trống thì không thu.
export interface WithdrawalFeeRules {
  byCount: { fromCount: number; fee: string }[];
  byAmount: { fromAmount: string; fixedFee: string; percent: string; minimumFee: string; maximumFee: string | null }[];
}
export const emptyWithdrawalFeeRules: WithdrawalFeeRules = { byCount: [], byAmount: [] };

// Phí của yêu cầu có số tiền amount, là lần rút thứ sequence trong tháng; làm tròn đến đồng.
export function withdrawalFee(amount: number, sequence: number, rules: WithdrawalFeeRules): number {
  const countTier = [...rules.byCount].filter((tier) => tier.fromCount <= sequence).sort((first, second) => second.fromCount - first.fromCount)[0];
  const amountTier = [...rules.byAmount].filter((tier) => Number(tier.fromAmount) <= amount).sort((first, second) => Number(second.fromAmount) - Number(first.fromAmount))[0];
  let fee = countTier ? Number(countTier.fee) : 0;
  if (amountTier) {
    let percentPart = Number(amountTier.percent) > 0 ? Math.max((amount * Number(amountTier.percent)) / 100, Number(amountTier.minimumFee)) : 0;
    if (amountTier.maximumFee !== null && Number(amountTier.percent) > 0) percentPart = Math.min(percentPart, Number(amountTier.maximumFee));
    fee += Number(amountTier.fixedFee) + percentPart;
  }
  return Math.round(fee);
}

export interface CommissionSettings {
  taxThreshold: string;
  taxRate: string;
  minimumWithdrawal: string;
  withdrawalFees: WithdrawalFeeRules;
  version: number;
}
const feePercent = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/).refine((value) => Number(value) <= 100, "invalidValue");
export const withdrawalFeeRulesSchema = z
  .object({
    byCount: z.array(z.object({ fromCount: z.number().int().min(1).max(1000), fee: commissionMoney }).strict()).max(20),
    byAmount: z
      .array(
        z
          .object({ fromAmount: commissionMoney, fixedFee: commissionMoney, percent: feePercent, minimumFee: commissionMoney, maximumFee: commissionMoney.nullable() })
          .strict()
          .refine((tier) => tier.maximumFee === null || Number(tier.maximumFee) >= Number(tier.minimumFee), { message: "invalidValue", path: ["maximumFee"] }),
      )
      .max(20),
  })
  .strict()
  .refine((rules) => new Set(rules.byCount.map((tier) => tier.fromCount)).size === rules.byCount.length, { message: "invalidValue", path: ["byCount"] })
  .refine((rules) => new Set(rules.byAmount.map((tier) => Number(tier.fromAmount))).size === rules.byAmount.length, { message: "invalidValue", path: ["byAmount"] });
export const commissionSettingsSchema = z
  .object({
    taxThreshold: commissionMoney,
    taxRate: z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/),
    minimumWithdrawal: commissionMoney,
    // Không gửi thì giữ bảng phí đang có.
    withdrawalFees: withdrawalFeeRulesSchema.optional(),
    version: z.number().int().min(0),
  })
  .strict();

export interface ListingItem {
  productId: string;
  name: string;
  categoryName: string;
  imageUrl: string | null;
  isPublished: boolean;
  description: string | null;
  // Giá thấp nhất gồm thuế trong các biến thể có giá.
  priceFrom: string | null;
  available: string;
  blockers: ListingBlocker[];
  // Chưa thiết lập: sản phẩm không có hoa hồng.
  commission: ProductCommission | null;
}
export const listingListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    published: z.enum(["all", "published", "unpublished"]).default("all"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const updateListingSchema = z.object({ isPublished: z.boolean(), description: z.string().trim().max(5000).nullable() }).strict();
export const testBuyerSchema = z.object({ isTestBuyer: z.boolean() }).strict();

// API_124: cửa hàng, giỏ hàng trên ứng dụng (QUYTAC_NGHIEPVU_155, 157). Giá là giá gồm thuế của một đơn vị cơ sở.
export interface ShopProductItem {
  id: string;
  name: string;
  imageUrl: string | null;
  priceFrom: string;
  inStock: boolean;
}

export interface ShopVariant {
  id: string;
  sku: string;
  // Giá trị phân loại theo thứ tự thuộc tính của sản phẩm.
  optionValues: string[];
  price: string;
  available: string;
}

export interface ShopProductDetail {
  id: string;
  name: string;
  description: string | null;
  unitName: string;
  images: string[];
  options: Array<{ name: string; values: string[] }>;
  variants: ShopVariant[];
  currency: string;
}

export const shopProductQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export interface CartLineItem {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  quantity: number;
  // null: không còn bán (ngừng đăng bán, hết giá, ngừng hoạt động).
  price: string | null;
  available: string;
}

export interface CartResponse {
  lines: CartLineItem[];
  currency: string;
}

export const cartLineSchema = z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(999) }).strict();

// API_125: danh mục tỉnh, xã; sổ địa chỉ (QUYTAC_NGHIEPVU_156).
export interface RegionItem {
  code: string;
  name: string;
}

export interface BuyerAddressItem {
  id: string;
  recipientName: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  wardCode: string;
  wardName: string;
  streetAddress: string;
  isDefault: boolean;
}

export const buyerAddressSchema = z
  .object({
    recipientName: z.string().trim().min(1).max(100),
    phone: vietnamPhone,
    provinceCode: z.string().trim().min(1).max(10),
    wardCode: z.string().trim().min(1).max(10),
    streetAddress: z.string().trim().min(1).max(200),
    isDefault: z.boolean().default(false),
  })
  .strict();

// API_126, API_127: đơn VComm (QUYTAC_NGHIEPVU_158, 159, 162).
export const marketplaceOrderStatuses = ["awaiting_payment", "awaiting_shipment", "awaiting_pickup", "shipping", "delivered", "completed", "cancelled"] as const;
export type MarketplaceOrderStatus = (typeof marketplaceOrderStatuses)[number];

const orderLinesInput = z.array(z.object({ variantId: z.uuid(), quantity: z.number().int().min(1).max(999) }).strict()).min(1).max(50);
// pointsToRedeem: số điểm thưởng dùng cho đơn (CONG_VIEC_51; QUYTAC_NGHIEPVU_348), mặc định 0.
const pointsToRedeem = z.number().int().min(0).max(1_000_000_000).default(0);
export const buyerOrderPreviewSchema = z.object({ addressId: z.uuid().nullable(), lines: orderLinesInput, pointsToRedeem }).strict();
// Mã phương thức theo định dạng; phương thức có thật, đang bật hay không do máy chủ kiểm theo danh mục (CONG_VIEC_32).
const paymentMethodInput = z
  .string()
  .regex(/^[a-z][a-z0-9_]{1,39}$/)
  .default("cod")
  .transform((value) => value as PaymentMethodCode);
// expectedTotal: tổng thanh toán người mua đã thấy; khác tổng tính lại thì báo giá đã thay đổi. paymentMethod mặc định thanh toán khi nhận hàng (ứng dụng bản CONG_VIEC_24).
export const buyerOrderPlaceSchema = z.object({ addressId: z.uuid(), lines: orderLinesInput, expectedTotal: requiredMoney, paymentMethod: paymentMethodInput, pointsToRedeem }).strict();

export interface MarketplaceOrderLine {
  variantId: string;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  quantity: string;
  // Giá gồm thuế của một đơn vị trước khuyến mãi; tiền dòng sau khuyến mãi.
  unitPrice: string;
  promotionDiscount: string;
  total: string;
  isGift: boolean;
  orderLineId: string | null;
}

export interface BuyerOrderPreview {
  lines: MarketplaceOrderLine[];
  goodsAmount: string;
  shippingFee: string;
  total: string;
  currency: string;
  // Chưa mở đặt hàng: chỉ người mua thử đặt được.
  canOrder: boolean;
  // Phương thức đang bật, theo thứ tự hiển thị.
  paymentMethods: PaymentMethodCode[];
  // Điểm thưởng (CONG_VIEC_51): khả năng dùng điểm, tiền điểm của số điểm đang chọn, tổng sau trừ điểm, điểm dự kiến tích.
  loyalty: { balance: number; minPoints: number; maxPoints: number; pointValue: string | null; redeemable: boolean; blockedReason: "no_phase" | "locked" | "inactive" | "insufficient" | null };
  pointsToRedeem: number;
  pointsAmount: string;
  payable: string;
  expectedPoints: number;
}

export interface MarketplaceOrderEvent {
  status: string;
  note: string | null;
  at: string;
}

export interface BuyerOrderListItem {
  id: string;
  documentNo: string;
  status: MarketplaceOrderStatus;
  createdAt: string;
  total: string;
  itemCount: number;
  firstProductName: string;
  imageUrl: string | null;
}

// CONG_VIEC_25: trạng thái thanh toán của đơn (QUYTAC_NGHIEPVU_167), tính từ tiền đã thu, đã hoàn, việc chờ hoàn.
export const orderPaymentStatuses = ["unpaid", "paid", "refund_pending", "partially_refunded", "refunded"] as const;
export type OrderPaymentStatus = (typeof orderPaymentStatuses)[number];

// API_131: mở thanh toán của cổng. Cổng chuyển trang trả paymentUrl; cổng chuyển khoản (VietQR, tài khoản định danh) trả transfer.
export interface PaymentTransferInstruction {
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: string;
  // Nội dung chuyển khoản bắt buộc để đối chiếu tự động.
  content: string;
  // Chuỗi mã QR theo chuẩn VietQR (EMVCo) để ứng dụng vẽ; null khi cổng không cấp.
  qrData: string | null;
  // Ảnh mã QR do cổng cấp; null khi không có.
  qrImageUrl: string | null;
}
export interface BuyerPaymentStart {
  paymentUrl: string | null;
  transfer: PaymentTransferInstruction | null;
  deadline: string;
}

export interface MarketplacePaymentItem {
  reference: string;
  method: PaymentMethodCode;
  amount: string;
  status: "pending" | "succeeded" | "failed";
  responseCode: string | null;
  transactionNo: string | null;
  createdAt: string;
  completedAt: string | null;
}

// API_133: hoàn tiền (QUYTAC_NGHIEPVU_168).
export const refundReasons = ["paid_after_cancel", "duplicate_payment", "order_cancelled", "return_received"] as const;
export type RefundReason = (typeof refundReasons)[number];
export const refundStatuses = ["pending", "completed"] as const;
export type RefundStatus = (typeof refundStatuses)[number];

export interface BuyerRefundItem {
  amount: string;
  reason: RefundReason;
  status: RefundStatus;
  refundedOn: string | null;
}

export interface BuyerBankAccount {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}
export const buyerBankAccountSchema = z
  .object({
    bankName: z.string().trim().min(2).max(100),
    accountNumber: z.string().trim().regex(/^[0-9]{6,20}$/),
    accountHolder: z.string().trim().min(2).max(100),
  })
  .strict();

export interface RefundItem {
  id: string;
  orderId: string;
  documentNo: string;
  buyerName: string;
  buyerPhone: string;
  reason: RefundReason;
  amount: string;
  status: RefundStatus;
  bankAccount: BuyerBankAccount | null;
  bankTransactionNo: string | null;
  refundedOn: string | null;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  version: number;
}
export const refundListQuerySchema = z
  .object({
    status: z.enum(refundStatuses).default("pending"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const completeRefundSchema = z
  .object({
    bankTransactionNo: z.string().trim().min(1).max(100),
    refundedOn: isoDate,
    note: z.string().trim().max(500).nullable(),
    version: z.number().int().min(1),
  })
  .strict();

export interface BuyerOrderDetail extends BuyerOrderListItem {
  recipientName: string;
  recipientPhone: string;
  address: string;
  lines: MarketplaceOrderLine[];
  goodsAmount: string;
  shippingFee: string;
  paymentMethod: PaymentMethodCode;
  paymentStatus: OrderPaymentStatus;
  paidAmount: string;
  refundedAmount: string;
  // Hạn thanh toán của đơn chờ thanh toán; quá hạn đơn tự hủy.
  paymentDeadline: string | null;
  canPay: boolean;
  refunds: BuyerRefundItem[];
  // Có việc chờ hoàn mà người mua chưa nhập tài khoản ngân hàng.
  needsBankAccount: boolean;
  carrierName: string | null;
  trackingCode: string | null;
  deliveredAt: string | null;
  // Hạn gửi yêu cầu trả hàng (7 ngày từ lúc giao thành công).
  returnDeadline: string | null;
  completedAt: string | null;
  completedAmount: string | null;
  cancelReason: string | null;
  events: MarketplaceOrderEvent[];
  canCancel: boolean;
  // Trả hàng trong 7 ngày (QUYTAC_NGHIEPVU_161).
  returnRequests: ReturnRequestItem[];
  canRequestReturn: boolean;
  // Tiền điểm thưởng trừ vào đơn; điểm dùng, hoàn, tích của đơn (CONG_VIEC_51).
  pointsAmount: string;
  points: LoyaltyDocumentPoints | null;
  version: number;
}

export interface MarketplaceOrderListItem extends BuyerOrderListItem {
  buyerName: string;
  buyerPhone: string;
  recipientName: string;
  carrierStatus: string | null;
}

export interface MarketplaceShipmentItem {
  carrierCode: string;
  carrierName: string;
  // null: đang chờ xác nhận tạo vận đơn.
  trackingCode: string | null;
  carrierStatus: string;
  fee: string | null;
  isActive: boolean;
  createdAt: string;
  syncedAt: string;
}

// CONG_VIEC_26: hoa hồng của đơn theo người hưởng và phần (QUYTAC_NGHIEPVU_201, 202).
export const commissionShares = ["referral", "staff", "team_head", "regional_director", "director"] as const;
export type CommissionShare = (typeof commissionShares)[number];
export interface MarketplaceOrderCommission {
  beneficiaryName: string;
  beneficiaryPhone: string;
  share: CommissionShare;
  // Đã cộng ví: số tiền thực; chưa hoàn tất: ước tính theo hàng hiện tại.
  amount: string;
  credited: boolean;
}

export interface MarketplaceOrderDetail extends BuyerOrderDetail {
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  salesOrderId: string;
  shipments: MarketplaceShipmentItem[];
  payments: MarketplacePaymentItem[];
  commissions: MarketplaceOrderCommission[];
  // Ghi tay đã thu tiền thu hộ khi đơn vị vận chuyển không có API (QUYTAC_NGHIEPVU_167).
  canRecordCod: boolean;
  // Có lần thanh toán chuyển khoản đang chờ và người xem có quyền xác nhận (CONG_VIEC_36).
  canConfirmTransfer: boolean;
  canShip: boolean;
  canRefreshShipment: boolean;
  carriers: CarrierItem[];
}

export const marketplaceOrderListQuerySchema = z
  .object({
    status: z.enum(marketplaceOrderStatuses).optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const buyerOrderListQuerySchema = z
  .object({
    status: z.enum(marketplaceOrderStatuses).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export const cancelMarketplaceOrderSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().min(1) }).strict();
export const recordCodCollectedSchema = z
  .object({ collectedOn: isoDate, reference: z.string().trim().min(1).max(100), version: z.number().int().min(1) })
  .strict();
// Kế toán xác nhận đã nhận tiền chuyển khoản của một lần thanh toán (CONG_VIEC_36; QUYTAC_NGHIEPVU_242).
export const confirmBankTransferSchema = z.object({ reference: z.string().trim().min(1).max(100), bankTransactionNo: z.string().trim().min(1).max(100) }).strict();
export const shipMarketplaceOrderSchema = z.object({ carrierCode: z.enum(carrierCodes), version: z.number().int().min(1) }).strict();

// API_129: trả hàng trong 7 ngày (QUYTAC_NGHIEPVU_161).
export const returnReasons = ["defective", "wrong_item", "not_as_described", "other"] as const;
export type ReturnReason = (typeof returnReasons)[number];
export const returnRequestStatuses = ["pending", "approved", "rejected", "withdrawn", "received", "not_received"] as const;
export type ReturnRequestStatus = (typeof returnRequestStatuses)[number];

export interface ReturnRequestItem {
  id: string;
  orderId: string;
  documentNo: string;
  status: ReturnRequestStatus;
  reason: ReturnReason;
  description: string;
  lines: Array<{ orderLineId: string; productName: string; variantLabel: string; quantity: string }>;
  images: string[];
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  closedAt: string | null;
  canWithdraw: boolean;
  version: number;
}

export interface ReturnRequestAdminItem extends ReturnRequestItem {
  buyerName: string;
  buyerPhone: string;
  canDecide: boolean;
  canClose: boolean;
}

export const createReturnRequestSchema = z
  .object({
    reason: z.enum(returnReasons),
    description: z.string().trim().min(1).max(500),
    lines: z
      .array(z.object({ orderLineId: z.uuid(), quantity: z.number().int().min(1).max(999) }).strict())
      .min(1)
      .max(50),
    imageIds: z.array(z.uuid()).max(5).default([]),
  })
  .strict();
export const returnDecisionSchema = z.object({ note: z.string().trim().max(500).nullable().default(null), version: z.number().int().min(1) }).strict();
export const returnRejectSchema = z.object({ note: z.string().trim().min(1).max(500), version: z.number().int().min(1) }).strict();
export const returnRequestListQuerySchema = z
  .object({
    status: z.enum(returnRequestStatuses).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

// API_135: ví hoa hồng của người dùng (CONG_VIEC_26; QUYTAC_NGHIEPVU_203).
export const walletTransactionKinds = ["commission", "withdrawal", "withdrawal_reversal"] as const;
export type WalletTransactionKind = (typeof walletTransactionKinds)[number];

export const buyerWalletQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export interface BuyerWalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  amount: string;
  balanceAfter: string;
  orderId: string | null;
  orderDocumentNo: string | null;
  note: string | null;
  createdAt: string;
}

export interface BuyerWalletResponse {
  balance: string;
  pendingAmount: string;
  transactions: PageResponse<BuyerWalletTransaction>;
  withdrawal: BuyerWithdrawalInfo;
}

// API_136: rút tiền hoa hồng (CONG_VIEC_26; QUYTAC_NGHIEPVU_204 đến 206).
export const withdrawalStatuses = ["pending", "approved", "rejected", "cancelled", "paid"] as const;
export type WithdrawalStatus = (typeof withdrawalStatuses)[number];

// Số tiền rút là số đồng nguyên.
export const createWithdrawalSchema = z.object({ amount: z.string().trim().regex(/^\d{1,13}$/) }).strict();
export const withdrawalVersionSchema = z.object({ version: z.number().int().min(1) }).strict();
export const rejectWithdrawalSchema = z.object({ reason: z.string().trim().min(1).max(500), version: z.number().int().min(1) }).strict();
export const payWithdrawalSchema = z.object({ bankTransactionNo: z.string().trim().min(1).max(100), paidOn: isoDate, version: z.number().int().min(1) }).strict();
export const withdrawalListQuerySchema = z
  .object({
    status: z.enum(withdrawalStatuses).default("pending"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const withdrawalTaxReportQuerySchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) }).strict();

export interface WithdrawalItem {
  id: string;
  userName: string;
  userPhone: string;
  amount: string;
  // Thuế dự kiến khi chưa duyệt; đã duyệt thì là số chốt.
  taxAmount: string;
  // Phí rút tiền (THAY_DOI_17): dự kiến khi chưa duyệt, đã duyệt thì là số chốt.
  feeAmount: string;
  netAmount: string;
  bankAccount: BuyerBankAccount;
  status: WithdrawalStatus;
  rejectReason: string | null;
  bankTransactionNo: string | null;
  paidOn: string | null;
  createdAt: string;
  decidedAt: string | null;
  version: number;
}

export interface WithdrawalTaxReport {
  month: string;
  rows: { userName: string; userPhone: string; amount: string; taxAmount: string; feeAmount: string; netAmount: string; paidOn: string; bankTransactionNo: string }[];
  totalAmount: string;
  totalTax: string;
}

// Phần rút tiền trên ví ứng dụng.
export interface BuyerWithdrawalInfo {
  minimumWithdrawal: string;
  taxThreshold: string;
  taxRate: string;
  withdrawalFees: WithdrawalFeeRules;
  // Số yêu cầu đã gửi trong tháng này (không tính bị từ chối, đã rút lại): yêu cầu mới là lần thứ withdrawalsThisMonth + 1.
  withdrawalsThisMonth: number;
  // THAY_DOI_19: tổng số tiền đã duyệt trong tháng này, để xét ngưỡng thuế cộng dồn.
  approvedThisMonth: string;
  bankAccount: BuyerBankAccount | null;
  // Yêu cầu đang chờ duyệt hoặc đã duyệt chưa chi.
  open: WithdrawalItem | null;
}

// CONG_VIEC_46: Nhân sự phần 1 (MODULE_08) – hồ sơ nhân sự (API_144 đến API_146, API_149).
export const employeeGenders = ["male", "female"] as const;
export const maritalStatuses = ["single", "married", "other"] as const;
export const educationLevels = ["none", "elementary", "intermediate", "college", "university", "master", "doctorate"] as const;
export const employeeDocumentKinds = ["identity_image", "qualification", "health_certificate", "resume", "data_consent", "guardian_consent", "other"] as const;
export const dependentRelationships = ["child", "spouse", "parent", "other"] as const;
export const workEventKinds = ["hire", "transfer", "title_change", "contract", "termination"] as const;
export type EmployeeGender = (typeof employeeGenders)[number];
export type MaritalStatus = (typeof maritalStatuses)[number];
export type EducationLevel = (typeof educationLevels)[number];
export type EmployeeDocumentKind = (typeof employeeDocumentKinds)[number];
export type DependentRelationship = (typeof dependentRelationships)[number];
export type WorkEventKind = (typeof workEventKinds)[number];
// Trường mã hóa: bỏ trống (undefined) khi sửa là giữ giá trị cũ; null hoặc chuỗi rỗng là xóa.
const protectedText = (maximum: number) => z.string().trim().max(maximum).nullable().optional();
const monthStart = isoDate.refine((value) => value.endsWith("-01"), { message: "invalidValue" });

export const saveEmployeeSchema = z
  .object({
    code: blankToNull(20),
    fullName: z.string().trim().min(1).max(200),
    gender: z.enum(employeeGenders),
    birthDate: isoDate,
    nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).default("VN"),
    identityNumber: protectedText(20),
    residence: z.string().trim().min(1).max(500),
    phone: blankToNull(20),
    personalEmail: blankToNull(200),
    contactAddress: blankToNull(500),
    maritalStatus: z.enum(maritalStatuses).nullable().optional(),
    educationLevel: z.enum(educationLevels).nullable().optional(),
    major: blankToNull(200),
    taxCode: protectedText(20),
    socialInsuranceNumber: protectedText(20),
    bankName: blankToNull(200),
    bankAccountNumber: protectedText(30),
    bankAccountHolder: blankToNull(200),
    workPermitNumber: protectedText(30),
    workPermitExpiry: isoDate.nullable().optional(),
    emergencyContact: blankToNull(300),
    // Chỉ khi lập: vị trí ban đầu, tạo quyết định "Vào làm".
    hireDate: isoDate.optional(),
    departmentId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    jobTitle: z.string().trim().min(1).max(100).optional(),
    userId: z.string().uuid().nullable().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveEmployeeRequest = z.input<typeof saveEmployeeSchema>;

export const employeeListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    departmentId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    status: z.enum(["active", "terminated", "all"]).default("active"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export interface EmployeePosition {
  departmentId: string | null;
  departmentName: string | null;
  branchId: string | null;
  branchName: string | null;
  jobTitle: string | null;
}
export interface EmployeeListItem extends EmployeePosition {
  id: string;
  code: string;
  fullName: string;
  hireDate: string;
  status: "active" | "terminated";
  isMinor: boolean;
  missingConsent: boolean;
}
export type EmployeeListResponse = PageResponse<EmployeeListItem>;

export interface EmployeeResponse extends EmployeePosition {
  id: string;
  code: string;
  fullName: string;
  gender: EmployeeGender;
  birthDate: string;
  nationality: string;
  identityKind: "citizen_id" | "passport";
  // Dạng che "********1234"; giá trị đầy đủ lấy qua API hiện số (QUYTAC_NGHIEPVU_295).
  identityNumber: string;
  residence: string;
  phone: string | null;
  personalEmail: string | null;
  contactAddress: string | null;
  maritalStatus: MaritalStatus | null;
  educationLevel: EducationLevel | null;
  major: string | null;
  taxCode: string | null;
  socialInsuranceNumber: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  workPermitNumber: string | null;
  workPermitExpiry: string | null;
  emergencyContact: string | null;
  hireDate: string;
  status: "active" | "terminated";
  terminationDate: string | null;
  terminationReason: string | null;
  userId: string | null;
  userEmail: string | null;
  isMinor: boolean;
  missingConsent: boolean;
  consentDate: string | null;
  version: number;
  canManage: boolean;
  canViewIdentity: boolean;
}

export const revealFields = ["identityNumber", "taxCode", "socialInsuranceNumber", "bankAccountNumber", "workPermitNumber"] as const;
export type RevealField = (typeof revealFields)[number];
export const revealSchema = z.object({ field: z.enum(revealFields) }).strict();
export interface RevealResponse {
  field: string;
  value: string | null;
}

export interface EmployeeOptionsResponse {
  departments: { id: string; code: string; name: string }[];
  branches: { id: string; code: string; name: string }[];
  // Thành viên đang hoạt động của công ty chưa có hồ sơ (để liên kết).
  users: { id: string; fullName: string; email: string | null }[];
}

export const uploadEmployeeDocumentSchema = z
  .object({
    kind: z.enum(employeeDocumentKinds),
    consentDate: isoDate.optional(),
  })
  .strict();
export interface EmployeeDocumentItem {
  id: string;
  kind: EmployeeDocumentKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  consentDate: string | null;
  uploadedByName: string;
  uploadedAt: string;
}

export const saveDependentSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200),
    relationship: z.enum(dependentRelationships),
    birthDate: isoDate,
    identityNumber: protectedText(20),
    deductionFrom: monthStart,
    deductionTo: monthStart.nullable().optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();
export interface DependentItem {
  id: string;
  fullName: string;
  relationship: DependentRelationship;
  birthDate: string;
  identityNumber: string | null;
  deductionFrom: string;
  deductionTo: string | null;
  version: number;
}

export const saveWorkEventSchema = z
  .object({
    kind: z.enum(["transfer", "title_change"]),
    effectiveDate: isoDate,
    decisionNo: blankToNull(50),
    departmentId: z.string().uuid().nullable().optional(),
    branchId: z.string().uuid().nullable().optional(),
    jobTitle: blankToNull(100),
    note: blankToNull(500),
    version: z.number().int().positive().optional(),
  })
  .strict();
export interface WorkEventItem {
  id: string;
  kind: WorkEventKind;
  effectiveDate: string;
  decisionNo: string | null;
  departmentName: string | null;
  branchName: string | null;
  jobTitle: string | null;
  note: string | null;
  sourceType: "manual" | "contract" | "appendix";
  effective: boolean;
  appliedAt: string | null;
  version: number;
}

// API_149: hồ sơ của tôi.
export interface MyEmployeeResponse {
  employee: EmployeeResponse;
  workEvents: WorkEventItem[];
}

// CONG_VIEC_46 lát L1: hợp đồng lao động, phụ lục, nghỉ việc (API_144, API_147, API_148).
export const contractKinds = ["probation", "fixed_term", "indefinite"] as const;
export const contractStatuses = ["draft", "pending", "approved", "signed", "rejected", "withdrawn", "cancelled", "terminated"] as const;
export const probationLevels = ["manager", "college", "intermediate", "other"] as const;
export const salaryPaymentMethods = ["transfer", "cash"] as const;
export const terminationReasons = ["expired", "completed", "mutual", "employee_unilateral", "employer_unilateral", "redundancy", "disciplinary", "probation_failed", "death", "other"] as const;
export type ContractKind = (typeof contractKinds)[number];
export type ContractStatus = (typeof contractStatuses)[number];
export type ProbationLevel = (typeof probationLevels)[number];
export type SalaryPaymentMethod = (typeof salaryPaymentMethods)[number];
export type TerminationReason = (typeof terminationReasons)[number];
// Tình trạng hiệu lực tính theo ngày (QUYTAC_NGHIEPVU_299).
export type ContractValidity = "not_started" | "active" | "expired" | "terminated" | null;

// CONG_VIEC_48 (THAY_DOI_21): mỗi dòng phụ cấp lưu mới phải có loại phụ cấp (QUYTAC_NGHIEPVU_314).
const allowanceSchema = z.object({ name: z.string().trim().min(1).max(100), amount: decimalText(4), allowanceTypeId: z.string().uuid() }).strict();

export const saveContractSchema = z
  .object({
    employeeId: z.string().uuid(),
    kind: z.enum(contractKinds),
    effectiveDate: isoDate,
    endDate: isoDate.nullable().optional(),
    jobTitle: z.string().trim().min(1).max(100),
    departmentId: z.string().uuid(),
    branchId: z.string().uuid(),
    salary: decimalText(4),
    probationLevel: z.enum(probationLevels).nullable().optional(),
    officialSalary: decimalText(4).nullable().optional(),
    paymentMethod: z.enum(salaryPaymentMethods).default("transfer"),
    allowances: z.array(allowanceSchema).max(20).default([]),
    signerName: z.string().trim().min(1).max(200),
    signerTitle: z.string().trim().min(1).max(100),
    otherTerms: blankToNull(4000),
    legalExceptionReason: blankToNull(500),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveContractRequest = z.input<typeof saveContractSchema>;

export const contractListQuerySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
    kind: z.enum(contractKinds).optional(),
    status: z.enum(contractStatuses).optional(),
    expiring: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const signContractSchema = z.object({ signDate: isoDate }).strict();
export const cancelContractSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const terminateContractSchema = z
  .object({ terminationDate: isoDate, reason: z.enum(terminationReasons), note: blankToNull(1000) })
  .strict();
export const terminateEmployeeSchema = terminateContractSchema;

export interface ContractAllowance {
  name: string;
  amount: string;
  // null với dòng lập trước CONG_VIEC_48.
  allowanceTypeId: string | null;
  allowanceTypeName: string | null;
}
export interface ContractTerms {
  jobTitle: string;
  departmentId: string;
  departmentName: string;
  branchId: string;
  branchName: string;
  // null khi người xem không có quyền xem mức lương.
  salary: string | null;
  paymentMethod: SalaryPaymentMethod;
  allowances: ContractAllowance[] | null;
}
export interface ContractListItem {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  documentNo: string | null;
  kind: ContractKind;
  status: ContractStatus;
  validity: ContractValidity;
  effectiveDate: string;
  endDate: string | null;
  terminationDate: string | null;
  salary: string | null;
  // Số ngày đến ngày kết thúc (âm là đã quá hạn); chỉ hợp đồng có ngày kết thúc chưa xử lý.
  daysToEnd: number | null;
  overThirtyDays: boolean;
}
export type ContractListResponse = PageResponse<ContractListItem>;

export interface AppendixResponse {
  id: string;
  documentNo: string | null;
  status: Exclude<ContractStatus, "terminated">;
  effectiveDate: string;
  jobTitle: string | null;
  departmentId: string | null;
  departmentName: string | null;
  branchId: string | null;
  branchName: string | null;
  salary: string | null;
  paymentMethod: SalaryPaymentMethod | null;
  allowances: ContractAllowance[] | null;
  description: string;
  signDate: string | null;
  hasSignedFile: boolean;
  approvalRequestId: string | null;
  cancelReason: string | null;
  canWithdraw: boolean;
  version: number;
}

export interface ContractResponse extends ContractListItem {
  currency: string;
  original: ContractTerms;
  // Giá trị hiện hành tại hôm nay sau các phụ lục đã ký có hiệu lực (QUYTAC_NGHIEPVU_300).
  current: ContractTerms;
  probationLevel: ProbationLevel | null;
  officialSalary: string | null;
  signerName: string;
  signerTitle: string;
  otherTerms: string | null;
  legalExceptionReason: string | null;
  approvalRequestId: string | null;
  signDate: string | null;
  hasSignedFile: boolean;
  cancelReason: string | null;
  terminationReason: TerminationReason | null;
  terminationNote: string | null;
  appendices: AppendixResponse[];
  canManage: boolean;
  canWithdraw: boolean;
  version: number;
}

export const saveAppendixSchema = z
  .object({
    effectiveDate: isoDate,
    jobTitle: blankToNull(100),
    departmentId: z.string().uuid().nullable().optional(),
    branchId: z.string().uuid().nullable().optional(),
    salary: decimalText(4).nullable().optional(),
    paymentMethod: z.enum(salaryPaymentMethods).nullable().optional(),
    allowances: z.array(allowanceSchema).max(20).nullable().optional(),
    description: z.string().trim().min(1).max(4000),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveAppendixRequest = z.input<typeof saveAppendixSchema>;

export interface MyContractsResponse {
  currency: string;
  contracts: ContractResponse[];
}

// CONG_VIEC_47: Nhân sự phần 2 (MODULE_08) – ca làm, lịch làm việc, ngày lễ, chấm công (API_150, API_151).
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const attendanceSettingsSchema = z
  .object({
    workingTimeMode: z.enum(["daily", "weekly"]),
    graceMinutes: z.number().int().min(0).max(30),
    appLocationScope: z.enum(["branch", "company"]),
    carryoverMode: z.enum(["expire", "never"]),
    carryoverMonths: z.number().int().min(1).max(36),
    allowAdvanceLeave: z.boolean(),
    overtimeAnnualLimit: z.union([z.literal(200), z.literal(300)]),
    overtimeExtendedReason: blankToNull(500),
    correctionMonthlyLimit: z.number().int().min(0).max(31),
    // 0: công ty chưa lưu cài đặt.
    version: z.number().int().min(0).optional(),
  })
  .strict();
export type AttendanceSettingsRequest = z.input<typeof attendanceSettingsSchema>;
export type AttendanceSettingsResponse = Omit<z.output<typeof attendanceSettingsSchema>, "version"> & { version: number };

export const saveShiftSchema = z
  .object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(100),
    startTime: clockTime,
    endTime: clockTime,
    breakStart: clockTime.nullable().optional(),
    breakMinutes: z.number().int().min(0).max(240),
    breakPaid: z.boolean(),
    workUnits: z.enum(["1", "0.5"]),
    status: z.enum(["active", "inactive"]).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveShiftRequest = z.input<typeof saveShiftSchema>;
export interface ShiftItem {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakMinutes: number;
  breakPaid: boolean;
  workUnits: "1" | "0.5";
  status: "active" | "inactive";
  standardMinutes: number;
  nightMinutes: number;
  // Ca từ 6 giờ chuẩn mà nghỉ giữa ca ngắn hơn luật (Bộ luật Lao động Điều 109): chỉ cảnh báo.
  shortBreakWarning: boolean;
  version: number;
}

export const saveScheduleSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    isDefault: z.boolean(),
    shiftIds: z.array(z.string().uuid().nullable()).length(7),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveScheduleRequest = z.input<typeof saveScheduleSchema>;
export const assignScheduleSchema = z
  .object({
    departmentId: z.string().uuid().nullable().optional(),
    employeeId: z.string().uuid().nullable().optional(),
    effectiveFrom: isoDate,
  })
  .strict();
export type AssignScheduleRequest = z.input<typeof assignScheduleSchema>;
export interface ScheduleItem {
  id: string;
  name: string;
  isDefault: boolean;
  shiftIds: (string | null)[];
  shiftCodes: (string | null)[];
  weeklyMinutes: number;
  assignments: { id: string; departmentId: string | null; departmentName: string | null; employeeId: string | null; employeeName: string | null; effectiveFrom: string }[];
  version: number;
}

export const rosterQuerySchema = z.object({ weekStart: isoDate, departmentId: z.string().uuid().optional() }).strict();
export type RosterWarning = "weeklyHoursExceeded" | "noRestDay" | "shortRestBetweenShifts";
export interface RosterRow {
  employeeId: string;
  code: string;
  fullName: string;
  departmentName: string | null;
  isMinor: boolean;
  cells: { date: string; shiftId: string | null; fromRoster: boolean; holiday: boolean; locked: boolean }[];
  weeklyMinutes: number;
  warnings: RosterWarning[];
}
export interface RosterResponse {
  weekStart: string;
  dates: string[];
  shifts: ShiftItem[];
  rows: RosterRow[];
  canEditAll: boolean;
}
export const saveRosterSchema = z
  .object({
    cells: z
      .array(z.object({ employeeId: z.string().uuid(), date: isoDate, shiftId: z.string().uuid().nullable(), clear: z.boolean().optional() }).strict())
      .min(1)
      .max(2000),
  })
  .strict();
export type SaveRosterRequest = z.input<typeof saveRosterSchema>;

export interface HolidayItem {
  id: string;
  date: string;
  name: string;
  foreignersOnly: boolean;
  scope: "group" | "company";
  canDelete: boolean;
}
export interface HolidayListResponse {
  year: number;
  canManageGroup: boolean;
  canManageCompany: boolean;
  items: HolidayItem[];
}
export const saveHolidaySchema = z
  .object({ date: isoDate, name: z.string().trim().min(1).max(100), foreignersOnly: z.boolean(), scope: z.enum(["group", "company"]) })
  .strict();
export type SaveHolidayRequest = z.input<typeof saveHolidaySchema>;
export const generateHolidaysSchema = z.object({ year: z.number().int().min(2000).max(2100) }).strict();

export type AttendanceDayStatus = "scheduled" | "present" | "missing_punch" | "absent" | "rest" | "holiday" | "leave";
export interface AttendanceDayCell {
  date: string;
  status: AttendanceDayStatus;
  dayKind: "workday" | "rest_day" | "holiday";
  shiftCode: string | null;
  plannedUnits: string;
  workedUnits: string;
  lateMinutes: number;
  earlyMinutes: number;
  leaveUnits: string;
  leavePayGroup: "annual" | "paid_personal" | "paid_other" | "unpaid" | "social_insurance" | null;
}
export const attendanceGridQuerySchema = z
  .object({
    month: yearMonth,
    departmentId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    status: z.enum(["missing_punch", "absent", "late"]).optional(),
  })
  .strict();
export interface AttendanceGridRow {
  employeeId: string;
  code: string;
  fullName: string;
  departmentName: string | null;
  attendanceCode: string | null;
  days: AttendanceDayCell[];
  workedUnits: string;
}
export interface AttendanceGridResponse {
  month: string;
  dates: string[];
  canManage: boolean;
  monthClosed: boolean;
  rows: AttendanceGridRow[];
}
export type PunchSource = "device" | "manual" | "app" | "correction";
export interface AttendancePunchItem {
  id: string;
  punchedAt: string;
  source: PunchSource;
  deviceCode: string | null;
  method: "gps" | "ip" | "qr" | null;
  locationName: string | null;
  distanceMeters: number | null;
  reason: string | null;
  createdByName: string;
  canDelete: boolean;
}
export interface AttendanceDayResponse {
  employeeId: string;
  code: string;
  fullName: string;
  date: string;
  day: (AttendanceDayCell & { firstIn: string | null; lastOut: string | null; workedMinutes: number; standardMinutes: number; nightMinutes: number; plannedStart: string | null; plannedEnd: string | null }) | null;
  punches: AttendancePunchItem[];
  canManage: boolean;
}
export const manualPunchSchema = z
  .object({
    employeeId: z.string().uuid(),
    workDate: isoDate,
    checkIn: clockTime.nullable().optional(),
    checkOut: clockTime.nullable().optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict()
  .refine((value) => Boolean(value.checkIn || value.checkOut), { path: ["checkIn"], message: "required" });
export type ManualPunchRequest = z.input<typeof manualPunchSchema>;
export const deletePunchSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const attendanceCodeSchema = z.object({ attendanceCode: blankToNull(20) }).strict();
export const recalculateAttendanceSchema = z.object({ month: yearMonth }).strict();
export interface AttendanceImportResponse {
  fileName: string;
  totalRows: number;
  accepted: number;
  duplicates: number;
  // messageKey là khóa trong nhóm `errors` của tệp dịch.
  errors: { row: number; messageKey: string }[];
  imported: boolean;
}
export interface AttendanceImportItem {
  id: string;
  fileName: string;
  importedAt: string;
  importedByName: string;
  accepted: number;
  duplicates: number;
  errors: number;
}

// CONG_VIEC_47 lát L1: địa điểm chấm công, chấm công trên ứng dụng, đơn giải trình (API_150, API_152, API_155).
export const saveAttendanceLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    branchId: z.string().uuid(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    radiusMeters: z.number().int().min(50).max(1000).nullable().optional(),
    ipRanges: z.array(z.string().trim().min(1).max(50)).max(20),
    qrEnabled: z.boolean(),
    status: z.enum(["active", "inactive"]).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveAttendanceLocationRequest = z.input<typeof saveAttendanceLocationSchema>;
export interface AttendanceLocationItem {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  ipRanges: string[];
  qrEnabled: boolean;
  status: "active" | "inactive";
  version: number;
}
export interface AttendanceQrResponse {
  locationName: string;
  token: string;
  // Đường dẫn tương đối trong mini app Nhân sự; giao diện ghép với địa chỉ trang.
  path: string;
  expiresInSeconds: number;
}
export const appPunchSchema = z
  .object({
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    accuracyMeters: z.number().min(0).max(100000).nullable().optional(),
    locationId: z.string().uuid().nullable().optional(),
    qrToken: z.string().trim().max(64).nullable().optional(),
  })
  .strict();
export type AppPunchRequest = z.input<typeof appPunchSchema>;
export interface MyAttendanceResponse {
  employee: { id: string; code: string; fullName: string } | null;
  today: string;
  shift: { code: string; start: string; end: string } | null;
  holiday: boolean;
  punches: { punchedAt: string; source: PunchSource; method: "gps" | "ip" | "qr" | null; locationName: string | null }[];
  nextAction: "in" | "out";
  locations: { id: string; name: string; gps: boolean; ip: boolean; qr: boolean; latitude: number | null; longitude: number | null; radiusMeters: number | null }[];
  networkMatched: boolean;
  // Trưởng phòng hoặc có quyền xem chấm công công ty: hiện liên kết Chấm công, Xếp ca.
  canViewTeam: boolean;
  canViewCompany: boolean;
}
export interface MyAttendanceMonthResponse {
  month: string;
  days: (AttendanceDayCell & { firstIn: string | null; lastOut: string | null })[];
  workedUnits: string;
  lateCount: number;
  lateMinutes: number;
}
export interface MyWeekResponse {
  weekStart: string;
  days: { date: string; shiftCode: string | null; start: string | null; end: string | null; holiday: boolean }[];
}
export const correctionKinds = ["forgot", "business_trip", "off_site", "device_error", "other"] as const;
export type CorrectionKind = (typeof correctionKinds)[number];
export const createCorrectionSchema = z
  .object({
    workDate: isoDate,
    kind: z.enum(correctionKinds),
    checkIn: z.preprocess((value) => (value === "" ? null : value), clockTime.nullable().optional()),
    checkOut: z.preprocess((value) => (value === "" ? null : value), clockTime.nullable().optional()),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict()
  .refine((value) => Boolean(value.checkIn || value.checkOut), { path: ["checkIn"], message: "required" });
export type CorrectionStatus = "pending" | "approved" | "rejected" | "withdrawn";
export interface CorrectionItem {
  id: string;
  correctionNo: string | null;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  kind: CorrectionKind;
  checkIn: string | null;
  checkOut: string | null;
  reason: string;
  hasAttachment: boolean;
  status: CorrectionStatus;
  approvalRequestId: string | null;
  requestedAt: string;
  canWithdraw: boolean;
}
export const correctionListQuerySchema = z.object({ status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(), month: yearMonth.optional() }).strict();
// CONG_VIEC_48 lát L0: thiết lập lương, loại phụ cấp, hồ sơ lương (API_156 đến API_158; QUYTAC_NGHIEPVU_312 đến 315).
const firstOfMonth = isoDate.refine((value) => value.endsWith("-01"), { message: "invalidValue" });
const rateText = decimalText(4);
const taxBracketSchema = z.object({ upperBound: decimalText(4).nullable(), rate: rateText }).strict();
export const savePayrollParametersSchema = z
  .object({
    effectiveFrom: firstOfMonth,
    baseSalary: decimalText(4),
    insuranceReference: decimalText(4).nullable().optional(),
    regionMinimums: z.tuple([decimalText(4), decimalText(4), decimalText(4), decimalText(4)]),
    employeeSocialRate: rateText,
    employeeHealthRate: rateText,
    employeeUnemploymentRate: rateText,
    employerRetirementRate: rateText,
    employerSicknessRate: rateText,
    employerHealthRate: rateText,
    employerUnemploymentRate: rateText,
    socialCapMultiplier: rateText,
    healthCapMultiplier: rateText,
    unemploymentCapMultiplier: rateText,
    personalDeduction: decimalText(4),
    dependentDeduction: decimalText(4),
    flatWithholdingRate: rateText,
    unpaidDaysThreshold: z.number().int().min(1).max(31),
    taxBrackets: z.array(taxBracketSchema).min(1).max(10),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePayrollParametersRequest = z.input<typeof savePayrollParametersSchema>;
export interface PayrollParametersItem {
  id: string;
  effectiveFrom: string;
  baseSalary: string;
  insuranceReference: string | null;
  regionMinimums: [string, string, string, string];
  employeeSocialRate: string;
  employeeHealthRate: string;
  employeeUnemploymentRate: string;
  employerRetirementRate: string;
  employerSicknessRate: string;
  employerHealthRate: string;
  employerUnemploymentRate: string;
  socialCapMultiplier: string;
  healthCapMultiplier: string;
  unemploymentCapMultiplier: string;
  personalDeduction: string;
  dependentDeduction: string;
  flatWithholdingRate: string;
  unpaidDaysThreshold: number;
  taxBrackets: { upperBound: string | null; rate: string }[];
  // Đang áp dụng: bộ có ngày hiệu lực gần nhất không sau hôm nay.
  current: boolean;
  // Đã được bảng lương đã duyệt dùng thì không sửa, không xóa (QUYTAC_NGHIEPVU_312).
  used: boolean;
  version: number;
}

export const savePayrollCompanySettingsSchema = z
  .object({
    unionFeeEnabled: z.boolean(),
    unionFeeRate: rateText,
    accidentRate: rateText,
    withholdingThreshold: decimalText(4),
    fallbackStandardDays: z.number().int().min(1).max(31),
    overtimeWeekdayRate: rateText,
    overtimeWeeklyRestRate: rateText,
    overtimeHolidayRate: rateText,
    nightRate: rateText,
    nightOvertimeRate: rateText,
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePayrollCompanySettingsRequest = z.input<typeof savePayrollCompanySettingsSchema>;
export type PayrollCompanySettings = z.output<typeof savePayrollCompanySettingsSchema> & { version: number };

export const payrollCostGroups = ["selling", "admin"] as const;
export type PayrollCostGroup = (typeof payrollCostGroups)[number];
export const saveBranchRegionsSchema = z
  .object({ items: z.array(z.object({ branchId: z.string().uuid(), region: z.number().int().min(1).max(4).nullable() }).strict()).max(500) })
  .strict();
export const saveDepartmentGroupsSchema = z
  .object({ items: z.array(z.object({ departmentId: z.string().uuid(), costGroup: z.enum(payrollCostGroups) }).strict()).max(500) })
  .strict();
export interface PayrollSettingsResponse {
  parameters: PayrollParametersItem[];
  canEditParameters: boolean;
  canEditCompany: boolean;
  company: PayrollCompanySettings;
  branches: { branchId: string; code: string; name: string; region: number | null }[];
  departments: { departmentId: string; name: string; costGroup: PayrollCostGroup }[];
}

export const allowanceTaxModes = ["taxable", "exempt", "exempt_up_to"] as const;
export type AllowanceTaxMode = (typeof allowanceTaxModes)[number];
export const saveAllowanceTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    taxMode: z.enum(allowanceTaxModes),
    exemptLimit: decimalText(4).nullable().optional(),
    prorated: z.boolean(),
    overtimeBase: z.boolean(),
    status: z.enum(["active", "inactive"]).default("active"),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveAllowanceTypeRequest = z.input<typeof saveAllowanceTypeSchema>;
export interface AllowanceTypeItem {
  id: string;
  name: string;
  taxMode: AllowanceTaxMode;
  exemptLimit: string | null;
  prorated: boolean;
  overtimeBase: boolean;
  status: "active" | "inactive";
  version: number;
}

export const payrollTaxMethods = ["auto", "progressive", "flat"] as const;
export type PayrollTaxMethod = (typeof payrollTaxMethods)[number];
export const savePayrollProfileSchema = z
  .object({
    socialExempt: z.boolean(),
    healthExempt: z.boolean(),
    unemploymentExempt: z.boolean(),
    exemptionReason: blankToNull(500),
    taxMethod: z.enum(payrollTaxMethods),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePayrollProfileRequest = z.input<typeof savePayrollProfileSchema>;
export const saveInsuranceSalarySchema = z.object({ effectiveMonth: firstOfMonth, amount: decimalText(4), note: blankToNull(500) }).strict();
export type SaveInsuranceSalaryRequest = z.input<typeof saveInsuranceSalarySchema>;
export const uploadTaxCommitmentSchema = z.object({ year: z.coerce.number().int().min(2000).max(2100) }).strict();
export interface InsuranceSalaryItem {
  id: string;
  effectiveMonth: string;
  amount: string;
  note: string | null;
  createdByName: string;
  createdAt: string;
  // Thấp hơn lương tối thiểu vùng của chi nhánh làm việc tại tháng hiệu lực (cảnh báo, không chặn).
  belowRegionalMinimum: boolean;
}
export interface PayrollProfileResponse {
  employeeId: string;
  socialExempt: boolean;
  healthExempt: boolean;
  unemploymentExempt: boolean;
  exemptionReason: string | null;
  taxMethod: PayrollTaxMethod;
  hasTaxCode: boolean;
  insuranceSalaries: InsuranceSalaryItem[];
  taxCommitments: { id: string; year: number; fileName: string; uploadedAt: string }[];
  version: number | null;
}
export interface MissingInsuranceItem {
  employeeId: string;
  code: string;
  fullName: string;
  contractKind: ContractKind | null;
  contractEndDate: string | null;
}

// CONG_VIEC_48 lát L1: bảng lương tháng (API_159, API_160; QUYTAC_NGHIEPVU_316 đến 322).
export const payrollStatuses = ["draft", "pending", "rejected", "withdrawn", "approved", "paid", "cancelled"] as const;
export type PayrollStatus = (typeof payrollStatuses)[number];
export const payrollWarnings = [
  "timesheetMissing",
  "branchRegionMissing",
  "negativeNet",
  "allowanceTypeMissing",
  "missingInsuranceSalary",
  "insuranceBelowMinimum",
  "unpaidDaysNoInsurance",
  "probationNoInsurance",
  "missingTaxCode",
  "flatWithholding",
] as const;
export type PayrollWarningCode = (typeof payrollWarnings)[number];
export const payrollAdjustmentCategories = ["bonus", "arrears", "commission", "advance", "compensation", "union_dues", "other"] as const;
export type PayrollAdjustmentCategory = (typeof payrollAdjustmentCategories)[number];

export const createPayrollSchema = z.object({ month: firstOfMonth }).strict();
export const payrollListQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    status: z.enum(payrollStatuses).optional(),
  })
  .strict();
export const payrollLineQuerySchema = z
  .object({
    departmentId: z.string().uuid().optional(),
    warningsOnly: z.enum(["true", "false"]).optional(),
  })
  .strict();
export const savePayrollAdjustmentSchema = z
  .object({
    employeeId: z.string().uuid(),
    kind: z.enum(["addition", "deduction"]),
    category: z.enum(payrollAdjustmentCategories),
    taxable: z.boolean().default(false),
    description: z.string().trim().min(1).max(200),
    amount: decimalText(4),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SavePayrollAdjustmentRequest = z.input<typeof savePayrollAdjustmentSchema>;
export const cancelPayrollSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const payPayrollSchema = z.object({ paymentDate: isoDate, fundId: z.string().uuid() }).strict();

export interface PayrollTotals {
  employeeCount: number;
  grossIncome: string;
  employeeInsurance: string;
  personalIncomeTax: string;
  deductions: string;
  netPay: string;
  employerInsurance: string;
  unionFee: string;
  employerCost: string;
}
export interface PayrollListItem extends PayrollTotals {
  id: string;
  month: string;
  documentNo: string | null;
  status: PayrollStatus;
}
export interface PayrollListResponse {
  data: PayrollListItem[];
  canManage: boolean;
}
export interface PayrollLineItem {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  costGroup: PayrollCostGroup;
  taxMethod: "progressive" | "flat";
  standardDays: string;
  paidDays: string;
  timePay: string;
  allowancePay: string;
  overtimePay: string;
  nightPremium: string;
  settledLeavePay: string;
  additions: string;
  deductions: string;
  grossIncome: string;
  taxableIncome: string;
  employeeInsurance: string;
  personalIncomeTax: string;
  netPay: string;
  employerCost: string;
  warnings: PayrollWarningCode[];
}
export interface PayrollAdjustmentItem {
  id: string;
  employeeId: string;
  kind: "addition" | "deduction";
  category: PayrollAdjustmentCategory;
  taxable: boolean;
  description: string;
  amount: string;
  version: number;
}
export interface PayrollLineDetail extends PayrollLineItem {
  monthlySalary: string;
  socialBase: string;
  healthBase: string;
  unemploymentBase: string;
  employeeSocial: string;
  employeeHealth: string;
  employeeUnemployment: string;
  employerSocial: string;
  employerHealth: string;
  employerUnemployment: string;
  unionFee: string;
  familyDeduction: string;
  assessableIncome: string;
  explanation: Record<string, unknown>;
  adjustments: PayrollAdjustmentItem[];
  canEdit: boolean;
}
export interface PayrollResponse extends PayrollTotals, PayrollPostingInfo {
  id: string;
  month: string;
  documentNo: string | null;
  status: PayrollStatus;
  parameterEffectiveFrom: string;
  baseSalary: string;
  standardDays: string | null;
  timesheetClosed: boolean;
  calculatedAt: string;
  calculatedByName: string;
  approvalRequestId: string | null;
  cancelReason: string | null;
  // Số dòng có cảnh báo chặn gửi duyệt (chưa có bảng công, chi nhánh chưa chọn vùng, thực lĩnh âm).
  blockingCount: number;
  warningCount: number;
  lines: PayrollLineItem[];
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canCancel: boolean;
  version: number;
}

// CONG_VIEC_48 lát L2: bút toán, trả lương, phiếu lương (API_160, API_161; QUYTAC_NGHIEPVU_323).
export type PayPayrollRequest = z.input<typeof payPayrollSchema>;
export interface PayrollJournal {
  id: string;
  journalNo: string;
  journalDate: string;
  sourceType: "payroll" | "payroll_payment";
  lines: { accountCode: string; accountName: string; debit: string; credit: string }[];
}
export interface PayrollPostingInfo {
  paymentDate: string | null;
  fundName: string | null;
  journals: PayrollJournal[];
  emailFailedCount: number;
  canPay: boolean;
  funds: { id: string; name: string; kind: "cash" | "bank" }[];
}
export interface PayslipListItem {
  lineId: string;
  month: string;
  netPay: string;
  status: "approved" | "paid";
  paymentDate: string | null;
}
export interface PayslipResponse {
  lineId: string;
  month: string;
  status: "approved" | "paid";
  paymentDate: string | null;
  employeeCode: string;
  employeeName: string;
  companyName: string;
  line: PayrollLineDetail;
}

// CONG_VIEC_47 lát L2: nghỉ phép (API_153; QUYTAC_NGHIEPVU_307 đến 309).
export const leavePayGroups = ["annual", "paid_personal", "paid_other", "unpaid", "social_insurance"] as const;
export type LeavePayGroup = (typeof leavePayGroups)[number];
export interface LeaveTypeItem {
  id: string;
  systemCode: string | null;
  name: string;
  payGroup: LeavePayGroup;
  perEventDays: string | null;
  yearlyMaxDays: string | null;
  requiresAttachment: boolean;
  status: "active" | "inactive";
  // Loại bảo hiểm xã hội chỉ nhân sự ghi nhận.
  selfService: boolean;
  version: number;
}
export const saveLeaveTypeSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    payGroup: z.enum(["paid_other", "unpaid"]).optional(),
    yearlyMaxDays: decimalText(1).nullable().optional(),
    requiresAttachment: z.boolean().optional(),
    status: z.enum(["active", "inactive"]).optional(),
    version: z.number().int().positive().optional(),
  })
  .strict();
export type SaveLeaveTypeRequest = z.input<typeof saveLeaveTypeSchema>;
export const workConditions = ["normal", "disabled", "hazardous", "very_hazardous"] as const;
export type WorkCondition = (typeof workConditions)[number];
export const saveLeavePolicySchema = z.object({ workCondition: z.enum(workConditions), seniorityStart: isoDate.nullable().optional() }).strict();
export const leaveAdjustmentSchema = z
  .object({
    employeeId: z.string().uuid(),
    leaveYear: z.number().int().min(2000).max(2100),
    days: z.string().trim().regex(/^-?\d{1,3}(\.\d{1,2})?$/),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export type LeaveAdjustmentRequest = z.input<typeof leaveAdjustmentSchema>;
export interface LeaveYearBalance {
  leaveYear: number;
  accrued: string;
  adjusted: string;
  used: string;
  expired: string;
  paidOut: string;
  balance: string;
  expiresOn: string | null;
}
export interface LeaveBalanceItem {
  employeeId: string;
  code: string;
  fullName: string;
  workCondition: WorkCondition;
  isMinor: boolean;
  seniorityStart: string;
  entitlementDays: number;
  years: LeaveYearBalance[];
  available: string;
  pending: string;
}
export interface LeaveLedgerEntry {
  id: string;
  leaveYear: number;
  kind: "accrual" | "month_reversal" | "usage" | "adjustment" | "expiry" | "payout";
  days: string;
  accrualMonth: string | null;
  requestNo: string | null;
  reason: string | null;
  createdAt: string;
}
export const leaveHalves = ["full", "morning", "afternoon"] as const;
export const leaveRequestBodySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    leaveTypeId: z.string().uuid(),
    fromDate: isoDate,
    fromHalf: z.enum(leaveHalves),
    toDate: isoDate,
    toHalf: z.enum(["full", "morning"]),
    reason: z.preprocess((value) => (value === "" ? null : value), z.string().trim().max(1000).nullable().optional()),
  })
  .strict();
export type LeaveRequestBody = z.input<typeof leaveRequestBodySchema>;
export interface LeavePreviewResponse {
  days: string;
  dates: { date: string; half: "full" | "morning" | "afternoon"; units: string }[];
  // Phép năm: số dư khả dụng trước và sau đơn.
  availableBefore: string | null;
  availableAfter: string | null;
}
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "withdrawn" | "cancelled";
export interface LeaveRequestItem {
  id: string;
  requestNo: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  payGroup: LeavePayGroup;
  fromDate: string;
  fromHalf: "full" | "morning" | "afternoon";
  toDate: string;
  toHalf: "full" | "morning";
  days: string;
  reason: string | null;
  hasAttachment: boolean;
  source: "self" | "hr";
  status: LeaveRequestStatus;
  approvalRequestId: string | null;
  requestedAt: string;
  cancelReason: string | null;
  canWithdraw: boolean;
  canCancel: boolean;
}
export const leaveRequestListQuerySchema = z
  .object({ status: z.enum(["pending", "approved", "rejected", "withdrawn", "cancelled"]).optional(), month: yearMonth.optional(), leaveTypeId: z.string().uuid().optional() })
  .strict();
export const cancelLeaveSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export interface MyLeaveResponse {
  balance: LeaveBalanceItem | null;
  types: LeaveTypeItem[];
  requests: LeaveRequestItem[];
}

// CONG_VIEC_47 lát L3: tăng ca (API_154; QUYTAC_NGHIEPVU_310), bảng công tháng (API_155; QUYTAC_NGHIEPVU_311).
export const overtimeBodySchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    workDate: isoDate,
    startTime: clockTime,
    endTime: clockTime,
    workContent: z.string().trim().min(1).max(500),
    workLocation: z.string().trim().min(1).max(200),
  })
  .strict();
export type OvertimeBody = z.input<typeof overtimeBodySchema>;
export type OvertimeViolation = "dayLimit" | "monthLimit" | "yearLimit" | "minor" | "overlapsShift" | "overlapsRequest";
export interface OvertimePreviewResponse {
  dayKind: "weekday" | "rest_day" | "holiday";
  hours: string;
  nightHours: string;
  dayLimitHours: string;
  monthUsedHours: string;
  monthLimitHours: number;
  yearUsedHours: string;
  yearLimitHours: number;
  violations: OvertimeViolation[];
}
export type OvertimeStatus = "awaiting_consent" | "declined" | "pending" | "approved" | "rejected" | "withdrawn" | "cancelled";
export interface OvertimeItem {
  id: string;
  requestNo: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  workDate: string;
  startAt: string;
  endAt: string;
  hours: string;
  dayKind: "weekday" | "rest_day" | "holiday";
  workContent: string;
  workLocation: string;
  consentStatus: "pending" | "agreed" | "declined" | "document";
  status: OvertimeStatus;
  approvalRequestId: string | null;
  // Giờ được tính theo công ngày (khi đã duyệt và ngày đã có kết quả).
  countedHours: string | null;
  canConsent: boolean;
  canWithdraw: boolean;
  canCancel: boolean;
}
export const overtimeListQuerySchema = z
  .object({ month: yearMonth, status: z.enum(["awaiting_consent", "declined", "pending", "approved", "rejected", "withdrawn", "cancelled"]).optional() })
  .strict();
export interface OvertimeTotalItem {
  employeeId: string;
  code: string;
  fullName: string;
  monthHours: string;
  yearHours: string;
  monthRemaining: string;
  yearRemaining: string;
}
export const overtimeConsentSchema = z.object({ agree: z.boolean() }).strict();
export const cancelOvertimeSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

export type TimesheetStatus = "open" | "confirming" | "closed";
export type TimesheetConfirmation = "pending" | "confirmed" | "disputed" | "auto_confirmed";
export interface TimesheetLineItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentName: string | null;
  employmentFrom: string;
  employmentTo: string;
  monthStandardUnits: string;
  standardUnits: string;
  standardHours: string;
  workedUnits: string;
  workedHours: string;
  holidayUnits: string;
  annualLeaveUnits: string;
  paidPersonalLeaveUnits: string;
  otherPaidLeaveUnits: string;
  unpaidLeaveUnits: string;
  socialInsuranceLeaveUnits: string;
  absentUnits: string;
  paidUnits: string;
  nightHours: string;
  overtimeWeekdayHours: string;
  overtimeWeekdayNightHours: string;
  overtimeWeekdayNightAfterDayHours: string;
  overtimeRestDayHours: string;
  overtimeRestDayNightHours: string;
  overtimeHolidayHours: string;
  overtimeHolidayNightHours: string;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  annualLeavePayoutUnits: string;
  annualLeaveBalanceEnd: string;
  confirmationStatus: TimesheetConfirmation;
  confirmedAt: string | null;
  disputeNote: string | null;
  disputeReply: string | null;
}
export interface TimesheetResponse {
  month: string;
  status: TimesheetStatus;
  monthEnded: boolean;
  confirmationDeadline: string | null;
  closedAt: string | null;
  payrollLocked: boolean;
  counts: { total: number; confirmed: number; disputed: number; pending: number };
  canManage: boolean;
  lines: TimesheetLineItem[];
}
export const openConfirmationSchema = z.object({ deadline: isoDate }).strict();
export const timesheetDisputeSchema = z.object({ note: z.string().trim().min(1).max(1000) }).strict();
export const timesheetReplySchema = z.object({ reply: z.string().trim().min(1).max(1000) }).strict();
export const reopenTimesheetSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export interface MyTimesheetResponse {
  month: string;
  status: TimesheetStatus | null;
  confirmationDeadline: string | null;
  line: TimesheetLineItem | null;
}

// CONG_VIEC_50: báo cáo quản trị (MODULE_15; API_170 đến API_175).
export const analyticsReportKinds = ["sales", "inventory", "debt", "commission"] as const;
export type AnalyticsReportKind = (typeof analyticsReportKinds)[number];

export interface AnalyticsCompany {
  id: string;
  code: string;
  name: string;
  currency: string;
  // QUYTAC_NGHIEPVU_339: chỉ công ty cùng đồng tiền hạch toán với công ty gốc được cộng vào dòng tổng.
  inTotal: boolean;
}

// API_170
export interface AnalyticsScopeResponse {
  group: { id: string; name: string; currency: string };
  today: string;
  companies: AnalyticsCompany[];
  // Công ty được xem theo từng nhóm báo cáo; mảng rỗng khi không có quyền nhóm đó.
  reports: Record<AnalyticsReportKind, string[]>;
}

// QUYTAC_NGHIEPVU_343: khoảng ngày bắt buộc, từ ngày không sau đến ngày, tối đa 366 ngày.
export const analyticsMaximumDays = 366;
export const analyticsCompanyIdsSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(",").filter(Boolean) : undefined))
  .pipe(z.array(z.uuid()).max(100).optional());
export const analyticsPeriodSchema = { from: isoDate, to: isoDate };
export const analyticsFormatSchema = z.enum(["json", "xlsx"]).default("json");

// Dòng tiền của báo cáo quản trị theo đồng tiền hạch toán; inTotal = cộng vào dòng tổng (QUYTAC_NGHIEPVU_339).
export interface AnalyticsMoneyRow {
  currency: string;
  inTotal: boolean;
}
// QUYTAC_NGHIEPVU_343: bảng hiện tối đa 500 dòng, xuất Excel tối đa 20.000 dòng.
export const analyticsDisplayRows = 500;
export const analyticsExportRows = 20_000;

// API_171
export const analyticsSalesGroupings = ["company", "channel", "product", "day", "month"] as const;
export type AnalyticsSalesGrouping = (typeof analyticsSalesGroupings)[number];
export const analyticsSalesQuerySchema = z
  .object({
    companyIds: analyticsCompanyIdsSchema,
    ...analyticsPeriodSchema,
    groupBy: z.enum(analyticsSalesGroupings).default("company"),
    channelId: z.uuid().optional(),
    marketplaceOnly: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
    format: analyticsFormatSchema,
  })
  .strict();
export interface AnalyticsSalesFigures {
  quantity: string;
  revenue: string;
  cost: string;
  grossProfit: string;
  internalRevenue: string;
}
export interface AnalyticsSalesRow extends AnalyticsMoneyRow, AnalyticsSalesFigures {
  key: string;
  label: string;
}
export interface AnalyticsSalesResponse {
  from: string;
  to: string;
  groupBy: AnalyticsSalesGrouping;
  currency: string;
  companies: AnalyticsCompany[];
  channels: { id: string; label: string }[];
  rows: AnalyticsSalesRow[];
  // Tổng các dòng cùng đồng tiền với công ty gốc, tính trên toàn bộ dữ liệu.
  totals: AnalyticsSalesFigures & { revenueExcludingInternal: string };
  // Số dòng có dữ liệu khi bảng bị cắt; null khi hiện đủ.
  totalRows: number | null;
}

// API_172
export const analyticsInventoryGroupings = ["company", "warehouse", "product"] as const;
export type AnalyticsInventoryGrouping = (typeof analyticsInventoryGroupings)[number];
export const analyticsInventoryQuerySchema = z
  .object({
    companyIds: analyticsCompanyIdsSchema,
    ...analyticsPeriodSchema,
    groupBy: z.enum(analyticsInventoryGroupings).default("warehouse"),
    warehouseId: z.uuid().optional(),
    format: analyticsFormatSchema,
  })
  .strict();
export interface AnalyticsInventoryFigures {
  openingQuantity: string;
  openingValue: string;
  inQuantity: string;
  inValue: string;
  outQuantity: string;
  outValue: string;
  closingQuantity: string;
  closingValue: string;
  // Giá vốn hàng bán trong kỳ (QUYTAC_NGHIEPVU_337), vòng quay, số ngày tồn; null khi chia cho 0 (QUYTAC_NGHIEPVU_340).
  costOfSales: string;
  turnover: string | null;
  daysOfInventory: string | null;
}
export interface AnalyticsInventoryRow extends AnalyticsMoneyRow, AnalyticsInventoryFigures {
  key: string;
  label: string;
}
export interface AnalyticsInventoryResponse {
  from: string;
  to: string;
  days: number;
  groupBy: AnalyticsInventoryGrouping;
  currency: string;
  companies: AnalyticsCompany[];
  warehouses: { id: string; label: string }[];
  rows: AnalyticsInventoryRow[];
  // Tổng giá trị các công ty cùng đồng tiền với công ty gốc; số lượng không cộng vì khác đơn vị giữa sản phẩm.
  totals: Pick<AnalyticsInventoryFigures, "openingValue" | "inValue" | "outValue" | "closingValue" | "costOfSales" | "turnover" | "daysOfInventory">;
  totalRows: number | null;
}

// API_173
export const analyticsDebtGroupings = ["company", "partner"] as const;
export type AnalyticsDebtGrouping = (typeof analyticsDebtGroupings)[number];
export const analyticsDebtQuerySchema = z
  .object({
    companyIds: analyticsCompanyIdsSchema,
    side: z.enum(["receivable", "payable"]).default("receivable"),
    groupBy: z.enum(analyticsDebtGroupings).default("company"),
    format: analyticsFormatSchema,
  })
  .strict();
export interface AnalyticsDebtFigures {
  balance: string;
  notDue: string;
  overdue1To30: string;
  overdue31To60: string;
  overdue61To90: string;
  overdueOver90: string;
  advance: string;
  // Số dư với đối tác nội bộ thuộc tập đoàn (QUYTAC_NGHIEPVU_338).
  internalBalance: string;
}
export interface AnalyticsDebtRow extends AnalyticsMoneyRow, AnalyticsDebtFigures {
  key: string;
  label: string;
}
export interface AnalyticsDebtResponse {
  today: string;
  side: DebtSide;
  groupBy: AnalyticsDebtGrouping;
  currency: string;
  companies: AnalyticsCompany[];
  // Thẻ phải thu, phải trả của các công ty cùng đồng tiền với công ty gốc.
  summary: Record<DebtSide, { balance: string; overdue: string }>;
  rows: AnalyticsDebtRow[];
  totals: AnalyticsDebtFigures & { balanceExcludingInternal: string };
  totalRows: number | null;
}

// API_174
export const analyticsCommissionGroupings = ["share", "beneficiary"] as const;
export type AnalyticsCommissionGrouping = (typeof analyticsCommissionGroupings)[number];
export const analyticsCommissionQuerySchema = z
  .object({
    companyIds: analyticsCompanyIdsSchema,
    ...analyticsPeriodSchema,
    groupBy: z.enum(analyticsCommissionGroupings).default("share"),
    format: analyticsFormatSchema,
  })
  .strict();
export interface AnalyticsCommissionResponse {
  from: string;
  to: string;
  groupBy: AnalyticsCommissionGrouping;
  currency: string;
  companies: AnalyticsCompany[];
  summary: {
    credited: string;
    creditedLines: number;
    // Ước tính hoa hồng của đơn chưa hoàn tất tại hôm nay (QUYTAC_NGHIEPVU_203).
    pending: string;
    paid: { count: number; amount: string; taxAmount: string; feeAmount: string; netAmount: string };
    pendingWithdrawals: { count: number; amount: string };
    // Tổng số dư ví; null khi công ty vận hành VComm không nằm trong các công ty đã chọn.
    walletBalance: string | null;
  };
  // key là loại phần hưởng (referral, staff, team_head, regional_director, director) hoặc mã người hưởng.
  rows: { key: string; label: string; lines: number; amount: string }[];
  withdrawals: { id: string; userName: string; paidOn: string; amount: string; taxAmount: string; feeAmount: string; netAmount: string }[];
  totalRows: number | null;
  totalWithdrawals: number | null;
}

// API_175: chỉ tiêu tổng quan theo quyền từng nhóm; null khi không có quyền nhóm đó hoặc không có công ty đã chọn được xem.
export const analyticsOverviewQuerySchema = z.object({ companyIds: analyticsCompanyIdsSchema, ...analyticsPeriodSchema }).strict();
export interface AnalyticsOverviewResponse {
  from: string;
  to: string;
  currency: string;
  sales: Pick<AnalyticsSalesResponse, "rows" | "totals"> | null;
  inventory: AnalyticsInventoryResponse["totals"] | null;
  debt: AnalyticsDebtResponse["summary"] | null;
  commission: Pick<AnalyticsCommissionResponse["summary"], "credited" | "pending" | "walletBalance"> | null;
}

// ---------------------------------------------------------------------------
// CONG_VIEC_51: Điểm thưởng (MODULE_11). Điểm là số nguyên; tiền, phần trăm là chuỗi số thập phân.
// ---------------------------------------------------------------------------
const loyaltyPercent = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,4})?$/, "invalidValue")
  .refine((value) => Number(value) <= 100, "invalidValue");
const loyaltyPointValue = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,4})?$/, "invalidValue")
  .refine((value) => Number(value) > 0, "invalidValue");
const loyaltyPointCount = z.number().int().min(1).max(1_000_000_000);

// QUYTAC_NGHIEPVU_345: giai đoạn chương trình điểm.
export const loyaltyPhaseSchema = z
  .object({
    startsOn: isoDate,
    endsOn: isoDate.nullable(),
    earnPercent: loyaltyPercent,
    pointValue: loyaltyPointValue,
    redeemMaxPercent: loyaltyPercent,
    redeemMinPoints: loyaltyPointCount,
    validityMonths: z.number().int().min(1).max(60),
    orderCapPoints: loyaltyPointCount.nullable(),
    monthlyCapPoints: loyaltyPointCount.nullable(),
  })
  .strict();
export type LoyaltyPhaseInput = z.infer<typeof loyaltyPhaseSchema>;
export const loyaltyPhaseUpdateSchema = loyaltyPhaseSchema.extend({ version: z.number().int().min(0) }).strict();

// QUYTAC_NGHIEPVU_351: bảng hạng, thay cả bảng; hạng đầu mức 0, mức tăng dần.
export const loyaltyTiersSchema = z
  .object({
    tiers: z
      .array(
        z
          .object({
            nameVi: z.string().trim().min(1).max(50),
            nameEn: z.string().trim().min(1).max(50),
            minAnnualSpend: z.string().trim().regex(/^\d{1,14}(\.\d{1,4})?$/, "invalidValue"),
            multiplier: z
              .string()
              .trim()
              .regex(/^\d(\.\d{1,3})?$/, "invalidValue")
              .refine((value) => Number(value) >= 1 && Number(value) <= 5, "invalidValue"),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict();
export type LoyaltyTiersInput = z.infer<typeof loyaltyTiersSchema>;

export type LoyaltyPhaseStatus = "upcoming" | "active" | "ended";
export interface LoyaltyPhase {
  id: string;
  startsOn: string;
  endsOn: string | null;
  earnPercent: string;
  pointValue: string;
  redeemMaxPercent: string;
  redeemMinPoints: number;
  validityMonths: number;
  orderCapPoints: number | null;
  monthlyCapPoints: number | null;
  status: LoyaltyPhaseStatus;
  version: number;
}
export interface LoyaltyTier {
  id: string;
  sortOrder: number;
  nameVi: string;
  nameEn: string;
  minAnnualSpend: string;
  multiplier: string;
}
export interface LoyaltyProgramResponse {
  today: string;
  phases: LoyaltyPhase[];
  tiers: LoyaltyTier[];
  canManage: boolean;
}

export type LoyaltyEntryKind = "earn" | "redeem" | "redeem_refund" | "earn_reversal" | "expire" | "adjust_add" | "adjust_subtract";
export type LoyaltySourceType = "marketplace_order" | "retail_sale" | "retail_return" | "adjustment";
export interface LoyaltyEntryItem {
  id: string;
  kind: LoyaltyEntryKind;
  points: number;
  balanceAfter: number;
  sourceType: LoyaltySourceType | null;
  sourceId: string | null;
  // Số chứng từ để hiện (số đơn bán của đơn VComm, số phiếu điều chỉnh); trống khi không có.
  documentNo: string | null;
  // Hạn dùng của lô khi bút toán là cộng điểm.
  expiresOn: string | null;
  createdAt: string;
}
export interface LoyaltyTierProgress {
  tier: LoyaltyTier | null;
  spendCurrentYear: string;
  spendPreviousYear: string;
  year: number;
  // Hạng kế tiếp và số tiền còn thiếu trong năm nay; trống khi đã ở hạng cao nhất.
  nextTier: LoyaltyTier | null;
  remainingToNext: string | null;
}
export interface BuyerLoyaltyResponse extends LoyaltyTierProgress {
  balance: number;
  locked: boolean;
  // Giá trị một điểm của giai đoạn đang hiệu lực; trống khi không có giai đoạn.
  pointValue: string | null;
  expiringPoints: number;
  expiringOn: string | null;
  tiers: LoyaltyTier[];
}
export interface LoyaltyDocumentPoints {
  redeemedPoints: number;
  redeemedAmount: string;
  refundedPoints: number;
  expectedPoints: number;
  earnedPoints: number | null;
  earnStatus: "pending" | "earned" | "skipped" | "cancelled";
  skipReason: "test_buyer" | "locked" | "inactive" | "no_phase" | "zero" | null;
  expiresOn: string | null;
  tierName: string | null;
  multiplier: string;
  earnPercent: string | null;
  pointValue: string | null;
}

// API_182: nghĩa vụ điểm theo tháng (CONG_VIEC_51; QUYTAC_NGHIEPVU_355). Điểm là số nguyên có dấu; giá trị theo giá trị một điểm lúc cộng.
export const loyaltyLiabilityQuerySchema = z.object({ year: z.coerce.number().int().min(2020).max(2100) }).strict();
export interface LoyaltyLiabilityMonth {
  month: string;
  issued: number;
  used: number;
  expired: number;
  adjusted: number;
  closingPoints: number;
  closingValue: string;
}
export interface LoyaltyLiabilityResponse {
  year: number;
  months: LoyaltyLiabilityMonth[];
  currentPoints: number;
  currentValue: string;
  expiringPoints: number;
}

// API_179: ví điểm (quản trị).
export const loyaltyAccountListQuerySchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    tierId: z.uuid().optional(),
    locked: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const loyaltyLockSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export interface LoyaltyAccountListItem {
  userId: string;
  fullName: string;
  phone: string;
  tierName: string | null;
  balance: number;
  expiringPoints: number;
  spendCurrentYear: string;
  locked: boolean;
}
export interface LoyaltyLotItem {
  id: string;
  sourceType: LoyaltySourceType;
  documentNo: string | null;
  earnedOn: string;
  expiresOn: string;
  points: number;
  remaining: number;
  pointValue: string;
}
export interface LoyaltyAccountDetail extends LoyaltyTierProgress {
  userId: string;
  fullName: string;
  phone: string;
  balance: number;
  locked: boolean;
  lockReason: string | null;
  lots: LoyaltyLotItem[];
  tierHistory: { fromTierName: string | null; toTierName: string; reason: "order_completed" | "year_start" | "tiers_changed"; createdAt: string }[];
  lockHistory: { action: "lock" | "unlock"; reason: string; actorName: string; createdAt: string }[];
  canManage: boolean;
}

// API_180: phiếu điều chỉnh điểm (QUYTAC_NGHIEPVU_353).
export const loyaltyAdjustmentStatuses = ["draft", "pending", "posted", "rejected", "withdrawn", "post_failed"] as const;
export type LoyaltyAdjustmentStatus = (typeof loyaltyAdjustmentStatuses)[number];
export const loyaltyAdjustmentSchema = z
  .object({
    phone: vietnamPhone,
    direction: z.enum(["add", "subtract"]),
    points: z.number().int().min(1).max(10_000_000),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const loyaltyAdjustmentUpdateSchema = loyaltyAdjustmentSchema.extend({ version: z.number().int().min(0) }).strict();
export const loyaltyAdjustmentListQuerySchema = z
  .object({
    status: z.enum(loyaltyAdjustmentStatuses).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export const loyaltyAdjustmentVersionSchema = z.object({ version: z.number().int().min(0) }).strict();
export interface LoyaltyAdjustmentItem {
  id: string;
  documentNo: string | null;
  userId: string;
  buyerName: string;
  buyerPhone: string;
  direction: "add" | "subtract";
  points: number;
  // Giá trị gửi duyệt = điểm × giá trị một điểm (chốt khi gửi; nháp: theo giai đoạn hiện hành).
  value: string | null;
  reason: string;
  status: LoyaltyAdjustmentStatus;
  failureReason: string | null;
  approvalRequestId: string | null;
  createdByName: string;
  createdAt: string;
  version: number;
  canEdit: boolean;
  canWithdraw: boolean;
}

// API_181: cảnh báo bất thường trong 90 ngày (QUYTAC_NGHIEPVU_354).
export const loyaltyAlertKinds = ["shared_contact", "cancel_return", "redeem_burst"] as const;
export type LoyaltyAlertKind = (typeof loyaltyAlertKinds)[number];
export const loyaltyAlertQuerySchema = z.object({ kind: z.enum(loyaltyAlertKinds).default("shared_contact") }).strict();
export interface LoyaltyAlertItem {
  // Thông tin trùng (số nhận, địa chỉ) hoặc ngày đổi dồn dập; trống với hủy, trả nhiều.
  label: string | null;
  buyers: { userId: string; fullName: string; phone: string }[];
  orderCount: number;
  cancelledOrReturned: number | null;
  points: number;
}
export interface LoyaltyAlertResponse {
  kind: LoyaltyAlertKind;
  items: LoyaltyAlertItem[];
}
