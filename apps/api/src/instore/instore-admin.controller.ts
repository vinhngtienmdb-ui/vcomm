// API_332 phần biểu phí cổng tại cửa hàng (CONG_VIEC_73 lát L4; MAN_HINH_280): công ty vận hành sàn xem, sửa.
// API_333 bảng chuyển tiền thu hộ (lát L5; MAN_HINH_281): công ty vận hành sàn xem, ghi đã chuyển; công ty sở hữu cửa hàng tập đoàn xem bảng của mình.
import { Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  instoreGatewayFeesSchema,
  instorePayoutListQuerySchema,
  instoreSettingsSchema,
  instoreTransferredSchema,
  type InstoreGatewayFeesResponse,
  type InstorePayoutDetail,
  type InstorePayoutListResponse,
  type InstoreSettingsResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AffiliateCheckoutsService } from "../affiliate/affiliate-checkouts.service";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { InstorePayoutsService } from "./payouts.service";

@Controller("finance/instore")
export class InstoreAdminController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly checkouts: AffiliateCheckoutsService,
    private readonly payouts: InstorePayoutsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requested: string | undefined, ...permissions: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requested, ...permissions);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("payouts")
  async payoutList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") requested?: string): Promise<InstorePayoutListResponse> {
    return this.payouts.list(await this.actor(request, requested, "finance.instore.view", "finance.instore.manage"), instorePayoutListQuerySchema.parse(query));
  }

  @Get("payouts/:id")
  async payout(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") requested?: string): Promise<InstorePayoutDetail> {
    return this.payouts.detail(await this.actor(request, requested, "finance.instore.view", "finance.instore.manage"), id);
  }

  @Post("payouts/:id/transferred")
  @HttpCode(200)
  async transferred(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") requested?: string): Promise<InstorePayoutDetail> {
    return this.payouts.markTransferred(await this.actor(request, requested, "finance.instore.manage"), id, instoreTransferredSchema.parse(body));
  }

  @Get("settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") requested?: string): Promise<InstoreSettingsResponse> {
    const actor = await this.actor(request, requested, "finance.instore.view", "finance.instore.manage");
    return this.payouts.settings(actor.companyId, (await this.permissionService.dataScope(actor.userId, actor.companyId, "finance.instore.manage")) !== null);
  }

  @Put("settings")
  async saveSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") requested?: string): Promise<InstoreSettingsResponse> {
    return this.payouts.saveSettings(await this.actor(request, requested, "finance.instore.manage"), instoreSettingsSchema.parse(body));
  }

  @Get("gateway-fees")
  async gatewayFees(@Req() request: AuthenticatedRequest, @Headers("x-company-id") requested?: string): Promise<InstoreGatewayFeesResponse> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requested, "finance.instore.view", "finance.instore.manage");
    const canManage = (await this.permissionService.dataScope(request.auth.userId, companyId, "finance.instore.manage")) !== null;
    return this.checkouts.gatewayFees({ userId: request.auth.userId, companyId, client: clientInfo(request) }, canManage);
  }

  @Put("gateway-fees")
  async saveGatewayFees(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") requested?: string): Promise<InstoreGatewayFeesResponse> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requested, "finance.instore.manage");
    return this.checkouts.saveGatewayFees({ userId: request.auth.userId, companyId, client: clientInfo(request) }, instoreGatewayFeesSchema.parse(body));
  }
}
