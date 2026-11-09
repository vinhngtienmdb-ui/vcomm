// Chính sách duyệt theo hạn mức (CHUC_NANG_15; QUYTAC_NGHIEPVU_17, 20, 21).
import { Inject, Injectable } from "@nestjs/common";
import type { ApprovalPolicyResponse, ApproverView, DocumentTypeResponse } from "contracts";
import { createApprovalPolicySchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

const managePolicy = "platform.approval_policy.manage";

type LevelRow = {
  policy_id: string;
  level_no: number;
  min_amount: string;
  approver_type: ApproverView["type"];
  approver_role_id: string | null;
  approver_role_name: string | null;
  approver_user_id: string | null;
  approver_user_name: string | null;
  substitute_type: "role" | "user";
  substitute_role_id: string | null;
  substitute_role_name: string | null;
  substitute_user_id: string | null;
  substitute_user_name: string | null;
  due_hours: number;
};

// Bỏ số 0 thừa sau dấu thập phân để hiển thị gọn: 50000000.0000 → 50000000.
export const trimAmount = (value: string) => (value.includes(".") ? value.replace(/\.?0+$/, "") : value);

@Injectable()
export class ApprovalPoliciesService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  async documentTypes(): Promise<DocumentTypeResponse[]> {
    const rows = await this.database.execute<{ code: string; app_code: string; name_vi: string; name_en: string }>(sql`
      SELECT code, app_code, name_vi, name_en FROM core.document_types WHERE requires_approval ORDER BY app_code, code`);
    return rows.rows.map((row) => ({ code: row.code, appCode: row.app_code, nameVi: row.name_vi, nameEn: row.name_en }));
  }

  // Chính sách đang hiệu lực và lịch sử của công ty đang chọn.
  async list(actor: Actor): Promise<ApprovalPolicyResponse[]> {
    const today = this.permissionService.today();
    const policies = await this.database.execute<{ id: string; document_type_code: string; name_vi: string; name_en: string; currency: string; effective_from: string; effective_to: string | null }>(sql`
      SELECT p.id, p.document_type_code, t.name_vi, t.name_en, p.currency,
        to_char(p.effective_from, 'YYYY-MM-DD') AS effective_from, to_char(p.effective_to, 'YYYY-MM-DD') AS effective_to
      FROM core.approval_policies p JOIN core.document_types t ON t.code = p.document_type_code
      WHERE p.company_id = ${actor.companyId}
      ORDER BY p.document_type_code, p.effective_from DESC`);
    if (policies.rows.length === 0) return [];
    const levels = await this.levels(policies.rows.map((row) => row.id));
    return policies.rows.map((row) => ({
      id: row.id,
      documentTypeCode: row.document_type_code,
      documentTypeNameVi: row.name_vi,
      documentTypeNameEn: row.name_en,
      currency: row.currency,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      active: row.effective_from <= today && (row.effective_to === null || row.effective_to >= today),
      levels: levels
        .filter((level) => level.policy_id === row.id)
        .map((level) => ({
          levelNo: level.level_no,
          minAmount: trimAmount(level.min_amount),
          approver: { type: level.approver_type, roleId: level.approver_role_id, userId: level.approver_user_id, name: level.approver_role_name ?? level.approver_user_name },
          substitute: { type: level.substitute_type, roleId: level.substitute_role_id, userId: level.substitute_user_id, name: level.substitute_role_name ?? level.substitute_user_name },
          dueHours: level.due_hours,
        })),
    }));
  }

  // Chính sách mới có hiệu lực từ ngày chọn; chính sách cũ kết thúc ngày trước đó (CHUC_NANG_15).
  async create(actor: Actor, input: z.output<typeof createApprovalPolicySchema>): Promise<ApprovalPolicyResponse> {
    if (!(await this.permissionService.permissionsCovering(actor.userId, { scopeType: "company", companyId: actor.companyId })).has(managePolicy)) {
      throw new ApiError("FORBIDDEN", "forbidden");
    }
    const levels = [...input.levels].sort((first, second) => first.levelNo - second.levelNo);
    if (levels.some((level, index) => level.levelNo !== index + 1)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { levels: "levelNumbersInvalid" } });
    for (const [index, level] of levels.entries()) {
      if (!level.substitute) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`levels.${index}.substitute`]: "substituteRequired" } });
      if (index > 0 && compareDecimal(level.minAmount, levels[index - 1]!.minAmount) <= 0) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`levels.${index}.minAmount`]: "levelAmountsNotIncreasing" } });
      }
    }
    const type = await this.database.execute(sql`SELECT 1 FROM core.document_types WHERE code = ${input.documentTypeCode} AND requires_approval`);
    if (type.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { documentTypeCode: "documentTypeNotFound" } });
    if ((await this.database.execute(sql`SELECT 1 FROM core.currencies WHERE code = ${input.currency}`)).rows.length === 0) {
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "invalidValue" } });
    }
    for (const [index, level] of levels.entries()) {
      for (const [field, choice] of [["approver", level.approver], ["substitute", level.substitute!]] as const) {
        if (!(await this.choiceExists(actor.companyId, choice))) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`levels.${index}.${field}`]: "approverNotFound" } });
      }
    }
    const later = await this.database.execute(sql`
      SELECT 1 FROM core.approval_policies WHERE company_id = ${actor.companyId} AND document_type_code = ${input.documentTypeCode} AND effective_from >= ${input.effectiveFrom}::date`);
    if (later.rows.length > 0) throw new ApiError("BUSINESS_RULE", "policyOverlap");

    const policyId = await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`
        UPDATE core.approval_policies SET effective_to = ${input.effectiveFrom}::date - 1
        WHERE company_id = ${actor.companyId} AND document_type_code = ${input.documentTypeCode}
          AND (effective_to IS NULL OR effective_to >= ${input.effectiveFrom}::date)`);
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO core.approval_policies (company_id, document_type_code, currency, effective_from, created_by)
        VALUES (${actor.companyId}, ${input.documentTypeCode}, ${input.currency}, ${input.effectiveFrom}::date, ${actor.userId}) RETURNING id`);
      const id = inserted.rows[0]!.id;
      for (const level of levels) {
        const approver = level.approver;
        const substitute = level.substitute!;
        await transaction.execute(sql`
          INSERT INTO core.approval_policy_levels (policy_id, level_no, min_amount, approver_type, approver_role_id, approver_user_id, substitute_type, substitute_role_id, substitute_user_id, due_hours)
          VALUES (${id}, ${level.levelNo}, ${level.minAmount}::numeric, ${approver.type}, ${approver.type === "role" ? approver.roleId : null}, ${approver.type === "user" ? approver.userId : null},
            ${substitute.type}, ${substitute.type === "role" ? substitute.roleId : null}, ${substitute.type === "user" ? substitute.userId : null}, ${level.dueHours})`);
      }
      await this.auditService.record({ ...auditBase(actor, "approval_policy"), action: "approval_policy.create", entityId: id, afterData: input }, transaction);
      return id;
    });
    return (await this.list(actor)).find((policy) => policy.id === policyId)!;
  }

  private async choiceExists(companyId: string, choice: { type: string; roleId?: string; userId?: string }): Promise<boolean> {
    if (choice.type === "department_manager") return true;
    if (choice.type === "role") {
      return (await this.database.execute(sql`SELECT 1 FROM core.roles WHERE id = ${choice.roleId!} AND status = 'active' AND (company_id IS NULL OR company_id = ${companyId})`)).rows.length > 0;
    }
    return (await this.database.execute(sql`SELECT 1 FROM core.user_company_memberships WHERE user_id = ${choice.userId!} AND company_id = ${companyId} AND status = 'active'`)).rows.length > 0;
  }

  private async levels(policyIds: string[]): Promise<LevelRow[]> {
    const result = await this.database.execute<LevelRow>(sql`
      SELECT l.policy_id, l.level_no, l.min_amount::text AS min_amount, l.approver_type, l.approver_role_id, ar.name_vi AS approver_role_name,
        l.approver_user_id, au.full_name AS approver_user_name, l.substitute_type, l.substitute_role_id, sr.name_vi AS substitute_role_name,
        l.substitute_user_id, su.full_name AS substitute_user_name, l.due_hours
      FROM core.approval_policy_levels l
      LEFT JOIN core.roles ar ON ar.id = l.approver_role_id LEFT JOIN core.users au ON au.id = l.approver_user_id
      LEFT JOIN core.roles sr ON sr.id = l.substitute_role_id LEFT JOIN core.users su ON su.id = l.substitute_user_id
      WHERE l.policy_id IN (${sql.join(policyIds.map((id) => sql`${id}::uuid`), sql`, `)})
      ORDER BY l.level_no`);
    return result.rows;
  }
}

// So sánh hai số thập phân dạng chuỗi không qua số thực.
export function compareDecimal(left: string, right: string): number {
  const [leftWhole = "0", leftFraction = ""] = left.split(".");
  const [rightWhole = "0", rightFraction = ""] = right.split(".");
  const width = Math.max(leftFraction.length, rightFraction.length);
  const a = BigInt(leftWhole + leftFraction.padEnd(width, "0"));
  const b = BigInt(rightWhole + rightFraction.padEnd(width, "0"));
  return a === b ? 0 : a < b ? -1 : 1;
}
