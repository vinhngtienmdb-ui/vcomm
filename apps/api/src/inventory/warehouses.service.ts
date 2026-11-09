// Kho, vị trí kệ, công ty chủ hàng, cài đặt kho (CHUC_NANG_38; QUYTAC_NGHIEPVU_45, 46; API_63).
import { Inject, Injectable } from "@nestjs/common";
import type {
  createLocationsSchema,
  createWarehouseSchema,
  InventorySettingsResponse,
  LocationResponse,
  updateInventorySettingsSchema,
  updateLocationSchema,
  updateWarehouseSchema,
  WarehouseOptionsResponse,
  WarehouseResponse,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { isUniqueViolation } from "../common/database-errors";
import { inventoryAudit, inventoryPermissions, requireCompanyPermission, warehousePermissions } from "./inventory-context";

type WarehouseRow = {
  id: string;
  company_id: string;
  company_name: string;
  branch_id: string;
  branch_name: string;
  code: string;
  name: string;
  address: string | null;
  uses_locations: boolean;
  owners: { companyId: string; companyName: string }[];
  location_count: number;
  status: "active" | "inactive";
  version: number;
};
export type Warehouse = { id: string; companyId: string; branchId: string; usesLocations: boolean; status: "active" | "inactive"; ownerIds: string[] };

@Injectable()
export class WarehousesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Kho của công ty đang chọn mà người dùng có quyền ở chi nhánh kho, cộng kho nhận hàng của công ty đang chọn (chỉ xem tồn).
  async list(actor: Actor): Promise<WarehouseResponse[]> {
    const rows = await this.database.execute<WarehouseRow>(sql`
      ${this.select()} WHERE w.company_id = ${actor.companyId}
        OR EXISTS (SELECT 1 FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id AND o.company_id = ${actor.companyId})
      ORDER BY w.status, w.code`);
    const ownCompany = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    const result: WarehouseResponse[] = [];
    for (const row of rows.rows) {
      const granted = await warehousePermissions(this.permissionService, actor.userId, { companyId: row.company_id, branchId: row.branch_id });
      const canOperate = granted.has(inventoryPermissions.access);
      const ownerView = row.owners.some((owner) => owner.companyId === actor.companyId) && ownCompany.has(inventoryPermissions.viewStock);
      if (!canOperate && !ownerView) continue;
      result.push(this.toResponse(row, canOperate, granted.has(inventoryPermissions.manageWarehouses)));
    }
    return result;
  }

  async detail(actor: Actor, id: string): Promise<WarehouseResponse> {
    const row = (await this.database.execute<WarehouseRow>(sql`${this.select()} WHERE w.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const granted = await warehousePermissions(this.permissionService, actor.userId, { companyId: row.company_id, branchId: row.branch_id });
    const ownerView =
      row.owners.some((owner) => owner.companyId === actor.companyId) &&
      (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(inventoryPermissions.viewStock);
    if (!granted.has(inventoryPermissions.access) && !ownerView) throw new ApiError("NOT_FOUND", "notFound");
    return this.toResponse(row, granted.has(inventoryPermissions.access), granted.has(inventoryPermissions.manageWarehouses));
  }

  // Dùng cho các dịch vụ kho khác: kho kèm danh sách chủ hàng; kiểm quyền tại kho.
  async operable(userId: string, id: string, permission: string): Promise<Warehouse> {
    const warehouse = await this.find(id);
    if (!warehouse) throw new ApiError("NOT_FOUND", "notFound");
    const granted = await warehousePermissions(this.permissionService, userId, warehouse);
    if (!granted.has(inventoryPermissions.access)) throw new ApiError("NOT_FOUND", "notFound");
    if (!granted.has(permission)) throw new ApiError("FORBIDDEN", "forbidden");
    return warehouse;
  }

  async find(id: string): Promise<Warehouse | null> {
    const row = (
      await this.database.execute<{ id: string; company_id: string; branch_id: string; uses_locations: boolean; status: "active" | "inactive"; owner_ids: string[] }>(sql`
      SELECT w.id, w.company_id, w.branch_id, w.uses_locations, w.status, array(SELECT o.company_id FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id) AS owner_ids
      FROM inventory.warehouses w WHERE w.id = ${id}`)
    ).rows[0];
    return row ? { id: row.id, companyId: row.company_id, branchId: row.branch_id, usesLocations: row.uses_locations, status: row.status, ownerIds: row.owner_ids } : null;
  }

  async create(actor: Actor, input: z.output<typeof createWarehouseSchema>): Promise<WarehouseResponse> {
    await requireCompanyPermission(this.permissionService, actor, inventoryPermissions.manageWarehouses);
    const fields: Record<string, "invalidValue" | "warehouseCodeExists"> = {};
    if ((await this.database.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.branchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0)
      fields.branchId = "invalidValue";
    if ((await this.database.execute(sql`SELECT 1 FROM inventory.warehouses WHERE company_id = ${actor.companyId} AND code = ${input.code}`)).rows.length > 0) fields.code = "warehouseCodeExists";
    const owners = [...new Set([actor.companyId, ...input.ownerCompanyIds])];
    if (!(await this.validCompanies(owners))) fields.ownerCompanyIds = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const id = await this.database
      .transaction(async (transaction) => {
        const warehouseId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO inventory.warehouses (company_id, branch_id, code, name, address, uses_locations, created_by, updated_by)
          VALUES (${actor.companyId}, ${input.branchId}, ${input.code}, ${input.name}, ${input.address ?? null}, ${input.usesLocations}, ${actor.userId}, ${actor.userId}) RETURNING id`)
        ).rows[0]!.id;
        for (const companyId of owners) await transaction.execute(sql`INSERT INTO inventory.warehouse_owners (warehouse_id, company_id) VALUES (${warehouseId}, ${companyId})`);
        await this.auditService.record({ ...inventoryAudit(actor, "warehouse"), action: "warehouse.create", entityId: warehouseId, afterData: { ...input, ownerCompanyIds: owners } }, transaction);
        return warehouseId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "warehouseCodeExists" } });
        throw error;
      });
    return this.detail(actor, id);
  }

  // Đổi cài đặt vị trí, bỏ chủ hàng chỉ khi không còn tồn liên quan.
  async update(actor: Actor, id: string, input: z.output<typeof updateWarehouseSchema>): Promise<WarehouseResponse> {
    const before = await this.requireManaged(actor, id);
    const owners = [...new Set([before.companyId, ...input.ownerCompanyIds])];
    const fields: Record<string, "invalidValue" | "warehouseOwnerHasStock" | "warehouseLocationsHaveStock"> = {};
    if (!(await this.validCompanies(owners))) fields.ownerCompanyIds = "invalidValue";
    const removed = before.owners.map((owner) => owner.companyId).filter((companyId) => !owners.includes(companyId));
    for (const companyId of removed) {
      if ((await this.database.execute(sql`SELECT 1 FROM inventory.balances WHERE warehouse_id = ${id} AND company_id = ${companyId} AND quantity > 0 LIMIT 1`)).rows.length > 0)
        fields.ownerCompanyIds = "warehouseOwnerHasStock";
    }
    if (input.usesLocations !== before.usesLocations && (await this.database.execute(sql`SELECT 1 FROM inventory.balances WHERE warehouse_id = ${id} AND quantity > 0 LIMIT 1`)).rows.length > 0) {
      fields.usesLocations = "warehouseLocationsHaveStock";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.warehouses SET name = ${input.name}, address = ${input.address ?? null}, uses_locations = ${input.usesLocations},
          version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM inventory.warehouse_owners WHERE warehouse_id = ${id}`);
      for (const companyId of owners) await transaction.execute(sql`INSERT INTO inventory.warehouse_owners (warehouse_id, company_id) VALUES (${id}, ${companyId})`);
      await this.auditService.record(
        { ...inventoryAudit(actor, "warehouse"), action: "warehouse.update", entityId: id, beforeData: before, afterData: { ...input, ownerCompanyIds: owners } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<WarehouseResponse> {
    await this.requireManaged(actor, id);
    if (status === "inactive" && (await this.database.execute(sql`SELECT 1 FROM inventory.balances WHERE warehouse_id = ${id} AND quantity > 0 LIMIT 1`)).rows.length > 0) {
      throw new ApiError("BUSINESS_RULE", "warehouseHasStock");
    }
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.warehouses SET status = ${status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${id} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        { ...inventoryAudit(actor, "warehouse"), action: `warehouse.${status === "inactive" ? "deactivate" : "activate"}`, entityId: id, afterData: { status } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async locations(actor: Actor, warehouseId: string): Promise<LocationResponse[]> {
    await this.detail(actor, warehouseId);
    const rows = await this.database.execute<{ id: string; warehouse_id: string; code: string; name: string | null; status: "active" | "inactive"; version: number }>(sql`
      SELECT id, warehouse_id, code, name, status, version FROM inventory.locations WHERE warehouse_id = ${warehouseId} ORDER BY code`);
    return rows.rows.map((row) => ({ id: row.id, warehouseId: row.warehouse_id, code: row.code, name: row.name, status: row.status, version: row.version }));
  }

  // Thêm nhiều vị trí một lần (ví dụ cả một dãy kệ); mã trùng trong kho bị từ chối, chỉ ra đúng dòng.
  async createLocations(actor: Actor, warehouseId: string, input: z.output<typeof createLocationsSchema>): Promise<LocationResponse[]> {
    await this.requireManaged(actor, warehouseId);
    const existing = new Set((await this.database.execute<{ code: string }>(sql`SELECT code FROM inventory.locations WHERE warehouse_id = ${warehouseId}`)).rows.map((row) => row.code));
    const fields: Record<string, "locationCodeExists"> = {};
    input.locations.forEach((location, index) => {
      if (existing.has(location.code) || input.locations.findIndex((other) => other.code === location.code) !== index) fields[`locations.${index}.code`] = "locationCodeExists";
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      for (const location of input.locations) {
        await transaction.execute(sql`INSERT INTO inventory.locations (warehouse_id, code, name) VALUES (${warehouseId}, ${location.code}, ${location.name ?? null})`);
      }
      await this.auditService.record({ ...inventoryAudit(actor, "location"), action: "location.create", entityId: warehouseId, afterData: input }, transaction);
    });
    return this.locations(actor, warehouseId);
  }

  async updateLocation(actor: Actor, warehouseId: string, id: string, input: z.output<typeof updateLocationSchema>): Promise<LocationResponse[]> {
    await this.requireManaged(actor, warehouseId);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.locations SET name = ${input.name ?? null}, version = version + 1, updated_at = now() WHERE id = ${id} AND warehouse_id = ${warehouseId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...inventoryAudit(actor, "location"), action: "location.update", entityId: id, afterData: input }, transaction);
    });
    return this.locations(actor, warehouseId);
  }

  async setLocationStatus(actor: Actor, warehouseId: string, id: string, status: "active" | "inactive", version: number): Promise<LocationResponse[]> {
    await this.requireManaged(actor, warehouseId);
    if (status === "inactive" && (await this.database.execute(sql`SELECT 1 FROM inventory.balances WHERE location_id = ${id} AND quantity > 0 LIMIT 1`)).rows.length > 0) {
      throw new ApiError("BUSINESS_RULE", "locationHasStock");
    }
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.locations SET status = ${status}, version = version + 1, updated_at = now() WHERE id = ${id} AND warehouse_id = ${warehouseId} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...inventoryAudit(actor, "location"), action: `location.${status === "inactive" ? "deactivate" : "activate"}`, entityId: id }, transaction);
    });
    return this.locations(actor, warehouseId);
  }

  async options(actor: Actor): Promise<WarehouseOptionsResponse> {
    await requireCompanyPermission(this.permissionService, actor, inventoryPermissions.manageWarehouses);
    const branches = await this.database.execute<{ id: string; name: string }>(sql`SELECT id, name FROM core.branches WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`);
    const companies = await this.database.execute<{ id: string; short_name: string }>(sql`SELECT id, short_name FROM core.companies WHERE status = 'active' ORDER BY short_name`);
    return { branches: branches.rows, companies: companies.rows.map((row) => ({ id: row.id, shortName: row.short_name })) };
  }

  async settings(companyId: string): Promise<InventorySettingsResponse> {
    const row = (await this.database.execute<{ reservation_hours: number; version: number }>(sql`SELECT reservation_hours, version FROM inventory.settings WHERE company_id = ${companyId}`)).rows[0];
    return row ? { reservationHours: row.reservation_hours, version: row.version } : { reservationHours: 72, version: 0 };
  }

  async updateSettings(actor: Actor, input: z.output<typeof updateInventorySettingsSchema>): Promise<InventorySettingsResponse> {
    await requireCompanyPermission(this.permissionService, actor, inventoryPermissions.manageWarehouses);
    const before = await this.settings(actor.companyId);
    if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        INSERT INTO inventory.settings (company_id, reservation_hours, updated_by) VALUES (${actor.companyId}, ${input.reservationHours}, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET reservation_hours = EXCLUDED.reservation_hours, updated_by = EXCLUDED.updated_by, updated_at = now(), version = inventory.settings.version + 1
        WHERE inventory.settings.version = ${input.version} RETURNING company_id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...inventoryAudit(actor, "inventory_settings"), action: "inventory_settings.update", beforeData: before, afterData: input }, transaction);
    });
    return this.settings(actor.companyId);
  }

  private async requireManaged(actor: Actor, id: string): Promise<WarehouseResponse> {
    const warehouse = await this.detail(actor, id);
    if (!warehouse.canManage) throw new ApiError("FORBIDDEN", "forbidden");
    return warehouse;
  }

  private async validCompanies(ids: string[]): Promise<boolean> {
    const found = await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM core.companies WHERE status = 'active' AND id = ANY(${`{${ids.join(",")}}`}::uuid[])`);
    return found.rows[0]!.total === ids.length;
  }

  private toResponse(row: WarehouseRow, canOperate: boolean, canManage: boolean): WarehouseResponse {
    return {
      id: row.id,
      companyId: row.company_id,
      companyName: row.company_name,
      branchId: row.branch_id,
      branchName: row.branch_name,
      code: row.code,
      name: row.name,
      address: row.address,
      usesLocations: row.uses_locations,
      owners: row.owners,
      locationCount: row.location_count,
      status: row.status,
      version: row.version,
      canOperate,
      canManage,
    };
  }

  private select() {
    return sql`
      SELECT w.id, w.company_id, c.short_name AS company_name, w.branch_id, b.name AS branch_name, w.code, w.name, w.address, w.uses_locations, w.status, w.version,
        coalesce((SELECT json_agg(json_build_object('companyId', oc.id, 'companyName', oc.short_name) ORDER BY oc.short_name)
                  FROM inventory.warehouse_owners o JOIN core.companies oc ON oc.id = o.company_id WHERE o.warehouse_id = w.id), '[]') AS owners,
        (SELECT count(*)::int FROM inventory.locations l WHERE l.warehouse_id = w.id AND l.status = 'active') AS location_count
      FROM inventory.warehouses w JOIN core.companies c ON c.id = w.company_id JOIN core.branches b ON b.id = w.branch_id`;
  }
}
