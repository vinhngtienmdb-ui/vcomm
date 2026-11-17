// API_332 phần biểu phí cổng tại cửa hàng (CONG_VIEC_73 lát L4; MAN_HINH_280): công ty vận hành sàn xem, sửa.
import { Body, Controller, Get, Headers, Put, Req } from "@nestjs/common";
import { instoreGatewayFeesSchema, type InstoreGatewayFeesResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AffiliateCheckoutsService } from "../affiliate/affiliate-checkouts.service";
import { PermissionService } from "../permissions/permission.service";

@Controller("finance/instore")
export class InstoreAdminController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly checkouts: AffiliateCheckoutsService,
  ) {}

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
