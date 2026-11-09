// Sản phẩm của công ty: thông tin chung, biến thể, mã hàng, đơn vị quy đổi, mã vạch (CHUC_NANG_31, 32; QUYTAC_NGHIEPVU_38 đến 40; API_56).
import { Inject, Injectable } from "@nestjs/common";
import { productLimits, type PageResponse, type ProductListItem, type ProductResponse, type productListQuerySchema, type saveProductSchema, type VatRate } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, requireCompanyPermission, searchText } from "./catalog-context";

export type ProductInput = z.output<typeof saveProductSchema>;
type FieldErrors = Record<string, string>;

type ProductRow = {
  id: string;
  company_id: string;
  category_id: string;
  category_name: string;
  code: string;
  name: string;
  description: string | null;
  brand: string | null;
  origin: string | null;
  vat_rate: VatRate;
  tracks_lots: boolean;
  tracks_serials: boolean;
  warranty_months: number;
  base_unit_id: string;
  weight_kg: string | null;
  volume_m3: string | null;
  options: { name: string; values: string[] }[];
  specifications: { name: string; value: string }[];
  status: "active" | "inactive";
  version: number;
  updated_at: Date;
};

// Bỏ số 0 vô nghĩa ở phần lẻ của số thập phân đọc từ cơ sở dữ liệu.
const trimDecimal = (value: string | null) => (value === null ? null : value.includes(".") ? value.replace(/\.?0+$/, "") : value);

@Injectable()
export class ProductsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: Actor, query: z.output<typeof productListQuerySchema>): Promise<PageResponse<ProductListItem>> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewProducts);
    const conditions = [sql`p.company_id = ${actor.companyId}`, sql`p.seller_id IS NULL`];
    if (query.categoryId) conditions.push(sql`p.category_id = ${query.categoryId}`);
    if (query.status) conditions.push(sql`p.status = ${query.status}`);
    if (query.search) {
      // Tìm không dấu theo tên, mã; hoặc đúng mã hàng, mã vạch của biến thể (TIEUCHI_NGHIEMTHU_64).
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      const exact = query.search.trim();
      conditions.push(sql`(p.search_text LIKE ${pattern}
        OR EXISTS (SELECT 1 FROM catalog.variants v WHERE v.product_id = p.id AND v.sku = ${exact.toUpperCase()})
        OR EXISTS (SELECT 1 FROM catalog.barcodes b JOIN catalog.variants v ON v.id = b.variant_id WHERE v.product_id = p.id AND b.company_id = ${actor.companyId} AND b.barcode = ${exact}))`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM catalog.products p WHERE ${where}`)).rows[0]?.total ?? 0;
    const rows = await this.database.execute<{
      id: string;
      code: string;
      name: string;
      category_id: string;
      category_name: string;
      base_unit_name: string;
      variant_count: number;
      status: "active" | "inactive";
      image_id: string | null;
      updated_at: Date;
    }>(sql`
      SELECT p.id, p.code, p.name, p.category_id, c.name_vi AS category_name, u.name_vi AS base_unit_name, p.status, p.updated_at,
        (SELECT count(*)::int FROM catalog.variants v WHERE v.product_id = p.id AND v.status = 'active') AS variant_count,
        (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order, i.created_at LIMIT 1) AS image_id
      FROM catalog.products p JOIN catalog.categories c ON c.id = p.category_id JOIN catalog.units u ON u.id = p.base_unit_id
      WHERE ${where} ORDER BY p.updated_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        categoryId: row.category_id,
        categoryName: row.category_name,
        baseUnitName: row.base_unit_name,
        variantCount: row.variant_count,
        status: row.status,
        imageId: row.image_id,
        updatedAt: new Date(row.updated_at).toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async detail(actor: Actor, id: string): Promise<ProductResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewProducts);
    return this.read(actor.companyId, id);
  }

  async create(actor: Actor, input: ProductInput): Promise<ProductResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    const id = await this.database.transaction(async (transaction) => this.insert(transaction, actor, actor.companyId, input));
    return this.read(actor.companyId, id);
  }

  // Dùng chung cho tạo, nhập Excel, sao chép sang công ty khác (L3): kiểm tra rồi ghi trong giao dịch của người gọi.
  async insert(transaction: Executor, actor: Actor, companyId: string, input: ProductInput): Promise<string> {
    const category = await this.validate(transaction, companyId, input, null);
    const code = input.code || (await this.nextCode(transaction, companyId, category.code));
    const inserted = await transaction.execute<{ id: string }>(sql`
      INSERT INTO catalog.products (company_id, category_id, code, name, search_text, description, brand, origin, vat_rate, tracks_lots, tracks_serials, warranty_months,
        base_unit_id, weight_kg, volume_m3, options, specifications, created_by, updated_by)
      VALUES (${companyId}, ${input.categoryId}, ${code}, ${input.name}, ${searchText(input.name, code, input.brand)}, ${input.description ?? null}, ${input.brand ?? null}, ${input.origin ?? null},
        ${input.vatRate}, ${input.tracksLots}, ${input.tracksSerials}, ${input.warrantyMonths}, ${input.baseUnitId}, ${input.weightKg}::numeric, ${input.volumeM3}::numeric,
        ${JSON.stringify(input.options)}::jsonb, ${JSON.stringify(input.specifications)}::jsonb, ${actor.userId}, ${actor.userId})
      RETURNING id`);
    const productId = inserted.rows[0]!.id;
    await this.writeChildren(transaction, companyId, productId, code, input, true);
    await this.auditService.record({ ...catalogAudit({ ...actor, companyId }, "product"), action: "product.create", entityId: productId, afterData: { ...input, code } }, transaction);
    return productId;
  }

  async update(actor: Actor, id: string, input: ProductInput): Promise<ProductResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    const before = await this.read(actor.companyId, id);
    if (input.version === undefined) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { version: "required" } });
    await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input, before);
      const code = input.code || before.code;
      if (code !== before.code) await this.requireFreeCode(transaction, actor.companyId, code, id);
      const updated = await transaction.execute(sql`
        UPDATE catalog.products SET category_id = ${input.categoryId}, code = ${code}, name = ${input.name}, search_text = ${searchText(input.name, code, input.brand)},
          description = ${input.description ?? null}, brand = ${input.brand ?? null}, origin = ${input.origin ?? null}, vat_rate = ${input.vatRate},
          tracks_lots = ${input.tracksLots}, tracks_serials = ${input.tracksSerials}, warranty_months = ${input.warrantyMonths}, base_unit_id = ${input.baseUnitId},
          weight_kg = ${input.weightKg}::numeric, volume_m3 = ${input.volumeM3}::numeric, options = ${JSON.stringify(input.options)}::jsonb,
          specifications = ${JSON.stringify(input.specifications)}::jsonb, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.writeChildren(transaction, actor.companyId, id, code, input, false);
      await this.auditService.record(
        { ...catalogAudit(actor, "product"), action: "product.update", entityId: id, beforeData: { ...before, images: undefined }, afterData: { ...input, code } },
        transaction,
      );
    });
    return this.read(actor.companyId, id);
  }

  // Không xóa sản phẩm, chỉ ngừng bán hoặc bán lại (QUYTAC_NGHIEPVU_38).
  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<ProductResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    await this.read(actor.companyId, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE catalog.products SET status = ${status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        { ...catalogAudit(actor, "product"), action: status === "inactive" ? "product.deactivate" : "product.activate", entityId: id, afterData: { status } },
        transaction,
      );
    });
    return this.read(actor.companyId, id);
  }

  // Sản phẩm của công ty khác, của nhà bán trả 404 như không tồn tại (TIEUCHI_NGHIEMTHU_57).
  async read(companyId: string, id: string, executor: Executor = this.database): Promise<ProductResponse> {
    const row = (
      await executor.execute<ProductRow>(sql`
      SELECT p.id, p.company_id, p.category_id, c.name_vi AS category_name, p.code, p.name, p.description, p.brand, p.origin, p.vat_rate, p.tracks_lots, p.tracks_serials,
        p.warranty_months, p.base_unit_id, p.weight_kg::text AS weight_kg, p.volume_m3::text AS volume_m3, p.options, p.specifications, p.status, p.version, p.updated_at
      FROM catalog.products p JOIN catalog.categories c ON c.id = p.category_id
      WHERE p.id = ${id} AND p.company_id = ${companyId} AND p.seller_id IS NULL`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const [units, variants, barcodes, images] = await Promise.all([
      executor.execute<{ unit_id: string; factor: string }>(sql`SELECT unit_id, factor::text AS factor FROM catalog.product_units WHERE product_id = ${id} ORDER BY factor`),
      executor.execute<{ id: string; sku: string; option_values: string[]; status: "active" | "inactive" }>(
        sql`SELECT id, sku, option_values, status FROM catalog.variants WHERE product_id = ${id} ORDER BY created_at, sku`,
      ),
      executor.execute<{ variant_id: string; unit_id: string; barcode: string }>(
        sql`SELECT b.variant_id, b.unit_id, b.barcode FROM catalog.barcodes b JOIN catalog.variants v ON v.id = b.variant_id WHERE v.product_id = ${id} ORDER BY b.barcode`,
      ),
      executor.execute<{ id: string; file_name: string; content_type: string; size_bytes: number }>(
        sql`SELECT id, file_name, content_type, size_bytes FROM catalog.product_images WHERE product_id = ${id} ORDER BY sort_order, created_at`,
      ),
    ]);
    return {
      id: row.id,
      companyId: row.company_id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      code: row.code,
      name: row.name,
      description: row.description,
      brand: row.brand,
      origin: row.origin,
      vatRate: row.vat_rate,
      tracksLots: row.tracks_lots,
      tracksSerials: row.tracks_serials,
      warrantyMonths: row.warranty_months,
      baseUnitId: row.base_unit_id,
      weightKg: trimDecimal(row.weight_kg),
      volumeM3: trimDecimal(row.volume_m3),
      options: row.options,
      specifications: row.specifications,
      units: units.rows.map((unit) => ({ unitId: unit.unit_id, factor: trimDecimal(unit.factor)! })),
      variants: variants.rows.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        optionValues: variant.option_values,
        status: variant.status,
        barcodes: barcodes.rows.filter((barcode) => barcode.variant_id === variant.id).map((barcode) => ({ unitId: barcode.unit_id, barcode: barcode.barcode })),
      })),
      images: images.rows.map((image) => ({ id: image.id, fileName: image.file_name, contentType: image.content_type, sizeBytes: image.size_bytes })),
      status: row.status,
      version: row.version,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  // Kiểm tra theo quy tắc; lỗi chỉ ra đúng trường, đúng dòng (TIEUCHI_NGHIEMTHU_58). Trả ngành hàng của sản phẩm.
  private async validate(executor: Executor, companyId: string, input: ProductInput, before: ProductResponse | null): Promise<{ code: string }> {
    const errors: FieldErrors = {};
    const category = (
      await executor.execute<{ code: string; status: string; child_count: number }>(sql`
      SELECT code, status, (SELECT count(*)::int FROM catalog.categories child WHERE child.parent_id = c.id) AS child_count FROM catalog.categories c WHERE id = ${input.categoryId}`)
    ).rows[0];
    if (!category || (category.status !== "active" && before?.categoryId !== input.categoryId)) errors.categoryId = "invalidValue";
    else if (category.child_count > 0) errors.categoryId = "productCategoryNotLeaf";
    if (input.tracksLots && input.tracksSerials) errors.tracksSerials = "categoryLotsAndSerials";

    const unitIds = [input.baseUnitId, ...input.units.map((unit) => unit.unitId)];
    const activeUnits = new Set(
      (
        await executor.execute<{ id: string }>(
          sql`SELECT id FROM catalog.units WHERE id IN (${sql.join(
            unitIds.map((unitId) => sql`${unitId}`),
            sql`, `,
          )}) AND (status = 'active' OR id IN (SELECT unit_id FROM catalog.product_units WHERE product_id = ${before?.id ?? null}) OR id = ${before?.baseUnitId ?? null})`,
        )
      ).rows.map((row) => row.id),
    );
    if (!activeUnits.has(input.baseUnitId)) errors.baseUnitId = "invalidValue";
    const seenUnits = new Set([input.baseUnitId]);
    input.units.forEach((unit, index) => {
      if (!activeUnits.has(unit.unitId) || seenUnits.has(unit.unitId)) errors[`units.${index}.unitId`] = "productUnitInvalid";
      seenUnits.add(unit.unitId);
      if (Number(unit.factor) <= 0) errors[`units.${index}.factor`] = "invalidValue";
    });

    // Biến thể: đủ giá trị theo từng thuộc tính phân loại, không trùng tổ hợp; không phân loại thì đúng một biến thể.
    const optionNames = new Set<string>();
    input.options.forEach((option, index) => {
      if (optionNames.has(option.name.toLowerCase())) errors[`options.${index}.name`] = "productOptionDuplicate";
      optionNames.add(option.name.toLowerCase());
      if (new Set(option.values.map((value) => value.toLowerCase())).size !== option.values.length) errors[`options.${index}.values`] = "productOptionDuplicate";
    });
    if (input.options.length === 0 && input.variants.length !== 1) errors.variants = "productVariantsInvalid";
    const combinations = new Set<string>();
    const existingIds = new Set(before?.variants.map((variant) => variant.id) ?? []);
    const skus = new Map<string, number>();
    const barcodes = new Map<string, string>();
    input.variants.forEach((variant, index) => {
      if (variant.id && !existingIds.has(variant.id)) errors[`variants.${index}.id`] = "invalidValue";
      const valid = variant.optionValues.length === input.options.length && variant.optionValues.every((value, position) => input.options[position]!.values.includes(value));
      if (!valid) errors[`variants.${index}.optionValues`] = "productVariantsInvalid";
      const key = JSON.stringify(variant.optionValues);
      if (combinations.has(key)) errors[`variants.${index}.optionValues`] = "productVariantDuplicate";
      combinations.add(key);
      if (variant.sku) {
        if (skus.has(variant.sku)) errors[`variants.${index}.sku`] = "productSkuExists";
        skus.set(variant.sku, index);
      }
      variant.barcodes.forEach((barcode, position) => {
        if (!seenUnits.has(barcode.unitId)) errors[`variants.${index}.barcodes.${position}.unitId`] = "productUnitInvalid";
        if (barcodes.has(barcode.barcode)) errors[`variants.${index}.barcodes.${position}.barcode`] = "productBarcodeExists";
        barcodes.set(barcode.barcode, `variants.${index}.barcodes.${position}.barcode`);
      });
    });
    if (input.variants.length > productLimits.variants) errors.variants = "productVariantsInvalid";

    // Mã hàng, mã vạch trùng với sản phẩm khác trong công ty.
    const ownVariantIds = before?.variants.map((variant) => variant.id) ?? [];
    if (skus.size > 0) {
      const taken = await executor.execute<{ sku: string }>(sql`
        SELECT sku FROM catalog.variants WHERE company_id = ${companyId} AND sku IN (${sql.join(
          [...skus.keys()].map((sku) => sql`${sku}`),
          sql`, `,
        )})
        AND product_id IS DISTINCT FROM ${before?.id ?? null}`);
      for (const row of taken.rows) errors[`variants.${skus.get(row.sku)}.sku`] = "productSkuExists";
    }
    if (barcodes.size > 0) {
      const taken = await executor.execute<{ barcode: string }>(sql`
        SELECT barcode FROM catalog.barcodes WHERE company_id = ${companyId} AND barcode IN (${sql.join(
          [...barcodes.keys()].map((barcode) => sql`${barcode}`),
          sql`, `,
        )})
        ${
          ownVariantIds.length > 0
            ? sql`AND variant_id NOT IN (${sql.join(
                ownVariantIds.map((variantId) => sql`${variantId}`),
                sql`, `,
              )})`
            : sql``
        }`);
      for (const row of taken.rows) errors[barcodes.get(row.barcode)!] = "productBarcodeExists";
    }
    if (input.code) {
      const taken = await executor.execute(sql`SELECT 1 FROM catalog.products WHERE company_id = ${companyId} AND code = ${input.code} AND id IS DISTINCT FROM ${before?.id ?? null}`);
      if (taken.rows.length > 0) errors.code = "productCodeExists";
    }
    if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: errors as Record<string, never> });
    return { code: category!.code };
  }

  private async requireFreeCode(executor: Executor, companyId: string, code: string, productId: string | null): Promise<void> {
    const taken = await executor.execute(sql`SELECT 1 FROM catalog.products WHERE company_id = ${companyId} AND code = ${code} AND id IS DISTINCT FROM ${productId}`);
    if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "productCodeExists" } });
  }

  // Mã sản phẩm tự sinh <mã ngành hàng>-<5 chữ số>, theo công ty và ngành hàng; bỏ qua số đã bị dùng bằng mã nhập tay.
  private async nextCode(executor: Executor, companyId: string, prefix: string): Promise<string> {
    for (;;) {
      const counter = await executor.execute<{ value: number }>(sql`
        INSERT INTO catalog.code_counters (company_id, prefix, next_value) VALUES (${companyId}, ${prefix}, 2)
        ON CONFLICT (company_id, prefix) DO UPDATE SET next_value = catalog.code_counters.next_value + 1
        RETURNING next_value - 1 AS value`);
      const code = `${prefix}-${String(counter.rows[0]!.value).padStart(5, "0")}`;
      const taken = await executor.execute(sql`SELECT 1 FROM catalog.products WHERE company_id = ${companyId} AND code = ${code}`);
      if (taken.rows.length === 0) return code;
    }
  }

  // Ghi đơn vị quy đổi, biến thể, mã vạch. Biến thể bị bỏ khỏi danh sách chuyển ngừng bán, không xóa (có thể đã dùng ở chứng từ).
  private async writeChildren(executor: Executor, companyId: string, productId: string, code: string, input: ProductInput, isNew: boolean): Promise<void> {
    await executor.execute(sql`DELETE FROM catalog.product_units WHERE product_id = ${productId}`);
    for (const unit of input.units) {
      await executor.execute(sql`INSERT INTO catalog.product_units (product_id, unit_id, factor) VALUES (${productId}, ${unit.unitId}, ${unit.factor}::numeric)`);
    }
    const existing = isNew ? [] : (await executor.execute<{ id: string; sku: string }>(sql`SELECT id, sku FROM catalog.variants WHERE product_id = ${productId} ORDER BY created_at, sku`)).rows;
    const kept = new Set(input.variants.map((variant) => variant.id).filter(Boolean));
    const usedSkus = new Set(input.variants.map((variant) => variant.sku).filter(Boolean) as string[]);
    for (const variant of existing.filter((item) => !kept.has(item.id))) {
      await executor.execute(sql`UPDATE catalog.variants SET status = 'inactive' WHERE id = ${variant.id}`);
      usedSkus.add(variant.sku);
    }
    // Xóa mã vạch cũ của cả sản phẩm trước: mã vạch chuyển giữa hai biến thể không vi phạm ràng buộc duy nhất.
    await executor.execute(sql`DELETE FROM catalog.barcodes WHERE variant_id IN (SELECT id FROM catalog.variants WHERE product_id = ${productId})`);
    let sequence = existing.length;
    for (const [index, variant] of input.variants.entries()) {
      let sku = variant.sku;
      if (!sku) {
        // Biến thể đã có giữ mã hàng cũ; biến thể mới mới sinh mã.
        const previous = existing.find((item) => item.id === variant.id)?.sku;
        if (previous) sku = previous;
        else if (input.options.length === 0) sku = code;
        else {
          do {
            sequence += 1;
            sku = `${code}-${String(sequence).padStart(2, "0")}`;
          } while (usedSkus.has(sku));
        }
      }
      usedSkus.add(sku);
      const taken = await executor.execute(sql`SELECT 1 FROM catalog.variants WHERE company_id = ${companyId} AND sku = ${sku} AND id IS DISTINCT FROM ${variant.id ?? null}`);
      if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`variants.${index}.sku`]: "productSkuExists" } as Record<string, never> });
      const variantId = variant.id
        ? (
            await executor.execute<{ id: string }>(sql`
            UPDATE catalog.variants SET sku = ${sku}, option_values = ${JSON.stringify(variant.optionValues)}::jsonb, status = ${variant.status}
            WHERE id = ${variant.id} AND product_id = ${productId} RETURNING id`)
          ).rows[0]!.id
        : (
            await executor.execute<{ id: string }>(sql`
            INSERT INTO catalog.variants (company_id, product_id, sku, option_values, status)
            VALUES (${companyId}, ${productId}, ${sku}, ${JSON.stringify(variant.optionValues)}::jsonb, ${variant.status}) RETURNING id`)
          ).rows[0]!.id;
      for (const barcode of variant.barcodes) {
        await executor.execute(sql`INSERT INTO catalog.barcodes (company_id, variant_id, unit_id, barcode) VALUES (${companyId}, ${variantId}, ${barcode.unitId}, ${barcode.barcode})`);
      }
    }
  }
}
