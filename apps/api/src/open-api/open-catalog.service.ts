// API sản phẩm, giá, tồn cho đối tác (CHUC_NANG_219; QUYTAC_NGHIEPVU_489; API_260, API_261). Chỉ dữ liệu công ty của khóa.
import { Inject, Injectable } from "@nestjs/common";
import type { OpenProductItem, OpenStockItem, PageResponse, openProductQuerySchema, openStockQuerySchema } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { lookupPrice } from "../catalog/price-lists.service";
import { DATABASE, type Database } from "../database/database.module";
import { pgArray } from "../inventory/stock-ledger.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import type { OpenApiCaller } from "./api-key.guard";

const trimDecimal = (value: string): string => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);

@Injectable()
export class OpenCatalogService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async products(caller: OpenApiCaller, query: z.output<typeof openProductQuerySchema>): Promise<PageResponse<OpenProductItem>> {
    // Hàng của công ty đang bán (không gồm hàng nhà bán trên sàn).
    const conditions: SQL[] = [sql`v.company_id = ${caller.companyId}`, sql`v.status = 'active'`, sql`p.status = 'active'`, sql`p.seller_id IS NULL`];
    if (query.updatedSince) conditions.push(sql`p.updated_at >= ${query.updatedSince}::timestamptz`);
    const where = sql.join(conditions, sql` AND `);
    const base = sql`FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE ${where}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${base}`)).rows[0]?.total ?? 0;
    const rows = await this.database.execute<{
      variant_id: string;
      sku: string;
      product_code: string;
      product_name: string;
      option_values: string[];
      vat_rate: string;
      base_unit_code: string;
      updated_at: Date;
      barcodes: { barcode: string; unitCode: string }[];
      units: { unitId: string; unitCode: string; unitName: string; factor: string }[];
    }>(sql`
      SELECT v.id AS variant_id, v.sku, p.code AS product_code, p.name AS product_name, v.option_values, p.vat_rate, bu.code AS base_unit_code, p.updated_at,
        coalesce((SELECT json_agg(json_build_object('barcode', b.barcode, 'unitCode', bcu.code) ORDER BY b.barcode)
                  FROM catalog.barcodes b JOIN catalog.units bcu ON bcu.id = b.unit_id WHERE b.variant_id = v.id), '[]'::json) AS barcodes,
        (SELECT json_agg(u ORDER BY u.factor::numeric, u."unitCode") FROM (
           SELECT p.base_unit_id AS "unitId", bu.code AS "unitCode", bu.name_vi AS "unitName", '1' AS factor
           UNION ALL SELECT pu.unit_id, cu.code, cu.name_vi, trim(trailing '.' FROM trim(trailing '0' FROM pu.factor::text))
           FROM catalog.product_units pu JOIN catalog.units cu ON cu.id = pu.unit_id WHERE pu.product_id = p.id) u) AS units
      FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units bu ON bu.id = p.base_unit_id
      WHERE ${where} ORDER BY v.sku LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const currency = await companyCurrency(this.database, caller.companyId);
    const today = vietnamDate(this.clock.now());
    const data: OpenProductItem[] = [];
    for (const row of rows.rows) {
      const units = [];
      for (const unit of row.units) {
        // Giá theo kênh của khóa và nhóm khách của đối tác, như màn hình đơn bán; chưa trừ khuyến mãi.
        const found = await lookupPrice(
          this.database,
          caller.companyId,
          { variantId: row.variant_id, unitId: unit.unitId, channelId: caller.channelId, customerGroupId: caller.customerGroupId ?? undefined, currency },
          today,
        );
        const price = found && found !== "variantNotFound" ? found : null;
        units.push({ unitCode: unit.unitCode, unitName: unit.unitName, factor: unit.factor, price: price?.price ?? null, priceIncludesVat: price?.includesVat ?? null });
      }
      data.push({
        sku: row.sku,
        productCode: row.product_code,
        productName: row.product_name,
        optionValues: row.option_values,
        vatRate: row.vat_rate,
        baseUnitCode: row.base_unit_code,
        barcodes: row.barcodes,
        units,
        updatedAt: new Date(row.updated_at).toISOString(),
      });
    }
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  // Số khả dụng = tồn − giữ hàng, âm thì trả 0; chỉ các kho của khóa.
  async stock(caller: OpenApiCaller, query: z.output<typeof openStockQuerySchema>): Promise<PageResponse<OpenStockItem>> {
    if (caller.warehouseIds.length === 0) return { data: [], page: query.page, pageSize: query.pageSize, total: 0 };
    const conditions: SQL[] = [sql`c.company_id = ${caller.companyId}`, sql`c.warehouse_id = ANY(${pgArray(caller.warehouseIds)}::uuid[])`, sql`v.status = 'active'`];
    if (query.warehouse) conditions.push(sql`w.code = ${query.warehouse}`);
    if (query.sku && query.sku.length > 0) conditions.push(sql`v.sku = ANY(${pgArray(query.sku)}::text[])`);
    // Kho Dropship: tồn là số nhà cung cấp khai báo của sản phẩm dropship đang dùng (QUYTAC_NGHIEPVU_498).
    const source = sql`(SELECT c.warehouse_id, c.company_id, c.variant_id, c.quantity FROM inventory.costs c JOIN inventory.warehouses cw ON cw.id = c.warehouse_id AND cw.kind = 'standard'
      UNION ALL SELECT dw.id, dp.company_id, dp.variant_id, dp.declared_quantity FROM purchasing.dropship_products dp
      JOIN inventory.warehouses dw ON dw.company_id = dp.company_id AND dw.kind = 'dropship' AND dw.status = 'active' WHERE dp.status = 'active')`;
    const base = sql`FROM ${source} c JOIN catalog.variants v ON v.id = c.variant_id JOIN catalog.products p ON p.id = v.product_id
      JOIN inventory.warehouses w ON w.id = c.warehouse_id JOIN catalog.units u ON u.id = p.base_unit_id WHERE ${sql.join(conditions, sql` AND `)}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${base}`)).rows[0]?.total ?? 0;
    const rows = await this.database.execute<{ sku: string; warehouse_code: string; unit_code: string; available: string }>(sql`
      SELECT v.sku, w.code AS warehouse_code, u.code AS unit_code,
        greatest(c.quantity - coalesce((SELECT sum(r.quantity) FROM inventory.reservations r
          WHERE r.warehouse_id = c.warehouse_id AND r.company_id = c.company_id AND r.variant_id = c.variant_id AND r.status = 'active'), 0), 0)::text AS available
      ${base} ORDER BY v.sku, w.code LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({ sku: row.sku, warehouseCode: row.warehouse_code, available: trimDecimal(row.available), unitCode: row.unit_code })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
