// API_164 mua chung (người mua), API_165 mua chung (quản trị) (CONG_VIEC_49; CHUC_NANG_172; QUYTAC_NGHIEPVU_328 đến 331).
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  buyerGroupBuyQuerySchema,
  cancelGroupBuySchema,
  groupBuyListQuerySchema,
  groupBuySettingsQuerySchema,
  groupBuySettingsSchema,
  openGroupBuySchema,
  type GroupBuyDetail,
  type GroupBuyItem,
  type GroupBuyOption,
  type GroupBuySettingsItem,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService, type MarketplacePermission } from "./buyer-admin.service";
import { GroupBuysService } from "./group-buys.service";

@Controller()
export class GroupBuysController {
  constructor(
    private readonly groupBuys: GroupBuysService,
    private readonly admin: BuyerAdminService,
  ) {}

  private actor(request: AuthenticatedRequest, permission: MarketplacePermission) {
    return this.admin.actor(request.auth.userId, clientInfo(request), permission);
  }

  @Get("buyer/group-buy-options")
  async options(@Req() request: AuthenticatedRequest): Promise<GroupBuyOption[]> {
    return this.groupBuys.options(request.auth.userId);
  }

  @Get("buyer/group-buys")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<GroupBuyItem>> {
    return this.groupBuys.list(request.auth.userId, buyerGroupBuyQuerySchema.parse(query));
  }

  @Get("buyer/group-buys/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<GroupBuyItem> {
    return this.groupBuys.detail(request.auth.userId, id);
  }

  @Post("buyer/group-buys")
  async open(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<GroupBuyItem> {
    return this.groupBuys.buyerOpen(request.auth.userId, openGroupBuySchema.parse(body));
  }

  @Get("marketplace/group-buy-settings")
  async settings(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<GroupBuySettingsItem>> {
    return this.groupBuys.listSettings(await this.actor(request, "marketplace.order.view"), groupBuySettingsQuerySchema.parse(query));
  }

  @Put("marketplace/group-buy-settings/:variantId")
  async saveSettings(@Req() request: AuthenticatedRequest, @Param("variantId", UuidPipe) variantId: string, @Body() body: unknown): Promise<GroupBuySettingsItem> {
    return this.groupBuys.saveSettings(await this.actor(request, "marketplace.order.manage"), variantId, groupBuySettingsSchema.parse(body));
  }

  @Get("marketplace/group-buys")
  async adminList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<GroupBuyItem>> {
    return this.groupBuys.adminList(await this.actor(request, "marketplace.order.view"), groupBuyListQuerySchema.parse(query));
  }

  @Get("marketplace/group-buys/:id")
  async adminDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<GroupBuyDetail> {
    return this.groupBuys.adminDetail(await this.actor(request, "marketplace.order.view"), id);
  }

  @Post("marketplace/group-buys")
  async adminOpen(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<GroupBuyDetail> {
    return this.groupBuys.adminOpen(await this.actor(request, "marketplace.order.manage"), openGroupBuySchema.parse(body));
  }

  @Post("marketplace/group-buys/:id/cancel")
  @HttpCode(200)
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<GroupBuyDetail> {
    return this.groupBuys.adminCancel(await this.actor(request, "marketplace.order.manage"), id, cancelGroupBuySchema.parse(body));
  }
}
