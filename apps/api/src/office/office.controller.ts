// API_184 Công việc; API_185 Bình luận, tệp của công việc (CHUC_NANG_182).
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  createOfficeTaskSchema,
  officeCommentSchema,
  officeFileMaximumBytes,
  officePeopleQuerySchema,
  officeTaskListQuerySchema,
  officeTaskProgressSchema,
  officeTaskTransitionSchema,
  updateOfficeTaskSchema,
  type OfficeFileItem,
  type OfficePerson,
  type OfficeTaskComment,
  type OfficeTaskEvent,
  type OfficeTaskListItem,
  type OfficeTaskResponse,
  type PageResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { OfficeTasksService } from "./office-tasks.service";

type UploadedOfficeFile = { buffer: Buffer; size: number; originalname: string };

// Tên tệp trong header: chữ không dấu cho trình duyệt cũ, bản UTF-8 đầy đủ theo RFC 5987.
export const officeContentDisposition = (kind: "inline" | "attachment", fileName: string) =>
  `${kind}; filename="${fileName
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

@Controller("office")
export class OfficeController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly tasks: OfficeTasksService,
  ) {}

  // Mọi API công việc cần quyền vào mini app ở công ty đang chọn; quyền trên từng việc xét theo người tham gia (QUYTAC_NGHIEPVU_357).
  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "office.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("people")
  async people(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficePerson[]> {
    return this.tasks.people(await this.actor(request, companyId), officePeopleQuerySchema.parse(query).search);
  }

  @Get("tasks")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<OfficeTaskListItem>> {
    return this.tasks.list(await this.actor(request, companyId), officeTaskListQuerySchema.parse(query));
  }

  @Post("tasks")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskResponse> {
    return this.tasks.create(await this.actor(request, companyId), createOfficeTaskSchema.parse(body));
  }

  @Get("tasks/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskResponse> {
    return this.tasks.detail(await this.actor(request, companyId), id);
  }

  @Patch("tasks/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskResponse> {
    return this.tasks.update(await this.actor(request, companyId), id, updateOfficeTaskSchema.parse(body));
  }

  @Post("tasks/:id/transition")
  @HttpCode(200)
  async transition(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskResponse> {
    const input = officeTaskTransitionSchema.parse(body);
    return this.tasks.transition(await this.actor(request, companyId), id, input.action, input.reason, input.version);
  }

  @Post("tasks/:id/progress")
  @HttpCode(200)
  async progress(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskResponse> {
    const input = officeTaskProgressSchema.parse(body);
    return this.tasks.updateProgress(await this.actor(request, companyId), id, input.progress, input.version);
  }

  @Get("tasks/:id/history")
  async history(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskEvent[]> {
    return this.tasks.history(await this.actor(request, companyId), id);
  }

  @Get("tasks/:id/comments")
  async comments(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskComment[]> {
    return this.tasks.comments(await this.actor(request, companyId), id);
  }

  @Post("tasks/:id/comments")
  async addComment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OfficeTaskComment[]> {
    return this.tasks.addComment(await this.actor(request, companyId), id, officeCommentSchema.parse(body).body);
  }

  @Patch("tasks/:id/comments/:commentId")
  async editComment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("commentId", UuidPipe) commentId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeTaskComment[]> {
    return this.tasks.editComment(await this.actor(request, companyId), id, commentId, officeCommentSchema.parse(body).body);
  }

  @Delete("tasks/:id/comments/:commentId")
  async removeComment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("commentId", UuidPipe) commentId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeTaskComment[]> {
    return this.tasks.editComment(await this.actor(request, companyId), id, commentId, null);
  }

  @Get("tasks/:id/files")
  async files(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OfficeFileItem[]> {
    return this.tasks.files(await this.actor(request, companyId), id);
  }

  // Tệp giữ trong bộ nhớ rồi ghi S3; giới hạn 20 MB kiểm ở dịch vụ để báo đúng thông báo, multer chỉ cắt tệp quá lớn bất thường.
  @Post("tasks/:id/files")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: officeFileMaximumBytes * 2, files: 1 } }))
  async addFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedOfficeFile | undefined,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeFileItem[]> {
    return this.tasks.addFile(await this.actor(request, companyId), id, file);
  }

  @Get("tasks/:id/files/:fileId")
  async download(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    const file = await this.tasks.downloadFile(await this.actor(request, companyId), id, fileId);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", officeContentDisposition("attachment", file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Delete("tasks/:id/files/:fileId")
  async removeFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<OfficeFileItem[]> {
    return this.tasks.removeFile(await this.actor(request, companyId), id, fileId);
  }
}
