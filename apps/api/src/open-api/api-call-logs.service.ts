// Nhật ký gọi API đối tác (CHUC_NANG_218; QUYTAC_NGHIEPVU_488; API_259): ghi mỗi lần gọi đã xác định được khóa, tra cứu, dọn dòng quá 90 ngày.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ApiCallLogItem, apiCallLogQuerySchema, PageResponse } from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { DATABASE, type Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";

export const callLogRetentionDays = 90;
// Chỉ giữ tham số truy vấn không chứa dữ liệu cá nhân (QUYTAC_NGHIEPVU_488).
const loggedQueryParameters = new Set(["page", "pageSize", "warehouse", "updatedSince", "status"]);

export interface ApiCallRecord {
  apiKeyId: string;
  companyId: string;
  method: string;
  url: string;
  statusCode: number;
  errorCode: string | null;
  durationMs: number;
  ip: string | null;
  requestId: string | null;
}

export function loggedPath(url: string): string {
  const parsed = new URL(url, "http://may-chu.local");
  const kept = [...parsed.searchParams.entries()].filter(([name]) => loggedQueryParameters.has(name));
  const query = kept.length > 0 ? `?${new URLSearchParams(kept).toString()}` : "";
  return `${parsed.pathname}${query}`.slice(0, 300);
}

const resultCondition = (result: z.output<typeof apiCallLogQuerySchema>["result"]): SQL | null => {
  if (result === "success") return sql`l.status_code < 400`;
  if (result === "rate_limited") return sql`l.status_code = 429`;
  if (result === "client_error") return sql`l.status_code BETWEEN 400 AND 499 AND l.status_code <> 429`;
  if (result === "server_error") return sql`l.status_code >= 500`;
  return null;
};

@Injectable()
export class ApiCallLogsService {
  private readonly logger = new Logger("ApiCallLogs");

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Lỗi ghi nhật ký chỉ ghi log máy chủ, không làm hỏng lần gọi (mục 15 đặc tả).
  async record(entry: ApiCallRecord): Promise<void> {
    try {
      await this.database.execute(sql`
        INSERT INTO core.api_call_logs (api_key_id, company_id, method, path, status_code, error_code, duration_ms, ip, request_id)
        VALUES (${entry.apiKeyId}, ${entry.companyId}, ${entry.method.toUpperCase()}, ${loggedPath(entry.url)}, ${entry.statusCode}, ${entry.errorCode?.slice(0, 50) ?? null},
          ${Math.max(0, Math.round(entry.durationMs))}, ${entry.ip}::inet, ${entry.requestId?.slice(0, 100) ?? null})`);
    } catch (error) {
      this.logger.error(`Không ghi được nhật ký gọi API: ${(error as Error).message}`);
    }
  }

  async list(actor: Actor, query: z.output<typeof apiCallLogQuerySchema>): Promise<PageResponse<ApiCallLogItem>> {
    const conditions: SQL[] = [sql`l.company_id = ${actor.companyId}`];
    if (query.apiKeyId) conditions.push(sql`l.api_key_id = ${query.apiKeyId}`);
    const result = resultCondition(query.result);
    if (result) conditions.push(result);
    if (query.from) conditions.push(sql`l.called_at >= ${query.from}::timestamptz`);
    if (query.to) conditions.push(sql`l.called_at <= ${query.to}::timestamptz`);
    if (query.path) conditions.push(sql`strpos(l.path, ${query.path}) > 0`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM core.api_call_logs l WHERE ${where}`)).rows[0]?.total ?? 0;
    const rows = await this.database.execute<{
      id: string;
      called_at: Date;
      api_key_id: string;
      api_key_name: string;
      method: string;
      path: string;
      status_code: number;
      error_code: string | null;
      duration_ms: number;
      ip: string | null;
      request_id: string | null;
    }>(sql`
      SELECT l.id::text AS id, l.called_at, l.api_key_id, k.name AS api_key_name, l.method, l.path, l.status_code, l.error_code, l.duration_ms, host(l.ip) AS ip, l.request_id
      FROM core.api_call_logs l JOIN core.api_keys k ON k.id = l.api_key_id
      WHERE ${where} ORDER BY l.called_at DESC, l.id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return {
      data: rows.rows.map((row) => ({
        id: row.id,
        calledAt: new Date(row.called_at).toISOString(),
        apiKeyId: row.api_key_id,
        apiKeyName: row.api_key_name,
        method: row.method,
        path: row.path,
        statusCode: row.status_code,
        errorCode: row.error_code,
        durationMs: row.duration_ms,
        ip: row.ip,
        requestId: row.request_id,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  // Tác vụ nền hằng ngày: xóa dòng quá 90 ngày (QUYTAC_NGHIEPVU_488).
  async purgeExpired(now: Date): Promise<number> {
    const result = await this.database.execute(sql`DELETE FROM core.api_call_logs WHERE called_at < ${now.toISOString()}::timestamptz - make_interval(days => ${callLogRetentionDays})`);
    return result.rowCount ?? 0;
  }
}
