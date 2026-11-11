// API_162 cộng tác viên, mời bạn bè (người mua); API_163 quản trị cộng tác viên, thưởng giới thiệu (CONG_VIEC_49; CHUC_NANG_171).
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  collaboratorClickSchema,
  collaboratorLabelSchema,
  collaboratorListQuerySchema,
  collaboratorReasonSchema,
  collaboratorVersionSchema,
  referralBonusSettingsSchema,
  submitCollaboratorSchema,
  type BuyerCollaboratorOrderItem,
  type BuyerCollaboratorResponse,
  type BuyerInvitationsResponse,
  type CollaboratorDetail,
  type CollaboratorListItem,
  type PageResponse,
  type ReferralBonusSettings,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService, type MarketplacePermission } from "./buyer-admin.service";
import { CollaboratorsService } from "./collaborators.service";

@Controller()
export class CollaboratorsController {
  constructor(
    private readonly collaborators: CollaboratorsService,
    private readonly admin: BuyerAdminService,
  ) {}

  private actor(request: AuthenticatedRequest, permission: MarketplacePermission) {
    return this.admin.actor(request.auth.userId, clientInfo(request), permission);
  }

  @Get("buyer/collaborator")
  async mine(@Req() request: AuthenticatedRequest): Promise<BuyerCollaboratorResponse> {
    return this.collaborators.mine(request.auth.userId);
  }

  @Post("buyer/collaborator")
  @HttpCode(200)
  async submit(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerCollaboratorResponse> {
    return this.collaborators.submit(request.auth.userId, submitCollaboratorSchema.parse(body));
  }

  @Post("buyer/collaborator/clicks")
  @HttpCode(204)
  async click(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.collaborators.click(request.auth.userId, collaboratorClickSchema.parse(body));
  }

  @Get("buyer/collaborator/orders")
  async myOrders(@Req() request: AuthenticatedRequest): Promise<BuyerCollaboratorOrderItem[]> {
    return this.collaborators.myOrders(request.auth.userId);
  }

  @Get("buyer/invitations")
  async invitations(@Req() request: AuthenticatedRequest): Promise<BuyerInvitationsResponse> {
    return this.collaborators.invitations(request.auth.userId);
  }

  @Get("marketplace/collaborators")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<CollaboratorListItem>> {
    return this.collaborators.list(await this.actor(request, "marketplace.buyer.view"), collaboratorListQuerySchema.parse(query));
  }

  @Get("marketplace/collaborators/:userId")
  async detail(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string): Promise<CollaboratorDetail> {
    return this.collaborators.detail(await this.actor(request, "marketplace.buyer.view"), userId);
  }

  @Post("marketplace/collaborators/:userId/approve")
  @HttpCode(200)
  async approve(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<CollaboratorDetail> {
    return this.collaborators.decide(await this.actor(request, "marketplace.buyer.manage"), userId, "approve", collaboratorVersionSchema.parse(body));
  }

  @Post("marketplace/collaborators/:userId/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<CollaboratorDetail> {
    return this.collaborators.decide(await this.actor(request, "marketplace.buyer.manage"), userId, "reject", collaboratorReasonSchema.parse(body));
  }

  @Post("marketplace/collaborators/:userId/suspend")
  @HttpCode(200)
  async suspend(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<CollaboratorDetail> {
    return this.collaborators.decide(await this.actor(request, "marketplace.buyer.manage"), userId, "suspend", collaboratorReasonSchema.parse(body));
  }

  @Post("marketplace/collaborators/:userId/restore")
  @HttpCode(200)
  async restore(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<CollaboratorDetail> {
    return this.collaborators.decide(await this.actor(request, "marketplace.buyer.manage"), userId, "restore", collaboratorVersionSchema.parse(body));
  }

  @Put("marketplace/collaborators/:userId/label")
  async label(@Req() request: AuthenticatedRequest, @Param("userId", UuidPipe) userId: string, @Body() body: unknown): Promise<CollaboratorDetail> {
    return this.collaborators.setLabel(await this.actor(request, "marketplace.buyer.manage"), userId, collaboratorLabelSchema.parse(body));
  }

  @Get("marketplace/referral-bonus-settings")
  async settings(@Req() request: AuthenticatedRequest): Promise<ReferralBonusSettings> {
    return this.collaborators.settings(await this.actor(request, "marketplace.order.view"));
  }

  @Put("marketplace/referral-bonus-settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<ReferralBonusSettings> {
    return this.collaborators.updateSettings(await this.actor(request, "marketplace.order.manage"), referralBonusSettingsSchema.parse(body));
  }
}
