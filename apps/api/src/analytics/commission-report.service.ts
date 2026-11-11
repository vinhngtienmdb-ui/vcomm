// Báo cáo hoa hồng và ví (CONG_VIEC_50; CHUC_NANG_177; QUYTAC_NGHIEPVU_342, 343; API_174).
// Hoa hồng thuộc công ty có đơn VComm; đã ghi có, rút tiền đã chi theo kỳ; đang chờ, số dư ví tại hôm nay. Người hưởng chỉ hiện họ tên.
import { Inject, Injectable } from "@nestjs/common";
import { analyticsDisplayRows, commissionShares, type AnalyticsCommissionResponse, type analyticsCommissionQuerySchema } from "contracts";
import { sql } from "drizzle-orm";
import type { z } from "zod";
import { trimDecimal } from "../catalog/catalog-context";
import { DATABASE, type Database } from "../database/database.module";
import { estimate } from "../marketplace/commissions.service";
import type { Actor } from "../permissions/roles.service";
import { periodNote, type ExportTable } from "./analytics-export";
import { AnalyticsScopeService, requirePeriod } from "./analytics-scope.service";
import { uuidList } from "./sales-report.service";

type CommissionQuery = z.infer<typeof analyticsCommissionQuerySchema>;
const shareNames: Record<string, string> = { referral: "Giới thiệu", staff: "Nhân viên", team_head: "Trưởng nhóm", regional_director: "Giám đốc vùng", director: "Giám đốc" };

@Injectable()
export class CommissionReportService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly scopeService: AnalyticsScopeService,
  ) {}

  async report(actor: Actor, query: CommissionQuery, allRows = false): Promise<AnalyticsCommissionResponse> {
    requirePeriod(query.from, query.to);
    const scope = await this.scopeService.resolve(actor, "commission", query.companyIds);
    const companies = uuidList(scope.companies.map((company) => company.id));
    const start = sql`(${query.from}::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const end = sql`((${query.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const credited = sql`
      FROM marketplace.order_commissions c JOIN marketplace.orders m ON m.id = c.order_id JOIN core.users u ON u.id = c.beneficiary_user_id
      WHERE m.company_id IN (${companies}) AND c.status = 'credited' AND c.credited_at >= ${start} AND c.credited_at < ${end}`;
    const key = query.groupBy === "share" ? sql`c.share` : sql`c.beneficiary_user_id::text`;
    const rows = (
      await this.database.execute<{ key: string; label: string; lines: number; amount: string }>(sql`
      SELECT ${key} AS key, ${query.groupBy === "share" ? sql`c.share` : sql`min(u.full_name)`} AS label, count(*)::int AS lines, sum(c.amount)::text AS amount
      ${credited} GROUP BY 1`)
    ).rows.map((row) => ({ ...row, label: query.groupBy === "share" ? (shareNames[row.key] ?? row.key) : row.label, amount: trimDecimal(row.amount) }));
    if (query.groupBy === "share") rows.sort((a, b) => commissionShares.indexOf(a.key as never) - commissionShares.indexOf(b.key as never));
    else rows.sort((a, b) => Number(b.amount) - Number(a.amount) || a.label.localeCompare(b.label));
    const totals = (await this.database.execute<{ lines: number; amount: string }>(sql`SELECT count(*)::int AS lines, coalesce(sum(c.amount), 0)::text AS amount ${credited}`)).rows[0]!;
    const pending = (
      await this.database.execute<{ amount: string }>(sql`
      SELECT coalesce(sum(${estimate}), 0)::text AS amount
      FROM marketplace.order_commissions c JOIN sales.order_lines l ON l.id = c.order_line_id JOIN marketplace.orders m ON m.id = c.order_id
      WHERE m.company_id IN (${companies}) AND c.status = 'pending' AND m.status <> 'cancelled'`)
    ).rows[0]!;
    const paidFilter = sql`w.company_id IN (${companies}) AND w.status = 'paid' AND w.paid_on BETWEEN ${query.from}::date AND ${query.to}::date`;
    const paid = (
      await this.database.execute<{ count: number; amount: string; tax_amount: string; fee_amount: string; net_amount: string }>(sql`
      SELECT count(*)::int AS count, coalesce(sum(w.amount), 0)::text AS amount, coalesce(sum(w.tax_amount), 0)::text AS tax_amount,
        coalesce(sum(w.fee_amount), 0)::text AS fee_amount, coalesce(sum(w.net_amount), 0)::text AS net_amount
      FROM marketplace.withdrawals w WHERE ${paidFilter}`)
    ).rows[0]!;
    const waiting = (
      await this.database.execute<{ count: number; amount: string }>(sql`
      SELECT count(*)::int AS count, coalesce(sum(w.amount), 0)::text AS amount FROM marketplace.withdrawals w WHERE w.company_id IN (${companies}) AND w.status = 'pending'`)
    ).rows[0]!;
    // Ví thuộc người hưởng, gắn với công ty vận hành VComm.
    const operatorInScope = (await this.database.execute<{ found: boolean }>(sql`SELECT EXISTS (SELECT 1 FROM core.companies WHERE is_marketplace_operator AND id IN (${companies})) AS found`))
      .rows[0]!.found;
    const wallet = operatorInScope ? (await this.database.execute<{ balance: string }>(sql`SELECT coalesce(sum(balance), 0)::text AS balance FROM marketplace.wallets`)).rows[0]!.balance : null;
    const withdrawals = (
      await this.database.execute<{ id: string; user_name: string; paid_on: string; amount: string; tax_amount: string; fee_amount: string; net_amount: string }>(sql`
      SELECT w.id::text, u.full_name AS user_name, w.paid_on::text, w.amount::text, w.tax_amount::text, w.fee_amount::text, w.net_amount::text
      FROM marketplace.withdrawals w JOIN core.users u ON u.id = w.user_id WHERE ${paidFilter} ORDER BY w.paid_on, u.full_name, w.id`)
    ).rows;
    return {
      from: query.from,
      to: query.to,
      groupBy: query.groupBy,
      currency: scope.group.currency,
      companies: scope.companies,
      summary: {
        credited: trimDecimal(totals.amount),
        creditedLines: totals.lines,
        pending: trimDecimal(pending.amount),
        paid: { count: paid.count, amount: trimDecimal(paid.amount), taxAmount: trimDecimal(paid.tax_amount), feeAmount: trimDecimal(paid.fee_amount), netAmount: trimDecimal(paid.net_amount) },
        pendingWithdrawals: { count: waiting.count, amount: trimDecimal(waiting.amount) },
        walletBalance: wallet === null ? null : trimDecimal(wallet),
      },
      rows: allRows ? rows : rows.slice(0, analyticsDisplayRows),
      withdrawals: (allRows ? withdrawals : withdrawals.slice(0, analyticsDisplayRows)).map((row) => ({
        id: row.id,
        userName: row.user_name,
        paidOn: row.paid_on,
        amount: trimDecimal(row.amount),
        taxAmount: trimDecimal(row.tax_amount),
        feeAmount: trimDecimal(row.fee_amount),
        netAmount: trimDecimal(row.net_amount),
      })),
      totalRows: rows.length > analyticsDisplayRows ? rows.length : null,
      totalWithdrawals: withdrawals.length > analyticsDisplayRows ? withdrawals.length : null,
    };
  }

  exportTables(report: AnalyticsCommissionResponse): ExportTable[] {
    const notes = [`Công ty: ${report.companies.map((company) => company.code).join(", ")}`, periodNote(report.from, report.to), `Đơn vị tiền: ${report.currency}`];
    return [
      {
        title: "Hoa hồng đã ghi có",
        notes,
        columns: [{ title: report.groupBy === "share" ? "Loại phần hưởng" : "Người hưởng" }, { title: "Số dòng hoa hồng", numeric: true }, { title: "Hoa hồng đã ghi có", numeric: true }],
        rows: report.rows.map((row) => [row.label, row.lines, row.amount]),
        totals: [["Tổng", report.summary.creditedLines, report.summary.credited]],
      },
      {
        title: "Rút tiền đã chi",
        notes,
        columns: [{ title: "Người hưởng" }, { title: "Ngày chi" }, ...["Số tiền", "Thuế thu nhập cá nhân", "Phí", "Thực nhận"].map((title) => ({ title, numeric: true }))],
        rows: report.withdrawals.map((row) => [row.userName, row.paidOn.split("-").reverse().join("/"), row.amount, row.taxAmount, row.feeAmount, row.netAmount]),
        totals: [["Tổng", null, report.summary.paid.amount, report.summary.paid.taxAmount, report.summary.paid.feeAmount, report.summary.paid.netAmount]],
      },
    ];
  }
}
