// Bảng giá, giá hiện hành, lịch sử giá, tra giá khi bán (CHUC_NANG_36; QUYTAC_NGHIEPVU_42, 43; API_61; TIEUCHI_NGHIEMTHU_61).
import { Inject, Injectable } from "@nestjs/common";
import type {
  createPriceListSchema,
  PageResponse,
  PriceHistoryItem,
  priceListPricesQuerySchema,
  PriceListResponse,
  priceLookupQuerySchema,
  PriceLookupResponse,
  PriceRow,
  updatePriceListSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { catalogAudit, catalogPermissions, requireCompanyPermission, isUniqueViolation, searchText, trimDecimal } from "./catalog-context";

type PriceListRow = {
  id: string;
  code: string;
  name: string;
  channel_id: string | null;
  channel_name: string | null;
  customer_group_id: string | null;
  customer_group_name: string | null;
  currency: string;
  includes_vat: boolean;
  status: "active" | "inactive";
  version: number;
};

const toResponse = (row: PriceListRow): PriceListResponse => ({
  id: row.id,
  code: row.code,
  name: row.name,
  channelId: row.channel_id,
  channelName: row.channel_name,
  customerGroupId: row.customer_group_id,
  customerGroupName: row.customer_group_name,
  currency: row.currency,
  includesVat: row.includes_vat,
  status: row.status,
  version: row.version,
});

export const day = (value: Date | string) => (value instanceof Date ? new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 10) : String(value).slice(0, 10));

@Injectable()
export class PriceListsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async list(actor: Actor): Promise<PriceListResponse[]> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    return (await this.database.execute<PriceListRow>(sql`${this.select()} WHERE l.company_id = ${actor.companyId} ORDER BY l.status, l.code`)).rows.map(toResponse);
  }

  async create(actor: Actor, input: z.output<typeof createPriceListSchema>): Promise<PriceListResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const errors: Record<string, "invalidValue" | "catalogItemCodeExists" | "priceListDuplicate"> = {};
    if ((await this.database.execute(sql`SELECT 1 FROM catalog.price_lists WHERE company_id = ${actor.companyId} AND code = ${input.code}`)).rows.length > 0) errors.code = "catalogItemCodeExists";
    if (
      input.channelId &&
      (await this.database.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE id = ${input.channelId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0
    ) {
      errors.channelId = "invalidValue";
    }
    if (
      input.customerGroupId &&
      (await this.database.execute(sql`SELECT 1 FROM catalog.customer_groups WHERE id = ${input.customerGroupId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0
    ) {
      errors.customerGroupId = "invalidValue";
    }
    if ((await this.database.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${input.currency} AND is_active`)).rows.length === 0) errors.currency = "invalidValue";
    if (Object.keys(errors).length === 0 && (await this.duplicate(actor.companyId, input.channelId ?? null, input.customerGroupId ?? null, input.currency, null)))
      errors.channelId = "priceListDuplicate";
    if (Object.keys(errors).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: errors });
    const id = await this.database
      .transaction(async (transaction) => {
        const listId = (
          await transaction.execute<{ id: string }>(sql`
        INSERT INTO catalog.price_lists (company_id, code, name, channel_id, customer_group_id, currency, includes_vat, created_by, updated_by)
        VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.channelId ?? null}, ${input.customerGroupId ?? null}, ${input.currency}, ${input.includesVat}, ${actor.userId}, ${actor.userId})
        RETURNING id`)
        ).rows[0]!.id;
        await this.auditService.record({ ...catalogAudit(actor, "price_list"), action: "price_list.create", entityId: listId, afterData: input }, transaction);
        return listId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { channelId: "priceListDuplicate" } });
        throw error;
      });
    return this.single(actor.companyId, id);
  }

  // Kênh, nhóm khách, tiền tệ không đổi sau khi tạo; đổi thì tạo bảng giá mới.
  async update(actor: Actor, id: string, input: z.output<typeof updatePriceListSchema>): Promise<PriceListResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const before = await this.single(actor.companyId, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE catalog.price_lists SET name = ${input.name}, includes_vat = ${input.includesVat}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...catalogAudit(actor, "price_list"), action: "price_list.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(actor.companyId, id);
  }

  async setStatus(actor: Actor, id: string, status: "active" | "inactive", version: number): Promise<PriceListResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.managePrices);
    const before = await this.single(actor.companyId, id);
    // Còn phiếu điều chỉnh giá chờ duyệt thì không ngừng dùng, để giá được duyệt luôn ghi vào bảng giá đang dùng.
    if (status === "inactive" && (await this.database.execute(sql`SELECT 1 FROM catalog.price_changes WHERE price_list_id = ${id} AND status = 'pending' LIMIT 1`)).rows.length > 0) {
      throw new ApiError("BUSINESS_RULE", "priceListHasPendingChanges");
    }
    if (status === "active" && (await this.duplicate(actor.companyId, before.channelId, before.customerGroupId, before.currency, id))) throw new ApiError("BUSINESS_RULE", "priceListDuplicate");
    await this.database
      .transaction(async (transaction) => {
        const updated = await transaction.execute(sql`
        UPDATE catalog.price_lists SET status = ${status}, version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version} RETURNING id`);
        if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await this.auditService.record(
          { ...catalogAudit(actor, "price_list"), action: `price_list.${status === "inactive" ? "deactivate" : "activate"}`, entityId: id, afterData: { status } },
          transaction,
        );
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "priceListDuplicate");
        throw error;
      });
    return this.single(actor.companyId, id);
  }

  // Giá hiện hành của mọi biến thể, đơn vị có giá trong bảng tại một ngày (QUYTAC_NGHIEPVU_43).
  async prices(actor: Actor, id: string, query: z.output<typeof priceListPricesQuerySchema>): Promise<PageResponse<PriceRow>> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    await this.single(actor.companyId, id);
    const date = query.date ?? this.permissionService.today();
    const search = query.search ? sql`AND (p.search_text LIKE ${`%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`} OR v.sku = ${query.search.toUpperCase()})` : sql``;
    const current = sql`
      SELECT DISTINCT ON (pr.variant_id, pr.unit_id) pr.variant_id, pr.unit_id, pr.price, pr.effective_from
      FROM catalog.prices pr WHERE pr.price_list_id = ${id} AND pr.effective_from <= ${date}::date
      ORDER BY pr.variant_id, pr.unit_id, pr.effective_from DESC, pr.created_at DESC`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM (${current}) c JOIN catalog.variants v ON v.id = c.variant_id JOIN catalog.products p ON p.id = v.product_id WHERE TRUE ${search}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<{
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      unit_id: string;
      unit_name: string;
      price: string;
      effective_from: Date;
    }>(sql`
      SELECT c.variant_id, v.sku, p.name AS product_name, v.option_values, c.unit_id, u.name_vi AS unit_name, c.price::text AS price, c.effective_from
      FROM (${current}) c JOIN catalog.variants v ON v.id = c.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = c.unit_id
      WHERE TRUE ${search} ORDER BY v.sku, u.name_vi LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        variantId: row.variant_id,
        sku: row.sku,
        productName: row.product_name,
        optionValues: row.option_values,
        unitId: row.unit_id,
        unitName: row.unit_name,
        price: trimDecimal(row.price),
        effectiveFrom: day(row.effective_from),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async history(actor: Actor, id: string, variantId: string, unitId: string): Promise<PriceHistoryItem[]> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    await this.single(actor.companyId, id);
    const rows = await this.database.execute<{ price: string; effective_from: Date; price_change_id: string; change_no: string | null; created_at: Date }>(sql`
      SELECT pr.price::text AS price, pr.effective_from, pr.price_change_id, c.change_no, pr.created_at
      FROM catalog.prices pr JOIN catalog.price_changes c ON c.id = pr.price_change_id
      WHERE pr.price_list_id = ${id} AND pr.variant_id = ${variantId} AND pr.unit_id = ${unitId}
      ORDER BY pr.effective_from DESC, pr.created_at DESC`);
    return rows.rows.map((row) => ({
      price: trimDecimal(row.price),
      effectiveFrom: day(row.effective_from),
      priceChangeId: row.price_change_id,
      changeNo: row.change_no,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  // Tra giá: bảng giá trùng kênh và nhóm khách → chỉ nhóm khách → chỉ kênh → bảng giá chung; trong bảng chưa có giá thì xét bảng kế tiếp.
  // Đơn vị không có giá riêng thì lấy giá đơn vị cơ sở nhân hệ số (QUYTAC_NGHIEPVU_42, 43).
  async lookup(actor: Actor, query: z.output<typeof priceLookupQuerySchema>): Promise<PriceLookupResponse> {
    await requireCompanyPermission(this.permissionService, actor, catalogPermissions.viewPrices);
    const date = query.date ?? this.permissionService.today();
    const variant = (
      await this.database.execute<{ base_unit_id: string; factor: string | null }>(sql`
      SELECT p.base_unit_id, (SELECT pu.factor::text FROM catalog.product_units pu WHERE pu.product_id = p.id AND pu.unit_id = ${query.unitId}) AS factor
      FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${query.variantId} AND v.company_id = ${actor.companyId}`)
    ).rows[0];
    if (!variant) throw new ApiError("NOT_FOUND", "notFound");
    const candidates = await this.database.execute<{ id: string; code: string; includes_vat: boolean; rank: number }>(sql`
      SELECT id, code, includes_vat,
        CASE WHEN channel_id IS NOT NULL AND customer_group_id IS NOT NULL THEN 1 WHEN customer_group_id IS NOT NULL THEN 2 WHEN channel_id IS NOT NULL THEN 3 ELSE 4 END AS rank
      FROM catalog.price_lists
      WHERE company_id = ${actor.companyId} AND status = 'active' AND currency = ${query.currency}
        AND (channel_id IS NULL OR channel_id = ${query.channelId ?? null}) AND (customer_group_id IS NULL OR customer_group_id = ${query.customerGroupId ?? null})
      ORDER BY rank`);
    for (const list of candidates.rows) {
      const price = async (unitId: string) =>
        (
          await this.database.execute<{ price: string; effective_from: Date }>(sql`
          SELECT price::text AS price, effective_from FROM catalog.prices
          WHERE price_list_id = ${list.id} AND variant_id = ${query.variantId} AND unit_id = ${unitId} AND effective_from <= ${date}::date
          ORDER BY effective_from DESC, created_at DESC LIMIT 1`)
        ).rows[0];
      const own = await price(query.unitId);
      if (own) return { priceListId: list.id, priceListCode: list.code, includesVat: list.includes_vat, price: trimDecimal(own.price), effectiveFrom: day(own.effective_from), fromBaseUnit: false };
      if (query.unitId !== variant.base_unit_id && variant.factor) {
        const base = await price(variant.base_unit_id);
        if (base) {
          const converted = (await this.database.execute<{ value: string }>(sql`SELECT round(${base.price}::numeric * ${variant.factor}::numeric, 4)::text AS value`)).rows[0]!.value;
          return { priceListId: list.id, priceListCode: list.code, includesVat: list.includes_vat, price: trimDecimal(converted), effectiveFrom: day(base.effective_from), fromBaseUnit: true };
        }
      }
    }
    throw new ApiError("NOT_FOUND", "priceNotFound");
  }

  async single(companyId: string, id: string): Promise<PriceListResponse> {
    const row = (await this.database.execute<PriceListRow>(sql`${this.select()} WHERE l.id = ${id} AND l.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  private async duplicate(companyId: string, channelId: string | null, customerGroupId: string | null, currency: string, exceptId: string | null): Promise<boolean> {
    const rows = await this.database.execute(sql`
      SELECT 1 FROM catalog.price_lists WHERE company_id = ${companyId} AND status = 'active' AND currency = ${currency}
        AND channel_id IS NOT DISTINCT FROM ${channelId} AND customer_group_id IS NOT DISTINCT FROM ${customerGroupId} AND id IS DISTINCT FROM ${exceptId}`);
    return rows.rows.length > 0;
  }

  private select() {
    return sql`
      SELECT l.id, l.code, l.name, l.channel_id, ch.name AS channel_name, l.customer_group_id, g.name AS customer_group_name, l.currency, l.includes_vat, l.status, l.version
      FROM catalog.price_lists l LEFT JOIN catalog.sales_channels ch ON ch.id = l.channel_id LEFT JOIN catalog.customer_groups g ON g.id = l.customer_group_id`;
  }
}
