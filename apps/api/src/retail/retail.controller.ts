// API_192, API_193: cửa hàng, quầy, ca thu ngân (CONG_VIEC_53). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  closeRetailShiftSchema,
  createRetailSaleSchema,
  openRetailShiftSchema,
  retailItemsQuerySchema,
  retailQuoteSchema,
  retailSaleListQuerySchema,
  retailPermissions,
  retailShiftListQuerySchema,
  saveRetailRegisterSchema,
  saveRetailStoreSchema,
  type RetailCounterContext,
  type RetailItemOption,
  type RetailQuoteResponse,
  type RetailSaleListResponse,
  type RetailSaleResponse,
  type RetailSetupOptions,
  type RetailShiftListResponse,
  type RetailShiftResponse,
  type RetailStoreResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { RetailSalesService } from "./retail-sales.service";
import { RetailShiftsService } from "./retail-shifts.service";
import { RetailStoresService } from "./retail-stores.service";

@Controller("retail")
export class RetailController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly stores: RetailStoresService,
    private readonly shifts: RetailShiftsService,
    private readonly sales: RetailSalesService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, retailPermissions.access);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RetailSetupOptions> {
    return this.stores.options(await this.actor(request, companyId));
  }

  @Get("stores")
  async storeList(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse[]> {
    return this.stores.list(await this.actor(request, companyId));
  }

  @Post("stores")
  async storeCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse> {
    return this.stores.create(await this.actor(request, companyId), saveRetailStoreSchema.parse(body));
  }

  @Get("stores/:id")
  async storeDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse> {
    return this.stores.detail(await this.actor(request, companyId), id);
  }

  @Patch("stores/:id")
  async storeUpdate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse> {
    return this.stores.update(await this.actor(request, companyId), id, saveRetailStoreSchema.parse(body));
  }

  @Post("stores/:id/registers")
  async registerCreate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse> {
    return this.stores.createRegister(await this.actor(request, companyId), id, saveRetailRegisterSchema.parse(body));
  }

  @Patch("registers/:id")
  async registerUpdate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse> {
    return this.stores.updateRegister(await this.actor(request, companyId), id, saveRetailRegisterSchema.parse(body));
  }

  @Get("counter")
  async counter(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RetailCounterContext> {
    return this.shifts.counter(await this.actor(request, companyId));
  }

  @Get("shifts")
  async shiftList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailShiftListResponse> {
    return this.shifts.list(await this.actor(request, companyId), retailShiftListQuerySchema.parse(query));
  }

  @Post("shifts")
  async shiftOpen(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailShiftResponse> {
    return this.shifts.open(await this.actor(request, companyId), openRetailShiftSchema.parse(body));
  }

  @Get("shifts/:id")
  async shiftDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RetailShiftResponse> {
    return this.shifts.detail(await this.actor(request, companyId), id);
  }

  @Post("shifts/:id/close")
  async shiftClose(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailShiftResponse> {
    return this.shifts.close(await this.actor(request, companyId), id, closeRetailShiftSchema.parse(body));
  }

  @Get("items")
  async items(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailItemOption[]> {
    const parsed = retailItemsQuerySchema.parse(query);
    return this.sales.items(await this.actor(request, companyId), parsed.shiftId, parsed.search);
  }

  @Post("quote")
  @HttpCode(200)
  async quote(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailQuoteResponse> {
    return this.sales.quote(await this.actor(request, companyId), retailQuoteSchema.parse(body));
  }

  @Get("sales")
  async saleList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailSaleListResponse> {
    return this.sales.list(await this.actor(request, companyId), retailSaleListQuerySchema.parse(query));
  }

  @Post("sales")
  async saleCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailSaleResponse> {
    return this.sales.create(await this.actor(request, companyId), createRetailSaleSchema.parse(body));
  }

  @Get("sales/:id")
  async saleDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RetailSaleResponse> {
    return this.sales.detail(await this.actor(request, companyId), id);
  }
}
