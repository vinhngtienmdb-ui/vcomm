// API_63: kho, vị trí, cài đặt kho (CONG_VIEC_05). Quyền chi tiết kiểm trong service theo chi nhánh sở hữu kho.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from "@nestjs/common";
import {
  qualityCheckSchema,
  savePurchaseReceiptSchema,
  savePurchaseReturnSchema,
  createLocationsSchema,
  createReservationSchema,
  extendReservationSchema,
  locationLabelQuerySchema,
  productLabelQuerySchema,
  reservationListQuerySchema,
  saveStockLevelSchema,
  stockLevelQuerySchema,
  type ReservationResponse,
  type StockLevelRow,
  createStocktakeSchema,
  finishStocktakeSchema,
  saveStocktakeCountsSchema,
  type StocktakeListItem,
  type StocktakeOptionsResponse,
  type StocktakeResponse,
  lotSuggestionQuerySchema,
  receiveTransferSchema,
  saveStockDocumentSchema,
  stockCardQuerySchema,
  stockDetailQuerySchema,
  stockDocumentListQuerySchema,
  stockItemSearchQuerySchema,
  stockListQuerySchema,
  type LotSuggestion,
  type PageResponse,
  type StockCardResponse,
  type StockDetailResponse,
  type StockDocumentListItem,
  type StockDocumentResponse,
  type StockItemOption,
  type StockRow,
  type TransferDestination,
  createWarehouseSchema,
  updateInventorySettingsSchema,
  updateLocationSchema,
  updateWarehouseSchema,
  versionSchema,
  type InventorySettingsResponse,
  type LocationResponse,
  type WarehouseOptionsResponse,
  type WarehouseResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { StockDocumentsService } from "./stock-documents.service";
import { LabelsService } from "./labels.service";
import { ReservationsService } from "./reservations.service";
import { StockLevelsService } from "./stock-levels.service";
import { StockService } from "./stock.service";
import { PurchaseReceiptsService } from "./purchase-receipts.service";
import { purchaseTypes } from "./stock-documents.service";
import { StocktakesService } from "./stocktakes.service";
import { TransfersService } from "./transfers.service";
import { WarehousesService } from "./warehouses.service";

const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");

@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly warehouses: WarehousesService,
    private readonly stock: StockService,
    private readonly documents: StockDocumentsService,
    private readonly transfers: TransfersService,
    private readonly stocktakes: StocktakesService,
    private readonly reservations: ReservationsService,
    private readonly stockLevels: StockLevelsService,
    private readonly labels: LabelsService,
    private readonly purchases: PurchaseReceiptsService,
  ) {}

  // Vào mini app Kho: quyền kho ở công ty đang chọn hoặc ở bất kỳ chi nhánh nào của công ty đó.
  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "inventory.access", "inventory.stock.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("warehouses")
  async list(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<WarehouseResponse[]> {
    return this.warehouses.list(await this.actor(request, companyId));
  }

  @Post("warehouses")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<WarehouseResponse> {
    return this.warehouses.create(await this.actor(request, companyId), createWarehouseSchema.parse(body));
  }

  @Get("warehouse-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<WarehouseOptionsResponse> {
    return this.warehouses.options(await this.actor(request, companyId));
  }

  @Get("warehouses/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<WarehouseResponse> {
    return this.warehouses.detail(await this.actor(request, companyId), id);
  }

  @Patch("warehouses/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<WarehouseResponse> {
    return this.warehouses.update(await this.actor(request, companyId), id, updateWarehouseSchema.parse(body));
  }

  @Post(["warehouses/:id/deactivate", "warehouses/:id/activate"])
  async setStatus(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<WarehouseResponse> {
    return this.warehouses.setStatus(await this.actor(request, companyId), id, statusOf(request), versionSchema.parse(body).version);
  }

  @Get("warehouses/:id/locations")
  async locations(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<LocationResponse[]> {
    return this.warehouses.locations(await this.actor(request, companyId), id);
  }

  @Post("warehouses/:id/locations")
  async createLocations(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LocationResponse[]> {
    return this.warehouses.createLocations(await this.actor(request, companyId), id, createLocationsSchema.parse(body));
  }

  @Patch("warehouses/:id/locations/:locationId")
  async updateLocation(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("locationId", UuidPipe) locationId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<LocationResponse[]> {
    return this.warehouses.updateLocation(await this.actor(request, companyId), id, locationId, updateLocationSchema.parse(body));
  }

  @Post(["warehouses/:id/locations/:locationId/deactivate", "warehouses/:id/locations/:locationId/activate"])
  async setLocationStatus(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("locationId", UuidPipe) locationId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<LocationResponse[]> {
    return this.warehouses.setLocationStatus(await this.actor(request, companyId), id, locationId, statusOf(request), versionSchema.parse(body).version);
  }

  @Get("settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<InventorySettingsResponse> {
    return this.warehouses.settings((await this.actor(request, companyId)).companyId);
  }

  @Put("settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<InventorySettingsResponse> {
    return this.warehouses.updateSettings(await this.actor(request, companyId), updateInventorySettingsSchema.parse(body));
  }
  // API_64: tồn kho, chi tiết, thẻ kho.
  @Get("stock")
  async stockList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<StockRow>> {
    return this.stock.list(await this.actor(request, companyId), stockListQuerySchema.parse(query));
  }

  @Get("stock/:variantId/details")
  async stockDetail(
    @Req() request: AuthenticatedRequest,
    @Param("variantId", UuidPipe) variantId: string,
    @Query() query: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<StockDetailResponse> {
    return this.stock.detail(await this.actor(request, companyId), variantId, stockDetailQuerySchema.parse(query));
  }

  @Get("stock-card")
  async stockCard(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StockCardResponse> {
    return this.stock.card(await this.actor(request, companyId), stockCardQuerySchema.parse(query));
  }

  // API_65: phiếu nhập khác, xuất khác, điều chỉnh.
  @Get("documents")
  async listDocuments(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<StockDocumentListItem>> {
    return this.documents.list(await this.actor(request, companyId), stockDocumentListQuerySchema.parse(query));
  }

  @Get("documents/lot-suggestions")
  async lotSuggestions(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<LotSuggestion[]> {
    return this.documents.lotSuggestions(await this.actor(request, companyId), lotSuggestionQuerySchema.parse(query));
  }

  @Get("items")
  async searchItems(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StockItemOption[]> {
    return this.documents.searchItems(await this.actor(request, companyId), stockItemSearchQuerySchema.parse(query));
  }

  @Get("documents/:id")
  async documentDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.documents.detail(await this.actor(request, companyId), id);
  }

  @Post("documents")
  async createDocument(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.documents.create(await this.actor(request, companyId), saveStockDocumentSchema.parse(body));
  }

  @Patch("documents/:id")
  async updateDocument(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.documents.update(await this.actor(request, companyId), id, saveStockDocumentSchema.parse(body));
  }

  @Delete("documents/:id")
  @HttpCode(204)
  async removeDocument(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    const actor = await this.actor(request, companyId);
    const row = await this.documents.visibleRow(actor, id);
    // Nháp phiếu nhập mua, trả hàng: người lập có quyền nhập mua xóa được (không cần quyền lập phiếu kho thường).
    if (purchaseTypes.includes(row.type)) await this.purchases.remove(actor, id);
    else await this.documents.remove(actor, id);
  }

  // Phiếu nhập mua, trả hàng nhà cung cấp gửi qua luồng riêng (không đi luồng duyệt, CONG_VIEC_07).
  @Post("documents/:id/submit")
  async submitDocument(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    const actor = await this.actor(request, companyId);
    const row = await this.documents.visibleRow(actor, id);
    return purchaseTypes.includes(row.type) ? this.purchases.submit(actor, id) : this.documents.submit(actor, id);
  }

  // API_76: đơn mua đã duyệt nhận vào kho người dùng nhập mua được; dòng còn nhận được.
  @Get("purchase-orders")
  async openPurchaseOrders(@Req() request: AuthenticatedRequest, @Query("search") search: string | undefined, @Headers("x-company-id") companyId?: string) {
    return this.purchases.openOrders(await this.actor(request, companyId), search?.trim().slice(0, 100) || undefined);
  }

  @Get("purchase-orders/:id")
  async purchaseOrderLines(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string) {
    return this.purchases.orderLines(await this.actor(request, companyId), id);
  }

  @Post("purchase-receipts")
  async createPurchaseReceipt(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.purchases.createReceipt(await this.actor(request, companyId), savePurchaseReceiptSchema.parse(body));
  }

  @Patch("purchase-receipts/:id")
  async updatePurchaseReceipt(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<StockDocumentResponse> {
    return this.purchases.updateReceipt(await this.actor(request, companyId), id, savePurchaseReceiptSchema.parse(body));
  }

  @Post("documents/:id/quality-check")
  async qualityCheck(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.purchases.qualityCheck(await this.actor(request, companyId), id, qualityCheckSchema.parse(body));
  }

  @Post("purchase-returns")
  async createPurchaseReturn(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.purchases.createReturn(await this.actor(request, companyId), savePurchaseReturnSchema.parse(body));
  }

  @Patch("purchase-returns/:id")
  async updatePurchaseReturn(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<StockDocumentResponse> {
    return this.purchases.updateReturn(await this.actor(request, companyId), id, savePurchaseReturnSchema.parse(body));
  }

  @Post("documents/:id/withdraw")
  async withdrawDocument(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.documents.withdraw(await this.actor(request, companyId), id);
  }

  // API_66: chuyển kho hai bước.
  @Get("transfer-destinations")
  async transferDestinations(@Req() request: AuthenticatedRequest, @Query("companyId", UuidPipe) owner: string, @Headers("x-company-id") companyId?: string): Promise<TransferDestination[]> {
    return this.transfers.destinations(await this.actor(request, companyId), owner);
  }

  @Post("documents/:id/ship")
  async ship(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.transfers.ship(await this.actor(request, companyId), id);
  }

  @Post("documents/:id/receive")
  async receive(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockDocumentResponse> {
    return this.transfers.receive(await this.actor(request, companyId), id, receiveTransferSchema.parse(body));
  }

  // API_67: kiểm kê.
  @Get("stocktakes")
  async listStocktakes(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<StocktakeListItem[]> {
    return this.stocktakes.list(await this.actor(request, companyId));
  }

  @Post("stocktakes")
  async createStocktake(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StocktakeResponse> {
    return this.stocktakes.create(await this.actor(request, companyId), createStocktakeSchema.parse(body));
  }

  @Get("stocktake-options")
  async stocktakeOptions(@Req() request: AuthenticatedRequest, @Query("warehouseId", UuidPipe) warehouseId: string, @Headers("x-company-id") companyId?: string): Promise<StocktakeOptionsResponse> {
    return this.stocktakes.options(await this.actor(request, companyId), warehouseId);
  }

  @Get("stocktakes/:id")
  async stocktake(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StocktakeResponse> {
    return this.stocktakes.detail(await this.actor(request, companyId), id);
  }

  @Post("stocktakes/:id/start")
  async startStocktake(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StocktakeResponse> {
    return this.stocktakes.start(await this.actor(request, companyId), id);
  }

  @Put("stocktakes/:id/counts")
  async saveCounts(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StocktakeResponse> {
    return this.stocktakes.saveCounts(await this.actor(request, companyId), id, saveStocktakeCountsSchema.parse(body));
  }

  @Post("stocktakes/:id/finish")
  async finishStocktake(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StocktakeResponse> {
    return this.stocktakes.finish(await this.actor(request, companyId), id, finishStocktakeSchema.parse(body));
  }

  @Post("stocktakes/:id/cancel")
  async cancelStocktake(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<StocktakeResponse> {
    return this.stocktakes.cancel(await this.actor(request, companyId), id);
  }

  // API_68: giữ hàng.
  @Get("reservations")
  async listReservations(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<ReservationResponse>> {
    return this.reservations.list(await this.actor(request, companyId), reservationListQuerySchema.parse(query));
  }

  @Post("reservations")
  async createReservation(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReservationResponse> {
    return this.reservations.create(await this.actor(request, companyId), createReservationSchema.parse(body));
  }

  @Post("reservations/:id/extend")
  async extendReservation(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReservationResponse> {
    return this.reservations.extend(await this.actor(request, companyId), id, extendReservationSchema.parse(body));
  }

  @Post("reservations/:id/release")
  async releaseReservation(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ReservationResponse> {
    return this.reservations.release(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  // API_69: tồn an toàn, cảnh báo.
  @Get("stock-levels")
  async listStockLevels(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<StockLevelRow[]> {
    return this.stockLevels.list(await this.actor(request, companyId), stockLevelQuerySchema.parse(query));
  }

  @Get("stock-alerts")
  async stockAlerts(@Req() request: AuthenticatedRequest, @Query("warehouseId") warehouseId: string | undefined, @Headers("x-company-id") companyId?: string): Promise<StockLevelRow[]> {
    return this.stockLevels.list(await this.actor(request, companyId), stockLevelQuerySchema.parse({ ...(warehouseId ? { warehouseId } : {}), onlyAlerts: "true" }));
  }

  @Put("stock-levels")
  async saveStockLevel(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<StockLevelRow> {
    return this.stockLevels.save(await this.actor(request, companyId), saveStockLevelSchema.parse(body));
  }

  @Delete("stock-levels/:warehouseId/:companyId/:variantId")
  @HttpCode(204)
  async removeStockLevel(
    @Req() request: AuthenticatedRequest,
    @Param("warehouseId", UuidPipe) warehouseId: string,
    @Param("companyId", UuidPipe) owner: string,
    @Param("variantId", UuidPipe) variantId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    await this.stockLevels.remove(await this.actor(request, companyId), warehouseId, owner, variantId);
  }

  // API_70: tem PDF.
  @Get("labels/products")
  async productLabels(@Req() request: AuthenticatedRequest, @Res() response: Response, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    const parsed = productLabelQuerySchema.parse(query);
    const variantIds = parsed.variantIds.split(",").map((id) => new UuidPipe().transform(id.trim()));
    sendPdf(response, "tem-san-pham.pdf", await this.labels.products(await this.actor(request, companyId), parsed.companyId, variantIds, parsed.copies));
  }

  @Get("labels/locations")
  async locationLabels(@Req() request: AuthenticatedRequest, @Res() response: Response, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    sendPdf(response, "tem-vi-tri.pdf", await this.labels.locations(await this.actor(request, companyId), locationLabelQuerySchema.parse(query).warehouseId));
  }
}

function sendPdf(response: Response, fileName: string, content: Buffer): void {
  response.setHeader("content-type", "application/pdf");
  response.setHeader("content-disposition", `inline; filename="${fileName}"`);
  response.send(content);
}
