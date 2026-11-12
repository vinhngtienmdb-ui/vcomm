// API_251, API_252, API_254: quy tắc chống gian lận, vụ việc, thiết bị của ví điểm (CONG_VIEC_60). Quyền xét tại công ty vận hành sàn:
// xem bằng loyalty.view, sửa quy tắc và xử lý vụ việc bằng loyalty.fraud.manage (QUYTAC_NGHIEPVU_479).
import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  loyaltyFraudCaseConcludeSchema,
  loyaltyFraudCaseListQuerySchema,
  loyaltyFraudCaseVersionSchema,
  loyaltyFraudRuleCodes,
  loyaltyFraudRuleSchema,
  type LoyaltyDeviceItem,
  type LoyaltyFraudCaseDetail,
  type LoyaltyFraudCaseItem,
  type LoyaltyFraudRule,
  type LoyaltyFraudRuleHistoryItem,
  type PageResponse,
} from "contracts";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { fraudPermission } from "./fraud";
import { LoyaltyFraudService } from "./fraud.service";

@Controller("loyalty")
export class LoyaltyFraudController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly fraud: LoyaltyFraudService,
  ) {}

  @Get("fraud-rules")
  async rules(@Req() request: AuthenticatedRequest): Promise<{ rules: LoyaltyFraudRule[]; canManage: boolean }> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return { rules: await this.fraud.rules(), canManage: await this.admin.allows(request.auth.userId, clientInfo(request), fraudPermission) };
  }

  @Get("fraud-rules/history")
  async history(@Req() request: AuthenticatedRequest): Promise<LoyaltyFraudRuleHistoryItem[]> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.fraud.ruleHistory();
  }

  @Put("fraud-rules/:code")
  async updateRule(@Req() request: AuthenticatedRequest, @Param("code") code: string, @Body() body: unknown): Promise<LoyaltyFraudRule[]> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), fraudPermission);
    return this.fraud.updateRule(actor, z.enum(loyaltyFraudRuleCodes).parse(code), loyaltyFraudRuleSchema.parse(body));
  }

  @Get("fraud-cases")
  async cases(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<LoyaltyFraudCaseItem> & { canManage: boolean }> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return { ...(await this.fraud.cases(loyaltyFraudCaseListQuerySchema.parse(query))), canManage: await this.admin.allows(request.auth.userId, clientInfo(request), fraudPermission) };
  }

  @Get("fraud-cases/:id")
  async caseDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<LoyaltyFraudCaseDetail & { canManage: boolean }> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return { ...(await this.fraud.caseDetail(id)), canManage: await this.admin.allows(request.auth.userId, clientInfo(request), fraudPermission) };
  }

  @Post("fraud-cases/:id/review")
  async review(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<LoyaltyFraudCaseDetail> {
    return this.fraud.review(await this.admin.actor(request.auth.userId, clientInfo(request), fraudPermission), id, loyaltyFraudCaseVersionSchema.parse(body).version);
  }

  @Post("fraud-cases/:id/conclude")
  async conclude(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<LoyaltyFraudCaseDetail> {
    return this.fraud.conclude(await this.admin.actor(request.auth.userId, clientInfo(request), fraudPermission), id, loyaltyFraudCaseConcludeSchema.parse(body));
  }

  @Get("accounts/:userId/devices")
  async devices(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string): Promise<LoyaltyDeviceItem[]> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.fraud.devices(userId);
  }
}
