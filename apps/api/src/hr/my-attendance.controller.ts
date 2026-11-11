// API_155 phần Chấm công của tôi, API_152 phần đơn của tôi (CONG_VIEC_47): chỉ cần là thành viên công ty đang chọn; hồ sơ liên kết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { appPunchSchema, createCorrectionSchema, type CorrectionItem, type MyAttendanceMonthResponse, type MyAttendanceResponse, type MyWeekResponse } from "contracts";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { weekdayIndex } from "./attendance-calculator";
import { MyAttendanceService, attachmentMaximumBytes, type UploadedAttachment } from "./my-attendance.service";

const monthParameter = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const mondayParameter = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => weekdayIndex(value) === 0);

@Controller("hr/me/attendance")
export class MyAttendanceController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly mine: MyAttendanceService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get()
  async today(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyAttendanceResponse> {
    return this.mine.today(await this.actor(request, companyId));
  }

  @Post("punch")
  async punch(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<MyAttendanceResponse> {
    return this.mine.punch(await this.actor(request, companyId), appPunchSchema.parse(body));
  }

  @Get("month")
  async month(@Req() request: AuthenticatedRequest, @Query("month") month: string | undefined, @Headers("x-company-id") companyId?: string): Promise<MyAttendanceMonthResponse> {
    return this.mine.month(await this.actor(request, companyId), monthParameter.parse(month));
  }

  @Get("week")
  async week(@Req() request: AuthenticatedRequest, @Query("weekStart") weekStart: string | undefined, @Headers("x-company-id") companyId?: string): Promise<MyWeekResponse> {
    return this.mine.week(await this.actor(request, companyId), mondayParameter.parse(weekStart));
  }

  @Get("corrections")
  async corrections(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CorrectionItem[]> {
    return this.mine.myCorrections(await this.actor(request, companyId));
  }

  @Post("corrections")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: attachmentMaximumBytes * 2, files: 1 } }))
  async createCorrection(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedAttachment | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<CorrectionItem> {
    return this.mine.createCorrection(await this.actor(request, companyId), createCorrectionSchema.parse(body), file);
  }

  @Post("corrections/:id/withdraw")
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<CorrectionItem> {
    return this.mine.withdrawCorrection(await this.actor(request, companyId), id);
  }
}
