// Cổng cửa hàng nhóm iPOS: quyền vào, quầy, mã ghép, thiết bị (CONG_VIEC_74; CHUC_NANG_254; QUYTAC_NGHIEPVU_596, 597, 606; API_348).
import { Inject, Injectable } from "@nestjs/common";
import type { IposPairingCode, IposPortalAccess, IposPortalOutlet, IposRegisterItem, IposSubscriptionStatus, iposRegisterCreateSchema, iposRegisterUpdateSchema } from "contracts";
import { sql } from "drizzle-orm";
import { randomInt } from "node:crypto";
import type { z } from "zod";
import type { PortalMember } from "../affiliate/portal.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { isUniqueViolation } from "../common/database-errors";
import { DATABASE, type Database } from "../database/database.module";
import { hashSecret } from "./ipos-device-context";

type Executor = Pick<Database, "execute">;
// Bỏ ký tự dễ nhầm (0, O, 1, I, L) khỏi mã ghép.
const pairingAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const pairingMinutes = 10;
// Hủy thuê bao: chủ cửa hàng còn xem dữ liệu 12 tháng (QUYTAC_NGHIEPVU_596).
const viewMonthsAfterCancel = 12;

export function newPairingCode(): string {
  return Array.from({ length: 8 }, () => pairingAlphabet[randomInt(0, pairingAlphabet.length)]).join("");
}

// Số quầy đang hoạt động của điểm bán vượt giới hạn: quầy tạo sau cùng vượt trước (QUYTAC_NGHIEPVU_597).
export const overLimitRegisters = (outletId: string) => sql`
  SELECT r.id FROM (
    SELECT r.id, row_number() OVER (ORDER BY r.created_at, r.id) AS position FROM ipos.registers r WHERE r.outlet_id = ${outletId} AND r.status = 'active'
  ) r
  WHERE r.position > COALESCE((
    SELECT COALESCE(s.custom_max_registers, pl.max_registers) FROM ipos.subscriptions s JOIN ipos.plans pl ON pl.id = s.plan_id
    WHERE s.outlet_id = ${outletId} AND s.status <> 'cancelled'), 0)`;

@Injectable()
export class IposRegistersService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly audit: AuditService,
  ) {}

  private record(member: PortalMember, action: string, entityType: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      { actorUserId: member.userId, companyId: member.companyId, appCode: "affiliate", action, entityType, entityId, afterData, ip: member.client.ip, userAgent: member.client.userAgent, requestId: member.client.requestId },
      executor,
    );
  }

  // Điểm bán có thuê bao mà thành viên được thấy (chủ: mọi điểm bán; thu ngân: điểm bán được gán).
  private async outlets(executor: Executor, member: PortalMember): Promise<IposPortalOutlet[]> {
    const rows = await executor.execute<{
      outlet_id: string;
      outlet_name: string;
      subscription_id: string;
      status: IposSubscriptionStatus;
      ends_on: string;
      plan_name: string;
      max_registers: number;
      active_registers: number;
    }>(sql`
      SELECT DISTINCT ON (s.outlet_id) s.outlet_id, o.name AS outlet_name, s.id AS subscription_id, s.status, s.ends_on::text, pl.name AS plan_name,
        COALESCE(s.custom_max_registers, pl.max_registers) AS max_registers,
        (SELECT count(*)::int FROM ipos.registers r WHERE r.outlet_id = s.outlet_id AND r.status = 'active') AS active_registers
      FROM ipos.subscriptions s JOIN affiliate.outlets o ON o.id = s.outlet_id JOIN ipos.plans pl ON pl.id = s.plan_id
      WHERE s.merchant_id = ${member.merchantId}
        AND (s.status <> 'cancelled' OR s.cancelled_at > ${this.clock.now()}::timestamptz - make_interval(months => ${viewMonthsAfterCancel}))
        ${member.role === "owner" ? sql`` : sql`AND s.outlet_id IN (SELECT outlet_id FROM affiliate.member_outlets WHERE member_id = ${member.memberId})`}
      ORDER BY s.outlet_id, s.status = 'cancelled', s.created_at DESC`);
    return rows.rows
      .map((row) => ({
        outletId: row.outlet_id,
        outletName: row.outlet_name,
        subscriptionId: row.subscription_id,
        subscriptionStatus: row.status,
        endsOn: row.ends_on,
        planName: row.plan_name,
        maxRegisters: row.max_registers,
        activeRegisters: row.active_registers,
      }))
      .sort((left, right) => left.outletName.localeCompare(right.outletName, "vi"));
  }

  async access(member: PortalMember): Promise<IposPortalAccess> {
    const outlets = await this.outlets(this.database, member);
    const pending =
      member.role === "owner"
        ? (
            await this.database.execute<{ total: number }>(sql`
              SELECT count(*)::int AS total FROM ipos.cashier_registrations WHERE merchant_id = ${member.merchantId} AND status = 'pending' AND expires_at > ${this.clock.now()}`)
          ).rows[0]!.total
        : 0;
    return { enabled: outlets.length > 0, isOwner: member.role === "owner", outlets, pendingRegistrations: pending };
  }

  // Chỉ chủ cửa hàng quản lý quầy; điểm bán phải có thuê bao chưa hủy.
  private async subscribedOutlet(executor: Executor, member: PortalMember, outletId: string): Promise<void> {
    const found = await executor.execute(sql`
      SELECT 1 FROM ipos.subscriptions WHERE merchant_id = ${member.merchantId} AND outlet_id = ${outletId} AND status <> 'cancelled'`);
    if (found.rows.length === 0) throw new ApiError("BUSINESS_RULE", "iposNoSubscription");
  }

  async registers(member: PortalMember): Promise<IposRegisterItem[]> {
    const rows = await this.database.execute<{
      id: string;
      outlet_id: string;
      outlet_name: string;
      name: string;
      status: "active" | "inactive";
      version: number;
      device_id: string | null;
      model: string | null;
      app_version: string | null;
      paired_at: Date | null;
      paired_by_name: string | null;
      last_seen_at: Date | null;
    }>(sql`
      SELECT r.id, r.outlet_id, o.name AS outlet_name, r.name, r.status, r.version, d.id AS device_id, d.model, d.app_version, d.paired_at, u.full_name AS paired_by_name, d.last_seen_at
      FROM ipos.registers r JOIN affiliate.outlets o ON o.id = r.outlet_id
      LEFT JOIN ipos.devices d ON d.register_id = r.id AND d.revoked_at IS NULL
      LEFT JOIN core.users u ON u.id = d.paired_by
      WHERE r.merchant_id = ${member.merchantId}
        ${member.role === "owner" ? sql`` : sql`AND r.outlet_id IN (SELECT outlet_id FROM affiliate.member_outlets WHERE member_id = ${member.memberId})`}
      ORDER BY o.name, r.created_at`);
    const outletIds = [...new Set(rows.rows.map((row) => row.outlet_id))];
    const over = new Set<string>();
    for (const outletId of outletIds) for (const row of (await this.database.execute<{ id: string }>(overLimitRegisters(outletId))).rows) over.add(row.id);
    return rows.rows.map((row) => ({
      id: row.id,
      outletId: row.outlet_id,
      outletName: row.outlet_name,
      name: row.name,
      status: row.status,
      overLimit: over.has(row.id),
      device: row.device_id
        ? {
            id: row.device_id,
            model: row.model,
            appVersion: row.app_version,
            pairedAt: new Date(row.paired_at!).toISOString(),
            pairedByName: row.paired_by_name ?? "",
            lastSeenAt: new Date(row.last_seen_at!).toISOString(),
          }
        : null,
      version: row.version,
    }));
  }

  // Số quầy đang hoạt động không vượt giới hạn của thuê bao (QUYTAC_NGHIEPVU_597, 606).
  private async ensureCapacity(executor: Executor, outletId: string): Promise<void> {
    const row = (
      await executor.execute<{ active: number; limit: number }>(sql`
        SELECT (SELECT count(*)::int FROM ipos.registers WHERE outlet_id = ${outletId} AND status = 'active') AS active,
          (SELECT COALESCE(s.custom_max_registers, pl.max_registers) FROM ipos.subscriptions s JOIN ipos.plans pl ON pl.id = s.plan_id
           WHERE s.outlet_id = ${outletId} AND s.status <> 'cancelled') AS limit`)
    ).rows[0]!;
    if (row.active >= row.limit) throw new ApiError("BUSINESS_RULE", "iposRegisterLimit");
  }

  async createRegister(member: PortalMember, input: z.infer<typeof iposRegisterCreateSchema>): Promise<IposRegisterItem[]> {
    await this.database
      .transaction(async (transaction) => {
        // Khóa thuê bao của điểm bán để hai yêu cầu cùng lúc không vượt giới hạn.
        await transaction.execute(sql`SELECT id FROM ipos.subscriptions WHERE outlet_id = ${input.outletId} AND merchant_id = ${member.merchantId} AND status <> 'cancelled' FOR UPDATE`);
        await this.subscribedOutlet(transaction, member, input.outletId);
        await this.ensureCapacity(transaction, input.outletId);
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO ipos.registers (merchant_id, outlet_id, name, created_by) VALUES (${member.merchantId}, ${input.outletId}, ${input.name}, ${member.userId}) RETURNING id`);
        await this.record(member, "ipos_register.create", "ipos_register", inserted.rows[0]!.id, input, transaction);
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "iposRegisterNameTaken");
        throw error;
      });
    return this.registers(member);
  }

  async updateRegister(member: PortalMember, registerId: string, input: z.infer<typeof iposRegisterUpdateSchema>): Promise<IposRegisterItem[]> {
    await this.database
      .transaction(async (transaction) => {
        const row = (
          await transaction.execute<{ outlet_id: string; status: string; version: number }>(sql`
            SELECT outlet_id, status, version FROM ipos.registers WHERE id = ${registerId} AND merchant_id = ${member.merchantId} FOR UPDATE`)
        ).rows[0];
        if (!row) throw new ApiError("NOT_FOUND", "notFound");
        if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
        if (row.status === "inactive" && input.status === "active") {
          await transaction.execute(sql`SELECT id FROM ipos.subscriptions WHERE outlet_id = ${row.outlet_id} AND status <> 'cancelled' FOR UPDATE`);
          await this.subscribedOutlet(transaction, member, row.outlet_id);
          await this.ensureCapacity(transaction, row.outlet_id);
        }
        await transaction.execute(sql`
          UPDATE ipos.registers SET name = ${input.name}, status = ${input.status}, updated_at = now(), version = version + 1 WHERE id = ${registerId}`);
        // Ngừng quầy thì thu hồi thiết bị đang ghép.
        if (input.status === "inactive") {
          await transaction.execute(sql`UPDATE ipos.devices SET revoked_at = ${this.clock.now()}, revoked_by = ${member.userId} WHERE register_id = ${registerId} AND revoked_at IS NULL`);
        }
        await this.record(member, "ipos_register.update", "ipos_register", registerId, input, transaction);
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "iposRegisterNameTaken");
        throw error;
      });
    return this.registers(member);
  }

  // Mã ghép 8 ký tự hiệu lực 10 phút cho quầy đang hoạt động; mã cũ chưa dùng của quầy hết hiệu lực.
  async pairingCode(member: PortalMember, registerId: string): Promise<IposPairingCode> {
    const now = this.clock.now();
    const code = newPairingCode();
    const expiresAt = new Date(now.getTime() + pairingMinutes * 60_000);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ outlet_id: string; status: string }>(sql`
          SELECT outlet_id, status FROM ipos.registers WHERE id = ${registerId} AND merchant_id = ${member.merchantId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.status !== "active") throw new ApiError("BUSINESS_RULE", "iposRegisterInactive");
      await this.subscribedOutlet(transaction, member, row.outlet_id);
      const over = await transaction.execute<{ id: string }>(overLimitRegisters(row.outlet_id));
      if (over.rows.some((item) => item.id === registerId)) throw new ApiError("BUSINESS_RULE", "iposRegisterLimit");
      await transaction.execute(sql`UPDATE ipos.pairing_codes SET used_at = ${now} WHERE register_id = ${registerId} AND used_at IS NULL`);
      await transaction.execute(sql`
        INSERT INTO ipos.pairing_codes (register_id, code_hash, expires_at, created_by) VALUES (${registerId}, ${hashSecret(code)}, ${expiresAt}, ${member.userId})`);
      await this.record(member, "ipos_pairing_code.create", "ipos_register", registerId, { expiresAt: expiresAt.toISOString() }, transaction);
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async revokeDevice(member: PortalMember, deviceId: string): Promise<IposRegisterItem[]> {
    await this.database.transaction(async (transaction) => {
      const revoked = await transaction.execute(sql`
        UPDATE ipos.devices SET revoked_at = ${this.clock.now()}, revoked_by = ${member.userId} WHERE id = ${deviceId} AND merchant_id = ${member.merchantId} AND revoked_at IS NULL`);
      if (!revoked.rowCount) throw new ApiError("NOT_FOUND", "notFound");
      await this.record(member, "ipos_device.revoke", "ipos_device", deviceId, {}, transaction);
    });
    return this.registers(member);
  }
}
