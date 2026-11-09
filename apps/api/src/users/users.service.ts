// Danh sách, chi tiết nhân viên và gán vai trò (CHUC_NANG_13, CHUC_NANG_19; QUYTAC_NGHIEPVU_09, 11, 12, 13, 14, 15).
// Không có chức năng đăng nhập thay hoặc xem hệ thống dưới quyền nhân viên khác (QUYTAC_NGHIEPVU_11).
import { Inject, Injectable } from "@nestjs/common";
import type { updateUserSchema } from "contracts";
import type { z } from "zod";
import { setClause } from "../common/sql-update";
import type { PageResponse, RoleAssignmentRequest, RoleAssignmentResponse, UserDetailResponse, UserListItem, UserListQuery } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { branchScopeCondition, PermissionService, type ScopeTarget } from "../permissions/permission.service";
import { RolesService, type Actor } from "../permissions/roles.service";

const viewUser = "platform.user.view";
const assignRole = "platform.role.assign";

type AssignmentRow = {
  id: string;
  role_id: string;
  role_code: string;
  role_name_vi: string;
  role_name_en: string;
  scope_type: "group" | "company" | "branch";
  company_id: string | null;
  company_short_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  valid_from: string;
  valid_to: string | null;
  active: boolean;
};

const toAssignment = (row: AssignmentRow): RoleAssignmentResponse => ({
  id: row.id,
  roleId: row.role_id,
  roleCode: row.role_code,
  roleNameVi: row.role_name_vi,
  roleNameEn: row.role_name_en,
  scopeType: row.scope_type,
  companyId: row.company_id,
  companyShortName: row.company_short_name,
  branchId: row.branch_id,
  branchName: row.branch_name,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  active: row.active,
});

export interface PreparedAssignment {
  input: RoleAssignmentRequest;
  target: ScopeTarget;
  hasSensitive: boolean;
}

type Executor = Pick<Database, "execute" | "insert">;

const targetOfAssignment = (row: Pick<AssignmentRow, "scope_type" | "company_id" | "branch_id">): ScopeTarget =>
  row.scope_type === "group"
    ? { scopeType: "group" }
    : row.scope_type === "company"
      ? { scopeType: "company", companyId: row.company_id! }
      : { scopeType: "branch", companyId: row.company_id!, branchId: row.branch_id! };

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly rolesService: RolesService,
    private readonly auditService: AuditService,
  ) {}

  // API_24: nhân viên trong công ty đang chọn, lọc theo phạm vi chi nhánh của quyền xem.
  async list(actor: Actor, query: UserListQuery): Promise<PageResponse<UserListItem>> {
    const scope = await this.permissionService.dataScope(actor.userId, actor.companyId, viewUser);
    if (!scope) throw new ApiError("FORBIDDEN", "forbidden");
    const day = this.permissionService.today();
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    const where = sql`
      m.company_id = ${actor.companyId} AND m.status = 'active'
      AND ${branchScopeCondition(scope, sql`m.default_branch_id`)}
      ${search ? sql`AND (u.full_name ILIKE ${search} OR u.email::text ILIKE ${search} OR u.phone ILIKE ${search} OR u.username::text ILIKE ${search})` : sql``}
      ${query.branchId ? sql`AND m.default_branch_id = ${query.branchId}` : sql``}
      ${query.status ? sql`AND u.status = ${query.status}` : sql``}
      ${query.roleId ? sql`AND EXISTS (SELECT 1 FROM core.user_role_assignments a WHERE a.user_id = u.id AND a.role_id = ${query.roleId} AND (a.scope_type = 'group' OR a.company_id = ${actor.companyId}))` : sql``}`;
    const total = await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM core.users u JOIN core.user_company_memberships m ON m.user_id = u.id WHERE ${where}`);
    const rows = await this.database.execute<{ id: string; full_name: string; email: string | null; phone: string | null; status: UserListItem["status"]; branch_name: string | null; department_name: string | null; job_title: string | null; role_names: string[] | null; last_login_at: Date | null }>(sql`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, b.name AS branch_name, d.name AS department_name, m.job_title, u.last_login_at,
        (SELECT array_agg(DISTINCT r.name_vi ORDER BY r.name_vi) FROM core.user_role_assignments a JOIN core.roles r ON r.id = a.role_id
          WHERE a.user_id = u.id AND (a.scope_type = 'group' OR a.company_id = ${actor.companyId})
            AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)) AS role_names
      FROM core.users u
      JOIN core.user_company_memberships m ON m.user_id = u.id
      LEFT JOIN core.branches b ON b.id = m.default_branch_id
      LEFT JOIN core.departments d ON d.id = m.department_id
      WHERE ${where}
      ORDER BY u.full_name, u.id
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, status: row.status, branchName: row.branch_name, departmentName: row.department_name, jobTitle: row.job_title, roleNames: row.role_names ?? [], lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null })),
      page: query.page,
      pageSize: query.pageSize,
      total: total.rows[0]?.total ?? 0,
    };
  }

  // API_29 (phần xem): nhân viên ngoài phạm vi trả 404 như không tồn tại.
  async detail(actor: Actor, userId: string): Promise<UserDetailResponse> {
    await this.requireVisible(actor, userId);
    const userResult = await this.database.execute<{ id: string; full_name: string; email: string | null; phone: string | null; username: string | null; status: UserDetailResponse["status"]; mfa_required: boolean; mfa_enabled: boolean; version: number }>(sql`
      SELECT id, full_name, email, phone, username, status, mfa_required, version,
        EXISTS (SELECT 1 FROM core.mfa_factors WHERE user_id = ${userId} AND confirmed_at IS NOT NULL) AS mfa_enabled
      FROM core.users WHERE id = ${userId}`);
    const user = userResult.rows[0]!;
    const companies = await this.database.execute<{ id: string; short_name: string; branch_name: string | null; job_title: string | null; is_default: boolean }>(sql`
      SELECT c.id, c.short_name, b.name AS branch_name, m.job_title, m.is_default
      FROM core.user_company_memberships m JOIN core.companies c ON c.id = m.company_id LEFT JOIN core.branches b ON b.id = m.default_branch_id
      WHERE m.user_id = ${userId} AND m.status = 'active' ORDER BY m.is_default DESC, c.code`);
    return {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: user.phone,
      username: user.username,
      status: user.status,
      mfaRequired: user.mfa_required,
      mfaEnabled: user.mfa_enabled,
      version: user.version,
      isSelf: userId === actor.userId,
      currentMembership: await this.currentMembership(actor.companyId, userId),
      companies: companies.rows.map((row) => ({ id: row.id, shortName: row.short_name, branchName: row.branch_name, jobTitle: row.job_title, isDefault: row.is_default })),
      roleAssignments: (await this.assignments(actor.companyId, userId)).map(toAssignment),
      assignableScopes: await this.assignableScopes(actor),
    };
  }

  // API_34 POST
  async assign(actor: Actor, userId: string, input: RoleAssignmentRequest): Promise<RoleAssignmentResponse> {
    await this.requireVisible(actor, userId);
    if (userId === actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    const prepared = await this.prepareAssignment(actor, input);
    const assignmentId = await this.database.transaction((transaction) => this.insertAssignment(transaction, actor, userId, prepared));
    const created = (await this.assignments(actor.companyId, userId)).find((row) => row.id === assignmentId)!;
    return toAssignment(created);
  }

  // Kiểm tra một lần gán trước khi ghi: ngày, phạm vi, quyền gán, vai trò còn dùng, không cấp quyền mình không có.
  async prepareAssignment(actor: Actor, input: RoleAssignmentRequest): Promise<PreparedAssignment> {
    if (input.validTo && input.validTo < input.validFrom) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { validTo: "endBeforeStart" } });
    }
    const target = await this.targetOfRequest(actor, input);
    if (!(await this.permissionService.permissionsCovering(actor.userId, target)).has(assignRole)) {
      throw new ApiError("FORBIDDEN", "assignOutsideCompany");
    }
    const roleResult = await this.database.execute<{ id: string; status: string; permission_codes: string[] | null; has_sensitive: boolean }>(sql`
      SELECT r.id, r.status,
        (SELECT array_agg(rp.permission_code) FROM core.role_permissions rp WHERE rp.role_id = r.id) AS permission_codes,
        EXISTS (SELECT 1 FROM core.role_permissions rp JOIN core.permissions p ON p.code = rp.permission_code WHERE rp.role_id = r.id AND p.is_sensitive) AS has_sensitive
      FROM core.roles r WHERE r.id = ${input.roleId} AND (r.company_id IS NULL OR r.company_id = ${actor.companyId})`);
    const role = roleResult.rows[0];
    if (!role) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { roleId: "invalidValue" } });
    if (role.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { roleId: "roleInactive" } });
    const grantable = await this.rolesService.grantablePermissions(actor.userId, assignRole, target);
    if (grantable !== "all" && (role.permission_codes ?? []).some((code) => !grantable.has(code))) throw new ApiError("FORBIDDEN", "cannotGrantMissing");
    return { input, target, hasSensitive: role.has_sensitive };
  }

  async insertAssignment(transaction: Executor, actor: Actor, userId: string, prepared: PreparedAssignment): Promise<string> {
    const { input, target } = prepared;
    const companyId = target.scopeType === "group" ? null : target.companyId;
    const branchId = target.scopeType === "branch" ? target.branchId : null;
    const inserted = await transaction.execute<{ id: string }>(sql`
      INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from, valid_to, created_by)
      VALUES (${userId}, ${input.roleId}, ${input.scopeType}, ${companyId}, ${branchId}, ${input.validFrom}::date, ${input.validTo ?? null}::date, ${actor.userId})
      RETURNING id`);
    const id = inserted.rows[0]!.id;
    // QUYTAC_NGHIEPVU_09: vai trò có quyền nhạy cảm thì bật bắt buộc xác thực hai lớp.
    if (prepared.hasSensitive) await transaction.execute(sql`UPDATE core.users SET mfa_required = true, updated_at = now() WHERE id = ${userId} AND mfa_required = false`);
    const after = { userId, roleId: input.roleId, scopeType: input.scopeType, companyId, branchId, validFrom: input.validFrom, validTo: input.validTo ?? null };
    await this.auditService.record({ ...this.auditBase(actor), action: "role_assignment.create", entityId: id, afterData: after }, transaction);
    await this.recordChangeEvent(transaction, id, userId, companyId);
    return id;
  }

  // API_29 PATCH: thông tin tài khoản và thông tin trong công ty đang chọn.
  async update(actor: Actor, userId: string, input: z.output<typeof updateUserSchema>): Promise<UserDetailResponse> {
    await this.requireVisible(actor, userId);
    const fields: Record<string, "emailUsed" | "phoneUsed" | "usernameUsed" | "invalidValue"> = {};
    for (const [field, column] of [["email", "email"], ["phone", "phone"], ["username", "username"]] as const) {
      const value = input[field];
      if (!value) continue;
      const owner = await this.database.execute(sql`SELECT 1 FROM core.users WHERE ${sql.raw(column)} = ${value} AND id <> ${userId}`);
      if (owner.rows.length > 0) fields[field] = `${field}Used` as "emailUsed";
    }
    if (input.defaultBranchId && (await this.database.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.defaultBranchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0) {
      fields.defaultBranchId = "invalidValue";
    }
    if (input.departmentId && (await this.database.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0) {
      fields.departmentId = "invalidValue";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const before = await this.detail(actor, userId);
    const remaining = { email: input.email === undefined ? before.email : input.email, phone: input.phone === undefined ? before.phone : input.phone, username: input.username === undefined ? before.username : input.username };
    if (!remaining.email && !remaining.phone) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { email: "identifierRequired" } });
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.users SET ${sql.join(
          [...setClause(input, { fullName: "full_name", email: "email", phone: "phone", username: "username" }), sql`version = version + 1`, sql`updated_at = now()`, sql`updated_by = ${actor.userId}`],
          sql`, `,
        )}
        WHERE id = ${userId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const membership = setClause(input, { defaultBranchId: "default_branch_id", departmentId: "department_id", jobTitle: "job_title" });
      if (membership.length > 0) {
        await transaction.execute(sql`
          UPDATE core.user_company_memberships SET ${sql.join([...membership, sql`updated_at = now()`, sql`updated_by = ${actor.userId}`], sql`, `)}
          WHERE user_id = ${userId} AND company_id = ${actor.companyId}`);
      }
      // Đổi định danh đăng nhập: cập nhật dòng mật khẩu tương ứng (QUYTAC_NGHIEPVU_05).
      for (const field of ["email", "phone", "username"] as const) {
        if (input[field] === undefined || input[field] === before[field]) continue;
        const old = before[field];
        const next = input[field];
        if (old && next) await transaction.execute(sql`UPDATE core.user_identities SET provider_subject = ${next.toLowerCase()} WHERE user_id = ${userId} AND provider = 'password' AND provider_subject = ${old.toLowerCase()}`);
        else if (old) await transaction.execute(sql`DELETE FROM core.user_identities WHERE user_id = ${userId} AND provider = 'password' AND provider_subject = ${old.toLowerCase()}`);
        else if (next) {
          await transaction.execute(sql`
            INSERT INTO core.user_identities (user_id, provider, provider_subject, password_hash)
            SELECT ${userId}, 'password', ${next.toLowerCase()}, password_hash FROM core.user_identities WHERE user_id = ${userId} AND provider = 'password' LIMIT 1`);
        }
      }
      await this.auditService.record({ ...this.auditBase(actor), entityType: "user", action: "user.update", entityId: userId, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, userId);
  }

  // API_30: khóa chặn đăng nhập và thu hồi mọi phiên; không tự khóa chính mình (CHUC_NANG_19).
  async setLocked(actor: Actor, userId: string, locked: boolean, reason: string): Promise<UserDetailResponse> {
    await this.requireVisible(actor, userId);
    if (userId === actor.userId) throw new ApiError("FORBIDDEN", "cannotLockSelf");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.users SET status = ${locked ? "locked" : "active"}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${userId} AND status = ${locked ? "active" : "locked"} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", locked ? "userNotActive" : "userNotLocked");
      if (locked) await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`);
      await this.auditService.record({ ...this.auditBase(actor), entityType: "user", action: locked ? "user.lock" : "user.unlock", entityId: userId, afterData: { reason } }, transaction);
    });
    return this.detail(actor, userId);
  }

  // API_34 DELETE
  async removeAssignment(actor: Actor, userId: string, assignmentId: string): Promise<void> {
    await this.requireVisible(actor, userId);
    const row = (await this.assignments(actor.companyId, userId)).find((assignment) => assignment.id === assignmentId);
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (userId === actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    if (!(await this.permissionService.permissionsCovering(actor.userId, targetOfAssignment(row))).has(assignRole)) {
      throw new ApiError("FORBIDDEN", "assignOutsideCompany");
    }
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM core.user_role_assignments WHERE id = ${assignmentId}`);
      await this.auditService.record({ ...this.auditBase(actor), action: "role_assignment.delete", entityId: assignmentId, beforeData: toAssignment(row) }, transaction);
      await this.recordChangeEvent(transaction, assignmentId, userId, row.company_id);
    });
  }

  private async recordChangeEvent(transaction: Pick<Database, "execute">, assignmentId: string, userId: string, companyId: string | null): Promise<void> {
    await transaction.execute(sql`
      INSERT INTO core.outbox_events (event_type, aggregate_type, aggregate_id, company_id, payload)
      VALUES ('core.role_assignment.changed', 'role_assignment', ${assignmentId}, ${companyId}, ${JSON.stringify({ userId, companyId })}::jsonb)`);
  }

  private async targetOfRequest(actor: Actor, input: RoleAssignmentRequest): Promise<ScopeTarget> {
    if (input.scopeType === "group") return { scopeType: "group" };
    if (input.scopeType === "company") return { scopeType: "company", companyId: actor.companyId };
    if (!input.branchId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { branchId: "required" } });
    const branch = await this.database.execute(sql`
      SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`);
    if (branch.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { branchId: "invalidValue" } });
    return { scopeType: "branch", companyId: actor.companyId, branchId: input.branchId };
  }

  private async assignableScopes(actor: Actor): Promise<UserDetailResponse["assignableScopes"]> {
    const group = (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" })).has(assignRole);
    const company = group || (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(assignRole);
    const branches = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM core.branches WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    const allowed = [];
    for (const branch of branches.rows) {
      if (company || (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "branch", companyId: actor.companyId, branchId: branch.id })).has(assignRole)) {
        allowed.push(branch);
      }
    }
    return { group, company, branches: allowed };
  }

  // Lần gán liên quan tới công ty đang chọn: phạm vi tập đoàn, công ty đó, hoặc chi nhánh của công ty đó.
  private async assignments(companyId: string, userId: string): Promise<AssignmentRow[]> {
    const day = this.permissionService.today();
    const result = await this.database.execute<AssignmentRow>(sql`
      SELECT a.id, a.role_id, r.code AS role_code, r.name_vi AS role_name_vi, r.name_en AS role_name_en, a.scope_type, a.company_id,
        c.short_name AS company_short_name, a.branch_id, b.name AS branch_name,
        to_char(a.valid_from, 'YYYY-MM-DD') AS valid_from, to_char(a.valid_to, 'YYYY-MM-DD') AS valid_to,
        (a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date) AND r.status = 'active') AS active
      FROM core.user_role_assignments a
      JOIN core.roles r ON r.id = a.role_id
      LEFT JOIN core.companies c ON c.id = a.company_id
      LEFT JOIN core.branches b ON b.id = a.branch_id
      WHERE a.user_id = ${userId} AND (a.scope_type = 'group' OR a.company_id = ${companyId})
      ORDER BY a.valid_from DESC, r.name_vi`);
    return result.rows;
  }

  private async currentMembership(companyId: string, userId: string): Promise<UserDetailResponse["currentMembership"]> {
    const row = (await this.database.execute<{ default_branch_id: string | null; department_id: string | null; job_title: string | null }>(sql`
      SELECT default_branch_id, department_id, job_title FROM core.user_company_memberships WHERE user_id = ${userId} AND company_id = ${companyId}`)).rows[0];
    return { defaultBranchId: row?.default_branch_id ?? null, departmentId: row?.department_id ?? null, jobTitle: row?.job_title ?? null };
  }

  async requireVisible(actor: Actor, userId: string): Promise<void> {
    const scope = await this.permissionService.dataScope(actor.userId, actor.companyId, viewUser);
    if (!scope) throw new ApiError("FORBIDDEN", "forbidden");
    const result = await this.database.execute(sql`
      SELECT 1 FROM core.user_company_memberships m
      WHERE m.user_id = ${userId} AND m.company_id = ${actor.companyId} AND m.status = 'active'
        AND ${branchScopeCondition(scope, sql`m.default_branch_id`)}`);
    if (result.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  private auditBase(actor: Actor) {
    return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "platform", entityType: "role_assignment", ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
  }
}
