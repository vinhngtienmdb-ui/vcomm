// API_77, API_78: đơn bán, cài đặt bán hàng (CONG_VIEC_08). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
  promotionListQuerySchema,
  savePromotionSchema,
  stopPromotionSchema,
  type PromotionListItem,
  type PromotionOptionsResponse,
  type PromotionResponse,
  closeSalesOrderSchema,
  confirmCounterpartSchema,
  rejectCounterpartSchema,
  saveSalesOrderSchema,
  salesOrderListQuerySchema,
  salesPriceQuerySchema,
  updateSalesSettingsSchema,
  versionSchema,
  type PageResponse,
  type SalesOptionsResponse,
  type SalesOrderListItem,
  type SalesOrderResponse,
  type SalesPriceResponse,
  type SalesSettingsResponse,
  type StockItemOption,
} from "contracts";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { searchVariantOptions } from "../catalog/variant-search";
import { UuidPipe } from "../common/uuid.pipe";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { requireSalesPermission, salesPermissions } from "./sales-context";
import { PromotionsService } from "./promotions.service";
import { SalesOrdersService } from "./sales-orders.service";

const itemSearchSchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();

@Controller("sales")
export class SalesController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly orders: SalesOrdersService,
    private readonly promotions: PromotionsService,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "sales.access", "sales.order.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<SalesOptionsResponse> {
    return this.orders.options(await this.actor(request, companyId));
  }

  @Get("items")
  async items(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StockItemOption[]> {
    const actor = await this.actor(request, companyId);
    // Tìm mặt hàng khi lập đơn bán hoặc chương trình khuyến mãi.
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders, salesPermissions.managePromotions);
    return searchVariantOptions(this.database, actor.companyId, itemSearchSchema.parse(query).search);
  }

  @Get("price")
  async price(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesPriceResponse> {
    return this.orders.price(await this.actor(request, companyId), salesPriceQuerySchema.parse(query));
  }

  @Get("settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<SalesSettingsResponse> {
    return this.orders.settings(await this.actor(request, companyId));
  }

  @Put("settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesSettingsResponse> {
    return this.orders.updateSettings(await this.actor(request, companyId), updateSalesSettingsSchema.parse(body));
  }

  @Get("orders")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<SalesOrderListItem>> {
    return this.orders.list(await this.actor(request, companyId), salesOrderListQuerySchema.parse(query));
  }

  @Post("orders")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.create(await this.actor(request, companyId), saveSalesOrderSchema.parse(body));
  }

  @Get("orders/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.detail(await this.actor(request, companyId), id);
  }

  @Patch("orders/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.update(await this.actor(request, companyId), id, saveSalesOrderSchema.parse(body));
  }

  @Post("orders/:id/submit")
  async submit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.submit(await this.actor(request, companyId), id);
  }

  @Post("orders/:id/withdraw")
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.withdraw(await this.actor(request, companyId), id);
  }

  @Post("orders/:id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.cancel(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Post("orders/:id/close")
  async close(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    const parsed = closeSalesOrderSchema.parse(body);
    return this.orders.close(await this.actor(request, companyId), id, parsed.reason, parsed.version);
  }

  @Post("orders/:id/counterpart-confirm")
  async confirmCounterpart(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.confirmCounterpart(await this.actor(request, companyId), id, confirmCounterpartSchema.parse(body));
  }

  @Post("orders/:id/counterpart-reject")
  async rejectCounterpart(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SalesOrderResponse> {
    return this.orders.rejectCounterpart(await this.actor(request, companyId), id, rejectCounterpartSchema.parse(body));
  }

  // API_83 (CONG_VIEC_12): chương trình khuyến mãi.
  @Get("promotions/options")
  async promotionOptions(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PromotionOptionsResponse> {
    return this.promotions.options(await this.actor(request, companyId));
  }

  @Get("promotions")
  async promotionList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PromotionListItem[]> {
    return this.promotions.list(await this.actor(request, companyId), promotionListQuerySchema.parse(query).status);
  }

  @Get("promotions/:id")
  async promotionDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PromotionResponse> {
    return this.promotions.detail(await this.actor(request, companyId), id);
  }

  @Post("promotions")
  async createPromotion(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PromotionResponse> {
    return this.promotions.create(await this.actor(request, companyId), savePromotionSchema.parse(body));
  }

  @Patch("promotions/:id")
  async updatePromotion(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PromotionResponse> {
    return this.promotions.update(await this.actor(request, companyId), id, savePromotionSchema.parse(body));
  }

  @Post("promotions/:id/submit")
  async submitPromotion(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PromotionResponse> {
    return this.promotions.submit(await this.actor(request, companyId), id);
  }

  @Post("promotions/:id/withdraw")
  async withdrawPromotion(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PromotionResponse> {
    return this.promotions.withdraw(await this.actor(request, companyId), id);
  }

  @Post("promotions/:id/stop")
  async stopPromotion(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PromotionResponse> {
    const parsed = stopPromotionSchema.parse(body);
    return this.promotions.stop(await this.actor(request, companyId), id, parsed.reason, parsed.version);
  }
}
