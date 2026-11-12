// API_255 đến API_259: quản lý khóa API đối tác, nhật ký gọi (CHUC_NANG_217, 218). Nhân viên đăng nhập như các API khác.
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  apiCallLogQuerySchema,
  apiKeyListQuerySchema,
  apiKeyOptionsQuerySchema,
  createApiKeySchema,
  revokeApiKeySchema,
  rotateApiKeySchema,
  updateApiKeySchema,
  type ApiCallLogItem,
  type ApiKeyDetail,
  type ApiKeyItem,
  type ApiKeyOptions,
  type ApiKeySecretResponse,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ApiCallLogsService } from "./api-call-logs.service";
import { ApiKeysService } from "./api-keys.service";

const manage = "platform.api_key.manage";
const viewLog = "platform.api_log.view";

@Controller("platform")
export class ApiKeysController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly apiKeys: ApiKeysService,
    private readonly callLogs: ApiCallLogsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, ...anyOf);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("api-keys")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ApiKeyItem[]> {
    const input = apiKeyListQuerySchema.parse(query);
    return this.apiKeys.list(await this.actor(request, companyId, manage, viewLog), input);
  }

  @Get("api-keys/options")
  async options(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<ApiKeyOptions> {
    const input = apiKeyOptionsQuerySchema.parse(query);
    return this.apiKeys.options(await this.actor(request, companyId, manage), input.partnerSearch);
  }

  @Post("api-keys")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ApiKeySecretResponse> {
    const actor = await this.actor(request, companyId, manage);
    return this.apiKeys.create(actor, createApiKeySchema.parse(body));
  }

  @Get("api-keys/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<ApiKeyDetail> {
    return this.apiKeys.detail(await this.actor(request, companyId, manage, viewLog), id);
  }

  @Patch("api-keys/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ApiKeyDetail> {
    const actor = await this.actor(request, companyId, manage);
    return this.apiKeys.update(actor, id, updateApiKeySchema.parse(body));
  }

  @Post("api-keys/:id/rotate")
  @HttpCode(200)
  async rotate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ApiKeySecretResponse> {
    const actor = await this.actor(request, companyId, manage);
    return this.apiKeys.rotate(actor, id, rotateApiKeySchema.parse(body));
  }

  @Post("api-keys/:id/revoke")
  @HttpCode(200)
  async revoke(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ApiKeyDetail> {
    const actor = await this.actor(request, companyId, manage);
    return this.apiKeys.revoke(actor, id, revokeApiKeySchema.parse(body));
  }

  @Get("api-call-logs")
  async logs(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<ApiCallLogItem>> {
    const input = apiCallLogQuerySchema.parse(query);
    return this.callLogs.list(await this.actor(request, companyId, viewLog, manage), input);
  }
}
