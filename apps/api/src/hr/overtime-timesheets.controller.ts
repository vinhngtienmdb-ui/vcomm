// API_154 tăng ca, API_155 bảng công tháng (CONG_VIEC_47). Trưởng phòng không cần quyền nhân sự; quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  cancelOvertimeSchema,
  openConfirmationSchema,
  overtimeBodySchema,
  overtimeConsentSchema,
  overtimeListQuerySchema,
  reopenTimesheetSchema,
  timesheetDisputeSchema,
  timesheetReplySchema,
  type MyTimesheetResponse,
  type OvertimeItem,
  type OvertimePreviewResponse,
  type OvertimeTotalItem,
  type TimesheetResponse,
} from "contracts";
import type { Response } from "express";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { contentDisposition } from "./hr.controller";
import { attachmentMaximumBytes, type UploadedAttachment } from "./my-attendance.service";
import { OvertimeService } from "./overtime.service";
import { TimesheetsService } from "./timesheets.service";

const monthParameter = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

@Controller("hr")
export class OvertimeTimesheetsController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly overtime: OvertimeService,
    private readonly timesheets: TimesheetsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("overtime")
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem[]> {
    return this.overtime.list(await this.actor(request, companyId), overtimeListQuerySchema.parse(query));
  }

  @Get("overtime/totals")
  async totals(@Req() request: AuthenticatedRequest, @Query("month") month: string | undefined, @Headers("x-company-id") companyId?: string): Promise<OvertimeTotalItem[]> {
    return this.overtime.totals(await this.actor(request, companyId), monthParameter.parse(month));
  }

  @Post("overtime/preview")
  async preview(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimePreviewResponse> {
    return this.overtime.preview(await this.actor(request, companyId), overtimeBodySchema.parse(body), false);
  }

  // Trưởng phòng, nhân sự lập cho người lao động; kèm tệp văn bản đồng ý thì nhân sự ghi nhận có hiệu lực ngay.
  @Post("overtime")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: attachmentMaximumBytes * 2, files: 1 } }))
  async create(@Req() request: AuthenticatedRequest, @UploadedFile() file: UploadedAttachment | undefined, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem> {
    return this.overtime.create(await this.actor(request, companyId), overtimeBodySchema.parse(body), file, false);
  }

  @Post("overtime/:id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem> {
    return this.overtime.cancel(await this.actor(request, companyId), id, cancelOvertimeSchema.parse(body).reason);
  }

  @Get("me/overtime")
  async mine(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem[]> {
    return this.overtime.mine(await this.actor(request, companyId));
  }

  @Post("me/overtime/preview")
  async myPreview(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimePreviewResponse> {
    return this.overtime.preview(await this.actor(request, companyId), overtimeBodySchema.parse(body), true);
  }

  @Post("me/overtime")
  async submit(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem> {
    return this.overtime.create(await this.actor(request, companyId), overtimeBodySchema.parse(body), undefined, true);
  }

  @Post("me/overtime/:id/consent")
  async consent(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem> {
    return this.overtime.consent(await this.actor(request, companyId), id, overtimeConsentSchema.parse(body).agree);
  }

  @Post("me/overtime/:id/withdraw")
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem> {
    return this.overtime.withdraw(await this.actor(request, companyId), id);
  }

  @Post("me/overtime/:id/cancel")
  async cancelMine(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<OvertimeItem> {
    return this.overtime.cancel(await this.actor(request, companyId), id, cancelOvertimeSchema.parse(body).reason);
  }

  @Get("timesheets/:month")
  async timesheet(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Headers("x-company-id") companyId?: string): Promise<TimesheetResponse> {
    return this.timesheets.detail(await this.actor(request, companyId), monthParameter.parse(month));
  }

  @Post("timesheets/:month/open-confirmation")
  async openConfirmation(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<TimesheetResponse> {
    return this.timesheets.openConfirmation(await this.actor(request, companyId), monthParameter.parse(month), openConfirmationSchema.parse(body).deadline);
  }

  @Post("timesheets/:month/lines/:employeeId/reply")
  async reply(
    @Req() request: AuthenticatedRequest,
    @Param("month") month: string,
    @Param("employeeId", UuidPipe) employeeId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<TimesheetResponse> {
    return this.timesheets.reply(await this.actor(request, companyId), monthParameter.parse(month), employeeId, timesheetReplySchema.parse(body).reply);
  }

  @Post("timesheets/:month/close")
  async close(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Headers("x-company-id") companyId?: string): Promise<TimesheetResponse> {
    return this.timesheets.close(await this.actor(request, companyId), monthParameter.parse(month));
  }

  @Post("timesheets/:month/reopen")
  async reopen(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<TimesheetResponse> {
    return this.timesheets.reopen(await this.actor(request, companyId), monthParameter.parse(month), reopenTimesheetSchema.parse(body).reason);
  }

  @Get("timesheets/:month/export")
  async export(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    const parsed = monthParameter.parse(month);
    const buffer = await this.timesheets.export(await this.actor(request, companyId), parsed);
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", contentDisposition(`bang-cong-${parsed}.xlsx`));
    response.setHeader("cache-control", "no-store");
    response.send(buffer);
  }

  @Get("me/timesheets/:month")
  async myTimesheet(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Headers("x-company-id") companyId?: string): Promise<MyTimesheetResponse> {
    return this.timesheets.mine(await this.actor(request, companyId), monthParameter.parse(month));
  }

  @Post("me/timesheets/:month/confirm")
  async confirm(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Headers("x-company-id") companyId?: string): Promise<MyTimesheetResponse> {
    return this.timesheets.respond(await this.actor(request, companyId), monthParameter.parse(month), { confirm: true });
  }

  @Post("me/timesheets/:month/dispute")
  async dispute(@Req() request: AuthenticatedRequest, @Param("month") month: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<MyTimesheetResponse> {
    return this.timesheets.respond(await this.actor(request, companyId), monthParameter.parse(month), { note: timesheetDisputeSchema.parse(body).note });
  }
}
