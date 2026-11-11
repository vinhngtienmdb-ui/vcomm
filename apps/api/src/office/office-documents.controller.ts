// API_188 Công văn đến; API_189 Công văn đi; API_190 Sổ, loại văn bản, thông tin thể thức, xuất sổ (CHUC_NANG_184).
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UploadedFiles, UseInterceptors } from "@nestjs/common";
import {
  acceptIncomingSchema,
  directIncomingSchema,
  documentSettingsSchema,
  documentTypeSchema,
  incomingListQuerySchema,
  outgoingCancelSchema,
  outgoingDecisionSchema,
  outgoingListQuerySchema,
  outgoingVersionSchema,
  registerIncomingSchema,
  registerSchema,
  saveOutgoingSchema,
  submitIncomingSchema,
  updateDocumentTypeSchema,
  updateIncomingSchema,
  updateRegisterSchema,
  voidIncomingSchema,
  type DocumentOptions,
  type DocumentSettings,
  type DocumentTypeItem,
  type IncomingListItem,
  type IncomingResponse,
  type OutgoingListItem,
  type OutgoingResponse,
  type PageResponse,
  type RegisterItem,
} from "contracts";
import type { Response } from "express";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { OfficeDocumentsService } from "./office-documents.service";
import { officeContentDisposition } from "./office.controller";
import { OfficeFileUpload, OfficeFilesUpload } from "./office-upload";

type Upload = { buffer: Buffer; size: number; originalname: string };

// Biểu mẫu multipart gửi trường dạng chuỗi: phần dữ liệu đi trong trường "data" (JSON).
const jsonField = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

@Controller("office")
export class OfficeDocumentsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly documents: OfficeDocumentsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, permission = "office.access"): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, permission);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  private send(response: Response, file: { fileName: string; contentType: string; content: Buffer }, kind: "inline" | "attachment" = "attachment") {
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", officeContentDisposition(kind, file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  // API_190
  @Get("document-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<DocumentOptions> {
    return this.documents.options(await this.actor(request, companyId));
  }

  @Get("document-settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<DocumentSettings> {
    return this.documents.settings(await this.actor(request, companyId, "office.document.clerk"));
  }

  @Put("document-settings")
  async saveSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DocumentSettings> {
    return this.documents.saveSettings(await this.actor(request, companyId, "office.document.clerk"), documentSettingsSchema.parse(body));
  }

  @Get("registers")
  async registers(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RegisterItem[]> {
    return this.documents.registers(await this.actor(request, companyId, "office.document.clerk"));
  }

  @Post("registers")
  async createRegister(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RegisterItem[]> {
    return this.documents.createRegister(await this.actor(request, companyId, "office.document.clerk"), registerSchema.parse(body));
  }

  @Patch("registers/:id")
  async updateRegister(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RegisterItem[]> {
    return this.documents.updateRegister(await this.actor(request, companyId, "office.document.clerk"), id, updateRegisterSchema.parse(body));
  }

  @Get("registers/:id/export")
  async exportRegister(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query("year") year: string, @Res() response: Response, @Headers("x-company-id") companyId?: string) {
    const file = await this.documents.exportRegister(await this.actor(request, companyId, "office.document.clerk"), id, z.coerce.number().int().min(2000).max(2100).parse(year));
    this.send(response, { ...file, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  @Get("document-types")
  async documentTypes(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<DocumentTypeItem[]> {
    return this.documents.documentTypes(await this.actor(request, companyId));
  }

  @Post("document-types")
  async createDocumentType(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DocumentTypeItem[]> {
    return this.documents.createDocumentType(await this.actor(request, companyId, "office.document.clerk"), documentTypeSchema.parse(body));
  }

  @Patch("document-types/:id")
  async updateDocumentType(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DocumentTypeItem[]> {
    return this.documents.updateDocumentType(await this.actor(request, companyId, "office.document.clerk"), id, updateDocumentTypeSchema.parse(body).status);
  }

  // API_188
  @Get("incoming")
  async incomingList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<IncomingListItem>> {
    return this.documents.incomingList(await this.actor(request, companyId), incomingListQuerySchema.parse(query));
  }

  // Vào sổ: multipart gồm "data" (JSON) và một hoặc nhiều tệp "files".
  @Post("incoming")
  @UseInterceptors(OfficeFilesUpload())
  async registerIncoming(
    @Req() request: AuthenticatedRequest,
    @Body("data") data: unknown,
    @UploadedFiles() files: Upload[] | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<IncomingResponse> {
    return this.documents.registerIncoming(await this.actor(request, companyId, "office.document.clerk"), registerIncomingSchema.parse(jsonField(data)), files ?? []);
  }

  @Get("incoming/:id")
  async incoming(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<IncomingResponse> {
    return this.documents.incoming(await this.actor(request, companyId), id);
  }

  @Patch("incoming/:id")
  async updateIncoming(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<IncomingResponse> {
    return this.documents.updateIncoming(await this.actor(request, companyId, "office.document.clerk"), id, updateIncomingSchema.parse(body));
  }

  @Post("incoming/:id/files")
  @UseInterceptors(OfficeFileUpload())
  async addIncomingFile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string) {
    return this.documents.addIncomingFile(await this.actor(request, companyId, "office.document.clerk"), id, file);
  }

  @Get("incoming/:id/files/:fileId")
  async incomingFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    this.send(response, await this.documents.downloadIncomingFile(await this.actor(request, companyId), id, fileId));
  }

  @Post("incoming/:id/accept")
  @HttpCode(200)
  async accept(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<IncomingResponse> {
    return this.documents.acceptIncoming(await this.actor(request, companyId, "office.document.clerk"), id, acceptIncomingSchema.parse(body));
  }

  @Post("incoming/:id/submit")
  @HttpCode(200)
  async submitIncoming(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<IncomingResponse> {
    return this.documents.submitIncoming(await this.actor(request, companyId, "office.document.clerk"), id, submitIncomingSchema.parse(body));
  }

  @Post("incoming/:id/direct")
  @HttpCode(200)
  async direct(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<IncomingResponse> {
    return this.documents.directIncoming(await this.actor(request, companyId, "office.document.direct"), id, directIncomingSchema.parse(body));
  }

  @Post("incoming/:id/void")
  @HttpCode(200)
  async voidIncoming(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<IncomingResponse> {
    const input = voidIncomingSchema.parse(body);
    return this.documents.voidIncoming(await this.actor(request, companyId, "office.document.clerk"), id, input.reason, input.version);
  }

  // API_189
  @Get("outgoing")
  async outgoingList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<OutgoingListItem>> {
    return this.documents.outgoingList(await this.actor(request, companyId), outgoingListQuerySchema.parse(query));
  }

  @Post("outgoing")
  async createOutgoing(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    return this.documents.createOutgoing(await this.actor(request, companyId, "office.document.draft"), saveOutgoingSchema.parse(body));
  }

  @Get("outgoing/:id")
  async outgoing(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    return this.documents.outgoing(await this.actor(request, companyId), id);
  }

  @Patch("outgoing/:id")
  async updateOutgoing(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    return this.documents.updateOutgoing(await this.actor(request, companyId, "office.document.draft"), id, saveOutgoingSchema.parse(body));
  }

  @Get("outgoing/:id/render")
  async render(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query("format") format: string, @Res() response: Response, @Headers("x-company-id") companyId?: string) {
    const file = await this.documents.renderOutgoing(await this.actor(request, companyId), id, z.enum(["pdf", "docx"]).parse(format));
    this.send(response, file, file.contentType === "application/pdf" ? "inline" : "attachment");
  }

  @Post("outgoing/:id/files")
  @UseInterceptors(OfficeFileUpload())
  async addDraftFile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string) {
    return this.documents.addDraftFile(await this.actor(request, companyId, "office.document.draft"), id, file);
  }

  @Get("outgoing/:id/files/:fileId")
  async outgoingFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    this.send(response, await this.documents.downloadOutgoingFile(await this.actor(request, companyId), id, fileId));
  }

  @Post("outgoing/:id/submit")
  @HttpCode(200)
  async submit(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    return this.documents.submitOutgoing(await this.actor(request, companyId, "office.document.draft"), id, outgoingVersionSchema.parse(body).version);
  }

  @Post("outgoing/:id/withdraw")
  @HttpCode(200)
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    return this.documents.withdrawOutgoing(await this.actor(request, companyId, "office.document.draft"), id, outgoingVersionSchema.parse(body).version);
  }

  @Post("outgoing/:id/decide")
  @HttpCode(200)
  async decide(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    const input = outgoingDecisionSchema.parse(body);
    return this.documents.decideOutgoing(await this.actor(request, companyId), id, input.decision, input.note, input.version);
  }

  @Post("outgoing/:id/cancel")
  @HttpCode(200)
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    const input = outgoingCancelSchema.parse(body);
    return this.documents.cancelOutgoing(await this.actor(request, companyId), id, input.reason, input.version);
  }

  @Post("outgoing/:id/number")
  @HttpCode(200)
  async number(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OutgoingResponse> {
    return this.documents.numberOutgoing(await this.actor(request, companyId, "office.document.clerk"), id, outgoingVersionSchema.parse(body).version);
  }

  // Phát hành: multipart gồm tệp "file" (bản đã ký, đóng dấu) và trường "version".
  @Post("outgoing/:id/issue")
  @HttpCode(200)
  @UseInterceptors(OfficeFileUpload())
  async issue(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: Upload | undefined,
    @Body("version") version: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OutgoingResponse> {
    return this.documents.issueOutgoing(await this.actor(request, companyId, "office.document.clerk"), id, file, z.coerce.number().int().min(1).parse(version));
  }
}
