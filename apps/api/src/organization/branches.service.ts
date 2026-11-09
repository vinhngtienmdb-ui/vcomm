// Quản lý chi nhánh (CHUC_NANG_02; QUYTAC_NGHIEPVU_02, 03, 12).
import { Inject, Injectable } from "@nestjs/common";
import type { BranchListQuery, BranchResponse, PageResponse } from "contracts";
import { createBranchSchema, updateBranchSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { setClause } from "../common/sql-update";
import { DATABASE, type Database } from "../database/database.module";
import { branchScopeCondition, PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { auditBase, recordEvent } from "./organization-context";

const manageBranch = "platform.branch.manage";

type BranchRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  branch_type: BranchResponse["branchType"];
  province_code: string | null;
  address: string | null;
  phone: string | null;
  status: "active" | "inactive";
  version: number;
};

const columns = { code: "code", name: "name", branchType: "branch_type", provinceCode: "province_code", address: "address", phone: "phone" };

const toResponse = (row: BranchRow): BranchResponse => ({
  id: row.id,
  companyId: row.company_id,
  code: row.code,
  name: row.name,
  branchType: row.branch_type,
  provinceCode: row.province_code,
  address: row.address,
  phone: row.phone,
  status: row.status,
  version: row.version,
});

const selectBranch = sql`SELECT id, company_id, code, name, branch_type, province_code, address, phone, status, version FROM core.branches`;

@Injectable()
export class BranchesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Danh sách chi nhánh của công ty đang chọn, lọc theo phạm vi quyền ngay trong truy vấn.
  async list(actor: Actor, query: BranchListQuery): Promise<PageResponse<BranchResponse>> {
    const scope = await this.permissionService.dataScope(actor.userId, actor.companyId, manageBranch);
    if (!scope) throw new ApiError("FORBIDDEN", "forbidden");
    const search = query.q ? `%${query.q.replace(/[\\%_]/g, (character) => `\\${character}`)}%` : null;
    const where = sql`company_id = ${actor.companyId} AND ${branchScopeCondition(scope, sql`id`)}
      ${search ? sql`AND (code ILIKE ${search} OR name ILIKE ${search} OR address ILIKE ${search})` : sql``}
      ${query.branchType ? sql`AND branch_type = ${query.branchType}` : sql``}
      ${query.provinceCode ? sql`AND province_code = ${query.provinceCode}` : sql``}
      ${query.status ? sql`AND status = ${query.status}` : sql``}`;
    const total = await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM core.branches WHERE ${where}`);
    const rows = await this.database.execute<BranchRow>(sql`${selectBranch} WHERE ${where} ORDER BY code LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(toResponse), page: query.page, pageSize: query.pageSize, total: total.rows[0]?.total ?? 0 };
  }

  // Tạo chi nhánh cần quyền ở phạm vi cả công ty đang chọn; công ty lấy từ X-Company-Id, không lấy từ dữ liệu gửi lên.
  async create(actor: Actor, input: z.output<typeof createBranchSchema>): Promise<BranchResponse> {
    if (!(await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(manageBranch)) {
      throw new ApiError("FORBIDDEN", "forbidden");
    }
    await this.requireUniqueCode(actor.companyId, input.code, null);
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.branches (company_id, code, name, branch_type, province_code, address, phone, created_by, updated_by)
        VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.branchType}, ${input.provinceCode ?? null}, ${input.address ?? null}, ${input.phone ?? null}, ${actor.userId}, ${actor.userId})
        RETURNING id`);
      const branchId = inserted.rows[0]!.id;
      await this.auditService.record({ ...auditBase(actor, "branch"), action: "branch.create", entityId: branchId, afterData: input }, transaction);
      await recordEvent(transaction, "core.branch.created", "branch", branchId, actor.companyId, { branchId, companyId: actor.companyId });
      return branchId;
    });
    return this.single(actor.companyId, id);
  }

  async update(actor: Actor, id: string, input: z.output<typeof updateBranchSchema>): Promise<BranchResponse> {
    const before = await this.editable(actor, id);
    if (input.code) await this.requireUniqueCode(actor.companyId, input.code, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.branches SET ${sql.join([...setClause(input, columns), sql`version = version + 1`, sql`updated_at = now()`, sql`updated_by = ${actor.userId}`], sql`, `)}
        WHERE id = ${id} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "branch"), action: "branch.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.single(actor.companyId, id);
  }

  async deactivate(actor: Actor, id: string, version: number): Promise<BranchResponse> {
    const before = await this.editable(actor, id);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.branches SET status = 'inactive', version = version + 1, updated_at = now(), updated_by = ${actor.userId}
        WHERE id = ${id} AND version = ${version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...auditBase(actor, "branch"), action: "branch.deactivate", entityId: id, beforeData: { status: before.status }, afterData: { status: "inactive" } }, transaction);
    });
    return this.single(actor.companyId, id);
  }

  // Chi nhánh ngoài công ty đang chọn hoặc ngoài phạm vi quyền trả 404 như không tồn tại.
  private async editable(actor: Actor, id: string): Promise<BranchResponse> {
    const branch = await this.single(actor.companyId, id);
    if (!(await this.permissionService.permissionsCovering(actor.userId, { scopeType: "branch", companyId: actor.companyId, branchId: id })).has(manageBranch)) {
      throw new ApiError("NOT_FOUND", "notFound");
    }
    return branch;
  }

  private async single(companyId: string, id: string): Promise<BranchResponse> {
    const result = await this.database.execute<BranchRow>(sql`${selectBranch} WHERE id = ${id} AND company_id = ${companyId}`);
    const row = result.rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return toResponse(row);
  }

  private async requireUniqueCode(companyId: string, code: string, selfId: string | null): Promise<void> {
    const others = selfId ? sql`AND id <> ${selfId}` : sql``;
    const result = await this.database.execute(sql`SELECT 1 FROM core.branches WHERE company_id = ${companyId} AND code = ${code} ${others}`);
    if (result.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "branchCodeExists" } });
  }
}
