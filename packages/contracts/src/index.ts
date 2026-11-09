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
  mfaRequired: boolean;
  user: { id: string; fullName: string; locale: "vi" | "en" };
}

// API_14
export interface MeResponse {
  user: { id: string; fullName: string; email: string | null; locale: "vi" | "en" };
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
  jobTitle: string | null;
  roleNames: string[];
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
  version: number;
  isSelf: boolean;
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
