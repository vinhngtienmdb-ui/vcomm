// API_144 đến API_146, API_149: hồ sơ nhân sự, giấy tờ, người phụ thuộc, quá trình công tác, hồ sơ của tôi (CONG_VIEC_46). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
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
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { documentMaximumBytes, EmployeesService, type UploadedFile as UploadedDocument } from "./employees.service";
import { WorkEventsService } from "./work-events.service";

// Tên tệp trong header: chữ không dấu cho trình duyệt cũ, bản UTF-8 đầy đủ theo RFC 5987.
export const contentDisposition = (fileName: string) =>
  `attachment; filename="${fileName
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

@Controller("hr")
export class HrController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly employees: EmployeesService,
    private readonly workEvents: WorkEventsService,
  ) {}

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
    const file = await this.employees.downloadDocument(await this.actor(request, companyId), id);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", contentDisposition(file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("cache-control", "no-store");
    response.send(file.content);
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
