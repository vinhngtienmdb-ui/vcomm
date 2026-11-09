// Ghi thông báo trong ứng dụng (bảng notifications). Gửi email, Zalo ZNS có ở lát sau.
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
    await executor.execute(sql`
      INSERT INTO core.notifications (user_id, company_id, kind, title, link, payload)
      VALUES (${item.userId}, ${item.companyId}, ${item.kind}, ${item.title}, ${item.link ?? null}, ${JSON.stringify(item.payload ?? {})}::jsonb)`);
  }
}
