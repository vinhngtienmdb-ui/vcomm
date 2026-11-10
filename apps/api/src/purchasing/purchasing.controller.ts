// API_73 đến API_75: bảng giá mua, đề nghị mua, đơn mua, cài đặt mua hàng (CONG_VIEC_07). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
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
import { SupplierPricesService } from "./supplier-prices.service";

const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");
const itemSearchSchema = z.object({ search: z.string().trim().min(1).max(100) }).strict();

@Controller("purchasing")
export class PurchasingController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly prices: SupplierPricesService,
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
}
