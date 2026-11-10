// API_119: quản trị tài khoản người mua VComm trên web-crm (CONG_VIEC_23). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  buyerChangeReferrerSchema,
  buyerListQuerySchema,
  buyerSalesFlagSchema,
  buyerSalesUnflagSchema,
  marketplaceOperatorSchema,
  salesMoveSchema,
  salesUnitManagerSchema,
  salesUnitTypeSchema,
  type SalesTeamResponse,
  type BuyerAccountDetailResponse,
  type BuyerAccountListItem,
  type MarketplaceSettingsResponse,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "./buyer-admin.service";
import { SalesTeamService } from "./sales-team.service";

@Controller("marketplace")
export class MarketplaceController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly salesTeam: SalesTeamService,
  ) {}

  // API_120: đội kinh doanh (CONG_VIEC_27).
  @Get("sales-team")
  async team(@Req() request: AuthenticatedRequest): Promise<SalesTeamResponse> {
    return this.salesTeam.overview(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.view"));
  }

  @Put("sales-units/:id")
  async unitType(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<SalesTeamResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage");
    return this.salesTeam.setUnitType(actor, id, salesUnitTypeSchema.parse(body).type);
  }

  @Put("sales-units/:id/manager")
  async unitManager(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<SalesTeamResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage");
    await this.salesTeam.setManager(actor, id, salesUnitManagerSchema.parse(body).userId);
    return this.salesTeam.overview(actor);
  }

  @Post("buyers/:id/sales-move")
  @HttpCode(200)
  async move(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAccountDetailResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage");
    const input = salesMoveSchema.parse(body);
    await this.salesTeam.move(actor, id, input.departmentId, input.version);
    return this.admin.detail(actor, id);
  }

  @Get("settings")
  async settings(@Req() request: AuthenticatedRequest): Promise<MarketplaceSettingsResponse> {
    return this.admin.settings(request.auth.userId);
  }

  @Put("operator-company")
  async setOperator(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<MarketplaceSettingsResponse> {
    return this.admin.setOperator(request.auth.userId, marketplaceOperatorSchema.parse(body).companyId, clientInfo(request));
  }

  @Get("buyers")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<BuyerAccountListItem>> {
    return this.admin.list(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.view"), buyerListQuerySchema.parse(query));
  }

  @Get("buyers/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerAccountDetailResponse> {
    return this.admin.detail(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.view"), id);
  }

  @Post("buyers/:id/referrer")
  @HttpCode(200)
  async changeReferrer(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAccountDetailResponse> {
    return this.admin.changeReferrer(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id, buyerChangeReferrerSchema.parse(body));
  }

  @Post("buyers/:id/sales-flag")
  @HttpCode(200)
  async flag(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAccountDetailResponse> {
    return this.admin.flagSalesStaff(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id, buyerSalesFlagSchema.parse(body));
  }

  @Delete("buyers/:id/sales-flag")
  async unflag(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAccountDetailResponse> {
    return this.admin.unflagSalesStaff(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id, buyerSalesUnflagSchema.parse(body).version);
  }
}
