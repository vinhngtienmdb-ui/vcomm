// API_327: mua hàng tại cửa hàng trên ứng dụng VComm (CONG_VIEC_73). Người mua chỉ xem, thao tác đơn chờ đã gắn với chính mình.
// Lát L1: mã thanh toán của thiết bị, đơn đang chờ, mở đơn từ mã QR, xem, từ chối. Lát L2: chọn điểm, thanh toán.
import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { claimInstoreCheckoutSchema, payInstoreCheckoutSchema, type BuyerInstoreCheckout, type PayCodePrefixResponse, type PayInstoreCheckoutResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { InstoreCheckoutsService } from "./checkouts.service";
import { PayCodeService } from "./pay-code.service";

@Controller("buyer/instore")
export class BuyerInstoreController {
  constructor(
    private readonly payCodes: PayCodeService,
    private readonly checkouts: InstoreCheckoutsService,
  ) {}

  // Cấp mã thanh toán của thiết bị đang giữ Smart OTP (sau kích hoạt, chuyển máy, hoặc khi ứng dụng mất mã đã lưu).
  @Post("pay-code")
  @HttpCode(200)
  async payCode(@Req() request: AuthenticatedRequest): Promise<PayCodePrefixResponse> {
    return this.payCodes.issuePrefix(request.auth.userId, clientInfo(request).deviceId ?? null);
  }

  @Get("checkouts/pending")
  async pending(@Req() request: AuthenticatedRequest): Promise<BuyerInstoreCheckout[]> {
    return this.checkouts.pending(request.auth.userId);
  }

  @Post("checkouts/claim")
  @HttpCode(200)
  async claim(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BuyerInstoreCheckout> {
    return this.checkouts.claim(request.auth.userId, claimInstoreCheckoutSchema.parse(body).token);
  }

  @Get("checkouts/:id")
  async get(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerInstoreCheckout> {
    return this.checkouts.getForBuyer(request.auth.userId, id);
  }

  @Post("checkouts/:id/pay")
  @HttpCode(200)
  async pay(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown): Promise<PayInstoreCheckoutResponse> {
    return this.checkouts.pay(request.auth.userId, id, payInstoreCheckoutSchema.parse(body), clientInfo(request));
  }

  @Post("checkouts/:id/decline")
  @HttpCode(200)
  async decline(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<BuyerInstoreCheckout> {
    return this.checkouts.decline(request.auth.userId, id);
  }
}
