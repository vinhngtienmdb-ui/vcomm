// API_140, API_141: tờ khai hải quan nhập khẩu (CONG_VIEC_45). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  importDeclarationListQuerySchema,
  saveImportDeclarationSchema,
  versionSchema,
  type ImportAllocationPreview,
  type ImportDeclarationListItem,
  type ImportDeclarationResponse,
  type ImportOrderOption,
  type PageResponse,
} from "contracts";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ImportDeclarationsService } from "./import-declarations.service";

const orderOptionsQuerySchema = z.object({ orderId: z.uuid().optional() }).strict();

@Controller("purchasing")
export class PurchasingImportsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly declarations: ImportDeclarationsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "purchasing.import.view", "purchasing.import.manage");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("import-orders")
  async orders(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportOrderOption[]> {
    return this.declarations.orderOptions(await this.actor(request, companyId), orderOptionsQuerySchema.parse(query).orderId);
  }

  @Get("import-declarations")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<ImportDeclarationListItem>> {
    return this.declarations.list(await this.actor(request, companyId), importDeclarationListQuerySchema.parse(query));
  }

  @Post("import-declarations")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportDeclarationResponse> {
    return this.declarations.create(await this.actor(request, companyId), saveImportDeclarationSchema.parse(body));
  }

  @Get("import-declarations/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ImportDeclarationResponse> {
    return this.declarations.detail(await this.actor(request, companyId), id);
  }

  @Patch("import-declarations/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportDeclarationResponse> {
    return this.declarations.update(await this.actor(request, companyId), id, saveImportDeclarationSchema.parse(body));
  }

  @Post("import-declarations/:id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportDeclarationResponse> {
    return this.declarations.cancel(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Get("import-declarations/:id/allocation-preview")
  async preview(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ImportAllocationPreview> {
    return this.declarations.preview(await this.actor(request, companyId), id);
  }

  @Post("import-declarations/:id/post")
  async post(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportDeclarationResponse> {
    return this.declarations.post(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }
}
