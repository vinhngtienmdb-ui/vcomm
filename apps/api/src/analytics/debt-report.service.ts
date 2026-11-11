// Báo cáo công nợ theo tuổi nợ (CONG_VIEC_50; CHUC_NANG_177; QUYTAC_NGHIEPVU_338, 339, 341; API_173).
// Dùng nguyên biểu thức tuổi nợ của sổ công nợ (QUYTAC_NGHIEPVU_91) tại ngày hôm nay.
import { Inject, Injectable } from "@nestjs/common";
import { analyticsDisplayRows, type AnalyticsDebtResponse, type AnalyticsDebtRow, type analyticsDebtQuerySchema, type DebtSide } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { DATABASE, type Database } from "../database/database.module";
import { ageingColumns, type AgeingRow } from "../finance/debts.service";
import type { Actor } from "../permissions/roles.service";
import type { ExportTable } from "./analytics-export";
import { AnalyticsScopeService } from "./analytics-scope.service";
import { subtract, uuidList } from "./sales-report.service";

type DebtQuery = z.infer<typeof analyticsDebtQuerySchema>;
type FigureRow = AgeingRow & { internal_balance: string };

@Injectable()
export class DebtReportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly scopeService: AnalyticsScopeService,
  ) {}

  async report(actor: Actor, query: DebtQuery, allRows = false): Promise<AnalyticsDebtResponse> {
    const scope = await this.scopeService.resolve(actor, "debt", query.companyIds);
    const today = this.scopeService.today();
    const companies = uuidList(scope.companies.map((company) => company.id));
    const sameCurrency = uuidList(scope.companies.filter((company) => company.inTotal).map((company) => company.id));
    const internal = sql`coalesce(sum(CASE WHEN i.direction = 'debit' THEN i.open_amount ELSE -i.open_amount END) FILTER (WHERE p.company_id IN (${uuidList(scope.groupCompanyIds)})), 0)::text AS internal_balance`;
    const from = sql`FROM finance.debt_items i JOIN crm.partners p ON p.id = i.partner_id JOIN core.companies c ON c.id = i.company_id`;
    const key = query.groupBy === "company" ? sql`i.company_id::text` : sql`i.partner_id::text || ':' || i.company_id::text`;
    const label = query.groupBy === "company" ? sql`min(c.code || ' · ' || coalesce(c.short_name, c.legal_name))` : sql`min(p.code || ' · ' || p.name || ' (' || c.code || ')')`;
    const rows = (
      await this.database.execute<FigureRow & { key: string; label: string; currency: string }>(sql`
      SELECT ${key} AS key, ${label} AS label, c.base_currency AS currency, ${ageingColumns(today)}, ${internal}
      ${from}
      WHERE i.company_id IN (${companies}) AND i.side = ${query.side} AND i.open_amount > 0
      GROUP BY 1, c.base_currency`)
    ).rows;
    const order = new Map(scope.companies.map((company, index) => [company.id, index]));
    const sorted: AnalyticsDebtRow[] = rows.map((row) => ({ key: row.key, label: row.label, currency: row.currency, inTotal: row.currency === scope.group.currency, ...this.toFigures(row) }));
    if (query.groupBy === "company") sorted.sort((a, b) => order.get(a.key)! - order.get(b.key)!);
    else sorted.sort((a, b) => Number(b.balance) - Number(a.balance) || a.label.localeCompare(b.label));
    const total = (
      await this.database.execute<FigureRow>(sql`
      SELECT ${ageingColumns(today)}, ${internal} ${from}
      WHERE i.company_id IN (${sameCurrency}) AND i.side = ${query.side} AND i.open_amount > 0`)
    ).rows[0]!;
    const totals = this.toFigures(total);
    const sides = (
      await this.database.execute<AgeingRow & { side: DebtSide; overdue: string }>(sql`
      SELECT i.side, ${ageingColumns(today)}, coalesce(sum(i.open_amount) FILTER (WHERE i.direction = 'debit' AND i.due_date < ${today}::date), 0)::text AS overdue
      FROM finance.debt_items i
      WHERE i.company_id IN (${sameCurrency}) AND i.open_amount > 0 GROUP BY i.side`)
    ).rows;
    const summary = Object.fromEntries(
      (["receivable", "payable"] as const).map((side) => {
        const row = sides.find((item) => item.side === side);
        return [side, { balance: trimDecimal(row?.balance ?? "0"), overdue: trimDecimal(row?.overdue ?? "0") }];
      }),
    ) as AnalyticsDebtResponse["summary"];
    return {
      today,
      side: query.side,
      groupBy: query.groupBy,
      currency: scope.group.currency,
      companies: scope.companies,
      summary,
      rows: allRows ? sorted : sorted.slice(0, analyticsDisplayRows),
      totals: { ...totals, balanceExcludingInternal: trimDecimal(subtract(totals.balance, totals.internalBalance)) },
      totalRows: sorted.length > analyticsDisplayRows ? sorted.length : null,
    };
  }

  private toFigures(row: FigureRow) {
    return {
      balance: trimDecimal(row.balance),
      notDue: trimDecimal(row.not_due),
      overdue1To30: trimDecimal(row.overdue_1_30),
      overdue31To60: trimDecimal(row.overdue_31_60),
      overdue61To90: trimDecimal(row.overdue_61_90),
      overdueOver90: trimDecimal(row.overdue_over_90),
      advance: trimDecimal(row.advance),
      internalBalance: trimDecimal(row.internal_balance),
    };
  }

  exportTable(report: AnalyticsDebtResponse): ExportTable {
    const titles = ["Số dư", "Chưa đến hạn", "Quá hạn 1–30 ngày", "31–60 ngày", "61–90 ngày", "Trên 90 ngày", "Trả trước", "Trong đó nội bộ"];
    const line = (row: AnalyticsDebtResponse["totals"]) => [row.balance, row.notDue, row.overdue1To30, row.overdue31To60, row.overdue61To90, row.overdueOver90, row.advance, row.internalBalance];
    return {
      title: report.side === "receivable" ? "Công nợ phải thu theo tuổi nợ" : "Công nợ phải trả theo tuổi nợ",
      notes: [
        `Công ty: ${report.companies.map((company) => company.code).join(", ")}`,
        `Tại ngày ${report.today.split("-").reverse().join("/")}`,
        `Đơn vị tiền: ${report.currency}; dòng khác đồng tiền không cộng vào tổng.`,
      ],
      columns: [{ title: report.groupBy === "company" ? "Công ty" : "Đối tác" }, { title: "Đồng tiền" }, ...titles.map((title) => ({ title, numeric: true }))],
      rows: report.rows.map((row) => [row.label, row.currency, ...line({ ...row, balanceExcludingInternal: "" })]),
      totals: [
        ["Cộng các công ty", report.currency, ...line(report.totals)],
        ["Tổng loại trừ nội bộ", report.currency, report.totals.balanceExcludingInternal, null, null, null, null, null, null, null],
      ],
    };
  }
}
