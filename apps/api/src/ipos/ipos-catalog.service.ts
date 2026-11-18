// Cổng cửa hàng nhóm iPOS: danh mục hàng – nhóm, mặt hàng, biến thể, mã vạch, giá theo điểm bán (CONG_VIEC_74; CHUC_NANG_255; QUYTAC_NGHIEPVU_597, 608; API_345).
// Chỉ chủ cửa hàng; ghi khi cửa hàng còn ít nhất một thuê bao chưa hủy. Số biến thể đang bán không vượt giới hạn mặt hàng của gói.
import { Inject, Injectable } from "@nestjs/common";
import type {
  IposActiveStatus,
  IposCategory,
  IposItemDetail,
  IposItemPage,
  IposItemRow,
  IposVariantOption,
  IposVatRate,
  iposCategoryCreateSchema,
  iposCategoryUpdateSchema,
  iposItemCreateSchema,
  iposItemUpdateSchema,
  iposOutletPricesSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import type { PortalMember } from "../affiliate/portal.service";
import { searchText } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { isUniqueViolation, violatedConstraint } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";

export type Executor = Pick<Database, "execute">;
type ItemInput = z.infer<typeof iposItemCreateSchema> & { status?: IposActiveStatus; version?: number };
const pageSize = 50;

// Bộ đếm số tự sinh theo cửa hàng (mã mặt hàng, số phiếu); khóa dòng đếm đến hết giao dịch nên không trùng số.
export async function nextNumber(executor: Executor, merchantId: string, kind: "item" | "receipt" | "adjustment"): Promise<number> {
  const rows = await executor.execute<{ last_number: number }>(sql`
    INSERT INTO ipos.number_counters (merchant_id, kind, last_number) VALUES (${merchantId}, ${kind}, 1)
    ON CONFLICT (merchant_id, kind) DO UPDATE SET last_number = ipos.number_counters.last_number + 1
    RETURNING last_number`);
  return rows.rows[0]!.last_number;
}

// Mã mặt hàng tự sinh `SP` và 6 chữ số; bỏ qua số đã có người tự đặt trùng.
export async function nextItemCode(executor: Executor, merchantId: string): Promise<string> {
  for (;;) {
    const code = `SP${String(await nextNumber(executor, merchantId, "item")).padStart(6, "0")}`;
    const taken = await executor.execute(sql`SELECT 1 FROM ipos.items WHERE merchant_id = ${merchantId} AND upper(code) = ${code}`);
    if (taken.rows.length === 0) return code;
  }
}

// Ghi danh mục, phiếu tồn cần cửa hàng còn thuê bao chưa hủy (đã hủy chỉ xem trong 12 tháng, QUYTAC_NGHIEPVU_596).
export async function requireWritable(executor: Executor, merchantId: string): Promise<void> {
  const found = await executor.execute(sql`SELECT 1 FROM ipos.subscriptions WHERE merchant_id = ${merchantId} AND status <> 'cancelled' LIMIT 1`);
  if (found.rows.length === 0) throw new ApiError("BUSINESS_RULE", "iposNoSubscription");
}

// Giới hạn mặt hàng của cửa hàng: lớn nhất trong các thuê bao chưa hủy; một gói không giới hạn thì không giới hạn.
export async function itemLimit(executor: Executor, merchantId: string): Promise<{ maxItems: number | null; planName: string | null }> {
  const rows = await executor.execute<{ max_items: number | null; name: string }>(sql`
    SELECT pl.max_items, pl.name FROM ipos.subscriptions s JOIN ipos.plans pl ON pl.id = s.plan_id
    WHERE s.merchant_id = ${merchantId} AND s.status <> 'cancelled'
    ORDER BY pl.max_items DESC NULLS FIRST LIMIT 1`);
  const row = rows.rows[0];
  return { maxItems: row?.max_items ?? null, planName: row?.name ?? null };
}

// Số mặt hàng đang bán tính theo biến thể (QUYTAC_NGHIEPVU_608 khoản 6).
export async function activeVariants(executor: Executor, merchantId: string): Promise<number> {
  const rows = await executor.execute<{ total: number }>(sql`
    SELECT count(*)::int AS total FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
    WHERE v.merchant_id = ${merchantId} AND v.status = 'active' AND i.status = 'active'`);
  return rows.rows[0]!.total;
}

// Khóa ghi danh mục của một cửa hàng đến hết giao dịch: kiểm giới hạn mặt hàng không bị hai người lưu cùng lúc vượt qua.
export async function lockCatalog(executor: Executor, merchantId: string): Promise<void> {
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ipos-catalog:${merchantId}`}))`);
}

// Vượt giới hạn: chỉ chặn khi số đang bán tăng thêm; không ẩn mặt hàng đã có (QUYTAC_NGHIEPVU_597 khoản 3).
export async function checkItemLimit(executor: Executor, merchantId: string, before: number): Promise<void> {
  const { maxItems } = await itemLimit(executor, merchantId);
  if (maxItems === null) return;
  const after = await activeVariants(executor, merchantId);
  if (after > before && after > maxItems) throw new ApiError("BUSINESS_RULE", "iposItemLimit");
}

@Injectable()
export class IposCatalogService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private record(member: PortalMember, action: string, entityType: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      { actorUserId: member.userId, companyId: member.companyId, appCode: "affiliate", action, entityType, entityId, afterData, ip: member.client.ip, userAgent: member.client.userAgent, requestId: member.client.requestId },
      executor,
    );
  }

  // Nhóm hàng.
  async categories(member: PortalMember): Promise<IposCategory[]> {
    const rows = await this.database.execute<{ id: string; parent_id: string | null; name: string; sort_order: number; status: IposActiveStatus; active_items: number; version: number }>(sql`
      SELECT c.id, c.parent_id, c.name, c.sort_order, c.status, c.version,
        (SELECT count(*)::int FROM ipos.items i WHERE i.category_id = c.id AND i.status = 'active') AS active_items
      FROM ipos.categories c WHERE c.merchant_id = ${member.merchantId}
      ORDER BY c.sort_order, lower(c.name)`);
    return rows.rows.map((row) => ({ id: row.id, parentId: row.parent_id, name: row.name, sortOrder: row.sort_order, status: row.status, activeItems: row.active_items, version: row.version }));
  }

  // Nhóm cha phải là nhóm cấp một của cùng cửa hàng; nhóm đang có nhóm con thì không thành nhóm con (hai cấp).
  private async checkParent(executor: Executor, member: PortalMember, parentId: string | null, selfId: string | null): Promise<void> {
    if (!parentId) return;
    const parent = await executor.execute<{ parent_id: string | null }>(sql`SELECT parent_id FROM ipos.categories WHERE id = ${parentId} AND merchant_id = ${member.merchantId}`);
    if (!parent.rows[0]) throw new ApiError("NOT_FOUND", "notFound");
    if (parent.rows[0].parent_id !== null || parentId === selfId) throw new ApiError("BUSINESS_RULE", "iposCategoryDepth");
    if (selfId) {
      const children = await executor.execute(sql`SELECT 1 FROM ipos.categories WHERE parent_id = ${selfId} LIMIT 1`);
      if (children.rows.length > 0) throw new ApiError("BUSINESS_RULE", "iposCategoryDepth");
    }
  }

  async createCategory(member: PortalMember, input: z.infer<typeof iposCategoryCreateSchema>): Promise<IposCategory[]> {
    try {
      await this.database.transaction(async (transaction) => {
        await requireWritable(transaction, member.merchantId);
        await this.checkParent(transaction, member, input.parentId, null);
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO ipos.categories (merchant_id, parent_id, name, sort_order) VALUES (${member.merchantId}, ${input.parentId}, ${input.name}, ${input.sortOrder}) RETURNING id`);
        await this.record(member, "ipos.category.create", "ipos_category", created.rows[0]!.id, input, transaction);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "iposCategoryNameTaken");
      throw error;
    }
    return this.categories(member);
  }

  async updateCategory(member: PortalMember, id: string, input: z.infer<typeof iposCategoryUpdateSchema>): Promise<IposCategory[]> {
    try {
      await this.database.transaction(async (transaction) => {
        await requireWritable(transaction, member.merchantId);
        const current = await transaction.execute<{ version: number }>(sql`SELECT version FROM ipos.categories WHERE id = ${id} AND merchant_id = ${member.merchantId} FOR UPDATE`);
        if (!current.rows[0]) throw new ApiError("NOT_FOUND", "notFound");
        if (current.rows[0].version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await this.checkParent(transaction, member, input.parentId, id);
        await transaction.execute(sql`
          UPDATE ipos.categories SET name = ${input.name}, parent_id = ${input.parentId}, sort_order = ${input.sortOrder}, status = ${input.status},
            updated_at = now(), version = version + 1
          WHERE id = ${id}`);
        await this.record(member, "ipos.category.update", "ipos_category", id, input, transaction);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "iposCategoryNameTaken");
      throw error;
    }
    return this.categories(member);
  }

  // Danh sách mặt hàng: tìm theo mã, tên (không dấu), mã vạch; lọc nhóm (gồm nhóm con), trạng thái.
  async items(member: PortalMember, query: { search?: string; categoryId?: string; status?: IposActiveStatus; page: number }): Promise<IposItemPage> {
    const pattern = query.search ? `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%` : null;
    const exact = query.search?.trim() ?? null;
    const where = sql`i.merchant_id = ${member.merchantId}
      ${pattern ? sql`AND (i.search_text LIKE ${pattern} OR EXISTS (SELECT 1 FROM ipos.item_barcodes b JOIN ipos.item_variants v ON v.id = b.variant_id WHERE v.item_id = i.id AND b.barcode = ${exact}))` : sql``}
      ${query.categoryId ? sql`AND (i.category_id = ${query.categoryId} OR i.category_id IN (SELECT id FROM ipos.categories WHERE parent_id = ${query.categoryId}))` : sql``}
      ${query.status ? sql`AND i.status = ${query.status}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ipos.items i WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<{
      id: string;
      code: string;
      name: string;
      category_id: string | null;
      category_name: string | null;
      unit: string;
      min_price: string;
      max_price: string;
      vat_rate: IposVatRate;
      track_stock: boolean;
      variant_count: number;
      barcodes: string[];
      status: IposActiveStatus;
    }>(sql`
      SELECT i.id, i.code, i.name, i.category_id, c.name AS category_name, i.unit, i.vat_rate, i.track_stock, i.status,
        COALESCE(p.min_price, i.price)::text AS min_price, COALESCE(p.max_price, i.price)::text AS max_price, COALESCE(p.variant_count, 0) AS variant_count,
        COALESCE((SELECT array_agg(b.barcode ORDER BY b.barcode) FROM ipos.item_barcodes b JOIN ipos.item_variants v ON v.id = b.variant_id WHERE v.item_id = i.id), '{}') AS barcodes
      FROM ipos.items i LEFT JOIN ipos.categories c ON c.id = i.category_id
      LEFT JOIN LATERAL (
        SELECT min(COALESCE(v.price, i.price)) AS min_price, max(COALESCE(v.price, i.price)) AS max_price, count(*)::int AS variant_count
        FROM ipos.item_variants v WHERE v.item_id = i.id AND v.status = 'active') p ON true
      WHERE ${where}
      ORDER BY i.status, i.code
      LIMIT ${pageSize} OFFSET ${(query.page - 1) * pageSize}`);
    const limit = await itemLimit(this.database, member.merchantId);
    return {
      items: rows.rows.map(
        (row): IposItemRow => ({
          id: row.id,
          code: row.code,
          name: row.name,
          categoryId: row.category_id,
          categoryName: row.category_name,
          unit: row.unit,
          minPrice: row.min_price,
          maxPrice: row.max_price,
          vatRate: row.vat_rate,
          trackStock: row.track_stock,
          variantCount: row.variant_count,
          barcodes: row.barcodes,
          status: row.status,
        }),
      ),
      total,
      page: query.page,
      pageSize,
      activeVariants: await activeVariants(this.database, member.merchantId),
      maxItems: limit.maxItems,
      planName: limit.planName,
    };
  }

  async item(member: PortalMember, id: string): Promise<IposItemDetail> {
    const rows = await this.database.execute<{
      id: string;
      code: string;
      name: string;
      category_id: string | null;
      unit: string;
      price: string;
      vat_rate: IposVatRate;
      track_stock: boolean;
      attribute1_name: string | null;
      attribute2_name: string | null;
      status: IposActiveStatus;
      version: number;
    }>(sql`
      SELECT id, code, name, category_id, unit, price::text, vat_rate, track_stock, attribute1_name, attribute2_name, status, version
      FROM ipos.items WHERE id = ${id} AND merchant_id = ${member.merchantId}`);
    const row = rows.rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const variants = await this.database.execute<{
      id: string;
      code: string;
      attribute1_value: string | null;
      attribute2_value: string | null;
      price: string | null;
      min_quantity: string | null;
      status: IposActiveStatus;
      barcodes: string[];
      outlet_prices: { outletId: string; price: string }[];
    }>(sql`
      SELECT v.id, v.code, v.attribute1_value, v.attribute2_value, v.price::text, trim_scale(v.min_quantity)::text AS min_quantity, v.status,
        COALESCE((SELECT array_agg(b.barcode ORDER BY b.created_at, b.barcode) FROM ipos.item_barcodes b WHERE b.variant_id = v.id), '{}') AS barcodes,
        COALESCE((SELECT json_agg(json_build_object('outletId', p.outlet_id, 'price', p.price::text)) FROM ipos.outlet_prices p WHERE p.variant_id = v.id), '[]') AS outlet_prices
      FROM ipos.item_variants v WHERE v.item_id = ${id}
      ORDER BY v.status, v.sort_order, v.code`);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      categoryId: row.category_id,
      unit: row.unit,
      price: row.price,
      vatRate: row.vat_rate,
      trackStock: row.track_stock,
      attribute1Name: row.attribute1_name,
      attribute2Name: row.attribute2_name,
      status: row.status,
      version: row.version,
      variants: variants.rows.map((variant) => ({
        id: variant.id,
        code: variant.code,
        attribute1Value: variant.attribute1_value,
        attribute2Value: variant.attribute2_value,
        price: variant.price,
        minQuantity: variant.min_quantity,
        barcodes: variant.barcodes,
        status: variant.status,
        outletPrices: variant.outlet_prices,
      })),
    };
  }

  // Kiểm biến thể theo thuộc tính: không thuộc tính thì đúng một biến thể mặc định cùng mã mặt hàng.
  private normalize(input: ItemInput, code: string): ItemInput["variants"] {
    if (input.attribute2Name && !input.attribute1Name) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { attribute1Name: "required" } });
    if (!input.attribute1Name) {
      if (input.variants.length !== 1) throw new ApiError("BUSINESS_RULE", "iposVariantInvalid");
      return [{ ...input.variants[0]!, code, attribute1Value: null, attribute2Value: null, status: "active" }];
    }
    const combinations = new Set<string>();
    const codes = new Set<string>();
    return input.variants.map((variant, index) => {
      if (!variant.attribute1Value || Boolean(input.attribute2Name) !== Boolean(variant.attribute2Value)) throw new ApiError("BUSINESS_RULE", "iposVariantInvalid");
      const combination = `${variant.attribute1Value.toLowerCase()}|${(variant.attribute2Value ?? "").toLowerCase()}`;
      const variantCode = variant.code || `${code}-${index + 1}`;
      if (combinations.has(combination) || codes.has(variantCode)) throw new ApiError("BUSINESS_RULE", "iposVariantInvalid");
      combinations.add(combination);
      codes.add(variantCode);
      return { ...variant, code: variantCode };
    });
  }

  private async saveVariants(executor: Executor, member: PortalMember, itemId: string, variants: ItemInput["variants"]): Promise<void> {
    const barcodes = variants.flatMap((variant) => variant.barcodes);
    if (new Set(barcodes).size !== barcodes.length) throw new ApiError("BUSINESS_RULE", "iposBarcodeTaken");
    const existing = await executor.execute<{ id: string }>(sql`SELECT id FROM ipos.item_variants WHERE item_id = ${itemId}`);
    const existingIds = new Set(existing.rows.map((row) => row.id));
    if (variants.some((variant) => variant.id && !existingIds.has(variant.id))) throw new ApiError("NOT_FOUND", "notFound");
    // Biến thể bỏ khỏi danh sách thì ngừng bán (không xóa vì có thể đã bán, đã có tồn); mã vạch của nó gỡ ra.
    const keptIds = variants.flatMap((variant) => (variant.id ? [variant.id] : []));
    for (const id of existingIds) {
      if (keptIds.includes(id)) continue;
      await executor.execute(sql`UPDATE ipos.item_variants SET status = 'inactive', updated_at = now() WHERE id = ${id}`);
    }
    await executor.execute(sql`DELETE FROM ipos.item_barcodes WHERE variant_id IN (SELECT id FROM ipos.item_variants WHERE item_id = ${itemId})`);
    // Đổi mã tạm thời để hai biến thể đổi mã cho nhau không vướng chỉ mục duy nhất.
    if (keptIds.length > 0) await executor.execute(sql`UPDATE ipos.item_variants SET code = '~' || left(id::text, 28) WHERE id IN (${sql.join(keptIds.map((id) => sql`${id}`), sql`, `)})`);
    for (const [index, variant] of variants.entries()) {
      let variantId = variant.id;
      if (variantId) {
        await executor.execute(sql`
          UPDATE ipos.item_variants SET code = ${variant.code}, attribute1_value = ${variant.attribute1Value}, attribute2_value = ${variant.attribute2Value},
            price = ${variant.price}, min_quantity = ${variant.minQuantity}, status = ${variant.status}, sort_order = ${index}, updated_at = now()
          WHERE id = ${variantId}`);
      } else {
        const created = await executor.execute<{ id: string }>(sql`
          INSERT INTO ipos.item_variants (merchant_id, item_id, code, attribute1_value, attribute2_value, price, min_quantity, status, sort_order)
          VALUES (${member.merchantId}, ${itemId}, ${variant.code}, ${variant.attribute1Value}, ${variant.attribute2Value}, ${variant.price}, ${variant.minQuantity}, ${variant.status}, ${index})
          RETURNING id`);
        variantId = created.rows[0]!.id;
      }
      for (const barcode of variant.barcodes) {
        await executor.execute(sql`INSERT INTO ipos.item_barcodes (merchant_id, variant_id, barcode) VALUES (${member.merchantId}, ${variantId}, ${barcode})`);
      }
    }
  }

  private async checkCategory(executor: Executor, member: PortalMember, categoryId: string | null): Promise<void> {
    if (!categoryId) return;
    const found = await executor.execute(sql`SELECT 1 FROM ipos.categories WHERE id = ${categoryId} AND merchant_id = ${member.merchantId}`);
    if (found.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  private translate(error: unknown): unknown {
    if (!isUniqueViolation(error)) return error;
    const constraint = violatedConstraint(error);
    if (constraint === "item_barcodes_barcode_idx") return new ApiError("BUSINESS_RULE", "iposBarcodeTaken");
    if (constraint === "item_variants_code_idx") return new ApiError("BUSINESS_RULE", "iposVariantInvalid");
    return new ApiError("BUSINESS_RULE", "iposItemCodeTaken");
  }

  async createItem(member: PortalMember, input: z.infer<typeof iposItemCreateSchema>): Promise<IposItemDetail> {
    let id = "";
    try {
      await this.database.transaction(async (transaction) => {
        await requireWritable(transaction, member.merchantId);
        await lockCatalog(transaction, member.merchantId);
        await this.checkCategory(transaction, member, input.categoryId);
        const before = await activeVariants(transaction, member.merchantId);
        const code = input.code || (await nextItemCode(transaction, member.merchantId));
        const variants = this.normalize(input, code);
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO ipos.items (merchant_id, code, name, search_text, category_id, unit, price, vat_rate, track_stock, attribute1_name, attribute2_name, created_by, updated_by)
          VALUES (${member.merchantId}, ${code}, ${input.name}, ${searchText(input.name, code)}, ${input.categoryId}, ${input.unit}, ${input.price}, ${input.vatRate}, ${input.trackStock},
            ${input.attribute1Name}, ${input.attribute2Name}, ${member.userId}, ${member.userId})
          RETURNING id`);
        id = created.rows[0]!.id;
        await this.saveVariants(transaction, member, id, variants);
        await checkItemLimit(transaction, member.merchantId, before);
        await this.record(member, "ipos.item.create", "ipos_item", id, { code, name: input.name, price: input.price, variants: variants.length }, transaction);
      });
    } catch (error) {
      throw this.translate(error);
    }
    return this.item(member, id);
  }

  async updateItem(member: PortalMember, id: string, input: z.infer<typeof iposItemUpdateSchema>): Promise<IposItemDetail> {
    try {
      await this.database.transaction(async (transaction) => {
        await requireWritable(transaction, member.merchantId);
        await lockCatalog(transaction, member.merchantId);
        const current = await transaction.execute<{ version: number }>(sql`SELECT version FROM ipos.items WHERE id = ${id} AND merchant_id = ${member.merchantId} FOR UPDATE`);
        if (!current.rows[0]) throw new ApiError("NOT_FOUND", "notFound");
        if (current.rows[0].version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await this.checkCategory(transaction, member, input.categoryId);
        const before = await activeVariants(transaction, member.merchantId);
        const variants = this.normalize(input, input.code);
        await transaction.execute(sql`
          UPDATE ipos.items SET code = ${input.code}, name = ${input.name}, search_text = ${searchText(input.name, input.code)}, category_id = ${input.categoryId}, unit = ${input.unit},
            price = ${input.price}, vat_rate = ${input.vatRate}, track_stock = ${input.trackStock}, attribute1_name = ${input.attribute1Name}, attribute2_name = ${input.attribute2Name},
            status = ${input.status}, updated_by = ${member.userId}, updated_at = now(), version = version + 1
          WHERE id = ${id}`);
        // Mặt hàng không thuộc tính: biến thể mặc định giữ nguyên mã định danh (tồn kho, giá điểm bán gắn vào nó).
        if (!input.attribute1Name && !variants[0]!.id) {
          const first = await transaction.execute<{ id: string }>(sql`SELECT id FROM ipos.item_variants WHERE item_id = ${id} ORDER BY sort_order, code LIMIT 1`);
          if (first.rows[0]) variants[0] = { ...variants[0]!, id: first.rows[0].id };
        }
        await this.saveVariants(transaction, member, id, variants);
        await checkItemLimit(transaction, member.merchantId, before);
        await this.record(member, "ipos.item.update", "ipos_item", id, { code: input.code, name: input.name, price: input.price, status: input.status, variants: variants.length }, transaction);
      });
    } catch (error) {
      throw this.translate(error);
    }
    return this.item(member, id);
  }

  // Giá riêng theo điểm bán (giá trống: bỏ giá riêng, dùng giá bán).
  async saveOutletPrices(member: PortalMember, id: string, input: z.infer<typeof iposOutletPricesSchema>): Promise<IposItemDetail> {
    await this.database.transaction(async (transaction) => {
      await requireWritable(transaction, member.merchantId);
      const variants = await transaction.execute<{ id: string }>(sql`
        SELECT v.id FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id WHERE i.id = ${id} AND i.merchant_id = ${member.merchantId}`);
      if (variants.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      const variantIds = new Set(variants.rows.map((row) => row.id));
      const outlets = await transaction.execute<{ id: string }>(sql`SELECT id FROM affiliate.outlets WHERE merchant_id = ${member.merchantId}`);
      const outletIds = new Set(outlets.rows.map((row) => row.id));
      for (const price of input.prices) {
        if (!variantIds.has(price.variantId) || !outletIds.has(price.outletId)) throw new ApiError("NOT_FOUND", "notFound");
        if (price.price === null) {
          await transaction.execute(sql`DELETE FROM ipos.outlet_prices WHERE outlet_id = ${price.outletId} AND variant_id = ${price.variantId}`);
        } else {
          await transaction.execute(sql`
            INSERT INTO ipos.outlet_prices (outlet_id, variant_id, merchant_id, price) VALUES (${price.outletId}, ${price.variantId}, ${member.merchantId}, ${price.price})
            ON CONFLICT (outlet_id, variant_id) DO UPDATE SET price = EXCLUDED.price, updated_at = now()`);
        }
      }
      await transaction.execute(sql`UPDATE ipos.items SET updated_at = now() WHERE id = ${id}`);
      await this.record(member, "ipos.item.outlet_prices", "ipos_item", id, input, transaction);
    });
    return this.item(member, id);
  }

  // Chọn biến thể có theo dõi tồn kho để lập phiếu tồn.
  async variantOptions(member: PortalMember, search: string | undefined): Promise<IposVariantOption[]> {
    const pattern = search ? `%${searchText(search).replace(/[%_\\]/g, (character) => `\\${character}`)}%` : "%";
    const rows = await this.database.execute<{ variant_id: string; item_code: string; variant_code: string; name: string; unit: string }>(sql`
      SELECT v.id AS variant_id, i.code AS item_code, v.code AS variant_code, i.unit,
        i.name || COALESCE(' – ' || v.attribute1_value, '') || COALESCE(' / ' || v.attribute2_value, '') AS name
      FROM ipos.item_variants v JOIN ipos.items i ON i.id = v.item_id
      WHERE v.merchant_id = ${member.merchantId} AND i.track_stock AND v.status = 'active' AND i.status = 'active'
        AND (i.search_text LIKE ${pattern} OR lower(v.code) LIKE ${pattern} OR EXISTS (SELECT 1 FROM ipos.item_barcodes b WHERE b.variant_id = v.id AND b.barcode = ${search?.trim() ?? ""}))
      ORDER BY i.code, v.sort_order LIMIT 30`);
    return rows.rows.map((row) => ({ variantId: row.variant_id, itemCode: row.item_code, variantCode: row.variant_code, name: row.name, unit: row.unit }));
  }
}
