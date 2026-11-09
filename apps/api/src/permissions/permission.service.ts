// Quyền của nhân viên trong một công ty (QUYTAC_NGHIEPVU_12, 13, 15).
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";

export interface CompanyMembership {
  id: string;
  code: string;
  shortName: string;
  isDefault: boolean;
}

@Injectable()
export class PermissionService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async memberships(userId: string): Promise<CompanyMembership[]> {
    const result = await this.database.execute<{ id: string; code: string; short_name: string; is_default: boolean }>(sql`
      SELECT c.id, c.code, c.short_name, m.is_default
      FROM core.user_company_memberships m
      JOIN core.companies c ON c.id = m.company_id
      WHERE m.user_id = ${userId} AND m.status = 'active' AND c.status = 'active'
      ORDER BY m.is_default DESC, c.code`);
    return result.rows.map((row) => ({ id: row.id, code: row.code, shortName: row.short_name, isDefault: row.is_default }));
  }

  // Công ty đang làm việc: header X-Company-Id nếu có, ngược lại công ty mặc định (tài liệu 17 mục 1).
  async resolveCompany(userId: string, requestedCompanyId: string | undefined): Promise<{ companyId: string | null; companies: CompanyMembership[] }> {
    const companies = await this.memberships(userId);
    if (requestedCompanyId) {
      if (!companies.some((company) => company.id === requestedCompanyId)) throw new ApiError("FORBIDDEN", "notMember");
      return { companyId: requestedCompanyId, companies };
    }
    return { companyId: companies.find((company) => company.isDefault)?.id ?? companies[0]?.id ?? null, companies };
  }

  // Một quyền có hiệu lực trong công ty C khi được gán qua phạm vi tập đoàn, công ty C, hoặc một chi nhánh của C.
  // Lọc dữ liệu theo từng chi nhánh làm ở lát L2.
  async permissionsInCompany(userId: string, companyId: string, today = new Date()): Promise<string[]> {
    const day = today.toISOString().slice(0, 10);
    const result = await this.database.execute<{ permission_code: string }>(sql`
      SELECT DISTINCT rp.permission_code
      FROM core.user_role_assignments a
      JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN core.role_permissions rp ON rp.role_id = r.id
      WHERE a.user_id = ${userId}
        AND a.valid_from <= ${day}::date
        AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)
        AND (a.scope_type = 'group' OR a.company_id = ${companyId})
      ORDER BY rp.permission_code`);
    return result.rows.map((row) => row.permission_code);
  }
}
