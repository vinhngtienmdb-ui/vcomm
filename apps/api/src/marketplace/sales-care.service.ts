// Ghi chú chăm sóc khách, hẹn trên ứng dụng VComm (CONG_VIEC_22; CHUC_NANG_205; API_229, API_230; QUYTAC_NGHIEPVU_432, 435, 436).
import { Inject, Injectable } from "@nestjs/common";
import type { CareNoteChannel, CareNoteItem, createCareNoteSchema, FollowUpItem, FollowUpsResponse } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { messages } from "i18n";
import { notify } from "../common/notifications";
import { fillTemplate } from "../hr/recruitment-emails";
import { DATABASE, type Database } from "../database/database.module";
import type { ClientInfo } from "../auth/auth.service";
import { localPhone } from "./local-phone";
import { SalesTeamService, type SalesTeam } from "./sales-team.service";

export const careNotePageSize = 20;
const followUpMaximumDays = 365;
const upcomingDays = 7;

type NoteRow = {
  id: string;
  channel: CareNoteChannel;
  content: string;
  follow_up_on: string | null;
  follow_up_done_at: Date | null;
  author_user_id: string;
  author_name: string;
  created_at: Date;
};

const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const noteItem = (row: NoteRow): CareNoteItem => ({
  id: row.id,
  channel: row.channel,
  content: row.content,
  followUpOn: row.follow_up_on,
  followUpDoneAt: row.follow_up_done_at ? new Date(row.follow_up_done_at).toISOString() : null,
  authorUserId: row.author_user_id,
  authorName: row.author_name,
  createdAt: new Date(row.created_at).toISOString(),
});

@Injectable()
export class SalesCareService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly salesTeam: SalesTeamService,
    private readonly audit: AuditService,
  ) {}

  // Đội của người gọi; không được đánh dấu nhân viên kinh doanh thì 403 (QUYTAC_NGHIEPVU_432).
  async teamOf(userId: string): Promise<{ team: SalesTeam; companyId: string }> {
    const row = (await this.database.execute<{ sales_company_id: string | null }>(sql`SELECT sales_company_id FROM marketplace.buyer_accounts WHERE user_id = ${userId} AND is_sales_staff`)).rows[0];
    if (!row?.sales_company_id) throw new ApiError("FORBIDDEN", "forbidden");
    return { team: await this.salesTeam.load(this.database, row.sales_company_id), companyId: row.sales_company_id };
  }

  // Người phụ trách khách xem được bởi người gọi: chính mình hoặc người trong nhánh (QUYTAC_NGHIEPVU_432).
  canSee(team: SalesTeam, userId: string, ownerId: string | null): boolean {
    if (!ownerId || !team.member(ownerId)) return false;
    return ownerId === userId || team.branch(userId).some((member) => member.userId === ownerId);
  }

  private async requireCustomer(team: SalesTeam, userId: string, customerId: string): Promise<void> {
    const row = (await this.database.execute<{ referrer_user_id: string | null }>(sql`SELECT referrer_user_id FROM marketplace.buyer_accounts WHERE user_id = ${customerId}`)).rows[0];
    if (!row || !this.canSee(team, userId, row.referrer_user_id)) throw new ApiError("NOT_FOUND", "notFound");
  }

  // Ghi chú của khách, mới nhất trước; gọi sau khi đã kiểm phạm vi.
  async notesOf(customerId: string, page: number): Promise<{ notes: CareNoteItem[]; hasMore: boolean }> {
    const rows = await this.database.execute<NoteRow>(sql`
      SELECT n.id, n.channel, n.content, n.follow_up_on::text, n.follow_up_done_at, n.author_user_id, u.full_name AS author_name, n.created_at
      FROM marketplace.customer_care_notes n JOIN core.users u ON u.id = n.author_user_id
      WHERE n.buyer_user_id = ${customerId} ORDER BY n.created_at DESC, n.id DESC
      LIMIT ${careNotePageSize + 1} OFFSET ${(page - 1) * careNotePageSize}`);
    return { notes: rows.rows.slice(0, careNotePageSize).map(noteItem), hasMore: rows.rows.length > careNotePageSize };
  }

  async list(userId: string, customerId: string, page: number): Promise<{ notes: CareNoteItem[]; hasMore: boolean }> {
    const { team } = await this.teamOf(userId);
    await this.requireCustomer(team, userId, customerId);
    return this.notesOf(customerId, page);
  }

  // API_229: thêm ghi chú (QUYTAC_NGHIEPVU_435). Nhật ký thao tác không chứa nội dung ghi chú (dữ liệu cá nhân).
  async create(userId: string, customerId: string, input: z.output<typeof createCareNoteSchema>, client: ClientInfo): Promise<CareNoteItem> {
    const { team, companyId } = await this.teamOf(userId);
    await this.requireCustomer(team, userId, customerId);
    const today = vietnamDate(this.clock.now());
    const followUpOn = input.followUpOn ?? null;
    if (followUpOn && (followUpOn < today || followUpOn > addDays(today, followUpMaximumDays))) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { followUpOn: "followUpDateRange" } });
    }
    return this.database.transaction(async (transaction) => {
      const created = (
        await transaction.execute<{ id: string }>(sql`
          INSERT INTO marketplace.customer_care_notes (company_id, buyer_user_id, author_user_id, channel, content, follow_up_on, created_at)
          VALUES (${companyId}, ${customerId}, ${userId}, ${input.channel}, ${input.content}, ${followUpOn}, ${this.clock.now()}) RETURNING id`)
      ).rows[0]!;
      await this.audit.record(
        {
          actorUserId: userId,
          companyId,
          appCode: "marketplace",
          action: "sales.care_note.create",
          entityType: "marketplace.customer_care_notes",
          entityId: created.id,
          afterData: { buyerUserId: customerId, channel: input.channel, followUpOn },
          ip: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        },
        transaction,
      );
      const row = (
        await transaction.execute<NoteRow>(sql`
          SELECT n.id, n.channel, n.content, n.follow_up_on::text, n.follow_up_done_at, n.author_user_id, u.full_name AS author_name, n.created_at
          FROM marketplace.customer_care_notes n JOIN core.users u ON u.id = n.author_user_id WHERE n.id = ${created.id}`)
      ).rows[0]!;
      return noteItem(row);
    });
  }

  // Hẹn chờ của người gọi còn xem được khách (QUYTAC_NGHIEPVU_436): quá hạn, hôm nay, 7 ngày tới.
  async pendingFollowUps(userId: string, team: SalesTeam, until: string): Promise<(FollowUpItem & { ownerId: string | null })[]> {
    const rows = await this.database.execute<{
      id: string;
      buyer_user_id: string;
      full_name: string;
      phone: string | null;
      referrer_user_id: string | null;
      channel: CareNoteChannel;
      content: string;
      follow_up_on: string;
    }>(sql`
      SELECT n.id, n.buyer_user_id, u.full_name, u.phone, b.referrer_user_id, n.channel, n.content, n.follow_up_on::text
      FROM marketplace.customer_care_notes n JOIN marketplace.buyer_accounts b ON b.user_id = n.buyer_user_id JOIN core.users u ON u.id = n.buyer_user_id
      WHERE n.author_user_id = ${userId} AND n.follow_up_on IS NOT NULL AND n.follow_up_done_at IS NULL AND n.follow_up_on <= ${until}::date
      ORDER BY n.follow_up_on, n.created_at, n.id`);
    return rows.rows
      .filter((row) => this.canSee(team, userId, row.referrer_user_id))
      .map((row) => ({
        noteId: row.id,
        customerId: row.buyer_user_id,
        customerName: row.full_name,
        customerPhone: localPhone(row.phone ?? ""),
        channel: row.channel,
        content: row.content,
        followUpOn: row.follow_up_on,
        ownerId: row.referrer_user_id,
      }));
  }

  // API_230: hẹn của tôi.
  async followUps(userId: string): Promise<FollowUpsResponse> {
    const { team } = await this.teamOf(userId);
    const today = vietnamDate(this.clock.now());
    const items = (await this.pendingFollowUps(userId, team, addDays(today, upcomingDays))).map(({ ownerId: _ownerId, ...item }) => item);
    return {
      today,
      overdue: items.filter((item) => item.followUpOn < today),
      dueToday: items.filter((item) => item.followUpOn === today),
      upcoming: items.filter((item) => item.followUpOn > today),
    };
  }

  // API_230: đánh dấu hẹn đã xong, chỉ người ghi, khách còn trong phạm vi; đã xong thì 409.
  async markDone(userId: string, noteId: string, client: ClientInfo): Promise<CareNoteItem> {
    const { team, companyId } = await this.teamOf(userId);
    const note = (
      await this.database.execute<{ buyer_user_id: string; referrer_user_id: string | null; follow_up_on: string | null; follow_up_done_at: Date | null }>(sql`
        SELECT n.buyer_user_id, b.referrer_user_id, n.follow_up_on::text, n.follow_up_done_at
        FROM marketplace.customer_care_notes n JOIN marketplace.buyer_accounts b ON b.user_id = n.buyer_user_id
        WHERE n.id = ${noteId} AND n.author_user_id = ${userId}`)
    ).rows[0];
    if (!note || !note.follow_up_on || !this.canSee(team, userId, note.referrer_user_id)) throw new ApiError("NOT_FOUND", "notFound");
    return this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE marketplace.customer_care_notes SET follow_up_done_at = ${this.clock.now()} WHERE id = ${noteId} AND follow_up_done_at IS NULL RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("BUSINESS_RULE", "followUpAlreadyDone");
      await this.audit.record(
        {
          actorUserId: userId,
          companyId,
          appCode: "marketplace",
          action: "sales.follow_up.done",
          entityType: "marketplace.customer_care_notes",
          entityId: noteId,
          afterData: { buyerUserId: note.buyer_user_id },
          ip: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        },
        transaction,
      );
      const row = (
        await transaction.execute<NoteRow>(sql`
          SELECT n.id, n.channel, n.content, n.follow_up_on::text, n.follow_up_done_at, n.author_user_id, u.full_name AS author_name, n.created_at
          FROM marketplace.customer_care_notes n JOIN core.users u ON u.id = n.author_user_id WHERE n.id = ${noteId}`)
      ).rows[0]!;
      return noteItem(row);
    });
  }

  // Nhắc hẹn lúc 07:00 (QUYTAC_NGHIEPVU_437): mỗi người có hẹn chờ đến hạn hoặc quá hạn, còn được đánh dấu, còn xem được khách
  // nhận tối đa một thông báo trong ứng dụng mỗi ngày; chạy lại trong ngày không tạo trùng. Không gửi thư, tin nhắn, thông báo đẩy.
  async remindDue(): Promise<{ notified: number }> {
    const today = vietnamDate(this.clock.now());
    const rows = await this.database.execute<{ author_user_id: string; sales_company_id: string; referrer_user_id: string | null; follow_up_on: string }>(sql`
      SELECT n.author_user_id, a.sales_company_id, b.referrer_user_id, n.follow_up_on::text
      FROM marketplace.customer_care_notes n
        JOIN marketplace.buyer_accounts b ON b.user_id = n.buyer_user_id
        JOIN marketplace.buyer_accounts a ON a.user_id = n.author_user_id AND a.is_sales_staff
      WHERE n.follow_up_on IS NOT NULL AND n.follow_up_done_at IS NULL AND n.follow_up_on <= ${today}::date`);
    const teams = new Map<string, SalesTeam>();
    const counts = new Map<string, { companyId: string; dueToday: number; overdue: number }>();
    for (const row of rows.rows) {
      let team = teams.get(row.sales_company_id);
      if (!team) {
        team = await this.salesTeam.load(this.database, row.sales_company_id);
        teams.set(row.sales_company_id, team);
      }
      if (!this.canSee(team, row.author_user_id, row.referrer_user_id)) continue;
      const entry = counts.get(row.author_user_id) ?? { companyId: row.sales_company_id, dueToday: 0, overdue: 0 };
      if (row.follow_up_on === today) entry.dueToday += 1;
      else entry.overdue += 1;
      counts.set(row.author_user_id, entry);
    }
    let notified = 0;
    for (const [userId, entry] of counts) {
      const created = await this.database.transaction(async (transaction) => {
        // Khóa theo người và ngày để hai lần chạy cùng lúc không tạo trùng.
        await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`sales-follow-up:${userId}:${today}`}))`);
        const exists = await transaction.execute(sql`
          SELECT 1 FROM core.notifications WHERE user_id = ${userId} AND kind = 'sales.follow_up_due' AND payload->>'date' = ${today}`);
        if (exists.rows.length > 0) return false;
        await notify(transaction, [
          {
            userId,
            companyId: entry.companyId,
            kind: "sales.follow_up_due",
            title: fillTemplate(messages.vi.salesNotifications.followUpDue, { today: String(entry.dueToday), overdue: String(entry.overdue) }),
            link: "/hen",
            payload: { date: today, dueToday: entry.dueToday, overdue: entry.overdue },
          },
        ]);
        return true;
      });
      if (created) notified += 1;
    }
    return { notified };
  }
}
