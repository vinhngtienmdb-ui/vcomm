// API_203: ứng viên trả lời đề nghị nhận việc qua liên kết trong email, không đăng nhập (CONG_VIEC_54; QUYTAC_NGHIEPVU_386).
// Giữ giới hạn 20 yêu cầu mỗi phút mỗi IP của API công khai (THAY_DOI_23 chỉ áp dụng cho /careers).
import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { offerAnswerSchema, type OfferAnswerPageResponse } from "contracts";
import type { Request } from "express";
import { Public } from "../auth/auth.guard";
import { JobOffersService } from "./job-offers.service";

@Controller("job-offer-responses")
@Public()
export class OfferAnswersController {
  constructor(private readonly offers: JobOffersService) {}

  @Get(":token")
  async page(@Param("token") token: string): Promise<OfferAnswerPageResponse> {
    return this.offers.answerPage(token);
  }

  @Post(":token")
  @HttpCode(200)
  async answer(@Param("token") token: string, @Body() body: unknown, @Req() request: Request): Promise<OfferAnswerPageResponse> {
    const input = offerAnswerSchema.parse(body);
    return this.offers.answer(token, input.accepted, input.note, { ip: request.ip ?? null, userAgent: request.header("user-agent") ?? null });
  }
}
