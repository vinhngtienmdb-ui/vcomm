// Tồn an toàn, cảnh báo, gợi ý bổ sung (CHUC_NANG_44; QUYTAC_NGHIEPVU_55; API_69; TIEUCHI_NGHIEMTHU_72).
import { Inject, Injectable } from "@nestjs/common";
import type { saveStockLevelSchema, stockLevelQuerySchema, StockLevelRow } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { pgArray } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

type LevelRow = {
  warehouse_id: string;
  warehouse_name: string;
  company_id: string;
  company_name: string;
  variant_id: string;
  sku: string;
  product_name: string;
  base_unit_name: string;
  minimum: string;
  maximum: string;
  available: string;
  incoming: string;
};

@Injectable()
export class StockLevelsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly warehouses: WarehousesService,
  ) {}

  async list(actor: Actor, query: z.output<typeof stockLevelQuerySchema>): Promise<StockLevelRow[]> {
    const { operable } = await this.warehouses.stockScope(actor);
    if (operable.length === 0) return [];
    const conditions: SQL[] = [sql`s.warehouse_id = ANY(${pgArray(operable)}::uuid[])`];
    if (query.warehouseId) conditions.push(sql`s.warehouse_id = ${query.warehouseId}`);
    const rows = await this.rows(sql.join(conditions, sql` AND `));
    return rows.map((row) => this.toResponse(row)).filter((row) => query.onlyAlerts !== "true" || row.belowMinimum);
  }

  async save(actor: Actor, input: z.output<typeof saveStockLevelSchema>): Promise<StockLevelRow> {
    const warehouse = await this.warehouses.operable(actor.userId, input.warehouseId, inventoryPermissions.manageReservations);
    if (!warehouse.ownerIds.includes(input.companyId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { companyId: "warehouseOwnerNotAllowed" } });
    const owned = await this.database.execute(sql`SELECT 1 FROM catalog.variants WHERE id = ${input.variantId} AND company_id = ${input.companyId}`);
    if (owned.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { variantId: "stockItemNotOwned" } });
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        INSERT INTO inventory.stock_levels (warehouse_id, company_id, variant_id, minimum, maximum, updated_by)
        VALUES (${input.warehouseId}, ${input.companyId}, ${input.variantId}, ${input.minimum}::numeric, ${input.maximum}::numeric, ${actor.userId})
        ON CONFLICT (warehouse_id, company_id, variant_id) DO UPDATE SET minimum = EXCLUDED.minimum, maximum = EXCLUDED.maximum, updated_by = EXCLUDED.updated_by, updated_at = now()`);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_level"), companyId: input.companyId, action: "stock_level.save", afterData: input }, transaction);
    });
    const row = (await this.rows(sql`s.warehouse_id = ${input.warehouseId} AND s.company_id = ${input.companyId} AND s.variant_id = ${input.variantId}`))[0]!;
    return this.toResponse(row);
  }

  async remove(actor: Actor, warehouseId: string, companyId: string, variantId: string): Promise<void> {
    await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.manageReservations);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`DELETE FROM inventory.stock_levels WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${variantId}`);
      await this.auditService.record({ ...inventoryAudit(actor, "stock_level"), companyId, action: "stock_level.delete", afterData: { warehouseId, variantId } }, transaction);
    });
  }

  // Tác vụ nền 7 giờ sáng: thông báo số mặt hàng dưới tồn an toàn cho người có quyền quản lý tồn an toàn tại kho.
  async notifyAlerts(): Promise<number> {
    const alerts = (await this.rows(sql`TRUE`)).map((row) => ({ row, response: this.toResponse(row) })).filter((item) => item.response.belowMinimum);
    const byWarehouse = new Map<string, LevelRow[]>();
    for (const item of alerts) byWarehouse.set(item.row.warehouse_id, [...(byWarehouse.get(item.row.warehouse_id) ?? []), item.row]);
    let sent = 0;
    for (const [warehouseId, rows] of byWarehouse) {
      const warehouse = (await this.warehouses.find(warehouseId))!;
      const recipients = await this.database.execute<{ user_id: string }>(sql`
        SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
        WHERE rp.permission_code = ${inventoryPermissions.manageReservations} AND a.valid_from <= current_date AND (a.valid_to IS NULL OR a.valid_to >= current_date)
          AND (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${warehouse.companyId}) OR (a.scope_type = 'branch' AND a.branch_id = ${warehouse.branchId}))`);
      await notify(
        this.database,
        recipients.rows.map((recipient) => ({
          userId: recipient.user_id,
          companyId: warehouse.companyId,
          kind: "inventory_stock_alert",
          title: `${rows[0]!.warehouse_name}: ${rows.length}`,
          link: "/inventory/reservations?tab=levels",
          payload: { warehouse: rows[0]!.warehouse_name, count: rows.length },
        })),
      );
      sent += recipients.rows.length;
    }
    return sent;
  }

  private async rows(condition: SQL): Promise<LevelRow[]> {
    return (
      await this.database.execute<LevelRow>(sql`
      SELECT s.warehouse_id, w.name AS warehouse_name, s.company_id, c.short_name AS company_name, s.variant_id, v.sku, p.name AS product_name, u.name_vi AS base_unit_name,
        s.minimum::text, s.maximum::text,
        (coalesce((SELECT k.quantity FROM inventory.costs k WHERE k.warehouse_id = s.warehouse_id AND k.company_id = s.company_id AND k.variant_id = s.variant_id), 0)
          - coalesce((SELECT sum(r.quantity) FROM inventory.reservations r WHERE r.warehouse_id = s.warehouse_id AND r.company_id = s.company_id AND r.variant_id = s.variant_id AND r.status = 'active'), 0))::text AS available,
        coalesce((SELECT sum(l.base_quantity) FROM inventory.documents d JOIN inventory.document_lines l ON l.document_id = d.id
                  WHERE d.type = 'transfer' AND d.status = 'in_transit' AND d.destination_warehouse_id = s.warehouse_id AND d.company_id = s.company_id AND l.variant_id = s.variant_id), 0)::text AS incoming
      FROM inventory.stock_levels s JOIN inventory.warehouses w ON w.id = s.warehouse_id JOIN core.companies c ON c.id = s.company_id
      JOIN catalog.variants v ON v.id = s.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = p.base_unit_id
      WHERE ${condition} ORDER BY w.code, v.sku`)
    ).rows;
  }

  // Gợi ý = tối đa − (khả dụng + đang chuyển đến) khi dưới tối thiểu (QUYTAC_NGHIEPVU_55).
  private toResponse(row: LevelRow): StockLevelRow {
    const projected = Number(row.available) + Number(row.incoming);
    const belowMinimum = projected < Number(row.minimum);
    return {
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      companyId: row.company_id,
      companyName: row.company_name,
      variantId: row.variant_id,
      sku: row.sku,
      productName: row.product_name,
      baseUnitName: row.base_unit_name,
      minimum: trimDecimal(row.minimum),
      maximum: trimDecimal(row.maximum),
      available: trimDecimal(Number(row.available).toFixed(4)),
      incoming: trimDecimal(row.incoming),
      belowMinimum,
      suggestedQuantity: belowMinimum ? trimDecimal((Number(row.maximum) - projected).toFixed(4)) : "0",
    };
  }
}
