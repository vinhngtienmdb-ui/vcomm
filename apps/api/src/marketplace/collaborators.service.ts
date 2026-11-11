// Cộng tác viên, mời bạn bè, thưởng giới thiệu (CONG_VIEC_49; CHUC_NANG_171; QUYTAC_NGHIEPVU_324, 325, 327; API_162, API_163).
import { Inject, Injectable } from "@nestjs/common";
import {
  collaboratorTermsVersion,
  type BuyerCollaboratorOrderItem,
  type BuyerCollaboratorResponse,
  type BuyerInvitationsResponse,
  type CollaboratorDetail,
  type CollaboratorHistoryItem,
  type CollaboratorLabel,
  type CollaboratorListItem,
  type CollaboratorStats,
  type CollaboratorStatus,
  type InvitationBonusStatus,
  type PageResponse,
  type ReferralBonusSettings,
} from "contracts";
import { randomInt } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import type { collaboratorListQuerySchema, referralBonusSettingsSchema, submitCollaboratorSchema } from "contracts";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { maskPhone } from "./buyer-accounts.service";
import { BuyerAdminService, type BuyerAdminActor } from "./buyer-admin.service";
import { commissionEstimate } from "./commissions.service";
import { localPhone } from "./local-phone";
import { buyerAccount } from "./shop.service";

type Executor = Pick<Database, "execute">;

// Mã 8 ký tự, bỏ 0, O, 1, I để khỏi đọc nhầm (QUYTAC_NGHIEPVU_324).
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 8 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join("");
// Tối đa 200 lượt ghi mỗi ngày mỗi người mua (QUYTAC_NGHIEPVU_325).
const dailyClickLimit = 200;

type ProfileRow = {
  user_id: string;
  full_name: string;
  phone: string | null;
  code: string | null;
  label: CollaboratorLabel | null;
  status: CollaboratorStatus;
  channel: string | null;
  terms_version: number;
  reason: string | null;
  submitted_at: Date;
  decided_at: Date | null;
  version: number;
};

// Thống kê 30 ngày theo cộng tác viên: lượt bấm, số đơn chưa hủy, hoa hồng cộng tác viên đang chờ và đã cộng.
async function statsOf(executor: Executor, userIds: string[]): Promise<Map<string, CollaboratorStats>> {
  const result = new Map<string, CollaboratorStats>();
  if (userIds.length === 0) return result;
  const ids = sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const clicks = await executor.execute<{ user_id: string; clicks: number }>(sql`
    SELECT collaborator_user_id AS user_id, count(*)::int AS clicks FROM marketplace.collaborator_click_log
    WHERE collaborator_user_id IN (${ids}) AND clicked_at > now() - interval '30 days' GROUP BY collaborator_user_id`);
  const orders = await executor.execute<{ user_id: string; orders: number; pending: string; credited: string }>(sql`
    SELECT c.beneficiary_user_id AS user_id, count(DISTINCT c.order_id)::int AS orders,
      coalesce(sum(${commissionEstimate}) FILTER (WHERE c.status = 'pending'), 0)::float::text AS pending,
      coalesce(sum(c.amount) FILTER (WHERE c.status = 'credited'), 0)::float::text AS credited
    FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id JOIN marketplace.orders m ON m.id = c.order_id
    WHERE c.share = 'collaborator' AND c.beneficiary_user_id IN (${ids}) AND m.status <> 'cancelled' AND c.created_at > now() - interval '30 days'
    GROUP BY c.beneficiary_user_id`);
  for (const userId of userIds) result.set(userId, { clicks: 0, orders: 0, pendingAmount: "0", creditedAmount: "0" });
  for (const row of clicks.rows) result.get(row.user_id)!.clicks = row.clicks;
  for (const row of orders.rows) Object.assign(result.get(row.user_id)!, { orders: row.orders, pendingAmount: row.pending, creditedAmount: row.credited });
  return result;
}

@Injectable()
export class CollaboratorsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly admin: BuyerAdminService,
    private readonly audit: AuditService,
  ) {}

  private async operator(): Promise<string> {
    const companyId = await this.admin.operatorCompanyId();
    if (!companyId) throw new ApiError("BUSINESS_RULE", "marketplaceOperatorNotSet");
    return companyId;
  }

  // ---------- Người mua (API_162) ----------

  async mine(userId: string): Promise<BuyerCollaboratorResponse> {
    const row = (
      await this.database.execute<ProfileRow>(sql`
      SELECT c.*, u.full_name, u.phone FROM marketplace.collaborators c JOIN core.users u ON u.id = c.user_id WHERE c.user_id = ${userId}`)
    ).rows[0];
    if (!row) return { profile: null, stats: null, termsVersion: collaboratorTermsVersion };
    const stats = ["approved", "suspended"].includes(row.status) ? (await statsOf(this.database, [userId])).get(userId)! : null;
    return {
      profile: {
        status: row.status,
        code: row.code,
        label: row.label,
        channel: row.channel,
        reason: row.reason,
        submittedAt: new Date(row.submitted_at).toISOString(),
        version: row.version,
      },
      stats,
      termsVersion: collaboratorTermsVersion,
    };
  }

  // Gửi đăng ký (QUYTAC_NGHIEPVU_324): lần đầu, hoặc gửi lại khi bị từ chối.
  async submit(userId: string, input: z.output<typeof submitCollaboratorSchema>): Promise<BuyerCollaboratorResponse> {
    await buyerAccount(this.database, userId);
    const companyId = await this.operator();
    await this.database.transaction(async (transaction) => {
      const current = (await transaction.execute<{ status: CollaboratorStatus; version: number }>(sql`SELECT status, version FROM marketplace.collaborators WHERE user_id = ${userId} FOR UPDATE`))
        .rows[0];
      if (!current) {
        if (input.version !== 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`
          INSERT INTO marketplace.collaborators (user_id, company_id, channel, terms_version) VALUES (${userId}, ${companyId}, ${input.channel || null}, ${collaboratorTermsVersion})`);
      } else {
        if (current.status !== "rejected") throw new ApiError("BUSINESS_RULE", "collaboratorAlreadySubmitted");
        if (current.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`
          UPDATE marketplace.collaborators SET status = 'pending', channel = ${input.channel || null}, terms_version = ${collaboratorTermsVersion}, reason = NULL,
            submitted_at = now(), decided_by = NULL, decided_at = NULL, updated_at = now(), version = version + 1
          WHERE user_id = ${userId}`);
      }
      await transaction.execute(sql`INSERT INTO marketplace.collaborator_history (user_id, action, changed_by) VALUES (${userId}, 'submit', ${userId})`);
    });
    return this.mine(userId);
  }

  // Ghi lượt bấm (QUYTAC_NGHIEPVU_325). Điều kiện không đạt thì bỏ qua, không báo lỗi để không lộ mã hợp lệ.
  async click(userId: string, input: { code: string; productId: string }): Promise<void> {
    await buyerAccount(this.database, userId);
    await this.database.transaction(async (transaction) => {
      // Khóa tài khoản người mua: đếm giới hạn ngày không chạy đồng thời.
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      const collaborator = (
        await transaction.execute<{ user_id: string }>(sql`
        SELECT c.user_id FROM marketplace.collaborators c
        WHERE c.code = ${input.code} AND c.status = 'approved' AND c.user_id <> ${userId}
          AND EXISTS (SELECT 1 FROM marketplace.listings l WHERE l.product_id = ${input.productId} AND l.is_published AND l.company_id = c.company_id)`)
      ).rows[0];
      if (!collaborator) return;
      const today = await transaction.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM marketplace.collaborator_click_log
        WHERE buyer_user_id = ${userId} AND clicked_at >= ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
      if (today.rows[0]!.count >= dailyClickLimit) return;
      await transaction.execute(sql`
        INSERT INTO marketplace.collaborator_click_log (buyer_user_id, collaborator_user_id, product_id) VALUES (${userId}, ${collaborator.user_id}, ${input.productId})`);
      await transaction.execute(sql`
        INSERT INTO marketplace.collaborator_clicks (buyer_user_id, collaborator_user_id, product_id) VALUES (${userId}, ${collaborator.user_id}, ${input.productId})
        ON CONFLICT (buyer_user_id, collaborator_user_id, product_id) DO UPDATE SET last_clicked_at = now(), click_count = marketplace.collaborator_clicks.click_count + 1`);
    });
  }

  // Đơn ghi nhận gần đây (20 đơn mới nhất, không gồm đơn hủy).
  async myOrders(userId: string): Promise<BuyerCollaboratorOrderItem[]> {
    const rows = await this.database.execute<{ order_id: string; document_no: string; product_name: string; credited: boolean; amount: string; created_at: Date }>(sql`
      SELECT c.order_id, so.document_no, min(p.name) AS product_name, bool_and(c.status = 'credited') AS credited,
        sum(coalesce(c.amount, ${commissionEstimate}))::float::text AS amount, m.created_at
      FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id JOIN catalog.variants v ON v.id = l.variant_id
        JOIN catalog.products p ON p.id = v.product_id JOIN marketplace.orders m ON m.id = c.order_id JOIN sales.orders so ON so.id = m.sales_order_id
      WHERE c.share = 'collaborator' AND c.beneficiary_user_id = ${userId} AND m.status <> 'cancelled'
      GROUP BY c.order_id, so.document_no, m.created_at ORDER BY m.created_at DESC LIMIT 20`);
    return rows.rows.map((row) => ({
      orderId: row.order_id,
      documentNo: row.document_no,
      productName: row.product_name,
      credited: row.credited,
      amount: row.amount,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  // Mời bạn bè (QUYTAC_NGHIEPVU_327): chương trình hiện tại và trạng thái thưởng của từng người đã mời.
  async invitations(userId: string): Promise<BuyerInvitationsResponse> {
    const companyId = await this.admin.operatorCompanyId();
    const settings = companyId ? await this.readSettings(this.database, companyId) : null;
    const rows = await this.database.execute<{ full_name: string; phone: string | null; registered_at: Date; bonus_amount: string | null; bonus_mine: boolean; open: boolean; completed: boolean }>(sql`
      SELECT u.full_name, u.phone, b.registered_at, rb.amount::float::text AS bonus_amount, coalesce(rb.beneficiary_user_id = ${userId}, false) AS bonus_mine,
        EXISTS (SELECT 1 FROM marketplace.orders m WHERE m.buyer_user_id = b.user_id AND m.referrer_user_id = ${userId} AND m.status NOT IN ('completed', 'cancelled')) AS open,
        EXISTS (SELECT 1 FROM marketplace.orders m WHERE m.buyer_user_id = b.user_id AND m.referrer_user_id = ${userId} AND m.status = 'completed') AS completed
      FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id LEFT JOIN marketplace.referral_bonuses rb ON rb.referred_user_id = b.user_id
      WHERE b.referrer_user_id = ${userId} ORDER BY b.registered_at DESC LIMIT 200`);
    const statusOf = (row: { bonus_amount: string | null; bonus_mine: boolean; open: boolean; completed: boolean }): InvitationBonusStatus => {
      if (row.bonus_amount !== null) return row.bonus_mine ? "credited" : "not_qualified";
      if (row.open) return "in_progress";
      return row.completed ? "not_qualified" : "no_order";
    };
    return {
      program: { isEnabled: settings?.isEnabled ?? false, bonusAmount: settings?.bonusAmount ?? null, minimumOrder: settings?.minimumOrder ?? "0" },
      invitees: rows.rows.map((row) => {
        const bonusStatus = statusOf(row);
        return {
          fullName: row.full_name,
          phone: maskPhone(row.phone ?? ""),
          registeredAt: new Date(row.registered_at).toISOString(),
          bonusStatus,
          bonusAmount: bonusStatus === "credited" ? row.bonus_amount : null,
        };
      }),
    };
  }

  // ---------- Quản trị (API_163) ----------

  async list(actor: BuyerAdminActor, query: z.output<typeof collaboratorListQuerySchema>): Promise<PageResponse<CollaboratorListItem>> {
    const conditions: SQL[] = [sql`c.company_id = ${actor.operatorCompanyId}`];
    if (query.status) conditions.push(sql`c.status = ${query.status}`);
    if (query.label) conditions.push(sql`c.label = ${query.label}`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[%_\\]/g, "\\$&")}%`;
      const phone = query.search.replace(/\D/g, "");
      conditions.push(sql`(u.full_name ILIKE ${pattern} OR c.code ILIKE ${pattern}${phone.length >= 3 ? sql` OR u.phone LIKE ${`%${phone.replace(/^0/, "")}%`}` : sql``})`);
    }
    const where = sql.join(conditions, sql` AND `);
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.collaborators c JOIN core.users u ON u.id = c.user_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<ProfileRow>(sql`
      SELECT c.*, u.full_name, u.phone FROM marketplace.collaborators c JOIN core.users u ON u.id = c.user_id
      WHERE ${where} ORDER BY c.submitted_at DESC, c.user_id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const stats = await statsOf(
      this.database,
      rows.rows.map((row) => row.user_id),
    );
    return { data: rows.rows.map((row) => this.listItem(row, stats.get(row.user_id)!)), page: query.page, pageSize: query.pageSize, total };
  }

  private listItem(row: ProfileRow, stats: CollaboratorStats): CollaboratorListItem {
    return {
      userId: row.user_id,
      fullName: row.full_name,
      phone: localPhone(row.phone ?? ""),
      code: row.code,
      label: row.label,
      status: row.status,
      orders: stats.orders,
      creditedAmount: stats.creditedAmount,
      submittedAt: new Date(row.submitted_at).toISOString(),
    };
  }

  async detail(actor: BuyerAdminActor, userId: string): Promise<CollaboratorDetail> {
    const row = (
      await this.database.execute<ProfileRow>(sql`
      SELECT c.*, u.full_name, u.phone FROM marketplace.collaborators c JOIN core.users u ON u.id = c.user_id
      WHERE c.user_id = ${userId} AND c.company_id = ${actor.operatorCompanyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const stats = (await statsOf(this.database, [userId])).get(userId)!;
    const history = await this.database.execute<{ action: CollaboratorHistoryItem["action"]; label: CollaboratorLabel | null; reason: string | null; name: string; changed_at: Date }>(sql`
      SELECT h.action, h.label, h.reason, u.full_name AS name, h.changed_at FROM marketplace.collaborator_history h JOIN core.users u ON u.id = h.changed_by
      WHERE h.user_id = ${userId} ORDER BY h.changed_at DESC, h.id`);
    return {
      ...this.listItem(row, stats),
      channel: row.channel,
      termsVersion: row.terms_version,
      reason: row.reason,
      decidedAt: row.decided_at ? new Date(row.decided_at).toISOString() : null,
      clicks: stats.clicks,
      pendingAmount: stats.pendingAmount,
      history: history.rows.map((item) => ({
        action: item.action,
        label: item.label,
        reason: item.reason,
        changedByName: item.name,
        changedAt: new Date(item.changed_at).toISOString(),
      })),
      version: row.version,
    };
  }

  // Chuyển trạng thái (QUYTAC_NGHIEPVU_324): duyệt, từ chối từ Chờ duyệt; tạm ngừng từ Đã duyệt; khôi phục từ Tạm ngừng. Duyệt lần đầu cấp mã.
  async decide(actor: BuyerAdminActor, userId: string, action: "approve" | "reject" | "suspend" | "restore", input: { reason?: string; version: number }): Promise<CollaboratorDetail> {
    const from: Record<typeof action, CollaboratorStatus> = { approve: "pending", reject: "pending", suspend: "approved", restore: "suspended" };
    const to: Record<typeof action, CollaboratorStatus> = { approve: "approved", reject: "rejected", suspend: "suspended", restore: "approved" };
    await this.database.transaction(async (transaction) => {
      const current = await this.lock(transaction, actor, userId, input.version);
      if (current.status !== from[action]) throw new ApiError("BUSINESS_RULE", "collaboratorStatusChanged");
      const reason = action === "reject" || action === "suspend" ? input.reason! : null;
      let code = current.code;
      if (action === "approve" && !code) code = await this.uniqueCode(transaction);
      await transaction.execute(sql`
        UPDATE marketplace.collaborators SET status = ${to[action]}, code = ${code}, reason = ${reason}, decided_by = ${actor.userId}, decided_at = now(),
          updated_at = now(), version = version + 1
        WHERE user_id = ${userId}`);
      await transaction.execute(sql`
        INSERT INTO marketplace.collaborator_history (user_id, action, reason, changed_by) VALUES (${userId}, ${action}, ${reason}, ${actor.userId})`);
      const titles: Record<typeof action, string> = {
        approve: "Bạn đã trở thành cộng tác viên VComm",
        reject: "Đăng ký cộng tác viên chưa được duyệt",
        suspend: "Tài khoản cộng tác viên bị tạm ngừng",
        restore: "Tài khoản cộng tác viên đã được khôi phục",
      };
      await notify(transaction, [{ userId, companyId: actor.operatorCompanyId, kind: `collaborator.${action}`, title: titles[action], payload: { reason } }]);
      await this.record(transaction, actor, `marketplace.collaborator.${action}`, userId, { status: current.status }, { status: to[action], reason });
    });
    return this.detail(actor, userId);
  }

  async setLabel(actor: BuyerAdminActor, userId: string, input: { label: CollaboratorLabel | null; version: number }): Promise<CollaboratorDetail> {
    await this.database.transaction(async (transaction) => {
      const current = await this.lock(transaction, actor, userId, input.version);
      if (!["approved", "suspended"].includes(current.status)) throw new ApiError("BUSINESS_RULE", "collaboratorNotApproved");
      await transaction.execute(sql`UPDATE marketplace.collaborators SET label = ${input.label}, updated_at = now(), version = version + 1 WHERE user_id = ${userId}`);
      await transaction.execute(sql`
        INSERT INTO marketplace.collaborator_history (user_id, action, label, changed_by) VALUES (${userId}, 'label', ${input.label}, ${actor.userId})`);
      await notify(transaction, [{ userId, companyId: actor.operatorCompanyId, kind: "collaborator.label", title: "Nhãn cộng tác viên của bạn đã thay đổi", payload: { label: input.label } }]);
      await this.record(transaction, actor, "marketplace.collaborator.label", userId, { label: current.label }, { label: input.label });
    });
    return this.detail(actor, userId);
  }

  private async lock(executor: Executor, actor: BuyerAdminActor, userId: string, version: number): Promise<{ status: CollaboratorStatus; code: string | null; label: CollaboratorLabel | null }> {
    const current = (
      await executor.execute<{ status: CollaboratorStatus; code: string | null; label: CollaboratorLabel | null; version: number }>(sql`
      SELECT status, code, label, version FROM marketplace.collaborators WHERE user_id = ${userId} AND company_id = ${actor.operatorCompanyId} FOR UPDATE`)
    ).rows[0];
    if (!current) throw new ApiError("NOT_FOUND", "notFound");
    if (current.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return current;
  }

  private async uniqueCode(executor: Executor): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = newCode();
      const taken = await executor.execute(sql`SELECT 1 FROM marketplace.collaborators WHERE code = ${code}`);
      if (taken.rows.length === 0) return code;
    }
    throw new Error("Không cấp được mã cộng tác viên sau 20 lần thử.");
  }

  // Cài đặt thưởng giới thiệu (QUYTAC_NGHIEPVU_327).
  private async readSettings(executor: Executor, companyId: string): Promise<ReferralBonusSettings> {
    const row = (
      await executor.execute<{ is_enabled: boolean; bonus_amount: string; minimum_order: string; version: number }>(sql`
      SELECT is_enabled, bonus_amount::text, minimum_order::text, version FROM marketplace.referral_bonus_settings WHERE company_id = ${companyId}`)
    ).rows[0];
    if (!row) return { isEnabled: false, bonusAmount: null, minimumOrder: "0", version: 0 };
    return { isEnabled: row.is_enabled, bonusAmount: trimDecimal(row.bonus_amount), minimumOrder: trimDecimal(row.minimum_order), version: row.version };
  }

  async settings(actor: BuyerAdminActor): Promise<ReferralBonusSettings> {
    return this.readSettings(this.database, actor.operatorCompanyId);
  }

  async updateSettings(actor: BuyerAdminActor, input: z.output<typeof referralBonusSettingsSchema>): Promise<ReferralBonusSettings> {
    await this.database.transaction(async (transaction) => {
      const before = await this.readSettings(transaction, actor.operatorCompanyId);
      const saved =
        input.version === 0
          ? await transaction.execute(sql`
            INSERT INTO marketplace.referral_bonus_settings (company_id, is_enabled, bonus_amount, minimum_order, updated_by)
            VALUES (${actor.operatorCompanyId}, ${input.isEnabled}, ${input.bonusAmount}::numeric, ${input.minimumOrder}::numeric, ${actor.userId})
            ON CONFLICT (company_id) DO NOTHING RETURNING company_id`)
          : await transaction.execute(sql`
            UPDATE marketplace.referral_bonus_settings SET is_enabled = ${input.isEnabled}, bonus_amount = ${input.bonusAmount}::numeric, minimum_order = ${input.minimumOrder}::numeric,
              updated_by = ${actor.userId}, updated_at = now(), version = version + 1
            WHERE company_id = ${actor.operatorCompanyId} AND version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.record(transaction, actor, "marketplace.referral_bonus_settings.update", actor.operatorCompanyId, before, input, "marketplace.referral_bonus_settings");
    });
    return this.settings(actor);
  }

  private record(
    transaction: Pick<Database, "execute" | "insert">,
    actor: BuyerAdminActor,
    action: string,
    entityId: string,
    beforeData: unknown,
    afterData: unknown,
    entityType = "marketplace.collaborators",
  ) {
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
