// API_91, API_92: hóa đơn điện tử, cài đặt hóa đơn điện tử (CONG_VIEC_16). Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req, Res, StreamableFile } from "@nestjs/common";
import { einvoiceListQuerySchema, updateEinvoiceSettingsSchema, type EinvoiceListItem, type EinvoiceResponse, type EinvoiceSettingsResponse, type PageResponse } from "contracts";
import type { Response } from "express";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { EinvoiceSettingsService } from "./einvoice-settings.service";
import { EinvoicesService } from "./einvoices.service";

const resendSchema = z.object({ version: z.number().int().min(0) }).strict();

@Controller("finance")
export class EinvoicesController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly settings: EinvoiceSettingsService,
    private readonly einvoices: EinvoicesService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "finance.access", "finance.einvoice.view");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("einvoice-settings")
  async getSettings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<EinvoiceSettingsResponse> {
    return this.settings.get(await this.actor(request, companyId));
  }

  @Put("einvoice-settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<EinvoiceSettingsResponse> {
    return this.settings.update(await this.actor(request, companyId), updateEinvoiceSettingsSchema.parse(body));
  }

  @Get("einvoices")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<EinvoiceListItem>> {
    return this.einvoices.list(await this.actor(request, companyId), einvoiceListQuerySchema.parse(query));
  }

  @Get("einvoices/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<EinvoiceResponse> {
    return this.einvoices.detail(await this.actor(request, companyId), id);
  }

  @Post("einvoices/:id/resend")
  async resend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<EinvoiceResponse> {
    return this.einvoices.resend(await this.actor(request, companyId), id, resendSchema.parse(body).version);
  }

  @Get("einvoices/:id/file/:format")
  async file(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("format") format: string,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<StreamableFile> {
    if (format !== "pdf" && format !== "xml") throw new ApiError("NOT_FOUND", "notFound");
    const file = await this.einvoices.file(await this.actor(request, companyId), id, format);
    response.setHeader("content-type", format === "pdf" ? "application/pdf" : "application/xml");
    response.setHeader("content-disposition", `${format === "pdf" ? "inline" : "attachment"}; filename="${file.fileName}"`);
    return new StreamableFile(file.content);
  }
}
