// Ghé thăm khách (CHUC_NANG_103; QUYTAC_NGHIEPVU_138, 139; API_114): ghi lượt có vị trí, ảnh; người có quyền xem đối tác xem mọi lượt của công ty (QUYTAC_NGHIEPVU_279).
import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { type createVisitSchema, type PageResponse, type visitListQuerySchema, type VisitItem, type VisitStaffOptionsResponse, visitPhotoMaximumBytes, visitPhotoMaximumCount } from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { FILE_STORAGE, type FileStorage } from "../common/file-storage";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const visitPermission = "crm.visit.manage";
export type UploadedPhoto = { buffer: Buffer; size: number };

// Nhận ảnh theo nội dung tệp (không tin phần mở rộng): JPEG, PNG.
const photoKinds = [
  { type: "image/jpeg", signature: [0xff, 0xd8, 0xff] },
  { type: "image/png", signature: [0x89, 0x50, 0x4e, 0x47] },
];

type Row = {
  id: string;
  partner_id: string;
  partner_code: string;
  partner_name: string;
  user_id: string;
  user_name: string;
  visited_at: string;
  latitude: string;
  longitude: string;
  accuracy_meters: string;
  note: string;
  photo_ids: string[] | null;
};

@Injectable()
export class VisitsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async create(actor: Actor, input: z.output<typeof createVisitSchema>, photos: UploadedPhoto[]): Promise<VisitItem> {
    if (!(await this.permissionService.permissionsInCompany(actor.userId, actor.companyId)).includes(visitPermission)) throw new ApiError("FORBIDDEN", "forbidden");
    const fields: Record<string, keyof Messages["errors"]> = {};
    // Chỉ khách hàng đang giao dịch của công ty (QUYTAC_NGHIEPVU_138; phạm vi xem toàn công ty theo QUYTAC_NGHIEPVU_279).
    const customer = await this.database.execute(sql`
      SELECT 1 FROM crm.partners p JOIN crm.partner_profiles pr ON pr.partner_id = p.id AND pr.company_id = ${actor.companyId}
      WHERE p.id = ${input.partnerId} AND p.status = 'active' AND pr.is_customer`);
    if (customer.rows.length === 0) fields.partnerId = "customerNotActive";
    if (photos.length > visitPhotoMaximumCount) fields.photos = "visitTooManyPhotos";
    const kinds = photos.map((photo, index) => {
      const kind = photoKinds.find((item) => item.signature.every((byte, position) => photo.buffer[position] === byte));
      if (photo.size > visitPhotoMaximumBytes) fields[`photos.${index}`] = "visitPhotoTooLarge";
      else if (!kind) fields[`photos.${index}`] = "visitPhotoTypeInvalid";
      return kind?.type ?? "";
    });
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    const id = randomUUID();
    const keys = photos.map(() => `visits/${actor.companyId}/${id}/${randomUUID()}`);
    for (const [index, photo] of photos.entries()) await this.storage.put(keys[index]!, photo.buffer, kinds[index]!);
    await this.database
      .transaction(async (transaction) => {
        await transaction.execute(sql`
          INSERT INTO crm.visits (id, company_id, partner_id, user_id, latitude, longitude, accuracy_meters, note)
          VALUES (${id}, ${actor.companyId}, ${input.partnerId}, ${actor.userId}, ${input.latitude}, ${input.longitude}, ${input.accuracyMeters}, ${input.note})`);
        for (const [index, photo] of photos.entries())
          await transaction.execute(sql`
            INSERT INTO core.attachments (company_id, owner_type, owner_id, file_name, content_type, size_bytes, storage_key, uploaded_by)
            VALUES (${actor.companyId}, 'visit', ${id}, ${`anh-${index + 1}.${kinds[index] === "image/png" ? "png" : "jpg"}`}, ${kinds[index]}, ${photo.size}, ${keys[index]}, ${actor.userId})`);
        await this.auditService.record(
          {
            actorUserId: actor.userId,
            companyId: actor.companyId,
            appCode: "crm",
            entityType: "visit",
            action: "visit.create",
            entityId: id,
            afterData: { partnerId: input.partnerId, photoCount: photos.length },
            ip: actor.client.ip,
            userAgent: actor.client.userAgent,
            requestId: actor.client.requestId,
          },
          transaction,
        );
      })
      .catch(async (error: unknown) => {
        for (const key of keys) await this.storage.remove(key).catch(() => undefined);
        throw error;
      });
    return this.detail(actor, id);
  }

  // Nhân viên đang làm việc của công ty để lọc ghé thăm (QUYTAC_NGHIEPVU_139, 279).
  async staffOptions(actor: Actor): Promise<VisitStaffOptionsResponse> {
    const users = await this.database.execute<{ id: string; full_name: string }>(sql`
      SELECT u.id, u.full_name FROM core.users u JOIN core.user_company_memberships m ON m.user_id = u.id
      WHERE m.company_id = ${actor.companyId} AND m.status = 'active' AND u.status = 'active' ORDER BY u.full_name`);
    return { users: users.rows.map((row) => ({ id: row.id, fullName: row.full_name })) };
  }

  async list(actor: Actor, query: z.output<typeof visitListQuerySchema>): Promise<PageResponse<VisitItem>> {
    const conditions: SQL[] = [sql`v.company_id = ${actor.companyId}`];
    if (query.partnerId) conditions.push(sql`v.partner_id = ${query.partnerId}`);
    if (query.userId) conditions.push(sql`v.user_id = ${query.userId}`);
    if (query.from) conditions.push(sql`v.visited_at >= (${query.from}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
    if (query.to) conditions.push(sql`v.visited_at < ((${query.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM crm.visits v WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<Row>(sql`${this.select()} WHERE ${where} ORDER BY v.visited_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.toItem(row)), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: Actor, id: string): Promise<VisitItem> {
    const row = (await this.database.execute<Row>(sql`${this.select()} WHERE v.id = ${id} AND v.company_id = ${actor.companyId}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return this.toItem(row);
  }

  async photo(actor: Actor, id: string, photoId: string): Promise<{ content: Buffer; contentType: string }> {
    await this.detail(actor, id);
    const file = (
      await this.database.execute<{ storage_key: string; content_type: string }>(sql`
      SELECT storage_key, content_type FROM core.attachments WHERE id = ${photoId} AND owner_type = 'visit' AND owner_id = ${id}`)
    ).rows[0];
    if (!file) throw new ApiError("NOT_FOUND", "notFound");
    return { content: await this.storage.get(file.storage_key), contentType: file.content_type };
  }

  private select(): SQL {
    return sql`SELECT v.id, v.partner_id, p.code AS partner_code, p.name AS partner_name, v.user_id, u.full_name AS user_name, v.visited_at, v.latitude::text, v.longitude::text,
      v.accuracy_meters::text, v.note,
      (SELECT array_agg(a.id ORDER BY a.created_at, a.file_name) FROM core.attachments a WHERE a.owner_type = 'visit' AND a.owner_id = v.id) AS photo_ids
      FROM crm.visits v JOIN crm.partners p ON p.id = v.partner_id JOIN core.users u ON u.id = v.user_id`;
  }

  private toItem(row: Row): VisitItem {
    return {
      id: row.id,
      partnerId: row.partner_id,
      partnerCode: row.partner_code,
      partnerName: row.partner_name,
      userId: row.user_id,
      userName: row.user_name,
      visitedAt: new Date(row.visited_at).toISOString(),
      latitude: trimDecimal(row.latitude),
      longitude: trimDecimal(row.longitude),
      accuracyMeters: trimDecimal(row.accuracy_meters),
      note: row.note,
      photoIds: row.photo_ids ?? [],
    };
  }
}
