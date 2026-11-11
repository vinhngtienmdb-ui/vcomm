// API_176 đến API_182: quản trị điểm thưởng trên web-crm (CONG_VIEC_51). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
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
import { LoyaltyProgramService } from "./program.service";

@Controller("loyalty")
export class LoyaltyController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly program: LoyaltyProgramService,
    private readonly accounts: LoyaltyAccountsService,
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
}
