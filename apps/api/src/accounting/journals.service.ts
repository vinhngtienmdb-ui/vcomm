// Bút toán, phiếu kế toán nhập tay, khóa sổ (CONG_VIEC_14; CHUC_NANG_72, 73; QUYTAC_NGHIEPVU_96, 97; API_88, API_89).
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { JournalListItem, JournalResponse, JournalSourceType, JournalStatus, LedgerPeriodsResponse, journalListQuerySchema, saveJournalSchema } from "contracts";
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
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { LedgerService, ledgerPermissions } from "./ledger.service";
import type { Executor } from "./postings";

const documentTypeCode = "accounting.journal";
type Input = z.output<typeof saveJournalSchema>;
type FieldErrors = Record<string, keyof Messages["errors"]>;
type JournalRow = {
  id: string;
  journal_no: string | null;
  journal_date: string;
  source_type: JournalSourceType;
  source_id: string | null;
  description: string;
  total_amount: string;
  status: JournalStatus;
  approval_request_id: string | null;
  post_error: string | null;
  created_by: string | null;
  created_by_name: string | null;
  version: number;
};
const round = (value: number) => Math.round(value * 10000) / 10000;
const monthEnd = (month: string) => {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
};
const nextMonthOf = (date: string) => {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
};

@Injectable()
export class JournalsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly ledger: LedgerService,
  ) {}

  // Duyệt xong thì ghi sổ; kỳ đã khóa thì phiếu về "Bị từ chối" kèm lý do.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      const requestId = String(event.payload.requestId);
      const journal = (await this.database.execute<{ id: string }>(sql`SELECT id FROM accounting.journals WHERE approval_request_id = ${requestId} AND status = 'pending'`)).rows[0];
      if (!journal) return;
      if (status === "approved") {
        try {
          await this.database.transaction((transaction) => this.post(transaction, journal.id));
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await this.database.execute(sql`
            UPDATE accounting.journals SET status = 'rejected', post_error = ${error.messageKey}, updated_at = now(), version = version + 1 WHERE id = ${journal.id} AND status = 'pending'`);
        }
      } else if (status === "rejected" || status === "withdrawn") {
        await this.database.execute(sql`UPDATE accounting.journals SET status = ${status}, updated_at = now(), version = version + 1 WHERE id = ${journal.id} AND status = 'pending'`);
      }
    });
  }

  private select() {
    return sql`
      SELECT j.id, j.journal_no, j.journal_date::text, j.source_type, j.source_id, j.description, j.total_amount::text, j.status, j.approval_request_id, j.post_error,
        j.created_by, u.full_name AS created_by_name, j.version
      FROM accounting.journals j LEFT JOIN core.users u ON u.id = j.created_by`;
  }

  private item(row: JournalRow): JournalListItem {
    return {
      id: row.id,
      journalNo: row.journal_no,
      journalDate: day(row.journal_date),
      sourceType: row.source_type,
      description: row.description,
      totalAmount: trimDecimal(row.total_amount),
      status: row.status,
    };
  }

  async list(actor: Actor, query: z.output<typeof journalListQuerySchema>): Promise<JournalListItem[]> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view, ledgerPermissions.manageJournals);
    const rows = await this.database.execute<JournalRow>(sql`
      ${this.select()} WHERE j.company_id = ${actor.companyId}
        ${query.sourceType ? sql`AND j.source_type = ${query.sourceType}` : sql``} ${query.status ? sql`AND j.status = ${query.status}` : sql``}
        ${query.from ? sql`AND j.journal_date >= ${query.from}::date` : sql``} ${query.to ? sql`AND j.journal_date <= ${query.to}::date` : sql``}
      ORDER BY j.journal_date DESC, j.created_at DESC LIMIT 500`);
    return rows.rows.map((row) => this.item(row));
  }

  private async single(executor: Executor, companyId: string, id: string): Promise<JournalRow> {
    const row = (await executor.execute<JournalRow>(sql`${this.select()} WHERE j.company_id = ${companyId} AND j.id = ${id}`)).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async detail(actor: Actor, id: string): Promise<JournalResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view, ledgerPermissions.manageJournals);
    const row = await this.single(this.database, actor.companyId, id);
    const lines = await this.database.execute<{
      line_no: number;
      account_id: string;
      code: string;
      name: string;
      partner_id: string | null;
      partner_name: string | null;
      debit: string;
      credit: string;
      description: string | null;
    }>(sql`
      SELECT l.line_no, l.account_id, a.code, a.name, l.partner_id, p.name AS partner_name, l.debit::text, l.credit::text, l.description
      FROM accounting.journal_lines l JOIN accounting.accounts a ON a.id = l.account_id LEFT JOIN crm.partners p ON p.id = l.partner_id
      WHERE l.journal_id = ${id} ORDER BY l.line_no`);
    const manage = granted.has(ledgerPermissions.manageJournals) && row.source_type === "manual";
    const editable = ["draft", "rejected", "withdrawn"].includes(row.status);
    let canWithdraw = false;
    if (row.status === "pending" && row.created_by === actor.userId && row.approval_request_id) {
      const step = await this.database.execute(sql`SELECT 1 FROM core.approval_steps WHERE request_id = ${row.approval_request_id} AND level_no = 1 AND decision IS NULL`);
      canWithdraw = step.rows.length > 0;
    }
    return {
      ...this.item(row),
      sourceId: row.source_id,
      currency: await companyCurrency(this.database, actor.companyId),
      lines: lines.rows.map((line) => ({
        lineNo: line.line_no,
        accountId: line.account_id,
        accountCode: line.code,
        accountName: line.name,
        partnerId: line.partner_id,
        partnerName: line.partner_name,
        debit: trimDecimal(line.debit),
        credit: trimDecimal(line.credit),
        description: line.description,
      })),
      approvalRequestId: row.approval_request_id,
      postError: row.status === "rejected" ? row.post_error : null,
      createdByName: row.created_by_name,
      version: row.version,
      canEdit: manage && editable,
      canSubmit: manage && editable,
      canWithdraw,
    };
  }

  // Phiếu kế toán: mỗi dòng một bên Nợ hoặc Có, tài khoản nhận bút toán được, tổng Nợ bằng tổng Có (QUYTAC_NGHIEPVU_96).
  private async validate(executor: Executor, companyId: string, input: Input): Promise<number> {
    const fields: FieldErrors = {};
    let debit = 0;
    let credit = 0;
    for (const [index, line] of input.lines.entries()) {
      const lineDebit = Number(line.debit);
      const lineCredit = Number(line.credit);
      if (lineDebit > 0 === lineCredit > 0) fields[`lines.${index}.debit`] = "journalLineSide";
      const account = (
        await executor.execute<{ ok: boolean }>(sql`
        SELECT a.status = 'active' AND NOT EXISTS (SELECT 1 FROM accounting.accounts c WHERE c.parent_id = a.id AND c.status = 'active') AS ok
        FROM accounting.accounts a WHERE a.id = ${line.accountId} AND a.company_id = ${companyId}`)
      ).rows[0];
      if (!account?.ok) fields[`lines.${index}.accountId`] = "accountNotPostable";
      if (line.partnerId) {
        const partner = await executor.execute(sql`SELECT 1 FROM crm.partner_profiles WHERE company_id = ${companyId} AND partner_id = ${line.partnerId}`);
        if (partner.rows.length === 0) fields[`lines.${index}.partnerId`] = "invalidValue";
      }
      debit += lineDebit;
      credit += lineCredit;
    }
    if (Math.abs(round(debit) - round(credit)) > 0.00005) fields.lines = "journalUnbalanced";
    if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
    return round(debit);
  }

  private async writeLines(executor: Executor, journalId: string, input: Input): Promise<void> {
    await executor.execute(sql`DELETE FROM accounting.journal_lines WHERE journal_id = ${journalId}`);
    for (const [index, line] of input.lines.entries()) {
      await executor.execute(sql`
        INSERT INTO accounting.journal_lines (journal_id, line_no, account_id, partner_id, debit, credit, description)
        VALUES (${journalId}, ${index + 1}, ${line.accountId}, ${line.partnerId ?? null}, ${line.debit}::numeric, ${line.credit}::numeric, ${line.description})`);
    }
  }

  async create(actor: Actor, input: Input): Promise<JournalResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.manageJournals);
    const id = await this.database.transaction(async (transaction) => {
      if (!(await this.ledger.requireOpenPeriod(transaction, actor.companyId, input.journalDate))) throw new ApiError("BUSINESS_RULE", "ledgerNotInitialized");
      const total = await this.validate(transaction, actor.companyId, input);
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO accounting.journals (company_id, journal_date, source_type, description, status, total_amount, created_by)
        VALUES (${actor.companyId}, ${input.journalDate}::date, 'manual', ${input.description}, 'draft', ${total.toFixed(4)}::numeric, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.writeLines(transaction, created, input);
      await this.auditService.record({ ...financeAudit(actor, "journal"), action: "journal.create", entityId: created, afterData: input }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async update(actor: Actor, id: string, input: Input): Promise<JournalResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.manageJournals);
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM accounting.journals WHERE id = ${id} AND company_id = ${actor.companyId} AND source_type = 'manual' AND status IN ('draft', 'rejected', 'withdrawn')
          AND version = ${input.version ?? 0} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.ledger.requireOpenPeriod(transaction, actor.companyId, input.journalDate);
      const total = await this.validate(transaction, actor.companyId, input);
      await transaction.execute(sql`
        UPDATE accounting.journals SET journal_date = ${input.journalDate}::date, description = ${input.description}, total_amount = ${total.toFixed(4)}::numeric, status = 'draft',
          post_error = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      await this.writeLines(transaction, id, input);
      await this.auditService.record({ ...financeAudit(actor, "journal"), action: "journal.update", entityId: id, afterData: input }, transaction);
    });
    return this.detail(actor, id);
  }

  async submit(actor: Actor, id: string, version: number): Promise<JournalResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.manageJournals);
    const current = await this.single(this.database, actor.companyId, id);
    if (current.source_type !== "manual" || !["draft", "rejected", "withdrawn"].includes(current.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "PKT");
    await this.database.transaction(async (transaction) => {
      const locked = await transaction.execute(sql`
        SELECT 1 FROM accounting.journals WHERE id = ${id} AND status IN ('draft', 'rejected', 'withdrawn') AND version = ${version} FOR UPDATE`);
      if (locked.rows.length === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.ledger.requireOpenPeriod(transaction, actor.companyId, day(current.journal_date));
      const journalNo = current.journal_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: id,
          documentNo: journalNo,
          amount: current.total_amount,
          currency: await companyCurrency(transaction, actor.companyId),
          documentDate: day(current.journal_date),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE accounting.journals SET status = 'pending', journal_no = ${journalNo}, approval_request_id = ${requestId}, post_error = NULL, updated_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!requestId) await this.post(transaction, id);
      await this.auditService.record({ ...financeAudit(actor, "journal"), action: "journal.submit", entityId: id, afterData: { journalNo, approvalRequestId: requestId } }, transaction);
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<JournalResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.manageJournals);
    const row = await this.single(this.database, actor.companyId, id);
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`UPDATE accounting.journals SET status = 'withdrawn', updated_at = now(), version = version + 1 WHERE id = ${id} AND status = 'pending'`);
      await this.auditService.record({ ...financeAudit(actor, "journal"), action: "journal.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  private async post(executor: Executor, id: string): Promise<void> {
    const row = (
      await executor.execute<{ company_id: string; journal_date: string }>(sql`SELECT company_id, journal_date::text FROM accounting.journals WHERE id = ${id} AND status = 'pending' FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    await this.ledger.requireOpenPeriod(executor, row.company_id, row.journal_date);
    await executor.execute(sql`UPDATE accounting.journals SET status = 'posted', posted_at = now(), post_error = NULL, updated_at = now() WHERE id = ${id}`);
  }

  // Tháng tiếp theo cần khóa: sau tháng đã khóa; chưa khóa lần nào thì tháng của bút toán sớm nhất (QUYTAC_NGHIEPVU_97).
  async periods(actor: Actor): Promise<LedgerPeriodsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view, ledgerPermissions.closePeriods);
    const settings = await this.ledger.lockedThrough(this.database, actor.companyId);
    if (!settings) throw new ApiError("BUSINESS_RULE", "ledgerNotInitialized");
    let nextMonth: string | null = settings.locked ? nextMonthOf(settings.locked) : null;
    if (!nextMonth) {
      const earliest = (
        await this.database.execute<{ value: string | null }>(sql`SELECT min(journal_date)::text AS value FROM accounting.journals WHERE company_id = ${actor.companyId} AND status = 'posted'`)
      ).rows[0]!.value;
      nextMonth = earliest ? earliest.slice(0, 7) : null;
    }
    const today = this.permissionService.today();
    const manage = granted.has(ledgerPermissions.closePeriods);
    return {
      lockedThrough: settings.locked,
      nextMonth,
      canClose: manage && nextMonth !== null && monthEnd(nextMonth) < today,
      canReopen: manage && settings.locked !== null,
      lastClosedMonth: settings.locked ? settings.locked.slice(0, 7) : null,
    };
  }

  // Khóa sổ một tháng: kết chuyển số dư tài khoản loại 5 đến 8 sang xác định kết quả, kết quả sang lợi nhuận chưa phân phối năm nay; ghi ngày khóa (QUYTAC_NGHIEPVU_97).
  async close(actor: Actor, month: string): Promise<LedgerPeriodsResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.closePeriods);
    const status = await this.periods(actor);
    if (status.nextMonth !== month || !status.canClose) throw new ApiError("BUSINESS_RULE", "periodNotClosable");
    const end = monthEnd(month);
    await this.database.transaction(async (transaction) => {
      const settings = (await transaction.execute<{ locked_through: string | null }>(sql`SELECT locked_through::text FROM accounting.settings WHERE company_id = ${actor.companyId} FOR UPDATE`))
        .rows[0]!;
      if (settings.locked_through !== status.lockedThrough) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      const pending = await transaction.execute(sql`
        SELECT 1 FROM accounting.journals WHERE company_id = ${actor.companyId} AND status = 'pending' AND journal_date <= ${end}::date LIMIT 1`);
      if (pending.rows.length > 0) throw new ApiError("BUSINESS_RULE", "periodHasPendingJournals");
      const rules = new Map(
        (
          await transaction.execute<{ role: string; account_id: string }>(sql`
          SELECT role, account_id FROM accounting.posting_rules WHERE company_id = ${actor.companyId} AND role IN ('income_summary', 'retained_earnings')`)
        ).rows.map((row) => [row.role, row.account_id]),
      );
      const summary = rules.get("income_summary")!;
      const retained = rules.get("retained_earnings")!;
      const balances = await transaction.execute<{ account_id: string; balance: string }>(sql`
        SELECT l.account_id, sum(l.debit - l.credit)::text AS balance
        FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id JOIN accounting.accounts a ON a.id = l.account_id
        WHERE j.company_id = ${actor.companyId} AND j.status = 'posted' AND j.journal_date <= ${end}::date AND substr(a.code, 1, 1) IN ('5', '6', '7', '8') AND l.account_id <> ${summary}
        GROUP BY l.account_id HAVING sum(l.debit - l.credit) <> 0`);
      const lines: { accountId: string; debit: number; credit: number }[] = [];
      let summaryBalance = 0;
      for (const row of balances.rows) {
        const balance = round(Number(row.balance));
        if (balance > 0) lines.push({ accountId: summary, debit: balance, credit: 0 }, { accountId: row.account_id, debit: 0, credit: balance });
        else lines.push({ accountId: row.account_id, debit: -balance, credit: 0 }, { accountId: summary, debit: 0, credit: -balance });
        summaryBalance += balance;
      }
      // Số dư tài khoản xác định kết quả (gồm kết chuyển trên) chuyển sang lợi nhuận chưa phân phối: dư Có là lãi, dư Nợ là lỗ.
      const previousSummary = Number(
        (
          await transaction.execute<{ value: string }>(sql`
          SELECT coalesce(sum(l.debit - l.credit), 0)::text AS value FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
          WHERE j.company_id = ${actor.companyId} AND j.status = 'posted' AND j.journal_date <= ${end}::date AND l.account_id = ${summary}`)
        ).rows[0]!.value,
      );
      const result = round(previousSummary + summaryBalance);
      if (result < 0) lines.push({ accountId: summary, debit: -result, credit: 0 }, { accountId: retained, debit: 0, credit: -result });
      else if (result > 0) lines.push({ accountId: retained, debit: result, credit: 0 }, { accountId: summary, debit: 0, credit: result });
      const total = round(lines.reduce((sum, line) => sum + line.debit, 0));
      const journalId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO accounting.journals (company_id, journal_no, journal_date, source_type, description, status, total_amount, created_by, posted_at)
        VALUES (${actor.companyId}, ${`KC-${month}`}, ${end}::date, 'closing', ${`Kết chuyển cuối tháng ${month.slice(5)}/${month.slice(0, 4)}`}, 'posted', ${total.toFixed(4)}::numeric, ${actor.userId}, now())
        RETURNING id`)
      ).rows[0]!.id;
      for (const [index, line] of lines.entries()) {
        await transaction.execute(sql`
          INSERT INTO accounting.journal_lines (journal_id, line_no, account_id, debit, credit) VALUES (${journalId}, ${index + 1}, ${line.accountId}, ${line.debit.toFixed(4)}::numeric, ${line.credit.toFixed(4)}::numeric)`);
      }
      await transaction.execute(sql`UPDATE accounting.settings SET locked_through = ${end}::date, version = version + 1 WHERE company_id = ${actor.companyId}`);
      await this.auditService.record({ ...financeAudit(actor, "ledger_period"), action: "period.close", entityId: actor.companyId, afterData: { month, journalId } }, transaction);
    });
    return this.periods(actor);
  }

  // Mở lại tháng khóa gần nhất: xóa bút toán kết chuyển của tháng đó, lùi ngày khóa về tháng trước (nếu tháng trước đã khóa).
  async reopen(actor: Actor): Promise<LedgerPeriodsResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.closePeriods);
    await this.database.transaction(async (transaction) => {
      const settings = (await transaction.execute<{ locked_through: string | null }>(sql`SELECT locked_through::text FROM accounting.settings WHERE company_id = ${actor.companyId} FOR UPDATE`))
        .rows[0];
      if (!settings?.locked_through) throw new ApiError("BUSINESS_RULE", "periodNotClosable");
      const month = settings.locked_through.slice(0, 7);
      await transaction.execute(sql`DELETE FROM accounting.journals WHERE company_id = ${actor.companyId} AND source_type = 'closing' AND journal_date = ${settings.locked_through}::date`);
      const previous = (
        await transaction.execute<{ value: string | null }>(sql`
        SELECT max(journal_date)::text AS value FROM accounting.journals WHERE company_id = ${actor.companyId} AND source_type = 'closing' AND journal_date < ${settings.locked_through}::date`)
      ).rows[0]!.value;
      await transaction.execute(sql`UPDATE accounting.settings SET locked_through = ${previous}::date, version = version + 1 WHERE company_id = ${actor.companyId}`);
      await this.auditService.record({ ...financeAudit(actor, "ledger_period"), action: "period.reopen", entityId: actor.companyId, afterData: { month } }, transaction);
    });
    return this.periods(actor);
  }
}
