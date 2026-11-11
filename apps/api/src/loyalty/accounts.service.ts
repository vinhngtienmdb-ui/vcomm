// Ví điểm: điểm của tôi, hạng thành viên trên ứng dụng; điểm của chứng từ (CONG_VIEC_51; CHUC_NANG_179; API_177).
import { Inject, Injectable } from "@nestjs/common";
import type { BuyerLoyaltyResponse, LoyaltyDocumentPoints, LoyaltyEntryItem, LoyaltyTier, LoyaltyTierProgress, PageResponse } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { DATABASE, type Database } from "../database/database.module";
import { vietnamToday } from "../marketplace/shop.service";
import type { SaleSourceType } from "./ledger.service";
import { LoyaltyProgramService, phaseOn } from "./program.service";
import { recomputeTiers } from "./tiers";

type Executor = Pick<Database, "execute">;

type EntryRow = {
  id: string;
  kind: LoyaltyEntryItem["kind"];
  points: number;
  balance_after: number;
  source_type: LoyaltyEntryItem["sourceType"];
  source_id: string | null;
  document_no: string | null;
  expires_on: string | null;
  created_at: Date;
};

const entryOf = (row: EntryRow): LoyaltyEntryItem => ({
  id: row.id,
  kind: row.kind,
  points: row.points,
  balanceAfter: row.balance_after,
  sourceType: row.source_type,
  sourceId: row.source_id,
  documentNo: row.document_no,
  expiresOn: row.expires_on,
  createdAt: new Date(row.created_at).toISOString(),
});

@Injectable()
export class LoyaltyAccountsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly program: LoyaltyProgramService,
  ) {}

  // Hạng hiện tại và tiến độ lên hạng; người chưa có ví điểm ở hạng thấp nhất.
  async progress(executor: Executor, userId: string, tiers: LoyaltyTier[]): Promise<LoyaltyTierProgress> {
    const row = (
      await executor.execute<{ tier_id: string | null; spend_current_year: string; spend_previous_year: string; spend_year: number }>(sql`
      SELECT tier_id, spend_current_year::text, spend_previous_year::text, spend_year FROM loyalty.accounts WHERE user_id = ${userId}`)
    ).rows[0];
    const year = Number((await vietnamToday(executor)).slice(0, 4));
    // Ví còn ghi năm cũ (chưa có việc nền đầu năm chạy): hiển thị như đã chuyển năm.
    const current = row && row.spend_year === year ? Number(row.spend_current_year) : 0;
    const previous = !row ? 0 : row.spend_year === year ? Number(row.spend_previous_year) : row.spend_year === year - 1 ? Number(row.spend_current_year) : 0;
    const reached = Math.max(current, previous);
    const tier = [...tiers].reverse().find((item) => Number(item.minAnnualSpend) <= reached) ?? tiers[0] ?? null;
    const nextTier = tier ? (tiers.find((item) => item.sortOrder > tier.sortOrder && Number(item.minAnnualSpend) > current) ?? null) : null;
    return {
      tier,
      year,
      spendCurrentYear: trimDecimal(String(current)),
      spendPreviousYear: trimDecimal(String(previous)),
      nextTier,
      remainingToNext: nextTier ? trimDecimal(String(Number(nextTier.minAnnualSpend) - current)) : null,
    };
  }

  // API_177: điểm của tôi (MAN_HINH_151, 152).
  async buyerSummary(userId: string): Promise<BuyerLoyaltyResponse> {
    const today = await vietnamToday(this.database);
    const tiers = await this.program.tiers(this.database);
    const account = (await this.database.execute<{ balance: number; locked: boolean }>(sql`SELECT balance, locked FROM loyalty.accounts WHERE user_id = ${userId}`)).rows[0];
    const expiring = (
      await this.database.execute<{ points: number; first_on: string | null }>(sql`
      SELECT coalesce(sum(remaining), 0)::int AS points, min(expires_on)::text AS first_on FROM loyalty.lots
      WHERE user_id = ${userId} AND remaining > 0 AND expires_on BETWEEN ${today}::date AND ${today}::date + 30`)
    ).rows[0]!;
    const phase = await phaseOn(this.database, today);
    return {
      ...(await this.progress(this.database, userId, tiers)),
      balance: account?.balance ?? 0,
      locked: account?.locked ?? false,
      pointValue: phase ? trimDecimal(String(phase.pointValue)) : null,
      expiringPoints: expiring.points,
      expiringOn: expiring.first_on,
      tiers,
    };
  }

  async entries(userId: string, query: { page: number; pageSize: number }): Promise<PageResponse<LoyaltyEntryItem>> {
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM loyalty.entries WHERE user_id = ${userId}`)).rows[0]!.total;
    const rows = await this.database.execute<EntryRow>(sql`
      SELECT e.id, e.kind, e.points, e.balance_after, e.source_type, e.source_id, e.created_at,
        CASE e.source_type WHEN 'marketplace_order' THEN (SELECT so.document_no FROM marketplace.orders m JOIN sales.orders so ON so.id = m.sales_order_id WHERE m.id = e.source_id)
          END AS document_no,
        CASE WHEN e.points > 0 THEN (SELECT max(l.expires_on)::text FROM loyalty.entry_lots el JOIN loyalty.lots l ON l.id = el.lot_id WHERE el.entry_id = e.id) END AS expires_on
      FROM loyalty.entries e WHERE e.user_id = ${userId}
      ORDER BY e.created_at DESC, e.id LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(entryOf), total, page: query.page, pageSize: query.pageSize };
  }

  // Điểm của một chứng từ bán (chi tiết đơn VComm trên ứng dụng và web).
  async documentPoints(executor: Executor, sourceType: SaleSourceType, sourceId: string): Promise<LoyaltyDocumentPoints | null> {
    const row = (
      await executor.execute<{
        redeemed_points: number;
        redeemed_amount: string;
        refunded_points: number;
        expected_points: number;
        earned_points: number | null;
        earn_status: LoyaltyDocumentPoints["earnStatus"];
        skip_reason: LoyaltyDocumentPoints["skipReason"];
        expires_on: string | null;
        tier_name: string | null;
        multiplier: string;
        earn_percent: string | null;
        point_value: string | null;
      }>(sql`
      SELECT d.redeemed_points, d.redeemed_amount::text, d.refunded_points, d.expected_points, d.earned_points, d.earn_status, d.skip_reason,
        (SELECT l.expires_on::text FROM loyalty.lots l WHERE l.source_type = d.source_type AND l.source_id = d.source_id) AS expires_on,
        t.name_vi AS tier_name, d.multiplier::text, p.earn_percent::text, p.point_value::text
      FROM loyalty.document_points d LEFT JOIN loyalty.tiers t ON t.id = d.tier_id LEFT JOIN loyalty.program_phases p ON p.id = d.phase_id
      WHERE d.source_type = ${sourceType} AND d.source_id = ${sourceId}`)
    ).rows[0];
    if (!row) return null;
    return {
      redeemedPoints: row.redeemed_points,
      redeemedAmount: trimDecimal(row.redeemed_amount),
      refundedPoints: row.refunded_points,
      expectedPoints: row.expected_points,
      earnedPoints: row.earned_points,
      earnStatus: row.earn_status,
      skipReason: row.skip_reason,
      expiresOn: row.expires_on,
      tierName: row.tier_name,
      multiplier: trimDecimal(row.multiplier),
      earnPercent: row.earn_percent === null ? null : trimDecimal(row.earn_percent),
      pointValue: row.point_value === null ? null : trimDecimal(row.point_value),
    };
  }

  // Việc nền đầu năm (QUYTAC_NGHIEPVU_351): chuyển chi tiêu sang năm trước, xét lại hạng mọi ví điểm.
  async yearStart(): Promise<number> {
    return this.database.transaction(async (transaction) => (await recomputeTiers(transaction, null, "year_start")).length);
  }
}
