// Sổ cái điểm theo chứng từ nguồn chung (CONG_VIEC_51; CHUC_NANG_179, 180; QUYTAC_NGHIEPVU_344, 346 đến 349, 351).
// Mọi hàm *Within chạy trong giao dịch của bên gọi (đơn VComm; bán, trả hàng tại quầy của CONG_VIEC_53) và khóa dòng ví điểm trước khi đổi số dư.
import { Inject, Injectable } from "@nestjs/common";
import type { LoyaltyCostBearer } from "contracts";
import { sql } from "drizzle-orm";
import { ApiError } from "../common/api-error";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { evaluateEarn, evaluateRedeem, evaluateReversal } from "./fraud";
import { phaseById, phaseOn, type ActivePhase } from "./program.service";
import { lockAccount, recomputeTiers } from "./tiers";

type Executor = Pick<Database, "execute">;
// CONG_VIEC_55: giao dịch tại cửa hàng liên kết dùng chung sổ cái điểm.
export type SaleSourceType = "marketplace_order" | "retail_sale" | "affiliate_transaction";
export type LoyaltySourceType = SaleSourceType | "retail_return" | "adjustment" | "affiliate_voucher";
export type EntryKind = "earn" | "redeem" | "redeem_refund" | "earn_reversal" | "expire" | "adjust_add" | "adjust_subtract";
export type SkipReason = "test_buyer" | "locked" | "inactive" | "no_phase" | "zero" | "fraud_rule";
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
  device_hash: string | null;
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

// Bút toán kế toán của từng bút toán điểm (QUYTAC_NGHIEPVU_355): LoyaltyPostingsService đăng ký khi khởi động; kiểm thử đơn vị không cần.
type EntryPoster = (executor: Executor, entryId: string) => Promise<void>;
let entryPoster: EntryPoster | null = null;
export const setEntryPoster = (poster: EntryPoster | null) => {
  entryPoster = poster;
};

// Ghi một bút toán điểm, cập nhật số dư (dòng ví đã khóa); trả mã bút toán.
async function addEntry(
  executor: Executor,
  input: {
    userId: string;
    kind: EntryKind;
    points: number;
    amount?: number;
    sourceType: LoyaltySourceType | null;
    sourceId: string | null;
    companyId: string | null;
    allocations: Allocation[];
    // Trừ lại điểm đã tích: chứng từ bán gốc, để hạch toán phần thiếu quy tiền theo kiểu chia chi phí của lô chứng từ bán (QUYTAC_NGHIEPVU_469).
    saleLink?: { sourceType: SaleSourceType; sourceId: string };
  },
): Promise<string> {
  const balance = (
    await executor.execute<{ balance: number }>(sql`UPDATE loyalty.accounts SET balance = balance + ${input.points}, updated_at = now() WHERE user_id = ${input.userId} RETURNING balance`)
  ).rows[0]!.balance;
  const entryId = (
    await executor.execute<{ id: string }>(sql`
    INSERT INTO loyalty.entries (user_id, kind, points, amount, balance_after, source_type, source_id, company_id)
    VALUES (${input.userId}, ${input.kind}, ${input.points}, ${input.amount ?? 0}, ${balance}, ${input.sourceType}, ${input.sourceId}::uuid, ${input.companyId}::uuid) RETURNING id`)
  ).rows[0]!.id;
  for (const allocation of input.allocations) {
    await executor.execute(sql`INSERT INTO loyalty.entry_lots (entry_id, lot_id, points, point_value) VALUES (${entryId}, ${allocation.lotId}, ${allocation.points}, ${allocation.pointValue})`);
  }
  if (input.saleLink) {
    await executor.execute(sql`INSERT INTO loyalty.refund_links (entry_id, sale_source_type, sale_source_id) VALUES (${entryId}, ${input.saleLink.sourceType}, ${input.saleLink.sourceId})`);
  }
  if (entryPoster) await entryPoster(executor, entryId);
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
    costBearer?: LoyaltyCostBearer;
  },
): Promise<string> {
  const lotId = (
    await executor.execute<{ id: string }>(sql`
    INSERT INTO loyalty.lots (user_id, source_type, source_id, company_id, points, remaining, point_value, earned_on, expires_on, cost_bearer)
    VALUES (${input.userId}, ${input.sourceType}, ${input.sourceId}, ${input.companyId}, ${input.points}, ${input.points}, ${input.pointValue}, ${input.day}::date,
      (${input.day}::date + make_interval(months => ${input.validityMonths}))::date, ${input.costBearer ?? "earning_company"}) RETURNING id`)
  ).rows[0]!.id;
  return addEntry(executor, { ...input, allocations: [{ lotId, points: input.points, pointValue: input.pointValue }] });
}

// Lấy điểm từ lô hạn sớm nhất trước, cùng hạn thì lô cũ trước (QUYTAC_NGHIEPVU_344); lô ưu tiên (lô của chứng từ bán khi trừ lại) lấy trước hết.
// validOn: chỉ lấy lô còn hạn tại ngày đó (dùng điểm); trống: lấy mọi lô còn điểm (trừ lại, hết hạn, điều chỉnh trừ).
export async function takeFromLots(executor: Executor, userId: string, points: number, preferredLotId: string | null = null, validOn: string | null = null): Promise<Allocation[]> {
  const lots = await executor.execute<{ id: string; remaining: number; point_value: string }>(sql`
    SELECT id, remaining, point_value::text FROM loyalty.lots WHERE user_id = ${userId} AND remaining > 0 AND (${validOn}::date IS NULL OR expires_on >= ${validOn}::date)
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
  if (left > 0) throw new ApiError("BUSINESS_RULE", "loyaltyRedeemInvalid");
  return allocations;
}

// CONG_VIEC_55 (QUYTAC_NGHIEPVU_402): khách đổi điểm lấy voucher của cửa hàng liên kết. Cần giai đoạn hiệu lực, ví không khóa, tài khoản hoạt động;
// lấy lô còn hạn, hạn sớm trước; không áp mức đổi tối thiểu, phần trăm đơn (giá điểm do voucher quy định). Trả giá trị một điểm lúc đổi.
export async function spendPointsWithin(
  executor: Executor,
  input: { userId: string; companyId: string; sourceType: "affiliate_voucher"; sourceId: string; day: string; points: number },
): Promise<{ pointValue: number; amount: number }> {
  await lockAccount(executor, input.userId);
  const phase = await phaseOn(executor, input.day);
  if (!phase) throw new ApiError("BUSINESS_RULE", "loyaltyNoPhase");
  const account = await standing(executor, input.userId);
  if (account.locked || account.inactive) throw new ApiError("BUSINESS_RULE", "loyaltyLocked");
  const amount = Math.floor(input.points * phase.pointValue);
  const allocations = await takeFromLots(executor, input.userId, input.points, null, input.day);
  await addEntry(executor, { userId: input.userId, kind: "redeem", points: -input.points, amount, sourceType: input.sourceType, sourceId: input.sourceId, companyId: input.companyId, allocations });
  return { pointValue: phase.pointValue, amount };
}

// Ghi sổ phiếu điều chỉnh đã duyệt (QUYTAC_NGHIEPVU_353): cộng tạo lô theo hạn, giá trị đã chốt khi gửi; trừ lấy lô hạn sớm trước, không vượt số dư.
export async function adjustPoints(
  executor: Executor,
  input: { userId: string; direction: "add" | "subtract"; points: number; adjustmentId: string; companyId: string; pointValue: number; validityMonths: number; day: string },
): Promise<string> {
  const account = await lockAccount(executor, input.userId);
  if (input.direction === "add") {
    return creditLot(executor, { ...input, kind: "adjust_add", sourceType: "adjustment", sourceId: input.adjustmentId });
  }
  if (account.balance < input.points) throw new ApiError("BUSINESS_RULE", "loyaltyInsufficientBalance");
  const allocations = await takeFromLots(executor, input.userId, input.points);
  return addEntry(executor, { userId: input.userId, kind: "adjust_subtract", points: -input.points, sourceType: "adjustment", sourceId: input.adjustmentId, companyId: input.companyId, allocations });
}

// Hết hạn một lô (QUYTAC_NGHIEPVU_350): trừ hết phần còn lại của lô; dòng ví khóa trước, lô khóa sau để cùng thứ tự với dùng điểm.
export async function expireLot(executor: Executor, lotId: string, day: string): Promise<number> {
  const peek = (await executor.execute<{ user_id: string }>(sql`SELECT user_id FROM loyalty.lots WHERE id = ${lotId}`)).rows[0];
  if (!peek) return 0;
  await lockAccount(executor, peek.user_id);
  const lot = (
    await executor.execute<{ remaining: number; point_value: string; company_id: string }>(sql`
    SELECT remaining, point_value::text, company_id FROM loyalty.lots WHERE id = ${lotId} AND remaining > 0 AND expires_on < ${day}::date FOR UPDATE`)
  ).rows[0];
  if (!lot) return 0;
  await executor.execute(sql`UPDATE loyalty.lots SET remaining = 0 WHERE id = ${lotId}`);
  await addEntry(executor, {
    userId: peek.user_id,
    kind: "expire",
    points: -lot.remaining,
    sourceType: null,
    sourceId: null,
    companyId: null,
    allocations: [{ lotId, points: -lot.remaining, pointValue: Number(lot.point_value) }],
  });
  return lot.remaining;
}

// Hoàn điểm đã dùng vào đúng các lô đã lấy (QUYTAC_NGHIEPVU_349): lô hạn xa trước; lô đã hết hạn được hạn mới = hôm nay + 30 ngày.
async function refundToLots(executor: Executor, input: { userId: string; saleSourceType: SaleSourceType; saleSourceId: string; points: number; day: string }): Promise<Allocation[]> {
  const lots = await executor.execute<{ lot_id: string; available: number; point_value: string }>(sql`
    SELECT el.lot_id, (-sum(el.points))::int AS available, max(el.point_value)::text AS point_value
    FROM loyalty.entry_lots el JOIN loyalty.entries e ON e.id = el.entry_id JOIN loyalty.lots l ON l.id = el.lot_id
    WHERE e.user_id = ${input.userId} AND e.kind IN ('redeem', 'redeem_refund')
      AND ((e.kind = 'redeem' AND e.source_type = ${input.saleSourceType} AND e.source_id = ${input.saleSourceId})
        OR (e.kind = 'redeem_refund' AND e.id IN (SELECT entry_id FROM loyalty.refund_links WHERE sale_source_type = ${input.saleSourceType} AND sale_source_id = ${input.saleSourceId})))
    GROUP BY el.lot_id, l.expires_on HAVING -sum(el.points) > 0 ORDER BY l.expires_on DESC, el.lot_id`);
  const allocations: Allocation[] = [];
  let left = input.points;
  for (const lot of lots.rows) {
    if (left === 0) break;
    const given = Math.min(left, lot.available);
    await executor.execute(sql`
      UPDATE loyalty.lots SET remaining = remaining + ${given},
        expires_on = CASE WHEN expires_on < ${input.day}::date THEN ${input.day}::date + 30 ELSE expires_on END, expiry_notified_at = CASE WHEN expires_on < ${input.day}::date THEN NULL ELSE expiry_notified_at END
      WHERE id = ${lot.lot_id}`);
    allocations.push({ lotId: lot.lot_id, points: given, pointValue: Number(lot.point_value) });
    left -= given;
  }
  if (left > 0) throw new Error("Không đủ điểm đã dùng để hoàn");
  return allocations;
}

// Trả hàng (một phần hoặc toàn bộ) của chứng từ bán (QUYTAC_NGHIEPVU_349): hoàn điểm đã dùng theo tỷ lệ giá trị hàng trả; đã tích thì trừ lại điểm đã tích theo tỷ lệ,
// số dư không đủ thì phần điểm thiếu quy ra tiền theo giá trị lúc tích (bên gọi trừ vào tiền hoàn). Tính theo lũy kế để tổng các lần trả khớp khi trả hết.
export async function returnSalePoints(
  executor: Executor,
  input: { saleSourceType: SaleSourceType; saleSourceId: string; returnSourceId: string; companyId: string; day: string; returnedGoodsAmount: number },
): Promise<ReturnResult> {
  const empty: ReturnResult = { refundedPoints: 0, refundedPointsAmount: 0, reversedPoints: 0, shortfallAmount: 0 };
  const peek = (await executor.execute<{ user_id: string }>(sql`SELECT user_id FROM loyalty.document_points WHERE source_type = ${input.saleSourceType} AND source_id = ${input.saleSourceId}`))
    .rows[0];
  if (!peek) return empty;
  await lockAccount(executor, peek.user_id);
  const document = (await documentOf(executor, input.saleSourceType, input.saleSourceId))!;
  const goods = Number(document.goods_amount);
  const returned = Math.min(goods, Number(document.returned_amount) + Math.max(input.returnedGoodsAmount, 0));
  const ratio = goods > 0 ? returned / goods : 1;
  const refundedPoints = Math.max(Math.round(document.redeemed_points * ratio) - document.refunded_points, 0);
  const refundedPointsAmount = Math.max(Math.round(Number(document.redeemed_amount) * ratio) - Number(document.refunded_amount), 0);
  const entrySource =
    input.saleSourceType === "retail_sale" ? { sourceType: "retail_return" as const, sourceId: input.returnSourceId } : { sourceType: input.saleSourceType, sourceId: input.saleSourceId };
  if (refundedPoints > 0) {
    const allocations = await refundToLots(executor, { userId: document.user_id, saleSourceType: input.saleSourceType, saleSourceId: input.saleSourceId, points: refundedPoints, day: input.day });
    const entryId = await addEntry(executor, {
      userId: document.user_id,
      kind: "redeem_refund",
      points: refundedPoints,
      amount: refundedPointsAmount,
      ...entrySource,
      companyId: input.companyId,
      allocations,
    });
    await executor.execute(sql`INSERT INTO loyalty.refund_links (entry_id, sale_source_type, sale_source_id) VALUES (${entryId}, ${input.saleSourceType}, ${input.saleSourceId})`);
  }
  let reversedPoints = 0;
  let shortfallAmount = 0;
  if (document.earn_status === "earned" && (document.earned_points ?? 0) > 0) {
    const toReverse = Math.max(Math.round((document.earned_points ?? 0) * ratio) - document.reversed_points, 0);
    if (toReverse > 0) {
      const lot = (
        await executor.execute<{ id: string; point_value: string }>(
          sql`SELECT id, point_value::text FROM loyalty.lots WHERE source_type = ${input.saleSourceType} AND source_id = ${input.saleSourceId}`,
        )
      ).rows[0];
      const balance = (await executor.execute<{ balance: number }>(sql`SELECT balance FROM loyalty.accounts WHERE user_id = ${document.user_id}`)).rows[0]!.balance;
      const taken = Math.min(toReverse, balance);
      // Luôn ghi bút toán (kể cả 0 điểm khi số dư bằng 0) để phần thiếu quy tiền có bút toán kế toán.
      {
        const allocations = taken > 0 ? await takeFromLots(executor, document.user_id, taken, lot?.id ?? null) : [];
        await addEntry(executor, {
          userId: document.user_id,
          kind: "earn_reversal",
          saleLink: { sourceType: input.saleSourceType, sourceId: input.saleSourceId },
          points: -taken,
          amount: Math.round((toReverse - taken) * Number(lot?.point_value ?? 0)),
          ...entrySource,
          companyId: input.companyId,
          allocations,
        });
      }
      reversedPoints = taken;
      // CONG_VIEC_60 (QUYTAC_NGHIEPVU_476): tích rồi trả hàng lặp lại.
      await evaluateReversal(executor, { userId: document.user_id, companyId: input.companyId, sourceType: input.saleSourceType, sourceId: input.saleSourceId });
      // Phần điểm thiếu quy ra tiền theo giá trị một điểm lúc tích (quyết định người dùng 2026-11-11).
      shortfallAmount = Math.round((toReverse - taken) * Number(lot?.point_value ?? 0));
      await executor.execute(sql`
        UPDATE loyalty.document_points SET reversed_points = reversed_points + ${toReverse}, shortfall_amount = shortfall_amount + ${shortfallAmount}
        WHERE source_type = ${input.saleSourceType} AND source_id = ${input.saleSourceId}`);
    }
  }
  await executor.execute(sql`
    UPDATE loyalty.document_points SET returned_amount = ${returned}, refunded_points = refunded_points + ${refundedPoints}, refunded_amount = refunded_amount + ${refundedPointsAmount}
    WHERE source_type = ${input.saleSourceType} AND source_id = ${input.saleSourceId}`);
  // Bán tại quầy đã cộng chi tiêu lúc bán: trả hàng trừ lại (QUYTAC_NGHIEPVU_351). Đơn VComm cộng chi tiêu theo giá trị hoàn tất nên không trừ.
  if (input.saleSourceType === "retail_sale" && document.earn_status !== "pending") await addSpend(executor, document.user_id, input.companyId, -(returned - Number(document.returned_amount)));
  if (refundedPoints > 0 || reversedPoints > 0) {
    await notify(executor, [
      {
        userId: document.user_id,
        companyId: input.companyId,
        kind: "loyalty.returned",
        title: refundedPoints > 0 ? `Bạn được hoàn ${refundedPoints.toLocaleString("vi-VN")} điểm thưởng` : `Đã trừ lại ${reversedPoints.toLocaleString("vi-VN")} điểm thưởng do trả hàng`,
        payload: { sourceType: input.saleSourceType, sourceId: input.saleSourceId, refundedPoints, reversedPoints },
      },
    ]);
  }
  return { refundedPoints, refundedPointsAmount, reversedPoints, shortfallAmount };
}

// Chứng từ bán bị hủy (QUYTAC_NGHIEPVU_347, 349): hoàn toàn bộ điểm đã dùng còn lại; chưa tích thì không tích nữa; đã tích (bán tại quầy) thì trừ lại như trả toàn bộ.
export async function releaseSalePoints(executor: Executor, sourceType: SaleSourceType, sourceId: string, returnSourceId: string | null = null): Promise<ReturnResult> {
  const row = (
    await executor.execute<{ company_id: string; goods_amount: string; returned_amount: string; today: string }>(sql`
    SELECT company_id, goods_amount::text, returned_amount::text, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today
    FROM loyalty.document_points WHERE source_type = ${sourceType} AND source_id = ${sourceId}`)
  ).rows[0];
  if (!row) return { refundedPoints: 0, refundedPointsAmount: 0, reversedPoints: 0, shortfallAmount: 0 };
  const result = await returnSalePoints(executor, {
    saleSourceType: sourceType,
    saleSourceId: sourceId,
    returnSourceId: returnSourceId ?? sourceId,
    companyId: row.company_id,
    day: row.today,
    // Đơn chưa có giá trị (tiền hàng 0) vẫn chạy để hoàn điểm theo tỷ lệ 1.
    returnedGoodsAmount: Math.max(Number(row.goods_amount) - Number(row.returned_amount), 0),
  });
  await executor.execute(sql`UPDATE loyalty.document_points SET earn_status = 'cancelled' WHERE source_type = ${sourceType} AND source_id = ${sourceId} AND earn_status = 'pending'`);
  return result;
}

// Điểm dùng được cho một chứng từ bán (QUYTAC_NGHIEPVU_348): số dư tính trên lô còn hạn; giai đoạn ngày chứng từ, ví không khóa, tài khoản hoạt động; tối đa theo số dư và phần trăm tiền hàng gồm thuế.
export async function quoteRedemption(
  executor: Executor,
  input: { userId: string; day: string; goodsAmount: number },
): Promise<{ balance: number; minPoints: number; maxPoints: number; pointValue: number | null; redeemable: boolean; blockedReason: BlockedReason | null }> {
  const phase = await phaseOn(executor, input.day);
  const row = (
    await executor.execute<{ balance: number | null; locked: boolean | null; status: string }>(sql`
    SELECT (SELECT sum(l.remaining)::int FROM loyalty.lots l WHERE l.user_id = u.id AND l.remaining > 0 AND l.expires_on >= ${input.day}::date) AS balance, a.locked, u.status
    FROM core.users u LEFT JOIN loyalty.accounts a ON a.user_id = u.id WHERE u.id = ${input.userId}`)
  ).rows[0];
  const balance = row?.balance ?? 0;
  const byPercent = phase ? Math.floor(Math.round(((Math.max(input.goodsAmount, 0) * phase.redeemMaxPercent) / 100 / phase.pointValue) * 1e6) / 1e6) : 0;
  const maxPoints = Math.min(balance, byPercent);
  const minPoints = phase?.redeemMinPoints ?? 0;
  const blockedReason: BlockedReason | null = !phase ? "no_phase" : row?.locked ? "locked" : row?.status !== "active" ? "inactive" : maxPoints < minPoints ? "insufficient" : null;
  return { balance, minPoints, maxPoints: blockedReason ? 0 : maxPoints, pointValue: phase?.pointValue ?? null, redeemable: blockedReason === null, blockedReason };
}

async function standing(executor: Executor, userId: string): Promise<{ locked: boolean; inactive: boolean; testBuyer: boolean }> {
  const row = (
    await executor.execute<{ locked: boolean; status: string; is_test_buyer: boolean | null }>(sql`
    SELECT a.locked, u.status, b.is_test_buyer FROM loyalty.accounts a JOIN core.users u ON u.id = a.user_id
    LEFT JOIN marketplace.buyer_accounts b ON b.user_id = a.user_id WHERE a.user_id = ${userId}`)
  ).rows[0]!;
  return { locked: row.locked, inactive: row.status !== "active", testBuyer: row.is_test_buyer === true };
}

async function multiplierOf(executor: Executor, userId: string): Promise<{ tierId: string | null; multiplier: number }> {
  const row = (
    await executor.execute<{ tier_id: string | null; multiplier: string | null }>(sql`
    SELECT a.tier_id, t.multiplier::text FROM loyalty.accounts a LEFT JOIN loyalty.tiers t ON t.id = a.tier_id WHERE a.user_id = ${userId}`)
  ).rows[0];
  return { tierId: row?.tier_id ?? null, multiplier: Number(row?.multiplier ?? 1) };
}

async function documentOf(executor: Executor, sourceType: SaleSourceType, sourceId: string): Promise<DocumentRow | null> {
  return (
    (
      await executor.execute<DocumentRow>(sql`
    SELECT company_id, user_id, document_date::text, goods_amount::text, returned_amount::text, phase_id, multiplier::text, redeemed_points, redeemed_amount::text,
      refunded_points, refunded_amount::text, expected_points, earned_points, reversed_points, shortfall_amount::text, earn_status, device_hash
    FROM loyalty.document_points WHERE source_type = ${sourceType} AND source_id = ${sourceId} FOR UPDATE`)
    ).rows[0] ?? null
  );
}

// Chi tiêu năm nay đổi (cộng khi tích, trừ khi trả hàng tại quầy); lên hạng thì báo người mua (QUYTAC_NGHIEPVU_351).
async function addSpend(executor: Executor, userId: string, companyId: string, amount: number): Promise<void> {
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

// Chốt giai đoạn ngày chứng từ, hạng và hệ số lúc đặt hoặc lúc bán (QUYTAC_NGHIEPVU_346); điểm dự kiến theo tiền hàng trừ tiền điểm.
export async function snapshotWithin(
  executor: Executor,
  input: {
    sourceType: SaleSourceType;
    sourceId: string;
    userId: string;
    companyId: string;
    day: string;
    goodsAmount: number;
    redeemedPoints?: number;
    redeemedAmount?: number;
    // CONG_VIEC_60: băm mã cài đặt ứng dụng lúc đặt (QUYTAC_NGHIEPVU_474).
    deviceHash?: string | null;
  },
): Promise<{ expectedPoints: number }> {
  await lockAccount(executor, input.userId);
  await recomputeTiers(executor, input.userId, "year_start");
  const phase = await phaseOn(executor, input.day);
  const { tierId, multiplier } = await multiplierOf(executor, input.userId);
  const redeemedAmount = input.redeemedAmount ?? 0;
  const expectedPoints = phase ? pointsFor(input.goodsAmount - redeemedAmount, phase, multiplier) : 0;
  await executor.execute(sql`
    INSERT INTO loyalty.document_points (source_type, source_id, company_id, user_id, document_date, goods_amount, phase_id, tier_id, multiplier, redeemed_points, redeemed_amount, expected_points,
      device_hash)
    VALUES (${input.sourceType}, ${input.sourceId}, ${input.companyId}, ${input.userId}, ${input.day}::date, ${input.goodsAmount}, ${phase?.id ?? null}, ${tierId}, ${multiplier},
      ${input.redeemedPoints ?? 0}, ${redeemedAmount}, ${expectedPoints}, ${input.deviceHash ?? null})`);
  return { expectedPoints };
}

@Injectable()
export class LoyaltyLedgerService {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  snapshotWithin(executor: Executor, input: Parameters<typeof snapshotWithin>[1]): Promise<{ expectedPoints: number }> {
    return snapshotWithin(executor, input);
  }

  quoteRedemption(executor: Executor, input: { userId: string; sourceType: SaleSourceType; day: string; goodsAmount: number }): ReturnType<typeof quoteRedemption> {
    return quoteRedemption(executor, input);
  }

  // Dùng điểm cho chứng từ bán (QUYTAC_NGHIEPVU_348): kiểm điều kiện, trừ điểm lô hạn sớm trước, chốt giai đoạn, hạng; 0 điểm thì chỉ chốt.
  async redeemWithin(
    executor: Executor,
    input: { userId: string; companyId: string; sourceType: SaleSourceType; sourceId: string; day: string; goodsAmount: number; points: number; deviceHash?: string | null },
  ): Promise<{ points: number; amount: number; expectedPoints: number }> {
    if (!Number.isInteger(input.points) || input.points < 0) throw new ApiError("BUSINESS_RULE", "loyaltyRedeemInvalid");
    if (input.points === 0) return { points: 0, amount: 0, ...(await snapshotWithin(executor, input)) };
    // CONG_VIEC_60 (QUYTAC_NGHIEPVU_475, 476): xét quy tắc chống gian lận trước khi khóa ví điểm.
    await evaluateRedeem(executor, { ...input, deviceHash: input.deviceHash ?? null });
    await lockAccount(executor, input.userId);
    const quote = await quoteRedemption(executor, input);
    if (quote.blockedReason === "no_phase") throw new ApiError("BUSINESS_RULE", "loyaltyNoPhase");
    if (quote.blockedReason === "locked" || quote.blockedReason === "inactive") throw new ApiError("BUSINESS_RULE", "loyaltyLocked");
    if (input.points < quote.minPoints || input.points > quote.maxPoints) throw new ApiError("BUSINESS_RULE", "loyaltyRedeemInvalid");
    const amount = Math.floor(input.points * quote.pointValue!);
    const allocations = await takeFromLots(executor, input.userId, input.points, null, input.day);
    await addEntry(executor, { userId: input.userId, kind: "redeem", points: -input.points, amount, sourceType: input.sourceType, sourceId: input.sourceId, companyId: input.companyId, allocations });
    const snapshot = await snapshotWithin(executor, { ...input, redeemedPoints: input.points, redeemedAmount: amount });
    return { points: input.points, amount, ...snapshot };
  }

  returnWithin(executor: Executor, input: Parameters<typeof returnSalePoints>[1]): Promise<ReturnResult> {
    return returnSalePoints(executor, input);
  }

  // Hủy chứng từ bán tại quầy (CONG_VIEC_53): như trả toàn bộ.
  cancelWithin(executor: Executor, input: { sourceType: SaleSourceType; sourceId: string; companyId: string; day: string }): Promise<ReturnResult> {
    return releaseSalePoints(executor, input.sourceType, input.sourceId);
  }

  // Tích điểm (QUYTAC_NGHIEPVU_347): đơn VComm gọi khi hoàn tất với giá trị hoàn tất; bán tại quầy gọi ngay sau khi bán với tiền hàng gồm thuế.
  // Giá trị tích = tiền hàng − tiền điểm đã dùng còn lại; chi tiêu năm cộng tiền hàng (QUYTAC_NGHIEPVU_351).
  async earnWithin(
    executor: Executor,
    // CONG_VIEC_55: `earnPercent` thay tỷ lệ tích của giai đoạn (tỷ lệ của cửa hàng liên kết); `countSpend` false thì không cộng chi tiêu xét hạng.
    input: { sourceType: SaleSourceType; sourceId: string; userId: string; companyId: string; day: string; goodsAmount: number; earnPercent?: number; countSpend?: boolean },
  ): Promise<{ points: number; skipReason: SkipReason | null }> {
    await lockAccount(executor, input.userId);
    let document = await documentOf(executor, input.sourceType, input.sourceId);
    if (!document) {
      await snapshotWithin(executor, input);
      document = (await documentOf(executor, input.sourceType, input.sourceId))!;
    }
    if (document.earn_status !== "pending") return { points: document.earned_points ?? 0, skipReason: null };
    const earningValue = Math.max(input.goodsAmount - (Number(document.redeemed_amount) - Number(document.refunded_amount)), 0);
    const account = await standing(executor, input.userId);
    const phase = document.phase_id ? await phaseById(executor, document.phase_id) : null;
    let points = phase ? pointsFor(earningValue, input.earnPercent === undefined ? phase : { ...phase, earnPercent: input.earnPercent }, Number(document.multiplier)) : 0;
    if (phase && phase.monthlyCapPoints !== null && points > 0) {
      const used = (
        await executor.execute<{ total: number }>(sql`
        SELECT coalesce(sum(earned_points), 0)::int AS total FROM loyalty.document_points
        WHERE user_id = ${input.userId} AND earn_status = 'earned' AND date_trunc('month', earned_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = date_trunc('month', ${input.day}::date)`)
      ).rows[0]!.total;
      points = Math.min(points, Math.max(phase.monthlyCapPoints - used, 0));
    }
    let skipReason: SkipReason | null = account.testBuyer ? "test_buyer" : account.locked ? "locked" : account.inactive ? "inactive" : !phase ? "no_phase" : points <= 0 ? "zero" : null;
    // CONG_VIEC_60 (QUYTAC_NGHIEPVU_475, 476): quy tắc chặn thì không tích.
    if (!skipReason && (await evaluateEarn(executor, { ...input, deviceHash: document.device_hash }))) skipReason = "fraud_rule";
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
        costBearer: phase!.costBearer,
      });
    }
    if (input.countSpend !== false) await addSpend(executor, input.userId, input.companyId, input.goodsAmount);
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
}
