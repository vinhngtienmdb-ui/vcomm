// Ví điểm và hạng thành viên (CONG_VIEC_51; QUYTAC_NGHIEPVU_344, 351). Dùng chung cho tích điểm, đổi điểm, bảng hạng, việc nền đầu năm.
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;
export type TierChangeReason = "order_completed" | "year_start" | "tiers_changed";

const currentYear = sql`extract(year FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::int`;

// Tạo ví điểm (hạng thấp nhất) nếu chưa có rồi khóa dòng ví; mọi thay đổi số dư, chi tiêu, hạng đi qua dòng khóa này.
export async function lockAccount(executor: Executor, userId: string): Promise<{ balance: number; locked: boolean; tierId: string | null }> {
  await executor.execute(sql`
    INSERT INTO loyalty.accounts (user_id, tier_id, spend_year)
    VALUES (${userId}, (SELECT id FROM loyalty.tiers ORDER BY sort_order LIMIT 1), ${currentYear}) ON CONFLICT (user_id) DO NOTHING`);
  const row = (
    await executor.execute<{ balance: number; locked: boolean; tier_id: string | null }>(sql`
    SELECT balance, locked, tier_id FROM loyalty.accounts WHERE user_id = ${userId} FOR UPDATE`)
  ).rows[0]!;
  return { balance: row.balance, locked: row.locked, tierId: row.tier_id };
}

// Hạng hiện tại = hạng cao hơn giữa hạng theo chi tiêu năm trước và năm nay (QUYTAC_NGHIEPVU_351); vì mức tăng dần nên bằng hạng theo chi tiêu lớn hơn.
// Ví còn ghi năm cũ thì chuyển năm trước. userId trống: mọi ví (đổi bảng hạng, đầu năm). Trả về các ví đã đổi hạng.
export async function recomputeTiers(executor: Executor, userId: string | null, reason: TierChangeReason): Promise<{ userId: string; fromTierId: string | null; toTierId: string }[]> {
  await executor.execute(sql`
    UPDATE loyalty.accounts SET spend_previous_year = CASE WHEN spend_year = ${currentYear} - 1 THEN spend_current_year ELSE 0 END,
      spend_current_year = 0, spend_year = ${currentYear}, updated_at = now()
    WHERE spend_year < ${currentYear} AND (${userId}::uuid IS NULL OR user_id = ${userId}::uuid)`);
  const changed = await executor.execute<{ user_id: string; from_tier_id: string | null; to_tier_id: string }>(sql`
    WITH target AS (
      SELECT a.user_id, a.tier_id AS old_tier,
        (SELECT t.id FROM loyalty.tiers t WHERE t.min_annual_spend <= greatest(a.spend_current_year, a.spend_previous_year) ORDER BY t.sort_order DESC LIMIT 1) AS new_tier
      FROM loyalty.accounts a WHERE ${userId}::uuid IS NULL OR a.user_id = ${userId}::uuid
    ), updated AS (
      UPDATE loyalty.accounts a SET tier_id = target.new_tier, updated_at = now() FROM target
      WHERE a.user_id = target.user_id AND target.new_tier IS NOT NULL AND a.tier_id IS DISTINCT FROM target.new_tier
      RETURNING a.user_id, target.old_tier, target.new_tier
    )
    INSERT INTO loyalty.tier_history (user_id, from_tier_id, to_tier_id, reason) SELECT user_id, old_tier, new_tier, ${reason} FROM updated
    RETURNING user_id, from_tier_id, to_tier_id`);
  return changed.rows.map((row) => ({ userId: row.user_id, fromTierId: row.from_tier_id, toTierId: row.to_tier_id }));
}
