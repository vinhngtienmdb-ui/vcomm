// Đẩy sự kiện outbox tới nơi nhận trong tiến trình (QUYTAC_NGHIEPVU_25). Sự kiện chưa có nơi nhận vẫn đánh dấu đã đẩy.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DATABASE, type Database } from "../database/database.module";

export interface OutboxEvent {
  id: number;
  eventType: string;
  aggregateId: string;
  companyId: string | null;
  payload: Record<string, unknown>;
}

type Handler = (event: OutboxEvent) => Promise<void>;

@Injectable()
export class OutboxService {
  private readonly handlers = new Map<string, Handler[]>();
  private readonly logger = new Logger("Outbox");

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  subscribe(eventType: string, handler: Handler): () => void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
    return () => this.handlers.set(eventType, (this.handlers.get(eventType) ?? []).filter((item) => item !== handler));
  }

  // Khóa từng dòng để nhiều tiến trình chạy song song không đẩy trùng.
  async dispatchPending(limit = 100): Promise<number> {
    return this.database.transaction(async (transaction) => {
      const rows = await transaction.execute<{ id: number; event_type: string; aggregate_id: string; company_id: string | null; payload: Record<string, unknown> }>(sql`
        SELECT id, event_type, aggregate_id, company_id, payload FROM core.outbox_events
        WHERE published_at IS NULL ORDER BY id LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
      for (const row of rows.rows) {
        const event = { id: Number(row.id), eventType: row.event_type, aggregateId: row.aggregate_id, companyId: row.company_id, payload: row.payload };
        try {
          for (const handler of this.handlers.get(row.event_type) ?? []) await handler(event);
          await transaction.execute(sql`UPDATE core.outbox_events SET published_at = now(), attempts = attempts + 1 WHERE id = ${row.id}`);
        } catch (error) {
          this.logger.error(`Sự kiện ${row.id} ${row.event_type}: ${(error as Error).message}`);
          await transaction.execute(sql`UPDATE core.outbox_events SET attempts = attempts + 1, last_error = ${(error as Error).message} WHERE id = ${row.id}`);
        }
      }
      return rows.rows.length;
    });
  }
}
