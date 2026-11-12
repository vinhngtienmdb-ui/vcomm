// Giao dịch đổi điểm với đối tác liên minh: đổi ra, đổi vào, chờ đối tác, xử lý tay (CONG_VIEC_65; CHUC_NANG_237; QUYTAC_NGHIEPVU_539, 540, 542 đến 544, 547; API_304, API_307).
// Trạng thái giao dịch lưu trước khi gọi đối tác; gọi đối tác ngoài giao dịch cơ sở dữ liệu để không giữ khóa khi chờ.
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  BuyerPartnerExchange,
  BuyerPartnerExchangeQuote,
  PageResponse,
  PartnerExchangeDirection,
  PartnerExchangeItem,
  PartnerExchangeStatus,
  partnerExchangeListQuerySchema,
  partnerExchangeResolveSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { LedgerService } from "../../accounting/ledger.service";
import { trimDecimal } from "../../catalog/catalog-context";
import { ApiError } from "../../common/api-error";
import { AuditService } from "../../common/audit.service";
import { CLOCK, type Clock } from "../../common/clock";
import { notify } from "../../common/notifications";
import { DATABASE, type Database } from "../../database/database.module";
import { usersWithPermission } from "../../hr/attendance-access";
import type { BuyerAdminActor } from "../../marketplace/buyer-admin.service";
import { vietnamToday } from "../../marketplace/shop.service";
import { creditLot, refundRedeemEntry, spendPointsWithin } from "../ledger.service";
import { phaseOn } from "../program.service";
import { maskName, SmartOtpService } from "../smart-otp.service";
import { lockAccount } from "../tiers";
import { assertBuyer, maskMemberNumber, openContract } from "./buyer-partners.service";
import { PartnerConnectors, type PartnerContractRef } from "./connector";
import { rateOn } from "./contracts.service";
import { exchangeDraft, marginTax } from "./postings";

type Executor = Pick<Database, "execute">;
const otpLifetimeMinutes = 5;
const recheckMinutes = 5;
const reviewAfterHours = 24;
// Trạng thái chiếm giới hạn (QUYTAC_NGHIEPVU_540): giao dịch đang chờ và hoàn tất.
const countedStatuses = sql`('sending', 'pending_partner', 'needs_review', 'completed')`;

type ExchangeRow = {
  id: string;
  document_no: string;
  contract_id: string;
  contract_code: string;
  company_id: string;
  partner_name: string;
  program_name: string;
  unit_name_vi: string;
  unit_name_en: string;
  connector: "simulator";
  tax_percent: string;
  user_id: string;
  full_name: string;
  member_number: string;
  direction: PartnerExchangeDirection;
  vcomm_points: number;
  partner_units: number;
  unit_price: string;
  amount: string;
  tax_amount: string;
  point_value_amount: string | null;
  point_value: string | null;
  validity_months: number | null;
  reference: string;
  partner_reference: string | null;
  status: PartnerExchangeStatus;
  attempts: number;
  last_error_code: string | null;
  otp_expires_at: Date | null;
  redeem_entry_id: string | null;
  resolution_note: string | null;
  created_at: Date;
  completed_at: Date | null;
};

const exchangeColumns = sql`x.id, x.document_no, x.contract_id, c.code AS contract_code, c.company_id, p.name AS partner_name, c.program_name, c.unit_name_vi, c.unit_name_en,
  c.connector, c.tax_percent::text, x.user_id, u.full_name, m.member_number, x.direction, x.vcomm_points, x.partner_units, x.unit_price::text, x.amount::text,
  x.tax_amount::text, x.point_value_amount::text, x.point_value::text, x.validity_months, x.reference, x.partner_reference, x.status, x.attempts, x.last_error_code,
  x.otp_expires_at, x.redeem_entry_id, x.resolution_note, x.created_at, x.completed_at`;
const exchangeFrom = sql`loyalty.partner_exchanges x JOIN loyalty.partner_contracts c ON c.id = x.contract_id JOIN crm.partners p ON p.id = c.partner_id
  JOIN core.users u ON u.id = x.user_id JOIN loyalty.partner_memberships m ON m.id = x.membership_id`;

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

const buyerItemOf = (row: ExchangeRow): BuyerPartnerExchange => ({
  id: row.id,
  documentNo: row.document_no,
  contractId: row.contract_id,
  partnerName: row.partner_name,
  programName: row.program_name,
  unitNameVi: row.unit_name_vi,
  unitNameEn: row.unit_name_en,
  direction: row.direction,
  vcommPoints: row.vcomm_points,
  partnerUnits: row.partner_units,
  status: row.status,
  otpExpiresAt: row.status === "otp_pending" ? iso(row.otp_expires_at) : null,
  createdAt: iso(row.created_at)!,
  completedAt: iso(row.completed_at),
});

const adminItemOf = (row: ExchangeRow): PartnerExchangeItem => ({
  ...buyerItemOf(row),
  contractCode: row.contract_code,
  customerMasked: maskName(row.full_name),
  memberNumberMasked: maskMemberNumber(row.member_number),
  unitPrice: trimDecimal(row.unit_price),
  amount: trimDecimal(row.amount),
  taxAmount: trimDecimal(row.tax_amount),
  pointValueAmount: row.point_value_amount === null ? null : trimDecimal(row.point_value_amount),
  reference: row.reference,
  partnerReference: row.partner_reference,
  attempts: row.attempts,
  lastErrorCode: row.last_error_code,
  resolutionNote: row.resolution_note,
});

const contractRef = (row: { contract_id: string; connector: "simulator" }): PartnerContractRef => ({ id: row.contract_id, connector: row.connector });

@Injectable()
export class PartnerExchangesService {
  private readonly logger = new Logger("PartnerExchanges");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly connectors: PartnerConnectors,
    private readonly smartOtp: SmartOtpService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  private async row(executor: Executor, id: string, lock = false): Promise<ExchangeRow | undefined> {
    return (await executor.execute<ExchangeRow>(sql`SELECT ${exchangeColumns} FROM ${exchangeFrom} WHERE x.id = ${id} ${lock ? sql`FOR UPDATE OF x` : sql``}`)).rows[0];
  }

  // Điều kiện chung của hai chiều: hợp đồng mở, chiều được phép, tỷ lệ hiệu lực, liên kết thành viên; số đơn vị là bội số của tỷ lệ (QUYTAC_NGHIEPVU_539).
  private async prepare(executor: Executor, userId: string, contractId: string, direction: PartnerExchangeDirection, partnerUnits: number) {
    await assertBuyer(executor, userId);
    const today = await vietnamToday(executor);
    const contract = await openContract(executor, contractId, today);
    const terms = (
      await executor.execute<{ outbound_enabled: boolean; inbound_enabled: boolean; company_id: string; tax_percent: string }>(sql`
        SELECT outbound_enabled, inbound_enabled, company_id, tax_percent::text FROM loyalty.partner_contracts WHERE id = ${contractId}`)
    ).rows[0]!;
    if (!terms[`${direction}_enabled`]) throw new ApiError("BUSINESS_RULE", "partnerDirectionDisabled");
    const rate = await rateOn(executor, contractId, direction, today);
    if (!rate || rate.vcomm_points === null || rate.partner_units === null) throw new ApiError("BUSINESS_RULE", "partnerNoRate");
    if (partnerUnits % rate.partner_units !== 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { partnerUnits: "partnerUnitsNotMultiple" } });
    const membership = (
      await executor.execute<{ id: string; member_number: string }>(sql`
        SELECT id, member_number FROM loyalty.partner_memberships WHERE contract_id = ${contractId} AND user_id = ${userId} AND status = 'linked'`)
    ).rows[0];
    if (!membership) throw new ApiError("BUSINESS_RULE", "partnerNotLinked");
    const points = (partnerUnits / rate.partner_units) * rate.vcomm_points;
    return { today, contract, terms, rate, membership, points };
  }

  // Giới hạn ba tầng (QUYTAC_NGHIEPVU_540): còn lại theo ngày, tháng của khách và tháng của đối tác (giờ Việt Nam).
  private async remaining(executor: Executor, userId: string, contractId: string, direction: PartnerExchangeDirection) {
    const limit = (
      await executor.execute<{
        min_points: number | null;
        max_points: number | null;
        customer_daily_points: number | null;
        customer_monthly_points: number | null;
        partner_monthly_points: number | null;
      }>(sql`
        SELECT min_points, max_points, customer_daily_points, customer_monthly_points, partner_monthly_points FROM loyalty.partner_limits
        WHERE contract_id = ${contractId} AND direction = ${direction}`)
    ).rows[0];
    const used = (
      await executor.execute<{ customer_day: number; customer_month: number; partner_month: number }>(sql`
        SELECT
          coalesce(sum(vcomm_points) FILTER (WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date), 0)::int AS customer_day,
          coalesce(sum(vcomm_points) FILTER (WHERE user_id = ${userId}), 0)::int AS customer_month,
          coalesce(sum(vcomm_points), 0)::int AS partner_month
        FROM loyalty.partner_exchanges
        WHERE contract_id = ${contractId} AND direction = ${direction}
          AND (status IN ${countedStatuses} OR (status = 'otp_pending' AND otp_expires_at > now()))
          AND date_trunc('month', created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')`)
    ).rows[0]!;
    const left = (cap: number | null | undefined, usedPoints: number) => (cap === null || cap === undefined ? null : Math.max(cap - usedPoints, 0));
    return {
      minPoints: limit?.min_points ?? null,
      maxPoints: limit?.max_points ?? null,
      today: left(limit?.customer_daily_points, used.customer_day),
      month: left(limit?.customer_monthly_points, used.customer_month),
      partnerMonth: left(limit?.partner_monthly_points, used.partner_month),
    };
  }

  private assertWithinLimits(points: number, remaining: Awaited<ReturnType<PartnerExchangesService["remaining"]>>) {
    const exceeded =
      (remaining.minPoints !== null && points < remaining.minPoints) ||
      (remaining.maxPoints !== null && points > remaining.maxPoints) ||
      (remaining.today !== null && points > remaining.today) ||
      (remaining.month !== null && points > remaining.month) ||
      (remaining.partnerMonth !== null && points > remaining.partnerMonth);
    if (exceeded) throw new ApiError("BUSINESS_RULE", "partnerLimitExceeded");
  }

  private async availablePoints(executor: Executor, userId: string, today: string): Promise<number> {
    return (
      await executor.execute<{ total: number }>(sql`
        SELECT coalesce(sum(remaining), 0)::int AS total FROM loyalty.lots WHERE user_id = ${userId} AND remaining > 0 AND expires_on >= ${today}::date`)
    ).rows[0]!.total;
  }

  async quote(userId: string, input: { contractId: string; direction: PartnerExchangeDirection; partnerUnits: number }): Promise<BuyerPartnerExchangeQuote> {
    const prepared = await this.prepare(this.database, userId, input.contractId, input.direction, input.partnerUnits);
    const remaining = await this.remaining(this.database, userId, input.contractId, input.direction);
    const smart = input.direction === "outbound" ? await this.smartOtp.state(this.database, userId) : { active: false };
    return {
      direction: input.direction,
      partnerUnits: input.partnerUnits,
      vcommPoints: prepared.points,
      unitStep: prepared.rate.partner_units!,
      availablePoints: input.direction === "outbound" ? await this.availablePoints(this.database, userId, prepared.today) : null,
      remainingToday: remaining.today,
      remainingThisMonth: remaining.month,
      minPoints: remaining.minPoints,
      maxPoints: remaining.maxPoints,
      smartOtpRequired: smart.active,
    };
  }

  private async nextDocumentNo(executor: Executor): Promise<string> {
    const row = (
      await executor.execute<{ value: string }>(sql`
        SELECT 'DL-' || to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY') || '-' || lpad(nextval('loyalty.partner_exchange_no_seq')::text, 6, '0') AS value`)
    ).rows[0]!;
    return row.value;
  }

  // Khóa theo đối tác và chiều để đếm giới hạn đúng khi nhiều khách đổi cùng lúc.
  private async lockLimits(executor: Executor, contractId: string, direction: PartnerExchangeDirection) {
    await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`partner-exchange:${contractId}:${direction}`}))`);
  }

  async create(userId: string, input: { contractId: string; direction: PartnerExchangeDirection; partnerUnits: number; smartOtp?: string | undefined }): Promise<BuyerPartnerExchange> {
    return input.direction === "outbound" ? this.createOutbound(userId, input) : this.requestInbound(userId, input);
  }

  // Đổi ra (QUYTAC_NGHIEPVU_542): Smart OTP khi khách đã kích hoạt; trừ điểm VComm từ lô hạn sớm nhất, lưu giao dịch, rồi gọi đối tác cộng điểm.
  private async createOutbound(userId: string, input: { contractId: string; partnerUnits: number; smartOtp?: string | undefined }): Promise<BuyerPartnerExchange> {
    const prepared = await this.prepare(this.database, userId, input.contractId, "outbound", input.partnerUnits);
    if ((await this.smartOtp.state(this.database, userId)).active) {
      if (!input.smartOtp) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { smartOtp: "required" } });
      await this.smartOtp.verify(userId, input.smartOtp, prepared.terms.company_id);
    }
    const amount = (input.partnerUnits * Number(prepared.rate.unit_price)).toFixed(4);
    const id = await this.database.transaction(async (transaction) => {
      await this.lockLimits(transaction, input.contractId, "outbound");
      this.assertWithinLimits(prepared.points, await this.remaining(transaction, userId, input.contractId, "outbound"));
      const inserted = (
        await transaction.execute<{ id: string }>(sql`
          INSERT INTO loyalty.partner_exchanges (document_no, contract_id, membership_id, user_id, direction, rate_id, vcomm_points, partner_units, unit_price, amount, reference, status)
          VALUES (${await this.nextDocumentNo(transaction)}, ${input.contractId}, ${prepared.membership.id}, ${userId}, 'outbound', ${prepared.rate.id}, ${prepared.points},
            ${input.partnerUnits}, ${prepared.rate.unit_price}::numeric, ${amount}::numeric, ${`VCX-${randomBytes(9).toString("base64url")}`}, 'sending')
          RETURNING id`)
      ).rows[0]!.id;
      const spent = await spendPointsWithin(transaction, {
        userId,
        companyId: prepared.terms.company_id,
        sourceType: "partner_exchange",
        sourceId: inserted,
        day: prepared.today,
        points: prepared.points,
      });
      await transaction.execute(sql`UPDATE loyalty.partner_exchanges SET redeem_entry_id = ${spent.entryId} WHERE id = ${inserted}`);
      return inserted;
    });
    await this.sendOutbound(id);
    return buyerItemOf((await this.row(this.database, id))!);
  }

  // Gọi đối tác cộng điểm (lần đầu hoặc gửi lại cùng mã tham chiếu) và xử lý kết quả.
  private async sendOutbound(id: string): Promise<void> {
    const row = (await this.row(this.database, id))!;
    const result = await this.connectors.of(contractRef(row)).creditPoints(contractRef(row), { memberNumber: row.member_number, units: row.partner_units, reference: row.reference });
    if (result.outcome === "success") await this.complete(id, result.value.partnerReference, null);
    else if (result.outcome === "rejected") await this.fail(id, result.code, null, null);
    else await this.wait(id, result.code);
  }

  // Không rõ kết quả: chờ đối tác, hỏi lại sau 5 phút (QUYTAC_NGHIEPVU_543).
  private async wait(id: string, code: string): Promise<void> {
    await this.database.execute(sql`
      UPDATE loyalty.partner_exchanges SET status = 'pending_partner', attempts = attempts + 1, last_error_code = ${code},
        next_check_at = now() + make_interval(mins => ${recheckMinutes}), updated_at = now()
      WHERE id = ${id} AND status IN ('sending', 'pending_partner')`);
  }

  // Hoàn tất: đổi ra ghi giá trị lúc tích của lô đã lấy; đổi vào cộng lô điểm VComm. Hạch toán, thông báo khách.
  private async complete(id: string, partnerReference: string, resolvedBy: string | null, note: string | null = null): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, id, true);
      if (!row || !["sending", "pending_partner", "needs_review"].includes(row.status)) return;
      let pointValueAmount: number;
      if (row.direction === "outbound") {
        pointValueAmount = Number(
          (
            await transaction.execute<{ value: string }>(sql`
              SELECT coalesce(sum(abs(points) * point_value), 0)::text AS value FROM loyalty.entry_lots WHERE entry_id = ${row.redeem_entry_id}`)
          ).rows[0]!.value,
        );
      } else {
        pointValueAmount = row.vcomm_points * Number(row.point_value);
        await lockAccount(transaction, row.user_id);
        const day = await vietnamToday(transaction);
        await creditLot(transaction, {
          userId: row.user_id,
          kind: "earn",
          sourceType: "partner_exchange",
          sourceId: id,
          companyId: row.company_id,
          points: row.vcomm_points,
          pointValue: Number(row.point_value),
          day,
          validityMonths: row.validity_months!,
        });
      }
      const tax = row.direction === "inbound" ? marginTax(Number(row.amount), pointValueAmount, Number(row.tax_percent)) : 0;
      await transaction.execute(sql`
        UPDATE loyalty.partner_exchanges SET status = 'completed', completed_at = now(), partner_reference = ${partnerReference}, point_value_amount = ${pointValueAmount.toFixed(4)}::numeric,
          tax_amount = ${tax}, resolved_by = ${resolvedBy}, resolution_note = ${note}, next_check_at = NULL, updated_at = now()
        WHERE id = ${id}`);
      await this.ledger.record(transaction, await exchangeDraft(transaction, id));
      await notify(transaction, [
        {
          userId: row.user_id,
          companyId: row.company_id,
          kind: "loyalty.partner_exchange",
          title:
            row.direction === "outbound"
              ? `Đã đổi ${row.vcomm_points.toLocaleString("vi-VN")} điểm VComm lấy ${row.partner_units.toLocaleString("vi-VN")} ${row.unit_name_vi} ${row.program_name}`
              : `Bạn được cộng ${row.vcomm_points.toLocaleString("vi-VN")} điểm VComm đổi từ ${row.program_name}`,
          payload: { exchangeId: id },
        },
      ]);
    });
  }

  // Thất bại: đổi ra hoàn điểm vào đúng lô (QUYTAC_NGHIEPVU_542); nhân viên chọn hoàn điểm thì trạng thái Đã hoàn điểm. Đổi vào chưa cộng điểm nên chỉ đổi trạng thái.
  private async fail(id: string, code: string | null, resolvedBy: string | null, note: string | null): Promise<void> {
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, id, true);
      if (!row || !["sending", "otp_pending", "pending_partner", "needs_review"].includes(row.status)) return;
      if (row.direction === "outbound" && row.redeem_entry_id) {
        await refundRedeemEntry(transaction, {
          entryId: row.redeem_entry_id,
          userId: row.user_id,
          sourceType: "partner_exchange",
          sourceId: id,
          companyId: row.company_id,
          day: await vietnamToday(transaction),
        });
      }
      const status = row.direction === "outbound" && resolvedBy ? "refunded" : "failed";
      await transaction.execute(sql`
        UPDATE loyalty.partner_exchanges SET status = ${status}, last_error_code = coalesce(${code}, last_error_code), resolved_by = ${resolvedBy}, resolution_note = ${note},
          next_check_at = NULL, updated_at = now()
        WHERE id = ${id}`);
      await notify(transaction, [
        {
          userId: row.user_id,
          companyId: row.company_id,
          kind: "loyalty.partner_exchange",
          title:
            row.direction === "outbound"
              ? `Đổi điểm sang ${row.program_name} không thành công, đã hoàn ${row.vcomm_points.toLocaleString("vi-VN")} điểm VComm`
              : `Đổi điểm từ ${row.program_name} không thành công`,
          payload: { exchangeId: id },
        },
      ]);
    });
  }

  // Đổi vào bước 1 (QUYTAC_NGHIEPVU_544): lưu giao dịch chờ OTP rồi gọi đối tác giữ yêu cầu trừ điểm, gửi OTP cho khách.
  private async requestInbound(userId: string, input: { contractId: string; partnerUnits: number }): Promise<BuyerPartnerExchange> {
    const prepared = await this.prepare(this.database, userId, input.contractId, "inbound", input.partnerUnits);
    const phase = await phaseOn(this.database, prepared.today);
    if (!phase) throw new ApiError("BUSINESS_RULE", "loyaltyNoPhase");
    const account = (await this.database.execute<{ locked: boolean }>(sql`SELECT locked FROM loyalty.accounts WHERE user_id = ${userId}`)).rows[0];
    if (account?.locked) throw new ApiError("BUSINESS_RULE", "loyaltyLocked");
    const amount = (input.partnerUnits * Number(prepared.rate.unit_price)).toFixed(4);
    const id = await this.database.transaction(async (transaction) => {
      await this.lockLimits(transaction, input.contractId, "inbound");
      this.assertWithinLimits(prepared.points, await this.remaining(transaction, userId, input.contractId, "inbound"));
      return (
        await transaction.execute<{ id: string }>(sql`
          INSERT INTO loyalty.partner_exchanges (document_no, contract_id, membership_id, user_id, direction, rate_id, vcomm_points, partner_units, unit_price, amount,
            point_value, validity_months, reference, status, otp_expires_at)
          VALUES (${await this.nextDocumentNo(transaction)}, ${input.contractId}, ${prepared.membership.id}, ${userId}, 'inbound', ${prepared.rate.id}, ${prepared.points},
            ${input.partnerUnits}, ${prepared.rate.unit_price}::numeric, ${amount}::numeric, ${phase.pointValue}, ${phase.validityMonths},
            ${`VCX-${randomBytes(9).toString("base64url")}`}, 'otp_pending', ${new Date(this.clock.now().getTime() + otpLifetimeMinutes * 60_000)})
          RETURNING id`)
      ).rows[0]!.id;
    });
    const row = (await this.row(this.database, id))!;
    const result = await this.connectors.of(contractRef(row)).requestDebit(contractRef(row), { memberNumber: row.member_number, units: row.partner_units, reference: row.reference });
    if (result.outcome !== "success") {
      await this.database.execute(sql`UPDATE loyalty.partner_exchanges SET status = 'failed', last_error_code = ${result.code}, updated_at = now() WHERE id = ${id}`);
      throw new ApiError("BUSINESS_RULE", result.outcome === "rejected" ? "partnerRejected" : "partnerConnectionFailed");
    }
    return buyerItemOf((await this.row(this.database, id))!);
  }

  // Đổi vào bước 2: khách nhập OTP; đối tác trừ điểm thì cộng điểm VComm. Mã sai giữ chờ OTP để nhập lại.
  async confirmInbound(userId: string, id: string, otp: string): Promise<BuyerPartnerExchange> {
    const claimed = await this.database.execute<{ id: string }>(sql`
      UPDATE loyalty.partner_exchanges SET status = 'sending', updated_at = now()
      WHERE id = ${id} AND user_id = ${userId} AND direction = 'inbound' AND status = 'otp_pending' AND otp_expires_at > ${this.clock.now()} RETURNING id`);
    if (claimed.rows.length === 0) {
      const current = (await this.database.execute<{ status: string }>(sql`SELECT status FROM loyalty.partner_exchanges WHERE id = ${id} AND user_id = ${userId}`)).rows[0];
      if (!current) throw new ApiError("NOT_FOUND", "notFound");
      if (current.status === "otp_pending") await this.database.execute(sql`UPDATE loyalty.partner_exchanges SET status = 'expired', updated_at = now() WHERE id = ${id}`);
      throw new ApiError("BUSINESS_RULE", "partnerOtpInvalid");
    }
    const row = (await this.row(this.database, id))!;
    const result = await this.connectors.of(contractRef(row)).confirmDebit(contractRef(row), { reference: row.reference, otp });
    if (result.outcome === "success") {
      await this.complete(id, result.value.partnerReference, null);
    } else if (result.outcome === "rejected" && result.code === "OTP_INVALID") {
      await this.database.execute(sql`UPDATE loyalty.partner_exchanges SET status = 'otp_pending', updated_at = now() WHERE id = ${id} AND status = 'sending'`);
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { otp: "partnerOtpInvalid" } });
    } else if (result.outcome === "rejected") {
      await this.fail(id, result.code, null, null);
    } else {
      await this.wait(id, result.code);
    }
    return buyerItemOf((await this.row(this.database, id))!);
  }

  async buyerList(userId: string, page: number, pageSize: number): Promise<PageResponse<BuyerPartnerExchange>> {
    await assertBuyer(this.database, userId);
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM loyalty.partner_exchanges WHERE user_id = ${userId}`)).rows[0]!.total;
    const rows = await this.database.execute<ExchangeRow>(sql`
      SELECT ${exchangeColumns} FROM ${exchangeFrom} WHERE x.user_id = ${userId} ORDER BY x.created_at DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
    return { data: rows.rows.map(buyerItemOf), page, pageSize, total };
  }

  async buyerDetail(userId: string, id: string): Promise<BuyerPartnerExchange> {
    const row = await this.row(this.database, id);
    if (!row || row.user_id !== userId) throw new ApiError("NOT_FOUND", "notFound");
    return buyerItemOf(row);
  }

  async list(actor: BuyerAdminActor, query: z.infer<typeof partnerExchangeListQuerySchema>): Promise<PageResponse<PartnerExchangeItem>> {
    const where = sql`c.company_id = ${actor.operatorCompanyId}
      ${query.contractId ? sql`AND x.contract_id = ${query.contractId}` : sql``}
      ${query.direction ? sql`AND x.direction = ${query.direction}` : sql``}
      ${query.status ? sql`AND x.status = ${query.status}` : sql``}
      ${query.from ? sql`AND (x.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= ${query.from}::date` : sql``}
      ${query.to ? sql`AND (x.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${query.to}::date` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${exchangeFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<ExchangeRow>(sql`
      SELECT ${exchangeColumns} FROM ${exchangeFrom} WHERE ${where}
      ORDER BY (x.status = 'needs_review') DESC, x.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(adminItemOf), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: BuyerAdminActor, id: string): Promise<PartnerExchangeItem> {
    const row = await this.row(this.database, id);
    if (!row || row.company_id !== actor.operatorCompanyId) throw new ApiError("NOT_FOUND", "notFound");
    return adminItemOf(row);
  }

  // Hỏi lại đối tác theo mã tham chiếu: hoàn tất, từ chối thì xử lý; đổi ra đối tác không có giao dịch thì gửi lại cùng mã; đổi vào không có thì thất bại.
  private async recheckOne(id: string): Promise<void> {
    const row = (await this.row(this.database, id))!;
    const result = await this.connectors.of(contractRef(row)).status(contractRef(row), { reference: row.reference });
    if (result.outcome !== "success") {
      await this.database.execute(sql`
        UPDATE loyalty.partner_exchanges SET attempts = attempts + 1, last_error_code = ${result.code}, next_check_at = now() + make_interval(mins => ${recheckMinutes}),
          updated_at = now()
        WHERE id = ${id} AND status = 'pending_partner'`);
      return;
    }
    const state = result.value;
    if (state.state === "completed") await this.complete(id, state.partnerReference ?? row.reference, null);
    else if (state.state === "rejected") await this.fail(id, "PARTNER_REJECTED", null, null);
    else if (state.state === "not_found" && row.direction === "outbound") await this.sendOutbound(id);
    else if (state.state === "not_found") await this.fail(id, "NOT_FOUND", null, null);
    else await this.wait(id, "PARTNER_PENDING");
  }

  // Việc nền mỗi 5 phút (QUYTAC_NGHIEPVU_543): quá 24 giờ chuyển Cần xử lý, thông báo người có quyền; còn lại hỏi lại đối tác.
  async processDue(limit = 200): Promise<void> {
    // Máy chủ dừng giữa lúc lưu và lúc gọi đối tác: giao dịch Đang gửi quá 2 phút được hỏi lại như giao dịch chờ đối tác.
    await this.database.execute(sql`
      UPDATE loyalty.partner_exchanges SET status = 'pending_partner', next_check_at = now(), updated_at = now()
      WHERE status = 'sending' AND updated_at < now() - interval '2 minutes'`);
    const overdue = await this.database.execute<{ id: string; company_id: string; document_no: string }>(sql`
      UPDATE loyalty.partner_exchanges x SET status = 'needs_review', next_check_at = NULL, updated_at = now()
      FROM loyalty.partner_contracts c
      WHERE c.id = x.contract_id AND x.status = 'pending_partner' AND x.created_at <= now() - make_interval(hours => ${reviewAfterHours})
      RETURNING x.id, c.company_id, x.document_no`);
    for (const exchange of overdue.rows) {
      await this.database.transaction(async (transaction) => {
        const recipients = await usersWithPermission(transaction, exchange.company_id, "loyalty.partner.manage", await vietnamToday(transaction));
        await notify(
          transaction,
          recipients.map((userId) => ({
            userId,
            companyId: exchange.company_id,
            kind: "loyalty.partner_exchange_review",
            title: `Giao dịch đổi điểm đối tác ${exchange.document_no} quá 24 giờ chưa có kết quả, cần xử lý`,
            link: `/crm/loyalty/partner-exchanges?status=needs_review`,
            payload: { exchangeId: exchange.id },
          })),
        );
      });
    }
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM loyalty.partner_exchanges WHERE status = 'pending_partner' AND next_check_at <= now() ORDER BY next_check_at LIMIT ${limit}`);
    for (const exchange of due.rows) {
      try {
        await this.recheckOne(exchange.id);
      } catch (error) {
        this.logger.error(`Không hỏi lại được giao dịch đổi điểm ${exchange.id}: ${(error as Error).message}`);
      }
    }
  }

  // Nhân viên hỏi lại thủ công (giao dịch chờ đối tác hoặc cần xử lý).
  async recheck(actor: BuyerAdminActor, id: string): Promise<PartnerExchangeItem> {
    const row = await this.detail(actor, id);
    if (row.status !== "pending_partner" && row.status !== "needs_review") throw new ApiError("BUSINESS_RULE", "partnerExchangeNotPending");
    const ref = contractRef((await this.row(this.database, id))!);
    const result = await this.connectors.of(ref).status(ref, { reference: row.reference });
    if (result.outcome === "success" && result.value.state === "completed") await this.complete(id, result.value.partnerReference ?? row.reference, actor.userId, "Hỏi lại đối tác");
    else if (result.outcome === "success" && result.value.state === "rejected") await this.fail(id, "PARTNER_REJECTED", null, null);
    else if (row.status === "pending_partner" && result.outcome === "success" && result.value.state === "not_found" && row.direction === "outbound") await this.sendOutbound(id);
    await this.audit.record({
      actorUserId: actor.userId,
      companyId: actor.operatorCompanyId,
      appCode: "crm",
      action: "loyalty_partner_exchange.recheck",
      entityType: "loyalty_partner_exchange",
      entityId: id,
      afterData: { outcome: result.outcome, state: result.outcome === "success" ? result.value.state : null },
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    });
    return this.detail(actor, id);
  }

  // Chốt tay giao dịch Cần xử lý (QUYTAC_NGHIEPVU_543): Hoàn tất kèm mã giao dịch đối tác, hoặc Hoàn điểm (đổi ra) / Thất bại (đổi vào) kèm lý do.
  async resolve(actor: BuyerAdminActor, id: string, input: z.infer<typeof partnerExchangeResolveSchema>): Promise<PartnerExchangeItem> {
    const row = await this.detail(actor, id);
    if (row.status !== "needs_review") throw new ApiError("BUSINESS_RULE", "partnerExchangeNotReview");
    if (input.action === "complete") await this.complete(id, input.partnerReference, actor.userId, "Chốt tay hoàn tất");
    else await this.fail(id, null, actor.userId, input.reason);
    await this.audit.record({
      actorUserId: actor.userId,
      companyId: actor.operatorCompanyId,
      appCode: "crm",
      action: `loyalty_partner_exchange.${input.action}`,
      entityType: "loyalty_partner_exchange",
      entityId: id,
      afterData: input,
      ip: actor.client.ip,
      userAgent: actor.client.userAgent,
      requestId: actor.client.requestId,
    });
    return this.detail(actor, id);
  }
}
