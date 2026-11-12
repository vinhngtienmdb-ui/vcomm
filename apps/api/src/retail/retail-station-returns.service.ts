// Nhận hàng trả của đơn VComm tại trạm giao hàng O2O (CONG_VIEC_57; CHUC_NANG_203; QUYTAC_NGHIEPVU_430; API_226; MAN_HINH_194).
// Yêu cầu trả hàng do vận hành sàn duyệt (QUYTAC_NGHIEPVU_161); trạm của đơn xác nhận đã nhận: phiếu nhận hàng trả lại vào kho trạm, việc chờ hoàn tiền.
import { Inject, Injectable } from "@nestjs/common";
import type { ReturnReason, ReturnRequestStatus, stationReturnListQuerySchema, StationReturnItem, StationReturnListResponse } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { ReturnRequestsService } from "../marketplace/return-requests.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { retailAudit, retailPermissions, retailPermissionsAt, retailScope, scopeCondition } from "./retail-context";

type ListQuery = z.output<typeof stationReturnListQuerySchema>;

type Row = {
  id: string;
  order_id: string;
  document_no: string;
  store_id: string;
  store_name: string;
  branch_id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_user_id: string;
  status: ReturnRequestStatus;
  reason: ReturnReason;
  description: string;
  decided_at: Date | null;
  closed_at: Date | null;
  received_by_name: string | null;
  stock_document_id: string | null;
  stock_document_no: string | null;
  order_status: string;
  version: number;
};

const rowSelect = sql`
  SELECT r.id, r.order_id, so.document_no, s.id AS store_id, s.display_name AS store_name, s.branch_id, u.full_name AS buyer_name, u.phone AS buyer_phone, r.buyer_user_id,
    r.status, r.reason, r.description, r.decided_at, r.closed_at, cu.full_name AS received_by_name, r.stock_document_id, d.document_no AS stock_document_no, m.status AS order_status, r.version
  FROM marketplace.return_requests r
  JOIN marketplace.orders m ON m.id = r.order_id
  JOIN sales.orders so ON so.id = m.sales_order_id
  JOIN retail.stores s ON s.id = m.station_id
  JOIN core.users u ON u.id = r.buyer_user_id
  LEFT JOIN core.users cu ON cu.id = r.closed_by
  LEFT JOIN inventory.documents d ON d.id = r.stock_document_id`;
const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);
const localPhone = (phone: string | null) => (phone ? phone.replace(/^\+84/, "0") : "");
const pageSize = 20;

@Injectable()
export class RetailStationReturnsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly returns: ReturnRequestsService,
  ) {}

  // Phạm vi: người xử lý đơn trực tuyến tại chi nhánh của trạm (QUYTAC_NGHIEPVU_431).
  private async visibility(actor: Actor): Promise<SQL> {
    const scope = await retailScope(this.permissionService, actor, retailPermissions.o2o);
    if (!scope) throw new ApiError("FORBIDDEN", "forbidden");
    return scopeCondition(scope, sql`s.branch_id`);
  }

  private async items(rows: Row[], canReceive: (row: Row) => boolean): Promise<StationReturnItem[]> {
    if (rows.length === 0) return [];
    const ids = sql.join(
      rows.map((row) => sql`${row.id}::uuid`),
      sql`, `,
    );
    const lines = await this.database.execute<{ request_id: string; order_line_id: string; quantity: string; name: string; option_values: string[] | null }>(sql`
      SELECT rl.request_id, rl.order_line_id, rl.quantity::text, p.name, v.option_values
      FROM marketplace.return_request_lines rl JOIN sales.order_lines l ON l.id = rl.order_line_id JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products p ON p.id = v.product_id
      WHERE rl.request_id IN (${ids}) ORDER BY l.line_no`);
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      documentNo: row.document_no,
      store: { id: row.store_id, name: row.store_name },
      buyerName: row.buyer_name,
      buyerPhone: localPhone(row.buyer_phone),
      status: row.status,
      reason: row.reason,
      description: row.description,
      lines: lines.rows
        .filter((line) => line.request_id === row.id)
        .map((line) => ({ orderLineId: line.order_line_id, productName: line.name, variantLabel: (line.option_values ?? []).filter(Boolean).join(" · "), quantity: trimDecimal(line.quantity) })),
      decidedAt: iso(row.decided_at),
      closedAt: iso(row.closed_at),
      receivedByName: row.status === "received" ? row.received_by_name : null,
      stockDocument: row.stock_document_id ? { id: row.stock_document_id, documentNo: row.stock_document_no ?? "" } : null,
      canReceive: canReceive(row),
      version: row.version,
    }));
  }

  // Yêu cầu đã duyệt chờ trạm nhận, hoặc đã nhận tại trạm.
  async list(actor: Actor, query: ListQuery): Promise<StationReturnListResponse> {
    const conditions: SQL[] = [sql`m.company_id = ${actor.companyId}`, sql`r.status = ${query.status}`, await this.visibility(actor)];
    if (query.storeId) conditions.push(sql`m.station_id = ${query.storeId}`);
    const text = query.search?.trim() ?? "";
    if (text) {
      const digits = text.replace(/[^0-9]/g, "");
      const phone = digits.startsWith("0") ? `+84${digits.slice(1)}` : digits;
      conditions.push(sql`(upper(so.document_no) = upper(${text}) OR (${digits.length >= 6} AND u.phone LIKE ${`%${phone}%`}))`);
    }
    const where = sql.join(conditions, sql` AND `);
    const order = query.status === "approved" ? sql`r.decided_at, r.id` : sql`r.closed_at DESC, r.id`;
    const [rows, total] = await Promise.all([
      this.database.execute<Row>(sql`${rowSelect} WHERE ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(query.page - 1) * pageSize}`),
      this.database.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM marketplace.return_requests r JOIN marketplace.orders m ON m.id = r.order_id JOIN sales.orders so ON so.id = m.sales_order_id
        JOIN retail.stores s ON s.id = m.station_id JOIN core.users u ON u.id = r.buyer_user_id WHERE ${where}`),
    ]);
    return { items: await this.items(rows.rows, (row) => row.status === "approved" && row.order_status === "delivered"), total: total.rows[0]!.total, page: query.page };
  }

  // Đã nhận hàng trả (QUYTAC_NGHIEPVU_430): trong một giao dịch ghi phiếu nhận hàng trả lại vào kho trạm theo dòng phiếu xuất, lập việc chờ hoàn tiền, đóng yêu cầu, báo người mua.
  async receive(actor: Actor, id: string, version: number): Promise<StationReturnItem> {
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<Row>(sql`${rowSelect} WHERE r.id = ${id} AND m.company_id = ${actor.companyId} AND ${await this.visibility(actor)} FOR UPDATE OF r`)).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      const granted = await retailPermissionsAt(this.permissionService, actor, row.branch_id);
      if (!granted.has(retailPermissions.o2o)) throw new ApiError("FORBIDDEN", "forbidden");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "approved") throw new ApiError("BUSINESS_RULE", "returnRequestNotOpen");
      // Đơn đã hoàn tất thì giá trị hoàn tất đã chốt (như QUYTAC_NGHIEPVU_161).
      const orderState = (await transaction.execute<{ status: string }>(sql`SELECT status FROM marketplace.orders WHERE id = ${row.order_id} FOR UPDATE`)).rows[0]!.status;
      if (orderState !== "delivered") throw new ApiError("BUSINESS_RULE", "returnRequestNotOpen");
      const documentId = await this.returns.receiveWithin(transaction, actor, id, row.order_id);
      await transaction.execute(sql`
        UPDATE marketplace.return_requests SET status = 'received', stock_document_id = ${documentId}, closed_by = ${actor.userId}, closed_at = now(), version = version + 1 WHERE id = ${id}`);
      await notify(transaction, [
        {
          userId: row.buyer_user_id,
          companyId: actor.companyId,
          kind: "return_request.received",
          title: `Trạm ${row.store_name} đã nhận hàng trả của đơn ${row.document_no}`,
          payload: { returnRequestId: id, orderId: row.order_id },
        },
      ]);
      await this.auditService.record(
        { ...retailAudit(actor, "return_request"), action: "station_return.receive", entityId: id, afterData: { storeId: row.store_id, stockDocumentId: documentId } },
        transaction,
      );
    });
    const row = (await this.database.execute<Row>(sql`${rowSelect} WHERE r.id = ${id}`)).rows[0]!;
    return (await this.items([row], () => false))[0]!;
  }
}
