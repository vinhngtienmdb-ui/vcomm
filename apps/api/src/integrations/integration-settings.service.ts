// Cài đặt tích hợp (CHUC_NANG_25; QUYTAC_NGHIEPVU_31): mã ứng dụng Google, Microsoft, Zalo, khóa eSMS.vn.
// Đọc thẳng từ cơ sở dữ liệu mỗi lần dùng nên lưu xong có hiệu lực ngay trên mọi tiến trình API.
import { Inject, Injectable } from "@nestjs/common";
import {
  type IntegrationSettingItem,
  type IntegrationSettingKey,
  type IntegrationSettingsResponse,
  integrationSettingKeys,
  secretIntegrationKeys,
  type updateIntegrationSettingsSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { webOrigin } from "../common/outbound-messages";
import { decryptSecret, encryptSecret } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { auditBase } from "../organization/organization-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const manageIntegration = "platform.integration.manage";

type SettingRow = { setting_key: IntegrationSettingKey; plain_value: string | null; secret_value: Buffer | null; updated_at: Date };

const isSecret = (key: IntegrationSettingKey) => secretIntegrationKeys.includes(key);
const lastFour = (value: string) => value.slice(-4);

// Đường dẫn nhà cung cấp chuyển về sau khi người dùng đồng ý (API_05).
export const oauthCallbackUrl = (provider: "google" | "microsoft" | "zalo") => `${webOrigin()}/api/v1/auth/oauth/${provider}/callback`;

@Injectable()
export class IntegrationSettingsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  // Chỉ quản trị tập đoàn: quyền phải có ở phạm vi tập đoàn.
  async requireManager(userId: string): Promise<void> {
    if (!(await this.permissionService.permissionsCovering(userId, { scopeType: "group" })).has(manageIntegration)) throw new ApiError("FORBIDDEN", "forbidden");
  }

  async list(): Promise<IntegrationSettingsResponse> {
    const rows = await this.rows();
    const settings: IntegrationSettingItem[] = integrationSettingKeys.map((key) => {
      const row = rows.get(key);
      const secretValue = row?.secret_value ? decryptSecret(row.secret_value) : null;
      return {
        key,
        secret: isSecret(key),
        configured: Boolean(row?.plain_value || row?.secret_value),
        value: isSecret(key) ? null : (row?.plain_value ?? null),
        lastFour: secretValue ? lastFour(secretValue) : null,
        updatedAt: row ? new Date(row.updated_at).toISOString() : null,
      };
    });
    return { settings, callbackUrls: { google: oauthCallbackUrl("google"), microsoft: oauthCallbackUrl("microsoft"), zalo: oauthCallbackUrl("zalo") } };
  }

  async update(actor: Actor, input: z.output<typeof updateIntegrationSettingsSchema>): Promise<IntegrationSettingsResponse> {
    const changed: Record<string, string | null> = {};
    await this.database.transaction(async (transaction) => {
      for (const key of input.clear) {
        await transaction.execute(sql`DELETE FROM core.integration_settings WHERE setting_key = ${key}`);
        changed[key] = null;
      }
      for (const [key, raw] of Object.entries(input.values) as [IntegrationSettingKey, string | undefined][]) {
        const value = raw?.trim() ?? "";
        if (input.clear.includes(key)) continue;
        if (isSecret(key)) {
          // QUYTAC_NGHIEPVU_31: để trống thì giữ khóa cũ.
          if (!value) continue;
          await transaction.execute(sql`
            INSERT INTO core.integration_settings (setting_key, secret_value, updated_by) VALUES (${key}, ${encryptSecret(value)}, ${actor.userId})
            ON CONFLICT (setting_key) DO UPDATE SET secret_value = EXCLUDED.secret_value, plain_value = NULL, updated_at = now(), updated_by = EXCLUDED.updated_by`);
          changed[key] = `••••${lastFour(value)}`;
        } else if (!value) {
          await transaction.execute(sql`DELETE FROM core.integration_settings WHERE setting_key = ${key}`);
          changed[key] = null;
        } else {
          await transaction.execute(sql`
            INSERT INTO core.integration_settings (setting_key, plain_value, updated_by) VALUES (${key}, ${value}, ${actor.userId})
            ON CONFLICT (setting_key) DO UPDATE SET plain_value = EXCLUDED.plain_value, secret_value = NULL, updated_at = now(), updated_by = EXCLUDED.updated_by`);
          changed[key] = value;
        }
      }
      // Nhật ký chỉ ghi 4 ký tự cuối của khóa bí mật (TIEUCHI_NGHIEMTHU_48).
      await this.auditService.record({ ...auditBase(actor, "integration_settings"), companyId: null, action: "integration_settings.update", afterData: changed }, transaction);
    });
    return this.list();
  }

  // Giá trị dùng nội bộ khi gọi nhà cung cấp; không bao giờ trả ra API.
  async get(key: IntegrationSettingKey): Promise<string | null> {
    const row = (await this.rows([key])).get(key);
    if (!row) return null;
    return row.secret_value ? decryptSecret(row.secret_value) : row.plain_value;
  }

  async getMany<K extends IntegrationSettingKey>(keys: readonly K[]): Promise<Record<K, string | null>> {
    const rows = await this.rows(keys);
    return Object.fromEntries(
      keys.map((key) => {
        const row = rows.get(key);
        return [key, row ? (row.secret_value ? decryptSecret(row.secret_value) : row.plain_value) : null];
      }),
    ) as Record<K, string | null>;
  }

  private async rows(keys?: readonly IntegrationSettingKey[]): Promise<Map<IntegrationSettingKey, SettingRow>> {
    const filter = keys
      ? sql`WHERE setting_key IN (${sql.join(
          keys.map((key) => sql`${key}`),
          sql`, `,
        )})`
      : sql``;
    const result = await this.database.execute<SettingRow>(sql`SELECT setting_key, plain_value, secret_value, updated_at FROM core.integration_settings ${filter}`);
    return new Map(result.rows.map((row) => [row.setting_key, row]));
  }
}
