// Đơn bán (CHUC_NANG_54, 55; QUYTAC_NGHIEPVU_67 đến 71; API_77, API_78): giá theo bảng giá, ngoại lệ cần duyệt, giữ hàng, hủy, đóng.
// Giữ hàng ghi qua ReservationsService của module Kho; số đã giao, đã trả tính từ phiếu kho.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  PageResponse,
  saveSalesOrderSchema,
  SalesExceptionKind,
  salesOrderListQuerySchema,
  SalesOrderListItem,
  SalesOrderResponse,
  SalesOrderStatus,
  SalesOptionsResponse,
  SalesPriceResponse,
  SalesSettingsResponse,
  updateSalesSettingsSchema,
  VatRate,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { day, lookupPrice } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { ReservationsService } from "../inventory/reservations.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { isReceivingWarehouse, variantUnitFactor } from "../purchasing/purchasing-context";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { requireSalesPermission, salesAudit, salesPermissions } from "./sales-context";

const documentTypeCode = "sales.order";
export const salesOrderSource = "sales.order";
type Executor = Pick<Database, "execute" | "insert">;
type FieldErrors = Record<string, keyof Messages["errors"]>;
type Input = z.output<typeof saveSalesOrderSchema>;
type SalesException = { kind: SalesExceptionKind; lineNo: number | null; detail: string };
type OrderRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  buyer_name: string | null;
  channel_id: string;
  channel_name: string;
  customer_group_id: string | null;
  warehouse_id: string;
  warehouse_name: string;
  order_date: Date | string;
  delivery_address: string | null;
  note: string | null;
  currency: string;
  status: SalesOrderStatus;
  exceptions: SalesException[];
  approval_request_id: string | null;
  net_amount: string;
  tax_amount: string;
  total_amount: string;
  closed_reason: string | null;
  created_by: string;
  created_by_name: string;
  version: number;
};
type PreparedLine = {
  variantId: string;
  unitId: string;
  quantity: string;
  baseQuantity: string;
  priceListId: string;
  listPrice: string;
  includesVat: boolean;
  discountPercent: string;
  unitPrice: string;
  vatRate: VatRate;
  net: string;
  tax: string;
  total: string;
};

const vatFraction = (rate: VatRate) => (["0", "5", "8", "10"].includes(rate) ? Number(rate) / 100 : 0);
// Theo đơn vị cơ sở: phiếu xuất giao hàng đã ghi sổ; phiếu nhận hàng trả lại đã ghi sổ.
export const deliveredOnOrderLine = (lineId: SQL) => sql`coalesce((
  SELECT sum(dl.base_quantity) FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
  WHERE dl.source_line_id = ${lineId} AND d.type = 'sales_issue' AND d.status = 'posted'), 0)`;
export const returnedOnOrderLine = (lineId: SQL) => sql`coalesce((
  SELECT sum(rl.base_quantity) FROM inventory.document_lines rl JOIN inventory.documents r ON r.id = rl.document_id
  JOIN inventory.document_lines dl ON dl.id = rl.source_line_id
  WHERE dl.source_line_id = ${lineId} AND r.type = 'sales_return' AND r.status = 'posted'), 0)`;

@Injectable()
export class SalesOrdersService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly reservations: ReservationsService,
  ) {}

  // Duyệt xong thì xác nhận đơn; từ chối, rút thì nhả hàng giữ (QUYTAC_NGHIEPVU_70).
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.transaction(async (transaction) => {
        const next = status === "approved" ? "confirmed" : status;
        const updated = await transaction.execute<{ id: string }>(sql`
          UPDATE sales.orders SET status = ${next}, confirmed_at = CASE WHEN ${next} = 'confirmed' THEN now() ELSE confirmed_at END, updated_at = now()
          WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending' RETURNING id`);
        const orderId = updated.rows[0]?.id;
        if (orderId && next !== "confirmed") await this.reservations.closeBySource(transaction, salesOrderSource, orderId, "released");
      });
    });
  }

  async options(actor: Actor): Promise<SalesOptionsResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.viewOrders, salesPermissions.manageOrders);
    const customers = await this.database.execute<{ id: string; code: string; name: string; customer_group_id: string | null }>(sql`
      SELECT p.id, p.code, p.name, pr.customer_group_id FROM crm.partners p JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}
      WHERE p.status = 'active' AND pr.status = 'active' AND pr.is_customer ORDER BY p.name`);
    const channels = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM catalog.sales_channels WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    const warehouses = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT w.id, w.code, w.name FROM inventory.warehouses w JOIN inventory.warehouse_owners o ON o.warehouse_id = w.id
      WHERE o.company_id = ${actor.companyId} AND w.status = 'active' ORDER BY w.code`);
    return {
      customers: customers.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, customerGroupId: row.customer_group_id })),
      channels: channels.rows,
      warehouses: warehouses.rows,
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }

  // Giá gợi ý của dòng theo kênh và nhóm khách (QUYTAC_NGHIEPVU_67).
  async price(actor: Actor, query: { variantId: string; unitId: string; channelId: string; customerId?: string | undefined; date?: string | undefined }): Promise<SalesPriceResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const unit = await variantUnitFactor(this.database, actor.companyId, query.variantId, query.unitId);
    if (!unit) throw new ApiError("NOT_FOUND", "notFound");
    const groupId = query.customerId ? await this.customerGroup(this.database, actor.companyId, query.customerId) : null;
    const found = await lookupPrice(
      this.database,
      actor.companyId,
      { variantId: query.variantId, unitId: query.unitId, channelId: query.channelId, customerGroupId: groupId ?? undefined, currency: await companyCurrency(this.database, actor.companyId) },
      query.date ?? this.permissionService.today(),
    );
    const priced = found && found !== "variantNotFound" ? found : null;
    return { price: priced?.price ?? null, priceListCode: priced?.priceListCode ?? null, includesVat: priced?.includesVat ?? false, vatRate: unit.vatRate as VatRate };
  }

  async list(actor: Actor, query: z.output<typeof salesOrderListQuerySchema>): Promise<PageResponse<SalesOrderListItem>> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.viewOrders, salesPermissions.manageOrders);
    const conditions: SQL[] = [sql`o.company_id = ${actor.companyId}`];
    if (query.status) conditions.push(sql`o.status = ${query.status}`);
    if (query.customerId) conditions.push(sql`o.customer_id = ${query.customerId}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(o.document_no = ${query.search.toUpperCase()} OR c.name ILIKE ${pattern} OR o.buyer_name ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total ${this.from()} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(
      sql`${this.select()} ${this.from()} WHERE ${where} ORDER BY o.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    return { data: rows.rows.map(toItem), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<SalesOrderResponse> {
    const granted = await requireSalesPermission(this.permissionService, actor, salesPermissions.viewOrders, salesPermissions.manageOrders);
    const row = await this.single(this.database, actor.companyId, id);
    const lines = await this.database.execute<{
      id: string;
      line_no: number;
      variant_id: string;
      sku: string;
      product_name: string;
      option_values: string[];
      unit_id: string;
      unit_name: string;
      quantity: string;
      base_quantity: string;
      price_list_code: string | null;
      list_price: string;
      price_includes_vat: boolean;
      discount_percent: string;
      unit_price: string;
      vat_rate: VatRate;
      net_amount: string;
      tax_amount: string;
      total_amount: string;
      delivered: string;
      returned: string;
    }>(sql`
      SELECT l.id, l.line_no, l.variant_id, v.sku, p.name AS product_name, v.option_values, l.unit_id, u.name_vi AS unit_name, l.quantity::text, l.base_quantity::text,
        pl.code AS price_list_code, l.list_price::text, l.price_includes_vat, l.discount_percent::text, l.unit_price::text, l.vat_rate, l.net_amount::text, l.tax_amount::text,
        l.total_amount::text, ${deliveredOnOrderLine(sql`l.id`)}::text AS delivered, ${returnedOnOrderLine(sql`l.id`)}::text AS returned
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      LEFT JOIN catalog.price_lists pl ON pl.id = l.price_list_id
      WHERE l.order_id = ${id} ORDER BY l.line_no`);
    const documents = await this.database.execute<{ id: string; document_no: string | null; type: "sales_issue" | "sales_return"; status: string; document_date: Date | string }>(sql`
      SELECT d.id, d.document_no, d.type, d.status, d.document_date FROM inventory.documents d
      WHERE (d.type = 'sales_issue' AND d.source_id = ${id})
         OR (d.type = 'sales_return' AND d.source_id IN (SELECT i.id FROM inventory.documents i WHERE i.type = 'sales_issue' AND i.source_id = ${id}))
      ORDER BY d.created_at`);
    const manage = granted.has(salesPermissions.manageOrders);
    const own = row.created_by === actor.userId;
    const delivered = lines.rows.some((line) => Number(line.delivered) > 0) || documents.rows.some((document) => document.type === "sales_issue");
    const draftIssue = documents.rows.some((document) => document.type === "sales_issue" && document.status === "draft");
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    return {
      ...toItem(row),
      channelId: row.channel_id,
      warehouseId: row.warehouse_id,
      deliveryAddress: row.delivery_address,
      note: row.note,
      approvalRequestId: row.approval_request_id,
      exceptions: row.exceptions.map((exception) => ({ ...exception, detail: this.visibleDetail(exception, granted) })),
      closedReason: row.closed_reason,
      lines: lines.rows.map((line) => ({
        id: line.id,
        lineNo: line.line_no,
        variantId: line.variant_id,
        sku: line.sku,
        productName: line.product_name,
        optionValues: line.option_values,
        unitId: line.unit_id,
        unitName: line.unit_name,
        quantity: trimDecimal(line.quantity),
        baseQuantity: trimDecimal(line.base_quantity),
        priceListCode: line.price_list_code,
        listPrice: trimDecimal(line.list_price),
        priceIncludesVat: line.price_includes_vat,
        discountPercent: trimDecimal(line.discount_percent),
        unitPrice: trimDecimal(line.unit_price),
        vatRate: line.vat_rate,
        netAmount: trimDecimal(line.net_amount),
        taxAmount: trimDecimal(line.tax_amount),
        totalAmount: trimDecimal(line.total_amount),
        deliveredBaseQuantity: trimDecimal(line.delivered),
        returnedBaseQuantity: trimDecimal(line.returned),
      })),
      documents: documents.rows.map((document) => ({ id: document.id, documentNo: document.document_no, type: document.type, status: document.status, documentDate: day(document.document_date) })),
      version: row.version,
      canEdit: manage && ["draft", "rejected", "withdrawn"].includes(row.status),
      canSubmit: manage && row.status === "draft",
      canWithdraw: manage && own && row.status === "pending" && !firstStepDecided,
      canCancel: manage && (["draft", "rejected", "withdrawn"].includes(row.status) || (row.status === "confirmed" && !delivered)),
      canClose: manage && row.status === "confirmed" && delivered && !draftIssue,
    };
  }

  async create(actor: Actor, input: Input): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const id = await this.database.transaction(async (transaction) => {
      const { lines, groupId } = await this.prepare(transaction, actor.companyId, input);
      const orderId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO sales.orders (company_id, customer_id, buyer_name, channel_id, customer_group_id, warehouse_id, order_date, delivery_address, note, currency, created_by)
        VALUES (${actor.companyId}, ${input.customerId ?? null}, ${input.buyerName}, ${input.channelId}, ${groupId}, ${input.warehouseId}, ${input.orderDate}::date, ${input.deliveryAddress},
          ${input.note}, ${await companyCurrency(transaction, actor.companyId)}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, orderId, lines);
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.create", entityId: orderId, afterData: input }, transaction);
      return orderId;
    });
    return this.detail(actor, id);
  }

  // Sửa khi nháp, bị từ chối, đã rút; sửa xong về nháp, gửi lại tính lại ngoại lệ, giữ hàng.
  async update(actor: Actor, id: string, input: Input): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      const { lines, groupId } = await this.prepare(transaction, actor.companyId, input);
      const updated = await transaction.execute(sql`
        UPDATE sales.orders SET customer_id = ${input.customerId ?? null}, buyer_name = ${input.buyerName}, channel_id = ${input.channelId}, customer_group_id = ${groupId},
          warehouse_id = ${input.warehouseId}, order_date = ${input.orderDate}::date, delivery_address = ${input.deliveryAddress}, note = ${input.note}, status = 'draft',
          approval_request_id = NULL, exceptions = '[]'::jsonb, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM sales.order_lines WHERE order_id = ${id}`);
      await this.writeLines(transaction, id, lines);
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi đơn: giữ hàng, tính ngoại lệ; có ngoại lệ thì gửi duyệt, không có thì xác nhận ngay (QUYTAC_NGHIEPVU_68, 70).
  async submit(actor: Actor, id: string): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const current = await this.single(this.database, actor.companyId, id);
    if (current.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "DBH");
    const hours = (await this.database.execute<{ hours: number }>(sql`SELECT coalesce((SELECT reservation_hours FROM inventory.settings WHERE company_id = ${actor.companyId}), 72) AS hours`)).rows[0]!
      .hours;
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM sales.orders WHERE id = ${id} AND status = 'draft' AND version = ${current.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Khóa hồ sơ khách để hai đơn cùng khách gửi đồng thời không cùng lọt hạn mức.
      if (current.customer_id) {
        await transaction.execute(sql`SELECT 1 FROM crm.partner_profiles WHERE company_id = ${actor.companyId} AND partner_id = ${current.customer_id} FOR UPDATE`);
      }
      const lines = await transaction.execute<{ line_no: number; variant_id: string; base_quantity: string; discount_percent: string; net_amount: string }>(sql`
        SELECT line_no, variant_id, base_quantity::text, discount_percent::text, net_amount::text FROM sales.order_lines WHERE order_id = ${id} ORDER BY line_no`);
      const documentNo = current.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
      // Giữ hàng theo tổng số lượng cơ sở từng mặt hàng.
      const totals = new Map<string, { quantity: number; index: number }>();
      lines.rows.forEach((line, index) => {
        const entry = totals.get(line.variant_id) ?? { quantity: 0, index };
        entry.quantity += Number(line.base_quantity);
        totals.set(line.variant_id, entry);
      });
      const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
      // Thứ tự cố định theo mặt hàng để hai đơn gửi đồng thời không khóa chéo nhau.
      for (const [variantId, total] of [...totals].sort(([left], [right]) => left.localeCompare(right))) {
        await this.reservations
          .reserve(transaction, {
            warehouseId: current.warehouse_id,
            companyId: actor.companyId,
            variantId,
            quantity: total.quantity.toFixed(4),
            sourceType: salesOrderSource,
            sourceId: id,
            sourceNo: documentNo,
            expiresAt,
            userId: actor.userId,
          })
          .catch((error: unknown) => {
            if (!(error instanceof ApiError) || error.messageKey !== "insufficientAvailableStock") throw error;
            throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`lines.${total.index}.quantity`]: "insufficientAvailableStock" } });
          });
      }
      const exceptions = await this.exceptions(transaction, current, lines.rows);
      let requestId: string | null = null;
      if (exceptions.length > 0) {
        try {
          requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
            documentTypeCode,
            documentId: id,
            documentNo,
            amount: current.total_amount,
            currency: current.currency,
            documentDate: this.permissionService.today(),
          });
        } catch (error) {
          if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
        }
      }
      await transaction.execute(sql`
        UPDATE sales.orders SET status = ${requestId ? "pending" : "confirmed"}, document_no = ${documentNo}, approval_request_id = ${requestId}, exceptions = ${JSON.stringify(exceptions)}::jsonb,
          submitted_at = now(), confirmed_at = CASE WHEN ${requestId === null} THEN now() END, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record(
        { ...salesAudit(actor, "sales_order"), action: "sales_order.submit", entityId: id, afterData: { documentNo, exceptions, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const row = await this.single(this.database, actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`UPDATE sales.orders SET status = 'withdrawn', updated_at = now() WHERE id = ${id} AND status = 'pending' RETURNING id`);
      if (updated.rows.length > 0) await this.reservations.closeBySource(transaction, salesOrderSource, id, "released");
    });
    return this.detail(actor, id);
  }

  // Hủy đơn chưa giao: nhả hàng giữ. Đơn đã có phiếu xuất giao hàng chỉ đóng được (QUYTAC_NGHIEPVU_71).
  async cancel(actor: Actor, id: string, version: number): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{ status: SalesOrderStatus }>(sql`
        SELECT status FROM sales.orders WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${version} FOR UPDATE`);
      const status = locked.rows[0]?.status;
      if (!status) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!["draft", "rejected", "withdrawn", "confirmed"].includes(status)) throw new ApiError("BUSINESS_RULE", "salesOrderNotCancellable");
      const issued = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE type = 'sales_issue' AND source_id = ${id} LIMIT 1`);
      if (issued.rows.length > 0) throw new ApiError("BUSINESS_RULE", "salesOrderNotCancellable");
      await transaction.execute(sql`UPDATE sales.orders SET status = 'cancelled', updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.reservations.closeBySource(transaction, salesOrderSource, id, "released");
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.cancel", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Đóng đơn đã giao một phần: phần chưa giao hủy, nhả hàng giữ còn lại; còn phiếu xuất nháp thì chưa đóng được.
  async close(actor: Actor, id: string, reason: string, version: number): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM sales.orders WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'confirmed' AND version = ${version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const open = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE type = 'sales_issue' AND source_id = ${id} AND status = 'draft' LIMIT 1`);
      if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "salesOrderHasOpenIssues");
      await transaction.execute(sql`
        UPDATE sales.orders SET status = 'closed', closed_reason = ${reason}, closed_at = now(), closed_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.reservations.closeBySource(transaction, salesOrderSource, id, "released");
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.close", entityId: id, afterData: { reason } }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gọi trong giao dịch ghi sổ phiếu xuất giao hàng của module Kho: giao đủ mọi dòng thì "Đã giao đủ", nhả phần giữ còn sót.
  async refreshDelivered(executor: Executor, orderId: string): Promise<void> {
    const updated = await executor.execute(sql`
      UPDATE sales.orders o SET status = 'delivered', updated_at = now(), version = version + 1
      WHERE o.id = ${orderId} AND o.status = 'confirmed'
        AND NOT EXISTS (SELECT 1 FROM sales.order_lines l WHERE l.order_id = o.id AND ${deliveredOnOrderLine(sql`l.id`)} < l.base_quantity)
      RETURNING o.id`);
    if (updated.rows.length > 0) await this.reservations.closeBySource(executor, salesOrderSource, orderId, "consumed");
  }

  async settings(actor: Actor): Promise<SalesSettingsResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.viewOrders, salesPermissions.manageOrders, salesPermissions.manageSettings);
    return readSettings(this.database, actor.companyId);
  }

  async updateSettings(actor: Actor, input: z.output<typeof updateSalesSettingsSchema>): Promise<SalesSettingsResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageSettings);
    const before = await readSettings(this.database, actor.companyId);
    if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.database.transaction(async (transaction) => {
      const saved = await transaction.execute(sql`
        INSERT INTO sales.settings (company_id, max_manual_discount_percent, updated_by) VALUES (${actor.companyId}, ${input.maxManualDiscountPercent}::numeric, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET max_manual_discount_percent = EXCLUDED.max_manual_discount_percent, updated_by = EXCLUDED.updated_by, updated_at = now(),
          version = sales.settings.version + 1
        WHERE sales.settings.version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...salesAudit(actor, "sales_settings"), action: "sales_settings.update", entityId: actor.companyId, beforeData: before, afterData: input }, transaction);
    });
    return readSettings(this.database, actor.companyId);
  }

  // Hạn mức công nợ, giá vốn chỉ hiện cho người có quyền xem (như hồ sơ đối tác, giá vốn kho).
  private visibleDetail(exception: SalesException, granted: Set<string>): string {
    if (exception.kind === "credit_limit" && !granted.has("crm.profile.manage")) return "";
    if (exception.kind === "below_cost" && !granted.has("inventory.cost.view")) return "";
    return exception.detail;
  }

  // Ngoại lệ: chiết khấu vượt mức; dưới giá vốn bình quân tại kho; vượt hạn mức công nợ theo dư nợ tạm tính (QUYTAC_NGHIEPVU_68, 69).
  private async exceptions(
    transaction: Executor,
    order: OrderRow,
    lines: { line_no: number; variant_id: string; base_quantity: string; discount_percent: string; net_amount: string }[],
  ): Promise<SalesException[]> {
    const result: SalesException[] = [];
    const maximum = Number((await readSettings(transaction, order.company_id)).maxManualDiscountPercent);
    for (const line of lines) {
      if (Number(line.discount_percent) > maximum + 0.000001) result.push({ kind: "discount", lineNo: line.line_no, detail: `${trimDecimal(line.discount_percent)}% > ${maximum}%` });
      const cost = (
        await transaction.execute<{ average_cost: string; quantity: string }>(sql`
        SELECT average_cost::text, quantity::text FROM inventory.costs WHERE warehouse_id = ${order.warehouse_id} AND company_id = ${order.company_id} AND variant_id = ${line.variant_id}`)
      ).rows[0];
      const unitNet = Number(line.net_amount) / Number(line.base_quantity);
      if (cost && Number(cost.quantity) > 0 && unitNet < Number(cost.average_cost) - 0.00005) {
        result.push({ kind: "below_cost", lineNo: line.line_no, detail: `${trimDecimal(unitNet.toFixed(4))} < ${trimDecimal(cost.average_cost)}` });
      }
    }
    if (order.customer_id) {
      const profile = (
        await transaction.execute<{ credit_limit: string | null; payment_term_days: number }>(sql`
        SELECT credit_limit::text, payment_term_days FROM crm.partner_profiles WHERE company_id = ${order.company_id} AND partner_id = ${order.customer_id}`)
      ).rows[0];
      if (profile?.credit_limit !== null && profile?.credit_limit !== undefined) {
        const exposure = (
          await transaction.execute<{ value: string }>(sql`
          SELECT (
            coalesce((SELECT sum(l.total_amount * greatest(l.base_quantity - ${deliveredOnOrderLine(sql`l.id`)}, 0) / l.base_quantity)
                      FROM sales.order_lines l JOIN sales.orders o ON o.id = l.order_id
                      WHERE o.company_id = ${order.company_id} AND o.customer_id = ${order.customer_id} AND o.status = 'confirmed' AND o.id <> ${order.id}), 0)
            + coalesce((SELECT sum(sl.total_amount * dl.base_quantity / sl.base_quantity)
                      FROM inventory.document_lines dl JOIN inventory.documents d ON d.id = dl.document_id
                      JOIN sales.order_lines sl ON sl.id = dl.source_line_id JOIN sales.orders o ON o.id = sl.order_id
                      WHERE d.type = 'sales_issue' AND d.status = 'posted' AND o.company_id = ${order.company_id} AND o.customer_id = ${order.customer_id}
                        AND d.document_date > ${this.permissionService.today()}::date - ${profile.payment_term_days}::int), 0)
          )::text AS value`)
        ).rows[0]!.value;
        const after = Number(exposure) + Number(order.total_amount);
        if (after > Number(profile.credit_limit) + 0.00005) {
          result.push({ kind: "credit_limit", lineNo: null, detail: `${trimDecimal(after.toFixed(4))} > ${trimDecimal(profile.credit_limit)}` });
        }
      }
    }
    return result;
  }

  // Kiểm khách, kênh, kho; tra giá từng dòng theo kênh, nhóm khách tại ngày đơn; tính tiền theo cách tính thuế của bảng giá (QUYTAC_NGHIEPVU_67).
  private async prepare(transaction: Executor, companyId: string, input: Input): Promise<{ lines: PreparedLine[]; groupId: string | null }> {
    const fields: FieldErrors = {};
    let groupId: string | null = null;
    if (input.customerId) {
      const customer = (
        await transaction.execute<{ customer_group_id: string | null }>(sql`
        SELECT pr.customer_group_id FROM crm.partners p JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${companyId}
        WHERE p.id = ${input.customerId} AND p.status = 'active' AND pr.status = 'active' AND pr.is_customer`)
      ).rows[0];
      if (!customer) fields.customerId = "customerNotActive";
      else groupId = customer.customer_group_id;
    }
    const channel = await transaction.execute(sql`SELECT 1 FROM catalog.sales_channels WHERE id = ${input.channelId} AND company_id = ${companyId} AND status = 'active'`);
    if (channel.rows.length === 0) fields.channelId = "invalidValue";
    if (!(await isReceivingWarehouse(transaction, companyId, input.warehouseId))) fields.warehouseId = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const currency = await companyCurrency(transaction, companyId);
    const lines: PreparedLine[] = [];
    for (const [index, line] of input.lines.entries()) {
      const unit = await variantUnitFactor(transaction, companyId, line.variantId, line.unitId);
      if (!unit) {
        fields[`lines.${index}.unitId`] = "invalidValue";
        continue;
      }
      const price = await lookupPrice(
        transaction,
        companyId,
        { variantId: line.variantId, unitId: line.unitId, channelId: input.channelId, customerGroupId: groupId ?? undefined, currency },
        input.orderDate,
      );
      if (!price || price === "variantNotFound") {
        fields[`lines.${index}.variantId`] = "priceNotFound";
        continue;
      }
      const vatRate = unit.vatRate as VatRate;
      const rate = vatFraction(vatRate);
      const unitPrice = Number(price.price) * (1 - Number(line.discountPercent) / 100);
      const amount = Number(line.quantity) * Number(unitPrice.toFixed(4));
      const net = price.includesVat ? amount / (1 + rate) : amount;
      const total = price.includesVat ? amount : net * (1 + rate);
      lines.push({
        variantId: line.variantId,
        unitId: line.unitId,
        quantity: line.quantity,
        baseQuantity: (Number(line.quantity) * unit.factor).toFixed(4),
        priceListId: price.priceListId,
        listPrice: price.price,
        includesVat: price.includesVat,
        discountPercent: line.discountPercent,
        unitPrice: unitPrice.toFixed(4),
        vatRate,
        net: net.toFixed(4),
        tax: (Number(total.toFixed(4)) - Number(net.toFixed(4))).toFixed(4),
        total: total.toFixed(4),
      });
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return { lines, groupId };
  }

  private async writeLines(transaction: Executor, orderId: string, lines: PreparedLine[]): Promise<void> {
    for (const [index, line] of lines.entries()) {
      await transaction.execute(sql`
        INSERT INTO sales.order_lines (order_id, line_no, variant_id, unit_id, quantity, base_quantity, price_list_id, list_price, price_includes_vat, discount_percent, unit_price, vat_rate,
          net_amount, tax_amount, total_amount)
        VALUES (${orderId}, ${index + 1}, ${line.variantId}, ${line.unitId}, ${line.quantity}::numeric, ${line.baseQuantity}::numeric, ${line.priceListId}, ${line.listPrice}::numeric,
          ${line.includesVat}, ${line.discountPercent}::numeric, ${line.unitPrice}::numeric, ${line.vatRate}, ${line.net}::numeric, ${line.tax}::numeric, ${line.total}::numeric)`);
    }
    await transaction.execute(sql`
      UPDATE sales.orders SET net_amount = t.net, tax_amount = t.tax, total_amount = t.total
      FROM (SELECT coalesce(sum(net_amount), 0) AS net, coalesce(sum(tax_amount), 0) AS tax, coalesce(sum(total_amount), 0) AS total FROM sales.order_lines WHERE order_id = ${orderId}) t
      WHERE id = ${orderId}`);
  }

  private async customerGroup(executor: Executor, companyId: string, customerId: string): Promise<string | null> {
    return (
      (await executor.execute<{ customer_group_id: string | null }>(sql`SELECT customer_group_id FROM crm.partner_profiles WHERE company_id = ${companyId} AND partner_id = ${customerId}`)).rows[0]
        ?.customer_group_id ?? null
    );
  }

  async single(executor: Executor, companyId: string, id: string): Promise<OrderRow> {
    const row = (await executor.execute<OrderRow>(sql`${this.select()} ${this.from()} WHERE o.id = ${id} AND o.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private select(): SQL {
    return sql`SELECT o.id, o.company_id, o.document_no, o.customer_id, c.name AS customer_name, o.buyer_name, o.channel_id, ch.name AS channel_name, o.customer_group_id, o.warehouse_id,
      w.name AS warehouse_name, o.order_date, o.delivery_address, o.note, o.currency, o.status, o.exceptions, o.approval_request_id, o.net_amount::text, o.tax_amount::text,
      o.total_amount::text, o.closed_reason, o.created_by, cu.full_name AS created_by_name, o.version`;
  }

  private from(): SQL {
    return sql`FROM sales.orders o LEFT JOIN crm.partners c ON c.id = o.customer_id JOIN catalog.sales_channels ch ON ch.id = o.channel_id
      JOIN inventory.warehouses w ON w.id = o.warehouse_id JOIN core.users cu ON cu.id = o.created_by`;
  }
}

export async function readSettings(executor: Pick<Database, "execute">, companyId: string): Promise<SalesSettingsResponse> {
  const row = (await executor.execute<{ percent: string; version: number }>(sql`SELECT max_manual_discount_percent::text AS percent, version FROM sales.settings WHERE company_id = ${companyId}`))
    .rows[0];
  return { maxManualDiscountPercent: row ? trimDecimal(row.percent) : "0", version: row?.version ?? 0 };
}

function toItem(row: OrderRow): SalesOrderListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    customerId: row.customer_id,
    customerName: row.customer_name,
    buyerName: row.buyer_name,
    channelName: row.channel_name,
    warehouseName: row.warehouse_name,
    orderDate: day(row.order_date),
    currency: row.currency,
    netAmount: trimDecimal(row.net_amount),
    taxAmount: trimDecimal(row.tax_amount),
    totalAmount: trimDecimal(row.total_amount),
    status: row.status,
    createdByName: row.created_by_name,
  };
}
