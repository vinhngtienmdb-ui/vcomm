// Xác định thiết bị iPOS và người đang đăng nhập trên thiết bị (CONG_VIEC_74; QUYTAC_NGHIEPVU_593, 606, 607).
// Mọi truy vấn của máy bán lọc theo cửa hàng của thiết bị; thu ngân chỉ dùng quầy thuộc điểm bán được gán.
import { iposDeviceHeader, type IposDeviceInfo, type IposDeviceMember, type IposMemberRole, type IposSubscriptionStatus } from "contracts";
import { sql } from "drizzle-orm";
import type { Request } from "express";
import { createHash } from "node:crypto";
import { ApiError } from "../common/api-error";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

// Thiết bị không dùng 30 ngày tự hết hiệu lực; phiên trên thiết bị sống tối đa 12 giờ kể từ đăng nhập.
export const deviceIdleDays = 30;
export const sessionHours = 12;

export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");

export interface IposDevice {
  deviceId: string;
  merchantId: string;
  merchantCode: string;
  merchantName: string;
  merchantStatus: string;
  outletId: string;
  outletName: string;
  outletStatus: string;
  registerId: string;
  registerName: string;
  registerStatus: string;
  subscriptionStatus: IposSubscriptionStatus | null;
}

export function deviceKeyOf(request: Request): string {
  const key = request.header(iposDeviceHeader);
  if (!key || key.length < 20 || key.length > 200) throw new ApiError("UNAUTHENTICATED", "iposDeviceUnknown");
  return key;
}

// Tìm thiết bị đang ghép theo khóa; ghi lần dùng gần nhất. Thiết bị thu hồi, quá 30 ngày không dùng, quầy ngừng thì từ chối.
export async function deviceByKey(executor: Executor, key: string, now: Date): Promise<IposDevice> {
  const row = (
    await executor.execute<{
      device_id: string;
      merchant_id: string;
      merchant_code: string;
      merchant_name: string;
      merchant_status: string;
      outlet_id: string;
      outlet_name: string;
      outlet_status: string;
      register_id: string;
      register_name: string;
      register_status: string;
      subscription_status: IposSubscriptionStatus | null;
      last_seen_at: Date;
    }>(sql`
      SELECT d.id AS device_id, d.merchant_id, m.code AS merchant_code, p.name AS merchant_name, m.status AS merchant_status,
        r.outlet_id, o.name AS outlet_name, o.status AS outlet_status, r.id AS register_id, r.name AS register_name, r.status AS register_status,
        (SELECT s.status FROM ipos.subscriptions s WHERE s.outlet_id = r.outlet_id AND s.status <> 'cancelled') AS subscription_status, d.last_seen_at
      FROM ipos.devices d
      JOIN ipos.registers r ON r.id = d.register_id
      JOIN affiliate.outlets o ON o.id = r.outlet_id
      JOIN affiliate.merchants m ON m.id = d.merchant_id
      JOIN crm.partners p ON p.id = m.partner_id
      WHERE d.key_hash = ${hashSecret(key)} AND d.revoked_at IS NULL`)
  ).rows[0];
  if (!row || new Date(row.last_seen_at).getTime() < now.getTime() - deviceIdleDays * 86_400_000) throw new ApiError("UNAUTHENTICATED", "iposDeviceUnknown");
  if (row.register_status !== "active" || row.merchant_status === "terminated") throw new ApiError("FORBIDDEN", "iposDeviceUnavailable");
  await executor.execute(sql`UPDATE ipos.devices SET last_seen_at = ${now} WHERE id = ${row.device_id}`);
  return {
    deviceId: row.device_id,
    merchantId: row.merchant_id,
    merchantCode: row.merchant_code,
    merchantName: row.merchant_name,
    merchantStatus: row.merchant_status,
    outletId: row.outlet_id,
    outletName: row.outlet_name,
    outletStatus: row.outlet_status,
    registerId: row.register_id,
    registerName: row.register_name,
    registerStatus: row.register_status,
    subscriptionStatus: row.subscription_status,
  };
}

export interface IposMemberRow {
  memberId: string;
  userId: string;
  fullName: string;
  role: IposMemberRole;
}

// Thành viên đang hoạt động của cửa hàng của thiết bị, được dùng quầy của thiết bị (chủ: mọi điểm bán; thu ngân: điểm bán được gán).
export async function memberForDevice(executor: Executor, device: IposDevice, where: { userId: string } | { memberId: string }): Promise<IposMemberRow | null> {
  const row = (
    await executor.execute<{ id: string; user_id: string; full_name: string; role: IposMemberRole }>(sql`
      SELECT mb.id, mb.user_id, mb.full_name, mb.role FROM affiliate.members mb
      WHERE mb.merchant_id = ${device.merchantId} AND mb.status = 'active' AND mb.user_id IS NOT NULL
        AND ${"userId" in where ? sql`mb.user_id = ${where.userId}` : sql`mb.id = ${where.memberId}`}
        AND (mb.role = 'owner' OR EXISTS (SELECT 1 FROM affiliate.member_outlets mo WHERE mo.member_id = mb.id AND mo.outlet_id = ${device.outletId}))`)
  ).rows[0];
  return row ? { memberId: row.id, userId: row.user_id, fullName: row.full_name, role: row.role } : null;
}

export async function deviceInfo(executor: Executor, device: IposDevice, now: Date): Promise<IposDeviceInfo> {
  const members = await executor.execute<{ member_id: string; full_name: string; role: IposMemberRole; locked: boolean }>(sql`
    SELECT mb.id AS member_id, mb.full_name, mb.role, (mp.locked_until IS NOT NULL AND mp.locked_until > ${now}) AS locked
    FROM ipos.member_pins mp JOIN affiliate.members mb ON mb.id = mp.member_id
    WHERE mp.device_id = ${device.deviceId} AND mb.status = 'active'
      AND (mb.role = 'owner' OR EXISTS (SELECT 1 FROM affiliate.member_outlets mo WHERE mo.member_id = mb.id AND mo.outlet_id = ${device.outletId}))
    ORDER BY mp.last_login_at DESC NULLS LAST, mb.full_name`);
  return {
    deviceId: device.deviceId,
    merchantCode: device.merchantCode,
    merchantName: device.merchantName,
    outletId: device.outletId,
    outletName: device.outletName,
    registerId: device.registerId,
    registerName: device.registerName,
    subscriptionStatus: device.subscriptionStatus,
    members: members.rows.map((row) => ({ memberId: row.member_id, fullName: row.full_name, role: row.role, locked: row.locked })),
  };
}

export interface IposPosActor extends IposMemberRow {
  device: IposDevice;
  sessionStartedAt: Date;
}

// Người thao tác trên máy bán: phiên `ipos_app` gắn đúng thiết bị gửi khóa, còn trong 12 giờ, thành viên còn dùng được quầy.
export async function posActor(executor: Executor, request: Request & { auth: { userId: string; sessionId: string } }, now: Date): Promise<IposPosActor> {
  const device = await deviceByKey(executor, deviceKeyOf(request), now);
  const binding = (
    await executor.execute<{ device_id: string; member_id: string; created_at: Date; client_type: string }>(sql`
      SELECT ds.device_id, ds.member_id, ds.created_at, s.client_type
      FROM core.sessions s JOIN ipos.device_sessions ds ON ds.family_id = s.family_id
      WHERE s.id = ${request.auth.sessionId} AND s.user_id = ${request.auth.userId}`)
  ).rows[0];
  if (!binding || binding.client_type !== "ipos_app" || binding.device_id !== device.deviceId) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
  if (new Date(binding.created_at).getTime() + sessionHours * 3_600_000 <= now.getTime()) throw new ApiError("UNAUTHENTICATED", "iposSessionExpired");
  const member = await memberForDevice(executor, device, { memberId: binding.member_id });
  if (!member || member.userId !== request.auth.userId) throw new ApiError("UNAUTHENTICATED", "unauthenticated");
  return { ...member, device, sessionStartedAt: new Date(binding.created_at) };
}

export const memberOf = (member: IposMemberRow, locked = false): IposDeviceMember => ({ memberId: member.memberId, fullName: member.fullName, role: member.role, locked });
