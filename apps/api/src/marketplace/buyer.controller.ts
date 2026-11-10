// API_116 đến 118: đăng ký, đăng nhập, tài khoản người mua trên ứng dụng VComm (CONG_VIEC_23).
// Người mua không thuộc công ty nào nên các API này không dùng header X-Company-Id.
import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
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
  type BuyerSalesCustomerItem,
} from "contracts";
import type { Request } from "express";
import { clientInfo } from "../auth/auth.controller";
import { Public, RateLimitGroup, type AuthenticatedRequest } from "../auth/auth.guard";
import { BuyerAccountsService } from "./buyer-accounts.service";

@Controller("buyer")
export class BuyerController {
  constructor(private readonly buyers: BuyerAccountsService) {}

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
}
