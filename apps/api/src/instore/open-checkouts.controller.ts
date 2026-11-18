// API_330: Open API đơn chờ thanh toán cho phần mềm cửa hàng liên kết, gốc /api/v1/open/instore (CONG_VIEC_73 lát L7; QUYTAC_NGHIEPVU_590).
// Xác thực bằng khóa API phạm vi `instore.checkout` (ApiKeyGuard), không cookie, không CSRF.
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import {
  openInstoreCheckoutCreateSchema,
  openInstoreListQuerySchema,
  openInstorePayCodeSchema,
  openInstoreReasonSchema,
  type OpenInstoreCheckout,
  type PageResponse,
} from "contracts";
import type { Response } from "express";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { ApiKeyGuard, RequireScope, type OpenApiRequest } from "../open-api/api-key.guard";
import { normalizeIp } from "../open-api/ip-allow-list";
import { checkoutCode, OpenInstoreCheckoutsService } from "./open-checkouts.service";

@Controller("open/instore")
@Public()
@OwnRateLimit()
@UseGuards(ApiKeyGuard)
@RequireScope("instore.checkout")
export class OpenInstoreCheckoutsController {
  constructor(private readonly service: OpenInstoreCheckoutsService) {}

  // Mã đơn đã có thì trả 200 với đơn cũ; tạo mới trả 201.
  @Post("checkouts")
  async create(@Req() request: OpenApiRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<OpenInstoreCheckout> {
    const result = await this.service.create(request.openApi, openInstoreCheckoutCreateSchema.parse(body));
    response.status(result.created ? 201 : 200);
    return result.checkout;
  }

  @Get("checkouts")
  list(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenInstoreCheckout>> {
    return this.service.list(request.openApi, openInstoreListQuerySchema.parse(query));
  }

  @Get("checkouts/:code")
  detail(@Req() request: OpenApiRequest, @Param("code") code: string): Promise<OpenInstoreCheckout> {
    return this.service.detail(request.openApi, checkoutCode(code));
  }

  @Post("checkouts/:code/pay-code")
  @HttpCode(200)
  payCode(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown): Promise<OpenInstoreCheckout> {
    return this.service.payCode(request.openApi, checkoutCode(code), openInstorePayCodeSchema.parse(body).payCode);
  }

  @Post("checkouts/:code/cancel")
  @HttpCode(200)
  cancel(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown): Promise<OpenInstoreCheckout> {
    return this.service.cancel(request.openApi, checkoutCode(code), openInstoreReasonSchema.parse(body).reason);
  }

  @Post("checkouts/:code/refund")
  @HttpCode(200)
  refund(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown): Promise<OpenInstoreCheckout> {
    return this.service.refund(request.openApi, checkoutCode(code), openInstoreReasonSchema.parse(body).reason, {
      ip: request.ip ? normalizeIp(request.ip) : null,
      requestId: request.header("x-request-id") ?? null,
    });
  }
}
