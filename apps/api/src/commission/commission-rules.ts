// Quy tắc hoa hồng dùng chung, không phụ thuộc dịch vụ khác (CONG_VIEC_17): gán nhân viên khi gửi đơn, mức theo ngành hàng và kênh.
import { sql } from "drizzle-orm";
import type { Database } from "../database/database.module";

type Executor = Pick<Database, "execute">;

// Gửi đơn: gán nhân viên hưởng theo cách gán của công ty (QUYTAC_NGHIEPVU_109). Đơn đã gán giữ nguyên.
// Đơn không có khách (bán lẻ) gán cho người lập đơn; đơn bán cho công ty con trong tập đoàn, đơn đối ứng nội bộ không gán (quyết định người dùng 2026-11-10).
export async function assignCommissionUser(executor: Executor, orderId: string): Promise<void> {
  await executor.execute(sql`
    UPDATE sales.orders o SET commission_user_id = CASE
        WHEN o.customer_id IS NULL OR s.assignment = 'order_creator' THEN o.created_by
        ELSE (SELECT p.owner_user_id FROM crm.partner_profiles p WHERE p.company_id = o.company_id AND p.partner_id = o.customer_id) END
    FROM finance.commission_settings s
    WHERE o.id = ${orderId} AND o.commission_user_id IS NULL AND s.company_id = o.company_id AND s.enabled AND o.order_date >= s.start_date
      AND NOT o.is_counterpart
      AND NOT EXISTS (SELECT 1 FROM crm.partners c WHERE c.id = o.customer_id AND c.company_id IS NOT NULL)`);
}

export interface RateSettings {
  combination: "matrix" | "channel_factor";
  defaultPercent: number;
  rates: Map<string, number>; // khóa `${categoryId}:${channelId ?? ""}`
  factors: Map<string, number>;
  parents: Map<string, string | null>;
}

export async function loadRateSettings(executor: Executor, companyId: string): Promise<RateSettings | null> {
  const settings = (
    await executor.execute<{ combination: "matrix" | "channel_factor"; default_percent: string; enabled: boolean; start_date: string | null }>(sql`
    SELECT combination, default_percent::text, enabled, start_date::text FROM finance.commission_settings WHERE company_id = ${companyId}`)
  ).rows[0];
  if (!settings) return null;
  const rates = await executor.execute<{ category_id: string; channel_id: string | null; percent: string }>(sql`
    SELECT category_id, channel_id, percent::text FROM finance.commission_rates WHERE company_id = ${companyId}`);
  const factors = await executor.execute<{ channel_id: string; factor: string }>(sql`SELECT channel_id, factor::text FROM finance.commission_channel_factors WHERE company_id = ${companyId}`);
  const categories = await executor.execute<{ id: string; parent_id: string | null }>(sql`SELECT id, parent_id FROM catalog.categories`);
  return {
    combination: settings.combination,
    defaultPercent: Number(settings.default_percent),
    rates: new Map(rates.rows.map((row) => [`${row.category_id}:${row.channel_id ?? ""}`, Number(row.percent)])),
    factors: new Map(factors.rows.map((row) => [row.channel_id, Number(row.factor)])),
    parents: new Map(categories.rows.map((row) => [row.id, row.parent_id])),
  };
}

// Phần trăm hoa hồng của một dòng (QUYTAC_NGHIEPVU_108): ngành hàng không có mức thì theo ngành hàng cha gần nhất.
export function commissionPercent(settings: RateSettings, categoryId: string, channelId: string): number {
  const find = (channel: string): number | null => {
    for (let current: string | null = categoryId, depth = 0; current && depth < 10; current = settings.parents.get(current) ?? null, depth++) {
      const value = settings.rates.get(`${current}:${channel}`);
      if (value !== undefined) return value;
    }
    return null;
  };
  if (settings.combination === "matrix") return find(channelId) ?? find("") ?? settings.defaultPercent;
  return Math.round((find("") ?? settings.defaultPercent) * (settings.factors.get(channelId) ?? 1) * 10000) / 10000;
}

// Hệ số theo phần trăm đạt chỉ tiêu: bậc có "từ phần trăm" lớn nhất không vượt phần trăm đạt.
export function tierMultiplier(tiers: { fromPercent: string; multiplier: string }[], achievedPercent: number | null): number {
  if (achievedPercent === null) return 1;
  let multiplier = 1;
  for (const tier of [...tiers].sort((left, right) => Number(left.fromPercent) - Number(right.fromPercent))) if (achievedPercent >= Number(tier.fromPercent)) multiplier = Number(tier.multiplier);
  return multiplier;
}
