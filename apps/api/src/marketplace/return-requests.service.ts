// Trả hàng trong 7 ngày của đơn VComm (CONG_VIEC_24; CHUC_NANG_118; QUYTAC_NGHIEPVU_161; API_129).
import { Inject, Injectable } from "@nestjs/common";
import type { createReturnRequestSchema, PageResponse, ReturnReason, ReturnRequestAdminItem, ReturnRequestItem, ReturnRequestStatus } from "contracts";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { SalesDeliveriesService } from "../inventory/sales-deliveries.service";
import type { Actor } from "../permissions/roles.service";
import { localPhone } from "./buyer-accounts.service";
import type { BuyerAdminActor } from "./buyer-admin.service";
import { refundReturnedGoods } from "./payments/refund-amounts";
import { vietnamToday } from "./shop.service";

type Executor = Pick<Database, "execute">;
export const returnWindowHours = 168;
export const maximumImageBytes = 5 * 1024 * 1024;
// Ảnh JPEG, PNG nhận diện theo nội dung tệp, không theo tên.
export const imageKind = (buffer: Buffer): "image/jpeg" | "image/png" | null => {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
};
// Yêu cầu còn tính vào số lượng đã yêu cầu, và yêu cầu đang xử lý chặn hoàn tất đơn.
const countedStatuses: ReturnRequestStatus[] = ["pending", "approved", "received"];

type RequestRow = {
  id: string;
  order_id: string;
  document_no: string;
  status: ReturnRequestStatus;
  reason: ReturnReason;
  description: string;
  decision_note: string | null;
  created_at: Date;
  decided_at: Date | null;
  closed_at: Date | null;
  version: number;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_user_id: string;
};

const requestSelect = sql`
  SELECT r.id, r.order_id, so.document_no, r.status, r.reason, r.description, r.decision_note, r.created_at, r.decided_at, r.closed_at, r.version, u.full_name AS buyer_name,
    u.phone AS buyer_phone, r.buyer_user_id
  FROM marketplace.return_requests r JOIN marketplace.orders m ON m.id = r.order_id JOIN sales.orders so ON so.id = m.sales_order_id JOIN core.users u ON u.id = r.buyer_user_id`;
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

async function itemsOf(executor: Executor, rows: RequestRow[], imageBase: string): Promise<ReturnRequestItem[]> {
  if (rows.length === 0) return [];
  const ids = sql.join(
    rows.map((row) => sql`${row.id}::uuid`),
    sql`, `,
  );
  const lines = await executor.execute<{ request_id: string; order_line_id: string; quantity: string; name: string; option_values: string[] | null }>(sql`
    SELECT rl.request_id, rl.order_line_id, rl.quantity::text, p.name, v.option_values
    FROM marketplace.return_request_lines rl JOIN sales.order_lines l ON l.id = rl.order_line_id JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
    WHERE rl.request_id IN (${ids}) ORDER BY l.line_no`);
  const images = await executor.execute<{ id: string; request_id: string }>(sql`SELECT id, request_id FROM marketplace.return_request_images WHERE request_id IN (${ids}) ORDER BY created_at, id`);
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    documentNo: row.document_no,
    status: row.status,
    reason: row.reason,
    description: row.description,
    lines: lines.rows
      .filter((line) => line.request_id === row.id)
      .map((line) => ({ orderLineId: line.order_line_id, productName: line.name, variantLabel: (line.option_values ?? []).filter(Boolean).join(" · "), quantity: trimDecimal(line.quantity) })),
    images: images.rows.filter((image) => image.request_id === row.id).map((image) => `${imageBase}/${image.id}`),
    decisionNote: row.decision_note,
    createdAt: iso(row.created_at)!,
    decidedAt: iso(row.decided_at),
    closedAt: iso(row.closed_at),
    canWithdraw: row.status === "pending",
    version: row.version,
  }));
}

// Yêu cầu trả hàng của một đơn, dùng ở chi tiết đơn của người mua.
export async function buyerReturnRequests(executor: Executor, orderId: string): Promise<ReturnRequestItem[]> {
  const rows = await executor.execute<RequestRow>(sql`${requestSelect} WHERE r.order_id = ${orderId} ORDER BY r.created_at DESC, r.id`);
  return itemsOf(executor, rows.rows, "/api/v1/buyer/return-requests/images");
}

@Injectable()
export class ReturnRequestsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly deliveries: SalesDeliveriesService,
  ) {}

  // Ảnh tải lên trước khi gửi yêu cầu; gắn vào yêu cầu khi gửi.
  async uploadImage(userId: string, file: { buffer: Buffer; size: number } | undefined): Promise<{ id: string }> {
    if (!file || file.size === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    if (file.size > maximumImageBytes) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "imageTooLarge" } });
    const kind = imageKind(file.buffer);
    if (!kind) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "returnImageType" } });
    // Giới hạn ảnh chưa gắn của mỗi người mua để không lưu tràn.
    const pending = (
      await this.database.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM marketplace.return_request_images WHERE buyer_user_id = ${userId} AND request_id IS NULL AND created_at > now() - interval '1 day'`)
    ).rows[0]!.count;
    if (pending >= 20) throw new ApiError("BUSINESS_RULE", "returnImageLimit");
    const storageKey = `return-requests/${userId}/${randomUUID()}`;
    await this.storage.put(storageKey, file.buffer, kind);
    const row = (
      await this.database.execute<{ id: string }>(sql`
      INSERT INTO marketplace.return_request_images (buyer_user_id, storage_key, content_type, size_bytes) VALUES (${userId}, ${storageKey}, ${kind}, ${file.size}) RETURNING id`)
    ).rows[0]!;
    return { id: row.id };
  }

  async image(imageId: string, owner: { buyerUserId: string } | { companyId: string }): Promise<{ contentType: string; content: Buffer }> {
    const row = (
      await this.database.execute<{ content_type: string; storage_key: string; buyer_user_id: string; company_id: string | null }>(sql`
      SELECT i.content_type, i.storage_key, i.buyer_user_id, m.company_id FROM marketplace.return_request_images i
      LEFT JOIN marketplace.return_requests r ON r.id = i.request_id LEFT JOIN marketplace.orders m ON m.id = r.order_id WHERE i.id = ${imageId}`)
    ).rows[0];
    const allowed = row && ("buyerUserId" in owner ? row.buyer_user_id === owner.buyerUserId : row.company_id === owner.companyId);
    if (!row || !allowed) throw new ApiError("NOT_FOUND", "notFound");
    return { contentType: row.content_type, content: await this.storage.get(row.storage_key) };
  }

  // Gửi yêu cầu trả hàng (QUYTAC_NGHIEPVU_161): đơn đã giao, trong 7 ngày, số lượng không vượt phần còn được yêu cầu, một yêu cầu đang xử lý.
  async create(userId: string, orderId: string, input: z.output<typeof createReturnRequestSchema>): Promise<ReturnRequestItem[]> {
    await this.database.transaction(async (transaction) => {
      const order = (
        await transaction.execute<{ buyer_user_id: string; status: string; sales_order_id: string; within: boolean }>(sql`
        SELECT buyer_user_id, status, sales_order_id, (delivered_at + make_interval(hours => ${returnWindowHours}) > now()) AS within FROM marketplace.orders WHERE id = ${orderId} FOR UPDATE`)
      ).rows[0];
      if (!order || order.buyer_user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
      if (order.status !== "delivered" || !order.within) throw new ApiError("BUSINESS_RULE", "returnWindowClosed");
      const open = await transaction.execute(sql`SELECT 1 FROM marketplace.return_requests WHERE order_id = ${orderId} AND status IN ('pending', 'approved')`);
      if (open.rows.length > 0) throw new ApiError("BUSINESS_RULE", "returnRequestOpen");
      const fields: Record<string, "invalidValue" | "returnQuantityExceeded"> = {};
      const seen = new Set<string>();
      for (const [index, line] of input.lines.entries()) {
        if (seen.has(line.orderLineId)) fields[`lines.${index}.orderLineId`] = "invalidValue";
        seen.add(line.orderLineId);
        const remaining = (
          await transaction.execute<{ remaining: string }>(sql`
          SELECT (l.base_quantity - coalesce((SELECT sum(rl.quantity) FROM marketplace.return_request_lines rl JOIN marketplace.return_requests r ON r.id = rl.request_id
            WHERE rl.order_line_id = l.id AND r.status IN (${sql.join(
              countedStatuses.map((status) => sql`${status}`),
              sql`, `,
            )})), 0))::text AS remaining
          FROM sales.order_lines l WHERE l.id = ${line.orderLineId} AND l.order_id = ${order.sales_order_id} AND NOT l.is_gift`)
        ).rows[0];
        if (!remaining) fields[`lines.${index}.orderLineId`] = "invalidValue";
        else if (line.quantity > Number(remaining.remaining) + 0.00005) fields[`lines.${index}.quantity`] = "returnQuantityExceeded";
      }
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const requestId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO marketplace.return_requests (order_id, buyer_user_id, reason, description) VALUES (${orderId}, ${userId}, ${input.reason}, ${input.description}) RETURNING id`)
      ).rows[0]!.id;
      for (const line of input.lines) {
        await transaction.execute(sql`INSERT INTO marketplace.return_request_lines (request_id, order_line_id, quantity) VALUES (${requestId}, ${line.orderLineId}, ${line.quantity})`);
      }
      for (const imageId of input.imageIds) {
        const attached = await transaction.execute(sql`
          UPDATE marketplace.return_request_images SET request_id = ${requestId} WHERE id = ${imageId} AND buyer_user_id = ${userId} AND request_id IS NULL RETURNING id`);
        if (attached.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { imageIds: "invalidValue" } });
      }
    });
    return buyerReturnRequests(this.database, orderId);
  }

  async withdraw(userId: string, requestId: string, version: number): Promise<ReturnRequestItem[]> {
    const row = (
      await this.database.execute<{ order_id: string }>(sql`
      UPDATE marketplace.return_requests SET status = 'withdrawn', closed_at = now(), version = version + 1
      WHERE id = ${requestId} AND buyer_user_id = ${userId} AND status = 'pending' AND version = ${version} RETURNING order_id`)
    ).rows[0];
    if (!row) {
      const exists = await this.database.execute(sql`SELECT 1 FROM marketplace.return_requests WHERE id = ${requestId} AND buyer_user_id = ${userId}`);
      throw exists.rows.length === 0 ? new ApiError("NOT_FOUND", "notFound") : new ApiError("CONFLICT_VERSION", "conflictVersion");
    }
    return buyerReturnRequests(this.database, row.order_id);
  }

  async list(actor: BuyerAdminActor, query: { status?: ReturnRequestStatus | undefined; page: number; pageSize: number }): Promise<PageResponse<ReturnRequestAdminItem>> {
    const where = sql`m.company_id = ${actor.operatorCompanyId} AND (${query.status ?? null}::text IS NULL OR r.status = ${query.status ?? null}::text)`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM marketplace.return_requests r JOIN marketplace.orders m ON m.id = r.order_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<RequestRow>(sql`${requestSelect} WHERE ${where} ORDER BY r.created_at DESC, r.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: await this.adminItems(rows.rows, true), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: BuyerAdminActor, requestId: string, canManage: boolean): Promise<ReturnRequestAdminItem> {
    const row = (await this.database.execute<RequestRow>(sql`${requestSelect} WHERE r.id = ${requestId} AND m.company_id = ${actor.operatorCompanyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return (await this.adminItems([row], canManage))[0]!;
  }

  private async adminItems(rows: RequestRow[], canManage: boolean): Promise<ReturnRequestAdminItem[]> {
    const items = await itemsOf(this.database, rows, "/api/v1/marketplace/return-requests/images");
    return items.map((item, index) => ({
      ...item,
      canWithdraw: false,
      buyerName: rows[index]!.buyer_name,
      buyerPhone: localPhone(rows[index]!.buyer_phone ?? ""),
      canDecide: canManage && item.status === "pending",
      canClose: canManage && item.status === "approved",
    }));
  }

  // Duyệt hoặc từ chối yêu cầu chờ duyệt; nhận hàng trả hoặc kết thúc khi không nhận được hàng; báo người mua (QUYTAC_NGHIEPVU_161).
  async decide(actor: BuyerAdminActor, requestId: string, action: "approve" | "reject" | "receive" | "not_received", note: string | null, version: number): Promise<ReturnRequestAdminItem> {
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ status: ReturnRequestStatus; version: number; order_id: string; buyer_user_id: string; sales_order_id: string; company_id: string }>(sql`
        SELECT r.status, r.version, r.order_id, r.buyer_user_id, m.sales_order_id, m.company_id FROM marketplace.return_requests r JOIN marketplace.orders m ON m.id = r.order_id
        WHERE r.id = ${requestId} FOR UPDATE OF r`)
      ).rows[0];
      if (!row || row.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const from = action === "approve" || action === "reject" ? "pending" : "approved";
      if (row.status !== from) throw new ApiError("BUSINESS_RULE", "returnRequestNotOpen");
      // Đơn đã hoàn tất thì giá trị hoàn tất đã chốt: không duyệt, không nhận hàng trả nữa.
      const orderState = (await transaction.execute<{ status: string }>(sql`SELECT status FROM marketplace.orders WHERE id = ${row.order_id} FOR UPDATE`)).rows[0]!.status;
      if (orderState !== "delivered" && action !== "reject" && action !== "not_received") throw new ApiError("BUSINESS_RULE", "returnRequestNotOpen");
      let documentId: string | null = null;
      if (action === "receive") {
        // Nhận hàng trả theo dòng, số lượng của yêu cầu: phiếu nhận hàng trả lại theo dòng phiếu xuất gốc.
        const lines = await transaction.execute<{ issue_id: string; issue_line_id: string; quantity: string }>(sql`
          SELECT d.id AS issue_id, dl.id AS issue_line_id, rl.quantity::text
          FROM marketplace.return_request_lines rl JOIN inventory.document_lines dl ON dl.source_line_id = rl.order_line_id
          JOIN inventory.documents d ON d.id = dl.document_id AND d.type = 'sales_issue' AND d.status = 'posted'
          WHERE rl.request_id = ${requestId} ORDER BY d.created_at, dl.line_no`);
        const issueId = lines.rows[0]?.issue_id;
        if (!issueId) throw new ApiError("BUSINESS_RULE", "salesIssueNotPosted");
        const system: Actor = { userId: actor.userId, companyId: actor.operatorCompanyId, client: actor.client };
        documentId = await this.deliveries.returnAsSystem(transaction, system, {
          issueId,
          documentDate: await vietnamToday(transaction),
          reason: "Người mua trả hàng trong 7 ngày",
          lines: lines.rows.map((line) => ({ issueLineId: line.issue_line_id, quantity: line.quantity })),
        });
        // Lập việc chờ hoàn tiền phần hàng trả (CONG_VIEC_25; QUYTAC_NGHIEPVU_168).
        await refundReturnedGoods(transaction, row.order_id, requestId);
      }
      const status = { approve: "approved", reject: "rejected", receive: "received", not_received: "not_received" }[action];
      const decided = action === "approve" || action === "reject";
      await transaction.execute(sql`
        UPDATE marketplace.return_requests SET status = ${status}, decision_note = coalesce(${note}, decision_note), stock_document_id = coalesce(${documentId}, stock_document_id),
          decided_by = CASE WHEN ${decided} THEN ${actor.userId}::uuid ELSE decided_by END, decided_at = CASE WHEN ${decided} THEN now() ELSE decided_at END,
          closed_by = CASE WHEN ${decided} THEN closed_by ELSE ${actor.userId}::uuid END, closed_at = CASE WHEN ${decided} AND ${action !== "reject"} THEN closed_at ELSE now() END,
          version = version + 1
        WHERE id = ${requestId}`);
      const titles = {
        approve: "Yêu cầu trả hàng đã được duyệt. Vui lòng gửi hàng về VComm theo hướng dẫn.",
        reject: "Yêu cầu trả hàng bị từ chối",
        receive: "VComm đã nhận hàng trả",
        not_received: "Yêu cầu trả hàng đã kết thúc: VComm không nhận được hàng",
      };
      await notify(transaction, [
        { userId: row.buyer_user_id, companyId: actor.operatorCompanyId, kind: `return_request.${status}`, title: titles[action], payload: { returnRequestId: requestId, orderId: row.order_id } },
      ]);
    });
    return this.detail(actor, requestId, true);
  }
}
