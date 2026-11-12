// API_206: cửa hàng liên kết trên web quản trị (CONG_VIEC_55). Quyền xét tại công ty vận hành sàn.
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req } from "@nestjs/common";
import {
  affiliateMemberVersionSchema,
  affiliateMerchantCreateSchema,
  affiliateMerchantListQuerySchema,
  affiliateMerchantStatusSchema,
  affiliateMerchantUpdateSchema,
  affiliateOutletSchema,
  affiliateOutletUpdateSchema,
  affiliateOwnerInviteSchema,
  affiliateVoucherListQuerySchema,
  affiliateSettlementListQuerySchema,
  affiliateAlertQuerySchema,
  affiliateReportQuerySchema,
  type AffiliateAlert,
  type AffiliateCompanyReport,
  affiliateSettlementResolveSchema,
  type AffiliateSettlementDetail,
  type AffiliateSettlementItem,
  companyVoucherSchema,
  companyVoucherUpdateSchema,
  type AffiliateVoucherItem,
  type AffiliateMember,
  type AffiliateMerchantDetail,
  type AffiliateMerchantListItem,
  type AffiliateOutlet,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { BuyerAdminService } from "../marketplace/buyer-admin.service";
import { voucherAction } from "./merchant-portal.controller";
import { AffiliateMerchantsService } from "./merchants.service";
import { AffiliateReportsService } from "./reports.service";
import { AffiliateSettlementsService, type SettlementActor } from "./settlements.service";
import { AffiliateVouchersService, type VoucherActor } from "./vouchers.service";

@Controller("affiliate")
export class AffiliateController {
  constructor(
    private readonly admin: BuyerAdminService,
    private readonly merchants: AffiliateMerchantsService,
    private readonly vouchers: AffiliateVouchersService,
    private readonly settlements: AffiliateSettlementsService,
    private readonly reports: AffiliateReportsService,
  ) {}

  private async voucherActor(request: AuthenticatedRequest, permission: "affiliate.view" | "affiliate.manage"): Promise<VoucherActor> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), permission);
    return { userId: actor.userId, companyId: actor.operatorCompanyId, merchantId: null, client: actor.client };
  }

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

  // API_210: mọi voucher liên kết; tạo, sửa voucher công ty phát hành.
  @Get("vouchers")
  async listVouchers(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateVoucherItem>> {
    return this.vouchers.list(await this.voucherActor(request, "affiliate.view"), affiliateVoucherListQuerySchema.parse(query));
  }

  @Get("vouchers/:id")
  async voucher(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateVoucherItem> {
    return this.vouchers.voucher(await this.voucherActor(request, "affiliate.view"), id);
  }

  @Post("vouchers")
  async createVoucher(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    return this.vouchers.create(await this.voucherActor(request, "affiliate.manage"), { issuer: "company", ...companyVoucherSchema.parse(body) });
  }

  @Put("vouchers/:id")
  async updateVoucher(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    const actor = await this.voucherActor(request, "affiliate.manage");
    await this.companyIssued(actor, id);
    return this.vouchers.update(actor, id, { issuer: "company", ...companyVoucherUpdateSchema.parse(body) });
  }

  // Công ty gửi duyệt, rút, tạm dừng, giảm số lượng voucher do công ty phát hành; tạm dừng được cả voucher cửa hàng.
  @Post("vouchers/:id/:action")
  async voucherAction(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Param("action") action: string, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    const actor = await this.voucherActor(request, "affiliate.manage");
    if (action !== "pause" && action !== "resume") await this.companyIssued(actor, id);
    return voucherAction(this.vouchers, actor, id, action, body);
  }

  // API_213: báo cáo theo cửa hàng, cảnh báo bất thường.
  @Get("report")
  async report(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<AffiliateCompanyReport> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.reports.companyReport(actor.operatorCompanyId, affiliateReportQuerySchema.parse(query));
  }

  @Get("alerts")
  async alerts(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<AffiliateAlert[]> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), "affiliate.view");
    return this.reports.alerts(actor.operatorCompanyId, affiliateAlertQuerySchema.parse(query));
  }

  // API_212: đối soát tuần mọi cửa hàng; trả lời khiếu nại và chốt lại.
  private async settlementActor(request: AuthenticatedRequest, permission: "affiliate.view" | "affiliate.manage"): Promise<SettlementActor> {
    const actor = await this.admin.actor(request.auth.userId, clientInfo(request), permission);
    return { userId: actor.userId, companyId: actor.operatorCompanyId, merchantId: null, client: actor.client };
  }

  @Get("settlements")
  async listSettlements(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateSettlementItem>> {
    return this.settlements.list(await this.settlementActor(request, "affiliate.view"), affiliateSettlementListQuerySchema.parse(query));
  }

  @Get("settlements/:id")
  async settlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateSettlementDetail> {
    return this.settlements.detail(await this.settlementActor(request, "affiliate.view"), id);
  }

  @Post("settlements/:id/resolve")
  @HttpCode(200)
  async resolveSettlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateSettlementDetail> {
    return this.settlements.resolve(await this.settlementActor(request, "affiliate.manage"), id, affiliateSettlementResolveSchema.parse(body));
  }

  private async companyIssued(actor: VoucherActor, id: string): Promise<void> {
    if ((await this.vouchers.voucher(actor, id)).issuer !== "company") throw new ApiError("FORBIDDEN", "forbidden");
  }
}
