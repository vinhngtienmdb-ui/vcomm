// Xác thực khóa API đối tác cho API gốc /api/v1/open (CHUC_NANG_218; QUYTAC_NGHIEPVU_484 đến 488).
// Bộ điều khiển gắn @Public() @OwnRateLimit() để guard đăng nhập của nhân viên cho qua; guard này tự xác thực, giới hạn tần suất, ghi nhật ký gọi.
import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ApiKeyKind, ApiKeyScope } from "contracts";
import { sql } from "drizzle-orm";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ApiError } from "../common/api-error";
import { CLOCK, type Clock, vietnamDate } from "../common/clock";
import { RateLimiter } from "../common/rate-limiter";
import { DATABASE, type Database } from "../database/database.module";
import { hashApiKey, isApiKeyFormat } from "./api-key-secret";
import { ApiCallLogsService } from "./api-call-logs.service";
import { ipAllowed, normalizeIp } from "./ip-allow-list";

const scopeKey = "openApiScope";
export const RequireScope = (scope: ApiKeyScope) => SetMetadata(scopeKey, scope);

export interface OpenApiCaller {
  keyId: string;
  keyName: string;
  keyPrefix: string;
  kind: ApiKeyKind;
  companyId: string;
  partnerId: string | null;
  customerGroupId: string | null;
  channelId: string;
  warehouseIds: string[];
  scopes: ApiKeyScope[];
}

export type OpenApiRequest = Request & { openApi: OpenApiCaller };

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  kind: ApiKeyKind;
  company_id: string;
  partner_id: string | null;
  channel_id: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute: number;
  expires_on: string | null;
  allowed_ips: string[];
  status: "active" | "revoked";
  warehouse_ids: string[];
  customer_group_id: string | null;
  partner_active: boolean;
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly rateLimiter: RateLimiter,
    private readonly callLogs: ApiCallLogsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<OpenApiRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const startedAt = performance.now();
    // Mã yêu cầu để đối tác báo lỗi; bộ lọc lỗi dùng lại cùng mã.
    const requestId = request.header("x-request-id")?.slice(0, 100) || randomUUID();
    request.headers["x-request-id"] = requestId;
    response.setHeader("X-Request-Id", requestId);
    const ip = request.ip ? normalizeIp(request.ip) : null;

    const token = /^Bearer\s+(\S+)$/i.exec(request.header("authorization") ?? "")?.[1] ?? "";
    const key = isApiKeyFormat(token) ? await this.findKey(hashApiKey(token)) : null;
    if (!key) {
      // Không xác định được khóa: không gắn được công ty nên không ghi nhật ký gọi; đếm theo IP (QUYTAC_NGHIEPVU_484).
      const retryAfterSeconds = await this.rateLimiter.hit("open-api-unauthorized", ip ?? "khong-ro");
      if (retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds });
      throw new ApiError("UNAUTHENTICATED", "openApiUnauthenticated");
    }

    response.on("finish", () => {
      void this.callLogs.record({
        apiKeyId: key.id,
        companyId: key.company_id,
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        errorCode: (response.locals.errorCode as string | undefined) ?? null,
        durationMs: performance.now() - startedAt,
        ip,
        requestId,
      });
    });

    const today = vietnamDate(this.clock.now());
    const expired = key.expires_on !== null && key.expires_on < today;
    if (key.status !== "active" || expired || (key.kind === "partner" && !key.partner_active)) throw new ApiError("UNAUTHENTICATED", "openApiUnauthenticated");
    if (!ipAllowed(ip ?? undefined, key.allowed_ips)) throw new ApiError("IP_NOT_ALLOWED", "ipNotAllowed");

    const limit = await this.rateLimiter.consume(`open-api-key:${key.id}`, key.rate_limit_per_minute);
    response.setHeader("X-RateLimit-Limit", String(key.rate_limit_per_minute));
    response.setHeader("X-RateLimit-Remaining", String(limit.remaining));
    if (limit.retryAfterSeconds !== null) throw new ApiError("RATE_LIMITED", "rateLimited", { retryAfterSeconds: limit.retryAfterSeconds });

    const scope = this.reflector.getAllAndOverride<ApiKeyScope | undefined>(scopeKey, [context.getHandler(), context.getClass()]);
    if (!scope || !key.scopes.includes(scope)) throw new ApiError("SCOPE_NOT_GRANTED", "scopeNotGranted");

    // Ghi lần dùng gần nhất tối đa một lần mỗi phút (mục 15 đặc tả).
    await this.database.execute(sql`
      UPDATE core.api_keys SET last_used_at = now() WHERE id = ${key.id} AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')`);

    request.openApi = {
      keyId: key.id,
      keyName: key.name,
      keyPrefix: key.key_prefix,
      kind: key.kind,
      companyId: key.company_id,
      partnerId: key.partner_id,
      customerGroupId: key.customer_group_id,
      channelId: key.channel_id,
      warehouseIds: key.warehouse_ids,
      scopes: key.scopes,
    };
    return true;
  }

  private async findKey(hash: string): Promise<KeyRow | null> {
    const row = (
      await this.database.execute<KeyRow>(sql`
      SELECT k.id, k.name, k.key_prefix, k.kind, k.company_id, k.partner_id, k.channel_id, k.scopes, k.rate_limit_per_minute, k.expires_on::text AS expires_on,
        k.allowed_ips::text[] AS allowed_ips, k.status,
        ARRAY(SELECT w.warehouse_id::text FROM core.api_key_warehouses w WHERE w.api_key_id = k.id) AS warehouse_ids,
        pp.customer_group_id,
        coalesce(p.status = 'active' AND pp.status = 'active' AND pp.is_customer, false) AS partner_active
      FROM core.api_keys k
      LEFT JOIN crm.partners p ON p.id = k.partner_id
      LEFT JOIN crm.partner_profiles pp ON pp.company_id = k.company_id AND pp.partner_id = k.partner_id
      WHERE k.key_hash = ${hash}`)
    ).rows[0];
    return row ?? null;
  }
}
