// Open API cho nhà cung cấp dropship: đơn mua dropship của chính nhà cung cấp, báo trạng thái giao, cập nhật tồn khai báo
// (CONG_VIEC_62 CHUC_NANG_224; QUYTAC_NGHIEPVU_505; API_271, API_272, API_309).
import { Inject, Injectable } from "@nestjs/common";
import type { OpenDropshipEventRequest, openDropshipOrderListQuerySchema, OpenDropshipOrder, OpenDropshipStockResponse, openDropshipStockSchema, PageResponse, DropshipStatus } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { OpenApiCaller } from "../open-api/api-key.guard";
import { DropshipOrdersService, type DropshipEvent } from "./dropship-orders.service";
import { setDeclaredQuantity } from "./dropship-products.service";

type OrderRow = {
  id: string;
  document_no: string;
  dropship_status: DropshipStatus;
  order_date: Date | string;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  carrier_name: string | null;
  tracking_code: string | null;
  delivered_on: Date | string | null;
  dropship_reason: string | null;
  updated_at: Date;
};

@Injectable()
export class OpenDropshipService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly auditService: AuditService,
    private readonly orders: DropshipOrdersService,
  ) {}

  async list(caller: OpenApiCaller, query: z.output<typeof openDropshipOrderListQuerySchema>): Promise<PageResponse<OpenDropshipOrder>> {
    const supplierId = this.supplierOf(caller);
    const conditions: SQL[] = [sql`po.company_id = ${caller.companyId}`, sql`po.supplier_id = ${supplierId}`, sql`po.dropship_sales_order_id IS NOT NULL`];
    if (query.status) conditions.push(sql`po.dropship_status = ${query.status}`);
    if (query.updatedSince) conditions.push(sql`po.updated_at >= ${query.updatedSince}::timestamptz`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY po.updated_at, po.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    const data: OpenDropshipOrder[] = [];
    for (const row of rows.rows) data.push(await this.toOrder(caller.companyId, supplierId, row));
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async detail(caller: OpenApiCaller, code: string): Promise<OpenDropshipOrder> {
    const supplierId = this.supplierOf(caller);
    return this.toOrder(caller.companyId, supplierId, await this.single(caller, supplierId, code));
  }

  // Báo cùng trạng thái lần hai trả kết quả hiện tại; chuyển sai trả 409 (QUYTAC_NGHIEPVU_505). Nhà cung cấp không hủy được đơn.
  async event(caller: OpenApiCaller, code: string, input: OpenDropshipEventRequest): Promise<OpenDropshipOrder> {
    const supplierId = this.supplierOf(caller);
    const row = await this.single(caller, supplierId, code);
    const event: DropshipEvent =
      input.type === "shipping"
        ? { type: "shipping", carrierName: input.carrierName ?? null, trackingCode: input.trackingCode ?? null }
        : input.type === "delivered"
          ? { type: "delivered", deliveredOn: input.deliveredOn }
          : { type: "failed", reason: input.reason };
    await this.orders.applyEvent({ kind: "api_key", apiKeyId: caller.keyId, companyId: caller.companyId }, row.id, event, null);
    return this.detail(caller, code);
  }

  // Cập nhật tồn khai báo theo mã biến thể hoặc mã hàng của nhà cung cấp; dòng không thuộc nhà cung cấp bị từ chối, dòng khác vẫn ghi (QUYTAC_NGHIEPVU_498, 505).
  async stock(caller: OpenApiCaller, input: z.output<typeof openDropshipStockSchema>): Promise<OpenDropshipStockResponse> {
    const supplierId = this.supplierOf(caller);
    const errors: OpenDropshipStockResponse["errors"] = [];
    let updated = 0;
    const seen = new Set<string>();
    await this.database.transaction(async (transaction) => {
      for (const [index, item] of input.items.entries()) {
        const found = (
          await transaction.execute<{ id: string }>(sql`
          SELECT dp.id FROM purchasing.dropship_products dp JOIN catalog.variants v ON v.id = dp.variant_id
          WHERE dp.company_id = ${caller.companyId} AND dp.supplier_id = ${supplierId} AND dp.status = 'active'
            AND (v.sku = ${item.variantCode?.toUpperCase() ?? null} OR EXISTS (
              SELECT 1 FROM purchasing.supplier_prices sp WHERE sp.company_id = dp.company_id AND sp.supplier_id = dp.supplier_id AND sp.variant_id = dp.variant_id
                AND sp.supplier_sku = ${item.supplierSku ?? null}))
          ORDER BY dp.id FOR UPDATE OF dp`)
        ).rows;
        if (found.length !== 1) errors.push({ index, code: "NOT_FOUND" });
        else if (seen.has(found[0]!.id)) errors.push({ index, code: "DUPLICATE" });
        else {
          seen.add(found[0]!.id);
          await setDeclaredQuantity(transaction, found[0]!.id, item.quantity, { kind: "open_api", apiKeyId: caller.keyId });
          updated += 1;
        }
      }
      await this.auditService.record(
        {
          actorUserId: null,
          companyId: caller.companyId,
          appCode: "purchasing",
          entityType: "dropship_product",
          action: "dropship_product.stock_open_api",
          afterData: { apiKey: `${caller.keyName} (${caller.keyPrefix})`, updated, errors: errors.length },
          ip: null,
          userAgent: null,
          requestId: null,
        },
        transaction,
      );
    });
    return { updated, errors };
  }

  // Khóa đối tác gắn nhà cung cấp; khóa nội bộ không dùng được API này.
  private supplierOf(caller: OpenApiCaller): string {
    if (caller.kind !== "partner" || !caller.partnerId) throw new ApiError("SCOPE_NOT_GRANTED", "scopeNotGranted");
    return caller.partnerId;
  }

  private async single(caller: OpenApiCaller, supplierId: string, code: string): Promise<OrderRow> {
    const row = (
      await this.database.execute<OrderRow>(sql`
      ${this.select()} ${this.from()} WHERE po.company_id = ${caller.companyId} AND po.supplier_id = ${supplierId} AND po.dropship_sales_order_id IS NOT NULL AND po.document_no = ${code}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Không trả giá bán, khách hàng, đơn bán; chỉ thông tin cần để giao (QUYTAC_NGHIEPVU_505).
  private async toOrder(companyId: string, supplierId: string, row: OrderRow): Promise<OpenDropshipOrder> {
    const lines = await this.database.execute<{ sku: string; product_name: string; unit_code: string; quantity: string; unit_price: string; vat_rate: string; supplier_sku: string | null }>(sql`
      SELECT v.sku, p.name AS product_name, u.code AS unit_code, l.quantity::text, l.unit_price::text, l.vat_rate,
        (SELECT sp.supplier_sku FROM purchasing.supplier_prices sp WHERE sp.company_id = ${companyId} AND sp.supplier_id = ${supplierId} AND sp.variant_id = l.variant_id
          AND sp.supplier_sku IS NOT NULL ORDER BY sp.valid_from DESC LIMIT 1) AS supplier_sku
      FROM purchasing.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.order_id = ${row.id} ORDER BY l.line_no`);
    return {
      code: row.document_no,
      status: row.dropship_status,
      orderDate: day(row.order_date),
      recipient: { name: row.recipient_name, phone: row.recipient_phone, address: row.delivery_address },
      lines: lines.rows.map((line) => ({
        variantCode: line.sku,
        supplierSku: line.supplier_sku,
        productName: line.product_name,
        unitCode: line.unit_code,
        quantity: trimDecimal(line.quantity),
        unitPrice: trimDecimal(line.unit_price),
        vatRate: line.vat_rate,
      })),
      carrierName: row.carrier_name,
      trackingCode: row.tracking_code,
      deliveredOn: row.delivered_on === null ? null : day(row.delivered_on),
      reason: row.dropship_reason,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private select(): SQL {
    return sql`SELECT po.id, po.document_no, po.dropship_status, po.order_date, coalesce(so.recipient_name, so.buyer_name, c.name) AS recipient_name,
      coalesce(so.recipient_phone, c.phone) AS recipient_phone, so.delivery_address, po.carrier_name, po.tracking_code, po.delivered_on, po.dropship_reason, po.updated_at`;
  }

  private from(): SQL {
    return sql`FROM purchasing.orders po JOIN sales.orders so ON so.id = po.dropship_sales_order_id LEFT JOIN crm.partners c ON c.id = so.customer_id`;
  }
}
