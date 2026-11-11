// API_153: nghỉ phép (CONG_VIEC_47). /hr/leave cho nhân sự, trưởng phòng; /hr/me/leave cho người có hồ sơ liên kết. Quyền chi tiết kiểm trong service.
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  cancelLeaveSchema,
  leaveAdjustmentSchema,
  leaveRequestBodySchema,
  leaveRequestListQuerySchema,
  saveLeavePolicySchema,
  saveLeaveTypeSchema,
  type LeaveBalanceItem,
  type LeaveLedgerEntry,
  type LeavePreviewResponse,
  type LeaveRequestItem,
  type LeaveTypeItem,
  type MyLeaveResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { contentDisposition } from "./hr.controller";
import { LeaveService } from "./leave.service";
import { attachmentMaximumBytes, type UploadedAttachment } from "./my-attendance.service";

@Controller("hr")
export class LeaveController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly leave: LeaveService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("leave/types")
  async types(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LeaveTypeItem[]> {
    return this.leave.types(await this.actor(request, companyId));
  }

  @Post("leave/types")
  async createType(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveTypeItem> {
    return this.leave.createType(await this.actor(request, companyId), saveLeaveTypeSchema.parse(body));
  }

  @Patch("leave/types/:id")
  async updateType(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveTypeItem> {
    return this.leave.updateType(await this.actor(request, companyId), id, saveLeaveTypeSchema.parse(body));
  }

  @Get("leave/balances")
  async balances(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LeaveBalanceItem[]> {
    return this.leave.balances(await this.actor(request, companyId));
  }

  @Get("leave/balances/:employeeId")
  async ledger(@Req() request: AuthenticatedRequest, @Param("employeeId", UuidPipe) employeeId: string, @Headers("x-company-id") companyId?: string): Promise<LeaveLedgerEntry[]> {
    return this.leave.ledger(await this.actor(request, companyId), employeeId);
  }

  @Put("leave/policies/:employeeId")
  async policy(@Req() request: AuthenticatedRequest, @Param("employeeId", UuidPipe) employeeId: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveBalanceItem> {
    return this.leave.savePolicy(await this.actor(request, companyId), employeeId, saveLeavePolicySchema.parse(body));
  }

  @Post("leave/adjustments")
  async adjust(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveBalanceItem> {
    return this.leave.adjust(await this.actor(request, companyId), leaveAdjustmentSchema.parse(body));
  }

  @Get("leave/requests")
  async requests(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveRequestItem[]> {
    return this.leave.requests(await this.actor(request, companyId), leaveRequestListQuerySchema.parse(query));
  }

  @Post("leave/preview")
  async preview(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeavePreviewResponse> {
    return this.leave.preview(await this.actor(request, companyId), leaveRequestBodySchema.parse(body), false);
  }

  // Nhân sự ghi nhận nghỉ thay người lao động (có hiệu lực ngay).
  @Post("leave/requests")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: attachmentMaximumBytes * 2, files: 1 } }))
  async record(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedAttachment | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<LeaveRequestItem> {
    return this.leave.create(await this.actor(request, companyId), leaveRequestBodySchema.parse(body), file, false);
  }

  @Post("leave/requests/:id/cancel")
  async cancel(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveRequestItem> {
    return this.leave.cancel(await this.actor(request, companyId), id, cancelLeaveSchema.parse(body).reason, false);
  }

  @Get("leave/requests/:id/attachment")
  async attachment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    const file = await this.leave.attachment(await this.actor(request, companyId), id);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", contentDisposition(file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("cache-control", "no-store");
    response.send(file.content);
  }

  @Get("me/leave")
  async mine(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MyLeaveResponse> {
    return this.leave.mine(await this.actor(request, companyId));
  }

  @Get("me/leave/ledger")
  async myLedger(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<LeaveLedgerEntry[]> {
    return this.leave.myLedger(await this.actor(request, companyId));
  }

  @Post("me/leave/preview")
  async myPreview(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeavePreviewResponse> {
    return this.leave.preview(await this.actor(request, companyId), leaveRequestBodySchema.parse(body), true);
  }

  @Post("me/leave/requests")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: attachmentMaximumBytes * 2, files: 1 } }))
  async submit(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: UploadedAttachment | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<LeaveRequestItem> {
    return this.leave.create(await this.actor(request, companyId), leaveRequestBodySchema.parse(body), file, true);
  }

  @Post("me/leave/requests/:id/withdraw")
  async withdraw(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<LeaveRequestItem> {
    return this.leave.withdraw(await this.actor(request, companyId), id);
  }

  @Post("me/leave/requests/:id/cancel")
  async cancelMine(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<LeaveRequestItem> {
    return this.leave.cancel(await this.actor(request, companyId), id, cancelLeaveSchema.parse(body).reason, true);
  }
}
