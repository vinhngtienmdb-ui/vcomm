// API_167 bảng tin (người mua), API_168 kiểm duyệt (quản trị), API_169 ảnh bài đăng (CONG_VIEC_49; CHUC_NANG_174; QUYTAC_NGHIEPVU_333 đến 335).
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  communitySettingsSchema,
  createBanSchema,
  createCommentSchema,
  createPostSchema,
  createReportSchema,
  hideContentSchema,
  moderationQuerySchema,
  officialPostSchema,
  pinPostSchema,
  postListQuerySchema,
  type CommunityBanItem,
  type CommunitySettings,
  type CommunityStatus,
  type ModerationItem,
  type PageResponse,
  type PostDetail,
  type PostItem,
  type ReviewableLine,
} from "contracts";
import type { Response } from "express";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "./buyer-admin.service";
import { CommunityService } from "./community.service";

const permission = "marketplace.community.manage";
const sendImage = (response: Response, file: { contentType: string; content: Buffer }) => {
  response.setHeader("content-type", file.contentType);
  response.setHeader("cache-control", "private, max-age=3600");
  response.setHeader("x-content-type-options", "nosniff");
  response.send(file.content);
};

@Controller()
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly admin: BuyerAdminService,
  ) {}

  private actor(request: AuthenticatedRequest) {
    return this.admin.actor(request.auth.userId, clientInfo(request), permission);
  }

  @Get("buyer/community")
  async status(@Req() request: AuthenticatedRequest): Promise<CommunityStatus> {
    return this.community.status(request.auth.userId);
  }

  @Get("buyer/posts")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<PostItem>> {
    return this.community.list(request.auth.userId, postListQuerySchema.parse(query));
  }

  @Get("buyer/reviewable-lines")
  async reviewable(@Req() request: AuthenticatedRequest): Promise<ReviewableLine[]> {
    return this.community.reviewable(request.auth.userId);
  }

  @Post("buyer/posts/images")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 6 * 1024 * 1024, files: 1 } }))
  async upload(@Req() request: AuthenticatedRequest, @UploadedFile() file: { buffer: Buffer; size: number } | undefined): Promise<{ id: string; url: string }> {
    return this.community.uploadImage(request.auth.userId, file);
  }

  @Get("buyer/posts/images/:id")
  async image(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response): Promise<void> {
    sendImage(response, await this.community.image(id, { userId: request.auth.userId }));
  }

  @Get("buyer/posts/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<PostDetail> {
    return this.community.detail(request.auth.userId, id);
  }

  @Post("buyer/posts")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<PostDetail> {
    return this.community.create(request.auth.userId, createPostSchema.parse(body));
  }

  @Delete("buyer/posts/:id")
  @HttpCode(204)
  async remove(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    await this.community.remove(request.auth.userId, id);
  }

  @Post("buyer/posts/:id/comments")
  async comment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PostDetail> {
    return this.community.comment(request.auth.userId, id, createCommentSchema.parse(body).content);
  }

  @Delete("buyer/comments/:id")
  @HttpCode(204)
  async removeComment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    await this.community.removeComment(request.auth.userId, id);
  }

  @Put("buyer/posts/:id/like")
  async like(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<{ liked: boolean; likeCount: number }> {
    return this.community.like(request.auth.userId, id, true);
  }

  @Delete("buyer/posts/:id/like")
  async unlike(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<{ liked: boolean; likeCount: number }> {
    return this.community.like(request.auth.userId, id, false);
  }

  @Post("buyer/reports")
  @HttpCode(204)
  async report(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.community.report(request.auth.userId, createReportSchema.parse(body));
  }

  @Get("marketplace/community/moderation")
  async moderation(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<ModerationItem>> {
    return this.community.moderation(await this.actor(request), moderationQuerySchema.parse(query));
  }

  @Get("marketplace/community/images/:id")
  async adminImage(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response): Promise<void> {
    await this.actor(request);
    sendImage(response, await this.community.image(id, { admin: true }));
  }

  @Post("marketplace/community/:target/:id/hide")
  @HttpCode(204)
  async hide(@Req() request: AuthenticatedRequest, @Param("target") target: string, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<void> {
    await this.community.moderate(await this.actor(request), z.enum(["posts", "comments"]).parse(target) === "posts" ? "post" : "comment", id, "hide", hideContentSchema.parse(body).reason);
  }

  @Post("marketplace/community/:target/:id/show")
  @HttpCode(204)
  async show(@Req() request: AuthenticatedRequest, @Param("target") target: string, @Param("id", UuidPipe) id: string): Promise<void> {
    await this.community.moderate(await this.actor(request), z.enum(["posts", "comments"]).parse(target) === "posts" ? "post" : "comment", id, "show", null);
  }

  @Get("marketplace/community/bans")
  async bans(@Req() request: AuthenticatedRequest): Promise<CommunityBanItem[]> {
    await this.actor(request);
    return this.community.bans();
  }

  @Post("marketplace/community/bans")
  async ban(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<CommunityBanItem[]> {
    return this.community.ban(await this.actor(request), createBanSchema.parse(body));
  }

  @Post("marketplace/community/bans/:id/lift")
  @HttpCode(200)
  async lift(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<CommunityBanItem[]> {
    return this.community.lift(await this.actor(request), id);
  }

  @Get("marketplace/community/settings")
  async settings(@Req() request: AuthenticatedRequest): Promise<CommunitySettings> {
    return this.community.settings(await this.actor(request));
  }

  @Put("marketplace/community/settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<CommunitySettings> {
    return this.community.updateSettings(await this.actor(request), communitySettingsSchema.parse(body));
  }

  @Get("marketplace/community/official-posts")
  async officialPosts(@Req() request: AuthenticatedRequest): Promise<PostItem[]> {
    return this.community.officialPosts(await this.actor(request));
  }

  @Post("marketplace/community/official-posts")
  async createOfficial(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<PostItem[]> {
    return this.community.createOfficial(await this.actor(request), officialPostSchema.parse(body));
  }

  @Put("marketplace/community/official-posts/:id/pin")
  async pin(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PostItem[]> {
    return this.community.pin(await this.actor(request), id, pinPostSchema.parse(body).isPinned);
  }
}
