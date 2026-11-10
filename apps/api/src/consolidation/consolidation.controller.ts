// API_106 đến API_109: báo cáo tài chính hợp nhất (CONG_VIEC_20). Quyền phạm vi tập đoàn kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseIntPipe, Post, Put, Query, Req } from "@nestjs/common";
import {
  consolidationManualEntrySchema,
  consolidationPreviewQuerySchema,
  consolidationVersionSchema,
  createConsolidationSchema,
  saveConsolidationProfitSchema,
  type ConsolidatedStatementResponse,
  type ConsolidationResponse,
  type ConsolidationScopeResponse,
  type ConsolidationsResponse,
} from "contracts";
import { z } from "zod";
import { UuidPipe } from "../common/uuid.pipe";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ConsolidationService } from "./consolidation.service";

@Controller("finance/consolidation")
export class ConsolidationController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly consolidation: ConsolidationService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.consolidation.view", "finance.consolidation.manage");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("scope")
  async scope(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ConsolidationScopeResponse> {
    return this.consolidation.scope(await this.actor(request, companyId));
  }

  @Get("preview")
  async preview(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ConsolidatedStatementResponse> {
    return this.consolidation.preview(await this.actor(request, companyId), consolidationPreviewQuerySchema.parse(query));
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ConsolidationsResponse> {
    return this.consolidation.list(await this.actor(request, companyId));
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ConsolidationResponse> {
    const input = createConsolidationSchema.parse(body);
    return this.consolidation.create(await this.actor(request, companyId), input.from, input.to);
  }

  @Get(":id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ConsolidationResponse> {
    return this.consolidation.detail(await this.actor(request, companyId), id);
  }

  @Post(":id/recalculate")
  async recalculate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ConsolidationResponse> {
    return this.consolidation.recalculate(await this.actor(request, companyId), id, consolidationVersionSchema.parse(body).version);
  }

  @Put(":id/profit-lines/:lineId")
  async saveProfit(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("lineId", UuidPipe) lineId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ConsolidationResponse> {
    return this.consolidation.saveProfit(await this.actor(request, companyId), id, lineId, saveConsolidationProfitSchema.parse(body));
  }

  @Post(":id/entries")
  async addManual(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ConsolidationResponse> {
    return this.consolidation.addManual(await this.actor(request, companyId), id, consolidationManualEntrySchema.parse(body));
  }

  @Delete(":id/entries/:entryNo")
  async removeManual(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("entryNo", ParseIntPipe) entryNo: number,
    @Query("version") version: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ConsolidationResponse> {
    return this.consolidation.removeManual(await this.actor(request, companyId), id, entryNo, z.coerce.number().int().min(0).parse(version));
  }

  @Post(":id/discard")
  @HttpCode(204)
  async discard(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.consolidation.discard(await this.actor(request, companyId), id, consolidationVersionSchema.parse(body).version);
  }
}
