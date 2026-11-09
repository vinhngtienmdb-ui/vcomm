// Quyền của nhân viên theo phạm vi (QUYTAC_NGHIEPVU_12, 13, 14, 15).
import { Inject, Injectable } from "@nestjs/common";
import { sql, type SQL } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";

export interface CompanyMembership {
  id: string;
  code: string;
  shortName: string;
  isDefault: boolean;
}

// Đích của một thao tác: cả tập đoàn, một công ty, hoặc một chi nhánh của công ty.
export type ScopeTarget = { scopeType: "group" } | { scopeType: "company"; companyId: string } | { scopeType: "branch"; companyId: string; branchId: string };

// Phạm vi dữ liệu được xem trong công ty đang chọn.
export type DataScope = { kind: "company" } | { kind: "branches"; branchIds: string[] };

@Injectable()
export class PermissionService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  today(): string {
    return vietnamDate(this.clock.now());
  }

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

  // Lần gán còn hiệu lực hôm nay (giờ Việt Nam): hết hiệu lực từ ngày sau ngày kết thúc.
  private activeAssignments(userId: string): SQL {
    const day = this.today();
    return sql`
      SELECT a.scope_type, a.company_id, a.branch_id, rp.permission_code
      FROM core.user_role_assignments a
      JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
      JOIN core.role_permissions rp ON rp.role_id = r.id
      WHERE a.user_id = ${userId}
        AND a.valid_from <= ${day}::date
        AND (a.valid_to IS NULL OR a.valid_to >= ${day}::date)`;
  }

  // Quyền có hiệu lực ở bất kỳ phạm vi nào trong công ty C (tập đoàn, công ty C, chi nhánh của C).
  async permissionsInCompany(userId: string, companyId: string): Promise<string[]> {
    const result = await this.database.execute<{ permission_code: string }>(sql`
      SELECT DISTINCT permission_code FROM (${this.activeAssignments(userId)}) granted
      WHERE scope_type = 'group' OR company_id = ${companyId}
      ORDER BY permission_code`);
    return result.rows.map((row) => row.permission_code);
  }

  // Quyền bao trùm toàn bộ đích: phạm vi tập đoàn bao mọi đích; công ty C bao C và chi nhánh của C; chi nhánh B chỉ bao B.
  async permissionsCovering(userId: string, target: ScopeTarget): Promise<Set<string>> {
    const condition =
      target.scopeType === "group"
        ? sql`scope_type = 'group'`
        : target.scopeType === "company"
          ? sql`scope_type = 'group' OR (scope_type = 'company' AND company_id = ${target.companyId})`
          : sql`scope_type = 'group' OR (scope_type = 'company' AND company_id = ${target.companyId}) OR (scope_type = 'branch' AND branch_id = ${target.branchId})`;
    const result = await this.database.execute<{ permission_code: string }>(sql`
      SELECT DISTINCT permission_code FROM (${this.activeAssignments(userId)}) granted WHERE ${condition}`);
    return new Set(result.rows.map((row) => row.permission_code));
  }

  // Công ty đang chọn và kiểm tra nhân viên có ít nhất một trong các quyền trong công ty đó; không có thì 403.
  async authorize(userId: string, requestedCompanyId: string | undefined, ...anyOf: string[]): Promise<string> {
    const { companyId } = await this.resolveCompany(userId, requestedCompanyId);
    const granted = companyId ? await this.permissionsInCompany(userId, companyId) : [];
    if (!companyId || !anyOf.some((permission) => granted.includes(permission))) {
      throw new ApiError("FORBIDDEN", "forbidden");
    }
    return companyId;
  }

  // Phạm vi dữ liệu của một quyền trong công ty C; null khi không có quyền.
  async dataScope(userId: string, companyId: string, permission: string): Promise<DataScope | null> {
    const result = await this.database.execute<{ scope_type: string; branch_id: string | null }>(sql`
      SELECT DISTINCT scope_type, branch_id FROM (${this.activeAssignments(userId)}) granted
      WHERE permission_code = ${permission} AND (scope_type = 'group' OR company_id = ${companyId})`);
    if (result.rows.length === 0) return null;
    if (result.rows.some((row) => row.scope_type !== "branch")) return { kind: "company" };
    return { kind: "branches", branchIds: result.rows.map((row) => row.branch_id!) };
  }
}

// Điều kiện lọc theo chi nhánh đặt ngay trong truy vấn (tài liệu 17 mục 1).
export function branchScopeCondition(scope: DataScope, branchColumn: SQL): SQL {
  if (scope.kind === "company") return sql`TRUE`;
  return sql`${branchColumn} IN (${sql.join(
    scope.branchIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
}
