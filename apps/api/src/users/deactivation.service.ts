// Bàn giao, vô hiệu hóa nhân viên và đặt lại xác thực hai lớp (CHUC_NANG_19, CHUC_NANG_09; luồng 6 tài liệu 09; API_31 đến API_33).
import { Inject, Injectable } from "@nestjs/common";
import type { DeactivateUserResponse, HandoverResponse, deactivateUserSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase, recordEvent } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { UsersService } from "./users.service";

type Executor = Pick<Database, "execute" | "insert">;

@Injectable()
export class DeactivationService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
  ) {}

  // API_31: việc đang chờ nhân viên trong công ty đang chọn.
  async handover(actor: Actor, userId: string, executor: Pick<Database, "execute"> = this.database): Promise<HandoverResponse> {
    await this.usersService.requireVisible(actor, userId);
    const steps = await executor.execute<{
      id: string;
      request_id: string;
      document_no: string;
      name_vi: string;
      name_en: string;
      level_no: number;
      requested_by: string;
    }>(sql`
      SELECT s.id, q.id AS request_id, q.document_no, t.name_vi, t.name_en, s.level_no, q.requested_by
      FROM core.approval_steps s
      JOIN core.approval_requests q ON q.id = s.request_id
      JOIN core.document_types t ON t.code = q.document_type_code
      WHERE s.assigned_user_id = ${userId} AND s.decision IS NULL AND q.status = 'pending' AND q.company_id = ${actor.companyId}
      ORDER BY q.requested_at, s.level_no`);
    const departments = await executor.execute<{
      id: string;
      code: string;
      name: string;
    }>(sql`
      SELECT id, code, name FROM core.departments WHERE company_id = ${actor.companyId} AND manager_user_id = ${userId} AND status = 'active' ORDER BY code`);
    return {
      pendingApprovalSteps: steps.rows.map((row) => ({
        id: row.id,
        requestId: row.request_id,
        documentNo: row.document_no,
        documentTypeNameVi: row.name_vi,
        documentTypeNameEn: row.name_en,
        levelNo: row.level_no,
        requestedById: row.requested_by,
      })),
      managedDepartments: departments.rows,
    };
  }

  // API_32: chuyển việc, gỡ khỏi công ty đang chọn; gỡ khỏi công ty cuối cùng thì tài khoản "Đã vô hiệu hóa" và mọi phiên hết hiệu lực.
  async deactivate(actor: Actor, userId: string, input: z.output<typeof deactivateUserSchema>): Promise<DeactivateUserResponse> {
    await this.usersService.requireVisible(actor, userId);
    if (userId === actor.userId) throw new ApiError("FORBIDDEN", "cannotLockSelf");
    return this.database.transaction(async (transaction) => {
      const user = (await transaction.execute<{ status: DeactivateUserResponse["status"] }>(sql`SELECT status FROM core.users WHERE id = ${userId} FOR UPDATE`)).rows[0]!;
      if (user.status !== "active" && user.status !== "locked") throw new ApiError("BUSINESS_RULE", "userNotActive");
      const pending = await this.handover(actor, userId, transaction);
      const fields: Record<string, "invalidValue" | "handoverRecipientInvalid"> = {};
      const recipientOf = (kind: string, itemId: string) => input.handover.find((item) => item.kind === kind && item.itemId === itemId)?.toUserId;
      input.handover.forEach((item, index) => {
        const known =
          item.kind === "approval_step" ? pending.pendingApprovalSteps.some((step) => step.id === item.itemId) : pending.managedDepartments.some((department) => department.id === item.itemId);
        if (!known) fields[`handover.${index}.itemId`] = "invalidValue";
      });
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      // QUYTAC_NGHIEPVU_27: mọi việc phải có người nhận.
      const missing = [
        ...pending.pendingApprovalSteps.map((step) => recipientOf("approval_step", step.id)),
        ...pending.managedDepartments.map((department) => recipientOf("department_manager", department.id)),
      ].some((recipient) => !recipient);
      if (missing) throw new ApiError("BUSINESS_RULE", "handoverRequired");
      for (const [index, item] of input.handover.entries()) {
        const step = pending.pendingApprovalSteps.find((candidate) => candidate.id === item.itemId);
        // Người nhận: đang hoạt động trong công ty, khác người nghỉ, không phải người lập chứng từ (QUYTAC_NGHIEPVU_20).
        if (item.toUserId === userId || (step && step.requestedById === item.toUserId) || !(await this.activeMember(transaction, actor.companyId, item.toUserId))) {
          fields[`handover.${index}.toUserId`] = "handoverRecipientInvalid";
        }
      }
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });

      for (const item of input.handover) {
        if (item.kind === "approval_step") {
          const moved = await transaction.execute<{
            request_id: string;
            started_at: Date | null;
            document_no: string;
          }>(sql`
            UPDATE core.approval_steps s SET assigned_user_id = ${item.toUserId}
            FROM core.approval_requests q WHERE s.id = ${item.itemId} AND q.id = s.request_id
            RETURNING s.request_id, s.started_at, q.document_no`);
          const row = moved.rows[0]!;
          if (row.started_at) {
            await notify(transaction, [
              {
                userId: item.toUserId,
                companyId: actor.companyId,
                kind: "approval.assigned",
                title: `Chứng từ ${row.document_no} chờ bạn duyệt`,
                link: `/hop-duyet/${row.request_id}`,
                payload: { documentNo: row.document_no, handover: true },
              },
            ]);
          }
        } else {
          await transaction.execute(sql`
            UPDATE core.departments SET manager_user_id = ${item.toUserId}, version = version + 1, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${item.itemId}`);
        }
      }

      const membership = (
        await transaction.execute<{ is_default: boolean }>(sql`
        SELECT is_default FROM core.user_company_memberships WHERE user_id = ${userId} AND company_id = ${actor.companyId}`)
      ).rows[0]!;
      await transaction.execute(sql`
        UPDATE core.user_company_memberships SET status = 'inactive', is_default = false, updated_at = now(), updated_by = ${actor.userId}
        WHERE user_id = ${userId} AND company_id = ${actor.companyId}`);
      await this.endAssignments(transaction, userId, sql`company_id = ${actor.companyId}`);
      const remaining = (
        await transaction.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM core.user_company_memberships WHERE user_id = ${userId} AND status = 'active'`)
      ).rows[0]!.total;
      if (remaining > 0 && membership.is_default) {
        await transaction.execute(sql`
          UPDATE core.user_company_memberships SET is_default = true
          WHERE id = (SELECT id FROM core.user_company_memberships WHERE user_id = ${userId} AND status = 'active' ORDER BY created_at LIMIT 1)`);
      }
      let status: DeactivateUserResponse["status"] = user.status;
      if (remaining === 0) {
        status = "disabled";
        await transaction.execute(sql`UPDATE core.users SET status = 'disabled', version = version + 1, updated_at = now(), updated_by = ${actor.userId} WHERE id = ${userId}`);
        await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`);
        await this.endAssignments(transaction, userId, sql`scope_type = 'group'`);
      }
      await this.auditService.record(
        {
          ...auditBase(actor, "user"),
          action: "user.deactivate",
          entityId: userId,
          beforeData: { status: user.status, ...pending },
          afterData: {
            status,
            reason: input.reason,
            handover: input.handover,
            remainingCompanies: remaining,
          },
        },
        transaction,
      );
      await recordEvent(transaction, "core.user.disabled", "user", userId, actor.companyId, { userId, companyId: actor.companyId });
      return { id: userId, status, remainingCompanies: remaining };
    });
  }

  // API_33: xóa khóa TOTP và mã dự phòng; nhân viên thiết lập lại ở lần đăng nhập sau.
  async resetMfa(actor: Actor, userId: string): Promise<void> {
    await this.usersService.requireVisible(actor, userId);
    if (userId === actor.userId) throw new ApiError("FORBIDDEN", "forbidden");
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute(sql`DELETE FROM core.mfa_factors WHERE user_id = ${userId} RETURNING id`);
      if (removed.rows.length === 0) throw new ApiError("BUSINESS_RULE", "mfaNotEnabled");
      await transaction.execute(sql`DELETE FROM core.mfa_backup_codes WHERE user_id = ${userId}`);
      await transaction.execute(sql`UPDATE core.sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`);
      await this.auditService.record(
        {
          ...auditBase(actor, "user"),
          action: "user.mfa.reset",
          entityId: userId,
        },
        transaction,
      );
    });
  }

  private async activeMember(executor: Pick<Database, "execute">, companyId: string, userId: string): Promise<boolean> {
    const result = await executor.execute(sql`
      SELECT 1 FROM core.user_company_memberships m JOIN core.users u ON u.id = m.user_id
      WHERE m.user_id = ${userId} AND m.company_id = ${companyId} AND m.status = 'active' AND u.status = 'active'`);
    return result.rows.length > 0;
  }

  // Kết thúc vai trò: lần gán đã bắt đầu thì hết hiệu lực từ hôm qua; lần gán bắt đầu từ hôm nay trở đi thì xóa.
  private async endAssignments(transaction: Executor, userId: string, scope: ReturnType<typeof sql>): Promise<void> {
    const today = this.permissionService.today();
    const ended = await transaction.execute<{
      id: string;
      company_id: string | null;
    }>(sql`
      UPDATE core.user_role_assignments SET valid_to = ${today}::date - 1
      WHERE user_id = ${userId} AND ${scope} AND valid_from < ${today}::date AND (valid_to IS NULL OR valid_to >= ${today}::date)
      RETURNING id, company_id`);
    const removed = await transaction.execute<{
      id: string;
      company_id: string | null;
    }>(sql`
      DELETE FROM core.user_role_assignments WHERE user_id = ${userId} AND ${scope} AND valid_from >= ${today}::date RETURNING id, company_id`);
    for (const row of [...ended.rows, ...removed.rows]) {
      await recordEvent(transaction, "core.role_assignment.changed", "role_assignment", row.id, row.company_id, { userId, companyId: row.company_id });
    }
  }
}
