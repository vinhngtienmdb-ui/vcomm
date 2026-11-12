// API_207: cổng cửa hàng liên kết – kích hoạt lời mời, thông tin của tôi, cửa hàng, nhân viên (CONG_VIEC_55).
// Cửa hàng đang chọn gửi qua header `x-merchant-id` khi người dùng là thành viên của nhiều cửa hàng.
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res } from "@nestjs/common";
import {
  affiliateActivationOtpSchema,
  affiliateActivationSchema,
  affiliateCashierInviteSchema,
  affiliateMemberOutletsSchema,
  affiliateMemberVersionSchema,
  affiliateTransactionCancelSchema,
  affiliateVoucherListQuerySchema,
  affiliateSettlementConfirmSchema,
  affiliateSettlementDisputeSchema,
  affiliateSettlementListQuerySchema,
  type AffiliateSettlementDetail,
  type AffiliateSettlementItem,
  affiliateVoucherQuantitySchema,
  affiliateVoucherVersionSchema,
  merchantVoucherSchema,
  merchantVoucherUpdateSchema,
  type AffiliateVoucherItem,
  affiliateTransactionCreateSchema,
  affiliateTransactionListQuerySchema,
  type AffiliateMember,
  type AffiliateTransactionCreated,
  type AffiliateTransactionItem,
  type PageResponse,
  type LoginResponse,
  type MerchantPortalMe,
  type MerchantPortalStore,
} from "contracts";
import type { Request, Response } from "express";
import { clientInfo, setSessionCookies } from "../auth/auth.controller";
import { Public, RateLimitGroup, type AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { MerchantPortalService, requireOwner, type PortalMember } from "./portal.service";
import { AffiliateTransactionsService } from "./transactions.service";
import { AffiliateSettlementsService } from "./settlements.service";
import { AffiliateVouchersService, type VoucherActor } from "./vouchers.service";

export function selectedMerchant(request: Request): string | undefined {
  const value = request.header("x-merchant-id");
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
}

@Controller("merchant-portal")
export class MerchantPortalController {
  constructor(
    private readonly portal: MerchantPortalService,
    private readonly transactions: AffiliateTransactionsService,
    private readonly vouchers: AffiliateVouchersService,
    private readonly settlements: AffiliateSettlementsService,
  ) {}

  // Voucher của cửa hàng: chỉ chủ cửa hàng (QUYTAC_NGHIEPVU_401).
  private async voucherActor(request: AuthenticatedRequest): Promise<VoucherActor> {
    const member = await this.member(request);
    requireOwner(member);
    return { userId: member.userId, companyId: member.companyId, merchantId: member.merchantId, client: member.client };
  }

  private member(request: AuthenticatedRequest): Promise<PortalMember> {
    return this.portal.member(request.auth.userId, selectedMerchant(request), clientInfo(request));
  }

  @Public()
  @RateLimitGroup("login")
  @Post("activation/otp")
  @HttpCode(204)
  async sendActivationOtp(@Body() body: unknown): Promise<void> {
    await this.portal.sendActivationOtp(affiliateActivationOtpSchema.parse(body).phone);
  }

  @Public()
  @RateLimitGroup("otp-verify")
  @Post("activation")
  @HttpCode(200)
  async activate(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<LoginResponse> {
    const input = affiliateActivationSchema.parse(body);
    const { response: result, session } = await this.portal.activate(input.phone, input.code, clientInfo(request));
    setSessionCookies(response, session);
    return result;
  }

  @Get("me")
  me(@Req() request: AuthenticatedRequest): Promise<MerchantPortalMe> {
    return this.portal.me(request.auth.userId);
  }

  @Get("store")
  async store(@Req() request: AuthenticatedRequest): Promise<MerchantPortalStore> {
    return this.portal.store(await this.member(request));
  }

  @Post("members")
  async inviteCashier(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.portal.inviteCashier(await this.member(request), affiliateCashierInviteSchema.parse(body));
  }

  @Put("members/:id")
  async setOutlets(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    const input = affiliateMemberOutletsSchema.parse(body);
    return this.portal.setCashierOutlets(await this.member(request), id, input.outletIds, input.version);
  }

  @Post("members/:id/lock")
  async lock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.portal.setCashierLocked(await this.member(request), id, true, affiliateMemberVersionSchema.parse(body).version);
  }

  @Post("members/:id/unlock")
  async unlock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateMember[]> {
    return this.portal.setCashierLocked(await this.member(request), id, false, affiliateMemberVersionSchema.parse(body).version);
  }

  // API_208: giao dịch tại quầy.
  @Post("transactions")
  async createTransaction(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateTransactionCreated> {
    return this.transactions.create(await this.member(request), affiliateTransactionCreateSchema.parse(body));
  }

  @Get("transactions")
  async listTransactions(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateTransactionItem>> {
    return this.transactions.list(await this.member(request), affiliateTransactionListQuerySchema.parse(query));
  }

  @Get("transactions/:id")
  async transaction(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateTransactionItem> {
    return this.transactions.transaction(await this.member(request), id);
  }

  @Post("transactions/:id/cancel")
  async cancelTransaction(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateTransactionItem> {
    return this.transactions.cancel(await this.member(request), id, affiliateTransactionCancelSchema.parse(body).reason);
  }

  // API_210: voucher của cửa hàng.
  @Get("vouchers")
  async listVouchers(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateVoucherItem>> {
    return this.vouchers.list(await this.voucherActor(request), affiliateVoucherListQuerySchema.parse(query));
  }

  @Post("vouchers")
  async createVoucher(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    return this.vouchers.create(await this.voucherActor(request), merchantVoucherSchema.parse(body));
  }

  @Get("vouchers/:id")
  async voucher(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateVoucherItem> {
    return this.vouchers.voucher(await this.voucherActor(request), id);
  }

  @Put("vouchers/:id")
  async updateVoucher(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    return this.vouchers.update(await this.voucherActor(request), id, merchantVoucherUpdateSchema.parse(body));
  }

  @Post("vouchers/:id/:action")
  async voucherAction(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Param("action") action: string, @Body() body: unknown): Promise<AffiliateVoucherItem> {
    return voucherAction(this.vouchers, await this.voucherActor(request), id, action, body);
  }

  // API_212: đối soát tuần của cửa hàng (chủ cửa hàng).
  @Get("settlements")
  async listSettlements(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<AffiliateSettlementItem>> {
    const member = await this.member(request);
    requireOwner(member);
    return this.settlements.list(this.settlements.memberActor(member), { ...affiliateSettlementListQuerySchema.parse(query), merchantId: undefined });
  }

  @Get("settlements/:id")
  async settlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<AffiliateSettlementDetail> {
    const member = await this.member(request);
    requireOwner(member);
    return this.settlements.detail(this.settlements.memberActor(member), id);
  }

  @Post("settlements/:id/confirm")
  @HttpCode(200)
  async confirmSettlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateSettlementDetail> {
    return this.settlements.confirm(await this.member(request), id, affiliateSettlementConfirmSchema.parse(body).version);
  }

  @Post("settlements/:id/dispute")
  @HttpCode(200)
  async disputeSettlement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<AffiliateSettlementDetail> {
    const input = affiliateSettlementDisputeSchema.parse(body);
    return this.settlements.dispute(await this.member(request), id, input.reason, input.version);
  }
}

// Thao tác voucher dùng chung cho cổng cửa hàng và web quản trị.
export async function voucherAction(vouchers: AffiliateVouchersService, actor: VoucherActor, id: string, action: string, body: unknown): Promise<AffiliateVoucherItem> {
  if (action === "quantity") {
    const input = affiliateVoucherQuantitySchema.parse(body);
    return vouchers.reduceQuantity(actor, id, input.totalQuantity, input.version);
  }
  const version = affiliateVoucherVersionSchema.parse(body).version;
  if (action === "submit") return vouchers.submit(actor, id, version);
  if (action === "withdraw") return vouchers.withdraw(actor, id, version);
  if (action === "pause") return vouchers.setPaused(actor, id, true, version);
  if (action === "resume") return vouchers.setPaused(actor, id, false, version);
  throw new ApiError("NOT_FOUND", "notFound");
}
