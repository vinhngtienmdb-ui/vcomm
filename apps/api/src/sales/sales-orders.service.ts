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
import { internalCompanyOf } from "../crm/partners.service";
import { internalSalesErrors } from "./internal-trade-rules";
import { receivableBalance } from "../finance/receivable-balance";
import { applyPromotions, type GiftShortage, lineAmounts, type PricedLine, withoutPromotion } from "./promotion-pricing";
import { promotionGiftUsage, promotionUsage } from "./promotions.service";
import { allowsManualGoodsOrders, goodsVariants, requireManualOrderLines, requireSalesPermission, salesAudit, salesPermissions } from "./sales-context";

const documentTypeCode = "sales.order";
export const salesOrderSource = "sales.order";
// Đơn của người mua VComm (CONG_VIEC_24) chỉ xử lý qua màn hình đơn VComm: không sửa, hủy, đóng, xuất, nhận trả từ màn hình đơn bán, phiếu kho.
export async function requireNotMarketplace(executor: Pick<Database, "execute">, salesOrderId: string | null): Promise<void> {
  if (!salesOrderId) return;
  const linked = await executor.execute(sql`SELECT 1 FROM marketplace.orders WHERE sales_order_id = ${salesOrderId}`);
  if (linked.rows.length > 0) throw new ApiError("BUSINESS_RULE", "marketplaceOrderManagedInApp");
}
type Executor = Pick<Database, "execute" | "insert">;
type FieldErrors = Record<string, keyof Messages["errors"]>;
type Input = z.output<typeof saveSalesOrderSchema>;
// Móc nối giao dịch nội bộ (CONG_VIEC_09): InternalTradeService đăng ký khi khởi động để sinh, đóng chứng từ đối ứng ở module Mua hàng trong cùng giao dịch.
export interface SalesInternalHooks {
  afterConfirmed(transaction: Executor, orderId: string): Promise<void>;
  afterEnded(transaction: Executor, orderId: string, reason: string): Promise<void>;
}
type SalesException = { kind: SalesExceptionKind; lineNo: number | null; detail: string };
type OrderRow = {
  id: string;
  open_api_key_name: string | null;
  partner_order_code: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  customer_via_open_api: boolean | null;
  company_id: string;
  document_no: string | null;
  customer_id: string | null;
  customer_name: string | null;
  buyer_name: string | null;
  channel_id: string;
  channel_name: string;
  customer_group_id: string | null;
  warehouse_id: string | null;
  warehouse_name: string;
  order_date: Date | string;
  delivery_address: string | null;
  customer_company_id: string | null;
  counterpart_order_id: string | null;
  is_counterpart: boolean;
  counterpart_rejected_reason: string | null;
  gift_shortages: GiftShortage[];
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
type PreparedLine = PricedLine;

// Dòng đơn mua chung: giá bậc gồm thuế thay giá bảng giá, không chiết khấu, không khuyến mãi (CONG_VIEC_49).
function groupPriced(line: PreparedLine, grossPrice: string): PreparedLine {
  const amounts = lineAmounts(grossPrice, true, line.vatRate, line.quantity, 0, "0");
  return withoutPromotion({
    ...line,
    listPrice: grossPrice,
    includesVat: true,
    discountPercent: "0",
    unitPrice: amounts.unitPrice,
    net: amounts.net.toFixed(4),
    tax: amounts.tax.toFixed(4),
    total: amounts.total.toFixed(4),
  });
}
type ExceptionLine = {
  line_no: number;
  variant_id: string;
  base_quantity: string;
  discount_percent: string;
  net_amount: string;
  is_gift: boolean;
  promotion_discount_total: string;
  vat_rate: VatRate;
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
  internalHooks: SalesInternalHooks | null = null;
  // Gọi sau khi đơn bán (đơn tay, đơn đối ứng nội bộ; không gồm đơn VComm) sang đã xác nhận, trong cùng giao dịch: lập phiếu xuất dịch vụ (CONG_VIEC_43; QUYTAC_NGHIEPVU_276).
  readonly confirmedHooks: ((transaction: Executor, orderId: string) => Promise<void>)[] = [];

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
        if (!orderId) return;
        if (next === "confirmed") await this.afterConfirmed(transaction, orderId);
        else await this.reservations.closeBySource(transaction, salesOrderSource, orderId, "released");
        // Đơn đối ứng nội bộ không được duyệt thì hủy, đơn mua bên kia đóng theo (QUYTAC_NGHIEPVU_74).
        if (next !== "confirmed" && (await this.isCounterpart(transaction, orderId))) await this.endByCounterpart(transaction, orderId, "Đơn bán đối ứng không được duyệt", true);
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
      allowManualGoodsOrders: await allowsManualGoodsOrders(this.database, actor.companyId),
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
    if (query.source === "open_api") conditions.push(sql`o.open_api_key_id IS NOT NULL`);
    if (query.source === "web") conditions.push(sql`o.open_api_key_id IS NULL`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(o.document_no = ${query.search.toUpperCase()} OR c.name ILIKE ${pattern} OR o.buyer_name ILIKE ${pattern} OR o.partner_order_code = ${query.search})`);
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
      is_gift: boolean;
      promotion_name: string | null;
      promotion_percent: string;
      order_promotion_name: string | null;
      order_discount_amount: string;
    }>(sql`
      SELECT l.id, l.line_no, l.variant_id, v.sku, p.name AS product_name, v.option_values, l.unit_id, u.name_vi AS unit_name, l.quantity::text, l.base_quantity::text,
        pl.code AS price_list_code, l.list_price::text, l.price_includes_vat, l.discount_percent::text, l.unit_price::text, l.vat_rate, l.net_amount::text, l.tax_amount::text,
        l.total_amount::text, ${deliveredOnOrderLine(sql`l.id`)}::text AS delivered, ${returnedOnOrderLine(sql`l.id`)}::text AS returned
        , l.is_gift, pr.name AS promotion_name, l.promotion_percent::text, opr.name AS order_promotion_name, l.order_discount_amount::text
      FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id JOIN catalog.units u ON u.id = l.unit_id
      LEFT JOIN catalog.price_lists pl ON pl.id = l.price_list_id LEFT JOIN sales.promotions pr ON pr.id = l.promotion_id LEFT JOIN sales.promotions opr ON opr.id = l.order_promotion_id
      WHERE l.order_id = ${id} ORDER BY l.line_no`);
    const documents = await this.database.execute<{ id: string; document_no: string | null; type: "sales_issue" | "sales_return"; status: string; document_date: Date | string }>(sql`
      SELECT d.id, d.document_no, d.type, d.status, d.document_date FROM inventory.documents d
      WHERE (d.type = 'sales_issue' AND d.source_id = ${id})
         OR (d.type = 'sales_return' AND d.source_id IN (SELECT i.id FROM inventory.documents i WHERE i.type = 'sales_issue' AND i.source_id = ${id}))
      ORDER BY d.created_at`);
    const manage = granted.has(salesPermissions.manageOrders);
    const own = row.created_by === actor.userId;
    const internal = row.customer_company_id !== null;
    const counterpart = row.counterpart_order_id
      ? ((
          await this.database.execute<{ company_name: string; document_no: string | null; status: string }>(sql`
          SELECT c.short_name AS company_name, o.document_no, o.status FROM purchasing.orders o JOIN core.companies c ON c.id = o.company_id WHERE o.id = ${row.counterpart_order_id}`)
        ).rows[0] ?? null)
      : null;
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
      // CONG_VIEC_66: người nhận giao thẳng của đơn Open API (QUYTAC_NGHIEPVU_494 khoản 7).
      recipient: row.recipient_name ? { name: row.recipient_name, phone: row.recipient_phone ?? "" } : null,
      customerCreatedViaOpenApi: row.customer_via_open_api === true,
      note: row.note,
      approvalRequestId: row.approval_request_id,
      exceptions: row.exceptions.map((exception) => ({ ...exception, detail: this.visibleDetail(exception, granted) })),
      isInternal: internal,
      isCounterpart: row.is_counterpart,
      counterpart: counterpart ? { companyName: counterpart.company_name, documentNo: counterpart.document_no, status: counterpart.status } : null,
      counterpartRejectedReason: row.counterpart_rejected_reason,
      giftShortages: row.gift_shortages,
      canConfirmCounterpart: manage && row.status === "counterpart_pending",
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
        isGift: line.is_gift,
        promotionName: line.promotion_name,
        promotionPercent: trimDecimal(line.promotion_percent),
        orderPromotionName: line.order_promotion_name,
        orderDiscountAmount: trimDecimal(line.order_discount_amount),
      })),
      documents: documents.rows.map((document) => ({ id: document.id, documentNo: document.document_no, type: document.type, status: document.status, documentDate: day(document.document_date) })),
      version: row.version,
      // Đơn đối ứng nội bộ không sửa dòng được (QUYTAC_NGHIEPVU_78).
      canEdit: manage && !row.is_counterpart && ["draft", "rejected", "withdrawn"].includes(row.status),
      canSubmit: manage && row.status === "draft",
      canWithdraw: manage && own && row.status === "pending" && !firstStepDecided,
      canCancel: manage && (["draft", "rejected", "withdrawn"].includes(row.status) || (row.status === "confirmed" && !delivered)),
      canClose: manage && row.status === "confirmed" && delivered && !draftIssue,
    };
  }

  async create(actor: Actor, input: Input): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const id = await this.database.transaction(async (transaction) => {
      const { lines, groupId, giftShortages } = await this.prepare(transaction, actor.companyId, input, null);
      const orderId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO sales.orders (company_id, customer_id, buyer_name, channel_id, customer_group_id, warehouse_id, order_date, delivery_address, note, currency, gift_shortages, created_by)
        VALUES (${actor.companyId}, ${input.customerId ?? null}, ${input.buyerName}, ${input.channelId}, ${groupId}, ${input.warehouseId}, ${input.orderDate}::date, ${input.deliveryAddress},
          ${input.note}, ${await companyCurrency(transaction, actor.companyId)}, ${JSON.stringify(giftShortages)}::jsonb, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, orderId, lines);
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.create", entityId: orderId, afterData: input }, transaction);
      return orderId;
    });
    return this.detail(actor, id);
  }

  // Đơn bán từ Open API (CONG_VIEC_61; QUYTAC_NGHIEPVU_490, 491): Nháp, người lập là người cấp khóa; giá, khuyến mãi, cài đặt hàng hóa như đơn lập tay.
  // Nhật ký thao tác không gắn người dùng, ghi tên khóa. Trùng mã đơn đối tác thì cơ sở dữ liệu báo trùng, bên gọi trả đơn cũ.
  async createFromOpenApi(
    companyId: string,
    createdBy: string,
    input: Input,
    source: {
      apiKeyId: string;
      scopeId: string;
      partnerOrderCode: string;
      keyName: string;
      keyPrefix: string;
      recipient: { name: string; phone: string } | null;
      ip: string | null;
      requestId: string | null;
    },
  ): Promise<string> {
    return this.database.transaction(async (transaction): Promise<string> => {
      const { lines, groupId, giftShortages } = await this.prepare(transaction, companyId, input, null);
      const orderId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO sales.orders (company_id, customer_id, buyer_name, channel_id, customer_group_id, warehouse_id, order_date, delivery_address, note, currency, gift_shortages, created_by,
          open_api_key_id, open_api_scope_id, partner_order_code, recipient_name, recipient_phone)
        VALUES (${companyId}, ${input.customerId ?? null}, ${input.buyerName}, ${input.channelId}, ${groupId}, ${input.warehouseId}, ${input.orderDate}::date, ${input.deliveryAddress},
          ${input.note}, ${await companyCurrency(transaction, companyId)}, ${JSON.stringify(giftShortages)}::jsonb, ${createdBy},
          ${source.apiKeyId}, ${source.scopeId}, ${source.partnerOrderCode}, ${source.recipient?.name ?? null}, ${source.recipient?.phone ?? null}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, orderId, lines);
      await this.auditService.record(
        {
          actorUserId: null,
          companyId,
          appCode: "sales",
          action: "sales_order.create",
          entityType: "sales_order",
          entityId: orderId,
          afterData: { ...input, recipient: source.recipient, openApi: { keyName: source.keyName, keyPrefix: source.keyPrefix, partnerOrderCode: source.partnerOrderCode } },
          ip: source.ip,
          requestId: source.requestId,
        },
        transaction,
      );
      return orderId;
    });
  }

  // Đối tác hủy đơn Open API còn Nháp (QUYTAC_NGHIEPVU_492); lý do ghi nhật ký thao tác.
  async cancelFromOpenApi(companyId: string, orderId: string, reason: string, source: { keyName: string; keyPrefix: string; ip: string | null; requestId: string | null }): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute<{ status: SalesOrderStatus }>(sql`SELECT status FROM sales.orders WHERE id = ${orderId} AND company_id = ${companyId} FOR UPDATE`);
      if (locked.rows[0]?.status !== "draft") throw new ApiError("BUSINESS_RULE", "openApiOrderNotCancellable");
      await transaction.execute(sql`UPDATE sales.orders SET status = 'cancelled', updated_at = now(), version = version + 1 WHERE id = ${orderId}`);
      await this.auditService.record(
        {
          actorUserId: null,
          companyId,
          appCode: "sales",
          action: "sales_order.cancel",
          entityType: "sales_order",
          entityId: orderId,
          afterData: { reason, openApi: { keyName: source.keyName, keyPrefix: source.keyPrefix } },
          ip: source.ip,
          requestId: source.requestId,
        },
        transaction,
      );
    });
  }

  // Sửa khi nháp, bị từ chối, đã rút; sửa xong về nháp, gửi lại tính lại ngoại lệ, giữ hàng.
  async update(actor: Actor, id: string, input: Input): Promise<SalesOrderResponse> {
    await requireNotMarketplace(this.database, id);
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    // Đơn có người nhận giao thẳng giữ người nhận khi sửa; địa chỉ giao không được để trống (QUYTAC_NGHIEPVU_494 khoản 7).
    if (before.recipient && !input.deliveryAddress) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { deliveryAddress: "required" } });
    await this.database.transaction(async (transaction) => {
      const { lines, groupId, giftShortages } = await this.prepare(transaction, actor.companyId, input, id);
      const updated = await transaction.execute(sql`
        UPDATE sales.orders SET customer_id = ${input.customerId ?? null}, buyer_name = ${input.buyerName}, channel_id = ${input.channelId}, customer_group_id = ${groupId},
          warehouse_id = ${input.warehouseId}, order_date = ${input.orderDate}::date, delivery_address = ${input.deliveryAddress}, note = ${input.note}, status = 'draft',
          gift_shortages = ${JSON.stringify(giftShortages)}::jsonb,
          approval_request_id = NULL, exceptions = '[]'::jsonb, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') AND NOT is_counterpart RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`DELETE FROM sales.order_lines WHERE order_id = ${id}`);
      await this.writeLines(transaction, id, lines);
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi đơn: giữ hàng, tính ngoại lệ; có ngoại lệ thì gửi duyệt, không có thì xác nhận ngay (QUYTAC_NGHIEPVU_68, 70).
  async submit(actor: Actor, id: string): Promise<SalesOrderResponse> {
    await requireNotMarketplace(this.database, id);
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const current = await this.single(this.database, actor.companyId, id);
    if (current.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    const hours = await this.beforeSubmit(actor);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`SELECT 1 FROM sales.orders WHERE id = ${id} AND status = 'draft' AND version = ${current.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.submitWithin(transaction, actor, current, hours);
    });
    return this.detail(actor, id);
  }

  // Dãy số chứng từ và thời hạn giữ hàng của công ty, đọc ngoài giao dịch gửi đơn.
  private async beforeSubmit(actor: Actor): Promise<number> {
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "DBH");
    return (await this.database.execute<{ hours: number }>(sql`SELECT coalesce((SELECT reservation_hours FROM inventory.settings WHERE company_id = ${actor.companyId}), 72) AS hours`)).rows[0]!.hours;
  }

  // Gửi đơn đã khóa: kiểm giao dịch nội bộ, giữ hàng, tính ngoại lệ, gửi duyệt hoặc xác nhận ngay.
  private async submitWithin(transaction: Executor, actor: Actor, current: OrderRow, hours: number): Promise<void> {
    const id = current.id;
    // Khóa hồ sơ khách để hai đơn cùng khách gửi đồng thời không cùng lọt hạn mức.
    if (current.customer_id) {
      await transaction.execute(sql`SELECT 1 FROM crm.partner_profiles WHERE company_id = ${actor.companyId} AND partner_id = ${current.customer_id} FOR UPDATE`);
    }
    const lines = await transaction.execute<ExceptionLine>(sql`
      SELECT line_no, variant_id, base_quantity::text, discount_percent::text, net_amount::text, is_gift, promotion_discount_total::text, vat_rate
      FROM sales.order_lines WHERE order_id = ${id} ORDER BY line_no`);
    await this.checkPromotionLimits(transaction, id);
    // Đơn nháp lập khi cài đặt còn bật: kiểm lại lúc gửi. Đơn đối ứng nội bộ đã kiểm ở đơn mua khởi tạo (QUYTAC_NGHIEPVU_276, 277).
    if (!current.is_counterpart)
      await requireManualOrderLines(
        transaction,
        actor.companyId,
        lines.rows.map((line) => line.variant_id),
      );
    if (current.customer_id) {
      const internal = await internalSalesErrors(
        transaction,
        actor.companyId,
        current.customer_id,
        current.channel_id,
        lines.rows.map((line) => line.variant_id),
      );
      if (Object.keys(internal).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: internal });
    }
    const documentNo = current.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
    // Giữ hàng theo tổng số lượng cơ sở từng mặt hàng; dịch vụ không giữ hàng (QUYTAC_NGHIEPVU_275).
    const goods = await goodsVariants(
      transaction,
      lines.rows.map((line) => line.variant_id),
    );
    const totals = new Map<string, { quantity: number; index: number }>();
    lines.rows.forEach((line, index) => {
      if (!goods.has(line.variant_id)) return;
      const entry = totals.get(line.variant_id) ?? { quantity: 0, index };
      entry.quantity += Number(line.base_quantity);
      totals.set(line.variant_id, entry);
    });
    const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString();
    // Thứ tự cố định theo mặt hàng để hai đơn gửi đồng thời không khóa chéo nhau.
    for (const [variantId, total] of [...totals].sort(([left], [right]) => left.localeCompare(right))) {
      await this.reservations
        .reserve(transaction, {
          warehouseId: current.warehouse_id!,
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
          if (error instanceof ApiError && (error.messageKey === "dropshipProductMissing" || error.messageKey === "dropshipPriceMissing"))
            throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`lines.${total.index}.variantId`]: error.messageKey } });
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
    if (requestId === null) await this.afterConfirmed(transaction, id);
  }

  private async afterConfirmed(transaction: Executor, orderId: string): Promise<void> {
    await this.internalHooks?.afterConfirmed(transaction, orderId);
    for (const hook of this.confirmedHooks) await hook(transaction, orderId);
  }

  async withdraw(actor: Actor, id: string): Promise<SalesOrderResponse> {
    await requireNotMarketplace(this.database, id);
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const row = await this.single(this.database, actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`UPDATE sales.orders SET status = 'withdrawn', updated_at = now() WHERE id = ${id} AND status = 'pending' RETURNING id`);
      if (updated.rows.length > 0) await this.reservations.closeBySource(transaction, salesOrderSource, id, "released");
      // Đơn đối ứng nội bộ bị rút thì hủy, đơn mua bên kia đóng theo.
      if (updated.rows.length > 0 && row.is_counterpart) await this.endByCounterpart(transaction, id, "Bên bán rút đơn bán đối ứng", true);
    });
    return this.detail(actor, id);
  }

  // Hủy đơn chưa giao: nhả hàng giữ. Đơn đã có phiếu xuất giao hàng chỉ đóng được (QUYTAC_NGHIEPVU_71).
  async cancel(actor: Actor, id: string, version: number): Promise<SalesOrderResponse> {
    await requireNotMarketplace(this.database, id);
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
      await this.internalHooks?.afterEnded(transaction, id, "Bên bán hủy đơn bán đối ứng");
    });
    return this.detail(actor, id);
  }

  // Đóng đơn đã giao một phần: phần chưa giao hủy, nhả hàng giữ còn lại; còn phiếu xuất nháp thì chưa đóng được.
  async close(actor: Actor, id: string, reason: string, version: number): Promise<SalesOrderResponse> {
    await requireNotMarketplace(this.database, id);
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
      await this.internalHooks?.afterEnded(transaction, id, `Bên bán đóng đơn bán đối ứng: ${reason}`);
    });
    return this.detail(actor, id);
  }

  // Bên bán xác nhận đơn đối ứng nội bộ: chọn kho xuất rồi gửi như đơn thường (kiểm ngoại lệ, giữ hàng) (QUYTAC_NGHIEPVU_74).
  async confirmCounterpart(actor: Actor, id: string, input: { warehouseId: string; version: number }): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    const hours = await this.beforeSubmit(actor);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM sales.orders WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'counterpart_pending' AND version = ${input.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!(await isReceivingWarehouse(transaction, actor.companyId, input.warehouseId))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { warehouseId: "invalidValue" } });
      // Người xác nhận là người lập đơn đối ứng ở công ty này (rút được yêu cầu duyệt của mình).
      await transaction.execute(sql`
        UPDATE sales.orders SET warehouse_id = ${input.warehouseId}, status = 'draft', created_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.counterpart_confirm", entityId: id, afterData: input }, transaction);
      await this.submitWithin(transaction, actor, await this.single(transaction, actor.companyId, id), hours);
    });
    return this.detail(actor, id);
  }

  // Bên bán từ chối đơn đối ứng: hủy, đơn mua bên kia đóng theo.
  async rejectCounterpart(actor: Actor, id: string, input: { reason: string; version: number }): Promise<SalesOrderResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE sales.orders SET status = 'cancelled', counterpart_rejected_reason = ${input.reason}, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'counterpart_pending' AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.counterpart_reject", entityId: id, afterData: input }, transaction);
      await this.internalHooks?.afterEnded(transaction, id, `Bên bán từ chối: ${input.reason}`);
    });
    return this.detail(actor, id);
  }

  // Sinh đơn bán đối ứng từ đơn mua nội bộ đã duyệt của công ty mua; giá chưa thuế, thuế suất lấy theo đơn mua (đã tra bảng giá kênh Nội bộ khi lập),
  // không tra lại để đổi bảng giá trong lúc chờ duyệt không làm hỏng việc sinh đơn (QUYTAC_NGHIEPVU_74, 75).
  async createCounterpart(
    transaction: Executor,
    input: {
      companyId: string;
      customerId: string;
      channelId: string;
      orderDate: string;
      purchaseOrderId: string;
      createdBy: string;
      lines: { variantId: string; unitId: string; quantity: string; netUnitPrice: string; vatRate: VatRate }[];
    },
  ): Promise<string> {
    const groupId = await this.customerGroup(transaction, input.companyId, input.customerId);
    const lines: PreparedLine[] = input.lines.map((line) => {
      const net = Number(line.quantity) * Number(line.netUnitPrice);
      const tax = net * vatFraction(line.vatRate);
      return withoutPromotion({
        variantId: line.variantId,
        unitId: line.unitId,
        quantity: line.quantity,
        baseQuantity: line.quantity,
        priceListId: null,
        listPrice: line.netUnitPrice,
        includesVat: false,
        discountPercent: "0",
        unitPrice: line.netUnitPrice,
        vatRate: line.vatRate,
        net: net.toFixed(4),
        tax: tax.toFixed(4),
        total: (Number(net.toFixed(4)) + Number(tax.toFixed(4))).toFixed(4),
      });
    });
    const orderId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO sales.orders (company_id, customer_id, channel_id, customer_group_id, warehouse_id, order_date, currency, status, counterpart_order_id, is_counterpart, created_by)
      VALUES (${input.companyId}, ${input.customerId}, ${input.channelId}, ${groupId}, NULL, ${input.orderDate}::date, ${await companyCurrency(transaction, input.companyId)}, 'counterpart_pending',
        ${input.purchaseOrderId}, true, ${input.createdBy}) RETURNING id`)
    ).rows[0]!.id;
    await this.writeLines(transaction, orderId, lines);
    return orderId;
  }

  async linkCounterpart(transaction: Executor, orderId: string, purchaseOrderId: string): Promise<void> {
    await transaction.execute(sql`UPDATE sales.orders SET counterpart_order_id = ${purchaseOrderId} WHERE id = ${orderId}`);
  }

  // Bên mua đóng, từ chối, không duyệt đơn đối ứng: đơn bán chưa giao thì hủy, đã giao một phần thì đóng; nhả hàng giữ (QUYTAC_NGHIEPVU_78). Không lan ngược lại.
  async endByCounterpart(transaction: Executor, orderId: string, reason: string, propagate = false): Promise<void> {
    const row = (await transaction.execute<{ status: SalesOrderStatus }>(sql`SELECT status FROM sales.orders WHERE id = ${orderId} FOR UPDATE`)).rows[0];
    if (!row || ["delivered", "cancelled", "closed"].includes(row.status)) {
      if (propagate) await this.internalHooks?.afterEnded(transaction, orderId, reason);
      return;
    }
    const issues = await transaction.execute<{ status: string }>(sql`SELECT status FROM inventory.documents WHERE type = 'sales_issue' AND source_id = ${orderId}`);
    if (issues.rows.some((issue) => issue.status === "draft")) throw new ApiError("BUSINESS_RULE", "salesOrderHasOpenIssues");
    const next = issues.rows.length > 0 ? "closed" : "cancelled";
    const ended = await transaction.execute<{ approval_request_id: string | null }>(sql`
      UPDATE sales.orders SET status = ${next}, closed_reason = ${reason}, closed_at = CASE WHEN ${next} = 'closed' THEN now() END, updated_at = now(), version = version + 1
      WHERE id = ${orderId} RETURNING approval_request_id`);
    const requestId = ended.rows[0]?.approval_request_id;
    if (row.status === "pending" && requestId) await this.approvals.cancelWithin(transaction, requestId);
    await this.reservations.closeBySource(transaction, salesOrderSource, orderId, "released");
    if (propagate) await this.internalHooks?.afterEnded(transaction, orderId, reason);
  }

  private async isCounterpart(executor: Executor, orderId: string): Promise<boolean> {
    return (await executor.execute<{ is_counterpart: boolean }>(sql`SELECT is_counterpart FROM sales.orders WHERE id = ${orderId}`)).rows[0]?.is_counterpart ?? false;
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

  // Đơn của người mua VComm (CONG_VIEC_24; QUYTAC_NGHIEPVU_158): giá theo kênh, khuyến mãi như đơn bán, không gắn khách hàng, không chiết khấu tay.
  async quoteMarketplace(
    transaction: Executor,
    companyId: string,
    input: { channelId: string; warehouseId: string; orderDate: string; lines: { variantId: string; unitId: string; quantity: string; discountPercent?: string }[]; groupPrice?: string | null },
  ): Promise<{ lines: PreparedLine[]; giftShortages: GiftShortage[] }> {
    const priced = await this.priceLines(
      transaction,
      companyId,
      input.channelId,
      null,
      input.orderDate,
      input.lines.map((line) => ({ ...line, discountPercent: line.discountPercent ?? "0" })),
    );
    // Đơn mua chung (CONG_VIEC_49; QUYTAC_NGHIEPVU_330): đơn giá bậc gồm thuế thay giá bảng giá, không khuyến mãi.
    if (input.groupPrice) return { lines: priced.map((line) => groupPriced(line, input.groupPrice!)), giftShortages: [] };
    return applyPromotions(
      transaction,
      { companyId, orderId: null, channelId: input.channelId, customerGroupId: null, orderDate: input.orderDate, internal: false, warehouseId: input.warehouseId, allowsGoodsGifts: true },
      priced,
    );
  }

  // Dãy số đơn bán của công ty, tạo ngoài giao dịch đặt hàng.
  async prepareNumbering(actor: Actor): Promise<void> {
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "DBH");
  }

  // Lập và xác nhận ngay đơn của người mua trong giao dịch của bên gọi: giữ hàng không thời hạn (đơn chờ giao); có ngoại lệ cần duyệt thì không lập.
  async placeMarketplaceWithin(
    transaction: Executor,
    actor: Actor,
    input: {
      channelId: string;
      warehouseId: string;
      orderDate: string;
      buyerName: string;
      deliveryAddress: string;
      lines: { variantId: string; unitId: string; quantity: string }[];
      groupPrice?: string | null;
    },
  ): Promise<{ orderId: string; documentNo: string }> {
    return this.placeConfirmedWithin(transaction, actor, { ...input, retail: null }, () => {
      throw new ApiError("BUSINESS_RULE", "marketplaceOrderNeedsReview");
    });
  }

  // Hóa đơn bán lẻ tại quầy (CONG_VIEC_53; QUYTAC_NGHIEPVU_371, 372, 374; THAY_DOI_24): như đơn VComm, có giảm tay; vượt mức giảm tay, dưới giá vốn thì chặn, không gửi duyệt.
  async placeRetailWithin(
    transaction: Executor,
    actor: Actor,
    input: {
      channelId: string;
      warehouseId: string;
      orderDate: string;
      buyerName: string | null;
      buyerTaxCode: string | null;
      buyerAddress: string | null;
      buyerIdentityNo: string | null;
      lines: { variantId: string; unitId: string; quantity: string; discountPercent: string }[];
    },
  ): Promise<{ orderId: string; documentNo: string }> {
    return this.placeConfirmedWithin(
      transaction,
      actor,
      { ...input, deliveryAddress: null, retail: { taxCode: input.buyerTaxCode, address: input.buyerAddress, identityNo: input.buyerIdentityNo } },
      (exceptions) => {
        const first = exceptions[0]!;
        throw new ApiError("BUSINESS_RULE", first.kind === "discount" ? "retailDiscountOverLimit" : "retailBelowCost");
      },
    );
  }

  private async placeConfirmedWithin(
    transaction: Executor,
    actor: Actor,
    input: {
      channelId: string;
      warehouseId: string;
      orderDate: string;
      buyerName: string | null;
      deliveryAddress: string | null;
      retail: { taxCode: string | null; address: string | null; identityNo: string | null } | null;
      lines: { variantId: string; unitId: string; quantity: string; discountPercent?: string }[];
    },
    rejectExceptions: (exceptions: SalesException[]) => never,
  ): Promise<{ orderId: string; documentNo: string }> {
    const { lines, giftShortages } = await this.quoteMarketplace(transaction, actor.companyId, input);
    const orderId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO sales.orders (company_id, customer_id, buyer_name, channel_id, customer_group_id, warehouse_id, order_date, delivery_address, note, currency, gift_shortages, created_by,
        is_retail, buyer_tax_code, buyer_address, buyer_identity_no)
      VALUES (${actor.companyId}, NULL, ${input.buyerName}, ${input.channelId}, NULL, ${input.warehouseId}, ${input.orderDate}::date, ${input.deliveryAddress}, NULL,
        ${await companyCurrency(transaction, actor.companyId)}, ${JSON.stringify(giftShortages)}::jsonb, ${actor.userId},
        ${input.retail !== null}, ${input.retail?.taxCode ?? null}, ${input.retail?.address ?? null}, ${input.retail?.identityNo ?? null}) RETURNING id`)
    ).rows[0]!.id;
    await this.writeLines(transaction, orderId, lines);
    await this.checkPromotionLimits(transaction, orderId);
    const documentNo = await this.sequences.next(actor.companyId, documentTypeCode, transaction);
    // Dịch vụ không giữ hàng (QUYTAC_NGHIEPVU_275).
    const goods = await goodsVariants(
      transaction,
      lines.map((line) => line.variantId),
    );
    const totals = new Map<string, number>();
    for (const line of lines) if (goods.has(line.variantId)) totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + Number(line.baseQuantity));
    for (const [variantId, quantity] of [...totals].sort(([left], [right]) => left.localeCompare(right))) {
      await this.reservations.reserve(transaction, {
        warehouseId: input.warehouseId,
        companyId: actor.companyId,
        variantId,
        quantity: quantity.toFixed(4),
        sourceType: salesOrderSource,
        sourceId: orderId,
        sourceNo: documentNo,
        expiresAt: null,
        userId: actor.userId,
      });
    }
    const current = await this.single(transaction, actor.companyId, orderId);
    const exceptionLines = await transaction.execute<ExceptionLine>(sql`
      SELECT line_no, variant_id, base_quantity::text, discount_percent::text, net_amount::text, is_gift, promotion_discount_total::text, vat_rate
      FROM sales.order_lines WHERE order_id = ${orderId} ORDER BY line_no`);
    const exceptions = await this.exceptions(transaction, current, exceptionLines.rows);
    if (exceptions.length > 0) rejectExceptions(exceptions);
    await transaction.execute(sql`
      UPDATE sales.orders SET status = 'confirmed', document_no = ${documentNo}, submitted_at = now(), confirmed_at = now(), updated_at = now(), version = version + 1 WHERE id = ${orderId}`);
    const action = input.retail ? "sales_order.retail_place" : "sales_order.marketplace_place";
    await this.auditService.record({ ...salesAudit(actor, "sales_order"), action, entityId: orderId, afterData: { documentNo, input } }, transaction);
    return { orderId, documentNo };
  }

  // Chốt nhóm mua chung thành công (CONG_VIEC_49; QUYTAC_NGHIEPVU_331): sửa đơn giá các dòng thành giá chốt gồm thuế trước khi xuất kho, tính lại tổng đơn bán.
  async repriceMarketplaceWithin(transaction: Executor, orderId: string, grossPrice: string): Promise<void> {
    const issued = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE type = 'sales_issue' AND source_id = ${orderId} LIMIT 1`);
    if (issued.rows.length > 0) throw new ApiError("BUSINESS_RULE", "salesOrderNotCancellable");
    const lines = await transaction.execute<{ id: string; vat_rate: VatRate; quantity: string }>(sql`
      SELECT id, vat_rate, quantity::text FROM sales.order_lines WHERE order_id = ${orderId} AND NOT is_gift FOR UPDATE`);
    for (const line of lines.rows) {
      const amounts = lineAmounts(grossPrice, true, line.vat_rate, line.quantity, 0, "0");
      await transaction.execute(sql`
        UPDATE sales.order_lines SET list_price = ${grossPrice}::numeric, price_includes_vat = true, unit_price = ${amounts.unitPrice}::numeric,
          net_amount = ${amounts.net}::numeric, tax_amount = ${amounts.tax}::numeric, total_amount = ${amounts.total}::numeric
        WHERE id = ${line.id}`);
    }
    await transaction.execute(sql`
      UPDATE sales.orders SET net_amount = t.net, tax_amount = t.tax, total_amount = t.total, updated_at = now(), version = version + 1
      FROM (SELECT coalesce(sum(net_amount), 0) AS net, coalesce(sum(tax_amount), 0) AS tax, coalesce(sum(total_amount), 0) AS total FROM sales.order_lines WHERE order_id = ${orderId}) t
      WHERE id = ${orderId}`);
  }

  // Hủy đơn của người mua chưa xuất kho, trong giao dịch của bên gọi: nhả hàng giữ.
  async cancelMarketplaceWithin(transaction: Executor, actor: Actor, orderId: string): Promise<void> {
    const issued = await transaction.execute(sql`SELECT 1 FROM inventory.documents WHERE type = 'sales_issue' AND source_id = ${orderId} LIMIT 1`);
    if (issued.rows.length > 0) throw new ApiError("BUSINESS_RULE", "salesOrderNotCancellable");
    await transaction.execute(sql`UPDATE sales.orders SET status = 'cancelled', updated_at = now(), version = version + 1 WHERE id = ${orderId} AND status = 'confirmed'`);
    await this.reservations.closeBySource(transaction, salesOrderSource, orderId, "released");
    await this.auditService.record({ ...salesAudit(actor, "sales_order"), action: "sales_order.cancel", entityId: orderId }, transaction);
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
        INSERT INTO sales.settings (company_id, max_manual_discount_percent, allow_manual_goods_orders, updated_by)
        VALUES (${actor.companyId}, ${input.maxManualDiscountPercent}::numeric, ${input.allowManualGoodsOrders ?? before.allowManualGoodsOrders}, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET max_manual_discount_percent = EXCLUDED.max_manual_discount_percent, allow_manual_goods_orders = EXCLUDED.allow_manual_goods_orders,
          updated_by = EXCLUDED.updated_by, updated_at = now(),
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

  // Ngoại lệ: chiết khấu vượt mức; dưới giá vốn bình quân tại kho; vượt hạn mức công nợ theo số dư công nợ phải thu cộng phần chưa giao của đơn đã xác nhận (QUYTAC_NGHIEPVU_68, 92; THAY_DOI_09).
  // Gửi đơn: khóa chương trình đã áp, kiểm lại ngân sách, suất cùng các đơn khác; không đủ thì người bán lưu lại để tính lại (QUYTAC_NGHIEPVU_82).
  private async checkPromotionLimits(transaction: Executor, orderId: string): Promise<void> {
    const used = await transaction.execute<{ id: string }>(sql`
      SELECT p.id FROM sales.promotions p
      WHERE p.id IN (SELECT promotion_id FROM sales.order_lines WHERE order_id = ${orderId} UNION SELECT order_promotion_id FROM sales.order_lines WHERE order_id = ${orderId})
      ORDER BY p.id FOR UPDATE`);
    for (const promotion of used.rows) {
      const over = await transaction.execute(sql`
        SELECT 1 FROM sales.promotions p WHERE p.id = ${promotion.id} AND (
          (p.budget_amount IS NOT NULL AND ${promotionUsage(sql`p.id`, sql`${orderId}::uuid`)} + coalesce((
            SELECT sum(CASE WHEN l.promotion_id = p.id AND NOT l.is_gift THEN l.promotion_discount_total - l.order_discount_amount ELSE 0 END)
                 + sum(CASE WHEN l.order_promotion_id = p.id THEN l.order_discount_amount ELSE 0 END)
            FROM sales.order_lines l WHERE l.order_id = ${orderId}), 0) > p.budget_amount + 0.00005)
          OR (p.max_gift_sets IS NOT NULL AND ${promotionGiftUsage(sql`p.id`, sql`${orderId}::uuid`)} + coalesce((
            SELECT sum(l.gift_sets) FROM sales.order_lines l WHERE l.order_id = ${orderId} AND l.promotion_id = p.id AND l.is_gift), 0) > p.max_gift_sets))`);
      if (over.rows.length > 0) throw new ApiError("BUSINESS_RULE", "promotionLimitExceeded");
    }
  }

  private async exceptions(transaction: Executor, order: OrderRow, lines: ExceptionLine[]): Promise<SalesException[]> {
    const result: SalesException[] = [];
    const maximum = Number((await readSettings(transaction, order.company_id)).maxManualDiscountPercent);
    for (const line of lines) {
      if (Number(line.discount_percent) > maximum + 0.000001) result.push({ kind: "discount", lineNo: line.line_no, detail: `${trimDecimal(line.discount_percent)}% > ${maximum}%` });
      const cost = (
        await transaction.execute<{ average_cost: string; quantity: string }>(sql`
        SELECT average_cost::text, quantity::text FROM inventory.costs WHERE warehouse_id = ${order.warehouse_id} AND company_id = ${order.company_id} AND variant_id = ${line.variant_id}`)
      ).rows[0];
      // So giá vốn với giá sau chiết khấu tay, trước khuyến mãi; dòng hàng tặng không xét (QUYTAC_NGHIEPVU_83).
      const promotionNet = Number(line.promotion_discount_total) / (1 + vatFraction(line.vat_rate));
      const unitNet = (Number(line.net_amount) + promotionNet) / Number(line.base_quantity);
      if (!line.is_gift && cost && Number(cost.quantity) > 0 && unitNet < Number(cost.average_cost) - 0.00005) {
        result.push({ kind: "below_cost", lineNo: line.line_no, detail: `${trimDecimal(unitNet.toFixed(4))} < ${trimDecimal(cost.average_cost)}` });
      }
    }
    if (order.customer_id) {
      const profile = (
        await transaction.execute<{ credit_limit: string | null }>(sql`
        SELECT credit_limit::text FROM crm.partner_profiles WHERE company_id = ${order.company_id} AND partner_id = ${order.customer_id}`)
      ).rows[0];
      if (profile?.credit_limit !== null && profile?.credit_limit !== undefined) {
        const exposure = (
          await transaction.execute<{ value: string }>(sql`
          SELECT (
            coalesce((SELECT sum(l.total_amount * greatest(l.base_quantity - ${deliveredOnOrderLine(sql`l.id`)}, 0) / l.base_quantity)
                      FROM sales.order_lines l JOIN sales.orders o ON o.id = l.order_id
                      WHERE o.company_id = ${order.company_id} AND o.customer_id = ${order.customer_id} AND o.status = 'confirmed' AND o.id <> ${order.id}), 0)
            + ${receivableBalance(order.company_id, order.customer_id)}
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
  private async prepare(transaction: Executor, companyId: string, input: Input, orderId: string | null): Promise<{ lines: PreparedLine[]; groupId: string | null; giftShortages: GiftShortage[] }> {
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
    if (!(await isReceivingWarehouse(transaction, companyId, input.warehouseId, true))) fields.warehouseId = "invalidValue";
    if (input.customerId && !fields.customerId && !fields.channelId) {
      Object.assign(
        fields,
        await internalSalesErrors(
          transaction,
          companyId,
          input.customerId,
          input.channelId,
          input.lines.map((line) => line.variantId),
        ),
      );
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const priced = await this.priceLines(transaction, companyId, input.channelId, groupId, input.orderDate, input.lines);
    // Khuyến mãi tự áp khi lưu; đơn bán nội bộ không áp (QUYTAC_NGHIEPVU_81).
    const internal = input.customerId ? (await internalCompanyOf(transaction, input.customerId)) !== null : false;
    const { lines, giftShortages } = await applyPromotions(
      transaction,
      {
        companyId,
        orderId,
        channelId: input.channelId,
        customerGroupId: groupId,
        orderDate: input.orderDate,
        internal,
        warehouseId: input.warehouseId,
        allowsGoodsGifts: await allowsManualGoodsOrders(transaction, companyId),
      },
      priced,
    );
    // Đơn bán lập tay, kể cả hàng tặng khuyến mãi (QUYTAC_NGHIEPVU_276).
    await requireManualOrderLines(
      transaction,
      companyId,
      lines.map((line) => line.variantId),
    );
    return { lines, groupId, giftShortages };
  }

  // Tra giá từng dòng theo kênh, nhóm khách tại ngày đơn; tính tiền theo cách tính thuế của bảng giá.
  private async priceLines(
    transaction: Executor,
    companyId: string,
    channelId: string,
    groupId: string | null,
    orderDate: string,
    inputLines: { variantId: string; unitId: string; quantity: string; discountPercent: string }[],
  ): Promise<PreparedLine[]> {
    const fields: FieldErrors = {};
    const currency = await companyCurrency(transaction, companyId);
    const lines: PreparedLine[] = [];
    for (const [index, line] of inputLines.entries()) {
      const unit = await variantUnitFactor(transaction, companyId, line.variantId, line.unitId);
      if (!unit) {
        fields[`lines.${index}.unitId`] = "invalidValue";
        continue;
      }
      const price = await lookupPrice(transaction, companyId, { variantId: line.variantId, unitId: line.unitId, channelId, customerGroupId: groupId ?? undefined, currency }, orderDate);
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
      lines.push(
        withoutPromotion({
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
        }),
      );
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return lines;
  }

  private async writeLines(transaction: Executor, orderId: string, lines: PreparedLine[]): Promise<void> {
    for (const [index, line] of lines.entries()) {
      await transaction.execute(sql`
        INSERT INTO sales.order_lines (order_id, line_no, variant_id, unit_id, quantity, base_quantity, price_list_id, list_price, price_includes_vat, discount_percent, unit_price, vat_rate,
          net_amount, tax_amount, total_amount, promotion_id, promotion_percent, order_promotion_id, order_discount_amount, promotion_discount_total, is_gift, gift_sets)
        VALUES (${orderId}, ${index + 1}, ${line.variantId}, ${line.unitId}, ${line.quantity}::numeric, ${line.baseQuantity}::numeric, ${line.priceListId}, ${line.listPrice}::numeric,
          ${line.includesVat}, ${line.discountPercent}::numeric, ${line.unitPrice}::numeric, ${line.vatRate}, ${line.net}::numeric, ${line.tax}::numeric, ${line.total}::numeric,
          ${line.promotionId}, ${line.promotionPercent}::numeric, ${line.orderPromotionId}, ${line.orderDiscountAmount}::numeric, ${line.promotionDiscountTotal}::numeric, ${line.isGift},
          ${line.giftSets})`);
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
      coalesce(w.name, '') AS warehouse_name, o.order_date, o.delivery_address, c.company_id AS customer_company_id, o.counterpart_order_id, o.is_counterpart, o.counterpart_rejected_reason, o.gift_shortages, o.note, o.currency, o.status, o.exceptions, o.approval_request_id, o.net_amount::text, o.tax_amount::text,
      o.total_amount::text, o.closed_reason, o.created_by, cu.full_name AS created_by_name, o.version,
      ak.name AS open_api_key_name, o.partner_order_code, o.recipient_name, o.recipient_phone, c.created_via_api_key_id IS NOT NULL AS customer_via_open_api`;
  }

  private from(): SQL {
    return sql`FROM sales.orders o LEFT JOIN crm.partners c ON c.id = o.customer_id JOIN catalog.sales_channels ch ON ch.id = o.channel_id
      LEFT JOIN inventory.warehouses w ON w.id = o.warehouse_id JOIN core.users cu ON cu.id = o.created_by
      LEFT JOIN core.api_keys ak ON ak.id = o.open_api_key_id`;
  }
}

export async function readSettings(executor: Pick<Database, "execute">, companyId: string): Promise<SalesSettingsResponse> {
  const row = (
    await executor.execute<{ percent: string; allowed: boolean; version: number }>(sql`
    SELECT max_manual_discount_percent::text AS percent, allow_manual_goods_orders AS allowed, version FROM sales.settings WHERE company_id = ${companyId}`)
  ).rows[0];
  return { maxManualDiscountPercent: row ? trimDecimal(row.percent) : "0", allowManualGoodsOrders: row?.allowed ?? false, version: row?.version ?? 0 };
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
    // CONG_VIEC_61: đơn tạo qua Open API (QUYTAC_NGHIEPVU_490).
    openApi: row.partner_order_code ? { keyName: row.open_api_key_name ?? "", partnerOrderCode: row.partner_order_code } : null,
  };
}
