// Đối soát tuần với cửa hàng liên kết (CONG_VIEC_55; CHUC_NANG_196; QUYTAC_NGHIEPVU_403, 404; API_212).
// Việc nền 1 giờ sáng thứ Hai lập bảng tuần trước cho mỗi cửa hàng có giao dịch chưa chốt; chủ cửa hàng xác nhận hoặc khiếu nại; quá số ngày tự xác nhận thì hệ thống xác nhận.
// Xác nhận: bút toán phí, thuế của phí, bù trừ phải thu với phải trả; một khoản công nợ theo số còn lại; phiếu thu, phiếu chi (CONG_VIEC_13) trừ hết thì bảng đã thanh toán.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type {
  AffiliateSettlementDetail,
  AffiliateSettlementItem,
  AffiliateSettlementStatus,
  AffiliateSettlementTransaction,
  AffiliateTransactionStatus,
  AffiliateVoucherIssuer,
  affiliateSettlementListQuerySchema,
  affiliateSettlementResolveSchema,
  PageResponse,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { LedgerService } from "../accounting/ledger.service";
import type { DraftJournal } from "../accounting/postings";
import type { ClientInfo } from "../auth/auth.service";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { DebtsService } from "../finance/debts.service";
import { PaymentsService } from "../finance/payments.service";
import { vietnamToday } from "../marketplace/shop.service";
import { requireOwner, type PortalMember } from "./portal.service";
import { affiliateLines } from "./postings";

type Executor = Pick<Database, "execute">;
// Thời điểm từ truy vấn SQL thô có thể là chuỗi hoặc Date.
const iso = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString());
// Thuế suất giá trị gia tăng của phí dịch vụ (đặc tả mục 18).
export const feeTaxRate = 10;

// Phạm vi xem: công ty vận hành sàn (mọi cửa hàng) hoặc một cửa hàng (chủ cửa hàng).
export interface SettlementActor {
  userId: string;
  companyId: string;
  merchantId: string | null;
  client: ClientInfo;
}

type SettlementRow = {
  id: string;
  document_no: string;
  merchant_id: string;
  merchant_code: string;
  merchant_name: string;
  week_start: string;
  week_end: string;
  transaction_count: number;
  earned_amount: string;
  redeemed_amount: string;
  company_voucher_amount: string;
  shortfall_amount: string;
  fee_percent: string;
  fee_amount: string;
  fee_tax_rate: string;
  fee_tax_amount: string;
  adjustment_amount: string;
  net_amount: string;
  status: AffiliateSettlementStatus;
  confirm_due_at: Date | string;
  confirmed_at: Date | string | null;
  confirmed_by: string | null;
  resolved_by: string | null;
  due_date: string | null;
  open_amount: string | null;
  overdue: boolean;
  version: number;
};

const settlementSelect = sql`
  SELECT s.id, s.document_no, s.merchant_id, m.code AS merchant_code, p.name AS merchant_name, s.week_start::text, (s.week_start + 6)::text AS week_end, s.transaction_count,
    s.earned_amount::text, s.redeemed_amount::text, s.company_voucher_amount::text, s.shortfall_amount::text, s.fee_percent::text, s.fee_amount::text, s.fee_tax_rate::text,
    s.fee_tax_amount::text, s.adjustment_amount::text, s.net_amount::text, s.status, s.confirm_due_at, s.confirmed_at, s.confirmed_by, s.resolved_by, s.due_date::text,
    d.open_amount::text, (d.side = 'receivable' AND d.open_amount > 0 AND d.due_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) AS overdue, s.version
  FROM affiliate.settlements s JOIN affiliate.merchants m ON m.id = s.merchant_id JOIN crm.partners p ON p.id = m.partner_id
  LEFT JOIN finance.debt_items d ON d.id = s.debt_item_id`;

function itemOf(row: SettlementRow): AffiliateSettlementItem {
  return {
    id: row.id,
    documentNo: row.document_no,
    merchantId: row.merchant_id,
    merchantCode: row.merchant_code,
    merchantName: row.merchant_name,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    transactionCount: row.transaction_count,
    earnedAmount: trimDecimal(row.earned_amount),
    redeemedAmount: trimDecimal(row.redeemed_amount),
    companyVoucherAmount: trimDecimal(row.company_voucher_amount),
    shortfallAmount: trimDecimal(row.shortfall_amount),
    feePercent: trimDecimal(row.fee_percent),
    feeAmount: trimDecimal(row.fee_amount),
    feeTaxRate: trimDecimal(row.fee_tax_rate),
    feeTaxAmount: trimDecimal(row.fee_tax_amount),
    adjustmentAmount: trimDecimal(row.adjustment_amount),
    netAmount: trimDecimal(row.net_amount),
    status: row.status,
    confirmDueAt: iso(row.confirm_due_at)!,
    confirmedAt: iso(row.confirmed_at),
    autoConfirmed: row.confirmed_at !== null && row.confirmed_by === null && row.resolved_by === null,
    dueDate: row.due_date,
    openAmount: row.open_amount === null ? null : trimDecimal(row.open_amount),
    overdue: row.overdue === true,
    version: row.version,
  };
}

// Phải thu của bảng đối soát đã xác nhận còn mở, quá hạn thanh toán: chặn tích (QUYTAC_NGHIEPVU_398).
export async function merchantOverdue(executor: Executor, merchantId: string): Promise<boolean> {
  const rows = await executor.execute(sql`
    SELECT 1 FROM affiliate.settlements s JOIN finance.debt_items d ON d.id = s.debt_item_id
    WHERE s.merchant_id = ${merchantId} AND d.side = 'receivable' AND d.open_amount > 0 AND d.due_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date LIMIT 1`);
  return rows.rows.length > 0;
}

// Bút toán khi xác nhận (QUYTAC_NGHIEPVU_404): phí Nợ phải trả / Có doanh thu phí, thuế; điều chỉnh với chi phí điểm; bù trừ Nợ phải trả / Có phải thu bằng số nhỏ hơn.
export function settlementDraft(input: {
  companyId: string;
  partnerId: string;
  id: string;
  documentNo: string;
  date: string;
  earned: number;
  shortfall: number;
  redeemed: number;
  companyVoucher: number;
  fee: number;
  feeTax: number;
  adjustment: number;
}): DraftJournal {
  const receivable = input.earned + input.shortfall + Math.max(input.adjustment, 0);
  const payable = input.redeemed + input.companyVoucher + Math.max(-input.adjustment, 0) - input.fee - input.feeTax;
  const offset = Math.max(Math.min(receivable, payable), 0);
  const partnerId = input.partnerId;
  return {
    companyId: input.companyId,
    sourceType: "affiliate_settlement",
    sourceId: input.id,
    journalNo: input.documentNo,
    date: input.date,
    description: `Đối soát cửa hàng liên kết ${input.documentNo}`,
    lines: affiliateLines([
      { role: "affiliate_payable", amount: input.fee + input.feeTax, partnerId },
      { role: "affiliate_fee_revenue", amount: -input.fee },
      { role: "affiliate_fee_tax", amount: -input.feeTax },
      { role: "affiliate_receivable", amount: Math.max(input.adjustment, 0), partnerId },
      { role: "loyalty_expense", amount: -input.adjustment },
      { role: "affiliate_payable", amount: -Math.max(-input.adjustment, 0), partnerId },
      { role: "affiliate_payable", amount: offset, partnerId },
      { role: "affiliate_receivable", amount: -offset, partnerId },
    ]),
  };
}

@Injectable()
export class AffiliateSettlementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly debts: DebtsService,
    private readonly payments: PaymentsService,
    private readonly accounting: LedgerService,
    private readonly audit: AuditService,
  ) {}

  // Phiếu thu, phiếu chi trừ hết công nợ của bảng: chuyển đã thanh toán trong cùng giao dịch.
  onModuleInit(): void {
    this.payments.postedHooks.push((transaction) => this.refreshPaid(transaction));
  }

  async refreshPaid(executor: Executor): Promise<void> {
    await executor.execute(sql`
      UPDATE affiliate.settlements s SET status = 'paid', paid_at = now(), version = s.version + 1
      FROM finance.debt_items d WHERE d.id = s.debt_item_id AND s.status = 'confirmed' AND d.open_amount = 0`);
  }

  private scope(actor: SettlementActor) {
    return actor.merchantId ? sql`s.company_id = ${actor.companyId} AND s.merchant_id = ${actor.merchantId}` : sql`s.company_id = ${actor.companyId}`;
  }

  async list(actor: SettlementActor, query: z.infer<typeof affiliateSettlementListQuerySchema>): Promise<PageResponse<AffiliateSettlementItem>> {
    const where = sql`${this.scope(actor)}
      ${query.merchantId ? sql`AND s.merchant_id = ${query.merchantId}` : sql``}
      ${query.status ? sql`AND s.status = ${query.status}` : sql``}
      ${query.overdue ? sql`AND d.side = 'receivable' AND d.open_amount > 0 AND d.due_date < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date` : sql``}`;
    const total = (
      await this.database.execute<{ total: number }>(sql`
        SELECT count(*)::int AS total FROM affiliate.settlements s LEFT JOIN finance.debt_items d ON d.id = s.debt_item_id WHERE ${where}`)
    ).rows[0]!.total;
    const rows = await this.database.execute<SettlementRow>(sql`
      ${settlementSelect} WHERE ${where} ORDER BY s.week_start DESC, s.document_no DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map(itemOf), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: SettlementActor, id: string): Promise<AffiliateSettlementDetail> {
    const row = (
      await this.database.execute<
        SettlementRow & {
          dispute_reason: string | null;
          disputed_at: Date | string | null;
          disputed_by_name: string | null;
          resolution_note: string | null;
          adjustment_reason: string | null;
          resolved_at: Date | string | null;
          resolved_by_name: string | null;
          confirmed_by_name: string | null;
          paid_at: Date | string | null;
        }
      >(sql`
        SELECT x.*, s.dispute_reason, s.disputed_at, du.full_name AS disputed_by_name, s.resolution_note, s.adjustment_reason, s.resolved_at, ru.full_name AS resolved_by_name,
          cu.full_name AS confirmed_by_name, s.paid_at
        FROM (${settlementSelect} WHERE ${this.scope(actor)} AND s.id = ${id}) x JOIN affiliate.settlements s ON s.id = x.id
        LEFT JOIN core.users du ON du.id = s.disputed_by LEFT JOIN core.users ru ON ru.id = s.resolved_by LEFT JOIN core.users cu ON cu.id = s.confirmed_by`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const transactions = await this.database.execute<{
      id: string;
      document_no: string;
      completed_at: Date | string;
      outlet_name: string;
      status: AffiliateTransactionStatus;
      bill_amount: string;
      voucher_discount: string;
      voucher_payable: string;
      voucher_issuer: AffiliateVoucherIssuer | null;
      redeemed_amount: string;
      earned_amount: string;
      shortfall_amount: string;
    }>(sql`
      SELECT t.id, t.document_no, t.completed_at, o.name AS outlet_name, t.status, t.bill_amount::text, t.voucher_discount::text, t.voucher_payable::text, v.issuer AS voucher_issuer,
        t.redeemed_amount::text, t.earned_amount::text, t.shortfall_amount::text
      FROM affiliate.transactions t JOIN affiliate.outlets o ON o.id = t.outlet_id
      LEFT JOIN affiliate.voucher_codes c ON c.id = t.voucher_code_id LEFT JOIN affiliate.vouchers v ON v.id = c.voucher_id
      WHERE t.settlement_id = ${id} ORDER BY t.completed_at, t.document_no`);
    return {
      ...itemOf(row),
      disputeReason: row.dispute_reason,
      disputedAt: iso(row.disputed_at),
      disputedByName: row.disputed_by_name,
      resolutionNote: row.resolution_note,
      adjustmentReason: row.adjustment_reason,
      resolvedAt: iso(row.resolved_at),
      resolvedByName: row.resolved_by_name,
      confirmedByName: row.confirmed_by_name,
      paidAt: iso(row.paid_at),
      transactions: transactions.rows.map(
        (item): AffiliateSettlementTransaction => ({
          id: item.id,
          documentNo: item.document_no,
          completedAt: iso(item.completed_at)!,
          outletName: item.outlet_name,
          status: item.status,
          billAmount: trimDecimal(item.bill_amount),
          voucherDiscount: trimDecimal(item.voucher_discount),
          voucherPayable: trimDecimal(item.voucher_payable),
          voucherIssuer: item.voucher_issuer,
          redeemedAmount: trimDecimal(item.redeemed_amount),
          earnedAmount: trimDecimal(item.earned_amount),
          shortfallAmount: trimDecimal(item.shortfall_amount),
        }),
      ),
    };
  }

  // Lập bảng tuần trước (thứ Hai đến Chủ nhật, giờ Việt Nam) cho mỗi cửa hàng có giao dịch chưa chốt hoàn tất đến hết tuần đó; giao dịch sót của tuần cũ gộp vào bảng này.
  async generateWeekly(today?: string): Promise<string[]> {
    const day = today ?? (await vietnamToday(this.database));
    const weekStart = (await this.database.execute<{ value: string }>(sql`SELECT (date_trunc('week', ${day}::date) - interval '7 days')::date::text AS value`)).rows[0]!.value;
    const merchants = await this.database.execute<{ merchant_id: string }>(sql`
      SELECT DISTINCT merchant_id FROM affiliate.transactions
      WHERE settlement_id IS NULL AND status IN ('completed', 'cancelled') AND (completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${weekStart}::date + 6`);
    const created: string[] = [];
    for (const merchant of merchants.rows) {
      const id = await this.database.transaction((transaction) => this.generateFor(transaction, merchant.merchant_id, weekStart));
      if (id) created.push(id);
    }
    return created;
  }

  private async generateFor(executor: Executor, merchantId: string, weekStart: string): Promise<string | null> {
    const merchant = (
      await executor.execute<{ company_id: string; fee_percent: string; auto_confirm_days: number; owner_ids: string[] }>(sql`
        SELECT m.company_id, m.fee_percent::text, m.auto_confirm_days,
          coalesce(array(SELECT user_id::text FROM affiliate.members WHERE merchant_id = m.id AND role = 'owner' AND status = 'active'), '{}') AS owner_ids
        FROM affiliate.merchants m WHERE m.id = ${merchantId} FOR UPDATE OF m`)
    ).rows[0]!;
    const exists = await executor.execute(sql`SELECT 1 FROM affiliate.settlements WHERE merchant_id = ${merchantId} AND week_start = ${weekStart}::date`);
    if (exists.rows.length > 0) return null;
    const sums = (
      await executor.execute<{ total: number; earned: string; shortfall: string; redeemed: string; company_voucher: string }>(sql`
        SELECT count(*)::int AS total,
          coalesce(sum(t.earned_amount) FILTER (WHERE t.status = 'completed'), 0)::text AS earned,
          coalesce(sum(t.shortfall_amount) FILTER (WHERE t.status = 'cancelled'), 0)::text AS shortfall,
          coalesce(sum(t.redeemed_amount + CASE WHEN v.issuer = 'merchant_points' THEN t.voucher_payable ELSE 0 END) FILTER (WHERE t.status = 'completed'), 0)::text AS redeemed,
          coalesce(sum(CASE WHEN v.issuer = 'company' THEN t.voucher_payable ELSE 0 END) FILTER (WHERE t.status = 'completed'), 0)::text AS company_voucher
        FROM affiliate.transactions t LEFT JOIN affiliate.voucher_codes c ON c.id = t.voucher_code_id LEFT JOIN affiliate.vouchers v ON v.id = c.voucher_id
        WHERE t.merchant_id = ${merchantId} AND t.settlement_id IS NULL AND t.status IN ('completed', 'cancelled')
          AND (t.completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${weekStart}::date + 6`)
    ).rows[0]!;
    if (sums.total === 0) return null;
    const earned = Number(sums.earned);
    const shortfall = Number(sums.shortfall);
    const redeemed = Number(sums.redeemed);
    const companyVoucher = Number(sums.company_voucher);
    const fee = Math.round((redeemed * Number(merchant.fee_percent)) / 100);
    const feeTax = Math.round((fee * feeTaxRate) / 100);
    const net = earned + shortfall + fee + feeTax - redeemed - companyVoucher;
    const inserted = (
      await executor.execute<{ id: string; document_no: string }>(sql`
        INSERT INTO affiliate.settlements (company_id, merchant_id, week_start, transaction_count, earned_amount, redeemed_amount, company_voucher_amount, shortfall_amount,
          fee_percent, fee_amount, fee_tax_rate, fee_tax_amount, net_amount, confirm_due_at)
        VALUES (${merchant.company_id}, ${merchantId}, ${weekStart}::date, ${sums.total}, ${earned}, ${redeemed}, ${companyVoucher}, ${shortfall}, ${merchant.fee_percent}, ${fee},
          ${feeTaxRate}, ${feeTax}, ${net}, now() + make_interval(days => ${merchant.auto_confirm_days}))
        RETURNING id, document_no`)
    ).rows[0]!;
    await executor.execute(sql`
      UPDATE affiliate.transactions SET settlement_id = ${inserted.id}
      WHERE merchant_id = ${merchantId} AND settlement_id IS NULL AND status IN ('completed', 'cancelled')
        AND (completed_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${weekStart}::date + 6`);
    await notify(
      executor,
      merchant.owner_ids.map((userId) => ({
        userId,
        companyId: merchant.company_id,
        kind: "affiliate.settlement_created",
        title: `Bảng đối soát ${inserted.document_no} chờ cửa hàng xác nhận`,
        payload: { settlementId: inserted.id },
      })),
    );
    return inserted.id;
  }

  private async locked(executor: Executor, actor: SettlementActor, id: string, version: number) {
    const row = (
      await executor.execute<{ status: AffiliateSettlementStatus; version: number; merchant_id: string; document_no: string }>(sql`
        SELECT s.status, s.version, s.merchant_id, s.document_no FROM affiliate.settlements s WHERE ${this.scope(actor)} AND s.id = ${id} FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return row;
  }

  private record(actor: SettlementActor, action: string, id: string, afterData: unknown, executor: Pick<Database, "insert">) {
    return this.audit.record(
      {
        actorUserId: actor.userId,
        companyId: actor.companyId,
        appCode: actor.merchantId ? "affiliate" : "crm",
        action,
        entityType: "affiliate_settlement",
        entityId: id,
        afterData,
        ip: actor.client.ip,
        userAgent: actor.client.userAgent,
        requestId: actor.client.requestId,
      },
      executor,
    );
  }

  // Chủ cửa hàng xác nhận bảng chờ xác nhận.
  async confirm(member: PortalMember, id: string, version: number): Promise<AffiliateSettlementDetail> {
    requireOwner(member);
    const actor = this.memberActor(member);
    await this.database.transaction(async (transaction) => {
      const row = await this.locked(transaction, actor, id, version);
      if (row.status !== "awaiting_confirmation") throw new ApiError("BUSINESS_RULE", "affiliateSettlementNotAwaiting");
      await this.confirmWithin(transaction, id, member.userId);
      await this.record(actor, "affiliate_settlement.confirm", id, null, transaction);
    });
    return this.detail(actor, id);
  }

  // Chủ cửa hàng khiếu nại bảng chờ xác nhận (lý do 1 đến 1.000 ký tự); dừng tự xác nhận tới khi công ty trả lời.
  async dispute(member: PortalMember, id: string, reason: string, version: number): Promise<AffiliateSettlementDetail> {
    requireOwner(member);
    const actor = this.memberActor(member);
    await this.database.transaction(async (transaction) => {
      const row = await this.locked(transaction, actor, id, version);
      if (row.status !== "awaiting_confirmation") throw new ApiError("BUSINESS_RULE", "affiliateSettlementNotAwaiting");
      await transaction.execute(sql`
        UPDATE affiliate.settlements SET status = 'disputed', dispute_reason = ${reason}, disputed_by = ${member.userId}, disputed_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.record(actor, "affiliate_settlement.dispute", id, { reason }, transaction);
    });
    return this.detail(actor, id);
  }

  // Công ty trả lời khiếu nại và chốt lại, có thể kèm điều chỉnh tiền (dương: cửa hàng trả thêm; âm: công ty trả thêm).
  async resolve(actor: SettlementActor, id: string, input: z.infer<typeof affiliateSettlementResolveSchema>): Promise<AffiliateSettlementDetail> {
    await this.database.transaction(async (transaction) => {
      const row = await this.locked(transaction, actor, id, input.version);
      if (row.status !== "disputed") throw new ApiError("BUSINESS_RULE", "affiliateSettlementNotDisputed");
      const adjustment = Number(input.adjustmentAmount);
      await transaction.execute(sql`
        UPDATE affiliate.settlements SET resolution_note = ${input.note}, adjustment_amount = ${adjustment}, adjustment_reason = ${adjustment === 0 ? null : (input.adjustmentReason ?? null)},
          net_amount = net_amount - adjustment_amount + ${adjustment}, resolved_by = ${actor.userId}, resolved_at = now()
        WHERE id = ${id}`);
      await this.confirmWithin(transaction, id, null);
      const owners = await transaction.execute<{ user_id: string }>(sql`
        SELECT user_id FROM affiliate.members WHERE merchant_id = ${row.merchant_id} AND role = 'owner' AND status = 'active'`);
      await notify(
        transaction,
        owners.rows.map((owner) => ({
          userId: owner.user_id,
          companyId: actor.companyId,
          kind: "affiliate.settlement_resolved",
          title: `Công ty đã trả lời khiếu nại bảng đối soát ${row.document_no}`,
          payload: { settlementId: id },
        })),
      );
      await this.record(actor, "affiliate_settlement.resolve", id, { note: input.note, adjustmentAmount: adjustment, adjustmentReason: input.adjustmentReason ?? null }, transaction);
    });
    return this.detail(actor, id);
  }

  // Việc nền: tự xác nhận bảng quá số ngày tự xác nhận; đối chiếu công nợ đã trả hết.
  async autoConfirmDue(): Promise<void> {
    const due = await this.database.execute<{ id: string }>(sql`
      SELECT id FROM affiliate.settlements WHERE status = 'awaiting_confirmation' AND confirm_due_at <= now() ORDER BY confirm_due_at LIMIT 500`);
    for (const row of due.rows) {
      await this.database.transaction(async (transaction) => {
        const current = (await transaction.execute<{ status: string }>(sql`SELECT status FROM affiliate.settlements WHERE id = ${row.id} FOR UPDATE`)).rows[0];
        if (current?.status === "awaiting_confirmation") await this.confirmWithin(transaction, row.id, null);
      });
    }
    await this.refreshPaid(this.database);
  }

  // Xác nhận: bút toán, công nợ một khoản theo số còn lại (hạn = ngày xác nhận + hạn thanh toán); số còn lại 0 thì đã thanh toán ngay.
  private async confirmWithin(executor: Executor, id: string, confirmedBy: string | null): Promise<void> {
    const row = (
      await executor.execute<{
        company_id: string;
        partner_id: string;
        document_no: string;
        payment_term_days: number;
        today: string;
        earned_amount: string;
        shortfall_amount: string;
        redeemed_amount: string;
        company_voucher_amount: string;
        fee_amount: string;
        fee_tax_amount: string;
        adjustment_amount: string;
        net_amount: string;
      }>(sql`
        SELECT s.company_id, m.partner_id, s.document_no, m.payment_term_days, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS today, s.earned_amount::text,
          s.shortfall_amount::text, s.redeemed_amount::text, s.company_voucher_amount::text, s.fee_amount::text, s.fee_tax_amount::text, s.adjustment_amount::text, s.net_amount::text
        FROM affiliate.settlements s JOIN affiliate.merchants m ON m.id = s.merchant_id WHERE s.id = ${id}`)
    ).rows[0]!;
    await this.accounting.record(
      executor,
      settlementDraft({
        companyId: row.company_id,
        partnerId: row.partner_id,
        id,
        documentNo: row.document_no,
        date: row.today,
        earned: Number(row.earned_amount),
        shortfall: Number(row.shortfall_amount),
        redeemed: Number(row.redeemed_amount),
        companyVoucher: Number(row.company_voucher_amount),
        fee: Number(row.fee_amount),
        feeTax: Number(row.fee_tax_amount),
        adjustment: Number(row.adjustment_amount),
      }),
    );
    const net = Number(row.net_amount);
    const dueDate = (await executor.execute<{ value: string }>(sql`SELECT (${row.today}::date + ${row.payment_term_days}::int)::text AS value`)).rows[0]!.value;
    let debtItemId: string | null = null;
    if (Math.abs(net) >= 0.00005) {
      const side = net > 0 ? "receivable" : "payable";
      // Cửa hàng là khách hàng và nhà cung cấp của công ty vận hành sàn để lập phiếu thu, phiếu chi (CONG_VIEC_13).
      await executor.execute(sql`
        INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier) VALUES (${row.company_id}, ${row.partner_id}, true, true)
        ON CONFLICT (company_id, partner_id) DO UPDATE SET is_customer = true, is_supplier = true`);
      await this.debts.lockPartner(executor, row.company_id, side, row.partner_id);
      const amount = Math.abs(net).toFixed(4);
      debtItemId = (
        await executor.execute<{ id: string }>(sql`
          INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount, note)
          VALUES (${row.company_id}, ${row.partner_id}, ${side}, 'debit', 'affiliate_settlement', ${id}, ${row.document_no}, ${row.today}::date, ${dueDate}::date,
            ${amount}::numeric, ${amount}::numeric, 'Đối soát cửa hàng liên kết')
          RETURNING id`)
      ).rows[0]!.id;
      await this.debts.matchDebit(executor, debtItemId);
    }
    await executor.execute(sql`
      UPDATE affiliate.settlements SET status = ${debtItemId ? "confirmed" : "paid"}, confirmed_by = ${confirmedBy}, confirmed_at = now(), due_date = ${dueDate}::date,
        debt_item_id = ${debtItemId}, paid_at = ${debtItemId ? null : sql`now()`}, version = version + 1
      WHERE id = ${id}`);
    await this.refreshPaid(executor);
  }

  memberActor(member: PortalMember): SettlementActor {
    return { userId: member.userId, companyId: member.companyId, merchantId: member.merchantId, client: member.client };
  }
}
