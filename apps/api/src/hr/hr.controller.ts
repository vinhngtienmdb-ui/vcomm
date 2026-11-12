// API_144 đến API_146, API_149: hồ sơ nhân sự, giấy tờ, người phụ thuộc, quá trình công tác, hồ sơ của tôi (CONG_VIEC_46). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  cancelContractSchema,
  contractListQuerySchema,
  saveAppendixSchema,
  saveContractSchema,
  signContractSchema,
  terminateContractSchema,
  terminateEmployeeSchema,
  type ContractListResponse,
  type ContractResponse,
  type MyContractsResponse,
  employeeListQuerySchema,
  revealSchema,
  saveDependentSchema,
  saveEmployeeSchema,
  saveWorkEventSchema,
  uploadEmployeeDocumentSchema,
  type DependentItem,
  type EmployeeDocumentItem,
  type EmployeeListResponse,
  type EmployeeOptionsResponse,
  type EmployeeResponse,
  type MyEmployeeResponse,
  type RevealResponse,
  type WorkEventItem,
  hrDigitalSigningSchema,
  type HrDigitalSigningInfo,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { documentMaximumBytes, EmployeesService, type UploadedFile as UploadedDocument } from "./employees.service";
import { ContractsService } from "./contracts.service";
import { WorkEventsService } from "./work-events.service";

// Tên tệp trong header: chữ không dấu cho trình duyệt cũ, bản UTF-8 đầy đủ theo RFC 5987.
export const contentDisposition = (fileName: string) =>
  `attachment; filename="${fileName
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

// Tệp PDF đem ký số tối đa 20 MB (QUYTAC_NGHIEPVU_458).
const signingPdfMaximumBytes = 20 * 1024 * 1024;
// Biểu mẫu multipart: phần dữ liệu đi trong trường "data" (JSON).
const jsonField = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

@Controller("hr")
export class HrController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly employees: EmployeesService,
    private readonly workEvents: WorkEventsService,
    private readonly contracts: ContractsService,
  ) {}

  private sendFile(response: Response, file: { fileName: string; contentType: string; content: Buffer }): void {
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", contentDisposition(file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("cache-control", "no-store");
    response.send(file.content);
  }

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "hr.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // Hồ sơ của tôi: chỉ cần là thành viên công ty đang chọn (không cần hr.access).
  private async memberActor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("employee-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<EmployeeOptionsResponse> {
    return this.employees.options(await this.actor(request, companyId));
  }

  @Get("employees")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<EmployeeListResponse> {
    return this.employees.list(await this.actor(request, companyId), employeeListQuerySchema.parse(query));
  }

  @Get("employees/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<EmployeeResponse> {
    return this.employees.detail(await this.actor(request, companyId), id);
  }

  @Post("employees")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<EmployeeResponse> {
    return this.employees.create(await this.actor(request, companyId), saveEmployeeSchema.parse(body));
  }

  @Patch("employees/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<EmployeeResponse> {
    return this.employees.update(await this.actor(request, companyId), id, saveEmployeeSchema.parse(body));
  }

  @Post("employees/:id/reveal")
  async reveal(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RevealResponse> {
    return this.employees.reveal(await this.actor(request, companyId), id, revealSchema.parse(body).field);
  }

  @Get("employees/:id/documents")
  async documents(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<EmployeeDocumentItem[]> {
    return this.employees.documents(await this.actor(request, companyId), id);
  }

  // Tệp giữ trong bộ nhớ rồi ghi kho tệp; giới hạn 10 MB kiểm ở dịch vụ, multer chỉ cắt tệp quá lớn bất thường.
  @Post("employees/:id/documents")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: documentMaximumBytes * 2, files: 1 } }))
  async upload(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<EmployeeDocumentItem[]> {
    const input = uploadEmployeeDocumentSchema.parse(body);
    return this.employees.uploadDocument(await this.actor(request, companyId), id, input.kind, input.consentDate, file);
  }

  @Get("documents/:id")
  async download(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    this.sendFile(response, await this.employees.downloadDocument(await this.actor(request, companyId), id));
  }

  @Get("employees/:id/dependents")
  async dependents(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<DependentItem[]> {
    return this.employees.dependents(await this.actor(request, companyId), id);
  }

  @Post("employees/:id/dependents")
  async addDependent(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DependentItem[]> {
    return this.employees.saveDependent(await this.actor(request, companyId), id, null, saveDependentSchema.parse(body));
  }

  @Patch("employees/:id/dependents/:dependentId")
  async updateDependent(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("dependentId", UuidPipe) dependentId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<DependentItem[]> {
    return this.employees.saveDependent(await this.actor(request, companyId), id, dependentId, saveDependentSchema.parse(body));
  }

  @Get("employees/:id/work-events")
  async workEventList(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<WorkEventItem[]> {
    return this.workEvents.list(await this.actor(request, companyId), id);
  }

  @Post("employees/:id/work-events")
  async addWorkEvent(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<WorkEventItem[]> {
    return this.workEvents.create(await this.actor(request, companyId), id, saveWorkEventSchema.parse(body));
  }

  @Patch("employees/:id/work-events/:eventId")
  async updateWorkEvent(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("eventId", UuidPipe) eventId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<WorkEventItem[]> {
    return this.workEvents.update(await this.actor(request, companyId), id, eventId, saveWorkEventSchema.parse(body));
  }

  @Delete("employees/:id/work-events/:eventId")
  async removeWorkEvent(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("eventId", UuidPipe) eventId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<WorkEventItem[]> {
    return this.workEvents.remove(await this.actor(request, companyId), id, eventId);
  }

  @Post("employees/:id/terminate")
  @HttpCode(204)
  async terminateEmployee(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.contracts.terminateEmployee(await this.actor(request, companyId), id, terminateEmployeeSchema.parse(body));
  }

  // API_147: hợp đồng lao động.
  @Get("contracts")
  async contractList(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ContractListResponse> {
    return this.contracts.list(await this.actor(request, companyId), contractListQuerySchema.parse(query));
  }

  @Get("contracts/:id")
  async contractDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.detail(await this.actor(request, companyId), id);
  }

  @Post("contracts")
  async createContract(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.create(await this.actor(request, companyId), saveContractSchema.parse(body));
  }

  @Patch("contracts/:id")
  async updateContract(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.update(await this.actor(request, companyId), id, saveContractSchema.parse(body));
  }

  @Post("contracts/:id/submit")
  async submitContract(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.submit(await this.actor(request, companyId), id);
  }

  @Post("contracts/:id/withdraw")
  async withdrawContract(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.withdraw(await this.actor(request, companyId), id);
  }

  @Post("contracts/:id/sign")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: documentMaximumBytes * 2, files: 1 } }))
  async signContract(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ContractResponse> {
    return this.contracts.sign(await this.actor(request, companyId), id, signContractSchema.parse(body).signDate, file);
  }

  // API_248 Ký số hợp đồng lao động, phụ lục (CONG_VIEC_59, CHUC_NANG_213): multipart gồm "data" (JSON người ký phía công ty, hạn ký, ghi chú, thư điện tử người lao động) và tệp PDF "file".
  @Get("contracts/:id/digital-signing")
  async contractSigningInfo(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<HrDigitalSigningInfo> {
    return this.contracts.digitalSigningInfo(await this.actor(request, companyId), id, null);
  }

  @Post("contracts/:id/digital-signing")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: signingPdfMaximumBytes + 1, files: 1 } }))
  async contractDigitalSigning(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body("data") data: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<HrDigitalSigningInfo> {
    return this.contracts.startDigitalSigning(await this.actor(request, companyId), id, null, hrDigitalSigningSchema.parse(jsonField(data)), file);
  }

  @Get("contract-appendices/:id/digital-signing")
  async appendixSigningInfo(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<HrDigitalSigningInfo> {
    const actor = await this.actor(request, companyId);
    return this.contracts.digitalSigningInfo(actor, await this.contracts.contractOfAppendix(actor, id), id);
  }

  @Post("contract-appendices/:id/digital-signing")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: signingPdfMaximumBytes + 1, files: 1 } }))
  async appendixDigitalSigning(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body("data") data: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<HrDigitalSigningInfo> {
    const actor = await this.actor(request, companyId);
    return this.contracts.startDigitalSigning(actor, await this.contracts.contractOfAppendix(actor, id), id, hrDigitalSigningSchema.parse(jsonField(data)), file);
  }

  @Post("contracts/:id/cancel")
  async cancelContract(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.cancel(await this.actor(request, companyId), id, cancelContractSchema.parse(body).reason);
  }

  @Post("contracts/:id/terminate")
  async terminateContract(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.terminate(await this.actor(request, companyId), id, terminateContractSchema.parse(body));
  }

  @Get("contracts/:id/signed-file")
  async contractFile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    this.sendFile(response, await this.contracts.downloadSigned(await this.actor(request, companyId), id, null, false));
  }

  // API_148: phụ lục hợp đồng.
  @Post("contracts/:id/appendices")
  async createAppendix(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ContractResponse> {
    return this.contracts.saveAppendix(await this.actor(request, companyId), id, null, saveAppendixSchema.parse(body));
  }

  @Patch("contracts/:id/appendices/:appendixId")
  async updateAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ContractResponse> {
    return this.contracts.saveAppendix(await this.actor(request, companyId), id, appendixId, saveAppendixSchema.parse(body));
  }

  @Post("contracts/:id/appendices/:appendixId/submit")
  async submitAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ContractResponse> {
    return this.contracts.submitAppendix(await this.actor(request, companyId), id, appendixId);
  }

  @Post("contracts/:id/appendices/:appendixId/withdraw")
  async withdrawAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ContractResponse> {
    return this.contracts.withdrawAppendix(await this.actor(request, companyId), id, appendixId);
  }

  @Post("contracts/:id/appendices/:appendixId/sign")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: documentMaximumBytes * 2, files: 1 } }))
  async signAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ContractResponse> {
    return this.contracts.signAppendix(await this.actor(request, companyId), id, appendixId, signContractSchema.parse(body).signDate, file);
  }

  @Post("contracts/:id/appendices/:appendixId/cancel")
  async cancelAppendix(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<ContractResponse> {
    return this.contracts.cancelAppendix(await this.actor(request, companyId), id, appendixId, cancelContractSchema.parse(body).reason);
  }

  @Get("contracts/:id/appendices/:appendixId/signed-file")
  async appendixFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("appendixId", UuidPipe) appendixId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    this.sendFile(response, await this.contracts.downloadSigned(await this.actor(request, companyId), id, appendixId, false));
  }

  @Get("me/contracts")
  async myContracts(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyContractsResponse> {
    return this.contracts.own(await this.memberActor(request, companyId));
  }

  @Get("me/contracts/:id/signed-file")
  async myContractFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Query("appendixId") appendixId: string | undefined,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    const appendix = appendixId ? new UuidPipe().transform(appendixId) : null;
    this.sendFile(response, await this.contracts.downloadSigned(await this.memberActor(request, companyId), id, appendix, true));
  }

  @Get("me")
  async me(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyEmployeeResponse> {
    const actor = await this.memberActor(request, companyId);
    const employee = await this.employees.own(actor);
    return { employee, workEvents: await this.workEvents.items(employee.id) };
  }

  @Post("me/reveal")
  async revealOwn(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RevealResponse> {
    return this.employees.revealOwn(await this.memberActor(request, companyId), revealSchema.parse(body).field);
  }
}
