// Bảng hoa hồng tháng (CONG_VIEC_17 lát L1; CHUC_NANG_83; QUYTAC_NGHIEPVU_111, 112; API_94): lập lần lượt theo tháng, duyệt, ghi sổ, bút toán.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { CommissionStatementResponse, CommissionStatementStatus, CommissionStatementsResponse } from "contracts";
import { sql } from "drizzle-orm";
import { LedgerService } from "../accounting/ledger.service";
import { ledgerSettings } from "../accounting/period-guard";
import { commissionDraft } from "../accounting/postings";
import { ApprovalRequestsService } from "../approvals/approval-requests.service";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { vietnamDate } from "../common/clock";
import { OutboxService } from "../common/outbox.service";
import { DATABASE, type Database } from "../database/database.module";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency, ensureSequence } from "../purchasing/requisitions.service";
import { NumberSequencesService } from "../settings/number-sequences.service";
import { tierMultiplier } from "./commission-rules";
import { commissionPermissions } from "./commissions.service";

type Executor = Pick<Database, "execute">;
const documentTypeCode = "finance.commission";

const monthEnd = (month: string) => {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
};
const nextMonthOf = (month: string) => {
  const [year, value] = month.split("-").map(Number) as [number, number];
  return value === 12 ? `${year + 1}-01` : `${year}-${String(value + 1).padStart(2, "0")}`;
};

type StatementRow = {
  id: string;
  company_id: string;
  month: string;
  document_no: string | null;
  status: CommissionStatementStatus;
  total_amount: string;
  approval_request_id: string | null;
  post_error: string | null;
  created_by: string | null;
  version: number;
};

@Injectable()
export class CommissionStatementsService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly sequences: NumberSequencesService,
    private readonly approvals: ApprovalRequestsService,
    private readonly outbox: OutboxService,
    private readonly ledger: LedgerService,
  ) {}

  // Duyệt xong thì ghi sổ; kỳ đã khóa thì bảng về "Bị từ chối" kèm lý do. Bị từ chối, rút: phát sinh trả về chưa vào bảng.
  onModuleInit(): void {
    this.outbox.subscribe("core.approval.completed", async (event) => {
      if (event.payload.documentTypeCode !== documentTypeCode) return;
      const status = String(event.payload.status);
      const statement = (
        await this.database.execute<{ id: string }>(sql`SELECT id FROM finance.commission_statements WHERE approval_request_id = ${String(event.payload.requestId)} AND status = 'pending'`)
      ).rows[0];
      if (!statement) return;
      if (status === "approved") {
        try {
          await this.database.transaction((transaction) => this.post(transaction, statement.id));
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          await this.database.transaction((transaction) => this.close(transaction, statement.id, "rejected", error.messageKey));
        }
      } else if (status === "rejected" || status === "withdrawn") {
        await this.database.transaction((transaction) => this.close(transaction, statement.id, status, null));
      }
    });
  }

  private async close(executor: Executor, id: string, status: "rejected" | "withdrawn", postError: string | null): Promise<void> {
    const updated = await executor.execute(sql`
      UPDATE finance.commission_statements SET status = ${status}, post_error = ${postError}, version = version + 1 WHERE id = ${id} AND status = 'pending' RETURNING id`);
    if (updated.rows.length > 0) await executor.execute(sql`UPDATE finance.commission_events SET statement_id = NULL WHERE statement_id = ${id}`);
  }

  // Tháng tiếp theo lập được: sau bảng gần nhất đang dùng; chưa có thì tháng của phát sinh sớm nhất chưa vào bảng; nhảy qua tháng không có phát sinh.
  private async nextMonth(executor: Executor, companyId: string): Promise<string | null> {
    const latest = (
      await executor.execute<{ month: string | null }>(sql`
      SELECT max(month) AS month FROM finance.commission_statements WHERE company_id = ${companyId} AND status NOT IN ('rejected', 'withdrawn')`)
    ).rows[0]!.month;
    const earliest = (
      await executor.execute<{ month: string | null }>(sql`
      SELECT to_char(min(event_date), 'YYYY-MM') AS month FROM finance.commission_events WHERE company_id = ${companyId} AND statement_id IS NULL`)
    ).rows[0]!.month;
    if (!earliest) return null;
    let candidate = latest ? nextMonthOf(latest) : earliest;
    if (earliest > candidate) candidate = earliest;
    return monthEnd(candidate) < vietnamDate(new Date()) ? candidate : null;
  }

  async list(actor: Actor): Promise<CommissionStatementsResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, commissionPermissions.view);
    const rows = await this.database.execute<StatementRow>(sql`
      SELECT id, company_id, month, document_no, status, total_amount::text, approval_request_id, post_error, created_by, version
      FROM finance.commission_statements WHERE company_id = ${actor.companyId} ORDER BY month DESC, created_at DESC LIMIT 120`);
    const next = await this.nextMonth(this.database, actor.companyId);
    const busy = rows.rows.some((row) => row.status === "draft" || row.status === "pending");
    return {
      statements: rows.rows.map((row) => this.item(row)),
      nextMonth: busy ? null : next,
      canCreate: granted.has(commissionPermissions.manage) && !busy && next !== null,
      canManage: granted.has(commissionPermissions.manage),
      currency: await companyCurrency(this.database, actor.companyId),
    };
  }

  private item(row: StatementRow) {
    return { id: row.id, month: row.month, documentNo: row.document_no, status: row.status, totalAmount: trimDecimal(row.total_amount), postError: row.post_error };
  }

  // Lập bảng: gom phát sinh chưa vào bảng đến hết tháng, tính theo nhân viên (QUYTAC_NGHIEPVU_111).
  async create(actor: Actor, month: string): Promise<CommissionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.manage);
    const id = await this.database.transaction(async (transaction) => {
      // Khóa cài đặt để hai người lập cùng lúc không trùng.
      await transaction.execute(sql`SELECT 1 FROM finance.commission_settings WHERE company_id = ${actor.companyId} FOR UPDATE`);
      const busy = await transaction.execute(sql`SELECT 1 FROM finance.commission_statements WHERE company_id = ${actor.companyId} AND status IN ('draft', 'pending') LIMIT 1`);
      if (busy.rows.length > 0) throw new ApiError("BUSINESS_RULE", "commissionStatementOpen");
      if ((await this.nextMonth(transaction, actor.companyId)) !== month) throw new ApiError("BUSINESS_RULE", "commissionMonthNotNext");
      const tiers =
        (await transaction.execute<{ tiers: { fromPercent: string; multiplier: string }[] }>(sql`SELECT tiers FROM finance.commission_settings WHERE company_id = ${actor.companyId}`)).rows[0]
          ?.tiers ?? [];
      const units = Number((await transaction.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${actor.companyId}) AS units`)).rows[0]!.units);
      const round = (value: number) => Math.round(value * 10 ** units) / 10 ** units;
      const statementId = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.commission_statements (company_id, month, created_by) VALUES (${actor.companyId}, ${month}, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await transaction.execute(sql`
        UPDATE finance.commission_events SET statement_id = ${statementId} WHERE company_id = ${actor.companyId} AND statement_id IS NULL AND event_date <= ${monthEnd(month)}::date`);
      const users = await transaction.execute<{ user_id: string; base: string; commission: string; target: string | null }>(sql`
        SELECT e.user_id, sum(e.base_amount)::text AS base, sum(e.amount)::text AS commission,
          (SELECT t.amount::text FROM finance.commission_targets t WHERE t.company_id = ${actor.companyId} AND t.user_id = e.user_id AND t.month = ${month}) AS target
        FROM finance.commission_events e WHERE e.statement_id = ${statementId} GROUP BY e.user_id`);
      let total = 0;
      for (const user of users.rows) {
        const achieved = user.target ? Math.round((Number(user.base) / Number(user.target)) * 1000000) / 10000 : null;
        const multiplier = tierMultiplier(tiers, achieved);
        const amount = round(Number(user.commission) * multiplier);
        total += amount;
        await transaction.execute(sql`
          INSERT INTO finance.commission_statement_lines (statement_id, user_id, base_amount, commission_before, target_amount, achieved_percent, multiplier, amount)
          VALUES (${statementId}, ${user.user_id}, ${user.base}, ${user.commission}, ${user.target}, ${achieved}, ${multiplier}, ${amount})`);
      }
      await transaction.execute(sql`UPDATE finance.commission_statements SET total_amount = ${round(total)} WHERE id = ${statementId}`);
      await this.auditService.record({ ...financeAudit(actor, "commission_statement"), action: "commission_statement.create", entityId: statementId, afterData: { month } }, transaction);
      return statementId;
    });
    return this.detail(actor, id);
  }

  async detail(actor: Actor, id: string): Promise<CommissionStatementResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, commissionPermissions.view);
    const row = (
      await this.database.execute<StatementRow>(sql`
      SELECT id, company_id, month, document_no, status, total_amount::text, approval_request_id, post_error, created_by, version
      FROM finance.commission_statements WHERE id = ${id} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    const lines = await this.database.execute<{
      user_id: string;
      full_name: string;
      base_amount: string;
      commission_before: string;
      target_amount: string | null;
      achieved_percent: string | null;
      multiplier: string;
      amount: string;
    }>(sql`
      SELECT l.user_id, u.full_name, l.base_amount::text, l.commission_before::text, l.target_amount::text, l.achieved_percent::text, l.multiplier::text, l.amount::text
      FROM finance.commission_statement_lines l JOIN core.users u ON u.id = l.user_id WHERE l.statement_id = ${id} ORDER BY u.full_name`);
    const count = Number((await this.database.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM finance.commission_events WHERE statement_id = ${id}`)).rows[0]!.count);
    return {
      ...this.item(row),
      lines: lines.rows.map((line) => ({
        userId: line.user_id,
        fullName: line.full_name,
        baseAmount: trimDecimal(line.base_amount),
        commissionBefore: trimDecimal(line.commission_before),
        targetAmount: line.target_amount === null ? null : trimDecimal(line.target_amount),
        achievedPercent: line.achieved_percent === null ? null : trimDecimal(line.achieved_percent),
        multiplier: trimDecimal(line.multiplier),
        amount: trimDecimal(line.amount),
      })),
      eventCount: count,
      currency: await companyCurrency(this.database, actor.companyId),
      canManage: granted.has(commissionPermissions.manage),
      canWithdraw: row.status === "pending" && row.created_by === actor.userId && Boolean(row.approval_request_id),
      version: row.version,
    };
  }

  // Gửi: cấp số, đi luồng duyệt; chưa có chính sách thì ghi sổ ngay (QUYTAC_NGHIEPVU_112).
  async submit(actor: Actor, id: string, version: number): Promise<CommissionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.manage);
    await ensureSequence(this.database, this.sequences, actor, documentTypeCode, "HH");
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<StatementRow>(sql`
        SELECT id, company_id, month, document_no, status, total_amount::text, approval_request_id, post_error, created_by, version
        FROM finance.commission_statements WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (row.status !== "draft") throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      const documentNo = row.document_no ?? (await this.sequences.next(actor.companyId, documentTypeCode, transaction));
      let requestId: string | null = null;
      try {
        requestId = await this.approvals.submitWithin(transaction, actor.companyId, actor.userId, {
          documentTypeCode,
          documentId: id,
          documentNo,
          // Tổng âm (hoàn tiền vượt) vẫn phải qua duyệt: giá trị duyệt là trị tuyệt đối.
          amount: Math.abs(Number(row.total_amount)).toFixed(4),
          currency: await companyCurrency(transaction, actor.companyId),
          documentDate: monthEnd(row.month),
        });
      } catch (error) {
        if (!(error instanceof ApiError && error.messageKey === "policyNotFound")) throw error;
      }
      await transaction.execute(sql`
        UPDATE finance.commission_statements SET status = 'pending', document_no = ${documentNo}, approval_request_id = ${requestId}, post_error = NULL, submitted_at = now(), version = version + 1
        WHERE id = ${id}`);
      if (!requestId) await this.post(transaction, id);
      await this.auditService.record(
        { ...financeAudit(actor, "commission_statement"), action: "commission_statement.submit", entityId: id, afterData: { documentNo, approvalRequestId: requestId } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async withdraw(actor: Actor, id: string): Promise<CommissionStatementResponse> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.manage);
    const row = (
      await this.database.execute<StatementRow>(sql`
      SELECT id, company_id, month, document_no, status, total_amount::text, approval_request_id, post_error, created_by, version
      FROM finance.commission_statements WHERE id = ${id} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    if (row.created_by !== actor.userId || !row.approval_request_id || row.status !== "pending") throw new ApiError("FORBIDDEN", "forbidden");
    await this.approvals.withdraw(actor.userId, row.approval_request_id);
    await this.database.transaction(async (transaction) => {
      await this.close(transaction, id, "withdrawn", null);
      await this.auditService.record({ ...financeAudit(actor, "commission_statement"), action: "commission_statement.withdraw", entityId: id }, transaction);
    });
    return this.detail(actor, id);
  }

  // Bỏ bảng nháp: phát sinh trả về chưa vào bảng.
  async discard(actor: Actor, id: string): Promise<CommissionStatementsResponse> {
    await requireFinancePermission(this.permissionService, actor, commissionPermissions.manage);
    await this.database.transaction(async (transaction) => {
      const deleted = await transaction.execute(sql`
        DELETE FROM finance.commission_statements WHERE id = ${id} AND company_id = ${actor.companyId} AND status = 'draft' RETURNING id`);
      if (deleted.rows.length === 0) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
      await this.auditService.record({ ...financeAudit(actor, "commission_statement"), action: "commission_statement.discard", entityId: id }, transaction);
    });
    return this.list(actor);
  }

  // Ghi sổ: bút toán ngày cuối tháng; tháng đã khóa sổ thì ghi ngày đầu kỳ chưa khóa, để tháng sau vẫn chốt được.
  private async post(executor: Executor, id: string): Promise<void> {
    const row = (
      await executor.execute<{ company_id: string; month: string }>(sql`
      SELECT company_id, month FROM finance.commission_statements WHERE id = ${id} AND status = 'pending' FOR UPDATE`)
    ).rows[0];
    if (!row) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    const ledger = await ledgerSettings(executor, row.company_id);
    if (ledger) {
      const rules = await executor.execute(sql`
        SELECT 1 FROM accounting.posting_rules WHERE company_id = ${row.company_id} AND role IN ('commission_expense', 'staff_payable')`);
      if (rules.rows.length < 2) throw new ApiError("BUSINESS_RULE", "postingRuleMissing");
      let date = monthEnd(row.month);
      if (ledger.locked && date <= ledger.locked) date = new Date(Date.parse(`${ledger.locked}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      await this.ledger.record(executor, await commissionDraft(executor, id, date));
    }
    await executor.execute(sql`UPDATE finance.commission_statements SET status = 'posted', posted_at = now(), post_error = NULL, version = version + 1 WHERE id = ${id}`);
  }
}
