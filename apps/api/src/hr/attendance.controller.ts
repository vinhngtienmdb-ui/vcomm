// API_150, API_151: cài đặt chấm công, ca, lịch tuần, xếp ca, ngày lễ, công ngày, lượt chấm (CONG_VIEC_47).
// Trưởng phòng không cần quyền nhân sự nên chỉ yêu cầu là thành viên công ty; quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  assignScheduleSchema,
  attendanceCodeSchema,
  attendanceGridQuerySchema,
  attendanceSettingsSchema,
  deletePunchSchema,
  generateHolidaysSchema,
  manualPunchSchema,
  recalculateAttendanceSchema,
  rosterQuerySchema,
  saveHolidaySchema,
  saveRosterSchema,
  saveScheduleSchema,
  saveShiftSchema,
  type AttendanceDayResponse,
  type AttendanceGridResponse,
  type AttendanceImportItem,
  type AttendanceImportResponse,
  type AttendanceSettingsResponse,
  type HolidayItem,
  type HolidayListResponse,
  type RosterResponse,
  type ScheduleItem,
  type ShiftItem,
} from "contracts";
import type { Response } from "express";
import writeXlsxFile from "write-excel-file/node";
import { z } from "zod";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { AttendanceSetupService } from "./attendance-setup.service";
import { AttendanceService, importMaximumBytes, type UploadedSheet } from "./attendance.service";
import { contentDisposition } from "./hr.controller";

const isoDateParameter = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

@Controller("hr/attendance")
export class AttendanceController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly setup: AttendanceSetupService,
    private readonly attendance: AttendanceService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AttendanceSettingsResponse> {
    return this.setup.settings(await this.actor(request, companyId));
  }

  @Put("settings")
  async saveSettings(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AttendanceSettingsResponse> {
    return this.setup.saveSettings(await this.actor(request, companyId), attendanceSettingsSchema.parse(body));
  }

  @Get("shifts")
  async shifts(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ShiftItem[]> {
    return this.setup.shifts(await this.actor(request, companyId));
  }

  @Post("shifts")
  async createShift(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ShiftItem> {
    return this.setup.createShift(await this.actor(request, companyId), saveShiftSchema.parse(body));
  }

  @Patch("shifts/:id")
  async updateShift(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ShiftItem> {
    return this.setup.updateShift(await this.actor(request, companyId), id, saveShiftSchema.parse(body));
  }

  @Get("schedules")
  async schedules(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<ScheduleItem[]> {
    return this.setup.schedules(await this.actor(request, companyId));
  }

  @Post("schedules")
  async createSchedule(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ScheduleItem> {
    return this.setup.createSchedule(await this.actor(request, companyId), saveScheduleSchema.parse(body));
  }

  @Patch("schedules/:id")
  async updateSchedule(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ScheduleItem> {
    return this.setup.updateSchedule(await this.actor(request, companyId), id, saveScheduleSchema.parse(body));
  }

  @Post("schedules/:id/assignments")
  async assignSchedule(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<ScheduleItem> {
    return this.setup.assignSchedule(await this.actor(request, companyId), id, assignScheduleSchema.parse(body));
  }

  @Get("roster")
  async roster(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<RosterResponse> {
    return this.setup.roster(await this.actor(request, companyId), rosterQuerySchema.parse(query));
  }

  @Put("roster")
  async saveRoster(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<{ saved: number }> {
    return this.setup.saveRoster(await this.actor(request, companyId), saveRosterSchema.parse(body));
  }

  @Get("holidays")
  async holidays(@Req() request: AuthenticatedRequest, @Query("year") year: string | undefined, @Headers("x-company-id") companyId?: string): Promise<HolidayListResponse> {
    return this.setup.holidays(await this.actor(request, companyId), z.coerce.number().int().min(2000).max(2100).parse(year));
  }

  @Post("holidays")
  async addHoliday(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<HolidayItem> {
    return this.setup.addHoliday(await this.actor(request, companyId), saveHolidaySchema.parse(body));
  }

  @Post("holidays/generate")
  async generateHolidays(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<HolidayListResponse> {
    return this.setup.generateHolidays(await this.actor(request, companyId), generateHolidaysSchema.parse(body).year);
  }

  @Delete("holidays/:id")
  @HttpCode(204)
  async deleteHoliday(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.setup.deleteHoliday(await this.actor(request, companyId), id);
  }

  @Get("grid")
  async grid(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<AttendanceGridResponse> {
    return this.attendance.grid(await this.actor(request, companyId), attendanceGridQuerySchema.parse(query));
  }

  @Get("days/:employeeId/:date")
  async day(
    @Req() request: AuthenticatedRequest,
    @Param("employeeId", UuidPipe) employeeId: string,
    @Param("date") date: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<AttendanceDayResponse> {
    return this.attendance.day(await this.actor(request, companyId), employeeId, isoDateParameter.parse(date));
  }

  @Post("punches")
  async addPunches(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AttendanceDayResponse> {
    return this.attendance.addManualPunches(await this.actor(request, companyId), manualPunchSchema.parse(body));
  }

  @Post("punches/:id/delete")
  @HttpCode(204)
  async deletePunch(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.attendance.deletePunch(await this.actor(request, companyId), id, deletePunchSchema.parse(body).reason);
  }

  @Put("codes/:employeeId")
  async setCode(
    @Req() request: AuthenticatedRequest,
    @Param("employeeId", UuidPipe) employeeId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<{ attendanceCode: string | null }> {
    return this.attendance.setAttendanceCode(await this.actor(request, companyId), employeeId, attendanceCodeSchema.parse(body).attendanceCode ?? null);
  }

  @Post("recalculate")
  async recalculate(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<{ month: string }> {
    return this.attendance.recalculateMonth(await this.actor(request, companyId), recalculateAttendanceSchema.parse(body).month);
  }

  @Get("imports")
  async imports(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AttendanceImportItem[]> {
    return this.attendance.imports(await this.actor(request, companyId));
  }

  @Get("imports/template")
  async template(@Res() response: Response): Promise<void> {
    const header = ["Mã chấm công", "Ngày giờ", "Mã máy"].map((value) => ({ value, fontWeight: "bold" as const }));
    const buffer = await writeXlsxFile([header, ["1001", "2026-11-02 07:58", "MAY01"].map((value) => ({ value }))], { sheet: "Lượt chấm" }).toBuffer();
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", contentDisposition("mau-luot-cham-cong.xlsx"));
    response.send(buffer);
  }

  // confirm = "true" thì ghi; còn lại chỉ xem trước.
  @Post("imports")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: importMaximumBytes * 2, files: 1 } }))
  async importPunches(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedSheet | undefined,
    @Body() body: { confirm?: string },
    @Headers("x-company-id") companyId?: string,
  ): Promise<AttendanceImportResponse> {
    if (!file) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { file: "required" } });
    return this.attendance.importPunches(await this.actor(request, companyId), file, body?.confirm === "true");
  }
}
