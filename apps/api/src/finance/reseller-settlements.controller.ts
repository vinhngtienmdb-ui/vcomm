// API_312, API_313: bảng đối soát tuần với người bán dropship (CONG_VIEC_62 CHUC_NANG_225; QUYTAC_NGHIEPVU_509). Quyền kiểm trong service.
import { Body, Controller, Get, Headers, Param, Post, Query, Req } from "@nestjs/common";
import { confirmResellerSettlementSchema, resellerSettlementListQuerySchema, type ResellerSettlementListResponse, type ResellerSettlementResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { financePermissions } from "./finance-context";
import { ResellerSettlementsService } from "./reseller-settlements.service";

@Controller("finance")
export class ResellerSettlementsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly settlements: ResellerSettlementsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, financePermissions.view, financePermissions.manageDebts);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("reseller-settlements")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ResellerSettlementListResponse> {
    return this.settlements.list(await this.actor(request, companyId), resellerSettlementListQuerySchema.parse(query));
  }

  @Get("reseller-settlements/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ResellerSettlementResponse> {
    return this.settlements.detail(await this.actor(request, companyId), id);
  }

  @Post("reseller-settlements/:id/confirm")
  async confirm(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ResellerSettlementResponse> {
    return this.settlements.confirm(await this.actor(request, companyId), id, confirmResellerSettlementSchema.parse(body));
  }
}
