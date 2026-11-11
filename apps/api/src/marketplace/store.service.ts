// Cài đặt bán hàng VComm, đăng bán, đơn vị vận chuyển, người mua thử (CONG_VIEC_24; CHUC_NANG_113; QUYTAC_NGHIEPVU_154, 155, 160; API_123).
// Phương thức thanh toán, mở đặt hàng (CONG_VIEC_25; CHUC_NANG_120; QUYTAC_NGHIEPVU_163, 164; API_130).
// Thiết lập hoa hồng từng sản phẩm, cài đặt hoa hồng chung (CONG_VIEC_26; CHUC_NANG_134; QUYTAC_NGHIEPVU_200, 204, 205; API_134).
import { Inject, Injectable } from "@nestjs/common";
import type {
  CarrierCode,
  CarrierItem,
  CommissionCalculation,
  CommissionSettings,
  commissionSettingsSchema,
  ListingBlocker,
  ListingItem,
  PageResponse,
  PaymentGatewayCode,
  PaymentMethodCode,
  PaymentMethodItem,
  ProductCommission,
  productCommissionSchema,
  StoreSettingsResponse,
  updateListingSchema,
  updateStoreSettingsSchema,
  VatRate,
} from "contracts";
import { carrierCodes, paymentMethodCodes } from "contracts";
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
import { gatewayConfigured } from "./payments/payment-gateway-registry";

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
  orderingOpen: boolean;
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
  ordering_open: boolean;
  version: number;
};

export type PricedVariant = { variantId: string; sku: string; optionValues: string[]; unitId: string; price: string; includesVat: boolean; grossPrice: string };

export const carrierNames: Record<CarrierCode, string> = { ghn: "Giao Hàng Nhanh (GHN)" };
const vatFraction = (rate: VatRate) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) / 100 : 0);

// Giá gồm thuế giá trị gia tăng của một đơn vị cơ sở, cùng cách tính với dòng đơn bán không chiết khấu.
export const grossPrice = (price: string, includesVat: boolean, vatRate: VatRate): string =>
  trimDecimal(includesVat ? Number(price).toFixed(4) : (Number(price) * (1 + vatFraction(vatRate))).toFixed(4));

async function readSettings(executor: Executor, companyId: string): Promise<SettingsRow | null> {
  return (
    (
      await executor.execute<SettingsRow>(sql`
      SELECT company_id, channel_id, warehouse_id, shipping_fee::text, free_shipping_threshold::text, package_length_cm, package_width_cm, package_height_cm, minimum_weight_grams, ordering_open, version
      FROM marketplace.store_settings WHERE company_id = ${companyId}`)
    ).rows[0] ?? null
  );
}

// Công ty vận hành sàn có kênh bán và kho xuất hợp lệ; chưa đủ thì ứng dụng không hiện hàng (QUYTAC_NGHIEPVU_154).
export async function loadStoreContext(executor: Executor): Promise<StoreContext | null> {
  const row = (
    await executor.execute<SettingsRow & { currency: string }>(sql`
    SELECT s.company_id, s.channel_id, s.warehouse_id, s.shipping_fee::text, s.free_shipping_threshold::text, s.package_length_cm, s.package_width_cm, s.package_height_cm,
      s.minimum_weight_grams, s.ordering_open, s.version, c.base_currency AS currency
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
    orderingOpen: row.ordering_open,
  };
}

// Cài đặt hoa hồng chung; chưa lưu thì dùng mặc định (thuế 10% trên 5.000.000 đồng, rút tối thiểu 100.000 đồng).
export async function commissionSettings(executor: Executor, companyId: string): Promise<CommissionSettings> {
  const row = (
    await executor.execute<{ tax_threshold: string; tax_rate: string; minimum_withdrawal: string; version: number }>(sql`
    SELECT tax_threshold::text, tax_rate::text, minimum_withdrawal::text, version FROM marketplace.commission_settings WHERE company_id = ${companyId}`)
  ).rows[0];
  return {
    taxThreshold: trimDecimal(row?.tax_threshold ?? "5000000"),
    taxRate: trimDecimal(row?.tax_rate ?? "10"),
    minimumWithdrawal: trimDecimal(row?.minimum_withdrawal ?? "100000"),
    version: row?.version ?? 0,
  };
}

// Phương thức đang bật mà cổng có thông tin kết nối, theo thứ tự hiển thị (QUYTAC_NGHIEPVU_163).
export async function enabledPaymentMethods(executor: Executor): Promise<PaymentMethodCode[]> {
  const rows = await executor.execute<{ code: PaymentMethodCode; gateway_code: PaymentGatewayCode }>(
    sql`SELECT code, gateway_code FROM marketplace.payment_methods WHERE is_enabled ORDER BY sort_order`,
  );
  return rows.rows.filter((row) => gatewayConfigured(row.gateway_code)).map((row) => row.code);
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
  const variants = await executor.execute<{ id: string; product_id: string; sku: string; option_values: string[] | null; base_unit_id: string; vat_rate: VatRate }>(sql`
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
      optionValues: variant.option_values ?? [],
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

  private async paymentMethods(): Promise<PaymentMethodItem[]> {
    const rows = await this.database.execute<{ code: PaymentMethodCode; gateway_code: PaymentGatewayCode; is_enabled: boolean }>(
      sql`SELECT code, gateway_code, is_enabled FROM marketplace.payment_methods ORDER BY sort_order`,
    );
    return rows.rows.map((row) => ({ code: row.code, gatewayCode: row.gateway_code, isEnabled: row.is_enabled, isConfigured: gatewayConfigured(row.gateway_code) }));
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
      orderingOpen: row?.ordering_open ?? false,
      paymentMethods: await this.paymentMethods(),
      commissionSettings: await commissionSettings(this.database, actor.operatorCompanyId),
    };
  }

  async updateSettings(actor: BuyerAdminActor, input: z.output<typeof updateStoreSettingsSchema>): Promise<StoreSettingsResponse> {
    await this.database.transaction(async (transaction) => {
      const fields: Record<string, "invalidValue" | "warehouseUsesLocations"> = {};
      const channel = await transaction.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE id = ${input.channelId} AND company_id = ${actor.operatorCompanyId} AND status = 'active'`);
      if (channel.rows.length === 0) fields.channelId = "invalidValue";
      if (!(await isReceivingWarehouse(transaction, actor.operatorCompanyId, input.warehouseId))) fields.warehouseId = "invalidValue";
      // Giao qua đơn vị vận chuyển lập phiếu xuất tự động nên kho xuất không quản lý vị trí.
      else if ((await transaction.execute<{ uses_locations: boolean }>(sql`SELECT uses_locations FROM inventory.warehouses WHERE id = ${input.warehouseId}`)).rows[0]?.uses_locations)
        fields.warehouseId = "warehouseUsesLocations";
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

  // Bật tắt phương thức (QUYTAC_NGHIEPVU_163): cổng chưa có thông tin kết nối thì không bật được; đang mở đặt hàng thì không tắt phương thức cuối cùng.
  async setPaymentMethod(actor: BuyerAdminActor, code: string, isEnabled: boolean): Promise<StoreSettingsResponse> {
    if (!(paymentMethodCodes as readonly string[]).includes(code)) throw new ApiError("NOT_FOUND", "notFound");
    await this.database.transaction(async (transaction) => {
      // Khóa cài đặt: bật tắt phương thức và mở đặt hàng không chạy đồng thời.
      const settings = (await transaction.execute<{ ordering_open: boolean }>(sql`SELECT ordering_open FROM marketplace.store_settings WHERE company_id = ${actor.operatorCompanyId} FOR UPDATE`))
        .rows[0];
      const method = (
        await transaction.execute<{ gateway_code: PaymentGatewayCode; is_enabled: boolean }>(sql`SELECT gateway_code, is_enabled FROM marketplace.payment_methods WHERE code = ${code} FOR UPDATE`)
      ).rows[0]!;
      if (isEnabled && !gatewayConfigured(method.gateway_code)) throw new ApiError("BUSINESS_RULE", "paymentGatewayNotConfigured");
      await transaction.execute(sql`UPDATE marketplace.payment_methods SET is_enabled = ${isEnabled}, updated_by = ${actor.userId}, updated_at = now() WHERE code = ${code}`);
      if (!isEnabled && settings?.ordering_open && (await enabledPaymentMethods(transaction)).length === 0) throw new ApiError("BUSINESS_RULE", "paymentMethodRequired");
      await this.record(transaction, actor, "marketplace.payment_method.update", "marketplace.payment_methods", null, { code, isEnabled: method.is_enabled }, { code, isEnabled });
    });
    return this.settings(actor, true);
  }

  // Mở đặt hàng cho mọi người mua (QUYTAC_NGHIEPVU_164): cần cài đặt bán hàng đã lưu và ít nhất một phương thức đang bật.
  async setOrderingOpen(actor: BuyerAdminActor, orderingOpen: boolean): Promise<StoreSettingsResponse> {
    await this.database.transaction(async (transaction) => {
      const settings = (await transaction.execute<{ ordering_open: boolean }>(sql`SELECT ordering_open FROM marketplace.store_settings WHERE company_id = ${actor.operatorCompanyId} FOR UPDATE`))
        .rows[0];
      if (!settings) throw new ApiError("BUSINESS_RULE", "storeNotReady");
      if (orderingOpen) {
        await transaction.execute(sql`SELECT 1 FROM marketplace.payment_methods FOR UPDATE`);
        if ((await enabledPaymentMethods(transaction)).length === 0) throw new ApiError("BUSINESS_RULE", "paymentMethodRequired");
      }
      await transaction.execute(
        sql`UPDATE marketplace.store_settings SET ordering_open = ${orderingOpen}, updated_by = ${actor.userId}, updated_at = now() WHERE company_id = ${actor.operatorCompanyId}`,
      );
      await this.record(transaction, actor, "marketplace.ordering_open.update", "marketplace.store_settings", actor.operatorCompanyId, { orderingOpen: settings.ordering_open }, { orderingOpen });
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
      calculation: CommissionCalculation | null;
      referral: string | null;
      staff: string | null;
      team_head: string | null;
      regional_director: string | null;
      director: string | null;
      commission_version: number | null;
    }>(sql`
      SELECT p.id, p.name, c.name_vi AS category_name, p.review_status, p.status, (p.tracks_lots OR p.tracks_serials OR c.tracks_lots OR c.tracks_serials) AS tracks,
        l.is_published, l.description, pc.calculation, pc.referral::text, pc.staff::text, pc.team_head::text, pc.regional_director::text, pc.director::text,
        pc.version AS commission_version,
        (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_id
      FROM catalog.products p JOIN catalog.categories c ON c.id = p.category_id LEFT JOIN marketplace.listings l ON l.product_id = p.id
      LEFT JOIN marketplace.product_commissions pc ON pc.product_id = p.id
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
          commission:
            row.calculation === null
              ? null
              : {
                  calculation: row.calculation,
                  referral: trimDecimal(row.referral!),
                  staff: trimDecimal(row.staff!),
                  teamHead: trimDecimal(row.team_head!),
                  regionalDirector: trimDecimal(row.regional_director!),
                  director: trimDecimal(row.director!),
                  version: row.commission_version!,
                },
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

  // Thiết lập hoa hồng sản phẩm (QUYTAC_NGHIEPVU_200): phần trăm tổng năm mức không quá 100%; số tiền cố định tổng năm mức không vượt giá bán gồm thuế thấp nhất của sản phẩm.
  async setCommission(actor: BuyerAdminActor, productId: string, input: z.output<typeof productCommissionSchema>): Promise<ProductCommission> {
    const total = [input.referral, input.staff, input.teamHead, input.regionalDirector, input.director].reduce((sum, value) => sum + Number(value), 0);
    await this.database.transaction(async (transaction) => {
      const product = await transaction.execute(sql`SELECT 1 FROM catalog.products WHERE id = ${productId} AND company_id = ${actor.operatorCompanyId} AND seller_id IS NULL FOR UPDATE`);
      if (product.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      if (input.calculation === "percent" && total > 100) throw new ApiError("BUSINESS_RULE", "commissionPercentOver");
      if (input.calculation === "fixed") {
        const context = await loadStoreContext(transaction);
        const today = (await transaction.execute<{ today: string }>(sql`SELECT (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today`)).rows[0]!.today;
        const prices = context ? ((await pricedVariants(transaction, context, [productId], today)).get(productId) ?? []).map((variant) => Number(variant.grossPrice)) : [];
        if (prices.length > 0 && total > Math.min(...prices)) throw new ApiError("BUSINESS_RULE", "commissionFixedOverPrice");
      }
      const before = (await transaction.execute(sql`SELECT * FROM marketplace.product_commissions WHERE product_id = ${productId}`)).rows[0] ?? null;
      const saved = before
        ? await transaction.execute(sql`
          UPDATE marketplace.product_commissions SET calculation = ${input.calculation}, referral = ${input.referral}::numeric, staff = ${input.staff}::numeric,
            team_head = ${input.teamHead}::numeric, regional_director = ${input.regionalDirector}::numeric, director = ${input.director}::numeric,
            updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE product_id = ${productId} AND version = ${input.version} RETURNING product_id`)
        : await transaction.execute(sql`
          INSERT INTO marketplace.product_commissions (product_id, company_id, calculation, referral, staff, team_head, regional_director, director, updated_by)
          SELECT ${productId}, ${actor.operatorCompanyId}, ${input.calculation}, ${input.referral}::numeric, ${input.staff}::numeric, ${input.teamHead}::numeric,
            ${input.regionalDirector}::numeric, ${input.director}::numeric, ${actor.userId}
          WHERE ${input.version} = 0 RETURNING product_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.record(transaction, actor, "marketplace.product_commission.update", "catalog.products", productId, before, input);
    });
    const row = (
      await this.database.execute<{ calculation: CommissionCalculation; referral: string; staff: string; team_head: string; regional_director: string; director: string; version: number }>(sql`
      SELECT calculation, referral::text, staff::text, team_head::text, regional_director::text, director::text, version FROM marketplace.product_commissions WHERE product_id = ${productId}`)
    ).rows[0]!;
    return {
      calculation: row.calculation,
      referral: trimDecimal(row.referral),
      staff: trimDecimal(row.staff),
      teamHead: trimDecimal(row.team_head),
      regionalDirector: trimDecimal(row.regional_director),
      director: trimDecimal(row.director),
      version: row.version,
    };
  }

  async updateCommissionSettings(actor: BuyerAdminActor, input: z.output<typeof commissionSettingsSchema>): Promise<StoreSettingsResponse> {
    if (Number(input.taxRate) > 100) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { taxRate: "invalidValue" } });
    if (Number(input.minimumWithdrawal) <= 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { minimumWithdrawal: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      const before = await commissionSettings(transaction, actor.operatorCompanyId);
      const saved =
        before.version === 0
          ? await transaction.execute(sql`
            INSERT INTO marketplace.commission_settings (company_id, tax_threshold, tax_rate, minimum_withdrawal, updated_by)
            SELECT ${actor.operatorCompanyId}, ${input.taxThreshold}::numeric, ${input.taxRate}::numeric, ${input.minimumWithdrawal}::numeric, ${actor.userId}
            WHERE ${input.version} = 0 ON CONFLICT DO NOTHING RETURNING company_id`)
          : await transaction.execute(sql`
            UPDATE marketplace.commission_settings SET tax_threshold = ${input.taxThreshold}::numeric, tax_rate = ${input.taxRate}::numeric,
              minimum_withdrawal = ${input.minimumWithdrawal}::numeric, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
            WHERE company_id = ${actor.operatorCompanyId} AND version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.record(transaction, actor, "marketplace.commission_settings.update", "marketplace.commission_settings", actor.operatorCompanyId, before, input);
    });
    return this.settings(actor, true);
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
