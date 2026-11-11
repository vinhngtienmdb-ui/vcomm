// API_119: quản trị tài khoản người mua VComm trên web-crm (CONG_VIEC_23). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
import {
  buyerChangeReferrerSchema,
  buyerListQuerySchema,
  buyerSalesFlagSchema,
  buyerSalesUnflagSchema,
  marketplaceOperatorSchema,
  rejectSalesProposalSchema,
  salesProposalListQuerySchema,
  type SalesProposalItem,
  salesMoveSchema,
  salesUnitManagerSchema,
  salesUnitTypeSchema,
  type SalesTeamResponse,
  type BuyerAccountDetailResponse,
  type BuyerAccountListItem,
  type MarketplaceSettingsResponse,
  type PageResponse,
  listingListQuerySchema,
  type ListingItem,
  type StoreSettingsResponse,
  testBuyerSchema,
  updateCarrierSchema,
  updateOrderingOpenSchema,
  updatePaymentMethodSchema,
  updateListingSchema,
  updateStoreSettingsSchema,
  cancelMarketplaceOrderSchema,
  marketplaceOrderListQuerySchema,
  shipMarketplaceOrderSchema,
  returnDecisionSchema,
  returnRejectSchema,
  returnRequestListQuerySchema,
  type ReturnRequestAdminItem,
  type MarketplaceOrderDetail,
  type MarketplaceOrderListItem,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "./buyer-admin.service";
import { SalesProposalsService } from "./sales-proposals.service";
import { SalesTeamService } from "./sales-team.service";
import { MarketplaceOrdersService } from "./marketplace-orders.service";
import { ShipmentsService } from "./shipments.service";
import { ReturnRequestsService } from "./return-requests.service";
import { StoreService } from "./store.service";

@Controller("marketplace")
export class MarketplaceController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly salesTeam: SalesTeamService,
    private readonly proposals: SalesProposalsService,
    private readonly store: StoreService,
    private readonly orders: MarketplaceOrdersService,
    private readonly shipments: ShipmentsService,
    private readonly returns: ReturnRequestsService,
  ) {}

  // API_129: yêu cầu trả hàng (CONG_VIEC_24).
  @Get("return-requests")
  async returnRequests(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<ReturnRequestAdminItem>> {
    return this.returns.list(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view"), returnRequestListQuerySchema.parse(query));
  }

  @Get("return-requests/images/:id")
  async returnImage(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response): Promise<void> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view");
    const file = await this.returns.image(id, { companyId: actor.operatorCompanyId });
    response.setHeader("content-type", file.contentType);
    response.setHeader("cache-control", "private, max-age=3600");
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Get("return-requests/:id")
  async returnRequest(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<ReturnRequestAdminItem> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view");
    return this.returns.detail(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "marketplace.order.manage"));
  }

  @Post("return-requests/:id/:action")
  @HttpCode(200)
  async decideReturn(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Param("action") action: string, @Body() body: unknown): Promise<ReturnRequestAdminItem> {
    const actions = { approve: "approve", reject: "reject", receive: "receive", "not-received": "not_received" } as const;
    const chosen = actions[action as keyof typeof actions];
    if (!chosen) throw new ApiError("NOT_FOUND", "notFound");
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage");
    const input = chosen === "reject" || chosen === "not_received" ? returnRejectSchema.parse(body) : returnDecisionSchema.parse(body);
    return this.returns.decide(actor, id, chosen, input.note, input.version);
  }

  @Post("orders/:id/ship")
  @HttpCode(200)
  async ship(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<MarketplaceOrderDetail> {
    const input = shipMarketplaceOrderSchema.parse(body);
    return this.shipments.ship(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), id, input.carrierCode, input.version);
  }

  @Post("orders/:id/refresh-shipment")
  @HttpCode(200)
  async refreshShipment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<MarketplaceOrderDetail> {
    return this.shipments.refresh(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), id);
  }

  // API_127: đơn VComm trên web (CONG_VIEC_24).
  @Get("orders")
  async orderList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<MarketplaceOrderListItem>> {
    return this.orders.adminList(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view"), marketplaceOrderListQuerySchema.parse(query));
  }

  @Get("orders/:id")
  async order(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<MarketplaceOrderDetail> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view");
    return this.orders.adminDetail(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "marketplace.order.manage"));
  }

  @Post("orders/:id/cancel")
  @HttpCode(200)
  async cancelOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<MarketplaceOrderDetail> {
    const input = cancelMarketplaceOrderSchema.parse(body);
    return this.orders.adminCancel(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), id, input.version, input.reason);
  }

  // API_123: cài đặt bán hàng VComm, đơn vị vận chuyển, đăng bán, người mua thử (CONG_VIEC_24).
  @Get("store-settings")
  async storeSettings(@Req() request: AuthenticatedRequest): Promise<StoreSettingsResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view");
    return this.store.settings(actor, await this.admin.allows(request.auth.userId, clientInfo(request), "marketplace.order.manage"));
  }

  @Put("store-settings")
  async updateStoreSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<StoreSettingsResponse> {
    return this.store.updateSettings(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), updateStoreSettingsSchema.parse(body));
  }

  @Put("carriers/:code")
  async carrier(@Req() request: AuthenticatedRequest, @Param("code") code: string, @Body() body: unknown): Promise<StoreSettingsResponse> {
    return this.store.setCarrier(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), code, updateCarrierSchema.parse(body).isEnabled);
  }

  // API_130: phương thức thanh toán, mở đặt hàng (CONG_VIEC_25).
  @Put("payment-methods/:code")
  async paymentMethod(@Req() request: AuthenticatedRequest, @Param("code") code: string, @Body() body: unknown): Promise<StoreSettingsResponse> {
    return this.store.setPaymentMethod(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), code, updatePaymentMethodSchema.parse(body).isEnabled);
  }

  @Put("ordering-open")
  async orderingOpen(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<StoreSettingsResponse> {
    return this.store.setOrderingOpen(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), updateOrderingOpenSchema.parse(body).orderingOpen);
  }

  @Get("listings")
  async listings(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<ListingItem>> {
    return this.store.listings(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.view"), listingListQuerySchema.parse(query));
  }

  @Put("listings/:productId")
  @HttpCode(204)
  async listing(@Req() request: AuthenticatedRequest, @Param("productId", UuidPipe) productId: string, @Body() body: unknown): Promise<void> {
    await this.store.updateListing(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage"), productId, updateListingSchema.parse(body));
  }

  @Put("buyers/:id/test-buyer")
  async testBuyer(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAccountDetailResponse> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.order.manage");
    await this.store.setTestBuyer(actor, id, testBuyerSchema.parse(body).isTestBuyer);
    return this.admin.detail(actor, id);
  }

  // API_121: duyệt đề xuất đội kinh doanh.
  @Get("sales-proposals")
  async proposalList(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<SalesProposalItem[]> {
    return this.proposals.pendingForAdmin(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.view"), salesProposalListQuerySchema.parse(query).status);
  }

  @Post("sales-proposals/:id/approve")
  @HttpCode(200)
  async approve(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<SalesProposalItem> {
    return this.proposals.approve(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id);
  }

  @Post("sales-proposals/:id/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<SalesProposalItem> {
    return this.proposals.reject(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id, rejectSalesProposalSchema.parse(body).note);
  }

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
    return (await this.admin.flagSalesStaff(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id, buyerSalesFlagSchema.parse(body)))!;
  }

  @Delete("buyers/:id/sales-flag")
  async unflag(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<BuyerAccountDetailResponse> {
    return (await this.admin.unflagSalesStaff(await this.admin.actor(request.auth.userId, clientInfo(request), "marketplace.buyer.manage"), id, buyerSalesUnflagSchema.parse(body).version))!;
  }
}
