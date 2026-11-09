// Danh sách, chi tiết nhân viên và gán vai trò (CHUC_NANG_13, CHUC_NANG_19; QUYTAC_NGHIEPVU_09, 11, 12, 13, 14, 15).
// Không có chức năng đăng nhập thay hoặc xem hệ thống dưới quyền nhân viên khác (QUYTAC_NGHIEPVU_11).
import { Inject, Injectable } from "@nestjs/common";
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
    const rows = await this.database.execute<{ id: string; full_name: string; email: string | null; phone: string | null; status: UserListItem["status"]; branch_name: string | null; job_title: string | null; role_names: string[] | null }>(sql`
      SELECT u.id, u.full_name, u.email, u.phone, u.status, b.name AS branch_name, m.job_title,
        (SELECT array_agg(DISTINCT r.name_vi ORDER BY r.name_vi) FROM core.user_role_assignments a JOIN core.roles r ON r.id = a.role_id
          WHERE a.user_id = u.id AND (a.scope_type = 'group' OR a.company_id = ${actor.companyId})
            AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)) AS role_names
      FROM core.users u
      JOIN core.user_company_memberships m ON m.user_id = u.id
      LEFT JOIN core.branches b ON b.id = m.default_branch_id
      WHERE ${where}
      ORDER BY u.full_name, u.id
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({ id: row.id, fullName: row.full_name, email: row.email, phone: row.phone, status: row.status, branchName: row.branch_name, jobTitle: row.job_title, roleNames: row.role_names ?? [] })),
      page: query.page,
      pageSize: query.pageSize,
      total: total.rows[0]?.total ?? 0,
    };
  }

  // API_29 (phần xem): nhân viên ngoài phạm vi trả 404 như không tồn tại.
  async detail(actor: Actor, userId: string): Promise<UserDetailResponse> {
    await this.requireVisible(actor, userId);
    const userResult = await this.database.execute<{ id: string; full_name: string; email: string | null; phone: string | null; username: string | null; status: UserDetailResponse["status"]; mfa_required: boolean; version: number }>(sql`
      SELECT id, full_name, email, phone, username, status, mfa_required, version FROM core.users WHERE id = ${userId}`);
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
      version: user.version,
      isSelf: userId === actor.userId,
      companies: companies.rows.map((row) => ({ id: row.id, shortName: row.short_name, branchName: row.branch_name, jobTitle: row.job_title, isDefault: row.is_default })),
      roleAssignments: (await this.assignments(actor.companyId, userId)).map(toAssignment),
      assignableScopes: await this.assignableScopes(actor),
    };
  }

  // API_34 POST
  async assign(actor: Actor, userId: string, input: RoleAssignmentRequest): Promise<RoleAssignmentResponse> {
    await this.requireVisible(actor, userId);
    if (userId === actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
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

    const companyId = target.scopeType === "group" ? null : target.companyId;
    const branchId = target.scopeType === "branch" ? target.branchId : null;
    const assignmentId = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.user_role_assignments (user_id, role_id, scope_type, company_id, branch_id, valid_from, valid_to, created_by)
        VALUES (${userId}, ${input.roleId}, ${input.scopeType}, ${companyId}, ${branchId}, ${input.validFrom}::date, ${input.validTo ?? null}::date, ${actor.userId})
        RETURNING id`);
      const id = inserted.rows[0]!.id;
      // QUYTAC_NGHIEPVU_09: vai trò có quyền nhạy cảm thì bật bắt buộc xác thực hai lớp.
      if (role.has_sensitive) await transaction.execute(sql`UPDATE core.users SET mfa_required = true, updated_at = now() WHERE id = ${userId} AND mfa_required = false`);
      const after = { userId, roleId: input.roleId, scopeType: input.scopeType, companyId, branchId, validFrom: input.validFrom, validTo: input.validTo ?? null };
      await this.auditService.record({ ...this.auditBase(actor), action: "role_assignment.create", entityId: id, afterData: after }, transaction);
      await this.recordChangeEvent(transaction, id, userId, companyId);
      return id;
    });
    const created = (await this.assignments(actor.companyId, userId)).find((row) => row.id === assignmentId)!;
    return toAssignment(created);
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

  private async requireVisible(actor: Actor, userId: string): Promise<void> {
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
