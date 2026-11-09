// Xem tồn kho, chi tiết lô, serial, vị trí, thẻ kho (CHUC_NANG_39; QUYTAC_NGHIEPVU_47, 48, 49, 54; API_64; TIEUCHI_NGHIEMTHU_74).
import { Inject, Injectable } from "@nestjs/common";
import type { PageResponse, StockCardResponse, stockCardQuerySchema, StockDetailResponse, stockDetailQuerySchema, stockListQuerySchema, StockRow } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { pgArray } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

const decimal = (value: string | null) => (value === null ? null : trimDecimal(value));

@Injectable()
export class StockService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly warehouses: WarehousesService,
  ) {}

  async list(actor: Actor, query: z.output<typeof stockListQuerySchema>): Promise<PageResponse<StockRow>> {
    const conditions: SQL[] = [await this.scope(actor)];
    if (query.warehouseId) conditions.push(sql`c.warehouse_id = ${query.warehouseId}`);
    if (query.companyId) conditions.push(sql`c.company_id = ${query.companyId}`);
    if (query.categoryId) conditions.push(sql`p.category_id = ${query.categoryId}`);
    if (query.onlyInStock !== "false") conditions.push(sql`c.quantity > 0`);
    if (query.search) {
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(p.search_text LIKE ${pattern} OR v.sku = ${query.search.toUpperCase()}
        OR EXISTS (SELECT 1 FROM catalog.barcodes b WHERE b.variant_id = v.id AND b.barcode = ${query.search}))`);
    }
    const where = sql.join(conditions, sql` AND `);
    const base = sql`FROM inventory.costs c JOIN catalog.variants v ON v.id = c.variant_id JOIN catalog.products p ON p.id = v.product_id WHERE ${where}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${base}`)).rows[0]!.total;
    const rows = await this.database.execute<{
      warehouse_id: string;
      warehouse_name: string;
      company_id: string;
      company_name: string;
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      base_unit_name: string;
      on_hand: string;
      reserved: string;
      incoming: string;
      average_cost: string;
      value: string;
      minimum: string | null;
    }>(sql`
      SELECT page.*, w.name AS warehouse_name, co.short_name AS company_name, u.name_vi AS base_unit_name,
        coalesce((SELECT sum(r.quantity) FROM inventory.reservations r WHERE r.warehouse_id = page.warehouse_id AND r.company_id = page.company_id AND r.variant_id = page.variant_id AND r.status = 'active'), 0)::text AS reserved,
        coalesce((SELECT sum(l.base_quantity) FROM inventory.documents d JOIN inventory.document_lines l ON l.document_id = d.id
                  WHERE d.type = 'transfer' AND d.status = 'in_transit' AND d.destination_warehouse_id = page.warehouse_id AND d.company_id = page.company_id AND l.variant_id = page.variant_id), 0)::text AS incoming,
        (SELECT s.minimum::text FROM inventory.stock_levels s WHERE s.warehouse_id = page.warehouse_id AND s.company_id = page.company_id AND s.variant_id = page.variant_id) AS minimum
      FROM (
        SELECT c.warehouse_id, c.company_id, c.variant_id, v.sku, p.name AS product_name, v.option_values, p.base_unit_id, c.quantity::text AS on_hand, c.average_cost::text AS average_cost, c.value::text AS value
        ${base} ORDER BY c.warehouse_id, v.sku LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
      ) page
      JOIN inventory.warehouses w ON w.id = page.warehouse_id JOIN core.companies co ON co.id = page.company_id JOIN catalog.units u ON u.id = page.base_unit_id
      ORDER BY w.code, page.sku`);
    const costVisible = await this.warehouses.costVisibility(actor);
    return {
      data: rows.rows.map((row) => {
        const showCost = costVisible(row);
        const available = Number(row.on_hand) - Number(row.reserved);
        return {
          warehouseId: row.warehouse_id,
          warehouseName: row.warehouse_name,
          companyId: row.company_id,
          companyName: row.company_name,
          variantId: row.variant_id,
          sku: row.sku,
          productName: row.product_name,
          optionValues: row.option_values,
          baseUnitName: row.base_unit_name,
          onHand: trimDecimal(row.on_hand),
          reserved: trimDecimal(row.reserved),
          available: trimDecimal(available.toFixed(4)),
          incoming: trimDecimal(row.incoming),
          averageCost: showCost ? trimDecimal(row.average_cost) : null,
          value: showCost ? trimDecimal(row.value) : null,
          minimum: decimal(row.minimum),
          belowMinimum: row.minimum !== null && available + Number(row.incoming) < Number(row.minimum),
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async detail(actor: Actor, variantId: string, query: z.output<typeof stockDetailQuerySchema>): Promise<StockDetailResponse> {
    const showCost = await this.requireVisible(actor, query.warehouseId, query.companyId);
    const balances = await this.database.execute<{
      lot_id: string | null;
      lot_no: string | null;
      expires_on: string | null;
      location_id: string | null;
      location_code: string | null;
      quantity: string;
    }>(sql`
      SELECT b.lot_id, l.lot_no, l.expires_on::text, b.location_id, loc.code AS location_code, b.quantity::text
      FROM inventory.balances b LEFT JOIN inventory.lots l ON l.id = b.lot_id LEFT JOIN inventory.locations loc ON loc.id = b.location_id
      WHERE b.warehouse_id = ${query.warehouseId} AND b.company_id = ${query.companyId} AND b.variant_id = ${variantId} AND b.quantity > 0
      ORDER BY l.expires_on NULLS LAST, l.lot_no, loc.code`);
    const serials = await this.database.execute<{ serial_no: string; location_code: string | null; unit_cost: string }>(sql`
      SELECT s.serial_no, loc.code AS location_code, s.unit_cost::text FROM inventory.serials s LEFT JOIN inventory.locations loc ON loc.id = s.location_id
      WHERE s.warehouse_id = ${query.warehouseId} AND s.company_id = ${query.companyId} AND s.variant_id = ${variantId} AND s.status = 'in_stock' ORDER BY s.serial_no`);
    const reservations = await this.database.execute<{ id: string; quantity: string; source_type: string; source_no: string | null; expires_at: Date | null }>(sql`
      SELECT id, quantity::text, source_type, source_no, expires_at FROM inventory.reservations
      WHERE warehouse_id = ${query.warehouseId} AND company_id = ${query.companyId} AND variant_id = ${variantId} AND status = 'active' ORDER BY created_at`);
    return {
      balances: balances.rows.map((row) => ({
        lotId: row.lot_id,
        lotNo: row.lot_no,
        expiresOn: row.expires_on,
        locationId: row.location_id,
        locationCode: row.location_code,
        quantity: trimDecimal(row.quantity),
      })),
      serials: serials.rows.map((row) => ({ serialNo: row.serial_no, locationCode: row.location_code, unitCost: showCost ? trimDecimal(row.unit_cost) : null })),
      reservations: reservations.rows.map((row) => ({
        id: row.id,
        quantity: trimDecimal(row.quantity),
        sourceType: row.source_type,
        sourceNo: row.source_no,
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      })),
    };
  }

  // Thẻ kho theo ngày giờ Việt Nam: tồn đầu kỳ, biến động trong kỳ, tồn cuối kỳ (QUYTAC_NGHIEPVU_49).
  async card(actor: Actor, query: z.output<typeof stockCardQuerySchema>): Promise<StockCardResponse> {
    if (query.from > query.to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "invalidValue" } });
    const showCost = await this.requireVisible(actor, query.warehouseId, query.companyId);
    const item = (
      await this.database.execute<{ sku: string; product_name: string; base_unit_name: string }>(sql`
      SELECT v.sku, p.name AS product_name, u.name_vi AS base_unit_name FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = p.base_unit_id
      WHERE v.id = ${query.variantId} AND v.company_id = ${query.companyId}`)
    ).rows[0];
    if (!item) throw new ApiError("NOT_FOUND", "notFound");
    const key = sql`m.warehouse_id = ${query.warehouseId} AND m.company_id = ${query.companyId} AND m.variant_id = ${query.variantId}`;
    const localDay = sql`(m.moved_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`;
    const summary = async (condition: SQL) =>
      (
        await this.database.execute<{ quantity: string; value: string }>(sql`
        SELECT coalesce((SELECT m.balance_after FROM inventory.movements m WHERE ${key} AND ${condition} ORDER BY m.id DESC LIMIT 1), 0)::text AS quantity,
          coalesce((SELECT sum(m.value) FROM inventory.movements m WHERE ${key} AND ${condition}), 0)::text AS value`)
      ).rows[0]!;
    const opening = await summary(sql`${localDay} < ${query.from}::date`);
    const closing = await summary(sql`${localDay} <= ${query.to}::date`);
    const movements = await this.database.execute<{
      id: string;
      moved_at: Date;
      document_id: string;
      document_no: string | null;
      document_type: StockCardResponse["movements"][number]["documentType"];
      lot_no: string | null;
      location_code: string | null;
      quantity: string;
      unit_cost: string;
      value: string;
      balance_after: string;
    }>(sql`
      SELECT m.id::text, m.moved_at, m.document_id, d.document_no, d.type AS document_type, l.lot_no, loc.code AS location_code,
        m.quantity::text, m.unit_cost::text, m.value::text, m.balance_after::text
      FROM inventory.movements m JOIN inventory.documents d ON d.id = m.document_id LEFT JOIN inventory.lots l ON l.id = m.lot_id LEFT JOIN inventory.locations loc ON loc.id = m.location_id
      WHERE ${key} AND ${localDay} BETWEEN ${query.from}::date AND ${query.to}::date ORDER BY m.id LIMIT 5000`);
    return {
      sku: item.sku,
      productName: item.product_name,
      baseUnitName: item.base_unit_name,
      opening: { quantity: trimDecimal(opening.quantity), value: showCost ? trimDecimal(opening.value) : null },
      movements: movements.rows.map((row) => ({
        id: row.id,
        movedAt: new Date(row.moved_at).toISOString(),
        documentId: row.document_id,
        documentNo: row.document_no,
        documentType: row.document_type,
        lotNo: row.lot_no,
        locationCode: row.location_code,
        quantity: trimDecimal(row.quantity),
        unitCost: showCost ? trimDecimal(row.unit_cost) : null,
        value: showCost ? trimDecimal(row.value) : null,
        balanceAfter: trimDecimal(row.balance_after),
      })),
      closing: { quantity: trimDecimal(closing.quantity), value: showCost ? trimDecimal(closing.value) : null },
    };
  }

  private async scope(actor: Actor): Promise<SQL> {
    const { operable, ownerView } = await this.warehouses.stockScope(actor);
    const parts: SQL[] = [sql`FALSE`];
    if (operable.length > 0) parts.push(sql`c.warehouse_id = ANY(${pgArray(operable)}::uuid[])`);
    if (ownerView.length > 0) parts.push(sql`(c.warehouse_id = ANY(${pgArray(ownerView)}::uuid[]) AND c.company_id = ${actor.companyId})`);
    return sql`(${sql.join(parts, sql` OR `)})`;
  }

  // Xem được kho cho chủ hàng này; trả quyền xem giá vốn.
  private async requireVisible(actor: Actor, warehouseId: string, companyId: string): Promise<boolean> {
    const { operable, ownerView } = await this.warehouses.stockScope(actor);
    if (!operable.includes(warehouseId) && !(ownerView.includes(warehouseId) && companyId === actor.companyId)) throw new ApiError("NOT_FOUND", "notFound");
    return (await this.warehouses.costVisibility(actor))({ warehouse_id: warehouseId, company_id: companyId });
  }
}
