// Báo cáo, cảnh báo của cửa hàng liên kết (CONG_VIEC_55; CHUC_NANG_196; QUYTAC_NGHIEPVU_405; API_213).
// Chỉ tiêu tính trên giao dịch hoàn tất theo ngày hoàn tất (giờ Việt Nam); giao dịch đã hủy chỉ đếm số hủy.
// Cảnh báo tính trong 7 ngày gần nhất, chỉ cảnh báo, không tự chặn; dư nợ từ 80 % hạn mức báo trong ứng dụng cho chủ cửa hàng mỗi ngày một lần.
import { Inject, Injectable } from "@nestjs/common";
import type {
  AffiliateAlert,
  AffiliateAlertKind,
  AffiliateCompanyReport,
  AffiliateExposure,
  AffiliateReportMetrics,
  affiliateAlertQuerySchema,
  affiliateReportQuerySchema,
  MerchantPortalReport,
} from "contracts";
import { type SQL, sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { vietnamToday } from "../marketplace/shop.service";
import { requireOwner, type PortalMember } from "./portal.service";
import { merchantExposure } from "./transactions.service";

type Executor = Pick<Database, "execute">;
type ReportQuery = z.infer<typeof affiliateReportQuerySchema>;

type MetricsRow = {
  transactions: number;
  bill_amount: string;
  customers: number;
  new_customers: number;
  earned_points: number;
  earned_amount: string;
  redeemed_points: number;
  redeemed_amount: string;
  vouchers_used: number;
  cancelled: number;
};

// Giao dịch hoàn tất hoặc đã hủy kèm ngày hoàn tất và cờ lần đầu khách giao dịch hoàn tất tại cửa hàng (tính trên toàn bộ lịch sử).
const base = (merchantFilter: SQL) => sql`
  WITH base AS (
    SELECT t.*, (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
      (t.status = 'completed' AND t.completed_at = min(t.completed_at) FILTER (WHERE t.status = 'completed') OVER (PARTITION BY t.merchant_id, t.buyer_user_id)) AS first_visit
    FROM affiliate.transactions t WHERE t.status IN ('completed', 'cancelled') AND ${merchantFilter}
  )`;

const metricsSelect = sql`
  count(*) FILTER (WHERE status = 'completed')::int AS transactions,
  coalesce(sum(bill_amount) FILTER (WHERE status = 'completed'), 0)::text AS bill_amount,
  count(DISTINCT buyer_user_id) FILTER (WHERE status = 'completed')::int AS customers,
  count(DISTINCT buyer_user_id) FILTER (WHERE first_visit)::int AS new_customers,
  coalesce(sum(earned_points) FILTER (WHERE status = 'completed'), 0)::int AS earned_points,
  coalesce(sum(earned_amount) FILTER (WHERE status = 'completed'), 0)::text AS earned_amount,
  coalesce(sum(redeemed_points) FILTER (WHERE status = 'completed'), 0)::int AS redeemed_points,
  coalesce(sum(redeemed_amount) FILTER (WHERE status = 'completed'), 0)::text AS redeemed_amount,
  count(voucher_code_id) FILTER (WHERE status = 'completed')::int AS vouchers_used,
  count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled`;

function metricsOf(row: MetricsRow | undefined): AffiliateReportMetrics {
  return {
    transactions: row?.transactions ?? 0,
    billAmount: trimDecimal(row?.bill_amount ?? "0"),
    customers: row?.customers ?? 0,
    newCustomers: row?.new_customers ?? 0,
    earnedPoints: row?.earned_points ?? 0,
    earnedAmount: trimDecimal(row?.earned_amount ?? "0"),
    redeemedPoints: row?.redeemed_points ?? 0,
    redeemedAmount: trimDecimal(row?.redeemed_amount ?? "0"),
    vouchersUsed: row?.vouchers_used ?? 0,
    cancelled: row?.cancelled ?? 0,
  };
}

// Dư nợ so với hạn mức (QUYTAC_NGHIEPVU_398, 405).
export async function exposureOf(executor: Executor, merchantId: string, creditLimit: string): Promise<AffiliateExposure> {
  const amount = await merchantExposure(executor, merchantId);
  const limit = Number(creditLimit);
  return {
    amount: String(Math.round(amount)),
    creditLimit: trimDecimal(creditLimit),
    remaining: String(Math.max(Math.round(limit - amount), 0)),
    percent: limit > 0 ? ((amount * 100) / limit).toFixed(1) : "0",
  };
}

// Số điện thoại đã che: 0903 *** 789.
const maskPhone = (phone: string | null) => (phone ? `0${phone.slice(3, 6)} *** ${phone.slice(-3)}` : null);

@Injectable()
export class AffiliateReportsService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Cổng cửa hàng (chủ cửa hàng): theo ngày, tuần, tháng, điểm bán; dư nợ, hạn mức còn lại.
  async merchantReport(member: PortalMember, query: ReportQuery): Promise<MerchantPortalReport> {
    requireOwner(member);
    const filter = sql`t.merchant_id = ${member.merchantId}`;
    const where = sql`day BETWEEN ${query.from}::date AND ${query.to}::date ${query.outletId ? sql`AND outlet_id = ${query.outletId}` : sql``}`;
    const period = query.groupBy === "month" ? sql`to_char(day, 'YYYY-MM')` : query.groupBy === "week" ? sql`date_trunc('week', day)::date::text` : sql`day::text`;
    const rows = await this.database.execute<MetricsRow & { period: string }>(sql`
      ${base(filter)} SELECT ${period} AS period, ${metricsSelect} FROM base WHERE ${where} GROUP BY 1 ORDER BY 1 DESC`);
    const totals = (await this.database.execute<MetricsRow>(sql`${base(filter)} SELECT ${metricsSelect} FROM base WHERE ${where}`)).rows[0];
    const limit = (await this.database.execute<{ credit_limit: string }>(sql`SELECT credit_limit::text FROM affiliate.merchants WHERE id = ${member.merchantId}`)).rows[0]!;
    return {
      totals: metricsOf(totals),
      rows: rows.rows.map((row) => ({ period: row.period, ...metricsOf(row) })),
      exposure: await exposureOf(this.database, member.merchantId, limit.credit_limit),
    };
  }

  // Web quản trị: cùng chỉ tiêu theo cửa hàng, phí dịch vụ của bảng đối soát có tuần bắt đầu trong kỳ, dư nợ.
  async companyReport(companyId: string, query: ReportQuery): Promise<AffiliateCompanyReport> {
    const filter = sql`t.merchant_id IN (SELECT id FROM affiliate.merchants WHERE company_id = ${companyId}) ${query.merchantId ? sql`AND t.merchant_id = ${query.merchantId}` : sql``}`;
    const where = sql`day BETWEEN ${query.from}::date AND ${query.to}::date`;
    const merchants = await this.database.execute<{ id: string; code: string; name: string; credit_limit: string; fee_amount: string }>(sql`
      SELECT m.id, m.code, p.name, m.credit_limit::text,
        coalesce((SELECT sum(s.fee_amount) FROM affiliate.settlements s WHERE s.merchant_id = m.id AND s.week_start BETWEEN ${query.from}::date AND ${query.to}::date), 0)::text AS fee_amount
      FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id
      WHERE m.company_id = ${companyId} AND m.status <> 'draft' ${query.merchantId ? sql`AND m.id = ${query.merchantId}` : sql``}
      ORDER BY p.name`);
    const metrics = new Map(
      (await this.database.execute<MetricsRow & { merchant_id: string }>(sql`${base(filter)} SELECT merchant_id, ${metricsSelect} FROM base WHERE ${where} GROUP BY 1`)).rows.map((row) => [
        row.merchant_id,
        row,
      ]),
    );
    const totals = (await this.database.execute<MetricsRow>(sql`${base(filter)} SELECT ${metricsSelect} FROM base WHERE ${where}`)).rows[0];
    const rows = [];
    let fee = 0;
    for (const merchant of merchants.rows) {
      fee += Number(merchant.fee_amount);
      rows.push({
        merchantId: merchant.id,
        merchantCode: merchant.code,
        merchantName: merchant.name,
        feeAmount: trimDecimal(merchant.fee_amount),
        exposure: await exposureOf(this.database, merchant.id, merchant.credit_limit),
        ...metricsOf(metrics.get(merchant.id)),
      });
    }
    return { totals: { ...metricsOf(totals), feeAmount: String(fee) }, rows };
  }

  // Cảnh báo bất thường (QUYTAC_NGHIEPVU_405), 7 ngày gần nhất tính cả hôm nay.
  async alerts(companyId: string, query: z.infer<typeof affiliateAlertQuerySchema>): Promise<AffiliateAlert[]> {
    const today = await vietnamToday(this.database);
    const merchantFilter = sql`m.company_id = ${companyId} ${query.merchantId ? sql`AND m.id = ${query.merchantId}` : sql``}`;
    const since = sql`(${today}::date - 6)`;
    const want = (kind: AffiliateAlertKind) => !query.kind || query.kind === kind;
    const empty = { day: null, count: null, total: null, percent: null, buyerPhone: null, cashierName: null, amount: null, limit: null };
    const alerts: AffiliateAlert[] = [];
    if (want("same_buyer_burst")) {
      const rows = await this.database.execute<{ merchant_id: string; name: string; day: string; count: number; phone: string | null }>(sql`
        SELECT t.merchant_id, p.name, (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day, count(*)::int AS count, u.phone
        FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id JOIN core.users u ON u.id = t.buyer_user_id
        WHERE ${merchantFilter} AND t.status = 'completed' AND (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${since}
        GROUP BY t.merchant_id, p.name, 3, t.buyer_user_id, u.phone HAVING count(*) >= 3 ORDER BY 3 DESC, 4 DESC`);
      for (const row of rows.rows)
        alerts.push({ ...empty, kind: "same_buyer_burst", merchantId: row.merchant_id, merchantName: row.name, day: row.day, count: row.count, buyerPhone: maskPhone(row.phone) });
    }
    if (want("near_cap")) {
      const rows = await this.database.execute<{ merchant_id: string; name: string; count: number; total: number; cap: string }>(sql`
        SELECT t.merchant_id, p.name, count(*) FILTER (WHERE t.bill_amount >= m.transaction_cap * 0.8)::int AS count, count(*)::int AS total, m.transaction_cap::text AS cap
        FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id
        WHERE ${merchantFilter} AND t.status = 'completed' AND (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${since}
        GROUP BY t.merchant_id, p.name, m.transaction_cap HAVING count(*) FILTER (WHERE t.bill_amount >= m.transaction_cap * 0.8) * 10 >= count(*) * 3`);
      for (const row of rows.rows)
        alerts.push({
          ...empty,
          kind: "near_cap",
          merchantId: row.merchant_id,
          merchantName: row.name,
          count: row.count,
          total: row.total,
          percent: ((row.count * 100) / row.total).toFixed(1),
          limit: trimDecimal(row.cap),
        });
    }
    if (want("cancel_rate")) {
      const rows = await this.database.execute<{ merchant_id: string; name: string; count: number; total: number }>(sql`
        SELECT t.merchant_id, p.name, count(*) FILTER (WHERE t.status = 'cancelled')::int AS count, count(*)::int AS total
        FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id
        WHERE ${merchantFilter} AND t.status IN ('completed', 'cancelled') AND (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${since}
        GROUP BY t.merchant_id, p.name HAVING count(*) >= 10 AND count(*) FILTER (WHERE t.status = 'cancelled') * 5 >= count(*)`);
      for (const row of rows.rows)
        alerts.push({ ...empty, kind: "cancel_rate", merchantId: row.merchant_id, merchantName: row.name, count: row.count, total: row.total, percent: ((row.count * 100) / row.total).toFixed(1) });
    }
    if (want("phone_declines")) {
      const rows = await this.database.execute<{ merchant_id: string; name: string; day: string; count: number; cashier: string }>(sql`
        SELECT t.merchant_id, p.name, (t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS day, count(*)::int AS count, coalesce(u.full_name, k.name) AS cashier
        FROM affiliate.transactions t JOIN affiliate.merchants m ON m.id = t.merchant_id JOIN crm.partners p ON p.id = m.partner_id
          -- Giao dịch qua Open API không có thu ngân: gom theo khóa, hiện tên khóa (CONG_VIEC_67).
          LEFT JOIN core.users u ON u.id = t.cashier_user_id LEFT JOIN core.api_keys k ON k.id = t.api_key_id
        WHERE ${merchantFilter} AND t.method = 'phone' AND t.status IN ('declined', 'expired') AND (t.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${since}
        GROUP BY t.merchant_id, p.name, 3, t.cashier_user_id, t.api_key_id, u.full_name, k.name HAVING count(*) >= 10 ORDER BY 3 DESC`);
      for (const row of rows.rows) alerts.push({ ...empty, kind: "phone_declines", merchantId: row.merchant_id, merchantName: row.name, day: row.day, count: row.count, cashierName: row.cashier });
    }
    if (want("credit_usage")) {
      for (const merchant of await this.creditUsage(this.database, merchantFilter)) {
        alerts.push({
          ...empty,
          kind: "credit_usage",
          merchantId: merchant.id,
          merchantName: merchant.name,
          amount: merchant.exposure.amount,
          limit: merchant.exposure.creditLimit,
          percent: merchant.exposure.percent,
        });
      }
    }
    return alerts;
  }

  // Cửa hàng đang hoạt động có dư nợ từ 80 % hạn mức.
  private async creditUsage(executor: Executor, merchantFilter: SQL): Promise<{ id: string; name: string; company_id: string; exposure: AffiliateExposure }[]> {
    const merchants = await executor.execute<{ id: string; name: string; company_id: string; credit_limit: string }>(sql`
      SELECT m.id, p.name, m.company_id, m.credit_limit::text FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id WHERE ${merchantFilter} AND m.status = 'active'`);
    const result = [];
    for (const merchant of merchants.rows) {
      const exposure = await exposureOf(executor, merchant.id, merchant.credit_limit);
      if (Number(exposure.percent) >= 80) result.push({ ...merchant, exposure });
    }
    return result;
  }

  // Việc nền hằng ngày: báo trong ứng dụng cho chủ cửa hàng khi dư nợ từ 80 % hạn mức (mỗi cửa hàng một lần một ngày).
  async notifyCreditUsage(): Promise<number> {
    let sent = 0;
    for (const merchant of await this.creditUsage(this.database, sql`true`)) {
      await this.database.transaction(async (transaction) => {
        const owners = await transaction.execute<{ user_id: string }>(sql`
          SELECT user_id FROM affiliate.members mb WHERE mb.merchant_id = ${merchant.id} AND mb.role = 'owner' AND mb.status = 'active'
            AND NOT EXISTS (SELECT 1 FROM core.notifications n WHERE n.user_id = mb.user_id AND n.kind = 'affiliate.credit_usage'
              AND n.payload->>'merchantId' = ${merchant.id} AND n.created_at > now() - interval '20 hours')`);
        await notify(
          transaction,
          owners.rows.map((owner) => ({
            userId: owner.user_id,
            companyId: merchant.company_id,
            kind: "affiliate.credit_usage",
            title: `Dư nợ với VComm đã đạt ${merchant.exposure.percent.replace(".", ",")} % hạn mức`,
            payload: { merchantId: merchant.id, amount: merchant.exposure.amount, limit: merchant.exposure.creditLimit },
          })),
        );
        sent += owners.rows.length;
      });
    }
    return sent;
  }
}
