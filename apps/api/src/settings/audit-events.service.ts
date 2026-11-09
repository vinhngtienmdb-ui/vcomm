// Tra cứu nhật ký thao tác (CHUC_NANG_23; QUYTAC_NGHIEPVU_30; API_47). Chỉ đọc: không có hàm sửa, xóa.
import { Inject, Injectable } from "@nestjs/common";
import type { AuditEventDetail, AuditEventItem, PageResponse, auditEventListQuerySchema } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

const viewAudit = "platform.audit.view";

type EventRow = {
  id: string;
  occurred_at: Date;
  actor_user_id: string | null;
  actor_name: string | null;
  company_short_name: string | null;
  app_code: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
};

const toItem = (row: EventRow): AuditEventItem => ({
  id: row.id,
  occurredAt: new Date(row.occurred_at).toISOString(),
  actorUserId: row.actor_user_id,
  actorName: row.actor_name,
  companyShortName: row.company_short_name,
  appCode: row.app_code,
  action: row.action,
  entityType: row.entity_type,
  entityId: row.entity_id,
  entityLabel: row.entity_label,
});

// Tên dễ đọc của đối tượng theo loại.
const selectEvents = sql`
  SELECT e.id, e.occurred_at, e.actor_user_id, actor.full_name AS actor_name, company.short_name AS company_short_name, e.app_code, e.action, e.entity_type, e.entity_id,
    CASE
      WHEN e.entity_type IN ('user', 'core.users') THEN COALESCE((SELECT full_name FROM core.users WHERE id = e.entity_id), e.after_data ->> 'identifier')
      WHEN e.entity_type = 'company' THEN (SELECT short_name FROM core.companies WHERE id = e.entity_id)
      WHEN e.entity_type = 'branch' THEN (SELECT code || ' – ' || name FROM core.branches WHERE id = e.entity_id)
      WHEN e.entity_type = 'department' THEN (SELECT name FROM core.departments WHERE id = e.entity_id)
      WHEN e.entity_type = 'role' THEN (SELECT name_vi FROM core.roles WHERE id = e.entity_id)
      WHEN e.entity_type = 'approval_request' THEN (SELECT document_no FROM core.approval_requests WHERE id = e.entity_id)
      WHEN e.entity_type = 'exchange_rate' THEN (SELECT from_currency || ' → ' || to_currency || ' ' || to_char(rate_date, 'DD/MM/YYYY') FROM core.exchange_rates WHERE id = e.entity_id)
      WHEN e.entity_type = 'number_sequence' THEN (SELECT name_vi FROM core.document_types WHERE code = e.after_data ->> 'documentTypeCode')
      WHEN e.entity_type = 'approval_policy' THEN (SELECT t.name_vi || ' – ' || to_char(p.effective_from, 'DD/MM/YYYY') FROM core.approval_policies p JOIN core.document_types t ON t.code = p.document_type_code WHERE p.id = e.entity_id)
      ELSE NULL
    END AS entity_label
  FROM core.audit_events e
  LEFT JOIN core.users actor ON actor.id = e.actor_user_id
  LEFT JOIN core.companies company ON company.id = e.company_id`;

@Injectable()
export class AuditEventsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  async list(actor: Actor, query: z.output<typeof auditEventListQuerySchema>): Promise<PageResponse<AuditEventItem>> {
    const conditions = [await this.scopeCondition(actor)];
    if (query.actorUserId) conditions.push(sql`e.actor_user_id = ${query.actorUserId}`);
    if (query.appCode) conditions.push(sql`e.app_code = ${query.appCode}`);
    if (query.entityType) conditions.push(sql`e.entity_type = ${query.entityType}`);
    if (query.entityId) conditions.push(sql`e.entity_id = ${query.entityId}`);
    if (query.action) conditions.push(sql`e.action = ${query.action}`);
    // Ngày lọc theo giờ Việt Nam.
    if (query.from) conditions.push(sql`e.occurred_at >= (${query.from}::date)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    if (query.to) conditions.push(sql`e.occurred_at < (${query.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'`);
    const where = sql.join(conditions, sql` AND `);
    const total = await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM core.audit_events e WHERE ${where}`);
    const rows = await this.database.execute<EventRow>(sql`
      ${selectEvents} WHERE ${where} ORDER BY e.occurred_at DESC, e.id
      LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map(toItem),
      page: query.page,
      pageSize: query.pageSize,
      total: total.rows[0]?.total ?? 0,
    };
  }

  // Dòng ngoài phạm vi trả 404 như không tồn tại.
  async detail(actor: Actor, id: string): Promise<AuditEventDetail> {
    const row = (
      await this.database.execute<
        EventRow & {
          before_data: unknown;
          after_data: unknown;
          ip: string | null;
          user_agent: string | null;
          request_id: string | null;
        }
      >(sql`
      SELECT listed.*, e.before_data, e.after_data, host(e.ip) AS ip, e.user_agent, e.request_id
      FROM (${selectEvents} WHERE e.id = ${id} AND ${await this.scopeCondition(actor)}) listed
      JOIN core.audit_events e ON e.id = listed.id AND e.occurred_at = listed.occurred_at`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return {
      ...toItem(row),
      beforeData: row.before_data,
      afterData: row.after_data,
      ip: row.ip,
      userAgent: row.user_agent,
      requestId: row.request_id,
    };
  }

  // Quản trị tập đoàn xem toàn tập đoàn; quản trị công ty chỉ xem nhật ký của công ty đang chọn.
  private async scopeCondition(actor: Actor): Promise<SQL> {
    if (
      (
        await this.permissionService.permissionsCovering(actor.userId, {
          scopeType: "group",
        })
      ).has(viewAudit)
    )
      return sql`TRUE`;
    if (
      (
        await this.permissionService.permissionsCovering(actor.userId, {
          scopeType: "company",
          companyId: actor.companyId,
        })
      ).has(viewAudit)
    ) {
      return sql`e.company_id = ${actor.companyId}`;
    }
    throw new ApiError("FORBIDDEN", "forbidden");
  }

  // Tạo trước partition của tháng hiện tại và hai tháng sau (tài liệu 16); tác vụ nền gọi mỗi ngày.
  async ensurePartitions(today: string): Promise<string[]> {
    const created: string[] = [];
    const [year, month] = today.split("-").map(Number) as [number, number];
    for (let offset = 0; offset < 3; offset += 1) {
      const start = new Date(Date.UTC(year, month - 1 + offset, 1));
      const end = new Date(Date.UTC(year, month + offset, 1));
      const name = `audit_events_${start.getUTCFullYear()}_${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
      const exists = await this.database.execute(sql`SELECT 1 FROM pg_tables WHERE schemaname = 'core' AND tablename = ${name}`);
      if (exists.rows.length > 0) continue;
      const from = start.toISOString().slice(0, 10);
      const to = end.toISOString().slice(0, 10);
      await this.database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS core.${name} PARTITION OF core.audit_events FOR VALUES FROM ('${from}') TO ('${to}')`));
      created.push(name);
    }
    return created;
  }
}
