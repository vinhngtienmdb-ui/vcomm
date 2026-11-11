// API_73 đến API_75: bảng giá mua, đề nghị mua, đơn mua, cài đặt mua hàng (CONG_VIEC_07). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
  closePurchaseOrderSchema,
  confirmCounterpartSchema,
  rejectCounterpartSchema,
  purchaseListQuerySchema,
  savePurchaseOrderSchema,
  saveRequisitionSchema,
  type PurchaseOrderListItem,
  type PurchaseOrderResponse,
  type RequisitionListItem,
  type RequisitionResponse,
  saveSupplierPriceSchema,
  supplierPriceListQuerySchema,
  supplierPriceLookupQuerySchema,
  updatePurchasingSettingsSchema,
  versionSchema,
  type PageResponse,
  type PurchasingOptionsResponse,
  type PurchasingSettingsResponse,
  type StockItemOption,
  type SupplierPriceLookupResponse,
  type SupplierPriceResponse,
} from "contracts";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { PurchaseOrdersService } from "./orders.service";
import { RequisitionsService } from "./requisitions.service";
import { SupplierPricesService } from "./supplier-prices.service";

const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");
const itemSearchSchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();

@Controller("purchasing")
export class PurchasingController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly prices: SupplierPricesService,
    private readonly requisitions: RequisitionsService,
    private readonly orders: PurchaseOrdersService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "purchasing.access", "purchasing.order.view", "purchasing.requisition.create");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PurchasingOptionsResponse> {
    return this.prices.options(await this.actor(request, companyId));
  }

  @Get("items")
  async items(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StockItemOption[]> {
    return this.prices.searchItems(await this.actor(request, companyId), itemSearchSchema.parse(query).search);
  }

  @Get("settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PurchasingSettingsResponse> {
    return this.prices.settings(await this.actor(request, companyId));
  }

  @Put("settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PurchasingSettingsResponse> {
    return this.prices.updateSettings(await this.actor(request, companyId), updatePurchasingSettingsSchema.parse(body));
  }

  @Get("supplier-prices")
  async listPrices(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<SupplierPriceResponse>> {
    return this.prices.list(await this.actor(request, companyId), supplierPriceListQuerySchema.parse(query));
  }

  @Get("supplier-prices/lookup")
  async lookup(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<SupplierPriceLookupResponse> {
    const parsed = supplierPriceLookupQuerySchema.parse(query);
    return this.prices.lookupFor(await this.actor(request, companyId), parsed.supplierId, parsed.variantId, parsed.unitId, parsed.quantity, parsed.date);
  }

  @Post("supplier-prices")
  async createPrice(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SupplierPriceResponse> {
    return this.prices.create(await this.actor(request, companyId), saveSupplierPriceSchema.parse(body));
  }

  @Patch("supplier-prices/:id")
  async updatePrice(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SupplierPriceResponse> {
    return this.prices.update(await this.actor(request, companyId), id, saveSupplierPriceSchema.parse(body));
  }

  @Post(["supplier-prices/:id/deactivate", "supplier-prices/:id/activate"])
  async setPriceStatus(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<SupplierPriceResponse> {
    return this.prices.setStatus(await this.actor(request, companyId), id, statusOf(request), versionSchema.parse(body).version);
  }

  @Get("requisitions")
  async listRequisitions(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<RequisitionListItem>> {
    return this.requisitions.list(await this.actor(request, companyId), purchaseListQuerySchema.parse(query));
  }

  @Post("requisitions")
  async createRequisition(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RequisitionResponse> {
    return this.requisitions.create(await this.actor(request, companyId), saveRequisitionSchema.parse(body));
  }

  @Get("requisitions/:id")
  async requisition(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RequisitionResponse> {
    return this.requisitions.detail(await this.actor(request, companyId), id);
  }

  @Patch("requisitions/:id")
  async updateRequisition(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RequisitionResponse> {
    return this.requisitions.update(await this.actor(request, companyId), id, saveRequisitionSchema.parse(body));
  }

  @Post("requisitions/:id/submit")
  async submitRequisition(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RequisitionResponse> {
    return this.requisitions.submit(await this.actor(request, companyId), id);
  }

  @Post("requisitions/:id/withdraw")
  async withdrawRequisition(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<RequisitionResponse> {
    return this.requisitions.withdraw(await this.actor(request, companyId), id);
  }

  @Post("requisitions/:id/close")
  async closeRequisition(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RequisitionResponse> {
    return this.requisitions.close(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Get("orders")
  async listOrders(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<PurchaseOrderListItem>> {
    return this.orders.list(await this.actor(request, companyId), purchaseListQuerySchema.parse(query));
  }

  @Post("orders")
  async createOrder(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    return this.orders.create(await this.actor(request, companyId), savePurchaseOrderSchema.parse(body));
  }

  @Get("orders/:id")
  async order(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    return this.orders.detail(await this.actor(request, companyId), id);
  }

  @Patch("orders/:id")
  async updateOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    return this.orders.update(await this.actor(request, companyId), id, savePurchaseOrderSchema.parse(body));
  }

  @Post("orders/:id/submit")
  async submitOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    return this.orders.submit(await this.actor(request, companyId), id);
  }

  @Post("orders/:id/withdraw")
  async withdrawOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    return this.orders.withdraw(await this.actor(request, companyId), id);
  }

  @Post("orders/:id/close")
  async closeOrder(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    const parsed = closePurchaseOrderSchema.parse(body);
    return this.orders.close(await this.actor(request, companyId), id, parsed.reason, parsed.version);
  }

  @Post("orders/:id/counterpart-confirm")
  async confirmCounterpart(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PurchaseOrderResponse> {
    return this.orders.confirmCounterpart(await this.actor(request, companyId), id, confirmCounterpartSchema.parse(body));
  }

  @Post("orders/:id/counterpart-reject")
  async rejectCounterpart(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PurchaseOrderResponse> {
    return this.orders.rejectCounterpart(await this.actor(request, companyId), id, rejectCounterpartSchema.parse(body));
  }
}
