// API_177: điểm của tôi, hạng thành viên trên ứng dụng VComm (CONG_VIEC_51). Người mua chỉ xem ví điểm của chính mình.
import { Body, Controller, Delete, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import {
  activateSmartOtpSchema,
  buyerWalletQuerySchema,
  type BuyerLoyaltyResponse,
  type LoyaltyEntryItem,
  type PageResponse,
  type SmartOtpActivationResponse,
  type SmartOtpStatusResponse,
} from "contracts";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { LoyaltyAccountsService } from "./accounts.service";
import { SmartOtpService } from "./smart-otp.service";

@Controller("buyer/loyalty")
export class BuyerLoyaltyController {
  constructor(
    private readonly accounts: LoyaltyAccountsService,
    private readonly smartOtp: SmartOtpService,
  ) {}

  @Get()
  async summary(@Req() request: AuthenticatedRequest): Promise<BuyerLoyaltyResponse> {
    return this.accounts.buyerSummary(request.auth.userId);
  }

  @Get("entries")
  async entries(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<PageResponse<LoyaltyEntryItem>> {
    return this.accounts.entries(request.auth.userId, buyerWalletQuerySchema.parse(query));
  }

  // API_199: Smart OTP dùng điểm tại quầy (CONG_VIEC_53 lát L6).
  @Get("smart-otp")
  async smartOtpStatus(@Req() request: AuthenticatedRequest): Promise<SmartOtpStatusResponse> {
    return this.smartOtp.status(request.auth.userId);
  }

  @Post("smart-otp/send-code")
  @HttpCode(204)
  async smartOtpSendCode(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.smartOtp.sendCode(request.auth.userId);
  }

  @Post("smart-otp/activate")
  async smartOtpActivate(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<SmartOtpActivationResponse> {
    return this.smartOtp.activate(request.auth.userId, activateSmartOtpSchema.parse(body));
  }

  @Delete("smart-otp")
  async smartOtpRevoke(@Req() request: AuthenticatedRequest): Promise<SmartOtpStatusResponse> {
    return this.smartOtp.revoke(request.auth.userId);
  }
}
