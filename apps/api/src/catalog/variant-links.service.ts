// Liên kết biến thể tương ứng giữa công ty, sao chép sản phẩm sang công ty khác (CHUC_NANG_34; QUYTAC_NGHIEPVU_41; API_59; TIEUCHI_NGHIEMTHU_60).
import { Inject, Injectable } from "@nestjs/common";
import type { createVariantLinkSchema, VariantLinkResponse, VariantLinkSuggestion } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Executor } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, requireCompanyPermission, trimDecimal } from "./catalog-context";
import { ProductsService } from "./products.service";

type LinkRow = {
  id: string;
  variant_id: string;
  sku: string;
  linked_variant_id: string;
  linked_sku: string;
  linked_product_id: string;
  linked_product_name: string;
  linked_company_id: string;
  linked_company_name: string;
  factor: string;
};

@Injectable()
export class VariantLinksService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly products: ProductsService,
  ) {}

  // Liên kết của các biến thể thuộc một sản phẩm, đọc cả hai chiều; hệ số đổi chiều khi đọc từ phía bên kia.
  async listForProduct(actor: Actor, productId: string): Promise<VariantLinkResponse[]> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewProducts);
    await this.products.read(actor.companyId, productId);
    const rows = await this.database.execute<LinkRow>(sql`
      SELECT l.id, mine.id AS variant_id, mine.sku, other.id AS linked_variant_id, other.sku AS linked_sku, op.id AS linked_product_id, op.name AS linked_product_name,
        other.company_id AS linked_company_id, c.short_name AS linked_company_name,
        (CASE WHEN l.variant_id = mine.id THEN l.factor ELSE 1 / l.factor END)::numeric(18,4)::text AS factor
      FROM catalog.variant_links l
      JOIN catalog.variants mine ON mine.id IN (l.variant_id, l.linked_variant_id) AND mine.product_id = ${productId}
      JOIN catalog.variants other ON other.id = CASE WHEN l.variant_id = mine.id THEN l.linked_variant_id ELSE l.variant_id END
      JOIN catalog.products op ON op.id = other.product_id
      JOIN core.companies c ON c.id = other.company_id
      ORDER BY mine.sku, c.short_name`);
    return rows.rows.map((row) => ({
      id: row.id,
      variantId: row.variant_id,
      sku: row.sku,
      linkedVariantId: row.linked_variant_id,
      linkedSku: row.linked_sku,
      linkedProductId: row.linked_product_id,
      linkedProductName: row.linked_product_name,
      linkedCompanyId: row.linked_company_id,
      linkedCompanyName: row.linked_company_name,
      factor: trimDecimal(row.factor),
    }));
  }

  // Gợi ý liên kết theo mã vạch trùng ở công ty khác (quyết định người dùng 2026-11-09).
  async suggestions(actor: Actor, productId: string, targetCompanyId: string): Promise<VariantLinkSuggestion[]> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewProducts);
    await requireCompanyPermission(this.permissionService, { ...actor, companyId: targetCompanyId }, catalogPermissions.viewProducts);
    await this.products.read(actor.companyId, productId);
    const rows = await this.database.execute<{ variant_id: string; sku: string; linked_variant_id: string; linked_sku: string; linked_product_name: string; barcode: string }>(sql`
      SELECT DISTINCT ON (mine.id, other.id) mine.id AS variant_id, mine.sku, other.id AS linked_variant_id, other.sku AS linked_sku, op.name AS linked_product_name, mb.barcode
      FROM catalog.variants mine
      JOIN catalog.barcodes mb ON mb.variant_id = mine.id
      JOIN catalog.barcodes ob ON ob.barcode = mb.barcode AND ob.company_id = ${targetCompanyId}
      JOIN catalog.variants other ON other.id = ob.variant_id
      JOIN catalog.products op ON op.id = other.product_id AND op.seller_id IS NULL
      WHERE mine.product_id = ${productId}
        AND NOT EXISTS (SELECT 1 FROM catalog.variant_links l WHERE (l.variant_id = mine.id AND l.linked_company_id = ${targetCompanyId}) OR (l.linked_variant_id = mine.id AND l.company_id = ${targetCompanyId}))`);
    return rows.rows.map((row) => ({
      variantId: row.variant_id,
      sku: row.sku,
      linkedVariantId: row.linked_variant_id,
      linkedSku: row.linked_sku,
      linkedProductName: row.linked_product_name,
      barcode: row.barcode,
    }));
  }

  async create(actor: Actor, input: z.output<typeof createVariantLinkSchema>): Promise<VariantLinkResponse> {
    const productId = await this.database.transaction(async (transaction) => this.link(transaction, actor, input.variantId, input.linkedVariantId, input.factor));
    return (await this.listForProduct(actor, productId)).find((link) => link.variantId === input.variantId && link.linkedVariantId === input.linkedVariantId)!;
  }

  // Người liên kết phải có quyền quản lý sản phẩm ở cả hai công ty; mỗi biến thể tối đa một liên kết với mỗi công ty khác.
  private async link(executor: Executor, actor: Actor, variantId: string, linkedVariantId: string, factor: string): Promise<string> {
    const variants = await executor.execute<{ id: string; company_id: string; product_id: string }>(sql`
      SELECT v.id, v.company_id, v.product_id FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
      WHERE v.id IN (${variantId}, ${linkedVariantId}) AND p.seller_id IS NULL`);
    const mine = variants.rows.find((row) => row.id === variantId);
    const other = variants.rows.find((row) => row.id === linkedVariantId);
    if (!mine || mine.company_id !== actor.companyId || !other) throw new ApiError("NOT_FOUND", "notFound");
    if (other.company_id === actor.companyId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { linkedVariantId: "variantLinkSameCompany" } });
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    await requireCompanyPermission(this.permissionService, { ...actor, companyId: other.company_id }, catalogPermissions.manageProducts);
    if (Number(factor) <= 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { factor: "invalidValue" } });
    const taken = await executor.execute(sql`
      SELECT 1 FROM catalog.variant_links
      WHERE (variant_id = ${variantId} AND linked_company_id = ${other.company_id}) OR (linked_variant_id = ${variantId} AND company_id = ${other.company_id})
        OR (variant_id = ${linkedVariantId} AND linked_company_id = ${actor.companyId}) OR (linked_variant_id = ${linkedVariantId} AND company_id = ${actor.companyId})`);
    if (taken.rows.length > 0) throw new ApiError("BUSINESS_RULE", "variantLinkExists");
    const inserted = await executor.execute<{ id: string }>(sql`
      INSERT INTO catalog.variant_links (variant_id, company_id, linked_variant_id, linked_company_id, factor, created_by)
      VALUES (${variantId}, ${actor.companyId}, ${linkedVariantId}, ${other.company_id}, ${factor}::numeric, ${actor.userId}) RETURNING id`);
    await this.auditService.record(
      {
        ...catalogAudit(actor, "product"),
        action: "product.link",
        entityId: mine.product_id,
        afterData: { variantId, linkedVariantId, linkedCompanyId: other.company_id, factor, linkId: inserted.rows[0]!.id },
      },
      executor,
    );
    return mine.product_id;
  }

  async remove(actor: Actor, linkId: string): Promise<void> {
    const link = (
      await this.database.execute<{ variant_id: string; company_id: string; linked_company_id: string; product_id: string }>(sql`
      SELECT l.variant_id, l.company_id, l.linked_company_id, v.product_id FROM catalog.variant_links l JOIN catalog.variants v ON v.id = l.variant_id WHERE l.id = ${linkId}`)
    ).rows[0];
    if (!link || (link.company_id !== actor.companyId && link.linked_company_id !== actor.companyId)) throw new ApiError("NOT_FOUND", "notFound");
    await requireCompanyPermission(this.permissionService, { ...actor, companyId: link.company_id }, catalogPermissions.manageProducts);
    await requireCompanyPermission(this.permissionService, { ...actor, companyId: link.linked_company_id }, catalogPermissions.manageProducts);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM catalog.variant_links WHERE id = ${linkId}`);
      await this.auditService.record({ ...catalogAudit(actor, "product"), action: "product.unlink", entityId: link.product_id, beforeData: { linkId } }, transaction);
    });
  }

  // Sao chép sang công ty khác: sản phẩm mới ở công ty đích, giữ mã nếu chưa bị dùng, rồi liên kết từng biến thể với hệ số 1.
  async copy(actor: Actor, productId: string, targetCompanyId: string): Promise<{ productId: string }> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    if (targetCompanyId === actor.companyId) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { targetCompanyId: "variantLinkSameCompany" } });
    await requireCompanyPermission(this.permissionService, { ...actor, companyId: targetCompanyId }, catalogPermissions.manageProducts);
    const source = await this.products.read(actor.companyId, productId);
    const active = source.variants.filter((variant) => variant.status === "active");
    if (active.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { variants: "productVariantsInvalid" } });
    const newId = await this.database.transaction(async (transaction) => {
      const codeTaken = (await transaction.execute(sql`SELECT 1 FROM catalog.products WHERE company_id = ${targetCompanyId} AND code = ${source.code}`)).rows.length > 0;
      const skusTaken = new Set(
        (
          await transaction.execute<{ sku: string }>(
            sql`SELECT sku FROM catalog.variants WHERE company_id = ${targetCompanyId} AND sku IN (${sql.join(
              active.map((variant) => sql`${variant.sku}`),
              sql`, `,
            )})`,
          )
        ).rows.map((row) => row.sku),
      );
      const barcodesTaken = new Set(
        (
          await transaction.execute<{ barcode: string }>(
            sql`SELECT barcode FROM catalog.barcodes WHERE company_id = ${targetCompanyId} AND barcode IN (${sql.join(
              [...active.flatMap((variant) => variant.barcodes.map((barcode) => sql`${barcode.barcode}`)), sql`NULL`],
              sql`, `,
            )})`,
          )
        ).rows.map((row) => row.barcode),
      );
      const targetId = await this.products.insert(transaction, { ...actor, companyId: targetCompanyId }, targetCompanyId, {
        categoryId: source.categoryId,
        code: codeTaken ? "" : source.code,
        name: source.name,
        description: source.description,
        brand: source.brand,
        origin: source.origin,
        vatRate: source.vatRate,
        tracksLots: source.tracksLots,
        tracksSerials: source.tracksSerials,
        warrantyMonths: source.warrantyMonths,
        baseUnitId: source.baseUnitId,
        weightKg: source.weightKg,
        volumeM3: source.volumeM3,
        options: source.options,
        specifications: source.specifications,
        units: source.units,
        // Mã hàng, mã vạch đã có ở công ty đích thì để hệ thống sinh mã khác, bỏ mã vạch trùng.
        variants: active.map((variant) => ({
          sku: codeTaken || skusTaken.has(variant.sku) ? "" : variant.sku,
          optionValues: variant.optionValues,
          status: "active" as const,
          barcodes: variant.barcodes.filter((barcode) => !barcodesTaken.has(barcode.barcode)),
        })),
      });
      const copied = await transaction.execute<{ id: string; option_values: string[] }>(sql`SELECT id, option_values FROM catalog.variants WHERE product_id = ${targetId}`);
      for (const variant of active) {
        const target = copied.rows.find((row) => JSON.stringify(row.option_values) === JSON.stringify(variant.optionValues))!;
        await this.link(transaction, actor, variant.id, target.id, "1");
      }
      return targetId;
    });
    return { productId: newId };
  }
}

// Mặt hàng tương ứng ở công ty khác qua liên kết (QUYTAC_NGHIEPVU_41), đọc hai chiều; factor là số đơn vị cơ sở bên kia cho một đơn vị cơ sở bên này.
export async function linkedVariant(executor: Pick<Database, "execute">, variantId: string, targetCompanyId: string): Promise<{ variantId: string; baseUnitId: string; factor: number } | null> {
  const row = (
    await executor.execute<{ variant_id: string; base_unit_id: string; factor: string }>(sql`
    SELECT l.variant_id, p.base_unit_id, l.factor::text FROM (
      SELECT linked_variant_id AS variant_id, factor FROM catalog.variant_links WHERE variant_id = ${variantId} AND linked_company_id = ${targetCompanyId}
      UNION ALL
      SELECT variant_id, 1 / factor FROM catalog.variant_links WHERE linked_variant_id = ${variantId} AND company_id = ${targetCompanyId}
    ) l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
    WHERE v.status = 'active' LIMIT 1`)
  ).rows[0];
  return row ? { variantId: row.variant_id, baseUnitId: row.base_unit_id, factor: Number(row.factor) } : null;
}
