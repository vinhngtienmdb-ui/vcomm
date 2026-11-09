// API_55 đến API_57: ngành hàng, đơn vị tính, sản phẩm, ảnh (CONG_VIEC_04). Đọc: người có quyền vào mini app Sản phẩm; sửa: quản lý ngành hàng phạm vi tập đoàn.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  createCategorySchema,
  createUnitSchema,
  productLimits,
  productListQuerySchema,
  saveProductSchema,
  updateCategorySchema,
  updateUnitSchema,
  versionSchema,
  copyProductSchema,
  createVariantLinkSchema,
  productImportMaximumBytes,
  type CategoryResponse,
  type ProductImportResponse,
  type VariantLinkResponse,
  type VariantLinkSuggestion,
  type PageResponse,
  type ProductImageResponse,
  type ProductListItem,
  type ProductResponse,
  type UnitResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import { localeOf } from "../common/api-error";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CategoriesService } from "./categories.service";
import { ProductImagesService } from "./product-images.service";
import { ProductImportService } from "./product-import.service";
import { VariantLinksService } from "./variant-links.service";
import { ProductsService } from "./products.service";
import { UnitsService } from "./units.service";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly categories: CategoriesService,
    private readonly units: UnitsService,
    private readonly products: ProductsService,
    private readonly images: ProductImagesService,
    private readonly imports: ProductImportService,
    private readonly links: VariantLinksService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, ...anyOf);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("categories")
  async listCategories(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CategoryResponse[]> {
    await this.actor(request, companyId, "catalog.access");
    return this.categories.list();
  }

  @Post("categories")
  async createCategory(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CategoryResponse> {
    return this.categories.create(await this.actor(request, companyId, "catalog.access"), createCategorySchema.parse(body));
  }

  @Patch("categories/:id")
  async updateCategory(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CategoryResponse> {
    return this.categories.update(await this.actor(request, companyId, "catalog.access"), id, updateCategorySchema.parse(body));
  }

  @Post("categories/:id/deactivate")
  @HttpCode(200)
  async deactivateCategory(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CategoryResponse> {
    return this.categories.setStatus(await this.actor(request, companyId, "catalog.access"), id, "inactive", versionSchema.parse(body).version);
  }

  @Post("categories/:id/activate")
  @HttpCode(200)
  async activateCategory(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CategoryResponse> {
    return this.categories.setStatus(await this.actor(request, companyId, "catalog.access"), id, "active", versionSchema.parse(body).version);
  }

  @Get("units")
  async listUnits(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<UnitResponse[]> {
    await this.actor(request, companyId, "catalog.access");
    return this.units.list();
  }

  @Post("units")
  async createUnit(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UnitResponse> {
    return this.units.create(await this.actor(request, companyId, "catalog.access"), createUnitSchema.parse(body));
  }

  @Patch("units/:id")
  async updateUnit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UnitResponse> {
    return this.units.update(await this.actor(request, companyId, "catalog.access"), id, updateUnitSchema.parse(body));
  }

  @Post("units/:id/deactivate")
  @HttpCode(200)
  async deactivateUnit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UnitResponse> {
    return this.units.setStatus(await this.actor(request, companyId, "catalog.access"), id, "inactive", versionSchema.parse(body).version);
  }

  @Post("units/:id/activate")
  @HttpCode(200)
  async activateUnit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UnitResponse> {
    return this.units.setStatus(await this.actor(request, companyId, "catalog.access"), id, "active", versionSchema.parse(body).version);
  }

  // API_56: sản phẩm.
  @Get("products")
  async listProducts(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<ProductListItem>> {
    const input = productListQuerySchema.parse(query);
    return this.products.list(await this.actor(request, companyId, "catalog.access"), input);
  }

  @Post("products")
  async createProduct(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProductResponse> {
    return this.products.create(await this.actor(request, companyId, "catalog.access"), saveProductSchema.parse(body));
  }

  @Get("products/:id")
  async productDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ProductResponse> {
    return this.products.detail(await this.actor(request, companyId, "catalog.access"), id);
  }

  @Patch("products/:id")
  async updateProduct(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProductResponse> {
    return this.products.update(await this.actor(request, companyId, "catalog.access"), id, saveProductSchema.parse(body));
  }

  @Post("products/:id/deactivate")
  @HttpCode(200)
  async deactivateProduct(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProductResponse> {
    return this.products.setStatus(await this.actor(request, companyId, "catalog.access"), id, "inactive", versionSchema.parse(body).version);
  }

  @Post("products/:id/activate")
  @HttpCode(200)
  async activateProduct(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProductResponse> {
    return this.products.setStatus(await this.actor(request, companyId, "catalog.access"), id, "active", versionSchema.parse(body).version);
  }

  // API_57: ảnh sản phẩm. Giới hạn 5 MB kiểm ở dịch vụ để báo đúng thông báo; multer chỉ cắt tệp quá lớn bất thường.
  @Post("products/:id/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: productLimits.imageBytes * 2, files: 1 } }))
  async addImage(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: { buffer: Buffer; size: number; originalname: string } | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ProductImageResponse> {
    return this.images.add(await this.actor(request, companyId, "catalog.access"), id, file);
  }

  // Thẻ img không gửi được header công ty nên nhận thêm tham số companyId.
  @Get("product-images/:id")
  async image(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Res() response: Response,
    @Query("companyId") queryCompanyId?: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    const file = await this.images.download(await this.actor(request, companyId ?? queryCompanyId, "catalog.access"), id);
    response.setHeader("content-type", file.contentType);
    response.setHeader("cache-control", "private, max-age=3600");
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Post("product-images/:id/primary")
  @HttpCode(204)
  async primaryImage(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.images.makePrimary(await this.actor(request, companyId, "catalog.access"), id);
  }

  @Delete("product-images/:id")
  @HttpCode(204)
  async removeImage(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.images.remove(await this.actor(request, companyId, "catalog.access"), id);
  }

  // API_58: nhập sản phẩm từ Excel.
  @Get("product-imports/template")
  async importTemplate(@Req() request: AuthenticatedRequest, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.actor(request, companyId, "catalog.access");
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", 'attachment; filename="mau-nhap-san-pham.xlsx"');
    response.send(await this.imports.template());
  }

  @Post("product-imports")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: productImportMaximumBytes * 2, files: 1 } }))
  async importProducts(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ProductImportResponse> {
    return this.imports.import(await this.actor(request, companyId, "catalog.access"), file, localeOf(request));
  }

  // API_59: liên kết biến thể giữa công ty, sao chép sản phẩm.
  @Get("products/:id/links")
  async productLinks(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<VariantLinkResponse[]> {
    return this.links.listForProduct(await this.actor(request, companyId, "catalog.access"), id);
  }

  @Get("products/:id/link-suggestions")
  async linkSuggestions(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Query("targetCompanyId", UuidPipe) targetCompanyId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<VariantLinkSuggestion[]> {
    return this.links.suggestions(await this.actor(request, companyId, "catalog.access"), id, targetCompanyId);
  }

  @Post("variant-links")
  async createLink(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<VariantLinkResponse> {
    return this.links.create(await this.actor(request, companyId, "catalog.access"), createVariantLinkSchema.parse(body));
  }

  @Delete("variant-links/:id")
  @HttpCode(204)
  async removeLink(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.links.remove(await this.actor(request, companyId, "catalog.access"), id);
  }

  @Post("products/:id/copy")
  async copyProduct(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<{ productId: string }> {
    return this.links.copy(await this.actor(request, companyId, "catalog.access"), id, copyProductSchema.parse(body).targetCompanyId);
  }
}
