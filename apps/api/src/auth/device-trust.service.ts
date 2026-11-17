// Thiết bị tin cậy của tài khoản người mua (CONG_VIEC_72; QUYTAC_NGHIEPVU_564, 565; API_321).
// Thiết bị = băm mã cài đặt ứng dụng (X-Device-Id); hết tin cậy sau 12 tháng không dùng, khi khách gỡ, khi đặt lại mật khẩu.
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerDeviceItem, SmartOtpPlatform } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { deviceHashOf } from "../common/device-hash";
import { DATABASE, type Database } from "../database/database.module";
import { AuthenticationSettingsService } from "./authentication-settings.service";
import type { ClientInfo } from "./auth.service";

type Executor = Pick<Database, "execute">;
const trustMonths = 12;

// Cách xác nhận thiết bị mới (QUYTAC_NGHIEPVU_565): mã Smart OTP; mã SMS khi chưa kích hoạt và còn thời hạn chuyển đổi;
// hết hạn mà chưa kích hoạt thì phải kích hoạt Smart OTP trên máy này (khôi phục, lát L4).
export type DeviceVerificationMethod = "smart_otp" | "sms" | "smart_otp_activation";

// Tên máy từ User-Agent của ứng dụng (chỉ để khách nhận ra trong danh sách).
export function deviceLabel(userAgent: string | null): { name: string; platform: SmartOtpPlatform | null } {
  const agent = userAgent ?? "";
  if (/iPhone|iPad|iOS|Darwin/i.test(agent)) return { name: "iPhone", platform: "ios" };
  if (/Android|okhttp/i.test(agent)) return { name: "Điện thoại Android", platform: "android" };
  if (/Mozilla/i.test(agent)) return { name: "Trình duyệt", platform: "web" };
  return { name: "Thiết bị", platform: null };
}

@Injectable()
export class DeviceTrustService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
    private readonly settings: AuthenticationSettingsService,
  ) {}

  async isTrusted(executor: Executor, userId: string, deviceHash: string | null): Promise<boolean> {
    if (!deviceHash) return false;
    const since = new Date(this.clock.now().getTime() - trustMonths * 30 * 86_400_000);
    const row = await executor.execute(sql`
      SELECT 1 FROM core.trusted_devices WHERE user_id = ${userId} AND device_hash = ${deviceHash} AND removed_at IS NULL AND last_seen_at >= ${since}`);
    return row.rows.length > 0;
  }

  // Ghi hoặc làm mới thiết bị tin cậy; thiết bị đã gỡ thì tin cậy lại từ đầu.
  async trust(executor: Executor, userId: string, deviceHash: string | null, client: Pick<ClientInfo, "userAgent">): Promise<void> {
    if (!deviceHash) return;
    const label = deviceLabel(client.userAgent);
    const now = this.clock.now();
    await executor.execute(sql`
      INSERT INTO core.trusted_devices (user_id, device_hash, device_name, platform, first_seen_at, last_seen_at)
      VALUES (${userId}, ${deviceHash}, ${label.name}, ${label.platform}, ${now}, ${now})
      ON CONFLICT (user_id, device_hash) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at,
        device_name = coalesce(core.trusted_devices.device_name, EXCLUDED.device_name), platform = coalesce(core.trusted_devices.platform, EXCLUDED.platform),
        first_seen_at = CASE WHEN core.trusted_devices.removed_at IS NULL THEN core.trusted_devices.first_seen_at ELSE EXCLUDED.first_seen_at END,
        removed_at = NULL`);
  }

  // Thiết bị chưa tin cậy thì cần cách xác nhận nào (null: không cần).
  async verificationMethod(executor: Executor, userId: string, deviceHash: string | null): Promise<DeviceVerificationMethod | null> {
    if (await this.isTrusted(executor, userId, deviceHash)) return null;
    const active = (await executor.execute(sql`SELECT 1 FROM core.smart_otp_devices WHERE user_id = ${userId}`)).rows.length > 0;
    if (active) return "smart_otp";
    return (await this.settings.buyerTransitionOpen(executor)) ? "sms" : "smart_otp_activation";
  }

  async list(userId: string, deviceId: string | null): Promise<BuyerDeviceItem[]> {
    const current = deviceHashOf(deviceId);
    const since = new Date(this.clock.now().getTime() - trustMonths * 30 * 86_400_000);
    const rows = await this.database.execute<{
      id: string;
      device_hash: string;
      device_name: string | null;
      platform: SmartOtpPlatform | null;
      first_seen_at: Date;
      last_seen_at: Date;
      holds_smart_otp: boolean;
    }>(sql`
      SELECT t.id, t.device_hash, t.device_name, t.platform, t.first_seen_at, t.last_seen_at,
        EXISTS (SELECT 1 FROM core.smart_otp_devices d WHERE d.user_id = t.user_id AND d.device_hash = t.device_hash) AS holds_smart_otp
      FROM core.trusted_devices t
      WHERE t.user_id = ${userId} AND t.removed_at IS NULL AND t.last_seen_at >= ${since}
      ORDER BY (t.device_hash = ${current ?? ""}) DESC, t.last_seen_at DESC`);
    return rows.rows.map((row) => ({
      id: row.id,
      deviceName: row.device_name,
      platform: row.platform,
      firstSeenAt: new Date(row.first_seen_at).toISOString(),
      lastSeenAt: new Date(row.last_seen_at).toISOString(),
      thisDevice: row.device_hash === current,
      holdsSmartOtp: row.holds_smart_otp,
    }));
  }

  // Gỡ thiết bị: hết tin cậy, thu hồi mọi phiên của thiết bị đó (QUYTAC_NGHIEPVU_564).
  async remove(userId: string, id: string, client: ClientInfo): Promise<BuyerDeviceItem[]> {
    const now = this.clock.now();
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute<{ device_hash: string; device_name: string | null }>(sql`
        UPDATE core.trusted_devices SET removed_at = ${now} WHERE id = ${id} AND user_id = ${userId} AND removed_at IS NULL RETURNING device_hash, device_name`);
      const row = removed.rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      await transaction.execute(sql`UPDATE core.sessions SET revoked_at = ${now} WHERE user_id = ${userId} AND device_hash = ${row.device_hash} AND revoked_at IS NULL`);
      await this.audit.record(
        {
          actorUserId: userId,
          appCode: "marketplace",
          action: "device.remove",
          entityType: "core.trusted_devices",
          entityId: id,
          afterData: { deviceName: row.device_name },
          ip: client.ip,
          userAgent: client.userAgent,
          requestId: client.requestId,
        },
        transaction,
      );
    });
    return this.list(userId, client.deviceId ?? null);
  }

  // Đặt lại mật khẩu: hết tin cậy mọi thiết bị trừ thiết bị đang làm (QUYTAC_NGHIEPVU_568).
  async removeAllExcept(executor: Executor, userId: string, deviceHash: string | null): Promise<void> {
    await executor.execute(sql`
      UPDATE core.trusted_devices SET removed_at = ${this.clock.now()}
      WHERE user_id = ${userId} AND removed_at IS NULL AND device_hash IS DISTINCT FROM ${deviceHash}`);
  }
}
