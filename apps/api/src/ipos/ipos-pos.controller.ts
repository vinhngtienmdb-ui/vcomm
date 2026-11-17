// API_335, API_336: ứng dụng iPOS – ghép thiết bị, đăng nhập trên thiết bị, thu ngân tự đăng ký (CONG_VIEC_74).
// Thiết bị gửi khóa qua tiêu đề `x-ipos-device`; sau khi đăng nhập gửi thêm token truy cập qua tiêu đề Authorization.
import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req } from "@nestjs/common";
import {
  iposLoginOtpSchema,
  iposLoginSchema,
  iposPairSchema,
  iposPinLoginSchema,
  iposPinSchema,
  iposRegistrationOtpSchema,
  iposRegistrationSchema,
  type IposDeviceInfo,
  type IposLoginResult,
  type IposMe,
  type IposPairResult,
  type IposRegistrationCreated,
  type IposRegistrationOutlet,
} from "contracts";
import type { Request } from "express";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import { Public, RateLimitGroup, type AuthenticatedRequest } from "../auth/auth.guard";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import { IposDeviceAuthService } from "./ipos-device-auth.service";
import { deviceKeyOf, posActor } from "./ipos-device-context";
import { IposRegistrationsService } from "./ipos-registrations.service";

const merchantCodeQuery = z.object({ merchantCode: z.string().trim().toUpperCase().regex(/^CH\d{6}$/, "invalidValue") });

@Controller("ipos")
export class IposPosController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly deviceAuth: IposDeviceAuthService,
    private readonly registrations: IposRegistrationsService,
  ) {}

  private actor(request: AuthenticatedRequest) {
    return posActor(this.database, request, this.clock.now());
  }

  @Public()
  @RateLimitGroup("ipos-device")
  @Post("devices/pair")
  async pair(@Req() request: Request, @Body() body: unknown): Promise<IposPairResult> {
    return this.deviceAuth.pair(iposPairSchema.parse(body), clientInfo(request));
  }

  @Public()
  @RateLimitGroup("ipos-device")
  @Get("pos/device")
  async device(@Req() request: Request): Promise<IposDeviceInfo> {
    return this.deviceAuth.device(deviceKeyOf(request));
  }

  @Public()
  @RateLimitGroup("login")
  @Post("pos/auth/otp")
  @HttpCode(204)
  async loginOtp(@Req() request: Request, @Body() body: unknown): Promise<void> {
    await this.deviceAuth.sendLoginOtp(deviceKeyOf(request), iposLoginOtpSchema.parse(body).phone);
  }

  @Public()
  @RateLimitGroup("login")
  @Post("pos/auth/login")
  async login(@Req() request: Request, @Body() body: unknown): Promise<IposLoginResult> {
    const input = iposLoginSchema.parse(body);
    return this.deviceAuth.loginWithOtp(deviceKeyOf(request), input.phone, input.code, clientInfo(request));
  }

  @Public()
  @RateLimitGroup("login")
  @Post("pos/auth/pin-login")
  async pinLogin(@Req() request: Request, @Body() body: unknown): Promise<IposLoginResult> {
    const input = iposPinLoginSchema.parse(body);
    return this.deviceAuth.loginWithPin(deviceKeyOf(request), input.memberId, input.pin, clientInfo(request));
  }

  @Post("pos/auth/pin")
  @HttpCode(204)
  async setPin(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.deviceAuth.setPin(await this.actor(request), iposPinSchema.parse(body).pin, clientInfo(request));
  }

  @Get("pos/me")
  async me(@Req() request: AuthenticatedRequest): Promise<IposMe> {
    return this.deviceAuth.me(await this.actor(request));
  }

  @Post("pos/auth/lock")
  @HttpCode(204)
  async lock(@Req() request: AuthenticatedRequest): Promise<void> {
    await this.deviceAuth.lock(await this.actor(request), request.auth.sessionId, clientInfo(request));
  }

  @Public()
  @RateLimitGroup("ipos-registration")
  @Get("cashier-registrations/outlets")
  async registrationOutlets(@Query() query: unknown): Promise<IposRegistrationOutlet[]> {
    return this.registrations.outlets(merchantCodeQuery.parse(query).merchantCode);
  }

  @Public()
  @RateLimitGroup("ipos-registration")
  @Post("cashier-registrations/otp")
  @HttpCode(204)
  async registrationOtp(@Body() body: unknown): Promise<void> {
    const input = iposRegistrationOtpSchema.parse(body);
    await this.registrations.sendOtp(input.merchantCode, input.phone);
  }

  @Public()
  @RateLimitGroup("ipos-registration")
  @Post("cashier-registrations")
  async register(@Body() body: unknown): Promise<IposRegistrationCreated> {
    return this.registrations.register(iposRegistrationSchema.parse(body));
  }
}
