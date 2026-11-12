// API_246 Hợp đồng, phụ lục; API_247 Loại hợp đồng, tùy chọn, đối tác (CONG_VIEC_59 lát L2).
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import {
  officeContractDecisionSchema,
  officeContractListQuerySchema,
  officeContractPartnerQuerySchema,
  officeContractReasonSchema,
  officeContractSigningSchema,
  officeContractTypeSchema,
  officeContractVersionSchema,
  officeEndContractSchema,
  officeImportAppendixSchema,
  officeImportContractSchema,
  officeSaveAppendixSchema,
  officeSaveContractSchema,
  officeShareContractSchema,
  officeUpdateSignedContractSchema,
  type OfficeContractListResponse,
  type OfficeContractOptions,
  type OfficeContractPartnerItem,
  type OfficeContractResponse,
  type OfficeContractTypeItem,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../../auth/auth.controller";
import type { AuthenticatedRequest } from "../../auth/auth.guard";
import { ApiError } from "../../common/api-error";
import { UuidPipe } from "../../common/uuid.pipe";
import { PermissionService } from "../../permissions/permission.service";
import type { Actor } from "../../permissions/roles.service";
import { officeContentDisposition } from "../office.controller";
import { OfficeFileUpload } from "../office-upload";
import { OfficeContractsService } from "./office-contracts.service";

type Upload = { buffer: Buffer; size: number; originalname: string };

// Biểu mẫu multipart: phần dữ liệu đi trong trường "data" (JSON).
const jsonField = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

@Controller("office")
export class OfficeContractsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly contracts: OfficeContractsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, permission = "office.access"): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, permission);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // API_247
  @Get("contract-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<OfficeContractOptions> {
    return this.contracts.options(await this.actor(request, companyId));
  }

  @Get("contract-partners")
  async partners(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractPartnerItem[]> {
    return this.contracts.partners(await this.actor(request, companyId), officeContractPartnerQuerySchema.parse(query).search);
  }

  @Get("contract-types")
  async types(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<OfficeContractTypeItem[]> {
    return this.contracts.types(await this.actor(request, companyId));
  }

  @Post("contract-types")
  async createType(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractTypeItem[]> {
    return this.contracts.createType(await this.actor(request, companyId, "office.contract.manage"), officeContractTypeSchema.parse(body));
  }

  @Put("contract-types/:id")
  async updateType(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractTypeItem[]> {
    return this.contracts.updateType(await this.actor(request, companyId, "office.contract.manage"), id, officeContractTypeSchema.parse(body));
  }

  // API_246
  @Get("contracts")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractListResponse> {
    return this.contracts.list(await this.actor(request, companyId), officeContractListQuerySchema.parse(query));
  }

  @Post("contracts")
  @UseInterceptors(OfficeFileUpload())
  async create(@Req() request: AuthenticatedRequest, @Body("data") data: unknown, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string) {
    return this.contracts.create(await this.actor(request, companyId, "office.contract.create"), officeSaveContractSchema.parse(jsonField(data)), file);
  }

  @Post("contracts/import")
  @UseInterceptors(OfficeFileUpload())
  async importSigned(@Req() request: AuthenticatedRequest, @Body("data") data: unknown, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string) {
    return this.contracts.importSigned(await this.actor(request, companyId, "office.contract.create"), officeImportContractSchema.parse(jsonField(data)), file);
  }

  @Get("contracts/:id")
  async get(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    return this.contracts.get(await this.actor(request, companyId), id);
  }

  // Sửa khi nháp, bị từ chối, đã rút: multipart, tệp nội dung không bắt buộc.
  @Post("contracts/:id")
  @UseInterceptors(OfficeFileUpload())
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ) {
    return this.contracts.update(await this.actor(request, companyId), id, officeSaveContractSchema.parse(jsonField(data)), file);
  }

  @Patch("contracts/:id")
  async updateSigned(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    return this.contracts.updateSigned(await this.actor(request, companyId), id, officeUpdateSignedContractSchema.parse(body));
  }

  @Post("contracts/:id/files")
  @UseInterceptors(OfficeFileUpload())
  async attach(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeContractResponse> {
    return this.contracts.attach(await this.actor(request, companyId), id, file);
  }

  @Get("contracts/:id/files/:fileId")
  async file(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ) {
    const file = await this.contracts.file(await this.actor(request, companyId), id, fileId);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", officeContentDisposition(file.contentType === "application/pdf" ? "inline" : "attachment", file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("cache-control", "no-store");
    response.send(file.content);
  }

  @Post("contracts/:id/submit")
  @HttpCode(200)
  async submit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    return this.contracts.submit(await this.actor(request, companyId), id, officeContractVersionSchema.parse(body).version);
  }

  @Post("contracts/:id/withdraw")
  @HttpCode(200)
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    return this.contracts.withdraw(await this.actor(request, companyId), id, officeContractVersionSchema.parse(body).version);
  }

  @Post("contracts/:id/decide")
  @HttpCode(200)
  async decide(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    const input = officeContractDecisionSchema.parse(body);
    return this.contracts.decide(await this.actor(request, companyId), id, input.decision, input.note, input.version);
  }

  @Post("contracts/:id/signing")
  @HttpCode(200)
  async signing(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    return this.contracts.startContractSigning(await this.actor(request, companyId), id, officeContractSigningSchema.parse(body));
  }

  @Post("contracts/:id/cancel")
  @HttpCode(200)
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    const input = officeContractReasonSchema.parse(body);
    return this.contracts.cancel(await this.actor(request, companyId), id, input.reason, input.version);
  }

  // Thanh lý, chấm dứt: multipart gồm "data" và tệp biên bản "file".
  @Post("contracts/:id/end")
  @HttpCode(200)
  @UseInterceptors(OfficeFileUpload())
  async end(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ) {
    return this.contracts.end(await this.actor(request, companyId), id, officeEndContractSchema.parse(jsonField(data)), file);
  }

  @Post("contracts/:id/shares")
  async share(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeContractResponse> {
    return this.contracts.share(await this.actor(request, companyId), id, officeShareContractSchema.parse(body).userId);
  }

  @Delete("contracts/:id/shares/:userId")
  async unshare(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("userId", UuidPipe) userId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeContractResponse> {
    return this.contracts.unshare(await this.actor(request, companyId), id, userId);
  }

  // Phụ lục.
  @Post("contracts/:id/appendices")
  @UseInterceptors(OfficeFileUpload())
  async createAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ) {
    return this.contracts.createAppendix(await this.actor(request, companyId), id, officeSaveAppendixSchema.parse(jsonField(data)), file);
  }

  @Post("contracts/:id/appendices/import")
  @UseInterceptors(OfficeFileUpload())
  async importAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ) {
    return this.contracts.importAppendix(await this.actor(request, companyId), id, officeImportAppendixSchema.parse(jsonField(data)), file);
  }

  @Post("contracts/:id/appendices/:appendixId")
  @UseInterceptors(OfficeFileUpload())
  async updateAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Body("data") data: unknown,
    @UploadedFile() file: Upload | undefined,
    @Headers("x-company-id") companyId?: string,
  ) {
    return this.contracts.updateAppendix(await this.actor(request, companyId), id, appendixId, officeSaveAppendixSchema.parse(jsonField(data)), file);
  }

  @Post("contracts/:id/appendices/:appendixId/:action")
  @HttpCode(200)
  async appendixAction(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Param("action") action: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeContractResponse> {
    const actor = await this.actor(request, companyId);
    if (action === "submit") return this.contracts.submitAppendix(actor, id, appendixId, officeContractVersionSchema.parse(body).version);
    if (action === "withdraw") return this.contracts.withdrawAppendix(actor, id, appendixId, officeContractVersionSchema.parse(body).version);
    if (action === "decide") {
      const input = officeContractDecisionSchema.parse(body);
      return this.contracts.decideAppendix(actor, id, appendixId, input.decision, input.note, input.version);
    }
    if (action === "signing") return this.contracts.appendixSigning(actor, id, appendixId, officeContractSigningSchema.parse(body));
    if (action === "cancel") {
      const input = officeContractReasonSchema.parse(body);
      return this.contracts.cancelAppendix(actor, id, appendixId, input.reason, input.version);
    }
    throw new ApiError("NOT_FOUND", "notFound");
  }
}
