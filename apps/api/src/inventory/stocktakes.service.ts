// Kiểm kê (CHUC_NANG_42; QUYTAC_NGHIEPVU_53; API_67; TIEUCHI_NGHIEMTHU_70).
// Bắt đầu: chụp tồn sổ sách, khóa mặt hàng (và vị trí) trong phạm vi. Kết thúc: chênh lệch sinh phiếu điều chỉnh đi luồng duyệt,
// dòng thiếu ghi người chịu trách nhiệm, tiền bồi thường (mặc định bằng giá trị thiếu).
import { Inject, Injectable } from "@nestjs/common";
import type { createStocktakeSchema, finishStocktakeSchema, saveStocktakeCountsSchema, StocktakeListItem, StocktakeOptionsResponse, StocktakeResponse, stockDocumentLineSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { inventoryAudit, inventoryPermissions } from "./inventory-context";
import { StockDocumentsService } from "./stock-documents.service";
import { pgArray, type Executor } from "./stock-ledger.service";
import { WarehousesService } from "./warehouses.service";

type StocktakeRow = {
  id: string;
  stocktake_no: string | null;
  warehouse_id: string;
  warehouse_name: string;
  company_id: string;
  company_name: string;
  scope_type: StocktakeListItem["scopeType"];
  scope_ids: string[];
  note: string | null;
  status: StocktakeListItem["status"];
  adjustment_document_id: string | null;
  adjustment_document_no: string | null;
  line_count: number;
  counted_count: number;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  version: number;
};

type LineRow = {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  option_values: string[];
  tracks_lots: boolean;
  tracks_serials: boolean;
  base_unit_id: string;
  base_unit_name: string;
  lot_id: string | null;
  lot_no: string | null;
  expires_on: string | null;
  location_id: string | null;
  location_code: string | null;
  system_quantity: string;
  counted_quantity: string | null;
  counted_serials: string[] | null;
  unit_cost: string;
  responsible_user_id: string | null;
  compensation_amount: string | null;
};

const decimal = (value: string | null) => (value === null ? null : trimDecimal(value));
const stocktakeTypeCode = "inventory.stocktake";

@Injectable()
export class StocktakesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly warehouses: WarehousesService,
    private readonly documents: StockDocumentsService,
    private readonly sequences: NumberSequencesService,
  ) {}

  async list(actor: Actor): Promise<StocktakeListItem[]> {
    const { operable } = await this.warehouses.stockScope(actor);
    if (operable.length === 0) return [];
    const rows = await this.database.execute<StocktakeRow>(sql`${this.select()} WHERE s.warehouse_id = ANY(${pgArray(operable)}::uuid[]) ORDER BY s.created_at DESC LIMIT 200`);
    return rows.rows.map((row) => this.toItem(row));
  }

  async detail(actor: Actor, id: string): Promise<StocktakeResponse> {
    const row = await this.visibleRow(actor, id);
    const showCost = (await this.warehouses.costVisibility(actor))({ warehouse_id: row.warehouse_id, company_id: row.company_id });
    const canManage = (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "branch", ...(await this.branchOf(row.warehouse_id)) })).has(inventoryPermissions.manageStocktakes);
    const lines = await this.lines(this.database, id);
    return {
      ...this.toItem(row),
      scopeIds: row.scope_ids,
      note: row.note,
      adjustmentDocumentId: row.adjustment_document_id,
      adjustmentDocumentNo: row.adjustment_document_no,
      lines: lines.map((line) => {
        const difference = line.counted_quantity === null ? null : Number(line.counted_quantity) - Number(line.system_quantity);
        return {
          id: line.id,
          variantId: line.variant_id,
          sku: line.sku,
          productName: line.product_name,
          optionValues: line.option_values,
          tracksSerials: line.tracks_serials,
          baseUnitName: line.base_unit_name,
          lotId: line.lot_id,
          lotNo: line.lot_no,
          expiresOn: line.expires_on,
          locationId: line.location_id,
          locationCode: line.location_code,
          systemQuantity: trimDecimal(line.system_quantity),
          countedQuantity: decimal(line.counted_quantity),
          countedSerials: line.counted_serials,
          difference: difference === null ? null : trimDecimal(difference.toFixed(4)),
          unitCost: showCost ? trimDecimal(line.unit_cost) : null,
          differenceValue: showCost && difference !== null ? trimDecimal((difference * Number(line.unit_cost)).toFixed(4)) : null,
          responsibleUserId: line.responsible_user_id,
          compensationAmount: showCost ? decimal(line.compensation_amount) : null,
        };
      }),
      version: row.version,
      canManage,
    };
  }

  async options(actor: Actor, warehouseId: string): Promise<StocktakeOptionsResponse> {
    // Dùng cả khi lập kiểm kê và khi nhận chuyển kho (chọn người chịu trách nhiệm phần thiếu).
    const warehouse = await this.warehouses.operable(actor.userId, warehouseId, inventoryPermissions.access);
    const categories = await this.database.execute<{ id: string; code: string; name_vi: string }>(sql`SELECT id, code, name_vi FROM catalog.categories WHERE status = 'active' ORDER BY code`);
    const users = await this.database.execute<{ id: string; full_name: string }>(sql`
      SELECT u.id, u.full_name FROM core.users u JOIN core.user_company_memberships m ON m.user_id = u.id
      WHERE m.company_id = ${warehouse.companyId} AND m.status = 'active' AND u.status = 'active' ORDER BY u.full_name`);
    return { categories: categories.rows.map((row) => ({ id: row.id, code: row.code, name: row.name_vi })), users: users.rows.map((row) => ({ id: row.id, fullName: row.full_name })) };
  }

  async create(actor: Actor, input: z.output<typeof createStocktakeSchema>): Promise<StocktakeResponse> {
    const warehouse = await this.warehouses.operable(actor.userId, input.warehouseId, inventoryPermissions.manageStocktakes);
    const fields: Record<string, keyof Messages["errors"]> = {};
    if (!warehouse.ownerIds.includes(input.companyId)) fields.companyId = "warehouseOwnerNotAllowed";
    if (input.scopeType === "full" ? input.scopeIds.length > 0 : input.scopeIds.length === 0) fields.scopeIds = input.scopeType === "full" ? "invalidValue" : "required";
    if (input.scopeType === "locations" && !warehouse.usesLocations) fields.scopeType = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const id = await this.database.transaction(async (transaction) => {
      const stocktakeId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO inventory.stocktakes (company_id, warehouse_id, scope_type, scope_ids, note, created_by)
        VALUES (${input.companyId}, ${input.warehouseId}, ${input.scopeType}, ${pgArray(input.scopeIds)}::uuid[], ${input.note ?? null}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...inventoryAudit(actor, "stocktake"), companyId: input.companyId, action: "stocktake.create", entityId: stocktakeId, afterData: input }, transaction);
      return stocktakeId;
    });
    return this.detail(actor, id);
  }

  // Bắt đầu đếm: cấp số, chụp tồn sổ sách (dòng tồn lớn hơn 0 trong phạm vi), từ đây mặt hàng trong phạm vi bị khóa.
  async start(actor: Actor, id: string): Promise<StocktakeResponse> {
    const row = await this.requireManaged(actor, id);
    if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "stocktakeNotDraft");
    const configured = await this.database.execute(sql`SELECT 1 FROM core.number_sequences WHERE company_id = ${row.company_id} AND document_type_code = ${stocktakeTypeCode} LIMIT 1`);
    if (configured.rows.length === 0) await this.sequences.update({ ...actor, companyId: row.company_id }, stocktakeTypeCode, { prefix: "KK", resetPeriod: "year", padding: 6 });
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.stocktakes WHERE id = ${id} AND status = 'draft' FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const stocktakeNo = await this.sequences.next(row.company_id, stocktakeTypeCode, transaction);
      const scope = this.scopeCondition(row);
      // Khóa dòng giá vốn của mặt hàng trong phạm vi: phiếu đang ghi sổ (khóa dòng này trước) phải xong trước khi chụp tồn,
      // phiếu đến sau thấy kiểm kê đang đếm và bị từ chối.
      await transaction.execute(sql`
        SELECT 1 FROM inventory.costs c JOIN catalog.variants v ON v.id = c.variant_id JOIN catalog.products p ON p.id = v.product_id
        WHERE c.warehouse_id = ${row.warehouse_id} AND c.company_id = ${row.company_id}
          AND EXISTS (SELECT 1 FROM inventory.balances b WHERE b.warehouse_id = c.warehouse_id AND b.company_id = c.company_id AND b.variant_id = c.variant_id AND ${scope})
        ORDER BY c.variant_id FOR UPDATE OF c`);
      await transaction.execute(sql`
        INSERT INTO inventory.stocktake_lines (stocktake_id, variant_id, lot_id, location_id, system_quantity, unit_cost)
        SELECT ${id}, b.variant_id, b.lot_id, b.location_id, b.quantity, coalesce(c.average_cost, 0)
        FROM inventory.balances b JOIN catalog.variants v ON v.id = b.variant_id JOIN catalog.products p ON p.id = v.product_id
        LEFT JOIN inventory.costs c ON c.warehouse_id = b.warehouse_id AND c.company_id = b.company_id AND c.variant_id = b.variant_id
        WHERE b.warehouse_id = ${row.warehouse_id} AND b.company_id = ${row.company_id} AND b.quantity > 0 AND ${scope}`);
      // Kiểm theo danh sách sản phẩm: mặt hàng không còn tồn vẫn có dòng để ghi số đếm thực tế.
      if (row.scope_type === "variants") {
        await transaction.execute(sql`
          INSERT INTO inventory.stocktake_lines (stocktake_id, variant_id, system_quantity, unit_cost)
          SELECT ${id}, v.id, 0, coalesce((SELECT c.average_cost FROM inventory.costs c WHERE c.warehouse_id = ${row.warehouse_id} AND c.company_id = ${row.company_id} AND c.variant_id = v.id), 0)
          FROM catalog.variants v WHERE v.id = ANY(${pgArray(row.scope_ids)}::uuid[]) AND v.company_id = ${row.company_id}
            AND NOT EXISTS (SELECT 1 FROM inventory.stocktake_lines l WHERE l.stocktake_id = ${id} AND l.variant_id = v.id)`);
      }
      // Hai lần kiểm kê đang đếm không được trùng mặt hàng, vị trí (tránh hai phiếu điều chỉnh cho cùng chênh lệch).
      const overlap = await transaction.execute(sql`
        SELECT 1 FROM inventory.stocktake_lines mine JOIN inventory.stocktake_lines other ON other.variant_id = mine.variant_id
          AND (other.location_id IS NULL OR mine.location_id IS NULL OR other.location_id = mine.location_id)
        JOIN inventory.stocktakes s ON s.id = other.stocktake_id
        WHERE mine.stocktake_id = ${id} AND s.id <> ${id} AND s.status = 'counting' AND s.warehouse_id = ${row.warehouse_id} AND s.company_id = ${row.company_id} LIMIT 1`);
      if (overlap.rows.length > 0) throw new ApiError("BUSINESS_RULE", "stocktakeOverlaps");
      await transaction.execute(sql`
        UPDATE inventory.stocktakes SET status = 'counting', stocktake_no = ${stocktakeNo}, started_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...inventoryAudit(actor, "stocktake"), companyId: row.company_id, action: "stocktake.start", entityId: id, afterData: { stocktakeNo } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Ghi số đếm; được ghi nhiều lần trong lúc đếm. Hàng thực tế có mà sổ sách không có thì thêm dòng mới (tồn sổ sách 0).
  async saveCounts(actor: Actor, id: string, input: z.output<typeof saveStocktakeCountsSchema>): Promise<StocktakeResponse> {
    const row = await this.requireManaged(actor, id);
    if (row.status !== "counting") throw new ApiError("BUSINESS_RULE", "stocktakeNotCounting");
    const warehouse = (await this.warehouses.find(row.warehouse_id))!;
    const lines = await this.lines(this.database, id);
    const locations = new Set(
      (await this.database.execute<{ id: string }>(sql`SELECT id FROM inventory.locations WHERE warehouse_id = ${row.warehouse_id} AND status = 'active'`)).rows.map((item) => item.id),
    );
    const fields: Record<string, keyof Messages["errors"]> = {};
    for (const [index, count] of input.counts.entries()) {
      const at = (field: string) => `counts.${index}.${field}`;
      const line = count.lineId ? lines.find((item) => item.id === count.lineId) : undefined;
      if (count.lineId && !line) fields[at("lineId")] = "invalidValue";
      const tracksSerials = line?.tracks_serials ?? (await this.variantTracksSerials(count.variantId ?? null, row.company_id));
      if (tracksSerials === null) fields[at("variantId")] = "stockItemNotOwned";
      if (tracksSerials) {
        if (!count.serials || count.serials.length !== Number(count.countedQuantity)) fields[at("serials")] = "serialCountMismatch";
        else if (new Set(count.serials).size !== count.serials.length) fields[at("serials")] = "serialDuplicate";
      }
      if (!line) {
        if (warehouse.usesLocations && (!count.locationId || !locations.has(count.locationId))) fields[at("locationId")] = count.locationId ? "invalidValue" : "required";
        if (!warehouse.usesLocations && count.locationId) fields[at("locationId")] = "invalidValue";
        const tracksLots = count.variantId ? await this.variantTracksLots(count.variantId, row.company_id) : false;
        if (count.lotId) {
          const lot = await this.database.execute(sql`SELECT 1 FROM inventory.lots WHERE id = ${count.lotId} AND variant_id = ${count.variantId ?? null} AND company_id = ${row.company_id}`);
          if (lot.rows.length === 0) fields[at("lotId")] = "invalidValue";
        } else if (tracksLots && Number(count.countedQuantity) > 0) {
          fields[at("lotId")] = "stocktakeLotRequired";
        }
      } else if (line.tracks_lots && !line.lot_id && Number(count.countedQuantity) > 0) {
        // Dòng không có lô của hàng theo lô (kiểm theo danh sách khi hết tồn): số đếm phải ghi theo lô đã có.
        fields[at("countedQuantity")] = "stocktakeLotRequired";
      }
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      for (const count of input.counts) {
        const serials = count.serials ? pgArray(count.serials) : null;
        if (count.lineId) {
          await transaction.execute(sql`
            UPDATE inventory.stocktake_lines SET counted_quantity = ${count.countedQuantity}::numeric, counted_serials = ${serials}::text[] WHERE id = ${count.lineId} AND stocktake_id = ${id}`);
          continue;
        }
        const existing = lines.find((line) => line.variant_id === count.variantId && line.lot_id === (count.lotId ?? null) && line.location_id === (count.locationId ?? null));
        if (existing) {
          await transaction.execute(sql`UPDATE inventory.stocktake_lines SET counted_quantity = ${count.countedQuantity}::numeric, counted_serials = ${serials}::text[] WHERE id = ${existing.id}`);
        } else {
          await transaction.execute(sql`
            INSERT INTO inventory.stocktake_lines (stocktake_id, variant_id, lot_id, location_id, system_quantity, counted_quantity, counted_serials, unit_cost)
            VALUES (${id}, ${count.variantId!}, ${count.lotId ?? null}, ${count.locationId ?? null}, 0, ${count.countedQuantity}::numeric, ${serials}::text[],
              coalesce((SELECT average_cost FROM inventory.costs WHERE warehouse_id = ${row.warehouse_id} AND company_id = ${row.company_id} AND variant_id = ${count.variantId!}), 0))`);
        }
      }
      await transaction.execute(sql`UPDATE inventory.stocktakes SET version = version + 1 WHERE id = ${id}`);
    });
    return this.detail(actor, id);
  }

  // Kết thúc: mọi dòng phải có số đếm; chênh lệch sinh phiếu điều chỉnh rồi gửi duyệt (chưa có chính sách thì ghi sổ ngay).
  async finish(actor: Actor, id: string, input: z.output<typeof finishStocktakeSchema>): Promise<StocktakeResponse> {
    const row = await this.requireManaged(actor, id);
    if (row.status !== "counting") throw new ApiError("BUSINESS_RULE", "stocktakeNotCounting");
    if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    const lines = await this.lines(this.database, id);
    if (lines.some((line) => line.counted_quantity === null)) throw new ApiError("BUSINESS_RULE", "stocktakeNotFullyCounted");
    const responsibilities = new Map(input.responsibilities.map((item) => [item.lineId, item]));
    const adjustment: z.output<typeof stockDocumentLineSchema>[] = [];
    for (const line of lines) {
      const responsibility = responsibilities.get(line.id);
      const base = { variantId: line.variant_id, unitId: line.base_unit_id, locationId: line.location_id, manufacturedOn: null, destinationLocationId: null };
      const shortage = (amount: number, serials: string[] = []) => ({
        ...base,
        quantity: `-${amount.toFixed(4)}`,
        unitCost: null,
        lotId: line.lot_id,
        lotNo: null,
        expiresOn: null,
        lotOverrideReason: line.lot_id ? "Kiểm kê" : null,
        serials,
        responsibleUserId: responsibility?.responsibleUserId ?? null,
        compensationAmount:
          responsibility?.compensationAmount !== undefined && responsibility.compensationAmount !== null ? String(responsibility.compensationAmount) : (amount * Number(line.unit_cost)).toFixed(4),
      });
      const surplus = (amount: number, serials: string[] = []) => ({
        ...base,
        quantity: amount.toFixed(4),
        unitCost: line.unit_cost,
        lotId: null,
        lotNo: line.lot_no,
        expiresOn: line.expires_on,
        lotOverrideReason: null,
        serials,
        responsibleUserId: null,
        compensationAmount: null,
      });
      if (line.tracks_serials) {
        const inStock = (
          await this.database.execute<{ serial_no: string }>(sql`
          SELECT serial_no FROM inventory.serials WHERE warehouse_id = ${row.warehouse_id} AND company_id = ${row.company_id} AND variant_id = ${line.variant_id}
            AND status = 'in_stock' AND location_id IS NOT DISTINCT FROM ${line.location_id}`)
        ).rows.map((item) => item.serial_no);
        const counted = line.counted_serials ?? [];
        const missing = inStock.filter((serial) => !counted.includes(serial));
        const extra = counted.filter((serial) => !inStock.includes(serial));
        if (missing.length > 0) adjustment.push(shortage(missing.length, missing));
        if (extra.length > 0) adjustment.push(surplus(extra.length, extra));
        continue;
      }
      const difference = Number(line.counted_quantity) - Number(line.system_quantity);
      if (difference < 0) adjustment.push(shortage(-difference));
      if (difference > 0) adjustment.push(surplus(difference));
    }
    const ownerActor: Actor = { ...actor, companyId: row.company_id };
    const documentId = await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM inventory.stocktakes WHERE id = ${id} AND status = 'counting' AND version = ${input.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      for (const line of lines) {
        const responsibility = responsibilities.get(line.id);
        if (responsibility) {
          await transaction.execute(sql`
            UPDATE inventory.stocktake_lines SET responsible_user_id = ${responsibility.responsibleUserId}, compensation_amount = ${responsibility.compensationAmount ?? null}::numeric WHERE id = ${line.id}`);
        }
      }
      const adjustmentId =
        adjustment.length === 0
          ? null
          : await this.documents.createWithin(
              transaction,
              ownerActor,
              {
                type: "adjustment",
                warehouseId: row.warehouse_id,
                companyId: row.company_id,
                documentDate: this.permissionService.today(),
                reasonCode: "stocktake",
                reason: `Kiểm kê ${row.stocktake_no ?? ""}`.trim(),
                note: row.note,
                lines: adjustment,
              },
              id,
            );
      await transaction.execute(sql`
        UPDATE inventory.stocktakes SET status = 'finished', finished_at = now(), adjustment_document_id = ${adjustmentId}, version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...inventoryAudit(actor, "stocktake"), companyId: row.company_id, action: "stocktake.finish", entityId: id, afterData: { adjustmentId } }, transaction);
      return adjustmentId;
    });
    if (documentId) {
      try {
        const document = (
          await this.database.execute<{ id: string; type: "adjustment"; company_id: string; warehouse_id: string; reason_code: string; stocktake_id: string | null; version: number }>(sql`
          SELECT id, type, company_id, warehouse_id, reason_code, stocktake_id, version FROM inventory.documents WHERE id = ${documentId}`)
        ).rows[0]!;
        await this.documents.submitDocument(actor, document);
      } catch (error) {
        // Gửi phiếu điều chỉnh lỗi (ví dụ hàng đang được giữ): trả kiểm kê về trạng thái đang đếm để sửa rồi kết thúc lại.
        await this.database.transaction(async (transaction) => {
          await transaction.execute(sql`UPDATE inventory.stocktakes SET status = 'counting', finished_at = NULL, adjustment_document_id = NULL, version = version + 1 WHERE id = ${id}`);
          await transaction.execute(sql`DELETE FROM inventory.documents WHERE id = ${documentId}`);
        });
        throw error;
      }
    }
    return this.detail(actor, id);
  }

  async cancel(actor: Actor, id: string): Promise<StocktakeResponse> {
    const row = await this.requireManaged(actor, id);
    if (row.status !== "draft" && row.status !== "counting") throw new ApiError("BUSINESS_RULE", "stocktakeNotCounting");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE inventory.stocktakes SET status = 'cancelled', finished_at = now(), version = version + 1 WHERE id = ${id} AND status IN ('draft', 'counting') RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "stocktakeNotCounting");
      await this.auditService.record({ ...inventoryAudit(actor, "stocktake"), companyId: row.company_id, action: "stocktake.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  private scopeCondition(row: StocktakeRow): SQL {
    const ids = pgArray(row.scope_ids);
    if (row.scope_type === "categories") return sql`p.category_id = ANY(${ids}::uuid[])`;
    if (row.scope_type === "locations") return sql`b.location_id = ANY(${ids}::uuid[])`;
    if (row.scope_type === "variants") return sql`b.variant_id = ANY(${ids}::uuid[])`;
    return sql`TRUE`;
  }

  private async variantTracksLots(variantId: string, companyId: string): Promise<boolean> {
    const row = (
      await this.database.execute<{ tracks_lots: boolean }>(sql`
      SELECT p.tracks_lots FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${variantId} AND v.company_id = ${companyId}`)
    ).rows[0];
    return row?.tracks_lots ?? false;
  }

  private async variantTracksSerials(variantId: string | null, companyId: string): Promise<boolean | null> {
    if (!variantId) return null;
    const row = (
      await this.database.execute<{ tracks_serials: boolean }>(sql`
      SELECT p.tracks_serials FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${variantId} AND v.company_id = ${companyId}`)
    ).rows[0];
    return row ? row.tracks_serials : null;
  }

  private async lines(executor: Executor, id: string): Promise<LineRow[]> {
    return (
      await executor.execute<LineRow>(sql`
      SELECT l.id, l.variant_id, v.sku, p.name AS product_name, v.option_values, p.tracks_lots, p.tracks_serials, p.base_unit_id, u.name_vi AS base_unit_name,
        l.lot_id, lot.lot_no, lot.expires_on::text, l.location_id, loc.code AS location_code, l.system_quantity::text, l.counted_quantity::text, l.counted_serials,
        l.unit_cost::text, l.responsible_user_id, l.compensation_amount::text
      FROM inventory.stocktake_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = p.base_unit_id
      LEFT JOIN inventory.lots lot ON lot.id = l.lot_id LEFT JOIN inventory.locations loc ON loc.id = l.location_id
      WHERE l.stocktake_id = ${id} ORDER BY loc.code NULLS FIRST, v.sku, lot.expires_on NULLS LAST`)
    ).rows;
  }

  private async branchOf(warehouseId: string): Promise<{ companyId: string; branchId: string }> {
    const warehouse = (await this.warehouses.find(warehouseId))!;
    return { companyId: warehouse.companyId, branchId: warehouse.branchId };
  }

  private async visibleRow(actor: Actor, id: string): Promise<StocktakeRow> {
    const { operable } = await this.warehouses.stockScope(actor);
    const row = (await this.database.execute<StocktakeRow>(sql`${this.select()} WHERE s.id = ${id}`)).rows[0];
    if (!row || !operable.includes(row.warehouse_id)) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async requireManaged(actor: Actor, id: string): Promise<StocktakeRow> {
    const row = await this.visibleRow(actor, id);
    await this.warehouses.operable(actor.userId, row.warehouse_id, inventoryPermissions.manageStocktakes);
    return row;
  }

  private toItem(row: StocktakeRow): StocktakeListItem {
    return {
      id: row.id,
      stocktakeNo: row.stocktake_no,
      warehouseId: row.warehouse_id,
      warehouseName: row.warehouse_name,
      companyId: row.company_id,
      companyName: row.company_name,
      scopeType: row.scope_type,
      status: row.status,
      lineCount: row.line_count,
      countedCount: row.counted_count,
      createdByName: row.created_by_name,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private select() {
    return sql`
      SELECT s.id, s.stocktake_no, s.warehouse_id, w.name AS warehouse_name, s.company_id, c.short_name AS company_name, s.scope_type, s.scope_ids, s.note, s.status,
        s.adjustment_document_id, d.document_no AS adjustment_document_no,
        (SELECT count(*)::int FROM inventory.stocktake_lines l WHERE l.stocktake_id = s.id) AS line_count,
        (SELECT count(*)::int FROM inventory.stocktake_lines l WHERE l.stocktake_id = s.id AND l.counted_quantity IS NOT NULL) AS counted_count,
        s.created_by, u.full_name AS created_by_name, s.created_at, s.version
      FROM inventory.stocktakes s JOIN inventory.warehouses w ON w.id = s.warehouse_id JOIN core.companies c ON c.id = s.company_id
      JOIN core.users u ON u.id = s.created_by LEFT JOIN inventory.documents d ON d.id = s.adjustment_document_id`;
  }
}
