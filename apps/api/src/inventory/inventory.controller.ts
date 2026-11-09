// API_63: kho, vị trí, cài đặt kho (CONG_VIEC_05). Quyền chi tiết kiểm trong service theo chi nhánh sở hữu kho.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Req } from "@nestjs/common";
import {
  createLocationsSchema,
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
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { WarehousesService } from "./warehouses.service";

const statusOf = (request: AuthenticatedRequest) => (request.path.endsWith("/deactivate") ? "inactive" : "active");

@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly warehouses: WarehousesService,
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
}
