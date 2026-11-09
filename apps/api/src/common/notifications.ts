// Ghi thông báo trong ứng dụng (bảng notifications) kèm sự kiện outbox `core.notification.created` trong cùng giao dịch;
// bộ gửi Zalo ZNS nhận sự kiện sau khi giao dịch ghi xong (CHUC_NANG_26).
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";

export interface NotificationInput {
  userId: string;
  companyId: string | null;
  kind: string;
  title: string;
  link?: string | null;
  payload?: Record<string, unknown>;
}

export async function notify(executor: Pick<Database, "execute">, items: NotificationInput[]): Promise<void> {
  for (const item of items) {
    const inserted = await executor.execute<{ id: string }>(sql`
      INSERT INTO core.notifications (user_id, company_id, kind, title, link, payload)
      VALUES (${item.userId}, ${item.companyId}, ${item.kind}, ${item.title}, ${item.link ?? null}, ${JSON.stringify(item.payload ?? {})}::jsonb) RETURNING id`);
    const id = inserted.rows[0]!.id;
    await executor.execute(sql`
      INSERT INTO core.outbox_events (event_type, aggregate_type, aggregate_id, company_id, payload)
      VALUES ('core.notification.created', 'notification', ${id}, ${item.companyId}, ${JSON.stringify({ notificationId: id, kind: item.kind })}::jsonb)`);
  }
}
