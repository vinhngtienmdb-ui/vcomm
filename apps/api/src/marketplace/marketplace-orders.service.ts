// Đơn VComm: xem trước, đặt hàng, đơn của tôi, hủy; quản trị đơn trên web (CONG_VIEC_24; CHUC_NANG_116; QUYTAC_NGHIEPVU_158, 159; API_126, API_127).
import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  BuyerOrderDetail,
  BuyerOrderListItem,
  BuyerOrderPreview,
  CarrierCode,
  FulfillmentMode,
  GroupBuyStatus,
  MarketplaceOrderDetail,
  MarketplaceOrderLine,
  MarketplaceOrderListItem,
  MarketplaceOrderStatus,
  PageResponse,
  OrderPaymentStatus,
  RefundReason,
  PaymentMethodCode,
} from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { MarketplaceCommissionsService } from "./commissions.service";
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
import { LoyaltyAccountsService } from "../loyalty/accounts.service";
import { LoyaltyPostingsService } from "../loyalty/postings.service";
import { LoyaltyLedgerService, pointsFor, quoteRedemption, releaseSalePoints } from "../loyalty/ledger.service";
import { phaseOn } from "../loyalty/program.service";
import { chosenStation, neededQuantities, notifyStationStaff, stationById, stationFee, stationOptions, type Station, type StationMode, stationView } from "./stations";
import { chargeWallet, refundOrderToWallet, returnWalletPart, shoppingWalletState, walletAmountFor } from "./shopping-wallet";

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
  points_amount: string;
  cod_amount: string;
  payment_method: PaymentMethodCode;
  payment_deadline: Date | null;
  paid_amount: string;
  refunded_amount: string;
  pending_refund_amount: string;
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
  wallet_amount: string;
  wallet_refunded_amount: string;
  group_buy_id: string | null;
  group_status: GroupBuyStatus | null;
  group_ends_at: Date | null;
  group_final_price: string | null;
  fulfillment_mode: FulfillmentMode;
  station_id: string | null;
};

// Nhóm mua chung đang mở để đặt đơn tham gia (QUYTAC_NGHIEPVU_330).
type OpenGroup = { id: string; variant_id: string; max_per_buyer: number; opener_user_id: string; opener_kind: "collaborator" | "staff"; first_price: string };

const money = (value: number) => trimDecimal(value.toFixed(4));
// Tiền đồng Việt Nam làm tròn đến đồng (tiền thu hộ, phí giao hàng).
const roundCurrency = (value: number) => Math.round(value);
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
// Nội dung mã QR nhận hàng: số đơn và mã (QUYTAC_NGHIEPVU_425).
export const pickupQrText = (documentNo: string, code: string) => `VCOMM-NHAN:${documentNo}:${code}`;

const orderSelect = sql`
  SELECT m.id, m.sales_order_id, so.document_no, m.buyer_user_id, u.full_name AS buyer_name, u.phone AS buyer_phone, m.recipient_name, m.recipient_phone, m.province_name,
    m.ward_name, m.street_address, m.goods_amount::text, m.shipping_fee::text, m.points_amount::text, m.cod_amount::text, m.payment_method, m.payment_deadline, m.paid_amount::text, m.refunded_amount::text,
    (SELECT coalesce(sum(f.amount), 0)::text FROM marketplace.refunds f WHERE f.order_id = m.id AND f.status = 'pending') AS pending_refund_amount, m.status, m.delivered_at, m.completed_at, m.completed_amount::text,
    m.cancel_reason, m.created_at, m.version,
    (SELECT count(*)::int FROM sales.order_lines l WHERE l.order_id = so.id AND NOT l.is_gift) AS item_count,
    (SELECT p.name FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE l.order_id = so.id ORDER BY l.line_no LIMIT 1) AS first_product_name,
    (SELECT i.id FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.product_images i ON i.product_id = v.product_id
      WHERE l.order_id = so.id ORDER BY l.line_no, i.sort_order LIMIT 1) AS first_image_id,
    s.carrier_code, s.tracking_code, s.carrier_status, m.wallet_amount::text, m.wallet_refunded_amount::text, m.group_buy_id, g.status AS group_status,
    g.ends_at AS group_ends_at, g.final_price::text AS group_final_price, m.fulfillment_mode, m.station_id
  FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id
  LEFT JOIN marketplace.shipments s ON s.order_id = m.id AND s.is_active LEFT JOIN marketplace.group_buys g ON g.id = m.group_buy_id`;

const listItem = (row: OrderRow): BuyerOrderListItem => ({
  id: row.id,
  documentNo: row.document_no,
  status: row.status,
  createdAt: iso(row.created_at)!,
  total: money(Number(row.goods_amount) + Number(row.shipping_fee)),
  itemCount: row.item_count,
  firstProductName: row.first_product_name,
  imageUrl: shopImagePath(row.first_image_id),
});

// Hủy được khi chưa có đơn vị vận chuyển lấy hàng (QUYTAC_NGHIEPVU_159), kể cả đơn chờ thanh toán (QUYTAC_NGHIEPVU_165).
// CONG_VIEC_49: đơn Chờ chốt nhóm hủy được khi nhóm còn mở (QUYTAC_NGHIEPVU_330).
// CONG_VIEC_57: đơn tại trạm hủy được khi Sẵn sàng nhận (QUYTAC_NGHIEPVU_424).
export const cancellableStatuses: MarketplaceOrderStatus[] = ["awaiting_payment", "awaiting_group", "awaiting_shipment", "ready_for_pickup", "awaiting_pickup"];
// Đơn thanh toán trực tuyến giữ hàng 15 phút (QUYTAC_NGHIEPVU_165).
export const paymentWindowMinutes = 15;

// Ghi tay đã thu tiền thu hộ: đơn thanh toán khi nhận hàng đã lấy hàng, chưa ghi đã thu (QUYTAC_NGHIEPVU_167).
const codRecordable = (row: { payment_method: PaymentMethodCode; cod_amount: string; paid_amount: string; status: MarketplaceOrderStatus }) =>
  row.payment_method === "cod" && Number(row.cod_amount) > 0 && Number(row.paid_amount) === 0 && ["shipping", "delivered", "completed"].includes(row.status);

// Trạng thái thanh toán (QUYTAC_NGHIEPVU_167).
export function paymentStatusOf(paid: number, refunded: number, pendingRefund: number): OrderPaymentStatus {
  if (pendingRefund > 0) return "refund_pending";
  if (refunded > 0) return refunded >= paid ? "refunded" : "partially_refunded";
  return paid > 0 ? "paid" : "unpaid";
}

// Lập việc chờ hoàn phần tiền đã thu chưa hoàn, chưa có việc chờ hoàn (hủy đơn đã thu tiền; QUYTAC_NGHIEPVU_168).
export async function refundRemainingPaid(executor: Pick<Database, "execute">, orderId: string, reason: "order_cancelled" | "paid_after_cancel"): Promise<void> {
  await executor.execute(sql`
    INSERT INTO marketplace.refunds (order_id, reason, amount)
    SELECT m.id, ${reason}, m.paid_amount - m.refunded_amount - coalesce((SELECT sum(f.amount) FROM marketplace.refunds f WHERE f.order_id = m.id AND f.status = 'pending'), 0)
    FROM marketplace.orders m WHERE m.id = ${orderId}
      AND m.paid_amount - m.refunded_amount - coalesce((SELECT sum(f.amount) FROM marketplace.refunds f WHERE f.order_id = m.id AND f.status = 'pending'), 0) > 0`);
}

// Hủy vận đơn khi hủy đơn đang chờ lấy hàng; đăng ký ở lát vận chuyển (ShipmentsService).
export interface ShipmentCanceller {
  cancelActive(transaction: Executor, orderId: string): Promise<void>;
}

@Injectable()
export class MarketplaceOrdersService {
  private readonly logger = new Logger(MarketplaceOrdersService.name);

  shipmentCanceller: ShipmentCanceller | null = null;

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly salesOrders: SalesOrdersService,
    private readonly audit: AuditService,
    private readonly commissions: MarketplaceCommissionsService,
    private readonly loyalty: LoyaltyLedgerService,
    private readonly loyaltyAccounts: LoyaltyAccountsService,
    private readonly loyaltyPostings: LoyaltyPostingsService,
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
    groupPrice: string | null = null,
    warehouseId: string = context.warehouseId,
  ): Promise<{ lines: MarketplaceOrderLine[]; goods: number; shippingFee: number; input: { variantId: string; unitId: string; quantity: string }[] }> {
    const merged = new Map<string, number>();
    for (const line of lines) merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + line.quantity);
    const sellable = await sellableVariants(executor, context, [...merged.keys()]);
    const missing = [...merged.keys()].filter((variantId) => !sellable.has(variantId));
    if (missing.length > 0) throw new ApiError("BUSINESS_RULE", "productNotSellable");
    const today = await vietnamToday(executor);
    const input = [...merged].map(([variantId, quantity]) => ({ variantId, unitId: sellable.get(variantId)!.unitId, quantity: String(quantity) }));
    const quoted = await this.salesOrders.quoteMarketplace(executor, context.companyId, { channelId: context.channelId, warehouseId, orderDate: today, lines: input, groupPrice });
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

  // Nhóm mua chung đang mở, chưa hết hạn; đơn tham gia một dòng đúng biến thể của nhóm (QUYTAC_NGHIEPVU_330).
  private async openGroup(executor: Executor, groupBuyId: string, lines: Line[], lock: boolean): Promise<OpenGroup> {
    const group = (
      await executor.execute<OpenGroup>(sql`
      SELECT id, variant_id, max_per_buyer, opener_user_id, opener_kind, (tiers -> 0 ->> 'unitPrice') AS first_price FROM marketplace.group_buys
      WHERE id = ${groupBuyId} AND status = 'open' AND ends_at > now() ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!group) throw new ApiError("BUSINESS_RULE", "groupBuyNotOpen");
    if (lines.length !== 1 || lines[0]!.variantId !== group.variant_id) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { lines: "invalidValue" } });
    return group;
  }

  async preview(
    userId: string,
    input: { addressId: string | null; lines: Line[]; pointsToRedeem: number; useShoppingWallet: boolean; groupBuyId: string | null; fulfillmentMode: FulfillmentMode; stationId: string | null },
  ): Promise<BuyerOrderPreview> {
    const account = await buyerAccount(this.database, userId);
    const context = await this.storeContext();
    const mode = input.fulfillmentMode;
    if (mode !== "carrier" && input.groupBuyId) throw new ApiError("BUSINESS_RULE", "groupBuyCarrierOnly");
    const group = input.groupBuyId ? await this.openGroup(this.database, input.groupBuyId, input.lines, false) : null;
    let quoted = await this.quote(this.database, context, input.lines, group?.first_price ?? null);
    // Trạm đủ hàng cho cách nhận của trạm; trạm đang chọn còn trong danh sách thì tính lại theo kho trạm, phí giao của trạm (CONG_VIEC_57; QUYTAC_NGHIEPVU_421, 422).
    let stations: Station[] = [];
    let station: Station | null = null;
    let shippingFee = quoted.shippingFee;
    if (mode !== "carrier") {
      const address = input.addressId ? await this.addressOf(this.database, userId, input.addressId) : null;
      stations = await stationOptions(this.database, context.companyId, mode, address, neededQuantities(quoted.lines));
      station = stations.find((item) => item.id === input.stationId) ?? null;
      if (station) quoted = await this.quote(this.database, context, input.lines, null, station.warehouseId);
      shippingFee = station ? stationFee(mode, station, quoted.goods) : 0;
    }
    // Mua chung bắt buộc trả trước: chỉ phương thức trực tuyến (QUYTAC_NGHIEPVU_330). Đơn của trạm không thu hộ qua đơn vị vận chuyển; thu tại trạm chỉ cho đơn của trạm (QUYTAC_NGHIEPVU_423).
    const paymentMethods = (await enabledPaymentMethods(this.database)).filter((method) => (!group || isOnlineMethod(method)) && (mode === "carrier" ? method !== "pay_at_station" : method !== "cod"));
    const total = quoted.goods + shippingFee;
    // Điểm thưởng (CONG_VIEC_51; QUYTAC_NGHIEPVU_346, 348): xem trước không trừ điểm; số điểm vượt giới hạn thì hạ về mức tối đa dùng được.
    // Ghép với CONG_VIEC_49 (CONG_VIEC_51 mục 19): điểm trừ trước, ví mua sắm tính trên phần còn lại; đơn mua chung không dùng điểm.
    const today = await vietnamToday(this.database);
    const loyalty = await quoteRedemption(this.database, { userId, day: today, goodsAmount: quoted.goods });
    const pointsToRedeem = group ? 0 : input.pointsToRedeem;
    const points = loyalty.redeemable && pointsToRedeem >= loyalty.minPoints ? Math.min(pointsToRedeem, loyalty.maxPoints) : 0;
    const pointsAmount = loyalty.pointValue === null ? 0 : Math.floor(points * loyalty.pointValue);
    const phase = await phaseOn(this.database, today);
    const multiplier = Number(
      (await this.database.execute<{ multiplier: string | null }>(sql`SELECT t.multiplier::text FROM loyalty.accounts a JOIN loyalty.tiers t ON t.id = a.tier_id WHERE a.user_id = ${userId}`)).rows[0]
        ?.multiplier ?? 1,
    );
    const wallet = await shoppingWalletState(this.database, userId, context.companyId);
    const usable = !wallet.locked && !wallet.blocked;
    const walletAmount = input.useShoppingWallet && usable ? Math.max(Math.min(wallet.balance, total - pointsAmount), 0) : 0;
    return {
      loyalty: { ...loyalty, pointValue: loyalty.pointValue === null ? null : trimDecimal(String(loyalty.pointValue)) },
      pointsToRedeem: points,
      pointsAmount: String(pointsAmount),
      expectedPoints: phase ? pointsFor(quoted.goods - pointsAmount, phase, multiplier) : 0,
      lines: quoted.lines,
      goodsAmount: String(quoted.goods),
      shippingFee: String(shippingFee),
      total: String(total),
      currency: context.currency,
      canOrder: (context.orderingOpen || account.isTestBuyer) && (paymentMethods.length > 0 || pointsAmount + walletAmount >= total),
      paymentMethods,
      shoppingWallet: { balance: money(wallet.balance), usable },
      walletAmount: money(walletAmount),
      payable: money(total - pointsAmount - walletAmount),
      fulfillmentMode: mode,
      stations: stations.map(stationView),
      station: station ? stationView(station) : null,
    };
  }

  // Mã nhận hàng chỉ hiện khi đơn đang chờ nhận hoặc đang giao từ trạm (QUYTAC_NGHIEPVU_425).
  private async pickupOf(row: OrderRow): Promise<BuyerOrderDetail["pickup"]> {
    if (!row.station_id || !["ready_for_pickup", "shipping"].includes(row.status)) return null;
    const found = (await this.database.execute<{ pickup_code: string; hold_until: Date }>(sql`SELECT pickup_code, hold_until FROM retail.station_orders WHERE order_id = ${row.id} AND is_active`))
      .rows[0];
    return found ? { code: found.pickup_code, qrText: pickupQrText(row.document_no, found.pickup_code), holdUntil: iso(found.hold_until)! } : null;
  }

  private async addressOf(executor: Executor, userId: string, addressId: string): Promise<{ provinceCode: string; wardCode: string } | null> {
    const row = (
      await executor.execute<{ province_code: string; ward_code: string }>(sql`
      SELECT province_code, ward_code FROM marketplace.buyer_addresses WHERE id = ${addressId} AND buyer_user_id = ${userId}`)
    ).rows[0];
    return row ? { provinceCode: row.province_code, wardCode: row.ward_code } : null;
  }

  // Đặt hàng (QUYTAC_NGHIEPVU_158, 164): chưa mở đặt hàng thì chỉ người mua thử; phương thức phải đang bật; tính lại giá, so với tổng người mua đã thấy; lập đơn bán, giữ hàng.
  // CONG_VIEC_49: trả một phần hoặc toàn bộ bằng ví mua sắm (QUYTAC_NGHIEPVU_332); đơn tham gia nhóm mua chung trả trước, giá bậc đầu (QUYTAC_NGHIEPVU_330).
  async place(
    userId: string,
    client: ClientInfo,
    input: {
      addressId: string;
      lines: Line[];
      expectedTotal: string;
      paymentMethod: PaymentMethodCode;
      pointsToRedeem?: number;
      useShoppingWallet: boolean;
      groupBuyId: string | null;
      fulfillmentMode?: FulfillmentMode;
      stationId?: string | null;
    },
  ): Promise<BuyerOrderDetail> {
    const account = await buyerAccount(this.database, userId);
    const context = await this.storeContext();
    if (!context.orderingOpen && !account.isTestBuyer) throw new ApiError("BUSINESS_RULE", "orderingNotOpen");
    const mode = input.fulfillmentMode ?? "carrier";
    if (mode !== "carrier" && input.groupBuyId) throw new ApiError("BUSINESS_RULE", "groupBuyCarrierOnly");
    // Đơn của trạm không thu hộ qua đơn vị vận chuyển; thu tại trạm chỉ cho đơn của trạm (QUYTAC_NGHIEPVU_423).
    const methodFits = mode === "carrier" ? input.paymentMethod !== "pay_at_station" : input.paymentMethod !== "cod";
    const methodEnabled = methodFits && (await enabledPaymentMethods(this.database)).includes(input.paymentMethod);
    const actor: Actor = { userId, companyId: context.companyId, client };
    await this.salesOrders.prepareNumbering(actor);
    const orderId = await this.database.transaction(async (transaction) => {
      // Khóa tài khoản người mua: đếm số lần đặt trong ngày, xóa giỏ không chạy đồng thời.
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      // Khóa nhóm: chốt nhóm không chạy đồng thời với đơn tham gia.
      const group = input.groupBuyId ? await this.openGroup(transaction, input.groupBuyId, input.lines, true) : null;
      if (group) {
        const mine = (
          await transaction.execute<{ quantity: string }>(sql`
          SELECT coalesce(sum(l.base_quantity), 0)::text AS quantity FROM marketplace.orders m JOIN sales.order_lines l ON l.order_id = m.sales_order_id
          WHERE m.group_buy_id = ${group.id} AND m.buyer_user_id = ${userId} AND m.status <> 'cancelled'`)
        ).rows[0]!.quantity;
        if (Number(mine) + input.lines[0]!.quantity > group.max_per_buyer) throw new ApiError("BUSINESS_RULE", "groupBuyBuyerLimit");
      }
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
      // Trạm khách chọn: kho xuất, phí giao theo trạm (CONG_VIEC_57; QUYTAC_NGHIEPVU_421, 422).
      const station =
        mode === "carrier" ? null : await chosenStation(transaction, context.companyId, mode, input.stationId ?? null, { provinceCode: address.province_code, wardCode: address.ward_code });
      const warehouseId = station?.warehouseId ?? context.warehouseId;
      const quoted = await this.quote(transaction, context, input.lines, group?.first_price ?? null, warehouseId);
      const shippingFee = station ? stationFee(mode as StationMode, station, quoted.goods) : quoted.shippingFee;
      const total = quoted.goods + shippingFee;
      if (Math.abs(total - Number(input.expectedTotal)) > 0.5) throw new ApiError("BUSINESS_RULE", "orderPriceChanged");
      // Ghép CONG_VIEC_51 với CONG_VIEC_49 (CONG_VIEC_51 mục 19): dùng điểm trước (chốt giai đoạn, hạng lúc đặt; QUYTAC_NGHIEPVU_346, 348),
      // rồi ví mua sắm trên phần còn lại; đơn mua chung không dùng điểm. Mã đơn lập trước để ghi chứng từ điểm.
      const id = randomUUID();
      const redeemed = await this.loyalty.redeemWithin(transaction, {
        userId,
        companyId: context.companyId,
        sourceType: "marketplace_order",
        sourceId: id,
        day: today,
        goodsAmount: quoted.goods,
        points: group ? 0 : (input.pointsToRedeem ?? 0),
      });
      const afterPoints = total - redeemed.amount;
      const walletAmount = input.useShoppingWallet && afterPoints > 0 ? await walletAmountFor(transaction, { userId, companyId: context.companyId, total: afterPoints }) : 0;
      const remaining = afterPoints - walletAmount;
      // Phương thức chỉ cần khi còn phải trả; mua chung không thanh toán khi nhận hàng.
      if (remaining > 0 && !methodEnabled) throw new ApiError("BUSINESS_RULE", "paymentMethodUnavailable");
      if (remaining > 0 && group && !isOnlineMethod(input.paymentMethod)) throw new ApiError("BUSINESS_RULE", "groupBuyNeedsPrepayment");
      const online = remaining > 0 && isOnlineMethod(input.paymentMethod);
      const status = online ? "awaiting_payment" : group ? "awaiting_group" : "awaiting_shipment";
      const recipient = `${address.recipient_name}, ${localPhone(address.phone)}`;
      const deliveryAddress =
        mode === "station_pickup" ? `${recipient}, nhận tại trạm ${station!.name}: ${station!.address}` : `${recipient}, ${address.street_address}, ${address.ward_name}, ${address.province_name}`;
      const sale = await this.salesOrders
        .placeMarketplaceWithin(transaction, actor, {
          channelId: context.channelId,
          warehouseId,
          orderDate: today,
          buyerName: address.recipient_name,
          deliveryAddress,
          lines: quoted.input,
          groupPrice: group?.first_price ?? null,
        })
        .catch((error: unknown) => {
          // Thiếu hàng khi giữ hàng: báo chung cho người mua.
          // Đơn của trạm: báo chọn trạm khác (QUYTAC_NGHIEPVU_422).
          if (error instanceof ApiError && error.messageKey === "insufficientAvailableStock") throw new ApiError("BUSINESS_RULE", station ? "stationOutOfStock" : "orderOutOfStock");
          throw error;
        });
      await transaction.execute(sql`
        INSERT INTO marketplace.orders (id, sales_order_id, company_id, buyer_user_id, recipient_name, recipient_phone, province_code, province_name, ward_code, ward_name, street_address,
          goods_amount, shipping_fee, cod_amount, payment_method, status, payment_deadline, wallet_amount, group_buy_id, points_amount, fulfillment_mode, station_id, warehouse_id)
        VALUES (${id}, ${sale.orderId}, ${context.companyId}, ${userId}, ${address.recipient_name}, ${address.phone}, ${address.province_code}, ${address.province_name}, ${address.ward_code},
          ${address.ward_name}, ${address.street_address}, ${quoted.goods}, ${shippingFee}, ${online || group ? 0 : remaining}, ${input.paymentMethod},
          ${status}, ${online ? sql`now() + make_interval(mins => ${paymentWindowMinutes})` : null}, ${walletAmount}, ${group?.id ?? null}, ${redeemed.amount},
          ${mode}, ${station?.id ?? null}, ${warehouseId})`);
      await chargeWallet(transaction, userId, id, walletAmount);
      await this.event(transaction, id, status, null, userId);
      // Báo nhân viên trạm có đơn mới (CONG_VIEC_57; QUYTAC_NGHIEPVU_429).
      if (station) await notifyStationStaff(transaction, { storeId: station.id, orderId: id, companyId: context.companyId, title: `Đơn trực tuyến mới ${sale.documentNo} tại ${station.name}` });
      // Chốt người hưởng, mức hoa hồng lúc đặt (CONG_VIEC_26; QUYTAC_NGHIEPVU_201); người mở nhóm là cộng tác viên nhận phần cộng tác viên (QUYTAC_NGHIEPVU_326).
      await this.commissions.snapshot(transaction, {
        orderId: id,
        salesOrderId: sale.orderId,
        buyerUserId: userId,
        companyId: context.companyId,
        groupBuyOpenerId: group?.opener_kind === "collaborator" ? group.opener_user_id : null,
      });
      // Đơn mua chung không đặt từ giỏ: giữ giỏ hàng.
      if (!group)
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
    // clock_timestamp: nhiều sự kiện trong cùng giao dịch (đã giao rồi đã thu COD) vẫn giữ đúng thứ tự trên dòng thời gian (LOI_06).
    await executor.execute(sql`INSERT INTO marketplace.order_events (order_id, status, note, actor_user_id, created_at) VALUES (${orderId}, ${status}, ${note}, ${actorUserId}, clock_timestamp())`);
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

  async lines(salesOrderId: string): Promise<MarketplaceOrderLine[]> {
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
    const refunds = await this.database.execute<{ amount: string; reason: RefundReason; status: "pending" | "completed"; refunded_on: string | null }>(
      sql`SELECT amount::text, reason, status, refunded_on::text FROM marketplace.refunds WHERE order_id = ${row.id} ORDER BY created_at`,
    );
    const hasBankAccount = (await this.database.execute(sql`SELECT 1 FROM marketplace.buyer_bank_accounts WHERE buyer_user_id = ${row.buyer_user_id}`)).rows.length > 0;
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
      paymentStatus: paymentStatusOf(Number(row.paid_amount), Number(row.refunded_amount), Number(row.pending_refund_amount)),
      paidAmount: trimDecimal(row.paid_amount),
      refundedAmount: trimDecimal(row.refunded_amount),
      walletAmount: trimDecimal(row.wallet_amount),
      walletRefundedAmount: trimDecimal(row.wallet_refunded_amount),
      groupBuy: row.group_buy_id
        ? { id: row.group_buy_id, status: row.group_status!, endsAt: iso(row.group_ends_at)!, finalPrice: row.group_final_price === null ? null : trimDecimal(row.group_final_price) }
        : null,
      paymentDeadline: row.status === "awaiting_payment" ? iso(row.payment_deadline) : null,
      refunds: refunds.rows.map((refund) => ({ amount: trimDecimal(refund.amount), reason: refund.reason, status: refund.status, refundedOn: refund.refunded_on })),
      needsBankAccount: !hasBankAccount && refunds.rows.some((refund) => refund.status === "pending"),
      canPay: row.status === "awaiting_payment" && row.payment_deadline !== null && new Date(row.payment_deadline).getTime() > Date.now(),
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
      pointsAmount: trimDecimal(row.points_amount),
      points: await this.loyaltyAccounts.documentPoints(this.database, "marketplace_order", row.id),
      fulfillmentMode: row.fulfillment_mode,
      station: row.station_id ? await stationById(this.database, row.station_id) : null,
      pickup: await this.pickupOf(row),
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
  private async cancelWithin(actor: Actor, orderId: string, version: number, reason: string, kind: "buyer" | "staff" | "system", buyerUserId: string | null): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const locked = (
        await transaction.execute<{ status: MarketplaceOrderStatus; sales_order_id: string; buyer_user_id: string; version: number; company_id: string; group_buy_id: string | null }>(sql`
        SELECT status, sales_order_id, buyer_user_id, version, company_id, group_buy_id FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)
      ).rows[0];
      if (!locked || (buyerUserId !== null && locked.buyer_user_id !== buyerUserId) || locked.company_id !== actor.companyId) throw new ApiError("NOT_FOUND", "notFound");
      if (locked.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!cancellableStatuses.includes(locked.status)) throw new ApiError("BUSINESS_RULE", "orderNotCancellable");
      // Còn vận đơn (kể cả đang chờ xác nhận tạo) thì hủy vận đơn trước; phiếu xuất nháp còn sót cũng xóa.
      if (!this.shipmentCanceller) throw new ApiError("BUSINESS_RULE", "orderNotCancellable");
      await this.shipmentCanceller.cancelActive(transaction, orderId);
      // Đơn tại trạm: mã nhận hàng hết hiệu lực (CONG_VIEC_57).
      await transaction.execute(sql`UPDATE retail.station_orders SET is_active = false WHERE order_id = ${orderId}`);
      await this.salesOrders.cancelMarketplaceWithin(transaction, actor, locked.sales_order_id);
      await transaction.execute(sql`
        UPDATE marketplace.orders SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by_kind = ${kind}, version = version + 1 WHERE id = ${orderId}`);
      await this.event(transaction, orderId, "cancelled", reason, actor.userId);
      // Đơn mua chung: mọi tiền đã trả hoàn vào ví mua sắm (QUYTAC_NGHIEPVU_330); đơn thường: tiền mặt hoàn ngân hàng, phần ví về ví (QUYTAC_NGHIEPVU_332).
      if (locked.group_buy_id) await refundOrderToWallet(transaction, orderId, null, "order_refund", reason);
      else {
        await refundRemainingPaid(transaction, orderId, "order_cancelled");
        await returnWalletPart(transaction, orderId);
      }
      // Điểm thưởng của đơn hủy (CONG_VIEC_51; QUYTAC_NGHIEPVU_349); đơn mua chung không dùng điểm.
      await releaseSalePoints(transaction, "marketplace_order", orderId);
    });
  }

  async buyerCancel(userId: string, client: ClientInfo, orderId: string, version: number, reason: string): Promise<BuyerOrderDetail> {
    const context = await this.storeContext();
    await this.cancelWithin({ userId, companyId: context.companyId, client }, orderId, version, reason, "buyer", userId);
    return this.buyerDetail(userId, orderId);
  }

  // Nhân viên trạm hủy đơn của trạm (CONG_VIEC_57; QUYTAC_NGHIEPVU_424); quyền, phạm vi trạm kiểm ở mini app Bán lẻ.
  async stationCancel(actor: Actor, orderId: string, version: number, reason: string, kind: "staff" | "system" = "staff"): Promise<void> {
    await this.cancelWithin(actor, orderId, version, reason, kind, null);
  }

  async adminCancel(actor: BuyerAdminActor, orderId: string, version: number, reason: string): Promise<MarketplaceOrderDetail> {
    // Đơn của trạm do trạm hủy; vận hành sàn chỉ xem (QUYTAC_NGHIEPVU_424, 431).
    const station = (await this.database.execute<{ station_id: string | null }>(sql`SELECT station_id FROM marketplace.orders WHERE id = ${orderId}`)).rows[0];
    if (station?.station_id) throw new ApiError("BUSINESS_RULE", "stationOrderOperatorReadOnly");
    await this.cancelWithin({ userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client }, orderId, version, reason, "staff", null);
    return this.adminDetail(actor, orderId, true);
  }

  async adminList(
    actor: BuyerAdminActor,
    query: {
      status?: MarketplaceOrderStatus | undefined;
      search?: string | undefined;
      fulfillmentMode?: FulfillmentMode | undefined;
      stationId?: string | undefined;
      page: number;
      pageSize: number;
    },
  ): Promise<PageResponse<MarketplaceOrderListItem>> {
    const text = query.search?.trim() ?? "";
    const digits = text.replace(/[^0-9]/g, "");
    const phone = digits.startsWith("0") ? `+84${digits.slice(1)}` : digits;
    const where = sql`m.company_id = ${actor.operatorCompanyId} AND (${query.status ?? null}::text IS NULL OR m.status = ${query.status ?? null}::text)
      AND (${query.fulfillmentMode ?? null}::text IS NULL OR m.fulfillment_mode = ${query.fulfillmentMode ?? null}::text)
      AND (${query.stationId ?? null}::uuid IS NULL OR m.station_id = ${query.stationId ?? null}::uuid)
      AND (${text}::text = '' OR upper(so.document_no) = upper(${text}::text) OR (${digits.length >= 6} AND (u.phone LIKE ${`%${phone}%`}::text OR m.recipient_phone LIKE ${`%${phone}%`}::text)))`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<OrderRow>(sql`${orderSelect} WHERE ${where} ORDER BY m.created_at DESC, m.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const stationNames = new Map((await this.stations(actor)).map((station) => [station.id, station.name]));
    return {
      data: rows.rows.map((row) => ({
        ...listItem(row),
        buyerName: row.buyer_name,
        buyerPhone: localPhone(row.buyer_phone ?? ""),
        recipientName: row.recipient_name,
        carrierStatus: row.carrier_status,
        fulfillmentMode: row.fulfillment_mode,
        stationName: row.station_id ? (stationNames.get(row.station_id) ?? null) : null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  // Trạm của công ty vận hành sàn để lọc đơn (MAN_HINH_195): trạm đang bật hoặc đã có đơn.
  async stations(actor: BuyerAdminActor): Promise<{ id: string; name: string }[]> {
    return (
      await this.database.execute<{ id: string; name: string }>(sql`
      SELECT s.id, s.display_name AS name FROM retail.stores s
      WHERE s.company_id = ${actor.operatorCompanyId} AND s.display_name IS NOT NULL
        AND (s.pickup_enabled OR s.delivery_enabled OR EXISTS (SELECT 1 FROM marketplace.orders m WHERE m.station_id = s.id))
      ORDER BY s.display_name`)
    ).rows;
  }

  async adminDetail(actor: BuyerAdminActor, orderId: string, canManage: boolean, canRecordPayment = false): Promise<MarketplaceOrderDetail> {
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
    const payments = await this.database.execute<{
      reference: string;
      method: PaymentMethodCode;
      amount: string;
      status: "pending" | "succeeded" | "failed";
      response_code: string | null;
      gateway_transaction_no: string | null;
      gateway_code: string;
      created_at: Date;
      completed_at: Date | null;
    }>(
      sql`SELECT reference, method, amount::text, status, response_code, gateway_transaction_no, gateway_code, created_at, completed_at FROM marketplace.payments WHERE order_id = ${orderId} ORDER BY created_at`,
    );
    const detail = await this.detailOf(row);
    const hold = row.station_id
      ? (
          await this.database.execute<{ ready_at: Date | null; hold_until: Date | null; delivery_attempts: number; courier_name: string | null }>(sql`
          SELECT st.ready_at, st.hold_until, st.delivery_attempts, u.full_name AS courier_name FROM retail.station_orders st LEFT JOIN core.users u ON u.id = st.courier_user_id
          WHERE st.order_id = ${orderId}`)
        ).rows[0]
      : undefined;
    return {
      ...detail,
      // Mã nhận hàng chỉ người mua thấy (QUYTAC_NGHIEPVU_425).
      pickup: null,
      stationHold: row.station_id
        ? {
            readyAt: iso(hold?.ready_at ?? null),
            holdUntil: ["ready_for_pickup", "shipping"].includes(row.status) ? iso(hold?.hold_until ?? null) : null,
            deliveryAttempts: hold?.delivery_attempts ?? 0,
            courierName: hold?.courier_name ?? null,
          }
        : null,
      canCancel: canManage && detail.canCancel && !row.station_id,
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
      payments: payments.rows.map((payment) => ({
        reference: payment.reference,
        method: payment.method,
        amount: trimDecimal(payment.amount),
        status: payment.status,
        responseCode: payment.response_code,
        transactionNo: payment.gateway_transaction_no,
        createdAt: iso(payment.created_at)!,
        completedAt: iso(payment.completed_at),
      })),
      canRecordCod: canRecordPayment && codRecordable(row),
      commissions: (await this.commissions.ofOrder(this.database, orderId)).map((item) => ({
        beneficiaryName: item.name,
        beneficiaryPhone: localPhone(item.phone ?? ""),
        share: item.share,
        amount: trimDecimal(item.amount),
        credited: item.credited,
      })),
      canConfirmTransfer: canRecordPayment && payments.rows.some((payment) => payment.gateway_code === "bank_transfer" && payment.status === "pending"),
      canShip: canManage && row.fulfillment_mode === "carrier" && row.status === "awaiting_shipment" && !shipments.rows.some((shipment) => shipment.is_active),
      canRefreshShipment: canManage && shipments.rows.some((shipment) => shipment.is_active) && ["awaiting_shipment", "awaiting_pickup", "shipping"].includes(row.status),
      carriers: carriers.rows.map((carrier) => ({ code: carrier.code, name: carrierNames[carrier.code], isEnabled: carrier.is_enabled, isConfigured: carrierConfigured(carrier.code) })),
    };
  }

  // Ghi tay "Đã thu COD" kèm số phiên đối soát của đơn vị vận chuyển (QUYTAC_NGHIEPVU_167).
  async recordCodCollected(actor: BuyerAdminActor, orderId: string, input: { collectedOn: string; reference: string; version: number }, canManage: boolean): Promise<MarketplaceOrderDetail> {
    await this.database.transaction(async (transaction) => {
      const company = (await transaction.execute<{ company_id: string }>(sql`SELECT company_id FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)).rows[0];
      if (!company || company.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
      const row = await this.row(transaction, orderId);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!codRecordable(row)) throw new ApiError("BUSINESS_RULE", "codNotRecordable");
      const today = await vietnamToday(transaction);
      if (input.collectedOn > today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { collectedOn: "invalidValue" } });
      await transaction.execute(sql`
        UPDATE marketplace.orders SET paid_amount = cod_amount, paid_at = (${input.collectedOn}::date + time '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh', version = version + 1 WHERE id = ${orderId}`);
      await this.event(transaction, orderId, "paid", `COD · ${input.reference}`, actor.userId);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "marketplace",
          action: "marketplace.order.cod_collected",
          entityType: "marketplace.orders",
          entityId: orderId,
          beforeData: null,
          afterData: input,
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.adminDetail(actor, orderId, canManage, true);
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
      // Một đơn lỗi (ví dụ kỳ kế toán đã khóa, thiếu định khoản) không chặn các đơn sau: ghi nhật ký, lượt sau thử lại.
      try {
        await this.completeOne(order.id, () => (completed += 1));
      } catch (error) {
        this.logger.error(`Không hoàn tất được đơn VComm ${order.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return completed;
  }

  private async completeOne(orderId: string, onCompleted: () => void): Promise<void> {
    const order = { id: orderId };
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
      // Cộng ví hoa hồng theo hàng thực bán (CONG_VIEC_26; QUYTAC_NGHIEPVU_202).
      await this.commissions.credit(transaction, order.id);
      // Tích điểm theo giá trị hoàn tất (CONG_VIEC_51; QUYTAC_NGHIEPVU_347).
      const completed = (
        await transaction.execute<{ buyer_user_id: string; company_id: string; completed_amount: string; today: string }>(sql`
        SELECT buyer_user_id, company_id, completed_amount::text, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today FROM marketplace.orders WHERE id = ${order.id}`)
      ).rows[0]!;
      await this.loyalty.earnWithin(transaction, {
        sourceType: "marketplace_order",
        sourceId: order.id,
        userId: completed.buyer_user_id,
        companyId: completed.company_id,
        day: completed.today,
        goodsAmount: Number(completed.completed_amount),
      });
      // Bút toán điểm đã dùng của đơn (QUYTAC_NGHIEPVU_355).
      await this.loyaltyPostings.postOrderRedeem(transaction, order.id);
      // Thưởng giới thiệu bạn bè một lần (CONG_VIEC_49; QUYTAC_NGHIEPVU_327).
      await this.commissions.creditReferralBonus(transaction, order.id);
      onCompleted();
    });
  }
}
