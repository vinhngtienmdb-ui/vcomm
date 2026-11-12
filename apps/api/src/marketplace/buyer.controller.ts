// API_116 đến 118: đăng ký, đăng nhập, tài khoản người mua trên ứng dụng VComm (CONG_VIEC_23).
// Người mua không thuộc công ty nào nên các API này không dùng header X-Company-Id.
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query, Req } from "@nestjs/common";
import { UuidPipe } from "../common/uuid.pipe";
import {
  buyerLoginSchema,
  buyerOtpVerifySchema,
  buyerPasswordResetSchema,
  buyerPhoneSchema,
  buyerRegisterSchema,
  buyerSetReferrerSchema,
  type AppLoginResponse,
  type BuyerMeResponse,
  type BuyerReferralItem,
  type BuyerSalesCustomerDetail,
  type CareNoteItem,
  careNoteListQuerySchema,
  createCareNoteSchema,
  type FollowUpsResponse,
  salesRevenueQuerySchema,
  type SalesRevenueResponse,
  type BuyerSalesCustomerItem,
  type MySalesTeamResponse,
  type BuyerWalletResponse,
  buyerWalletQuerySchema,
  createSalesProposalSchema,
  type SalesProposalItem,
  type SalesProposalOptionsResponse,
} from "contracts";
import type { Request } from "express";
import { clientInfo } from "../auth/auth.controller";
import { Public, RateLimitGroup, type AuthenticatedRequest } from "../auth/auth.guard";
import { DATABASE, type Database } from "../database/database.module";
import { BuyerAccountsService } from "./buyer-accounts.service";
import { SalesCareService } from "./sales-care.service";
import { SalesRevenueService } from "./sales-revenue.service";
import { MarketplaceCommissionsService } from "./commissions.service";
import { SalesProposalsService } from "./sales-proposals.service";
import { WithdrawalsService } from "./withdrawals.service";

@Controller("buyer")
export class BuyerController {
  constructor(
    private readonly buyers: BuyerAccountsService,
    private readonly care: SalesCareService,
    private readonly revenue: SalesRevenueService,
    private readonly proposals: SalesProposalsService,
    private readonly commissions: MarketplaceCommissionsService,
    private readonly withdrawals: WithdrawalsService,
    @Inject(DATABASE) private readonly database: Database,
  ) {}

  @Public()
  @Post("register/otp")
  @HttpCode(204)
  async sendRegisterOtp(@Body() body: unknown): Promise<void> {
    await this.buyers.sendRegisterOtp(buyerPhoneSchema.parse(body).phone);
  }

  @Public()
  @RateLimitGroup("otp-verify")
  @Post("register")
  @HttpCode(200)
  async register(@Body() body: unknown, @Req() request: Request): Promise<AppLoginResponse> {
    return this.buyers.register(buyerRegisterSchema.parse(body), clientInfo(request));
  }

  @Public()
  @RateLimitGroup("login")
  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: Request): Promise<AppLoginResponse> {
    const input = buyerLoginSchema.parse(body);
    return this.buyers.login(input.phone, input.password, clientInfo(request));
  }

  @Public()
  @Post("login/otp")
  @HttpCode(204)
  async sendLoginOtp(@Body() body: unknown): Promise<void> {
    await this.buyers.sendLoginOtp(buyerPhoneSchema.parse(body).phone);
  }

  @Public()
  @RateLimitGroup("otp-verify")
  @Post("login/otp/verify")
  @HttpCode(200)
  async verifyLoginOtp(@Body() body: unknown, @Req() request: Request): Promise<AppLoginResponse> {
    const input = buyerOtpVerifySchema.parse(body);
    return this.buyers.verifyLoginOtp(input.phone, input.code, clientInfo(request));
  }

  @Public()
  @Post("password-reset/otp")
  @HttpCode(204)
  async sendPasswordResetOtp(@Body() body: unknown): Promise<void> {
    await this.buyers.sendPasswordResetOtp(buyerPhoneSchema.parse(body).phone);
  }

  @Public()
  @RateLimitGroup("otp-verify")
  @Post("password-reset")
  @HttpCode(204)
  async resetPassword(@Body() body: unknown, @Req() request: Request): Promise<void> {
    const input = buyerPasswordResetSchema.parse(body);
    await this.buyers.resetPassword(input.phone, input.code, input.password, clientInfo(request));
  }

  @Get("me")
  async me(@Req() request: AuthenticatedRequest): Promise<BuyerMeResponse> {
    return this.buyers.me(request.auth.userId);
  }

  @Get("referrals")
  async referrals(@Req() request: AuthenticatedRequest): Promise<BuyerReferralItem[]> {
    return this.buyers.referrals(request.auth.userId);
  }

  @Post("referrer")
  @HttpCode(200)
  async setReferrer(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerMeResponse> {
    return this.buyers.setReferrer(request.auth.userId, buyerSetReferrerSchema.parse(body).referralCode, clientInfo(request));
  }

  @Get("sales/customers")
  async salesCustomers(@Req() request: AuthenticatedRequest): Promise<BuyerSalesCustomerItem[]> {
    return this.buyers.salesCustomers(request.auth.userId);
  }

  // API_228: chi tiết khách (CONG_VIEC_22).
  @Get("sales/customers/:id")
  async salesCustomerDetail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerSalesCustomerDetail> {
    return this.buyers.salesCustomerDetail(request.auth.userId, id);
  }

  // API_229: ghi chú chăm sóc của khách (CONG_VIEC_22).
  @Get("sales/customers/:id/notes")
  async careNotes(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query() query: unknown): Promise<{ notes: CareNoteItem[]; hasMore: boolean }> {
    return this.care.list(request.auth.userId, id, careNoteListQuerySchema.parse(query).page);
  }

  @Post("sales/customers/:id/notes")
  async createCareNote(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<CareNoteItem> {
    return this.care.create(request.auth.userId, id, createCareNoteSchema.parse(body), clientInfo(request));
  }

  // API_230: hẹn của tôi, đánh dấu đã xong.
  @Get("sales/follow-ups")
  async followUps(@Req() request: AuthenticatedRequest): Promise<FollowUpsResponse> {
    return this.care.followUps(request.auth.userId);
  }

  @Post("sales/follow-ups/:id/done")
  @HttpCode(200)
  async followUpDone(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<CareNoteItem> {
    return this.care.markDone(request.auth.userId, id, clientInfo(request));
  }

  // API_231: doanh số tháng của tôi và của nhánh (CONG_VIEC_22).
  @Get("sales/revenue")
  async salesRevenue(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<SalesRevenueResponse> {
    return this.revenue.revenue(request.auth.userId, salesRevenueQuerySchema.parse(query).month);
  }

  // API_135: ví hoa hồng của chính người gọi (CONG_VIEC_26).
  @Get("wallet")
  async wallet(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<BuyerWalletResponse> {
    const parsed = buyerWalletQuerySchema.parse(query);
    return { ...(await this.commissions.wallet(this.database, request.auth.userId, parsed)), withdrawal: await this.withdrawals.info(this.database, request.auth.userId) };
  }

  // API_122: đội của tôi (CONG_VIEC_27).
  @Get("sales/team")
  async team(@Req() request: AuthenticatedRequest): Promise<MySalesTeamResponse> {
    return this.buyers.team(request.auth.userId);
  }

  @Get("sales/members/:id/customers")
  async memberCustomers(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerSalesCustomerItem[]> {
    return this.buyers.memberCustomers(request.auth.userId, id);
  }

  // API_121: đề xuất thay đổi đội kinh doanh (người quản lý).
  @Get("sales/proposal-options")
  async proposalOptions(@Req() request: AuthenticatedRequest): Promise<SalesProposalOptionsResponse> {
    return this.proposals.options(request.auth.userId);
  }

  @Get("sales/proposals")
  async myProposals(@Req() request: AuthenticatedRequest): Promise<SalesProposalItem[]> {
    return this.proposals.mine(request.auth.userId);
  }

  @Post("sales/proposals")
  async createProposal(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<SalesProposalItem> {
    return this.proposals.create(request.auth.userId, createSalesProposalSchema.parse(body));
  }

  @Post("sales/proposals/:id/withdraw")
  @HttpCode(200)
  async withdrawProposal(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<SalesProposalItem> {
    return this.proposals.withdraw(request.auth.userId, id);
  }
}
