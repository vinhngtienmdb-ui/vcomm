// API_191 Bảng tin nội bộ (CHUC_NANG_185; QUYTAC_NGHIEPVU_367).
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  officeCommentSchema,
  officeFileMaximumBytes,
  officePostListQuerySchema,
  postRevokeSchema,
  savePostSchema,
  type PageResponse,
  type PostListItem,
  type PostOptions,
  type PostReader,
  type PostResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { officeContentDisposition } from "./office.controller";
import { OfficePostsService } from "./office-posts.service";

type Upload = { buffer: Buffer; size: number; originalname: string };

@Controller("office")
export class OfficePostsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly posts: OfficePostsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "office.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("post-options")
  async options(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PostOptions> {
    return this.posts.options(await this.actor(request, companyId));
  }

  @Get("posts")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<PostListItem>> {
    return this.posts.list(await this.actor(request, companyId), officePostListQuerySchema.parse(query));
  }

  @Post("posts")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.create(await this.actor(request, companyId), savePostSchema.parse(body));
  }

  @Get("posts/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.detail(await this.actor(request, companyId), id);
  }

  @Patch("posts/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.update(await this.actor(request, companyId), id, savePostSchema.parse(body));
  }

  @Post("posts/:id/revoke")
  @HttpCode(200)
  async revoke(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.revoke(await this.actor(request, companyId), id, postRevokeSchema.parse(body).version);
  }

  @Post("posts/:id/acknowledge")
  @HttpCode(200)
  async acknowledge(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.acknowledge(await this.actor(request, companyId), id);
  }

  @Get("posts/:id/readers")
  async readers(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PostReader[]> {
    return this.posts.readers(await this.actor(request, companyId), id);
  }

  @Post("posts/:id/comments")
  async addComment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.addComment(await this.actor(request, companyId), id, officeCommentSchema.parse(body).body);
  }

  @Patch("posts/:id/comments/:commentId")
  async editComment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("commentId", UuidPipe) commentId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PostResponse> {
    return this.posts.editComment(await this.actor(request, companyId), id, commentId, officeCommentSchema.parse(body).body);
  }

  @Delete("posts/:id/comments/:commentId")
  async removeComment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("commentId", UuidPipe) commentId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PostResponse> {
    return this.posts.editComment(await this.actor(request, companyId), id, commentId, null);
  }

  @Post("posts/:id/files")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: officeFileMaximumBytes * 2, files: 1 } }))
  async addFile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @UploadedFile() file: Upload | undefined, @Headers("x-company-id") companyId?: string): Promise<PostResponse> {
    return this.posts.addFile(await this.actor(request, companyId), id, file);
  }

  @Get("posts/:id/files/:fileId")
  async file(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    const file = await this.posts.downloadFile(await this.actor(request, companyId), id, fileId);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", officeContentDisposition("attachment", file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.send(file.content);
  }

  @Delete("posts/:id/files/:fileId")
  async removeFile(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("fileId", UuidPipe) fileId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PostResponse> {
    return this.posts.removeFile(await this.actor(request, companyId), id, fileId);
  }
}
