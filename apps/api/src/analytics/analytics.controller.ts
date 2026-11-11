// API_170 đến API_175: báo cáo quản trị (CONG_VIEC_50). Chỉ đọc; quyền từng nhóm báo cáo kiểm trong service.
import { Controller, Get, Headers, Req } from "@nestjs/common";
import type { AnalyticsScopeResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AnalyticsScopeService } from "./analytics-scope.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly scopeService: AnalyticsScopeService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "analytics.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("scope")
  async scope(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AnalyticsScopeResponse> {
    return this.scopeService.scope(await this.actor(request, companyId));
  }
}
