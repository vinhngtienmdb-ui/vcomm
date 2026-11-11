// API_235 đến API_240: ngân sách mua (CONG_VIEC_58). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { budgetListQuerySchema, saveBudgetPlanSchema, versionSchema, type BudgetOptionsResponse, type BudgetPlanListItem, type BudgetPlanResponse, type PageResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { BudgetPlansService } from "./budgets.service";

@Controller("purchasing")
export class PurchasingBudgetsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly plans: BudgetPlansService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "purchasing.access", "purchasing.order.view", "purchasing.requisition.create");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("budget-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<BudgetOptionsResponse> {
    return this.plans.options(await this.actor(request, companyId));
  }

  @Get("budget-plans")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<BudgetPlanListItem>> {
    return this.plans.list(await this.actor(request, companyId), budgetListQuerySchema.parse(query));
  }

  @Post("budget-plans")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BudgetPlanResponse> {
    return this.plans.create(await this.actor(request, companyId), saveBudgetPlanSchema.parse(body));
  }

  @Get("budget-plans/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<BudgetPlanResponse> {
    return this.plans.detail(await this.actor(request, companyId), id);
  }

  @Patch("budget-plans/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BudgetPlanResponse> {
    return this.plans.update(await this.actor(request, companyId), id, saveBudgetPlanSchema.parse(body));
  }

  @Post("budget-plans/:id/submit")
  async submit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BudgetPlanResponse> {
    return this.plans.submit(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Post("budget-plans/:id/withdraw")
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<BudgetPlanResponse> {
    return this.plans.withdraw(await this.actor(request, companyId), id);
  }

  @Post("budget-plans/:id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BudgetPlanResponse> {
    return this.plans.cancel(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }
}
