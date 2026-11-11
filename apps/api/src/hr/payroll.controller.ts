// API_156 đến API_158: thiết lập lương, loại phụ cấp, hồ sơ lương của nhân viên (CONG_VIEC_48). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  saveAllowanceTypeSchema,
  saveBranchRegionsSchema,
  saveDepartmentGroupsSchema,
  saveInsuranceSalarySchema,
  savePayrollCompanySettingsSchema,
  savePayrollParametersSchema,
  savePayrollProfileSchema,
  uploadTaxCommitmentSchema,
  type AllowanceTypeItem,
  type MissingInsuranceItem,
  type PayrollProfileResponse,
  type PayrollSettingsResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { documentMaximumBytes, type UploadedFile as UploadedDocument } from "./employees.service";
import { contentDisposition } from "./hr.controller";
import { PayrollSetupService } from "./payroll-setup.service";

@Controller("hr")
export class PayrollController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly setup: PayrollSetupService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "hr.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("payroll-settings")
  async settings(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PayrollSettingsResponse> {
    return this.setup.settings(await this.actor(request, companyId));
  }

  @Post("payroll-parameters")
  async createParameters(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollSettingsResponse> {
    return this.setup.saveParameters(await this.actor(request, companyId), null, savePayrollParametersSchema.parse(body));
  }

  @Patch("payroll-parameters/:id")
  async updateParameters(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollSettingsResponse> {
    return this.setup.saveParameters(await this.actor(request, companyId), id, savePayrollParametersSchema.parse(body));
  }

  @Delete("payroll-parameters/:id")
  async deleteParameters(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PayrollSettingsResponse> {
    return this.setup.deleteParameters(await this.actor(request, companyId), id);
  }

  @Put("payroll-settings/company")
  async saveCompany(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollSettingsResponse> {
    return this.setup.saveCompany(await this.actor(request, companyId), savePayrollCompanySettingsSchema.parse(body));
  }

  @Put("payroll-settings/branches")
  async saveBranches(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollSettingsResponse> {
    return this.setup.saveBranchRegions(await this.actor(request, companyId), saveBranchRegionsSchema.parse(body));
  }

  @Put("payroll-settings/departments")
  async saveDepartments(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollSettingsResponse> {
    return this.setup.saveDepartmentGroups(await this.actor(request, companyId), saveDepartmentGroupsSchema.parse(body));
  }

  @Get("allowance-types")
  async allowanceTypes(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<AllowanceTypeItem[]> {
    return this.setup.allowanceTypes(await this.actor(request, companyId));
  }

  @Post("allowance-types")
  async createAllowanceType(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AllowanceTypeItem[]> {
    return this.setup.saveAllowanceType(await this.actor(request, companyId), null, saveAllowanceTypeSchema.parse(body));
  }

  @Patch("allowance-types/:id")
  async updateAllowanceType(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<AllowanceTypeItem[]> {
    return this.setup.saveAllowanceType(await this.actor(request, companyId), id, saveAllowanceTypeSchema.parse(body));
  }

  @Get("payroll-profiles/missing-insurance")
  async missingInsurance(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<MissingInsuranceItem[]> {
    return this.setup.missingInsurance(await this.actor(request, companyId));
  }

  @Get("employees/:id/payroll-profile")
  async profile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PayrollProfileResponse> {
    return this.setup.profile(await this.actor(request, companyId), id);
  }

  @Put("employees/:id/payroll-profile")
  async saveProfile(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollProfileResponse> {
    return this.setup.saveProfile(await this.actor(request, companyId), id, savePayrollProfileSchema.parse(body));
  }

  @Post("employees/:id/insurance-salaries")
  async saveInsuranceSalary(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollProfileResponse> {
    return this.setup.saveInsuranceSalary(await this.actor(request, companyId), id, saveInsuranceSalarySchema.parse(body));
  }

  @Delete("employees/:id/insurance-salaries/:salaryId")
  @HttpCode(200)
  async deleteInsuranceSalary(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("salaryId", UuidPipe) salaryId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollProfileResponse> {
    return this.setup.deleteInsuranceSalary(await this.actor(request, companyId), id, salaryId);
  }

  @Post("employees/:id/tax-commitments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: documentMaximumBytes * 2, files: 1 } }))
  async uploadTaxCommitment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @UploadedFile() file: UploadedDocument | undefined,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollProfileResponse> {
    return this.setup.uploadTaxCommitment(await this.actor(request, companyId), id, uploadTaxCommitmentSchema.parse(body).year, file);
  }

  @Get("employees/:id/tax-commitments/:commitmentId")
  async downloadTaxCommitment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("commitmentId", UuidPipe) commitmentId: string,
    @Res() response: Response,
    @Headers("x-company-id") companyId?: string,
  ): Promise<void> {
    const file = await this.setup.downloadTaxCommitment(await this.actor(request, companyId), id, commitmentId);
    response.setHeader("content-type", file.contentType);
    response.setHeader("content-disposition", contentDisposition(file.fileName));
    response.setHeader("x-content-type-options", "nosniff");
    response.setHeader("cache-control", "no-store");
    response.send(file.content);
  }
}
