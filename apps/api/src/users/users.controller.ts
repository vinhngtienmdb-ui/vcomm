// API_24 đến API_30, API_34.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  inviteUserSchema,
  lockUserSchema,
  roleAssignmentSchema,
  updateUserSchema,
  userImportMaximumBytes,
  userListQuerySchema,
  type InviteUserResponse,
  type PageResponse,
  type RoleAssignmentResponse,
  type UserDetailResponse,
  type UserImportResponse,
  type UserListItem,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { localeOf } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { InvitationsService } from "./invitations.service";
import { UserImportService } from "./user-import.service";
import { UsersService } from "./users.service";

type UploadedSpreadsheet = { buffer: Buffer; size: number; originalname: string };

@Controller("users")
export class UsersController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly usersService: UsersService,
    private readonly invitationsService: InvitationsService,
    private readonly userImportService: UserImportService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, permission: string): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, permission);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<UserListItem>> {
    const input = userListQuerySchema.parse(query);
    return this.usersService.list(await this.actor(request, companyId, "platform.user.view"), input);
  }

  // API_25
  @Post("invitations")
  async invite(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<InviteUserResponse> {
    const actor = await this.actor(request, companyId, "platform.user.invite");
    return this.invitationsService.invite(actor, inviteUserSchema.parse(body));
  }

  // API_28: khai báo trước ":id" để không bị hiểu là mã nhân viên.
  @Get("imports/template")
  async template(@Req() request: AuthenticatedRequest, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.actor(request, companyId, "platform.user.invite");
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", 'attachment; filename="mau_nhap_nhan_vien.xlsx"');
    response.send(await this.userImportService.template());
  }

  // API_27: tệp giữ trong bộ nhớ, không ghi ra đĩa.
  @Post("imports")
  @HttpCode(200)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: userImportMaximumBytes + 1, files: 1 } }))
  async import(@Req() request: AuthenticatedRequest, @UploadedFile() file: UploadedSpreadsheet | undefined, @Headers("x-company-id") companyId?: string): Promise<UserImportResponse> {
    const actor = await this.actor(request, companyId, "platform.user.invite");
    return this.userImportService.import(actor, file, localeOf(request));
  }

  @Get(":id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<UserDetailResponse> {
    return this.usersService.detail(await this.actor(request, companyId, "platform.user.view"), id);
  }

  // API_29 PATCH
  @Patch(":id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UserDetailResponse> {
    const actor = await this.actor(request, companyId, "platform.user.manage");
    return this.usersService.update(actor, id, updateUserSchema.parse(body));
  }

  // API_26
  @Post(":id/invitations/resend")
  @HttpCode(204)
  async resend(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<void> {
    await this.invitationsService.resend(await this.actor(request, companyId, "platform.user.invite"), id);
  }

  // API_30
  @Post(":id/lock")
  @HttpCode(200)
  async lock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UserDetailResponse> {
    const actor = await this.actor(request, companyId, "platform.user.manage");
    return this.usersService.setLocked(actor, id, true, lockUserSchema.parse(body).reason);
  }

  @Post(":id/unlock")
  @HttpCode(200)
  async unlock(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<UserDetailResponse> {
    const actor = await this.actor(request, companyId, "platform.user.manage");
    return this.usersService.setLocked(actor, id, false, lockUserSchema.parse(body).reason);
  }

  @Post(":id/role-assignments")
  async assign(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<RoleAssignmentResponse> {
    const input = roleAssignmentSchema.parse(body);
    return this.usersService.assign(await this.actor(request, companyId, "platform.role.assign"), id, input);
  }

  @Delete(":id/role-assignments/:assignmentId")
  @HttpCode(204)
  async remove(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("assignmentId", UuidPipe) assignmentId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    await this.usersService.removeAssignment(await this.actor(request, companyId, "platform.role.assign"), id, assignmentId);
  }
}
