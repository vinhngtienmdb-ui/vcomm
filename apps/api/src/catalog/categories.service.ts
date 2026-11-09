// Ngành hàng dùng chung tập đoàn, tối đa 4 cấp (CHUC_NANG_30; QUYTAC_NGHIEPVU_37; API_55).
import { Inject, Injectable } from "@nestjs/common";
import { categoryMaximumLevel, type CategoryResponse, type createCategorySchema, type updateCategorySchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, requireGroupPermission } from "./catalog-context";

type CategoryRow = {
  id: string;
  parent_id: string | null;
  code: string;
  name_vi: string;
  name_en: string;
  level: number;
  tracks_lots: boolean;
  tracks_serials: boolean;
  warranty_months: number;
  status: "active" | "inactive";
  version: number;
  product_count: number;
  child_count: number;
};

const toResponse = (row: CategoryRow): CategoryResponse => ({
  id: row.id,
  parentId: row.parent_id,
  code: row.code,
  nameVi: row.name_vi,
  nameEn: row.name_en,
  level: row.level,
  tracksLots: row.tracks_lots,
  tracksSerials: row.tracks_serials,
  warrantyMonths: row.warranty_months,
  status: row.status,
  version: row.version,
  productCount: row.product_count,
  childCount: row.child_count,
});

type CategoryInput = z.output<typeof createCategorySchema>;

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(): Promise<CategoryResponse[]> {
    const rows = await this.database.execute<CategoryRow>(sql`${this.select()} ORDER BY c.level, c.code`);
    return rows.rows.map(toResponse);
  }

  async create(actor: Actor, input: CategoryInput): Promise<CategoryResponse> {
    await requireGroupPermission(this.permissionService, actor.userId, catalogPermissions.manageCategories);
    const level = await this.validate(input, null);
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO catalog.categories (parent_id, code, name_vi, name_en, level, tracks_lots, tracks_serials, warranty_months, created_by, updated_by)
        VALUES (${input.parentId ?? null}, ${input.code}, ${input.nameVi}, ${input.nameEn}, ${level}, ${input.tracksLots}, ${input.tracksSerials}, ${input.warrantyMonths}, ${actor.userId}, ${actor.userId})
        RETURNING id`);
      const categoryId = inserted.rows[0]!.id;
      await this.auditService.record({ ...catalogAudit(actor, "category"), action: "category.create", entityId: categoryId, afterData: input }, transaction);
      return categoryId;
    });
    return this.single(id);
  }

  // Đổi ngành hàng cha thì tính lại cấp của cả nhánh con; không vượt 4 cấp, không tạo vòng.
  async update(actor: Actor, id: string, input: z.output<typeof updateCategorySchema>): Promise<CategoryResponse> {
    await requireGroupPermission(this.permissionService, actor.userId, catalogPermissions.manageCategories);
    const before = await this.single(id);
    if (input.code !== before.code && before.productCount > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "categoryCodeLocked" } });
    const level = await this.validate(input, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE catalog.categories SET parent_id = ${input.parentId ?? null}, code = ${input.code}, name_vi = ${input.nameVi}, name_en = ${input.nameEn}, level = ${level},
          tracks_lots = ${input.tracksLots}, tracks_serials = ${input.tracksSerials}, warranty_months = ${input.warrantyMonths},
          version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (level !== before.level) {
        await transaction.execute(sql`
          WITH RECURSIVE tree AS (
            SELECT id, ${level}::smallint AS level FROM catalog.categories WHERE id = ${id}
            UNION ALL SELECT c.id, (tree.level + 1)::smallint FROM catalog.categories c JOIN tree ON c.parent_id = tree.id)
          UPDATE catalog.categories c SET level = tree.level FROM tree WHERE c.id = tree.id`);
      }
      await this.auditService.record({ ...catalogAudit(actor, "category"), action: "category.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(id);
  }

  // Không xóa ngành hàng, chỉ ngừng dùng hoặc dùng lại (QUYTAC_NGHIEPVU_37).
  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<CategoryResponse> {
    await requireGroupPermission(this.permissionService, actor.userId, catalogPermissions.manageCategories);
    const before = await this.single(id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE catalog.categories SET status = ${status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        { ...catalogAudit(actor, "category"), action: status === "inactive" ? "category.deactivate" : "category.activate", entityId: id, beforeData: { status: before.status }, afterData: { status } },
        transaction,
      );
    });
    return this.single(id);
  }

  async single(id: string): Promise<CategoryResponse> {
    const row = (await this.database.execute<CategoryRow>(sql`${this.select()} WHERE c.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  // Trả cấp của ngành hàng sau khi lưu.
  private async validate(input: CategoryInput, id: string | null): Promise<number> {
    const errors: Record<string, "categoryCodeExists" | "categoryTooDeep" | "categoryParentCycle" | "categoryParentHasProducts" | "categoryLotsAndSerials" | "invalidValue"> = {};
    if (input.tracksLots && input.tracksSerials) errors.tracksSerials = "categoryLotsAndSerials";
    const duplicate = await this.database.execute(sql`SELECT 1 FROM catalog.categories WHERE code = ${input.code} AND id IS DISTINCT FROM ${id}`);
    if (duplicate.rows.length > 0) errors.code = "categoryCodeExists";
    let level = 1;
    if (input.parentId) {
      const parent = (
        await this.database.execute<{ level: number; product_count: number }>(sql`
        SELECT level, (SELECT count(*)::int FROM catalog.products p WHERE p.category_id = c.id) AS product_count FROM catalog.categories c WHERE id = ${input.parentId}`)
      ).rows[0];
      if (!parent) errors.parentId = "invalidValue";
      else {
        level = parent.level + 1;
        // Sản phẩm chỉ gắn ngành hàng lá (QUYTAC_NGHIEPVU_38): ngành hàng đã có sản phẩm không nhận ngành hàng con.
        if (parent.product_count > 0) errors.parentId = "categoryParentHasProducts";
        if (id) {
          const cycle = await this.database.execute(sql`
            WITH RECURSIVE ancestors AS (
              SELECT id, parent_id FROM catalog.categories WHERE id = ${input.parentId}
              UNION ALL SELECT c.id, c.parent_id FROM catalog.categories c JOIN ancestors a ON c.id = a.parent_id)
            SELECT 1 FROM ancestors WHERE id = ${id}`);
          if (cycle.rows.length > 0) errors.parentId = "categoryParentCycle";
        }
      }
    }
    // Độ sâu của nhánh con (khi sửa) cộng cấp mới không vượt 4.
    const depth = id
      ? ((
          await this.database.execute<{ depth: number }>(sql`
          WITH RECURSIVE tree AS (
            SELECT id, 0 AS depth FROM catalog.categories WHERE id = ${id}
            UNION ALL SELECT c.id, tree.depth + 1 FROM catalog.categories c JOIN tree ON c.parent_id = tree.id)
          SELECT max(depth)::int AS depth FROM tree`)
        ).rows[0]?.depth ?? 0)
      : 0;
    if (!errors.parentId && level + depth > categoryMaximumLevel) errors.parentId = "categoryTooDeep";
    if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: errors });
    return level;
  }

  private select() {
    return sql`
      SELECT c.id, c.parent_id, c.code, c.name_vi, c.name_en, c.level, c.tracks_lots, c.tracks_serials, c.warranty_months, c.status, c.version,
        (SELECT count(*)::int FROM catalog.products p WHERE p.category_id = c.id) AS product_count,
        (SELECT count(*)::int FROM catalog.categories child WHERE child.parent_id = c.id) AS child_count
      FROM catalog.categories c`;
  }
}
