// Chương trình điểm theo giai đoạn và bảng hạng (CONG_VIEC_51; CHUC_NANG_178; QUYTAC_NGHIEPVU_345, 351; API_176).
import { Inject, Injectable } from "@nestjs/common";
import type { LoyaltyCostBearer, LoyaltyPhase, LoyaltyPhaseInput, LoyaltyProgramResponse, LoyaltyTier, LoyaltyTiersInput } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { vietnamToday } from "../marketplace/shop.service";
import { recomputeTiers } from "./tiers";

type Executor = Pick<Database, "execute">;

type PhaseRow = {
  id: string;
  starts_on: string;
  ends_on: string | null;
  earn_percent: string;
  point_value: string;
  redeem_max_percent: string;
  redeem_min_points: number;
  validity_months: number;
  order_cap_points: number | null;
  monthly_cap_points: number | null;
  cost_bearer: LoyaltyCostBearer;
  version: number;
};

export type ActivePhase = {
  id: string;
  earnPercent: number;
  pointValue: number;
  redeemMaxPercent: number;
  redeemMinPoints: number;
  validityMonths: number;
  orderCapPoints: number | null;
  monthlyCapPoints: number | null;
  costBearer: LoyaltyCostBearer;
};

const phaseColumns = sql`id, starts_on::text, ends_on::text, earn_percent::text, point_value::text, redeem_max_percent::text, redeem_min_points, validity_months,
  order_cap_points, monthly_cap_points, cost_bearer, version`;

const statusOf = (row: PhaseRow, today: string) => (row.starts_on > today ? "upcoming" : row.ends_on !== null && row.ends_on < today ? "ended" : "active");

const phaseOf = (row: PhaseRow, today: string): LoyaltyPhase => ({
  id: row.id,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  earnPercent: trimDecimal(row.earn_percent),
  pointValue: trimDecimal(row.point_value),
  redeemMaxPercent: trimDecimal(row.redeem_max_percent),
  redeemMinPoints: row.redeem_min_points,
  validityMonths: row.validity_months,
  orderCapPoints: row.order_cap_points,
  monthlyCapPoints: row.monthly_cap_points,
  costBearer: row.cost_bearer,
  status: statusOf(row, today),
  version: row.version,
});

const activePhaseOf = (row: PhaseRow): ActivePhase => ({
  id: row.id,
  earnPercent: Number(row.earn_percent),
  pointValue: Number(row.point_value),
  redeemMaxPercent: Number(row.redeem_max_percent),
  redeemMinPoints: row.redeem_min_points,
  validityMonths: row.validity_months,
  orderCapPoints: row.order_cap_points,
  monthlyCapPoints: row.monthly_cap_points,
  costBearer: row.cost_bearer,
});

// Giai đoạn hiệu lực tại một ngày (giờ Việt Nam); không có thì không tích, không đổi điểm.
export async function phaseOn(executor: Executor, day: string): Promise<ActivePhase | null> {
  const row = (
    await executor.execute<PhaseRow>(sql`
    SELECT ${phaseColumns} FROM loyalty.program_phases WHERE starts_on <= ${day}::date AND (ends_on IS NULL OR ends_on >= ${day}::date)`)
  ).rows[0];
  return row ? activePhaseOf(row) : null;
}

// Giai đoạn đã chốt trên chứng từ; tham số của giai đoạn đã bắt đầu không đổi (QUYTAC_NGHIEPVU_345).
export async function phaseById(executor: Executor, id: string): Promise<ActivePhase> {
  return activePhaseOf((await executor.execute<PhaseRow>(sql`SELECT ${phaseColumns} FROM loyalty.program_phases WHERE id = ${id}`)).rows[0]!);
}

const isExclusionViolation = (error: unknown) => {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  return candidate?.code === "23P01" || candidate?.cause?.code === "23P01";
};

@Injectable()
export class LoyaltyProgramService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async program(canManage: boolean): Promise<LoyaltyProgramResponse> {
    const today = await vietnamToday(this.database);
    const phases = await this.database.execute<PhaseRow>(sql`SELECT ${phaseColumns} FROM loyalty.program_phases ORDER BY starts_on DESC`);
    return { today, phases: phases.rows.map((row) => phaseOf(row, today)), tiers: await this.tiers(this.database), canManage };
  }

  async tiers(executor: Executor): Promise<LoyaltyTier[]> {
    const rows = await executor.execute<{ id: string; sort_order: number; name_vi: string; name_en: string; min_annual_spend: string; multiplier: string }>(sql`
      SELECT id, sort_order, name_vi, name_en, min_annual_spend::text, multiplier::text FROM loyalty.tiers ORDER BY sort_order`);
    return rows.rows.map((row) => ({
      id: row.id,
      sortOrder: row.sort_order,
      nameVi: row.name_vi,
      nameEn: row.name_en,
      minAnnualSpend: trimDecimal(row.min_annual_spend),
      multiplier: trimDecimal(row.multiplier),
    }));
  }

  // Lưu giai đoạn; ràng buộc loại trừ trong cơ sở dữ liệu chặn chồng lấn kể cả khi hai người lưu cùng lúc.
  private async write<T>(work: (transaction: Database) => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction((transaction) => work(transaction as unknown as Database));
    } catch (error) {
      if (isExclusionViolation(error)) throw new ApiError("BUSINESS_RULE", "loyaltyPhaseOverlap");
      throw error;
    }
  }

  // Giai đoạn mới bắt đầu từ hôm nay trở đi để không áp ngược cho đơn đã đặt.
  async createPhase(actor: BuyerAdminActor, input: LoyaltyPhaseInput): Promise<LoyaltyPhase> {
    const today = await vietnamToday(this.database);
    if (input.startsOn < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { startsOn: "loyaltyPhaseStartInPast" } });
    if (input.endsOn !== null && input.endsOn < input.startsOn) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { endsOn: "invalidValue" } });
    const row = await this.write(async (transaction) => {
      const inserted = (
        await transaction.execute<PhaseRow>(sql`
        INSERT INTO loyalty.program_phases (company_id, starts_on, ends_on, earn_percent, point_value, redeem_max_percent, redeem_min_points, validity_months,
          order_cap_points, monthly_cap_points, cost_bearer, created_by, updated_by)
        VALUES (${actor.operatorCompanyId}, ${input.startsOn}::date, ${input.endsOn}::date, ${input.earnPercent}::numeric, ${input.pointValue}::numeric,
          ${input.redeemMaxPercent}::numeric, ${input.redeemMinPoints}, ${input.validityMonths}, ${input.orderCapPoints}, ${input.monthlyCapPoints}, ${input.costBearer}, ${actor.userId}, ${actor.userId})
        RETURNING ${phaseColumns}`)
      ).rows[0]!;
      await this.audit.record(
        { actorUserId: actor.userId, companyId: actor.operatorCompanyId, appCode: "crm", action: "loyalty_phase.create", entityType: "loyalty_phase", entityId: inserted.id, afterData: input },
        transaction,
      );
      return inserted;
    });
    return phaseOf(row, today);
  }

  // Giai đoạn chưa bắt đầu sửa được mọi tham số; đã bắt đầu chỉ sửa ngày kết thúc, không trước hôm nay (QUYTAC_NGHIEPVU_345).
  async updatePhase(actor: BuyerAdminActor, id: string, input: LoyaltyPhaseInput & { version: number }): Promise<LoyaltyPhase> {
    const today = await vietnamToday(this.database);
    const row = await this.write(async (transaction) => {
      const current = (await transaction.execute<PhaseRow>(sql`SELECT ${phaseColumns} FROM loyalty.program_phases WHERE id = ${id} FOR UPDATE`)).rows[0];
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      if (current.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (input.endsOn !== null && input.endsOn < input.startsOn) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { endsOn: "invalidValue" } });
      if (statusOf(current, today) === "upcoming") {
        if (input.startsOn < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { startsOn: "loyaltyPhaseStartInPast" } });
      } else {
        const same =
          input.startsOn === current.starts_on &&
          Number(input.earnPercent) === Number(current.earn_percent) &&
          Number(input.pointValue) === Number(current.point_value) &&
          Number(input.redeemMaxPercent) === Number(current.redeem_max_percent) &&
          input.redeemMinPoints === current.redeem_min_points &&
          input.validityMonths === current.validity_months &&
          input.orderCapPoints === current.order_cap_points &&
          input.monthlyCapPoints === current.monthly_cap_points;
        if (!same) throw new ApiError("BUSINESS_RULE", "loyaltyPhaseStarted");
        // QUYTAC_NGHIEPVU_468: giai đoạn đã bắt đầu không đổi được kiểu chia chi phí.
        if (input.costBearer !== current.cost_bearer) throw new ApiError("BUSINESS_RULE", "loyaltyCostBearerStarted");
        if (input.endsOn !== null && input.endsOn < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { endsOn: "loyaltyPhaseEndInPast" } });
      }
      const updated = (
        await transaction.execute<PhaseRow>(sql`
        UPDATE loyalty.program_phases SET starts_on = ${input.startsOn}::date, ends_on = ${input.endsOn}::date, earn_percent = ${input.earnPercent}::numeric,
          point_value = ${input.pointValue}::numeric, redeem_max_percent = ${input.redeemMaxPercent}::numeric, redeem_min_points = ${input.redeemMinPoints},
          validity_months = ${input.validityMonths}, order_cap_points = ${input.orderCapPoints}, monthly_cap_points = ${input.monthlyCapPoints},
          cost_bearer = ${input.costBearer}, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${id} RETURNING ${phaseColumns}`)
      ).rows[0]!;
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "loyalty_phase.update",
          entityType: "loyalty_phase",
          entityId: id,
          beforeData: phaseOf(current, today),
          afterData: input,
        },
        transaction,
      );
      return updated;
    });
    return phaseOf(row, today);
  }

  async deletePhase(actor: BuyerAdminActor, id: string): Promise<void> {
    const today = await vietnamToday(this.database);
    await this.database.transaction(async (transaction) => {
      const current = (await transaction.execute<PhaseRow>(sql`SELECT ${phaseColumns} FROM loyalty.program_phases WHERE id = ${id} FOR UPDATE`)).rows[0];
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      if (statusOf(current, today) !== "upcoming") throw new ApiError("BUSINESS_RULE", "loyaltyPhaseStarted");
      await transaction.execute(sql`DELETE FROM loyalty.program_phases WHERE id = ${id}`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "loyalty_phase.delete",
          entityType: "loyalty_phase",
          entityId: id,
          beforeData: phaseOf(current, today),
        },
        transaction,
      );
    });
  }

  // Thay cả bảng hạng (QUYTAC_NGHIEPVU_351): hạng đầu mức 0, mức tăng dần. Hạng đã gắn với ví, lịch sử, đơn thì giữ dòng (sửa tại chỗ theo thứ tự);
  // bỏ bớt hạng đã dùng thì báo lỗi. Đổi bảng xong tính lại hạng mọi ví điểm.
  async replaceTiers(actor: BuyerAdminActor, input: LoyaltyTiersInput): Promise<LoyaltyTier[]> {
    const tiers = input.tiers;
    if (Number(tiers[0]!.minAnnualSpend) !== 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { "tiers.0.minAnnualSpend": "loyaltyFirstTierZero" } });
    for (let index = 1; index < tiers.length; index += 1) {
      if (Number(tiers[index]!.minAnnualSpend) <= Number(tiers[index - 1]!.minAnnualSpend))
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { [`tiers.${index}.minAnnualSpend`]: "loyaltyTierNotAscending" } });
    }
    return this.database.transaction(async (transaction) => {
      await transaction.execute(sql`LOCK TABLE loyalty.tiers IN EXCLUSIVE MODE`);
      const before = await this.tiers(transaction);
      const removed = before.filter((tier) => tier.sortOrder > tiers.length);
      for (const tier of removed) {
        const used = await transaction.execute(sql`
          SELECT 1 FROM loyalty.accounts WHERE tier_id = ${tier.id}
          UNION ALL SELECT 1 FROM loyalty.tier_history WHERE from_tier_id = ${tier.id} OR to_tier_id = ${tier.id} LIMIT 1`);
        if (used.rows.length > 0) throw new ApiError("BUSINESS_RULE", "loyaltyTierInUse");
        await transaction.execute(sql`DELETE FROM loyalty.tiers WHERE id = ${tier.id}`);
      }
      for (const [index, tier] of tiers.entries()) {
        await transaction.execute(sql`
          INSERT INTO loyalty.tiers (sort_order, name_vi, name_en, min_annual_spend, multiplier, updated_by, updated_at)
          VALUES (${index + 1}, ${tier.nameVi}, ${tier.nameEn}, ${tier.minAnnualSpend}::numeric, ${tier.multiplier}::numeric, ${actor.userId}, now())
          ON CONFLICT (sort_order) DO UPDATE SET name_vi = EXCLUDED.name_vi, name_en = EXCLUDED.name_en, min_annual_spend = EXCLUDED.min_annual_spend,
            multiplier = EXCLUDED.multiplier, updated_by = EXCLUDED.updated_by, updated_at = now()`);
      }
      await recomputeTiers(transaction, null, "tiers_changed");
      const after = await this.tiers(transaction);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "loyalty_tiers.replace",
          entityType: "loyalty_tiers",
          entityId: actor.operatorCompanyId,
          beforeData: before,
          afterData: after,
        },
        transaction,
      );
      return after;
    });
  }
}
