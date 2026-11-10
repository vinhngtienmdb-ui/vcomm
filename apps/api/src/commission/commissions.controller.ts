// API_93, API_94: cài đặt hoa hồng, chỉ tiêu, phát sinh, bảng hoa hồng (CONG_VIEC_17). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Put, Query, Req } from "@nestjs/common";
import {
  commissionEventsQuerySchema,
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
import { CommissionsService } from "./commissions.service";

@Controller("finance")
export class CommissionsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly commissions: CommissionsService,
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
}
