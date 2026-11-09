// API_55: ngành hàng, đơn vị tính (CONG_VIEC_04). Đọc: người có quyền vào mini app Sản phẩm; sửa: quản lý ngành hàng phạm vi tập đoàn.
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Req } from "@nestjs/common";
import { createCategorySchema, createUnitSchema, updateCategorySchema, updateUnitSchema, versionSchema, type CategoryResponse, type UnitResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CategoriesService } from "./categories.service";
import { UnitsService } from "./units.service";

@Controller("catalog")
export class CatalogController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly categories: CategoriesService,
    private readonly units: UnitsService,
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
}
