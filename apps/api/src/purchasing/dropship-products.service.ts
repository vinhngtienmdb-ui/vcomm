// Sản phẩm dropship, tồn nhà cung cấp khai báo (CONG_VIEC_62 CHUC_NANG_222; QUYTAC_NGHIEPVU_497, 498; API_265, API_266).
import { Inject, Injectable } from "@nestjs/common";
import {
  dropshipStockImportColumns,
  productImportMaximumBytes,
  productImportMaximumRows,
  type createDropshipProductSchema,
  type DropshipOptionsResponse,
  type DropshipProductDetailResponse,
  type dropshipProductListQuerySchema,
  type DropshipProductResponse,
  type DropshipStockImportResponse,
  type PageResponse,
  type updateDropshipProductSchema,
  type updateDropshipStockSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { messages, type Locale } from "i18n";
import { readSheet } from "read-excel-file/node";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { isActiveSupplier, purchasingAudit, purchasingPermissions, requirePermission, variantUnitFactor, type Executor, type FieldErrors } from "./purchasing-context";

type ProductRow = {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  option_values: string[];
  base_unit_name: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  unit_id: string;
  unit_name: string;
  purchase_price: string | null;
  declared_quantity: string;
  reserved_quantity: string;
  declared_at: Date;
  declared_by_name: string | null;
  status: "active" | "inactive";
  version: number;
};

// Nguồn đổi tồn: nhân viên (tay, tệp) hoặc khóa API của nhà cung cấp (L3).
export type StockChangeSource = { kind: "manual" | "import"; userId: string } | { kind: "open_api"; apiKeyId: string };

@Injectable()
export class DropshipProductsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async options(actor: Actor): Promise<DropshipOptionsResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    const warehouse = (
      await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM inventory.warehouses WHERE company_id = ${actor.companyId} AND kind = 'dropship' AND status = 'active'`)
    ).rows[0];
    const suppliers = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT p.id, p.code, p.name FROM crm.partners p JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}
      WHERE p.status = 'active' AND pr.status = 'active' AND pr.is_supplier ORDER BY p.name`);
    return { warehouse: warehouse ?? null, suppliers: suppliers.rows };
  }

  async list(actor: Actor, query: z.output<typeof dropshipProductListQuerySchema>): Promise<PageResponse<DropshipProductResponse>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    const conditions: SQL[] = [sql`dp.company_id = ${actor.companyId}`, sql`dp.status = ${query.status ?? "active"}`];
    if (query.supplierId) conditions.push(sql`dp.supplier_id = ${query.supplierId}`);
    if (query.search) {
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(v.sku = ${query.search.toUpperCase()} OR p.search_text LIKE ${pattern})`);
    }
    if (query.unavailableOnly) conditions.push(sql`dp.declared_quantity - ${this.reserved()} <= 0`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<ProductRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY s.name, v.sku LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map(toResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<DropshipProductDetailResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    const product = await this.single(this.database, actor.companyId, id);
    const changes = await this.database.execute<{ id: string; old_quantity: string; new_quantity: string; source: "manual" | "import" | "open_api"; changed_by_name: string; created_at: Date }>(sql`
      SELECT c.id, c.old_quantity::text, c.new_quantity::text, c.source, coalesce(u.full_name, k.name) AS changed_by_name, c.created_at
      FROM purchasing.dropship_stock_changes c LEFT JOIN core.users u ON u.id = c.changed_by LEFT JOIN core.api_keys k ON k.id = c.changed_via_api_key_id
      WHERE c.dropship_product_id = ${id} ORDER BY c.created_at DESC LIMIT 50`);
    return {
      ...product,
      changes: changes.rows.map((row) => ({
        id: row.id,
        oldQuantity: trimDecimal(row.old_quantity),
        newQuantity: trimDecimal(row.new_quantity),
        source: row.source,
        changedByName: row.changed_by_name,
        createdAt: new Date(row.created_at).toISOString(),
      })),
    };
  }

  async create(actor: Actor, input: z.output<typeof createDropshipProductSchema>): Promise<DropshipProductResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    const id = await this.database
      .transaction(async (transaction) => {
        await this.validate(transaction, actor.companyId, input.variantId, input.supplierId, input.unitId, null);
        const productId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO purchasing.dropship_products (company_id, variant_id, supplier_id, unit_id, declared_quantity, declared_by, created_by, updated_by)
          VALUES (${actor.companyId}, ${input.variantId}, ${input.supplierId}, ${input.unitId}, ${input.declaredQuantity}::numeric, ${actor.userId}, ${actor.userId}, ${actor.userId})
          RETURNING id`)
        ).rows[0]!.id;
        if (Number(input.declaredQuantity) > 0) {
          await transaction.execute(sql`
            INSERT INTO purchasing.dropship_stock_changes (dropship_product_id, old_quantity, new_quantity, source, changed_by)
            VALUES (${productId}, 0, ${input.declaredQuantity}::numeric, 'manual', ${actor.userId})`);
        }
        await this.auditService.record({ ...purchasingAudit(actor, "dropship_product"), action: "dropship_product.create", entityId: productId, afterData: input }, transaction);
        return productId;
      })
      .catch(duplicateAsFieldError);
    return this.single(this.database, actor.companyId, id);
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateDropshipProductSchema>): Promise<DropshipProductResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    const before = await this.single(this.database, actor.companyId, id);
    await this.database
      .transaction(async (transaction) => {
        if (input.status === "active") await this.validate(transaction, actor.companyId, before.variantId, input.supplierId, input.unitId, id);
        const updated = await transaction.execute(sql`
          UPDATE purchasing.dropship_products SET supplier_id = ${input.supplierId}, unit_id = ${input.unitId}, status = ${input.status},
            updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version} RETURNING id`);
        if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await this.auditService.record({ ...purchasingAudit(actor, "dropship_product"), action: "dropship_product.update", entityId: id, beforeData: before, afterData: input }, transaction);
      })
      .catch(duplicateAsFieldError);
    return this.single(this.database, actor.companyId, id);
  }

  async updateStock(actor: Actor, id: string, input: z.output<typeof updateDropshipStockSchema>): Promise<DropshipProductResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    await this.database.transaction(async (transaction) => {
      const current = (
        await transaction.execute<{ version: number; status: string }>(sql`
        SELECT version, status FROM purchasing.dropship_products WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      if (current.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (current.status !== "active") throw new ApiError("BUSINESS_RULE", "dropshipProductMissing");
      await setDeclaredQuantity(transaction, id, input.declaredQuantity, { kind: "manual", userId: actor.userId });
      await this.auditService.record(
        { ...purchasingAudit(actor, "dropship_product"), action: "dropship_product.stock", entityId: id, afterData: { declaredQuantity: input.declaredQuantity } },
        transaction,
      );
    });
    return this.single(this.database, actor.companyId, id);
  }

  // Tệp Excel: mã biến thể, tồn khai báo; dòng lỗi bỏ qua, dòng đúng ghi (QUYTAC_NGHIEPVU_498).
  async importStock(actor: Actor, file: { buffer: Buffer; size: number } | undefined, locale: Locale): Promise<DropshipStockImportResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > productImportMaximumBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooLarge" } });
    let sheet: unknown[][];
    try {
      sheet = (await readSheet(file.buffer)) as unknown[][];
    } catch {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    }
    const text = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());
    if (dropshipStockImportColumns.some((title, index) => text(sheet[0]?.[index]) !== title)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileInvalidTemplate" } });
    const rows = sheet
      .slice(1)
      .map((row, index) => ({ number: index + 2, sku: text(row[0]).toUpperCase(), quantity: text(row[1]) }))
      .filter((row) => row.sku || row.quantity);
    if (rows.length > productImportMaximumRows) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "fileTooManyRowsCatalog" } });
    const errorText = messages[locale].errors as Record<string, string>;
    const errors: { row: number; message: string }[] = [];
    let updated = 0;
    const seen = new Set<string>();
    await this.database.transaction(async (transaction) => {
      for (const row of rows) {
        const found = (
          await transaction.execute<{ id: string }>(sql`
          SELECT dp.id FROM purchasing.dropship_products dp JOIN catalog.variants v ON v.id = dp.variant_id
          WHERE dp.company_id = ${actor.companyId} AND dp.status = 'active' AND v.sku = ${row.sku} FOR UPDATE OF dp`)
        ).rows[0];
        if (!found) errors.push({ row: row.number, message: `${errorText.dropshipProductMissing} (${dropshipStockImportColumns[0]})` });
        else if (!/^\d{1,12}$/.test(row.quantity)) errors.push({ row: row.number, message: `${errorText.invalidValue} (${dropshipStockImportColumns[1]})` });
        else if (seen.has(found.id)) errors.push({ row: row.number, message: errorText.priceLineDuplicate ?? "" });
        else {
          seen.add(found.id);
          await setDeclaredQuantity(transaction, found.id, row.quantity, { kind: "import", userId: actor.userId });
          updated += 1;
        }
      }
      await this.auditService.record({ ...purchasingAudit(actor, "dropship_product"), action: "dropship_product.stock_import", afterData: { updated, errors: errors.length } }, transaction);
    });
    return { updated, errors };
  }

  // Mặt hàng hóa đang bán của công ty, không theo lô, serial; nhà cung cấp đang giao dịch; đơn vị của mặt hàng; chưa có dòng đang dùng (QUYTAC_NGHIEPVU_497).
  private async validate(transaction: Executor, companyId: string, variantId: string, supplierId: string, unitId: string, exceptId: string | null): Promise<void> {
    const fields: FieldErrors = {};
    const variant = (
      await transaction.execute<{ kind: string; tracks_lots: boolean; tracks_serials: boolean }>(sql`
      SELECT p.kind, p.tracks_lots, p.tracks_serials FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
      WHERE v.id = ${variantId} AND v.company_id = ${companyId} AND v.status = 'active' AND p.status = 'active'`)
    ).rows[0];
    if (!variant) fields.variantId = "invalidValue";
    else if (variant.kind === "service") fields.variantId = "serviceNotStocked";
    else if (variant.tracks_lots || variant.tracks_serials) fields.variantId = "dropshipTrackedNotAllowed";
    if (!(await isActiveSupplier(transaction, companyId, supplierId))) fields.supplierId = "supplierNotActive";
    if (variant && !(await variantUnitFactor(transaction, companyId, variantId, unitId))) fields.unitId = "invalidValue";
    if (!fields.variantId) {
      const existing = await transaction.execute(sql`
        SELECT 1 FROM purchasing.dropship_products WHERE company_id = ${companyId} AND variant_id = ${variantId} AND status = 'active' AND id IS DISTINCT FROM ${exceptId}::uuid`);
      if (existing.rows.length > 0) fields.variantId = "dropshipProductExists";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<DropshipProductResponse> {
    const row = (await executor.execute<ProductRow>(sql`${this.select()} ${this.from()} WHERE dp.id = ${id} AND dp.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  // Giữ chỗ đang có tại kho Dropship của công ty.
  private reserved(): SQL {
    return sql`coalesce((SELECT sum(r.quantity) FROM inventory.reservations r JOIN inventory.warehouses w ON w.id = r.warehouse_id AND w.kind = 'dropship'
      WHERE r.company_id = dp.company_id AND r.variant_id = dp.variant_id AND r.status = 'active'), 0)`;
  }

  private select(): SQL {
    const today = this.permissionService.today();
    return sql`SELECT dp.id, dp.variant_id, v.sku, p.name AS product_name, v.option_values, bu.name_vi AS base_unit_name, dp.supplier_id, s.code AS supplier_code, s.name AS supplier_name,
      dp.unit_id, u.name_vi AS unit_name, dp.declared_quantity::text, ${this.reserved()}::text AS reserved_quantity, dp.declared_at,
      coalesce(du.full_name, dk.name) AS declared_by_name, dp.status, dp.version,
      (SELECT sp.unit_price::text FROM purchasing.supplier_prices sp
        WHERE sp.company_id = dp.company_id AND sp.supplier_id = dp.supplier_id AND sp.variant_id = dp.variant_id AND sp.unit_id = dp.unit_id AND sp.status = 'active'
          AND sp.valid_from <= ${today}::date AND (sp.valid_to IS NULL OR sp.valid_to >= ${today}::date)
        ORDER BY sp.min_quantity, sp.valid_from DESC LIMIT 1) AS purchase_price`;
  }

  private from(): SQL {
    return sql`FROM purchasing.dropship_products dp JOIN catalog.variants v ON v.id = dp.variant_id JOIN catalog.products p ON p.id = v.product_id
      JOIN catalog.units bu ON bu.id = p.base_unit_id JOIN catalog.units u ON u.id = dp.unit_id JOIN crm.partners s ON s.id = dp.supplier_id
      LEFT JOIN core.users du ON du.id = dp.declared_by LEFT JOIN core.api_keys dk ON dk.id = dp.declared_via_api_key_id`;
  }
}

// Ghi tồn khai báo mới và lịch sử; bên gọi đã khóa dòng (QUYTAC_NGHIEPVU_498). Dùng chung cho Open API nhà cung cấp (L3).
export async function setDeclaredQuantity(transaction: Executor, id: string, quantity: string, source: StockChangeSource): Promise<void> {
  const userId = source.kind === "open_api" ? null : source.userId;
  const apiKeyId = source.kind === "open_api" ? source.apiKeyId : null;
  const old = (await transaction.execute<{ declared_quantity: string }>(sql`SELECT declared_quantity::text FROM purchasing.dropship_products WHERE id = ${id}`)).rows[0]!;
  await transaction.execute(sql`
    UPDATE purchasing.dropship_products SET declared_quantity = ${quantity}::numeric, declared_at = now(), declared_by = ${userId}, declared_via_api_key_id = ${apiKeyId},
      updated_at = now(), version = version + 1
    WHERE id = ${id}`);
  await transaction.execute(sql`
    INSERT INTO purchasing.dropship_stock_changes (dropship_product_id, old_quantity, new_quantity, source, changed_by, changed_via_api_key_id)
    VALUES (${id}, ${old.declared_quantity}::numeric, ${quantity}::numeric, ${source.kind}, ${userId}, ${apiKeyId})`);
}

function duplicateAsFieldError(error: unknown): never {
  if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { variantId: "dropshipProductExists" } });
  throw error;
}

function toResponse(row: ProductRow): DropshipProductResponse {
  const available = Number(row.declared_quantity) - Number(row.reserved_quantity);
  return {
    id: row.id,
    variantId: row.variant_id,
    sku: row.sku,
    productName: row.product_name,
    optionValues: row.option_values,
    baseUnitName: row.base_unit_name,
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    unitId: row.unit_id,
    unitName: row.unit_name,
    purchasePrice: row.purchase_price === null ? null : trimDecimal(row.purchase_price),
    declaredQuantity: trimDecimal(row.declared_quantity),
    reservedQuantity: trimDecimal(row.reserved_quantity),
    availableQuantity: trimDecimal(String(Math.max(available, 0))),
    declaredAt: new Date(row.declared_at).toISOString(),
    declaredByName: row.declared_by_name,
    status: row.status,
    version: row.version,
  };
}
