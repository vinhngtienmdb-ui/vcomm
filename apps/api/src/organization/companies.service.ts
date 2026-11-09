// Quản lý công ty (CHUC_NANG_01; QUYTAC_NGHIEPVU_01 đến 04).
import { Inject, Injectable } from "@nestjs/common";
import type { CompanyResponse, CreateCompanyRequest, UpdateCompanyRequest } from "contracts";
import { createCompanySchema, updateCompanySchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { setClause } from "../common/sql-update";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { auditBase, recordEvent } from "./organization-context";

const manageCompany = "platform.company.manage";

type CompanyRow = {
  id: string;
  parent_id: string | null;
  code: string;
  legal_name: string;
  short_name: string;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  base_currency: string;
  accounting_regime: CompanyResponse["accountingRegime"];
  fiscal_year_start: number;
  status: "active" | "inactive";
  version: number;
  active_branch_count: number;
};

const columns = {
  parentId: "parent_id",
  code: "code",
  legalName: "legal_name",
  shortName: "short_name",
  taxCode: "tax_code",
  address: "address",
  phone: "phone",
  email: "email",
  baseCurrency: "base_currency",
  accountingRegime: "accounting_regime",
  fiscalYearStart: "fiscal_year_start",
};

const toResponse = (row: CompanyRow): CompanyResponse => ({
  id: row.id,
  parentId: row.parent_id,
  code: row.code,
  legalName: row.legal_name,
  shortName: row.short_name,
  taxCode: row.tax_code,
  address: row.address,
  phone: row.phone,
  email: row.email,
  baseCurrency: row.base_currency,
  accountingRegime: row.accounting_regime,
  fiscalYearStart: row.fiscal_year_start,
  status: row.status,
  version: row.version,
  activeBranchCount: row.active_branch_count,
});

@Injectable()
export class CompaniesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Chỉ quản trị tập đoàn: quyền quản lý công ty ở phạm vi tập đoàn (QUYTAC_NGHIEPVU_01).
  async requireGroupAuthority(userId: string): Promise<void> {
    if (!(await this.permissionService.permissionsCovering(userId, { scopeType: "group" })).has(manageCompany)) {
      throw new ApiError("FORBIDDEN", "forbidden");
    }
  }

  async list(): Promise<CompanyResponse[]> {
    const result = await this.database.execute<CompanyRow>(sql`${this.select()} ORDER BY c.parent_id NULLS FIRST, c.code`);
    return result.rows.map(toResponse);
  }

  async create(actor: Actor, input: z.output<typeof createCompanySchema>): Promise<CompanyResponse> {
    await this.validate(input, null);
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.companies (parent_id, code, legal_name, short_name, tax_code, address, phone, email, base_currency, accounting_regime, fiscal_year_start, created_by, updated_by)
        VALUES (${input.parentId}, ${input.code}, ${input.legalName}, ${input.shortName}, ${input.taxCode ?? null}, ${input.address ?? null}, ${input.phone ?? null},
          ${input.email ?? null}, ${input.baseCurrency}, ${input.accountingRegime}, ${input.fiscalYearStart}, ${actor.userId}, ${actor.userId})
        RETURNING id`);
      const companyId = inserted.rows[0]!.id;
      // Người tạo trở thành thành viên để chọn được công ty mới ở thanh trên cùng (CHUC_NANG_11).
      await transaction.execute(sql`
        INSERT INTO core.user_company_memberships (user_id, company_id, is_default, created_by) VALUES (${actor.userId}, ${companyId}, false, ${actor.userId})
        ON CONFLICT (user_id, company_id) DO NOTHING`);
      await this.auditService.record({ ...auditBase(actor, "company"), action: "company.create", entityId: companyId, afterData: input }, transaction);
      await recordEvent(transaction, "core.company.created", "company", companyId, companyId, { companyId });
      return companyId;
    });
    return this.single(id);
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateCompanySchema>): Promise<CompanyResponse> {
    const before = await this.single(id);
    await this.validate(input, id);
    const assignments = setClause(input, columns);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.companies SET ${sql.join([...assignments, sql`version = version + 1`, sql`updated_at = now()`, sql`updated_by = ${actor.userId}`], sql`, `)}
        WHERE id = ${id} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "company"), action: "company.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(id);
  }

  // API_21: không xóa, chỉ ngừng hoạt động; còn chi nhánh hoạt động thì từ chối (QUYTAC_NGHIEPVU_03).
  async deactivate(actor: Actor, id: string, version: number): Promise<CompanyResponse> {
    const before = await this.single(id);
    if (before.activeBranchCount > 0) throw new ApiError("BUSINESS_RULE", "companyHasActiveBranches");
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.companies SET status = 'inactive', version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND version = ${version}
          AND NOT EXISTS (SELECT 1 FROM core.branches b WHERE b.company_id = ${id} AND b.status = 'active')
        RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "company"), action: "company.deactivate", entityId: id, beforeData: { status: before.status }, afterData: { status: "inactive" } }, transaction);
    });
    return this.single(id);
  }

  private select() {
    return sql`
      SELECT c.id, c.parent_id, c.code, c.legal_name, c.short_name, c.tax_code, c.address, c.phone, c.email::text AS email, c.base_currency,
        c.accounting_regime, c.fiscal_year_start, c.status, c.version,
        (SELECT count(*)::int FROM core.branches b WHERE b.company_id = c.id AND b.status = 'active') AS active_branch_count
      FROM core.companies c`;
  }

  private async single(id: string): Promise<CompanyResponse> {
    const result = await this.database.execute<CompanyRow>(sql`${this.select()} WHERE c.id = ${id}`);
    const row = result.rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  // Mã công ty, mã số thuế duy nhất toàn tập đoàn kể cả công ty đã ngừng hoạt động; cây không tạo vòng.
  private async validate(input: Partial<CreateCompanyRequest & UpdateCompanyRequest>, selfId: string | null): Promise<void> {
    const fields: Record<string, "companyCodeExists" | "taxCodeExists" | "companyParentCycle" | "invalidValue"> = {};
    const others = selfId ? sql`AND id <> ${selfId}` : sql``;
    if (input.code && (await this.database.execute(sql`SELECT 1 FROM core.companies WHERE code = ${input.code} ${others}`)).rows.length > 0) fields.code = "companyCodeExists";
    if (input.taxCode && (await this.database.execute(sql`SELECT 1 FROM core.companies WHERE tax_code = ${input.taxCode} ${others}`)).rows.length > 0) fields.taxCode = "taxCodeExists";
    if (input.baseCurrency && (await this.database.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${input.baseCurrency}`)).rows.length === 0) fields.baseCurrency = "invalidValue";
    if (input.parentId) {
      const parent = await this.database.execute(sql`SELECT 1 FROM core.companies WHERE id = ${input.parentId} AND status = 'active'`);
      if (parent.rows.length === 0) fields.parentId = "invalidValue";
      else if (selfId) {
        const cycle = await this.database.execute(sql`
          WITH RECURSIVE subtree AS (
            SELECT id FROM core.companies WHERE id = ${selfId}
            UNION ALL SELECT c.id FROM core.companies c JOIN subtree s ON c.parent_id = s.id
          ) SELECT 1 FROM subtree WHERE id = ${input.parentId}`);
        if (cycle.rows.length > 0) fields.parentId = "companyParentCycle";
      }
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }
}
