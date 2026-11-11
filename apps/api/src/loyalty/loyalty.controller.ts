// API_176 đến API_182: quản trị điểm thưởng trên web-crm (CONG_VIEC_51). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  buyerWalletQuerySchema,
  loyaltyAccountListQuerySchema,
  loyaltyAdjustmentListQuerySchema,
  loyaltyAdjustmentSchema,
  loyaltyAdjustmentUpdateSchema,
  loyaltyAdjustmentVersionSchema,
  loyaltyAlertQuerySchema,
  loyaltyLockSchema,
  type LoyaltyAccountDetail,
  type LoyaltyAccountListItem,
  type LoyaltyAdjustmentItem,
  type LoyaltyAlertResponse,
  type LoyaltyEntryItem,
  type PageResponse,
  loyaltyLiabilityQuerySchema,
  type LoyaltyLiabilityResponse,
  loyaltyPhaseSchema,
  loyaltyPhaseUpdateSchema,
  loyaltyTiersSchema,
  type LoyaltyPhase,
  type LoyaltyProgramResponse,
  type LoyaltyTier,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { LoyaltyAccountsService } from "./accounts.service";
import { LoyaltyAdminService } from "./admin.service";
import { LoyaltyProgramService } from "./program.service";

@Controller("loyalty")
export class LoyaltyController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly program: LoyaltyProgramService,
    private readonly accounts: LoyaltyAccountsService,
    private readonly loyaltyAdmin: LoyaltyAdminService,
  ) {}

  // API_176: chương trình điểm, bảng hạng.
  @Get("program")
  async getProgram(@Req() request: AuthenticatedRequest): Promise<LoyaltyProgramResponse> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.program.program(await this.admin.allows(request.auth.userId, clientInfo(request), "loyalty.manage"));
  }

  @Post("phases")
  async createPhase(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<LoyaltyPhase> {
    return this.program.createPhase(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), loyaltyPhaseSchema.parse(body));
  }

  @Put("phases/:id")
  async updatePhase(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<LoyaltyPhase> {
    return this.program.updatePhase(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), id, loyaltyPhaseUpdateSchema.parse(body));
  }

  @Delete("phases/:id")
  @HttpCode(204)
  async deletePhase(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    await this.program.deletePhase(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), id);
  }

  @Put("tiers")
  async replaceTiers(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<LoyaltyTier[]> {
    return this.program.replaceTiers(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), loyaltyTiersSchema.parse(body));
  }

  // API_182: nghĩa vụ điểm theo tháng.
  @Get("liability")
  async liability(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<LoyaltyLiabilityResponse> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.accounts.liability(loyaltyLiabilityQuerySchema.parse(query).year);
  }

  // API_179: ví điểm.
  @Get("accounts")
  async listAccounts(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<LoyaltyAccountListItem>> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.loyaltyAdmin.list(loyaltyAccountListQuerySchema.parse(query));
  }

  @Get("accounts/:userId")
  async account(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string): Promise<LoyaltyAccountDetail> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.loyaltyAdmin.detail(userId, await this.admin.allows(request.auth.userId, clientInfo(request), "loyalty.manage"));
  }

  @Get("accounts/:userId/entries")
  async accountEntries(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Query() query: unknown): Promise<PageResponse<LoyaltyEntryItem>> {
    await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view");
    return this.accounts.entries(userId, buyerWalletQuerySchema.parse(query));
  }

  @Post("accounts/:userId/lock")
  @HttpCode(200)
  async lock(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<LoyaltyAccountDetail> {
    return this.loyaltyAdmin.setLocked(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), userId, true, loyaltyLockSchema.parse(body).reason);
  }

  @Post("accounts/:userId/unlock")
  @HttpCode(200)
  async unlock(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<LoyaltyAccountDetail> {
    return this.loyaltyAdmin.setLocked(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), userId, false, loyaltyLockSchema.parse(body).reason);
  }

  // API_180: phiếu điều chỉnh điểm.
  @Get("adjustments")
  async adjustments(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<LoyaltyAdjustmentItem>> {
    return this.loyaltyAdmin.adjustments(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view"), loyaltyAdjustmentListQuerySchema.parse(query));
  }

  @Get("adjustments/:id")
  async adjustment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<LoyaltyAdjustmentItem> {
    return this.loyaltyAdmin.adjustment(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view"), id);
  }

  @Post("adjustments")
  async createAdjustment(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<LoyaltyAdjustmentItem> {
    return this.loyaltyAdmin.createAdjustment(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), loyaltyAdjustmentSchema.parse(body));
  }

  @Put("adjustments/:id")
  async updateAdjustment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<LoyaltyAdjustmentItem> {
    return this.loyaltyAdmin.updateAdjustment(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), id, loyaltyAdjustmentUpdateSchema.parse(body));
  }

  @Post("adjustments/:id/submit")
  @HttpCode(200)
  async submitAdjustment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<LoyaltyAdjustmentItem> {
    return this.loyaltyAdmin.submitAdjustment(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), id, loyaltyAdjustmentVersionSchema.parse(body).version);
  }

  @Post("adjustments/:id/withdraw")
  @HttpCode(200)
  async withdrawAdjustment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<LoyaltyAdjustmentItem> {
    return this.loyaltyAdmin.withdrawAdjustment(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.manage"), id);
  }

  // API_181: cảnh báo bất thường.
  @Get("alerts")
  async alerts(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<LoyaltyAlertResponse> {
    return this.loyaltyAdmin.alerts(await this.admin.actor(request.auth.userId, clientInfo(request), "loyalty.view"), loyaltyAlertQuerySchema.parse(query).kind);
  }
}
