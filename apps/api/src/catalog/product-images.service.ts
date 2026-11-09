// Ảnh sản phẩm: JPG, PNG, WEBP, tối đa 5 MB, tối đa 10 ảnh, kiểm tra nội dung tệp (CONG_VIEC_04 mục 9; API_57; TIEUCHI_NGHIEMTHU_63).
import { Inject, Injectable, Logger } from "@nestjs/common";
import { productImageExtensions, productLimits, type ProductImageResponse } from "contracts";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, requireCompanyPermission } from "./catalog-context";

const imageTypes: Record<(typeof productImageExtensions)[number], { type: string; matches: (content: Buffer) => boolean }> = {
  jpg: { type: "image/jpeg", matches: (content) => content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff },
  jpeg: { type: "image/jpeg", matches: (content) => content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff },
  png: { type: "image/png", matches: (content) => content.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  webp: { type: "image/webp", matches: (content) => content.subarray(0, 4).toString("latin1") === "RIFF" && content.subarray(8, 12).toString("latin1") === "WEBP" },
};

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger("ProductImages");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async add(actor: Actor, productId: string, file: { buffer: Buffer; size: number; originalname: string } | undefined): Promise<ProductImageResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    await this.requireProduct(actor.companyId, productId);
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > productLimits.imageBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "imageTooLarge" } });
    const extension = file.originalname.split(".").pop()?.toLowerCase() as (typeof productImageExtensions)[number] | undefined;
    const kind = extension && (productImageExtensions as readonly string[]).includes(extension) ? imageTypes[extension] : null;
    if (!kind || !kind.matches(file.buffer)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "imageTypeInvalid" } });
    const fileName = Buffer.from(file.originalname, "latin1")
      .toString("utf8")
      .replace(/[\\/\r\n"]/g, "_")
      .slice(-200);
    const storageKey = `products/${actor.companyId}/${productId}/${randomUUID()}`;
    await this.storage.put(storageKey, file.buffer, kind.type);
    try {
      return await this.database.transaction(async (transaction) => {
        // Khóa dòng sản phẩm để các lần tải lên đồng thời không vượt 10 ảnh.
        await transaction.execute(sql`SELECT 1 FROM catalog.products WHERE id = ${productId} FOR UPDATE`);
        const count = (
          await transaction.execute<{ total: number; next: number }>(sql`
          SELECT count(*)::int AS total, coalesce(max(sort_order) + 1, 0)::int AS next FROM catalog.product_images WHERE product_id = ${productId}`)
        ).rows[0]!;
        if (count.total >= productLimits.images) throw new ApiError("BUSINESS_RULE", "imageTooMany");
        const row = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO catalog.product_images (product_id, file_name, content_type, size_bytes, storage_key, sort_order, uploaded_by)
          VALUES (${productId}, ${fileName}, ${kind.type}, ${file.size}, ${storageKey}, ${count.next}, ${actor.userId}) RETURNING id`)
        ).rows[0]!;
        await this.auditService.record({ ...catalogAudit(actor, "product"), action: "product.image.add", entityId: productId, afterData: { fileName, sizeBytes: file.size } }, transaction);
        return { id: row.id, fileName, contentType: kind.type, sizeBytes: file.size };
      });
    } catch (error) {
      await this.storage.remove(storageKey).catch(() => undefined);
      throw error;
    }
  }

  // Ảnh được chọn lên đầu làm ảnh đại diện.
  async makePrimary(actor: Actor, imageId: string): Promise<void> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    const image = await this.image(actor.companyId, imageId);
    await this.database.execute(sql`
      UPDATE catalog.product_images SET sort_order = CASE WHEN id = ${imageId} THEN 0 ELSE sort_order + 1 END WHERE product_id = ${image.product_id}`);
  }

  async remove(actor: Actor, imageId: string): Promise<void> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.manageProducts);
    const image = await this.image(actor.companyId, imageId);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM catalog.product_images WHERE id = ${imageId}`);
      await this.auditService.record({ ...catalogAudit(actor, "product"), action: "product.image.delete", entityId: image.product_id, beforeData: { fileName: image.file_name } }, transaction);
    });
    await this.storage.remove(image.storage_key).catch((error: unknown) => this.logger.error(`Không xóa được tệp ${image.storage_key}: ${(error as Error).message}`));
  }

  async download(actor: Actor, imageId: string): Promise<{ contentType: string; content: Buffer }> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewProducts);
    const image = await this.image(actor.companyId, imageId);
    return { contentType: image.content_type, content: await this.storage.get(image.storage_key) };
  }

  private async requireProduct(companyId: string, productId: string): Promise<void> {
    const found = await this.database.execute(sql`SELECT 1 FROM catalog.products WHERE id = ${productId} AND company_id = ${companyId} AND seller_id IS NULL`);
    if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  private async image(companyId: string, imageId: string) {
    const row = (
      await this.database.execute<{ product_id: string; file_name: string; content_type: string; storage_key: string }>(sql`
      SELECT i.product_id, i.file_name, i.content_type, i.storage_key FROM catalog.product_images i JOIN catalog.products p ON p.id = i.product_id
      WHERE i.id = ${imageId} AND p.company_id = ${companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }
}
