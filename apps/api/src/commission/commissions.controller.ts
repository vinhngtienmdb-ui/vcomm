// API_93, API_94: cài đặt hoa hồng, chỉ tiêu, phát sinh, bảng hoa hồng (CONG_VIEC_17). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  commissionEventsQuerySchema,
  createCommissionStatementSchema,
  type CommissionStatementResponse,
  type CommissionStatementsResponse,
  commissionTargetsQuerySchema,
  saveCommissionTargetsSchema,
  updateCommissionSettingsSchema,
  type CommissionEventItem,
  type CommissionSettingsResponse,
  type CommissionTargetsResponse,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { UuidPipe } from "../common/uuid.pipe";
import { z } from "zod";
import { CommissionStatementsService } from "./commission-statements.service";
import { CommissionsService } from "./commissions.service";

@Controller("finance")
export class CommissionsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly commissions: CommissionsService,
    private readonly statements: CommissionStatementsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.commission.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("commission-settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CommissionSettingsResponse> {
    return this.commissions.settings(await this.actor(request, companyId));
  }

  @Put("commission-settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CommissionSettingsResponse> {
    return this.commissions.updateSettings(await this.actor(request, companyId), updateCommissionSettingsSchema.parse(body));
  }

  @Get("commission-targets")
  async targets(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<CommissionTargetsResponse> {
    return this.commissions.targets(await this.actor(request, companyId), commissionTargetsQuerySchema.parse(query).month);
  }

  @Put("commission-targets")
  async saveTargets(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CommissionTargetsResponse> {
    return this.commissions.saveTargets(await this.actor(request, companyId), saveCommissionTargetsSchema.parse(body));
  }

  @Get("commissions/events")
  async events(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<CommissionEventItem>> {
    return this.commissions.events(await this.actor(request, companyId), commissionEventsQuerySchema.parse(query));
  }

  @Get("commissions/statements")
  async statementList(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CommissionStatementsResponse> {
    return this.statements.list(await this.actor(request, companyId));
  }

  @Post("commissions/statements")
  async createStatement(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CommissionStatementResponse> {
    return this.statements.create(await this.actor(request, companyId), createCommissionStatementSchema.parse(body).month);
  }

  @Get("commissions/statements/:id")
  async statement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CommissionStatementResponse> {
    return this.statements.detail(await this.actor(request, companyId), id);
  }

  @Post("commissions/statements/:id/submit")
  async submitStatement(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CommissionStatementResponse> {
    return this.statements.submit(
      await this.actor(request, companyId),
      id,
      z
        .object({ version: z.number().int().min(0) })
        .strict()
        .parse(body).version,
    );
  }

  @Post("commissions/statements/:id/withdraw")
  async withdrawStatement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CommissionStatementResponse> {
    return this.statements.withdraw(await this.actor(request, companyId), id);
  }

  @Delete("commissions/statements/:id")
  async discardStatement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CommissionStatementsResponse> {
    return this.statements.discard(await this.actor(request, companyId), id);
  }
}
