// Thiết lập lương, loại phụ cấp, hồ sơ lương của nhân viên (CONG_VIEC_48; CHUC_NANG_168; QUYTAC_NGHIEPVU_312 đến 315; API_156 đến API_158).
import { Inject, Injectable } from "@nestjs/common";
import type {
  AllowanceTypeItem,
  MissingInsuranceItem,
  PayrollCompanySettings,
  PayrollParametersItem,
  PayrollProfileResponse,
  PayrollSettingsResponse,
  saveAllowanceTypeSchema,
  saveBranchRegionsSchema,
  saveDepartmentGroupsSchema,
  saveInsuranceSalarySchema,
  savePayrollCompanySettingsSchema,
  savePayrollParametersSchema,
  savePayrollProfileSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError, type ErrorMessageKey } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { EmployeesService, type UploadedFile } from "./employees.service";
import { hrAudit, hrPermission, positionAt, requireHrPermission } from "./hr-context";

type Executor = Pick<Database, "execute">;
type ParametersInput = z.output<typeof savePayrollParametersSchema>;
type CompanyInput = z.output<typeof savePayrollCompanySettingsSchema>;
type AllowanceTypeInput = z.output<typeof saveAllowanceTypeSchema>;
type ProfileInput = z.output<typeof savePayrollProfileSchema>;
type InsuranceSalaryInput = z.output<typeof saveInsuranceSalarySchema>;

export const payrollPermission = { view: "hr.payroll.view", manage: "hr.payroll.manage", setup: "hr.payroll.setup" } as const;

// Bỏ số 0 thừa sau dấu thập phân: "0.0800" → "0.08".
const trim = (value: string | null): string | null => (value === null ? null : value.includes(".") ? value.replace(/0+$/, "").replace(/\.$/, "") : value);

// Thiết lập công ty khi chưa lưu (QUYTAC_NGHIEPVU_313, 318).
export const defaultCompanySettings: Omit<PayrollCompanySettings, "version"> = {
  unionFeeEnabled: true,
  unionFeeRate: "0.02",
  accidentRate: "0.005",
  withholdingThreshold: "2000000",
  fallbackStandardDays: 26,
  overtimeWeekdayRate: "1.5",
  overtimeWeeklyRestRate: "2",
  overtimeHolidayRate: "3",
  nightRate: "0.3",
  nightOvertimeRate: "0.2",
};

type ParameterRow = {
  id: string;
  effective_from: string;
  base_salary: string;
  insurance_reference: string | null;
  region_one_minimum: string;
  region_two_minimum: string;
  region_three_minimum: string;
  region_four_minimum: string;
  employee_social_rate: string;
  employee_health_rate: string;
  employee_unemployment_rate: string;
  employer_retirement_rate: string;
  employer_sickness_rate: string;
  employer_health_rate: string;
  employer_unemployment_rate: string;
  social_cap_multiplier: string;
  health_cap_multiplier: string;
  unemployment_cap_multiplier: string;
  personal_deduction: string;
  dependent_deduction: string;
  flat_withholding_rate: string;
  unpaid_days_threshold: number;
  version: number;
};

@Injectable()
export class PayrollSetupService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly employees: EmployeesService,
  ) {}

  // Bộ tham số đã được bảng lương đã duyệt dùng (bảng lương có ở lát L1; trước đó không bộ nào bị khóa).
  async parametersUsed(executor: Executor, parameterId: string): Promise<boolean> {
    const exists = (await executor.execute<{ found: boolean }>(sql`SELECT to_regclass('hr.payrolls') IS NOT NULL AS found`)).rows[0]!.found;
    if (!exists) return false;
    return (await executor.execute(sql`SELECT 1 FROM hr.payrolls WHERE parameter_id = ${parameterId} AND status IN ('approved', 'paid') LIMIT 1`)).rows.length > 0;
  }

  async parameterItems(executor: Executor): Promise<PayrollParametersItem[]> {
    const today = this.permissionService.today();
    const rows = (
      await executor.execute<ParameterRow>(sql`
      SELECT id, effective_from::text, base_salary::text, insurance_reference::text, region_one_minimum::text, region_two_minimum::text, region_three_minimum::text,
        region_four_minimum::text, employee_social_rate::text, employee_health_rate::text, employee_unemployment_rate::text, employer_retirement_rate::text,
        employer_sickness_rate::text, employer_health_rate::text, employer_unemployment_rate::text, social_cap_multiplier::text, health_cap_multiplier::text,
        unemployment_cap_multiplier::text, personal_deduction::text, dependent_deduction::text, flat_withholding_rate::text, unpaid_days_threshold, version
      FROM hr.payroll_parameters ORDER BY effective_from DESC`)
    ).rows;
    const brackets = (
      await executor.execute<{ parameter_id: string; upper_bound: string | null; rate: string }>(sql`
      SELECT parameter_id, upper_bound::text, rate::text FROM hr.payroll_tax_brackets ORDER BY parameter_id, sort_order`)
    ).rows;
    const currentId = rows.find((row) => row.effective_from <= today)?.id;
    const items: PayrollParametersItem[] = [];
    for (const row of rows) {
      items.push({
        id: row.id,
        effectiveFrom: row.effective_from,
        baseSalary: trim(row.base_salary)!,
        insuranceReference: trim(row.insurance_reference),
        regionMinimums: [trim(row.region_one_minimum)!, trim(row.region_two_minimum)!, trim(row.region_three_minimum)!, trim(row.region_four_minimum)!],
        employeeSocialRate: trim(row.employee_social_rate)!,
        employeeHealthRate: trim(row.employee_health_rate)!,
        employeeUnemploymentRate: trim(row.employee_unemployment_rate)!,
        employerRetirementRate: trim(row.employer_retirement_rate)!,
        employerSicknessRate: trim(row.employer_sickness_rate)!,
        employerHealthRate: trim(row.employer_health_rate)!,
        employerUnemploymentRate: trim(row.employer_unemployment_rate)!,
        socialCapMultiplier: trim(row.social_cap_multiplier)!,
        healthCapMultiplier: trim(row.health_cap_multiplier)!,
        unemploymentCapMultiplier: trim(row.unemployment_cap_multiplier)!,
        personalDeduction: trim(row.personal_deduction)!,
        dependentDeduction: trim(row.dependent_deduction)!,
        flatWithholdingRate: trim(row.flat_withholding_rate)!,
        unpaidDaysThreshold: row.unpaid_days_threshold,
        taxBrackets: brackets.filter((bracket) => bracket.parameter_id === row.id).map((bracket) => ({ upperBound: trim(bracket.upper_bound), rate: trim(bracket.rate)! })),
        current: row.id === currentId,
        used: await this.parametersUsed(executor, row.id),
        version: row.version,
      });
    }
    return items;
  }

  async companySettings(executor: Executor, companyId: string): Promise<PayrollCompanySettings> {
    const row = (
      await executor.execute<{
        union_fee_enabled: boolean;
        union_fee_rate: string;
        accident_rate: string;
        withholding_threshold: string;
        fallback_standard_days: number;
        overtime_weekday_rate: string;
        overtime_weekly_rest_rate: string;
        overtime_holiday_rate: string;
        night_rate: string;
        night_overtime_rate: string;
        version: number;
      }>(sql`
      SELECT union_fee_enabled, union_fee_rate::text, accident_rate::text, withholding_threshold::text, fallback_standard_days, overtime_weekday_rate::text,
        overtime_weekly_rest_rate::text, overtime_holiday_rate::text, night_rate::text, night_overtime_rate::text, version
      FROM hr.payroll_company_settings WHERE company_id = ${companyId}`)
    ).rows[0];
    if (!row) return { ...defaultCompanySettings, version: 0 };
    return {
      unionFeeEnabled: row.union_fee_enabled,
      unionFeeRate: trim(row.union_fee_rate)!,
      accidentRate: trim(row.accident_rate)!,
      withholdingThreshold: trim(row.withholding_threshold)!,
      fallbackStandardDays: row.fallback_standard_days,
      overtimeWeekdayRate: trim(row.overtime_weekday_rate)!,
      overtimeWeeklyRestRate: trim(row.overtime_weekly_rest_rate)!,
      overtimeHolidayRate: trim(row.overtime_holiday_rate)!,
      nightRate: trim(row.night_rate)!,
      nightOvertimeRate: trim(row.night_overtime_rate)!,
      version: row.version,
    };
  }

  // Sửa tham số pháp luật: quyền thiết lập lương gán ở phạm vi tập đoàn (QUYTAC_NGHIEPVU_312).
  private async canEditParameters(actor: Actor): Promise<boolean> {
    return (await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" })).has(payrollPermission.setup);
  }

  async settings(actor: Actor): Promise<PayrollSettingsResponse> {
    const granted = await requireHrPermission(this.permissionService, actor, payrollPermission.setup, payrollPermission.manage, payrollPermission.view);
    const branches = (
      await this.database.execute<{ branch_id: string; code: string; name: string; region: number | null }>(sql`
      SELECT b.id AS branch_id, b.code, b.name, r.region FROM core.branches b LEFT JOIN hr.payroll_branch_regions r ON r.branch_id = b.id
      WHERE b.company_id = ${actor.companyId} AND b.status = 'active' ORDER BY b.code`)
    ).rows;
    const departments = (
      await this.database.execute<{ department_id: string; name: string; cost_group: "selling" | "admin" | null }>(sql`
      SELECT d.id AS department_id, d.name, g.cost_group FROM core.departments d LEFT JOIN hr.payroll_department_groups g ON g.department_id = d.id
      WHERE d.company_id = ${actor.companyId} AND d.status = 'active' ORDER BY d.name`)
    ).rows;
    return {
      parameters: await this.parameterItems(this.database),
      canEditParameters: await this.canEditParameters(actor),
      canEditCompany: granted.has(payrollPermission.setup),
      company: await this.companySettings(this.database, actor.companyId),
      branches: branches.map((row) => ({ branchId: row.branch_id, code: row.code, name: row.name, region: row.region })),
      departments: departments.map((row) => ({ departmentId: row.department_id, name: row.name, costGroup: row.cost_group ?? "admin" })),
    };
  }

  private validateBrackets(input: ParametersInput): void {
    const fields: Record<string, ErrorMessageKey> = {};
    const last = input.taxBrackets.length - 1;
    let previous = 0;
    for (const [index, bracket] of input.taxBrackets.entries()) {
      if (index === last) {
        if (bracket.upperBound !== null) fields[`taxBrackets.${index}.upperBound`] = "invalidValue";
      } else if (bracket.upperBound === null || Number(bracket.upperBound) <= previous) fields[`taxBrackets.${index}.upperBound`] = "invalidValue";
      else previous = Number(bracket.upperBound);
      if (Number(bracket.rate) > 1) fields[`taxBrackets.${index}.rate`] = "invalidValue";
    }
    for (const key of [
      "employeeSocialRate",
      "employeeHealthRate",
      "employeeUnemploymentRate",
      "employerRetirementRate",
      "employerSicknessRate",
      "employerHealthRate",
      "employerUnemploymentRate",
      "flatWithholdingRate",
    ] as const)
      if (Number(input[key]) > 1) fields[key] = "invalidValue";
    for (const key of ["baseSalary", "socialCapMultiplier", "healthCapMultiplier", "unemploymentCapMultiplier"] as const) if (Number(input[key]) <= 0) fields[key] = "invalidValue";
    for (const [index, minimum] of input.regionMinimums.entries()) if (Number(minimum) <= 0) fields[`regionMinimums.${index}`] = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async writeBrackets(executor: Executor, parameterId: string, input: ParametersInput): Promise<void> {
    await executor.execute(sql`DELETE FROM hr.payroll_tax_brackets WHERE parameter_id = ${parameterId}`);
    for (const [index, bracket] of input.taxBrackets.entries()) {
      await executor.execute(sql`
        INSERT INTO hr.payroll_tax_brackets (parameter_id, sort_order, upper_bound, rate) VALUES (${parameterId}, ${index + 1}, ${bracket.upperBound}::numeric, ${bracket.rate}::numeric)`);
    }
  }

  async saveParameters(actor: Actor, id: string | null, input: ParametersInput): Promise<PayrollSettingsResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup);
    if (!(await this.canEditParameters(actor))) throw new ApiError("FORBIDDEN", "forbidden");
    this.validateBrackets(input);
    await this.database.transaction(async (transaction) => {
      const duplicate = await transaction.execute(sql`SELECT 1 FROM hr.payroll_parameters WHERE effective_from = ${input.effectiveFrom}::date AND id IS DISTINCT FROM ${id}::uuid`);
      if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { effectiveFrom: "payrollParametersExists" } });
      const values = sql`${input.effectiveFrom}::date, ${input.baseSalary}::numeric, ${input.insuranceReference ?? null}::numeric, ${input.regionMinimums[0]}::numeric,
        ${input.regionMinimums[1]}::numeric, ${input.regionMinimums[2]}::numeric, ${input.regionMinimums[3]}::numeric, ${input.employeeSocialRate}::numeric,
        ${input.employeeHealthRate}::numeric, ${input.employeeUnemploymentRate}::numeric, ${input.employerRetirementRate}::numeric, ${input.employerSicknessRate}::numeric,
        ${input.employerHealthRate}::numeric, ${input.employerUnemploymentRate}::numeric, ${input.socialCapMultiplier}::numeric, ${input.healthCapMultiplier}::numeric,
        ${input.unemploymentCapMultiplier}::numeric, ${input.personalDeduction}::numeric, ${input.dependentDeduction}::numeric, ${input.flatWithholdingRate}::numeric,
        ${input.unpaidDaysThreshold}`;
      let parameterId = id;
      if (parameterId === null) {
        parameterId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.payroll_parameters (effective_from, base_salary, insurance_reference, region_one_minimum, region_two_minimum, region_three_minimum, region_four_minimum,
            employee_social_rate, employee_health_rate, employee_unemployment_rate, employer_retirement_rate, employer_sickness_rate, employer_health_rate, employer_unemployment_rate,
            social_cap_multiplier, health_cap_multiplier, unemployment_cap_multiplier, personal_deduction, dependent_deduction, flat_withholding_rate, unpaid_days_threshold,
            created_by, updated_by)
          VALUES (${values}, ${actor.userId}, ${actor.userId}) RETURNING id`)
        ).rows[0]!.id;
      } else {
        const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.payroll_parameters WHERE id = ${parameterId} FOR UPDATE`)).rows[0];
        if (!before) throw new ApiError("NOT_FOUND", "notFound");
        if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        if (await this.parametersUsed(transaction, parameterId)) throw new ApiError("BUSINESS_RULE", "payrollParametersUsed");
        await transaction.execute(sql`
          UPDATE hr.payroll_parameters SET (effective_from, base_salary, insurance_reference, region_one_minimum, region_two_minimum, region_three_minimum, region_four_minimum,
            employee_social_rate, employee_health_rate, employee_unemployment_rate, employer_retirement_rate, employer_sickness_rate, employer_health_rate, employer_unemployment_rate,
            social_cap_multiplier, health_cap_multiplier, unemployment_cap_multiplier, personal_deduction, dependent_deduction, flat_withholding_rate, unpaid_days_threshold)
            = (${values}), updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE id = ${parameterId}`);
      }
      await this.writeBrackets(transaction, parameterId, input);
      await this.auditService.record(
        { ...hrAudit(actor, "payroll_parameters"), action: id ? "payroll.parameters.update" : "payroll.parameters.create", entityId: parameterId, afterData: { ...input } },
        transaction,
      );
    });
    return this.settings(actor);
  }

  async deleteParameters(actor: Actor, id: string): Promise<PayrollSettingsResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup);
    if (!(await this.canEditParameters(actor))) throw new ApiError("FORBIDDEN", "forbidden");
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<{ effective_from: string }>(sql`SELECT effective_from::text FROM hr.payroll_parameters WHERE id = ${id} FOR UPDATE`)).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (await this.parametersUsed(transaction, id)) throw new ApiError("BUSINESS_RULE", "payrollParametersUsed");
      await transaction.execute(sql`DELETE FROM hr.payroll_parameters WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "payroll_parameters"), action: "payroll.parameters.delete", entityId: id, beforeData: before }, transaction);
    });
    return this.settings(actor);
  }

  async saveCompany(actor: Actor, input: CompanyInput): Promise<PayrollSettingsResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup);
    const fields: Record<string, ErrorMessageKey> = {};
    for (const key of ["unionFeeRate", "accidentRate"] as const) if (Number(input[key]) > 1) fields[key] = "invalidValue";
    for (const key of ["overtimeWeekdayRate", "overtimeWeeklyRestRate", "overtimeHolidayRate"] as const) if (Number(input[key]) < 1) fields[key] = "invalidValue";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.payroll_company_settings WHERE company_id = ${actor.companyId} FOR UPDATE`)).rows[0];
      if ((before?.version ?? 0) !== (input.version ?? 0)) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        INSERT INTO hr.payroll_company_settings (company_id, union_fee_enabled, union_fee_rate, accident_rate, withholding_threshold, fallback_standard_days, overtime_weekday_rate,
          overtime_weekly_rest_rate, overtime_holiday_rate, night_rate, night_overtime_rate, updated_by)
        VALUES (${actor.companyId}, ${input.unionFeeEnabled}, ${input.unionFeeRate}::numeric, ${input.accidentRate}::numeric, ${input.withholdingThreshold}::numeric,
          ${input.fallbackStandardDays}, ${input.overtimeWeekdayRate}::numeric, ${input.overtimeWeeklyRestRate}::numeric, ${input.overtimeHolidayRate}::numeric,
          ${input.nightRate}::numeric, ${input.nightOvertimeRate}::numeric, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET union_fee_enabled = EXCLUDED.union_fee_enabled, union_fee_rate = EXCLUDED.union_fee_rate, accident_rate = EXCLUDED.accident_rate,
          withholding_threshold = EXCLUDED.withholding_threshold, fallback_standard_days = EXCLUDED.fallback_standard_days, overtime_weekday_rate = EXCLUDED.overtime_weekday_rate,
          overtime_weekly_rest_rate = EXCLUDED.overtime_weekly_rest_rate, overtime_holiday_rate = EXCLUDED.overtime_holiday_rate, night_rate = EXCLUDED.night_rate,
          night_overtime_rate = EXCLUDED.night_overtime_rate, updated_by = EXCLUDED.updated_by, updated_at = now(), version = hr.payroll_company_settings.version + 1`);
      await this.auditService.record({ ...hrAudit(actor, "payroll_settings"), action: "payroll.settings.update", entityId: actor.companyId, afterData: { ...input } }, transaction);
    });
    return this.settings(actor);
  }

  async saveBranchRegions(actor: Actor, input: z.output<typeof saveBranchRegionsSchema>): Promise<PayrollSettingsResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup);
    await this.database.transaction(async (transaction) => {
      for (const [index, item] of input.items.entries()) {
        if ((await transaction.execute(sql`SELECT 1 FROM core.branches WHERE id = ${item.branchId} AND company_id = ${actor.companyId}`)).rows.length === 0)
          throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`items.${index}.branchId`]: "invalidValue" } });
        if (item.region === null) await transaction.execute(sql`DELETE FROM hr.payroll_branch_regions WHERE branch_id = ${item.branchId}`);
        else
          await transaction.execute(sql`
            INSERT INTO hr.payroll_branch_regions (branch_id, company_id, region, updated_by) VALUES (${item.branchId}, ${actor.companyId}, ${item.region}, ${actor.userId})
            ON CONFLICT (branch_id) DO UPDATE SET region = EXCLUDED.region, updated_by = EXCLUDED.updated_by, updated_at = now()`);
      }
      await this.auditService.record({ ...hrAudit(actor, "payroll_settings"), action: "payroll.branch_regions.update", entityId: actor.companyId, afterData: { ...input } }, transaction);
    });
    return this.settings(actor);
  }

  async saveDepartmentGroups(actor: Actor, input: z.output<typeof saveDepartmentGroupsSchema>): Promise<PayrollSettingsResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup);
    await this.database.transaction(async (transaction) => {
      for (const [index, item] of input.items.entries()) {
        if ((await transaction.execute(sql`SELECT 1 FROM core.departments WHERE id = ${item.departmentId} AND company_id = ${actor.companyId}`)).rows.length === 0)
          throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`items.${index}.departmentId`]: "invalidValue" } });
        await transaction.execute(sql`
          INSERT INTO hr.payroll_department_groups (department_id, company_id, cost_group, updated_by) VALUES (${item.departmentId}, ${actor.companyId}, ${item.costGroup}, ${actor.userId})
          ON CONFLICT (department_id) DO UPDATE SET cost_group = EXCLUDED.cost_group, updated_by = EXCLUDED.updated_by, updated_at = now()`);
      }
      await this.auditService.record({ ...hrAudit(actor, "payroll_settings"), action: "payroll.department_groups.update", entityId: actor.companyId, afterData: { ...input } }, transaction);
    });
    return this.settings(actor);
  }

  // Loại phụ cấp: người lập, sửa hợp đồng cũng cần xem danh mục để chọn (QUYTAC_NGHIEPVU_314).
  async allowanceTypes(actor: Actor): Promise<AllowanceTypeItem[]> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup, payrollPermission.manage, payrollPermission.view, hrPermission.contract);
    const rows = await this.database.execute<{
      id: string;
      name: string;
      tax_mode: AllowanceTypeItem["taxMode"];
      exempt_limit: string | null;
      prorated: boolean;
      overtime_base: boolean;
      status: "active" | "inactive";
      version: number;
    }>(sql`
      SELECT id, name, tax_mode, exempt_limit::text, prorated, overtime_base, status, version FROM hr.allowance_types WHERE company_id = ${actor.companyId} ORDER BY status, lower(name)`);
    return rows.rows.map((row) => ({
      id: row.id,
      name: row.name,
      taxMode: row.tax_mode,
      exemptLimit: trim(row.exempt_limit),
      prorated: row.prorated,
      overtimeBase: row.overtime_base,
      status: row.status,
      version: row.version,
    }));
  }

  async saveAllowanceType(actor: Actor, id: string | null, input: AllowanceTypeInput): Promise<AllowanceTypeItem[]> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.setup);
    const exemptLimit = input.taxMode === "exempt_up_to" ? (input.exemptLimit ?? null) : null;
    if (input.taxMode === "exempt_up_to" && (exemptLimit === null || Number(exemptLimit) <= 0))
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { exemptLimit: exemptLimit === null ? "required" : "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      const duplicate = await transaction.execute(
        sql`SELECT 1 FROM hr.allowance_types WHERE company_id = ${actor.companyId} AND lower(name) = lower(${input.name}) AND id IS DISTINCT FROM ${id}::uuid`,
      );
      if (duplicate.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { name: "allowanceTypeExists" } });
      let typeId = id;
      if (typeId === null) {
        typeId = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO hr.allowance_types (company_id, name, tax_mode, exempt_limit, prorated, overtime_base, status, created_by, updated_by)
          VALUES (${actor.companyId}, ${input.name}, ${input.taxMode}, ${exemptLimit}::numeric, ${input.prorated}, ${input.overtimeBase}, ${input.status}, ${actor.userId}, ${actor.userId})
          RETURNING id`)
        ).rows[0]!.id;
      } else {
        const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.allowance_types WHERE id = ${typeId} AND company_id = ${actor.companyId} FOR UPDATE`)).rows[0];
        if (!before) throw new ApiError("NOT_FOUND", "notFound");
        if (before.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        await transaction.execute(sql`
          UPDATE hr.allowance_types SET name = ${input.name}, tax_mode = ${input.taxMode}, exempt_limit = ${exemptLimit}::numeric, prorated = ${input.prorated},
            overtime_base = ${input.overtimeBase}, status = ${input.status}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE id = ${typeId}`);
      }
      await this.auditService.record({ ...hrAudit(actor, "allowance_type"), action: id ? "allowance_type.update" : "allowance_type.create", entityId: typeId, afterData: { ...input } }, transaction);
    });
    return this.allowanceTypes(actor);
  }

  // Hồ sơ lương của nhân viên (QUYTAC_NGHIEPVU_315). Hồ sơ phải thuộc công ty và người xem thấy được (đã nghỉ: cần quyền quản lý hồ sơ như CONG_VIEC_46).
  private async requireEmployee(executor: Executor, actor: Actor, employeeId: string): Promise<{ tax_code_last4: string | null }> {
    const row = (await executor.execute<{ tax_code_last4: string | null }>(sql`SELECT tax_code_last4 FROM hr.employees WHERE id = ${employeeId} AND company_id = ${actor.companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async profile(actor: Actor, employeeId: string): Promise<PayrollProfileResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    const employee = await this.requireEmployee(this.database, actor, employeeId);
    const profile = (
      await this.database.execute<{
        social_exempt: boolean;
        health_exempt: boolean;
        unemployment_exempt: boolean;
        exemption_reason: string | null;
        tax_method: PayrollProfileResponse["taxMethod"];
        version: number;
      }>(sql`SELECT social_exempt, health_exempt, unemployment_exempt, exemption_reason, tax_method, version FROM hr.employee_payroll_profiles WHERE employee_id = ${employeeId}`)
    ).rows[0];
    // Cảnh báo dưới lương tối thiểu vùng: chi nhánh làm việc tại tháng hiệu lực, bộ tham số hiệu lực ngày cuối tháng đó.
    const salaries = (
      await this.database.execute<{ id: string; effective_month: string; amount: string; note: string | null; created_by_name: string; created_at: string; minimum: string | null }>(sql`
      SELECT s.id, s.effective_month::text, s.amount::text, s.note, u.full_name AS created_by_name, s.created_at::text,
        (SELECT CASE r.region WHEN 1 THEN p.region_one_minimum WHEN 2 THEN p.region_two_minimum WHEN 3 THEN p.region_three_minimum ELSE p.region_four_minimum END::text
           FROM hr.payroll_branch_regions r, hr.payroll_parameters p
           WHERE r.branch_id = (SELECT position.branch_id FROM (SELECT ${positionAt(sql`s.employee_id`, sql`(s.effective_month + interval '1 month' - interval '1 day')::date`)}) position)
             AND p.effective_from <= (s.effective_month + interval '1 month' - interval '1 day')::date
           ORDER BY p.effective_from DESC LIMIT 1) AS minimum
      FROM hr.employee_insurance_salaries s JOIN core.users u ON u.id = s.created_by
      WHERE s.employee_id = ${employeeId} ORDER BY s.effective_month DESC`)
    ).rows;
    const commitments = (
      await this.database.execute<{ id: string; year: number; file_name: string; uploaded_at: string }>(sql`
      SELECT id, year, file_name, uploaded_at::text FROM hr.employee_tax_commitments WHERE employee_id = ${employeeId} ORDER BY year DESC`)
    ).rows;
    return {
      employeeId,
      socialExempt: profile?.social_exempt ?? false,
      healthExempt: profile?.health_exempt ?? false,
      unemploymentExempt: profile?.unemployment_exempt ?? false,
      exemptionReason: profile?.exemption_reason ?? null,
      taxMethod: profile?.tax_method ?? "auto",
      hasTaxCode: employee.tax_code_last4 !== null,
      insuranceSalaries: salaries.map((row) => ({
        id: row.id,
        effectiveMonth: row.effective_month,
        amount: trim(row.amount)!,
        note: row.note,
        createdByName: row.created_by_name,
        createdAt: new Date(row.created_at).toISOString(),
        belowRegionalMinimum: row.minimum !== null && Number(row.amount) < Number(row.minimum),
      })),
      taxCommitments: commitments.map((row) => ({ id: row.id, year: row.year, fileName: row.file_name, uploadedAt: new Date(row.uploaded_at).toISOString() })),
      version: profile?.version ?? null,
    };
  }

  async saveProfile(actor: Actor, employeeId: string, input: ProfileInput): Promise<PayrollProfileResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    if ((input.socialExempt || input.healthExempt || input.unemploymentExempt) && !input.exemptionReason)
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { exemptionReason: "required" } });
    await this.database.transaction(async (transaction) => {
      await this.requireEmployee(transaction, actor, employeeId);
      const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.employee_payroll_profiles WHERE employee_id = ${employeeId} FOR UPDATE`)).rows[0];
      if ((before?.version ?? 0) !== (input.version ?? 0)) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        INSERT INTO hr.employee_payroll_profiles (employee_id, company_id, social_exempt, health_exempt, unemployment_exempt, exemption_reason, tax_method, updated_by)
        VALUES (${employeeId}, ${actor.companyId}, ${input.socialExempt}, ${input.healthExempt}, ${input.unemploymentExempt}, ${input.exemptionReason}, ${input.taxMethod}, ${actor.userId})
        ON CONFLICT (employee_id) DO UPDATE SET social_exempt = EXCLUDED.social_exempt, health_exempt = EXCLUDED.health_exempt, unemployment_exempt = EXCLUDED.unemployment_exempt,
          exemption_reason = EXCLUDED.exemption_reason, tax_method = EXCLUDED.tax_method, updated_by = EXCLUDED.updated_by, updated_at = now(),
          version = hr.employee_payroll_profiles.version + 1`);
      await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.payroll_profile.update", entityId: employeeId, afterData: { ...input } }, transaction);
    });
    return this.profile(actor, employeeId);
  }

  // Khai lương đóng bảo hiểm: cùng tháng hiệu lực thì thay mức cũ. Nhật ký không ghi số tiền (dữ liệu lương nhạy cảm).
  async saveInsuranceSalary(actor: Actor, employeeId: string, input: InsuranceSalaryInput): Promise<PayrollProfileResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    if (Number(input.amount) <= 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "invalidValue" } });
    await this.database.transaction(async (transaction) => {
      await this.requireEmployee(transaction, actor, employeeId);
      await transaction.execute(sql`
        INSERT INTO hr.employee_insurance_salaries (company_id, employee_id, effective_month, amount, note, created_by)
        VALUES (${actor.companyId}, ${employeeId}, ${input.effectiveMonth}::date, ${input.amount}::numeric, ${input.note}, ${actor.userId})
        ON CONFLICT (employee_id, effective_month) DO UPDATE SET amount = EXCLUDED.amount, note = EXCLUDED.note, created_by = EXCLUDED.created_by, created_at = now()`);
      await this.auditService.record(
        { ...hrAudit(actor, "employee"), action: "employee.insurance_salary.save", entityId: employeeId, afterData: { effectiveMonth: input.effectiveMonth } },
        transaction,
      );
    });
    return this.profile(actor, employeeId);
  }

  async deleteInsuranceSalary(actor: Actor, employeeId: string, salaryId: string): Promise<PayrollProfileResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.database.transaction(async (transaction) => {
      await this.requireEmployee(transaction, actor, employeeId);
      const removed = await transaction.execute<{ effective_month: string }>(
        sql`DELETE FROM hr.employee_insurance_salaries WHERE id = ${salaryId} AND employee_id = ${employeeId} RETURNING effective_month::text`,
      );
      if (removed.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
      await this.auditService.record(
        { ...hrAudit(actor, "employee"), action: "employee.insurance_salary.delete", entityId: employeeId, beforeData: { effectiveMonth: removed.rows[0]!.effective_month } },
        transaction,
      );
    });
    return this.profile(actor, employeeId);
  }

  // Cam kết 08/CK-TNCN: cùng năm thì thay tệp cũ.
  async uploadTaxCommitment(actor: Actor, employeeId: string, year: number, file: UploadedFile | undefined): Promise<PayrollProfileResponse> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    await this.requireEmployee(this.database, actor, employeeId);
    const stored = await this.employees.storeFile(`hr/${actor.companyId}/tax-commitments/${employeeId}`, file);
    let replacedKey: string | null = null;
    await this.database
      .transaction(async (transaction) => {
        replacedKey =
          (await transaction.execute<{ storage_key: string }>(sql`DELETE FROM hr.employee_tax_commitments WHERE employee_id = ${employeeId} AND year = ${year} RETURNING storage_key`)).rows[0]
            ?.storage_key ?? null;
        await transaction.execute(sql`
          INSERT INTO hr.employee_tax_commitments (company_id, employee_id, year, file_name, content_type, size_bytes, storage_key, uploaded_by)
          VALUES (${actor.companyId}, ${employeeId}, ${year}, ${stored.fileName}, ${stored.contentType}, ${stored.size}, ${stored.storageKey}, ${actor.userId})`);
        await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.tax_commitment.upload", entityId: employeeId, afterData: { year, fileName: stored.fileName } }, transaction);
      })
      .catch(async (error: unknown) => {
        await this.storage.remove(stored.storageKey).catch(() => undefined);
        throw error;
      });
    if (replacedKey) await this.storage.remove(replacedKey).catch(() => undefined);
    return this.profile(actor, employeeId);
  }

  async downloadTaxCommitment(actor: Actor, employeeId: string, commitmentId: string): Promise<{ fileName: string; contentType: string; content: Buffer }> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    const row = (
      await this.database.execute<{ file_name: string; content_type: string; storage_key: string }>(sql`
      SELECT file_name, content_type, storage_key FROM hr.employee_tax_commitments WHERE id = ${commitmentId} AND employee_id = ${employeeId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    await this.auditService.record({ ...hrAudit(actor, "employee"), action: "employee.tax_commitment.download", entityId: employeeId, afterData: { commitmentId } });
    return { fileName: row.file_name, contentType: row.content_type, content: await this.storage.get(row.storage_key) };
  }

  // Nhân viên đang làm có hợp đồng đã ký còn hiệu lực từ hôm nay mà chưa khai lương đóng bảo hiểm (MAN_HINH_129).
  async missingInsurance(actor: Actor): Promise<MissingInsuranceItem[]> {
    await requireHrPermission(this.permissionService, actor, payrollPermission.manage);
    const today = this.permissionService.today();
    const rows = await this.database.execute<{ id: string; code: string; full_name: string; kind: MissingInsuranceItem["contractKind"]; end_date: string | null }>(sql`
      SELECT e.id, e.code, e.full_name, c.kind, c.end_date::text
      FROM hr.employees e
      LEFT JOIN LATERAL (SELECT kind, end_date FROM hr.contracts WHERE employee_id = e.id AND status = 'signed' AND (end_date IS NULL OR end_date >= ${today}::date)
        ORDER BY effective_date LIMIT 1) c ON true
      WHERE e.company_id = ${actor.companyId} AND e.status = 'active' AND c.kind IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM hr.employee_insurance_salaries s WHERE s.employee_id = e.id)
      ORDER BY e.code`);
    return rows.rows.map((row) => ({ employeeId: row.id, code: row.code, fullName: row.full_name, contractKind: row.kind, contractEndDate: row.end_date }));
  }
}
