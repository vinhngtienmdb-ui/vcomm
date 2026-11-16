// API_308 (CONG_VIEC_65): đối tác liên minh tặng điểm VComm qua Open API, gốc /api/v1/open/loyalty-partner; khóa API phạm vi `loyalty.partner` (QUYTAC_NGHIEPVU_545).
import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { openPartnerGiftCancelSchema, openPartnerGiftListQuerySchema, openPartnerGiftSchema, partnerTransactionCodePattern, type OpenPartnerGift, type PageResponse } from "contracts";
import type { Response } from "express";
import { OwnRateLimit, Public } from "../../auth/auth.guard";
import { ApiError } from "../../common/api-error";
import { ApiKeyGuard, RequireScope, type OpenApiRequest } from "../../open-api/api-key.guard";
import { PartnerGiftsService } from "./gifts.service";

const giftCode = (value: string): string => {
  if (!partnerTransactionCodePattern.test(value)) throw new ApiError("NOT_FOUND", "notFound");
  return value;
};

@Controller("open/loyalty-partner")
@Public()
@OwnRateLimit()
@UseGuards(ApiKeyGuard)
export class OpenPartnerGiftsController {
  constructor(private readonly gifts: PartnerGiftsService) {}

  // Mã giao dịch đối tác đã có thì trả 200 với giao dịch cũ; tạo mới trả 201.
  @Post("gifts")
  @RequireScope("loyalty.partner")
  async create(@Req() request: OpenApiRequest, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<OpenPartnerGift> {
    const result = await this.gifts.create(request.openApi, openPartnerGiftSchema.parse(body));
    response.status(result.created ? 201 : 200);
    return result.gift;
  }

  @Get("gifts")
  @RequireScope("loyalty.partner")
  list(@Req() request: OpenApiRequest, @Query() query: unknown): Promise<PageResponse<OpenPartnerGift>> {
    return this.gifts.openList(request.openApi, openPartnerGiftListQuerySchema.parse(query));
  }

  @Get("gifts/:code")
  @RequireScope("loyalty.partner")
  get(@Req() request: OpenApiRequest, @Param("code") code: string): Promise<OpenPartnerGift> {
    return this.gifts.get(request.openApi, giftCode(code));
  }

  @Post("gifts/:code/cancel")
  @RequireScope("loyalty.partner")
  cancel(@Req() request: OpenApiRequest, @Param("code") code: string, @Body() body: unknown, @Res({ passthrough: true }) response: Response): Promise<OpenPartnerGift> {
    response.status(200);
    return this.gifts.cancel(request.openApi, giftCode(code), openPartnerGiftCancelSchema.parse(body).reason);
  }
}
