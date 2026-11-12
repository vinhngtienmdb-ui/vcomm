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
  type paymentListQuerySchema,
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
import { fundBalance } from "./funds.service";
import { assertSettlementPayment, isLoyaltySettlementPaymentKind, refreshSettlementPaid } from "../loyalty/settlement-payments";

type Input = z.output<typeof savePaymentSchema>;
type FieldErrors = Record<string, keyof Messages["errors"]>;
const receiptType = "finance.receipt";
const paymentType = "finance.payment";
const documentTypeOf = (kind: AnyPaymentKind) => (paymentKindIsReceipt(kind) ? receiptType : paymentType);
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
    const funds = await this.database.execute<{ id: string; code: string; name: string; kind: "cash" | "bank"; balance: string }>(sql`
      SELECT f.id, f.code, f.name, f.kind, ${fundBalance(sql`f.id`)}::text AS balance FROM finance.funds f
      WHERE f.company_id = ${actor.companyId} AND f.status = 'active' ORDER BY f.code`);
    return { funds: funds.rows.map((fund) => ({ ...fund, balance: trimDecimal(fund.balance) })), currency: await companyCurrency(this.database, actor.companyId) };
  }

  private select() {
    return sql`
      SELECT p.id, p.company_id, p.document_no, p.kind, p.partner_id, pr.code AS partner_code, pr.name AS partner_name, p.fund_id, f.code AS fund_code, f.name AS fund_name,
        p.payment_date::text, p.amount::text, p.note, p.status, p.approval_request_id, p.post_error, p.posted_at::text, p.created_by, u.full_name AS created_by_name, p.version
      FROM finance.payments p LEFT JOIN crm.partners pr ON pr.id = p.partner_id JOIN finance.funds f ON f.id = p.fund_id JOIN core.users u ON u.id = p.created_by`;
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
    }>(
      posted
        ? sql`
          SELECT d.id, d.document_no, d.source_type, d.document_date::text, d.due_date::text, d.amount::text, d.open_amount::text, a.amount::text AS allocated
          FROM finance.debt_items c JOIN finance.debt_allocations a ON a.credit_item_id = c.id JOIN finance.debt_items d ON d.id = a.debit_item_id
          WHERE c.source_type = 'payment' AND c.source_id = ${id} ORDER BY d.due_date, d.document_date`
        : sql`
          SELECT d.id, d.document_no, d.source_type, d.document_date::text, d.due_date::text, d.amount::text, d.open_amount::text, l.amount::text AS allocated
          FROM finance.payment_lines l JOIN finance.debt_items d ON d.id = l.debit_item_id
          WHERE l.payment_id = ${id} ORDER BY d.due_date, d.document_date`,
    );
    const allocatedTotal = lines.rows.reduce((total, line) => total + Number(line.allocated), 0);
    const unallocated = paymentKindSettles(row.kind)
      ? posted
        ? ((await this.database.execute<{ open_amount: string }>(sql`SELECT open_amount::text FROM finance.debt_items WHERE source_type = 'payment' AND source_id = ${id}`)).rows[0]?.open_amount ??
          "0")
        : Math.max(0, Number(row.amount) - allocatedTotal).toFixed(4)
      : "0";
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
      })),
      unallocated: trimDecimal(unallocated),
      createdByName: row.created_by_name,
      postedAt: row.posted_at,
      version: row.version,
      canEdit: manage && editable,
      canSubmit: manage && editable,
      canWithdraw,
    };
  }

  // Kiểm đối tác đúng phía, quỹ đang dùng, chứng từ trừ là khoản tăng còn nợ của đối tác, tổng trừ không vượt số tiền; hoàn tiền không vượt trả trước.
  private async validate(executor: Executor, companyId: string, input: Input): Promise<Input["lines"]> {
    const side = paymentKindSide[input.kind];
    await this.debts.requirePartnerOnSide(executor, companyId, side, input.partnerId, "partnerId");
    const fields: FieldErrors = {};
    // Số tiền không lẻ hơn đơn vị nhỏ nhất của tiền tệ công ty (THAY_DOI_10).
    const units = Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${companyId}) AS units`)).rows[0]!.units);
    const fraction = (value: string) => (value.split(".")[1] ?? "").replace(/0+$/, "").length;
    if (fraction(input.amount) > units) fields.amount = "invalidValue";
    for (const [index, line] of input.lines.entries()) if (fraction(line.amount) > units) fields[`lines.${index}.amount`] = "invalidValue";
    const fund = (await executor.execute<{ status: string }>(sql`SELECT status FROM finance.funds WHERE id = ${input.fundId} AND company_id = ${companyId}`)).rows[0];
    if (!fund) fields.fundId = "invalidValue";
    else if (fund.status !== "active") fields.fundId = "fundInactive";
    const lines = paymentKindSettles(input.kind) ? input.lines : [];
    const seen = new Set<string>();
    let total = 0;
    for (const [index, line] of lines.entries()) {
      const item = (
        await executor.execute<{ open_amount: string }>(sql`
        SELECT open_amount::text FROM finance.debt_items
        WHERE id = ${line.debitItemId} AND company_id = ${companyId} AND side = ${side} AND partner_id = ${input.partnerId} AND direction = 'debit'`)
      ).rows[0];
      if (!item || seen.has(line.debitItemId)) fields[`lines.${index}.debitItemId`] = "invalidValue";
      else if (Number(line.amount) > Number(item.open_amount) + 0.00005) fields[`lines.${index}.amount`] = "debtAllocationExceeded";
      seen.add(line.debitItemId);
      total += Number(line.amount);
    }
    if (total > Number(input.amount) + 0.00005) fields.amount = "paymentAllocationExceeded";
    if (!paymentKindSettles(input.kind)) {
      const advance = (await this.debts.openDebtsOf(executor, companyId, side, input.partnerId)).advance;
      if (Number(input.amount) > Number(advance) + 0.00005) fields.amount = "refundExceedsAdvance";
    }
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return lines;
  }

  private async writeLines(executor: Executor, paymentId: string, lines: Input["lines"]): Promise<void> {
    await executor.execute(sql`DELETE FROM finance.payment_lines WHERE payment_id = ${paymentId}`);
    for (const line of lines) {
      await executor.execute(sql`INSERT INTO finance.payment_lines (payment_id, debit_item_id, amount) VALUES (${paymentId}, ${line.debitItemId}, ${line.amount}::numeric)`);
    }
  }

  async create(actor: Actor, input: Input): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const id = await this.database.transaction(async (transaction) => {
      const lines = await this.validate(transaction, actor.companyId, input);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.payments (company_id, kind, partner_id, fund_id, payment_date, amount, note, created_by)
        VALUES (${actor.companyId}, ${input.kind}, ${input.partnerId}, ${input.fundId}, ${input.paymentDate}::date, ${input.amount}::numeric, ${input.note}, ${actor.userId})
        RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, created, lines);
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    await this.database.transaction(async (transaction) => {
      const before = await this.single(transaction, actor.companyId, id);
      // Phiếu nợ nội bộ điểm lập từ bảng đối soát điểm nội bộ, không sửa ở đây (CONG_VIEC_60).
      if (isLoyaltySettlementPaymentKind(before.kind)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      const locked = await transaction.execute(sql`
        SELECT 1 FROM finance.payments WHERE id = ${id} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${input.version ?? 0} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      // Đã cấp số thì không đổi giữa phiếu thu và phiếu chi (hai dãy số khác nhau).
      if (before.document_no && documentTypeOf(before.kind) !== documentTypeOf(input.kind)) {
        throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { kind: "invalidValue" } });
      }
      const lines = await this.validate(transaction, actor.companyId, input);
      await transaction.execute(sql`
        UPDATE finance.payments SET kind = ${input.kind}, partner_id = ${input.partnerId}, fund_id = ${input.fundId}, payment_date = ${input.paymentDate}::date, amount = ${input.amount}::numeric,
          note = ${input.note}, status = 'draft', post_error = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeLines(transaction, id, lines);
      await this.auditService.record({ ...financeAudit(actor, "payment"), action: "payment.update", entityId: id, beforeData: before, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  // Gửi: phiếu thu ghi sổ ngay; phiếu chi đi luồng duyệt, chưa có chính sách thì ghi sổ ngay (QUYTAC_NGHIEPVU_89).
  async submit(actor: Actor, id: string, version: number): Promise<PaymentResponse> {
    await requireFinancePermission(this.permissionService, actor, financePermissions.managePayments);
    const current = await this.single(this.database, actor.companyId, id);
    if (!["draft", "rejected", "withdrawn"].includes(current.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    const typeCode = documentTypeOf(current.kind);
    await ensureSequence(this.database, this.sequences, actor, typeCode, typeCode === receiptType ? "PT" : "PC");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM finance.payments WHERE id = ${id} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const documentNo = current.document_no ?? (await this.sequences.next(actor.companyId, typeCode, transaction));
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
      await transaction.execute<{ company_id: string; kind: PaymentKind; partner_id: string; fund_id: string; document_no: string; payment_date: string; amount: string; note: string | null }>(sql`
      SELECT company_id, kind, partner_id, fund_id, document_no, payment_date::text, amount::text, note FROM finance.payments WHERE id = ${id} AND status = 'pending' FOR UPDATE`)
    ).rows[0];
    if (!payment) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (isLoyaltySettlementPaymentKind(payment.kind)) {
      await this.postLoyaltySettlementPayment(transaction, id);
      return;
    }
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
}
