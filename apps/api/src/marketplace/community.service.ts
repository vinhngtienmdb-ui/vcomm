// Bảng tin cộng đồng mở, đánh giá đã mua hàng, bình luận, thích, báo cáo, kiểm duyệt (CONG_VIEC_49; CHUC_NANG_174; QUYTAC_NGHIEPVU_333 đến 335; API_167 đến 169).
import { Inject, Injectable } from "@nestjs/common";
import type {
  CommentItem,
  CommunityBanItem,
  CommunitySettings,
  CommunityStatus,
  ContentStatus,
  ModerationItem,
  PageResponse,
  PostDetail,
  PostItem,
  PostKind,
  PostProductItem,
  ReportReason,
  ReviewableLine,
} from "contracts";
import type { communitySettingsSchema, createPostSchema, createReportSchema } from "contracts";
import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { searchText, trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { BuyerAdminService, type BuyerAdminActor } from "./buyer-admin.service";
import { localPhone } from "./local-phone";
import { imageKind, maximumImageBytes } from "./return-requests.service";
import { buyerAccount, shopImagePath, vietnamToday } from "./shop.service";
import { loadStoreContext, pricedVariants } from "./store.service";

type Executor = Pick<Database, "execute">;
// Giới hạn mỗi người mỗi ngày (QUYTAC_NGHIEPVU_334); tự ẩn tạm khi có từ 5 báo cáo chờ xử lý (QUYTAC_NGHIEPVU_335); tối đa 3 bài ghim (QUYTAC_NGHIEPVU_333).
const dailyPostLimit = 10;
const dailyCommentLimit = 100;
const autoHideReports = 5;
const pinLimit = 3;
const pendingImageLimit = 30;
const imagePath = (id: string) => `/api/v1/buyer/posts/images/${id}`;
const iso = (value: Date) => new Date(value).toISOString();
// Đầu ngày hôm nay theo giờ Việt Nam.
const vietnamDayStart = sql`((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;

type PostRow = {
  id: string;
  kind: PostKind;
  author_user_id: string;
  author_name: string;
  content: string;
  rating: number | null;
  is_pinned: boolean;
  like_count: number;
  comment_count: number;
  status: ContentStatus;
  created_at: Date;
  liked: boolean;
};

@Injectable()
export class CommunityService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly admin: BuyerAdminService,
    private readonly audit: AuditService,
  ) {}

  private async operator(): Promise<string> {
    const companyId = await this.admin.operatorCompanyId();
    if (!companyId) throw new ApiError("BUSINESS_RULE", "marketplaceOperatorNotSet");
    return companyId;
  }

  private async settingsOf(executor: Executor, companyId: string): Promise<CommunitySettings> {
    const row = (
      await executor.execute<{ posting_enabled: boolean; comments_enabled: boolean; banned_words: string[]; version: number }>(sql`
      SELECT posting_enabled, comments_enabled, banned_words, version FROM marketplace.community_settings WHERE company_id = ${companyId}`)
    ).rows[0];
    return { postingEnabled: row?.posting_enabled ?? true, commentsEnabled: row?.comments_enabled ?? true, bannedWords: row?.banned_words ?? [], version: row?.version ?? 0 };
  }

  private async activeBan(executor: Executor, userId: string): Promise<{ until: Date | null; reason: string } | null> {
    return (
      (
        await executor.execute<{ until: Date | null; reason: string }>(sql`
        SELECT until, reason FROM marketplace.community_bans WHERE user_id = ${userId} AND lifted_at IS NULL AND (until IS NULL OR until > now())
        ORDER BY until DESC NULLS FIRST LIMIT 1`)
      ).rows[0] ?? null
    );
  }

  // Kiểm trước khi đăng bài, bình luận (QUYTAC_NGHIEPVU_334, 335): công tắc, khóa tài khoản, từ cấm (không phân biệt hoa thường, dấu).
  private async guard(executor: Executor, companyId: string, userId: string, kind: "post" | "comment", text: string): Promise<void> {
    const settings = await this.settingsOf(executor, companyId);
    if (kind === "post" ? !settings.postingEnabled : !settings.commentsEnabled) throw new ApiError("BUSINESS_RULE", "communityDisabled");
    if (await this.activeBan(executor, userId)) throw new ApiError("FORBIDDEN", "communityBanned");
    const normalized = searchText(text);
    if (settings.bannedWords.some((word) => normalized.includes(searchText(word)))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { content: "communityBannedWord" } });
  }

  // ---------- Người mua (API_167) ----------

  async status(userId: string): Promise<CommunityStatus> {
    await buyerAccount(this.database, userId);
    const settings = await this.settingsOf(this.database, await this.operator());
    const ban = await this.activeBan(this.database, userId);
    return { postingEnabled: settings.postingEnabled, commentsEnabled: settings.commentsEnabled, ban: ban ? { until: ban.until ? iso(ban.until) : null, reason: ban.reason } : null };
  }

  private postSelect(viewerId: string | null): SQL {
    return sql`
      SELECT p.id, p.kind, p.author_user_id, CASE WHEN p.kind = 'official' THEN 'VComm' ELSE u.full_name END AS author_name, p.content, p.rating, p.is_pinned,
        p.like_count, p.comment_count, p.status, p.created_at,
        EXISTS (SELECT 1 FROM marketplace.post_likes l WHERE l.post_id = p.id AND l.user_id = ${viewerId}::uuid) AS liked
      FROM marketplace.posts p JOIN core.users u ON u.id = p.author_user_id`;
  }

  private async items(executor: Executor, rows: PostRow[], viewerId: string | null): Promise<PostItem[]> {
    if (rows.length === 0) return [];
    const ids = sql.join(
      rows.map((row) => sql`${row.id}::uuid`),
      sql`, `,
    );
    const images = await executor.execute<{ id: string; post_id: string }>(sql`SELECT id, post_id FROM marketplace.post_images WHERE post_id IN (${ids}) ORDER BY sort_order, id`);
    const products = await executor.execute<{ post_id: string; product_id: string; name: string; image_id: string | null }>(sql`
      SELECT pp.post_id, pp.product_id, pr.name, (SELECT i.id FROM catalog.product_images i WHERE i.product_id = pr.id ORDER BY i.sort_order LIMIT 1) AS image_id
      FROM marketplace.post_products pp JOIN catalog.products pr ON pr.id = pp.product_id WHERE pp.post_id IN (${ids}) ORDER BY pp.sort_order`);
    // Giá thấp nhất gồm thuế của sản phẩm còn bán; không còn bán thì null.
    const context = await loadStoreContext(executor);
    const productIds = [...new Set(products.rows.map((row) => row.product_id))];
    const prices = context && productIds.length > 0 ? await pricedVariants(executor, context, productIds, await vietnamToday(executor)) : new Map();
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      authorId: row.author_user_id,
      authorName: row.author_name,
      content: row.content,
      rating: row.rating,
      images: images.rows.filter((image) => image.post_id === row.id).map((image) => imagePath(image.id)),
      products: products.rows
        .filter((product) => product.post_id === row.id)
        .map((product): PostProductItem => {
          const variants = (prices.get(product.product_id) ?? []) as { grossPrice: string }[];
          return {
            productId: product.product_id,
            name: product.name,
            imageUrl: shopImagePath(product.image_id),
            priceFrom: variants.length > 0 ? trimDecimal(Math.min(...variants.map((variant) => Number(variant.grossPrice))).toFixed(4)) : null,
          };
        }),
      isPinned: row.is_pinned,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      likedByMe: row.liked,
      isMine: viewerId !== null && row.author_user_id === viewerId,
      status: row.status,
      createdAt: iso(row.created_at),
    }));
  }

  // Bảng tin: bài ghim trước, còn lại mới nhất trước; lọc theo sản phẩm gắn hoặc sản phẩm được đánh giá (QUYTAC_NGHIEPVU_333).
  async list(userId: string, query: { productId?: string | undefined; page: number; pageSize: number }): Promise<PageResponse<PostItem>> {
    await buyerAccount(this.database, userId);
    const companyId = await this.operator();
    const conditions: SQL[] = [sql`p.company_id = ${companyId}`, sql`p.status = 'visible'`];
    if (query.productId)
      conditions.push(sql`(p.reviewed_product_id = ${query.productId} OR EXISTS (SELECT 1 FROM marketplace.post_products pp WHERE pp.post_id = p.id AND pp.product_id = ${query.productId}))`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM marketplace.posts p WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<PostRow>(sql`
      ${this.postSelect(userId)} WHERE ${where} ORDER BY p.is_pinned DESC, p.created_at DESC, p.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: await this.items(this.database, rows.rows, userId), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(userId: string, postId: string): Promise<PostDetail> {
    await buyerAccount(this.database, userId);
    const companyId = await this.operator();
    const row = (await this.database.execute<PostRow>(sql`${this.postSelect(userId)} WHERE p.id = ${postId} AND p.company_id = ${companyId}`)).rows[0];
    // Bài ẩn, đã xóa chỉ tác giả thấy (để biết đã bị ẩn); người khác coi như không có.
    if (!row || row.status === "deleted" || (row.status !== "visible" && row.author_user_id !== userId)) throw new ApiError("NOT_FOUND", "notFound");
    const comments = await this.database.execute<{ id: string; author_user_id: string; name: string; content: string; status: ContentStatus; created_at: Date }>(sql`
      SELECT c.id, c.author_user_id, u.full_name AS name, c.content, c.status, c.created_at FROM marketplace.post_comments c JOIN core.users u ON u.id = c.author_user_id
      WHERE c.post_id = ${postId} AND c.status <> 'deleted' ORDER BY c.created_at, c.id`);
    const [item] = await this.items(this.database, [row], userId);
    return {
      ...item!,
      comments: comments.rows.map(
        (comment): CommentItem => ({
          id: comment.id,
          authorId: comment.author_user_id,
          authorName: comment.name,
          content: comment.status === "visible" ? comment.content : null,
          isMine: comment.author_user_id === userId,
          status: comment.status,
          createdAt: iso(comment.created_at),
        }),
      ),
    };
  }

  // Dòng đơn đã giao hoặc hoàn tất của chính người mua, chưa đánh giá (QUYTAC_NGHIEPVU_333).
  async reviewable(userId: string): Promise<ReviewableLine[]> {
    await buyerAccount(this.database, userId);
    const rows = await this.database.execute<{ line_id: string; order_id: string; document_no: string; product_id: string; name: string; option_values: string[] | null }>(sql`
      SELECT l.id AS line_id, m.id AS order_id, so.document_no, v.product_id, p.name, v.option_values
      FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id JOIN sales.order_lines l ON l.order_id = so.id
        JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE m.buyer_user_id = ${userId} AND m.status IN ('delivered', 'completed') AND NOT l.is_gift
        AND NOT EXISTS (SELECT 1 FROM marketplace.posts r WHERE r.order_line_id = l.id)
      ORDER BY m.created_at DESC, l.line_no LIMIT 50`);
    return rows.rows.map((row) => ({
      orderLineId: row.line_id,
      orderId: row.order_id,
      documentNo: row.document_no,
      productId: row.product_id,
      productName: row.name,
      variantLabel: (row.option_values ?? []).filter(Boolean).join(" · "),
    }));
  }

  // Đăng bài hoặc đánh giá (QUYTAC_NGHIEPVU_333, 334).
  async create(userId: string, input: z.output<typeof createPostSchema>): Promise<PostDetail> {
    await buyerAccount(this.database, userId);
    const companyId = await this.operator();
    const id = await this.database.transaction(async (transaction) => {
      // Khóa tài khoản người mua: đếm giới hạn ngày không chạy đồng thời.
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      await this.guard(transaction, companyId, userId, "post", input.content);
      const today = (
        await transaction.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM marketplace.posts WHERE author_user_id = ${userId} AND kind <> 'official' AND created_at >= ${vietnamDayStart}`)
      ).rows[0]!.count;
      if (today >= dailyPostLimit) throw new ApiError("BUSINESS_RULE", "communityPostLimit");
      let reviewedProduct: string | null = null;
      if (input.orderLineId) {
        const line = (
          await transaction.execute<{ product_id: string }>(sql`
          SELECT v.product_id FROM sales.order_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN marketplace.orders m ON m.sales_order_id = l.order_id
          WHERE l.id = ${input.orderLineId} AND m.buyer_user_id = ${userId} AND m.status IN ('delivered', 'completed') AND NOT l.is_gift`)
        ).rows[0];
        if (!line) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { orderLineId: "communityReviewNotAllowed" } });
        const reviewed = await transaction.execute(sql`SELECT 1 FROM marketplace.posts WHERE order_line_id = ${input.orderLineId}`);
        if (reviewed.rows.length > 0) throw new ApiError("BUSINESS_RULE", "communityAlreadyReviewed");
        reviewedProduct = line.product_id;
      }
      const productIds = [...new Set(input.productIds)];
      if (productIds.length > 0) {
        const listed = await transaction.execute<{ product_id: string }>(sql`
          SELECT product_id FROM marketplace.listings WHERE company_id = ${companyId} AND is_published AND product_id IN (${sql.join(
            productIds.map((productId) => sql`${productId}::uuid`),
            sql`, `,
          )})`);
        if (listed.rows.length !== productIds.length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { productIds: "invalidValue" } });
      }
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO marketplace.posts (company_id, author_user_id, kind, content, rating, order_line_id, reviewed_product_id)
        VALUES (${companyId}, ${userId}, ${input.orderLineId ? "review" : "member"}, ${input.content}, ${input.rating}, ${input.orderLineId}, ${reviewedProduct}) RETURNING id`)
      ).rows[0]!.id;
      for (const [index, productId] of productIds.entries()) {
        await transaction.execute(sql`INSERT INTO marketplace.post_products (post_id, product_id, sort_order) VALUES (${created}, ${productId}, ${index})`);
      }
      for (const [index, imageId] of [...new Set(input.imageIds)].entries()) {
        const attached = await transaction.execute(sql`
          UPDATE marketplace.post_images SET post_id = ${created}, sort_order = ${index} WHERE id = ${imageId} AND uploader_id = ${userId} AND post_id IS NULL RETURNING id`);
        if (attached.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { imageIds: "invalidValue" } });
      }
      return created;
    });
    return this.detail(userId, id);
  }

  // Tác giả xóa bài (ẩn vĩnh viễn), không sửa.
  async remove(userId: string, postId: string): Promise<void> {
    const removed = await this.database.execute(sql`
      UPDATE marketplace.posts SET status = 'deleted', is_pinned = false, updated_at = now(), version = version + 1
      WHERE id = ${postId} AND author_user_id = ${userId} AND kind <> 'official' AND status <> 'deleted' RETURNING id`);
    if (removed.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  private async visiblePost(executor: Executor, postId: string): Promise<{ company_id: string }> {
    const post = (await executor.execute<{ company_id: string }>(sql`SELECT company_id FROM marketplace.posts WHERE id = ${postId} AND status = 'visible' FOR UPDATE`)).rows[0];
    if (!post) throw new ApiError("NOT_FOUND", "notFound");
    return post;
  }

  async comment(userId: string, postId: string, content: string): Promise<PostDetail> {
    await buyerAccount(this.database, userId);
    await this.database.transaction(async (transaction) => {
      const post = await this.visiblePost(transaction, postId);
      await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${userId} FOR UPDATE`);
      await this.guard(transaction, post.company_id, userId, "comment", content);
      const today = (
        await transaction.execute<{ count: number }>(sql`
        SELECT count(*)::int AS count FROM marketplace.post_comments WHERE author_user_id = ${userId} AND created_at >= ${vietnamDayStart}`)
      ).rows[0]!.count;
      if (today >= dailyCommentLimit) throw new ApiError("BUSINESS_RULE", "communityCommentLimit");
      await transaction.execute(sql`INSERT INTO marketplace.post_comments (post_id, author_user_id, content) VALUES (${postId}, ${userId}, ${content})`);
      await transaction.execute(sql`UPDATE marketplace.posts SET comment_count = comment_count + 1 WHERE id = ${postId}`);
    });
    return this.detail(userId, postId);
  }

  async removeComment(userId: string, commentId: string): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const current = (
        await transaction.execute<{ status: ContentStatus }>(sql`
        SELECT status FROM marketplace.post_comments WHERE id = ${commentId} AND author_user_id = ${userId} AND status <> 'deleted' FOR UPDATE`)
      ).rows[0];
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      await transaction.execute(sql`UPDATE marketplace.post_comments SET status = 'deleted', version = version + 1 WHERE id = ${commentId}`);
      // Số bình luận của bài chỉ đếm bình luận đang hiện.
      if (current.status === "visible") await this.adjustCommentCount(transaction, commentId, -1);
    });
  }

  // Thích, bỏ thích: mỗi người một lần mỗi bài.
  async like(userId: string, postId: string, liked: boolean): Promise<{ liked: boolean; likeCount: number }> {
    await buyerAccount(this.database, userId);
    return this.database.transaction(async (transaction) => {
      await this.visiblePost(transaction, postId);
      const changed = liked
        ? await transaction.execute(sql`INSERT INTO marketplace.post_likes (post_id, user_id) VALUES (${postId}, ${userId}) ON CONFLICT DO NOTHING RETURNING post_id`)
        : await transaction.execute(sql`DELETE FROM marketplace.post_likes WHERE post_id = ${postId} AND user_id = ${userId} RETURNING post_id`);
      const count = (
        await transaction.execute<{ like_count: number }>(sql`
        UPDATE marketplace.posts SET like_count = greatest(like_count + ${changed.rows.length > 0 ? (liked ? 1 : -1) : 0}, 0) WHERE id = ${postId} RETURNING like_count`)
      ).rows[0]!.like_count;
      return { liked, likeCount: count };
    });
  }

  // Báo cáo nội dung của người khác; đủ 5 báo cáo chờ xử lý thì tự ẩn tạm (QUYTAC_NGHIEPVU_335).
  async report(userId: string, input: z.output<typeof createReportSchema>): Promise<void> {
    await buyerAccount(this.database, userId);
    await this.database.transaction(async (transaction) => {
      const table = input.postId ? sql`marketplace.posts` : sql`marketplace.post_comments`;
      const targetId = (input.postId ?? input.commentId)!;
      const target = (await transaction.execute<{ author_user_id: string; status: ContentStatus }>(sql`SELECT author_user_id, status FROM ${table} WHERE id = ${targetId} FOR UPDATE`)).rows[0];
      if (!target || target.status === "deleted" || target.status === "hidden") throw new ApiError("NOT_FOUND", "notFound");
      if (target.author_user_id === userId) throw new ApiError("BUSINESS_RULE", "communityReportOwn");
      const inserted = await transaction.execute(sql`
        INSERT INTO marketplace.content_reports (post_id, comment_id, reporter_id, reason, description) VALUES (${input.postId}, ${input.commentId}, ${userId}, ${input.reason}, ${input.description})
        ON CONFLICT DO NOTHING RETURNING id`);
      if (inserted.rows.length === 0) throw new ApiError("BUSINESS_RULE", "communityAlreadyReported");
      const column = input.postId ? sql`post_id` : sql`comment_id`;
      const pending = (await transaction.execute<{ count: number }>(sql`SELECT count(*)::int AS count FROM marketplace.content_reports WHERE ${column} = ${targetId} AND status = 'pending'`)).rows[0]!
        .count;
      if (pending >= autoHideReports && target.status === "visible") {
        await transaction.execute(sql`UPDATE ${table} SET status = 'auto_hidden', version = version + 1 WHERE id = ${targetId}`);
        if (input.commentId) await this.adjustCommentCount(transaction, input.commentId, -1);
      }
    });
  }

  private async adjustCommentCount(executor: Executor, commentId: string, delta: number): Promise<void> {
    await executor.execute(sql`
      UPDATE marketplace.posts p SET comment_count = greatest(p.comment_count + ${delta}, 0) FROM marketplace.post_comments c WHERE c.id = ${commentId} AND p.id = c.post_id`);
  }

  // API_169: ảnh bài đăng tải lên trước khi đăng, kiểm theo nội dung tệp.
  async uploadImage(userId: string, file: { buffer: Buffer; size: number } | undefined): Promise<{ id: string; url: string }> {
    await buyerAccount(this.database, userId);
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > maximumImageBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "imageTooLarge" } });
    const kind = imageKind(file.buffer);
    if (!kind) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "returnImageType" } });
    const pending = (
      await this.database.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM marketplace.post_images WHERE uploader_id = ${userId} AND post_id IS NULL AND created_at > now() - interval '1 day'`)
    ).rows[0]!.count;
    if (pending >= pendingImageLimit) throw new ApiError("BUSINESS_RULE", "communityImageLimit");
    const storageKey = `community/${userId}/${randomUUID()}`;
    await this.storage.put(storageKey, file.buffer, kind);
    const id = (
      await this.database.execute<{ id: string }>(sql`
      INSERT INTO marketplace.post_images (uploader_id, storage_key, content_type, size_bytes) VALUES (${userId}, ${storageKey}, ${kind}, ${file.size}) RETURNING id`)
    ).rows[0]!.id;
    return { id, url: imagePath(id) };
  }

  // Ảnh của bài đang hiện xem được bởi người đã đăng nhập; ảnh chưa đăng hoặc bài bị ẩn chỉ người tải lên (hoặc quản trị) xem.
  async image(imageId: string, viewer: { userId: string } | { admin: true }): Promise<{ contentType: string; content: Buffer }> {
    const row = (
      await this.database.execute<{ content_type: string; storage_key: string; uploader_id: string; status: ContentStatus | null }>(sql`
      SELECT i.content_type, i.storage_key, i.uploader_id, p.status FROM marketplace.post_images i LEFT JOIN marketplace.posts p ON p.id = i.post_id WHERE i.id = ${imageId}`)
    ).rows[0];
    const allowed = row && ("admin" in viewer || row.status === "visible" || row.uploader_id === viewer.userId);
    if (!row || !allowed) throw new ApiError("NOT_FOUND", "notFound");
    return { contentType: row.content_type, content: await this.storage.get(row.storage_key) };
  }

  // ---------- Kiểm duyệt (API_168) ----------

  async moderation(actor: BuyerAdminActor, query: { view: "reported" | "hidden"; page: number; pageSize: number }): Promise<PageResponse<ModerationItem>> {
    const filter = query.view === "reported" ? sql`x.pending_reports > 0 AND x.status IN ('visible', 'auto_hidden')` : sql`x.status IN ('hidden', 'auto_hidden')`;
    const base = sql`
      SELECT * FROM (
        SELECT 'post' AS target, p.id, p.id AS post_id, p.author_user_id, p.content, p.status, p.hidden_reason, p.created_at,
          (SELECT count(*)::int FROM marketplace.content_reports r WHERE r.post_id = p.id AND r.status = 'pending') AS pending_reports,
          (SELECT r.reason FROM marketplace.content_reports r WHERE r.post_id = p.id AND r.status = 'pending' GROUP BY r.reason ORDER BY count(*) DESC, r.reason LIMIT 1) AS top_reason,
          (SELECT max(r.created_at) FROM marketplace.content_reports r WHERE r.post_id = p.id AND r.status = 'pending') AS latest_report_at
        FROM marketplace.posts p WHERE p.company_id = ${actor.operatorCompanyId} AND p.kind <> 'official'
        UNION ALL
        SELECT 'comment', c.id, c.post_id, c.author_user_id, c.content, c.status, c.hidden_reason, c.created_at,
          (SELECT count(*)::int FROM marketplace.content_reports r WHERE r.comment_id = c.id AND r.status = 'pending'),
          (SELECT r.reason FROM marketplace.content_reports r WHERE r.comment_id = c.id AND r.status = 'pending' GROUP BY r.reason ORDER BY count(*) DESC, r.reason LIMIT 1),
          (SELECT max(r.created_at) FROM marketplace.content_reports r WHERE r.comment_id = c.id AND r.status = 'pending')
        FROM marketplace.post_comments c JOIN marketplace.posts p ON p.id = c.post_id WHERE p.company_id = ${actor.operatorCompanyId}
      ) x WHERE ${filter}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM (${base}) y`)).rows[0]!.total;
    const rows = await this.database.execute<{
      target: "post" | "comment";
      id: string;
      post_id: string;
      author_user_id: string;
      content: string;
      status: ContentStatus;
      hidden_reason: string | null;
      created_at: Date;
      pending_reports: number;
      top_reason: ReportReason | null;
      latest_report_at: Date | null;
      full_name: string;
      phone: string | null;
    }>(sql`
      SELECT y.*, u.full_name, u.phone FROM (${base}) y JOIN core.users u ON u.id = y.author_user_id
      ORDER BY y.pending_reports DESC, y.latest_report_at DESC NULLS LAST, y.created_at DESC, y.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        target: row.target,
        id: row.id,
        postId: row.post_id,
        authorId: row.author_user_id,
        authorName: row.full_name,
        authorPhone: localPhone(row.phone ?? ""),
        content: row.content,
        status: row.status,
        hiddenReason: row.hidden_reason,
        pendingReports: row.pending_reports,
        topReason: row.top_reason,
        latestReportAt: row.latest_report_at ? iso(row.latest_report_at) : null,
        createdAt: iso(row.created_at),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  // Ẩn (lý do, báo tác giả) hoặc hiện lại (bỏ qua báo cáo đang chờ) bài, bình luận (QUYTAC_NGHIEPVU_335).
  async moderate(actor: BuyerAdminActor, target: "post" | "comment", id: string, action: "hide" | "show", reason: string | null): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const table = target === "post" ? sql`marketplace.posts` : sql`marketplace.post_comments`;
      const owner =
        target === "post"
          ? sql`SELECT company_id FROM marketplace.posts WHERE id = ${id}`
          : sql`SELECT p.company_id FROM marketplace.post_comments c JOIN marketplace.posts p ON p.id = c.post_id WHERE c.id = ${id}`;
      const company = (await transaction.execute<{ company_id: string }>(owner)).rows[0];
      if (!company || company.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
      const current = (await transaction.execute<{ status: ContentStatus; author_user_id: string }>(sql`SELECT status, author_user_id FROM ${table} WHERE id = ${id} FOR UPDATE`)).rows[0]!;
      if (current.status === "deleted") throw new ApiError("NOT_FOUND", "notFound");
      const next: ContentStatus = action === "hide" ? "hidden" : "visible";
      const column = target === "post" ? sql`post_id` : sql`comment_id`;
      // Nội dung đang hiện mà còn báo cáo chờ xử lý: "hiện lại" nghĩa là bỏ qua các báo cáo, không đổi trạng thái.
      const pendingReports = (await transaction.execute(sql`SELECT 1 FROM marketplace.content_reports WHERE ${column} = ${id} AND status = 'pending' LIMIT 1`)).rows.length > 0;
      if (current.status === next && !(action === "show" && pendingReports)) throw new ApiError("BUSINESS_RULE", "communityStatusUnchanged");
      if (current.status !== next) await transaction.execute(sql`UPDATE ${table} SET status = ${next}, hidden_reason = ${action === "hide" ? reason : null}, version = version + 1 WHERE id = ${id}`);
      if (target === "comment") {
        const wasCounted = current.status === "visible";
        if (wasCounted !== (next === "visible")) await this.adjustCommentCount(transaction, id, next === "visible" ? 1 : -1);
      }
      await transaction.execute(sql`
        UPDATE marketplace.content_reports SET status = ${action === "hide" ? "resolved" : "dismissed"}, handled_by = ${actor.userId}, handled_at = now()
        WHERE ${column} = ${id} AND status = 'pending'`);
      if (action === "hide") {
        await notify(transaction, [
          {
            userId: current.author_user_id,
            companyId: actor.operatorCompanyId,
            kind: `community.${target}_hidden`,
            title: target === "post" ? "Bài đăng của bạn đã bị ẩn" : "Bình luận của bạn đã bị ẩn",
            payload: { id, reason },
          },
        ]);
      }
      await this.record(
        transaction,
        actor,
        `marketplace.community.${target}_${action}`,
        target === "post" ? "marketplace.posts" : "marketplace.post_comments",
        id,
        { status: current.status },
        { status: next, reason },
      );
    });
  }

  async bans(): Promise<CommunityBanItem[]> {
    const rows = await this.database.execute<{
      id: string;
      user_id: string;
      full_name: string;
      phone: string | null;
      until: Date | null;
      reason: string;
      banned_by_name: string;
      created_at: Date;
    }>(sql`
      SELECT b.id, b.user_id, u.full_name, u.phone, b.until, b.reason, a.full_name AS banned_by_name, b.created_at
      FROM marketplace.community_bans b JOIN core.users u ON u.id = b.user_id JOIN core.users a ON a.id = b.banned_by JOIN marketplace.buyer_accounts ba ON ba.user_id = b.user_id
      WHERE b.lifted_at IS NULL AND (b.until IS NULL OR b.until > now()) ORDER BY b.created_at DESC`);
    return rows.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.full_name,
      userPhone: localPhone(row.phone ?? ""),
      until: row.until ? iso(row.until) : null,
      reason: row.reason,
      bannedByName: row.banned_by_name,
      createdAt: iso(row.created_at),
    }));
  }

  // Khóa đăng bài, bình luận 1 đến 365 ngày hoặc vĩnh viễn (days null), có lý do, báo người dùng.
  async ban(actor: BuyerAdminActor, input: { userId: string; days: number | null; reason: string }): Promise<CommunityBanItem[]> {
    await this.database.transaction(async (transaction) => {
      const buyer = await transaction.execute(sql`SELECT 1 FROM marketplace.buyer_accounts WHERE user_id = ${input.userId}`);
      if (buyer.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      // Khóa mới thay khóa đang hiệu lực.
      await transaction.execute(sql`
        UPDATE marketplace.community_bans SET lifted_by = ${actor.userId}, lifted_at = now() WHERE user_id = ${input.userId} AND lifted_at IS NULL AND (until IS NULL OR until > now())`);
      const until = input.days === null ? null : sql`now() + make_interval(days => ${input.days})`;
      await transaction.execute(sql`
        INSERT INTO marketplace.community_bans (user_id, until, reason, banned_by) VALUES (${input.userId}, ${until}, ${input.reason}, ${actor.userId})`);
      await notify(transaction, [
        {
          userId: input.userId,
          companyId: actor.operatorCompanyId,
          kind: "community.banned",
          title: "Tài khoản của bạn bị khóa đăng bài và bình luận",
          payload: { days: input.days, reason: input.reason },
        },
      ]);
      await this.record(transaction, actor, "marketplace.community.ban", "marketplace.community_bans", input.userId, null, input);
    });
    return this.bans();
  }

  async lift(actor: BuyerAdminActor, banId: string): Promise<CommunityBanItem[]> {
    await this.database.transaction(async (transaction) => {
      const lifted = (
        await transaction.execute<{ user_id: string }>(sql`
        UPDATE marketplace.community_bans SET lifted_by = ${actor.userId}, lifted_at = now() WHERE id = ${banId} AND lifted_at IS NULL RETURNING user_id`)
      ).rows[0];
      if (!lifted) throw new ApiError("NOT_FOUND", "notFound");
      await notify(transaction, [{ userId: lifted.user_id, companyId: actor.operatorCompanyId, kind: "community.unbanned", title: "Tài khoản của bạn đã được mở khóa đăng bài và bình luận" }]);
      await this.record(transaction, actor, "marketplace.community.lift_ban", "marketplace.community_bans", banId, null, null);
    });
    return this.bans();
  }

  async settings(actor: BuyerAdminActor): Promise<CommunitySettings> {
    return this.settingsOf(this.database, actor.operatorCompanyId);
  }

  async updateSettings(actor: BuyerAdminActor, input: z.output<typeof communitySettingsSchema>): Promise<CommunitySettings> {
    const words = [...new Set(input.bannedWords.map((word) => word.trim()).filter(Boolean))];
    await this.database.transaction(async (transaction) => {
      const before = await this.settingsOf(transaction, actor.operatorCompanyId);
      const saved =
        input.version === 0
          ? await transaction.execute(sql`
            INSERT INTO marketplace.community_settings (company_id, posting_enabled, comments_enabled, banned_words, updated_by)
            VALUES (${actor.operatorCompanyId}, ${input.postingEnabled}, ${input.commentsEnabled}, ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(words)}::jsonb)), ${actor.userId})
            ON CONFLICT (company_id) DO NOTHING RETURNING company_id`)
          : await transaction.execute(sql`
            UPDATE marketplace.community_settings SET posting_enabled = ${input.postingEnabled}, comments_enabled = ${input.commentsEnabled}, banned_words = ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(words)}::jsonb)),
              updated_by = ${actor.userId}, updated_at = now(), version = version + 1
            WHERE company_id = ${actor.operatorCompanyId} AND version = ${input.version} RETURNING company_id`);
      if (saved.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.record(transaction, actor, "marketplace.community_settings.update", "marketplace.community_settings", actor.operatorCompanyId, before, { ...input, bannedWords: words });
    });
    return this.settings(actor);
  }

  // Bài của VComm: đăng bởi người có quyền kiểm duyệt, ghim tối đa 3 bài (QUYTAC_NGHIEPVU_333).
  async officialPosts(actor: BuyerAdminActor): Promise<PostItem[]> {
    const rows = await this.database.execute<PostRow>(sql`
      ${this.postSelect(null)} WHERE p.company_id = ${actor.operatorCompanyId} AND p.kind = 'official' AND p.status <> 'deleted' ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 50`);
    return this.items(this.database, rows.rows, null);
  }

  async createOfficial(actor: BuyerAdminActor, input: { content: string; isPinned: boolean }): Promise<PostItem[]> {
    await this.database.transaction(async (transaction) => {
      if (input.isPinned) await this.checkPinLimit(transaction, actor.operatorCompanyId);
      const id = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO marketplace.posts (company_id, author_user_id, kind, content, is_pinned) VALUES (${actor.operatorCompanyId}, ${actor.userId}, 'official', ${input.content}, ${input.isPinned}) RETURNING id`)
      ).rows[0]!.id;
      await this.record(transaction, actor, "marketplace.community.official_post", "marketplace.posts", id, null, input);
    });
    return this.officialPosts(actor);
  }

  async pin(actor: BuyerAdminActor, postId: string, isPinned: boolean): Promise<PostItem[]> {
    await this.database.transaction(async (transaction) => {
      if (isPinned) await this.checkPinLimit(transaction, actor.operatorCompanyId);
      const updated = await transaction.execute(sql`
        UPDATE marketplace.posts SET is_pinned = ${isPinned}, version = version + 1 WHERE id = ${postId} AND company_id = ${actor.operatorCompanyId} AND kind = 'official' AND status = 'visible'
        RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await this.record(transaction, actor, "marketplace.community.pin", "marketplace.posts", postId, null, { isPinned });
    });
    return this.officialPosts(actor);
  }

  private async checkPinLimit(executor: Executor, companyId: string): Promise<void> {
    // Khóa các bài ghim để đếm không chạy đồng thời.
    const pinned = await executor.execute(sql`SELECT id FROM marketplace.posts WHERE company_id = ${companyId} AND is_pinned AND status = 'visible' FOR UPDATE`);
    if (pinned.rows.length >= pinLimit) throw new ApiError("BUSINESS_RULE", "communityPinLimit");
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
