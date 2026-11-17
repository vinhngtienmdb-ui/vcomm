// API_273, API_278: trạng thái trợ lý AI của người dùng, xác nhận thông báo xử lý dữ liệu cá nhân, cài đặt công ty (CHUC_NANG_226).
import { Body, Controller, Get, Headers, HttpCode, Patch, Post, Req } from "@nestjs/common";
import { acknowledgeAiNoticeSchema, aiPermissions, updateAiSettingsSchema, type AiMeResponse, type AiSettingsResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AiAccessService } from "./ai-access.service";
import { AiSettingsService } from "./ai-settings.service";

@Controller("ai")
export class AiController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly access: AiAccessService,
    private readonly settings: AiSettingsService,
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
}
