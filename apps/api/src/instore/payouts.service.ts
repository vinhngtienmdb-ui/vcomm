// CONG_VIEC_73 lát L5: bảng chuyển tiền thu hộ ngày và hạch toán hai công ty (QUYTAC_NGHIEPVU_584 đến 587; API_333).
// Công ty vận hành sàn nhận tiền cổng (Nợ ngân hàng / Có phải trả người nhận), lập bảng mỗi ngày cho từng người nhận (cửa hàng liên kết hoặc công ty
// sở hữu cửa hàng tập đoàn): tiền chuyển = G − H − I − K − L + M − N; âm thì ghi 0, mang sang bảng sau. Ghi đã chuyển lập phiếu chi (và phiếu thu ở công ty sở hữu).
import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  InstorePayoutDetail,
  InstorePayoutItem,
  instorePayoutListQuerySchema,
  InstoreSettingsResponse,
  instoreTransferredSchema,
  PageResponse,
} from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { LedgerService } from "../accounting/ledger.service";
import { credit, debit, type DraftJournal, type DraftLine } from "../accounting/postings";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { notify } from "../common/notifications";
import { internalPartnerOf } from "../crm/partners.service";
import { DATABASE, type Database } from "../database/database.module";
import { PaymentsService } from "../finance/payments.service";
import { vietnamToday } from "../marketplace/shop.service";
import type { Actor } from "../permissions/roles.service";
import type { CheckoutRow, DatabaseTransaction } from "./checkouts.service";

type Executor = Pick<Database, "execute">;
type Recipient = { kind: "merchant"; merchantId: string } | { kind: "retail_company"; companyId: string };

// Bảng chờ chuyển quá 2 ngày làm việc (bỏ thứ Bảy, Chủ nhật) thì nhắc kế toán công ty vận hành sàn.
const overdueWorkingDays = 2;

const iso = (value: Date | string | null) => (value ? new Date(value).toISOString() : null);
const money = (value: number) => Math.round(value);

// Thêm n ngày làm việc (bỏ thứ Bảy, Chủ nhật; không trừ ngày lễ, như hạn hóa đơn điện tử).
export function addWorkingDays(date: string, days: number): string {
  const current = new Date(`${date}T00:00:00Z`);
  let left = days;
  while (left > 0) {
    current.setUTCDate(current.getUTCDate() + 1);
    const weekday = current.getUTCDay();
    if (weekday !== 0 && weekday !== 6) left -= 1;
  }
  return current.toISOString().slice(0, 10);
}

type PayoutRow = {
  id: string;
  document_no: string;
  operator_company_id: string;
  recipient_kind: "merchant" | "retail_company";
  recipient_company_id: string | null;
  merchant_id: string | null;
  recipient_name: string;
  recipient_code: string | null;
  business_date: string;
  collected_amount: string;
  platform_fee: string;
  platform_fee_tax: string;
  gateway_fee: string;
  reversal_amount: string;
  carried_amount: string;
  deduction_amount: string;
  amount: string;
  fee_tax_rate: string;
  status: "pending" | "transferred";
  transferred_on: string | null;
  bank_transaction_no: string | null;
  payment_no: string | null;
  receipt_no: string | null;
  created_at: Date;
  version: number;
};

const payoutColumns = sql`
  p.id, p.document_no, p.operator_company_id, p.recipient_kind, p.recipient_company_id, p.merchant_id,
  coalesce(rc.short_name, rc.legal_name, mp.name) AS recipient_name, coalesce(rc.code, m.code) AS recipient_code, p.business_date::text,
  p.collected_amount::text, p.platform_fee::text, p.platform_fee_tax::text, p.gateway_fee::text, p.reversal_amount::text, p.carried_amount::text, p.deduction_amount::text,
  p.amount::text, p.fee_tax_rate::text, p.status, p.transferred_on::text, p.bank_transaction_no, pay.document_no AS payment_no, rec.document_no AS receipt_no,
  p.created_at, p.version`;
const payoutFrom = sql`
  instore.payouts p
  LEFT JOIN core.companies rc ON rc.id = p.recipient_company_id
  LEFT JOIN affiliate.merchants m ON m.id = p.merchant_id
  LEFT JOIN crm.partners mp ON mp.id = m.partner_id
  LEFT JOIN finance.payments pay ON pay.id = p.payment_id
  LEFT JOIN finance.payments rec ON rec.id = p.receipt_id`;

@Injectable()
export class InstorePayoutsService {
  private readonly logger = new Logger("InstorePayouts");
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Hạch toán khi tiền về và khi khách trả qua ứng dụng (QUYTAC_NGHIEPVU_587).
  // ---------------------------------------------------------------------------

  // Người nhận tiền thu hộ của đơn và đối tượng công nợ ở công ty vận hành sàn: cửa hàng liên kết (đối tác của cửa hàng, 331) hoặc công ty sở hữu (đối tác nội bộ, 336).
  // Cửa hàng tập đoàn của chính công ty vận hành sàn: tiền đã về chính công ty, không có người nhận.
  private async recipientOf(executor: Executor, row: Pick<CheckoutRow, "kind" | "merchant_id" | "company_id" | "operator_company_id">) {
    if (row.kind === "affiliate") {
      const partnerId = (await executor.execute<{ partner_id: string }>(sql`SELECT partner_id FROM affiliate.merchants WHERE id = ${row.merchant_id}`)).rows[0]!.partner_id;
      return { recipient: { kind: "merchant", merchantId: row.merchant_id! } as Recipient, partnerId, role: "affiliate_payable" as const };
    }
    if (row.company_id === row.operator_company_id) return null;
    return {
      recipient: { kind: "retail_company", companyId: row.company_id! } as Recipient,
      partnerId: await internalPartnerOf(executor, row.company_id!),
      role: "instore_payable_internal" as const,
    };
  }

  // Cổng báo thành công: Nợ tiền gửi ngân hàng nhận tiền cổng / Có phải trả người nhận (hoặc Có phải thu khách lẻ khi cửa hàng của chính công ty vận hành sàn).
  async recordGatewayReceipt(transaction: Executor, row: CheckoutRow, amount: number): Promise<void> {
    const recipient = await this.recipientOf(transaction, row);
    const day = await vietnamToday(transaction);
    const draft: DraftJournal = {
      companyId: row.operator_company_id,
      sourceType: "instore_checkout",
      sourceId: row.id,
      journalNo: row.document_no,
      date: day,
      description: `Tiền khách trả qua ứng dụng VComm, đơn ${row.document_no}`,
      lines: [debit("bank", money(amount)), recipient ? credit(recipient.role, money(amount), recipient.partnerId) : credit("receivable", money(amount))],
    };
    await this.ledger.record(transaction, draft);
  }

  // Hóa đơn bán lẻ của công ty sở hữu cửa hàng tập đoàn (khác công ty vận hành sàn): dòng "Ứng dụng VComm" Nợ phải thu nội bộ / Có phải thu khách lẻ.
  async recordOwnerSale(transaction: Executor, row: CheckoutRow, appAmount: number): Promise<void> {
    if (row.kind !== "retail" || row.company_id === row.operator_company_id || appAmount <= 0) return;
    const draft: DraftJournal = {
      companyId: row.company_id!,
      sourceType: "instore_checkout_owner",
      sourceId: row.id,
      journalNo: row.document_no,
      date: await vietnamToday(transaction),
      description: `Khách trả qua ứng dụng VComm, đơn ${row.document_no}`,
      lines: [debit("instore_receivable_internal", money(appAmount), await internalPartnerOf(transaction, row.operator_company_id)), credit("receivable", money(appAmount))],
    };
    await this.ledger.record(transaction, draft);
  }

  // ---------------------------------------------------------------------------
  // Lập bảng chuyển tiền ngày (QUYTAC_NGHIEPVU_585).
  // ---------------------------------------------------------------------------

  // Việc nền 1 giờ sáng: lập bảng cho ngày hôm trước (hoặc ngày chỉ định) cho mọi người nhận có tiền thu hộ, khoản trừ khác hoặc số mang sang.
  async generateDaily(businessDate?: string): Promise<string[]> {
    const day = businessDate ?? (await this.database.execute<{ day: string }>(sql`SELECT ((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 1)::text AS day`)).rows[0]!.day;
    const operator = (await this.database.execute<{ id: string }>(sql`SELECT id FROM core.companies WHERE is_marketplace_operator`)).rows[0];
    if (!operator) return [];
    const candidates = await this.database.execute<{ recipient_kind: "merchant" | "retail_company"; recipient_id: string }>(sql`
      SELECT DISTINCT CASE WHEN c.kind = 'affiliate' THEN 'merchant' ELSE 'retail_company' END AS recipient_kind, coalesce(c.merchant_id, c.company_id) AS recipient_id
      FROM instore.checkouts c
      WHERE c.operator_company_id = ${operator.id} AND c.status = 'completed' AND c.collect_in_app AND c.paid_amount > 0 AND c.payout_id IS NULL
        AND (c.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${day}::date AND (c.kind = 'affiliate' OR c.company_id <> c.operator_company_id)
      UNION
      SELECT d.recipient_kind, coalesce(d.merchant_id, d.recipient_company_id) FROM instore.payout_deductions d WHERE d.payout_id IS NULL AND d.business_date <= ${day}::date
      UNION
      SELECT p.recipient_kind, coalesce(p.merchant_id, p.recipient_company_id) FROM instore.payouts p
      WHERE p.operator_company_id = ${operator.id} AND p.business_date < ${day}::date
        AND p.collected_amount - p.platform_fee - p.platform_fee_tax - p.gateway_fee - p.reversal_amount + p.carried_amount - p.deduction_amount < 0
        AND NOT EXISTS (SELECT 1 FROM instore.payouts later WHERE later.recipient_kind = p.recipient_kind
          AND coalesce(later.merchant_id, later.recipient_company_id) = coalesce(p.merchant_id, p.recipient_company_id) AND later.business_date > p.business_date)`);
    const created: string[] = [];
    for (const candidate of candidates.rows) {
      const recipient: Recipient =
        candidate.recipient_kind === "merchant" ? { kind: "merchant", merchantId: candidate.recipient_id } : { kind: "retail_company", companyId: candidate.recipient_id };
      try {
        const id = await this.database.transaction((transaction) => this.generateFor(transaction, operator.id, recipient, day));
        if (id) created.push(id);
      } catch (error) {
        this.logger.error(`Lập bảng chuyển tiền ngày ${day} cho ${candidate.recipient_id} không được: ${(error as Error).message}`);
      }
    }
    return created;
  }

  private async generateFor(transaction: DatabaseTransaction, operatorId: string, recipient: Recipient, day: string): Promise<string | null> {
    const recipientId = recipient.kind === "merchant" ? recipient.merchantId : recipient.companyId;
    // Xếp hàng theo người nhận; đã có bảng của ngày thì bỏ qua (chạy lại việc nền không lập trùng).
    await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`instore.payout:${recipient.kind}:${recipientId}`}))`);
    const recipientFilter =
      recipient.kind === "merchant"
        ? sql`recipient_kind = 'merchant' AND merchant_id = ${recipientId}`
        : sql`recipient_kind = 'retail_company' AND recipient_company_id = ${recipientId}`;
    const exists = await transaction.execute(sql`SELECT 1 FROM instore.payouts WHERE ${recipientFilter} AND business_date = ${day}::date`);
    if (exists.rows.length) return null;
    const checkoutFilter =
      recipient.kind === "merchant" ? sql`c.kind = 'affiliate' AND c.merchant_id = ${recipientId}` : sql`c.kind = 'retail' AND c.company_id = ${recipientId}`;
    const totals = (
      await transaction.execute<{ collected: string; fee: string; gateway: string; count: number }>(sql`
        SELECT coalesce(sum(c.paid_amount), 0)::text AS collected, coalesce(sum(c.platform_fee), 0)::text AS fee, coalesce(sum(c.gateway_fee), 0)::text AS gateway, count(*)::int AS count
        FROM instore.checkouts c
        WHERE ${checkoutFilter} AND c.operator_company_id = ${operatorId} AND c.status = 'completed' AND c.collect_in_app AND c.paid_amount > 0 AND c.payout_id IS NULL
          AND (c.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${day}::date`)
    ).rows[0]!;
    const deductions = (
      await transaction.execute<{ total: string }>(sql`
        SELECT coalesce(sum(amount), 0)::text AS total FROM instore.payout_deductions WHERE ${recipientFilter} AND payout_id IS NULL AND business_date <= ${day}::date`)
    ).rows[0]!;
    const previous = (
      await transaction.execute<{ raw: string }>(sql`
        SELECT (collected_amount - platform_fee - platform_fee_tax - gateway_fee - reversal_amount + carried_amount - deduction_amount)::text AS raw
        FROM instore.payouts WHERE ${recipientFilter} AND business_date < ${day}::date ORDER BY business_date DESC LIMIT 1`)
    ).rows[0];
    const rate = Number(
      (await transaction.execute<{ rate: string }>(sql`SELECT fee_tax_rate::text AS rate FROM instore.settings WHERE company_id = ${operatorId}`)).rows[0]?.rate ?? 10,
    );
    const collected = Number(totals.collected);
    const fee = money(Number(totals.fee));
    const tax = money((fee * rate) / 100);
    const gateway = money(Number(totals.gateway));
    const reversal = 0;
    const carried = previous && Number(previous.raw) < 0 ? Number(previous.raw) : 0;
    const deduction = Number(deductions.total);
    if (totals.count === 0 && deduction === 0 && carried === 0) return null;
    const raw = collected - fee - tax - gateway - reversal + carried - deduction;
    const amount = Math.max(raw, 0);
    const inserted = (
      await transaction.execute<{ id: string; document_no: string }>(sql`
        INSERT INTO instore.payouts (operator_company_id, recipient_kind, recipient_company_id, merchant_id, business_date, collected_amount, platform_fee, platform_fee_tax,
          gateway_fee, reversal_amount, carried_amount, deduction_amount, amount, fee_tax_rate, status, transferred_on)
        VALUES (${operatorId}, ${recipient.kind}, ${recipient.kind === "retail_company" ? recipientId : null}, ${recipient.kind === "merchant" ? recipientId : null}, ${day}::date,
          ${collected}, ${fee}, ${tax}, ${gateway}, ${reversal}, ${carried}, ${deduction}, ${amount}, ${rate}, ${amount > 0 ? "pending" : "transferred"},
          ${amount > 0 ? null : day}::date)
        RETURNING id, document_no`)
    ).rows[0]!;
    await transaction.execute(sql`
      UPDATE instore.checkouts c SET payout_id = ${inserted.id}
      WHERE ${checkoutFilter} AND c.operator_company_id = ${operatorId} AND c.status = 'completed' AND c.collect_in_app AND c.paid_amount > 0 AND c.payout_id IS NULL
        AND (c.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ${day}::date`);
    await transaction.execute(sql`
      UPDATE instore.payout_deductions SET payout_id = ${inserted.id} WHERE ${recipientFilter} AND payout_id IS NULL AND business_date <= ${day}::date`);

    // Hạch toán phí khi lập bảng: công ty vận hành sàn Nợ phải trả người nhận / Có doanh thu phí sàn, thuế, Có chi phí phí cổng thu lại;
    // công ty sở hữu cửa hàng tập đoàn Nợ chi phí bán hàng, thuế đầu vào / Có phải thu nội bộ.
    const party = await this.recipientOf(transaction, {
      kind: recipient.kind === "merchant" ? "affiliate" : "retail",
      merchant_id: recipient.kind === "merchant" ? recipientId : null,
      company_id: recipient.kind === "retail_company" ? recipientId : null,
      operator_company_id: operatorId,
    });
    const charges = fee + tax + gateway;
    if (party && charges > 0) {
      const lines: DraftLine[] = [debit(party.role, charges, party.partnerId), credit("instore_fee_revenue", fee), credit("vat_output", tax), credit("collection_fee", gateway)];
      await this.ledger.record(transaction, {
        companyId: operatorId,
        sourceType: "instore_payout",
        sourceId: inserted.id,
        journalNo: inserted.document_no,
        date: day,
        description: `Phí sàn, phí cổng bảng chuyển tiền ${inserted.document_no}`,
        lines,
      });
      if (recipient.kind === "retail_company")
        await this.ledger.record(transaction, {
          companyId: recipientId,
          sourceType: "instore_payout_owner",
          sourceId: inserted.id,
          journalNo: inserted.document_no,
          date: day,
          description: `Phí sàn, phí cổng thu hộ qua ứng dụng VComm, bảng ${inserted.document_no}`,
          lines: [
            debit("collection_fee", fee + gateway),
            debit("vat_input", tax),
            credit("instore_receivable_internal", charges, await internalPartnerOf(transaction, operatorId)),
          ],
        });
    }
    // Công nợ của số tiền phải chuyển: phải trả ở công ty vận hành sàn; phải thu nội bộ ở công ty sở hữu.
    if (amount > 0 && party?.partnerId) {
      const payable = await this.debtItem(transaction, operatorId, party.partnerId, "payable", inserted, day, amount);
      await transaction.execute(sql`UPDATE instore.payouts SET payable_debt_item_id = ${payable} WHERE id = ${inserted.id}`);
      if (recipient.kind === "retail_company") {
        const operatorPartner = await internalPartnerOf(transaction, operatorId);
        if (operatorPartner) {
          const receivable = await this.debtItem(transaction, recipientId, operatorPartner, "receivable", inserted, day, amount);
          await transaction.execute(sql`UPDATE instore.payouts SET receivable_debt_item_id = ${receivable} WHERE id = ${inserted.id}`);
        }
      }
    }
    return inserted.id;
  }

  private async debtItem(
    transaction: Executor,
    companyId: string,
    partnerId: string,
    side: "payable" | "receivable",
    payout: { id: string; document_no: string },
    day: string,
    amount: number,
  ): Promise<string> {
    await transaction.execute(sql`
      INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier) VALUES (${companyId}, ${partnerId}, ${side === "receivable"}, ${side === "payable"})
      ON CONFLICT (company_id, partner_id) DO UPDATE SET is_customer = crm.partner_profiles.is_customer OR EXCLUDED.is_customer,
        is_supplier = crm.partner_profiles.is_supplier OR EXCLUDED.is_supplier`);
    return (
      await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount, note)
        VALUES (${companyId}, ${partnerId}, ${side}, 'debit', ${side === "payable" ? "instore_payout" : "instore_payout_owner"}, ${payout.id}, ${payout.document_no}, ${day}::date, ${day}::date, ${amount}, ${amount},
          ${`Bảng chuyển tiền thu hộ ${payout.document_no}`})
        RETURNING id`)
    ).rows[0]!.id;
  }

  // ---------------------------------------------------------------------------
  // Xem, ghi đã chuyển (API_333; MAN_HINH_281, 282).
  // ---------------------------------------------------------------------------

  private item(row: PayoutRow, today: string): InstorePayoutItem {
    return {
      id: row.id,
      documentNo: row.document_no,
      recipientKind: row.recipient_kind,
      recipientName: row.recipient_name,
      recipientCode: row.recipient_code,
      businessDate: row.business_date,
      collectedAmount: String(Number(row.collected_amount)),
      platformFee: String(Number(row.platform_fee)),
      platformFeeTax: String(Number(row.platform_fee_tax)),
      gatewayFee: String(Number(row.gateway_fee)),
      reversalAmount: String(Number(row.reversal_amount)),
      carriedAmount: String(Number(row.carried_amount)),
      deductionAmount: String(Number(row.deduction_amount)),
      amount: String(Number(row.amount)),
      feeTaxRate: String(Number(row.fee_tax_rate)),
      status: row.status,
      overdue: row.status === "pending" && addWorkingDays(row.business_date, overdueWorkingDays + 1) <= today,
      transferredOn: row.transferred_on,
      bankTransactionNo: row.bank_transaction_no,
      paymentNo: row.payment_no,
      receiptNo: row.receipt_no,
      receiptMissing: row.recipient_kind === "retail_company" && row.status === "transferred" && row.receipt_no === null,
      createdAt: iso(row.created_at)!,
      version: row.version,
    };
  }

  // Công ty vận hành sàn thấy mọi bảng; công ty sở hữu cửa hàng tập đoàn thấy bảng của mình.
  private async scopeOf(companyId: string) {
    const isOperator = (await this.database.execute(sql`SELECT 1 FROM core.companies WHERE id = ${companyId} AND is_marketplace_operator`)).rows.length > 0;
    return { isOperator, where: isOperator ? sql`p.operator_company_id = ${companyId}` : sql`p.recipient_company_id = ${companyId}` };
  }

  async list(actor: Actor, query: z.infer<typeof instorePayoutListQuerySchema>): Promise<PageResponse<InstorePayoutItem> & { overdueCount: number }> {
    const scope = await this.scopeOf(actor.companyId);
    const today = await vietnamToday(this.database);
    const where = sql`${scope.where}
      ${query.recipientKind ? sql`AND p.recipient_kind = ${query.recipientKind}` : sql``}
      ${query.status ? sql`AND p.status = ${query.status}` : sql``}
      ${query.from ? sql`AND p.business_date >= ${query.from}::date` : sql``}
      ${query.to ? sql`AND p.business_date <= ${query.to}::date` : sql``}
      ${query.merchantId ? sql`AND p.merchant_id = ${query.merchantId}` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${payoutFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<PayoutRow>(sql`
      SELECT ${payoutColumns} FROM ${payoutFrom} WHERE ${where} ORDER BY p.business_date DESC, p.document_no DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    const pending = await this.database.execute<{ business_date: string }>(sql`SELECT p.business_date::text FROM ${payoutFrom} WHERE ${scope.where} AND p.status = 'pending'`);
    return {
      data: rows.rows.map((row) => this.item(row, today)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      overdueCount: pending.rows.filter((row) => addWorkingDays(row.business_date, overdueWorkingDays + 1) <= today).length,
    };
  }

  private async row(id: string, where: ReturnType<typeof sql>): Promise<PayoutRow> {
    const row = (await this.database.execute<PayoutRow>(sql`SELECT ${payoutColumns} FROM ${payoutFrom} WHERE p.id = ${id} AND ${where}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  private async detailOf(row: PayoutRow): Promise<InstorePayoutDetail> {
    const today = await vietnamToday(this.database);
    const lines = await this.database.execute<{
      id: string;
      document_no: string;
      paid_at: Date;
      place_name: string;
      bill_amount: string;
      paid_amount: string;
      platform_fee: string;
      gateway_fee: string;
      sale_no: string | null;
    }>(sql`
      SELECT c.id, c.document_no, c.paid_at, coalesce(o.name, r.name) AS place_name, c.bill_amount::text, c.paid_amount::text, c.platform_fee::text, c.gateway_fee::text,
        coalesce(s.document_no, t.document_no) AS sale_no
      FROM instore.checkouts c LEFT JOIN affiliate.outlets o ON o.id = c.outlet_id LEFT JOIN retail.registers r ON r.id = c.register_id
      LEFT JOIN retail.sales s ON s.id = c.retail_sale_id LEFT JOIN affiliate.transactions t ON t.id = c.affiliate_transaction_id
      WHERE c.payout_id = ${row.id} ORDER BY c.paid_at`);
    const deductions = await this.database.execute<{ id: string; kind: string; business_date: string; amount: string; note: string | null }>(sql`
      SELECT id, kind, business_date::text, amount::text, note FROM instore.payout_deductions WHERE payout_id = ${row.id} ORDER BY business_date, created_at`);
    return {
      ...this.item(row, today),
      lines: lines.rows.map((line) => ({
        checkoutId: line.id,
        checkoutNo: line.document_no,
        documentNo: line.sale_no,
        paidAt: iso(line.paid_at)!,
        placeName: line.place_name,
        billAmount: String(Number(line.bill_amount)),
        collectedAmount: String(Number(line.paid_amount)),
        platformFee: String(Number(line.platform_fee)),
        gatewayFee: String(Number(line.gateway_fee)),
      })),
      deductions: deductions.rows.map((line) => ({ id: line.id, kind: line.kind, businessDate: line.business_date, amount: String(Number(line.amount)), note: line.note })),
    };
  }

  async detail(actor: Actor, id: string): Promise<InstorePayoutDetail> {
    return this.detailOf(await this.row(id, (await this.scopeOf(actor.companyId)).where));
  }

  // Cổng cửa hàng (MAN_HINH_282): chủ cửa hàng xem bảng của cửa hàng mình.
  async merchantList(merchantId: string, query: z.infer<typeof instorePayoutListQuerySchema>): Promise<PageResponse<InstorePayoutItem>> {
    const today = await vietnamToday(this.database);
    const where = sql`p.merchant_id = ${merchantId} ${query.status ? sql`AND p.status = ${query.status}` : sql``}
      ${query.from ? sql`AND p.business_date >= ${query.from}::date` : sql``} ${query.to ? sql`AND p.business_date <= ${query.to}::date` : sql``}`;
    const total = (await this.database.execute<{ total: number }>(sql`SELECT count(*)::int AS total FROM ${payoutFrom} WHERE ${where}`)).rows[0]!.total;
    const rows = await this.database.execute<PayoutRow>(sql`
      SELECT ${payoutColumns} FROM ${payoutFrom} WHERE ${where} ORDER BY p.business_date DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.item(row, today)), page: query.page, pageSize: query.pageSize, total };
  }

  async merchantDetail(merchantId: string, id: string): Promise<InstorePayoutDetail> {
    return this.detailOf(await this.row(id, sql`p.merchant_id = ${merchantId}`));
  }

  // Ghi đã chuyển (QUYTAC_NGHIEPVU_585, 587): ngày chuyển, số giao dịch ngân hàng, quỹ chi của công ty vận hành sàn. Hệ thống lập, ghi sổ phiếu chi trừ công nợ phải trả;
  // người nhận là công ty tập đoàn thì lập cùng lúc phiếu thu ở công ty đó vào quỹ ngân hàng của cửa hàng có tiền thu hộ lớn nhất trong bảng
// (cửa hàng chưa cài quỹ ngân hàng: chưa lập phiếu thu, màn hình báo để công ty đó lập tay trừ công nợ phải thu nội bộ).
  async markTransferred(actor: Actor, id: string, input: z.infer<typeof instoreTransferredSchema>): Promise<InstorePayoutDetail> {
    const scope = await this.scopeOf(actor.companyId);
    if (!scope.isOperator) throw new ApiError("FORBIDDEN", "forbidden");
    const current = await this.row(id, scope.where);
    if (current.status !== "pending") throw new ApiError("BUSINESS_RULE", "instorePayoutNotPending");
    if (input.transferredOn < current.business_date) throw new ApiError("VALIDATION_FAILED", "invalidValue", { fields: { transferredOn: "instoreTransferBeforeDate" } });
    await this.payments.prepareInstorePayoutNumbering(actor);
    const ownerFund =
      current.recipient_kind === "retail_company"
        ? (
            await this.database.execute<{ fund_id: string }>(sql`
              SELECT s.bank_fund_id AS fund_id FROM instore.checkouts c JOIN retail.stores s ON s.id = c.store_id
              WHERE c.payout_id = ${id} AND s.bank_fund_id IS NOT NULL GROUP BY s.bank_fund_id ORDER BY sum(c.paid_amount) DESC LIMIT 1`)
          ).rows[0]?.fund_id ?? null
        : null;
    const ownerActor: Actor | null = current.recipient_kind === "retail_company" ? { ...actor, companyId: current.recipient_company_id! } : null;
    if (ownerActor) await this.payments.prepareInstorePayoutNumbering(ownerActor);
    await this.database.transaction(async (transaction) => {
      const locked = (
        await transaction.execute<{ status: string; version: number; payable_debt_item_id: string | null; receivable_debt_item_id: string | null; amount: string }>(sql`
          SELECT status, version, payable_debt_item_id, receivable_debt_item_id, amount::text FROM instore.payouts WHERE id = ${id} FOR UPDATE`)
      ).rows[0]!;
      if (locked.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (locked.status !== "pending") throw new ApiError("BUSINESS_RULE", "instorePayoutNotPending");
      const note = `Chuyển tiền thu hộ bảng ${current.document_no}`;
      const partner = (await transaction.execute<{ partner_id: string }>(sql`SELECT partner_id FROM finance.debt_items WHERE id = ${locked.payable_debt_item_id}`)).rows[0];
      if (!locked.payable_debt_item_id || !partner) throw new ApiError("BUSINESS_RULE", "instorePayoutNoPartner");
      const paymentId = await this.payments.recordInstorePayoutWithin(transaction, actor, {
        kind: "instore_payout_payment",
        partnerId: partner.partner_id,
        fundId: input.fundId,
        paymentDate: input.transferredOn,
        amount: locked.amount,
        referenceNo: input.bankTransactionNo,
        note,
        payoutId: id,
        debtItemId: locked.payable_debt_item_id,
      });
      let receiptId: string | null = null;
      if (ownerActor && locked.receivable_debt_item_id) {
        const operatorPartner = (await transaction.execute<{ partner_id: string }>(sql`SELECT partner_id FROM finance.debt_items WHERE id = ${locked.receivable_debt_item_id}`)).rows[0]!
          .partner_id;
        if (ownerFund) {
          receiptId = await this.payments.recordInstorePayoutWithin(transaction, ownerActor, {
            kind: "instore_payout_receipt",
            partnerId: operatorPartner,
            fundId: ownerFund,
            paymentDate: input.transferredOn,
            amount: locked.amount,
            referenceNo: input.bankTransactionNo,
            note,
            payoutId: id,
            debtItemId: locked.receivable_debt_item_id,
          });
        }
      }
      await transaction.execute(sql`
        UPDATE instore.payouts SET status = 'transferred', transferred_on = ${input.transferredOn}::date, bank_transaction_no = ${input.bankTransactionNo},
          payment_id = ${paymentId}, receipt_id = ${receiptId}, transferred_by = ${actor.userId}, transferred_at = now(), updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "finance",
          action: "instore_payout.transferred",
          entityType: "instore_payout",
          entityId: id,
          afterData: { ...input, paymentId, receiptId },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  // Việc nền mỗi sáng: nhắc kế toán công ty vận hành sàn các bảng chờ chuyển quá 2 ngày làm việc (một lần mỗi ngày).
  async remindOverdue(): Promise<number> {
    const today = await vietnamToday(this.database);
    const rows = await this.database.execute<{ operator_company_id: string; business_date: string }>(sql`
      SELECT operator_company_id, business_date::text FROM instore.payouts WHERE status = 'pending'`);
    const byCompany = new Map<string, number>();
    for (const row of rows.rows)
      if (addWorkingDays(row.business_date, overdueWorkingDays + 1) <= today) byCompany.set(row.operator_company_id, (byCompany.get(row.operator_company_id) ?? 0) + 1);
    let sent = 0;
    for (const [companyId, count] of byCompany) {
      const recipients = await this.database.execute<{ user_id: string }>(sql`
        SELECT DISTINCT a.user_id FROM core.user_role_assignments a JOIN core.role_permissions rp ON rp.role_id = a.role_id JOIN core.roles r ON r.id = a.role_id AND r.status = 'active'
        WHERE rp.permission_code = 'finance.instore.manage' AND a.valid_from <= ${today}::date AND (a.valid_to IS NULL OR a.valid_to >= ${today}::date)
          AND (a.scope_type = 'group' OR (a.scope_type = 'company' AND a.company_id = ${companyId}))`);
      await notify(
        this.database,
        recipients.rows.map((recipient) => ({
          userId: recipient.user_id,
          companyId,
          kind: "instore.payout_overdue",
          title: `${count} bảng chuyển tiền thu hộ chờ chuyển quá ${overdueWorkingDays} ngày làm việc`,
          link: "/finance/instore-payouts?status=pending",
          payload: { count },
        })),
      );
      sent += recipients.rows.length;
    }
    return sent;
  }

  // Thuế suất phí sàn, phí thu hộ (MAN_HINH_280).
  async settings(companyId: string, canManage: boolean): Promise<InstoreSettingsResponse> {
    const row = (await this.database.execute<{ fee_tax_rate: string; version: number }>(sql`SELECT fee_tax_rate::text, version FROM instore.settings WHERE company_id = ${companyId}`))
      .rows[0];
    return { feeTaxRate: String(Number(row?.fee_tax_rate ?? 10)), version: row?.version ?? 0, canManage };
  }

  async saveSettings(actor: Actor, input: { feeTaxRate: string; version: number }): Promise<InstoreSettingsResponse> {
    await this.database.transaction(async (transaction) => {
      const current = (await transaction.execute<{ version: number }>(sql`SELECT version FROM instore.settings WHERE company_id = ${actor.companyId} FOR UPDATE`)).rows[0];
      if ((current?.version ?? 0) !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await transaction.execute(sql`
        INSERT INTO instore.settings (company_id, fee_tax_rate, updated_by) VALUES (${actor.companyId}, ${input.feeTaxRate}, ${actor.userId})
        ON CONFLICT (company_id) DO UPDATE SET fee_tax_rate = EXCLUDED.fee_tax_rate, updated_by = EXCLUDED.updated_by, updated_at = now(), version = instore.settings.version + 1`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.companyId,
          appCode: "finance",
          action: "instore.settings.save",
          entityType: "instore_gateway_fee",
          entityId: actor.companyId,
          afterData: input,
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.settings(actor.companyId, true);
  }

}
