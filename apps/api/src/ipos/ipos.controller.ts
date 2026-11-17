// API_354, API_355: gói và thuê bao iPOS trên ERP (CONG_VIEC_74). Quyền xét tại công ty vận hành sàn; xem dùng `affiliate.view`.
import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  iposBillingSchema,
  iposPlanCreateSchema,
  iposPlanUpdateSchema,
  iposSubscriptionActionSchema,
  iposSubscriptionCreateSchema,
  iposSubscriptionListQuerySchema,
  iposSubscriptionUpdateSchema,
  type IposBilling,
  type IposMerchantOverview,
  type IposPlan,
  type IposSubscription,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { IposPlansService } from "./ipos-plans.service";
import { IposSubscriptionsService } from "./ipos-subscriptions.service";

@Controller()
export class IposController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly plans: IposPlansService,
    private readonly subscriptions: IposSubscriptionsService,
  ) {}

  private viewer(request: AuthenticatedRequest) {
    return this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
  }

  private subscriptionManager(request: AuthenticatedRequest) {
    return this.admin.actor(request.auth.userId, clientInfo(request), "ipos.subscription.manage");
  }

  @Get("ipos/plans")
  async listPlans(@Req() request: AuthenticatedRequest): Promise<IposPlan[]> {
    return this.plans.list(await this.viewer(request));
  }

  @Post("ipos/plans")
  async createPlan(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposPlan> {
    return this.plans.create(await this.admin.actor(request.auth.userId, clientInfo(request), "ipos.plan.manage"), iposPlanCreateSchema.parse(body));
  }

  @Put("ipos/plans/:id")
  async updatePlan(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposPlan> {
    return this.plans.update(await this.admin.actor(request.auth.userId, clientInfo(request), "ipos.plan.manage"), id, iposPlanUpdateSchema.parse(body));
  }

  @Get("ipos/subscriptions")
  async listSubscriptions(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<IposSubscription>> {
    return this.subscriptions.list(await this.viewer(request), iposSubscriptionListQuerySchema.parse(query));
  }

  @Get("ipos/subscriptions/:id")
  async subscription(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposSubscription> {
    return this.subscriptions.detail(await this.viewer(request), id);
  }

  @Get("affiliate/merchants/:id/ipos")
  async merchantOverview(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposMerchantOverview> {
    const canManage = await this.admin.allows(request.auth.userId, clientInfo(request), "ipos.subscription.manage");
    return this.subscriptions.merchantOverview(await this.viewer(request), id, canManage);
  }

  @Put("affiliate/merchants/:id/ipos-billing")
  async saveBilling(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposBilling> {
    return this.subscriptions.saveBilling(await this.subscriptionManager(request), id, iposBillingSchema.parse(body));
  }

  @Post("affiliate/merchants/:id/ipos-subscriptions")
  async createSubscription(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSubscription> {
    return this.subscriptions.create(await this.subscriptionManager(request), id, iposSubscriptionCreateSchema.parse(body));
  }

  @Put("ipos/subscriptions/:id")
  async updateSubscription(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSubscription> {
    return this.subscriptions.update(await this.subscriptionManager(request), id, iposSubscriptionUpdateSchema.parse(body));
  }

  @Post("ipos/subscriptions/:id/renew")
  async renew(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSubscription> {
    return this.subscriptions.renew(await this.subscriptionManager(request), id, iposSubscriptionActionSchema.parse(body).version);
  }

  @Post("ipos/subscriptions/:id/lock")
  async lock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSubscription> {
    const input = iposSubscriptionActionSchema.parse(body);
    return this.subscriptions.lock(await this.subscriptionManager(request), id, input.version, input.reason ?? null);
  }

  @Post("ipos/subscriptions/:id/unlock")
  async unlock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSubscription> {
    return this.subscriptions.unlock(await this.subscriptionManager(request), id, iposSubscriptionActionSchema.parse(body).version);
  }

  @Post("ipos/subscriptions/:id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSubscription> {
    const input = iposSubscriptionActionSchema.parse(body);
    return this.subscriptions.cancel(await this.subscriptionManager(request), id, input.version, input.reason ?? null);
  }
}
