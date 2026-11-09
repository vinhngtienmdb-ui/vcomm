// API_49: Cài đặt tích hợp (CHUC_NANG_25). Chỉ quản trị tập đoàn (TIEUCHI_NGHIEMTHU_49).
import { Body, Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { integrationTestMessageSchema, updateIntegrationSettingsSchema, type IntegrationSettingsResponse, type IntegrationTestResponse, type MessageDeliveryItem } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { IntegrationSettingsService } from "./integration-settings.service";
import { MessagingService } from "./messaging.service";

@Controller("integration-settings")
export class IntegrationsController {
  constructor(
    private readonly settings: IntegrationSettingsService,
    private readonly messaging: MessagingService,
  ) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest): Promise<IntegrationSettingsResponse> {
    await this.settings.requireManager(request.auth.userId);
    return this.settings.list();
  }

  @Put()
  async update(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IntegrationSettingsResponse> {
    await this.settings.requireManager(request.auth.userId);
    const input = updateIntegrationSettingsSchema.parse(body);
    return this.settings.update({ userId: request.auth.userId, companyId: "", client: clientInfo(request) }, input);
  }

  @Post("test")
  @HttpCode(200)
  async test(@Req() request: AuthenticatedRequest): Promise<IntegrationTestResponse> {
    await this.settings.requireManager(request.auth.userId);
    return this.messaging.test();
  }

  @Post("test-message")
  @HttpCode(200)
  async testMessage(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IntegrationTestResponse> {
    await this.settings.requireManager(request.auth.userId);
    return this.messaging.sendTestMessage(integrationTestMessageSchema.parse(body).phone, request.auth.userId);
  }

  @Get("deliveries")
  async deliveries(@Req() request: AuthenticatedRequest): Promise<MessageDeliveryItem[]> {
    await this.settings.requireManager(request.auth.userId);
    return this.messaging.recentDeliveries();
  }
}
