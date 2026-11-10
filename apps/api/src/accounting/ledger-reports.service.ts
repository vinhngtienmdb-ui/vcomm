// Bảng cân đối số phát sinh, sổ cái tài khoản (CONG_VIEC_14; CHUC_NANG_73; QUYTAC_NGHIEPVU_98; API_89).
import { Inject, Injectable } from "@nestjs/common";
import type { AccountLedgerResponse, TrialBalanceResponse, TrialBalanceRow } from "contracts";
import { sql } from "drizzle-orm";
import { trimDecimal } from "../catalog/catalog-context";
import { day } from "../catalog/price-lists.service";
import { ApiError } from "../common/api-error";
import { DATABASE, type Database } from "../database/database.module";
import { requireFinancePermission } from "../finance/finance-context";
import { PermissionService } from "../permissions/permission.service";
import type { Actor } from "../permissions/roles.service";
import { companyCurrency } from "../purchasing/requisitions.service";
import { ledgerPermissions } from "./ledger.service";

const round = (value: number) => Math.round(value * 10000) / 10000;
const text = (value: number) => trimDecimal(round(value).toFixed(4));
type Amounts = { openingDebit: number; openingCredit: number; debit: number; credit: number; closingDebit: number; closingCredit: number };
const zero = (): Amounts => ({ openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 });

@Injectable()
export class LedgerReportsService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly permissionService: PermissionService,
  ) {}

  // Số dư tách bên Nợ, bên Có; tài khoản lưỡng tính có đối tác tính theo từng đối tác (QUYTAC_NGHIEPVU_98).
  async trialBalance(actor: Actor, from: string, to: string): Promise<TrialBalanceResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view);
    if (from > to) throw new ApiError("VALIDATION_FAILED", "validationFailed", { fields: { to: "endBeforeStart" } });
    const accounts = (
      await this.database.execute<{ id: string; code: string; name: string; parent_id: string | null; nature: string }>(sql`
      SELECT id, code, name, parent_id, nature FROM accounting.accounts WHERE company_id = ${actor.companyId} ORDER BY code`)
    ).rows;
    const movements = await this.database.execute<{ account_id: string; partner_id: string | null; opening: string; debit: string; credit: string }>(sql`
      SELECT l.account_id, l.partner_id,
        sum(CASE WHEN j.journal_date < ${from}::date THEN l.debit - l.credit ELSE 0 END)::text AS opening,
        sum(CASE WHEN j.journal_date >= ${from}::date THEN l.debit ELSE 0 END)::text AS debit,
        sum(CASE WHEN j.journal_date >= ${from}::date THEN l.credit ELSE 0 END)::text AS credit
      FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
      WHERE j.company_id = ${actor.companyId} AND j.status = 'posted' AND j.journal_date <= ${to}::date
      GROUP BY l.account_id, l.partner_id`);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const amounts = new Map<string, Amounts>();
    const add = (accountId: string, value: Amounts) => {
      for (let current: string | null = accountId; current; current = byId.get(current)?.parent_id ?? null) {
        const target = amounts.get(current) ?? zero();
        for (const key of Object.keys(value) as (keyof Amounts)[]) target[key] += value[key];
        amounts.set(current, target);
      }
    };
    // Tài khoản lưỡng tính: số dư từng đối tác giữ nguyên bên; tài khoản khác: số dư bù trừ trong tài khoản.
    const netted = new Map<string, { opening: number; debit: number; credit: number }>();
    for (const row of movements.rows) {
      const opening = Number(row.opening);
      const debit = Number(row.debit);
      const credit = Number(row.credit);
      if (byId.get(row.account_id)?.nature === "both" && row.partner_id) {
        const closing = opening + debit - credit;
        add(row.account_id, {
          openingDebit: Math.max(opening, 0),
          openingCredit: Math.max(-opening, 0),
          debit,
          credit,
          closingDebit: Math.max(closing, 0),
          closingCredit: Math.max(-closing, 0),
        });
      } else {
        const current = netted.get(row.account_id) ?? { opening: 0, debit: 0, credit: 0 };
        netted.set(row.account_id, { opening: current.opening + opening, debit: current.debit + debit, credit: current.credit + credit });
      }
    }
    for (const [accountId, value] of netted) {
      const closing = value.opening + value.debit - value.credit;
      add(accountId, {
        openingDebit: Math.max(value.opening, 0),
        openingCredit: Math.max(-value.opening, 0),
        debit: value.debit,
        credit: value.credit,
        closingDebit: Math.max(closing, 0),
        closingCredit: Math.max(-closing, 0),
      });
    }
    const depth = (id: string): number => {
      const parent = byId.get(id)?.parent_id;
      return parent ? depth(parent) + 1 : 0;
    };
    const toText = (value: Amounts) => ({
      openingDebit: text(value.openingDebit),
      openingCredit: text(value.openingCredit),
      debit: text(value.debit),
      credit: text(value.credit),
      closingDebit: text(value.closingDebit),
      closingCredit: text(value.closingCredit),
    });
    const rows: TrialBalanceRow[] = accounts
      .filter((account) => amounts.has(account.id) && Object.values(amounts.get(account.id)!).some((value) => Math.abs(value) > 0.00005))
      .map((account) => ({ accountId: account.id, code: account.code, name: account.name, depth: depth(account.id), ...toText(amounts.get(account.id)!) }));
    const totals = zero();
    for (const account of accounts.filter((item) => !item.parent_id)) {
      const value = amounts.get(account.id);
      if (value) for (const key of Object.keys(totals) as (keyof Amounts)[]) totals[key] += value[key];
    }
    return { from, to, currency: await companyCurrency(this.database, actor.companyId), rows, totals: toText(totals) };
  }

  // Sổ cái một tài khoản (gồm tài khoản chi tiết): số dư đầu, từng dòng kèm tài khoản đối ứng, số dư lũy kế theo bên Nợ (số âm là dư Có).
  async accountLedger(actor: Actor, accountId: string, from: string, to: string): Promise<AccountLedgerResponse> {
    await requireFinancePermission(this.permissionService, actor, ledgerPermissions.view);
    const account = (
      await this.database.execute<{ id: string; code: string; name: string; nature: "debit" | "credit" | "both" }>(sql`
      SELECT id, code, name, nature FROM accounting.accounts WHERE id = ${accountId} AND company_id = ${actor.companyId}`)
    ).rows[0];
    if (!account) throw new ApiError("NOT_FOUND", "notFound");
    const scope = sql`(WITH RECURSIVE tree AS (SELECT id FROM accounting.accounts WHERE id = ${accountId} UNION ALL SELECT c.id FROM accounting.accounts c JOIN tree t ON c.parent_id = t.id) SELECT id FROM tree)`;
    const opening = Number(
      (
        await this.database.execute<{ value: string }>(sql`
        SELECT coalesce(sum(l.debit - l.credit), 0)::text AS value FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id
        WHERE j.company_id = ${actor.companyId} AND j.status = 'posted' AND j.journal_date < ${from}::date AND l.account_id IN ${scope}`)
      ).rows[0]!.value,
    );
    const rows = await this.database.execute<{
      journal_id: string;
      journal_no: string | null;
      journal_date: string;
      description: string;
      code: string;
      partner_name: string | null;
      debit: string;
      credit: string;
      counter: string[] | null;
    }>(sql`
      SELECT j.id AS journal_id, j.journal_no, j.journal_date::text, coalesce(l.description, j.description) AS description, a.code, p.name AS partner_name, l.debit::text, l.credit::text,
        (SELECT array_agg(DISTINCT oa.code ORDER BY oa.code) FROM accounting.journal_lines o JOIN accounting.accounts oa ON oa.id = o.account_id
         WHERE o.journal_id = j.id AND ((l.debit > 0 AND o.credit > 0) OR (l.credit > 0 AND o.debit > 0))) AS counter
      FROM accounting.journal_lines l JOIN accounting.journals j ON j.id = l.journal_id JOIN accounting.accounts a ON a.id = l.account_id LEFT JOIN crm.partners p ON p.id = l.partner_id
      WHERE j.company_id = ${actor.companyId} AND j.status = 'posted' AND j.journal_date BETWEEN ${from}::date AND ${to}::date AND l.account_id IN ${scope}
      ORDER BY j.journal_date, j.created_at, l.line_no
      LIMIT 10000`);
    let balance = opening;
    let totalDebit = 0;
    let totalCredit = 0;
    const entries = rows.rows.map((row) => {
      balance += Number(row.debit) - Number(row.credit);
      totalDebit += Number(row.debit);
      totalCredit += Number(row.credit);
      return {
        journalId: row.journal_id,
        journalNo: row.journal_no,
        journalDate: day(row.journal_date),
        description: row.description,
        accountCode: row.code,
        counterAccounts: row.counter ?? [],
        partnerName: row.partner_name,
        debit: trimDecimal(row.debit),
        credit: trimDecimal(row.credit),
        balance: text(balance),
      };
    });
    return {
      account,
      from,
      to,
      currency: await companyCurrency(this.database, actor.companyId),
      openingBalance: text(opening),
      entries,
      totalDebit: text(totalDebit),
      totalCredit: text(totalCredit),
      closingBalance: text(balance),
    };
  }
}
