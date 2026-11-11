// Cửa hàng, giỏ hàng, sổ địa chỉ của người mua trên ứng dụng VComm (CONG_VIEC_24; CHUC_NANG_114, 115; QUYTAC_NGHIEPVU_155 đến 157; API_124, API_125).
import { Inject, Injectable } from "@nestjs/common";
import type { buyerAddressSchema, BuyerAddressItem, CartResponse, PageResponse, RegionItem, ShopProductDetail, ShopProductItem } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { searchText } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { DATABASE, type Database } from "../database/database.module";
import { localPhone } from "./buyer-accounts.service";
import { availableQuantities, loadStoreContext, type PricedVariant, pricedVariants, type StoreContext } from "./store.service";

type Executor = Pick<Database, "execute">;
const maximumAddresses = 10;
const maximumCartLines = 50;

export const shopImagePath = (imageId: string | null) => (imageId ? `/api/v1/buyer/shop/images/${imageId}` : null);
export const vietnamToday = async (executor: Executor) => (await executor.execute<{ today: string }>(sql`SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today`)).rows[0]!.today;

// Điều kiện sản phẩm được hiện trên ứng dụng, trừ điều kiện có giá (QUYTAC_NGHIEPVU_155).
// Sàn VComm chỉ bán hàng hóa; sản phẩm dịch vụ không hiện, không đặt được kể cả khi đổi loại sau khi đăng (CONG_VIEC_43, lát L4).
export const visibleProduct = (context: StoreContext) => sql`
  p.company_id = ${context.companyId} AND p.seller_id IS NULL AND p.review_status = 'approved' AND p.status = 'active' AND p.kind = 'goods'
  AND NOT (p.tracks_lots OR p.tracks_serials)
  AND NOT EXISTS (SELECT 1 FROM catalog.categories c WHERE c.id = p.category_id AND (c.tracks_lots OR c.tracks_serials))
  AND EXISTS (SELECT 1 FROM marketplace.listings l WHERE l.product_id = p.id AND l.is_published)`;

// Tài khoản người mua của người đang đăng nhập; tạo khi người dùng đăng nhập ứng dụng lần đầu (như CONG_VIEC_23).
export async function buyerAccount(executor: Executor, userId: string): Promise<{ isTestBuyer: boolean }> {
  await executor.execute(sql`INSERT INTO marketplace.buyer_accounts (user_id) VALUES (${userId}) ON CONFLICT (user_id) DO NOTHING`);
  const row = (
    await executor.execute<{ is_test_buyer: boolean; status: string }>(sql`
    SELECT b.is_test_buyer, u.status FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id WHERE b.user_id = ${userId}`)
  ).rows[0]!;
  if (row.status !== "active") throw new ApiError("FORBIDDEN", "forbidden");
  return { isTestBuyer: row.is_test_buyer };
}

// Biến thể đang bán được: sản phẩm hiện trên ứng dụng và biến thể có giá hôm nay.
export async function sellableVariants(executor: Executor, context: StoreContext, variantIds: string[]): Promise<Map<string, PricedVariant & { productId: string }>> {
  const result = new Map<string, PricedVariant & { productId: string }>();
  if (variantIds.length === 0) return result;
  const products = await executor.execute<{ id: string }>(sql`
    SELECT DISTINCT p.id FROM catalog.products p JOIN catalog.variants v ON v.product_id = p.id
    WHERE v.id IN (${sql.join(
      variantIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )}) AND ${visibleProduct(context)}`);
  const priced = await pricedVariants(
    executor,
    context,
    products.rows.map((row) => row.id),
    await vietnamToday(executor),
  );
  for (const [productId, variants] of priced) for (const variant of variants) if (variantIds.includes(variant.variantId)) result.set(variant.variantId, { ...variant, productId });
  return result;
}

const variantLabel = (values: string[] | null) => (values ?? []).filter(Boolean).join(" · ");

@Injectable()
export class ShopService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  private async context(): Promise<StoreContext | null> {
    return loadStoreContext(this.database);
  }

  async products(userId: string, query: { search?: string | undefined; page: number; pageSize: number }): Promise<PageResponse<ShopProductItem>> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    if (!context) return { data: [], page: query.page, pageSize: query.pageSize, total: 0 };
    const search = query.search?.trim() ? `%${searchText(query.search)}%` : null;
    const rows = await this.database.execute<{ id: string; name: string; image_id: string | null }>(sql`
      SELECT p.id, p.name, (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_id
      FROM catalog.products p WHERE ${visibleProduct(context)} AND (${search}::text IS NULL OR p.search_text LIKE ${search}::text) ORDER BY p.name, p.id`);
    const priced = await pricedVariants(
      this.database,
      context,
      rows.rows.map((row) => row.id),
      await vietnamToday(this.database),
    );
    const sellable = rows.rows.filter((row) => (priced.get(row.id) ?? []).length > 0);
    const page = sellable.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    const available = await availableQuantities(
      this.database,
      context.warehouseId,
      context.companyId,
      page.flatMap((row) => priced.get(row.id)!.map((variant) => variant.variantId)),
    );
    return {
      data: page.map((row) => {
        const variants = priced.get(row.id)!;
        return {
          id: row.id,
          name: row.name,
          imageUrl: shopImagePath(row.image_id),
          priceFrom: variants.map((variant) => variant.grossPrice).reduce((low, price) => (Number(price) < Number(low) ? price : low)),
          inStock: variants.some((variant) => Number(available.get(variant.variantId) ?? 0) > 0),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total: sellable.length,
    };
  }

  async product(userId: string, productId: string): Promise<ShopProductDetail> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    if (!context) throw new ApiError("NOT_FOUND", "notFound");
    const row = (
      await this.database.execute<{ id: string; name: string; description: string | null; options: Array<{ name: string; values: string[] }>; unit_name: string }>(sql`
      SELECT p.id, p.name, coalesce(l.description, p.description) AS description, p.options, u.name_vi AS unit_name
      FROM catalog.products p JOIN marketplace.listings l ON l.product_id = p.id JOIN catalog.units u ON u.id = p.base_unit_id
      WHERE p.id = ${productId} AND ${visibleProduct(context)}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const variants = (await pricedVariants(this.database, context, [productId], await vietnamToday(this.database))).get(productId) ?? [];
    if (variants.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    const available = await availableQuantities(
      this.database,
      context.warehouseId,
      context.companyId,
      variants.map((variant) => variant.variantId),
    );
    const images = await this.database.execute<{ id: string }>(sql`SELECT id FROM catalog.product_images WHERE product_id = ${productId} ORDER BY sort_order`);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      unitName: row.unit_name,
      images: images.rows.map((image) => shopImagePath(image.id)!),
      options: row.options ?? [],
      variants: variants.map((variant) => ({
        id: variant.variantId,
        sku: variant.sku,
        optionValues: variant.optionValues,
        price: variant.grossPrice,
        available: available.get(variant.variantId) ?? "0",
      })),
      currency: context.currency,
    };
  }

  // Ảnh của sản phẩm đang hiện trên ứng dụng; không cần đăng nhập (thông tin công khai của cửa hàng).
  async image(imageId: string): Promise<{ contentType: string; content: Buffer }> {
    const context = await this.context();
    if (!context) throw new ApiError("NOT_FOUND", "notFound");
    const row = (
      await this.database.execute<{ content_type: string; storage_key: string }>(sql`
      SELECT i.content_type, i.storage_key FROM catalog.product_images i JOIN catalog.products p ON p.id = i.product_id WHERE i.id = ${imageId} AND ${visibleProduct(context)}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return { contentType: row.content_type, content: await this.storage.get(row.storage_key) };
  }

  async cart(userId: string): Promise<CartResponse> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    const lines = await this.database.execute<{ variant_id: string; quantity: number; product_id: string; product_name: string; option_values: string[] | null; image_id: string | null }>(sql`
      SELECT c.variant_id, c.quantity, p.id AS product_id, p.name AS product_name, v.option_values,
        (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_id
      FROM marketplace.cart_lines c JOIN catalog.variants v ON v.id = c.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE c.buyer_user_id = ${userId} ORDER BY c.added_at, c.variant_id`);
    const variantIds = lines.rows.map((line) => line.variant_id);
    const sellable = context ? await sellableVariants(this.database, context, variantIds) : new Map<string, PricedVariant & { productId: string }>();
    const available = context ? await availableQuantities(this.database, context.warehouseId, context.companyId, variantIds) : new Map<string, string>();
    return {
      lines: lines.rows.map((line) => ({
        variantId: line.variant_id,
        productId: line.product_id,
        productName: line.product_name,
        variantLabel: variantLabel(line.option_values),
        imageUrl: sellable.has(line.variant_id) ? shopImagePath(line.image_id) : null,
        quantity: line.quantity,
        price: sellable.get(line.variant_id)?.grossPrice ?? null,
        available: sellable.has(line.variant_id) ? (available.get(line.variant_id) ?? "0") : "0",
      })),
      currency: context?.currency ?? "VND",
    };
  }

  // Thêm hoặc đặt số lượng một dòng giỏ; chỉ thêm được biến thể đang bán (QUYTAC_NGHIEPVU_157).
  async setCartLine(userId: string, variantId: string, quantity: number): Promise<CartResponse> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      const existing = await transaction.execute(sql`SELECT 1 FROM marketplace.cart_lines WHERE buyer_user_id = ${userId} AND variant_id = ${variantId}`);
      if (existing.rows.length === 0) {
        if (!context || !(await sellableVariants(transaction, context, [variantId])).has(variantId)) throw new ApiError("BUSINESS_RULE", "productNotSellable");
        const count = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM marketplace.cart_lines WHERE buyer_user_id = ${userId}`)).rows[0]!.count;
        if (count >= maximumCartLines) throw new ApiError("BUSINESS_RULE", "cartFull");
      }
      await transaction.execute(sql`
        INSERT INTO marketplace.cart_lines (buyer_user_id, variant_id, quantity) VALUES (${userId}, ${variantId}, ${quantity})
        ON CONFLICT (buyer_user_id, variant_id) DO UPDATE SET quantity = excluded.quantity`);
    });
    return this.cart(userId);
  }

  async removeCartLine(userId: string, variantId: string): Promise<CartResponse> {
    await this.database.execute(sql`DELETE FROM marketplace.cart_lines WHERE buyer_user_id = ${userId} AND variant_id = ${variantId}`);
    return this.cart(userId);
  }

  async provinces(): Promise<RegionItem[]> {
    return (await this.database.execute<{ code: string; name: string }>(sql`SELECT code, full_name AS name FROM marketplace.provinces ORDER BY name`)).rows;
  }

  async wards(provinceCode: string): Promise<RegionItem[]> {
    return (await this.database.execute<{ code: string; name: string }>(sql`SELECT code, full_name AS name FROM marketplace.wards WHERE province_code = ${provinceCode} ORDER BY name`)).rows;
  }

  async addresses(userId: string): Promise<BuyerAddressItem[]> {
    const rows = await this.database.execute<{
      id: string;
      recipient_name: string;
      phone: string;
      province_code: string;
      province_name: string;
      ward_code: string;
      ward_name: string;
      street_address: string;
      is_default: boolean;
    }>(sql`
      SELECT a.id, a.recipient_name, a.phone, a.province_code, p.full_name AS province_name, a.ward_code, w.full_name AS ward_name, a.street_address, a.is_default
      FROM marketplace.buyer_addresses a JOIN marketplace.provinces p ON p.code = a.province_code JOIN marketplace.wards w ON w.code = a.ward_code
      WHERE a.buyer_user_id = ${userId} ORDER BY a.is_default DESC, a.created_at, a.id`);
    return rows.rows.map((row) => ({
      id: row.id,
      recipientName: row.recipient_name,
      phone: localPhone(row.phone),
      provinceCode: row.province_code,
      provinceName: row.province_name,
      wardCode: row.ward_code,
      wardName: row.ward_name,
      streetAddress: row.street_address,
      isDefault: row.is_default,
    }));
  }

  // Thêm hoặc sửa địa chỉ: xã phải thuộc tỉnh; tối đa 10 địa chỉ; địa chỉ đầu tiên là mặc định (QUYTAC_NGHIEPVU_156).
  async saveAddress(userId: string, addressId: string | null, input: z.output<typeof buyerAddressSchema>): Promise<BuyerAddressItem[]> {
    await buyerAccount(this.database, userId);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      const ward = await transaction.execute(sql`SELECT 1 FROM marketplace.wards WHERE code = ${input.wardCode} AND province_code = ${input.provinceCode}`);
      if (ward.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { wardCode: "invalidValue" } });
      const count = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM marketplace.buyer_addresses WHERE buyer_user_id = ${userId}`)).rows[0]!.count;
      const makeDefault = input.isDefault || count === 0;
      if (makeDefault) await transaction.execute(sql`UPDATE marketplace.buyer_addresses SET is_default = false WHERE buyer_user_id = ${userId} AND is_default`);
      if (addressId) {
        const updated = await transaction.execute(sql`
          UPDATE marketplace.buyer_addresses SET recipient_name = ${input.recipientName}, phone = ${input.phone}, province_code = ${input.provinceCode}, ward_code = ${input.wardCode},
            street_address = ${input.streetAddress}, is_default = is_default OR ${makeDefault}, updated_at = now()
          WHERE id = ${addressId} AND buyer_user_id = ${userId} RETURNING id`);
        if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
        await this.keepDefault(transaction, userId);
        return;
      }
      if (count >= maximumAddresses) throw new ApiError("BUSINESS_RULE", "addressBookFull");
      await transaction.execute(sql`
        INSERT INTO marketplace.buyer_addresses (buyer_user_id, recipient_name, phone, province_code, ward_code, street_address, is_default)
        VALUES (${userId}, ${input.recipientName}, ${input.phone}, ${input.provinceCode}, ${input.wardCode}, ${input.streetAddress}, ${makeDefault})`);
    });
    return this.addresses(userId);
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<BuyerAddressItem[]> {
    await this.database.transaction(async (transaction) => {
      const found = await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_addresses WHERE id = ${addressId} AND buyer_user_id = ${userId} FOR UPDATE`);
      if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await transaction.execute(sql`UPDATE marketplace.buyer_addresses SET is_default = false WHERE buyer_user_id = ${userId} AND is_default`);
      await transaction.execute(sql`UPDATE marketplace.buyer_addresses SET is_default = true WHERE id = ${addressId}`);
    });
    return this.addresses(userId);
  }

  // Xóa địa chỉ mặc định thì địa chỉ cũ nhất còn lại thành mặc định.
  async removeAddress(userId: string, addressId: string): Promise<BuyerAddressItem[]> {
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute(sql`DELETE FROM marketplace.buyer_addresses WHERE id = ${addressId} AND buyer_user_id = ${userId} RETURNING id`);
      if (removed.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await this.keepDefault(transaction, userId);
    });
    return this.addresses(userId);
  }

  private async keepDefault(executor: Executor, userId: string): Promise<void> {
    await executor.execute(sql`
      UPDATE marketplace.buyer_addresses SET is_default = true
      WHERE id = (SELECT id FROM marketplace.buyer_addresses WHERE buyer_user_id = ${userId} ORDER BY created_at, id LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM marketplace.buyer_addresses WHERE buyer_user_id = ${userId} AND is_default)`);
  }
}
