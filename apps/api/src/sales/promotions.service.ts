// Chương trình khuyến mãi (CONG_VIEC_12; CHUC_NANG_62, 64; QUYTAC_NGHIEPVU_79, 80, 82; API_83): lập, sửa, gửi duyệt, rút, dừng; đã dùng tính từ dòng đơn bán.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { PromotionKind, PromotionListItem, PromotionOptionsResponse, PromotionResponse, PromotionStatus, savePromotionSchema } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { pgArray } from "../inventory/stock-ledger.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { internalChannelCode } from "./internal-trade-rules";
import { requireSalesPermission, salesAudit, salesPermissions } from "./sales-context";

const documentTypeCode = "sales.promotion";
type Executor = Pick<Database, "execute" | "insert">;
type FieldErrors = Record<string, keyof Messages["errors"]>;
type Input = z.output<typeof savePromotionSchema>;
type PromotionRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  name: string;
  kind: PromotionKind;
  valid_from: Date | string;
  valid_to: Date | string;
  min_order_amount: string | null;
  order_discount_percent: string | null;
  max_order_discount: string | null;
  buy_variant_id: string | null;
  buy_quantity: string | null;
  gift_variant_id: string | null;
  gift_quantity: string | null;
  budget_amount: string | null;
  max_gift_sets: number | null;
  note: string | null;
  status: PromotionStatus;
  approval_request_id: string | null;
  stopped_reason: string | null;
  created_by: string;
  created_by_name: string;
  used_amount: string;
  used_gift_sets: number;
  version: number;
};

// Đơn bán tính vào đã dùng của chương trình (QUYTAC_NGHIEPVU_82).
export const promotionCountedStatuses = sql`('pending', 'confirmed', 'delivered', 'closed')`;
// Tiền đã giảm (gồm thuế), số suất đã tặng của chương trình; bỏ qua một đơn (đơn đang lưu, đang gửi).
export const promotionUsage = (promotionId: SQL, exceptOrderId: SQL = sql`NULL::uuid`) => sql`
  (SELECT coalesce(sum(CASE WHEN l.promotion_id = ${promotionId} AND NOT l.is_gift THEN l.promotion_discount_total - l.order_discount_amount ELSE 0 END), 0)
        + coalesce(sum(CASE WHEN l.order_promotion_id = ${promotionId} THEN l.order_discount_amount ELSE 0 END), 0)
   FROM sales.order_lines l JOIN sales.orders o ON o.id = l.order_id
   WHERE (l.promotion_id = ${promotionId} OR l.order_promotion_id = ${promotionId}) AND o.status IN ${promotionCountedStatuses}
     AND o.id IS DISTINCT FROM ${exceptOrderId})`;
export const promotionGiftUsage = (promotionId: SQL, exceptOrderId: SQL = sql`NULL::uuid`) => sql`
  (SELECT coalesce(sum(l.gift_sets), 0)::int FROM sales.order_lines l JOIN sales.orders o ON o.id = l.order_id
   WHERE l.promotion_id = ${promotionId} AND l.is_gift AND o.status IN ${promotionCountedStatuses} AND o.id IS DISTINCT FROM ${exceptOrderId})`;

@Injectable()
export class PromotionsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
  ) {}

  // Duyệt xong thì chương trình chạy; từ chối, rút thì về trạng thái tương ứng, sửa được.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      if (!["approved", "rejected", "withdrawn"].includes(status)) return;
      await this.database.execute(sql`
        UPDATE sales.promotions SET status = ${status === "approved" ? "active" : status}, updated_at = now()
        WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`);
    });
  }

  async options(actor: Actor): Promise<PromotionOptionsResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.viewPromotions, salesPermissions.managePromotions);
    const channels = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM catalog.sales_channels WHERE company_id = ${actor.companyId} AND status = 'active' AND code <> ${internalChannelCode} ORDER BY code`);
    const groups = await this.database.execute<{ id: string; code: string; name: string }>(sql`
      SELECT id, code, name FROM catalog.customer_groups WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY code`);
    return { channels: channels.rows, customerGroups: groups.rows, currency: await companyCurrency(this.database, actor.companyId) };
  }

  async list(actor: Actor, status: PromotionStatus | undefined): Promise<PromotionListItem[]> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.viewPromotions, salesPermissions.managePromotions);
    const rows = await this.database.execute<PromotionRow>(
      sql`${this.select()} WHERE p.company_id = ${actor.companyId} ${status ? sql`AND p.status = ${status}` : sql``} ORDER BY p.created_at DESC LIMIT 500`,
    );
    return rows.rows.map(toItem);
  }

  async detail(actor: Actor, id: string): Promise<PromotionResponse> {
    const granted = await requireSalesPermission(this.permissionService, actor, salesPermissions.viewPromotions, salesPermissions.managePromotions);
    const row = await this.single(this.database, actor.companyId, id);
    const channels = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT c.id, c.name FROM sales.promotion_channels pc JOIN catalog.sales_channels c ON c.id = pc.channel_id WHERE pc.promotion_id = ${id} ORDER BY c.code`);
    const groups = await this.database.execute<{ id: string; name: string }>(sql`
      SELECT g.id, g.name FROM sales.promotion_customer_groups pg JOIN catalog.customer_groups g ON g.id = pg.customer_group_id WHERE pg.promotion_id = ${id} ORDER BY g.code`);
    const items = await this.database.execute<{ variant_id: string; sku: string; product_name: string; discount_percent: string }>(sql`
      SELECT i.variant_id, v.sku, p.name AS product_name, i.discount_percent::text FROM sales.promotion_items i JOIN catalog.variants v ON v.id = i.variant_id
      JOIN catalog.products p ON p.id = v.product_id WHERE i.promotion_id = ${id} ORDER BY v.sku`);
    const variant = async (variantId: string | null, quantity: string | null) => {
      if (!variantId || quantity === null) return null;
      const found = (
        await this.database.execute<{ sku: string; product_name: string; base_unit_name: string }>(sql`
        SELECT v.sku, p.name AS product_name, u.name_vi AS base_unit_name FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id
        JOIN catalog.units u ON u.id = p.base_unit_id WHERE v.id = ${variantId}`)
      ).rows[0]!;
      return { variantId, sku: found.sku, productName: found.product_name, quantity: trimDecimal(quantity), baseUnitName: found.base_unit_name };
    };
    const manage = granted.has(salesPermissions.managePromotions);
    const firstStepDecided = row.approval_request_id
      ? (await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NOT NULL`)).rows.length > 0
      : true;
    return {
      ...toItem(row),
      channels: channels.rows,
      customerGroups: groups.rows,
      items: items.rows.map((item) => ({ variantId: item.variant_id, sku: item.sku, productName: item.product_name, discountPercent: trimDecimal(item.discount_percent) })),
      minOrderAmount: row.min_order_amount === null ? null : trimDecimal(row.min_order_amount),
      orderDiscountPercent: row.order_discount_percent === null ? null : trimDecimal(row.order_discount_percent),
      maxOrderDiscount: row.max_order_discount === null ? null : trimDecimal(row.max_order_discount),
      buy: await variant(row.buy_variant_id, row.buy_quantity),
      gift: await variant(row.gift_variant_id, row.gift_quantity),
      note: row.note,
      approvalRequestId: row.approval_request_id,
      stoppedReason: row.stopped_reason,
      currency: await companyCurrency(this.database, row.company_id),
      version: row.version,
      canEdit: manage && ["draft", "rejected", "withdrawn"].includes(row.status),
      canSubmit: manage && ["draft", "rejected", "withdrawn"].includes(row.status),
      canWithdraw: row.created_by === actor.userId && row.status === "pending" && !firstStepDecided,
      canStop: manage && row.status === "active",
    };
  }

  async create(actor: Actor, input: Input): Promise<PromotionResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.managePromotions);
    const id = await this.database.transaction(async (transaction) => {
      await this.validate(transaction, actor.companyId, input);
      const promotionId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO sales.promotions (company_id, name, kind, valid_from, valid_to, created_by) VALUES (${actor.companyId}, ${input.name}, 'product_discount', ${input.validFrom}::date,
          ${input.validTo}::date, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.write(transaction, promotionId, input);
      await this.auditService.record({ ...salesAudit(actor, "promotion"), action: "promotion.create", entityId: promotionId, afterData: input }, transaction);
      return promotionId;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<PromotionResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.managePromotions);
    const before = await this.detail(actor, id);
    if (!before.canEdit) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM sales.promotions WHERE id = ${id} AND company_id = ${actor.companyId} AND version = ${input.version ?? 0} AND status IN ('draft', 'rejected', 'withdrawn') FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.validate(transaction, actor.companyId, input);
      await transaction.execute(sql`
        UPDATE sales.promotions SET name = ${input.name}, valid_from = ${input.validFrom}::date, valid_to = ${input.validTo}::date, status = 'draft',
          approval_request_id = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.write(transaction, id, input);
      await this.auditService.record({ ...salesAudit(actor, "promotion"), action: "promotion.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi duyệt; chưa có chính sách duyệt thì chạy ngay (QUYTAC_NGHIEPVU_80).
  async submit(actor: Actor, id: string): Promise<PromotionResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.managePromotions);
    const current = await this.single(this.database, actor.companyId, id);
    if (!["draft", "rejected", "withdrawn"].includes(current.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "KM");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM sales.promotions WHERE id = ${id} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${current.version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const documentNo = current.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: id,
          documentNo,
          amount: current.budget_amount ?? "0",
          currency: await companyCurrency(transaction, actor.companyId),
          documentDate: this.permissionService.today(),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE sales.promotions SET status = ${requestId ? "pending" : "active"}, document_no = ${documentNo}, approval_request_id = ${requestId}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...salesAudit(actor, "promotion"), action: "promotion.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } }, transaction);
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<PromotionResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.managePromotions);
    const row = await this.single(this.database, actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.execute(sql`UPDATE sales.promotions SET status = 'withdrawn', updated_at = now() WHERE id = ${id} AND status = 'pending'`);
    return this.detail(actor, id);
  }

  // Dừng chương trình đang chạy; đơn đã lưu giữ khuyến mãi đã áp cho đến khi lưu lại (QUYTAC_NGHIEPVU_80, 84).
  async stop(actor: Actor, id: string, reason: string, version: number): Promise<PromotionResponse> {
    await requireSalesPermission(this.permissionService, actor, salesPermissions.managePromotions);
    const updated = await this.database.execute(sql`
      UPDATE sales.promotions SET status = 'stopped', stopped_reason = ${reason}, stopped_at = now(), stopped_by = ${actor.userId}, updated_at = now(), version = version + 1
      WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'active' AND version = ${version} RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.auditService.record({ ...salesAudit(actor, "promotion"), action: "promotion.stop", entityId: id, afterData: { reason } });
    return this.detail(actor, id);
  }

  // Mặt hàng đang bán của công ty; kênh (không phải kênh Nội bộ), nhóm khách của công ty.
  private async validate(transaction: Executor, companyId: string, input: Input): Promise<void> {
    const fields: FieldErrors = {};
    const activeVariant = async (variantId: string) =>
      (
        await transaction.execute(sql`
        SELECT 1 FROM catalog.variants v JOIN catalog.products p ON p.id = v.product_id WHERE v.id = ${variantId} AND v.company_id = ${companyId} AND v.status = 'active' AND p.status = 'active'`)
      ).rows.length > 0;
    if (input.kind === "product_discount") {
      for (const [index, item] of input.items.entries()) if (!(await activeVariant(item.variantId))) fields[`items.${index}.variantId`] = "invalidValue";
    }
    if (input.kind === "buy_get") {
      if (input.buyVariantId && !(await activeVariant(input.buyVariantId))) fields.buyVariantId = "invalidValue";
      if (input.giftVariantId && !(await activeVariant(input.giftVariantId))) fields.giftVariantId = "invalidValue";
    }
    if (input.channelIds.length > 0) {
      const found = await transaction.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM catalog.sales_channels WHERE company_id = ${companyId} AND code <> ${internalChannelCode} AND id = ANY(${pgArray(input.channelIds)}::uuid[])`);
      if (found.rows[0]!.total !== new Set(input.channelIds).size) fields.channelIds = "invalidValue";
    }
    if (input.customerGroupIds.length > 0) {
      const found = await transaction.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM catalog.customer_groups WHERE company_id = ${companyId} AND id = ANY(${pgArray(input.customerGroupIds)}::uuid[])`);
      if (found.rows[0]!.total !== new Set(input.customerGroupIds).size) fields.customerGroupIds = "invalidValue";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  // Ghi loại cùng các trường của loại trong một câu lệnh (ràng buộc theo loại kiểm từng câu); trường của loại khác để trống. Dòng mới chèn tạm loại giảm theo sản phẩm.
  private async write(transaction: Executor, id: string, input: Input): Promise<void> {
    const order = input.kind === "order_discount";
    const buyGet = input.kind === "buy_get";
    await transaction.execute(sql`
      UPDATE sales.promotions SET kind = ${input.kind}, min_order_amount = ${order ? input.minOrderAmount : null}::numeric, order_discount_percent = ${order ? input.orderDiscountPercent : null}::numeric,
        max_order_discount = ${order ? input.maxOrderDiscount : null}::numeric, buy_variant_id = ${buyGet ? (input.buyVariantId ?? null) : null},
        buy_quantity = ${buyGet ? input.buyQuantity : null}::numeric, gift_variant_id = ${buyGet ? (input.giftVariantId ?? null) : null}, gift_quantity = ${buyGet ? input.giftQuantity : null}::numeric,
        budget_amount = ${buyGet ? null : input.budgetAmount}::numeric, max_gift_sets = ${buyGet ? (input.maxGiftSets ?? null) : null}, note = ${input.note}
      WHERE id = ${id}`);
    await transaction.execute(sql`DELETE FROM sales.promotion_items WHERE promotion_id = ${id}`);
    await transaction.execute(sql`DELETE FROM sales.promotion_channels WHERE promotion_id = ${id}`);
    await transaction.execute(sql`DELETE FROM sales.promotion_customer_groups WHERE promotion_id = ${id}`);
    if (input.kind === "product_discount") {
      for (const item of input.items) {
        await transaction.execute(sql`INSERT INTO sales.promotion_items (promotion_id, variant_id, discount_percent) VALUES (${id}, ${item.variantId}, ${item.discountPercent}::numeric)`);
      }
    }
    for (const channelId of new Set(input.channelIds)) await transaction.execute(sql`INSERT INTO sales.promotion_channels (promotion_id, channel_id) VALUES (${id}, ${channelId})`);
    for (const groupId of new Set(input.customerGroupIds)) {
      await transaction.execute(sql`INSERT INTO sales.promotion_customer_groups (promotion_id, customer_group_id) VALUES (${id}, ${groupId})`);
    }
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<PromotionRow> {
    const row = (await executor.execute<PromotionRow>(sql`${this.select()} WHERE p.id = ${id} AND p.company_id = ${companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private select(): SQL {
    return sql`SELECT p.id, p.company_id, p.document_no, p.name, p.kind, p.valid_from, p.valid_to, p.min_order_amount::text, p.order_discount_percent::text, p.max_order_discount::text,
      p.buy_variant_id, p.buy_quantity::text, p.gift_variant_id, p.gift_quantity::text, p.budget_amount::text, p.max_gift_sets, p.note, p.status, p.approval_request_id, p.stopped_reason,
      p.created_by, u.full_name AS created_by_name, ${promotionUsage(sql`p.id`)}::text AS used_amount, ${promotionGiftUsage(sql`p.id`)} AS used_gift_sets, p.version
      FROM sales.promotions p JOIN core.users u ON u.id = p.created_by`;
  }
}

function toItem(row: PromotionRow): PromotionListItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    name: row.name,
    kind: row.kind,
    validFrom: day(row.valid_from),
    validTo: day(row.valid_to),
    status: row.status,
    usedAmount: trimDecimal(row.used_amount),
    usedGiftSets: Number(row.used_gift_sets),
    budgetAmount: row.budget_amount === null ? null : trimDecimal(row.budget_amount),
    maxGiftSets: row.max_gift_sets,
    createdByName: row.created_by_name,
  };
}
