// Kế toán tổng hợp (CONG_VIEC_14; CHUC_NANG_69 đến 71; QUYTAC_NGHIEPVU_93 đến 95; API_87): khởi tạo, tài khoản, định khoản, bút toán tự sinh.
import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { AccountingRegime, AccountResponse, LedgerSetupResponse, PostingRuleResponse, saveAccountSchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { ApiError } from "../common/api-error";
import { AuditService } from "../common/audit.service";
import { DATABASE, type Database } from "../database/database.module";
import { financeAudit, requireFinancePermission } from "../finance/finance-context";
import { PaymentsService } from "../finance/payments.service";
import { InternalReceiptsService } from "../inventory/internal-receipts.service";
import { StockDocumentsService } from "../inventory/stock-documents.service";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { charts, defaultPostingRules, roleDescriptions } from "./charts";
import { inventoryDraft, paymentDraft, postingRoles, writeOffDraft, type DraftJournal, type Executor, type PostingRole } from "./postings";

export const ledgerPermissions = {
  view: "finance.ledger.view",
  setup: "finance.ledger.setup",
  manageJournals: "finance.journal.manage",
  closePeriods: "finance.period.close",
} as const;

type AccountRow = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  nature: "debit" | "credit" | "both";
  is_system: boolean;
  status: "active" | "inactive";
  has_children: boolean;
  has_lines: boolean;
  version: number;
};

@Injectable()
export class LedgerService implements OnModuleInit {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly auditService: AuditService,
    private readonly documents: StockDocumentsService,
    private readonly payments: PaymentsService,
    private readonly internalReceipts: InternalReceiptsService,
  ) {}

  // Ghi sổ chứng từ nghiệp vụ thì sinh bút toán trong cùng giao dịch (QUYTAC_NGHIEPVU_95).
  onModuleInit(): void {
    this.documents.postedHooks.push(async (transaction, documentId) => this.record(transaction, await inventoryDraft(transaction, documentId)));
    this.payments.postedHooks.push(async (transaction, paymentId) => this.record(transaction, await paymentDraft(transaction, paymentId)));
    this.internalReceipts.writtenOffHooks.push(async (transaction, discrepancyId) => this.record(transaction, await writeOffDraft(transaction, discrepancyId, this.permissionService.today())));
  }

  // Kỳ đã khóa thì từ chối ghi sổ (QUYTAC_NGHIEPVU_97). Công ty chưa khởi tạo kế toán: trả null.
  async lockedThrough(executor: Executor, companyId: string): Promise<{ locked: string | null } | null> {
    const row = (await executor.execute<{ locked_through: string | null }>(sql`SELECT locked_through::text FROM accounting.settings WHERE company_id = ${companyId} FOR SHARE`)).rows[0];
    return row ? { locked: row.locked_through } : null;
  }

  async requireOpenPeriod(executor: Executor, companyId: string, date: string): Promise<boolean> {
    const settings = await this.lockedThrough(executor, companyId);
    if (!settings) return false;
    if (settings.locked && date <= settings.locked) throw new ApiError("BUSINESS_RULE", "periodLocked");
    return true;
  }

  // Ghi bút toán tự sinh: đổi vai trò sang tài khoản theo định khoản của công ty, bỏ dòng 0, kiểm cân.
  async record(executor: Executor, draft: DraftJournal | null, checkLock = true): Promise<void> {
    if (!draft) return;
    if (checkLock ? !(await this.requireOpenPeriod(executor, draft.companyId, draft.date)) : !(await this.lockedThrough(executor, draft.companyId))) return;
    const rules = new Map(
      (await executor.execute<{ role: PostingRole; account_id: string }>(sql`SELECT role, account_id FROM accounting.posting_rules WHERE company_id = ${draft.companyId}`)).rows.map((row) => [
        row.role,
        row.account_id,
      ]),
    );
    const lines = draft.lines.filter((line) => line.debit > 0.00005 || line.credit > 0.00005);
    if (lines.length === 0) return;
    const totalDebit = lines.reduce((total, line) => total + line.debit, 0);
    const totalCredit = lines.reduce((total, line) => total + line.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.00005) throw new Error(`Bút toán lệch Nợ Có: ${draft.sourceType} ${draft.sourceId}`);
    const journalId = (
      await executor.execute<{ id: string }>(sql`
      INSERT INTO accounting.journals (company_id, journal_no, journal_date, source_type, source_id, description, status, total_amount, posted_at)
      VALUES (${draft.companyId}, ${draft.journalNo}, ${draft.date}::date, ${draft.sourceType}, ${draft.sourceId}, ${draft.description}, 'posted', ${totalDebit.toFixed(4)}::numeric, now())
      RETURNING id`)
    ).rows[0]!.id;
    for (const [index, line] of lines.entries()) {
      const accountId = rules.get(line.role);
      if (!accountId) throw new Error(`Thiếu định khoản vai trò ${line.role}`);
      await executor.execute(sql`
        INSERT INTO accounting.journal_lines (journal_id, line_no, account_id, partner_id, debit, credit)
        VALUES (${journalId}, ${index + 1}, ${accountId}, ${line.partnerId}, ${line.debit.toFixed(4)}::numeric, ${line.credit.toFixed(4)}::numeric)`);
    }
  }

  private async companyRegime(executor: Executor, companyId: string): Promise<AccountingRegime> {
    return (await executor.execute<{ accounting_regime: AccountingRegime }>(sql`SELECT accounting_regime FROM core.companies WHERE id = ${companyId}`)).rows[0]!.accounting_regime;
  }

  async setupStatus(actor: Actor): Promise<LedgerSetupResponse> {
    const granted = await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view, ledgerPermissions.setup);
    const regime = await this.companyRegime(this.database, actor.companyId);
    const settings = (await this.database.execute<{ locked_through: string | null }>(sql`SELECT locked_through::text FROM accounting.settings WHERE company_id = ${actor.companyId}`)).rows[0];
    return { initialized: Boolean(settings), regime, regimeName: charts[regime].name, lockedThrough: settings?.locked_through ?? null, canSetup: granted.has(ledgerPermissions.setup) };
  }

  // Khởi tạo theo chế độ kế toán của công ty: nạp tài khoản, định khoản mặc định, tạo bút toán cho chứng từ đã ghi sổ trước đó (CHUC_NANG_69).
  async setup(actor: Actor): Promise<LedgerSetupResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.setup);
    await this.database.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT 1 FROM core.companies WHERE id = ${actor.companyId} FOR UPDATE`);
      const existing = await transaction.execute(sql`SELECT 1 FROM accounting.settings WHERE company_id = ${actor.companyId}`);
      if (existing.rows.length > 0) throw new ApiError("BUSINESS_RULE", "ledgerInitialized");
      const regime = await this.companyRegime(transaction, actor.companyId);
      await transaction.execute(sql`INSERT INTO accounting.settings (company_id, initialized_by) VALUES (${actor.companyId}, ${actor.userId})`);
      const ids = new Map<string, string>();
      for (const account of charts[regime].accounts) {
        const id = (
          await transaction.execute<{ id: string }>(sql`
          INSERT INTO accounting.accounts (company_id, code, name, parent_id, nature, is_system)
          VALUES (${actor.companyId}, ${account.code}, ${account.name}, ${account.parent ? (ids.get(account.parent) ?? null) : null}, ${account.nature}, true)
          RETURNING id`)
        ).rows[0]!.id;
        ids.set(account.code, id);
      }
      for (const role of postingRoles) {
        await transaction.execute(sql`
          INSERT INTO accounting.posting_rules (company_id, role, account_id, updated_by) VALUES (${actor.companyId}, ${role}, ${ids.get(defaultPostingRules[regime][role])!}, ${actor.userId})`);
      }
      await this.backfill(transaction, actor.companyId);
      await this.auditService.record({ ...financeAudit(actor, "ledger"), action: "ledger.setup", entityId: actor.companyId, afterData: { regime } }, transaction);
    });
    return this.setupStatus(actor);
  }

  // Chứng từ đã ghi sổ trước khi khởi tạo: tạo bút toán theo thứ tự ghi sổ.
  private async backfill(executor: Executor, companyId: string): Promise<void> {
    const documents = await executor.execute<{ id: string }>(sql`
      SELECT id FROM inventory.documents WHERE company_id = ${companyId} AND status IN ('posted', 'in_transit', 'received') AND type <> 'transfer' ORDER BY posted_at, created_at`);
    for (const document of documents.rows) await this.record(executor, await inventoryDraft(executor, document.id), false);
    const payments = await executor.execute<{ id: string }>(sql`SELECT id FROM finance.payments WHERE company_id = ${companyId} AND status = 'posted' ORDER BY posted_at`);
    for (const payment of payments.rows) await this.record(executor, await paymentDraft(executor, payment.id), false);
    const writeOffs = await executor.execute<{ id: string; resolved_at: string }>(sql`
      SELECT id, (resolved_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS resolved_at FROM inventory.internal_discrepancies WHERE company_id = ${companyId} AND status = 'written_off'`);
    for (const writeOff of writeOffs.rows) await this.record(executor, await writeOffDraft(executor, writeOff.id, writeOff.resolved_at), false);
  }

  private async requireInitialized(executor: Executor, companyId: string): Promise<void> {
    if (!(await this.lockedThrough(executor, companyId))) throw new ApiError("BUSINESS_RULE", "ledgerNotInitialized");
  }

  async accounts(actor: Actor): Promise<AccountResponse[]> {
    const granted = await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view, ledgerPermissions.setup, ledgerPermissions.manageJournals);
    const rows = await this.database.execute<AccountRow>(sql`
      SELECT a.id, a.code, a.name, a.parent_id, a.nature, a.is_system, a.status, a.version,
        EXISTS (SELECT 1 FROM accounting.accounts c WHERE c.parent_id = a.id AND c.status = 'active') AS has_children,
        EXISTS (SELECT 1 FROM accounting.journal_lines l WHERE l.account_id = a.id) AS has_lines
      FROM accounting.accounts a WHERE a.company_id = ${actor.companyId} ORDER BY a.code`);
    const manage = granted.has(ledgerPermissions.setup);
    return rows.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      parentId: row.parent_id,
      nature: row.nature,
      isSystem: row.is_system,
      status: row.status,
      postable: row.status === "active" && !row.has_children,
      hasLines: row.has_lines,
      version: row.version,
      canEdit: manage,
    }));
  }

  // Tài khoản chi tiết: số hiệu bắt đầu bằng số hiệu tài khoản cha, tính chất theo cha (QUYTAC_NGHIEPVU_93).
  async createAccount(actor: Actor, input: z.output<typeof saveAccountSchema>): Promise<AccountResponse[]> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.setup);
    await this.database.transaction(async (transaction) => {
      await this.requireInitialized(transaction, actor.companyId);
      const parent = input.parentId
        ? (
            await transaction.execute<{ code: string; nature: string; status: string }>(sql`
            SELECT code, nature, status FROM accounting.accounts WHERE id = ${input.parentId} AND company_id = ${actor.companyId} FOR UPDATE`)
          ).rows[0]
        : undefined;
      if (!parent || parent.status !== "active") throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { parentId: "invalidValue" } });
      if (!input.code.startsWith(parent.code) || input.code.length <= parent.code.length) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "accountCodePrefix" } });
      const taken = await transaction.execute(sql`SELECT 1 FROM accounting.accounts WHERE company_id = ${actor.companyId} AND code = ${input.code}`);
      if (taken.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { code: "accountCodeExists" } });
      const id = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO accounting.accounts (company_id, code, name, parent_id, nature) VALUES (${actor.companyId}, ${input.code}, ${input.name}, ${input.parentId}, ${parent.nature}) RETURNING id`)
      ).rows[0]!.id;
      // Định khoản đang dùng tài khoản cha chuyển sang tài khoản chi tiết mới (tài khoản cha không nhận bút toán mới; bút toán cũ vẫn cộng vào số dư của cha).
      await transaction.execute(sql`UPDATE accounting.posting_rules SET account_id = ${id}, updated_at = now(), updated_by = ${actor.userId} WHERE account_id = ${input.parentId}`);
      await this.auditService.record({ ...financeAudit(actor, "account"), action: "account.create", entityId: id, afterData: input }, transaction);
    });
    return this.accounts(actor);
  }

  // Sửa tên, ngừng dùng tài khoản chi tiết; tài khoản hệ thống chỉ đổi tên được, không ngừng dùng.
  async updateAccount(actor: Actor, id: string, input: { name: string; status: "active" | "inactive"; version: number }): Promise<AccountResponse[]> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.setup);
    await this.database.transaction(async (transaction) => {
      const row = (
        await transaction.execute<{ is_system: boolean; version: number; name: string; status: string }>(sql`
        SELECT is_system, version, name, status FROM accounting.accounts WHERE id = ${id} AND company_id = ${actor.companyId} FOR UPDATE`)
      ).rows[0];
      if (!row) throw new ApiError("NOT_FOUND", "notFound");
      if (row.version !== input.version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      if (input.status === "inactive") {
        if (row.is_system) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { status: "accountSystem" } });
        const used = await transaction.execute(sql`SELECT 1 FROM accounting.posting_rules WHERE account_id = ${id} LIMIT 1`);
        if (used.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { status: "accountUsedByRule" } });
        const children = await transaction.execute(sql`SELECT 1 FROM accounting.accounts WHERE parent_id = ${id} AND status = 'active' LIMIT 1`);
        if (children.rows.length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { status: "accountHasChildren" } });
      }
      await transaction.execute(sql`UPDATE accounting.accounts SET name = ${input.name}, status = ${input.status}, updated_at = now(), version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "account"), action: "account.update", entityId: id, beforeData: row, afterData: input }, transaction);
    });
    return this.accounts(actor);
  }

  async postingRules(actor: Actor): Promise<PostingRuleResponse[]> {
    const granted = await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view, ledgerPermissions.setup);
    const rows = await this.database.execute<{ role: PostingRole; account_id: string; code: string; name: string }>(sql`
      SELECT r.role, r.account_id, a.code, a.name FROM accounting.posting_rules r JOIN accounting.accounts a ON a.id = r.account_id WHERE r.company_id = ${actor.companyId}`);
    const byRole = new Map(rows.rows.map((row) => [row.role, row]));
    return postingRoles
      .filter((role) => byRole.has(role))
      .map((role) => {
        const row = byRole.get(role)!;
        return { role, description: roleDescriptions[role], accountId: row.account_id, accountCode: row.code, accountName: row.name, canEdit: granted.has(ledgerPermissions.setup) };
      });
  }

  // Đổi tài khoản của một vai trò; tài khoản phải nhận bút toán được (QUYTAC_NGHIEPVU_94).
  async updatePostingRule(actor: Actor, role: PostingRole, accountId: string): Promise<PostingRuleResponse[]> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.setup);
    if (!postingRoles.includes(role)) throw new ApiError("NOT_FOUND", "notFound");
    await this.database.transaction(async (transaction) => {
      await this.requireInitialized(transaction, actor.companyId);
      const account = (
        await transaction.execute<{ ok: boolean }>(sql`
        SELECT a.status = 'active' AND NOT EXISTS (SELECT 1 FROM accounting.accounts c WHERE c.parent_id = a.id AND c.status = 'active') AS ok
        FROM accounting.accounts a WHERE a.id = ${accountId} AND a.company_id = ${actor.companyId}`)
      ).rows[0];
      if (!account?.ok) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { accountId: "accountNotPostable" } });
      await transaction.execute(
        sql`UPDATE accounting.posting_rules SET account_id = ${accountId}, updated_at = now(), updated_by = ${actor.userId} WHERE company_id = ${actor.companyId} AND role = ${role}`,
      );
      await this.auditService.record({ ...financeAudit(actor, "posting_rule"), action: "posting_rule.update", entityId: actor.companyId, afterData: { role, accountId } }, transaction);
    });
    return this.postingRules(actor);
  }
}
