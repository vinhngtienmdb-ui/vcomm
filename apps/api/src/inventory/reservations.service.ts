// Giữ hàng (CHUC_NANG_43; QUYTAC_NGHIEPVU_54): tồn khả dụng = tồn thực − hàng đang giữ. Không giữ quá tồn khả dụng.
// Phiếu kho làm giảm tồn giữ hàng khi gửi duyệt; MODULE_05 giữ hàng cho đơn bán đã xác nhận.
import { Inject, Injectable } from "@nestjs/common";
import type { createReservationSchema, extendReservationSchema, PageResponse, reservationListQuerySchema, ReservationResponse } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { inventoryAudit, inventoryPermissions, requireStockedVariant } from "./inventory-context";
import { pgArray, type Executor } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

type ReservationRow = {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  company_id: string;
  company_name: string;
  variant_id: string;
  sku: string;
  product_name: string;
  quantity: string;
  base_unit_name: string;
  source_type: string;
  source_no: string | null;
  expires_at: Date | null;
  status: ReservationResponse["status"];
  created_by_name: string | null;
  created_at: Date;
  version: number;
};
export const manualSource = "inventory.manual";

export interface ReservationRequest {
  warehouseId: string;
  companyId: string;
  variantId: string;
  quantity: string;
  sourceType: string;
  sourceId: string;
  sourceNo: string | null;
  expiresAt: string | null;
  userId: string | null;
}

@Injectable()
export class ReservationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly warehouses: WarehousesService,
  ) {}

  async list(actor: Actor, query: z.output<typeof reservationListQuerySchema>): Promise<PageResponse<ReservationResponse>> {
    const { operable } = await this.warehouses.stockScope(actor);
    const conditions: SQL[] = [operable.length > 0 ? sql`r.warehouse_id = ANY(${pgArray(operable)}::uuid[])` : sql`FALSE`, sql`r.status = ${query.status ?? "active"}`];
    if (query.warehouseId) conditions.push(sql`r.warehouse_id = ${query.warehouseId}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM inventory.reservations r WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<ReservationRow>(
      sql`${this.select()} WHERE ${where} ORDER BY r.expires_at NULLS LAST, r.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map((row) => this.toResponse(row)), page: query.page, pageSize: query.pageSize, total };
  }

  // Giữ thủ công, hạn giữ theo cài đặt của công ty chủ hàng (QUYTAC_NGHIEPVU_54).
  async create(actor: Actor, input: z.output<typeof createReservationSchema>): Promise<ReservationResponse> {
    const warehouse = await this.warehouses.operable(actor.userId, input.warehouseId, inventoryPermissions.manageReservations);
    if (!warehouse.ownerIds.includes(input.companyId)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { companyId: "warehouseOwnerNotAllowed" } });
    const owned = await this.database.execute(sql`SELECT 1 FROM catalog.variants WHERE id = ${input.variantId} AND company_id = ${input.companyId}`);
    if (owned.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { variantId: "stockItemNotOwned" } });
    const hours = (await this.warehouses.settings(input.companyId)).reservationHours;
    const id = await this.database.transaction(async (transaction) => {
      const sourceId = (await transaction.execute<{ id: string }>(sql`SELECT gen_random_uuid() AS id`)).rows[0]!.id;
      const expiresAt = (await transaction.execute<{ value: string }>(sql`SELECT (now() + make_interval(hours => ${hours}))::text AS value`)).rows[0]!.value;
      const reservationId = await this.reserve(transaction, {
        ...input,
        sourceType: manualSource,
        sourceId,
        sourceNo: input.note,
        expiresAt,
        userId: actor.userId,
      });
      await this.auditService.record({ ...inventoryAudit(actor, "reservation"), companyId: input.companyId, action: "reservation.create", entityId: reservationId, afterData: input }, transaction);
      return reservationId;
    });
    return this.single(id);
  }

  async extend(actor: Actor, id: string, input: z.output<typeof extendReservationSchema>): Promise<ReservationResponse> {
    const row = await this.requireManaged(actor, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.reservations SET expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(hours => ${input.hours}), version = version + 1
        WHERE id = ${id} AND status = 'active' AND expires_at IS NOT NULL AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...inventoryAudit(actor, "reservation"), companyId: row.company_id, action: "reservation.extend", entityId: id, afterData: input }, transaction);
    });
    return this.single(id);
  }

  // Nhả tay chỉ với hàng giữ thủ công hoặc cho đơn bán; hàng giữ cho phiếu kho nhả khi phiếu bị từ chối, rút.
  async release(actor: Actor, id: string, version: number): Promise<ReservationResponse> {
    const row = await this.requireManaged(actor, id);
    if (row.source_type === "inventory.document") throw new ApiError("BUSINESS_RULE", "reservationOwnedByDocument");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.reservations SET status = 'released', released_at = now(), version = version + 1 WHERE id = ${id} AND status = 'active' AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...inventoryAudit(actor, "reservation"), companyId: row.company_id, action: "reservation.release", entityId: id }, transaction);
    });
    return this.single(id);
  }

  // Tác vụ nền mỗi 5 phút: nhả hàng giữ đã hết hạn.
  async releaseExpired(): Promise<number> {
    const released = await this.database.execute(sql`
      UPDATE inventory.reservations SET status = 'released', released_at = now(), version = version + 1
      WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now() RETURNING id`);
    return released.rows.length;
  }

  private async requireManaged(actor: Actor, id: string): Promise<ReservationRow> {
    const row = (await this.database.execute<ReservationRow>(sql`${this.select()} WHERE r.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.manageReservations);
    return row;
  }

  private async single(id: string): Promise<ReservationResponse> {
    return this.toResponse((await this.database.execute<ReservationRow>(sql`${this.select()} WHERE r.id = ${id}`)).rows[0]!);
  }

  private toResponse(row: ReservationRow): ReservationResponse {
    return {
      id: row.id,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      companyId: row.company_id,
      companyName: row.company_name,
      variantId: row.variant_id,
      sku: row.sku,
      productName: row.product_name,
      quantity: trimDecimal(row.quantity),
      baseUnitName: row.base_unit_name,
      sourceType: row.source_type,
      sourceNo: row.source_no,
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      status: row.status,
      createdByName: row.created_by_name,
      createdAt: new Date(row.created_at).toISOString(),
      version: row.version,
    };
  }

  private select() {
    return sql`
      SELECT r.id, r.warehouse_id, w.name AS warehouse_name, r.company_id, c.short_name AS company_name, r.variant_id, v.sku, p.name AS product_name, r.quantity::text,
        u.name_vi AS base_unit_name, r.source_type, r.source_no, r.expires_at, r.status, cu.full_name AS created_by_name, r.created_at, r.version
      FROM inventory.reservations r JOIN inventory.warehouses w ON w.id = r.warehouse_id JOIN core.companies c ON c.id = r.company_id
      JOIN catalog.variants v ON v.id = r.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = p.base_unit_id
      LEFT JOIN core.users cu ON cu.id = r.created_by`;
  }

  // Khóa dòng giá vốn của mặt hàng để hai lần giữ đồng thời không vượt tồn khả dụng.
  async available(transaction: Executor, warehouseId: string, companyId: string, variantId: string, excludeSource?: { type: string; id: string }): Promise<string> {
    await transaction.execute(sql`INSERT INTO inventory.costs (warehouse_id, company_id, variant_id) VALUES (${warehouseId}, ${companyId}, ${variantId}) ON CONFLICT DO NOTHING`);
    const row = (
      await transaction.execute<{ available: string }>(sql`
      WITH locked AS (SELECT quantity FROM inventory.costs WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${variantId} FOR UPDATE)
      SELECT ((SELECT quantity FROM locked) - coalesce((
        SELECT sum(quantity) FROM inventory.reservations
        WHERE warehouse_id = ${warehouseId} AND company_id = ${companyId} AND variant_id = ${variantId} AND status = 'active'
          AND NOT (source_type = ${excludeSource?.type ?? ""} AND source_id IS NOT DISTINCT FROM ${excludeSource?.id ?? null}::uuid)), 0))::text AS available`)
    ).rows[0]!;
    return row.available;
  }

  async reserve(transaction: Executor, request: ReservationRequest): Promise<string> {
    // Dịch vụ không giữ hàng (QUYTAC_NGHIEPVU_275); bên gọi bỏ dòng dịch vụ trước khi giữ.
    await requireStockedVariant(transaction, request.variantId);
    const available = await this.available(transaction, request.warehouseId, request.companyId, request.variantId, { type: request.sourceType, id: request.sourceId });
    if (Number(available) < Number(request.quantity)) throw new ApiError("BUSINESS_RULE", "insufficientAvailableStock");
    const row = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO inventory.reservations (warehouse_id, company_id, variant_id, quantity, source_type, source_id, source_no, expires_at, created_by)
      VALUES (${request.warehouseId}, ${request.companyId}, ${request.variantId}, ${request.quantity}::numeric, ${request.sourceType}, ${request.sourceId}, ${request.sourceNo},
        ${request.expiresAt}::timestamptz, ${request.userId}) RETURNING id`)
    ).rows[0]!;
    return row.id;
  }

  // Nguồn kết thúc: đã dùng (xuất kho) hoặc nhả (từ chối, rút, hủy).
  // Giao hàng theo đơn bán dùng phần đang giữ trước (QUYTAC_NGHIEPVU_70): giảm số giữ của mặt hàng, hết thì đánh dấu đã dùng.
  async consumeFromSource(transaction: Executor, sourceType: string, sourceId: string, warehouseId: string, variantId: string, quantity: string): Promise<void> {
    const rows = await transaction.execute<{ id: string; quantity: string }>(sql`
      SELECT id, quantity::text FROM inventory.reservations
      WHERE source_type = ${sourceType} AND source_id = ${sourceId} AND warehouse_id = ${warehouseId} AND variant_id = ${variantId} AND status = 'active'
      ORDER BY created_at FOR UPDATE`);
    let remaining = Number(quantity);
    for (const row of rows.rows) {
      if (remaining <= 0) break;
      if (Number(row.quantity) <= remaining + 0.00005) {
        await transaction.execute(sql`UPDATE inventory.reservations SET status = 'consumed', released_at = now(), version = version + 1 WHERE id = ${row.id}`);
        remaining -= Number(row.quantity);
      } else {
        await transaction.execute(sql`UPDATE inventory.reservations SET quantity = quantity - ${remaining.toFixed(4)}::numeric, version = version + 1 WHERE id = ${row.id}`);
        remaining = 0;
      }
    }
  }

  async closeBySource(transaction: Executor, sourceType: string, sourceId: string, status: "released" | "consumed"): Promise<void> {
    await transaction.execute(sql`
      UPDATE inventory.reservations SET status = ${status}, released_at = now(), version = version + 1
      WHERE source_type = ${sourceType} AND source_id = ${sourceId} AND status = 'active'`);
  }
}
