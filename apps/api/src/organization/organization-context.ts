// Ngữ cảnh chung của các dịch vụ tổ chức: ghi nhật ký và sự kiện outbox trong cùng giao dịch.
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";
import type { Actor } from "../permissions/roles.service";

export type Executor = Pick<Database, "execute" | "insert">;

export function auditBase(actor: Actor, entityType: string) {
  return { actorUserId: actor.userId, companyId: actor.companyId, appCode: "platform", entityType, ip: actor.client.ip, userAgent: actor.client.userAgent, requestId: actor.client.requestId };
}

export async function recordEvent(executor: Executor, eventType: string, aggregateType: string, aggregateId: string, companyId: string | null, payload: Record<string, unknown>): Promise<void> {
  await executor.execute(sql`
    INSERT INTO core.outbox_events (event_type, aggregate_type, aggregate_id, company_id, payload)
    VALUES (${eventType}, ${aggregateType}, ${aggregateId}, ${companyId}, ${JSON.stringify(payload)}::jsonb)`);
}
