// Cài đặt bán hàng VComm, đăng bán, đơn vị vận chuyển, người mua thử (CONG_VIEC_24; CHUC_NANG_113; QUYTAC_NGHIEPVU_154, 155, 160; API_123).
import { Inject, Injectable } from "@nestjs/common";
import type { CarrierCode, CarrierItem, ListingBlocker, ListingItem, PageResponse, StoreSettingsResponse, updateListingSchema, updateStoreSettingsSchema, VatRate } from "contracts";
import { carrierCodes } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { lookupPrice } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { isReceivingWarehouse } from "../purchasing/purchasing-context";
import type { BuyerAdminActor } from "./buyer-admin.service";
import { carrierConfigured } from "./carriers/carrier-registry";

type Executor = Pick<Database, "execute">;

export interface StoreContext {
  companyId: string;
  channelId: string;
  warehouseId: string;
  currency: string;
  shippingFee: string;
  freeShippingThreshold: string | null;
  packageLengthCm: number;
  packageWidthCm: number;
  packageHeightCm: number;
  minimumWeightGrams: number;
}

type SettingsRow = {
  company_id: string;
  channel_id: string | null;
  warehouse_id: string | null;
  shipping_fee: string;
  free_shipping_threshold: string | null;
  package_length_cm: number;
  package_width_cm: number;
  package_height_cm: number;
  minimum_weight_grams: number;
  version: number;
};

export type PricedVariant = { variantId: string; sku: string; optionValues: Record<string, string>; unitId: string; price: string; includesVat: boolean; grossPrice: string };

export const carrierNames: Record<CarrierCode, string> = { ghn: "Giao Hàng Nhanh (GHN)" };
const vatFraction = (rate: VatRate) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) / 100 : 0);

// Giá gồm thuế giá trị gia tăng của một đơn vị cơ sở, cùng cách tính với dòng đơn bán không chiết khấu.
export const grossPrice = (price: string, includesVat: boolean, vatRate: VatRate): string =>
  trimDecimal(includesVat ? Number(price).toFixed(4) : (Number(price) * (1 + vatFraction(vatRate))).toFixed(4));

async function readSettings(executor: Executor, companyId: string): Promise<SettingsRow | null> {
  return (
    (
      await executor.execute<SettingsRow>(sql`
      SELECT company_id, channel_id, warehouse_id, shipping_fee::text, free_shipping_threshold::text, package_length_cm, package_width_cm, package_height_cm, minimum_weight_grams, version
      FROM marketplace.store_settings WHERE company_id = ${companyId}`)
    ).rows[0] ?? null
  );
}

// Công ty vận hành sàn có kênh bán và kho xuất hợp lệ; chưa đủ thì ứng dụng không hiện hàng (QUYTAC_NGHIEPVU_154).
export async function loadStoreContext(executor: Executor): Promise<StoreContext | null> {
  const row = (
    await executor.execute<SettingsRow & { currency: string }>(sql`
    SELECT s.company_id, s.channel_id, s.warehouse_id, s.shipping_fee::text, s.free_shipping_threshold::text, s.package_length_cm, s.package_width_cm, s.package_height_cm,
      s.minimum_weight_grams, s.version, c.base_currency AS currency
    FROM core.companies c JOIN marketplace.store_settings s ON s.company_id = c.id
    JOIN catalog.sales_channels ch ON ch.id = s.channel_id AND ch.company_id = c.id AND ch.status = 'active'
    JOIN inventory.warehouses w ON w.id = s.warehouse_id AND w.status = 'active'
    WHERE c.is_marketplace_operator AND c.status = 'active'`)
  ).rows[0];
  if (!row?.channel_id || !row.warehouse_id) return null;
  return {
    companyId: row.company_id,
    channelId: row.channel_id,
    warehouseId: row.warehouse_id,
    currency: row.currency,
    shippingFee: row.shipping_fee,
    freeShippingThreshold: row.free_shipping_threshold,
    packageLengthCm: row.package_length_cm,
    packageWidthCm: row.package_width_cm,
    packageHeightCm: row.package_height_cm,
    minimumWeightGrams: row.minimum_weight_grams,
  };
}

// Số có thể bán tại kho xuất (tồn trừ giữ hàng đang hiệu lực), chỉ đọc.
export async function availableQuantities(executor: Executor, warehouseId: string, companyId: string, variantIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (variantIds.length === 0) return result;
  const rows = await executor.execute<{ variant_id: string; available: string }>(sql`
    SELECT v.id AS variant_id, (coalesce((SELECT quantity FROM inventory.costs c WHERE c.warehouse_id = ${warehouseId} AND c.company_id = ${companyId} AND c.variant_id = v.id), 0)
      - coalesce((SELECT sum(quantity) FROM inventory.reservations r WHERE r.warehouse_id = ${warehouseId} AND r.company_id = ${companyId} AND r.variant_id = v.id AND r.status = 'active'), 0))::text AS available
    FROM catalog.variants v WHERE v.id IN (${sql.join(
      variantIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`);
  for (const row of rows.rows) result.set(row.variant_id, trimDecimal(Number(row.available) > 0 ? row.available : "0"));
  return result;
}

// Biến thể đang hoạt động có giá đơn vị cơ sở trên kênh VComm hôm nay (QUYTAC_NGHIEPVU_155).
export async function pricedVariants(executor: Executor, context: StoreContext, productIds: string[], date: string): Promise<Map<string, PricedVariant[]>> {
  const result = new Map<string, PricedVariant[]>();
  if (productIds.length === 0) return result;
  const variants = await executor.execute<{ id: string; product_id: string; sku: string; option_values: Record<string, string> | null; base_unit_id: string; vat_rate: VatRate }>(sql`
    SELECT v.id, v.product_id, v.sku, v.option_values, p.base_unit_id, p.vat_rate FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
    WHERE v.status = 'active' AND v.company_id = ${context.companyId} AND v.product_id IN (${sql.join(
      productIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )}) ORDER BY v.sku`);
  for (const variant of variants.rows) {
    const found = await lookupPrice(executor, context.companyId, { variantId: variant.id, unitId: variant.base_unit_id, channelId: context.channelId, currency: context.currency }, date);
    if (!found || found === "variantNotFound") continue;
    const list = result.get(variant.product_id) ?? [];
    list.push({
      variantId: variant.id,
      sku: variant.sku,
      optionValues: variant.option_values ?? {},
      unitId: variant.base_unit_id,
      price: found.price,
      includesVat: found.includesVat,
      grossPrice: grossPrice(found.price, found.includesVat, variant.vat_rate),
    });
    result.set(variant.product_id, list);
  }
  return result;
}

const imagePath = (imageId: string | null, companyId: string) => (imageId ? `/api/v1/catalog/product-images/${imageId}?companyId=${companyId}` : null);

@Injectable()
export class StoreService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private async carriers(): Promise<CarrierItem[]> {
    const rows = await this.database.execute<{ code: CarrierCode; is_enabled: boolean }>(sql`SELECT code, is_enabled FROM marketplace.carriers ORDER BY code`);
    return rows.rows.map((row) => ({ code: row.code, name: carrierNames[row.code], isEnabled: row.is_enabled, isConfigured: carrierConfigured(row.code) }));
  }

  async settings(actor: BuyerAdminActor, canManage: boolean): Promise<StoreSettingsResponse> {
    const row = await readSettings(this.database, actor.operatorCompanyId);
    const company = (await this.database.execute<{ short_name: string }>(sql`SELECT short_name FROM core.companies WHERE id = ${actor.operatorCompanyId}`)).rows[0]!;
    const channels = await this.database.execute<{ id: string; name: string }>(
      sql`SELECT id, name FROM catalog.sales_channels WHERE company_id = ${actor.operatorCompanyId} AND status = 'active' ORDER BY name`,
    );
    const warehouses = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT w.id, w.name FROM inventory.warehouses w
      WHERE w.status = 'active' AND EXISTS (SELECT 1 FROM inventory.warehouse_owners o WHERE o.warehouse_id = w.id AND o.company_id = ${actor.operatorCompanyId}) ORDER BY w.name`);
    return {
      companyName: company.short_name,
      channelId: row?.channel_id ?? null,
      warehouseId: row?.warehouse_id ?? null,
      shippingFee: trimDecimal(row?.shipping_fee ?? "0"),
      freeShippingThreshold: row?.free_shipping_threshold ? trimDecimal(row.free_shipping_threshold) : null,
      packageLengthCm: row?.package_length_cm ?? 20,
      packageWidthCm: row?.package_width_cm ?? 15,
      packageHeightCm: row?.package_height_cm ?? 10,
      minimumWeightGrams: row?.minimum_weight_grams ?? 200,
      version: row?.version ?? 0,
      canManage,
      channels: channels.rows,
      warehouses: warehouses.rows,
      carriers: await this.carriers(),
    };
  }

  async updateSettings(actor: BuyerAdminActor, input: z.output<typeof updateStoreSettingsSchema>): Promise<StoreSettingsResponse> {
    await this.database.transaction(async (transaction) => {
      const fields: Record<string, "invalidValue"> = {};
      const channel = await transaction.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE id = ${input.channelId} AND company_id = ${actor.operatorCompanyId} AND status = 'active'`);
      if (channel.rows.length === 0) fields.channelId = "invalidValue";
      if (!(await isReceivingWarehouse(transaction, actor.operatorCompanyId, input.warehouseId))) fields.warehouseId = "invalidValue";
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const before = await readSettings(transaction, actor.operatorCompanyId);
      const values = sql`${input.channelId}, ${input.warehouseId}, ${input.shippingFee}::numeric, ${input.freeShippingThreshold}::numeric, ${input.packageLengthCm}, ${input.packageWidthCm},
        ${input.packageHeightCm}, ${input.minimumWeightGrams}, ${actor.userId}`;
      const saved = before
        ? await transaction.execute(sql`
          UPDATE marketplace.store_settings SET (channel_id, warehouse_id, shipping_fee, free_shipping_threshold, package_length_cm, package_width_cm, package_height_cm, minimum_weight_grams, updated_by)
            = (${values}), updated_at = now(), version = version + 1
          WHERE company_id = ${actor.operatorCompanyId} AND version = ${input.version} RETURNING version`)
        : await transaction.execute(sql`
          INSERT INTO marketplace.store_settings (company_id, channel_id, warehouse_id, shipping_fee, free_shipping_threshold, package_length_cm, package_width_cm, package_height_cm,
            minimum_weight_grams, updated_by)
          SELECT ${actor.operatorCompanyId}, ${values} WHERE ${input.version} = 0 ON CONFLICT DO NOTHING RETURNING version`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.record(transaction, actor, "marketplace.store_settings.update", "marketplace.store_settings", actor.operatorCompanyId, before, input);
    });
    return this.settings(actor, true);
  }

  async setCarrier(actor: BuyerAdminActor, code: string, isEnabled: boolean): Promise<StoreSettingsResponse> {
    if (!(carrierCodes as readonly string[]).includes(code)) throw new ApiError("NOT_FOUND", "notFound");
    // Chưa có thông tin kết nối thì không bật được (QUYTAC_NGHIEPVU_160).
    if (isEnabled && !carrierConfigured(code as CarrierCode)) throw new ApiError("BUSINESS_RULE", "carrierNotConfigured");
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE marketplace.carriers SET is_enabled = ${isEnabled}, updated_by = ${actor.userId}, updated_at = now() WHERE code = ${code}`);
      await this.record(transaction, actor, "marketplace.carrier.update", "marketplace.carriers", null, null, { code, isEnabled });
    });
    return this.settings(actor, true);
  }

  // Sản phẩm của công ty vận hành sàn kèm lý do chưa hiện trên ứng dụng (QUYTAC_NGHIEPVU_155).
  async listings(actor: BuyerAdminActor, query: { search?: string | undefined; published: "all" | "published" | "unpublished"; page: number; pageSize: number }): Promise<PageResponse<ListingItem>> {
    const companyId = actor.operatorCompanyId;
    const search = query.search?.trim() ? `%${searchText(query.search)}%` : null;
    const where = sql`p.company_id = ${companyId} AND p.seller_id IS NULL
      AND (${search}::text IS NULL OR p.search_text LIKE ${search}::text OR lower(p.code) LIKE ${search}::text)
      AND (${query.published}::text = 'all' OR (${query.published}::text = 'published') = coalesce(l.is_published, false))`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM catalog.products p LEFT JOIN marketplace.listings l ON l.product_id = p.id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<{
      id: string;
      name: string;
      category_name: string;
      review_status: string;
      status: string;
      tracks: boolean;
      is_published: boolean | null;
      description: string | null;
      image_id: string | null;
    }>(sql`
      SELECT p.id, p.name, c.name_vi AS category_name, p.review_status, p.status, (p.tracks_lots OR p.tracks_serials OR c.tracks_lots OR c.tracks_serials) AS tracks,
        l.is_published, l.description,
        (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_id
      FROM catalog.products p JOIN catalog.categories c ON c.id = p.category_id LEFT JOIN marketplace.listings l ON l.product_id = p.id
      WHERE ${where} ORDER BY p.name, p.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const context = await loadStoreContext(this.database);
    const today = (await this.database.execute<{ today: string }>(sql`SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today`)).rows[0]!.today;
    const priced = context
      ? await pricedVariants(
          this.database,
          context,
          rows.rows.map((row) => row.id),
          today,
        )
      : new Map<string, PricedVariant[]>();
    const variantIds = [...priced.values()].flat().map((variant) => variant.variantId);
    const available = context ? await availableQuantities(this.database, context.warehouseId, companyId, variantIds) : new Map<string, string>();
    return {
      data: rows.rows.map((row) => {
        const variants = priced.get(row.id) ?? [];
        const blockers: ListingBlocker[] = [];
        if (!context) blockers.push("storeNotReady");
        if (row.review_status !== "approved") blockers.push("notApproved");
        if (row.status !== "active") blockers.push("inactive");
        if (row.tracks) blockers.push("lotOrSerial");
        if (context && variants.length === 0) blockers.push("noPrice");
        const prices = variants.map((variant) => Number(variant.grossPrice));
        return {
          productId: row.id,
          name: row.name,
          categoryName: row.category_name,
          imageUrl: imagePath(row.image_id, companyId),
          isPublished: row.is_published ?? false,
          description: row.description,
          priceFrom: prices.length > 0 ? trimDecimal(Math.min(...prices).toFixed(4)) : null,
          available: trimDecimal(variants.reduce((sum, variant) => sum + Number(available.get(variant.variantId) ?? 0), 0).toFixed(4)),
          blockers,
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async updateListing(actor: BuyerAdminActor, productId: string, input: z.output<typeof updateListingSchema>): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const product = await transaction.execute(sql`SELECT 1 FROM catalog.products WHERE id = ${productId} AND company_id = ${actor.operatorCompanyId} AND seller_id IS NULL`);
      if (product.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      const before = (await transaction.execute(sql`SELECT is_published, description FROM marketplace.listings WHERE product_id = ${productId}`)).rows[0] ?? null;
      await transaction.execute(sql`
        INSERT INTO marketplace.listings (product_id, company_id, is_published, description, updated_by) VALUES (${productId}, ${actor.operatorCompanyId}, ${input.isPublished}, ${input.description || null}, ${actor.userId})
        ON CONFLICT (product_id) DO UPDATE SET is_published = excluded.is_published, description = excluded.description, updated_by = excluded.updated_by, updated_at = now()`);
      await this.record(transaction, actor, "marketplace.listing.update", "catalog.products", productId, before, input);
    });
  }

  // Người mua thử đặt được hàng khi chưa mở đặt hàng (QUYTAC_NGHIEPVU_158).
  async setTestBuyer(actor: BuyerAdminActor, buyerUserId: string, isTestBuyer: boolean): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`UPDATE marketplace.buyer_accounts SET is_test_buyer = ${isTestBuyer} WHERE user_id = ${buyerUserId} RETURNING user_id`);
      if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await this.record(transaction, actor, "marketplace.test_buyer.update", "marketplace.buyer_accounts", buyerUserId, null, { isTestBuyer });
    });
  }

  private record(transaction: Pick<Database, "execute" | "insert">, actor: BuyerAdminActor, action: string, entityType: string, entityId: string | null, beforeData: unknown, afterData: unknown) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action,
        entityType,
        entityId,
        beforeData,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      transaction,
    );
  }
}
