// API_156 đến API_161: thiết lập lương, loại phụ cấp, hồ sơ lương của nhân viên, bảng lương tháng (CONG_VIEC_48). Quyền chi tiết kiểm trong service.
import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  cancelPayrollSchema,
  payPayrollSchema,
  createPayrollSchema,
  payrollLineQuerySchema,
  payrollListQuerySchema,
  savePayrollAdjustmentSchema,
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
  type PayrollLineDetail,
  type PayrollListResponse,
  type PayrollResponse,
  type PayslipListItem,
  type PayslipResponse,
  type PayrollProfileResponse,
  type PayrollSettingsResponse,
} from "contracts";
import type { Response } from "express";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { ApiError } from "../common/api-error";
import { UuidPipe } from "../common/uuid.pipe";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { documentMaximumBytes, type UploadedFile as UploadedDocument } from "./employees.service";
import { contentDisposition } from "./hr.controller";
import { PayrollSetupService } from "./payroll-setup.service";
import { PayrollsService } from "./payrolls.service";

@Controller("hr")
export class PayrollController {
  constructor(
    private readonly permissionService: PermissionService,
    private readonly setup: PayrollSetupService,
    private readonly payrolls: PayrollsService,
  ) {}

  private async actor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const companyId = await this.permissionService.authorize(request.auth.userId, requestedCompanyId, "hr.access");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  // Phiếu lương của tôi: chỉ cần là thành viên công ty đang chọn (như hồ sơ của tôi, CONG_VIEC_46).
  private async memberActor(request: AuthenticatedRequest, requestedCompanyId: string | undefined): Promise<Actor> {
    const { companyId } = await this.permissionService.resolveCompany(request.auth.userId, requestedCompanyId);
    if (!companyId) throw new ApiError("FORBIDDEN", "forbidden");
    return { userId: request.auth.userId, companyId, client: clientInfo(request) };
  }

  @Get("me/payslips")
  async myPayslips(@Req() request: AuthenticatedRequest, @Headers("x-company-id") companyId?: string): Promise<PayslipListItem[]> {
    return this.payrolls.myPayslips(await this.memberActor(request, companyId));
  }

  @Get("me/payslips/:lineId")
  async myPayslip(@Req() request: AuthenticatedRequest, @Param("lineId", UuidPipe) lineId: string, @Headers("x-company-id") companyId?: string): Promise<PayslipResponse> {
    return this.payrolls.myPayslip(await this.memberActor(request, companyId), lineId);
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
  @Get("payrolls")
  async listPayrolls(@Req() request: AuthenticatedRequest, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollListResponse> {
    return this.payrolls.list(await this.actor(request, companyId), payrollListQuerySchema.parse(query));
  }

  @Post("payrolls")
  async createPayroll(@Req() request: AuthenticatedRequest, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.create(await this.actor(request, companyId), createPayrollSchema.parse(body).month);
  }

  @Get("payrolls/:id")
  async payroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Query() query: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.detail(await this.actor(request, companyId), id, payrollLineQuerySchema.parse(query));
  }

  @Get("payrolls/:id/export")
  async exportPayroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Res() response: Response, @Headers("x-company-id") companyId?: string): Promise<void> {
    const file = await this.payrolls.export(await this.actor(request, companyId), id);
    response.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("content-disposition", contentDisposition(file.fileName));
    response.setHeader("cache-control", "no-store");
    response.send(file.content);
  }

  @Get("payrolls/:id/lines/:lineId")
  async payrollLine(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("lineId", UuidPipe) lineId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollLineDetail> {
    return this.payrolls.lineDetail(await this.actor(request, companyId), id, lineId);
  }

  @Post("payrolls/:id/recalculate")
  @HttpCode(200)
  async recalculatePayroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.recalculate(await this.actor(request, companyId), id);
  }

  @Post("payrolls/:id/adjustments")
  async createAdjustment(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.saveAdjustment(await this.actor(request, companyId), id, null, savePayrollAdjustmentSchema.parse(body));
  }

  @Patch("payrolls/:id/adjustments/:adjustmentId")
  async updateAdjustment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("adjustmentId", UuidPipe) adjustmentId: string,
    @Body() body: unknown,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollResponse> {
    return this.payrolls.saveAdjustment(await this.actor(request, companyId), id, adjustmentId, savePayrollAdjustmentSchema.parse(body));
  }

  @Delete("payrolls/:id/adjustments/:adjustmentId")
  @HttpCode(200)
  async deleteAdjustment(
    @Req() request: AuthenticatedRequest,
    @Param("id", UuidPipe) id: string,
    @Param("adjustmentId", UuidPipe) adjustmentId: string,
    @Headers("x-company-id") companyId?: string,
  ): Promise<PayrollResponse> {
    return this.payrolls.deleteAdjustment(await this.actor(request, companyId), id, adjustmentId);
  }

  @Post("payrolls/:id/submit")
  @HttpCode(200)
  async submitPayroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.submit(await this.actor(request, companyId), id);
  }

  @Post("payrolls/:id/withdraw")
  @HttpCode(200)
  async withdrawPayroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.withdraw(await this.actor(request, companyId), id);
  }

  @Post("payrolls/:id/cancel")
  @HttpCode(200)
  async cancelPayroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.cancel(await this.actor(request, companyId), id, cancelPayrollSchema.parse(body).reason);
  }

  @Post("payrolls/:id/pay")
  @HttpCode(200)
  async payPayroll(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Body() body: unknown, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.pay(await this.actor(request, companyId), id, payPayrollSchema.parse(body));
  }

  @Post("payrolls/:id/send-payslips")
  @HttpCode(200)
  async sendPayslips(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string, @Headers("x-company-id") companyId?: string): Promise<PayrollResponse> {
    return this.payrolls.resendPayslips(await this.actor(request, companyId), id);
  }
}
