// API_106 đến API_109: báo cáo tài chính hợp nhất (CONG_VIEC_20). Quyền phạm vi tập đoàn kiểm trong service.
import { Controller, Get, Headers, Query, Req } from "@nestjs/common";
import { consolidationPreviewQuerySchema, type ConsolidatedStatementResponse, type ConsolidationScopeResponse } from "contracts";
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
}
