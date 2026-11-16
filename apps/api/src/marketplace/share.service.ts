// Sản phẩm công khai cho trang chia sẻ, tệp danh mục Facebook (CONG_VIEC_68; CHUC_NANG_240, 241; QUYTAC_NGHIEPVU_553, 554, 557).
// Chỉ đọc sản phẩm đang hiện trên cửa hàng VComm của công ty vận hành sàn; không cần người mua đăng nhập.
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.module";
import { visibleProduct, vietnamToday } from "./shop.service";
import { availableQuantities, loadStoreContext, pricedVariants } from "./store.service";

export interface PublicVariant {
  variantId: string;
  sku: string;
  optionValues: string[];
  grossPrice: string;
  available: string;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  brand: string | null;
  options: Array<{ name: string; values: string[] }>;
  imageIds: string[];
  variants: PublicVariant[];
}

export interface PublicCatalog {
  storeName: string;
  currency: string;
  products: PublicProduct[];
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ShareService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // productIds trống: mọi sản phẩm đang hiện. Sản phẩm không có giá kênh hôm nay bị bỏ như trên ứng dụng (QUYTAC_NGHIEPVU_155).
  async catalog(productIds?: string[]): Promise<PublicCatalog | null> {
    const context = await loadStoreContext(this.database);
    if (!context) return null;
    const ids = productIds?.filter((id) => uuidPattern.test(id));
    if (ids && ids.length === 0) return null;
    const store = (await this.database.execute<{ short_name: string }>(sql`SELECT short_name FROM core.companies WHERE id = ${context.companyId}`)).rows[0]!;
    const rows = await this.database.execute<{ id: string; name: string; description: string | null; brand: string | null; options: Array<{ name: string; values: string[] }> | null }>(sql`
      SELECT p.id, p.name, coalesce(nullif(l.description, ''), p.description) AS description, nullif(p.brand, '') AS brand, p.options
      FROM catalog.products p JOIN marketplace.listings l ON l.product_id = p.id
      WHERE ${visibleProduct(context)} ${
        ids
          ? sql`AND p.id IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`
          : sql``
      }
      ORDER BY p.name, p.id`);
    const priced = await pricedVariants(
      this.database,
      context,
      rows.rows.map((row) => row.id),
      await vietnamToday(this.database),
    );
    const sellable = rows.rows.filter((row) => (priced.get(row.id) ?? []).length > 0);
    if (sellable.length === 0) return { storeName: store.short_name, currency: context.currency, products: [] };
    const available = await availableQuantities(
      this.database,
      context.warehouseId,
      context.companyId,
      sellable.flatMap((row) => priced.get(row.id)!.map((variant) => variant.variantId)),
    );
    const images = await this.database.execute<{ id: string; product_id: string }>(sql`
      SELECT id, product_id FROM catalog.product_images WHERE product_id IN (${sql.join(
        sellable.map((row) => sql`${row.id}::uuid`),
        sql`, `,
      )}) ORDER BY product_id, sort_order, id`);
    const imagesOf = new Map<string, string[]>();
    for (const image of images.rows) imagesOf.set(image.product_id, [...(imagesOf.get(image.product_id) ?? []), image.id]);
    return {
      storeName: store.short_name,
      currency: context.currency,
      products: sellable.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        brand: row.brand,
        options: row.options ?? [],
        imageIds: imagesOf.get(row.id) ?? [],
        variants: priced.get(row.id)!.map((variant) => ({
          variantId: variant.variantId,
          sku: variant.sku,
          optionValues: variant.optionValues,
          grossPrice: variant.grossPrice,
          available: available.get(variant.variantId) ?? "0",
        })),
      })),
    };
  }

  async product(productId: string): Promise<{ storeName: string; currency: string; product: PublicProduct | null }> {
    const catalog = await this.catalog([productId]);
    if (!catalog) {
      const context = await loadStoreContext(this.database);
      const storeName = context ? (await this.database.execute<{ short_name: string }>(sql`SELECT short_name FROM core.companies WHERE id = ${context.companyId}`)).rows[0]!.short_name : "VComm";
      return { storeName, currency: context?.currency ?? "VND", product: null };
    }
    return { storeName: catalog.storeName, currency: catalog.currency, product: catalog.products[0] ?? null };
  }
}
