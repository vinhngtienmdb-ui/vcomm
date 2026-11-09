// Quản lý phòng ban dạng cây (CHUC_NANG_03; QUYTAC_NGHIEPVU_02, 03, 04).
import { Inject, Injectable } from "@nestjs/common";
import type { DepartmentResponse } from "contracts";
import { createDepartmentSchema, updateDepartmentSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { setClause } from "../common/sql-update";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { auditBase } from "./organization-context";

const manageDepartment = "platform.department.manage";

type DepartmentRow = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  manager_user_id: string | null;
  manager_name: string | null;
  status: "active" | "inactive";
  version: number;
  member_count: number;
};

const columns = { parentId: "parent_id", code: "code", name: "name", managerUserId: "manager_user_id" };

const toResponse = (row: DepartmentRow): DepartmentResponse => ({
  id: row.id,
  parentId: row.parent_id,
  code: row.code,
  name: row.name,
  managerUserId: row.manager_user_id,
  managerName: row.manager_name,
  status: row.status,
  version: row.version,
  memberCount: row.member_count,
});

type DepartmentField = "parentId" | "code" | "managerUserId";
type DepartmentError = "invalidValue" | "departmentCodeExists" | "departmentParentCycle" | "managerNotMember";

@Injectable()
export class DepartmentsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: Actor): Promise<DepartmentResponse[]> {
    const result = await this.database.execute<DepartmentRow>(sql`${this.select()} WHERE d.company_id = ${actor.companyId} ORDER BY d.code`);
    return result.rows.map(toResponse);
  }

  async create(actor: Actor, input: z.output<typeof createDepartmentSchema>): Promise<DepartmentResponse> {
    await this.requireCompanyAuthority(actor);
    await this.validate(actor.companyId, input, null);
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.departments (company_id, parent_id, code, name, manager_user_id, created_by, updated_by)
        VALUES (${actor.companyId}, ${input.parentId ?? null}, ${input.code}, ${input.name}, ${input.managerUserId ?? null}, ${actor.userId}, ${actor.userId})
        RETURNING id`);
      const departmentId = inserted.rows[0]!.id;
      await this.auditService.record({ ...auditBase(actor, "department"), action: "department.create", entityId: departmentId, afterData: input }, transaction);
      return departmentId;
    });
    return this.single(actor.companyId, id);
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateDepartmentSchema>): Promise<DepartmentResponse> {
    const before = await this.single(actor.companyId, id);
    await this.requireCompanyAuthority(actor);
    await this.validate(actor.companyId, input, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.departments SET ${sql.join([...setClause(input, columns), sql`version = version + 1`, sql`updated_at = now()`, sql`updated_by = ${actor.userId}`], sql`, `)}
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "department"), action: "department.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(actor.companyId, id);
  }

  async deactivate(actor: Actor, id: string, version: number): Promise<DepartmentResponse> {
    const before = await this.single(actor.companyId, id);
    await this.requireCompanyAuthority(actor);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.departments SET status = 'inactive', version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "department"), action: "department.deactivate", entityId: id, beforeData: { status: before.status }, afterData: { status: "inactive" } }, transaction);
    });
    return this.single(actor.companyId, id);
  }

  private async requireCompanyAuthority(actor: Actor): Promise<void> {
    if (!(await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(manageDepartment)) {
      throw new ApiError("FORBIDDEN", "forbidden");
    }
  }

  private select() {
    return sql`
      SELECT d.id, d.parent_id, d.code, d.name, d.manager_user_id, u.full_name AS manager_name, d.status, d.version,
        (SELECT count(*)::int FROM core.user_company_memberships m WHERE m.department_id = d.id AND m.status = 'active') AS member_count
      FROM core.departments d LEFT JOIN core.users u ON u.id = d.manager_user_id`;
  }

  // Phòng ban của công ty khác trả 404 như không tồn tại.
  private async single(companyId: string, id: string): Promise<DepartmentResponse> {
    const result = await this.database.execute<DepartmentRow>(sql`${this.select()} WHERE d.id = ${id} AND d.company_id = ${companyId}`);
    const row = result.rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  private async validate(companyId: string, input: { parentId?: string | null; code?: string; managerUserId?: string | null }, selfId: string | null): Promise<void> {
    const fields: Partial<Record<DepartmentField, DepartmentError>> = {};
    if (input.code) {
      const others = selfId ? sql`AND id <> ${selfId}` : sql``;
      const duplicate = await this.database.execute(sql`SELECT 1 FROM core.departments WHERE company_id = ${companyId} AND code = ${input.code} ${others}`);
      if (duplicate.rows.length > 0) fields.code = "departmentCodeExists";
    }
    if (input.parentId) {
      const parent = await this.database.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.parentId} AND company_id = ${companyId} AND status = 'active'`);
      if (parent.rows.length === 0 && input.parentId !== selfId) fields.parentId = "invalidValue";
      else if (selfId) {
        // Cha mới không được là chính phòng ban hoặc phòng ban con, cháu của nó (QUYTAC_NGHIEPVU_04).
        const cycle = await this.database.execute(sql`
          WITH RECURSIVE subtree AS (
            SELECT id FROM core.departments WHERE id = ${selfId}
            UNION ALL SELECT d.id FROM core.departments d JOIN subtree s ON d.parent_id = s.id
          ) SELECT 1 FROM subtree WHERE id = ${input.parentId}`);
        if (cycle.rows.length > 0) fields.parentId = "departmentParentCycle";
      }
    }
    if (input.managerUserId) {
      const member = await this.database.execute(sql`
        SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
        WHERE m.user_id = ${input.managerUserId} AND m.company_id = ${companyId} AND m.status = 'active' AND u.status <> 'disabled'`);
      if (member.rows.length === 0) fields.managerUserId = "managerNotMember";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }
}
