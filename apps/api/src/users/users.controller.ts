// API_24, API_29 (phần xem), API_34.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, Query, Req } from "@nestjs/common";
import { roleAssignmentSchema, userListQuerySchema, type PageResponse, type RoleAssignmentResponse, type UserDetailResponse, type UserListItem } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly usersService: UsersService,
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

  @Get(":id")
  async detail(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<UserDetailResponse> {
    return this.usersService.detail(await this.actor(request, companyId, "platform.user.view"), id);
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
