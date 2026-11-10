// Bảng giá mua theo nhà cung cấp, danh sách chọn, cài đặt mua hàng (CHUC_NANG_49; QUYTAC_NGHIEPVU_61, 64; API_73, API_75).
import { Inject, Injectable } from "@nestjs/common";
import type {
  PageResponse,
  PurchasingOptionsResponse,
  PurchasingSettingsResponse,
  saveSupplierPriceSchema,
  StockItemOption,
  supplierPriceListQuerySchema,
  SupplierPriceLookupResponse,
  SupplierPriceResponse,
  updatePurchasingSettingsSchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { searchVariantOptions } from "../catalog/variant-search";
import { internalCompanyOf } from "../crm/partners.service";
import { internalPrice } from "../sales/internal-trade-rules";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { isActiveSupplier, purchasingAudit, purchasingPermissions, requirePermission, variantUnitFactor, type Executor, type FieldErrors } from "./purchasing-context";

type Input = z.output<typeof saveSupplierPriceSchema>;
type PriceRow = {
  id: string;
  supplier_id: string;
  supplier_code: string;
  supplier_name: string;
  variant_id: string;
  sku: string;
  product_name: string;
  option_values: string[];
  unit_id: string;
  unit_name: string;
  min_quantity: string;
  unit_price: string;
  supplier_sku: string | null;
  valid_from: Date | string;
  valid_to: Date | string | null;
  status: "active" | "inactive";
  version: number;
};

const anyPurchasingPermission = [purchasingPermissions.managePrices, purchasingPermissions.createRequisition, purchasingPermissions.viewOrders, purchasingPermissions.manageOrders];

@Injectable()
export class SupplierPricesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: Actor, query: z.output<typeof supplierPriceListQuerySchema>): Promise<PageResponse<SupplierPriceResponse>> {
    await requirePermission(this.permissionService, actor, ...anyPurchasingPermission);
    const conditions: SQL[] = [sql`sp.company_id = ${actor.companyId}`];
    if (query.supplierId) conditions.push(sql`sp.supplier_id = ${query.supplierId}`);
    if (query.status) conditions.push(sql`sp.status = ${query.status}`);
    if (query.search) {
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(v.sku = ${query.search.toUpperCase()} OR p.search_text LIKE ${pattern} OR sp.supplier_sku = ${query.search})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<PriceRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY sp.status, s.name, v.sku, sp.min_quantity, sp.valid_from DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map(toResponse), page: query.page, pageSize: query.pageSize, total };
  }

  async create(actor: Actor, input: Input): Promise<SupplierPriceResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.managePrices);
    const id = await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input, null);
      const priceId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO purchasing.supplier_prices (company_id, supplier_id, variant_id, unit_id, min_quantity, unit_price, supplier_sku, valid_from, valid_to, created_by)
        VALUES (${actor.companyId}, ${input.supplierId}, ${input.variantId}, ${input.unitId}, ${input.minQuantity}::numeric, ${input.unitPrice}::numeric, ${input.supplierSku},
          ${input.validFrom}::date, ${input.validTo ?? null}::date, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...purchasingAudit(actor, "supplier_price"), action: "supplier_price.create", entityId: priceId, afterData: input }, transaction);
      return priceId;
    });
    return this.single(actor.companyId, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<SupplierPriceResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.managePrices);
    const before = await this.single(actor.companyId, id);
    await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input, id);
      const updated = await transaction.execute(sql`
        UPDATE purchasing.supplier_prices SET supplier_id = ${input.supplierId}, variant_id = ${input.variantId}, unit_id = ${input.unitId}, min_quantity = ${input.minQuantity}::numeric,
          unit_price = ${input.unitPrice}::numeric, supplier_sku = ${input.supplierSku}, valid_from = ${input.validFrom}::date, valid_to = ${input.validTo ?? null}::date,
          updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version ?? 0} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...purchasingAudit(actor, "supplier_price"), action: "supplier_price.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(actor.companyId, id);
  }

  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<SupplierPriceResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.managePrices);
    const before = await this.single(actor.companyId, id);
    await this.database.transaction(async (transaction) => {
      if (status === "active") {
        await this.validate(transaction, actor.companyId, { ...before, minQuantity: before.minQuantity, unitPrice: before.unitPrice, validTo: before.validTo, version }, id);
      }
      const updated = await transaction.execute(sql`
        UPDATE purchasing.supplier_prices SET status = ${status}, updated_at = now(), version = version + 1 WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        { ...purchasingAudit(actor, "supplier_price"), action: `supplier_price.${status === "inactive" ? "deactivate" : "activate"}`, entityId: id, afterData: { status } },
        transaction,
      );
    });
    return this.single(actor.companyId, id);
  }

  // Giá có hiệu lực tại ngày, số lượng tối thiểu lớn nhất không vượt số lượng đặt (QUYTAC_NGHIEPVU_61).
  async lookup(executor: Executor, companyId: string, supplierId: string, variantId: string, unitId: string, quantity: string, date: string): Promise<SupplierPriceLookupResponse> {
    const row = (
      await executor.execute<{ id: string; unit_price: string }>(sql`
      SELECT id, unit_price::text FROM purchasing.supplier_prices
      WHERE company_id = ${companyId} AND supplier_id = ${supplierId} AND variant_id = ${variantId} AND unit_id = ${unitId} AND status = 'active'
        AND valid_from <= ${date}::date AND (valid_to IS NULL OR valid_to >= ${date}::date) AND min_quantity <= ${quantity}::numeric
      ORDER BY min_quantity DESC, valid_from DESC LIMIT 1`)
    ).rows[0];
    return { unitPrice: row ? trimDecimal(row.unit_price) : null, priceId: row?.id ?? null };
  }

  async lookupFor(actor: Actor, supplierId: string, variantId: string, unitId: string, quantity: string | undefined, date: string | undefined): Promise<SupplierPriceLookupResponse> {
    await requirePermission(this.permissionService, actor, ...anyPurchasingPermission);
    const quantityText = quantity && /^\d{1,12}(\.\d{1,4})?$/.test(quantity) ? quantity : "0";
    // Nhà cung cấp nội bộ: giá theo bảng giá kênh Nội bộ của công ty bán, không sửa tay (QUYTAC_NGHIEPVU_75).
    const sellerCompanyId = await internalCompanyOf(this.database, supplierId);
    if (sellerCompanyId) {
      const price = await internalPrice(this.database, actor.companyId, sellerCompanyId, variantId, unitId, date ?? this.permissionService.today());
      return { unitPrice: price?.unitPrice ?? null, priceId: null, internal: { vatRate: price?.vatRate ?? "10" } };
    }
    return this.lookup(this.database, actor.companyId, supplierId, variantId, unitId, quantityText, date ?? this.permissionService.today());
  }

  async options(actor: Actor): Promise<PurchasingOptionsResponse> {
    await requirePermission(this.permissionService, actor, ...anyPurchasingPermission);
    const suppliers = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT p.id, p.code, p.name FROM crm.partners p JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}
      WHERE p.status = 'active' AND pr.status = 'active' AND pr.is_supplier ORDER BY p.name`);
    const warehouses = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT w.id, w.code, w.name FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
      WHERE o.company_id = ${actor.companyId} AND w.status = 'active' ORDER BY w.code`);
    const currency = (await this.database.execute<{ base_currency: string }>(sql`SELECT base_currency FROM core.companies WHERE id = ${actor.companyId}`)).rows[0]!.base_currency;
    return { suppliers: suppliers.rows, warehouses: warehouses.rows, currency };
  }

  async searchItems(actor: Actor, search: string): Promise<StockItemOption[]> {
    await requirePermission(this.permissionService, actor, ...anyPurchasingPermission);
    return searchVariantOptions(this.database, actor.companyId, search);
  }

  async settings(actor: Actor): Promise<PurchasingSettingsResponse> {
    await requirePermission(this.permissionService, actor, ...anyPurchasingPermission);
    return readSettings(this.database, actor.companyId);
  }

  async updateSettings(actor: Actor, input: z.output<typeof updatePurchasingSettingsSchema>): Promise<PurchasingSettingsResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageSettings);
    const before = await readSettings(this.database, actor.companyId);
    if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.database.transaction(async (transaction) => {
      const saved = await transaction.execute(sql`
        INSERT INTO purchasing.settings (company_id, over_receipt_tolerance_percent, updated_by) VALUES (${actor.companyId}, ${input.overReceiptTolerancePercent}::numeric, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET over_receipt_tolerance_percent = EXCLUDED.over_receipt_tolerance_percent, updated_by = EXCLUDED.updated_by, updated_at = now(),
          version = purchasing.settings.version + 1
        WHERE purchasing.settings.version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        { ...purchasingAudit(actor, "purchasing_settings"), action: "purchasing_settings.update", entityId: actor.companyId, beforeData: before, afterData: input },
        transaction,
      );
    });
    return readSettings(this.database, actor.companyId);
  }

  // Không có hai giá đang dùng cùng nhà cung cấp, mặt hàng, đơn vị, số lượng tối thiểu chồng hiệu lực; khóa theo khóa giá để hai người lưu cùng lúc không lọt.
  private async validate(transaction: Executor, companyId: string, input: Input, exceptId: string | null): Promise<void> {
    const fields: FieldErrors = {};
    if (!(await isActiveSupplier(transaction, companyId, input.supplierId))) fields.supplierId = "supplierNotActive";
    if (!(await variantUnitFactor(transaction, companyId, input.variantId, input.unitId))) fields.unitId = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`supplier_price:${companyId}:${input.supplierId}:${input.variantId}:${input.unitId}`}))`);
    const overlap = await transaction.execute(sql`
      SELECT 1 FROM purchasing.supplier_prices
      WHERE company_id = ${companyId} AND supplier_id = ${input.supplierId} AND variant_id = ${input.variantId} AND unit_id = ${input.unitId}
        AND min_quantity = ${input.minQuantity}::numeric AND status = 'active' AND id IS DISTINCT FROM ${exceptId}
        AND daterange(valid_from, valid_to, '[]') && daterange(${input.validFrom}::date, ${input.validTo ?? null}::date, '[]')`);
    if (overlap.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { validFrom: "supplierPriceOverlaps" } });
  }

  private async single(companyId: string, id: string): Promise<SupplierPriceResponse> {
    const row = (await this.database.execute<PriceRow>(sql`${this.select()} ${this.from()} WHERE sp.id = ${id} AND sp.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  private select(): SQL {
    return sql`SELECT sp.id, sp.supplier_id, s.code AS supplier_code, s.name AS supplier_name, sp.variant_id, v.sku, p.name AS product_name, v.option_values, sp.unit_id,
      u.name_vi AS unit_name, sp.min_quantity::text, sp.unit_price::text, sp.supplier_sku, sp.valid_from, sp.valid_to, sp.status, sp.version`;
  }

  private from(): SQL {
    return sql`FROM purchasing.supplier_prices sp JOIN crm.partners s ON s.id = sp.supplier_id JOIN catalog.variants v ON v.id = sp.variant_id
      JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = sp.unit_id`;
  }
}

export async function readSettings(executor: Executor, companyId: string): Promise<PurchasingSettingsResponse> {
  const row = (
    await executor.execute<{ percent: string; version: number }>(sql`SELECT over_receipt_tolerance_percent::text AS percent, version FROM purchasing.settings WHERE company_id = ${companyId}`)
  ).rows[0];
  return { overReceiptTolerancePercent: row ? trimDecimal(row.percent) : "0", version: row?.version ?? 0 };
}

function toResponse(row: PriceRow): SupplierPriceResponse {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierCode: row.supplier_code,
    supplierName: row.supplier_name,
    variantId: row.variant_id,
    sku: row.sku,
    productName: row.product_name,
    optionValues: row.option_values,
    unitId: row.unit_id,
    unitName: row.unit_name,
    minQuantity: trimDecimal(row.min_quantity),
    unitPrice: trimDecimal(row.unit_price),
    supplierSku: row.supplier_sku,
    validFrom: day(row.valid_from),
    validTo: row.valid_to === null ? null : day(row.valid_to),
    status: row.status,
    version: row.version,
  };
}
