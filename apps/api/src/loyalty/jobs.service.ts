// Việc nền điểm thưởng (CONG_VIEC_51; QUYTAC_NGHIEPVU_350, 351): hết hạn lô, nhắc trước 30 ngày, chuyển năm chi tiêu và xét lại hạng; chạy lúc 0 giờ 10 phút giờ Việt Nam.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { vietnamToday } from "../marketplace/shop.service";
import { expireLot } from "./ledger.service";
import { recomputeTiers } from "./tiers";

@Injectable()
export class LoyaltyJobsService {
  private readonly logger = new Logger(LoyaltyJobsService.name);

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async runDaily(): Promise<{ expiredLots: number; reminded: number; tierChanges: number }> {
    const expiredLots = await this.expireDue();
    const reminded = await this.remindExpiring();
    const tierChanges = await this.database.transaction(async (transaction) => (await recomputeTiers(transaction, null, "year_start")).length);
    return { expiredLots, reminded, tierChanges };
  }

  // Mỗi lần tối đa 1.000 lô; mỗi lô một giao dịch để một lô lỗi (kỳ kế toán đã khóa) không chặn lô khác.
  async expireDue(): Promise<number> {
    const today = await vietnamToday(this.database);
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM loyalty.lots WHERE remaining > 0 AND expires_on < ${today}::date ORDER BY expires_on, id LIMIT 1000`);
    let expired = 0;
    for (const lot of due.rows) {
      try {
        if ((await this.database.transaction((transaction) => expireLot(transaction, lot.id, today))) > 0) expired += 1;
      } catch (error) {
        this.logger.error(`Không ghi hết hạn được lô điểm ${lot.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return expired;
  }

  // Lô còn điểm, hạn trong 30 ngày tới: thông báo một lần mỗi lô.
  async remindExpiring(): Promise<number> {
    const today = await vietnamToday(this.database);
    return this.database.transaction(async (transaction) => {
      const lots = await transaction.execute<{ id: string; user_id: string; company_id: string; remaining: number; expires_on: string }>(sql`
        UPDATE loyalty.lots SET expiry_notified_at = now()
        WHERE id IN (SELECT id FROM loyalty.lots WHERE remaining > 0 AND expiry_notified_at IS NULL AND expires_on BETWEEN ${today}::date AND ${today}::date + 30 LIMIT 1000 FOR UPDATE SKIP LOCKED)
        RETURNING id, user_id, company_id, remaining, expires_on::text`);
      await notify(
        transaction,
        lots.rows.map((lot) => ({
          userId: lot.user_id,
          companyId: lot.company_id,
          kind: "loyalty.expiring",
          title: `${lot.remaining.toLocaleString("vi-VN")} điểm thưởng sẽ hết hạn ngày ${lot.expires_on.split("-").reverse().join("/")}`,
          payload: { lotId: lot.id, points: lot.remaining, expiresOn: lot.expires_on },
        })),
      );
      return lots.rows.length;
    });
  }
}
