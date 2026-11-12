// API_140, API_141: tờ khai hải quan nhập khẩu; API_142, API_143: chứng từ chi phí nhập khẩu (CONG_VIEC_45); API_219: tờ khai bổ sung (CONG_VIEC_56).
// Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  importDeclarationListQuerySchema,
  landedCostListQuerySchema,
  saveLandedCostSchema,
  type LandedCostAllocation,
  type LandedCostListItem,
  type LandedCostResponse,
  saveImportDeclarationSchema,
  saveImportAmendmentSchema,
  versionSchema,
  type ImportAmendmentBase,
  type ImportAmendmentListItem,
  type ImportAmendmentResponse,
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
import { ImportAmendmentsService } from "./import-amendments.service";
import { ImportDeclarationsService } from "./import-declarations.service";
import { LandedCostsService } from "./landed-costs.service";

const orderOptionsQuerySchema = z.object({ orderId: z.uuid().optional() }).strict();
const amendmentListQuerySchema = z.object({ declarationId: z.uuid() }).strict();

@Controller("purchasing")
export class PurchasingImportsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly declarations: ImportDeclarationsService,
    private readonly landedCosts: LandedCostsService,
    private readonly amendments: ImportAmendmentsService,
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

  @Get("import-amendments")
  async listAmendments(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentListItem[]> {
    return this.amendments.list(await this.actor(request, companyId), amendmentListQuerySchema.parse(query).declarationId);
  }

  @Post("import-amendments")
  async createAmendment(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentResponse> {
    return this.amendments.save(await this.actor(request, companyId), null, saveImportAmendmentSchema.parse(body));
  }

  // Đặt trước "import-amendments/:id".
  @Get("import-amendments/current")
  async amendmentBase(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentBase> {
    return this.amendments.base(await this.actor(request, companyId), amendmentListQuerySchema.parse(query).declarationId);
  }

  @Get("import-amendments/:id")
  async amendment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentResponse> {
    return this.amendments.detail(await this.actor(request, companyId), id);
  }

  @Patch("import-amendments/:id")
  async updateAmendment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentResponse> {
    return this.amendments.save(await this.actor(request, companyId), id, saveImportAmendmentSchema.parse(body));
  }

  @Post("import-amendments/:id/cancel")
  async cancelAmendment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentResponse> {
    return this.amendments.cancel(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Get("import-amendments/:id/allocation-preview")
  async amendmentPreview(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ImportAllocationPreview> {
    return this.amendments.preview(await this.actor(request, companyId), id);
  }

  @Post("import-amendments/:id/post")
  async postAmendment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ImportAmendmentResponse> {
    return this.amendments.post(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Get("landed-costs")
  async listCosts(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<LandedCostListItem>> {
    return this.landedCosts.list(await this.actor(request, companyId), landedCostListQuerySchema.parse(query));
  }

  @Post("landed-costs")
  async createCost(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LandedCostResponse> {
    return this.landedCosts.create(await this.actor(request, companyId), saveLandedCostSchema.parse(body));
  }

  @Get("landed-costs/:id")
  async costDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<LandedCostResponse> {
    return this.landedCosts.detail(await this.actor(request, companyId), id);
  }

  @Patch("landed-costs/:id")
  async updateCost(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LandedCostResponse> {
    return this.landedCosts.update(await this.actor(request, companyId), id, saveLandedCostSchema.parse(body));
  }

  @Post("landed-costs/:id/cancel")
  async cancelCost(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LandedCostResponse> {
    return this.landedCosts.cancel(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }

  @Get("landed-costs/:id/allocation")
  async costAllocation(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<LandedCostAllocation> {
    return this.landedCosts.allocation(await this.actor(request, companyId), id);
  }

  @Post("landed-costs/:id/post")
  async postCost(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LandedCostResponse> {
    return this.landedCosts.post(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }
}
