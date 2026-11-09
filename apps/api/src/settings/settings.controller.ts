// API_43, API_45 đến API_48: dãy số chứng từ, tỷ giá, tiền tệ, nhật ký thao tác, thông báo.
import { Body, Controller, Get, Headers, HttpCode, Inject, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  auditEventListQuerySchema,
  createExchangeRateSchema,
  exchangeRateListQuerySchema,
  updateExchangeRateSchema,
  updateNumberSequenceSchema,
  type AuditEventDetail,
  type AuditEventItem,
  type CurrencyResponse,
  type ExchangeRateListResponse,
  type ExchangeRateResponse,
  type NotificationListResponse,
  type NumberSequenceResponse,
  type PageResponse,
} from "contracts";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AuditEventsService } from "./audit-events.service";
import { ExchangeRatesService } from "./exchange-rates.service";
import { NumberSequencesService } from "./number-sequences.service";

const documentTypeCode = z.string().regex(/^[a-z_]+\.[a-z_]+$/);

@Controller()
export class SettingsController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly numberSequences: NumberSequencesService,
    private readonly exchangeRates: ExchangeRatesService,
    private readonly auditEvents: AuditEventsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, ...anyOf);
    return {
      userId: request.auth.userId,
      companyId,
      client: clientInfo(request),
    };
  }

  @Get("number-sequences")
  async listSequences(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<NumberSequenceResponse[]> {
    return this.numberSequences.list(await this.actor(request, companyId, "platform.number_sequence.manage"));
  }

  @Patch("number-sequences/:documentTypeCode")
  async updateSequence(@Req() request: AuthenticatedRequest, @Param("documentTypeCode") code: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<NumberSequenceResponse> {
    const actor = await this.actor(request, companyId, "platform.number_sequence.manage");
    if (!documentTypeCode.safeParse(code).success) throw new ApiError("NOT_FOUND", "notFound");
    return this.numberSequences.update(actor, code, updateNumberSequenceSchema.parse(body));
  }

  // Mọi nhân viên đã đăng nhập xem được tỷ giá (CHUC_NANG_21).
  @Get("exchange-rates")
  async listRates(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ExchangeRateListResponse> {
    const input = exchangeRateListQuerySchema.parse(query);
    return this.exchangeRates.list(await this.memberActor(request, companyId), input.date);
  }

  @Post("exchange-rates")
  async createRate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ExchangeRateResponse> {
    const actor = await this.memberActor(request, companyId);
    return this.exchangeRates.create(actor, createExchangeRateSchema.parse(body));
  }

  @Patch("exchange-rates/:id")
  async updateRate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ExchangeRateResponse> {
    const actor = await this.memberActor(request, companyId);
    return this.exchangeRates.update(actor, id, updateExchangeRateSchema.parse(body));
  }

  @Get("currencies")
  async currencies(): Promise<CurrencyResponse[]> {
    return this.exchangeRates.currencies();
  }

  // API_47: chỉ có hai endpoint đọc; không có endpoint sửa, xóa (QUYTAC_NGHIEPVU_30).
  @Get("audit-events")
  async listAudit(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<AuditEventItem>> {
    const input = auditEventListQuerySchema.parse(query);
    return this.auditEvents.list(await this.actor(request, companyId, "platform.audit.view"), input);
  }

  @Get("audit-events/:id")
  async auditDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<AuditEventDetail> {
    return this.auditEvents.detail(await this.actor(request, companyId, "platform.audit.view"), id);
  }

  // API_48: thông báo của chính mình, mới nhất trước.
  @Get("notifications")
  async notifications(@Req() request: AuthenticatedRequest): Promise<NotificationListResponse> {
    const userId = request.auth.userId;
    const rows = await this.database.execute<{
      id: string;
      kind: string;
      title: string;
      link: string | null;
      payload: Record<string, unknown>;
      read_at: Date | null;
      created_at: Date;
    }>(sql`
      SELECT id, kind, title, link, payload, read_at, created_at FROM core.notifications WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 30`);
    const unread = await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM core.notifications WHERE user_id = ${userId} AND read_at IS NULL`);
    return {
      unreadCount: unread.rows[0]?.total ?? 0,
      data: rows.rows.map((row) => ({ id: row.id, kind: row.kind, title: row.title, link: row.link, payload: row.payload, readAt: row.read_at ? new Date(row.read_at).toISOString() : null, createdAt: new Date(row.created_at).toISOString() })),
    };
  }

  @Post("notifications/:id/read")
  @HttpCode(204)
  async readNotification(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    const updated = await this.database.execute(sql`
      UPDATE core.notifications SET read_at = COALESCE(read_at, now()) WHERE id = ${id} AND user_id = ${request.auth.userId} RETURNING id`);
    if (updated.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  // Nhân viên thuộc công ty đang chọn, không cần quyền riêng.
  private async memberActor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return {
      userId: request.auth.userId,
      companyId,
      client: clientInfo(request),
    };
  }
}
