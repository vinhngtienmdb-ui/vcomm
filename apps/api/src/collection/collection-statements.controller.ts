// API_102 đến API_105: đơn vị thu hộ (102), bảng đối soát thu hộ (103 danh sách, nhập tệp; 104 chi tiết, xử lý), tệp mẫu (105) (CONG_VIEC_19). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  collectionImportMaximumBytes,
  collectionStatementListQuerySchema,
  importCollectionStatementSchema,
  saveCollectorSchema,
  type CollectionStatementResponse,
  type CollectionStatementsResponse,
  type CollectorItem,
  type CollectorsResponse,
} from "contracts";
import type { Response } from "express";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { CollectionStatementsService } from "./collection-statements.service";

const versionSchema = z.object({ version: z.number().int().min(0) }).strict();

@Controller("finance")
export class CollectionStatementsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly statements: CollectionStatementsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.collection.view", "finance.collection.setup");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("collectors")
  async collectors(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CollectorsResponse> {
    return this.statements.collectors(await this.actor(request, companyId));
  }

  @Post("collectors")
  async createCollector(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CollectorItem> {
    return this.statements.saveCollector(await this.actor(request, companyId), null, saveCollectorSchema.parse(body));
  }

  @Put("collectors/:id")
  async updateCollector(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CollectorItem> {
    return this.statements.saveCollector(await this.actor(request, companyId), id, saveCollectorSchema.parse(body));
  }

  @Get("collection-statements/template")
  async template(@Req() request: AuthenticatedRequest, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.actor(request, companyId);
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", 'attachment; filename="mau-doi-soat-thu-ho.xlsx"');
    response.send(await this.statements.template());
  }

  @Get("collection-statements")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<CollectionStatementsResponse> {
    return this.statements.list(await this.actor(request, companyId), collectionStatementListQuerySchema.parse(query));
  }

  @Post("collection-statements")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: collectionImportMaximumBytes * 2, files: 1 } }))
  async import(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CollectionStatementResponse> {
    return this.statements.import(await this.actor(request, companyId), importCollectionStatementSchema.parse(body), file);
  }

  @Get("collection-statements/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CollectionStatementResponse> {
    return this.statements.detail(await this.actor(request, companyId), id);
  }

  @Delete("collection-statements/:id/lines/:lineId")
  async removeLine(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("lineId", UuidPipe) lineId: string,
    @Query("version") version: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CollectionStatementResponse> {
    return this.statements.removeLine(await this.actor(request, companyId), id, lineId, z.coerce.number().int().min(0).parse(version));
  }

  @Post("collection-statements/:id/discard")
  @HttpCode(204)
  async discard(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.statements.discard(await this.actor(request, companyId), id, versionSchema.parse(body).version);
  }
}
