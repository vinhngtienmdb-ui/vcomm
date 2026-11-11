// Mua chung bậc giá theo tổng số lượng, trả trước (CONG_VIEC_49; CHUC_NANG_172; QUYTAC_NGHIEPVU_328 đến 331; API_164, API_165).
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { CollaboratorLabel, GroupBuyDetail, GroupBuyItem, GroupBuyOption, GroupBuySettingsItem, GroupBuyStatus, GroupBuyTier, MarketplaceOrderStatus, PageResponse } from "contracts";
import type { buyerGroupBuyQuerySchema, groupBuyListQuerySchema, groupBuySettingsQuerySchema, groupBuySettingsSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { ClientInfo } from "../auth/auth.service";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";
import { SalesOrdersService } from "../sales/sales-orders.service";
import { localPhone } from "./local-phone";
import { BuyerAdminService, type BuyerAdminActor } from "./buyer-admin.service";
import { MarketplaceOrdersService } from "./marketplace-orders.service";
import { refundOrderToWallet } from "./shopping-wallet";
import { buyerAccount, sellableVariants, shopImagePath } from "./shop.service";
import { loadStoreContext, type StoreContext } from "./store.service";

type Executor = Pick<Database, "execute">;
// Mỗi cộng tác viên tối đa 5 nhóm đang mở (QUYTAC_NGHIEPVU_329).
const openGroupLimit = 5;
const systemClient: ClientInfo = { ip: null, userAgent: "group-buy-close", requestId: null };

type GroupRow = {
  id: string;
  variant_id: string;
  product_id: string;
  product_name: string;
  option_values: string[] | null;
  image_id: string | null;
  opener_name: string;
  opener_kind: "collaborator" | "staff";
  opener_label: CollaboratorLabel | null;
  status: GroupBuyStatus;
  starts_at: Date;
  ends_at: Date;
  tiers: GroupBuyTier[];
  max_per_buyer: number;
  final_quantity: number | null;
  final_price: string | null;
  cancel_reason: string | null;
  quantity: number;
  my_quantity: number;
  version: number;
};

// Đơn giá của bậc có mốc lớn nhất không vượt số lượng; dưới mốc tối thiểu thì null (QUYTAC_NGHIEPVU_331).
export function tierPrice(tiers: GroupBuyTier[], quantity: number): string | null {
  const reached = [...tiers].filter((tier) => tier.minQuantity <= quantity).sort((first, second) => second.minQuantity - first.minQuantity)[0];
  return reached ? reached.unitPrice : null;
}

const groupSelect = (viewerId: string | null) => sql`
  SELECT g.id, g.variant_id, v.product_id, p.name AS product_name, v.option_values,
    (SELECT i.id FROM catalog.product_images i WHERE i.product_id = p.id ORDER BY i.sort_order LIMIT 1) AS image_id,
    u.full_name AS opener_name, g.opener_kind, c.label AS opener_label, g.status, g.starts_at, g.ends_at, g.tiers, g.max_per_buyer, g.final_quantity, g.final_price::text,
    g.cancel_reason, g.version,
    coalesce((SELECT sum(l.base_quantity) FROM marketplace.orders m JOIN sales.order_lines l ON l.order_id = m.sales_order_id
      WHERE m.group_buy_id = g.id AND m.status = 'awaiting_group'), 0)::int AS quantity,
    coalesce((SELECT sum(l.base_quantity) FROM marketplace.orders m JOIN sales.order_lines l ON l.order_id = m.sales_order_id
      WHERE m.group_buy_id = g.id AND m.status <> 'cancelled' AND m.buyer_user_id = ${viewerId}::uuid), 0)::int AS my_quantity
  FROM marketplace.group_buys g JOIN catalog.variants v ON v.id = g.variant_id JOIN catalog.products p ON p.id = v.product_id
    JOIN core.users u ON u.id = g.opener_user_id LEFT JOIN marketplace.collaborators c ON c.user_id = g.opener_user_id`;

const itemOf = (row: GroupRow): GroupBuyItem => {
  const quantity = row.status === "open" ? row.quantity : (row.final_quantity ?? row.quantity);
  const current = row.status === "open" ? tierPrice(row.tiers, quantity) : null;
  return {
    id: row.id,
    variantId: row.variant_id,
    productId: row.product_id,
    productName: row.product_name,
    variantLabel: (row.option_values ?? []).filter(Boolean).join(" · "),
    imageUrl: shopImagePath(row.image_id),
    openerName: row.opener_name,
    openerKind: row.opener_kind,
    openerLabel: row.opener_label,
    status: row.status,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    tiers: row.tiers,
    maxPerBuyer: row.max_per_buyer,
    quantity,
    currentPrice: current === null ? null : trimDecimal(current),
    finalPrice: row.final_price === null ? null : trimDecimal(row.final_price),
    cancelReason: row.cancel_reason,
    myQuantity: row.my_quantity,
    version: row.version,
  };
};

type SettingsRow = {
  variant_id: string;
  product_id: string;
  product_name: string;
  option_values: string[] | null;
  is_enabled: boolean | null;
  max_duration_hours: number | null;
  max_per_buyer: number | null;
  version: number | null;
  tiers: GroupBuyTier[] | null;
};

@Injectable()
export class GroupBuysService {
  private readonly logger = new Logger(GroupBuysService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly salesOrders: SalesOrdersService,
    private readonly orders: MarketplaceOrdersService,
    private readonly admin: BuyerAdminService,
    private readonly audit: AuditService,
  ) {}

  private async context(): Promise<StoreContext> {
    const context = await loadStoreContext(this.database);
    if (!context) throw new ApiError("BUSINESS_RULE", "storeNotReady");
    return context;
  }

  // Giá bán gồm thuế hiện tại của các biến thể đang bán.
  private async prices(executor: Executor, context: StoreContext, variantIds: string[]): Promise<Map<string, string>> {
    const sellable = await sellableVariants(executor, context, variantIds);
    return new Map([...sellable].map(([variantId, variant]) => [variantId, variant.grossPrice]));
  }

  private settingsSelect(where: SQL): SQL {
    return sql`
      SELECT v.id AS variant_id, v.product_id, p.name AS product_name, v.option_values, s.is_enabled, s.max_duration_hours, s.max_per_buyer, s.version,
        (SELECT json_agg(json_build_object('minQuantity', t.min_quantity, 'unitPrice', trim_scale(t.unit_price)::text) ORDER BY t.tier_no)
          FROM marketplace.group_buy_setting_tiers t WHERE t.variant_id = v.id) AS tiers
      FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN marketplace.listings l ON l.product_id = p.id AND l.is_published
        LEFT JOIN marketplace.group_buy_settings s ON s.variant_id = v.id
      WHERE ${where}`;
  }

  private settingsItem(row: SettingsRow, price: string | null): GroupBuySettingsItem {
    return {
      variantId: row.variant_id,
      productId: row.product_id,
      productName: row.product_name,
      variantLabel: (row.option_values ?? []).filter(Boolean).join(" · "),
      currentPrice: price === null ? null : trimDecimal(price),
      isEnabled: row.is_enabled ?? false,
      tiers: row.tiers ?? [],
      maxDurationHours: row.max_duration_hours ?? 72,
      maxPerBuyer: row.max_per_buyer ?? 1,
      version: row.version ?? 0,
    };
  }

  // ---------- Quản trị (API_165) ----------

  async listSettings(actor: BuyerAdminActor, query: z.output<typeof groupBuySettingsQuerySchema>): Promise<PageResponse<GroupBuySettingsItem>> {
    const context = await this.context();
    const conditions: SQL[] = [sql`p.company_id = ${actor.operatorCompanyId}`, sql`v.status = 'active'`];
    if (query.search) conditions.push(sql`p.search_text LIKE ${`%${searchText(query.search)}%`}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id JOIN marketplace.listings l ON l.product_id = p.id AND l.is_published
      WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<SettingsRow>(sql`${this.settingsSelect(where)} ORDER BY p.name, v.sku LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const prices = await this.prices(
      this.database,
      context,
      rows.rows.map((row) => row.variant_id),
    );
    return { data: rows.rows.map((row) => this.settingsItem(row, prices.get(row.variant_id) ?? null)), page: query.page, pageSize: query.pageSize, total };
  }

  // Cài đặt theo biến thể (QUYTAC_NGHIEPVU_328): biến thể đang bán; bậc 1 không cao hơn giá bán hiện tại; theo phiên bản.
  async saveSettings(actor: BuyerAdminActor, variantId: string, input: z.output<typeof groupBuySettingsSchema>): Promise<GroupBuySettingsItem> {
    const context = await this.context();
    await this.database.transaction(async (transaction) => {
      const price = (await this.prices(transaction, context, [variantId])).get(variantId);
      if (!price) throw new ApiError("BUSINESS_RULE", "groupBuyVariantNotSellable");
      if (Number(input.tiers[0]!.unitPrice) > Number(price)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { "tiers.0.unitPrice": "groupBuyFirstTierOverPrice" } });
      const current = (await transaction.execute<{ version: number }>(sql`SELECT version FROM marketplace.group_buy_settings WHERE variant_id = ${variantId} FOR UPDATE`)).rows[0];
      if ((current?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (current) {
        await transaction.execute(sql`
          UPDATE marketplace.group_buy_settings SET is_enabled = ${input.isEnabled}, max_duration_hours = ${input.maxDurationHours}, max_per_buyer = ${input.maxPerBuyer},
            updated_by = ${actor.userId}, updated_at = now(), version = version + 1 WHERE variant_id = ${variantId}`);
        await transaction.execute(sql`DELETE FROM marketplace.group_buy_setting_tiers WHERE variant_id = ${variantId}`);
      } else {
        await transaction.execute(sql`
          INSERT INTO marketplace.group_buy_settings (variant_id, company_id, is_enabled, max_duration_hours, max_per_buyer, updated_by)
          VALUES (${variantId}, ${actor.operatorCompanyId}, ${input.isEnabled}, ${input.maxDurationHours}, ${input.maxPerBuyer}, ${actor.userId})`);
      }
      for (const [index, tier] of input.tiers.entries()) {
        await transaction.execute(sql`
          INSERT INTO marketplace.group_buy_setting_tiers (variant_id, tier_no, min_quantity, unit_price) VALUES (${variantId}, ${index + 1}, ${tier.minQuantity}, ${tier.unitPrice}::numeric)`);
      }
      await this.record(transaction, actor, "marketplace.group_buy_settings.update", "marketplace.group_buy_settings", variantId, current ?? null, input);
    });
    const row = (await this.database.execute<SettingsRow>(this.settingsSelect(sql`v.id = ${variantId}`))).rows[0]!;
    return this.settingsItem(row, (await this.prices(this.database, context, [variantId])).get(variantId) ?? null);
  }

  async adminList(actor: BuyerAdminActor, query: z.output<typeof groupBuyListQuerySchema>): Promise<PageResponse<GroupBuyItem>> {
    const where = sql`g.company_id = ${actor.operatorCompanyId} ${query.status ? sql`AND g.status = ${query.status}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.group_buys g WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<GroupRow>(sql`
      ${groupSelect(null)} WHERE ${where} ORDER BY g.created_at DESC, g.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(itemOf), page: query.page, pageSize: query.pageSize, total };
  }

  async adminDetail(actor: BuyerAdminActor, id: string): Promise<GroupBuyDetail> {
    const row = (await this.database.execute<GroupRow>(sql`${groupSelect(null)} WHERE g.id = ${id} AND g.company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const orders = await this.database.execute<{
      id: string;
      document_no: string;
      full_name: string;
      phone: string | null;
      quantity: string;
      paid: string;
      status: MarketplaceOrderStatus;
    }>(sql`
      SELECT m.id, so.document_no, u.full_name, u.phone, (SELECT sum(l.base_quantity) FROM sales.order_lines l WHERE l.order_id = so.id)::text AS quantity,
        (m.paid_amount + m.wallet_amount)::text AS paid, m.status
      FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = m.buyer_user_id
      WHERE m.group_buy_id = ${id} ORDER BY m.created_at`);
    return {
      ...itemOf(row),
      orders: orders.rows.map((order) => ({
        orderId: order.id,
        documentNo: order.document_no,
        buyerName: order.full_name,
        buyerPhone: localPhone(order.phone ?? ""),
        quantity: Number(order.quantity),
        paidAmount: trimDecimal(order.paid),
        status: order.status,
      })),
    };
  }

  async adminOpen(actor: BuyerAdminActor, input: { variantId: string; durationHours: number }): Promise<GroupBuyDetail> {
    const id = await this.open(actor.userId, "staff", actor.operatorCompanyId, input);
    return this.adminDetail(actor, id);
  }

  // Hủy nhóm đang mở (QUYTAC_NGHIEPVU_329): xử lý như thất bại, có lý do.
  async adminCancel(actor: BuyerAdminActor, id: string, input: { reason: string; version: number }): Promise<GroupBuyDetail> {
    const exists = (await this.database.execute<{ version: number }>(sql`SELECT version FROM marketplace.group_buys WHERE id = ${id} AND company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!exists) throw new ApiError("NOT_FOUND", "notFound");
    if (exists.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    const closed = await this.close(id, { reason: input.reason, actorUserId: actor.userId });
    if (!closed) throw new ApiError("BUSINESS_RULE", "groupBuyNotOpen");
    await this.audit.record({
      actorUserId: actor.userId,
      companyId: actor.operatorCompanyId,
      appCode: "marketplace",
      action: "marketplace.group_buy.cancel",
      entityType: "marketplace.group_buys",
      entityId: id,
      afterData: { reason: input.reason },
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    });
    return this.adminDetail(actor, id);
  }

  // ---------- Người mua (API_164) ----------

  async options(userId: string): Promise<GroupBuyOption[]> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    const rows = await this.database.execute<SettingsRow>(sql`${this.settingsSelect(sql`p.company_id = ${context.companyId} AND s.is_enabled`)} ORDER BY p.name, v.sku`);
    const prices = await this.prices(
      this.database,
      context,
      rows.rows.map((row) => row.variant_id),
    );
    return rows.rows
      .filter((row) => prices.has(row.variant_id) && (row.tiers?.length ?? 0) > 0)
      .map((row) => {
        const item = this.settingsItem(row, null);
        return {
          variantId: item.variantId,
          productId: item.productId,
          productName: item.productName,
          variantLabel: item.variantLabel,
          tiers: item.tiers,
          maxDurationHours: item.maxDurationHours,
          maxPerBuyer: item.maxPerBuyer,
        };
      });
  }

  async list(userId: string, query: z.output<typeof buyerGroupBuyQuerySchema>): Promise<PageResponse<GroupBuyItem>> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    const conditions: SQL[] = [sql`g.company_id = ${context.companyId}`];
    if (query.scope === "open") conditions.push(sql`g.status = 'open' AND g.ends_at > now()`);
    else conditions.push(sql`(g.opener_user_id = ${userId} OR EXISTS (SELECT 1 FROM marketplace.orders m WHERE m.group_buy_id = g.id AND m.buyer_user_id = ${userId}))`);
    if (query.productId) conditions.push(sql`v.product_id = ${query.productId}`);
    const where = sql.join(conditions, sql` AND `);
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.group_buys g JOIN catalog.variants v ON v.id = g.variant_id WHERE ${where}`)
    ).rows[0]!.total;
    const order = query.scope === "open" ? sql`g.ends_at, g.id` : sql`g.created_at DESC, g.id`;
    const rows = await this.database.execute<GroupRow>(sql`${groupSelect(userId)} WHERE ${where} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(itemOf), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(userId: string, id: string): Promise<GroupBuyItem> {
    await buyerAccount(this.database, userId);
    const context = await this.context();
    const row = (await this.database.execute<GroupRow>(sql`${groupSelect(userId)} WHERE g.id = ${id} AND g.company_id = ${context.companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return itemOf(row);
  }

  // Cộng tác viên đã duyệt (gồm KOL, KOC) mở nhóm, tối đa 5 nhóm đang mở (QUYTAC_NGHIEPVU_329).
  async buyerOpen(userId: string, input: { variantId: string; durationHours: number }): Promise<GroupBuyItem> {
    await buyerAccount(this.database, userId);
    const companyId = await this.admin.operatorCompanyId();
    if (!companyId) throw new ApiError("BUSINESS_RULE", "marketplaceOperatorNotSet");
    const approved = await this.database.execute(sql`SELECT 1 FROM marketplace.collaborators WHERE user_id = ${userId} AND status = 'approved'`);
    if (approved.rows.length === 0) throw new ApiError("FORBIDDEN", "groupBuyNotCollaborator");
    const id = await this.open(userId, "collaborator", companyId, input);
    return this.detail(userId, id);
  }

  private async open(userId: string, kind: "collaborator" | "staff", companyId: string, input: { variantId: string; durationHours: number }): Promise<string> {
    const context = await this.context();
    return this.database.transaction(async (transaction) => {
      if (kind === "collaborator") {
        // Khóa hồ sơ cộng tác viên: đếm số nhóm đang mở không chạy đồng thời.
        await transaction.execute(sql`SELECT 1 FROM marketplace.collaborators WHERE user_id = ${userId} FOR UPDATE`);
        const open = await transaction.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM marketplace.group_buys WHERE opener_user_id = ${userId} AND status = 'open'`);
        if (open.rows[0]!.count >= openGroupLimit) throw new ApiError("BUSINESS_RULE", "groupBuyOpenLimit");
      }
      const settings = (await transaction.execute<SettingsRow>(this.settingsSelect(sql`v.id = ${input.variantId} AND p.company_id = ${companyId} AND s.is_enabled`))).rows[0];
      if (!settings || !settings.tiers?.length) throw new ApiError("BUSINESS_RULE", "groupBuyNotEnabled");
      if (!(await this.prices(transaction, context, [input.variantId])).has(input.variantId)) throw new ApiError("BUSINESS_RULE", "groupBuyVariantNotSellable");
      if (input.durationHours > settings.max_duration_hours!) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { durationHours: "groupBuyDurationOver" } });
      return (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO marketplace.group_buys (company_id, variant_id, opener_user_id, opener_kind, ends_at, tiers, max_per_buyer)
        VALUES (${companyId}, ${input.variantId}, ${userId}, ${kind}, now() + make_interval(hours => ${input.durationHours}), ${JSON.stringify(settings.tiers)}::jsonb,
          ${settings.max_per_buyer}) RETURNING id`)
      ).rows[0]!.id;
    });
  }

  // ---------- Chốt nhóm (QUYTAC_NGHIEPVU_331) ----------

  // Việc nền mỗi phút: nhóm hết hạn, mỗi lần tối đa 100 nhóm; một nhóm lỗi không chặn nhóm khác.
  async closeDue(): Promise<number> {
    const due = await this.database.execute<{ id: string }>(sql`SELECT id FROM marketplace.group_buys WHERE status = 'open' AND ends_at <= now() ORDER BY ends_at LIMIT 100`);
    let closed = 0;
    for (const group of due.rows) {
      try {
        if (await this.close(group.id, null)) closed += 1;
      } catch (error) {
        this.logger.error(`Chốt nhóm mua chung ${group.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return closed;
  }

  // Chốt một nhóm: hết hạn (cancel null) hoặc nhân viên hủy. Trả về false khi nhóm không còn mở.
  private async close(groupId: string, cancel: { reason: string; actorUserId: string } | null): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const group = (
        await transaction.execute<{ company_id: string; opener_user_id: string; tiers: GroupBuyTier[]; expired: boolean }>(sql`
        SELECT company_id, opener_user_id, tiers, ends_at <= now() AS expired FROM marketplace.group_buys WHERE id = ${groupId} AND status = 'open' FOR UPDATE`)
      ).rows[0];
      if (!group || (!cancel && !group.expired)) return false;
      const orders = await transaction.execute<{ id: string; sales_order_id: string; buyer_user_id: string; status: MarketplaceOrderStatus; quantity: string; shipping_fee: string }>(sql`
        SELECT m.id, m.sales_order_id, m.buyer_user_id, m.status, (SELECT sum(l.base_quantity) FROM sales.order_lines l WHERE l.order_id = m.sales_order_id)::text AS quantity,
          m.shipping_fee::text
        FROM marketplace.orders m WHERE m.group_buy_id = ${groupId} AND m.status IN ('awaiting_payment', 'awaiting_group') ORDER BY m.created_at FOR UPDATE`);
      const system: Actor = { userId: cancel?.actorUserId ?? group.opener_user_id, companyId: group.company_id, client: systemClient };
      const endOrder = async (order: { id: string; sales_order_id: string }, reason: string) => {
        await this.salesOrders.cancelMarketplaceWithin(transaction, system, order.sales_order_id);
        await transaction.execute(sql`
          UPDATE marketplace.orders SET status = 'cancelled', cancel_reason = ${reason}, cancelled_by_kind = ${cancel ? "staff" : "system"}, version = version + 1 WHERE id = ${order.id}`);
        await this.orders.event(transaction, order.id, "cancelled", reason, cancel?.actorUserId ?? null);
        await refundOrderToWallet(transaction, order.id, null, "group_buy_refund", reason);
      };
      // Đơn chưa thanh toán xong thì hủy, phần đã trả bằng ví hoàn về ví.
      for (const order of orders.rows.filter((item) => item.status === "awaiting_payment")) await endOrder(order, "Nhóm mua chung đã kết thúc");
      const joined = orders.rows.filter((item) => item.status === "awaiting_group");
      const quantity = joined.reduce((sum, order) => sum + Number(order.quantity), 0);
      const price = cancel ? null : tierPrice(group.tiers, quantity);
      if (price === null) {
        const reason = cancel ? cancel.reason : "Nhóm mua chung không đủ số lượng";
        for (const order of joined) await endOrder(order, reason);
        await transaction.execute(sql`
          UPDATE marketplace.group_buys SET status = ${cancel ? "cancelled" : "failed"}, cancel_reason = ${cancel?.reason ?? null}, final_quantity = ${quantity}, closed_at = now(),
            version = version + 1 WHERE id = ${groupId}`);
        await this.notifyBuyers(transaction, group.company_id, joined, "group_buy.failed", "Nhóm mua chung đã kết thúc, tiền đã hoàn vào ví mua sắm", groupId);
        return true;
      }
      // Thành công: sửa giá theo bậc đạt được, hoàn phần dư vào ví mua sắm, đơn sang Chờ giao.
      for (const order of joined) {
        await this.salesOrders.repriceMarketplaceWithin(transaction, order.sales_order_id, price);
        const goods = Math.round(Number((await transaction.execute<{ total: string }>(sql`SELECT total_amount::text AS total FROM sales.orders WHERE id = ${order.sales_order_id}`)).rows[0]!.total));
        const before = (await transaction.execute<{ goods: string }>(sql`SELECT goods_amount::text AS goods FROM marketplace.orders WHERE id = ${order.id}`)).rows[0]!;
        await transaction.execute(sql`UPDATE marketplace.orders SET goods_amount = ${goods}, status = 'awaiting_shipment', version = version + 1 WHERE id = ${order.id}`);
        const difference = Number(before.goods) - goods;
        if (difference > 0) await refundOrderToWallet(transaction, order.id, difference, "group_buy_difference", null);
        await this.orders.event(transaction, order.id, "awaiting_shipment", `Giá chốt ${trimDecimal(price)}`, null);
      }
      await transaction.execute(sql`
        UPDATE marketplace.group_buys SET status = 'succeeded', final_quantity = ${quantity}, final_price = ${price}::numeric, closed_at = now(), version = version + 1 WHERE id = ${groupId}`);
      await this.notifyBuyers(transaction, group.company_id, joined, "group_buy.succeeded", "Nhóm mua chung thành công, tiền dư đã hoàn vào ví mua sắm", groupId);
      return true;
    });
  }

  private async notifyBuyers(executor: Executor, companyId: string, orders: { id: string; buyer_user_id: string }[], kind: string, title: string, groupId: string): Promise<void> {
    await notify(
      executor,
      orders.map((order) => ({ userId: order.buyer_user_id, companyId, kind, title, payload: { groupBuyId: groupId, orderId: order.id } })),
    );
  }

  private record(transaction: Pick<Database, "execute" | "insert">, actor: BuyerAdminActor, action: string, entityType: string, entityId: string, beforeData: unknown, afterData: unknown) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "marketplace",
        action,
        entityType,
        entityId,
        beforeData,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      transaction,
    );
  }
}
