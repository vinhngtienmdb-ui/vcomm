// Quản trị điểm thưởng: ví điểm, khóa ví, phiếu điều chỉnh qua luồng duyệt, cảnh báo bất thường
// (CONG_VIEC_51; CHUC_NANG_181; QUYTAC_NGHIEPVU_352 đến 354; API_179 đến 181).
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { LoyaltyAccountDetail, LoyaltyAccountListItem, LoyaltyAdjustmentItem, LoyaltyAdjustmentStatus, LoyaltyAlertKind, LoyaltyAlertResponse, LoyaltyLotItem, PageResponse } from "contracts";
import { sql } from "drizzle-orm";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { localPhone } from "../marketplace/local-phone";
import { vietnamToday } from "../marketplace/shop.service";
import { ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { LoyaltyAccountsService } from "./accounts.service";
import { adjustPoints } from "./ledger.service";
import { LoyaltyProgramService, phaseById, phaseOn } from "./program.service";
import { lockAccount } from "./tiers";

type Executor = Pick<Database, "execute">;
const adjustmentType = "loyalty.adjustment";
const iso = (value: Date) => new Date(value).toISOString();

type AdjustmentRow = {
  id: string;
  document_no: string | null;
  user_id: string;
  buyer_name: string;
  buyer_phone: string | null;
  direction: "add" | "subtract";
  points: number;
  point_value: string | null;
  reason: string;
  status: LoyaltyAdjustmentStatus;
  failure_reason: string | null;
  approval_request_id: string | null;
  created_by: string;
  created_by_name: string;
  created_at: Date;
  version: number;
};

const adjustmentSelect = sql`
  SELECT d.id, d.document_no, d.user_id, u.full_name AS buyer_name, u.phone AS buyer_phone, d.direction, d.points, d.point_value::text, d.reason, d.status, d.failure_reason,
    d.approval_request_id, d.created_by, c.full_name AS created_by_name, d.created_at, d.version
  FROM loyalty.adjustments d JOIN core.users u ON u.id = d.user_id JOIN core.users c ON c.id = d.created_by`;

@Injectable()
export class LoyaltyAdminService implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyAdminService.name);

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
    private readonly accounts: LoyaltyAccountsService,
    private readonly program: LoyaltyProgramService,
    private readonly approvals: ApprovalRequestsService,
    private readonly sequences: NumberSequencesService,
    private readonly outbox: OutboxService,
  ) {}

  // Duyệt xong (sự kiện core.approval.completed) thì ghi sổ; thiếu số dư khi trừ thì phiếu Không ghi sổ được (QUYTAC_NGHIEPVU_353).
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== adjustmentType) return;
      const status = String(event.payload.status);
      const id = String(event.payload.documentId);
      if (status === "approved") {
        try {
          await this.database.transaction((transaction) => this.post(transaction, id));
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await this.database.execute(sql`
            UPDATE loyalty.adjustments SET status = 'post_failed', failure_reason = ${error.messageKey}, updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
        }
      } else if (status === "rejected" || status === "withdrawn") {
        await this.database.execute(sql`UPDATE loyalty.adjustments SET status = ${status}, updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      }
    });
  }

  // API_179: danh sách người mua và ví điểm.
  async list(query: {
    search?: string | undefined;
    tierId?: string | undefined;
    locked?: "true" | "false" | undefined;
    page: number;
    pageSize: number;
  }): Promise<PageResponse<LoyaltyAccountListItem>> {
    const today = await vietnamToday(this.database);
    const search = query.search ? `%${query.search.replace(/[%_\\]/g, (character) => `\\${character}`)}%` : null;
    const searchPhone = query.search && /^0\d{9}$/.test(query.search.replace(/\s/g, "")) ? `+84${query.search.replace(/\s/g, "").slice(1)}` : null;
    const where = sql`(${search}::text IS NULL OR u.full_name ILIKE ${search} OR u.phone ILIKE ${search} OR u.phone = ${searchPhone})
      AND (${query.tierId ?? null}::uuid IS NULL OR a.tier_id = ${query.tierId ?? null}::uuid)
      AND (${query.locked ?? null}::text IS NULL OR coalesce(a.locked, false) = (${query.locked ?? null}::text = 'true'))`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id LEFT JOIN loyalty.accounts a ON a.user_id = b.user_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<{
      user_id: string;
      full_name: string;
      phone: string | null;
      tier_name: string | null;
      balance: number | null;
      expiring: number;
      spend: string | null;
      locked: boolean | null;
    }>(sql`
      SELECT b.user_id, u.full_name, u.phone, t.name_vi AS tier_name, a.balance, a.locked, a.spend_current_year::text AS spend,
        coalesce((SELECT sum(l.remaining) FROM loyalty.lots l WHERE l.user_id = b.user_id AND l.remaining > 0 AND l.expires_on BETWEEN ${today}::date AND ${today}::date + 30), 0)::int AS expiring
      FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id LEFT JOIN loyalty.accounts a ON a.user_id = b.user_id LEFT JOIN loyalty.tiers t ON t.id = a.tier_id
      WHERE ${where} ORDER BY coalesce(a.balance, 0) DESC, u.full_name, b.user_id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        userId: row.user_id,
        fullName: row.full_name,
        phone: localPhone(row.phone ?? ""),
        tierName: row.tier_name,
        balance: row.balance ?? 0,
        expiringPoints: row.expiring,
        spendCurrentYear: trimDecimal(row.spend ?? "0"),
        locked: row.locked ?? false,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  private async buyer(executor: Executor, userId: string): Promise<{ full_name: string; phone: string | null }> {
    const row = (
      await executor.execute<{ full_name: string; phone: string | null }>(sql`
      SELECT u.full_name, u.phone FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id WHERE b.user_id = ${userId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  // API_179: chi tiết ví điểm (MAN_HINH_147).
  async detail(userId: string, canManage: boolean): Promise<LoyaltyAccountDetail> {
    const buyer = await this.buyer(this.database, userId);
    const account = (
      await this.database.execute<{ balance: number; locked: boolean; lock_reason: string | null }>(sql`SELECT balance, locked, lock_reason FROM loyalty.accounts WHERE user_id = ${userId}`)
    ).rows[0];
    const lots = await this.database.execute<{
      id: string;
      source_type: LoyaltyLotItem["sourceType"];
      document_no: string | null;
      earned_on: string;
      expires_on: string;
      points: number;
      remaining: number;
      point_value: string;
    }>(sql`
      SELECT l.id, l.source_type, l.earned_on::text, l.expires_on::text, l.points, l.remaining, l.point_value::text,
        CASE l.source_type WHEN 'marketplace_order' THEN (SELECT so.document_no FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = l.source_id)
          WHEN 'adjustment' THEN (SELECT d.document_no FROM loyalty.adjustments d WHERE d.id = l.source_id)
          WHEN 'partner_exchange' THEN (SELECT x.document_no FROM loyalty.partner_exchanges x WHERE x.id = l.source_id) END AS document_no
      FROM loyalty.lots l WHERE l.user_id = ${userId} AND l.remaining > 0 ORDER BY l.expires_on, l.created_at`);
    const tiers = await this.database.execute<{ from_name: string | null; to_name: string; reason: "order_completed" | "year_start" | "tiers_changed"; created_at: Date }>(sql`
      SELECT f.name_vi AS from_name, t.name_vi AS to_name, h.reason, h.created_at FROM loyalty.tier_history h JOIN loyalty.tiers t ON t.id = h.to_tier_id
      LEFT JOIN loyalty.tiers f ON f.id = h.from_tier_id WHERE h.user_id = ${userId} ORDER BY h.created_at DESC LIMIT 50`);
    const locks = await this.database.execute<{ action: "lock" | "unlock"; reason: string; actor_name: string; created_at: Date }>(sql`
      SELECT h.action, h.reason, u.full_name AS actor_name, h.created_at FROM loyalty.lock_history h JOIN core.users u ON u.id = h.actor_user_id
      WHERE h.user_id = ${userId} ORDER BY h.created_at DESC LIMIT 50`);
    return {
      ...(await this.accounts.progress(this.database, userId, await this.program.tiers(this.database))),
      userId,
      fullName: buyer.full_name,
      phone: localPhone(buyer.phone ?? ""),
      balance: account?.balance ?? 0,
      locked: account?.locked ?? false,
      lockReason: account?.lock_reason ?? null,
      lots: lots.rows.map((lot) => ({
        id: lot.id,
        sourceType: lot.source_type,
        documentNo: lot.document_no,
        earnedOn: lot.earned_on,
        expiresOn: lot.expires_on,
        points: lot.points,
        remaining: lot.remaining,
        pointValue: trimDecimal(lot.point_value),
      })),
      tierHistory: tiers.rows.map((row) => ({ fromTierName: row.from_name, toTierName: row.to_name, reason: row.reason, createdAt: iso(row.created_at) })),
      lockHistory: locks.rows.map((row) => ({ action: row.action, reason: row.reason, actorName: row.actor_name, createdAt: iso(row.created_at) })),
      canManage,
    };
  }

  // QUYTAC_NGHIEPVU_352: khóa, mở ví điểm kèm lý do, lưu lịch sử.
  async setLocked(actor: BuyerAdminActor, userId: string, locked: boolean, reason: string): Promise<LoyaltyAccountDetail> {
    await this.database.transaction(async (transaction) => {
      await this.buyer(transaction, userId);
      const account = await lockAccount(transaction, userId);
      if (account.locked === locked) throw new ApiError("BUSINESS_RULE", "loyaltyAlreadyLocked");
      await transaction.execute(sql`UPDATE loyalty.accounts SET locked = ${locked}, lock_reason = ${locked ? reason : null}, updated_at = now() WHERE user_id = ${userId}`);
      await transaction.execute(sql`INSERT INTO loyalty.lock_history (user_id, action, reason, actor_user_id) VALUES (${userId}, ${locked ? "lock" : "unlock"}, ${reason}, ${actor.userId})`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: locked ? "loyalty_account.lock" : "loyalty_account.unlock",
          entityType: "loyalty_account",
          entityId: userId,
          afterData: { reason },
        },
        transaction,
      );
    });
    return this.detail(userId, true);
  }

  private async adjustmentRow(executor: Executor, actor: BuyerAdminActor, id: string): Promise<AdjustmentRow> {
    const row = (await executor.execute<AdjustmentRow>(sql`${adjustmentSelect} WHERE d.id = ${id} AND d.company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async itemOf(row: AdjustmentRow, actor: BuyerAdminActor): Promise<LoyaltyAdjustmentItem> {
    let pointValue = row.point_value;
    if (pointValue === null) pointValue = await this.currentPointValue(this.database).then((phase) => (phase ? String(phase.pointValue) : null));
    return {
      id: row.id,
      documentNo: row.document_no,
      userId: row.user_id,
      buyerName: row.buyer_name,
      buyerPhone: localPhone(row.buyer_phone ?? ""),
      direction: row.direction,
      points: row.points,
      value: pointValue === null ? null : trimDecimal(String(Math.round(row.points * Number(pointValue)))),
      reason: row.reason,
      status: row.status,
      failureReason: row.failure_reason,
      approvalRequestId: row.approval_request_id,
      createdByName: row.created_by_name,
      createdAt: iso(row.created_at),
      version: row.version,
      canEdit: ["draft", "rejected", "withdrawn"].includes(row.status),
      canWithdraw: row.status === "pending" && row.created_by === actor.userId,
    };
  }

  // Giai đoạn hiện hành; không có thì giai đoạn gần nhất đã kết thúc (QUYTAC_NGHIEPVU_353).
  private async currentPointValue(executor: Executor): Promise<{ id: string; pointValue: number; validityMonths: number } | null> {
    const today = await vietnamToday(executor);
    const current = await phaseOn(executor, today);
    if (current) return current;
    const last = (await executor.execute<{ id: string }>(sql`SELECT id FROM loyalty.program_phases WHERE starts_on <= ${today}::date ORDER BY starts_on DESC LIMIT 1`)).rows[0];
    return last ? phaseById(executor, last.id) : null;
  }

  async adjustments(actor: BuyerAdminActor, query: { status?: LoyaltyAdjustmentStatus | undefined; page: number; pageSize: number }): Promise<PageResponse<LoyaltyAdjustmentItem>> {
    const where = sql`d.company_id = ${actor.operatorCompanyId} AND (${query.status ?? null}::text IS NULL OR d.status = ${query.status ?? null}::text)`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM loyalty.adjustments d WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<AdjustmentRow>(
      sql`${adjustmentSelect} WHERE ${where} ORDER BY d.created_at DESC, d.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
    );
    const data: LoyaltyAdjustmentItem[] = [];
    for (const row of rows.rows) data.push(await this.itemOf(row, actor));
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async adjustment(actor: BuyerAdminActor, id: string): Promise<LoyaltyAdjustmentItem> {
    return this.itemOf(await this.adjustmentRow(this.database, actor, id), actor);
  }

  private async buyerByPhone(executor: Executor, phone: string): Promise<string> {
    const row = (await executor.execute<{ user_id: string }>(sql`SELECT b.user_id FROM marketplace.buyer_accounts b JOIN core.users u ON u.id = b.user_id WHERE u.phone = ${phone}`)).rows[0];
    if (!row) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { phone: "loyaltyBuyerNotFound" } });
    return row.user_id;
  }

  async createAdjustment(actor: BuyerAdminActor, input: { phone: string; direction: "add" | "subtract"; points: number; reason: string }): Promise<LoyaltyAdjustmentItem> {
    const id = await this.database.transaction(async (transaction) => {
      const userId = await this.buyerByPhone(transaction, input.phone);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO loyalty.adjustments (company_id, user_id, direction, points, reason, created_by)
        VALUES (${actor.operatorCompanyId}, ${userId}, ${input.direction}, ${input.points}, ${input.reason}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.audit.record(
        { actorUserId: actor.userId, companyId: actor.operatorCompanyId, appCode: "crm", action: "loyalty_adjustment.create", entityType: "loyalty_adjustment", entityId: created, afterData: input },
        transaction,
      );
      return created;
    });
    return this.adjustment(actor, id);
  }

  async updateAdjustment(actor: BuyerAdminActor, id: string, input: { phone: string; direction: "add" | "subtract"; points: number; reason: string; version: number }): Promise<LoyaltyAdjustmentItem> {
    await this.database.transaction(async (transaction) => {
      const userId = await this.buyerByPhone(transaction, input.phone);
      const updated = await transaction.execute(sql`
        UPDATE loyalty.adjustments SET user_id = ${userId}, direction = ${input.direction}, points = ${input.points}, reason = ${input.reason}, updated_at = now(), version = version + 1
        WHERE id = ${id} AND company_id = ${actor.operatorCompanyId} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) {
        const row = await this.adjustmentRow(transaction, actor, id);
        throw row.version !== input.version ? new ApiError("CONFLICT_VERSION", "conflictVersion") : new ApiError("BUSINESS_RULE", "loyaltyAdjustmentNotEditable");
      }
      await this.audit.record(
        { actorUserId: actor.userId, companyId: actor.operatorCompanyId, appCode: "crm", action: "loyalty_adjustment.update", entityType: "loyalty_adjustment", entityId: id, afterData: input },
        transaction,
      );
    });
    return this.adjustment(actor, id);
  }

  // Gửi duyệt (QUYTAC_NGHIEPVU_353): chốt giai đoạn, giá trị một điểm; cấp số DD khi gửi lần đầu; không có chính sách duyệt thì không gửi được.
  async submitAdjustment(actor: BuyerAdminActor, id: string, version: number): Promise<LoyaltyAdjustmentItem> {
    const numbering = { userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client };
    await ensureSequence(this.database, this.sequences, numbering, adjustmentType, "DD");
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: LoyaltyAdjustmentStatus; version: number; document_no: string | null; points: number }>(sql`
        SELECT status, version, document_no, points FROM loyalty.adjustments WHERE id = ${id} AND company_id = ${actor.operatorCompanyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "loyaltyAdjustmentNotEditable");
      const phase = await this.currentPointValue(transaction);
      if (!phase) throw new ApiError("BUSINESS_RULE", "loyaltyNoPhase");
      const documentNo = row.document_no ?? (await this.sequences.next(actor.operatorCompanyId, adjustmentType, transaction));
      const requestId = await this.approvals.submitWithin(transaction, actor.operatorCompanyId, actor.userId, {
        documentTypeCode: adjustmentType,
        documentId: id,
        documentNo,
        amount: String(Math.round(row.points * phase.pointValue)),
        currency: "VND",
        documentDate: await vietnamToday(transaction),
      });
      await transaction.execute(sql`
        UPDATE loyalty.adjustments SET status = 'pending', document_no = ${documentNo}, phase_id = ${phase.id}, point_value = ${phase.pointValue}, approval_request_id = ${requestId},
          failure_reason = NULL, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "loyalty_adjustment.submit",
          entityType: "loyalty_adjustment",
          entityId: id,
          afterData: { documentNo, approvalRequestId: requestId },
        },
        transaction,
      );
    });
    return this.adjustment(actor, id);
  }

  async withdrawAdjustment(actor: BuyerAdminActor, id: string): Promise<LoyaltyAdjustmentItem> {
    const row = await this.adjustmentRow(this.database, actor, id);
    if (row.created_by !== actor.userId || row.status !== "pending" || !row.approval_request_id) throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE loyalty.adjustments SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.audit.record(
        { actorUserId: actor.userId, companyId: actor.operatorCompanyId, appCode: "crm", action: "loyalty_adjustment.withdraw", entityType: "loyalty_adjustment", entityId: id },
        transaction,
      );
    });
    return this.adjustment(actor, id);
  }

  private async post(transaction: Executor, id: string): Promise<void> {
    const row = (
      await transaction.execute<{ user_id: string; company_id: string; direction: "add" | "subtract"; points: number; point_value: string; phase_id: string; status: string }>(sql`
      SELECT user_id, company_id, direction, points, point_value::text, phase_id, status FROM loyalty.adjustments WHERE id = ${id} FOR UPDATE`)
    ).rows[0];
    if (!row || row.status !== "pending") return;
    const phase = await phaseById(transaction, row.phase_id);
    const entryId = await adjustPoints(transaction, {
      userId: row.user_id,
      direction: row.direction,
      points: row.points,
      adjustmentId: id,
      companyId: row.company_id,
      pointValue: Number(row.point_value),
      validityMonths: phase.validityMonths,
      day: await vietnamToday(transaction),
    });
    await transaction.execute(sql`UPDATE loyalty.adjustments SET status = 'posted', entry_id = ${entryId}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
  }

  // API_181 (QUYTAC_NGHIEPVU_354): 90 ngày gần nhất; chỉ cảnh báo.
  async alerts(actor: BuyerAdminActor, kind: LoyaltyAlertKind): Promise<LoyaltyAlertResponse> {
    type Row = { label: string | null; buyer_ids: string[]; order_count: number; cancelled: number | null; points: number };
    let rows: Row[];
    if (kind === "shared_contact") {
      rows = (
        await this.database.execute<Row>(sql`
        WITH recent AS (
          SELECT m.id, m.buyer_user_id, m.recipient_phone, m.province_code || '|' || m.ward_code || '|' || lower(regexp_replace(trim(m.street_address), '\\s+', ' ', 'g')) AS address_key,
            lower(regexp_replace(trim(m.street_address), '\\s+', ' ', 'g')) || ', ' || m.ward_name || ', ' || m.province_name AS address_label
          FROM marketplace.orders m WHERE m.company_id = ${actor.operatorCompanyId} AND m.created_at >= now() - interval '90 days'
        ), groups AS (
          SELECT 'phone' AS group_kind, recipient_phone AS group_key, min(recipient_phone) AS label FROM recent GROUP BY recipient_phone HAVING count(DISTINCT buyer_user_id) >= 3
          UNION ALL
          SELECT 'address', address_key, min(address_label) FROM recent GROUP BY address_key HAVING count(DISTINCT buyer_user_id) >= 3
        )
        SELECT g.label, array_agg(DISTINCT r.buyer_user_id) AS buyer_ids, count(DISTINCT r.id)::int AS order_count, NULL::int AS cancelled,
          coalesce((SELECT sum(d.earned_points) FROM loyalty.document_points d WHERE d.source_type = 'marketplace_order' AND d.source_id = ANY (array_agg(r.id))), 0)::int AS points
        FROM groups g JOIN recent r ON (g.group_kind = 'phone' AND r.recipient_phone = g.group_key) OR (g.group_kind = 'address' AND r.address_key = g.group_key)
        GROUP BY g.group_kind, g.group_key, g.label ORDER BY count(DISTINCT r.buyer_user_id) DESC, g.label`)
      ).rows;
    } else if (kind === "cancel_return") {
      rows = (
        await this.database.execute<Row>(sql`
        SELECT NULL AS label, ARRAY[m.buyer_user_id] AS buyer_ids, count(*)::int AS order_count,
          count(*) FILTER (WHERE m.status = 'cancelled' OR EXISTS (SELECT 1 FROM marketplace.return_requests r WHERE r.order_id = m.id AND r.status = 'received'))::int AS cancelled,
          coalesce(sum((SELECT d.earned_points FROM loyalty.document_points d WHERE d.source_type = 'marketplace_order' AND d.source_id = m.id)), 0)::int AS points
        FROM marketplace.orders m WHERE m.company_id = ${actor.operatorCompanyId} AND m.created_at >= now() - interval '90 days'
        GROUP BY m.buyer_user_id
        HAVING count(*) >= 5 AND count(*) FILTER (WHERE m.status = 'cancelled' OR EXISTS (SELECT 1 FROM marketplace.return_requests r WHERE r.order_id = m.id AND r.status = 'received')) * 2 >= count(*)
        ORDER BY cancelled DESC`)
      ).rows;
    } else {
      rows = (
        await this.database.execute<Row>(sql`
        SELECT to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS label, ARRAY[e.user_id] AS buyer_ids, count(DISTINCT e.source_id)::int AS order_count,
          NULL::int AS cancelled, (-sum(e.points))::int AS points
        FROM loyalty.entries e WHERE e.kind = 'redeem' AND e.created_at >= now() - interval '90 days'
        GROUP BY e.user_id, to_char(e.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') HAVING count(DISTINCT e.source_id) >= 5
        ORDER BY label DESC`)
      ).rows;
    }
    const ids = [...new Set(rows.flatMap((row) => row.buyer_ids))];
    const people = new Map<string, { userId: string; fullName: string; phone: string }>();
    if (ids.length > 0) {
      const found = await this.database.execute<{ id: string; full_name: string; phone: string | null }>(sql`
        SELECT id, full_name, phone FROM core.users WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`);
      for (const person of found.rows) people.set(person.id, { userId: person.id, fullName: person.full_name, phone: localPhone(person.phone ?? "") });
    }
    return {
      kind,
      items: rows.map((row) => ({
        label: row.label,
        buyers: row.buyer_ids.map((id) => people.get(id)!).filter(Boolean),
        orderCount: row.order_count,
        cancelledOrReturned: row.cancelled,
        points: row.points,
      })),
    };
  }
}
