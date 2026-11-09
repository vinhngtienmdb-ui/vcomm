// API_14 đến API_18: hồ sơ cá nhân, đổi mật khẩu, cách đăng nhập, phiên (CHUC_NANG_10). Chỉ hồ sơ của chính mình.
import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Patch, Post, Req } from "@nestjs/common";
import { changePasswordSchema, mfaCodeSchema, updateMeSchema, type IdentityResponse, type MeResponse, type MfaBackupCodesResponse, type SessionResponse } from "contracts";
import { eq, sql } from "drizzle-orm";
import { clientInfo } from "../auth/auth.controller";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { MfaService } from "../auth/mfa.service";
import { PasswordService } from "../auth/password.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { UuidPipe } from "../common/uuid.pipe";
import { DATABASE, type Database } from "../database/database.module";
import { users } from "../database/schema";
import { PermissionService } from "../permissions/permission.service";

@Controller("me")
export class MeController {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly mfa: MfaService,
    private readonly passwords: PasswordService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async me(@Req() request: AuthenticatedRequest, @Headers("x-company-id") requestedCompanyId?: string): Promise<MeResponse> {
    const rows = await this.database.select().from(users).where(eq(users.id, request.auth.userId)).limit(1);
    const user = rows[0];
    if (!user) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
    const { companyId, companies } = await this.permissionService.resolveCompany(user.id, requestedCompanyId);
    const permissions = companyId ? await this.permissionService.permissionsInCompany(user.id, companyId) : [];
    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        locale: user.locale === "en" ? "en" : "vi",
        mfaRequired: user.mfaRequired,
        mfaEnabled: await this.mfa.isEnrolled(user.id),
        version: user.version,
      },
      companies,
      currentCompanyId: companyId,
      permissions,
    };
  }

  // API_15: họ tên, ngôn ngữ, công ty mặc định (CHUC_NANG_22).
  @Patch()
  async update(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<MeResponse> {
    const input = updateMeSchema.parse(body);
    const userId = request.auth.userId;
    if (input.defaultCompanyId) await this.permissionService.resolveCompany(userId, input.defaultCompanyId);
    await this.database.transaction(async (transaction) => {
      const updated = await transaction.execute(sql`
        UPDATE core.users SET full_name = COALESCE(${input.fullName ?? null}, full_name), locale = COALESCE(${input.locale ?? null}, locale),
          version = version + 1, updated_at = now(), updated_by = ${userId}
        WHERE id = ${userId} AND version = ${input.version} RETURNING id`);
      if (updated.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (input.defaultCompanyId) {
        await transaction.execute(sql`UPDATE core.user_company_memberships SET is_default = (company_id = ${input.defaultCompanyId}) WHERE user_id = ${userId}`);
      }
      const client = clientInfo(request);
      await this.auditService.record({ actorUserId: userId, appCode: "platform", action: "profile.update", entityType: "user", entityId: userId, afterData: input, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId }, transaction);
    });
    return this.me(request);
  }

  // API_16
  @Post("password")
  @HttpCode(204)
  async changePassword(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    const input = changePasswordSchema.parse(body);
    await this.passwords.change(request.auth.userId, request.auth.sessionId, input.currentPassword, input.newPassword, clientInfo(request));
  }

  // API_17
  @Get("identities")
  async identities(@Req() request: AuthenticatedRequest): Promise<IdentityResponse[]> {
    const rows = await this.database.execute<{ id: string; provider: IdentityResponse["provider"]; provider_subject: string; last_used_at: Date | null }>(sql`
      SELECT id, provider, provider_subject, last_used_at FROM core.user_identities WHERE user_id = ${request.auth.userId} ORDER BY provider, created_at`);
    return rows.rows.map((row) => ({ id: row.id, provider: row.provider, subject: row.provider_subject, lastUsedAt: row.last_used_at ? new Date(row.last_used_at).toISOString() : null }));
  }

  // Không cho hủy cách đăng nhập cuối cùng; mật khẩu gắn với email, số điện thoại không hủy ở đây.
  @Delete("identities/:id")
  @HttpCode(204)
  async removeIdentity(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    const rows = await this.database.execute<{ id: string; provider: string }>(sql`SELECT id, provider FROM core.user_identities WHERE user_id = ${request.auth.userId}`);
    const target = rows.rows.find((row) => row.id === id);
    if (!target) throw new ApiError("NOT_FOUND", "notFound");
    if (target.provider === "password" || rows.rows.length <= 1) throw new ApiError("BUSINESS_RULE", "lastIdentity");
    await this.database.execute(sql`DELETE FROM core.user_identities WHERE id = ${id} AND user_id = ${request.auth.userId}`);
  }

  // API_18
  @Get("sessions")
  async sessions(@Req() request: AuthenticatedRequest): Promise<SessionResponse[]> {
    const rows = await this.database.execute<{ id: string; client_type: string; ip: string | null; user_agent: string | null; created_at: Date }>(sql`
      SELECT id, client_type, host(ip) AS ip, user_agent, created_at FROM core.sessions
      WHERE user_id = ${request.auth.userId} AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC`);
    return rows.rows.map((row) => ({ id: row.id, clientType: row.client_type, ip: row.ip, userAgent: row.user_agent, createdAt: new Date(row.created_at).toISOString(), current: row.id === request.auth.sessionId }));
  }

  // Thu hồi phiên: thiết bị đó phải đăng nhập lại ở thao tác tiếp theo (TIEUCHI_NGHIEMTHU_18).
  @Delete("sessions/:id")
  @HttpCode(204)
  async revokeSession(@Req() request: AuthenticatedRequest, @Param("id", UuidPipe) id: string): Promise<void> {
    const revoked = await this.database.execute(sql`
      UPDATE core.sessions SET revoked_at = now() WHERE id = ${id} AND user_id = ${request.auth.userId} AND revoked_at IS NULL RETURNING id`);
    if (revoked.rows.length === 0) throw new ApiError("NOT_FOUND", "notFound");
  }

  // Tắt xác thực hai lớp (MAN_HINH_06); không được khi đang bắt buộc.
  @Post("mfa/disable")
  @HttpCode(204)
  async disableMfa(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<void> {
    await this.mfa.disable(request.auth.userId, request.auth.sessionId, mfaCodeSchema.parse(body).code, clientInfo(request));
  }

  // Tạo lại 10 mã dự phòng; mã cũ hết hiệu lực.
  @Post("mfa/backup-codes")
  async regenerateBackupCodes(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<MfaBackupCodesResponse> {
    return this.mfa.regenerateBackupCodes(request.auth.userId, request.auth.sessionId, mfaCodeSchema.parse(body).code, clientInfo(request));
  }
}
