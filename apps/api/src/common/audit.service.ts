// Nhật ký thao tác chỉ thêm (QUYTAC_NGHIEPVU_30, CHUC_NANG_23).
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.module";
import { auditEvents } from "../database/schema";

export interface AuditEntry {
  actorUserId: string | null;
  companyId?: string | null;
  appCode: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async record(entry: AuditEntry, executor: Pick<Database, "insert"> = this.database): Promise<void> {
    await executor.insert(auditEvents).values({
      actorUserId: entry.actorUserId,
      companyId: entry.companyId ?? null,
      appCode: entry.appCode,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      beforeData: entry.beforeData ?? null,
      afterData: entry.afterData ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
      requestId: entry.requestId ?? null,
      // clock_timestamp: nhiều thao tác trong cùng giao dịch vẫn giữ đúng thứ tự trên nhật ký (LOI_08, như LOI_06).
      occurredAt: sql`clock_timestamp()`,
    });
  }
}
