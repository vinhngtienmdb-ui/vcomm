// Đơn VComm: xem trước, đặt hàng, đơn của tôi, hủy; quản trị đơn trên web (CONG_VIEC_24; CHUC_NANG_116; QUYTAC_NGHIEPVU_158, 159; API_126, API_127).
import { Inject, Injectable } from "@nestjs/common";
import type {
  BuyerOrderDetail,
  BuyerOrderListItem,
  BuyerOrderPreview,
  CarrierCode,
  MarketplaceOrderDetail,
  MarketplaceOrderLine,
  MarketplaceOrderListItem,
  MarketplaceOrderStatus,
  PageResponse,
  PaymentMethodCode,
} from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { returnedOnOrderLine, SalesOrdersService } from "../sales/sales-orders.service";
import type { ClientInfo } from "../auth/auth.service";
import { localPhone } from "./buyer-accounts.service";
import type { BuyerAdminActor } from "./buyer-admin.service";
import { buyerAccount, sellableVariants, shopImagePath, vietnamToday } from "./shop.service";
import { carrierNames, enabledPaymentMethods, loadStoreContext, type StoreContext } from "./store.service";
import { isOnlineMethod } from "./payments/payment-gateway-registry";
import { carrierConfigured } from "./carriers/carrier-registry";
import { buyerReturnRequests, returnWindowHours } from "./return-requests.service";

type Executor = Pick<Database, "execute" | "insert">;
type Line = { variantId: string; quantity: number };
const dailyOrderLimit = 20;

type OrderRow = {
  id: string;
  sales_order_id: string;
  document_no: string;
  buyer_user_id: string;
  buyer_name: string;
  buyer_phone: string | null;
  recipient_name: string;
  recipient_phone: string;
  province_name: string;
  ward_name: string;
  street_address: string;
  goods_amount: string;
  shipping_fee: string;
  cod_amount: string;
  total_amount: string;
  payment_method: PaymentMethodCode;
  status: MarketplaceOrderStatus;
  delivered_at: Date | null;
  completed_at: Date | null;
  completed_amount: string | null;
  cancel_reason: string | null;
  created_at: Date;
  version: number;
  item_count: number;
  first_product_name: string;
  first_image_id: string | null;
  carrier_code: CarrierCode | null;
  tracking_code: string | null;
  carrier_status: string | null;
};

const money = (value: number) => trimDecimal(value.toFixed(4));
// Tiền đồng Việt Nam làm tròn đến đồng (tiền thu hộ, phí giao hàng).
const roundCurrency = (value: number) => Math.round(value);
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

const orderSelect = sql`
  SELECT m.id, m.sales_order_id, so.document_no, m.buyer_user_id, u.full_name AS buyer_name, u.phone AS buyer_phone, m.recipient_name, m.recipient_phone, m.province_name,
    m.ward_name, m.street_address, m.goods_amount::text, m.shipping_fee::text, m.cod_amount::text, m.total_amount::text, m.payment_method, m.status, m.delivered_at, m.completed_at, m.completed_amount::text,
    m.cancel_reason, m.created_at, m.version,
    (SELECT count(*)::int FROM sales.order_lines l WHERE l.order_id = so.id AND NOT l.is_gift) AS item_count,
    (SELECT p.name FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = so.id ORDER BY l.line_no LIMIT 1) AS first_product_name,
    (SELECT i.id FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.product_images i ON i.product_id = v.product_id
      WHERE l.order_id = so.id ORDER BY l.line_no, i.sort_order LIMIT 1) AS first_image_id,
    s.carrier_code, s.tracking_code, s.carrier_status
  FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id
  LEFT JOIN marketplace.shipments s ON s.order_id = m.id AND s.is_active`;

const listItem = (row: OrderRow): BuyerOrderListItem => ({
  id: row.id,
  documentNo: row.document_no,
  status: row.status,
  createdAt: iso(row.created_at)!,
  total: trimDecimal(row.total_amount),
  itemCount: row.item_count,
  firstProductName: row.first_product_name,
  imageUrl: shopImagePath(row.first_image_id),
});

// Hủy được khi chưa có đơn vị vận chuyển lấy hàng (QUYTAC_NGHIEPVU_159).
export const cancellableStatuses: MarketplaceOrderStatus[] = ["awaiting_shipment", "awaiting_pickup"];

// Hủy vận đơn khi hủy đơn đang chờ lấy hàng; đăng ký ở lát vận chuyển (ShipmentsService).
export interface ShipmentCanceller {
  cancelActive(transaction: Executor, orderId: string): Promise<void>;
}

@Injectable()
export class MarketplaceOrdersService {
  shipmentCanceller: ShipmentCanceller | null = null;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly salesOrders: SalesOrdersService,
  ) {}

  private async storeContext(): Promise<StoreContext> {
    const context = await loadStoreContext(this.database);
    if (!context) throw new ApiError("BUSINESS_RULE", "storeNotReady");
    return context;
  }

  // Tính dòng, khuyến mãi, phí giao hàng như lúc đặt (QUYTAC_NGHIEPVU_155, 158).
  private async quote(
    executor: Executor,
    context: StoreContext,
    lines: Line[],
  ): Promise<{ lines: MarketplaceOrderLine[]; goods: number; shippingFee: number; input: { variantId: string; unitId: string; quantity: string }[] }> {
    const merged = new Map<string, number>();
    for (const line of lines) merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
    const sellable = await sellableVariants(executor, context, [...merged.keys()]);
    const missing = [...merged.keys()].filter((variantId) => !sellable.has(variantId));
    if (missing.length > 0) throw new ApiError("BUSINESS_RULE", "productNotSellable");
    const today = await vietnamToday(executor);
    const input = [...merged].map(([variantId, quantity]) => ({ variantId, unitId: sellable.get(variantId)!.unitId, quantity: String(quantity) }));
    const quoted = await this.salesOrders.quoteMarketplace(executor, context.companyId, { channelId: context.channelId, warehouseId: context.warehouseId, orderDate: today, lines: input });
    const details = await this.describe(
      executor,
      quoted.lines.map((line) => line.variantId),
    );
    const result = quoted.lines.map((line) => {
      const quantity = Number(line.quantity);
      const unitPrice = line.isGift ? 0 : (Number(line.total) + Number(line.promotionDiscountTotal)) / quantity;
      return {
        variantId: line.variantId,
        ...details.get(line.variantId)!,
        quantity: trimDecimal(line.quantity),
        unitPrice: money(unitPrice),
        promotionDiscount: money(Number(line.promotionDiscountTotal)),
        total: money(Number(line.total)),
        isGift: line.isGift,
        orderLineId: null,
      };
    });
    const goods = roundCurrency(quoted.lines.reduce((sum, line) => sum + Number(line.total), 0));
    const threshold = context.freeShippingThreshold === null ? null : Number(context.freeShippingThreshold);
    const shippingFee = threshold !== null && goods >= threshold ? 0 : roundCurrency(Number(context.shippingFee));
    return { lines: result, goods, shippingFee, input };
  }

  private async describe(executor: Executor, variantIds: string[]): Promise<Map<string, { productName: string; variantLabel: string; imageUrl: string | null }>> {
    const result = new Map<string, { productName: string; variantLabel: string; imageUrl: string | null }>();
    if (variantIds.length === 0) return result;
    const rows = await executor.execute<{ id: string; name: string; option_values: string[] | null; image_id: string | null }>(sql`
      SELECT v.id, p.name, v.option_values, (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_id
      FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id IN (${sql.join(
        variantIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`);
    for (const row of rows.rows) result.set(row.id, { productName: row.name, variantLabel: (row.option_values ?? []).filter(Boolean).join(" · "), imageUrl: shopImagePath(row.image_id) });
    return result;
  }

  async preview(userId: string, lines: Line[]): Promise<BuyerOrderPreview> {
    const account = await buyerAccount(this.database, userId);
    const context = await this.storeContext();
    const quoted = await this.quote(this.database, context, lines);
    const paymentMethods = await enabledPaymentMethods(this.database);
    return {
      lines: quoted.lines,
      goodsAmount: String(quoted.goods),
      shippingFee: String(quoted.shippingFee),
      total: String(quoted.goods + quoted.shippingFee),
      currency: context.currency,
      canOrder: (context.orderingOpen || account.isTestBuyer) && paymentMethods.length > 0,
      paymentMethods,
    };
  }

  // Đặt hàng (QUYTAC_NGHIEPVU_158, 164): chưa mở đặt hàng thì chỉ người mua thử; phương thức phải đang bật; tính lại giá, so với tổng người mua đã thấy; lập đơn bán, giữ hàng.
  async place(userId: string, client: ClientInfo, input: { addressId: string; lines: Line[]; expectedTotal: string; paymentMethod: PaymentMethodCode }): Promise<BuyerOrderDetail> {
    const account = await buyerAccount(this.database, userId);
    const context = await this.storeContext();
    if (!context.orderingOpen && !account.isTestBuyer) throw new ApiError("BUSINESS_RULE", "orderingNotOpen");
    if (!(await enabledPaymentMethods(this.database)).includes(input.paymentMethod)) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    // Thanh toán trực tuyến làm ở lát L1.
    if (isOnlineMethod(input.paymentMethod)) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
    const actor: Actor = { userId, companyId: context.companyId, client };
    await this.salesOrders.prepareNumbering(actor);
    const orderId = await this.database.transaction(async (transaction) => {
      // Khóa tài khoản người mua: đếm số lần đặt trong ngày, xóa giỏ không chạy đồng thời.
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      const today = await vietnamToday(transaction);
      const placed = (
        await transaction.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM marketplace.orders WHERE buyer_user_id = ${userId} AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = ${today}::date`)
      ).rows[0]!.count;
      if (placed >= dailyOrderLimit) throw new ApiError("BUSINESS_RULE", "dailyOrderLimit");
      const address = (
        await transaction.execute<{ recipient_name: string; phone: string; province_code: string; province_name: string; ward_code: string; ward_name: string; street_address: string }>(sql`
        SELECT a.recipient_name, a.phone, a.province_code, p.full_name AS province_name, a.ward_code, w.full_name AS ward_name, a.street_address
        FROM marketplace.buyer_addresses a JOIN marketplace.provinces p ON p.code = a.province_code JOIN marketplace.wards w ON w.code = a.ward_code
        WHERE a.id = ${input.addressId} AND a.buyer_user_id = ${userId}`)
      ).rows[0];
      if (!address) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { addressId: "invalidValue" } });
      const quoted = await this.quote(transaction, context, input.lines);
      const total = quoted.goods + quoted.shippingFee;
      if (Math.abs(total - Number(input.expectedTotal)) > 0.5) throw new ApiError("BUSINESS_RULE", "orderPriceChanged");
      const deliveryAddress = `${address.recipient_name}, ${localPhone(address.phone)}, ${address.street_address}, ${address.ward_name}, ${address.province_name}`;
      const sale = await this.salesOrders
        .placeMarketplaceWithin(transaction, actor, {
          channelId: context.channelId,
          warehouseId: context.warehouseId,
          orderDate: today,
          buyerName: address.recipient_name,
          deliveryAddress,
          lines: quoted.input,
        })
        .catch((error: unknown) => {
          // Thiếu hàng khi giữ hàng: báo chung cho người mua.
          if (error instanceof ApiError && error.messageKey === "insufficientAvailableStock") throw new ApiError("BUSINESS_RULE", "orderOutOfStock");
          throw error;
        });
      const id = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO marketplace.orders (sales_order_id, company_id, buyer_user_id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name, street_address,
          goods_amount, shipping_fee, cod_amount, total_amount, payment_method)
        VALUES (${sale.orderId}, ${context.companyId}, ${userId}, ${address.recipient_name}, ${address.phone}, ${address.province_code}, ${address.province_name}, ${address.ward_code},
          ${address.ward_name}, ${address.street_address}, ${quoted.goods}, ${quoted.shippingFee}, ${input.paymentMethod === "cod" ? total : 0}, ${total}, ${input.paymentMethod}) RETURNING id`)
      ).rows[0]!.id;
      await this.event(transaction, id, "awaiting_shipment", null, userId);
      await transaction.execute(sql`
        DELETE FROM marketplace.cart_lines WHERE buyer_user_id = ${userId} AND variant_id IN (${sql.join(
          input.lines.map((line) => sql`${line.variantId}::uuid`),
          sql`, `,
        )})`);
      return id;
    });
    return this.buyerDetail(userId, orderId);
  }

  async event(executor: Pick<Database, "execute">, orderId: string, status: string, note: string | null, actorUserId: string | null): Promise<void> {
    await executor.execute(sql`INSERT INTO marketplace.order_events (order_id, status, note, actor_user_id) VALUES (${orderId}, ${status}, ${note}, ${actorUserId})`);
  }

  async buyerList(userId: string, query: { status?: MarketplaceOrderStatus | undefined; page: number; pageSize: number }): Promise<PageResponse<BuyerOrderListItem>> {
    const where = sql`m.buyer_user_id = ${userId} AND (${query.status ?? null}::text IS NULL OR m.status = ${query.status ?? null}::text)`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.orders m WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(sql`${orderSelect} WHERE ${where} ORDER BY m.created_at DESC, m.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(listItem), page: query.page, pageSize: query.pageSize, total };
  }

  private async row(executor: Pick<Database, "execute">, orderId: string): Promise<OrderRow> {
    const row = (await executor.execute<OrderRow>(sql`${orderSelect} WHERE m.id = ${orderId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async lines(salesOrderId: string): Promise<MarketplaceOrderLine[]> {
    const rows = await this.database.execute<{ id: string; variant_id: string; quantity: string; total_amount: string; promotion_discount_total: string; is_gift: boolean }>(sql`
      SELECT id, variant_id, quantity::text, total_amount::text, promotion_discount_total::text, is_gift FROM sales.order_lines WHERE order_id = ${salesOrderId} ORDER BY line_no`);
    const details = await this.describe(
      this.database,
      rows.rows.map((row) => row.variant_id),
    );
    return rows.rows.map((row) => ({
      variantId: row.variant_id,
      ...details.get(row.variant_id)!,
      quantity: trimDecimal(row.quantity),
      unitPrice: money(row.is_gift ? 0 : (Number(row.total_amount) + Number(row.promotion_discount_total)) / Number(row.quantity)),
      promotionDiscount: money(Number(row.promotion_discount_total)),
      total: money(Number(row.total_amount)),
      isGift: row.is_gift,
      orderLineId: row.id,
    }));
  }

  private async detailOf(row: OrderRow): Promise<BuyerOrderDetail> {
    const returnRequests = await buyerReturnRequests(this.database, row.id);
    const events = await this.database.execute<{ status: string; note: string | null; created_at: Date }>(
      sql`SELECT status, note, created_at FROM marketplace.order_events WHERE order_id = ${row.id} ORDER BY created_at, id`,
    );
    return {
      ...listItem(row),
      recipientName: row.recipient_name,
      recipientPhone: localPhone(row.recipient_phone),
      address: `${row.street_address}, ${row.ward_name}, ${row.province_name}`,
      lines: await this.lines(row.sales_order_id),
      goodsAmount: trimDecimal(row.goods_amount),
      shippingFee: trimDecimal(row.shipping_fee),
      paymentMethod: row.payment_method,
      carrierName: row.carrier_code ? carrierNames[row.carrier_code] : null,
      trackingCode: row.tracking_code,
      deliveredAt: iso(row.delivered_at),
      returnDeadline: row.delivered_at ? new Date(new Date(row.delivered_at).getTime() + returnWindowHours * 3_600_000).toISOString() : null,
      completedAt: iso(row.completed_at),
      completedAmount: row.completed_amount === null ? null : trimDecimal(row.completed_amount),
      cancelReason: row.cancel_reason,
      events: events.rows.map((event) => ({ status: event.status, note: event.note, at: iso(event.created_at)! })),
      canCancel: cancellableStatuses.includes(row.status),
      returnRequests,
      // Trong 7 ngày từ lúc giao thành công và không có yêu cầu đang xử lý (QUYTAC_NGHIEPVU_161).
      canRequestReturn:
        row.status === "delivered" &&
        row.delivered_at !== null &&
        new Date(row.delivered_at).getTime() + returnWindowHours * 3_600_000 > Date.now() &&
        !returnRequests.some((request) => request.status === "pending" || request.status === "approved"),
      version: row.version,
    };
  }

  async buyerDetail(userId: string, orderId: string): Promise<BuyerOrderDetail> {
    const row = await this.row(this.database, orderId);
    // Người mua chỉ xem đơn của mình; đơn của người khác coi như không có.
    if (row.buyer_user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
    return this.detailOf(row);
  }

  // Hủy đơn (QUYTAC_NGHIEPVU_159): người mua hoặc nhân viên VComm, khi chưa có đơn vị vận chuyển lấy hàng.
  private async cancelWithin(actor: Actor, orderId: string, version: number, reason: string, kind: "buyer" | "staff", buyerUserId: string | null): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const locked = (
        await transaction.execute<{ status: MarketplaceOrderStatus; sales_order_id: string; buyer_user_id: string; version: number; company_id: string }>(sql`
        SELECT status, sales_order_id, buyer_user_id, version, company_id FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)
      ).rows[0];
      if (!locked || (buyerUserId !== null && locked.buyer_user_id !== buyerUserId) || locked.company_id !== actor.companyId) throw new ApiError("NOT_FOUND", "notFound");
      if (locked.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!cancellableStatuses.includes(locked.status)) throw new ApiError("BUSINESS_RULE", "orderNotCancellable");
      // Còn vận đơn (kể cả đang chờ xác nhận tạo) thì hủy vận đơn trước; phiếu xuất nháp còn sót cũng xóa.
      if (!this.shipmentCanceller) throw new ApiError("BUSINESS_RULE", "orderNotCancellable");
      await this.shipmentCanceller.cancelActive(transaction, orderId);
      await this.salesOrders.cancelMarketplaceWithin(transaction, actor, locked.sales_order_id);
      await transaction.execute(sql`
        UPDATE marketplace.orders SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by_kind = ${kind}, version = version + 1 WHERE id = ${orderId}`);
      await this.event(transaction, orderId, "cancelled", reason, actor.userId);
    });
  }

  async buyerCancel(userId: string, client: ClientInfo, orderId: string, version: number, reason: string): Promise<BuyerOrderDetail> {
    const context = await this.storeContext();
    await this.cancelWithin({ userId, companyId: context.companyId, client }, orderId, version, reason, "buyer", userId);
    return this.buyerDetail(userId, orderId);
  }

  async adminCancel(actor: BuyerAdminActor, orderId: string, version: number, reason: string): Promise<MarketplaceOrderDetail> {
    await this.cancelWithin({ userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client }, orderId, version, reason, "staff", null);
    return this.adminDetail(actor, orderId, true);
  }

  async adminList(
    actor: BuyerAdminActor,
    query: { status?: MarketplaceOrderStatus | undefined; search?: string | undefined; page: number; pageSize: number },
  ): Promise<PageResponse<MarketplaceOrderListItem>> {
    const text = query.search?.trim() ?? "";
    const digits = text.replace(/[^0-9]/g, "");
    const phone = digits.startsWith("0") ? `+84${digits.slice(1)}` : digits;
    const where = sql`m.company_id = ${actor.operatorCompanyId} AND (${query.status ?? null}::text IS NULL OR m.status = ${query.status ?? null}::text)
      AND (${text}::text = '' OR upper(so.document_no) = upper(${text}::text) OR (${digits.length >= 6} AND (u.phone LIKE ${`%${phone}%`}::text OR m.recipient_phone LIKE ${`%${phone}%`}::text)))`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(sql`${orderSelect} WHERE ${where} ORDER BY m.created_at DESC, m.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        ...listItem(row),
        buyerName: row.buyer_name,
        buyerPhone: localPhone(row.buyer_phone ?? ""),
        recipientName: row.recipient_name,
        carrierStatus: row.carrier_status,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async adminDetail(actor: BuyerAdminActor, orderId: string, canManage: boolean): Promise<MarketplaceOrderDetail> {
    const row = await this.row(this.database, orderId);
    const company = (await this.database.execute<{ company_id: string }>(sql`SELECT company_id FROM marketplace.orders WHERE id = ${orderId}`)).rows[0]!;
    if (company.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
    const shipments = await this.database.execute<{
      carrier_code: CarrierCode;
      tracking_code: string | null;
      carrier_status: string;
      fee: string | null;
      is_active: boolean;
      created_at: Date;
      synced_at: Date;
    }>(sql`SELECT carrier_code, tracking_code, carrier_status, fee::text, is_active, created_at, synced_at FROM marketplace.shipments WHERE order_id = ${orderId} ORDER BY created_at`);
    const carriers = await this.database.execute<{ code: CarrierCode; is_enabled: boolean }>(sql`SELECT code, is_enabled FROM marketplace.carriers ORDER BY code`);
    const detail = await this.detailOf(row);
    return {
      ...detail,
      canCancel: canManage && detail.canCancel,
      buyerId: row.buyer_user_id,
      buyerName: row.buyer_name,
      buyerPhone: localPhone(row.buyer_phone ?? ""),
      salesOrderId: row.sales_order_id,
      shipments: shipments.rows.map((shipment) => ({
        carrierCode: shipment.carrier_code,
        carrierName: carrierNames[shipment.carrier_code],
        trackingCode: shipment.tracking_code,
        carrierStatus: shipment.carrier_status,
        fee: shipment.fee === null ? null : trimDecimal(shipment.fee),
        isActive: shipment.is_active,
        createdAt: iso(shipment.created_at)!,
        syncedAt: iso(shipment.synced_at)!,
      })),
      canShip: canManage && row.status === "awaiting_shipment" && !shipments.rows.some((shipment) => shipment.is_active),
      canRefreshShipment: canManage && shipments.rows.some((shipment) => shipment.is_active) && ["awaiting_shipment", "awaiting_pickup", "shipping"].includes(row.status),
      carriers: carriers.rows.map((carrier) => ({ code: carrier.code, name: carrierNames[carrier.code], isEnabled: carrier.is_enabled, isConfigured: carrierConfigured(carrier.code) })),
    };
  }

  // Tự hoàn tất (QUYTAC_NGHIEPVU_162): đã qua 7 ngày từ lúc giao thành công, không còn yêu cầu trả hàng chờ duyệt hoặc đã duyệt chưa kết thúc.
  // Giá trị hoàn tất là tiền hàng gồm thuế trừ phần hàng trả đã nhận, làm tròn đến đồng; chạy mỗi giờ.
  async completeDue(): Promise<number> {
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT m.id FROM marketplace.orders m
      WHERE m.status = 'delivered' AND m.delivered_at + make_interval(hours => ${returnWindowHours}) <= now()
        AND NOT EXISTS (SELECT 1 FROM marketplace.return_requests r WHERE r.order_id = m.id AND r.status IN ('pending', 'approved'))
      ORDER BY m.delivered_at LIMIT 500`);
    let completed = 0;
    for (const order of due.rows) {
      await this.database.transaction(async (transaction) => {
        // Khóa đơn trước rồi mới xét yêu cầu trả hàng: yêu cầu gửi đồng thời phải chờ hoặc được thấy.
        const locked = await transaction.execute(sql`SELECT 1 FROM marketplace.orders WHERE id = ${order.id} AND status = 'delivered' FOR UPDATE`);
        if (locked.rows.length === 0) return;
        const updated = await transaction.execute(sql`
          UPDATE marketplace.orders m SET status = 'completed', completed_at = now(), version = version + 1,
            completed_amount = round(coalesce((
              SELECT sum(l.total_amount * greatest(l.base_quantity - ${returnedOnOrderLine(sql`l.id`)}, 0) / l.base_quantity)
              FROM sales.order_lines l WHERE l.order_id = m.sales_order_id), 0))
          WHERE m.id = ${order.id} AND m.status = 'delivered'
            AND NOT EXISTS (SELECT 1 FROM marketplace.return_requests r WHERE r.order_id = m.id AND r.status IN ('pending', 'approved'))
          RETURNING m.id`);
        if (updated.rows.length === 0) return;
        await this.event(transaction, order.id, "completed", null, null);
        completed += 1;
      });
    }
    return completed;
  }
}
