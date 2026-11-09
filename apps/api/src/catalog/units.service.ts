// Đơn vị tính dùng chung tập đoàn (CHUC_NANG_30; API_55).
import { Inject, Injectable } from "@nestjs/common";
import type { createUnitSchema, UnitResponse, updateUnitSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, requireGroupPermission } from "./catalog-context";

type UnitRow = { id: string; code: string; name_vi: string; name_en: string; status: "active" | "inactive"; version: number };
const toResponse = (row: UnitRow): UnitResponse => ({ id: row.id, code: row.code, nameVi: row.name_vi, nameEn: row.name_en, status: row.status, version: row.version });

@Injectable()
export class UnitsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(): Promise<UnitResponse[]> {
    return (await this.database.execute<UnitRow>(sql`SELECT id, code, name_vi, name_en, status, version FROM catalog.units ORDER BY code`)).rows.map(toResponse);
  }

  async create(actor: Actor, input: z.output<typeof createUnitSchema>): Promise<UnitResponse> {
    await requireGroupPermission(this.permissionService, actor.userId, catalogPermissions.manageCategories);
    if ((await this.database.execute(sql`SELECT 1 FROM catalog.units WHERE code = ${input.code}`)).rows.length > 0) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "unitCodeExists" } });
    }
    const id = await this.database.transaction(async (transaction) => {
      const unitId = (await transaction.execute<{ id: string }>(sql`INSERT INTO catalog.units (code, name_vi, name_en) VALUES (${input.code}, ${input.nameVi}, ${input.nameEn}) RETURNING id`)).rows[0]!
        .id;
      await this.auditService.record({ ...catalogAudit(actor, "unit"), action: "unit.create", entityId: unitId, afterData: input }, transaction);
      return unitId;
    });
    return this.single(id);
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateUnitSchema>): Promise<UnitResponse> {
    await requireGroupPermission(this.permissionService, actor.userId, catalogPermissions.manageCategories);
    const before = await this.single(id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE catalog.units SET name_vi = ${input.nameVi}, name_en = ${input.nameEn}, version = version + 1, updated_at = now() WHERE id = ${id} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...catalogAudit(actor, "unit"), action: "unit.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(id);
  }

  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<UnitResponse> {
    await requireGroupPermission(this.permissionService, actor.userId, catalogPermissions.manageCategories);
    await this.single(id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`UPDATE catalog.units SET status = ${status}, version = version + 1, updated_at = now() WHERE id = ${id} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...catalogAudit(actor, "unit"), action: status === "inactive" ? "unit.deactivate" : "unit.activate", entityId: id, afterData: { status } }, transaction);
    });
    return this.single(id);
  }

  async single(id: string): Promise<UnitResponse> {
    const row = (await this.database.execute<UnitRow>(sql`SELECT id, code, name_vi, name_en, status, version FROM catalog.units WHERE id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }
}
