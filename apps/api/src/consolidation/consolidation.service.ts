// Báo cáo tài chính hợp nhất (CONG_VIEC_20; CHUC_NANG_92 đến 95; QUYTAC_NGHIEPVU_123 đến 128; API_106 đến API_109).
import { Inject, Injectable } from "@nestjs/common";
import type {
  AccountingRegime,
  ConsolidatedStatementResponse,
  ConsolidationEntry,
  ConsolidationListItem,
  consolidationManualEntrySchema,
  ConsolidationMember,
  ConsolidationProfitLine,
  ConsolidationResponse,
  ConsolidationScopeResponse,
  ConsolidationsResponse,
  ConsolidationWarning,
  consolidationPreviewQuerySchema,
  saveConsolidationProfitSchema,
  StatementKind,
} from "contracts";
import { sql, type SQL } from "drizzle-orm";
import { charts } from "../accounting/charts";
import { AuditService } from "../common/audit.service";
import { financeAudit } from "../finance/finance-context";
import type { z } from "zod";
import { consolidatedCode, StatementsService, type ExtraLine, type Ledger } from "../accounting/statements.service";
import { statementTemplates } from "../accounting/statement-templates";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";

export const consolidationPermissions = { view: "finance.consolidation.view", manage: "finance.consolidation.manage" } as const;
// Mẫu hợp nhất: B01-DN, B02-DN Thông tư 99 (quyết định của người dùng ngày 2026-11-10).
const consolidationRegime: AccountingRegime = "TT99_2025";

type MemberRow = {
  id: string;
  code: string;
  short_name: string | null;
  legal_name: string;
  accounting_regime: AccountingRegime;
  base_currency: string;
  fiscal_year_start: number;
  is_root: boolean;
  initialized: boolean;
};

@Injectable()
export class ConsolidationService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
    private readonly statements: StatementsService,
    private readonly auditService: AuditService,
  ) {}

  // Quyền hợp nhất chỉ có hiệu lực khi gán ở phạm vi tập đoàn.
  async requireGroupPermission(actor: Actor, ...anyOf: string[]): Promise<Set<string>> {
    const granted = await this.permissionService.permissionsCovering(actor.userId, { scopeType: "group" });
    if (!anyOf.some((permission) => granted.has(permission))) throw new ApiError("FORBIDDEN", "forbidden");
    return granted;
  }

  // Tập đoàn: công ty gốc của công ty đang chọn và mọi công ty con các cấp (QUYTAC_NGHIEPVU_123).
  async members(companyId: string): Promise<MemberRow[]> {
    return (
      await this.database.execute<MemberRow>(sql`
      WITH RECURSIVE up AS (
        SELECT id, parent_id FROM core.companies WHERE id = ${companyId}
        UNION ALL SELECT c.id, c.parent_id FROM core.companies c JOIN up ON c.id = up.parent_id
      ), root AS (SELECT id FROM up WHERE parent_id IS NULL),
      down AS (
        SELECT id FROM root
        UNION ALL SELECT c.id FROM core.companies c JOIN down ON c.parent_id = down.id
      )
      SELECT c.id, c.code, c.short_name, c.legal_name, c.accounting_regime, c.base_currency, c.fiscal_year_start, c.parent_id IS NULL AS is_root,
        EXISTS (SELECT 1 FROM accounting.settings s WHERE s.company_id = c.id) AS initialized
      FROM core.companies c JOIN down ON down.id = c.id
      ORDER BY c.parent_id IS NOT NULL, c.code`)
    ).rows;
  }

  private toMember(row: MemberRow, currency: string): ConsolidationMember {
    return {
      companyId: row.id,
      code: row.code,
      name: row.short_name ?? row.legal_name,
      regime: row.accounting_regime,
      currency: row.base_currency,
      isRoot: row.is_root,
      excludedReason: row.base_currency !== currency ? "other_currency" : !row.initialized ? "ledger_not_initialized" : null,
    };
  }

  async scope(actor: Actor): Promise<ConsolidationScopeResponse> {
    const granted = await this.requireGroupPermission(actor, consolidationPermissions.view, consolidationPermissions.manage);
    const rows = await this.members(actor.companyId);
    const root = rows.find((row) => row.is_root)!;
    return {
      group: { id: root.id, name: root.short_name ?? root.legal_name },
      currency: root.base_currency,
      members: rows.map((row) => this.toMember(row, root.base_currency)),
      canManage: granted.has(consolidationPermissions.manage),
    };
  }

  // Sổ cái cộng gộp các thành viên được hợp nhất; công ty gốc (nếu được hợp nhất) đứng đầu để nhận lợi nhuận chưa phân phối.
  async ledgerOf(companyId: string, memberIds?: string[]): Promise<{ ledger: Ledger; root: MemberRow; included: MemberRow[]; units: number }> {
    const rows = await this.members(companyId);
    const root = rows.find((row) => row.is_root)!;
    // Bảng hợp nhất dùng thành viên của lần tính lại gần nhất.
    const included = memberIds ? rows.filter((row) => memberIds.includes(row.id)) : rows.filter((row) => this.toMember(row, root.base_currency).excludedReason === null);
    if (included.length === 0) throw new ApiError("BUSINESS_RULE", "consolidationNoMembers");
    // Mã tài khoản ghép theo Thông tư 99 kể cả khi chỉ một công ty được hợp nhất.
    const ledger = await this.statements.ledger(
      included.map((row) => ({ id: row.id, regime: row.accounting_regime })),
      true,
    );
    const units = Number((await this.database.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${root.id}) AS units`)).rows[0]!.units);
    return { ledger, root, included, units };
  }

  // Báo cáo hợp nhất: cột cộng gộp (không có dòng bổ sung), cột hợp nhất (có bút toán loại trừ), cột loại trừ là chênh lệch.
  async report(actor: Actor, ledger: Ledger, root: MemberRow, included: MemberRow[], units: number, kind: StatementKind, from: string, to: string): Promise<ConsolidatedStatementResponse> {
    const template = this.statements.templateOf(consolidationRegime, kind);
    const combined = await this.statements.compute(ledger, template, kind, from, to, root.fiscal_year_start, units, false);
    const consolidated = ledger.extras.length > 0 ? await this.statements.compute(ledger, template, kind, from, to, root.fiscal_year_start, units, true) : combined;
    const money = (value: number) => trimDecimal((Math.round(value * 10 ** units) / 10 ** units).toFixed(Math.max(units, 0)));
    return {
      kind,
      form: template.form,
      name: template.name,
      group: { id: root.id, name: root.short_name ?? root.legal_name },
      currency: root.base_currency,
      columns: combined.columns,
      memberNames: included.map((row) => row.short_name ?? row.legal_name),
      lines: template.lines.map((line) => {
        const before = combined.current.get(line.code) ?? 0;
        const after = consolidated.current.get(line.code) ?? 0;
        return {
          code: line.code,
          name: line.name,
          level: line.level,
          note: line.note ?? null,
          combined: money(before),
          eliminations: money(after - before),
          consolidated: money(after),
          previous: money(combined.previous.get(line.code) ?? 0),
        };
      }),
    };
  }

  // Xem trước cộng gộp (lát L0): chưa có bút toán loại trừ.
  async preview(actor: Actor, query: z.output<typeof consolidationPreviewQuerySchema>): Promise<ConsolidatedStatementResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.view, consolidationPermissions.manage);
    if (query.from > query.to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "endBeforeStart" } });
    const { ledger, root, included, units } = await this.ledgerOf(actor.companyId);
    return this.report(actor, ledger, root, included, units, query.kind, query.from, query.to);
  }
  // ---------- Bảng hợp nhất theo kỳ (CHUC_NANG_93, 94; QUYTAC_NGHIEPVU_125 đến 128; API_106 đến API_108) ----------

  private listItem(row: ConsolidationRow): ConsolidationListItem {
    return {
      id: row.id,
      fromDate: row.from_date,
      toDate: row.to_date,
      documentNo: row.document_no,
      status: row.status,
      calculatedAt: row.calculated_at ? new Date(row.calculated_at).toISOString() : null,
      postError: row.post_error,
    };
  }

  private async rootOf(companyId: string): Promise<MemberRow> {
    return (await this.members(companyId)).find((row) => row.is_root)!;
  }

  async row(executor: Executor, groupId: string, id: string, lock = false): Promise<ConsolidationRow> {
    const row = (
      await executor.execute<ConsolidationRow>(sql`
      SELECT id, group_company_id, from_date::text, to_date::text, document_no, status, member_ids, warnings, report, calculated_at, approval_request_id, post_error, created_by, submitted_by, version
      FROM finance.consolidations WHERE id = ${id} AND group_company_id = ${groupId} ${lock ? sql`FOR UPDATE` : sql``}`)
    ).rows[0];
    if (!row) throw new ApiError("NOT_FOUND", "notFound");
    return row;
  }

  async list(actor: Actor): Promise<ConsolidationsResponse> {
    const granted = await this.requireGroupPermission(actor, consolidationPermissions.view, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    const rows = (
      await this.database.execute<ConsolidationRow>(sql`
      SELECT id, group_company_id, from_date::text, to_date::text, document_no, status, member_ids, warnings, report, calculated_at, approval_request_id, post_error, created_by, submitted_by, version
      FROM finance.consolidations WHERE group_company_id = ${root.id} ORDER BY to_date DESC, created_at DESC LIMIT 200`)
    ).rows;
    return { data: rows.map((row) => this.listItem(row)), canManage: granted.has(consolidationPermissions.manage) };
  }

  async create(actor: Actor, from: string, to: string): Promise<ConsolidationResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.manage);
    if (from > to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "endBeforeStart" } });
    const root = await this.rootOf(actor.companyId);
    const id = await this.database.transaction(async (transaction) => {
      const existing = (
        await transaction.execute(sql`
        SELECT 1 FROM finance.consolidations WHERE group_company_id = ${root.id} AND from_date = ${from}::date AND to_date = ${to}::date AND status NOT IN ('rejected', 'withdrawn')`)
      ).rows[0];
      if (existing) throw new ApiError("BUSINESS_RULE", "consolidationPeriodExists");
      const created = (
        await transaction.execute<{ id: string }>(sql`
        INSERT INTO finance.consolidations (group_company_id, from_date, to_date, created_by) VALUES (${root.id}, ${from}::date, ${to}::date, ${actor.userId}) RETURNING id`)
      ).rows[0]!.id;
      await this.calculate(transaction, actor, created);
      await this.auditService.record({ ...financeAudit(actor, "consolidation"), action: "consolidation.create", entityId: created, beforeData: null, afterData: { from, to } }, transaction);
      return created;
    });
    return this.detail(actor, id);
  }

  async recalculate(actor: Actor, id: string, version: number): Promise<ConsolidationResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, root.id, id, true);
      this.requireEditable(row, version);
      await this.calculate(transaction, actor, id);
      await this.auditService.record({ ...financeAudit(actor, "consolidation"), action: "consolidation.recalculate", entityId: id, beforeData: null, afterData: null }, transaction);
    });
    return this.detail(actor, id);
  }

  private requireEditable(row: ConsolidationRow, version: number): void {
    if (row.version !== version) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
    if (!["draft", "rejected", "withdrawn"].includes(row.status)) throw new ApiError("BUSINESS_RULE", "documentNotDraft");
  }

  // Tính lại: thành viên, bút toán loại trừ tự động, lãi chưa thực hiện (giữ số đã sửa tay), chênh lệch công nợ nội bộ.
  private async calculate(executor: Executor, actor: Actor, id: string): Promise<void> {
    const root = await this.rootOf(actor.companyId);
    const row = await this.row(executor, root.id, id);
    const { included } = await this.ledgerOf(actor.companyId);
    const memberIds = included.map((member) => member.id);
    const nameOf = new Map(included.map((member) => [member.id, member.short_name ?? member.legal_name]));
    const members = sql`(${sql.join(
      memberIds.map((memberId) => sql`${memberId}::uuid`),
      sql`, `,
    )})`;
    await executor.execute(sql`DELETE FROM finance.consolidation_entries WHERE consolidation_id = ${id} AND kind <> 'manual'`);
    let entryNo = Number(
      (await executor.execute<{ next: number }>(sql`SELECT coalesce(max(entry_no), 0)::int AS next FROM finance.consolidation_entries WHERE consolidation_id = ${id}`)).rows[0]!.next,
    );
    const insertLine = async (kind: string, companyId: string, accountId: string, partnerId: string | null, debit: number, credit: number, description: string) =>
      executor.execute(sql`
        INSERT INTO finance.consolidation_entries (consolidation_id, entry_no, kind, company_id, account_id, partner_id, debit, credit, description)
        VALUES (${id}, ${entryNo}, ${kind}, ${companyId}, ${accountId}, ${partnerId}, ${debit.toFixed(4)}::numeric, ${credit.toFixed(4)}::numeric, ${description})`);

    // 1. Công nợ nội bộ cuối kỳ (QUYTAC_NGHIEPVU_125).
    const balances = (
      await executor.execute<{ company_id: string; account_id: string; code: string; partner_id: string; other_id: string; net: string }>(sql`
      SELECT j.company_id, l.account_id, a.code, l.partner_id, p.company_id AS other_id, sum(l.debit - l.credit)::text AS net
      FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id JOIN accounting.accounts a ON a.id = l.account_id
      JOIN crm.partners p ON p.id = l.partner_id
      WHERE j.company_id IN ${members} AND j.status = 'posted' AND j.journal_date <= ${row.to_date}::date AND p.company_id IN ${members} AND p.company_id <> j.company_id
        AND (a.code LIKE '131%' OR a.code LIKE '1388%' OR a.code LIKE '136%' OR a.code LIKE '331%' OR a.code LIKE '3388%' OR a.code LIKE '336%')
      GROUP BY j.company_id, l.account_id, a.code, l.partner_id, p.company_id`)
    ).rows;
    const isReceivable = (code: string) => code.startsWith("131") || code.startsWith("1388") || code.startsWith("136");
    const warnings: ConsolidationWarning[] = [];
    for (const creditor of memberIds)
      for (const debtor of memberIds) {
        if (creditor === debtor) continue;
        const receivables = balances.filter((item) => item.company_id === creditor && item.other_id === debtor && isReceivable(item.code) && Number(item.net) > 0);
        const payables = balances.filter((item) => item.company_id === debtor && item.other_id === creditor && !isReceivable(item.code) && Number(item.net) < 0);
        const receivable = receivables.reduce((total, item) => total + Number(item.net), 0);
        const payable = payables.reduce((total, item) => total - Number(item.net), 0);
        if (receivable === 0 && payable === 0) continue;
        const amount = Math.min(receivable, payable);
        if (amount > 0) {
          entryNo += 1;
          const description = `Loại trừ công nợ nội bộ ${nameOf.get(creditor)} – ${nameOf.get(debtor)}`;
          let left = amount;
          for (const item of receivables) {
            const part = Math.min(left, Number(item.net));
            if (part > 0) await insertLine("intercompany_balance", creditor, item.account_id, item.partner_id, 0, part, description);
            left -= part;
          }
          left = amount;
          for (const item of payables) {
            const part = Math.min(left, -Number(item.net));
            if (part > 0) await insertLine("intercompany_balance", debtor, item.account_id, item.partner_id, part, 0, description);
            left -= part;
          }
        }
        if (Math.abs(receivable - payable) > 0.00005)
          warnings.push({
            receivableCompany: nameOf.get(creditor)!,
            payableCompany: nameOf.get(debtor)!,
            receivable: trimDecimal(receivable.toFixed(4)),
            payable: trimDecimal(payable.toFixed(4)),
            difference: trimDecimal((receivable - payable).toFixed(4)),
          });
      }

    // 2. Doanh thu thuần bán nội bộ trong kỳ (trừ hàng bán bị trả lại): Nợ doanh thu / Có giá vốn (QUYTAC_NGHIEPVU_126).
    const sales = (
      await executor.execute<{ seller_id: string; buyer_id: string; amount: string }>(sql`
      SELECT j.company_id AS seller_id, p.company_id AS buyer_id,
        sum(CASE WHEN d.type = 'sales_issue' AND r.role = 'revenue' THEN l.credit - l.debit WHEN d.type = 'sales_return' AND r.role = 'sales_return' THEN -(l.debit - l.credit) ELSE 0 END)::text AS amount
      FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
      JOIN inventory.documents d ON d.id = j.source_id AND j.source_type = 'inventory_document' AND d.type IN ('sales_issue', 'sales_return')
      JOIN crm.partners p ON p.id = d.partner_id
      JOIN accounting.posting_rules r ON r.company_id = j.company_id AND r.account_id = l.account_id AND r.role IN ('revenue', 'sales_return')
      WHERE j.company_id IN ${members} AND j.status = 'posted' AND j.journal_date BETWEEN ${row.from_date}::date AND ${row.to_date}::date
        AND p.company_id IN ${members} AND p.company_id <> j.company_id
      GROUP BY j.company_id, p.company_id`)
    ).rows;
    for (const sale of sales) {
      const amount = Number(sale.amount);
      if (Math.abs(amount) < 0.00005) continue;
      const revenue = await this.roleAccount(executor, sale.seller_id, "revenue");
      const cogs = await this.roleAccount(executor, sale.seller_id, "cogs");
      entryNo += 1;
      const description = `Loại trừ doanh thu, giá vốn bán nội bộ ${nameOf.get(sale.seller_id)} – ${nameOf.get(sale.buyer_id)}`;
      if (amount > 0) {
        await insertLine("internal_sales", sale.seller_id, revenue, null, amount, 0, description);
        await insertLine("internal_sales", sale.seller_id, cogs, null, 0, amount, description);
      } else {
        await insertLine("internal_sales", sale.seller_id, cogs, null, -amount, 0, description);
        await insertLine("internal_sales", sale.seller_id, revenue, null, 0, -amount, description);
      }
    }

    // 3. Lãi chưa thực hiện ước tính từng mặt hàng mua nội bộ trong kỳ; giữ số đã sửa tay (QUYTAC_NGHIEPVU_127).
    const overrides = (
      await executor.execute<{ buyer_company_id: string; seller_company_id: string; variant_id: string; override_amount: string | null; override_reason: string | null }>(sql`
      SELECT buyer_company_id, seller_company_id, variant_id, override_amount::text, override_reason FROM finance.consolidation_profit_lines WHERE consolidation_id = ${id} AND override_amount IS NOT NULL`)
    ).rows;
    await executor.execute(sql`DELETE FROM finance.consolidation_profit_lines WHERE consolidation_id = ${id}`);
    const units = Number((await executor.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${root.id}) AS units`)).rows[0]!.units);
    const items = (
      await executor.execute<{
        buyer_id: string;
        seller_id: string;
        variant_id: string;
        internal_quantity: string;
        issue_quantity: string;
        revenue: string;
        cost: string;
        ending_quantity: string;
      }>(sql`
      WITH received AS (
        SELECT r.company_id AS buyer_id, i.company_id AS seller_id, rl.variant_id, abs(rl.base_quantity) AS quantity, abs(il.base_quantity) AS issue_quantity,
          abs(il.base_quantity) * ol.net_amount / nullif(ol.base_quantity, 0) AS revenue, abs(il.cost_value) AS cost
        FROM inventory.documents r JOIN inventory.document_lines rl ON rl.document_id = r.id
        JOIN inventory.document_lines il ON il.id = rl.counterpart_line_id JOIN inventory.documents i ON i.id = il.document_id
        JOIN sales.order_lines ol ON ol.id = il.source_line_id
        WHERE r.type = 'purchase_receipt' AND r.status = 'posted' AND r.counterpart_document_id IS NOT NULL
          AND r.company_id IN ${members} AND i.company_id IN ${members} AND r.document_date BETWEEN ${row.from_date}::date AND ${row.to_date}::date
      )
      SELECT buyer_id, seller_id, variant_id, sum(quantity)::text AS internal_quantity, sum(issue_quantity)::text AS issue_quantity,
        coalesce(sum(revenue), 0)::text AS revenue, coalesce(sum(cost), 0)::text AS cost,
        (SELECT coalesce(sum(m.quantity), 0) FROM inventory.movements m
         WHERE m.company_id = received.buyer_id AND m.variant_id = received.variant_id
           AND m.moved_at < ((${row.to_date}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'))::text AS ending_quantity
      FROM received GROUP BY buyer_id, seller_id, variant_id`)
    ).rows;
    for (const item of items) {
      // Lãi gộp mỗi đơn vị tính theo đơn vị của bên mua (hai bên có thể khác đơn vị, ví dụ hộp và cái).
      const received = Number(item.internal_quantity);
      const margin = received > 0 ? Math.max((Number(item.revenue) - Number(item.cost)) / received, 0) : 0;
      const remaining = Math.min(Math.max(Number(item.ending_quantity), 0), Number(item.internal_quantity));
      const estimated = Math.round(remaining * margin * 10 ** units) / 10 ** units;
      const kept = overrides.find((override) => override.buyer_company_id === item.buyer_id && override.seller_company_id === item.seller_id && override.variant_id === item.variant_id);
      await executor.execute(sql`
        INSERT INTO finance.consolidation_profit_lines (consolidation_id, buyer_company_id, seller_company_id, variant_id, internal_quantity, ending_quantity, unit_margin, estimated_amount, override_amount, override_reason)
        VALUES (${id}, ${item.buyer_id}, ${item.seller_id}, ${item.variant_id}, ${item.internal_quantity}::numeric, ${item.ending_quantity}::numeric, ${margin.toFixed(4)}::numeric,
          ${estimated.toFixed(4)}::numeric, ${kept?.override_amount ?? null}::numeric, ${kept?.override_reason ?? null})`);
    }
    await executor.execute(sql`
      UPDATE finance.consolidations SET member_ids = ${`{${memberIds.join(",")}}`}::uuid[], warnings = ${JSON.stringify(warnings)}::jsonb, calculated_at = now(), post_error = NULL, version = version + 1
      WHERE id = ${id}`);
  }

  private async roleAccount(executor: Executor, companyId: string, role: string): Promise<string> {
    const accountId = (await executor.execute<{ account_id: string }>(sql`SELECT account_id FROM accounting.posting_rules WHERE company_id = ${companyId} AND role = ${role}`)).rows[0]?.account_id;
    if (!accountId) throw new ApiError("BUSINESS_RULE", "postingRuleMissing");
    return accountId;
  }

  // Bút toán loại trừ, điều chỉnh đưa vào báo cáo: tài khoản doanh thu, thu nhập (loại 5, 7) ghi Nợ thì tính là giảm phát sinh Có;
  // tài khoản chi phí (loại 6, 8) ghi Có thì tính là giảm phát sinh Nợ (chỉ tiêu B02-DN lấy theo một bên phát sinh).
  private async extras(executor: Executor, id: string, ledger: Ledger): Promise<ExtraLine[]> {
    const codeOf = new Map(ledger.accounts.map((account) => [account.id, account.code]));
    const rows = (
      await executor.execute<{ account_id: string; partner_id: string | null; debit: string; credit: string }>(sql`
      SELECT account_id, partner_id, debit::text, credit::text FROM finance.consolidation_entries WHERE consolidation_id = ${id}`)
    ).rows.map((row) => ({ accountId: row.account_id, partnerKey: row.partner_id ?? "", debit: Number(row.debit), credit: Number(row.credit) }));
    const profits = (
      await executor.execute<{ buyer_company_id: string; amount: string }>(sql`
      SELECT buyer_company_id, sum(coalesce(override_amount, estimated_amount))::text AS amount FROM finance.consolidation_profit_lines WHERE consolidation_id = ${id} GROUP BY buyer_company_id`)
    ).rows;
    for (const profit of profits) {
      const amount = Number(profit.amount);
      if (amount <= 0) continue;
      rows.push({ accountId: await this.roleAccount(executor, profit.buyer_company_id, "cogs"), partnerKey: "", debit: amount, credit: 0 });
      rows.push({ accountId: await this.roleAccount(executor, profit.buyer_company_id, "goods"), partnerKey: "", debit: 0, credit: amount });
    }
    return rows
      .filter((row) => codeOf.has(row.accountId))
      .map((row) => {
        const type = codeOf.get(row.accountId)!.charAt(0);
        if ((type === "5" || type === "7") && row.debit > 0) return { ...row, debit: 0, credit: -row.debit };
        if ((type === "6" || type === "8") && row.credit > 0) return { ...row, debit: -row.credit, credit: 0 };
        return row;
      });
  }

  async detail(actor: Actor, id: string): Promise<ConsolidationResponse> {
    const granted = await this.requireGroupPermission(actor, consolidationPermissions.view, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    const row = await this.row(this.database, root.id, id);
    const { ledger, included, units } = await this.ledgerOf(actor.companyId, row.member_ids);
    const nameOf = new Map(included.map((member) => [member.id, member.short_name ?? member.legal_name]));
    let balanceSheet: ConsolidatedStatementResponse;
    let incomeStatement: ConsolidatedStatementResponse;
    if (row.status === "posted" && row.report) {
      ({ balanceSheet, incomeStatement } = row.report);
    } else {
      ledger.extras = await this.extras(this.database, id, ledger);
      balanceSheet = await this.report(actor, ledger, root, included, units, "balance_sheet", row.from_date, row.to_date);
      incomeStatement = await this.report(actor, ledger, root, included, units, "income_statement", row.from_date, row.to_date);
    }
    const entryRows = (
      await this.database.execute<{
        entry_no: number;
        kind: ConsolidationEntry["kind"];
        description: string;
        company_id: string;
        code: string;
        partner: string | null;
        debit: string;
        credit: string;
      }>(sql`
      SELECT e.entry_no, e.kind, e.description, e.company_id, a.code, p.name AS partner, e.debit::text, e.credit::text
      FROM finance.consolidation_entries e JOIN accounting.accounts a ON a.id = e.account_id LEFT JOIN crm.partners p ON p.id = e.partner_id
      WHERE e.consolidation_id = ${id} ORDER BY e.entry_no, e.debit DESC, a.code`)
    ).rows;
    const regimeOf = new Map(included.map((member) => [member.id, member.accounting_regime]));
    const entries: ConsolidationEntry[] = [];
    for (const item of entryRows) {
      let entry = entries.find((existing) => existing.entryNo === item.entry_no);
      if (!entry) {
        entry = { entryNo: item.entry_no, kind: item.kind, description: item.description, lines: [] };
        entries.push(entry);
      }
      entry.lines.push({
        companyName: nameOf.get(item.company_id) ?? "",
        accountCode: consolidatedCode(regimeOf.get(item.company_id) ?? consolidationRegime, item.code),
        partnerName: item.partner,
        debit: trimDecimal(item.debit),
        credit: trimDecimal(item.credit),
      });
    }
    const profitRows = (
      await this.database.execute<{
        id: string;
        buyer_company_id: string;
        seller_company_id: string;
        item_name: string;
        internal_quantity: string;
        ending_quantity: string;
        unit_margin: string;
        estimated_amount: string;
        override_amount: string | null;
        override_reason: string | null;
      }>(sql`
      SELECT l.id, l.buyer_company_id, l.seller_company_id, concat_ws(' · ', pr.name, v.sku) AS item_name, l.internal_quantity::text, l.ending_quantity::text, l.unit_margin::text,
        l.estimated_amount::text, l.override_amount::text, l.override_reason
      FROM finance.consolidation_profit_lines l JOIN catalog.variants v ON v.id = l.variant_id JOIN catalog.products pr ON pr.id = v.product_id
      WHERE l.consolidation_id = ${id} ORDER BY pr.name`)
    ).rows;
    const profitLines: ConsolidationProfitLine[] = profitRows.map((item) => ({
      id: item.id,
      buyerName: nameOf.get(item.buyer_company_id) ?? "",
      sellerName: nameOf.get(item.seller_company_id) ?? "",
      itemName: item.item_name,
      internalQuantity: trimDecimal(item.internal_quantity),
      endingQuantity: trimDecimal(item.ending_quantity),
      unitMargin: trimDecimal(item.unit_margin),
      estimatedAmount: trimDecimal(item.estimated_amount),
      overrideAmount: trimDecimal(item.override_amount),
      overrideReason: item.override_reason,
      effectiveAmount: trimDecimal(item.override_amount ?? item.estimated_amount),
    }));
    if (profitLines.some((line) => Number(line.effectiveAmount) > 0))
      entries.push({
        entryNo: 0,
        kind: "unrealized_profit",
        description: "Lãi chưa thực hiện trong hàng tồn kho",
        lines: [
          { companyName: "", accountCode: "632", partnerName: null, debit: trimDecimal(profitLines.reduce((total, line) => total + Number(line.effectiveAmount), 0).toFixed(4)), credit: "0" },
          { companyName: "", accountCode: "156", partnerName: null, debit: "0", credit: trimDecimal(profitLines.reduce((total, line) => total + Number(line.effectiveAmount), 0).toFixed(4)) },
        ],
      });
    const canManage = granted.has(consolidationPermissions.manage);
    return {
      ...this.listItem(row),
      memberNames: included.map((member) => member.short_name ?? member.legal_name),
      warnings: row.warnings,
      entries,
      profitLines,
      balanceSheet,
      incomeStatement,
      accountOptions: charts[consolidationRegime].accounts.map((account) => ({ code: account.code, name: account.name })),
      canManage,
      canEdit: canManage && ["draft", "rejected", "withdrawn"].includes(row.status),
      canWithdraw: canManage && row.status === "pending" && row.submitted_by === actor.userId && Boolean(row.approval_request_id),
      currency: root.base_currency,
      version: row.version,
    };
  }

  async saveProfit(actor: Actor, id: string, lineId: string, input: z.output<typeof saveConsolidationProfitSchema>): Promise<ConsolidationResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, root.id, id, true);
      this.requireEditable(row, input.version);
      if (input.amount !== null && !input.reason) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { reason: "required" } });
      const updated = await transaction.execute(sql`
        UPDATE finance.consolidation_profit_lines SET override_amount = ${input.amount}::numeric, override_reason = ${input.amount === null ? null : input.reason}
        WHERE id = ${lineId} AND consolidation_id = ${id}`);
      if ((updated.rowCount ?? 0) === 0) throw new ApiError("NOT_FOUND", "notFound");
      await transaction.execute(sql`UPDATE finance.consolidations SET version = version + 1 WHERE id = ${id}`);
      await this.auditService.record(
        { ...financeAudit(actor, "consolidation"), action: "consolidation.profit_override", entityId: id, beforeData: null, afterData: { lineId, amount: input.amount, reason: input.reason } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async addManual(actor: Actor, id: string, input: z.output<typeof consolidationManualEntrySchema>): Promise<ConsolidationResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, root.id, id, true);
      this.requireEditable(row, input.version);
      const fields: Record<string, "invalidValue"> = {};
      let debit = 0;
      let credit = 0;
      for (const [index, line] of input.lines.entries()) {
        if (Number(line.debit) > 0 === Number(line.credit) > 0) fields[`lines.${index}.debit`] = "invalidValue";
        debit += Number(line.debit);
        credit += Number(line.credit);
      }
      if (Math.abs(debit - credit) > 0.00005) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { lines: "journalUnbalanced" } });
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      // Tài khoản: tài khoản của thành viên (công ty gốc trước) có mã ghép theo Thông tư 99 trùng mã đã chọn.
      const { ledger, included } = await this.ledgerOf(actor.companyId, row.member_ids);
      const order = new Map(included.map((member, index) => [member.id, index]));
      const accounts = (
        await transaction.execute<{ id: string; company_id: string; code: string }>(sql`
        SELECT id, company_id, code FROM accounting.accounts WHERE id IN (${sql.join(
          ledger.accounts.map((account) => sql`${account.id}::uuid`),
          sql`, `,
        )})`)
      ).rows.sort((first, second) => order.get(first.company_id)! - order.get(second.company_id)!);
      const regimeOf = new Map(included.map((member) => [member.id, member.accounting_regime]));
      const resolved = input.lines.map((line, index) => {
        const account = accounts.find((item) => consolidatedCode(regimeOf.get(item.company_id)!, item.code) === line.accountCode);
        if (!account) fields[`lines.${index}.accountCode`] = "invalidValue";
        return { ...line, account };
      });
      if (Object.keys(fields).length > 0) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields });
      const entryNo =
        Number((await transaction.execute<{ next: number }>(sql`SELECT coalesce(max(entry_no), 0)::int AS next FROM finance.consolidation_entries WHERE consolidation_id = ${id}`)).rows[0]!.next) + 1;
      for (const line of resolved)
        await transaction.execute(sql`
          INSERT INTO finance.consolidation_entries (consolidation_id, entry_no, kind, company_id, account_id, debit, credit, description, created_by)
          VALUES (${id}, ${entryNo}, 'manual', ${line.account!.company_id}, ${line.account!.id}, ${line.debit}::numeric, ${line.credit}::numeric, ${input.description}, ${actor.userId})`);
      await transaction.execute(sql`UPDATE finance.consolidations SET version = version + 1 WHERE id = ${id}`);
      await this.auditService.record(
        { ...financeAudit(actor, "consolidation"), action: "consolidation.manual_entry", entityId: id, beforeData: null, afterData: { entryNo, description: input.description, lines: input.lines } },
        transaction,
      );
    });
    return this.detail(actor, id);
  }

  async removeManual(actor: Actor, id: string, entryNo: number, version: number): Promise<ConsolidationResponse> {
    await this.requireGroupPermission(actor, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    await this.database.transaction(async (transaction) => {
      const row = await this.row(transaction, root.id, id, true);
      this.requireEditable(row, version);
      const removed = await transaction.execute(sql`DELETE FROM finance.consolidation_entries WHERE consolidation_id = ${id} AND entry_no = ${entryNo} AND kind = 'manual'`);
      if ((removed.rowCount ?? 0) === 0) throw new ApiError("NOT_FOUND", "notFound");
      await transaction.execute(sql`UPDATE finance.consolidations SET version = version + 1 WHERE id = ${id}`);
      await this.auditService.record({ ...financeAudit(actor, "consolidation"), action: "consolidation.remove_manual_entry", entityId: id, beforeData: { entryNo }, afterData: null }, transaction);
    });
    return this.detail(actor, id);
  }

  async discard(actor: Actor, id: string, version: number): Promise<void> {
    await this.requireGroupPermission(actor, consolidationPermissions.manage);
    const root = await this.rootOf(actor.companyId);
    await this.database.transaction(async (transaction) => {
      const removed = await transaction.execute(sql`
        DELETE FROM finance.consolidations WHERE id = ${id} AND group_company_id = ${root.id} AND status = 'draft' AND document_no IS NULL AND version = ${version}`);
      if ((removed.rowCount ?? 0) === 0) throw new ApiError("CONFLICT_VERSION", "conflictVersion");
      await this.auditService.record({ ...financeAudit(actor, "consolidation"), action: "consolidation.discard", entityId: id, beforeData: null, afterData: null }, transaction);
    });
  }
}

type Executor = Pick<Database, "execute">;
type ConsolidationRow = {
  id: string;
  group_company_id: string;
  from_date: string;
  to_date: string;
  document_no: string | null;
  status: ConsolidationListItem["status"];
  member_ids: string[];
  warnings: ConsolidationWarning[];
  report: { balanceSheet: ConsolidatedStatementResponse; incomeStatement: ConsolidatedStatementResponse } | null;
  calculated_at: string | null;
  approval_request_id: string | null;
  post_error: string | null;
  created_by: string;
  submitted_by: string | null;
  version: number;
};
