// API_273 đến API_279: trạng thái trợ lý AI của người dùng, xác nhận thông báo xử lý dữ liệu cá nhân, hỏi đáp số liệu,
// hội thoại, đánh giá, soạn nội dung sản phẩm, cài đặt công ty, thống kê sử dụng (CHUC_NANG_226 đến 229).
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, StreamableFile } from "@nestjs/common";
import {
  acknowledgeAiNoticeSchema,
  aiConversationListQuerySchema,
  aiFeedbackSchema,
  aiPermissions,
  aiUsageQuerySchema,
  askAiSchema,
  productContentRequestSchema,
  updateAiSettingsSchema,
  type AiConversationDetail,
  type AiConversationItem,
  type AiFeedback,
  type AiMeResponse,
  type AiSettingsResponse,
  type AiStreamEvent,
  type AiUsageResponse,
  type PageResponse,
  type ProductContentResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import { reportXlsx, xlsxContentType } from "../analytics/analytics-export";
import { localeOf } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { UuidPipe } from "../common/uuid.pipe";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AiAccessService } from "./ai-access.service";
import { AiChatService } from "./ai-chat.service";
import { AiContentService } from "./ai-content.service";
import { AiUsageService } from "./ai-usage.service";
import { AiSettingsService } from "./ai-settings.service";

@Controller("ai")
export class AiController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly access: AiAccessService,
    private readonly settings: AiSettingsService,
    private readonly chat: AiChatService,
    private readonly content: AiContentService,
    private readonly usage: AiUsageService,
    private readonly audit: AuditService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, ...anyOf);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // Mọi người đã đăng nhập: giao diện dùng để ẩn, hiện nút trợ lý và hiện lý do chưa dùng được.
  @Get("me")
  async me(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AiMeResponse> {
    const { companyId: resolved } = await this.permissionService.resolveCompany(request.auth.userId, companyId);
    return this.access.status(request.auth.userId, resolved);
  }

  @Post("me/acknowledge")
  @HttpCode(200)
  async acknowledge(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AiMeResponse> {
    const input = acknowledgeAiNoticeSchema.parse(body);
    const { companyId: resolved } = await this.permissionService.resolveCompany(request.auth.userId, companyId);
    await this.access.acknowledge(request.auth.userId, input.noticeVersion);
    return this.access.status(request.auth.userId, resolved);
  }

  @Get("settings")
  async getSettings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AiSettingsResponse> {
    return this.settings.get(await this.actor(request, companyId, aiPermissions.settings, aiPermissions.usage));
  }

  @Patch("settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AiSettingsResponse> {
    const actor = await this.actor(request, companyId, aiPermissions.settings);
    return this.settings.update(actor, updateAiSettingsSchema.parse(body));
  }

  @Get("conversations")
  async conversations(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<AiConversationItem>> {
    return this.chat.list(await this.actor(request, companyId, aiPermissions.chat), aiConversationListQuerySchema.parse(query));
  }

  @Get("conversations/:id")
  async conversation(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<AiConversationDetail> {
    return this.chat.detail(await this.actor(request, companyId, aiPermissions.chat), id);
  }

  @Delete("conversations/:id")
  @HttpCode(204)
  async removeConversation(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.chat.remove(await this.actor(request, companyId, aiPermissions.chat), id);
  }

  // API_275: lỗi trước khi bắt đầu trả lời dùng mã HTTP thường; sau đó là dòng sự kiện text/event-stream.
  @Post("conversations/messages")
  async ask(@Req() request: AuthenticatedRequest, @Res() response: Response, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    const actor = await this.actor(request, companyId, aiPermissions.chat);
    const turn = await this.chat.prepare(actor, askAiSchema.parse(body), localeOf(request));
    response.status(200);
    response.setHeader("content-type", "text/event-stream; charset=utf-8");
    response.setHeader("cache-control", "no-cache, no-transform");
    response.setHeader("x-accel-buffering", "no");
    response.flushHeaders();
    // Người dùng rời trang thì vẫn chạy hết lượt và lưu câu trả lời; chỉ ngừng ghi ra kết nối.
    const emit = (event: AiStreamEvent) => {
      if (response.writableEnded || response.destroyed) return;
      const { type, ...data } = event;
      response.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      await this.chat.run(turn, emit);
    } finally {
      if (!response.writableEnded) response.end();
    }
  }

  @Put("messages/:id/feedback")
  async feedback(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AiFeedback | null> {
    return this.chat.setFeedback(await this.actor(request, companyId, aiPermissions.chat), id, aiFeedbackSchema.parse(body));
  }

  @Delete("messages/:id/feedback")
  @HttpCode(204)
  async removeFeedback(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.chat.setFeedback(await this.actor(request, companyId, aiPermissions.chat), id, null);
  }

  @Post("product-content")
  @HttpCode(200)
  async productContent(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ProductContentResponse> {
    const actor = await this.actor(request, companyId, aiPermissions.productContent);
    return this.content.draft(actor, productContentRequestSchema.parse(body));
  }

  // API_279: thống kê tháng; xuất Excel cùng số liệu, ghi nhật ký thao tác.
  @Get("usage")
  async usageReport(
    @Req() request: AuthenticatedRequest,
    @Query() query: unknown,
    @Res({ passthrough: true }) response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AiUsageResponse | StreamableFile> {
    const actor = await this.actor(request, companyId, aiPermissions.usage, aiPermissions.settings);
    const parsed = aiUsageQuerySchema.parse(query);
    const report = await this.usage.report(actor, parsed);
    if (parsed.format === "json") return report;
    const tables = this.usage.exportTables(report);
    const content = await reportXlsx(tables);
    await this.audit.record({
      actorUserId: actor.userId,
      companyId: actor.companyId,
      appCode: "platform",
      action: "ai.usage.export",
      entityType: "ai_usage",
      afterData: { month: parsed.month, feature: parsed.feature ?? null },
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    });
    response.setHeader("content-type", xlsxContentType);
    response.setHeader("content-disposition", `attachment; filename="thong-ke-tro-ly-ai-${parsed.month}.xlsx"`);
    return new StreamableFile(content);
  }
}
