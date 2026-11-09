// Kích hoạt tài khoản bằng đường dẫn một lần, hết hạn sau 72 giờ (CHUC_NANG_04; QUYTAC_NGHIEPVU_06, 07).
import { Inject, Injectable } from "@nestjs/common";
import type { ActivationInfoResponse } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { DATABASE, type Database } from "../database/database.module";
import type { ClientInfo } from "./auth.service";
import { setPassword } from "./password.service";
import { hashToken } from "./tokens";

export const minimumPasswordLength = 10;

type TokenRow = { token_id: string; user_id: string; full_name: string; email: string | null; phone: string | null; username: string | null; company_name: string | null };

@Injectable()
export class ActivationService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly auditService: AuditService,
  ) {}

  // Thông tin hiển thị trên MAN_HINH_03; đường dẫn không dùng được thì báo chung một thông báo.
  async info(token: string): Promise<ActivationInfoResponse> {
    const row = await this.validToken(token);
    return { fullName: row.full_name, companyName: row.company_name, loginIdentifier: row.email ?? row.username ?? row.phone ?? "" };
  }

  async activate(token: string, password: string, client: ClientInfo): Promise<void> {
    const row = await this.validToken(token);
    if (password.length < minimumPasswordLength) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { password: "passwordTooShort" } });
    const now = this.clock.now().toISOString();
    await this.database.transaction(async (transaction) => {
      // Đánh dấu đã dùng có điều kiện để hai yêu cầu cùng lúc chỉ một yêu cầu thành công.
      const used = await transaction.execute(sql`
        UPDATE core.user_tokens SET used_at = ${now}::timestamptz
        WHERE id = ${row.token_id} AND used_at IS NULL AND expires_at > ${now}::timestamptz RETURNING id`);
      if (used.rows.length === 0) throw new ApiError("BUSINESS_RULE", "activationInvalid");
      // Đăng nhập được bằng email, tên đăng nhập hoặc số điện thoại.
      await setPassword(transaction, row.user_id, password);
      await transaction.execute(sql`UPDATE core.users SET status = 'active', updated_at = now(), version = version + 1 WHERE id = ${row.user_id} AND status = 'invited'`);
      await this.auditService.record(
        { actorUserId: row.user_id, appCode: "platform", action: "user.activate", entityType: "user", entityId: row.user_id, ip: client.ip, userAgent: client.userAgent, requestId: client.requestId },
        transaction,
      );
    });
  }

  private async validToken(token: string): Promise<TokenRow> {
    const now = this.clock.now().toISOString();
    const result = await this.database.execute<TokenRow>(sql`
      SELECT t.id AS token_id, u.id AS user_id, u.full_name, u.email::text AS email, u.phone, u.username::text AS username,
        (SELECT c.short_name FROM core.user_company_memberships m JOIN core.companies c ON c.id = m.company_id
          WHERE m.user_id = u.id AND m.status = 'active' ORDER BY m.is_default DESC, m.created_at LIMIT 1) AS company_name
      FROM core.user_tokens t JOIN core.users u ON u.id = t.user_id
      WHERE t.token_hash = ${hashToken(token)} AND t.purpose = 'activation' AND t.used_at IS NULL
        AND t.expires_at > ${now}::timestamptz AND u.status = 'invited'`);
    const row = result.rows[0];
    if (!row) throw new ApiError("BUSINESS_RULE", "activationInvalid");
    return row;
  }
}
