// API_206: cửa hàng liên kết trên web quản trị (CONG_VIEC_55). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  affiliateMemberVersionSchema,
  affiliateMerchantCreateSchema,
  affiliateMerchantListQuerySchema,
  affiliateMerchantStatusSchema,
  affiliateMerchantUpdateSchema,
  affiliateOutletSchema,
  affiliateOutletUpdateSchema,
  affiliateOwnerInviteSchema,
  type AffiliateMember,
  type AffiliateMerchantDetail,
  type AffiliateMerchantListItem,
  type AffiliateOutlet,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { AffiliateMerchantsService } from "./merchants.service";

@Controller("affiliate")
export class AffiliateController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly merchants: AffiliateMerchantsService,
  ) {}

  private manager(request: AuthenticatedRequest) {
    return this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.manage");
  }

  @Get("merchants")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateMerchantListItem>> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.merchants.list(actor, affiliateMerchantListQuerySchema.parse(query));
  }

  @Post("merchants")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    return this.merchants.create(await this.manager(request), affiliateMerchantCreateSchema.parse(body));
  }

  @Get("merchants/:id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateMerchantDetail> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.merchants.detail(actor, id, await this.admin.allows(request.auth.userId, clientInfo(request), "affiliate.manage"));
  }

  @Put("merchants/:id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    return this.merchants.update(await this.manager(request), id, affiliateMerchantUpdateSchema.parse(body));
  }

  @Post("merchants/:id/activate")
  async activate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    const input = affiliateMerchantStatusSchema.parse(body);
    return this.merchants.changeStatus(await this.manager(request), id, "active", input.version, null);
  }

  @Post("merchants/:id/suspend")
  async suspend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    const input = affiliateMerchantStatusSchema.parse(body);
    return this.merchants.changeStatus(await this.manager(request), id, "suspended", input.version, input.reason ?? null);
  }

  @Post("merchants/:id/terminate")
  async terminate(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMerchantDetail> {
    const input = affiliateMerchantStatusSchema.parse(body);
    return this.merchants.changeStatus(await this.manager(request), id, "terminated", input.version, input.reason ?? null);
  }

  @Post("merchants/:id/outlets")
  async addOutlet(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateOutlet> {
    return this.merchants.addOutlet(await this.manager(request), id, affiliateOutletSchema.parse(body));
  }

  @Put("outlets/:id")
  async updateOutlet(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateOutlet> {
    return this.merchants.updateOutlet(await this.manager(request), id, affiliateOutletUpdateSchema.parse(body));
  }

  @Post("merchants/:id/owner-invitations")
  async inviteOwner(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.merchants.inviteOwner(await this.manager(request), id, affiliateOwnerInviteSchema.parse(body));
  }

  @Post("members/:id/lock")
  async lockMember(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.merchants.setMemberLocked(await this.manager(request), id, true, affiliateMemberVersionSchema.parse(body).version);
  }

  @Post("members/:id/unlock")
  async unlockMember(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.merchants.setMemberLocked(await this.manager(request), id, false, affiliateMemberVersionSchema.parse(body).version);
  }
}
