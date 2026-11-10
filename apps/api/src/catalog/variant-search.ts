// Tìm mặt hàng đang bán của một công ty theo mã vạch (đúng), mã hàng (đúng) hoặc tên không dấu; dùng chung cho Kho, Mua hàng.
import type { StockItemOption } from "contracts";
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import { searchText } from "./catalog-context";

export async function searchVariantOptions(database: Pick<Database, "execute">, companyId: string, search: string): Promise<StockItemOption[]> {
  const pattern = `%${searchText(search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
  const rows = await database.execute<{
    variant_id: string;
    sku: string;
    product_name: string;
    option_values: string[];
    tracks_lots: boolean;
    tracks_serials: boolean;
    base_unit_id: string;
    units: { unitId: string; unitName: string; factor: string }[];
    matched_unit_id: string | null;
  }>(sql`
    SELECT v.id AS variant_id, v.sku, p.name AS product_name, v.option_values, p.tracks_lots, p.tracks_serials, p.base_unit_id,
      (SELECT json_agg(u ORDER BY u.factor) FROM (
         SELECT p.base_unit_id AS "unitId", bu.name_vi AS "unitName", '1' AS factor
         UNION ALL SELECT pu.unit_id, cu.name_vi, trim(trailing '.' FROM trim(trailing '0' FROM pu.factor::text)) FROM catalog.product_units pu JOIN catalog.units cu ON cu.id = pu.unit_id WHERE pu.product_id = p.id) u) AS units,
      (SELECT b.unit_id FROM catalog.barcodes b WHERE b.variant_id = v.id AND b.barcode = ${search} LIMIT 1) AS matched_unit_id
    FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units bu ON bu.id = p.base_unit_id
    WHERE v.company_id = ${companyId} AND v.status = 'active' AND p.status = 'active'
      AND (v.sku = ${search.toUpperCase()} OR p.search_text LIKE ${pattern}
           OR EXISTS (SELECT 1 FROM catalog.barcodes b WHERE b.company_id = ${companyId} AND b.variant_id = v.id AND b.barcode = ${search}))
    ORDER BY (v.sku = ${search.toUpperCase()}) DESC, v.sku LIMIT 10`);
  return rows.rows.map((row) => ({
    variantId: row.variant_id,
    sku: row.sku,
    productName: row.product_name,
    optionValues: row.option_values,
    tracksLots: row.tracks_lots,
    tracksSerials: row.tracks_serials,
    baseUnitId: row.base_unit_id,
    units: row.units,
    matchedUnitId: row.matched_unit_id,
  }));
}
