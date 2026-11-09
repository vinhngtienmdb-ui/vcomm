// Quản lý vai trò và ma trận quyền (CHUC_NANG_12; QUYTAC_NGHIEPVU_01, 14).
import { Inject, Injectable } from "@nestjs/common";
import type { CreateRoleRequest, PermissionGroupResponse, RoleKind, RolePermissionsRequest, RoleResponse, UpdateRoleRequest } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { ClientInfo } from "../auth/auth.service";
import { PermissionService, type ScopeTarget } from "./permission.service";

const manageRole = "platform.role.manage";

type RoleRow = {
  id: string;
  company_id: string | null;
  code: string;
  name_vi: string;
  name_en: string;
  description: string | null;
  is_system: boolean;
  status: "active" | "inactive";
  version: number;
};

export interface Actor {
  userId: string;
  companyId: string;
  client: ClientInfo;
}

const kindOf = (role: Pick<RoleRow, "is_system" | "company_id">): RoleKind => (role.is_system ? "system" : role.company_id === null ? "shared" : "company");
const targetOf = (role: Pick<RoleRow, "company_id">): ScopeTarget => (role.company_id === null ? { scopeType: "group" } : { scopeType: "company", companyId: role.company_id });

@Injectable()
export class RolesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Quản trị có quyền ở phạm vi tập đoàn cấp được mọi quyền; quản trị phạm vi hẹp hơn chỉ cấp quyền mình có ở phạm vi đó.
  async grantablePermissions(userId: string, authority: string, target: ScopeTarget): Promise<Set<string> | "all"> {
    if ((await this.permissionService.permissionsCovering(userId, { scopeType: "group" })).has(authority)) return "all";
    return this.permissionService.permissionsCovering(userId, target);
  }

  // API_35
  async permissionGroups(actor: Actor): Promise<PermissionGroupResponse[]> {
    const grantable = await this.grantablePermissions(actor.userId, manageRole, { scopeType: "company", companyId: actor.companyId });
    const result = await this.database.execute<{ app_code: string; app_name_vi: string; app_name_en: string; code: string; name_vi: string; name_en: string; is_sensitive: boolean }>(sql`
      SELECT a.code AS app_code, a.name_vi AS app_name_vi, a.name_en AS app_name_en, p.code, p.name_vi, p.name_en, p.is_sensitive
      FROM core.permissions p JOIN core.apps a ON a.code = p.app_code
      ORDER BY a.sort_order, p.code`);
    const groups = new Map<string, PermissionGroupResponse>();
    for (const row of result.rows) {
      const group = groups.get(row.app_code) ?? { appCode: row.app_code, appNameVi: row.app_name_vi, appNameEn: row.app_name_en, permissions: [] };
      group.permissions.push({ code: row.code, nameVi: row.name_vi, nameEn: row.name_en, isSensitive: row.is_sensitive, grantableByMe: grantable === "all" || grantable.has(row.code) });
      groups.set(row.app_code, group);
    }
    return [...groups.values()];
  }

  // API_36 GET: vai trò hệ thống, dùng chung và vai trò riêng của công ty đang chọn.
  async list(actor: Actor): Promise<RoleResponse[]> {
    const day = this.permissionService.today();
    const result = await this.database.execute<RoleRow & { permission_codes: string[] | null; member_count: number; has_sensitive: boolean }>(sql`
      SELECT r.id, r.company_id, r.code, r.name_vi, r.name_en, r.description, r.is_system, r.status, r.version,
        (SELECT array_agg(rp.permission_code ORDER BY rp.permission_code) FROM core.role_permissions rp WHERE rp.role_id = r.id) AS permission_codes,
        EXISTS (SELECT 1 FROM core.role_permissions rp JOIN core.permissions p ON p.code = rp.permission_code WHERE rp.role_id = r.id AND p.is_sensitive) AS has_sensitive,
        (SELECT count(DISTINCT a.user_id)::int FROM core.user_role_assignments a
          WHERE a.role_id = r.id AND a.valid_from <= ${day}::date AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)
            AND (a.scope_type = 'group' OR a.company_id = ${actor.companyId})) AS member_count
      FROM core.roles r
      WHERE r.company_id IS NULL OR r.company_id = ${actor.companyId}
      ORDER BY r.is_system DESC, (r.company_id IS NULL) DESC, r.name_vi`);
    const groupAuthority = (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" })).has(manageRole);
    const companyAuthority = (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(manageRole);
    return result.rows.map((row) => {
      const kind = kindOf(row);
      return {
        ...this.toResponseFields(row),
        permissionCodes: row.permission_codes ?? [],
        memberCount: row.member_count,
        hasSensitive: row.has_sensitive,
        editableByMe: kind === "system" ? false : kind === "shared" ? groupAuthority : companyAuthority,
      };
    });
  }

  async create(actor: Actor, input: CreateRoleRequest): Promise<RoleResponse> {
    const companyId = input.shared ? null : actor.companyId;
    await this.requireAuthority(actor.userId, targetOf({ company_id: companyId }));
    const duplicate = await this.database.execute(sql`
      SELECT 1 FROM core.roles WHERE code = ${input.code} AND (company_id IS NULL OR company_id = ${actor.companyId})`);
    if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "roleCodeExists" } });
    const role = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<RoleRow>(sql`
        INSERT INTO core.roles (company_id, code, name_vi, name_en, description, created_by, updated_by)
        VALUES (${companyId}, ${input.code}, ${input.nameVi}, ${input.nameEn}, ${input.description ?? null}, ${actor.userId}, ${actor.userId})
        RETURNING id, company_id, code, name_vi, name_en, description, is_system, status, version`);
      const row = inserted.rows[0]!;
      await this.auditService.record({ ...this.auditBase(actor), action: "role.create", entityId: row.id, afterData: row }, transaction);
      return row;
    });
    return { ...this.toResponseFields(role), permissionCodes: [], memberCount: 0, hasSensitive: false, editableByMe: true };
  }

  async update(actor: Actor, roleId: string, input: UpdateRoleRequest): Promise<RoleResponse> {
    const role = await this.editableRole(actor, roleId);
    const updated = await this.database.transaction(async (transaction) => {
      const result = await transaction.execute<RoleRow>(sql`
        UPDATE core.roles SET
          name_vi = COALESCE(${input.nameVi ?? null}, name_vi),
          name_en = COALESCE(${input.nameEn ?? null}, name_en),
          description = ${input.description === undefined ? sql`description` : input.description},
          status = COALESCE(${input.status ?? null}, status),
          version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${roleId} AND version = ${input.version}
        RETURNING id, company_id, code, name_vi, name_en, description, is_system, status, version`);
      const row = result.rows[0];
      if (!row) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...this.auditBase(actor), action: "role.update", entityId: roleId, beforeData: role, afterData: row }, transaction);
      return row;
    });
    return this.single(actor, updated.id);
  }

  // Sửa quyền của vai trò áp dụng ngay cho mọi người có vai trò (CHUC_NANG_12, trường hợp ngoại lệ).
  async setPermissions(actor: Actor, roleId: string, input: RolePermissionsRequest): Promise<RoleResponse> {
    const role = await this.editableRole(actor, roleId);
    const requested = [...new Set(input.permissionCodes)];
    const known = await this.database.execute<{ code: string; is_sensitive: boolean }>(sql`
      SELECT code, is_sensitive FROM core.permissions WHERE code IN (${sql.join(requested.length ? requested.map((code) => sql`${code}`) : [sql`NULL`], sql`, `)})`);
    if (known.rows.length !== requested.length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { permissionCodes: "invalidValue" } });
    const current = await this.database.execute<{ permission_code: string }>(sql`SELECT permission_code FROM core.role_permissions WHERE role_id = ${roleId}`);
    const before = current.rows.map((row) => row.permission_code).sort();
    const added = requested.filter((code) => !before.includes(code));
    const grantable = await this.grantablePermissions(actor.userId, manageRole, targetOf(role));
    if (grantable !== "all" && added.some((code) => !grantable.has(code))) throw new ApiError("FORBIDDEN", "cannotGrantMissing");
    const addsSensitive = known.rows.some((row) => row.is_sensitive && added.includes(row.code));

    await this.database.transaction(async (transaction) => {
      const bumped = await transaction.execute(sql`
        UPDATE core.roles SET version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${roleId} AND version = ${input.version} RETURNING id`);
      if (bumped.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM core.role_permissions WHERE role_id = ${roleId}`);
      if (requested.length > 0) {
        await transaction.execute(sql`
          INSERT INTO core.role_permissions (role_id, permission_code)
          VALUES ${sql.join(requested.map((code) => sql`(${roleId}, ${code})`), sql`, `)}`);
      }
      // QUYTAC_NGHIEPVU_09: thêm quyền nhạy cảm thì bật bắt buộc xác thực hai lớp cho người đang có vai trò.
      if (addsSensitive) {
        await transaction.execute(sql`
          UPDATE core.users SET mfa_required = true, updated_at = now()
          WHERE mfa_required = false AND id IN (SELECT user_id FROM core.user_role_assignments WHERE role_id = ${roleId})`);
      }
      await this.auditService.record(
        { ...this.auditBase(actor), action: "role.permissions.update", entityId: roleId, beforeData: { permissionCodes: before }, afterData: { permissionCodes: [...requested].sort() } },
        transaction,
      );
    });
    return this.single(actor, roleId);
  }

  private async single(actor: Actor, roleId: string): Promise<RoleResponse> {
    const role = (await this.list(actor)).find((item) => item.id === roleId);
    if (!role) throw new ApiError("NOT_FOUND", "notFound");
    return role;
  }

  private async requireAuthority(userId: string, target: ScopeTarget): Promise<void> {
    if (!(await this.permissionService.permissionsCovering(userId, target)).has(manageRole)) {
      throw new ApiError("FORBIDDEN", target.scopeType === "group" ? "sharedRoleGroupOnly" : "forbidden");
    }
  }

  private async editableRole(actor: Actor, roleId: string): Promise<RoleRow> {
    const result = await this.database.execute<RoleRow>(sql`
      SELECT id, company_id, code, name_vi, name_en, description, is_system, status, version
      FROM core.roles WHERE id = ${roleId} AND (company_id IS NULL OR company_id = ${actor.companyId})`);
    const role = result.rows[0];
    if (!role) throw new ApiError("NOT_FOUND", "notFound");
    if (role.is_system) throw new ApiError("BUSINESS_RULE", "systemRoleReadOnly");
    await this.requireAuthority(actor.userId, targetOf(role));
    return role;
  }

  private toResponseFields(row: RoleRow) {
    return {
      id: row.id,
      code: row.code,
      nameVi: row.name_vi,
      nameEn: row.name_en,
      description: row.description,
      kind: kindOf(row),
      status: row.status,
      version: row.version,
    };
  }

  private auditBase(actor: Actor) {
    return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "platform", entityType: "role", ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
  }
}
