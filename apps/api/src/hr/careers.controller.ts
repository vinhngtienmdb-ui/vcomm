// API_204: trang tuyển dụng công khai, không đăng nhập (CONG_VIEC_54; QUYTAC_NGHIEPVU_382).
// Không giới hạn số yêu cầu theo IP theo quyết định của người dùng (chấp nhận rủi ro ở tài liệu 22); kích thước, loại tệp vẫn kiểm.
import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UploadedFiles, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { careersApplySchema, careersListQuerySchema, type CareersApplyResponse, type CareersListResponse, type CareersPostingResponse } from "contracts";
import type { Request } from "express";
import { resolveLocale } from "i18n";
import { NoRateLimit, Public } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { CandidatesService } from "./candidates.service";
import type { UploadedFile } from "./employees.service";
import { formData } from "./recruitment.controller";

@Controller("careers")
@Public()
@NoRateLimit()
export class CareersController {
  constructor(private readonly candidates: CandidatesService) {}

  @Get("postings")
  async list(@Query() query: unknown): Promise<CareersListResponse> {
    return this.candidates.careersList(careersListQuerySchema.parse(query));
  }

  @Get("postings/:id")
  async detail(@Param("id", UuidPipe) id: string, @Query("locale") locale: string | undefined, @Req() request: Request): Promise<CareersPostingResponse> {
    return this.candidates.careersDetail(id, resolveLocale(locale ?? request.header("accept-language")));
  }

  @Post("postings/:id/applications")
  @HttpCode(201)
  @UseInterceptors(FileFieldsInterceptor([{ name: "resume", maxCount: 1 }], { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  async apply(@Param("id", UuidPipe) id: string, @UploadedFiles() files: { resume?: UploadedFile[] } | undefined, @Body() body: unknown, @Req() request: Request): Promise<CareersApplyResponse> {
    return this.candidates.apply(id, careersApplySchema.parse(formData(body)), files?.resume?.[0], { ip: request.ip ?? null, userAgent: request.header("user-agent") ?? null });
  }
}
