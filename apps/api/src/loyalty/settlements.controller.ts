// API_249, API_250: bảng đối soát nợ nội bộ điểm thưởng (CONG_VIEC_60). Xem, xác nhận theo công ty đang chọn (công ty vận hành sàn hoặc công ty con); quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Post, Query, Req } from "@nestjs/common";
import { loyaltySettlementDisputeSchema, loyaltySettlementListQuerySchema, loyaltySettlementVersionSchema, type LoyaltySettlementResponse, type LoyaltySettlementsResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { LoyaltySettlementsService, settlementPermissions } from "./settlements.service";

@Controller("loyalty/settlements")
export class LoyaltySettlementsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly settlements: LoyaltySettlementsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", settlementPermissions.view, settlementPermissions.manage);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<LoyaltySettlementsResponse> {
    return this.settlements.list(await this.actor(request, companyId), loyaltySettlementListQuerySchema.parse(query));
  }

  @Get(":id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<LoyaltySettlementResponse> {
    return this.settlements.detail(await this.actor(request, companyId), id);
  }

  @Post(":id/rebuild")
  async rebuild(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LoyaltySettlementResponse> {
    return this.settlements.rebuild(await this.actor(request, companyId), id, loyaltySettlementVersionSchema.parse(body).version);
  }

  @Post(":id/confirm")
  async confirm(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LoyaltySettlementResponse> {
    return this.settlements.confirm(await this.actor(request, companyId), id, loyaltySettlementVersionSchema.parse(body).version);
  }

  @Post(":id/dispute")
  async dispute(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LoyaltySettlementResponse> {
    return this.settlements.dispute(await this.actor(request, companyId), id, loyaltySettlementDisputeSchema.parse(body));
  }
}
