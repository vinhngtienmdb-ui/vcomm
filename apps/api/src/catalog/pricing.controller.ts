// API_60 đến API_62: kênh bán, nhóm khách hàng, bảng giá, giá, phiếu điều chỉnh giá (CONG_VIEC_04). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  createCatalogItemSchema,
  createPriceListSchema,
  priceChangeImportColumns,
  priceChangeListQuerySchema,
  priceHistoryQuerySchema,
  priceListPricesQuerySchema,
  priceLookupQuerySchema,
  productImportMaximumBytes,
  savePriceChangeSchema,
  updateCatalogItemSchema,
  updatePriceListSchema,
  versionSchema,
  type CatalogItemResponse,
  type PageResponse,
  type PriceChangeImportResponse,
  type PriceChangeListItem,
  type PriceChangeResponse,
  type PriceHistoryItem,
  type PriceListResponse,
  type PriceLookupResponse,
  type PriceRow,
} from "contracts";
import type { Response } from "express";
import writeXlsxFile from "write-excel-file/node";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { localeOf } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CatalogItemsService, type CatalogItemKind } from "./catalog-items.service";
import { PriceChangesService } from "./price-changes.service";
import { PriceListsService } from "./price-lists.service";

const itemPaths = ["sales-channels", "customer-groups"];
const kindOf = (request: AuthenticatedRequest): CatalogItemKind => (request.path.includes("/customer-groups") ? "customer_group" : "channel");
const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");

@Controller("catalog")
export class PricingController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly items: CatalogItemsService,
    private readonly priceLists: PriceListsService,
    private readonly priceChanges: PriceChangesService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "catalog.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // API_60
  @Post("sales-channels/defaults")
  async defaultChannels(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CatalogItemResponse[]> {
    return this.items.createDefaultChannels(await this.actor(request, companyId));
  }

  @Get(itemPaths)
  async listItems(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CatalogItemResponse[]> {
    return this.items.list(await this.actor(request, companyId), kindOf(request));
  }

  @Post(itemPaths)
  async createItem(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CatalogItemResponse> {
    return this.items.create(await this.actor(request, companyId), kindOf(request), createCatalogItemSchema.parse(body));
  }

  @Patch(itemPaths.map((path) => `${path}/:id`))
  async updateItem(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CatalogItemResponse> {
    return this.items.update(await this.actor(request, companyId), kindOf(request), id, updateCatalogItemSchema.parse(body));
  }

  @Post(itemPaths.flatMap((path) => [`${path}/:id/deactivate`, `${path}/:id/activate`]))
  async setItemStatus(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CatalogItemResponse> {
    return this.items.setStatus(await this.actor(request, companyId), kindOf(request), id, statusOf(request), versionSchema.parse(body).version);
  }

  // API_61
  @Get("price-lists")
  async listPriceLists(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PriceListResponse[]> {
    return this.priceLists.list(await this.actor(request, companyId));
  }

  @Post("price-lists")
  async createPriceList(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceListResponse> {
    return this.priceLists.create(await this.actor(request, companyId), createPriceListSchema.parse(body));
  }

  @Patch("price-lists/:id")
  async updatePriceList(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceListResponse> {
    return this.priceLists.update(await this.actor(request, companyId), id, updatePriceListSchema.parse(body));
  }

  @Post(["price-lists/:id/deactivate", "price-lists/:id/activate"])
  async setPriceListStatus(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceListResponse> {
    return this.priceLists.setStatus(await this.actor(request, companyId), id, statusOf(request), versionSchema.parse(body).version);
  }

  @Get("price-lists/:id/prices")
  async prices(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<PriceRow>> {
    return this.priceLists.prices(await this.actor(request, companyId), id, priceListPricesQuerySchema.parse(query));
  }

  @Get("price-lists/:id/history")
  async history(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceHistoryItem[]> {
    const parsed = priceHistoryQuerySchema.parse(query);
    return this.priceLists.history(await this.actor(request, companyId), id, parsed.variantId, parsed.unitId);
  }

  @Get("prices/lookup")
  async lookup(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceLookupResponse> {
    return this.priceLists.lookup(await this.actor(request, companyId), priceLookupQuerySchema.parse(query));
  }

  // API_62
  @Get("price-changes")
  async listChanges(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<PriceChangeListItem>> {
    return this.priceChanges.list(await this.actor(request, companyId), priceChangeListQuerySchema.parse(query));
  }

  @Get("price-changes/import-template")
  async changeTemplate(@Req() request: AuthenticatedRequest, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.actor(request, companyId);
    const header = priceChangeImportColumns.map((value) => ({ value, fontWeight: "bold" as const }));
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", 'attachment; filename="mau-dieu-chinh-gia.xlsx"');
    response.send(await writeXlsxFile([header, ["AOTH-00001-01", "CAI", "150000"].map((value) => ({ value }))], { sheet: "Giá" }).toBuffer());
  }

  @Post("price-changes/import-lines")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: productImportMaximumBytes * 2, files: 1 } }))
  async importLines(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Query("priceListId") priceListId: string | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PriceChangeImportResponse> {
    const listId = priceListId ? new UuidPipe().transform(priceListId) : undefined;
    return this.priceChanges.importLines(await this.actor(request, companyId), listId, file, localeOf(request));
  }

  @Get("price-changes/:id")
  async changeDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PriceChangeResponse> {
    return this.priceChanges.detail(await this.actor(request, companyId), id);
  }

  @Post("price-changes")
  async createChange(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceChangeResponse> {
    return this.priceChanges.create(await this.actor(request, companyId), savePriceChangeSchema.parse(body));
  }

  @Patch("price-changes/:id")
  async updateChange(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PriceChangeResponse> {
    return this.priceChanges.update(await this.actor(request, companyId), id, savePriceChangeSchema.parse(body));
  }

  @Delete("price-changes/:id")
  @HttpCode(204)
  async removeChange(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.priceChanges.remove(await this.actor(request, companyId), id);
  }

  @Post("price-changes/:id/submit")
  async submitChange(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PriceChangeResponse> {
    return this.priceChanges.submit(await this.actor(request, companyId), id);
  }

  @Post("price-changes/:id/withdraw")
  async withdrawChange(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PriceChangeResponse> {
    return this.priceChanges.withdraw(await this.actor(request, companyId), id);
  }
}
