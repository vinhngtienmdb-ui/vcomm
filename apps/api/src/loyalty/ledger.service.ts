// Sổ cái điểm theo chứng từ nguồn chung (CONG_VIEC_51; CHUC_NANG_179, 180; QUYTAC_NGHIEPVU_344, 346 đến 349, 351).
// Mọi hàm *Within chạy trong giao dịch của bên gọi (đơn VComm; bán, trả hàng tại quầy của CONG_VIEC_53) và khóa dòng ví điểm trước khi đổi số dư.
import { Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { phaseById, phaseOn, type ActivePhase } from "./program.service";
import { lockAccount, recomputeTiers } from "./tiers";

type Executor = Pick<Database, "execute">;
export type SaleSourceType = "marketplace_order" | "retail_sale";
export type LoyaltySourceType = SaleSourceType | "retail_return" | "adjustment";
export type EntryKind = "earn" | "redeem" | "redeem_refund" | "earn_reversal" | "expire" | "adjust_add" | "adjust_subtract";
export type SkipReason = "test_buyer" | "locked" | "inactive" | "no_phase" | "zero";
export type BlockedReason = "no_phase" | "locked" | "inactive" | "insufficient";
type Allocation = { lotId: string; points: number; pointValue: number };

type DocumentRow = {
  company_id: string;
  user_id: string;
  document_date: string;
  goods_amount: string;
  returned_amount: string;
  phase_id: string | null;
  multiplier: string;
  redeemed_points: number;
  redeemed_amount: string;
  refunded_points: number;
  refunded_amount: string;
  expected_points: number;
  earned_points: number | null;
  reversed_points: number;
  shortfall_amount: string;
  earn_status: "pending" | "earned" | "skipped" | "cancelled";
};

export interface ReturnResult {
  refundedPoints: number;
  refundedPointsAmount: number;
  reversedPoints: number;
  shortfallAmount: number;
}

const roundCurrency = (value: number) => Math.round(value);
// Điểm = phần nguyên của giá trị × tỷ lệ tích × hệ số ÷ giá trị một điểm, áp trần mỗi đơn (QUYTAC_NGHIEPVU_346, 347). Làm tròn 6 chữ số trước khi lấy phần nguyên để tránh sai số dấu phẩy động.
export const pointsFor = (value: number, phase: Pick<ActivePhase, "earnPercent" | "pointValue" | "orderCapPoints">, multiplier: number) => {
  const raw = Math.floor(Math.round(((Math.max(value, 0) * phase.earnPercent * multiplier) / 100 / phase.pointValue) * 1e6) / 1e6);
  return phase.orderCapPoints === null ? raw : Math.min(raw, phase.orderCapPoints);
};

// Ghi một bút toán điểm, cập nhật số dư (dòng ví đã khóa); trả mã bút toán.
async function addEntry(
  executor: Executor,
  input: { userId: string; kind: EntryKind; points: number; sourceType: LoyaltySourceType | null; sourceId: string | null; companyId: string | null; allocations: Allocation[] },
): Promise<string> {
  const balance = (
    await executor.execute<{ balance: number }>(sql`UPDATE loyalty.accounts SET balance = balance + ${input.points}, updated_at = now() WHERE user_id = ${input.userId} RETURNING balance`)
  ).rows[0]!.balance;
  const entryId = (
    await executor.execute<{ id: string }>(sql`
    INSERT INTO loyalty.entries (user_id, kind, points, balance_after, source_type, source_id, company_id)
    VALUES (${input.userId}, ${input.kind}, ${input.points}, ${balance}, ${input.sourceType}, ${input.sourceId}::uuid, ${input.companyId}::uuid) RETURNING id`)
  ).rows[0]!.id;
  for (const allocation of input.allocations) {
    await executor.execute(sql`INSERT INTO loyalty.entry_lots (entry_id, lot_id, points, point_value) VALUES (${entryId}, ${allocation.lotId}, ${allocation.points}, ${allocation.pointValue})`);
  }
  return entryId;
}

// Tạo lô và bút toán cộng (tích, điều chỉnh cộng).
export async function creditLot(
  executor: Executor,
  input: {
    userId: string;
    kind: "earn" | "adjust_add";
    sourceType: SaleSourceType | "adjustment";
    sourceId: string;
    companyId: string;
    points: number;
    pointValue: number;
    day: string;
    validityMonths: number;
  },
): Promise<string> {
  const lotId = (
    await executor.execute<{ id: string }>(sql`
    INSERT INTO loyalty.lots (user_id, source_type, source_id, company_id, points, remaining, point_value, earned_on, expires_on)
    VALUES (${input.userId}, ${input.sourceType}, ${input.sourceId}, ${input.companyId}, ${input.points}, ${input.points}, ${input.pointValue}, ${input.day}::date,
      (${input.day}::date + make_interval(months => ${input.validityMonths}))::date) RETURNING id`)
  ).rows[0]!.id;
  return addEntry(executor, { ...input, allocations: [{ lotId, points: input.points, pointValue: input.pointValue }] });
}

// Lấy điểm từ lô hạn sớm nhất trước, cùng hạn thì lô cũ trước (QUYTAC_NGHIEPVU_344); lô ưu tiên (lô của chứng từ bán khi trừ lại) lấy trước hết.
export async function takeFromLots(executor: Executor, userId: string, points: number, preferredLotId: string | null = null): Promise<Allocation[]> {
  const lots = await executor.execute<{ id: string; remaining: number; point_value: string }>(sql`
    SELECT id, remaining, point_value::text FROM loyalty.lots WHERE user_id = ${userId} AND remaining > 0
    ORDER BY (id = ${preferredLotId}::uuid) IS TRUE DESC, expires_on, created_at, id FOR UPDATE`);
  const allocations: Allocation[] = [];
  let left = points;
  for (const lot of lots.rows) {
    if (left === 0) break;
    const taken = Math.min(left, lot.remaining);
    await executor.execute(sql`UPDATE loyalty.lots SET remaining = remaining - ${taken} WHERE id = ${lot.id}`);
    allocations.push({ lotId: lot.id, points: -taken, pointValue: Number(lot.point_value) });
    left -= taken;
  }
  if (left > 0) throw new Error("Lô điểm không khớp số dư ví điểm");
  return allocations;
}

// Chứng từ bán bị hủy trước khi tích: không tích (QUYTAC_NGHIEPVU_347); hoàn điểm đã dùng thêm ở lát L2 (QUYTAC_NGHIEPVU_349).
export async function releaseSalePoints(executor: Executor, sourceType: SaleSourceType, sourceId: string): Promise<void> {
  await executor.execute(sql`UPDATE loyalty.document_points SET earn_status = 'cancelled' WHERE source_type = ${sourceType} AND source_id = ${sourceId} AND earn_status = 'pending'`);
}

@Injectable()
export class LoyaltyLedgerService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  // Tài khoản không được tích, đổi: người mua thử (chỉ không tích), ví khóa, người dùng ngưng hoạt động (QUYTAC_NGHIEPVU_347, 352).
  private async standing(executor: Executor, userId: string): Promise<{ locked: boolean; inactive: boolean; testBuyer: boolean }> {
    const row = (
      await executor.execute<{ locked: boolean; status: string; is_test_buyer: boolean | null }>(sql`
      SELECT a.locked, u.status, b.is_test_buyer FROM loyalty.accounts a JOIN core.users u ON u.id = a.user_id
      LEFT JOIN marketplace.buyer_accounts b ON b.user_id = a.user_id WHERE a.user_id = ${userId}`)
    ).rows[0]!;
    return { locked: row.locked, inactive: row.status !== "active", testBuyer: row.is_test_buyer === true };
  }

  private async multiplierOf(executor: Executor, userId: string): Promise<{ tierId: string | null; multiplier: number }> {
    const row = (
      await executor.execute<{ tier_id: string | null; multiplier: string | null }>(sql`
      SELECT a.tier_id, t.multiplier::text FROM loyalty.accounts a LEFT JOIN loyalty.tiers t ON t.id = a.tier_id WHERE a.user_id = ${userId}`)
    ).rows[0];
    return { tierId: row?.tier_id ?? null, multiplier: Number(row?.multiplier ?? 1) };
  }

  private async document(executor: Executor, sourceType: SaleSourceType, sourceId: string): Promise<DocumentRow | null> {
    return (
      (
        await executor.execute<DocumentRow>(sql`
      SELECT company_id, user_id, document_date::text, goods_amount::text, returned_amount::text, phase_id, multiplier::text, redeemed_points, redeemed_amount::text,
        refunded_points, refunded_amount::text, expected_points, earned_points, reversed_points, shortfall_amount::text, earn_status
      FROM loyalty.document_points WHERE source_type = ${sourceType} AND source_id = ${sourceId} FOR UPDATE`)
      ).rows[0] ?? null
    );
  }

  // Chốt giai đoạn ngày chứng từ, hạng và hệ số lúc đặt hoặc lúc bán (QUYTAC_NGHIEPVU_346); điểm dự kiến theo tiền hàng trừ tiền điểm.
  async snapshotWithin(
    executor: Executor,
    input: { sourceType: SaleSourceType; sourceId: string; userId: string; companyId: string; day: string; goodsAmount: number; redeemedPoints?: number; redeemedAmount?: number },
  ): Promise<{ expectedPoints: number }> {
    await lockAccount(executor, input.userId);
    await recomputeTiers(executor, input.userId, "year_start");
    const phase = await phaseOn(executor, input.day);
    const { tierId, multiplier } = await this.multiplierOf(executor, input.userId);
    const redeemedAmount = input.redeemedAmount ?? 0;
    const expectedPoints = phase ? pointsFor(input.goodsAmount - redeemedAmount, phase, multiplier) : 0;
    await executor.execute(sql`
      INSERT INTO loyalty.document_points (source_type, source_id, company_id, user_id, document_date, goods_amount, phase_id, tier_id, multiplier, redeemed_points, redeemed_amount, expected_points)
      VALUES (${input.sourceType}, ${input.sourceId}, ${input.companyId}, ${input.userId}, ${input.day}::date, ${input.goodsAmount}, ${phase?.id ?? null}, ${tierId}, ${multiplier},
        ${input.redeemedPoints ?? 0}, ${redeemedAmount}, ${expectedPoints})`);
    return { expectedPoints };
  }

  // Tích điểm (QUYTAC_NGHIEPVU_347): đơn VComm gọi khi hoàn tất với giá trị hoàn tất; bán tại quầy gọi ngay sau khi bán với tiền hàng gồm thuế.
  // Giá trị tích = tiền hàng − tiền điểm đã dùng còn lại; chi tiêu năm cộng tiền hàng (QUYTAC_NGHIEPVU_351).
  async earnWithin(
    executor: Executor,
    input: { sourceType: SaleSourceType; sourceId: string; userId: string; companyId: string; day: string; goodsAmount: number },
  ): Promise<{ points: number; skipReason: SkipReason | null }> {
    await lockAccount(executor, input.userId);
    let document = await this.document(executor, input.sourceType, input.sourceId);
    if (!document) {
      await this.snapshotWithin(executor, input);
      document = (await this.document(executor, input.sourceType, input.sourceId))!;
    }
    if (document.earn_status !== "pending") return { points: document.earned_points ?? 0, skipReason: null };
    const earningValue = Math.max(input.goodsAmount - (Number(document.redeemed_amount) - Number(document.refunded_amount)), 0);
    const standing = await this.standing(executor, input.userId);
    const phase = document.phase_id ? await phaseById(executor, document.phase_id) : null;
    let points = phase ? pointsFor(earningValue, phase, Number(document.multiplier)) : 0;
    if (phase && phase.monthlyCapPoints !== null && points > 0) {
      const used = (
        await executor.execute<{ total: number }>(sql`
        SELECT coalesce(sum(earned_points), 0)::int AS total FROM loyalty.document_points
        WHERE user_id = ${input.userId} AND earn_status = 'earned' AND date_trunc('month', earned_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = date_trunc('month', ${input.day}::date)`)
      ).rows[0]!.total;
      points = Math.min(points, Math.max(phase.monthlyCapPoints - used, 0));
    }
    const skipReason: SkipReason | null = standing.testBuyer ? "test_buyer" : standing.locked ? "locked" : standing.inactive ? "inactive" : !phase ? "no_phase" : points <= 0 ? "zero" : null;
    await executor.execute(sql`
      UPDATE loyalty.document_points SET earn_status = ${skipReason ? "skipped" : "earned"}, skip_reason = ${skipReason}, earned_points = ${skipReason ? null : points},
        earned_value = ${earningValue}, earned_at = now() WHERE source_type = ${input.sourceType} AND source_id = ${input.sourceId}`);
    if (!skipReason) {
      await creditLot(executor, {
        userId: input.userId,
        kind: "earn",
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        companyId: input.companyId,
        points,
        pointValue: phase!.pointValue,
        day: input.day,
        validityMonths: phase!.validityMonths,
      });
    }
    await this.addSpend(executor, input.userId, input.companyId, input.goodsAmount);
    if (!skipReason) {
      await notify(executor, [
        {
          userId: input.userId,
          companyId: input.companyId,
          kind: "loyalty.earned",
          title: `Bạn được cộng ${points.toLocaleString("vi-VN")} điểm thưởng`,
          payload: { sourceType: input.sourceType, sourceId: input.sourceId, points },
        },
      ]);
    }
    return { points: skipReason ? 0 : points, skipReason };
  }

  // Chi tiêu năm nay đổi (cộng khi tích, trừ khi trả hàng tại quầy); lên hạng thì báo người mua (QUYTAC_NGHIEPVU_351).
  private async addSpend(executor: Executor, userId: string, companyId: string, amount: number): Promise<void> {
    await recomputeTiers(executor, userId, "year_start");
    await executor.execute(sql`UPDATE loyalty.accounts SET spend_current_year = greatest(spend_current_year + ${amount}::numeric, 0), updated_at = now() WHERE user_id = ${userId}`);
    const changed = await recomputeTiers(executor, userId, "order_completed");
    for (const change of changed) {
      const tiers = await executor.execute<{ id: string; sort_order: number; name_vi: string }>(sql`
        SELECT id, sort_order, name_vi FROM loyalty.tiers WHERE id IN (${change.toTierId}, ${change.fromTierId ?? change.toTierId})`);
      const to = tiers.rows.find((tier) => tier.id === change.toTierId)!;
      const from = tiers.rows.find((tier) => tier.id === change.fromTierId);
      if (!from || to.sort_order > from.sort_order) {
        await notify(executor, [{ userId, companyId, kind: "loyalty.tier_up", title: `Chúc mừng bạn lên hạng ${to.name_vi}`, payload: { tierId: to.id } }]);
      }
    }
  }
}
