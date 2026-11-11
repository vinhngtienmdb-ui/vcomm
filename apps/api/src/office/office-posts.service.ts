// Bảng tin nội bộ (CHUC_NANG_185; QUYTAC_NGHIEPVU_367; API_191).
import { Inject, Injectable } from "@nestjs/common";
import {
  postMaximumPinned,
  type OfficeFileItem,
  type OfficeTaskComment,
  type PageResponse,
  type PostAudienceType,
  type PostListItem,
  type PostOptions,
  type PostReader,
  type PostResponse,
  type PostState,
  type SavePostInput,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import type { postListQuerySchema } from "contracts";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { groupRootOf, peopleById } from "./office-access";
import { checkOfficeFile } from "./office-tasks.service";

type Executor = Pick<Database, "execute">;
type PostListQuery = z.infer<typeof postListQuerySchema>;

type PostRow = {
  id: string;
  company_id: string;
  company_name: string;
  group_company_id: string;
  title: string;
  body: string;
  audience_type: PostAudienceType;
  pinned: boolean;
  publish_at: Date | string;
  expires_at: Date | string | null;
  requires_acknowledgement: boolean;
  allow_comments: boolean;
  status: "active" | "revoked";
  created_by: string;
  edited_at: Date | string | null;
  version: number;
  read_at: Date | string | null;
  acknowledged_at: Date | string | null;
  comment_count: number;
  file_count: number;
};

const isoOrNull = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString());

// Đoạn trích cho danh sách: bỏ ký hiệu đánh dấu, tối đa 200 ký tự.
const excerptOf = (body: string) => {
  const plain = body
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|\*/g, "")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > 200 ? `${plain.slice(0, 199)}…` : plain;
};

@Injectable()
export class OfficePostsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  private audit(actor: Actor) {
    return {
      actorUserId: actor.userId,
      companyId: actor.companyId,
      appCode: "office",
      entityType: "office_post",
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    };
  }

  private now(): string {
    return this.clock.now().toISOString();
  }

  // Quyền đăng ở công ty đang chọn (phạm vi tập đoàn hoặc công ty; quyền ở chi nhánh không dùng) và ở phạm vi tập đoàn.
  private async posting(actor: Actor): Promise<{ canPost: boolean; canPostGroup: boolean }> {
    const company = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId });
    const group = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" });
    return { canPost: company.has("office.bulletin.post"), canPostGroup: group.has("office.bulletin.post") };
  }

  // Người nhận tin tại thời điểm xem: thành viên đang hoạt động thuộc đối tượng (QUYTAC_NGHIEPVU_367).
  private recipientCondition(userColumn: SQL, companyColumn: SQL): SQL {
    return sql`EXISTS (
      SELECT 1 FROM core.user_company_memberships rm JOIN core.users u ON u.id = rm.user_id AND u.status = 'active'
      JOIN core.companies mc ON mc.id = rm.company_id AND mc.status = 'active'
      WHERE rm.user_id = ${userColumn} AND rm.status = 'active'
        AND (
          (p.audience_type = 'company' AND rm.company_id = p.company_id)
          OR (p.audience_type = 'units' AND rm.company_id = p.company_id AND EXISTS (
            SELECT 1 FROM office.post_audiences a WHERE a.post_id = p.id
              AND ((a.kind = 'branch' AND a.target_id = rm.default_branch_id) OR (a.kind = 'department' AND a.target_id = rm.department_id))))
          OR (p.audience_type = 'group' AND rm.company_id = ${companyColumn} AND p.group_company_id = (
            WITH RECURSIVE chain AS (
              SELECT id, parent_id FROM core.companies WHERE id = rm.company_id
              UNION ALL SELECT c.id, c.parent_id FROM core.companies c JOIN chain ON c.id = chain.parent_id)
            SELECT id FROM chain WHERE parent_id IS NULL LIMIT 1))
        ))`;
  }

  private publishedCondition(now: string): SQL {
    return sql`p.status = 'active' AND p.publish_at <= ${now}::timestamptz AND (p.expires_at IS NULL OR p.expires_at > ${now}::timestamptz)`;
  }

  // Tin người dùng nhận ở công ty đang chọn: tin của công ty hoặc tin toàn tập đoàn của tập đoàn.
  private feedCondition(actor: Actor, now: string): SQL {
    return sql`${this.publishedCondition(now)} AND (p.company_id = ${actor.companyId} OR p.audience_type = 'group')
      AND ${this.recipientCondition(sql`${actor.userId}::uuid`, sql`${actor.companyId}::uuid`)}`;
  }

  private columns(actor: Actor): SQL {
    return sql`p.id, p.company_id, c.short_name AS company_name, p.group_company_id, p.title, p.body, p.audience_type, p.pinned, p.publish_at, p.expires_at,
      p.requires_acknowledgement, p.allow_comments, p.status, p.created_by, p.edited_at, p.version, r.read_at, r.acknowledged_at,
      (SELECT count(*)::int FROM office.post_comments pc WHERE pc.post_id = p.id AND pc.deleted_at IS NULL) AS comment_count,
      (SELECT count(*)::int FROM office.files f WHERE f.owner_type = 'post' AND f.owner_id = p.id AND f.deleted_at IS NULL) AS file_count`;
  }

  private from(actor: Actor): SQL {
    return sql`office.posts p JOIN core.companies c ON c.id = p.company_id
      LEFT JOIN office.post_reads r ON r.post_id = p.id AND r.user_id = ${actor.userId}`;
  }

  private state(row: Pick<PostRow, "status" | "publish_at" | "expires_at">, now: string): PostState {
    if (row.status === "revoked") return "revoked";
    if (new Date(row.publish_at).toISOString() > now) return "scheduled";
    if (row.expires_at && new Date(row.expires_at).toISOString() <= now) return "expired";
    return "published";
  }

  private async audienceText(rows: PostRow[]): Promise<Map<string, string>> {
    const ids = rows.filter((row) => row.audience_type === "units").map((row) => row.id);
    const names = new Map<string, string[]>();
    if (ids.length > 0) {
      const targets = (
        await this.database.execute<{ post_id: string; name: string }>(sql`
          SELECT a.post_id, coalesce(b.name, d.name) AS name FROM office.post_audiences a
          LEFT JOIN core.branches b ON a.kind = 'branch' AND b.id = a.target_id
          LEFT JOIN core.departments d ON a.kind = 'department' AND d.id = a.target_id
          WHERE a.post_id IN (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )}) ORDER BY 2`)
      ).rows;
      for (const target of targets) names.set(target.post_id, [...(names.get(target.post_id) ?? []), target.name]);
    }
    return new Map(rows.map((row) => [row.id, row.audience_type === "company" ? `Toàn ${row.company_name}` : row.audience_type === "group" ? "Toàn tập đoàn" : (names.get(row.id) ?? []).join(", ")]));
  }

  private async items(actor: Actor, rows: PostRow[]): Promise<PostListItem[]> {
    const now = this.now();
    const people = await peopleById(
      this.database,
      rows.map((row) => row.created_by),
      actor.companyId,
    );
    const audiences = await this.audienceText(rows);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      excerpt: excerptOf(row.body),
      author: people.get(row.created_by)!,
      companyName: row.company_name,
      audienceType: row.audience_type,
      audienceText: audiences.get(row.id) ?? "",
      pinned: row.pinned,
      publishAt: isoOrNull(row.publish_at)!,
      expiresAt: isoOrNull(row.expires_at),
      requiresAcknowledgement: row.requires_acknowledgement,
      state: this.state(row, now),
      isRead: row.read_at !== null,
      acknowledgedAt: isoOrNull(row.acknowledged_at),
      commentCount: row.comment_count,
      fileCount: row.file_count,
    }));
  }

  async options(actor: Actor): Promise<PostOptions> {
    const { canPost, canPostGroup } = await this.posting(actor);
    const branches = (await this.database.execute<{ id: string; name: string }>(sql`SELECT id, name FROM core.branches WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`))
      .rows;
    const departments = (
      await this.database.execute<{ id: string; name: string }>(sql`SELECT id, name FROM core.departments WHERE company_id = ${actor.companyId} AND status = 'active' ORDER BY name`)
    ).rows;
    return { branches, departments, canPost, canPostGroup, pinnedCount: await this.pinnedCount(this.database, actor.companyId, null) };
  }

  // Tin ghim đang hiệu lực của công ty (chưa thu hồi, chưa hết hạn), trừ tin đang sửa.
  private async pinnedCount(executor: Executor, companyId: string, exceptId: string | null): Promise<number> {
    const now = this.now();
    const result = await executor.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM office.posts p WHERE p.company_id = ${companyId} AND p.pinned AND p.status = 'active'
        AND (p.expires_at IS NULL OR p.expires_at > ${now}::timestamptz) ${exceptId ? sql`AND p.id <> ${exceptId}` : sql``}`);
    return result.rows[0]!.count;
  }

  async list(actor: Actor, query: PostListQuery): Promise<PageResponse<PostListItem>> {
    const now = this.now();
    let condition: SQL;
    if (query.view === "manage") {
      const { canPost } = await this.posting(actor);
      condition = canPost ? sql`p.company_id = ${actor.companyId}` : sql`p.company_id = ${actor.companyId} AND p.created_by = ${actor.userId}`;
    } else condition = this.feedCondition(actor, now);
    const conditions = [condition];
    if (query.unread === "true") conditions.push(sql`r.read_at IS NULL`);
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
      conditions.push(sql`(p.title ILIKE ${pattern} OR p.body ILIKE ${pattern})`);
    }
    const where = sql.join(conditions, sql` AND `);
    // Tin ghim còn hiệu lực lên đầu, rồi mới nhất trước.
    const order = sql`(p.pinned AND p.status = 'active' AND (p.expires_at IS NULL OR p.expires_at > ${now}::timestamptz)) DESC, p.publish_at DESC, p.id`;
    const total = (await this.database.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM ${this.from(actor)} WHERE ${where}`)).rows[0]!.count;
    const rows = (
      await this.database.execute<PostRow>(sql`
        SELECT ${this.columns(actor)} FROM ${this.from(actor)} WHERE ${where} ORDER BY ${order}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`)
    ).rows;
    return { data: await this.items(actor, rows), page: query.page, pageSize: query.pageSize, total };
  }

  // Xem được: người nhận khi tin đang hiển thị; người đăng; người có quyền đăng cùng phạm vi.
  private async loadVisible(executor: Executor, actor: Actor, id: string, lock = false): Promise<{ row: PostRow; isRecipient: boolean; isAuthor: boolean; canManage: boolean }> {
    const now = this.now();
    const row = (
      await executor.execute<PostRow & { is_recipient: boolean }>(sql`
        SELECT ${this.columns(actor)}, (${this.feedCondition(actor, now)}) AS is_recipient
        FROM ${this.from(actor)} WHERE p.id = ${id} ${lock ? sql`FOR UPDATE OF p` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const isAuthor = row.created_by === actor.userId;
    const { canPost, canPostGroup } = await this.posting(actor);
    const canManage =
      isAuthor || (row.audience_type === "group" ? canPostGroup && row.group_company_id === (await groupRootOf(executor, actor.companyId)) : canPost && row.company_id === actor.companyId);
    if (!row.is_recipient && !canManage) throw new ApiError("NOT_FOUND", "notFound");
    return { row, isRecipient: row.is_recipient, isAuthor, canManage };
  }

  async detail(actor: Actor, id: string): Promise<PostResponse> {
    const loaded = await this.loadVisible(this.database, actor, id);
    // Người nhận mở tin lần đầu: ghi đã đọc.
    if (loaded.isRecipient && !loaded.isAuthor && loaded.row.read_at === null) {
      await this.database.execute(sql`INSERT INTO office.post_reads (post_id, user_id) VALUES (${id}, ${actor.userId}) ON CONFLICT DO NOTHING`);
      loaded.row.read_at = this.now();
    }
    return this.response(actor, loaded);
  }

  private async response(actor: Actor, loaded: Awaited<ReturnType<OfficePostsService["loadVisible"]>>): Promise<PostResponse> {
    const { row, isRecipient, isAuthor, canManage } = loaded;
    const [item] = await this.items(actor, [row]);
    const audience = (await this.database.execute<{ kind: string; target_id: string }>(sql`SELECT kind, target_id FROM office.post_audiences WHERE post_id = ${row.id}`)).rows;
    const active = row.status === "active";
    const actions: PostResponse["allowedActions"] = [];
    if (isAuthor && active) actions.push("edit", "revoke", "upload");
    if (isRecipient && !isAuthor && row.requires_acknowledgement && row.acknowledged_at === null) actions.push("acknowledge");
    if (row.allow_comments && active && (isRecipient || canManage)) actions.push("comment");
    if (canManage) actions.push("view_readers");
    return {
      ...item!,
      body: row.body,
      branchIds: audience.filter((target) => target.kind === "branch").map((target) => target.target_id),
      departmentIds: audience.filter((target) => target.kind === "department").map((target) => target.target_id),
      allowComments: row.allow_comments,
      editedAt: isoOrNull(row.edited_at),
      files: await this.fileItems(actor, row.id, isAuthor && active),
      comments: await this.commentItems(actor, row.id, isAuthor),
      readStats: canManage ? await this.readStats(row.id) : null,
      allowedActions: actions,
      version: row.version,
    };
  }

  // Người nhận hiện tại của tin (trừ người đăng): dùng cho thống kê đọc và thông báo.
  private async recipientIds(executor: Executor, postId: string): Promise<string[]> {
    const result = await executor.execute<{ id: string }>(sql`
      SELECT DISTINCT m.user_id AS id FROM office.posts p
      JOIN core.user_company_memberships m ON m.status = 'active'
      WHERE p.id = ${postId} AND m.user_id <> p.created_by AND ${this.recipientCondition(sql`m.user_id`, sql`m.company_id`)}`);
    return result.rows.map((row) => row.id);
  }

  private async readStats(postId: string): Promise<PostResponse["readStats"]> {
    const recipients = await this.recipientIds(this.database, postId);
    if (recipients.length === 0) return { recipients: 0, read: 0, acknowledged: 0 };
    const result = await this.database.execute<{ read: number; acknowledged: number }>(sql`
      SELECT count(*)::int AS read, count(acknowledged_at)::int AS acknowledged FROM office.post_reads
      WHERE post_id = ${postId} AND user_id IN (${sql.join(
        recipients.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`);
    return { recipients: recipients.length, read: result.rows[0]!.read, acknowledged: result.rows[0]!.acknowledged };
  }

  async readers(actor: Actor, id: string): Promise<PostReader[]> {
    const loaded = await this.loadVisible(this.database, actor, id);
    if (!loaded.canManage) throw new ApiError("FORBIDDEN", "forbidden");
    const recipients = await this.recipientIds(this.database, id);
    const reads = new Map(
      (
        await this.database.execute<{ user_id: string; read_at: Date; acknowledged_at: Date | null }>(sql`SELECT user_id, read_at, acknowledged_at FROM office.post_reads WHERE post_id = ${id}`)
      ).rows.map((read) => [read.user_id, read]),
    );
    const people = await peopleById(this.database, recipients, actor.companyId);
    return recipients
      .map((userId) => ({ person: people.get(userId)!, readAt: isoOrNull(reads.get(userId)?.read_at ?? null), acknowledgedAt: isoOrNull(reads.get(userId)?.acknowledged_at ?? null) }))
      .sort((first, second) => Number(first.readAt !== null) - Number(second.readAt !== null) || first.person.fullName.localeCompare(second.person.fullName, "vi"));
  }

  // Kiểm tra đối tượng, thời điểm, giới hạn ghim khi đăng hoặc sửa.
  private async checkInput(executor: Executor, actor: Actor, input: SavePostInput, publishAt: string, exceptId: string | null): Promise<void> {
    const { canPost, canPostGroup } = await this.posting(actor);
    if (!canPost && !canPostGroup) throw new ApiError("FORBIDDEN", "forbidden");
    if (input.audienceType === "group" && !canPostGroup) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { audienceType: "officePostGroupForbidden" } });
    if (input.audienceType !== "group" && !canPost) throw new ApiError("FORBIDDEN", "forbidden");
    if (input.audienceType === "units") {
      if (input.branchIds.length + input.departmentIds.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { audienceType: "officePostAudienceRequired" } });
      const valid = (
        await executor.execute<{ count: number }>(sql`
          SELECT (SELECT count(*)::int FROM core.branches WHERE company_id = ${actor.companyId} AND id = ANY(${`{${input.branchIds.join(",")}}`}::uuid[]))
               + (SELECT count(*)::int FROM core.departments WHERE company_id = ${actor.companyId} AND id = ANY(${`{${input.departmentIds.join(",")}}`}::uuid[])) AS count`)
      ).rows[0]!.count;
      if (valid !== new Set(input.branchIds).size + new Set(input.departmentIds).size)
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { audienceType: "officePostAudienceRequired" } });
    }
    if (input.expiresAt && new Date(input.expiresAt).toISOString() <= publishAt) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { expiresAt: "officePostExpiryInvalid" } });
    if (input.pinned && (await this.pinnedCount(executor, actor.companyId, exceptId)) >= postMaximumPinned) throw new ApiError("BUSINESS_RULE", "officePostPinLimit");
  }

  private async writeAudience(executor: Executor, postId: string, input: SavePostInput): Promise<void> {
    await executor.execute(sql`DELETE FROM office.post_audiences WHERE post_id = ${postId}`);
    if (input.audienceType !== "units") return;
    for (const branchId of new Set(input.branchIds)) await executor.execute(sql`INSERT INTO office.post_audiences (post_id, kind, target_id) VALUES (${postId}, 'branch', ${branchId})`);
    for (const departmentId of new Set(input.departmentIds))
      await executor.execute(sql`INSERT INTO office.post_audiences (post_id, kind, target_id) VALUES (${postId}, 'department', ${departmentId})`);
  }

  async create(actor: Actor, input: SavePostInput): Promise<PostResponse> {
    const now = this.now();
    const publishAt = input.publishAt ? new Date(input.publishAt).toISOString() : now;
    const id = await this.database.transaction(async (transaction) => {
      await this.checkInput(transaction, actor, input, publishAt, null);
      const groupCompanyId = await groupRootOf(transaction, actor.companyId);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO office.posts (company_id, group_company_id, title, body, audience_type, pinned, publish_at, expires_at, requires_acknowledgement, allow_comments, created_by)
        VALUES (${actor.companyId}, ${groupCompanyId}, ${input.title}, ${input.body}, ${input.audienceType}, ${input.pinned}, ${publishAt}, ${input.expiresAt ?? null},
          ${input.requiresAcknowledgement}, ${input.allowComments}, ${actor.userId}) RETURNING id`);
      const postId = inserted.rows[0]!.id;
      await this.writeAudience(transaction, postId, input);
      await this.auditService.record(
        { ...this.audit(actor), action: "office.post.create", entityId: postId, afterData: { title: input.title, audienceType: input.audienceType, publishAt } },
        transaction,
      );
      return postId;
    });
    // Tin đăng ngay cần xác nhận đọc: gửi thông báo luôn, không đợi việc nền.
    await this.publishDue();
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: SavePostInput): Promise<PostResponse> {
    await this.database.transaction(async (transaction) => {
      const { row, isAuthor } = await this.loadVisible(transaction, actor, id, true);
      if (!isAuthor) throw new ApiError("FORBIDDEN", "forbidden");
      if (row.status === "revoked") throw new ApiError("BUSINESS_RULE", "officePostRevoked");
      if (input.version !== undefined && input.version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const now = this.now();
      const published = new Date(row.publish_at).toISOString() <= now;
      // Tin đã đăng giữ thời điểm đăng; tin hẹn giờ đổi được giờ đăng.
      const publishAt = published ? new Date(row.publish_at).toISOString() : input.publishAt ? new Date(input.publishAt).toISOString() : now;
      await this.checkInput(transaction, actor, input, publishAt, id);
      await transaction.execute(sql`
        UPDATE office.posts SET title = ${input.title}, body = ${input.body}, audience_type = ${input.audienceType}, pinned = ${input.pinned}, publish_at = ${publishAt},
          expires_at = ${input.expiresAt ?? null}, requires_acknowledgement = ${input.requiresAcknowledgement}, allow_comments = ${input.allowComments},
          edited_at = ${published ? sql`now()` : sql`edited_at`}, version = version + 1
        WHERE id = ${id}`);
      await this.writeAudience(transaction, id, input);
      await this.auditService.record(
        { ...this.audit(actor), action: "office.post.update", entityId: id, beforeData: { title: row.title }, afterData: { title: input.title, audienceType: input.audienceType } },
        transaction,
      );
    });
    await this.publishDue();
    return this.detail(actor, id);
  }

  async revoke(actor: Actor, id: string, version: number): Promise<PostResponse> {
    await this.database.transaction(async (transaction) => {
      const { row, isAuthor } = await this.loadVisible(transaction, actor, id, true);
      if (!isAuthor) throw new ApiError("FORBIDDEN", "forbidden");
      if (row.status === "revoked") throw new ApiError("BUSINESS_RULE", "officePostRevoked");
      if (version !== row.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`UPDATE office.posts SET status = 'revoked', revoked_at = now(), revoked_by = ${actor.userId}, pinned = false, version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...this.audit(actor), action: "office.post.revoke", entityId: id, beforeData: { title: row.title } }, transaction);
    });
    return this.detail(actor, id);
  }

  async acknowledge(actor: Actor, id: string): Promise<PostResponse> {
    const loaded = await this.loadVisible(this.database, actor, id);
    if (!loaded.isRecipient || loaded.isAuthor || !loaded.row.requires_acknowledgement) throw new ApiError("BUSINESS_RULE", "officePostNotAcknowledgeable");
    await this.database.execute(sql`
      INSERT INTO office.post_reads (post_id, user_id, acknowledged_at) VALUES (${id}, ${actor.userId}, now())
      ON CONFLICT (post_id, user_id) DO UPDATE SET acknowledged_at = coalesce(office.post_reads.acknowledged_at, now())`);
    return this.detail(actor, id);
  }

  // Việc nền mỗi phút: tin cần xác nhận đọc đến giờ đăng thì thông báo người nhận, mỗi tin một lần.
  async publishDue(): Promise<{ notified: number }> {
    const now = this.now();
    return this.database.transaction(async (transaction) => {
      const due = (
        await transaction.execute<{ id: string; company_id: string; title: string }>(sql`
          SELECT id, company_id, title FROM office.posts
          WHERE requires_acknowledgement AND notified_at IS NULL AND status = 'active' AND publish_at <= ${now}::timestamptz
            AND (expires_at IS NULL OR expires_at > ${now}::timestamptz)
          ORDER BY publish_at FOR UPDATE SKIP LOCKED LIMIT 50`)
      ).rows;
      for (const post of due) {
        const recipients = await this.recipientIds(transaction, post.id);
        // Tin toàn tập đoàn: thông báo gắn công ty thành viên mặc định của người nhận để mở đúng công ty.
        const companies = new Map(
          (
            await transaction.execute<{ user_id: string; company_id: string }>(sql`
              SELECT DISTINCT ON (m.user_id) m.user_id, m.company_id FROM core.user_company_memberships m JOIN office.posts p ON p.id = ${post.id}
              WHERE m.status = 'active' AND m.user_id = ANY(${`{${recipients.join(",")}}`}::uuid[])
              ORDER BY m.user_id, (m.company_id = p.company_id) DESC, m.is_default DESC`)
          ).rows.map((item) => [item.user_id, item.company_id]),
        );
        await notify(
          transaction,
          recipients.map((userId) => ({
            userId,
            companyId: companies.get(userId) ?? post.company_id,
            kind: "office_post",
            title: `Tin cần xác nhận đã đọc: ${post.title}`,
            link: `/office/bulletin/${post.id}`,
            payload: { postId: post.id },
          })),
        );
        await transaction.execute(sql`UPDATE office.posts SET notified_at = now() WHERE id = ${post.id}`);
      }
      return { notified: due.length };
    });
  }

  // Bình luận (như QUYTAC_NGHIEPVU_359); người đăng tin xóa được bình luận bất kỳ.
  private async commentItems(actor: Actor, postId: string, isAuthor: boolean): Promise<OfficeTaskComment[]> {
    const rows = (
      await this.database.execute<{ id: string; author_id: string; body: string; created_at: Date; edited_at: Date | null; deleted_at: Date | null }>(sql`
        SELECT id, author_id, body, created_at, edited_at, deleted_at FROM office.post_comments WHERE post_id = ${postId} ORDER BY created_at, id`)
    ).rows;
    const people = await peopleById(
      this.database,
      rows.map((row) => row.author_id),
      actor.companyId,
    );
    return rows.map((row) => ({
      id: row.id,
      author: people.get(row.author_id)!,
      body: row.deleted_at ? null : row.body,
      createdAt: isoOrNull(row.created_at)!,
      editedAt: isoOrNull(row.edited_at),
      deleted: row.deleted_at !== null,
      canEdit: row.author_id === actor.userId && row.deleted_at === null,
      canDelete: row.deleted_at === null && (row.author_id === actor.userId || isAuthor),
    }));
  }

  async addComment(actor: Actor, id: string, body: string): Promise<PostResponse> {
    await this.database.transaction(async (transaction) => {
      const { row, isRecipient, canManage } = await this.loadVisible(transaction, actor, id);
      if (!row.allow_comments || row.status !== "active" || !(isRecipient || canManage)) throw new ApiError("BUSINESS_RULE", "officePostCommentsClosed");
      await transaction.execute(sql`INSERT INTO office.post_comments (post_id, author_id, body) VALUES (${id}, ${actor.userId}, ${body})`);
      if (row.created_by !== actor.userId) {
        await notify(transaction, [
          { userId: row.created_by, companyId: row.company_id, kind: "office_post_comment", title: `Bình luận mới: ${row.title}`, link: `/office/bulletin/${id}`, payload: { postId: id } },
        ]);
      }
    });
    return this.detail(actor, id);
  }

  async editComment(actor: Actor, id: string, commentId: string, body: string | null): Promise<PostResponse> {
    await this.database.transaction(async (transaction) => {
      const { isAuthor } = await this.loadVisible(transaction, actor, id);
      const comment = (
        await transaction.execute<{ author_id: string; deleted_at: Date | null }>(sql`
          SELECT author_id, deleted_at FROM office.post_comments WHERE id = ${commentId} AND post_id = ${id} FOR UPDATE`)
      ).rows[0];
      if (!comment || comment.deleted_at) throw new ApiError("NOT_FOUND", "notFound");
      if (body === null) {
        if (comment.author_id !== actor.userId && !isAuthor) throw new ApiError("FORBIDDEN", "forbidden");
        await transaction.execute(sql`UPDATE office.post_comments SET deleted_at = now(), deleted_by = ${actor.userId} WHERE id = ${commentId}`);
      } else {
        if (comment.author_id !== actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
        await transaction.execute(sql`UPDATE office.post_comments SET body = ${body}, edited_at = now() WHERE id = ${commentId}`);
      }
    });
    return this.detail(actor, id);
  }

  // Tệp đính kèm: người đăng tải lên, xóa khi tin chưa thu hồi; người xem được tin thì tải xuống.
  private async fileItems(actor: Actor, postId: string, canDelete: boolean): Promise<OfficeFileItem[]> {
    const files = (
      await this.database.execute<{ id: string; file_name: string; content_type: string; size_bytes: number; uploaded_by: string; created_at: Date }>(sql`
        SELECT id, file_name, content_type, size_bytes, uploaded_by, created_at FROM office.files
        WHERE owner_type = 'post' AND owner_id = ${postId} AND deleted_at IS NULL ORDER BY created_at`)
    ).rows;
    const people = await peopleById(
      this.database,
      files.map((file) => file.uploaded_by),
      actor.companyId,
    );
    return files.map((file) => ({
      id: file.id,
      fileName: file.file_name,
      contentType: file.content_type,
      sizeBytes: file.size_bytes,
      uploadedBy: people.get(file.uploaded_by)!,
      createdAt: isoOrNull(file.created_at)!,
      canDelete,
    }));
  }

  async addFile(actor: Actor, id: string, file: { buffer: Buffer; size: number; originalname: string } | undefined): Promise<PostResponse> {
    const checked = checkOfficeFile(file);
    const { row, isAuthor } = await this.loadVisible(this.database, actor, id);
    if (!isAuthor) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status === "revoked") throw new ApiError("BUSINESS_RULE", "officePostRevoked");
    const storageKey = `office/${row.company_id}/post/${id}/${randomUUID()}`;
    await this.storage.put(storageKey, file!.buffer, checked.contentType);
    try {
      await this.database.execute(sql`
        INSERT INTO office.files (company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
        VALUES (${row.company_id}, 'post', ${id}, ${checked.fileName}, ${checked.contentType}, ${file!.size}, ${storageKey}, ${actor.userId})`);
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
    return this.detail(actor, id);
  }

  async removeFile(actor: Actor, id: string, fileId: string): Promise<PostResponse> {
    const { row, isAuthor } = await this.loadVisible(this.database, actor, id);
    if (!isAuthor) throw new ApiError("FORBIDDEN", "forbidden");
    if (row.status === "revoked") throw new ApiError("BUSINESS_RULE", "officePostRevoked");
    const result = await this.database.execute(sql`
      UPDATE office.files SET deleted_at = now(), deleted_by = ${actor.userId} WHERE id = ${fileId} AND owner_type = 'post' AND owner_id = ${id} AND deleted_at IS NULL RETURNING id`);
    if (result.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
    return this.detail(actor, id);
  }

  async downloadFile(actor: Actor, id: string, fileId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    await this.loadVisible(this.database, actor, id);
    const file = (
      await this.database.execute<{ file_name: string; content_type: string; storage_key: string }>(sql`
        SELECT file_name, content_type, storage_key FROM office.files WHERE id = ${fileId} AND owner_type = 'post' AND owner_id = ${id} AND deleted_at IS NULL`)
    ).rows[0];
    if (!file) throw new ApiError("NOT_FOUND", "notFound");
    return { fileName: file.file_name, contentType: file.content_type, content: await this.storage.get(file.storage_key) };
  }
}
