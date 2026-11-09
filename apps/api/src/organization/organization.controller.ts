// API_20 đến API_23: công ty, chi nhánh, phòng ban.
import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req } from "@nestjs/common";
import {
  branchListQuerySchema,
  createBranchSchema,
  createCompanySchema,
  createDepartmentSchema,
  updateBranchSchema,
  updateCompanySchema,
  updateDepartmentSchema,
  versionSchema,
  type BranchResponse,
  type CompanyResponse,
  type DepartmentResponse,
  type PageResponse,
} from "contracts";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { BranchesService } from "./branches.service";
import { CompaniesService } from "./companies.service";
import { DepartmentsService } from "./departments.service";

@Controller()
export class OrganizationController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly companiesService: CompaniesService,
    private readonly branchesService: BranchesService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined, permission: string): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, permission);
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  private async groupActor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const actor = await this.actor(request, requestedCompanyId, "platform.company.manage");
    await this.companiesService.requireGroupAuthority(actor.userId);
    return actor;
  }

  @Get("companies")
  async companies(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<CompanyResponse[]> {
    await this.groupActor(request, companyId);
    return this.companiesService.list();
  }

  @Post("companies")
  async createCompany(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CompanyResponse> {
    const actor = await this.groupActor(request, companyId);
    return this.companiesService.create(actor, createCompanySchema.parse(body));
  }

  @Patch("companies/:id")
  async updateCompany(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CompanyResponse> {
    const actor = await this.groupActor(request, companyId);
    return this.companiesService.update(actor, id, updateCompanySchema.parse(body));
  }

  @Post("companies/:id/deactivate")
  @HttpCode(200)
  async deactivateCompany(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<CompanyResponse> {
    const actor = await this.groupActor(request, companyId);
    return this.companiesService.deactivate(actor, id, versionSchema.parse(body).version);
  }

  @Get("branches")
  async branches(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PageResponse<BranchResponse>> {
    const input = branchListQuerySchema.parse(query);
    return this.branchesService.list(await this.actor(request, companyId, "platform.branch.manage"), input);
  }

  @Post("branches")
  async createBranch(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BranchResponse> {
    const actor = await this.actor(request, companyId, "platform.branch.manage");
    return this.branchesService.create(actor, createBranchSchema.parse(body));
  }

  @Patch("branches/:id")
  async updateBranch(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BranchResponse> {
    const actor = await this.actor(request, companyId, "platform.branch.manage");
    return this.branchesService.update(actor, id, updateBranchSchema.parse(body));
  }

  @Post("branches/:id/deactivate")
  @HttpCode(200)
  async deactivateBranch(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<BranchResponse> {
    const actor = await this.actor(request, companyId, "platform.branch.manage");
    return this.branchesService.deactivate(actor, id, versionSchema.parse(body).version);
  }

  @Get("departments")
  async departments(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<DepartmentResponse[]> {
    return this.departmentsService.list(await this.actor(request, companyId, "platform.department.manage"));
  }

  @Post("departments")
  async createDepartment(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DepartmentResponse> {
    const actor = await this.actor(request, companyId, "platform.department.manage");
    return this.departmentsService.create(actor, createDepartmentSchema.parse(body));
  }

  @Patch("departments/:id")
  async updateDepartment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DepartmentResponse> {
    const actor = await this.actor(request, companyId, "platform.department.manage");
    return this.departmentsService.update(actor, id, updateDepartmentSchema.parse(body));
  }

  @Post("departments/:id/deactivate")
  @HttpCode(200)
  async deactivateDepartment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<DepartmentResponse> {
    const actor = await this.actor(request, companyId, "platform.department.manage");
    return this.departmentsService.deactivate(actor, id, versionSchema.parse(body).version);
  }
}
