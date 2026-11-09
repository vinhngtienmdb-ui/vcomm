// Mời nhân viên, gửi lại đường dẫn kích hoạt (CHUC_NANG_04; QUYTAC_NGHIEPVU_05, 06; luồng 1 tài liệu 09).
import { Inject, Injectable } from "@nestjs/common";
import type { InviteUserResponse } from "contracts";
import { inviteUserSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { newRandomToken, hashToken } from "../auth/tokens";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { OUTBOUND_MESSAGES, webOrigin, type OutboundMessages } from "../common/outbound-messages";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase, recordEvent } from "../organization/organization-context";
import type { Actor } from "../permissions/roles.service";
import { UsersService, type PreparedAssignment } from "./users.service";

export const activationHours = 72;

type InviteInput = z.output<typeof inviteUserSchema>;
type FieldError = "identifierRequired" | "emailUsed" | "phoneUsed" | "usernameUsed" | "alreadyMember" | "invalidValue";
type Executor = Pick<Database, "execute" | "insert">;

@Injectable()
export class InvitationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(OUTBOUND_MESSAGES) private readonly messages: OutboundMessages,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  // API_25. Nhân viên đã có tài khoản ở công ty khác thì chỉ thêm vào công ty này (CHUC_NANG_04).
  async invite(actor: Actor, input: InviteInput): Promise<InviteUserResponse> {
    const fields: Record<string, FieldError> = {};
    if (!input.email && !input.phone && !input.username) fields.email = "identifierRequired";
    const owners = new Map<string, string>();
    for (const [field, column] of [["email", "email"], ["phone", "phone"], ["username", "username"]] as const) {
      const value = input[field];
      if (!value) continue;
      const found = await this.database.execute<{ id: string }>(sql`SELECT id FROM core.users WHERE ${sql.raw(column)} = ${value}`);
      if (found.rows[0]) owners.set(field, found.rows[0].id);
    }
    // Tài khoản có sẵn xác định theo định danh ưu tiên đầu tiên được nhập (email, rồi số điện thoại, rồi tên đăng nhập).
    // Định danh còn lại thuộc người khác thì báo trùng.
    const primary = input.email ? "email" : input.phone ? "phone" : "username";
    const existingId = owners.get(primary) ?? null;
    for (const [field, ownerId] of owners) {
      if (ownerId !== existingId) fields[field] = `${field}Used` as FieldError;
    }
    if (existingId) {
      const member = await this.database.execute(sql`
        SELECT 1 FROM core.user_company_memberships WHERE user_id = ${existingId} AND company_id = ${actor.companyId} AND status = 'active'`);
      if (member.rows.length > 0) fields[owners.has("email") ? "email" : owners.has("phone") ? "phone" : "username"] = "alreadyMember";
    }
    if (input.defaultBranchId && (await this.database.execute(sql`SELECT 1 FROM core.branches WHERE id = ${input.defaultBranchId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0) {
      fields.defaultBranchId = "invalidValue";
    }
    if (input.departmentId && (await this.database.execute(sql`SELECT 1 FROM core.departments WHERE id = ${input.departmentId} AND company_id = ${actor.companyId} AND status = 'active'`)).rows.length === 0) {
      fields.departmentId = "invalidValue";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const prepared: PreparedAssignment[] = [];
    for (const assignment of input.roleAssignments) prepared.push(await this.usersService.prepareAssignment(actor, assignment));

    const result = await this.database.transaction(async (transaction) => {
      let userId = existingId;
      if (!userId) {
        const created = await transaction.execute<{ id: string }>(sql`
          INSERT INTO core.users (email, phone, username, full_name, status, created_by, updated_by)
          VALUES (${input.email ?? null}, ${input.phone ?? null}, ${input.username ?? null}, ${input.fullName}, 'invited', ${actor.userId}, ${actor.userId})
          RETURNING id`);
        userId = created.rows[0]!.id;
        await recordEvent(transaction, "core.user.created", "user", userId, actor.companyId, { userId, companyId: actor.companyId });
      }
      const hasDefault = await transaction.execute(sql`SELECT 1 FROM core.user_company_memberships WHERE user_id = ${userId} AND status = 'active' AND is_default`);
      await transaction.execute(sql`
        INSERT INTO core.user_company_memberships (user_id, company_id, default_branch_id, department_id, job_title, is_default, created_by, updated_by)
        VALUES (${userId}, ${actor.companyId}, ${input.defaultBranchId ?? null}, ${input.departmentId ?? null}, ${input.jobTitle ?? null}, ${hasDefault.rows.length === 0}, ${actor.userId}, ${actor.userId})
        ON CONFLICT (user_id, company_id) DO UPDATE SET status = 'active', default_branch_id = EXCLUDED.default_branch_id, department_id = EXCLUDED.department_id,
          job_title = EXCLUDED.job_title, updated_at = now(), updated_by = EXCLUDED.updated_by`);
      for (const assignment of prepared) await this.usersService.insertAssignment(transaction, actor, userId, assignment);
      await this.auditService.record({ ...auditBase(actor, "user"), action: "user.invite", entityId: userId, afterData: { ...input, existingAccount: existingId !== null } }, transaction);
      const status = (await transaction.execute<{ status: InviteUserResponse["status"] }>(sql`SELECT status FROM core.users WHERE id = ${userId}`)).rows[0]!.status;
      const token = status === "invited" ? await this.issueActivationToken(transaction, actor, userId) : null;
      return { userId, status, token };
    });
    if (result.token) await this.sendActivation(result.userId, result.token);
    return { userId: result.userId, status: result.status, addedToExistingAccount: existingId !== null };
  }

  // API_26: chỉ cho tài khoản còn "Đã mời"; đường dẫn cũ hết hiệu lực ngay.
  async resend(actor: Actor, userId: string): Promise<void> {
    await this.usersService.requireVisible(actor, userId);
    const status = (await this.database.execute<{ status: string }>(sql`SELECT status FROM core.users WHERE id = ${userId}`)).rows[0]?.status;
    if (status !== "invited") throw new ApiError("BUSINESS_RULE", "notInvited");
    const token = await this.database.transaction(async (transaction) => {
      const issued = await this.issueActivationToken(transaction, actor, userId);
      await this.auditService.record({ ...auditBase(actor, "user"), action: "user.invitation.resend", entityId: userId }, transaction);
      return issued;
    });
    await this.sendActivation(userId, token);
  }

  private async issueActivationToken(transaction: Executor, actor: Actor, userId: string): Promise<string> {
    const now = this.clock.now();
    await transaction.execute(sql`
      UPDATE core.user_tokens SET expires_at = LEAST(expires_at, ${now.toISOString()}::timestamptz)
      WHERE user_id = ${userId} AND purpose = 'activation' AND used_at IS NULL`);
    const token = newRandomToken();
    const expiresAt = new Date(now.getTime() + activationHours * 3600 * 1000);
    await transaction.execute(sql`
      INSERT INTO core.user_tokens (user_id, purpose, token_hash, expires_at, created_by)
      VALUES (${userId}, 'activation', ${hashToken(token)}, ${expiresAt.toISOString()}::timestamptz, ${actor.userId})`);
    return token;
  }

  // Gửi qua email nếu có, không thì SMS. Nội dung không chứa mật khẩu.
  private async sendActivation(userId: string, token: string): Promise<void> {
    const user = (await this.database.execute<{ email: string | null; phone: string | null; full_name: string }>(sql`SELECT email::text AS email, phone, full_name FROM core.users WHERE id = ${userId}`)).rows[0]!;
    const link = `${webOrigin()}/kich-hoat?token=${encodeURIComponent(token)}`;
    const to = user.email ?? user.phone;
    if (!to) return;
    await this.messages.send({
      channel: user.email ? "email" : "sms",
      to,
      subject: "Kích hoạt tài khoản VComm",
      body: `Chào ${user.full_name}, mở đường dẫn sau trong ${activationHours} giờ để kích hoạt tài khoản: ${link}`,
    });
  }
}
