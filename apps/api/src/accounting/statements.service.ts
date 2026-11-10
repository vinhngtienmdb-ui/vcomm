// Báo cáo tài chính (CONG_VIEC_15; CHUC_NANG_74, 75; QUYTAC_NGHIEPVU_99 đến 102; API_90): tính chỉ tiêu theo mẫu của chế độ kế toán từ sổ cái.
import { Inject, Injectable } from "@nestjs/common";
import type { AccountingRegime, StatementKind, StatementResponse } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { ledgerPermissions } from "./ledger.service";
import { statementTemplates, type StatementFormula, type StatementLine, type StatementTemplate } from "./statement-templates";

type Account = { id: string; code: string; parentId: string | null; longTerm: boolean };
type Scope = "all" | "short" | "long";
const round = (value: number) => Math.round(value * 10000) / 10000;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const shiftYear = (date: string, years: number) => {
  const [year, month, dayOfMonth] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year + years, month - 1, dayOfMonth));
  // 29/02 lùi về năm không nhuận thành 28/02.
  if (target.getUTCMonth() !== month - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
};

@Injectable()
export class StatementsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  private async context(actor: Actor) {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view);
    const company = (
      await this.database.execute<{
        legal_name: string;
        tax_code: string | null;
        address: string | null;
        base_currency: string;
        accounting_regime: AccountingRegime;
        fiscal_year_start: number;
        initialized: boolean;
      }>(sql`
      SELECT c.legal_name, c.tax_code, c.address, c.base_currency, c.accounting_regime, c.fiscal_year_start, EXISTS (SELECT 1 FROM accounting.settings s WHERE s.company_id = c.id) AS initialized
      FROM core.companies c WHERE c.id = ${actor.companyId}`)
    ).rows[0]!;
    if (!company.initialized) throw new ApiError("BUSINESS_RULE", "ledgerNotInitialized");
    const rows = await this.database.execute<{ id: string; code: string; parent_id: string | null; is_long_term: boolean }>(sql`
      SELECT id, code, parent_id, is_long_term FROM accounting.accounts WHERE company_id = ${actor.companyId}`);
    const byId = new Map(rows.rows.map((row) => [row.id, row]));
    // Dài hạn: tài khoản được đánh dấu hoặc nằm dưới tài khoản được đánh dấu.
    const longTerm = (id: string | null): boolean => (id ? (byId.get(id)!.is_long_term ? true : longTerm(byId.get(id)!.parent_id)) : false);
    const accounts: Account[] = rows.rows.map((row) => ({ id: row.id, code: row.code, parentId: row.parent_id, longTerm: longTerm(row.id) }));
    const retained = (await this.database.execute<{ account_id: string }>(sql`SELECT account_id FROM accounting.posting_rules WHERE company_id = ${actor.companyId} AND role = 'retained_earnings'`))
      .rows[0]!.account_id;
    return { company, accounts, retained };
  }

  // Tài khoản thuộc từng mã trong công thức (gồm tài khoản chi tiết); tài khoản khớp nhiều mã thì thuộc mã dài nhất.
  private groups(accounts: Account[], codes: string[], scope: Scope): Map<string, Account[]> {
    const result = new Map<string, Account[]>(codes.map((code) => [code, []]));
    for (const account of accounts) {
      if (scope === "short" && account.longTerm) continue;
      if (scope === "long" && !account.longTerm) continue;
      const match = codes.filter((code) => account.code.startsWith(code)).sort((a, b) => b.length - a.length)[0];
      if (match) result.get(match)!.push(account);
    }
    return result;
  }

  // Số dư cuối ngày theo tài khoản, đối tác; số dư tài khoản loại 5 đến 9 (chưa kết chuyển) cộng vào lợi nhuận chưa phân phối năm nay (QUYTAC_NGHIEPVU_100).
  private async balances(companyId: string, date: string, accounts: Account[], retained: string): Promise<Map<string, Map<string, number>>> {
    const rows = await this.database.execute<{ account_id: string; partner_id: string | null; net: string }>(sql`
      SELECT l.account_id, l.partner_id, sum(l.debit - l.credit)::text AS net
      FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
      WHERE j.company_id = ${companyId} AND j.status = 'posted' AND j.journal_date <= ${date}::date
      GROUP BY l.account_id, l.partner_id`);
    const codeOf = new Map(accounts.map((account) => [account.id, account.code]));
    const result = new Map<string, Map<string, number>>();
    const add = (accountId: string, partner: string, value: number) => {
      const target = result.get(accountId) ?? new Map<string, number>();
      target.set(partner, (target.get(partner) ?? 0) + value);
      result.set(accountId, target);
    };
    for (const row of rows.rows) {
      const value = Number(row.net);
      if ("56789".includes(codeOf.get(row.account_id)!.charAt(0))) add(retained, "", value);
      else add(row.account_id, row.partner_id ?? "", value);
    }
    return result;
  }

  private balanceValue(formula: StatementFormula, accounts: Account[], balances: Map<string, Map<string, number>>, scope: Scope): number {
    const net = (items: Account[]) => items.reduce((total, account) => total + [...(balances.get(account.id)?.values() ?? [])].reduce((sum, value) => sum + value, 0), 0);
    const byPartner = (items: Account[], sign: 1 | -1) =>
      items.reduce((total, account) => total + [...(balances.get(account.id)?.values() ?? [])].reduce((sum, value) => sum + Math.max(sign * value, 0), 0), 0);
    let value = 0;
    for (const items of this.groups(accounts, formula.debitBalance ?? [], scope).values()) value += Math.max(net(items), 0);
    for (const items of this.groups(accounts, formula.creditBalance ?? [], scope).values()) value += Math.max(-net(items), 0);
    for (const items of this.groups(accounts, formula.debitBalanceByPartner ?? [], scope).values()) value += byPartner(items, 1);
    for (const items of this.groups(accounts, formula.creditBalanceByPartner ?? [], scope).values()) value += byPartner(items, -1);
    // Bù trừ Nợ trừ Có; chỉ tiêu bên nguồn vốn dùng "negative" để dư Có thành số dương.
    for (const items of this.groups(accounts, formula.netBalance ?? [], scope).values()) value += net(items);
    return formula.negative ? -value : value;
  }

  // Phát sinh trong kỳ, không tính bút toán kết chuyển (QUYTAC_NGHIEPVU_100).
  private async turnovers(companyId: string, from: string, to: string): Promise<Map<string, { debit: number; credit: number }>> {
    const rows = await this.database.execute<{ account_id: string; debit: string; credit: string }>(sql`
      SELECT l.account_id, sum(l.debit)::text AS debit, sum(l.credit)::text AS credit
      FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
      WHERE j.company_id = ${companyId} AND j.status = 'posted' AND j.source_type <> 'closing' AND j.journal_date BETWEEN ${from}::date AND ${to}::date
      GROUP BY l.account_id`);
    return new Map(rows.rows.map((row) => [row.account_id, { debit: Number(row.debit), credit: Number(row.credit) }]));
  }

  // Phát sinh của một bên trên các tài khoản, chỉ dòng có tài khoản đối ứng (bên kia của cùng bút toán) thuộc danh sách.
  private async counterTurnover(companyId: string, from: string, to: string, accountIds: string[], counterIds: string[], side: "debit" | "credit"): Promise<number> {
    if (accountIds.length === 0 || counterIds.length === 0) return 0;
    const own = side === "debit" ? sql`l.debit` : sql`l.credit`;
    const other = side === "debit" ? sql`o.credit` : sql`o.debit`;
    const row = (
      await this.database.execute<{ value: string }>(sql`
      SELECT coalesce(sum(${own}), 0)::text AS value FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
      WHERE j.company_id = ${companyId} AND j.status = 'posted' AND j.source_type <> 'closing' AND j.journal_date BETWEEN ${from}::date AND ${to}::date
        AND l.account_id IN ${sql`(${sql.join(
          accountIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`} AND ${own} > 0
        AND EXISTS (SELECT 1 FROM accounting.journal_lines o WHERE o.journal_id = l.journal_id AND ${other} > 0
          AND o.account_id IN ${sql`(${sql.join(
            counterIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`})`)
    ).rows[0]!;
    return Number(row.value);
  }

  // Chỉ tiêu kết quả kinh doanh: phát sinh đối ứng 911 (hoặc 521) tính như đã kết chuyển: phát sinh thuần của tài khoản trong kỳ.
  private async incomeValue(companyId: string, from: string, to: string, formula: StatementFormula, accounts: Account[], turnovers: Map<string, { debit: number; credit: number }>): Promise<number> {
    const ids = (codes: string[] | undefined) => [...this.groups(accounts, codes ?? [], "all").values()].flat().map((account) => account.id);
    const sumOf = (codes: string[] | undefined, pick: (value: { debit: number; credit: number }) => number) =>
      ids(codes).reduce((total, id) => total + (turnovers.has(id) ? pick(turnovers.get(id)!) : 0), 0);
    const counter = formula.counter ?? [];
    if (counter.includes("911")) {
      if (formula.creditTurnover) return sumOf(formula.creditTurnover, (value) => value.debit - value.credit);
      if (formula.debitTurnover) return sumOf(formula.debitTurnover, (value) => value.credit - value.debit);
    }
    if (counter.length === 1 && counter[0] === "521" && formula.debitTurnover) return sumOf(["521"], (value) => value.debit - value.credit);
    if (counter.length > 0) {
      const side = formula.debitTurnover ? "debit" : "credit";
      return this.counterTurnover(companyId, from, to, ids(formula.debitTurnover ?? formula.creditTurnover), ids(counter), side);
    }
    // Loại đối ứng 911, 521: chỉ có ở bút toán kết chuyển, đã không tính.
    if (formula.creditTurnover) return sumOf(formula.creditTurnover, (value) => value.credit);
    if (formula.debitTurnover) return sumOf(formula.debitTurnover, (value) => value.debit);
    return 0;
  }

  // Tính các chỉ tiêu theo thứ tự phụ thuộc (tổng tính sau các chỉ tiêu thành phần).
  private evaluate(template: StatementTemplate, base: (line: StatementLine) => number): Map<string, number> {
    const byCode = new Map(template.lines.map((line) => [line.code, line]));
    const values = new Map<string, number>();
    const visit = (code: string, trail: Set<string>): number => {
      if (values.has(code)) return values.get(code)!;
      const line = byCode.get(code);
      if (!line || trail.has(code)) return 0;
      trail.add(code);
      const formula = line.formula ?? {};
      let value = formula.sum || formula.minus ? 0 : base(line);
      for (const item of formula.sum ?? []) value += visit(item, trail);
      for (const item of formula.minus ?? []) value -= visit(item, trail);
      values.set(code, round(value));
      return values.get(code)!;
    };
    for (const line of template.lines) visit(line.code, new Set());
    return values;
  }

  private template(regime: AccountingRegime, kind: StatementKind, form: string | undefined): StatementTemplate {
    const templates = statementTemplates[regime];
    if (kind === "income_statement") return templates.incomeStatement;
    if (form && templates.balanceSheetB01b && form === templates.balanceSheetB01b.form) return templates.balanceSheetB01b;
    return templates.balanceSheet;
  }

  async statement(actor: Actor, kind: StatementKind, from: string, to: string, form?: string): Promise<StatementResponse> {
    const { company, accounts, retained } = await this.context(actor);
    if (from > to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "endBeforeStart" } });
    const template = this.template(company.accounting_regime, kind, form);
    const templates = statementTemplates[company.accounting_regime];
    const forms = kind === "balance_sheet" ? [templates.balanceSheet.form, ...(templates.balanceSheetB01b ? [templates.balanceSheetB01b.form] : [])] : [templates.incomeStatement.form];
    let current: Map<string, number>;
    let previous: Map<string, number>;
    let columns: { label: string; from: string | null; to: string }[];
    if (kind === "balance_sheet") {
      // Số đầu năm: cuối ngày trước ngày đầu năm tài chính chứa ngày báo cáo (QUYTAC_NGHIEPVU_102).
      const month = String(company.fiscal_year_start).padStart(2, "0");
      let yearStart = `${to.slice(0, 4)}-${month}-01`;
      if (yearStart > to) yearStart = `${Number(to.slice(0, 4)) - 1}-${month}-01`;
      const openingDate = addDays(yearStart, -1);
      const compute = async (date: string) => {
        const balances = await this.balances(actor.companyId, date, accounts, retained);
        const byCode = new Map(template.lines.map((line) => [line.code, line]));
        const twins = new Set(template.lines.filter((line) => line.longTermOf).map((line) => line.longTermOf!));
        return this.evaluate(template, (line) => {
          if (line.longTermOf) {
            const twin = byCode.get(line.longTermOf);
            return twin?.formula ? this.balanceValue(twin.formula, accounts, balances, "long") : 0;
          }
          return line.formula ? this.balanceValue(line.formula, accounts, balances, twins.has(line.code) ? "short" : "all") : 0;
        });
      };
      current = await compute(to);
      previous = await compute(openingDate);
      columns = [
        { label: "endOfPeriod", from: null, to },
        { label: "startOfYear", from: null, to: openingDate },
      ];
    } else {
      const compute = async (start: string, end: string) => {
        const turnovers = await this.turnovers(actor.companyId, start, end);
        const bases = new Map<string, number>();
        for (const line of template.lines)
          if (line.formula && !line.formula.sum && !line.formula.minus) bases.set(line.code, await this.incomeValue(actor.companyId, start, end, line.formula, accounts, turnovers));
        return this.evaluate(template, (line) => bases.get(line.code) ?? 0);
      };
      const previousFrom = shiftYear(from, -1);
      const previousTo = shiftYear(to, -1);
      current = await compute(from, to);
      previous = await compute(previousFrom, previousTo);
      columns = [
        { label: "currentPeriod", from, to },
        { label: "previousPeriod", from: previousFrom, to: previousTo },
      ];
    }
    const units = Number((await this.database.execute<{ units: number }>(sql`SELECT finance.company_minor_units(${actor.companyId}) AS units`)).rows[0]!.units);
    const money = (value: number) => trimDecimal((Math.round(value * 10 ** units) / 10 ** units).toFixed(Math.max(units, 0)));
    return {
      kind,
      form: template.form,
      name: template.name,
      forms,
      regime: company.accounting_regime,
      company: { name: company.legal_name, taxCode: company.tax_code, address: company.address },
      currency: company.base_currency,
      columns,
      lines: template.lines.map((line) => ({
        code: line.code,
        name: line.name,
        level: line.level,
        note: line.note ?? null,
        current: money(current.get(line.code) ?? 0),
        previous: money(previous.get(line.code) ?? 0),
      })),
    };
  }
}
