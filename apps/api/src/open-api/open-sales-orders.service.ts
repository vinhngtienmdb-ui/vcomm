// API đơn bán cho đối tác (CHUC_NANG_220; QUYTAC_NGHIEPVU_490 đến 492; API_262 đến API_264).
// Đối tác chỉ thấy đơn trong phạm vi của mình: mọi khóa cùng đối tác, khóa nội bộ chỉ đơn của chính khóa.
import { Inject, Injectable } from "@nestjs/common";
import type { OpenSalesOrder, PageResponse, openSalesOrderListQuerySchema, openSalesOrderSchema } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { deliveredOnOrderLine, SalesOrdersService } from "../sales/sales-orders.service";
import { orderScopeOf, type CallerContext, type OpenApiCaller } from "./api-key.guard";
import { OpenCustomersService } from "./open-customers.service";

const trimDecimal = (value: string): string => (value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);
const day = (value: Date | string): string => (typeof value === "string" ? value.slice(0, 10) : vietnamDate(value));

type OrderRow = {
  id: string;
  partner_order_code: string;
  document_no: string | null;
  status: string;
  order_date: Date | string;
  warehouse_code: string | null;
  customer_code: string | null;
  buyer_name: string | null;
  delivery_address: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  note: string | null;
  currency: string;
  net_amount: string;
  tax_amount: string;
  total_amount: string;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class OpenSalesOrdersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly salesOrders: SalesOrdersService,
    private readonly customers: OpenCustomersService,
  ) {}

  // Trả { created: false } khi mã đơn đối tác đã có: không tạo, không sửa, không so nội dung.
  async create(caller: OpenApiCaller, input: z.output<typeof openSalesOrderSchema>, context: CallerContext): Promise<{ created: boolean; order: OpenSalesOrder }> {
    const scopeId = orderScopeOf(caller);
    const existing = await this.findId(caller, input.partnerOrderCode);
    if (existing) return { created: false, order: await this.detailById(existing) };

    const fields: Record<string, ErrorMessageKey> = {};
    const warehouse = (
      await this.database.execute<{ id: string }>(sql`
      SELECT w.id FROM inventory.warehouses w JOIN core.api_key_warehouses kw ON kw.warehouse_id = w.id AND kw.api_key_id = ${caller.keyId}
      WHERE w.company_id = ${caller.companyId} AND w.code = ${input.warehouseCode} AND w.status = 'active'`)
    ).rows[0];
    if (!warehouse) fields.warehouseCode = "openApiWarehouseNotAllowed";

    // Khách: khóa đối tác là chính đối tác hoặc khách trong phạm vi (QUYTAC_NGHIEPVU_494 khoản 6); khóa nội bộ chỉ định khách của công ty hoặc để trống (QUYTAC_NGHIEPVU_490).
    let customerId: string | null = caller.partnerId;
    if (caller.kind === "partner" && input.customerCode) {
      customerId = await this.customers.usableCustomerId(caller, input.customerCode);
      if (!customerId) fields.customerCode = "customerNotActive";
    }
    if (caller.kind === "internal" && input.customerCode) {
      const customer = (
        await this.database.execute<{ id: string }>(sql`
        SELECT p.id FROM crm.partners p JOIN crm.partner_profiles pp ON pp.partner_id = p.id AND pp.company_id = ${caller.companyId}
        WHERE p.code = ${input.customerCode} AND p.status = 'active' AND pp.status = 'active' AND pp.is_customer`)
      ).rows[0];
      if (!customer) fields.customerCode = "customerNotActive";
      customerId = customer?.id ?? null;
    }

    // Dòng hàng: mã biến thể, mã đơn vị (đơn vị cơ sở hoặc đơn vị quy đổi của sản phẩm).
    const lines: { variantId: string; unitId: string; quantity: string; discountPercent: string }[] = [];
    for (const [index, line] of input.lines.entries()) {
      const found = (
        await this.database.execute<{ variant_id: string; unit_id: string | null }>(sql`
        SELECT v.id AS variant_id,
          (SELECT u.id FROM catalog.units u WHERE u.code = ${line.unitCode.toUpperCase()}
             AND (u.id = p.base_unit_id OR EXISTS (SELECT 1 FROM catalog.product_units pu WHERE pu.product_id = p.id AND pu.unit_id = u.id))) AS unit_id
        FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
        WHERE v.company_id = ${caller.companyId} AND v.sku = ${line.sku.toUpperCase()} AND v.status = 'active' AND p.status = 'active' AND p.seller_id IS NULL`)
      ).rows[0];
      if (!found) fields[`lines.${index}.sku`] = "openApiSkuNotFound";
      else if (!found.unit_id) fields[`lines.${index}.unitCode`] = "openApiUnitNotFound";
      else if (Number(line.quantity) <= 0) fields[`lines.${index}.quantity`] = "invalidValue";
      else lines.push({ variantId: found.variant_id, unitId: found.unit_id, quantity: line.quantity, discountPercent: "0" });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });

    const createdBy = (await this.database.execute<{ created_by: string }>(sql`SELECT created_by FROM core.api_keys WHERE id = ${caller.keyId}`)).rows[0]!.created_by;
    try {
      const id = await this.salesOrders.createFromOpenApi(
        caller.companyId,
        createdBy,
        {
          customerId,
          buyerName: input.buyerName ?? null,
          channelId: caller.channelId!,
          warehouseId: warehouse!.id,
          orderDate: input.orderDate ?? vietnamDate(this.clock.now()),
          deliveryAddress: input.recipient?.address ?? input.deliveryAddress ?? null,
          note: input.note ?? null,
          lines,
        },
        {
          apiKeyId: caller.keyId,
          scopeId,
          partnerOrderCode: input.partnerOrderCode,
          keyName: caller.keyName,
          keyPrefix: caller.keyPrefix,
          recipient: input.recipient ? { name: input.recipient.name, phone: input.recipient.phone } : null,
          ...context,
        },
      );
      return { created: true, order: await this.detailById(id) };
    } catch (error) {
      // Hai lần gửi cùng mã đồng thời: lần sau gặp chỉ mục duy nhất, trả đơn đã tạo (QUYTAC_NGHIEPVU_491).
      if (isUniqueViolation(error)) {
        const raced = await this.findId(caller, input.partnerOrderCode);
        if (raced) return { created: false, order: await this.detailById(raced) };
      }
      throw error;
    }
  }

  async detail(caller: OpenApiCaller, partnerOrderCode: string): Promise<OpenSalesOrder> {
    const id = await this.findId(caller, partnerOrderCode);
    if (!id) throw new ApiError("NOT_FOUND", "notFound");
    return this.detailById(id);
  }

  async list(caller: OpenApiCaller, query: z.output<typeof openSalesOrderListQuerySchema>): Promise<PageResponse<OpenSalesOrder>> {
    const conditions: SQL[] = [this.scopeCondition(caller)];
    if (query.status) conditions.push(sql`o.status = ${query.status}`);
    if (query.updatedSince) conditions.push(sql`o.updated_at >= ${query.updatedSince}::timestamptz`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM sales.orders o WHERE ${where}`)).rows[0]?.total ?? 0;
    const ids = await this.database.execute<{ id: string }>(sql`
      SELECT o.id FROM sales.orders o WHERE ${where} ORDER BY o.updated_at DESC, o.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const data: OpenSalesOrder[] = [];
    for (const row of ids.rows) data.push(await this.detailById(row.id));
    return { data, page: query.page, pageSize: query.pageSize, total };
  }

  async cancel(caller: OpenApiCaller, partnerOrderCode: string, reason: string, context: CallerContext): Promise<OpenSalesOrder> {
    const id = await this.findId(caller, partnerOrderCode);
    if (!id) throw new ApiError("NOT_FOUND", "notFound");
    await this.salesOrders.cancelFromOpenApi(caller.companyId, id, reason, { keyName: caller.keyName, keyPrefix: caller.keyPrefix, ...context });
    return this.detailById(id);
  }

  private scopeCondition(caller: OpenApiCaller): SQL {
    return sql`o.company_id = ${caller.companyId} AND o.open_api_scope_id = ${orderScopeOf(caller)} AND o.open_api_key_id IS NOT NULL`;
  }

  private async findId(caller: OpenApiCaller, partnerOrderCode: string): Promise<string | null> {
    const row = (await this.database.execute<{ id: string }>(sql`SELECT o.id FROM sales.orders o WHERE ${this.scopeCondition(caller)} AND o.partner_order_code = ${partnerOrderCode}`)).rows[0];
    return row?.id ?? null;
  }

  private async detailById(id: string): Promise<OpenSalesOrder> {
    const row = (
      await this.database.execute<OrderRow>(sql`
      SELECT o.id, o.partner_order_code, o.document_no, o.status, o.order_date, w.code AS warehouse_code, c.code AS customer_code, o.buyer_name, o.delivery_address, o.recipient_name, o.recipient_phone, o.note, o.currency,
        o.net_amount::text, o.tax_amount::text, o.total_amount::text, o.created_at, o.updated_at
      FROM sales.orders o LEFT JOIN inventory.warehouses w ON w.id = o.warehouse_id LEFT JOIN crm.partners c ON c.id = o.customer_id
      WHERE o.id = ${id}`)
    ).rows[0]!;
    const lines = await this.database.execute<{
      line_no: number;
      sku: string;
      product_name: string;
      unit_code: string;
      quantity: string;
      unit_price: string;
      discount_percent: string;
      net_amount: string;
      tax_amount: string;
      total_amount: string;
      is_gift: boolean;
      delivered: string;
    }>(sql`
      SELECT l.line_no, v.sku, p.name AS product_name, u.code AS unit_code, l.quantity::text, l.unit_price::text, l.discount_percent::text, l.net_amount::text, l.tax_amount::text,
        l.total_amount::text, l.is_gift, ${deliveredOnOrderLine(sql`l.id`)}::text AS delivered
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.order_id = ${id} ORDER BY l.line_no`);
    return {
      partnerOrderCode: row.partner_order_code,
      documentNo: row.document_no,
      status: row.status,
      orderDate: day(row.order_date),
      warehouseCode: row.warehouse_code,
      customerCode: row.customer_code,
      buyerName: row.buyer_name,
      deliveryAddress: row.delivery_address,
      recipient: row.recipient_name ? { name: row.recipient_name, phone: row.recipient_phone!, address: row.delivery_address! } : null,
      note: row.note,
      currency: row.currency,
      netAmount: trimDecimal(row.net_amount),
      taxAmount: trimDecimal(row.tax_amount),
      totalAmount: trimDecimal(row.total_amount),
      lines: lines.rows.map((line) => ({
        lineNo: line.line_no,
        sku: line.sku,
        productName: line.product_name,
        unitCode: line.unit_code,
        quantity: trimDecimal(line.quantity),
        unitPrice: trimDecimal(line.unit_price),
        discountPercent: trimDecimal(line.discount_percent),
        netAmount: trimDecimal(line.net_amount),
        taxAmount: trimDecimal(line.tax_amount),
        totalAmount: trimDecimal(line.total_amount),
        isGift: line.is_gift,
        deliveredBaseQuantity: trimDecimal(line.delivered),
      })),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
