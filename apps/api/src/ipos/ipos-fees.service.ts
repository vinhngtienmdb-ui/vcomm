// Phí thuê bao iPOS (CONG_VIEC_74 L7; CHUC_NANG_253; QUYTAC_NGHIEPVU_598 đến 603; API_353, 356).
// Phiếu `PI…` lập theo kỳ cho mỗi thuê bao: công nợ phải thu cửa hàng (nguồn `ipos_fee_invoice`), bút toán Nợ 131 phải thu phí thuê bao / Có 511, 3331,
// hóa đơn điện tử phí (hạ tầng hóa đơn không gắn phiếu xuất của CONG_VIEC_73 lát L6). Bốn cách thu chụp lúc lập phiếu:
// - VietQR: kế toán lập phiếu thu ngân hàng trừ công nợ của phiếu; công nợ hết thì phiếu đã thu.
// - Trừ đối soát điểm tuần: phiếu chờ thu cộng vào bảng tuần kế tiếp thành khoản G; xác nhận bảng thì công nợ phiếu chuyển vào công nợ bảng; bảng thanh toán thì phiếu đã thu.
// - Trừ thu hộ: dòng khoản trừ N trong bảng chuyển tiền của CONG_VIEC_73 (ghi khi lập phiếu).
// - Miễn phí: không lập phiếu (việc nền thuê bao tự gia hạn).
// Phiếu đã thu đủ thì thuê bao gia hạn đến hết kỳ của phiếu và về đang hoạt động (QUYTAC_NGHIEPVU_596 khoản 2).
import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type {
  IposFeeInvoice,
  IposFeeInvoiceDetail,
  IposFeeMethod,
  IposFeeSummary,
  IposFeeVietqr,
  IposMerchantFeeOverview,
  PageResponse,
  iposFeeInvoiceListQuerySchema,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { credit, debit } from "../accounting/postings";
import { LedgerService } from "../accounting/ledger.service";
import { AffiliateSettlementsService } from "../affiliate/settlements.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { CLOCK, vietnamDate, type Clock } from "../common/clock";
import { notify } from "../common/notifications";
import { DATABASE, type Database } from "../database/database.module";
import { settingsRow } from "../einvoice/einvoice-settings.service";
import { EinvoicesService, type InvoiceItem, insertInvoice } from "../einvoice/einvoices.service";
import { DebtsService } from "../finance/debts.service";
import { PaymentsService } from "../finance/payments.service";
import type { BuyerAdminActor } from "../marketplace/buyer-admin.service";
import { bankTransferConfiguration, vietQrData } from "../marketplace/payments/gateways/bank-transfer-gateway";

type Executor = Pick<Database, "execute">;
type VatRate = InvoiceItem["vatRate"];

// Kỳ tiếp lập phiếu trước ngày hết hạn 7 ngày; trừ thu hộ quá 7 ngày chưa đủ chuyển VietQR; phiếu hạn trả 7 ngày kể từ ngày lập.
export const iposFeeLeadDays = 7;
export const iposFeeDueDays = 7;

type FeeRow = {
  id: string;
  document_no: string;
  company_id: string;
  merchant_id: string;
  merchant_code: string;
  merchant_name: string;
  outlet_name: string;
  plan_name: string;
  subscription_id: string;
  period_start: string;
  period_end: string;
  period_months: number;
  monthly_price: string;
  amount: string;
  tax_percent: string;
  tax_amount: string;
  total: string;
  paid_amount: string;
  method: IposFeeMethod;
  status: IposFeeInvoice["status"];
  issued_on: string;
  due_on: string;
  switched_at: Date | null;
  settlement_id: string | null;
  debt_item_id: string | null;
  void_reason: string | null;
  voided_at: Date | null;
  created_at: Date;
  version: number;
};

const feeSelect = (where: SQL) => sql`
  SELECT f.id, f.document_no, f.company_id, f.merchant_id, m.code AS merchant_code, p.name AS merchant_name, o.name AS outlet_name, pl.name AS plan_name, f.subscription_id,
    f.period_start::text, f.period_end::text, f.period_months, f.monthly_price::text, f.amount::text, f.tax_percent::text, f.tax_amount::text, f.total::text, f.paid_amount::text,
    f.method, f.status, f.issued_on::text, f.due_on::text, f.switched_at, f.settlement_id, f.debt_item_id, f.void_reason, f.voided_at, f.created_at, f.version
  FROM ipos.fee_invoices f JOIN affiliate.merchants m ON m.id = f.merchant_id JOIN crm.partners p ON p.id = m.partner_id
  JOIN affiliate.outlets o ON o.id = f.outlet_id JOIN ipos.plans pl ON pl.id = f.plan_id
  WHERE ${where}`;

const money = (value: string | number) => String(Math.round(Number(value)));

@Injectable()
export class IposFeesService implements OnModuleInit {
  private readonly logger = new Logger("IposFees");

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly ledger: LedgerService,
    private readonly debts: DebtsService,
    private readonly payments: PaymentsService,
    private readonly settlements: AffiliateSettlementsService,
    private readonly einvoices: EinvoicesService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    // Phiếu thu ngân hàng trừ công nợ phiếu phí (VietQR): công nợ hết thì phiếu đã thu, gia hạn thuê bao.
    this.payments.postedHooks.push((transaction) => this.refreshPaid(transaction));
    // Khoản G trong bảng đối soát tuần (QUYTAC_NGHIEPVU_601).
    this.settlements.registerCharge({
      merchants: async (executor, until) =>
        (
          await executor.execute<{ merchant_id: string }>(sql`
            SELECT DISTINCT merchant_id FROM ipos.fee_invoices WHERE method = 'settlement_deduction' AND status = 'awaiting' AND settlement_id IS NULL AND issued_on <= ${until}::date`)
        ).rows.map((row) => row.merchant_id),
      pending: async (executor, merchantId, until) =>
        Number(
          (
            await executor.execute<{ total: string }>(sql`
              SELECT coalesce(sum(total - paid_amount), 0)::text AS total FROM ipos.fee_invoices
              WHERE merchant_id = ${merchantId} AND method = 'settlement_deduction' AND status = 'awaiting' AND settlement_id IS NULL AND issued_on <= ${until}::date`)
          ).rows[0]!.total,
        ),
      attach: async (executor, merchantId, settlementId, until) => {
        await executor.execute(sql`
          UPDATE ipos.fee_invoices SET settlement_id = ${settlementId}, version = version + 1
          WHERE merchant_id = ${merchantId} AND method = 'settlement_deduction' AND status = 'awaiting' AND settlement_id IS NULL AND issued_on <= ${until}::date`);
      },
      // Xác nhận bảng: công nợ của phiếu chuyển vào công nợ của bảng (đóng công nợ phiếu bằng khoản ghi có cùng nguồn).
      confirmed: async (executor, settlementId) => {
        const rows = await executor.execute<{ id: string }>(sql`SELECT id FROM ipos.fee_invoices WHERE settlement_id = ${settlementId} AND status = 'awaiting'`);
        for (const row of rows.rows) await this.closeDebt(executor, row.id, "Chuyển vào bảng đối soát tuần");
      },
      paid: async (executor, settlementId) => {
        const rows = await executor.execute<{ id: string }>(sql`
          UPDATE ipos.fee_invoices SET paid_amount = total, status = 'paid', paid_at = now(), version = version + 1
          WHERE settlement_id = ${settlementId} AND status = 'awaiting' RETURNING id`);
        for (const row of rows.rows) await this.extendSubscription(executor, row.id);
      },
    });
  }

  private today(): string {
    return vietnamDate(this.clock.now());
  }

  // ---------------------------------------------------------------------------
  // Lập phiếu (việc nền `ipos-subscriptions-daily`; lập lại sau khi hủy).
  // ---------------------------------------------------------------------------

  // Kỳ chưa lập phiếu kế tiếp của thuê bao: kỳ đầu bắt đầu ngày hết dùng thử (hoặc ngày bắt đầu; thuê bao cấp trước khi có phiếu phí lấy kỳ hiện tại = ngày hết hạn trừ một kỳ),
  // kỳ sau nối tiếp phiếu gần nhất chưa hủy.
  // Kỳ đầu lập khi đến ngày bắt đầu kỳ; kỳ sau lập trước ngày bắt đầu kỳ 7 ngày (QUYTAC_NGHIEPVU_599 khoản 1).
  async runDaily(): Promise<{ issued: number; switched: number; deducted: number; reminded: number }> {
    const today = this.today();
    const candidates = await this.database.execute<{ id: string; period_start: string; first: boolean }>(sql`
      WITH last AS (
        SELECT DISTINCT ON (subscription_id) subscription_id, period_end FROM ipos.fee_invoices WHERE status <> 'voided' ORDER BY subscription_id, period_end DESC)
      SELECT s.id, coalesce(last.period_end, greatest(coalesce(s.trial_ends_on, s.starts_on), (s.ends_on - make_interval(months => s.period_months))::date))::text AS period_start, last.period_end IS NULL AS first
      FROM ipos.subscriptions s LEFT JOIN ipos.merchant_billing b ON b.merchant_id = s.merchant_id LEFT JOIN last ON last.subscription_id = s.id
      WHERE s.status <> 'cancelled' AND coalesce(b.method, 'vietqr') <> 'free'
        AND coalesce(last.period_end, greatest(coalesce(s.trial_ends_on, s.starts_on), (s.ends_on - make_interval(months => s.period_months))::date)) <= ${today}::date + ${iposFeeLeadDays}::int`);
    let issued = 0;
    for (const row of candidates.rows) {
      // Kỳ đầu chỉ lập khi đã đến ngày bắt đầu (hết dùng thử); kỳ sau lập trước 7 ngày.
      if (row.first && row.period_start > today) continue;
      const created = await this.database.transaction(async (transaction) => {
        await transaction.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`ipos-fee:${row.id}`}))`);
        return this.issue(transaction, row.id, row.period_start, null);
      });
      if (created) issued += 1;
    }
    const deducted = await this.database.transaction((transaction) => this.collectTransferred(transaction));
    const reminded = await this.remind(today);
    return { issued, switched: 0, deducted, reminded };
  }

  // Lập một phiếu cho kỳ bắt đầu `periodStart`; trả null khi kỳ đã có phiếu chưa hủy hoặc cách thu là miễn phí.
  async issue(transaction: Executor, subscriptionId: string, periodStart: string, createdBy: string | null): Promise<string | null> {
    const today = this.today();
    const sub = (
      await transaction.execute<{
        merchant_id: string;
        outlet_id: string;
        plan_id: string;
        period_months: number;
        monthly_price: string;
        tax_percent: string;
        company_id: string;
        partner_id: string;
        method: IposFeeMethod | "free";
        status: string;
      }>(sql`
        SELECT s.merchant_id, s.outlet_id, s.plan_id, s.period_months, coalesce(s.custom_monthly_price, pl.monthly_price)::text AS monthly_price, pl.tax_percent::text,
          pl.company_id, m.partner_id, coalesce(b.method, 'vietqr') AS method, s.status
        FROM ipos.subscriptions s JOIN ipos.plans pl ON pl.id = s.plan_id JOIN affiliate.merchants m ON m.id = s.merchant_id
        -- Cửa hàng chưa chọn cách thu: thu bằng VietQR.
        LEFT JOIN ipos.merchant_billing b ON b.merchant_id = s.merchant_id
        WHERE s.id = ${subscriptionId} FOR UPDATE OF s`)
    ).rows[0];
    if (!sub || sub.method === "free" || sub.status === "cancelled") return null;
    const taken = await transaction.execute(sql`SELECT 1 FROM ipos.fee_invoices WHERE subscription_id = ${subscriptionId} AND period_start = ${periodStart}::date AND status <> 'voided'`);
    if (taken.rows.length > 0) return null;
    const amount = Number(sub.monthly_price) * sub.period_months;
    const tax = Math.round((amount * Number(sub.tax_percent)) / 100);
    const total = amount + tax;
    const dates = (
      await transaction.execute<{ period_end: string; due_on: string }>(sql`
        SELECT (${periodStart}::date + make_interval(months => ${sub.period_months}))::date::text AS period_end, (${today}::date + ${iposFeeDueDays}::int)::text AS due_on`)
    ).rows[0]!;
    const inserted = (
      await transaction.execute<{ id: string; document_no: string }>(sql`
        INSERT INTO ipos.fee_invoices (company_id, merchant_id, subscription_id, outlet_id, plan_id, period_start, period_end, period_months, monthly_price, amount, tax_percent,
          tax_amount, total, method, issued_on, due_on, created_by)
        VALUES (${sub.company_id}, ${sub.merchant_id}, ${subscriptionId}, ${sub.outlet_id}, ${sub.plan_id}, ${periodStart}::date, ${dates.period_end}::date, ${sub.period_months},
          ${sub.monthly_price}, ${amount}, ${sub.tax_percent}, ${tax}, ${total}, ${sub.method}, ${today}::date, ${dates.due_on}::date, ${createdBy})
        RETURNING id, document_no`)
    ).rows[0]!;
    if (total > 0) {
      // Công nợ phải thu cửa hàng; cửa hàng là khách hàng của công ty vận hành sàn (CONG_VIEC_13).
      await transaction.execute(sql`
        INSERT INTO crm.partner_profiles (company_id, partner_id, is_customer, is_supplier) VALUES (${sub.company_id}, ${sub.partner_id}, true, false)
        ON CONFLICT (company_id, partner_id) DO UPDATE SET is_customer = true`);
      await this.debts.lockPartner(transaction, sub.company_id, "receivable", sub.partner_id);
      const debtItemId = (
        await transaction.execute<{ id: string }>(sql`
          INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount, note)
          VALUES (${sub.company_id}, ${sub.partner_id}, 'receivable', 'debit', 'ipos_fee_invoice', ${inserted.id}, ${inserted.document_no}, ${today}::date, ${dates.due_on}::date,
            ${total}, ${total}, 'Phí thuê bao iPOS')
          RETURNING id`)
      ).rows[0]!.id;
      await transaction.execute(sql`UPDATE ipos.fee_invoices SET debt_item_id = ${debtItemId} WHERE id = ${inserted.id}`);
      await this.debts.matchDebit(transaction, debtItemId);
      await this.ledger.record(transaction, {
        companyId: sub.company_id,
        sourceType: "ipos_fee_invoice",
        sourceId: inserted.id,
        journalNo: inserted.document_no,
        date: today,
        description: `Phí thuê bao iPOS ${inserted.document_no}`,
        lines: [debit("ipos_fee_receivable", total, sub.partner_id), credit("ipos_fee_revenue", amount), credit("vat_output", tax)],
      });
      // Trừ thu hộ: khoản trừ N vào bảng chuyển tiền ngày gần nhất lập sau ngày lập phiếu (QUYTAC_NGHIEPVU_600).
      if (sub.method === "collection_deduction") {
        await transaction.execute(sql`
          INSERT INTO instore.payout_deductions (recipient_kind, merchant_id, business_date, kind, amount, reference_id, note)
          VALUES ('merchant', ${sub.merchant_id}, ${today}::date, 'ipos_subscription', ${total}, ${inserted.id}, ${`Phí thuê bao iPOS ${inserted.document_no}`})`);
      }
      await this.issueEinvoice(transaction, inserted.id);
      await this.refreshPaid(transaction);
    } else {
      await transaction.execute(sql`UPDATE ipos.fee_invoices SET status = 'paid', paid_at = now() WHERE id = ${inserted.id}`);
      await this.extendSubscription(transaction, inserted.id);
    }
    await this.notifyOwners(transaction, sub.merchant_id, "ipos_fee_invoice", `Phiếu phí thuê bao iPOS ${inserted.document_no}: ${money(total)} đồng`, "/ipos/subscription");
    return inserted.id;
  }

  // Hóa đơn điện tử phí (một hóa đơn mỗi phiếu); công ty chưa bật hóa đơn điện tử thì bỏ qua, ghi nhật ký (lập sau trên module hóa đơn).
  private async issueEinvoice(transaction: Executor, feeInvoiceId: string): Promise<string | null> {
    const row = (await transaction.execute<FeeRow>(feeSelect(sql`f.id = ${feeInvoiceId}`))).rows[0]!;
    const settings = await settingsRow(transaction, row.company_id);
    if (!settings?.enabled || !settings.start_date || row.issued_on < settings.start_date) {
      this.logger.warn(`Công ty ${row.company_id} chưa bật hóa đơn điện tử: chưa lập hóa đơn phí thuê bao ${row.document_no}`);
      return null;
    }
    const company = (
      await transaction.execute<{ legal_name: string; tax_code: string | null; address: string | null }>(sql`SELECT legal_name, tax_code, address FROM core.companies WHERE id = ${row.company_id}`)
    ).rows[0]!;
    const buyer = (
      await transaction.execute<{ partner_id: string; name: string; tax_code: string | null; address: string | null }>(sql`
        SELECT p.id AS partner_id, p.name, p.tax_code, p.address FROM affiliate.merchants m JOIN crm.partners p ON p.id = m.partner_id WHERE m.id = ${row.merchant_id}`)
    ).rows[0]!;
    const label = `${row.period_start.split("-").reverse().join("/")} – ${row.period_end.split("-").reverse().join("/")}`;
    return insertInvoice(transaction, {
      companyId: row.company_id,
      sourceDocumentId: null,
      iposFeeInvoiceId: row.id,
      kind: "original",
      relatedInvoiceId: null,
      invoiceDate: row.issued_on,
      settings,
      seller: { name: company.legal_name, taxCode: company.tax_code, address: company.address },
      buyer: { partnerId: buyer.partner_id, name: buyer.name, taxCode: buyer.tax_code, address: buyer.address, anonymous: false },
      currency: "VND",
      items: [
        {
          lineNo: 1,
          itemCode: null,
          itemName: `Phí thuê bao phần mềm bán hàng iPOS – ${row.plan_name} – ${row.outlet_name} (${label})`,
          unitName: "Tháng",
          quantity: row.period_months,
          unitPrice: Number(row.monthly_price),
          vatRate: String(Number(row.tax_percent)) as VatRate,
          netAmount: Number(row.amount),
          taxAmount: Number(row.tax_amount),
          totalAmount: Number(row.total),
          isPromotion: false,
        },
      ],
      note: row.document_no,
    });
  }

  // ---------------------------------------------------------------------------
  // Đã thu, gia hạn.
  // ---------------------------------------------------------------------------

  // Phiếu VietQR, trừ thu hộ còn công nợ: đã thu = tổng − công nợ còn lại; công nợ hết thì đã thu đủ.
  async refreshPaid(executor: Executor): Promise<void> {
    const paid = await executor.execute<{ id: string }>(sql`
      UPDATE ipos.fee_invoices f SET paid_amount = least(f.total, f.total - d.open_amount),
        status = CASE WHEN d.open_amount = 0 THEN 'paid' ELSE f.status END, paid_at = CASE WHEN d.open_amount = 0 THEN now() ELSE f.paid_at END, version = f.version + 1
      FROM finance.debt_items d
      WHERE d.id = f.debt_item_id AND f.status = 'awaiting' AND f.settlement_id IS NULL AND f.paid_amount <> least(f.total, f.total - d.open_amount)
      RETURNING f.id, f.status`);
    for (const row of paid.rows as { id: string; status: string }[]) if (row.status === "paid") await this.extendSubscription(executor, row.id);
  }

  // Trừ thu hộ (QUYTAC_NGHIEPVU_600): khoản trừ N nằm trong bảng chuyển tiền đã chuyển thì phần đó coi như đã thu: bút toán Nợ phải trả cửa hàng (331) /
  // Có phải thu phí thuê bao (131), đóng công nợ phần đó bằng khoản ghi có, cộng đã thu. Bảng chuyển tiền thiếu tiền thì phần âm dồn sang bảng sau (cách của CONG_VIEC_73).
  async collectTransferred(executor: Executor): Promise<number> {
    const rows = await executor.execute<{ id: string; amount: string; fee_invoice_id: string; company_id: string; partner_id: string; document_no: string; payout_no: string; day: string }>(sql`
      SELECT d.id, d.amount::text, f.id AS fee_invoice_id, f.company_id, m.partner_id, f.document_no, p.document_no AS payout_no, p.transferred_on::text AS day
      FROM instore.payout_deductions d JOIN instore.payouts p ON p.id = d.payout_id JOIN ipos.fee_invoices f ON f.id = d.reference_id
      JOIN affiliate.merchants m ON m.id = f.merchant_id
      WHERE d.kind = 'ipos_subscription' AND p.status = 'transferred' AND f.status = 'awaiting'
        AND NOT EXISTS (SELECT 1 FROM accounting.journals j WHERE j.source_type = 'ipos_fee_deduction' AND j.source_id = d.id)
      ORDER BY p.transferred_on, d.created_at
      FOR UPDATE OF f`);
    for (const row of rows.rows) {
      await this.ledger.record(executor, {
        companyId: row.company_id,
        sourceType: "ipos_fee_deduction",
        sourceId: row.id,
        journalNo: row.payout_no,
        date: row.day,
        description: `Trừ phí thuê bao iPOS ${row.document_no} vào bảng chuyển tiền ${row.payout_no}`,
        lines: [debit("affiliate_payable", Number(row.amount), row.partner_id), credit("ipos_fee_receivable", Number(row.amount), row.partner_id)],
      });
      await this.reduceDebt(executor, row.fee_invoice_id, Number(row.amount), row.id, `Trừ vào bảng chuyển tiền ${row.payout_no}`);
    }
    if (rows.rows.length > 0) await this.refreshPaid(executor);
    return rows.rows.length;
  }

  // Ghi có một phần công nợ của phiếu (nguồn là dòng khoản trừ để mỗi lần trừ một khoản riêng).
  private async reduceDebt(executor: Executor, feeInvoiceId: string, amount: number, deductionId: string, note: string): Promise<void> {
    const debt = (
      await executor.execute<{ id: string; company_id: string; partner_id: string; document_no: string }>(sql`
        SELECT d.id, d.company_id, d.partner_id, d.document_no FROM ipos.fee_invoices f JOIN finance.debt_items d ON d.id = f.debt_item_id WHERE f.id = ${feeInvoiceId}`)
    ).rows[0];
    if (!debt) return;
    await this.debts.lockPartner(executor, debt.company_id, "receivable", debt.partner_id);
    const creditId = (
      await executor.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, original_item_id, document_no, document_date, amount, open_amount, note)
        VALUES (${debt.company_id}, ${debt.partner_id}, 'receivable', 'credit', 'ipos_fee_deduction', ${deductionId}, ${debt.id}, ${debt.document_no}, ${this.today()}::date,
          ${amount}, ${amount}, ${note})
        RETURNING id`)
    ).rows[0]!.id;
    await this.debts.matchCredit(executor, creditId, [{ debitItemId: debt.id, amount: null }], false);
  }

  // Thu đủ: thuê bao gia hạn đến hết kỳ của phiếu; quá hạn, tạm khóa (không khóa tay) về đang hoạt động.
  private async extendSubscription(executor: Executor, feeInvoiceId: string): Promise<void> {
    await executor.execute(sql`
      UPDATE ipos.subscriptions s SET ends_on = greatest(s.ends_on, f.period_end),
        status = CASE WHEN s.status = 'trial' THEN 'trial' WHEN s.locked_manually THEN 'locked' ELSE 'active' END, updated_at = now(), version = s.version + 1
      FROM ipos.fee_invoices f WHERE f.id = ${feeInvoiceId} AND s.id = f.subscription_id AND s.status <> 'cancelled'`);
  }

  // Đóng công nợ còn lại của phiếu bằng khoản ghi có cùng nguồn (chuyển vào bảng đối soát, hủy phiếu).
  private async closeDebt(executor: Executor, feeInvoiceId: string, note: string): Promise<void> {
    const debt = (
      await executor.execute<{ id: string; company_id: string; partner_id: string; open_amount: string; document_no: string }>(sql`
        SELECT d.id, d.company_id, d.partner_id, d.open_amount::text, d.document_no FROM ipos.fee_invoices f JOIN finance.debt_items d ON d.id = f.debt_item_id WHERE f.id = ${feeInvoiceId}`)
    ).rows[0];
    if (!debt || Number(debt.open_amount) <= 0) return;
    await this.debts.lockPartner(executor, debt.company_id, "receivable", debt.partner_id);
    const creditId = (
      await executor.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, original_item_id, document_no, document_date, amount, open_amount, note)
        VALUES (${debt.company_id}, ${debt.partner_id}, 'receivable', 'credit', 'ipos_fee_invoice_close', ${feeInvoiceId}, ${debt.id}, ${debt.document_no}, ${this.today()}::date,
          ${debt.open_amount}::numeric, ${debt.open_amount}::numeric, ${note})
        RETURNING id`)
    ).rows[0]!.id;
    await this.debts.matchCredit(executor, creditId, [{ debitItemId: debt.id, amount: null }], false);
  }

  // ---------------------------------------------------------------------------
  // Hủy, lập lại (API_356).
  // ---------------------------------------------------------------------------

  async void(actor: BuyerAdminActor, id: string, input: { reason: string; version: number }): Promise<IposFeeInvoiceDetail> {
    await this.database.transaction(async (transaction) => {
      const row = (await transaction.execute<FeeRow>(sql`${feeSelect(sql`f.id = ${id} AND f.company_id = ${actor.operatorCompanyId}`)} FOR UPDATE OF f`)).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Chỉ hủy phiếu chờ thu chưa thu đồng nào, chưa vào bảng đối soát, khoản trừ chưa vào bảng chuyển tiền.
      if (row.status !== "awaiting" || Number(row.paid_amount) > 0 || row.settlement_id) throw new ApiError("BUSINESS_RULE", "iposFeeNotVoidable");
      const gathered = await transaction.execute(sql`SELECT 1 FROM instore.payout_deductions WHERE reference_id = ${id} AND payout_id IS NOT NULL`);
      if (gathered.rows.length > 0) throw new ApiError("BUSINESS_RULE", "iposFeeNotVoidable");
      await transaction.execute(sql`DELETE FROM instore.payout_deductions WHERE reference_id = ${id} AND payout_id IS NULL`);
      await this.closeDebt(transaction, id, `Hủy phiếu phí: ${input.reason}`);
      const partner = (await transaction.execute<{ partner_id: string }>(sql`SELECT partner_id FROM affiliate.merchants WHERE id = ${row.merchant_id}`)).rows[0]!.partner_id;
      if (Number(row.total) > 0) {
        await this.ledger.record(transaction, {
          companyId: row.company_id,
          sourceType: "ipos_fee_invoice_void",
          sourceId: id,
          journalNo: row.document_no,
          date: this.today(),
          description: `Hủy phiếu phí thuê bao iPOS ${row.document_no}`,
          lines: [debit("ipos_fee_revenue", Number(row.amount)), debit("vat_output", Number(row.tax_amount)), credit("ipos_fee_receivable", Number(row.total), partner)],
        });
      }
      await transaction.execute(sql`
        UPDATE ipos.fee_invoices SET status = 'voided', void_reason = ${input.reason}, voided_by = ${actor.userId}, voided_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "ipos_fee_invoice.void",
          entityType: "ipos_fee_invoice",
          entityId: id,
          afterData: { documentNo: row.document_no, reason: input.reason },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
    });
    return this.detail(actor, id, true);
  }

  // Lập lại phiếu cho kỳ đã hủy (cách thu hiện tại của cửa hàng).
  async reissue(actor: BuyerAdminActor, subscriptionId: string, periodStart: string): Promise<IposFeeInvoiceDetail> {
    const id = await this.database.transaction(async (transaction) => {
      const sub = (
        await transaction.execute<{ id: string }>(sql`
          SELECT s.id FROM ipos.subscriptions s JOIN affiliate.merchants m ON m.id = s.merchant_id WHERE s.id = ${subscriptionId} AND m.company_id = ${actor.operatorCompanyId}`)
      ).rows[0];
      if (!sub) throw new ApiError("NOT_FOUND", "notFound");
      const voided = await transaction.execute(sql`SELECT 1 FROM ipos.fee_invoices WHERE subscription_id = ${subscriptionId} AND period_start = ${periodStart}::date AND status = 'voided'`);
      if (voided.rows.length === 0) throw new ApiError("BUSINESS_RULE", "iposFeeReissueInvalid");
      const created = await this.issue(transaction, subscriptionId, periodStart, actor.userId);
      if (!created) throw new ApiError("BUSINESS_RULE", "iposFeeReissueInvalid");
      await this.audit.record(
        {
          actorUserId: actor.userId,
          companyId: actor.operatorCompanyId,
          appCode: "crm",
          action: "ipos_fee_invoice.reissue",
          entityType: "ipos_fee_invoice",
          entityId: created,
          afterData: { subscriptionId, periodStart },
          ip: actor.client.ip,
          userAgent: actor.client.userAgent,
          requestId: actor.client.requestId,
        },
        transaction,
      );
      return created;
    });
    return this.detail(actor, id, true);
  }

  // ---------------------------------------------------------------------------
  // Xem (API_356, thẻ Phí của MAN_HINH_306, API_353).
  // ---------------------------------------------------------------------------

  private view(row: FeeRow): IposFeeInvoice {
    const remaining = Number(row.total) - Number(row.paid_amount);
    return {
      id: row.id,
      documentNo: row.document_no,
      merchantId: row.merchant_id,
      merchantCode: row.merchant_code,
      merchantName: row.merchant_name,
      outletName: row.outlet_name,
      planName: row.plan_name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      periodMonths: row.period_months,
      monthlyPrice: money(row.monthly_price),
      amount: money(row.amount),
      taxPercent: String(Number(row.tax_percent)),
      taxAmount: money(row.tax_amount),
      total: money(row.total),
      paidAmount: money(row.paid_amount),
      remaining: money(row.status === "voided" ? 0 : remaining),
      method: row.method,
      status: row.status,
      issuedOn: row.issued_on,
      dueOn: row.due_on,
      overdue: row.status === "awaiting" && row.due_on < this.today(),
      switchedToVietqr: row.switched_at !== null,
      createdAt: new Date(row.created_at).toISOString(),
      version: row.version,
    };
  }

  async list(actor: BuyerAdminActor, query: z.infer<typeof iposFeeInvoiceListQuerySchema>): Promise<PageResponse<IposFeeInvoice>> {
    const conditions: SQL[] = [sql`f.company_id = ${actor.operatorCompanyId}`];
    if (query.status) conditions.push(sql`f.status = ${query.status}`);
    if (query.method) conditions.push(sql`f.method = ${query.method}`);
    if (query.merchantId) conditions.push(sql`f.merchant_id = ${query.merchantId}`);
    if (query.period) conditions.push(sql`to_char(f.period_start, 'YYYY-MM') = ${query.period}`);
    if (query.overdue) conditions.push(sql`f.status = 'awaiting' AND f.due_on < ${this.today()}::date`);
    const where = sql.join(conditions, sql` AND `);
    const total = (await this.database.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ipos.fee_invoices f WHERE ${where}`)).rows[0]!.n;
    const rows = await this.database.execute<FeeRow>(sql`${feeSelect(where)} ORDER BY f.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`);
    return { data: rows.rows.map((row) => this.view(row)), page: query.page, pageSize: query.pageSize, total };
  }

  async detail(actor: BuyerAdminActor, id: string, canManage: boolean): Promise<IposFeeInvoiceDetail> {
    const row = (await this.database.execute<FeeRow>(feeSelect(sql`f.id = ${id} AND f.company_id = ${actor.operatorCompanyId}`))).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return this.detailOf(row, canManage);
  }

  private async detailOf(row: FeeRow, canManage: boolean): Promise<IposFeeInvoiceDetail> {
    const deductions = await this.database.execute<{ payout_no: string | null; business_date: string; amount: string; transferred: boolean }>(sql`
      SELECT p.document_no AS payout_no, d.business_date::text, d.amount::text, coalesce(p.status = 'transferred', false) AS transferred
      FROM instore.payout_deductions d LEFT JOIN instore.payouts p ON p.id = d.payout_id WHERE d.reference_id = ${row.id} ORDER BY d.created_at`);
    const settlement = row.settlement_id
      ? (await this.database.execute<{ document_no: string }>(sql`SELECT document_no FROM affiliate.settlements WHERE id = ${row.settlement_id}`)).rows[0]?.document_no ?? null
      : null;
    const einvoice = (
      await this.database.execute<{ id: string; invoice_no: string | null; status: string }>(sql`
        SELECT id, invoice_no, status FROM finance.einvoices WHERE ipos_fee_invoice_id = ${row.id} AND kind = 'original'`)
    ).rows[0];
    const debt = row.debt_item_id
      ? (await this.database.execute<{ open_amount: string }>(sql`SELECT open_amount::text FROM finance.debt_items WHERE id = ${row.debt_item_id}`)).rows[0]?.open_amount ?? null
      : null;
    const journals = await this.database.execute<{ journal_no: string }>(sql`
      SELECT journal_no FROM accounting.journals WHERE source_id = ${row.id} AND source_type IN ('ipos_fee_invoice', 'ipos_fee_invoice_void') ORDER BY created_at`);
    return {
      ...this.view(row),
      subscriptionId: row.subscription_id,
      voidReason: row.void_reason,
      voidedAt: row.voided_at ? new Date(row.voided_at).toISOString() : null,
      deductions: deductions.rows.map((item) => ({ payoutNo: item.payout_no, businessDate: item.business_date, amount: money(item.amount), transferred: item.transferred })),
      settlementNo: settlement,
      einvoice: einvoice ? { id: einvoice.id, invoiceNo: einvoice.invoice_no, status: einvoice.status } : null,
      debtOpenAmount: debt === null ? null : money(debt),
      journalNos: journals.rows.map((item) => item.journal_no),
      canManage: canManage && row.status === "awaiting",
      canReissue:
        canManage &&
        row.status === "voided" &&
        (await this.database.execute(sql`SELECT 1 FROM ipos.fee_invoices WHERE subscription_id = ${row.subscription_id} AND period_start = ${row.period_start}::date AND status <> 'voided'`)).rows
          .length === 0,
    };
  }

  // Thẻ Phí: tổng phải thu, đã thu, còn phải thu, quá hạn theo cách thu (phiếu chưa hủy lập trong khoảng ngày).
  async summary(actor: BuyerAdminActor, period: { from: string; to: string; merchantId?: string }): Promise<IposFeeSummary> {
    const rows = await this.database.execute<{ method: IposFeeMethod; invoices: number; total: string; paid: string; remaining: string; overdue: string }>(sql`
      SELECT f.method, count(*)::int AS invoices, sum(f.total)::text AS total, sum(f.paid_amount)::text AS paid, sum(f.total - f.paid_amount)::text AS remaining,
        coalesce(sum(f.total - f.paid_amount) FILTER (WHERE f.due_on < ${this.today()}::date), 0)::text AS overdue
      FROM ipos.fee_invoices f
      WHERE f.company_id = ${actor.operatorCompanyId} AND f.status <> 'voided' AND f.issued_on BETWEEN ${period.from}::date AND ${period.to}::date
        ${period.merchantId ? sql`AND f.merchant_id = ${period.merchantId}` : sql``}
      GROUP BY f.method ORDER BY f.method`);
    const list = rows.rows.map((row) => ({ ...row, total: money(row.total), paid: money(row.paid), remaining: money(row.remaining), overdue: money(row.overdue) }));
    const sum = (key: "total" | "paid" | "remaining" | "overdue") => String(list.reduce((value, row) => value + Number(row[key]), 0));
    return { rows: list, totals: { invoices: list.reduce((value, row) => value + row.invoices, 0), total: sum("total"), paid: sum("paid"), remaining: sum("remaining"), overdue: sum("overdue") } };
  }

  // Cổng cửa hàng (API_353; MAN_HINH_301): cách thu, thuê bao, phiếu phí 12 tháng gần nhất.
  async merchantOverview(merchantId: string): Promise<IposMerchantFeeOverview> {
    const billing = (
      await this.database.execute<{ method: IposMerchantFeeOverview["billingMethod"]; free_until: string | null }>(sql`
        SELECT method, free_until::text FROM ipos.merchant_billing WHERE merchant_id = ${merchantId}`)
    ).rows[0];
    const today = this.today();
    const subscriptions = await this.database.execute<{
      id: string;
      outlet_name: string;
      plan_name: string;
      status: IposMerchantFeeOverview["subscriptions"][number]["status"];
      ends_on: string;
      grace_left: number | null;
      monthly_price: string;
    }>(sql`
      SELECT s.id, o.name AS outlet_name, pl.name AS plan_name, s.status, s.ends_on::text,
        CASE WHEN s.status = 'overdue' THEN (s.ends_on + 7 - ${today}::date)::int END AS grace_left, coalesce(s.custom_monthly_price, pl.monthly_price)::text AS monthly_price
      FROM ipos.subscriptions s JOIN affiliate.outlets o ON o.id = s.outlet_id JOIN ipos.plans pl ON pl.id = s.plan_id
      WHERE s.merchant_id = ${merchantId} AND (s.status <> 'cancelled' OR s.cancelled_at > now() - interval '12 months')
      ORDER BY s.status = 'cancelled', o.name`);
    const invoices = await this.database.execute<FeeRow>(sql`
      ${feeSelect(sql`f.merchant_id = ${merchantId} AND f.status <> 'voided' AND f.created_at > now() - interval '12 months'`)} ORDER BY f.created_at DESC LIMIT 100`);
    return {
      billingMethod: billing?.method ?? null,
      freeUntil: billing?.free_until ?? null,
      subscriptions: subscriptions.rows.map((row) => ({
        id: row.id,
        outletName: row.outlet_name,
        planName: row.plan_name,
        status: row.status,
        endsOn: row.ends_on,
        graceDaysLeft: row.grace_left,
        monthlyPrice: money(row.monthly_price),
      })),
      invoices: invoices.rows.map((row) => this.view(row)),
    };
  }

  // Mã VietQR trả phí: tài khoản nhận tiền của công ty vận hành sàn, nội dung là số phiếu, số tiền còn phải thu (QUYTAC_NGHIEPVU_602).
  async vietqr(merchantId: string, id: string): Promise<IposFeeVietqr> {
    const row = (await this.database.execute<FeeRow>(feeSelect(sql`f.id = ${id} AND f.merchant_id = ${merchantId}`))).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.status !== "awaiting" || row.method !== "vietqr") throw new ApiError("BUSINESS_RULE", "iposFeeNotPayableByVietqr");
    const account = bankTransferConfiguration();
    if (!account) throw new ApiError("BUSINESS_RULE", "iposFeeVietqrNotConfigured");
    const amount = Number(row.total) - Number(row.paid_amount);
    return {
      documentNo: row.document_no,
      amount: String(amount),
      content: row.document_no,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      payload: vietQrData({ bankBin: account.bankBin, accountNumber: account.accountNumber, amount, content: row.document_no }),
    };
  }

  // ---------------------------------------------------------------------------
  // Nhắc (QUYTAC_NGHIEPVU_596 khoản 3, 603): còn 7 ngày, 1 ngày, ngày quá hạn; dùng thử còn 3 ngày.
  // ---------------------------------------------------------------------------

  private async remind(today: string): Promise<number> {
    const rows = await this.database.execute<{ merchant_id: string; outlet_name: string; kind: string; ends_on: string }>(sql`
      SELECT s.merchant_id, o.name AS outlet_name, s.ends_on::text,
        CASE WHEN s.status = 'trial' THEN 'trial' WHEN s.ends_on - ${today}::date = 7 THEN 'days7' WHEN s.ends_on - ${today}::date = 1 THEN 'days1' ELSE 'overdue' END AS kind
      FROM ipos.subscriptions s JOIN affiliate.outlets o ON o.id = s.outlet_id LEFT JOIN ipos.merchant_billing b ON b.merchant_id = s.merchant_id
      WHERE coalesce(b.method, 'vietqr') <> 'free' AND (
        (s.status = 'trial' AND s.trial_ends_on - ${today}::date = 3)
        OR (s.status IN ('active', 'overdue') AND (s.ends_on - ${today}::date IN (7, 1) OR s.ends_on + 1 = ${today}::date))
      )
      AND NOT EXISTS (SELECT 1 FROM ipos.fee_invoices f WHERE f.subscription_id = s.id AND f.status = 'paid' AND f.period_start >= s.ends_on)`);
    const titles: Record<string, (row: { outlet_name: string; ends_on: string }) => string> = {
      trial: (row) => `Thuê bao iPOS điểm bán ${row.outlet_name} còn 3 ngày dùng thử`,
      days7: (row) => `Thuê bao iPOS điểm bán ${row.outlet_name} hết hạn sau 7 ngày, trả phí để gia hạn`,
      days1: (row) => `Thuê bao iPOS điểm bán ${row.outlet_name} hết hạn ngày mai, trả phí để gia hạn`,
      overdue: (row) => `Thuê bao iPOS điểm bán ${row.outlet_name} đã quá hạn, còn ${iposFeeLeadDays} ngày ân hạn trước khi tạm khóa`,
    };
    for (const row of rows.rows) await this.notifyOwners(this.database, row.merchant_id, `ipos_subscription_${row.kind}`, titles[row.kind]!(row), "/ipos/subscription");
    return rows.rows.length;
  }

  private async notifyOwners(executor: Executor, merchantId: string, kind: string, title: string, link: string): Promise<void> {
    const owners = await executor.execute<{ user_id: string }>(sql`SELECT user_id FROM affiliate.members WHERE merchant_id = ${merchantId} AND role = 'owner' AND status = 'active'`);
    await notify(
      executor,
      owners.rows.map((row) => ({ userId: row.user_id, companyId: null, kind, title, link })),
    );
  }
}
