// Khai báo Drizzle cho các bảng schema `core` mà mã đang dùng. Cấu trúc gốc: database/migrations (tài liệu 16).
import { bigint, boolean, customType, date, inet, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

export const core = pgSchema("core");

export const companies = core.table("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  legalName: text("legal_name").notNull(),
  shortName: text("short_name").notNull(),
  taxCode: text("tax_code"),
  baseCurrency: text("base_currency").notNull(),
  accountingRegime: text("accounting_regime").notNull(),
  status: text("status").notNull(),
});

export const branches = core.table("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  branchType: text("branch_type").notNull(),
  status: text("status").notNull(),
});

export const users = core.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username"),
  email: text("email"),
  phone: text("phone"),
  fullName: text("full_name").notNull(),
  locale: text("locale").notNull(),
  mfaRequired: boolean("mfa_required").notNull(),
  isSuperAdmin: boolean("is_super_admin").notNull(),
  status: text("status").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  loginLockedUntil: timestamp("login_locked_until", { withTimezone: true }),
});

export const userIdentities = core.table("user_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  provider: text("provider").notNull(),
  providerSubject: text("provider_subject").notNull(),
  passwordHash: text("password_hash"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const sessions = core.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  refreshTokenHash: bytea("refresh_token_hash").notNull(),
  familyId: uuid("family_id").notNull(),
  clientType: text("client_type").notNull(),
  ip: inet("ip"),
  userAgent: text("user_agent"),
  mfaVerified: boolean("mfa_verified").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const loginAttempts = core.table("login_attempts", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
  provider: text("provider").notNull(),
  identifier: text("identifier").notNull(),
  userId: uuid("user_id"),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  ip: inet("ip"),
  userAgent: text("user_agent"),
});

export const userCompanyMemberships = core.table("user_company_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  companyId: uuid("company_id").notNull(),
  defaultBranchId: uuid("default_branch_id"),
  isDefault: boolean("is_default").notNull(),
  status: text("status").notNull(),
});

export const apps = core.table("apps", {
  code: text("code").primaryKey(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en").notNull(),
  baseUrl: text("base_url").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").notNull(),
});

export const permissions = core.table("permissions", {
  code: text("code").primaryKey(),
  appCode: text("app_code").notNull(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en").notNull(),
  isSensitive: boolean("is_sensitive").notNull(),
});

export const roles = core.table("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id"),
  code: text("code").notNull(),
  nameVi: text("name_vi").notNull(),
  nameEn: text("name_en").notNull(),
  isSystem: boolean("is_system").notNull(),
  status: text("status").notNull(),
});

export const rolePermissions = core.table("role_permissions", {
  roleId: uuid("role_id").notNull(),
  permissionCode: text("permission_code").notNull(),
});

export const userRoleAssignments = core.table("user_role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  roleId: uuid("role_id").notNull(),
  scopeType: text("scope_type").notNull(),
  companyId: uuid("company_id"),
  branchId: uuid("branch_id"),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
});

export const auditEvents = core.table("audit_events", {
  id: uuid("id").notNull().defaultRandom(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid("actor_user_id"),
  companyId: uuid("company_id"),
  appCode: text("app_code").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  ip: inet("ip"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
});
