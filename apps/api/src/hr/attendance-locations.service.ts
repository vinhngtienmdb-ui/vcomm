// Địa điểm chấm công trên ứng dụng và mã QR động (CONG_VIEC_47; QUYTAC_NGHIEPVU_304; API_150).
import { Inject, Injectable } from "@nestjs/common";
import type { AttendanceLocationItem, AttendanceQrResponse, saveAttendanceLocationSchema } from "contracts";
import { sql } from "drizzle-orm";
import { isIP } from "node:net";
import { timingSafeEqual } from "node:crypto";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, type Clock } from "../common/clock";
import { blindIndex } from "../common/secret-box";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { attendanceAccess, requireAttendanceManage, requireAttendanceView } from "./attendance-access";
import { hrAudit } from "./hr-context";

type LocationInput = z.output<typeof saveAttendanceLocationSchema>;

// Mã QR đổi mỗi 30 giây; nhận mã của khung hiện tại và khung liền trước.
export const qrSlotSeconds = 30;
export const qrToken = (locationId: string, slot: number) => blindIndex(`QR|${locationId}|${slot}`).subarray(0, 12).toString("base64url");
export function qrTokenValid(locationId: string, token: string, now: Date): boolean {
  const slot = Math.floor(now.getTime() / 1000 / qrSlotSeconds);
  const given = Buffer.from(token);
  return [slot, slot - 1].some((candidate) => {
    const expected = Buffer.from(qrToken(locationId, candidate));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

// Khoảng cách hai tọa độ theo công thức haversine (mét).
export function distanceMeters(latitude: number, longitude: number, otherLatitude: number, otherLongitude: number): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const half = Math.sin(radians(otherLatitude - latitude) / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(otherLatitude)) * Math.sin(radians(otherLongitude - longitude) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(half));
}

// Địa chỉ IPv4 dạng IPv6 ("::ffff:1.2.3.4") đưa về IPv4 để so với dải mạng công ty.
export const normalizeIp = (value: string | null) => (value ? value.replace(/^::ffff:/, "") : null);

const validCidr = (value: string) => {
  const [address, bits] = value.split("/");
  const version = isIP(address ?? "");
  if (!version) return false;
  if (bits === undefined) return true;
  const size = Number(bits);
  return Number.isInteger(size) && size >= 0 && size <= (version === 4 ? 32 : 128);
};

type LocationRow = {
  id: string;
  name: string;
  branch_id: string;
  branch_name: string;
  latitude: string | null;
  longitude: string | null;
  radius_meters: number | null;
  ip_ranges: string[];
  qr_enabled: boolean;
  status: "active" | "inactive";
  version: number;
};

const toItem = (row: LocationRow): AttendanceLocationItem => ({
  id: row.id,
  name: row.name,
  branchId: row.branch_id,
  branchName: row.branch_name,
  latitude: row.latitude === null ? null : Number(row.latitude),
  longitude: row.longitude === null ? null : Number(row.longitude),
  radiusMeters: row.radius_meters,
  ipRanges: row.ip_ranges,
  qrEnabled: row.qr_enabled,
  status: row.status,
  version: row.version,
});

@Injectable()
export class AttendanceLocationsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
  ) {}

  private access(actor: Actor) {
    return attendanceAccess(this.permissionService, this.database, actor);
  }

  async rows(companyId: string, onlyActive: boolean): Promise<LocationRow[]> {
    const result = await this.database.execute<LocationRow>(sql`
      SELECT l.id, l.name, l.branch_id, b.name AS branch_name, l.latitude::text, l.longitude::text, l.radius_meters,
        ARRAY(SELECT host(r) || '/' || masklen(r) FROM unnest(l.ip_ranges) r) AS ip_ranges, l.qr_enabled, l.status, l.version
      FROM hr.attendance_locations l JOIN core.branches b ON b.id = l.branch_id
      WHERE l.company_id = ${companyId}${onlyActive ? sql` AND l.status = 'active'` : sql``} ORDER BY l.status, l.name`);
    return result.rows;
  }

  async list(actor: Actor): Promise<AttendanceLocationItem[]> {
    requireAttendanceView(await this.access(actor));
    return (await this.rows(actor.companyId, false)).map(toItem);
  }

  private validate(input: LocationInput): void {
    const fields: Record<string, "required" | "invalidValue" | "locationMethodRequired"> = {};
    const gps = [input.latitude, input.longitude, input.radiusMeters].filter((value) => value !== null && value !== undefined).length;
    if (gps !== 0 && gps !== 3) fields[input.latitude == null ? "latitude" : input.longitude == null ? "longitude" : "radiusMeters"] = "required";
    input.ipRanges.forEach((range, index) => {
      if (!validCidr(range)) fields[`ipRanges.${index}`] = "invalidValue";
    });
    if (gps === 0 && input.ipRanges.length === 0 && !input.qrEnabled) fields.qrEnabled = "locationMethodRequired";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
  }

  private async checkBranch(actor: Actor, branchId: string): Promise<void> {
    const branch = await this.database.execute(sql`SELECT 1 FROM core.branches WHERE id = ${branchId} AND company_id = ${actor.companyId} AND status = 'active'`);
    if (branch.rows.length === 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { branchId: "invalidValue" } });
  }

  private ipArray(ranges: string[]) {
    return sql`ARRAY[${sql.join(
      ranges.map((range) => sql`${range}::cidr`),
      sql`, `,
    )}]::cidr[]`;
  }

  async create(actor: Actor, input: LocationInput): Promise<AttendanceLocationItem> {
    requireAttendanceManage(await this.access(actor));
    this.validate(input);
    await this.checkBranch(actor, input.branchId);
    const id = await this.database.transaction(async (transaction) => {
      const inserted = await transaction.execute<{ id: string }>(sql`
        INSERT INTO hr.attendance_locations (company_id, branch_id, name, latitude, longitude, radius_meters, ip_ranges, qr_enabled, status, created_by)
        VALUES (${actor.companyId}, ${input.branchId}, ${input.name}, ${input.latitude ?? null}, ${input.longitude ?? null}, ${input.radiusMeters ?? null},
          ${input.ipRanges.length ? this.ipArray(input.ipRanges) : sql`'{}'::cidr[]`}, ${input.qrEnabled}, ${input.status ?? "active"}, ${actor.userId}) RETURNING id`);
      const locationId = inserted.rows[0]!.id;
      await this.auditService.record({ ...hrAudit(actor, "attendance_location"), action: "attendance_location.create", entityId: locationId, beforeData: null, afterData: input }, transaction);
      return locationId;
    });
    return (await this.list(actor)).find((item) => item.id === id)!;
  }

  async update(actor: Actor, id: string, input: LocationInput): Promise<AttendanceLocationItem> {
    requireAttendanceManage(await this.access(actor));
    this.validate(input);
    await this.checkBranch(actor, input.branchId);
    await this.database.transaction(async (transaction) => {
      const before = (await transaction.execute<{ version: number }>(sql`SELECT version FROM hr.attendance_locations WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)).rows[0];
      if (!before) throw new ApiError("NOT_FOUND", "notFound");
      if (input.version !== before.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        UPDATE hr.attendance_locations SET branch_id = ${input.branchId}, name = ${input.name}, latitude = ${input.latitude ?? null}, longitude = ${input.longitude ?? null},
          radius_meters = ${input.radiusMeters ?? null}, ip_ranges = ${input.ipRanges.length ? this.ipArray(input.ipRanges) : sql`'{}'::cidr[]`}, qr_enabled = ${input.qrEnabled},
          status = ${input.status ?? "active"}, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.auditService.record({ ...hrAudit(actor, "attendance_location"), action: "attendance_location.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return (await this.list(actor)).find((item) => item.id === id)!;
  }

  // Màn hình mã QR đặt tại địa điểm: người có quyền quản lý chấm công mở; giao diện gọi lại mỗi khi mã hết hạn.
  async qr(actor: Actor, id: string): Promise<AttendanceQrResponse> {
    requireAttendanceManage(await this.access(actor));
    const row = (
      await this.database.execute<{ name: string; qr_enabled: boolean }>(sql`
      SELECT name, qr_enabled FROM hr.attendance_locations WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'active'`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (!row.qr_enabled) throw new ApiError("BUSINESS_RULE", "qrDisabled");
    const seconds = this.clock.now().getTime() / 1000;
    const slot = Math.floor(seconds / qrSlotSeconds);
    const token = qrToken(id, slot);
    return {
      locationName: row.name,
      token,
      path: `/my-attendance?l=${id}&t=${token}&c=${actor.companyId}`,
      expiresInSeconds: Math.max(1, Math.ceil((slot + 1) * qrSlotSeconds - seconds)),
    };
  }
}
