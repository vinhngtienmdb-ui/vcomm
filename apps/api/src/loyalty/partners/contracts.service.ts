// Đối tác liên minh điểm ngoài tập đoàn phía công ty vận hành sàn: hợp đồng, giới hạn, tỷ lệ theo chiều và giai đoạn, bộ giả lập
// (CONG_VIEC_65; CHUC_NANG_236; QUYTAC_NGHIEPVU_538 đến 540, 550; API_301 đến 303).
import { Inject, Injectable } from "@nestjs/common";
import type {
  PageResponse,
  PartnerContractDetail,
  PartnerContractInput,
  PartnerContractListItem,
  PartnerContractStatus,
  PartnerDirection,
  PartnerLimit,
  PartnerPaymentMode,
  PartnerRate,
  PartnerSimulatorMode,
  PartnerSimulatorState,
  partnerContractListQuerySchema,
  partnerContractUpdateSchema,
  partnerRateCreateSchema,
  partnerRateUpdateSchema,
  partnerSimulatorMemberSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../../catalog/catalog-context";
import { ApiError } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { isUniqueViolation } from "../../common/database-errors";
import { DATABASE, type Database } from "../../database/database.module";
import type { BuyerAdminActor } from "../../marketplace/buyer-admin.service";
import { vietnamToday } from "../../marketplace/shop.service";
import { simulatorEnabled } from "./connector";

type Executor = Pick<Database, "execute">;
type ContractUpdate = z.infer<typeof partnerContractUpdateSchema>;
const directions: PartnerDirection[] = ["outbound", "inbound", "gift"];

type ContractRow = {
  id: string;
  code: string;
  partner_id: string;
  partner_code: string;
  partner_name: string;
  tax_code: string | null;
  program_name: string;
  unit_name_vi: string;
  unit_name_en: string;
  contract_no: string;
  effective_from: string;
  effective_to: string | null;
  outbound_enabled: boolean;
  inbound_enabled: boolean;
  gift_enabled: boolean;
  payment_mode: PartnerPaymentMode;
  credit_limit: string | null;
  payment_term_days: number;
  tax_percent: string;
  connector: "simulator";
  member_pattern: string;
  status: PartnerContractStatus;
  status_reason: string | null;
  version: number;
};

type RateRow = {
  id: string;
  direction: PartnerDirection;
  starts_on: string;
  ends_on: string | null;
  vcomm_points: number | null;
  partner_units: number | null;
  unit_price: string;
  version: number;
};

const contractColumns = sql`c.id, c.code, c.partner_id, p.code AS partner_code, p.name AS partner_name, p.tax_code, c.program_name, c.unit_name_vi, c.unit_name_en,
  c.contract_no, c.effective_from::text, c.effective_to::text, c.outbound_enabled, c.inbound_enabled, c.gift_enabled, c.payment_mode, c.credit_limit::text,
  c.payment_term_days, c.tax_percent::text, c.connector, c.member_pattern, c.status, c.status_reason, c.version`;

export const directionsOf = (row: Pick<ContractRow, "outbound_enabled" | "inbound_enabled" | "gift_enabled">): PartnerDirection[] => directions.filter((direction) => row[`${direction}_enabled`]);

const listItemOf = (row: ContractRow): PartnerContractListItem => ({
  id: row.id,
  code: row.code,
  partnerId: row.partner_id,
  partnerName: row.partner_name,
  programName: row.program_name,
  unitNameVi: row.unit_name_vi,
  unitNameEn: row.unit_name_en,
  directions: directionsOf(row),
  paymentMode: row.payment_mode,
  creditLimit: row.credit_limit === null ? null : trimDecimal(row.credit_limit),
  status: row.status,
});

const rateStatus = (row: { starts_on: string; ends_on: string | null }, today: string) => (row.starts_on > today ? "upcoming" : row.ends_on !== null && row.ends_on < today ? "ended" : "active");

const rateOf = (row: RateRow, today: string): PartnerRate => ({
  id: row.id,
  direction: row.direction,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  vcommPoints: row.vcomm_points,
  partnerUnits: row.partner_units,
  unitPrice: trimDecimal(row.unit_price),
  status: rateStatus(row, today),
  version: row.version,
});

export async function contractRow(executor: Executor, contractId: string, companyId: string, lock = false): Promise<ContractRow> {
  const row = (
    await executor.execute<ContractRow>(sql`
      SELECT ${contractColumns} FROM loyalty.partner_contracts c JOIN crm.partners p ON p.id = c.partner_id
      WHERE c.id = ${contractId} AND c.company_id = ${companyId} ${lock ? sql`FOR UPDATE OF c` : sql``}`)
  ).rows[0];
  if (!row) throw new ApiError("NOT_FOUND", "notFound");
  return row;
}

// Tỷ lệ hiệu lực của một chiều tại một ngày (giờ Việt Nam).
export async function rateOn(executor: Executor, contractId: string, direction: PartnerDirection, day: string): Promise<RateRow | null> {
  return (
    (
      await executor.execute<RateRow>(sql`
        SELECT id, direction, starts_on::text, ends_on::text, vcomm_points, partner_units, unit_price::text, version FROM loyalty.partner_rates
        WHERE contract_id = ${contractId} AND direction = ${direction} AND starts_on <= ${day}::date AND (ends_on IS NULL OR ends_on >= ${day}::date)`)
    ).rows[0] ?? null
  );
}

async function limitsOf(executor: Executor, contractId: string): Promise<Record<PartnerDirection, PartnerLimit>> {
  const rows = await executor.execute<{
    direction: PartnerDirection;
    min_points: number | null;
    max_points: number | null;
    customer_daily_points: number | null;
    customer_monthly_points: number | null;
    partner_monthly_points: number | null;
  }>(sql`SELECT direction, min_points, max_points, customer_daily_points, customer_monthly_points, partner_monthly_points FROM loyalty.partner_limits WHERE contract_id = ${contractId}`);
  const empty: PartnerLimit = { minPoints: null, maxPoints: null, customerDailyPoints: null, customerMonthlyPoints: null, partnerMonthlyPoints: null };
  const result: Record<PartnerDirection, PartnerLimit> = { outbound: { ...empty }, inbound: { ...empty }, gift: { ...empty } };
  for (const row of rows.rows) {
    result[row.direction] = {
      minPoints: row.min_points,
      maxPoints: row.max_points,
      customerDailyPoints: row.customer_daily_points,
      customerMonthlyPoints: row.customer_monthly_points,
      partnerMonthlyPoints: row.partner_monthly_points,
    };
  }
  return result;
}

// Giới hạn tặng không dùng mức tối thiểu, mỗi ngày (QUYTAC_NGHIEPVU_540): bỏ qua nếu gửi lên.
async function writeLimits(executor: Executor, contractId: string, limits: PartnerContractInput["limits"]): Promise<void> {
  for (const direction of directions) {
    const limit = limits[direction];
    const gift = direction === "gift";
    await executor.execute(sql`
      INSERT INTO loyalty.partner_limits (contract_id, direction, min_points, max_points, customer_daily_points, customer_monthly_points, partner_monthly_points)
      VALUES (${contractId}, ${direction}, ${gift ? null : limit.minPoints}, ${limit.maxPoints}, ${gift ? null : limit.customerDailyPoints}, ${limit.customerMonthlyPoints},
        ${limit.partnerMonthlyPoints})
      ON CONFLICT (contract_id, direction) DO UPDATE SET min_points = EXCLUDED.min_points, max_points = EXCLUDED.max_points,
        customer_daily_points = EXCLUDED.customer_daily_points, customer_monthly_points = EXCLUDED.customer_monthly_points,
        partner_monthly_points = EXCLUDED.partner_monthly_points`);
  }
}

// QUYTAC_NGHIEPVU_538: ít nhất một chiều; trả sau bắt buộc hạn mức nợ, trả trước để trống.
function assertTerms(input: Pick<PartnerContractInput, "outboundEnabled" | "inboundEnabled" | "giftEnabled" | "paymentMode" | "creditLimit">): void {
  if (!input.outboundEnabled && !input.inboundEnabled && !input.giftEnabled) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { outboundEnabled: "partnerDirectionRequired" } });
  if ((input.paymentMode === "postpaid") !== (input.creditLimit !== null)) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { creditLimit: "partnerCreditLimitRequired" } });
}

@Injectable()
export class PartnerContractsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  private record(actor: BuyerAdminActor, action: string, entityId: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.operatorCompanyId,
        appCode: "crm",
        action,
        entityType: "loyalty_partner_contract",
        entityId,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  async list(actor: BuyerAdminActor, query: z.infer<typeof partnerContractListQuerySchema>): Promise<PageResponse<PartnerContractListItem>> {
    const search = query.search ? `%${query.search.toLowerCase()}%` : null;
    const where = sql`c.company_id = ${actor.operatorCompanyId}
      ${query.status ? sql`AND c.status = ${query.status}` : sql``}
      ${search ? sql`AND (lower(c.code) LIKE ${search} OR p.search_text LIKE ${search} OR lower(c.program_name) LIKE ${search})` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM loyalty.partner_contracts c JOIN crm.partners p ON p.id = c.partner_id WHERE ${where}`))
      .rows[0]!.total;
    const rows = await this.database.execute<ContractRow>(sql`
      SELECT ${contractColumns} FROM loyalty.partner_contracts c JOIN crm.partners p ON p.id = c.partner_id
      WHERE ${where} ORDER BY c.code DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(listItemOf), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: BuyerAdminActor, contractId: string, canManage: boolean): Promise<PartnerContractDetail> {
    const row = await contractRow(this.database, contractId, actor.operatorCompanyId);
    const today = await vietnamToday(this.database);
    const rates = await this.database.execute<RateRow>(sql`
      SELECT id, direction, starts_on::text, ends_on::text, vcomm_points, partner_units, unit_price::text, version FROM loyalty.partner_rates
      WHERE contract_id = ${contractId} ORDER BY direction, starts_on DESC`);
    const linked = await this.database.execute<{ total: number }>(sql`
      SELECT count(*)::int AS total FROM loyalty.partner_memberships WHERE contract_id = ${contractId} AND status = 'linked'`);
    return {
      ...listItemOf(row),
      partnerCode: row.partner_code,
      taxCode: row.tax_code,
      contractNo: row.contract_no,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      outboundEnabled: row.outbound_enabled,
      inboundEnabled: row.inbound_enabled,
      giftEnabled: row.gift_enabled,
      paymentTermDays: row.payment_term_days,
      taxPercent: trimDecimal(row.tax_percent),
      connector: row.connector,
      memberPattern: row.member_pattern,
      limits: await limitsOf(this.database, contractId),
      statusReason: row.status_reason,
      rates: rates.rows.map((rate) => rateOf(rate, today)),
      linkedMembers: linked.rows[0]!.total,
      canManage,
      version: row.version,
    };
  }

  // QUYTAC_NGHIEPVU_538: chỉ đối tác ngoài tập đoàn đang hoạt động; một đối tác một hợp đồng; tạo ở trạng thái nháp.
  async create(actor: BuyerAdminActor, input: PartnerContractInput): Promise<PartnerContractDetail> {
    assertTerms(input);
    const partner = (await this.database.execute<{ company_id: string | null; status: string }>(sql`SELECT company_id, status FROM crm.partners WHERE id = ${input.partnerId}`)).rows[0];
    if (!partner || partner.status !== "active") throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { partnerId: "invalidValue" } });
    if (partner.company_id) throw new ApiError("BUSINESS_RULE", "partnerContractInternalPartner");
    const id = await this.database
      .transaction(async (transaction) => {
        const inserted = await transaction.execute<{ id: string }>(sql`
          INSERT INTO loyalty.partner_contracts (company_id, partner_id, program_name, unit_name_vi, unit_name_en, contract_no, effective_from, effective_to,
            outbound_enabled, inbound_enabled, gift_enabled, payment_mode, credit_limit, payment_term_days, tax_percent, connector, member_pattern, created_by, updated_by)
          VALUES (${actor.operatorCompanyId}, ${input.partnerId}, ${input.programName}, ${input.unitNameVi}, ${input.unitNameEn}, ${input.contractNo}, ${input.effectiveFrom}::date,
            ${input.effectiveTo}::date, ${input.outboundEnabled}, ${input.inboundEnabled}, ${input.giftEnabled}, ${input.paymentMode}, ${input.creditLimit}::numeric,
            ${input.paymentTermDays}, ${input.taxPercent}::numeric, ${input.connector}, ${input.memberPattern}, ${actor.userId}, ${actor.userId})
          RETURNING id`);
        const contractId = inserted.rows[0]!.id;
        await writeLimits(transaction, contractId, input.limits);
        await this.record(actor, "loyalty_partner_contract.create", contractId, input, transaction);
        return contractId;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) throw new ApiError("BUSINESS_RULE", "partnerContractTaken");
        throw error;
      });
    return this.detail(actor, id, true);
  }

  // Sửa điều khoản áp cho giao dịch tạo sau khi lưu; đã chấm dứt thì không sửa. Đổi cách thanh toán: kiểm giao dịch chưa chốt, công nợ mở (lát L3).
  async update(actor: BuyerAdminActor, contractId: string, input: ContractUpdate): Promise<PartnerContractDetail> {
    assertTerms(input);
    await this.database.transaction(async (transaction) => {
      const row = await contractRow(transaction, contractId, actor.operatorCompanyId, true);
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status === "terminated") throw new ApiError("BUSINESS_RULE", "partnerContractTerminated");
      await transaction.execute(sql`
        UPDATE loyalty.partner_contracts SET program_name = ${input.programName}, unit_name_vi = ${input.unitNameVi}, unit_name_en = ${input.unitNameEn},
          contract_no = ${input.contractNo}, effective_from = ${input.effectiveFrom}::date, effective_to = ${input.effectiveTo}::date, outbound_enabled = ${input.outboundEnabled},
          inbound_enabled = ${input.inboundEnabled}, gift_enabled = ${input.giftEnabled}, payment_mode = ${input.paymentMode}, credit_limit = ${input.creditLimit}::numeric,
          payment_term_days = ${input.paymentTermDays}, tax_percent = ${input.taxPercent}::numeric, connector = ${input.connector}, member_pattern = ${input.memberPattern},
          updated_by = ${actor.userId}, updated_at = now(), version = version + 1
        WHERE id = ${contractId}`);
      await writeLimits(transaction, contractId, input.limits);
      await this.record(actor, "loyalty_partner_contract.update", contractId, input, transaction);
    });
    return this.detail(actor, contractId, true);
  }

  // Kích hoạt (nháp, tạm ngưng), tạm ngưng (kèm lý do), chấm dứt (kèm lý do, không quay lại; liên kết thành viên hết hiệu lực).
  async changeStatus(actor: BuyerAdminActor, contractId: string, target: "active" | "suspended" | "terminated", version: number, reason: string | null): Promise<PartnerContractDetail> {
    if (target !== "active" && !reason) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { reason: "required" } });
    await this.database.transaction(async (transaction) => {
      const row = await contractRow(transaction, contractId, actor.operatorCompanyId, true);
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const allowed: Record<typeof target, PartnerContractStatus[]> = { active: ["draft", "suspended"], suspended: ["active"], terminated: ["draft", "active", "suspended"] };
      if (!allowed[target].includes(row.status)) throw new ApiError("BUSINESS_RULE", "partnerContractStatusInvalid");
      await transaction.execute(sql`
        UPDATE loyalty.partner_contracts SET status = ${target}, status_reason = ${target === "active" ? null : reason}, updated_by = ${actor.userId}, updated_at = now(),
          version = version + 1
        WHERE id = ${contractId}`);
      if (target === "terminated") {
        await transaction.execute(sql`UPDATE loyalty.partner_memberships SET status = 'unlinked', unlinked_at = now() WHERE contract_id = ${contractId} AND status = 'linked'`);
      }
      await this.record(actor, `loyalty_partner_contract.${target}`, contractId, { reason }, transaction);
    });
    return this.detail(actor, contractId, true);
  }

  // Không chồng lấn trong cùng chiều: khóa dòng hợp đồng rồi kiểm, nên hai người lưu cùng lúc không tạo chồng lấn (QUYTAC_NGHIEPVU_539).
  private async assertNoOverlap(executor: Executor, contractId: string, direction: PartnerDirection, startsOn: string, endsOn: string | null, exceptId: string | null) {
    const overlap = await executor.execute(sql`
      SELECT 1 FROM loyalty.partner_rates WHERE contract_id = ${contractId} AND direction = ${direction} AND (${exceptId}::uuid IS NULL OR id <> ${exceptId}::uuid)
        AND daterange(starts_on, ends_on, '[]') && daterange(${startsOn}::date, ${endsOn}::date, '[]') LIMIT 1`);
    if (overlap.rows.length > 0) throw new ApiError("BUSINESS_RULE", "partnerRateOverlap");
  }

  // Giai đoạn mới bắt đầu từ hôm nay trở đi (như QUYTAC_NGHIEPVU_345) để không áp ngược cho giao dịch đã có.
  async createRate(actor: BuyerAdminActor, contractId: string, input: z.infer<typeof partnerRateCreateSchema>): Promise<PartnerRate> {
    const today = await vietnamToday(this.database);
    if (input.startsOn < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { startsOn: "loyaltyPhaseStartInPast" } });
    const row = await this.database.transaction(async (transaction) => {
      const contract = await contractRow(transaction, contractId, actor.operatorCompanyId, true);
      if (contract.status === "terminated") throw new ApiError("BUSINESS_RULE", "partnerContractTerminated");
      await this.assertNoOverlap(transaction, contractId, input.direction, input.startsOn, input.endsOn, null);
      const inserted = (
        await transaction.execute<RateRow>(sql`
          INSERT INTO loyalty.partner_rates (contract_id, direction, starts_on, ends_on, vcomm_points, partner_units, unit_price, created_by, updated_by)
          VALUES (${contractId}, ${input.direction}, ${input.startsOn}::date, ${input.endsOn}::date, ${input.vcommPoints}, ${input.partnerUnits}, ${input.unitPrice}::numeric,
            ${actor.userId}, ${actor.userId})
          RETURNING id, direction, starts_on::text, ends_on::text, vcomm_points, partner_units, unit_price::text, version`)
      ).rows[0]!;
      await this.record(actor, "loyalty_partner_rate.create", contractId, input, transaction);
      return inserted;
    });
    return rateOf(row, today);
  }

  // Giai đoạn chưa bắt đầu sửa được mọi tham số; đã bắt đầu chỉ sửa ngày kết thúc, không trước hôm nay.
  async updateRate(actor: BuyerAdminActor, rateId: string, input: z.infer<typeof partnerRateUpdateSchema>): Promise<PartnerRate> {
    const today = await vietnamToday(this.database);
    const row = await this.database.transaction(async (transaction) => {
      const contractId = await this.rateContract(transaction, actor, rateId);
      await contractRow(transaction, contractId, actor.operatorCompanyId, true);
      const current = (
        await transaction.execute<RateRow>(sql`
          SELECT id, direction, starts_on::text, ends_on::text, vcomm_points, partner_units, unit_price::text, version FROM loyalty.partner_rates WHERE id = ${rateId} FOR UPDATE`)
      ).rows[0]!;
      if (current.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if ((current.direction === "gift") !== (input.vcommPoints === null && input.partnerUnits === null) || (input.vcommPoints === null) !== (input.partnerUnits === null))
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { vcommPoints: "invalidValue" } });
      if (rateStatus(current, today) === "upcoming") {
        if (input.startsOn < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { startsOn: "loyaltyPhaseStartInPast" } });
      } else {
        const same =
          input.startsOn === current.starts_on && input.vcommPoints === current.vcomm_points && input.partnerUnits === current.partner_units && Number(input.unitPrice) === Number(current.unit_price);
        if (!same) throw new ApiError("BUSINESS_RULE", "partnerRateStarted");
        if (input.endsOn !== null && input.endsOn < today) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { endsOn: "loyaltyPhaseEndInPast" } });
      }
      await this.assertNoOverlap(transaction, contractId, current.direction, input.startsOn, input.endsOn, rateId);
      const updated = (
        await transaction.execute<RateRow>(sql`
          UPDATE loyalty.partner_rates SET starts_on = ${input.startsOn}::date, ends_on = ${input.endsOn}::date, vcomm_points = ${input.vcommPoints},
            partner_units = ${input.partnerUnits}, unit_price = ${input.unitPrice}::numeric, updated_by = ${actor.userId}, updated_at = now(), version = version + 1
          WHERE id = ${rateId}
          RETURNING id, direction, starts_on::text, ends_on::text, vcomm_points, partner_units, unit_price::text, version`)
      ).rows[0]!;
      await this.record(actor, "loyalty_partner_rate.update", contractId, { rateId, before: rateOf(current, today), after: input }, transaction);
      return updated;
    });
    return rateOf(row, today);
  }

  async deleteRate(actor: BuyerAdminActor, rateId: string): Promise<void> {
    const today = await vietnamToday(this.database);
    await this.database.transaction(async (transaction) => {
      const contractId = await this.rateContract(transaction, actor, rateId);
      await contractRow(transaction, contractId, actor.operatorCompanyId, true);
      const current = (
        await transaction.execute<RateRow>(sql`
          SELECT id, direction, starts_on::text, ends_on::text, vcomm_points, partner_units, unit_price::text, version FROM loyalty.partner_rates WHERE id = ${rateId} FOR UPDATE`)
      ).rows[0]!;
      if (rateStatus(current, today) !== "upcoming") throw new ApiError("BUSINESS_RULE", "partnerRateStarted");
      await transaction.execute(sql`DELETE FROM loyalty.partner_rates WHERE id = ${rateId}`);
      await this.record(actor, "loyalty_partner_rate.delete", contractId, { rateId, before: rateOf(current, today) }, transaction);
    });
  }

  private async rateContract(executor: Executor, actor: BuyerAdminActor, rateId: string): Promise<string> {
    const row = (
      await executor.execute<{ contract_id: string }>(sql`
        SELECT r.contract_id FROM loyalty.partner_rates r JOIN loyalty.partner_contracts c ON c.id = r.contract_id
        WHERE r.id = ${rateId} AND c.company_id = ${actor.operatorCompanyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row.contract_id;
  }

  // Bộ giả lập (QUYTAC_NGHIEPVU_550): xem chế độ, thành viên giả; số điện thoại hiện đầy đủ vì là dữ liệu giả của bộ giả lập.
  async simulator(actor: BuyerAdminActor, contractId: string): Promise<PartnerSimulatorState> {
    await contractRow(this.database, contractId, actor.operatorCompanyId);
    const mode = (await this.database.execute<{ mode: PartnerSimulatorMode }>(sql`SELECT mode FROM loyalty.partner_simulator_settings WHERE contract_id = ${contractId}`)).rows[0]?.mode;
    const members = await this.database.execute<{ member_number: string; full_name: string; phone: string; balance_units: number }>(sql`
      SELECT member_number, full_name, phone, balance_units FROM loyalty.partner_simulator_members WHERE contract_id = ${contractId} ORDER BY created_at, member_number`);
    return {
      enabled: simulatorEnabled(),
      mode: mode ?? "normal",
      members: members.rows.map((row) => ({ memberNumber: row.member_number, fullName: row.full_name, phone: row.phone, balanceUnits: row.balance_units })),
    };
  }

  private assertSimulator(row: ContractRow) {
    if (row.connector !== "simulator" || !simulatorEnabled()) throw new ApiError("BUSINESS_RULE", "partnerConnectorUnavailable");
  }

  async setSimulatorMode(actor: BuyerAdminActor, contractId: string, mode: PartnerSimulatorMode): Promise<PartnerSimulatorState> {
    await this.database.transaction(async (transaction) => {
      this.assertSimulator(await contractRow(transaction, contractId, actor.operatorCompanyId, true));
      await transaction.execute(sql`
        INSERT INTO loyalty.partner_simulator_settings (contract_id, mode, updated_by) VALUES (${contractId}, ${mode}, ${actor.userId})
        ON CONFLICT (contract_id) DO UPDATE SET mode = EXCLUDED.mode, updated_by = EXCLUDED.updated_by, updated_at = now()`);
      await this.record(actor, "loyalty_partner_simulator.mode", contractId, { mode }, transaction);
    });
    return this.simulator(actor, contractId);
  }

  async upsertSimulatorMember(actor: BuyerAdminActor, contractId: string, input: z.infer<typeof partnerSimulatorMemberSchema>): Promise<PartnerSimulatorState> {
    await this.database.transaction(async (transaction) => {
      this.assertSimulator(await contractRow(transaction, contractId, actor.operatorCompanyId, true));
      await transaction.execute(sql`
        INSERT INTO loyalty.partner_simulator_members (contract_id, member_number, full_name, phone, balance_units)
        VALUES (${contractId}, ${input.memberNumber}, ${input.fullName}, ${input.phone}, ${input.balanceUnits})
        ON CONFLICT (contract_id, member_number) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, balance_units = EXCLUDED.balance_units`);
      // Không ghi số thành viên vào nhật ký thao tác (QUYTAC_NGHIEPVU_550).
      await this.record(actor, "loyalty_partner_simulator.member", contractId, {}, transaction);
    });
    return this.simulator(actor, contractId);
  }
}
