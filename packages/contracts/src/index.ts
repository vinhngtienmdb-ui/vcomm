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
