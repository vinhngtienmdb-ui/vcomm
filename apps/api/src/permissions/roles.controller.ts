// API_35, API_36 (CHUC_NANG_12).
import { Body, Controller, Get, Headers, Param, Patch, Post, Put, Req } from "@nestjs/common";
import { createRoleSchema, rolePermissionsSchema, updateRoleSchema, type PermissionGroupResponse, type RoleResponse } from "contracts";
import { clientInfo } from "../auth/auth.controller";
import { UuidPipe } from "../common/uuid.pipe";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { PermissionService } from "./permission.service";
import { RolesService, type Actor } from "./roles.service";

const manageRole = "platform.role.manage";

@Controller()
export class RolesController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly rolesService: RolesService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, ...(anyOf.length ? anyOf : [manageRole]));
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("permissions")
  async permissions(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PermissionGroupResponse[]> {
    return this.rolesService.permissionGroups(await this.actor(request, companyId));
  }

  // Người có quyền gán vai trò cần danh sách vai trò để chọn ở MAN_HINH_13.
  @Get("roles")
  async list(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<RoleResponse[]> {
    return this.rolesService.list(await this.actor(request, companyId, manageRole, "platform.role.assign"));
  }

  @Post("roles")
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<RoleResponse> {
    const input = createRoleSchema.parse(body);
    return this.rolesService.create(await this.actor(request, companyId), input);
  }

  @Patch("roles/:id")
  async update(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<RoleResponse> {
    const input = updateRoleSchema.parse(body);
    return this.rolesService.update(await this.actor(request, companyId), id, input);
  }

  @Put("roles/:id/permissions")
  async setPermissions(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<RoleResponse> {
    const input = rolePermissionsSchema.parse(body);
    return this.rolesService.setPermissions(await this.actor(request, companyId), id, input);
  }
}
