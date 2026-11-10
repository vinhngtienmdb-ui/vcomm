// API_77, API_78: đơn bán, cài đặt bán hàng (CONG_VIEC_08). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
  closeSalesOrderSchema,
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
import { SalesOrdersService } from "./sales-orders.service";

const itemSearchSchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();

@Controller("sales")
export class SalesController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly orders: SalesOrdersService,
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
    await requireSalesPermission(this.permissionService, actor, salesPermissions.manageOrders);
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
}
