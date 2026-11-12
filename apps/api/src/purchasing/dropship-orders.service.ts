// Đơn mua dropship: tự lập khi đơn bán kho Dropship xác nhận; báo đang giao, đã giao (ghi sổ phiếu nhập mua và phiếu xuất bán), giao thất bại, hủy; số hóa đơn nhà cung cấp
// (CONG_VIEC_62 CHUC_NANG_223; QUYTAC_NGHIEPVU_500 đến 502, 504; API_267, API_268).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { DropshipEventResponse, dropshipOrderListQuerySchema, DropshipOrderListItem, DropshipOrderResponse, DropshipStatus, PageResponse, SalesOrderDropshipItem, VatRate } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { PurchaseReceiptsService } from "../inventory/purchase-receipts.service";
import { ReservationsService } from "../inventory/reservations.service";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { salesOrderSource, SalesOrdersService } from "../sales/sales-orders.service";
import { PurchaseOrdersService } from "./orders.service";
import { purchasingAudit, purchasingPermissions, requirePermission, type Executor } from "./purchasing-context";
import { SupplierPricesService } from "./supplier-prices.service";

// Người báo trạng thái: nhân viên trên web hoặc khóa API của nhà cung cấp (L3).
export type DropshipSource = { kind: "user"; actor: Actor } | { kind: "api_key"; apiKeyId: string; companyId: string };
export type DropshipEvent =
  | { type: "shipping"; carrierName: string | null; trackingCode: string | null }
  | { type: "delivered"; deliveredOn: string }
  | { type: "failed"; reason: string }
  | { type: "cancelled"; reason: string };

type OrderRow = {
  id: string;
  company_id: string;
  document_no: string;
  sales_order_id: string;
  sales_order_no: string | null;
  sales_order_status: string;
  supplier_id: string;
  supplier_name: string;
  warehouse_name: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  line_count: number;
  total_amount: string;
  tax_amount: string;
  currency: string;
  dropship_status: DropshipStatus;
  order_date: Date | string;
  overdue: boolean;
  carrier_name: string | null;
  tracking_code: string | null;
  delivered_on: Date | string | null;
  dropship_reason: string | null;
  supplier_invoice_no: string | null;
  supplier_invoice_date: Date | string | null;
  status: string;
  created_by: string;
  version: number;
};

const openStatuses: DropshipStatus[] = ["awaiting", "shipping"];

@Injectable()
export class DropshipOrdersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly orders: PurchaseOrdersService,
    private readonly prices: SupplierPricesService,
    private readonly salesOrders: SalesOrdersService,
    private readonly reservations: ReservationsService,
    private readonly receipts: PurchaseReceiptsService,
    private readonly deliveries: SalesDeliveriesService,
  ) {}

  onModuleInit(): void {
    this.salesOrders.confirmedHooks.push((transaction, orderId) => this.salesConfirmed(transaction, orderId));
    this.salesOrders.dropshipOrders = (executor, orderId) => this.forSalesOrder(executor, orderId);
  }

  // Đơn bán kho Dropship xác nhận: mỗi nhà cung cấp một đơn mua Đã duyệt; giữ chỗ không hết hạn đến khi đơn mua kết thúc (QUYTAC_NGHIEPVU_500).
  async salesConfirmed(transaction: Executor, salesOrderId: string): Promise<void> {
    const order = (
      await transaction.execute<{ company_id: string; warehouse_id: string; created_by: string; kind: string }>(sql`
      SELECT o.company_id, o.warehouse_id, o.created_by, w.kind FROM sales.orders o JOIN inventory.warehouses w ON w.id = o.warehouse_id WHERE o.id = ${salesOrderId}`)
    ).rows[0];
    if (!order || order.kind !== "dropship") return;
    const existing = await transaction.execute(sql`SELECT 1 FROM purchasing.orders WHERE dropship_sales_order_id = ${salesOrderId} LIMIT 1`);
    if (existing.rows.length > 0) return;
    const lines = await transaction.execute<{ variant_id: string; base_quantity: string; supplier_id: string; unit_id: string; factor: string; vat_rate: VatRate }>(sql`
      SELECT l.variant_id, sum(l.base_quantity)::text AS base_quantity, dp.supplier_id, dp.unit_id, p.vat_rate,
        (CASE WHEN p.base_unit_id = dp.unit_id THEN 1 ELSE pu.factor END)::text AS factor
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      JOIN purchasing.dropship_products dp ON dp.company_id = ${order.company_id} AND dp.variant_id = l.variant_id AND dp.status = 'active'
      LEFT JOIN catalog.product_units pu ON pu.product_id = p.id AND pu.unit_id = dp.unit_id
      WHERE l.order_id = ${salesOrderId} AND p.kind = 'goods'
      GROUP BY l.variant_id, dp.supplier_id, dp.unit_id, p.vat_rate, p.base_unit_id, pu.factor
      ORDER BY dp.supplier_id, l.variant_id`);
    if (lines.rows.length === 0) return;
    const today = this.permissionService.today();
    await this.orders.ensureOrderSequence({ userId: order.created_by, companyId: order.company_id, client: { ip: null, userAgent: null, requestId: null } } as unknown as Actor);
    const suppliers = [...new Set(lines.rows.map((line) => line.supplier_id))];
    for (const supplierId of suppliers) {
      const prepared = [];
      for (const line of lines.rows.filter((row) => row.supplier_id === supplierId)) {
        const quantity = (Number(line.base_quantity) / Number(line.factor)).toFixed(4);
        const price = await this.prices.lookup(transaction, order.company_id, supplierId, line.variant_id, line.unit_id, quantity, today);
        if (price.unitPrice === null) throw new ApiError("BUSINESS_RULE", "dropshipPriceMissing");
        prepared.push({ variantId: line.variant_id, unitId: line.unit_id, quantity, baseQuantity: line.base_quantity, unitPrice: price.unitPrice, vatRate: line.vat_rate });
      }
      const purchaseOrderId = await this.orders.createDropship(transaction, {
        companyId: order.company_id,
        supplierId,
        warehouseId: order.warehouse_id,
        orderDate: today,
        salesOrderId,
        createdBy: order.created_by,
        lines: prepared,
      });
      await transaction.execute(sql`INSERT INTO purchasing.dropship_events (order_id, status, created_by) VALUES (${purchaseOrderId}, 'awaiting', ${order.created_by})`);
    }
    await this.reservations.holdWithoutExpiry(transaction, salesOrderSource, salesOrderId);
  }

  async list(actor: Actor, query: z.output<typeof dropshipOrderListQuerySchema>): Promise<PageResponse<DropshipOrderListItem>> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    const conditions: SQL[] = [sql`po.company_id = ${actor.companyId}`, sql`po.dropship_sales_order_id IS NOT NULL`];
    if (query.status) conditions.push(sql`po.dropship_status = ${query.status}`);
    if (query.supplierId) conditions.push(sql`po.supplier_id = ${query.supplierId}`);
    if (query.overdueOnly) conditions.push(sql`${this.overdue()}`);
    if (query.missingInvoiceOnly) conditions.push(sql`po.dropship_status = 'delivered' AND po.supplier_invoice_no IS NULL`);
    if (query.search) {
      const pattern = `%${searchText(query.search).replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(po.document_no ILIKE ${pattern} OR so.document_no ILIKE ${pattern} OR so.recipient_name ILIKE ${pattern} OR so.buyer_name ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY po.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map(toListItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<DropshipOrderResponse> {
    const granted = await requirePermission(this.permissionService, actor, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    return this.response(this.database, actor.companyId, id, granted.has(purchasingPermissions.manageDropship));
  }

  // Khối Dropship của chi tiết đơn bán (người xem đơn bán thấy được).
  async forSalesOrder(executor: Executor, salesOrderId: string): Promise<SalesOrderDropshipItem[]> {
    const rows = await executor.execute<{
      id: string;
      document_no: string;
      supplier_name: string;
      line_count: number;
      dropship_status: DropshipStatus;
      carrier_name: string | null;
      tracking_code: string | null;
    }>(sql`
      SELECT po.id, po.document_no, s.name AS supplier_name, (SELECT count(*)::int FROM purchasing.order_lines l WHERE l.order_id = po.id) AS line_count, po.dropship_status,
        po.carrier_name, po.tracking_code
      FROM purchasing.orders po JOIN crm.partners s ON s.id = po.supplier_id WHERE po.dropship_sales_order_id = ${salesOrderId} ORDER BY po.document_no`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      supplierName: row.supplier_name,
      lineCount: row.line_count,
      status: row.dropship_status,
      carrierName: row.carrier_name,
      trackingCode: row.tracking_code,
    }));
  }

  async staffEvent(actor: Actor, id: string, event: DropshipEvent, version: number): Promise<DropshipOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    await this.applyEvent({ kind: "user", actor }, id, event, version);
    return this.response(this.database, actor.companyId, id, true);
  }

  // Báo trạng thái giao theo QUYTAC_NGHIEPVU_500 đến 502; báo lại cùng trạng thái không đổi gì. Đã giao: ghi sổ phiếu nhập mua và phiếu xuất bán trong một giao dịch.
  async applyEvent(source: DropshipSource, id: string, event: DropshipEvent, version: number | null): Promise<void> {
    const companyId = source.kind === "user" ? source.actor.companyId : source.companyId;
    const current = await this.single(this.database, companyId, id);
    const target: DropshipStatus = event.type;
    if (current.dropship_status === target && target !== "shipping") return;
    if (!openStatuses.includes(current.dropship_status)) throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
    if (target === "shipping" && current.dropship_status !== "awaiting" && current.dropship_status !== "shipping") throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
    if (source.kind === "api_key" && target === "cancelled") throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
    const actor: Actor = source.kind === "user" ? source.actor : ({ userId: current.created_by, companyId, client: { ip: null, userAgent: null, requestId: null } } as unknown as Actor);
    if (event.type === "delivered") {
      const today = this.permissionService.today();
      if (event.deliveredOn > today || event.deliveredOn < day(current.order_date)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { deliveredOn: "invalidValue" } });
      await this.receipts.ensureReceiptSequence(actor, companyId);
      await this.deliveries.ensureSequences(actor, companyId);
    }
    await this.database.transaction(async (transaction) => {
      const locked = (
        await transaction.execute<{ dropship_status: DropshipStatus; version: number }>(sql`
        SELECT dropship_status, version FROM purchasing.orders WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`)
      ).rows[0];
      if (!locked) throw new ApiError("NOT_FOUND", "notFound");
      if (version !== null && locked.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Hai lần báo cùng lúc: lần sau thấy trạng thái đã đổi.
      if (locked.dropship_status === target && target !== "shipping") return;
      if (!openStatuses.includes(locked.dropship_status)) throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
      let note: string | null = null;
      if (event.type === "shipping") {
        note = [event.carrierName, event.trackingCode].filter(Boolean).join(" · ") || null;
        await transaction.execute(sql`
          UPDATE purchasing.orders SET dropship_status = 'shipping', carrier_name = ${event.carrierName}, tracking_code = ${event.trackingCode}, updated_at = now(), version = version + 1
          WHERE id = ${id}`);
      } else if (event.type === "delivered") {
        const receiptId = await this.receipts.receiveAsSystem(transaction, actor, id, event.deliveredOn);
        const salesLines = await transaction.execute<{ id: string; quantity: string }>(sql`
          SELECT l.id, l.quantity::text FROM sales.order_lines l
          WHERE l.order_id = ${current.sales_order_id} AND l.variant_id IN (SELECT variant_id FROM purchasing.order_lines WHERE order_id = ${id}) ORDER BY l.line_no`);
        const issueId = await this.deliveries.issueAsSystem(transaction, actor, {
          orderId: current.sales_order_id,
          documentDate: event.deliveredOn,
          lines: salesLines.rows.map((line) => ({ orderLineId: line.id, quantity: trimDecimal(line.quantity) })),
        });
        await transaction.execute(sql`
          UPDATE purchasing.orders SET dropship_status = 'delivered', delivered_on = ${event.deliveredOn}::date, updated_at = now(), version = version + 1 WHERE id = ${id}`);
        await this.auditService.record(
          { ...purchasingAudit(actor, "purchase_order"), action: "purchase_order.dropship_delivered", entityId: id, afterData: { deliveredOn: event.deliveredOn, receiptId, issueId } },
          transaction,
        );
      } else {
        note = event.reason;
        await transaction.execute(sql`
          UPDATE purchasing.orders SET dropship_status = ${target}, dropship_reason = ${event.reason}, status = 'closed', closed_reason = ${event.reason}, closed_at = now(),
            updated_at = now(), version = version + 1
          WHERE id = ${id}`);
        const variants = (await transaction.execute<{ variant_id: string }>(sql`SELECT variant_id FROM purchasing.order_lines WHERE order_id = ${id}`)).rows.map((row) => row.variant_id);
        await this.reservations.releaseVariants(transaction, salesOrderSource, current.sales_order_id, variants);
      }
      await transaction.execute(sql`
        INSERT INTO purchasing.dropship_events (order_id, status, note, created_by, created_via_api_key_id)
        VALUES (${id}, ${target}, ${note}, ${source.kind === "user" ? source.actor.userId : null}, ${source.kind === "api_key" ? source.apiKeyId : null})`);
      if (event.type !== "delivered") {
        await this.auditService.record({ ...purchasingAudit(actor, "purchase_order"), action: `purchase_order.dropship_${target}`, entityId: id, afterData: event }, transaction);
      }
      await this.endSalesOrderIfDone(transaction, current.sales_order_id);
    });
  }

  async supplierInvoice(actor: Actor, id: string, input: { invoiceNo: string; invoiceDate: string; version: number }): Promise<DropshipOrderResponse> {
    await requirePermission(this.permissionService, actor, purchasingPermissions.manageDropship);
    const before = await this.single(this.database, actor.companyId, id);
    if (before.dropship_status !== "delivered") throw new ApiError("BUSINESS_RULE", "dropshipStatusInvalid");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE purchasing.orders SET supplier_invoice_no = ${input.invoiceNo}, supplier_invoice_date = ${input.invoiceDate}::date, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record(
        {
          ...purchasingAudit(actor, "purchase_order"),
          action: "purchase_order.supplier_invoice",
          entityId: id,
          beforeData: { invoiceNo: before.supplier_invoice_no, invoiceDate: before.supplier_invoice_date === null ? null : day(before.supplier_invoice_date) },
          afterData: input,
        },
        transaction,
      );
    });
    return this.response(this.database, actor.companyId, id, true);
  }

  // Mọi đơn mua dropship của đơn bán đã kết thúc mà đơn bán chưa giao đủ: hủy (chưa giao gì) hoặc đóng phần còn lại (QUYTAC_NGHIEPVU_502).
  private async endSalesOrderIfDone(transaction: Executor, salesOrderId: string): Promise<void> {
    const open = await transaction.execute(sql`
      SELECT 1 FROM purchasing.orders WHERE dropship_sales_order_id = ${salesOrderId} AND dropship_status IN ('awaiting', 'shipping') LIMIT 1`);
    if (open.rows.length > 0) return;
    const status = (await transaction.execute<{ status: string }>(sql`SELECT status FROM sales.orders WHERE id = ${salesOrderId}`)).rows[0]?.status;
    if (status !== "confirmed") return;
    await this.salesOrders.endByCounterpart(transaction, salesOrderId, "Nhà cung cấp dropship không giao");
  }

  private async response(executor: Executor, companyId: string, id: string, canManage: boolean): Promise<DropshipOrderResponse> {
    const row = await this.single(executor, companyId, id);
    const lines = await executor.execute<{
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      supplier_sku: string | null;
      unit_name: string;
      quantity: string;
      unit_price: string;
      vat_rate: string;
      amount: string;
    }>(sql`
      SELECT l.variant_id, v.sku, p.name AS product_name, v.option_values, u.name_vi AS unit_name, l.quantity::text, l.unit_price::text, l.vat_rate, l.amount::text,
        (SELECT sp.supplier_sku FROM purchasing.supplier_prices sp WHERE sp.company_id = ${companyId} AND sp.supplier_id = ${row.supplier_id} AND sp.variant_id = l.variant_id
          AND sp.supplier_sku IS NOT NULL ORDER BY sp.valid_from DESC LIMIT 1) AS supplier_sku
      FROM purchasing.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      WHERE l.order_id = ${id} ORDER BY l.line_no`);
    const events = await executor.execute<{ status: DropshipStatus; note: string | null; actor_name: string; created_at: Date }>(sql`
      SELECT e.status, e.note, coalesce(u.full_name, k.name, '') AS actor_name, e.created_at
      FROM purchasing.dropship_events e LEFT JOIN core.users u ON u.id = e.created_by LEFT JOIN core.api_keys k ON k.id = e.created_via_api_key_id
      WHERE e.order_id = ${id} ORDER BY e.created_at, e.id`);
    const documents = await executor.execute<{ id: string; document_no: string; type: string }>(sql`
      SELECT d.id, d.document_no, d.type FROM inventory.documents d
      WHERE d.status = 'posted' AND ((d.type = 'purchase_receipt' AND d.source_id = ${id})
        OR (d.type = 'sales_issue' AND d.source_id = ${row.sales_order_id} AND EXISTS (
          SELECT 1 FROM inventory.document_lines dl WHERE dl.document_id = d.id AND dl.variant_id IN (SELECT variant_id FROM purchasing.order_lines WHERE order_id = ${id}))))
      ORDER BY d.created_at`);
    const receipt = documents.rows.find((document) => document.type === "purchase_receipt");
    const issue = documents.rows.find((document) => document.type === "sales_issue");
    return {
      ...toListItem(row),
      salesOrderStatus: row.sales_order_status,
      warehouseName: row.warehouse_name,
      recipientPhone: row.recipient_phone,
      carrierName: row.carrier_name,
      trackingCode: row.tracking_code,
      deliveredOn: row.delivered_on === null ? null : day(row.delivered_on),
      reason: row.dropship_reason,
      supplierInvoiceDate: row.supplier_invoice_date === null ? null : day(row.supplier_invoice_date),
      taxAmount: trimDecimal(row.tax_amount),
      receipt: receipt ? { id: receipt.id, documentNo: receipt.document_no } : null,
      issue: issue ? { id: issue.id, documentNo: issue.document_no } : null,
      lines: lines.rows.map((line) => ({
        variantId: line.variant_id,
        sku: line.sku,
        productName: line.product_name,
        optionValues: line.option_values,
        supplierSku: line.supplier_sku,
        unitName: line.unit_name,
        quantity: trimDecimal(line.quantity),
        unitPrice: trimDecimal(line.unit_price),
        vatRate: line.vat_rate,
        amount: trimDecimal(line.amount),
      })),
      events: events.rows.map((event): DropshipEventResponse => ({ status: event.status, note: event.note, actorName: event.actor_name, createdAt: new Date(event.created_at).toISOString() })),
      canManage,
      version: row.version,
    };
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<OrderRow> {
    const row = (await executor.execute<OrderRow>(sql`${this.select()} ${this.from()} WHERE po.id = ${id} AND po.company_id = ${companyId} AND po.dropship_sales_order_id IS NOT NULL`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // Chờ giao quá 2 ngày kể từ ngày đơn (giờ Việt Nam).
  private overdue(): SQL {
    return sql`(po.dropship_status = 'awaiting' AND po.order_date < ${this.permissionService.today()}::date - 2)`;
  }

  private select(): SQL {
    return sql`SELECT po.id, po.company_id, po.document_no, po.dropship_sales_order_id AS sales_order_id, so.document_no AS sales_order_no, so.status AS sales_order_status,
      po.supplier_id, s.name AS supplier_name, w.name AS warehouse_name, coalesce(so.recipient_name, so.buyer_name, c.name) AS recipient_name, so.recipient_phone, so.delivery_address,
      (SELECT count(*)::int FROM purchasing.order_lines l WHERE l.order_id = po.id) AS line_count, po.total_amount::text, po.tax_amount::text, po.currency, po.dropship_status,
      po.order_date, ${this.overdue()} AS overdue, po.carrier_name, po.tracking_code, po.delivered_on, po.dropship_reason, po.supplier_invoice_no, po.supplier_invoice_date,
      po.status, po.created_by, po.version`;
  }

  private from(): SQL {
    return sql`FROM purchasing.orders po JOIN sales.orders so ON so.id = po.dropship_sales_order_id JOIN crm.partners s ON s.id = po.supplier_id
      JOIN inventory.warehouses w ON w.id = po.warehouse_id LEFT JOIN crm.partners c ON c.id = so.customer_id`;
  }
}

function toListItem(row: OrderRow): DropshipOrderListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    salesOrderId: row.sales_order_id,
    salesOrderNo: row.sales_order_no,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    recipientName: row.recipient_name,
    deliveryAddress: row.delivery_address,
    lineCount: row.line_count,
    totalAmount: trimDecimal(row.total_amount),
    currency: row.currency,
    status: row.dropship_status,
    orderDate: day(row.order_date),
    overdue: row.overdue,
    supplierInvoiceNo: row.supplier_invoice_no,
  };
}
