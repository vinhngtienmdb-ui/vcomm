// Kênh bán, nhóm khách hàng của công ty (CHUC_NANG_35; API_60): hai danh mục cùng cấu trúc mã, tên, trạng thái.
import { Inject, Injectable } from "@nestjs/common";
import { defaultSalesChannels, type CatalogItemResponse, type createCatalogItemSchema, type updateCatalogItemSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, isUniqueViolation, requireCompanyPermission } from "./catalog-context";

export type CatalogItemKind = "channel" | "customer_group";
const tables: Record<CatalogItemKind, string> = { channel: "catalog.sales_channels", customer_group: "catalog.customer_groups" };
type ItemRow = { id: string; code: string; name: string; status: "active" | "inactive"; version: number };
const toResponse = (row: ItemRow): CatalogItemResponse => ({ id: row.id, code: row.code, name: row.name, status: row.status, version: row.version });

@Injectable()
export class CatalogItemsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: Actor, kind: CatalogItemKind): Promise<CatalogItemResponse[]> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    const rows = await this.database.execute<ItemRow>(sql`SELECT id, code, name, status, version FROM ${sql.raw(tables[kind])} WHERE company_id = ${actor.companyId} ORDER BY code`);
    return rows.rows.map(toResponse);
  }

  async create(actor: Actor, kind: CatalogItemKind, input: z.output<typeof createCatalogItemSchema>): Promise<CatalogItemResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const table = sql.raw(tables[kind]);
    if ((await this.database.execute(sql`SELECT 1 FROM ${table} WHERE company_id = ${actor.companyId} AND code = ${input.code}`)).rows.length > 0) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "catalogItemCodeExists" } });
    }
    const id = await this.database
      .transaction(async (transaction) => {
        const itemId = (await transaction.execute<{ id: string }>(sql`INSERT INTO ${table} (company_id, code, name) VALUES (${actor.companyId}, ${input.code}, ${input.name}) RETURNING id`)).rows[0]!
          .id;
        await this.auditService.record({ ...catalogAudit(actor, kind), action: `${kind}.create`, entityId: itemId, afterData: input }, transaction);
        return itemId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "catalogItemCodeExists" } });
        throw error;
      });
    return this.single(actor.companyId, kind, id);
  }

  // Thêm các kênh có sẵn còn thiếu (Bán sỉ, Bán lẻ, Sàn VComm, Nội bộ).
  async createDefaultChannels(actor: Actor): Promise<CatalogItemResponse[]> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    for (const channel of defaultSalesChannels) {
      const exists = await this.database.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE company_id = ${actor.companyId} AND code = ${channel.code}`);
      if (exists.rows.length === 0) await this.create(actor, "channel", { ...channel });
    }
    return this.list(actor, "channel");
  }

  async update(actor: Actor, kind: CatalogItemKind, id: string, input: z.output<typeof updateCatalogItemSchema>): Promise<CatalogItemResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const before = await this.single(actor.companyId, kind, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE ${sql.raw(tables[kind])} SET name = ${input.name}, version = version + 1, updated_at = now() WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...catalogAudit(actor, kind), action: `${kind}.update`, entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(actor.companyId, kind, id);
  }

  async setStatus(actor: Actor, kind: CatalogItemKind, id: string, status: "active" | "inactive", version: number): Promise<CatalogItemResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    await this.single(actor.companyId, kind, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE ${sql.raw(tables[kind])} SET status = ${status}, version = version + 1, updated_at = now() WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...catalogAudit(actor, kind), action: `${kind}.${status === "inactive" ? "deactivate" : "activate"}`, entityId: id, afterData: { status } }, transaction);
    });
    return this.single(actor.companyId, kind, id);
  }

  private async single(companyId: string, kind: CatalogItemKind, id: string): Promise<CatalogItemResponse> {
    const row = (await this.database.execute<ItemRow>(sql`SELECT id, code, name, status, version FROM ${sql.raw(tables[kind])} WHERE id = ${id} AND company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }
}
