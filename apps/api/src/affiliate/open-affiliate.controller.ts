// API điểm thưởng cho phần mềm cửa hàng liên kết, gốc /api/v1/open/affiliate (CONG_VIEC_67; API_296, API_298 đến API_300).
// Xác thực bằng khóa API phạm vi `loyalty.member` (ApiKeyGuard của CONG_VIEC_61), không cookie, không CSRF.
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import {
  openAffiliateCancelSchema,
  openAffiliateListQuerySchema,
  openAffiliateQuoteSchema,
  openAffiliateTransactionSchema,
  openTransactionCodePattern,
  type OpenAffiliateOutlet,
  type OpenAffiliateQuote,
  type OpenAffiliateTransaction,
  type PageResponse,
} from "contracts";
import type { Response } from "express";
import { OwnRateLimit, Public } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { ApiKeyGuard, RequireScope, type OpenApiRequest } from "../open-api/api-key.guard";
import { normalizeIp } from "../open-api/ip-allow-list";
import { OpenAffiliateService, type OpenCallContext } from "./open-affiliate.service";

const contextOf = (request: OpenApiRequest): OpenCallContext => ({ ip: request.ip ? normalizeIp(request.ip) : null, requestId: request.header("x-request-id") ?? null });
const transactionCode = (value: string): string => {
  if (!openTransactionCodePattern.test(value)) throw new ApiError("NOT_FOUND", "notFound");
  return value;
};

@Controller("open/affiliate")
@Public()
@OwnRateLimit()
@UseGuards(ApiKeyGuard)
@RequireScope("loyalty.member")
export class OpenAffiliateController {
  constructor(private readonly service: OpenAffiliateService) {}

  @Get("outlets")
  outlets(@Req() request: OpenApiRequest): Promise<OpenAffiliateOutlet[]> {
    return this.service.outlets(request.openApi);
  }

  @Post("quote")
  @HttpCode(200)
  quote(@Req() request: OpenApiRequest, @Body() body: unknown): Promise<OpenAffiliateQuote> {
    return this.service.quote(request.openApi, openAffiliateQuoteSchema.parse(body));
  }

  // Mã giao dịch đối tác đã có thì trả 200 với giao dịch cũ; tạo mới trả 201.
  @Post("transactions")
  async create(@Req() request: OpenApiRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<OpenAffiliateTransaction> {
    const result = await this.service.create(request.openApi, openAffiliateTransactionSchema.parse(body), contextOf(request));
    response.status(result.created ? 201 : 200);
    return result.transaction;
  }

  @Get("transactions")
  list(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenAffiliateTransaction>> {
    return this.service.list(request.openApi, openAffiliateListQuerySchema.parse(query));
  }

  @Get("transactions/:code")
  detail(@Req() request: OpenApiRequest, @Param("code") code: string): Promise<OpenAffiliateTransaction> {
    return this.service.detail(request.openApi, transactionCode(code));
  }

  @Post("transactions/:code/cancel")
  @HttpCode(200)
  cancel(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown): Promise<OpenAffiliateTransaction> {
    return this.service.cancel(request.openApi, transactionCode(code), openAffiliateCancelSchema.parse(body).reason, contextOf(request));
  }
}
