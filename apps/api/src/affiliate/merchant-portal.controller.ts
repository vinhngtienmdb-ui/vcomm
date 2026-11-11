// API_207: cổng cửa hàng liên kết – kích hoạt lời mời, thông tin của tôi, cửa hàng, nhân viên (CONG_VIEC_55).
// Cửa hàng đang chọn gửi qua header `x-merchant-id` khi người dùng là thành viên của nhiều cửa hàng.
import { Body, Controller, Get, HttpCode, Param, Post, Put, Req, Res } from "@nestjs/common";
import {
  affiliateActivationOtpSchema,
  affiliateActivationSchema,
  affiliateCashierInviteSchema,
  affiliateMemberOutletsSchema,
  affiliateMemberVersionSchema,
  type AffiliateMember,
  type LoginResponse,
  type MerchantPortalMe,
  type MerchantPortalStore,
} from "contracts";
import type { Request, Response } from "express";
import { clientInfo, setSessionCookies } from "../auth/auth.controller";
import { Public, RateLimitGroup, type AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { MerchantPortalService, type PortalMember } from "./portal.service";

export function selectedMerchant(request: Request): string | undefined {
  const value = request.header("x-merchant-id");
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined;
}

@Controller("merchant-portal")
export class MerchantPortalController {
  constructor(private readonly portal: MerchantPortalService) {}

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
}
