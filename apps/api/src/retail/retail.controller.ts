// API_192, API_193: cửa hàng, quầy, ca thu ngân (CONG_VIEC_53). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  closeRetailShiftSchema,
  createRetailReturnSchema,
  createRetailSaleSchema,
  openRetailShiftSchema,
  retailItemsQuerySchema,
  retailQuoteSchema,
  retailReturnQuoteSchema,
  retailSaleListQuerySchema,
  retailPermissions,
  retailShiftListQuerySchema,
  saveRetailRegisterSchema,
  saveRetailStationSchema,
  stationAssignSchema,
  stationAttemptSchema,
  stationDispatchSchema,
  stationHandoverSchema,
  type MyDeliveriesResponse,
  stationOrderCancelSchema,
  stationOrderListQuerySchema,
  stationOrderVersionSchema,
  type StationOrderDetail,
  type StationOrderListResponse,
  saveRetailStoreSchema,
  type RetailCounterContext,
  type RetailItemOption,
  type RetailQuoteResponse,
  type RetailRegionItem,
  type RetailReturnableResponse,
  type RetailReturnQuoteResponse,
  type RetailReturnResponse,
  type RetailSaleListResponse,
  type RetailSaleResponse,
  type RetailSetupOptions,
  type RetailShiftListResponse,
  type RetailShiftResponse,
  type RetailStoreResponse,
  stationReturnListQuerySchema,
  type StationReturnItem,
  type StationReturnListResponse,
  stationReturnReceiveSchema,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { RetailReturnsService } from "./retail-returns.service";
import { RetailSalesService } from "./retail-sales.service";
import { RetailShiftsService } from "./retail-shifts.service";
import { RetailStationOrdersService } from "./retail-station-orders.service";
import { RetailStationReturnsService } from "./retail-station-returns.service";
import { RetailStoresService } from "./retail-stores.service";

@Controller("retail")
export class RetailController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly stores: RetailStoresService,
    private readonly shifts: RetailShiftsService,
    private readonly sales: RetailSalesService,
    private readonly returns: RetailReturnsService,
    private readonly stationOrders: RetailStationOrdersService,
    private readonly stationReturns: RetailStationReturnsService,
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

  // API_220: cài đặt trạm giao hàng O2O (CONG_VIEC_57).
  @Patch("stores/:id/station")
  async stationUpdate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailStoreResponse> {
    return this.stores.saveStation(await this.actor(request, companyId), id, saveRetailStationSchema.parse(body));
  }

  // API_223, API_224: đơn trực tuyến tại trạm (CONG_VIEC_57).
  @Get("station-orders")
  async stationOrderList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderListResponse> {
    return this.stationOrders.list(await this.actor(request, companyId), stationOrderListQuerySchema.parse(query));
  }

  @Get("station-orders/by-code")
  async stationOrderByCode(
    @Req() request: AuthenticatedRequest,
    @Query("storeId", UuidPipe) storeId: string,
    @Query("code") code: string | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<StationOrderDetail> {
    return this.stationOrders.byCode(await this.actor(request, companyId), storeId, String(code ?? "").slice(0, 120));
  }

  // API_226: nhận hàng trả tại trạm (CONG_VIEC_57).
  @Get("station-returns")
  async stationReturnList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StationReturnListResponse> {
    return this.stationReturns.list(await this.actor(request, companyId), stationReturnListQuerySchema.parse(query));
  }

  @Post("station-returns/:id/receive")
  @HttpCode(200)
  async stationReturnReceive(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationReturnItem> {
    return this.stationReturns.receive(await this.actor(request, companyId), id, stationReturnReceiveSchema.parse(body).version);
  }

  // API_225: trạm giao tận nơi (CONG_VIEC_57).
  @Get("station-orders/my-deliveries")
  async myDeliveries(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyDeliveriesResponse> {
    return this.stationOrders.myDeliveries(await this.actor(request, companyId));
  }

  @Post("station-orders/:id/assign")
  @HttpCode(200)
  async stationOrderAssign(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.assign(await this.actor(request, companyId), id, stationAssignSchema.parse(body));
  }

  @Post("station-orders/:id/dispatch")
  @HttpCode(200)
  async stationOrderDispatch(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.dispatch(await this.actor(request, companyId), id, stationDispatchSchema.parse(body));
  }

  @Post("station-orders/:id/deliver")
  @HttpCode(200)
  async stationOrderDeliver(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.deliver(await this.actor(request, companyId), id, stationHandoverSchema.parse(body));
  }

  @Post("station-orders/:id/attempts")
  @HttpCode(200)
  async stationOrderAttempt(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.attempt(await this.actor(request, companyId), id, stationAttemptSchema.parse(body));
  }

  @Get("station-orders/:id")
  async stationOrderDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.detail(await this.actor(request, companyId), id);
  }

  @Post("station-orders/:id/ready")
  @HttpCode(200)
  async stationOrderReady(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.ready(await this.actor(request, companyId), id, stationOrderVersionSchema.parse(body).version);
  }

  @Post("station-orders/:id/cancel")
  @HttpCode(200)
  async stationOrderCancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.cancel(await this.actor(request, companyId), id, stationOrderCancelSchema.parse(body));
  }

  @Post("station-orders/:id/handover")
  @HttpCode(200)
  async stationOrderHandover(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StationOrderDetail> {
    return this.stationOrders.handover(await this.actor(request, companyId), id, stationHandoverSchema.parse(body));
  }

  @Get("regions/provinces")
  async provinces(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RetailRegionItem[]> {
    return this.stores.provinces(await this.actor(request, companyId));
  }

  @Get("regions/provinces/:code/wards")
  async wards(@Req() request: AuthenticatedRequest, @Param("code") code: string, @Headers("x-company-id") companyId?: string): Promise<RetailRegionItem[]> {
    return this.stores.wards(await this.actor(request, companyId), code);
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

  @Get("sales/:id/returnable")
  async returnable(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Query("shiftId", UuidPipe) shiftId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<RetailReturnableResponse> {
    return this.returns.returnable(await this.actor(request, companyId), id, shiftId);
  }

  @Post("returns/quote")
  @HttpCode(200)
  async returnQuote(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailReturnQuoteResponse> {
    return this.returns.quote(await this.actor(request, companyId), retailReturnQuoteSchema.parse(body));
  }

  @Post("returns")
  async returnCreate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RetailReturnResponse> {
    return this.returns.create(await this.actor(request, companyId), createRetailReturnSchema.parse(body));
  }

  @Get("returns/:id")
  async returnDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RetailReturnResponse> {
    return this.returns.detail(await this.actor(request, companyId), id);
  }
}
