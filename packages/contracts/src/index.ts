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

export const saveProductSchema = z
  .object({
    categoryId: z.uuid(),
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
export const stockDocumentTypes = ["receipt_other", "issue_other", "adjustment", "transfer"] as const;
export type StockDocumentType = (typeof stockDocumentTypes)[number];
export const stockDocumentStatuses = ["draft", "pending", "posted", "in_transit", "received", "rejected", "withdrawn"] as const;
export type StockDocumentStatus = (typeof stockDocumentStatuses)[number];
// Lý do theo loại phiếu; "Hủy hàng hết hạn" là lý do duy nhất được xuất lô hết hạn (QUYTAC_NGHIEPVU_51).
export const stockReasonCodes = {
  receipt_other: ["opening_balance", "found", "gift", "other"],
  issue_other: ["internal_use", "gift", "damaged", "expired_disposal", "other"],
  adjustment: ["stocktake", "damaged", "found", "other"],
  transfer: ["transfer"],
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
    systemQuantity: string;
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

export const purchaseDocumentStatuses = ["draft", "pending", "approved", "rejected", "withdrawn", "received", "closed"] as const;
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
  warehouseId: string;
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
