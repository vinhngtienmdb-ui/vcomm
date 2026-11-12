// API_265, API_266: sản phẩm dropship, tồn nhà cung cấp khai báo (CONG_VIEC_62). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  createDropshipProductSchema,
  dropshipProductListQuerySchema,
  dropshipStockImportColumns,
  productImportMaximumBytes,
  updateDropshipProductSchema,
  updateDropshipStockSchema,
  type DropshipOptionsResponse,
  type DropshipProductDetailResponse,
  type DropshipProductResponse,
  type DropshipStockImportResponse,
  type PageResponse,
} from "contracts";
import type { Response } from "express";
import writeXlsxFile from "write-excel-file/node";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { localeOf } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { DropshipProductsService } from "./dropship-products.service";
import { purchasingPermissions } from "./purchasing-context";

@Controller("purchasing")
export class DropshipController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly products: DropshipProductsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, purchasingPermissions.viewDropship, purchasingPermissions.manageDropship);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("dropship-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<DropshipOptionsResponse> {
    return this.products.options(await this.actor(request, companyId));
  }

  @Get("dropship-products")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<DropshipProductResponse>> {
    return this.products.list(await this.actor(request, companyId), dropshipProductListQuerySchema.parse(query));
  }

  @Get("dropship-products/stock-import-template")
  async template(@Req() request: AuthenticatedRequest, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.actor(request, companyId);
    const header = dropshipStockImportColumns.map((value) => ({ value, fontWeight: "bold" as const }));
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", 'attachment; filename="mau-ton-dropship.xlsx"');
    response.send(await writeXlsxFile([header, ["AOTH-00001-01", "100"].map((value) => ({ value }))], { sheet: "Tồn" }).toBuffer());
  }

  @Post("dropship-products/stock-import")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: productImportMaximumBytes * 2, files: 1 } }))
  async importStock(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<DropshipStockImportResponse> {
    return this.products.importStock(await this.actor(request, companyId), file, localeOf(request));
  }

  @Get("dropship-products/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<DropshipProductDetailResponse> {
    return this.products.detail(await this.actor(request, companyId), id);
  }

  @Post("dropship-products")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DropshipProductResponse> {
    return this.products.create(await this.actor(request, companyId), createDropshipProductSchema.parse(body));
  }

  @Patch("dropship-products/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DropshipProductResponse> {
    return this.products.update(await this.actor(request, companyId), id, updateDropshipProductSchema.parse(body));
  }

  @Patch("dropship-products/:id/stock")
  async updateStock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DropshipProductResponse> {
    return this.products.updateStock(await this.actor(request, companyId), id, updateDropshipStockSchema.parse(body));
  }
}
