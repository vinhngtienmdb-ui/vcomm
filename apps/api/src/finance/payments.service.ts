// Phiếu thu, phiếu chi (CONG_VIEC_13; CHUC_NANG_67; QUYTAC_NGHIEPVU_87 đến 89; API_86): lập, sửa, gửi, rút; trừ nợ theo chứng từ; hoàn tiền; phiếu chi qua luồng duyệt.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  paymentKindIsReceipt,
  paymentKindSettles,
  paymentKindSide,
  type DebtSourceType,
  type AnyPaymentKind,
  type PaymentKind,
  type RetailFundDocumentKind,
  type PaymentListItem,
  type PaymentOptionsResponse,
  type PaymentResponse,
  type PaymentStatus,
  type PaymentFxPreviewResponse,
  type paymentListQuerySchema,
  type saveCurrencyPurchaseSchema,
  type savePaymentSchema,
} from "contracts";
import { sql } from "drizzle-orm";
import type { Messages } from "i18n";
import type { z } from "zod";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { daysBetween, DebtsService, type Executor } from "./debts.service";
import { financeAudit, financePermissions, requireFinancePermission } from "./finance-context";
import { assertSettlementPayment, isLoyaltySettlementPaymentKind, refreshSettlementPaid } from "../loyalty/settlement-payments";
import { checkCustomsOnPost } from "./customs-tax";
import { averageRate, fundBalance, fundForeignBalance } from "./funds.service";

type Input = z.output<typeof savePaymentSchema>;
const fraction = (value: string) => (value.split(".")[1] ?? "").replace(/0+$/, "").length;
type CurrencyPurchaseInput = z.output<typeof saveCurrencyPurchaseSchema>;
// Kết quả kiểm tra phiếu: dòng trừ nợ (amount theo tiền tệ công ty), số tiền phiếu, phần ngoại tệ (CONG_VIEC_56).
type Prepared = {
  lines: { debitItemId: string; amount: string; foreignAmount: string | null }[];
  amount: string;
  foreign: { currency: string; amount: string; exchangeRate: string | null } | null;
};
// Tính phiếu chi trả nợ ngoại tệ (QUYTAC_NGHIEPVU_407, 410, 411).
type FxComputation = {
  currency: string;
  foreignTotal: number;
  lines: { debitItemId: string; foreignAmount: string; bookRate: string; bookAmount: string }[];
  bookTotal: string;
  fundValue: string;
  fundRate: string | null;
  exchangeDifference: string;
  exchangeRate: string | null;
};
type FieldErrors = Record<string, keyof Messages["errors"]>;
const receiptType = "finance.receipt";
const paymentType = "finance.payment";
const documentTypeOf = (kind: AnyPaymentKind) => (paymentKindIsReceipt(kind) ? receiptType : paymentType);
// Dãy số: phiếu mua ngoại tệ có dãy riêng tiền tố MNT, vẫn đi luồng duyệt phiếu chi (CONG_VIEC_56; quyết định người dùng 2026-11-12).
const currencyPurchaseType = "finance.currency_purchase";
const sequenceOf = (kind: AnyPaymentKind) =>
  kind === "currency_purchase" ? { type: currencyPurchaseType, prefix: "MNT" } : paymentKindIsReceipt(kind) ? { type: receiptType, prefix: "PT" } : { type: paymentType, prefix: "PC" };
type PaymentRow = {
  id: string;
  company_id: string;
  document_no: string | null;
  kind: AnyPaymentKind;
  partner_id: string | null;
  partner_code: string | null;
  partner_name: string | null;
  fund_id: string;
  fund_code: string;
  fund_name: string;
  payment_date: string;
  amount: string;
  note: string | null;
  status: PaymentStatus;
  approval_request_id: string | null;
  post_error: string | null;
  posted_at: string | null;
  created_by: string;
  created_by_name: string;
  version: number;
  currency: string | null;
  foreign_amount: string | null;
  exchange_rate: string | null;
  exchange_difference: string | null;
  counter_fund_id: string | null;
  counter_fund_code: string | null;
  counter_fund_name: string | null;
  reference_no: string | null;
};

@Injectable()
export class PaymentsService implements OnModuleInit {
  // Module khác đăng ký lúc khởi động để chạy trong cùng giao dịch ghi sổ phiếu thu chi (kế toán, CONG_VIEC_14).
  readonly postedHooks: ((transaction: Executor, paymentId: string) => Promise<void>)[] = [];

  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly debts: DebtsService,
  ) {}

  // Duyệt xong thì ghi sổ; không ghi sổ được (số dư quỹ, số còn nợ đã đổi) thì phiếu về "Bị từ chối" kèm lý do để người lập sửa, gửi lại.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== paymentType) return;
      const status = String(event.payload.status);
      const requestId = String(event.payload.requestId);
      const payment = (await this.database.execute<{ id: string }>(sql`SELECT id FROM finance.payments WHERE approval_request_id = ${requestId} AND status = 'pending'`)).rows[0];
      if (!payment) return;
      if (status === "approved") {
        try {
          await this.database.transaction((transaction) => this.post(transaction, payment.id));
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await this.database.execute(sql`
            UPDATE finance.payments SET status = 'rejected', post_error = ${error.messageKey}, updated_at = now(), version = version + 1
            WHERE id = ${payment.id} AND status = 'pending'`);
        }
      } else if (status === "rejected" || status === "withdrawn") {
        await this.database.execute(sql`UPDATE finance.payments SET status = ${status}, updated_at = now(), version = version + 1 WHERE id = ${payment.id} AND status = 'pending'`);
      }
    });
  }

  async options(actor: Actor): Promise<PaymentOptionsResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments);
    const funds = await this.database.execute<{ id: string; code: string; name: string; kind: "cash" | "bank"; balance: string; currency: string | null; foreign_balance: string | null }>(sql`
      SELECT f.id, f.code, f.name, f.kind, ${fundBalance(sql`f.id`)}::text AS balance, f.currency, ${fundForeignBalance(sql`f.id`)}::text AS foreign_balance FROM finance.funds f
      WHERE f.company_id = ${actor.companyId} AND f.status = 'active' ORDER BY f.code`);
    return {
      funds: funds.rows.map((fund) => ({
        id: fund.id,
        code: fund.code,
        name: fund.name,
        kind: fund.kind,
        balance: trimDecimal(fund.balance),
        fundCurrency: fund.currency,
        foreignBalance: fund.foreign_balance === null ? null : trimDecimal(fund.foreign_balance),
      })),
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }

  private select() {
    return sql`
      SELECT p.id, p.company_id, p.document_no, p.kind, p.partner_id, pr.code AS partner_code, pr.name AS partner_name, p.fund_id, f.code AS fund_code, f.name AS fund_name,
        p.payment_date::text, p.amount::text, p.note, p.status, p.approval_request_id, p.post_error, p.posted_at::text, p.created_by, u.full_name AS created_by_name, p.version,
        p.currency, p.foreign_amount::text, p.exchange_rate::text, p.exchange_difference::text, p.counter_fund_id, cf.code AS counter_fund_code, cf.name AS counter_fund_name,
        p.reference_no
      FROM finance.payments p LEFT JOIN crm.partners pr ON pr.id = p.partner_id JOIN finance.funds f ON f.id = p.fund_id JOIN core.users u ON u.id = p.created_by
        LEFT JOIN finance.funds cf ON cf.id = p.counter_fund_id`;
  }

  async list(actor: Actor, query: z.output<typeof paymentListQuerySchema>): Promise<PaymentListItem[]> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments);
    const rows = await this.database.execute<PaymentRow>(sql`
      ${this.select()} WHERE p.company_id = ${actor.companyId}
        ${query.kind ? sql`AND p.kind = ${query.kind}` : sql``} ${query.status ? sql`AND p.status = ${query.status}` : sql``} ${query.partnerId ? sql`AND p.partner_id = ${query.partnerId}` : sql``}
      ORDER BY p.payment_date DESC, p.created_at DESC LIMIT 500`);
    return rows.rows.map((row) => ({
      id: row.id,
      documentNo: row.document_no,
      kind: row.kind,
      paymentDate: day(row.payment_date),
      partnerName: row.partner_name,
      fundName: row.fund_name,
      amount: trimDecimal(row.amount),
      status: row.status,
    }));
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<PaymentRow> {
    const row = (await executor.execute<PaymentRow>(sql`${this.select()} WHERE p.company_id = ${companyId} AND p.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async detail(actor: Actor, id: string): Promise<PaymentResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, financePermissions.view, financePermissions.managePayments);
    const row = await this.single(this.database, actor.companyId, id);
    const today = this.permissionService.today();
    const posted = row.status === "posted";
    // Đã ghi sổ: các khoản tăng thực trừ; chưa ghi sổ: chứng từ người lập chọn.
    const lines = await this.database.execute<{
      id: string;
      document_no: string;
      source_type: DebtSourceType;
      document_date: string;
      due_date: string;
      amount: string;
      open_amount: string;
      allocated: string;
      allocated_foreign: string | null;
      currency: string | null;
      foreign_amount: string | null;
      open_foreign_amount: string | null;
      book_rate: string | null;
    }>(
      posted
        ? sql`
          SELECT d.id, d.document_no, d.source_type, d.document_date::text, d.due_date::text, d.amount::text, d.open_amount::text, a.amount::text AS allocated,
            (SELECT l.foreign_amount::text FROM finance.payment_lines l WHERE l.payment_id = ${id} AND l.debit_item_id = d.id) AS allocated_foreign,
            d.currency, d.foreign_amount::text, d.open_foreign_amount::text, d.book_rate::text
          FROM finance.debt_items c JOIN finance.debt_allocations a ON a.credit_item_id = c.id JOIN finance.debt_items d ON d.id = a.debit_item_id
          WHERE c.source_type = 'payment' AND c.source_id = ${id} ORDER BY d.due_date, d.document_date`
        : sql`
          SELECT d.id, d.document_no, d.source_type, d.document_date::text, d.due_date::text, d.amount::text, d.open_amount::text, l.amount::text AS allocated,
            l.foreign_amount::text AS allocated_foreign, d.currency, d.foreign_amount::text, d.open_foreign_amount::text, d.book_rate::text
          FROM finance.payment_lines l JOIN finance.debt_items d ON d.id = l.debit_item_id
          WHERE l.payment_id = ${id} ORDER BY d.due_date, d.document_date`,
    );
    const allocatedTotal = lines.rows.reduce((total, line) => total + Number(line.allocated), 0);
    const unallocated =
      paymentKindSettles(row.kind) && !row.currency
        ? posted
          ? ((await this.database.execute<{ open_amount: string }>(sql`SELECT open_amount::text FROM finance.debt_items WHERE source_type = 'payment' AND source_id = ${id}`)).rows[0]?.open_amount ??
            "0")
          : Math.max(0, Number(row.amount) - allocatedTotal).toFixed(4)
        : "0";
    // Dòng thuế của phiếu nộp, nhận hoàn thuế hải quan (CONG_VIEC_56; QUYTAC_NGHIEPVU_416, 417).
    const customsLines = await this.database.execute<{
      line_kind: "payment" | "offset" | "refund" | "late_payment";
      declaration_id: string;
      declaration_no: string | null;
      tax_type: "import_duty" | "excise_tax" | "environmental_tax" | "import_vat";
      amount: string;
      overdue_days: number | null;
      computed_amount: string | null;
    }>(sql`
      SELECT c.line_kind, c.declaration_id, d.declaration_no, c.tax_type, c.amount::text, c.overdue_days, c.computed_amount::text
      FROM finance.customs_tax_lines c LEFT JOIN purchasing.import_declarations d ON d.id = c.declaration_id
      WHERE c.payment_id = ${id} ORDER BY c.line_no`);
    const manage = granted.has(financePermissions.managePayments);
    const editable = ["draft", "rejected", "withdrawn"].includes(row.status);
    let canWithdraw = false;
    if (row.status === "pending" && row.created_by === actor.userId && row.approval_request_id) {
      const step = await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NULL`);
      canWithdraw = step.rows.length > 0;
    }
    return {
      id: row.id,
      documentNo: row.document_no,
      kind: row.kind,
      partner: row.partner_id ? { id: row.partner_id, code: row.partner_code!, name: row.partner_name! } : null,
      fund: { id: row.fund_id, code: row.fund_code, name: row.fund_name },
      paymentDate: day(row.payment_date),
      amount: trimDecimal(row.amount),
      currency: await companyCurrency(this.database, actor.companyId),
      note: row.note,
      status: row.status,
      approvalRequestId: row.approval_request_id,
      postError: row.status === "rejected" ? row.post_error : null,
      lines: lines.rows.map((line) => ({
        id: line.id,
        documentNo: line.document_no,
        sourceType: line.source_type,
        documentDate: day(line.document_date),
        dueDate: day(line.due_date),
        amount: trimDecimal(line.amount),
        openAmount: trimDecimal(line.open_amount),
        overdueDays: Number(line.open_amount) > 0 ? Math.max(0, daysBetween(line.due_date, today)) : 0,
        allocated: trimDecimal(line.allocated),
        allocatedForeign: line.allocated_foreign === null ? null : trimDecimal(line.allocated_foreign),
        foreign: line.currency
          ? { currency: line.currency, amount: trimDecimal(line.foreign_amount!), openAmount: trimDecimal(line.open_foreign_amount ?? "0"), bookRate: trimDecimal(line.book_rate ?? "0") }
          : null,
      })),
      unallocated: trimDecimal(unallocated),
      foreign: row.currency
        ? {
            currency: row.currency,
            amount: trimDecimal(row.foreign_amount!),
            exchangeRate: row.exchange_rate === null ? null : trimDecimal(row.exchange_rate),
            exchangeDifference: row.exchange_difference === null ? null : trimDecimal(row.exchange_difference),
            counterFund: row.counter_fund_id ? { id: row.counter_fund_id, code: row.counter_fund_code!, name: row.counter_fund_name! } : null,
          }
        : null,
      referenceNo: row.reference_no,
      customsLines: customsLines.rows.map((line) => ({
        lineKind: line.line_kind,
        declarationId: line.declaration_id,
        declarationNo: line.declaration_no ?? "",
        taxType: line.tax_type,
        amount: trimDecimal(line.amount),
        overdueDays: line.overdue_days,
        computedAmount: line.computed_amount === null ? null : trimDecimal(line.computed_amount),
        edited: line.computed_amount !== null && Number(line.computed_amount) !== Number(line.amount),
      })),
      createdByName: row.created_by_name,
      postedAt: row.posted_at,
      version: row.version,
      canEdit: manage && editable,
      canSubmit: manage && editable,
      canWithdraw,
    };
  }

  // Kiểm đối tác đúng phía, quỹ đang dùng, chứng từ trừ là khoản tăng còn nợ của đối tác, tổng trừ không vượt số tiền; hoàn tiền không vượt trả trước.
  // Phiếu chi trả nợ ngoại tệ kiểm theo QUYTAC_NGHIEPVU_410 (CONG_VIEC_56).
  private async validate(executor: Executor, companyId: string, input: Input): Promise<Prepared> {
    const side = paymentKindSide[input.kind];
    await this.debts.requirePartnerOnSide(executor, companyId, side, input.partnerId, "partnerId");
    const base = await companyCurrency(executor, companyId);
    if (input.currency && input.currency !== base) {
      if (input.kind !== "supplier_payment") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "invalidValue" } });
      const computed = await this.computeFx(executor, companyId, input);
      return {
        lines: computed.lines.map((line) => ({ debitItemId: line.debitItemId, amount: line.bookAmount, foreignAmount: line.foreignAmount })),
        amount: computed.fundValue,
        foreign: { currency: computed.currency, amount: computed.foreignTotal.toFixed(4), exchangeRate: computed.exchangeRate },
      };
    }
    const fields: FieldErrors = {};
    // Số tiền không lẻ hơn đơn vị nhỏ nhất của tiền tệ công ty (THAY_DOI_10).
    const units = await this.companyUnits(executor, companyId);
    if (!input.amount) fields.amount = "required";
    else if (fraction(input.amount) > units) fields.amount = "invalidValue";
    for (const [index, line] of input.lines.entries()) {
      if (!line.amount) fields[`lines.${index}.amount`] = "required";
      else if (fraction(line.amount) > units) fields[`lines.${index}.amount`] = "invalidValue";
    }
    const fund = (await executor.execute<{ status: string; currency: string | null }>(sql`SELECT status, currency FROM finance.funds WHERE id = ${input.fundId} AND company_id = ${companyId}`))
      .rows[0];
    if (!fund) fields.fundId = "invalidValue";
    else if (fund.status !== "active") fields.fundId = "fundInactive";
    // Quỹ ngoại tệ chỉ dùng cho phiếu chi trả nợ ngoại tệ cùng tiền tệ, phiếu mua ngoại tệ (QUYTAC_NGHIEPVU_406).
    else if (fund.currency) fields.fundId = "fundCurrencyMismatch";
    const lines = paymentKindSettles(input.kind) ? input.lines : [];
    const seen = new Set<string>();
    let total = 0;
    for (const [index, line] of lines.entries()) {
      const item = (
        await executor.execute<{ open_amount: string; currency: string | null }>(sql`
        SELECT open_amount::text, currency FROM finance.debt_items
        WHERE id = ${line.debitItemId} AND company_id = ${companyId} AND side = ${side} AND partner_id = ${input.partnerId} AND direction = 'debit'`)
      ).rows[0];
      if (!item || seen.has(line.debitItemId)) fields[`lines.${index}.debitItemId`] = "invalidValue";
      // Khoản nợ có ngoại tệ chỉ trả bằng phiếu chi ngoại tệ (QUYTAC_NGHIEPVU_409).
      else if (item.currency) fields[`lines.${index}.debitItemId`] = "foreignDebtRequiresForeignPayment";
      else if (Number(line.amount) > Number(item.open_amount) + 0.00005) fields[`lines.${index}.amount`] = "debtAllocationExceeded";
      seen.add(line.debitItemId);
      total += Number(line.amount ?? 0);
    }
    if (total > Number(input.amount ?? 0) + 0.00005) fields.amount = "paymentAllocationExceeded";
    if (!paymentKindSettles(input.kind) && input.amount) {
      const advance = (await this.debts.openDebtsOf(executor, companyId, side, input.partnerId)).advance;
      if (Number(input.amount) > Number(advance) + 0.00005) fields.amount = "refundExceedsAdvance";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return { lines: lines.map((line) => ({ debitItemId: line.debitItemId, amount: line.amount!, foreignAmount: null })), amount: input.amount!, foreign: null };
  }

  private async companyUnits(executor: Executor, companyId: string): Promise<number> {
    return Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${companyId}) AS units`)).rows[0]!.units);
  }

  // Phiếu chi trả nợ ngoại tệ (QUYTAC_NGHIEPVU_407, 410, 411): giảm nợ từng dòng theo tỷ giá đích danh (trả hết thì bằng số còn nợ);
  // quỹ ngoại tệ: giá trị ra theo bình quân gia quyền di động (chi hết thì bằng giá trị còn lại); quỹ tiền tệ công ty: tiền chi theo tỷ giá ngân hàng bán.
  // Dùng khi lưu (ước tính), xem trước và khi ghi sổ (quỹ, công nợ đã khóa).
  private async computeFx(executor: Executor, companyId: string, input: Input, posting = false): Promise<FxComputation> {
    const currency = input.currency!;
    const fields: FieldErrors = {};
    const units = await this.companyUnits(executor, companyId);
    const currencyRow = (await executor.execute<{ minor_units: number }>(sql`SELECT minor_units FROM core.currencies WHERE code = ${currency} AND is_active`)).rows[0];
    if (!currencyRow) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "invalidValue" } });
    const foreignUnits = Number(currencyRow.minor_units);
    const roundBase = (value: number) => (Math.round(value * 10 ** units) / 10 ** units).toFixed(4);
    if (input.lines.length === 0) fields.lines = "required";
    const seen = new Set<string>();
    const lines: FxComputation["lines"] = [];
    let foreignTotal = 0;
    let bookTotal = 0;
    for (const [index, line] of input.lines.entries()) {
      if (!line.foreignAmount) {
        fields[`lines.${index}.foreignAmount`] = "required";
        continue;
      }
      if (fraction(line.foreignAmount) > foreignUnits) fields[`lines.${index}.foreignAmount`] = "invalidValue";
      const item = (
        await executor.execute<{ open_amount: string; open_foreign_amount: string | null; book_rate: string | null; currency: string | null }>(sql`
        SELECT open_amount::text, open_foreign_amount::text, book_rate::text, currency FROM finance.debt_items
        WHERE id = ${line.debitItemId} AND company_id = ${companyId} AND side = 'payable' AND partner_id = ${input.partnerId} AND direction = 'debit'`)
      ).rows[0];
      if (!item || seen.has(line.debitItemId) || item.currency !== currency || item.open_foreign_amount === null) {
        fields[`lines.${index}.debitItemId`] = "invalidValue";
        continue;
      }
      seen.add(line.debitItemId);
      const foreign = Number(line.foreignAmount);
      const open = Number(item.open_foreign_amount);
      if (foreign > open + 0.00005) {
        if (posting) throw new ApiError("BUSINESS_RULE", "debtAllocationExceeded");
        fields[`lines.${index}.foreignAmount`] = "debtAllocationExceeded";
        continue;
      }
      const bookAmount = Math.abs(foreign - open) < 0.00005 ? Number(item.open_amount).toFixed(4) : roundBase(foreign * Number(item.book_rate));
      lines.push({ debitItemId: line.debitItemId, foreignAmount: line.foreignAmount, bookRate: trimDecimal(item.book_rate!), bookAmount });
      foreignTotal += foreign;
      bookTotal += Number(bookAmount);
    }
    const fund = (
      await executor.execute<{ status: string; currency: string | null; balance: string; foreign_balance: string | null }>(sql`
      SELECT status, currency, ${fundBalance(sql`f.id`)}::text AS balance, ${fundForeignBalance(sql`f.id`)}::text AS foreign_balance FROM finance.funds f
      WHERE f.id = ${input.fundId} AND f.company_id = ${companyId}`)
    ).rows[0];
    let fundValue = "0";
    let fundRate: string | null = null;
    let exchangeRate: string | null = null;
    if (!fund) fields.fundId = "invalidValue";
    else if (fund.status !== "active") fields.fundId = "fundInactive";
    else if (fund.currency && fund.currency !== currency) fields.fundId = "fundCurrencyMismatch";
    else if (fund.currency) {
      const balance = Number(fund.foreign_balance);
      fundRate = averageRate(fund.balance, fund.foreign_balance!);
      if (foreignTotal > balance + 0.00005) {
        if (posting) throw new ApiError("BUSINESS_RULE", "insufficientFundBalance");
        fields.fundId = "insufficientFundBalance";
      }
      fundValue = Math.abs(foreignTotal - balance) < 0.00005 ? Number(fund.balance).toFixed(4) : balance > 0 ? roundBase((Number(fund.balance) * foreignTotal) / balance) : "0";
    } else {
      if (!input.exchangeRate) fields.exchangeRate = "required";
      else {
        exchangeRate = input.exchangeRate;
        if (input.amount) {
          if (fraction(input.amount) > units) fields.amount = "invalidValue";
          fundValue = Number(input.amount).toFixed(4);
        } else fundValue = roundBase(foreignTotal * Number(input.exchangeRate));
      }
    }
    if (Object.keys(fields).length > 0) {
      if (posting) throw new ApiError("BUSINESS_RULE", fields.fundId ? "fundInactive" : "debtAllocationExceeded");
      throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    }
    return {
      currency,
      foreignTotal,
      lines,
      bookTotal: bookTotal.toFixed(4),
      fundValue,
      fundRate,
      exchangeDifference: (bookTotal - Number(fundValue)).toFixed(4),
      exchangeRate,
    };
  }

  async fxPreview(actor: Actor, input: Input): Promise<PaymentFxPreviewResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    if (input.kind !== "supplier_payment" || !input.currency) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { currency: "required" } });
    const computed = await this.computeFx(this.database, actor.companyId, input);
    return {
      currency: computed.currency,
      foreignTotal: trimDecimal(computed.foreignTotal.toFixed(4)),
      lines: computed.lines.map((line) => ({ ...line, bookAmount: trimDecimal(line.bookAmount) })),
      bookTotal: trimDecimal(computed.bookTotal),
      fundValue: trimDecimal(computed.fundValue),
      fundRate: computed.fundRate,
      exchangeDifference: trimDecimal(computed.exchangeDifference),
    };
  }

  private async writeLines(executor: Executor, paymentId: string, lines: Prepared["lines"]): Promise<void> {
    await executor.execute(sql`DELETE FROM finance.payment_lines WHERE payment_id = ${paymentId}`);
    for (const line of lines) {
      await executor.execute(sql`
        INSERT INTO finance.payment_lines (payment_id, debit_item_id, amount, foreign_amount) VALUES (${paymentId}, ${line.debitItemId}, ${line.amount}::numeric, ${line.foreignAmount}::numeric)`);
    }
  }

  async create(actor: Actor, input: Input): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const id = await this.database.transaction(async (transaction) => {
      const prepared = await this.validate(transaction, actor.companyId, input);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.payments (company_id, kind, partner_id, fund_id, payment_date, amount, note, created_by, currency, foreign_amount, exchange_rate)
        VALUES (${actor.companyId}, ${input.kind}, ${input.partnerId}, ${input.fundId}, ${input.paymentDate}::date, ${prepared.amount}::numeric, ${input.note}, ${actor.userId},
          ${prepared.foreign?.currency ?? null}, ${prepared.foreign?.amount ?? null}::numeric, ${prepared.foreign?.exchangeRate ?? null}::numeric)
        RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, created, prepared.lines);
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    await this.database.transaction(async (transaction) => {
      const before = await this.lockEditable(transaction, actor.companyId, id, input.version);
      // Phiếu nợ nội bộ điểm lập từ bảng đối soát điểm nội bộ, không sửa ở đây (CONG_VIEC_60).
      if (isLoyaltySettlementPaymentKind(before.kind)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      if (before.kind === "currency_purchase" || before.kind === "customs_tax_payment" || before.kind === "customs_tax_refund") {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { kind: "invalidValue" } });
      }
      // Đã cấp số thì không đổi giữa phiếu thu và phiếu chi (hai dãy số khác nhau).
      if (before.document_no && documentTypeOf(before.kind) !== documentTypeOf(input.kind)) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { kind: "invalidValue" } });
      }
      const prepared = await this.validate(transaction, actor.companyId, input);
      await transaction.execute(sql`
        UPDATE finance.payments SET kind = ${input.kind}, partner_id = ${input.partnerId}, fund_id = ${input.fundId}, payment_date = ${input.paymentDate}::date, amount = ${prepared.amount}::numeric,
          note = ${input.note}, currency = ${prepared.foreign?.currency ?? null}, foreign_amount = ${prepared.foreign?.amount ?? null}::numeric,
          exchange_rate = ${prepared.foreign?.exchangeRate ?? null}::numeric, status = 'draft', post_error = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeLines(transaction, id, prepared.lines);
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  private async lockEditable(transaction: Executor, companyId: string, id: string, version: number | undefined): Promise<PaymentRow> {
    const before = await this.single(transaction, companyId, id);
    const locked = await transaction.execute(sql`
      SELECT 1 FROM finance.payments WHERE id = ${id} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version ?? 0} FOR UPDATE`);
    if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    return before;
  }

  // Phiếu mua ngoại tệ (QUYTAC_NGHIEPVU_408; API_214): quỹ chi tiền tệ công ty, quỹ nhận ngoại tệ; số tiền chi mặc định bằng ngoại tệ nhân tỷ giá.
  async saveCurrencyPurchase(actor: Actor, id: string | null, input: CurrencyPurchaseInput): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const savedId = await this.database.transaction(async (transaction) => {
      const before = id ? await this.lockEditable(transaction, actor.companyId, id, input.version) : null;
      if (before && before.kind !== "currency_purchase") throw new ApiError("NOT_FOUND", "notFound");
      const fields: FieldErrors = {};
      const units = await this.companyUnits(transaction, actor.companyId);
      const funds = await transaction.execute<{ id: string; status: string; currency: string | null; minor_units: number | null }>(sql`
        SELECT f.id, f.status, f.currency, c.minor_units FROM finance.funds f LEFT JOIN core.currencies c ON c.code = f.currency
        WHERE f.company_id = ${actor.companyId} AND f.id IN (${input.fundId}, ${input.counterFundId})`);
      const source = funds.rows.find((fund) => fund.id === input.fundId);
      const target = funds.rows.find((fund) => fund.id === input.counterFundId);
      if (!source || source.currency) fields.fundId = source ? "fundCurrencyMismatch" : "invalidValue";
      else if (source.status !== "active") fields.fundId = "fundInactive";
      if (!target || !target.currency) fields.counterFundId = target ? "fundCurrencyMismatch" : "invalidValue";
      else if (target.status !== "active") fields.counterFundId = "fundInactive";
      else if (fraction(input.foreignAmount) > Number(target.minor_units)) fields.foreignAmount = "invalidValue";
      if (input.amount && fraction(input.amount) > units) fields.amount = "invalidValue";
      if (Number(input.exchangeRate) <= 0) fields.exchangeRate = "invalidValue";
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const amount =
        input.amount ?? (await transaction.execute<{ value: string }>(sql`SELECT round(${input.foreignAmount}::numeric * ${input.exchangeRate}::numeric, ${units})::text AS value`)).rows[0]!.value;
      if (Number(amount) <= 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { amount: "invalidValue" } });
      if (before) {
        await transaction.execute(sql`
          UPDATE finance.payments SET fund_id = ${input.fundId}, counter_fund_id = ${input.counterFundId}, payment_date = ${input.paymentDate}::date, amount = ${amount}::numeric,
            currency = ${target!.currency}, foreign_amount = ${input.foreignAmount}::numeric, exchange_rate = ${input.exchangeRate}::numeric, note = ${input.note},
            status = 'draft', post_error = NULL, updated_at = now(), version = version + 1
          WHERE id = ${before.id}`);
        await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.update", entityId: before.id, beforeData: before, afterData: input }, transaction);
        return before.id;
      }
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.payments (company_id, kind, partner_id, fund_id, counter_fund_id, payment_date, amount, currency, foreign_amount, exchange_rate, note, created_by)
        VALUES (${actor.companyId}, 'currency_purchase', NULL, ${input.fundId}, ${input.counterFundId}, ${input.paymentDate}::date, ${amount}::numeric, ${target!.currency},
          ${input.foreignAmount}::numeric, ${input.exchangeRate}::numeric, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, savedId);
  }

  // Gửi: phiếu thu ghi sổ ngay; phiếu chi đi luồng duyệt, chưa có chính sách thì ghi sổ ngay (QUYTAC_NGHIEPVU_89).
  async submit(actor: Actor, id: string, version: number): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const current = await this.single(this.database, actor.companyId, id);
    if (!["draft", "rejected", "withdrawn"].includes(current.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    const typeCode = documentTypeOf(current.kind);
    const sequence = sequenceOf(current.kind);
    await ensureSequence(this.database, this.sequences, actor, sequence.type, sequence.prefix);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM finance.payments WHERE id = ${id} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const documentNo = current.document_no ?? (await this.sequences.next(actor.companyId, sequence.type, transaction));
      let requestId: string | null = null;
      if (typeCode === paymentType) {
        try {
          requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
            documentTypeCode: paymentType,
            documentId: id,
            documentNo,
            amount: current.amount,
            currency: await companyCurrency(transaction, actor.companyId),
            documentDate: day(current.payment_date),
          });
        } catch (error) {
          if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
        }
      }
      await transaction.execute(sql`
        UPDATE finance.payments SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, post_error = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!requestId) await this.post(transaction, id);
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } }, transaction);
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const row = await this.single(this.database, actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE finance.payments SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Ghi sổ: khóa công nợ của đối tác và quỹ, kiểm lại, tạo khoản công nợ, trừ nợ, đánh dấu đã ghi sổ (QUYTAC_NGHIEPVU_87, 88).
  // Chứng từ quỹ bán lẻ (THAY_DOI_24; CONG_VIEC_53 QUYTAC_NGHIEPVU_375): hệ thống lập khi đóng ca thu ngân, không đối tượng, không trừ nợ, ghi sổ ngay không qua duyệt.
  // Dãy số phiếu thu, phiếu chi tạo trước giao dịch bằng prepareRetailNumbering.
  async prepareRetailNumbering(actor: Actor): Promise<void> {
    await ensureSequence(this.database, this.sequences, actor, receiptType, "PT");
    await ensureSequence(this.database, this.sequences, actor, paymentType, "PC");
  }

  async recordRetailWithin(
    transaction: Executor & Pick<Database, "insert">,
    actor: Actor,
    input: { kind: RetailFundDocumentKind; fundId: string; paymentDate: string; amount: string; note: string; sourceType: string; sourceId: string; staffUserId: string | null },
  ): Promise<string> {
    const documentNo = await this.sequences.next(actor.companyId, documentTypeOf(input.kind), transaction);
    const id = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO finance.payments (company_id, document_no, kind, partner_id, fund_id, payment_date, amount, note, status, posted_at, created_by, source_type, source_id, staff_user_id)
      VALUES (${actor.companyId}, ${documentNo}, ${input.kind}, NULL, ${input.fundId}, ${input.paymentDate}::date, ${input.amount}::numeric, ${input.note}, 'posted', now(), ${actor.userId},
        ${input.sourceType}, ${input.sourceId}, ${input.staffUserId})
      RETURNING id`)
    ).rows[0]!.id;
    for (const hook of this.postedHooks) await hook(transaction, id);
    await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.retail_record", entityId: id, afterData: { documentNo, ...input } }, transaction);
    return id;
  }

  private async post(transaction: Executor, id: string): Promise<void> {
    const payment = (
      await transaction.execute<{
        company_id: string;
        kind: PaymentKind | "currency_purchase" | "customs_tax_payment" | "customs_tax_refund";
        partner_id: string;
        fund_id: string;
        counter_fund_id: string | null;
        document_no: string;
        payment_date: string;
        amount: string;
        note: string | null;
        currency: string | null;
        exchange_rate: string | null;
      }>(sql`
      SELECT company_id, kind, partner_id, fund_id, counter_fund_id, document_no, payment_date::text, amount::text, note, currency, exchange_rate::text
      FROM finance.payments WHERE id = ${id} AND status = 'pending' FOR UPDATE`)
    ).rows[0];
    if (!payment) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (isLoyaltySettlementPaymentKind(payment.kind)) {
      await this.postLoyaltySettlementPayment(transaction, id);
      return;
    }
    if (payment.kind === "currency_purchase") return this.postCurrencyPurchase(transaction, id, payment.fund_id, payment.counter_fund_id!, payment.amount);
    // Phiếu nộp, nhận hoàn thuế hải quan: kiểm lại số dư thuế, quỹ rồi ghi sổ; không có công nợ (QUYTAC_NGHIEPVU_416).
    if (payment.kind === "customs_tax_payment" || payment.kind === "customs_tax_refund") {
      await checkCustomsOnPost(transaction, id);
      await transaction.execute(sql`UPDATE finance.payments SET status = 'posted', posted_at = now(), post_error = NULL, updated_at = now() WHERE id = ${id}`);
      for (const hook of this.postedHooks) await hook(transaction, id);
      return;
    }
    if (payment.currency) return this.postForeignPayment(transaction, id, { ...payment, kind: payment.kind });
    const side = paymentKindSide[payment.kind];
    await this.debts.lockPartner(transaction, payment.company_id, side, payment.partner_id);
    // Khóa quỹ trước, tính số dư bằng câu lệnh sau để thấy phiếu giao dịch khác vừa ghi sổ (READ COMMITTED lấy ảnh chụp theo từng câu lệnh).
    const fundStatus = (await transaction.execute<{ status: string }>(sql`SELECT status FROM finance.funds WHERE id = ${payment.fund_id} FOR UPDATE`)).rows[0]!.status;
    const fund = { status: fundStatus, balance: (await transaction.execute<{ balance: string }>(sql`SELECT ${fundBalance(payment.fund_id)}::text AS balance`)).rows[0]!.balance };
    if (fund.status !== "active") throw new ApiError("BUSINESS_RULE", "fundInactive");
    if (!paymentKindIsReceipt(payment.kind) && Number(payment.amount) > Number(fund.balance) + 0.00005) throw new ApiError("BUSINESS_RULE", "insufficientFundBalance");
    if (paymentKindSettles(payment.kind)) {
      const lines = await transaction.execute<{ debit_item_id: string; amount: string; open_amount: string }>(sql`
        SELECT l.debit_item_id, l.amount::text, d.open_amount::text FROM finance.payment_lines l JOIN finance.debt_items d ON d.id = l.debit_item_id
        WHERE l.payment_id = ${id} ORDER BY d.due_date, d.document_date, d.created_at`);
      if (lines.rows.some((line) => Number(line.amount) > Number(line.open_amount) + 0.00005)) throw new ApiError("BUSINESS_RULE", "debtAllocationExceeded");
      const itemId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, amount, open_amount, note)
        VALUES (${payment.company_id}, ${payment.partner_id}, ${side}, 'credit', 'payment', ${id}, ${payment.document_no}, ${payment.payment_date}::date, ${payment.amount}::numeric,
          ${payment.amount}::numeric, ${payment.note})
        RETURNING id`)
      ).rows[0]!.id;
      // Không chọn chứng từ: trừ các khoản cũ nhất trước; có chọn: trừ đúng chứng từ, phần thừa là trả trước.
      await this.debts.matchCredit(
        transaction,
        itemId,
        lines.rows.map((line) => ({ debitItemId: line.debit_item_id, amount: line.amount })),
        lines.rows.length === 0,
      );
    } else {
      const advance = (await this.debts.openDebtsOf(transaction, payment.company_id, side, payment.partner_id)).advance;
      if (Number(payment.amount) > Number(advance) + 0.00005) throw new ApiError("BUSINESS_RULE", "refundExceedsAdvance");
      const itemId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, due_date, amount, open_amount, note)
        VALUES (${payment.company_id}, ${payment.partner_id}, ${side}, 'debit', 'payment', ${id}, ${payment.document_no}, ${payment.payment_date}::date, ${payment.payment_date}::date,
          ${payment.amount}::numeric, ${payment.amount}::numeric, ${payment.note})
        RETURNING id`)
      ).rows[0]!.id;
      await this.debts.matchDebit(transaction, itemId);
    }
    await transaction.execute(sql`UPDATE finance.payments SET status = 'posted', posted_at = now(), post_error = NULL, updated_at = now() WHERE id = ${id}`);
    for (const hook of this.postedHooks) await hook(transaction, id);
  }

  // CONG_VIEC_60 (QUYTAC_NGHIEPVU_473): phiếu nợ nội bộ điểm không trừ công nợ; kiểm số dư quỹ (phiếu chi) và số còn lại của bảng đối soát.
  private async postLoyaltySettlementPayment(transaction: Executor, id: string): Promise<void> {
    const payment = (
      await transaction.execute<{ company_id: string; kind: "loyalty_intercompany_receipt" | "loyalty_intercompany_payment"; fund_id: string; amount: string; loyalty_settlement_id: string }>(sql`
      SELECT company_id, kind, fund_id, amount::text, loyalty_settlement_id FROM finance.payments WHERE id = ${id}`)
    ).rows[0]!;
    await assertSettlementPayment(transaction, {
      settlementId: payment.loyalty_settlement_id,
      companyId: payment.company_id,
      kind: payment.kind,
      amount: Number(payment.amount),
      paymentId: id,
      lock: true,
    });
    const fundStatus = (await transaction.execute<{ status: string }>(sql`SELECT status FROM finance.funds WHERE id = ${payment.fund_id} FOR UPDATE`)).rows[0]!.status;
    if (fundStatus !== "active") throw new ApiError("BUSINESS_RULE", "fundInactive");
    if (payment.kind === "loyalty_intercompany_payment") {
      const balance = (await transaction.execute<{ balance: string }>(sql`SELECT ${fundBalance(payment.fund_id)}::text AS balance`)).rows[0]!.balance;
      if (Number(payment.amount) > Number(balance) + 0.00005) throw new ApiError("BUSINESS_RULE", "insufficientFundBalance");
    }
    await transaction.execute(sql`UPDATE finance.payments SET status = 'posted', posted_at = now(), post_error = NULL, updated_at = now() WHERE id = ${id}`);
    for (const hook of this.postedHooks) await hook(transaction, id);
    await refreshSettlementPaid(transaction, id);
  }

  // Phiếu ngoại tệ có ngày không sau ngày đánh giá lại đã ghi sổ thì không ghi sổ được (QUYTAC_NGHIEPVU_411).
  private async requireAfterRevaluation(transaction: Executor, id: string): Promise<void> {
    const before = await transaction.execute(sql`
      SELECT 1 FROM finance.payments p JOIN finance.fx_revaluations r ON r.company_id = p.company_id AND r.status = 'posted' AND r.revaluation_date >= p.payment_date
      WHERE p.id = ${id} LIMIT 1`);
    if (before.rows.length > 0) throw new ApiError("BUSINESS_RULE", "paymentBeforeRevaluation");
  }

  // Ghi sổ phiếu mua ngoại tệ (QUYTAC_NGHIEPVU_408): khóa hai quỹ theo thứ tự mã để tránh khóa chéo; quỹ chi đủ số dư; quỹ nhận đang dùng.
  private async postCurrencyPurchase(transaction: Executor, id: string, fundId: string, counterFundId: string, amount: string): Promise<void> {
    await this.requireAfterRevaluation(transaction, id);
    const funds = await transaction.execute<{ id: string; status: string }>(sql`SELECT id, status FROM finance.funds WHERE id IN (${fundId}, ${counterFundId}) ORDER BY id FOR UPDATE`);
    if (funds.rows.some((fund) => fund.status !== "active")) throw new ApiError("BUSINESS_RULE", "fundInactive");
    const balance = (await transaction.execute<{ balance: string }>(sql`SELECT ${fundBalance(fundId)}::text AS balance`)).rows[0]!.balance;
    if (Number(amount) > Number(balance) + 0.00005) throw new ApiError("BUSINESS_RULE", "insufficientFundBalance");
    await transaction.execute(sql`UPDATE finance.payments SET status = 'posted', posted_at = now(), post_error = NULL, updated_at = now() WHERE id = ${id}`);
    for (const hook of this.postedHooks) await hook(transaction, id);
  }

  // Ghi sổ phiếu chi trả nợ ngoại tệ (QUYTAC_NGHIEPVU_409 đến 411): tính lại theo số dư quỹ, số còn nợ lúc ghi sổ; khoản giảm nợ theo tỷ giá đích danh,
  // trừ đúng từng khoản nợ và số ngoại tệ còn nợ; số tiền phiếu là giá trị ra khỏi quỹ; chênh lệch tỷ giá lưu trên phiếu để sinh bút toán.
  private async postForeignPayment(
    transaction: Executor,
    id: string,
    payment: {
      company_id: string;
      kind: PaymentKind;
      partner_id: string;
      fund_id: string;
      document_no: string;
      payment_date: string;
      amount: string;
      note: string | null;
      currency: string | null;
      exchange_rate: string | null;
    },
  ): Promise<void> {
    await this.requireAfterRevaluation(transaction, id);
    await this.debts.lockPartner(transaction, payment.company_id, "payable", payment.partner_id);
    await transaction.execute(sql`SELECT 1 FROM finance.funds WHERE id = ${payment.fund_id} FOR UPDATE`);
    const lines = await transaction.execute<{ debit_item_id: string; foreign_amount: string }>(sql`
      SELECT l.debit_item_id, l.foreign_amount::text FROM finance.payment_lines l JOIN finance.debt_items d ON d.id = l.debit_item_id
      WHERE l.payment_id = ${id} ORDER BY d.due_date, d.document_date, d.created_at`);
    const computed = await this.computeFx(
      transaction,
      payment.company_id,
      {
        kind: payment.kind,
        partnerId: payment.partner_id,
        fundId: payment.fund_id,
        paymentDate: payment.payment_date,
        amount: payment.exchange_rate ? payment.amount : undefined,
        note: payment.note,
        currency: payment.currency,
        exchangeRate: payment.exchange_rate,
        lines: lines.rows.map((line) => ({ debitItemId: line.debit_item_id, foreignAmount: line.foreign_amount })),
      },
      true,
    );
    const balance = (await transaction.execute<{ balance: string }>(sql`SELECT ${fundBalance(payment.fund_id)}::text AS balance`)).rows[0]!.balance;
    if (Number(computed.fundValue) > Number(balance) + 0.00005) throw new ApiError("BUSINESS_RULE", "insufficientFundBalance");
    const creditId = (
      await transaction.execute<{ id: string }>(sql`
      INSERT INTO finance.debt_items (company_id, partner_id, side, direction, source_type, source_id, document_no, document_date, amount, open_amount, note, currency, foreign_amount, exchange_rate)
      VALUES (${payment.company_id}, ${payment.partner_id}, 'payable', 'credit', 'payment', ${id}, ${payment.document_no}, ${payment.payment_date}::date, ${computed.bookTotal}::numeric,
        ${computed.bookTotal}::numeric, ${payment.note}, ${computed.currency}, ${computed.foreignTotal.toFixed(4)}::numeric, round(${computed.bookTotal}::numeric / ${computed.foreignTotal.toFixed(4)}::numeric, 8))
      RETURNING id`)
    ).rows[0]!.id;
    for (const line of computed.lines) {
      await this.debts.allocate(transaction, line.debitItemId, creditId, line.bookAmount);
      await transaction.execute(sql`
        UPDATE finance.debt_items SET open_foreign_amount = CASE WHEN open_amount = 0 THEN 0 ELSE greatest(open_foreign_amount - ${line.foreignAmount}::numeric, 0) END
        WHERE id = ${line.debitItemId}`);
      await transaction.execute(sql`UPDATE finance.payment_lines SET amount = ${line.bookAmount}::numeric WHERE payment_id = ${id} AND debit_item_id = ${line.debitItemId}`);
    }
    await transaction.execute(sql`
      UPDATE finance.payments SET amount = ${computed.fundValue}::numeric, exchange_difference = ${computed.exchangeDifference}::numeric,
        status = 'posted', posted_at = now(), post_error = NULL, updated_at = now()
      WHERE id = ${id}`);
    for (const hook of this.postedHooks) await hook(transaction, id);
  }
}
