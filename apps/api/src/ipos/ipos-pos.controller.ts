// API_335 đến 342: ứng dụng iPOS – ghép thiết bị, đăng nhập trên thiết bị, thu ngân tự đăng ký, đồng bộ danh mục, ca, giỏ treo, hóa đơn, duyệt tại chỗ (CONG_VIEC_74).
// Thiết bị gửi khóa qua tiêu đề `x-ipos-device`; sau khi đăng nhập gửi thêm token truy cập qua tiêu đề Authorization.
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseIntPipe, Post, Put, Query, Req } from "@nestjs/common";
import {
  iposApprovalSchema,
  iposLoyaltyCreateSchema,
  iposPayCodeSchema,
  iposVcommCheckoutCreateSchema,
  type IposLoyaltyTransaction,
  type IposVcommCheckout,
  iposCashMovementSchema,
  iposCloseShiftSchema,
  iposDrawerEventSchema,
  iposHeldCartSchema,
  iposOpenShiftSchema,
  iposPrintLogSchema,
  iposSaleCreateSchema,
  type IposApproval,
  type IposCatalog,
  type IposCurrentShift,
  type IposHeldCart,
  type IposSale,
  type IposSaleRow,
  type IposShift,
  type IposShiftReport,
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
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { IposCheckoutsService } from "./ipos-checkouts.service";
import { IposSalesService } from "./ipos-sales.service";
import { IposShiftsService } from "./ipos-shifts.service";
import { IposDeviceAuthService } from "./ipos-device-auth.service";
import { deviceKeyOf, posActor } from "./ipos-device-context";
import { IposRegistrationsService } from "./ipos-registrations.service";

const catalogQuery = z.object({ since: z.string().datetime({ offset: true }).optional() });
const salesQuery = z.object({ shiftId: z.string().uuid(), search: z.string().trim().max(30).optional() });
const slotOf = (slot: number) => {
  if (slot < 1 || slot > 5) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { slot: "invalidValue" } });
  return slot;
};
const merchantCodeQuery = z.object({ merchantCode: z.string().trim().toUpperCase().regex(/^CH\d{6}$/, "invalidValue") });

@Controller("ipos")
export class IposPosController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly deviceAuth: IposDeviceAuthService,
    private readonly registrations: IposRegistrationsService,
    private readonly shifts: IposShiftsService,
    private readonly sales: IposSalesService,
    private readonly checkoutsService: IposCheckoutsService,
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
    return this.deviceAuth.loginWithOtp(deviceKeyOf(request), input.phone, input.code, input.method, clientInfo(request));
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

  // API_337: đồng bộ danh mục.
  @Get("pos/catalog")
  async catalog(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposCatalog> {
    const since = catalogQuery.parse(query).since;
    return this.shifts.catalog(await this.actor(request), since ? new Date(since) : null);
  }

  // API_338: ca, thu chi, đóng ca, biên bản; nhật ký mở ngăn kéo.
  @Get("pos/shifts/current")
  async currentShift(@Req() request: AuthenticatedRequest): Promise<IposCurrentShift> {
    return this.shifts.current(await this.actor(request));
  }

  @Post("pos/shifts")
  async openShift(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposShift> {
    return this.shifts.open(await this.actor(request), iposOpenShiftSchema.parse(body));
  }

  @Post("pos/shifts/:id/cash-movements")
  async cashMovement(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposShiftReport> {
    return this.shifts.addCashMovement(await this.actor(request), id, iposCashMovementSchema.parse(body));
  }

  @Post("pos/shifts/:id/close")
  async closeShift(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposShiftReport> {
    return this.shifts.close(await this.actor(request), id, iposCloseShiftSchema.parse(body));
  }

  @Get("pos/shifts/:id/report")
  async shiftReport(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposShiftReport> {
    return this.shifts.report(await this.actor(request), id);
  }

  @Post("pos/drawer-events")
  @HttpCode(204)
  async drawer(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.shifts.drawerOpened(await this.actor(request), iposDrawerEventSchema.parse(body ?? {}).reason);
  }

  // API_339: giỏ treo.
  @Get("pos/held-carts")
  async heldCarts(@Req() request: AuthenticatedRequest): Promise<IposHeldCart[]> {
    return this.shifts.heldCarts(await this.actor(request));
  }

  @Put("pos/held-carts/:slot")
  async saveHeldCart(@Req() request: AuthenticatedRequest, @Param("slot", ParseIntPipe) slot: number, @Body() body: unknown): Promise<IposHeldCart[]> {
    return this.shifts.saveHeldCart(await this.actor(request), slotOf(slot), iposHeldCartSchema.parse(body));
  }

  @Delete("pos/held-carts/:slot")
  async removeHeldCart(@Req() request: AuthenticatedRequest, @Param("slot", ParseIntPipe) slot: number): Promise<IposHeldCart[]> {
    return this.shifts.removeHeldCart(await this.actor(request), slotOf(slot));
  }

  // API_340: hóa đơn.
  @Post("pos/sales")
  async createSale(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposSale> {
    return this.sales.create(await this.actor(request), iposSaleCreateSchema.parse(body));
  }

  @Get("pos/sales")
  async listSales(@Req() request: AuthenticatedRequest, @Query() query: unknown): Promise<IposSaleRow[]> {
    const input = salesQuery.parse(query);
    return this.sales.list(await this.actor(request), input.shiftId, input.search);
  }

  @Get("pos/sales/:id")
  async sale(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposSale> {
    return this.sales.detail(await this.actor(request), id);
  }

  @Post("pos/sales/:id/print-log")
  async printLog(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposSale> {
    return this.sales.logPrint(await this.actor(request), id, iposPrintLogSchema.parse(body).reprint);
  }

  // API_342: chủ cửa hàng duyệt tại chỗ bằng PIN.
  @RateLimitGroup("login")
  @Post("pos/approvals/pin")
  async approve(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposApproval> {
    return this.shifts.approve(await this.actor(request), iposApprovalSchema.parse(body));
  }

  // API_341: khách VComm dùng điểm, voucher tại quầy (service CONG_VIEC_55, 67); đơn chờ thanh toán qua ứng dụng VComm (CONG_VIEC_73).
  @Post("pos/loyalty-transactions")
  async createLoyalty(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposLoyaltyTransaction> {
    return this.checkoutsService.createLoyalty(await this.actor(request), iposLoyaltyCreateSchema.parse(body));
  }

  @Get("pos/loyalty-transactions/:id")
  async loyalty(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposLoyaltyTransaction> {
    return this.checkoutsService.loyalty(await this.actor(request), id);
  }

  @Post("pos/loyalty-transactions/:id/cancel")
  async cancelLoyalty(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposLoyaltyTransaction> {
    return this.checkoutsService.cancelLoyalty(await this.actor(request), id);
  }

  @Post("pos/vcomm-checkouts")
  async createCheckout(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<IposVcommCheckout> {
    return this.checkoutsService.createCheckout(await this.actor(request), iposVcommCheckoutCreateSchema.parse(body));
  }

  @Get("pos/vcomm-checkouts/:id")
  async checkout(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposVcommCheckout> {
    return this.checkoutsService.checkout(await this.actor(request), id);
  }

  @RateLimitGroup("ipos-device")
  @Post("pos/vcomm-checkouts/:id/pay-code")
  async payCode(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<IposVcommCheckout> {
    return this.checkoutsService.attachPayCode(await this.actor(request), id, iposPayCodeSchema.parse(body).code);
  }

  @Post("pos/vcomm-checkouts/:id/cancel")
  async cancelCheckout(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<IposVcommCheckout> {
    return this.checkoutsService.cancelCheckout(await this.actor(request), id);
  }
}
